#!/usr/bin/env node
/**
 * Pre-specified Phase-2 dramatic-recognition production batch runner.
 *
 * This does not invent a new generator or scorer. It orchestrates the existing
 * bilateral drama generator plus the Phase-2 poetics scorer into one explicit
 * batch shape:
 *   - repeated v3 positive targets, paired none vs reframe from fixed prefixes
 *   - fresh D4 flat and D10 emphatic-trap controls per repeat
 *   - an uncued v3 stress slice retained in the same artifact tree
 *   - Qwen + Gemini critics by default
 *
 * Usage:
 *   node scripts/run-poetics-production-batch.js --dry-run
 *   node scripts/run-poetics-production-batch.js --batch-id phase2-production-v1
 *   node scripts/run-poetics-production-batch.js --mock --root-dir /tmp/poetics-smoke --repeats 1 --force
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const CAL_DIR = path.join(ROOT, 'config', 'poetics-calibration');
const DEFAULT_BATCH_ID = 'phase2-production-v1';
const DEFAULT_CRITICS = ['qwen/qwen3.5-plus-02-15', 'google/gemini-3.5-flash'];

const V3_TARGETS = 'D7,D9,D11,D14,D17,D18';
const V3_STRESS = 'D8,D12,D13,D15,D16';
const V3_SPEC = path.join(CAL_DIR, 'phase2-dramas-v3.yaml');
const V2_SPEC = path.join(CAL_DIR, 'phase2-dramas-v2.yaml');

function parseArgs(argv) {
  const args = {
    batchId: DEFAULT_BATCH_ID,
    rootDir: null,
    generator: 'codex',
    repeats: 3,
    stressRepeats: 1,
    critics: DEFAULT_CRITICS,
    maxTurns: 3,
    targetSpec: V3_SPEC,
    targetOnly: V3_TARGETS,
    targetTidStart: 6,
    stressSpec: V3_SPEC,
    stressOnly: V3_STRESS,
    stressTidStart: 6,
    dryRun: false,
    mock: false,
    force: false,
    skipGenerate: false,
    skipScore: false,
    allowQualityWarnings: false,
    only: null,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--batch-id') args.batchId = argv[++i];
    else if (t === '--root-dir') args.rootDir = path.resolve(argv[++i]);
    else if (t === '--generator') args.generator = argv[++i];
    else if (t === '--repeats') args.repeats = parseInt(argv[++i], 10);
    else if (t === '--stress-repeats') args.stressRepeats = parseInt(argv[++i], 10);
    else if (t === '--critics') args.critics = splitCsv(argv[++i]);
    else if (t === '--max-turns') args.maxTurns = parseInt(argv[++i], 10);
    else if (t === '--target-spec') args.targetSpec = path.resolve(argv[++i]);
    else if (t === '--target-only') args.targetOnly = argv[++i];
    else if (t === '--target-tid-start') args.targetTidStart = parseInt(argv[++i], 10);
    else if (t === '--stress-spec') args.stressSpec = path.resolve(argv[++i]);
    else if (t === '--stress-only') args.stressOnly = argv[++i];
    else if (t === '--stress-tid-start') args.stressTidStart = parseInt(argv[++i], 10);
    else if (t === '--dry-run') args.dryRun = true;
    else if (t === '--mock') args.mock = true;
    else if (t === '--force') args.force = true;
    else if (t === '--skip-generate') args.skipGenerate = true;
    else if (t === '--skip-score') args.skipScore = true;
    else if (t === '--allow-quality-warnings') args.allowQualityWarnings = true;
    else if (t === '--only') args.only = new Set(splitCsv(argv[++i]));
    else if (t === '--json') args.json = true;
    else throw new Error(`unknown arg: ${t}`);
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(args.batchId)) throw new Error('--batch-id must be path-safe');
  if (!['codex', 'claude'].includes(args.generator)) throw new Error('--generator must be codex|claude');
  if (!Number.isInteger(args.repeats) || args.repeats < 1) throw new Error('--repeats must be a positive integer');
  if (!Number.isInteger(args.stressRepeats) || args.stressRepeats < 0) {
    throw new Error('--stress-repeats must be a non-negative integer');
  }
  if (!Number.isInteger(args.maxTurns) || args.maxTurns < 1) throw new Error('--max-turns must be positive');
  if (!fs.existsSync(args.targetSpec)) throw new Error(`--target-spec not found: ${args.targetSpec}`);
  if (!args.targetOnly) throw new Error('--target-only must name at least one drama id');
  if (!Number.isInteger(args.targetTidStart) || args.targetTidStart < 0) {
    throw new Error('--target-tid-start must be a non-negative integer');
  }
  if (!fs.existsSync(args.stressSpec)) throw new Error(`--stress-spec not found: ${args.stressSpec}`);
  if (!Number.isInteger(args.stressTidStart) || args.stressTidStart < 0) {
    throw new Error('--stress-tid-start must be a non-negative integer');
  }
  if (!args.critics.length) throw new Error('--critics must name at least one critic');
  args.rootDir = args.rootDir || path.join(CAL_DIR, args.batchId);
  return args;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function repeatLabel(i) {
  return `r${String(i).padStart(2, '0')}`;
}

function modelSlug(model) {
  return String(model)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function rel(p) {
  return path.relative(ROOT, p);
}

function buildPlan(rawArgs = {}) {
  const args = {
    ...parseArgs([]),
    ...rawArgs,
  };
  args.rootDir = args.rootDir ? path.resolve(args.rootDir) : path.join(CAL_DIR, args.batchId);
  if (!args.critics?.length) args.critics = DEFAULT_CRITICS;

  const units = [];
  for (let i = 1; i <= args.repeats; i++) {
    const r = repeatLabel(i);
    units.push({
      id: `target-${r}`,
      kind: 'target',
      repeat: r,
      spec: args.targetSpec,
      tidStart: args.targetTidStart,
      only: args.targetOnly,
      pairedPolicies: ['none', 'reframe'],
      directorRevisitAnchor: 'misframing-candidate',
      outDir: path.join(args.rootDir, `target-${r}`, 'sample'),
      delibDir: path.join(args.rootDir, `target-${r}`, 'deliberation'),
      transcriptsDir: path.join(args.rootDir, `target-${r}`, 'transcripts'),
      keyPath: path.join(args.rootDir, `target-${r}`, 'key.yaml'),
    });
    units.push({
      id: `control-${r}-d4`,
      kind: 'control',
      control: 'd4-flat',
      repeat: r,
      spec: V2_SPEC,
      only: 'D4',
      outDir: path.join(args.rootDir, `control-${r}`, 'd4', 'sample'),
      delibDir: path.join(args.rootDir, `control-${r}`, 'd4', 'deliberation'),
      transcriptsDir: path.join(args.rootDir, `control-${r}`, 'd4', 'transcripts'),
      keyPath: path.join(args.rootDir, `control-${r}`, 'd4', 'key.yaml'),
    });
    units.push({
      id: `control-${r}-d10-emphatic`,
      kind: 'control',
      control: 'd10-emphatic-trap',
      repeat: r,
      spec: V3_SPEC,
      tidStart: 6,
      only: 'D10',
      outDir: path.join(args.rootDir, `control-${r}`, 'd10-emphatic', 'sample'),
      delibDir: path.join(args.rootDir, `control-${r}`, 'd10-emphatic', 'deliberation'),
      transcriptsDir: path.join(args.rootDir, `control-${r}`, 'd10-emphatic', 'transcripts'),
      keyPath: path.join(args.rootDir, `control-${r}`, 'd10-emphatic', 'key.yaml'),
    });
  }

  for (let i = 1; i <= args.stressRepeats; i++) {
    const r = repeatLabel(i);
    units.push({
      id: `stress-${r}`,
      kind: 'stress',
      repeat: r,
      spec: args.stressSpec,
      tidStart: args.stressTidStart,
      only: args.stressOnly,
      outDir: path.join(args.rootDir, `stress-${r}`, 'sample'),
      delibDir: path.join(args.rootDir, `stress-${r}`, 'deliberation'),
      transcriptsDir: path.join(args.rootDir, `stress-${r}`, 'transcripts'),
      keyPath: path.join(args.rootDir, `stress-${r}`, 'key.yaml'),
    });
  }

  const selected = args.only ? units.filter((unit) => args.only.has(unit.id)) : units;
  if (args.only && selected.length !== args.only.size) {
    const found = new Set(selected.map((unit) => unit.id));
    const missing = [...args.only].filter((id) => !found.has(id));
    throw new Error(`unknown --only unit(s): ${missing.join(', ')}`);
  }

  return {
    batchId: args.batchId,
    rootDir: args.rootDir,
    generator: args.generator,
    repeats: args.repeats,
    stressRepeats: args.stressRepeats,
    maxTurns: args.maxTurns,
    critics: args.critics,
    allUnits: units,
    selectedUnitIds: selected.map((unit) => unit.id),
    units: selected,
  };
}

function generationCommand(unit, args) {
  const cmd = [
    process.execPath,
    'scripts/generate-pedagogical-dramas.js',
    '--generator',
    args.generator,
    '--spec',
    unit.spec,
    '--only',
    unit.only,
    '--max-turns',
    String(args.maxTurns),
    '--out-dir',
    unit.outDir,
    '--delib-dir',
    unit.delibDir,
    '--transcripts-dir',
    unit.transcriptsDir,
    '--key',
    unit.keyPath,
  ];
  if (unit.tidStart != null) cmd.push('--tid-start', String(unit.tidStart));
  if (unit.pairedPolicies) {
    cmd.push('--paired-continuation-policies', unit.pairedPolicies.join(','));
    cmd.push('--director-revisit-anchor', unit.directorRevisitAnchor);
  }
  if (args.mock) cmd.push('--mock');
  if (args.force) cmd.push('--force');
  return cmd;
}

function scoreJobs(unit, args) {
  const arms = unit.pairedPolicies
    ? unit.pairedPolicies.map((policy) => ({
        id: `${unit.id}-${policy}`,
        sampleDir: path.join(unit.outDir, policy),
        keyPath: path.join(path.dirname(unit.keyPath), `key-${policy}.yaml`),
      }))
    : [{ id: unit.id, sampleDir: unit.outDir, keyPath: unit.keyPath }];
  const jobs = [];
  for (const arm of arms) {
    for (const critic of args.critics) {
      jobs.push({
        ...arm,
        critic,
        outPath: path.join(args.rootDir, 'scores', `${arm.id}-${modelSlug(critic)}.json`),
      });
    }
  }
  return jobs;
}

function scoreCommand(job, args) {
  const cmd = [
    process.execPath,
    'scripts/score-poetics-phase2.js',
    '--model',
    job.critic,
    '--sample-dir',
    job.sampleDir,
    '--key',
    job.keyPath,
    '--out',
    job.outPath,
  ];
  if (args.mock) cmd.push('--mock');
  if (args.allowQualityWarnings) cmd.push('--allow-quality-warnings');
  return cmd;
}

function printableCommand(cmd) {
  return cmd.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(' ');
}

function runCommand(cmd, args) {
  if (args.dryRun) {
    console.log(`  ${printableCommand(cmd)}`);
    return;
  }
  fs.mkdirSync(path.dirname(outputPathFromCommand(cmd)), { recursive: true });
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env },
  });
  if (result.status !== 0) {
    throw new Error(`command failed (${result.status}): ${printableCommand(cmd)}`);
  }
}

function outputPathFromCommand(cmd) {
  const outIndex = cmd.indexOf('--out');
  if (outIndex !== -1) return cmd[outIndex + 1];
  const keyIndex = cmd.indexOf('--key');
  if (keyIndex !== -1) return cmd[keyIndex + 1];
  return path.join(ROOT, 'exports', 'unused.json');
}

function writePlan(plan, args) {
  if (args.dryRun) return;
  fs.mkdirSync(args.rootDir, { recursive: true });
  const saved = {
    ...plan,
    rootDir: rel(plan.rootDir),
    allUnits: undefined,
    selectedUnitIds: undefined,
    units: plan.allUnits.map((unit) => ({
      ...unit,
      spec: rel(unit.spec),
      outDir: rel(unit.outDir),
      delibDir: rel(unit.delibDir),
      transcriptsDir: rel(unit.transcriptsDir),
      keyPath: rel(unit.keyPath),
    })),
  };
  fs.writeFileSync(path.join(args.rootDir, 'batch-plan.json'), `${JSON.stringify(saved, null, 2)}\n`, 'utf8');
}

function summarizePlan(plan, args) {
  const nTargets = plan.units.filter((unit) => unit.kind === 'target').length;
  const nControls = plan.units.filter((unit) => unit.kind === 'control').length;
  const nStress = plan.units.filter((unit) => unit.kind === 'stress').length;
  console.log(`\n══ Poetics production batch ${plan.batchId} ══`);
  console.log(`  root: ${rel(plan.rootDir)}`);
  console.log(`  generator: ${plan.generator}${args.mock ? ' (mock)' : ''}`);
  console.log(`  units: ${plan.units.length} (${nTargets} target, ${nControls} control, ${nStress} stress)`);
  console.log(`  critics: ${plan.critics.join(', ')}`);
}

function runPlan(args) {
  const plan = buildPlan(args);
  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  summarizePlan(plan, args);
  writePlan(plan, args);

  if (!args.skipGenerate) {
    console.log('\n── generation ──');
    for (const unit of plan.units) {
      console.log(`\n# ${unit.id}`);
      runCommand(generationCommand(unit, args), args);
    }
  }

  if (!args.skipScore) {
    console.log('\n── scoring ──');
    if (!args.dryRun) fs.mkdirSync(path.join(args.rootDir, 'scores'), { recursive: true });
    for (const unit of plan.units) {
      for (const job of scoreJobs(unit, args)) {
        console.log(`\n# ${job.id} · ${job.critic}`);
        runCommand(scoreCommand(job, args), args);
      }
    }
  }

  if (!args.dryRun) {
    console.log(`\nwrote batch plan → ${rel(path.join(args.rootDir, 'batch-plan.json'))}`);
    console.log(`scores dir       → ${rel(path.join(args.rootDir, 'scores'))}`);
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    runPlan(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export { buildPlan, generationCommand, modelSlug, parseArgs, scoreCommand, scoreJobs };
