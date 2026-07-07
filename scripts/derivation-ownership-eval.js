#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import {
  deriveObjectOwnershipState,
  summarizeOwnershipStates,
} from '../services/dramaticDerivation/objectOwnership.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'exports/dramatic-derivation/ownership-eval');
const DEFAULT_SEARCH_DIRS = [
  path.join(ROOT, 'exports/dramatic-derivation/loop'),
  path.join(ROOT, 'exports/dramatic-derivation/episodes'),
  path.join(ROOT, 'exports/dramatic-derivation/didactic-mode-candidate-gate/episodes'),
];

function usage() {
  return `Usage:
  node scripts/derivation-ownership-eval.js \\
    --pair <pair-id>=<s0-ref>,<s1-ref> [--pair ...] \\
    [--out exports/dramatic-derivation/ownership-eval]

Refs may be result.json files, run directories, or labels under the standard
derivation loop/episode artifact directories. The first label in each pair is
treated as S0 and the second as S1 for delta reporting.
`;
}

export function parsePairSpec(spec) {
  const splitAt = String(spec || '').indexOf('=');
  if (splitAt <= 0) throw new Error(`Invalid --pair ${JSON.stringify(spec)}. Expected id=s0,s1.`);
  const pairId = spec.slice(0, splitAt).trim();
  const refs = spec
    .slice(splitAt + 1)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!pairId || refs.length !== 2) throw new Error(`Invalid --pair ${JSON.stringify(spec)}. Expected id=s0,s1.`);
  if (refs[0] === refs[1]) throw new Error(`Invalid --pair ${JSON.stringify(spec)}. Refs must differ.`);
  return { pairId, refs };
}

export function parseArgs(argv = []) {
  const pairs = [];
  const opts = { out: DEFAULT_OUT, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, pairs, help: true };
    if (arg === '--pair') {
      pairs.push(parsePairSpec(argv[++i]));
      continue;
    }
    if (arg === '--out') {
      opts.out = path.resolve(ROOT, argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  return { ...opts, pairs };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveResultRef(ref) {
  const candidates = [];
  const resolved = path.resolve(ROOT, ref);
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    candidates.push(stat.isDirectory() ? path.join(resolved, 'result.json') : resolved);
  }
  for (const dir of DEFAULT_SEARCH_DIRS) {
    candidates.push(path.join(dir, ref, 'result.json'));
  }
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Could not resolve result ref ${ref}`);
  return found;
}

function allWorldFiles() {
  const dir = path.join(ROOT, 'config/drama-derivation');
  return fs
    .readdirSync(dir)
    .filter((name) => /^world-.+\.ya?ml$/u.test(name))
    .map((name) => path.join(dir, name));
}

function worldForId(worldId) {
  for (const file of allWorldFiles()) {
    const parsed = yaml.parse(fs.readFileSync(file, 'utf8'));
    if (parsed?.id === worldId) return { file, world: parsed };
  }
  throw new Error(`Could not find world file for ${worldId}`);
}

function premiseMap(world) {
  const map = new Map();
  for (const premise of Array.isArray(world?.premises) ? world.premises : []) {
    if (!premise?.id) continue;
    map.set(premise.id, {
      id: premise.id,
      surface: String(premise.surface || ''),
    });
  }
  return map;
}

function publicTranscriptLines(result) {
  return (Array.isArray(result?.transcript) ? result.transcript : [])
    .filter((line) => ['tutor', 'learner', 'stage', 'director'].includes(line?.role))
    .map((line) => ({
      turn: line.turn,
      role: line.role === 'director' ? 'stage' : line.role,
      text: String(line.text || '').trim(),
    }))
    .filter((line) => line.text);
}

function finalD(result) {
  const last = result?.trajectory?.[result.trajectory.length - 1];
  return Number.isFinite(last?.D) ? last.D : null;
}

function releaseSignature(result) {
  return (Array.isArray(result?.ledger) ? result.ledger : [])
    .map((entry) => `${entry.premiseId}@t${entry.turn}`)
    .join('|');
}

function objectWindow(lines, releaseTurn, nextReleaseTurn = null) {
  const end = Number.isFinite(nextReleaseTurn) ? nextReleaseTurn : releaseTurn + 6;
  return lines.filter((line) => line.role === 'learner' && line.turn >= releaseTurn && line.turn <= end);
}

function scoreReleasedObjects(result, world) {
  const premises = premiseMap(world);
  const lines = publicTranscriptLines(result);
  const ledger = (Array.isArray(result?.ledger) ? result.ledger : []).filter((entry) => premises.has(entry.premiseId));
  const states = [];
  for (let i = 0; i < ledger.length; i += 1) {
    const entry = ledger[i];
    const premise = premises.get(entry.premiseId);
    const nextReleaseTurn = ledger[i + 1]?.turn || null;
    const transcript = objectWindow(lines, entry.turn, nextReleaseTurn);
    const state = deriveObjectOwnershipState({
      currentObject: `${premise.id}: ${premise.surface.slice(0, 120)}`,
      objectSurface: premise.surface,
      transcript,
      recoveryProbe: transcript.some((line) => line.turn > entry.turn + 1),
    });
    states.push({
      premiseId: premise.id,
      releaseTurn: entry.turn,
      learnerTurns: transcript.map((line) => line.turn),
      ownershipLevel: state.ownershipLevel,
      score: state.score,
      maxScore: state.maxScore,
      gaps: state.gaps,
      echoOnly: state.echoOnly,
      auditClean: state.inputAudit?.ok === true && state.nonLeakAudit?.ok === true,
      evidence: state.evidence,
      probes: state.probes,
    });
  }
  return states;
}

function analyzeRun(ref) {
  const resultFile = resolveResultRef(ref);
  const result = readJson(resultFile);
  const { file: worldFile, world } = worldForId(result.worldId);
  const ownership = scoreReleasedObjects(result, world);
  return {
    ref,
    resultFile: path.relative(ROOT, resultFile),
    worldFile: path.relative(ROOT, worldFile),
    worldId: result.worldId,
    verdict: result.verdict,
    turnsPlayed: result.turnsPlayed,
    finalD: finalD(result),
    releaseSignature: releaseSignature(result),
    ownership,
    ownershipSummary: summarizeOwnershipStates(ownership),
  };
}

function comparePair(pair) {
  const s0 = analyzeRun(pair.refs[0]);
  const s1 = analyzeRun(pair.refs[1]);
  const reliabilityMatched =
    s0.verdict === s1.verdict && s0.finalD === s1.finalD && s0.releaseSignature === s1.releaseSignature;
  const meanDelta = s1.ownershipSummary.meanScore - s0.ownershipSummary.meanScore;
  const ownershipGain = reliabilityMatched && meanDelta >= 0.5;
  return {
    pairId: pair.pairId,
    s0,
    s1,
    comparison: {
      reliabilityMatched,
      sameVerdict: s0.verdict === s1.verdict,
      sameFinalD: s0.finalD === s1.finalD,
      sameReleaseSignature: s0.releaseSignature === s1.releaseSignature,
      meanOwnershipDelta: meanDelta,
      ownershipGain,
      decision: ownershipGain
        ? 'eligible_for_replay_gate'
        : reliabilityMatched
          ? 'matched_reliability_no_ownership_gain'
          : 'not_matched_reliability',
    },
  };
}

function mdTableRow(pair) {
  return `| ${pair.pairId} | ${pair.s0.verdict} | ${pair.s1.verdict} | ${pair.s0.finalD} | ${pair.s1.finalD} | ${pair.comparison.reliabilityMatched ? 'yes' : 'no'} | ${pair.s0.ownershipSummary.meanScore.toFixed(2)} | ${pair.s1.ownershipSummary.meanScore.toFixed(2)} | ${pair.comparison.meanOwnershipDelta.toFixed(2)} | ${pair.comparison.decision} |`;
}

function renderMarkdown(report) {
  const lines = [
    '# Derivation Ownership Evaluation',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Boundary',
    '',
    '- Zero-paid artifact analysis only.',
    '- The scorer uses released public premise surfaces and public learner transcript lines.',
    '- It does not alter hidden + proofDebt, conduct policy, selector state, or runtime defaults.',
    '',
    '## Pair Summary',
    '',
    '| Pair | S0 verdict | S1 verdict | S0 D | S1 D | Reliability matched | S0 mean ownership | S1 mean ownership | Delta | Decision |',
    '|---|---|---|---:|---:|---|---:|---:|---:|---|',
    ...report.pairs.map(mdTableRow),
    '',
    '## Interpretation',
    '',
  ];
  if (report.pairs.some((pair) => pair.comparison.ownershipGain)) {
    lines.push(
      'At least one pair shows a coarse ownership gain at matched proof reliability. That is enough to justify a tighter replay gate, not a paid run by itself.',
    );
  } else {
    lines.push(
      'No pair shows a coarse ownership gain at matched proof reliability. Under the current evaluator, these overlays remain null for learner ownership even when they are proof-safe.',
    );
  }
  lines.push('', '## Pair Details', '');
  for (const pair of report.pairs) {
    lines.push(`### ${pair.pairId}`, '');
    for (const arm of ['s0', 's1']) {
      const run = pair[arm];
      lines.push(
        `- ${arm.toUpperCase()}: ${run.ref}`,
        `- verdict: ${run.verdict}; final D: ${run.finalD}; mean ownership: ${run.ownershipSummary.meanScore.toFixed(2)}`,
        `- levels: ${JSON.stringify(run.ownershipSummary.byLevel)}`,
        `- gaps: ${JSON.stringify(run.ownershipSummary.byGap)}`,
        '',
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export function buildOwnershipReport(pairs) {
  return {
    schema: 'dramatic-derivation.ownership-eval-report.v0',
    generatedAt: new Date().toISOString(),
    pairs: pairs.map(comparePair),
  };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (opts.help) {
    console.log(usage());
    return;
  }
  if (!opts.pairs.length) {
    console.error(`At least one --pair is required.\n${usage()}`);
    process.exit(1);
  }
  const report = buildOwnershipReport(opts.pairs);
  atomicWrite(path.join(opts.out, 'ownership-eval-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(path.join(opts.out, 'ownership-eval-report.md'), renderMarkdown(report));
  console.log(`ownership eval wrote ${path.relative(ROOT, opts.out)}/ownership-eval-report.{json,md}`);
  for (const pair of report.pairs) {
    console.log(`${pair.pairId}: ${pair.comparison.decision} delta=${pair.comparison.meanOwnershipDelta.toFixed(2)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
