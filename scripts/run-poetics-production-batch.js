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
 *   - Qwen 3.7 Max + Gemini + DeepSeek + Sonnet critics by default
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
import { createProgressReporter } from './progress.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const CAL_DIR = path.join(ROOT, 'config', 'poetics-calibration');
const DEFAULT_BATCH_ID = 'phase2-production-v1';
const DEFAULT_CRITICS = [
  'qwen/qwen3.7-max',
  'google/gemini-3.5-flash',
  'deepseek/deepseek-v4-pro',
  'anthropic/claude-sonnet-4.6',
];

const V3_TARGETS = 'D7,D9,D11,D14,D17,D18';
const V3_STRESS = 'D8,D12,D13,D15,D16';
const V3_SPEC = path.join(CAL_DIR, 'phase2-dramas-v3.yaml');
const V2_SPEC = path.join(CAL_DIR, 'phase2-dramas-v2.yaml');
const HARD_TRAPS_SPEC = path.join(CAL_DIR, 'phase2-dramas-hard-traps.yaml');
const CONTROL_UNITS = [
  {
    id: 'd4',
    segment: 'd4',
    control: 'd4-flat',
    spec: V2_SPEC,
    only: 'D4',
    variationKind: 'control-d4',
  },
  {
    id: 'd10-emphatic',
    segment: 'd10-emphatic',
    control: 'd10-boundary-trap',
    spec: V3_SPEC,
    only: 'D10',
    tidStart: 6,
    variationKind: 'control-d10-emphatic',
  },
  {
    id: 'd25-hard-trap',
    segment: 'd25-hard-trap',
    control: 'd25-hard-trap',
    spec: HARD_TRAPS_SPEC,
    only: 'D25',
    variationKind: 'control-d25-hard-trap',
  },
  {
    id: 'd26-hard-trap',
    segment: 'd26-hard-trap',
    control: 'd26-hard-trap',
    spec: HARD_TRAPS_SPEC,
    only: 'D26',
    variationKind: 'control-d26-hard-trap',
  },
];

function variationKeyFor(args, repeat, unitKind) {
  return `${args.batchId}:${repeat}:${unitKind}`;
}

function parseArgs(argv) {
  const args = {
    batchId: DEFAULT_BATCH_ID,
    rootDir: null,
    generator: 'codex',
    repeats: 3,
    stressRepeats: 1,
    critics: DEFAULT_CRITICS,
    generationConcurrency: 1,
    scoreConcurrency: 3,
    structureCritic: 'off',
    structureCriticConcurrency: 1,
    failOnStructureCritic: false,
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
    skipExistingScores: false,
    allowQualityWarnings: false,
    adaptationArms: false,
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
    else if (t === '--generation-concurrency') args.generationConcurrency = parseInt(argv[++i], 10);
    else if (t === '--score-concurrency') args.scoreConcurrency = parseInt(argv[++i], 10);
    else if (t === '--structure-critic') args.structureCritic = argv[++i];
    else if (t === '--structure-critic-concurrency') args.structureCriticConcurrency = parseInt(argv[++i], 10);
    else if (t === '--fail-on-structure-critic') args.failOnStructureCritic = true;
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
    else if (t === '--skip-existing-scores') args.skipExistingScores = true;
    else if (t === '--allow-quality-warnings') args.allowQualityWarnings = true;
    else if (t === '--adaptation-arms') args.adaptationArms = true;
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
  if (!Number.isInteger(args.generationConcurrency) || args.generationConcurrency < 1) {
    throw new Error('--generation-concurrency must be a positive integer');
  }
  if (!Number.isInteger(args.scoreConcurrency) || args.scoreConcurrency < 1) {
    throw new Error('--score-concurrency must be a positive integer');
  }
  if (!['off', 'rules', 'codex', 'claude', 'claude-code'].includes(args.structureCritic)) {
    throw new Error('--structure-critic must be off|rules|codex|claude|claude-code');
  }
  if (!Number.isInteger(args.structureCriticConcurrency) || args.structureCriticConcurrency < 1) {
    throw new Error('--structure-critic-concurrency must be a positive integer');
  }
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
  const pairedTargetArms = args.adaptationArms
    ? [
        'routine',
        'none',
        'reframe-only',
        'tutor-uptake-only',
        'reframe+tutor-uptake',
        'peripeteia-only',
        'reframe+peripeteia',
      ]
    : ['none', 'reframe'];
  for (let i = 1; i <= args.repeats; i++) {
    const r = repeatLabel(i);
    units.push({
      id: `target-${r}`,
      kind: 'target',
      repeat: r,
      spec: args.targetSpec,
      tidStart: args.targetTidStart,
      only: args.targetOnly,
      pairedPolicies: pairedTargetArms,
      pairedAdaptationArms: args.adaptationArms,
      directorRevisitAnchor: 'misframing-candidate',
      directorVariationKey: variationKeyFor(args, r, 'target'),
      outDir: path.join(args.rootDir, `target-${r}`, 'sample'),
      delibDir: path.join(args.rootDir, `target-${r}`, 'deliberation'),
      transcriptsDir: path.join(args.rootDir, `target-${r}`, 'transcripts'),
      keyPath: path.join(args.rootDir, `target-${r}`, 'key.yaml'),
    });
    for (const control of CONTROL_UNITS) {
      units.push({
        id: `control-${r}-${control.id}`,
        kind: 'control',
        control: control.control,
        repeat: r,
        spec: control.spec,
        ...(control.tidStart != null ? { tidStart: control.tidStart } : {}),
        only: control.only,
        directorVariationKey: variationKeyFor(args, r, control.variationKind),
        outDir: path.join(args.rootDir, `control-${r}`, control.segment, 'sample'),
        delibDir: path.join(args.rootDir, `control-${r}`, control.segment, 'deliberation'),
        transcriptsDir: path.join(args.rootDir, `control-${r}`, control.segment, 'transcripts'),
        keyPath: path.join(args.rootDir, `control-${r}`, control.segment, 'key.yaml'),
      });
    }
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
      directorVariationKey: variationKeyFor(args, r, 'stress'),
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
    generationConcurrency: args.generationConcurrency,
    scoreConcurrency: args.scoreConcurrency,
    structureCritic: args.structureCritic,
    structureCriticConcurrency: args.structureCriticConcurrency,
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
    '--generation-concurrency',
    String(args.generationConcurrency),
  ];
  if (unit.tidStart != null) cmd.push('--tid-start', String(unit.tidStart));
  if (unit.pairedPolicies) {
    cmd.push(
      unit.pairedAdaptationArms ? '--paired-adaptation-arms' : '--paired-continuation-policies',
      unit.pairedPolicies.join(','),
    );
    cmd.push('--director-revisit-anchor', unit.directorRevisitAnchor);
  }
  if (unit.directorVariationKey) cmd.push('--director-variation-key', unit.directorVariationKey);
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

function structureCriticJobs(unit, args) {
  const arms = unit.pairedPolicies
    ? unit.pairedPolicies.map((policy) => ({
        id: `${unit.id}-${policy}`,
        sampleDir: path.join(unit.outDir, policy),
        keyPath: path.join(path.dirname(unit.keyPath), `key-${policy}.yaml`),
      }))
    : [{ id: unit.id, sampleDir: unit.outDir, keyPath: unit.keyPath }];
  return arms.map((arm) => ({
    ...arm,
    critic: args.structureCritic,
    outPath: path.join(args.rootDir, 'structure-critic', `${arm.id}-${modelSlug(args.structureCritic)}.json`),
  }));
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
    '--concurrency',
    String(args.scoreConcurrency),
  ];
  if (args.mock) cmd.push('--mock');
  if (args.allowQualityWarnings) cmd.push('--allow-quality-warnings');
  return cmd;
}

function structureCriticCommand(job, args) {
  const critic = job.critic === 'claude' ? 'claude-code' : job.critic;
  const cmd = [
    process.execPath,
    'scripts/critic-poetics-structure.js',
    '--critic',
    critic,
    '--sample-dir',
    job.sampleDir,
    '--key',
    job.keyPath,
    '--out',
    job.outPath,
    '--concurrency',
    String(args.structureCriticConcurrency),
  ];
  if (args.mock) cmd.push('--mock');
  if (args.failOnStructureCritic) cmd.push('--fail-on-violation');
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
  console.log(`  generation concurrency: ${plan.generationConcurrency}`);
  console.log(`  units: ${plan.units.length} (${nTargets} target, ${nControls} control, ${nStress} stress)`);
  if (args.structureCritic !== 'off') console.log(`  structure critic: ${args.structureCritic}`);
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
    const generationProgress = createProgressReporter({
      label: 'batch generation',
      total: plan.units.length,
      enabled: !args.dryRun,
    });
    generationProgress.start(`${plan.units.length} unit(s)`);
    for (const unit of plan.units) {
      console.log(`\n# ${unit.id}`);
      generationProgress.note(`${unit.id} starting`);
      runCommand(generationCommand(unit, args), args);
      generationProgress.step(`${unit.id} complete`);
    }
    generationProgress.finish('generation stage complete');
  }

  if (args.structureCritic !== 'off') {
    console.log('\n── structural critic ──');
    if (!args.dryRun) fs.mkdirSync(path.join(args.rootDir, 'structure-critic'), { recursive: true });
    const jobs = plan.units.flatMap((unit) => structureCriticJobs(unit, args));
    const criticProgress = createProgressReporter({
      label: 'structure critic',
      total: jobs.length,
      enabled: !args.dryRun,
    });
    criticProgress.start(`${jobs.length} structure critic job(s)`);
    for (const job of jobs) {
      console.log(`\n# ${job.id} · ${job.critic}`);
      criticProgress.note(`${job.id} · ${job.critic} starting`);
      runCommand(structureCriticCommand(job, args), args);
      criticProgress.step(`${job.id} · ${job.critic} complete`);
    }
    criticProgress.finish('structural critic stage complete');
  }

  if (!args.skipScore) {
    console.log('\n── scoring ──');
    if (!args.dryRun) fs.mkdirSync(path.join(args.rootDir, 'scores'), { recursive: true });
    const jobs = plan.units.flatMap((unit) => scoreJobs(unit, args));
    const scoringProgress = createProgressReporter({
      label: 'batch scoring',
      total: jobs.length,
      enabled: !args.dryRun,
    });
    scoringProgress.start(`${jobs.length} scorer job(s)`);
    for (const job of jobs) {
      if (args.skipExistingScores && fs.existsSync(job.outPath)) {
        console.log(`\n# ${job.id} · ${job.critic} (skip existing)`);
        scoringProgress.step(`${job.id} · ${job.critic} skipped`);
        continue;
      }
      console.log(`\n# ${job.id} · ${job.critic}`);
      scoringProgress.note(`${job.id} · ${job.critic} starting`);
      runCommand(scoreCommand(job, args), args);
      scoringProgress.step(`${job.id} · ${job.critic} complete`);
    }
    scoringProgress.finish('scoring stage complete');
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

export {
  buildPlan,
  CONTROL_UNITS,
  DEFAULT_CRITICS,
  generationCommand,
  modelSlug,
  parseArgs,
  scoreCommand,
  scoreJobs,
  structureCriticCommand,
  structureCriticJobs,
};
