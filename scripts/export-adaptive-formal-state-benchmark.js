#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  canonicalJson,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  hashFile,
} from '../services/experimentRunArtifacts.js';
import {
  A21_LATENT_GENERATOR_FAMILY,
  DAG_DROPOUT_LATENT_GENERATOR_FAMILY,
  buildFormalStateBenchmarkDataset,
} from '../services/adaptiveTutor/formalStateBenchmark.js';
import {
  buildStateValiditySplitManifest,
  stateValidityGatePolicyFromConfig,
  validateLatentGeneratorFamilyClaim,
} from '../services/adaptiveTutor/stateValidityMetrics.js';
import { applyCrossDialoguePlacebos } from './export-adaptive-state-benchmark.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'adaptive-state-benchmark.yaml');
const DEFAULT_OUT = path.join(ROOT, 'exports', 'adaptive-state-benchmark');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/gu, '-');
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite formal benchmark artifact ${filePath}`);
    throw error;
  }
}

export function exportAdaptiveFormalStateBenchmark({ outDir, configPath = DEFAULT_CONFIG, runSeed = 20260711 } = {}) {
  const output = resolvePath(outDir || path.join(DEFAULT_OUT, `formal-instruments-${timestamp()}`));
  const configFile = resolvePath(configPath);
  const config = yaml.parse(fs.readFileSync(configFile, 'utf8'));
  const dataset = buildFormalStateBenchmarkDataset({ seed: runSeed });
  const rows = dataset.rows;
  applyCrossDialoguePlacebos(rows, runSeed);
  for (const row of rows) validateLatentGeneratorFamilyClaim(row);

  const holdoutAxes = config.splits?.group_axes || [
    'world',
    'scenario_family',
    'latent_generator_family',
    'learner_source',
    'model_family',
  ];
  const splitManifest = buildStateValiditySplitManifest(rows, {
    method: config.splits?.method || 'leave_one_group_level_out',
    atomicUnit: config.splits?.atomic_unit || 'dialogue_id',
    holdoutAxes,
    gatePolicy: stateValidityGatePolicyFromConfig(config),
  });
  const folds = splitManifest.folds;

  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  const plan = buildExperimentRunPlan({
    runId: path.basename(output),
    runner: 'scripts/export-adaptive-formal-state-benchmark.js',
    provenance: { git },
    models: { generator: { requested: 'node/offline', resolved: process.version, observed: process.version } },
    requiredObservedModelRoles: [],
    hashes: {
      runner: hashFile(SCRIPT),
      analyzer: hashFile(path.join(ROOT, 'services', 'adaptiveTutor', 'stateValidityMetrics.js')),
      policy: hashFile(path.join(ROOT, 'services', 'adaptiveTutor', 'actionPolicy.js')),
      profile: hashFile(path.join(ROOT, 'services', 'adaptiveTutor', 'formalStateBenchmark.js')),
      prompt: hashCanonicalJson({ languageRenderers: dataset.limitations }),
      world: hashCanonicalJson(rows.map((row) => row.groups.world).sort()),
      config: hashFile(configFile),
    },
    masterSeed: runSeed,
    jobs: [
      {
        id: A21_LATENT_GENERATOR_FAMILY,
        rows: rows.filter((row) => row.groups.latent_generator_family === A21_LATENT_GENERATOR_FAMILY).length,
      },
      {
        id: DAG_DROPOUT_LATENT_GENERATOR_FAMILY,
        rows: rows.filter((row) => row.groups.latent_generator_family === DAG_DROPOUT_LATENT_GENERATOR_FAMILY).length,
      },
    ],
    lineage: { parentRunId: null, resumeOf: null, supersedes: [] },
    intent: {
      predictionOrigin: config.prediction_origin,
      claimBoundary: config.claim_boundary,
      dataTier: 'formal_synthetic_instruments',
      latentGeneratorFamilies: dataset.latentGeneratorFamilies,
    },
    metadata: {
      bounded: true,
      rowCount: rows.length,
      limitations: dataset.limitations,
      benchmarkConfigSha256: hashFile(configFile),
    },
  });

  createRunPlan(output, plan);
  appendRunEvent(output, { type: 'formal_instrument_export_started', families: dataset.latentGeneratorFamilies });
  writeExclusive(path.join(output, 'benchmark.jsonl'), `${rows.map((row) => canonicalJson(row)).join('\n')}\n`);
  writeExclusive(
    path.join(output, 'split-manifest.json'),
    canonicalJson(splitManifest, { space: 2, trailingNewline: true }),
  );
  writeExclusive(
    path.join(output, 'benchmark-metadata.json'),
    canonicalJson(
      {
        schema: 'machinespirits.adaptive-state-benchmark-metadata.v1',
        dataTier: 'formal_synthetic_instruments',
        rowCount: rows.length,
        coverage: {
          worlds: [...new Set(rows.map((row) => row.groups.world))].sort(),
          latentGeneratorFamilies: dataset.latentGeneratorFamilies,
          learnerSources: [...new Set(rows.map((row) => row.groups.learner_source))].sort(),
          modelFamilies: [...new Set(rows.map((row) => row.groups.model_family))].sort(),
        },
        limitations: dataset.limitations,
      },
      { space: 2, trailingNewline: true },
    ),
  );
  appendRunEvent(output, { type: 'formal_instrument_export_completed', rows: rows.length, folds: folds.length });
  createRunSeal(output, {
    metadata: {
      rows: rows.length,
      folds: folds.length,
      claimStatus: 'synthetic_instrument_only',
    },
  });
  return { output, rows, splitManifest, verification: assertExperimentRun(output) };
}

function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      config: { type: 'string', default: DEFAULT_CONFIG },
      seed: { type: 'string', default: '20260711' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node scripts/export-adaptive-formal-state-benchmark.js [--out DIR] [--config YAML] [--seed N]');
    return;
  }
  const seed = Number(values.seed);
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('--seed must be a non-negative safe integer');
  const result = exportAdaptiveFormalStateBenchmark({ outDir: values.out, configPath: values.config, runSeed: seed });
  console.log(`exported ${result.rows.length} formal-instrument rows to ${result.output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}
