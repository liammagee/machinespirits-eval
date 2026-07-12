#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import {
  adaptiveStateCriticalPathSummary,
  buildAdaptiveStateCriticalPathPlan,
  validateAdaptiveStateCriticalPathPlan,
} from '../services/adaptiveTutor/stateBenchmarkV2.js';
import {
  assertAdaptiveStateS1PromotionParentAuthorization,
  validateAdaptiveStateS1PromotionParent,
} from '../services/adaptiveTutor/stateBenchmarkStage2Lineage.js';
import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  hashFile,
} from '../services/experimentRunArtifacts.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');
const DEFAULT_OUT = path.join(ROOT, 'exports', 'adaptive-state-benchmark-v2');
const ANALYZER = path.join(ROOT, 'services', 'adaptiveTutor', 'stateValidityMetricsV2.js');

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
  return `Usage: node scripts/run-adaptive-state-benchmark-v2.js [options]

This command freezes a balanced critical-path plan. It never makes model calls.

Options:
  --stage <name>       s0_contract, s1_technical_pilot, or s2_confirmation
  --per-cell <8>       Optional S2 assertion; confirmation is frozen at eight per cell
  --s0-parent <dir>    Required for S2: complete sealed current S0 run
  --parent <dir>       Required for S2: complete sealed paid S1 run
  --label <id>         Plan label. Default: adaptive-state-v2-<stage>
  --run-seed <n>       Immutable job-order seed. Default: 20260711
  --config <path>      Default: config/adaptive-state-benchmark-v2.yaml
  --out <dir>          Default: exports/adaptive-state-benchmark-v2
  --stdout             Print JSON without writing files
  --help               Show this help
`;
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite frozen benchmark plan at ${filePath}`);
    throw error;
  }
}

export function renderAdaptiveStateCriticalPathMarkdown(plan) {
  const summary = adaptiveStateCriticalPathSummary(plan);
  const lines = [
    `# Adaptive learner-state benchmark v2 — ${plan.label}`,
    '',
    `Stage: \`${summary.stage}\`; paid: **${summary.paid ? 'yes' : 'no'}**.`,
    '',
    '## Bounded design',
    '',
    `- ${summary.crossedCells} fully crossed world × generator × realizer cells`,
    `- ${summary.dialogues} dialogue jobs; ${summary.transitions} scored next-turn transitions`,
    `- ${summary.modelCalls} expected language-model calls`,
    `- ${summary.representationsPerTransition} offline representations evaluated on the same transitions`,
    `- co-primary targets: ${summary.primaryTargets.map((target) => `\`${target}\``).join(', ')}`,
    '',
    '## Axes',
    '',
    `- worlds: ${plan.axes.worlds.join(', ')}`,
    `- latent generators: ${plan.axes.latent_generators.join(', ')}`,
    `- realizers: ${plan.axes.realizers.join(', ')}`,
    '',
    '## Complexity boundary',
    '',
    '- no tutor-policy sweep',
    '- no learner-profile sweep',
    '- no judge-model sweep',
    '- no target expansion before untouched confirmation',
    '- confirmation stops at eight seeds per crossed cell',
    '',
    '## Stop rules',
    '',
    ...(plan.stop_rules.length ? plan.stop_rules.map((rule) => `- ${rule}`) : ['- none declared for this stage']),
    '',
    `Design SHA-256: \`${plan.design_sha256}\``,
    '',
    '> Planning only. This artifact does not execute a model, pass a sensor gate, or support an efficacy claim.',
    '',
  ];
  return lines.join('\n');
}

export function buildPlanArtifact({ config, configPath, stage, confirmationPerCell, label, promotionParent = null }) {
  if (stage === 's2_confirmation') assertAdaptiveStateS1PromotionParentAuthorization(promotionParent);
  if (
    stage === 's2_confirmation' &&
    confirmationPerCell !== null &&
    Number(confirmationPerCell) !== 8
  ) {
    throw new Error('S2 is frozen at --per-cell 8; no pilot-derived sample-size selection is permitted');
  }
  if (
    stage === 's2_confirmation' &&
    promotionParent.authorization.s1.config_sha256 !== hashCanonicalJson(config)
  ) {
    throw new Error('S2 planning requires an S1 parent produced under the current frozen config');
  }
  const plan = buildAdaptiveStateCriticalPathPlan(config, { stage, confirmationPerCell, label });
  validateAdaptiveStateCriticalPathPlan(plan);
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  return {
    ...plan,
    provenance: {
      git,
      config_path: path.relative(ROOT, configPath),
      config_sha256: hashFile(configPath),
      planner_path: path.relative(ROOT, SCRIPT),
      planner_sha256: hashFile(SCRIPT),
      ...(promotionParent
        ? {
            parent_s1_authorization_sha256: promotionParent.authorization.authorization_sha256,
            parent_s1_seal_sha256: promotionParent.authorization.s1.seal_sha256,
            sample_size_basis: promotionParent.authorization.sample_size_basis,
            power_claim: false,
          }
        : {}),
    },
  };
}

function hashFileSet(paths) {
  return hashCanonicalJson(
    [...new Set(paths)].sort().map((file) => ({ path: file, sha256: hashFile(resolveFromRoot(file)) })),
  );
}

function buildImmutablePlanningEnvelope(plan, { config, configPath, runSeed, promotionParent = null }) {
  const realizerModels = [...new Set(plan.jobs.map((job) => job.language_realizer.model_ref))].sort();
  return buildExperimentRunPlan({
    runId: plan.label,
    runner: path.relative(ROOT, SCRIPT),
    provenance: { git: plan.provenance.git },
    models: {
      learner_realizer: {
        requested: 'crossed-realizer-set',
        resolved: 'crossed-realizer-set',
        observed: null,
        allowedObservedModels: realizerModels,
      },
    },
    requiredObservedModelRoles: [],
    hashes: {
      runner: hashFile(SCRIPT),
      analyzer: hashFile(ANALYZER),
      policy: hashFileSet(config.critical_path.latent_generators.map((row) => row.source)),
      profile: hashCanonicalJson(config.complexity_cap),
      prompt: hashCanonicalJson(config.realizer_contract),
      world: hashFileSet(config.critical_path.worlds.map((row) => row.source)),
      config: hashFile(configPath),
    },
    masterSeed: runSeed,
    jobs: plan.jobs,
    lineage: {
      parentRunId: promotionParent?.authorization?.s1?.run_id || null,
      resumeOf: null,
      supersedes: [],
    },
    intent: {
      criticalPath: plan,
      ...(promotionParent ? { s2Authorization: promotionParent.authorization } : {}),
      claimBoundary: config.claim_boundary,
      executionBoundary: 'Planning transaction only; no transition or model call was executed.',
    },
    metadata: {
      benchmarkSchema: config.schema,
      benchmarkVersion: config.version,
      designSha256: plan.design_sha256,
      configSha256: plan.provenance.config_sha256,
      stage: plan.stage,
      paid: plan.paid,
      ...(promotionParent
        ? {
            selectedSeedsPerCell: promotionParent.authorization.selected_seeds_per_cell,
            s2AuthorizationSha256: promotionParent.authorization.authorization_sha256,
            parentS1SealSha256: promotionParent.authorization.s1.seal_sha256,
            sampleSizeBasis: promotionParent.authorization.sample_size_basis,
            powerClaimMade: false,
          }
        : {}),
    },
  });
}

async function main(argv = process.argv.slice(2)) {
  if (has(argv, 'help')) {
    process.stdout.write(usage());
    return;
  }
  const stage = arg(argv, 'stage', 's0_contract');
  const confirmationPerCell = arg(argv, 'per-cell', null);
  const runSeed = Number(arg(argv, 'run-seed', '20260711'));
  if (!Number.isSafeInteger(runSeed)) throw new Error('--run-seed must be a safe integer');
  const configPath = resolveFromRoot(arg(argv, 'config', DEFAULT_CONFIG));
  const outRoot = resolveFromRoot(arg(argv, 'out', DEFAULT_OUT));
  const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
  const label = arg(argv, 'label', `adaptive-state-v2-${stage}`);
  const parentArg = arg(argv, 'parent', null);
  const s0ParentArg = arg(argv, 's0-parent', null);
  const promotionParent =
    stage === 's2_confirmation'
      ? validateAdaptiveStateS1PromotionParent({
          parentRunDir: parentArg ? resolveFromRoot(parentArg) : null,
          s0RunDir: s0ParentArg ? resolveFromRoot(s0ParentArg) : null,
          config,
          configPath,
          repoRoot: ROOT,
        })
      : null;
  const plan = buildPlanArtifact({
    config,
    configPath,
    stage,
    confirmationPerCell,
    label,
    promotionParent,
  });
  if (has(argv, 'stdout')) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  const directory = path.join(outRoot, label);
  const jsonPath = path.join(directory, 'critical-path-plan.json');
  const markdownPath = path.join(directory, 'critical-path-plan.md');
  const envelope = buildImmutablePlanningEnvelope(plan, { config, configPath, runSeed, promotionParent });
  createRunPlan(directory, envelope);
  writeExclusive(jsonPath, `${JSON.stringify(plan, null, 2)}\n`);
  writeExclusive(markdownPath, renderAdaptiveStateCriticalPathMarkdown(plan));
  appendRunEvent(directory, {
    type: 'critical_path_planned',
    stage,
    paid: plan.paid,
    dialogueJobs: plan.counts.dialogue_jobs,
    expectedModelCalls: plan.counts.expected_model_calls,
    executedModelCalls: 0,
  });
  createRunSeal(directory, {
    status: 'planned',
    metadata: {
      stage,
      designSha256: plan.design_sha256,
      executedModelCalls: 0,
      ...(promotionParent
        ? {
            s2AuthorizationSha256: promotionParent.authorization.authorization_sha256,
            parentS1SealSha256: promotionParent.authorization.s1.seal_sha256,
            sampleSizeBasis: promotionParent.authorization.sample_size_basis,
            powerClaimMade: false,
          }
        : {}),
    },
  });
  const verification = assertExperimentRun(directory);
  const summary = adaptiveStateCriticalPathSummary(plan);
  process.stdout.write(
    `${stage}: ${summary.dialogues} dialogues, ${summary.transitions} transitions, ${summary.modelCalls} expected calls\n`,
  );
  process.stdout.write(`${path.relative(ROOT, jsonPath)}\n${path.relative(ROOT, markdownPath)}\n`);
  process.stdout.write(`immutable planning transaction verified: ${verification.inventory.length} artifacts\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
