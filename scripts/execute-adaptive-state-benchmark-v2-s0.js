#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
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
  sha256,
} from '../services/experimentRunArtifacts.js';
import {
  buildAdaptiveStateCriticalPathPlan,
  validateAdaptiveStateCriticalPathPlan,
} from '../services/adaptiveTutor/stateBenchmarkV2.js';
import {
  ADAPTIVE_STATE_STAGE0_ANALYZER_SOURCE_FILES,
  buildAdaptiveStateStage0Dataset,
  validateAdaptiveStateStage0DatasetContentSha256,
} from '../services/adaptiveTutor/stateBenchmarkStage0Executor.js';
import {
  buildAdaptiveStateStage0Report,
  buildAdaptiveStateStage0SplitManifest,
  validateAdaptiveStateStage0ReportContentSha256,
  validateAdaptiveStateStage0SplitManifestContentSha256,
} from '../services/adaptiveTutor/stateBenchmarkStage0Analysis.js';
import { adaptiveStateLearnerKernel } from '../services/adaptiveTutor/learnerKernels/index.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');
const DEFAULT_OUT = path.join(ROOT, 'exports', 'adaptive-state-benchmark-v2');
const EXECUTOR = path.join(ROOT, 'services', 'adaptiveTutor', 'stateBenchmarkStage0Executor.js');
const REALIZER = path.join(ROOT, 'services', 'adaptiveTutor', 'stateBenchmarkDeterministicRealizer.js');
const BENCHMARK = path.join(ROOT, 'services', 'adaptiveTutor', 'stateBenchmarkV2.js');

function arg(argv, name, fallback = null) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : fallback;
}

function has(argv, name) {
  return argv.includes(`--${name}`);
}

function resolveFromRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function usage() {
  return `Usage: node scripts/execute-adaptive-state-benchmark-v2-s0.js [options]

Executes the frozen no-cost Stage-0 matrix, replays it, fits the diagnostic
world-transfer no-state head, and seals a non-confirmatory contract report.

Options:
  --label <id>       Default: adaptive-state-v2-s0-contract
  --run-seed <n>     Immutable artifact job-order seed. Default: 20260711
  --config <path>    Default: config/adaptive-state-benchmark-v2.yaml
  --out <dir>        Default: exports/adaptive-state-benchmark-v2
  --help             Show this help
`;
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite frozen Stage-0 artifact at ${filePath}`);
    throw error;
  }
  return { path: filePath, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

function jsonl(rows) {
  return rows.map((row) => canonicalJson(row)).join('\n') + '\n';
}

function aggregateFileHash(paths) {
  return hashCanonicalJson(
    [...new Set(paths)].sort().map((file) => ({ path: file, sha256: hashFile(resolveFromRoot(file)) })),
  );
}

function executionRunPlan({ plan, config, configPath, runSeed }) {
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  return buildExperimentRunPlan({
    runId: plan.label,
    runner: path.relative(ROOT, SCRIPT),
    provenance: { git },
    models: {
      learner_realizer: {
        requested: 'deterministic-stage0-crossed-set',
        resolved: 'deterministic-stage0-crossed-set',
        observed: null,
        allowedObservedModels: plan.jobs.map((job) => job.language_realizer.model_ref),
      },
    },
    requiredObservedModelRoles: [],
    hashes: {
      runner: aggregateFileHash([
        path.relative(ROOT, SCRIPT),
        path.relative(ROOT, EXECUTOR),
        path.relative(ROOT, BENCHMARK),
      ]),
      analyzer: aggregateFileHash(ADAPTIVE_STATE_STAGE0_ANALYZER_SOURCE_FILES),
      policy: aggregateFileHash(
        config.critical_path.latent_generators.flatMap(
          (row) => adaptiveStateLearnerKernel(row.id).metadata.source_files,
        ),
      ),
      profile: hashCanonicalJson(config.complexity_cap),
      prompt: hashFile(REALIZER),
      world: aggregateFileHash(config.critical_path.worlds.map((row) => row.source)),
      config: hashFile(configPath),
    },
    masterSeed: runSeed,
    jobs: plan.jobs,
    lineage: { parentRunId: null, resumeOf: null, supersedes: [] },
    intent: {
      criticalPath: plan,
      claimBoundary: config.claim_boundary,
      executionBoundary:
        'Zero model calls. Stage 0 validates deterministic data, controls, replay, and oracle alignment only.',
    },
    metadata: {
      benchmarkSchema: config.schema,
      benchmarkVersion: config.version,
      observationChannelVersion: '2.3',
      stage: 's0_contract',
      paid: false,
      expectedModelCalls: 0,
      designSha256: plan.design_sha256,
    },
  });
}

export function renderAdaptiveStateStage0Report(report) {
  const lines = [
    '# Adaptive learner-state benchmark v2.1 / exact observation channel v2.3 — Stage 0',
    '',
    `Status: **${report.status}**`,
    `Decision: \`${report.decision}\``,
    '',
    '## Contract checks',
    '',
    `- complete matrix: ${report.structural_audit.failures.includes('crossed_matrix_incomplete') ? 'fail' : 'pass'}`,
    `- leakage audit: ${report.structural_audit.leakage.count ? 'fail' : 'pass'}`,
    `- matched controls: ${Object.values(report.structural_audit.controls).some(Boolean) ? 'fail' : 'pass'}`,
    `- exact replay: ${report.deterministic_replay.passed ? 'pass' : 'fail'}`,
    `- fixed head converged: ${report.protocol.fixed_head.all_folds_converged ? 'pass' : 'fail'}`,
    '',
    '## Instrument sensitivity',
    '',
    ...Object.entries(report.instrument).map(
      ([target, row]) =>
        `- \`${target}\`: oracle ${row.oracle_beats_all_state_blind_baselines_on_both_metrics ? 'beats' : 'does not beat'} no-state, training-fold class-prior, and uniform on log loss and Brier`,
    ),
    '',
    ...(report.stop_reasons.length
      ? ['## Stop reasons', '', ...report.stop_reasons.map((reason) => `- \`${reason}\``), '']
      : []),
    '> This is a deterministic contract/instrument check. It is not the untouched S2 sensor verdict and makes no tutoring-efficacy or human-learning claim.',
    '',
    `Report SHA-256: \`${report.content_sha256}\``,
    '',
  ];
  return lines.join('\n');
}

function datasetManifest(dataset, files) {
  return {
    schema: 'machinespirits.adaptive-state-stage0-dataset-manifest.v2',
    version: dataset.version,
    stage: 's0_contract',
    confirmation_eligible: false,
    dataset_schema: dataset.schema,
    dataset_version: dataset.version,
    design_sha256: dataset.design_sha256,
    config_sha256: dataset.config_sha256,
    dataset_content_sha256: dataset.content_sha256,
    dialogues: dataset.dialogues.length,
    scored_transitions: dataset.rows.length,
    model_calls: dataset.model_call_count,
    deterministic_realizer_calls: dataset.deterministic_realizer_call_count,
    audit_world_local_fact_ids: [...dataset.world_local_fact_ids],
    files,
  };
}

async function main(argv = process.argv.slice(2)) {
  if (has(argv, 'help')) {
    process.stdout.write(usage());
    return;
  }
  const configPath = resolveFromRoot(arg(argv, 'config', DEFAULT_CONFIG));
  const outRoot = resolveFromRoot(arg(argv, 'out', DEFAULT_OUT));
  const label = arg(argv, 'label', 'adaptive-state-v2-s0-contract');
  const runSeed = Number(arg(argv, 'run-seed', '20260711'));
  if (!Number.isSafeInteger(runSeed)) throw new Error('--run-seed must be a safe integer');
  const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
  const plan = buildAdaptiveStateCriticalPathPlan(config, { stage: 's0_contract', label });
  validateAdaptiveStateCriticalPathPlan(plan);
  const runDir = path.join(outRoot, label);
  createRunPlan(runDir, executionRunPlan({ plan, config, configPath, runSeed }));
  writeExclusive(
    path.join(runDir, 'critical-path-plan.json'),
    canonicalJson(plan, { space: 2, trailingNewline: true }),
  );
  appendRunEvent(runDir, {
    type: 'stage0_execution_started',
    dialogueJobs: plan.counts.dialogue_jobs,
    scoredTransitions: plan.counts.scored_transitions,
    expectedModelCalls: 0,
  });

  const dataset = buildAdaptiveStateStage0Dataset({ plan, config, repoRoot: ROOT });
  validateAdaptiveStateStage0DatasetContentSha256(dataset);
  const replayed = buildAdaptiveStateStage0Dataset({ plan, config, repoRoot: ROOT });
  validateAdaptiveStateStage0DatasetContentSha256(replayed);
  const replay = {
    schema: 'machinespirits.adaptive-state-stage0-replay.v2',
    passed: dataset.content_sha256 === replayed.content_sha256,
    first_sha256: dataset.content_sha256,
    replay_sha256: replayed.content_sha256,
  };

  const dialoguesFile = writeExclusive(path.join(runDir, 'dialogues.jsonl'), jsonl(dataset.dialogues));
  const rowsFile = writeExclusive(path.join(runDir, 'benchmark-rows.jsonl'), jsonl(dataset.rows));
  const splitManifest = buildAdaptiveStateStage0SplitManifest(dataset.rows, config);
  validateAdaptiveStateStage0SplitManifestContentSha256(splitManifest);
  const splitFile = writeExclusive(
    path.join(runDir, 'split-manifest.json'),
    canonicalJson(splitManifest, { space: 2, trailingNewline: true }),
  );
  writeExclusive(path.join(runDir, 'replay.json'), canonicalJson(replay, { space: 2, trailingNewline: true }));
  const manifest = datasetManifest(dataset, {
    dialogues_jsonl: { path: 'dialogues.jsonl', sha256: dialoguesFile.sha256, bytes: dialoguesFile.bytes },
    benchmark_rows_jsonl: { path: 'benchmark-rows.jsonl', sha256: rowsFile.sha256, bytes: rowsFile.bytes },
    split_manifest: { path: 'split-manifest.json', sha256: splitFile.sha256, bytes: splitFile.bytes },
  });
  writeExclusive(
    path.join(runDir, 'dataset-manifest.json'),
    canonicalJson(manifest, { space: 2, trailingNewline: true }),
  );
  const report = buildAdaptiveStateStage0Report({ dataset, plan, config, splitManifest, replay });
  validateAdaptiveStateStage0ReportContentSha256(report);
  writeExclusive(
    path.join(runDir, 'stage0-contract-report.json'),
    canonicalJson(report, { space: 2, trailingNewline: true }),
  );
  writeExclusive(path.join(runDir, 'stage0-contract-report.md'), renderAdaptiveStateStage0Report(report));
  appendRunEvent(runDir, {
    type: 'stage0_contract_evaluated',
    status: report.status,
    decision: report.decision,
    datasetSha256: dataset.content_sha256,
    reportSha256: report.content_sha256,
    executedModelCalls: 0,
  });
  createRunSeal(runDir, {
    status: report.status === 'pass' ? 'complete' : 'stopped',
    metadata: {
      stage: 's0_contract',
      decision: report.decision,
      datasetSha256: dataset.content_sha256,
      reportSha256: report.content_sha256,
      executedModelCalls: 0,
    },
  });
  const verified = assertExperimentRun(runDir);
  process.stdout.write(
    `${report.status}: ${dataset.dialogues.length} dialogues, ${dataset.rows.length} transitions, 0 model calls\n`,
  );
  process.stdout.write(`${path.relative(ROOT, runDir)}\n`);
  process.stdout.write(`sealed evidence transaction verified: ${verified.inventory.length} artifacts\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
