import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { factKey, proofTree } from './chainer.js';

export const LEAN_CERTIFICATE_SCHEMA = 'machinespirits.derivation.lean-certificate.v1';

function sanitizeIdentifierPart(value) {
  const text = String(value ?? 'empty')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  const safe = text || 'empty';
  return /^[A-Za-z_]/u.test(safe) ? safe : `x_${safe}`;
}

function factIdentifier(fact) {
  return `fact__${fact.map(sanitizeIdentifierPart).join('__')}`;
}

function theoremIdentifier(value) {
  return sanitizeIdentifierPart(String(value).replace(/-/gu, '_')).toLowerCase();
}

function formatFact(fact) {
  if (!Array.isArray(fact)) return String(fact ?? '');
  const [predicate, ...args] = fact;
  return args.length ? `${predicate}(${args.join(', ')})` : String(predicate ?? '');
}

function pathIdFor(pathSpec, index) {
  return pathSpec?.id || pathSpec?.name || pathSpec?.label || `path_${index + 1}`;
}

function premiseFact(world, premiseId) {
  const premise = world.premiseById.get(premiseId);
  if (!premise) throw new Error(`proof path references unknown premise "${premiseId}"`);
  return premise.fact;
}

function factsEqual(a, b) {
  return factKey(a) === factKey(b);
}

function collectProofFacts(node, facts = new Map()) {
  facts.set(factKey(node.fact), node.fact);
  if (!node.base) {
    for (const premise of node.premises) collectProofFacts(premise, facts);
  }
  return facts;
}

function collectBaseLeaves(node, leaves = new Map()) {
  if (node.base) {
    leaves.set(factKey(node.fact), node.fact);
    return leaves;
  }
  for (const premise of node.premises) collectBaseLeaves(premise, leaves);
  return leaves;
}

function collectApplications(node, applications = []) {
  if (node.base) return applications;
  for (const premise of node.premises) collectApplications(premise, applications);
  applications.push({
    rule: node.rule,
    premises: node.premises.map((premise) => premise.fact),
    output: node.fact,
  });
  return applications;
}

function premiseLabelForFact(world, fact) {
  for (const premise of world.premises || []) {
    if (factsEqual(premise.fact, fact)) return premise.id;
  }
  const backgroundIndex = (world.background || []).findIndex((candidate) => factsEqual(candidate, fact));
  if (backgroundIndex >= 0) return `background_${backgroundIndex + 1}`;
  return factIdentifier(fact);
}

function uniqueName(base, used) {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function theoremForPath(world, pathSpec, index) {
  const pathId = pathIdFor(pathSpec, index);
  const pathPremiseIds = Array.isArray(pathSpec?.premises) ? pathSpec.premises : [];
  const baseFacts = [...(world.background || []), ...pathPremiseIds.map((id) => premiseFact(world, id))];
  const tree = proofTree(baseFacts, world.rules || [], world.secret.fact);
  if (!tree) {
    const listed = pathPremiseIds.length ? pathPremiseIds.join(', ') : '(none)';
    throw new Error(`Lean certificate path "${pathId}" does not entail secret from premises: ${listed}`);
  }

  const baseLeaves = [...collectBaseLeaves(tree).values()];
  const applications = collectApplications(tree);
  const usedNames = new Set();
  const assumptionNameByKey = new Map();
  const ruleNameByIndex = new Map();
  const lines = [];

  lines.push(`/-- Authored positive certificate for ${world.id} ${pathId}. -/`);
  lines.push(`theorem authored_positive_proof_${theoremIdentifier(pathId)}`);

  for (const fact of baseLeaves) {
    const label = premiseLabelForFact(world, fact);
    const name = uniqueName(`h__${theoremIdentifier(label)}`, usedNames);
    assumptionNameByKey.set(factKey(fact), name);
    lines.push(`  (${name} : ${factIdentifier(fact)})`);
  }

  applications.forEach((application, appIndex) => {
    const name = uniqueName(`rule__${theoremIdentifier(application.rule)}__${appIndex + 1}`, usedNames);
    ruleNameByIndex.set(appIndex, name);
    const premiseTypes = application.premises.map(factIdentifier).join(' -> ');
    const signature = premiseTypes
      ? `${premiseTypes} -> ${factIdentifier(application.output)}`
      : factIdentifier(application.output);
    lines.push(`  (${name} : ${signature})`);
  });

  lines.push(`  : ${factIdentifier(world.secret.fact)} := by`);

  const derivedNameByKey = new Map(assumptionNameByKey);
  let appCursor = 0;
  const emitProof = (node) => {
    const key = factKey(node.fact);
    if (derivedNameByKey.has(key)) return derivedNameByKey.get(key);
    const premiseNames = node.premises.map(emitProof);
    const ruleName = ruleNameByIndex.get(appCursor);
    appCursor += 1;
    const haveName = uniqueName(`h__${factIdentifier(node.fact).replace(/^fact__/u, '')}`, usedNames);
    lines.push(
      `  have ${haveName} : ${factIdentifier(node.fact)} := ${[ruleName, ...premiseNames].join(' ')}`,
    );
    derivedNameByKey.set(key, haveName);
    return haveName;
  };

  const finalName = emitProof(tree);
  lines.push(`  exact ${finalName}`);

  return {
    pathId,
    premiseIds: pathPremiseIds,
    proofFacts: [...collectProofFacts(tree).values()],
    lean: lines.join('\n'),
  };
}

export function generateLeanCertificate(world, { sourcePath = null } = {}) {
  const theoremBlocks = [];
  const allFacts = new Map();
  const pathSummaries = [];

  (world.proofPaths || []).forEach((pathSpec, index) => {
    const theorem = theoremForPath(world, pathSpec, index);
    theoremBlocks.push(theorem.lean);
    pathSummaries.push({
      pathId: theorem.pathId,
      premiseIds: theorem.premiseIds,
      proofFactCount: theorem.proofFacts.length,
    });
    for (const fact of theorem.proofFacts) allFacts.set(factKey(fact), fact);
  });

  allFacts.set(factKey(world.secret.fact), world.secret.fact);
  const factDeclarations = [...allFacts.values()]
    .sort((a, b) => factIdentifier(a).localeCompare(factIdentifier(b)))
    .map((fact) => `/-- ${formatFact(fact)} -/\naxiom ${factIdentifier(fact)} : Prop`);

  const sourceLine = sourcePath ? `Source world: ${sourcePath}` : `Source world: ${world.id}`;
  const lean = [
    '/-',
    `Generated by scripts/check-proof-dag-lean.js.`,
    sourceLine,
    `Schema: ${LEAN_CERTIFICATE_SCHEMA}`,
    '',
    'This file is an optional authored-DAG certificate. It does not replace the',
    'runtime JS forward chainer used for learner entitlement.',
    '-/',
    '',
    'import ProofDag.Basic',
    '',
    'namespace ProofDag.Generated.World001Nocturne',
    '',
    ...factDeclarations,
    '',
    ...theoremBlocks,
    '',
    'end ProofDag.Generated.World001Nocturne',
    '',
  ].join('\n');

  return {
    schema: LEAN_CERTIFICATE_SCHEMA,
    worldId: world.id,
    theoremCount: theoremBlocks.length,
    pathSummaries,
    lean,
  };
}

export function writeLeanCertificate(filePath, lean) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const prior = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (prior !== lean) fs.writeFileSync(filePath, lean);
}

export function findLeanTool(name) {
  const envName = name === 'lake' ? 'LAKE_BIN' : name === 'lean' ? 'LEAN_BIN' : null;
  const candidates = [];
  if (envName && process.env[envName]) candidates.push(process.env[envName]);
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(dir, name));
  }
  candidates.push(path.join(os.homedir(), '.elan', 'bin', name));
  return candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

export function checkLeanCertificate({
  projectDir,
  leanFile,
  lakeBin = findLeanTool('lake'),
  timeoutMs = 30000,
} = {}) {
  if (!lakeBin) {
    return {
      ok: false,
      skipped: true,
      reason: 'lake not found on PATH or ~/.elan/bin',
    };
  }
  const relativeLeanFile = path.relative(projectDir, leanFile);
  const build = spawnSync(lakeBin, ['build'], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  if (build.error || build.status !== 0) {
    return {
      ok: false,
      skipped: false,
      command: `${lakeBin} build`,
      status: build.status,
      error: build.error?.message || null,
      stdout: build.stdout || '',
      stderr: build.stderr || '',
    };
  }

  const result = spawnSync(lakeBin, ['env', 'lean', relativeLeanFile], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  if (result.error) {
    return {
      ok: false,
      skipped: false,
      command: `${lakeBin} build && ${lakeBin} env lean ${relativeLeanFile}`,
      error: result.error.message,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  }
  return {
    ok: result.status === 0,
    skipped: false,
    command: `${lakeBin} build && ${lakeBin} env lean ${relativeLeanFile}`,
    status: result.status,
    stdout: [build.stdout, result.stdout].filter(Boolean).join('\n'),
    stderr: [build.stderr, result.stderr].filter(Boolean).join('\n'),
  };
}
