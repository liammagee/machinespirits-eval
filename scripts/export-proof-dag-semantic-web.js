#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { closure, factKey } from '../services/dramaticDerivation/chainer.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from '../services/dramaticDerivation/learnerDag.js';
import {
  buildLearnerProxyDagMemory,
  buildTutorLearnerDagModel,
} from '../services/dramaticDerivation/proxyDagMemory.js';
import {
  buildProofDagSemanticWebArtifacts,
  serializeProofDagJsonLd,
  serializeProofDagRdf,
} from '../services/dramaticDerivation/semanticWebProofDag.js';
import {
  loadProofDagShaclShapes,
  validateProofDagSemanticWebArtifacts,
} from '../services/dramaticDerivation/semanticWebValidation.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORLD = 'config/drama-derivation/world-001-nocturne.yaml';
const DEFAULT_OUTPUT = 'tools/proof-dag-semantic-web/Generated/World001Nocturne';
const AUTHORED_SHAPES = 'tools/proof-dag-semantic-web/shapes/authored.ttl';
const PUBLIC_SHAPES = 'tools/proof-dag-semantic-web/shapes/public-projections.ttl';

function usage() {
  return `Usage: node scripts/export-proof-dag-semantic-web.js [options]

Export and SHACL-validate the authored, learner-proxy, and tutor-model proof
DAGs for the deterministic Nocturne fixture.

Options:
  --world <path>       World YAML (default: ${DEFAULT_WORLD})
  --out-dir <path>     Artifact directory (default: ${DEFAULT_OUTPUT})
  --check              Validate and fail if checked-in artifacts are stale
  --help               Show this help
`;
}

export function parseProofDagSemanticWebArgs(argv) {
  const options = { world: DEFAULT_WORLD, outDir: DEFAULT_OUTPUT, check: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--check') options.check = true;
    else if (arg === '--world') options.world = argv[++index];
    else if (arg === '--out-dir') options.outDir = argv[++index];
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.world) throw new Error('--world requires a path');
  if (!options.outDir) throw new Error('--out-dir requires a path');
  return options;
}

function repoPath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function readableFact(fact) {
  if (!Array.isArray(fact) || !fact.length) return '';
  const [predicate, ...args] = fact;
  return args.length ? `${predicate}: ${args.join(', ')}` : String(predicate);
}

export function buildNocturneProofDagProjections(world, { turn = 26 } = {}) {
  const ledger = world.releaseSchedule
    .filter((entry) => entry.turn <= turn)
    .map((entry) => ({ premiseId: entry.premise, turn: entry.turn, via: entry.via }));
  const learnerPremises = ledger
    .map((entry) => world.premiseById.get(entry.premiseId))
    .filter((premise) => premise?.id?.startsWith('p_'));
  const groundedFacts = learnerPremises.map((premise) => premise.fact);
  const derived = closure(groundedFacts, world.rules);
  const voicedTargets = [
    ['writtenDuring', 'nocturne', 'floodWinter'],
    ['couldHaveWritten', 'liane', 'nocturne'],
    ['hadSourceOf', 'liane', 'nocturne'],
  ];
  const voiced = voicedTargets
    .filter((fact) => derived.facts.has(factKey(fact)))
    .map((fact) => ({ fact, turn: Math.max(1, turn - 1) }));
  const hypotheses = [
    { turn: 23, text: 'Liane had both opportunity and access, but the correcting hand is still missing.' },
  ];
  const snapshot = buildLearnerDagSnapshot(world, {
    turn,
    boardFacts: groundedFacts,
    validFacts: groundedFacts,
    voiced,
    hypotheses,
    ledger,
    source: 'semantic_web_nocturne_fixture',
  });
  const learnerDag = buildLearnerDag([snapshot], world);
  const surfaces = new Map(learnerPremises.map((premise) => [factKey(premise.fact), premise.surface]));
  const learnerProxyDag = buildLearnerProxyDagMemory({
    turn,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts,
    voiced,
    hypotheses,
    factSurface: (fact) => surfaces.get(factKey(fact)) || readableFact(fact),
  });
  const tutorLearnerDagModel = buildTutorLearnerDagModel({
    turn,
    role: 'tutor',
    proxyDagMemory: learnerProxyDag,
    assessment: learnerDag.assessment,
  });
  return { learnerProxyDag, tutorLearnerDagModel };
}

export async function buildNocturneProofDagSemanticWebBundle(worldPath = repoPath(DEFAULT_WORLD)) {
  const world = loadWorld(worldPath);
  const projections = buildNocturneProofDagProjections(world);
  const sourcePath = path.relative(ROOT, worldPath);
  const artifacts = await buildProofDagSemanticWebArtifacts({ world, sourcePath, ...projections });
  const validation = await validateProofDagSemanticWebArtifacts({
    artifacts,
    authoredShapes: loadProofDagShaclShapes(repoPath(AUTHORED_SHAPES)),
    publicShapes: loadProofDagShaclShapes(repoPath(PUBLIC_SHAPES)),
  });
  const files = {
    'authored.ttl': await serializeProofDagRdf(artifacts.authored.store),
    'authored.jsonld': serializeProofDagJsonLd(artifacts.authored.store),
    'learner-proxy.ttl': await serializeProofDagRdf(artifacts.learner.store),
    'learner-proxy.jsonld': serializeProofDagJsonLd(artifacts.learner.store),
    'tutor-model.ttl': await serializeProofDagRdf(artifacts.tutor.store),
    'tutor-model.jsonld': serializeProofDagJsonLd(artifacts.tutor.store),
    'proof-dags.trig': await serializeProofDagRdf(artifacts.combined, { format: 'TriG' }),
    'validation-report.json': `${JSON.stringify(validation, null, 2)}\n`,
  };
  return { world, projections, artifacts, validation, files };
}

function updateArtifacts(outputDir, files, { check }) {
  const stale = [];
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(outputDir, name);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (current === contents) continue;
    stale.push(name);
    if (!check) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    }
  }
  return stale;
}

export async function runProofDagSemanticWebExport(options) {
  const worldPath = repoPath(options.world);
  const outputDir = repoPath(options.outDir);
  const bundle = await buildNocturneProofDagSemanticWebBundle(worldPath);
  if (!bundle.validation.conforms) {
    throw new Error(`SHACL validation failed:\n${JSON.stringify(bundle.validation.graphs, null, 2)}`);
  }
  const stale = updateArtifacts(outputDir, bundle.files, options);
  if (options.check && stale.length) {
    throw new Error(`semantic-web proof-DAG artifacts are stale: ${stale.join(', ')}`);
  }
  return { ...bundle, outputDir, stale };
}

async function main() {
  const options = parseProofDagSemanticWebArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const result = await runProofDagSemanticWebExport(options);
  const action = options.check ? 'Checked' : result.stale.length ? 'Generated' : 'Unchanged';
  console.log(`${action} ${path.relative(ROOT, result.outputDir)} for ${result.world.id}.`);
  for (const [name, graph] of Object.entries(result.validation.graphs)) {
    console.log(`  ${name}: ${graph.quadCount} quads; SHACL ${graph.conforms ? 'conforms' : 'fails'}`);
  }
  console.log('Live JS proof entitlement remains unchanged; this is an optional export/check layer.');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
