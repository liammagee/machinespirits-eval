#!/usr/bin/env node
/**
 * Reproducible tutor-stub QA matrix.
 *
 * Runs the normal tutor-stub auto-eval report for each automated learner
 * profile, then builds a consolidated policy x learner robustness report.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { normalizeTutorStubRegisterOverlayThreshold } from '../services/tutorStubRegisterPolicyComposition.js';
import { resolveModel } from '../services/evalConfigLoader.js';
import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
  hashCanonicalJson,
  hashFile,
  verifyExperimentRun,
} from '../services/experimentRunArtifacts.js';
import { recordTutorStubModelObservation } from '../services/tutorStubEvalIntegrity.js';
import { tutorStubPolicyRequiresDeterministicDraw } from '../services/tutorStubPolicySampler.js';
import { normalizeTutorStubReleaseSpeed } from '../services/tutorStubReleasePacing.js';
import {
  learnerProfileSuite,
  learnerProfileSuiteIds,
  learnerProfileSuiteNames,
  normalizeLearnerProfileSuiteId,
} from './tutor-stub-learner-profile-contracts.js';
import {
  normalizePolicyName,
  normalizePolicySuiteId,
  tutorStubPolicySuite,
  tutorStubPolicySuiteNames,
  tutorStubPolicySuitePolicies,
} from './tutor-stub-policy-suites.js';

const QA_SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(QA_SCRIPT), '..');

const { values: args } = parseArgs({
  options: {
    suite: { type: 'string', default: 'core' },
    'profile-suite': { type: 'string', default: 'core' },
    profiles: { type: 'string', default: '' },
    policies: { type: 'string', default: '' },
    runs: { type: 'string', default: '1' },
    'run-seed': { type: 'string', default: '20260711' },
    turns: { type: 'string', default: 'until-grounded' },
    'safety-turns': { type: 'string', default: '120' },
    model: { type: 'string', default: process.env.TUTOR_STUB_EVAL_MODEL || 'codex.gpt-5.5' },
    'analysis-model': { type: 'string', default: process.env.TUTOR_STUB_EVAL_ANALYSIS_MODEL || 'codex.gpt-5.5' },
    'auto-learner-model': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_MODEL || process.env.TUTOR_STUB_AUTO_LEARNER_MODEL || 'codex.gpt-5.5',
    },
    world: { type: 'string', default: process.env.TUTOR_STUB_EVAL_WORLD || 'world_005_marrick' },
    'trace-dir': { type: 'string', default: '' },
    parallelism: { type: 'string', default: process.env.TUTOR_STUB_EVAL_PARALLELISM || '6' },
    'progress-interval': { type: 'string', default: process.env.TUTOR_STUB_EVAL_PROGRESS_INTERVAL || '30' },
    'register-palette': { type: 'string', default: 'all' },
    'register-overlay-threshold': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_REGISTER_OVERLAY_THRESHOLD ||
        process.env.TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD ||
        '0.7',
    },
    'release-speed': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_RELEASE_SPEED || process.env.TUTOR_STUB_RELEASE_SPEED || '1',
    },
    'cli-effort': { type: 'string', default: process.env.TUTOR_STUB_EVAL_CLI_EFFORT || 'low' },
    'max-tokens': { type: 'string', default: process.env.TUTOR_STUB_EVAL_MAX_TOKENS || '4096' },
    'history-turns': { type: 'string', default: process.env.TUTOR_STUB_EVAL_HISTORY_TURNS || '4' },
    'baseline-policy': { type: 'string', default: 'bland' },
    'primary-horizon': { type: 'string', default: '16' },
    'minimum-effect': { type: 'string', default: '0.05' },
    'qa-max-outcome-spread': { type: 'string', default: '0.12' },
    'qa-min-worst-outcome': { type: 'string', default: '0.75' },
    'qa-min-worst-closure': { type: 'string', default: '0.75' },
    'qa-min-worst-coverage': { type: 'string', default: '0.65' },
    'qa-max-mean-failure-rate': { type: 'string', default: '0.10' },
    'qa-noninferiority-margin': { type: 'string', default: '0.02' },
    'first-message': { type: 'string', default: '' },
    'from-dir': { type: 'string', default: '' },
    'interleave-policies': { type: 'boolean', default: false },
    'pressure-turns': { type: 'string', default: '' },
    'print-plan': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'keep-going': { type: 'boolean', default: false },
    'no-analyze': { type: 'boolean', default: false },
    'no-html-report': { type: 'boolean', default: false },
    'no-ledger': { type: 'boolean', default: false },
    'no-dag': { type: 'boolean', default: false },
    'no-memory-summary': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  console.log(`Usage:
  npm run tutor:stub:qa -- [options]

Options:
  --suite <controls|core|pressure|sentinel|headroom|adaptive|frontier|audit>
                         policy suite when --policies is omitted (default: core)
                         controls = bland/random/negative calibration
                         core = routine baseline + discrete adaptive comparison
                         pressure = field + negative screen for pressure-sensitive learners
                         sentinel = representative five-policy discrimination ladder
                         headroom = outcome contrast on discriminable stress profiles under a
                                    binding cap (defaults --profile-suite sentinel and
                                    --safety-turns 40 unless passed explicitly)
                         adaptive = adaptive-only sweep without controls
                         frontier = baseline + rich/continuous state policies
                         audit = expensive all-policy sweep ("focused", "full", and "all" aliases accepted)
  --profile-suite <core|sentinel|stress|audit>
                         learner profile suite when --profiles is omitted (default: core)
                         core = routine policy robustness
                         sentinel = cheap profile-discrimination screen
                         stress = targeted failure-mode probes
                         audit = expensive all-profile audit ("all" is accepted as an alias)
  --profiles <csv>       automated learner profiles
                         overrides --profile-suite
  --policies <csv>       explicit policies; overrides --suite
  --runs <n>             repetitions per policy and learner profile (default: 1)
  --run-seed <n>         master seed for exact job/draw replay (default: 20260711)
  --turns <n|until-grounded>
  --safety-turns <n>     runaway guard for until-grounded (default: 120)
  --parallelism <n>      child dialogues per learner-profile auto-eval (default: 6)
  --trace-dir <path>     New QA artifact root; live plans are create-once
                         (default: .tutor-stub-auto-eval/qa-matrix-<timestamp>)
  --from-dir <path>      build only consolidated QA reports from existing summaries;
                         preserve any existing qa-plan.json
  --baseline-policy <p>  same-learner comparison baseline (default: bland)
  --register-overlay-threshold <n>
                         strong-change threshold for composed +state/+field policies (default: 0.7)
  --release-speed <n>    base clue-release speed, 0.5-2 (default: 1)
  --primary-horizon <n>  preregistered learner-turn horizon (default: 16)
  --minimum-effect <n>   preregistered minimum outcome effect (default: 0.05)
  --dry-run              pass --dry-run to auto-eval children
  --print-plan           print the reproducible plan and exit
  --json                 JSON output for --print-plan
  --no-analyze           skip consolidated qa-matrix.md/json
  --keep-going           continue after a failed profile run
`);
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function unitInterval(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(`${name} must be between 0 and 1`);
  return parsed;
}

function configuredQaThresholds() {
  return {
    maxOutcomeSpread: unitInterval(args['qa-max-outcome-spread'], '--qa-max-outcome-spread'),
    minWorstOutcome: unitInterval(args['qa-min-worst-outcome'], '--qa-min-worst-outcome'),
    minWorstClosure: unitInterval(args['qa-min-worst-closure'], '--qa-min-worst-closure'),
    minWorstCoverage: unitInterval(args['qa-min-worst-coverage'], '--qa-min-worst-coverage'),
    maxMeanFailureRate: unitInterval(args['qa-max-mean-failure-rate'], '--qa-max-mean-failure-rate'),
    nonInferiorityMargin: unitInterval(args['qa-noninferiority-margin'], '--qa-noninferiority-margin'),
  };
}

function normalizeProfileName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
}

function safeTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function safeSlug(value) {
  return String(value || 'run')
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function policyList() {
  if (args.policies) return csv(args.policies).map(normalizePolicyName);
  const suite = normalizePolicySuiteId(args.suite || 'core');
  const policies = tutorStubPolicySuitePolicies(suite);
  if (!policies) {
    throw new Error(
      `Unknown --suite ${args.suite}. Known: ${tutorStubPolicySuiteNames({ includeAliases: true }).join(', ')}`,
    );
  }
  return policies;
}

// The headroom suite exists to create outcome variance: discriminable stress
// profiles + a binding cap. Without both, its contrast collapses back to the
// all-policies-ground-at-the-floor ceiling, so resolve its companion defaults
// unless the caller explicitly overrode them on the command line.
function explicitCliFlag(name) {
  return process.argv.some((token) => token === `--${name}` || token.startsWith(`--${name}=`));
}

function resolveHeadroomDefaults() {
  if (args.policies || normalizePolicySuiteId(args.suite || 'core') !== 'headroom') return;
  if (!args.profiles && !explicitCliFlag('profile-suite')) args['profile-suite'] = 'sentinel';
  if (!explicitCliFlag('safety-turns')) args['safety-turns'] = '40';
}

function profileList() {
  if (!args.profiles) {
    const suite = normalizeLearnerProfileSuiteId(args['profile-suite'] || 'core');
    const profiles = learnerProfileSuiteIds(suite);
    if (!profiles) {
      throw new Error(
        `Unknown --profile-suite ${args['profile-suite']}. Known: ${learnerProfileSuiteNames({ includeAliases: true }).join(', ')}`,
      );
    }
    return profiles;
  }
  const profiles = csv(args.profiles).map(normalizeProfileName);
  if (!profiles.length) throw new Error('--profiles must include at least one learner profile');
  return profiles;
}

function qaRootDir() {
  if (args['from-dir']) return resolvePath(args['from-dir']);
  if (args['trace-dir']) return resolvePath(args['trace-dir']);
  return path.join(ROOT, '.tutor-stub-auto-eval', `qa-matrix-${safeTimestampForFile()}`);
}

function pushOptionalFlag(command, flag, value) {
  if (value !== undefined && value !== null && String(value) !== '') command.push(flag, String(value));
}

function autoEvalArgsForProfile({ profile, traceDir, indexRoot, policies, parentRunId }) {
  const command = [
    'scripts/run-tutor-stub-auto-eval.js',
    '--runs',
    String(positiveInt(args.runs, '--runs')),
    '--run-seed',
    String(runSeed()),
    '--policies',
    policies.join(','),
    '--parallelism',
    String(positiveInt(args.parallelism, '--parallelism')),
    '--progress-interval',
    String(positiveInt(args['progress-interval'], '--progress-interval')),
    '--turns',
    args.turns,
    '--safety-turns',
    String(positiveInt(args['safety-turns'], '--safety-turns')),
    '--primary-horizon',
    String(positiveInt(args['primary-horizon'], '--primary-horizon')),
    '--model',
    args.model,
    '--analysis-model',
    args['analysis-model'],
    '--auto-learner-model',
    args['auto-learner-model'],
    '--auto-learner-profile-id',
    profile,
    '--parent-run-id',
    parentRunId,
    '--world',
    args.world,
    '--trace-dir',
    traceDir,
    '--index-root',
    indexRoot,
    '--register-palette',
    args['register-palette'],
    '--keep-going',
  ];
  pushOptionalFlag(command, '--cli-effort', args['cli-effort']);
  pushOptionalFlag(command, '--max-tokens', args['max-tokens']);
  pushOptionalFlag(command, '--history-turns', args['history-turns']);
  pushOptionalFlag(command, '--pressure-turns', args['pressure-turns']);
  pushOptionalFlag(
    command,
    '--register-overlay-threshold',
    normalizeTutorStubRegisterOverlayThreshold(args['register-overlay-threshold'], {
      label: '--register-overlay-threshold',
    }),
  );
  pushOptionalFlag(
    command,
    '--release-speed',
    normalizeTutorStubReleaseSpeed(args['release-speed'], { label: '--release-speed' }),
  );
  if (args['interleave-policies']) command.push('--interleave-policies');
  pushOptionalFlag(command, '--first-message', args['first-message']);
  if (args['dry-run']) command.push('--dry-run');
  if (args['no-html-report']) command.push('--no-html-report');
  if (args['no-ledger']) command.push('--no-ledger');
  if (args['no-dag']) command.push('--no-dag');
  if (args['no-memory-summary']) command.push('--no-memory-summary');
  return command;
}

function buildPlanWarnings({ policySuite, profileSuite, profiles, policies, runs }) {
  const warnings = [];
  if (policySuite?.id === 'audit') {
    warnings.push(
      'audit runs every register policy, including controls and continuous policies; use it as an expensive periodic audit, not as the default policy comparison.',
    );
  }
  if (policySuite?.id === 'adaptive') {
    warnings.push(
      'adaptive omits bland/random/negative controls; use core, frontier, or audit when same-run baselines matter.',
    );
  }
  if (profileSuite?.id === 'audit') {
    warnings.push(
      'audit runs every core and stress profile; use it as an expensive periodic audit, not as the default policy comparison.',
    );
  }
  if (profiles.includes('affective_resistant') && !policies.includes('negative')) {
    warnings.push('affective_resistant separates best when the policy set includes a pressure arm such as negative.');
  }
  if (policySuite?.id === 'headroom') {
    if (profileSuite?.id === 'core') {
      warnings.push(
        'headroom on the core profiles runs against near-clone learners (discrimination gate fail); use the sentinel or stress profile suites.',
      );
    }
    if (args.turns === 'until-grounded' && positiveInt(args['safety-turns'], '--safety-turns') > 60) {
      warnings.push(
        'headroom needs a binding turn cap to create outcome variance; with --safety-turns above 60 every policy likely grounds at the ceiling again.',
      );
    }
  }
  const rowCount = profiles.length * policies.length * runs;
  if (rowCount >= 100) {
    warnings.push(
      `this plan expands to ${rowCount} dialogue rows; dry-run first and prefer sentinel/core unless the audit is intentional.`,
    );
  }
  return warnings;
}

function buildPlan({ rootDir = qaRootDir() } = {}) {
  const profiles = profileList();
  const policies = policyList();
  const policySuite = args.policies ? null : tutorStubPolicySuite(args.suite || 'core');
  const profileSuite = args.profiles ? null : learnerProfileSuite(args['profile-suite'] || 'core');
  const runs = positiveInt(args.runs, '--runs');
  const parentRunId = path.basename(path.resolve(rootDir));
  const jobs = profiles.map((profile, index) => {
    const traceDir = path.join(rootDir, safeSlug(profile));
    return {
      ordinal: index + 1,
      profile,
      traceDir: path.relative(ROOT, traceDir),
      command: ['node', ...autoEvalArgsForProfile({ profile, traceDir, indexRoot: rootDir, policies, parentRunId })],
    };
  });
  return {
    schema: 'machinespirits.tutor-stub.qa-matrix-plan.v1',
    generatedAt: new Date().toISOString(),
    suite: args.policies ? 'custom' : policySuite.id,
    policySuite: args.policies ? 'custom' : policySuite.id,
    policySuitePurpose: args.policies ? 'Explicit policy list supplied by --policies.' : policySuite.purpose,
    policySuiteCost: args.policies ? 'custom' : policySuite.cost,
    policySuiteAliases: args.policies ? [] : policySuite.aliases,
    profileSuite: args.profiles ? 'custom' : profileSuite.id,
    profileSuitePurpose: args.profiles ? 'Explicit profile list supplied by --profiles.' : profileSuite.purpose,
    profileSuiteCost: args.profiles ? 'custom' : profileSuite.cost,
    profileSuiteAliases: args.profiles ? [] : profileSuite.aliases,
    dryRun: Boolean(args['dry-run']),
    rootDir: path.relative(ROOT, rootDir),
    profiles,
    policies,
    baselinePolicy: normalizePolicyName(args['baseline-policy']) || 'bland',
    primaryHorizon: positiveInt(args['primary-horizon'], '--primary-horizon'),
    minimumEffect: unitInterval(args['minimum-effect'], '--minimum-effect'),
    qaThresholds: configuredQaThresholds(),
    runs,
    runSeed: runSeed(),
    turns: args.turns,
    safetyTurns: positiveInt(args['safety-turns'], '--safety-turns'),
    interleavePolicies: Boolean(args['interleave-policies']),
    pressureTurns: args['pressure-turns'] || null,
    registerOverlayThreshold: normalizeTutorStubRegisterOverlayThreshold(args['register-overlay-threshold'], {
      label: '--register-overlay-threshold',
    }),
    releaseSpeed: normalizeTutorStubReleaseSpeed(args['release-speed'], { label: '--release-speed' }),
    parallelism: positiveInt(args.parallelism, '--parallelism'),
    model: args.model,
    analysisModel: args['analysis-model'],
    autoLearnerModel: args['auto-learner-model'],
    world: args.world,
    expectedDialogueRows: profiles.length * policies.length * runs,
    warnings: buildPlanWarnings({ policySuite, profileSuite, profiles, policies, runs }),
    outputs: {
      plan: path.relative(ROOT, path.join(rootDir, 'qa-plan.json')),
      markdown: path.relative(ROOT, path.join(rootDir, 'qa-matrix.md')),
      json: path.relative(ROOT, path.join(rootDir, 'qa-matrix.json')),
    },
    jobs,
  };
}

function runSeed() {
  const value = Number(args['run-seed']);
  if (!Number.isSafeInteger(value)) throw new Error('--run-seed must be a safe integer');
  return value;
}

function qaDesign(plan) {
  return {
    schema: plan.schema,
    suite: plan.suite,
    policySuite: plan.policySuite,
    profileSuite: plan.profileSuite,
    dryRun: plan.dryRun,
    profiles: plan.profiles,
    policies: plan.policies,
    baselinePolicy: plan.baselinePolicy,
    primaryHorizon: plan.primaryHorizon,
    minimumEffect: plan.minimumEffect,
    qaThresholds: plan.qaThresholds,
    runs: plan.runs,
    runSeed: plan.runSeed,
    turns: plan.turns,
    safetyTurns: plan.safetyTurns,
    interleavePolicies: plan.interleavePolicies,
    pressureTurns: plan.pressureTurns,
    releaseSpeed: plan.releaseSpeed,
    parallelism: plan.parallelism,
    model: plan.model,
    analysisModel: plan.analysisModel,
    autoLearnerModel: plan.autoLearnerModel,
    world: plan.world,
    warnings: plan.warnings,
  };
}

function worldSourcePath(world) {
  const raw = String(world || '').trim();
  const candidates = [
    path.isAbsolute(raw) ? raw : path.resolve(ROOT, raw),
    path.join(ROOT, 'config', 'drama-derivation', `${raw.replaceAll('_', '-')}.yaml`),
    path.join(ROOT, 'config', 'drama-derivation', `${raw}.yaml`),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Cannot resolve world source for evidence hashing: ${world}`);
  return found;
}

function hashFileSet(files) {
  return hashCanonicalJson(
    [...new Set(files)]
      .sort()
      .map((file) => ({ path: path.relative(ROOT, file).split(path.sep).join('/'), sha256: hashFile(file) })),
  );
}

function evidenceModel(reference) {
  const resolved = resolveModel(reference);
  return {
    requested: reference,
    resolved: `${resolved.provider}/${resolved.model}`,
    observed: null,
  };
}

function dialogueJobs(plan) {
  const pairs = [];
  if (plan.interleavePolicies) {
    for (let repeat = 1; repeat <= plan.runs; repeat += 1) {
      for (const policy of plan.policies) pairs.push({ policy, repeat });
    }
  } else {
    for (const policy of plan.policies) {
      for (let repeat = 1; repeat <= plan.runs; repeat += 1) pairs.push({ policy, repeat });
    }
  }
  return plan.profiles.flatMap((profile, profileIndex) =>
    pairs.map(({ policy, repeat }, dialogueIndex) => ({
      id: `${safeSlug(profile)}-${safeSlug(policy)}-r${repeat}`,
      profile,
      policy,
      repeat,
      profileOrdinal: profileIndex + 1,
      dialogueOrdinal: dialogueIndex + 1,
      artifactRoot: `{run_dir}/${safeSlug(profile)}`,
    })),
  );
}

function buildQaEvidencePlan(plan) {
  const design = qaDesign(plan);
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  const tutorStub = path.join(ROOT, 'scripts', 'tutor-stub.js');
  const policySuites = path.join(ROOT, 'scripts', 'tutor-stub-policy-suites.js');
  const profileContracts = path.join(ROOT, 'scripts', 'tutor-stub-learner-profile-contracts.js');
  const analyzer = path.join(ROOT, 'scripts', 'analyze-tutor-stub-auto-evals.js');
  const plannedJobs = dialogueJobs(plan);
  const requiredRandomDrawJobIds = plan.dryRun
    ? []
    : plannedJobs.filter((job) => tutorStubPolicyRequiresDeterministicDraw(job.policy)).map((job) => job.id);
  return buildExperimentRunPlan({
    runId: path.basename(resolvePath(plan.rootDir)),
    createdAt: plan.generatedAt,
    runner: 'scripts/run-tutor-stub-qa-matrix.js',
    provenance: { git },
    models: {
      tutor: evidenceModel(plan.model),
      analyzer: evidenceModel(plan.analysisModel),
      learner: evidenceModel(plan.autoLearnerModel),
    },
    requiredObservedModelRoles: plan.dryRun ? [] : ['tutor', 'analyzer', 'learner'],
    hashes: {
      runner: hashFile(QA_SCRIPT),
      analyzer: hashFile(analyzer),
      policy: hashFileSet([tutorStub, policySuites]),
      profile: hashFile(profileContracts),
      prompt: hashFile(tutorStub),
      world: hashFile(worldSourcePath(plan.world)),
      config: hashCanonicalJson(design),
    },
    masterSeed: runSeed(),
    jobs: plannedJobs,
    lineage: { parentRunId: null, resumeOf: null, supersedes: [] },
    intent: {
      qaMatrix: design,
      compatibilityPlan: 'qa-plan.json',
      claimBoundary: 'Dry runs validate orchestration only; simulated learner outcomes do not estimate human learning.',
    },
    metadata: {
      qaDesignHash: hashCanonicalJson(design),
      randomDrawContract: {
        schema: EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA,
        requiredJobIds: requiredRandomDrawJobIds,
        minimumPerJob: 1,
      },
    },
  });
}

function childJobKey(job) {
  return [job?.profile, job?.policy, job?.repeat].map((value) => String(value ?? '')).join('\u0000');
}

function collectChildPolicyDraws(rootDir, evidencePlan) {
  const root = path.resolve(rootDir);
  const parentJobs = new Map(evidencePlan.jobs.map((job) => [childJobKey(job), job]));
  const parentOrder = new Map(evidencePlan.randomization.jobOrder.map((jobId, index) => [jobId, index]));
  const rows = [];
  const skippedChildren = [];
  const seen = new Set();
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.name !== 'run-events.jsonl' || directory === root) continue;
      const childPlanPath = path.join(directory, 'run-plan.json');
      const childSealPath = path.join(directory, 'run-seal.json');
      if (!fs.existsSync(childPlanPath) || !fs.existsSync(childSealPath)) continue;
      // Integrity-only: a sealed child whose failed jobs never drew (e.g. a
      // dead-session casualty under --keep-going) still forwards the draws it
      // DID seal; the root contract judges completeness at final
      // verification. Only a broken child ledger blocks forwarding.
      const childVerification = verifyExperimentRun(directory, { completeness: false });
      if (!childVerification.ok) {
        skippedChildren.push({
          traceDir: path.relative(root, directory).split(path.sep).join('/'),
          runId: childVerification.plan?.runId || null,
          errors: childVerification.errors,
        });
        continue;
      }
      const childJobs = new Map(childVerification.plan.jobs.map((job) => [job.id, job]));
      const lines = fs.readFileSync(entryPath, 'utf8').split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].trim()) continue;
        let event;
        try {
          event = JSON.parse(lines[index]);
        } catch (error) {
          throw new Error(`Invalid child run event at ${entryPath}:${index + 1}: ${error.message}`);
        }
        if (event.type !== 'random_draw') continue;
        const sourceJobId = String(event.jobId || '').trim();
        const sourceJob = childJobs.get(sourceJobId);
        const parentJob = sourceJob ? parentJobs.get(childJobKey(sourceJob)) : null;
        if (!sourceJob || !parentJob) {
          throw new Error(
            `Cannot map child policy draw ${JSON.stringify(sourceJobId || null)} from ${entryPath} to frozen QA job`,
          );
        }
        const digest = hashCanonicalJson({ parentJobId: parentJob.id, decision: event.decision });
        if (seen.has(digest)) continue;
        seen.add(digest);
        rows.push({
          jobId: parentJob.id,
          sourceJobId,
          sourceRunId: childVerification.plan.runId,
          sourceEventSha256: event.eventSha256,
          decision: event.decision,
          digest,
        });
      }
    }
  }
  rows.sort(
    (left, right) =>
      parentOrder.get(left.jobId) - parentOrder.get(right.jobId) ||
      Number(left.decision?.material?.learnerTurn || 0) - Number(right.decision?.material?.learnerTurn || 0) ||
      String(left.decision?.material?.decisionKind || '').localeCompare(
        String(right.decision?.material?.decisionKind || ''),
      ) ||
      left.digest.localeCompare(right.digest),
  );
  return { rows, skippedChildren };
}

function appendChildPolicyDrawEvents(rootDir, evidencePlan) {
  const { rows, skippedChildren } = collectChildPolicyDraws(rootDir, evidencePlan);
  for (const skipped of skippedChildren) {
    console.warn(
      `[qa-matrix] warning: child run ${skipped.traceDir} failed integrity verification; its policy draws were not forwarded`,
    );
    appendRunEvent(rootDir, {
      type: 'child_run_unverified',
      traceDir: skipped.traceDir,
      runId: skipped.runId,
      errorCount: skipped.errors.length,
      errors: skipped.errors.slice(0, 25),
    });
  }
  for (const row of rows) {
    appendRunEvent(rootDir, {
      type: 'random_draw',
      jobId: row.jobId,
      sourceJobId: row.sourceJobId,
      sourceRunId: row.sourceRunId,
      sourceEventSha256: row.sourceEventSha256,
      decision: row.decision,
    });
  }
}

function collectObservedModels(rootDir) {
  const observations = new Map();
  const stack = [rootDir];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name !== 'run-events.jsonl') {
        const lines = fs.readFileSync(entryPath, 'utf8').split('\n');
        for (let index = 0; index < lines.length; index += 1) {
          if (!lines[index].trim()) continue;
          let event;
          try {
            event = JSON.parse(lines[index]);
          } catch (error) {
            throw new Error(`Invalid JSONL evidence at ${entryPath}:${index + 1}: ${error.message}`);
          }
          recordTutorStubModelObservation(observations, event, {
            source: `${entryPath}:${index + 1}`,
          });
        }
      }
    }
  }
  return observations;
}

function appendObservedModelEvents(rootDir, evidencePlan) {
  for (const [role, models] of [...collectObservedModels(rootDir).entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    for (const observed of [...models].sort()) {
      appendRunEvent(rootDir, {
        type: 'model_observed',
        role,
        requested: evidencePlan.models?.[role]?.requested || null,
        resolved: evidencePlan.models?.[role]?.resolved || null,
        observed,
      });
    }
  }
}

function renderPlanMarkdown(plan) {
  const lines = [
    '# Tutor Stub QA Matrix Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    `Root: ${plan.rootDir}`,
    `Policy suite: ${plan.policySuite}`,
    `Policy suite purpose: ${plan.policySuitePurpose}`,
    `Profile suite: ${plan.profileSuite}`,
    `Profile suite purpose: ${plan.profileSuitePurpose}`,
    `Profiles: ${plan.profiles.join(', ')}`,
    `Policies: ${plan.policies.join(', ')}`,
    `Runs: ${plan.runs}`,
    `Expected dialogue rows: ${plan.expectedDialogueRows}`,
    `Primary horizon: learner turn ${plan.primaryHorizon}`,
    `Minimum effect: ${plan.minimumEffect}`,
    `QA gates: ${JSON.stringify(plan.qaThresholds)}`,
    `Dry run: ${plan.dryRun ? 'yes' : 'no'}`,
    '',
  ];
  if (plan.warnings.length) {
    lines.push('Warnings:', '');
    for (const warning of plan.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }
  lines.push('| # | Profile | Trace Dir | Command |', '|---:|---|---|---|');
  for (const job of plan.jobs) {
    lines.push(`| ${job.ordinal} | ${job.profile} | ${job.traceDir} | \`${job.command.join(' ')}\` |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function walkSummaryFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['logs', 'traces'].includes(entry.name) && !entry.name.endsWith('-field-svg')) stack.push(entryPath);
      } else if (/^auto-eval-.*\.json$/u.test(entry.name)) {
        files.push(entryPath);
      }
    }
  }
  return files.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs || a.localeCompare(b));
}

function runCommand(command, { label }) {
  console.log(`[qa-matrix] ${label}`);
  console.log(`[qa-matrix] ${command.map((part) => JSON.stringify(part)).join(' ')}`);
  const result = spawnSync(process.execPath, command.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  return result.status || 0;
}

function runAnalyzer({ outputDir, summaryFiles, json, minimumEffect = args['minimum-effect'] }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, json ? 'qa-matrix.json' : 'qa-matrix.md');
  const command = [
    'node',
    'scripts/analyze-tutor-stub-auto-evals.js',
    ...summaryFiles,
    '--qa',
    '--baseline-policy',
    normalizePolicyName(args['baseline-policy']) || 'bland',
    '--qa-minimum-effect',
    String(minimumEffect),
    '--out',
    outPath,
  ];
  const thresholdFlags = {
    '--qa-max-outcome-spread': args['qa-max-outcome-spread'],
    '--qa-min-worst-outcome': args['qa-min-worst-outcome'],
    '--qa-min-worst-closure': args['qa-min-worst-closure'],
    '--qa-min-worst-coverage': args['qa-min-worst-coverage'],
    '--qa-max-mean-failure-rate': args['qa-max-mean-failure-rate'],
    '--qa-noninferiority-margin': args['qa-noninferiority-margin'],
  };
  for (const [flag, value] of Object.entries(thresholdFlags)) command.push(flag, String(value));
  if (json) command.push('--json');
  if (args['dry-run']) command.push('--include-dry-run');
  const status = runCommand(command, { label: `build ${path.basename(outPath)}` });
  if (status !== 0) throw new Error(`Analyzer failed with status ${status}`);
  return outPath;
}

function writeFrozenPlan(planPath, plan) {
  try {
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(
        `Refusing to overwrite frozen QA plan at ${planPath}; use a new --trace-dir for a live run or --from-dir to rebuild reports`,
      );
    }
    throw error;
  }
}

function main() {
  if (args.help) {
    usage();
    return;
  }
  resolveHeadroomDefaults();
  const rootDir = qaRootDir();
  const plan = buildPlan({ rootDir });
  if (args['print-plan']) {
    process.stdout.write(args.json ? `${JSON.stringify(plan, null, 2)}\n` : renderPlanMarkdown(plan));
    return;
  }

  fs.mkdirSync(rootDir, { recursive: true });
  const planPath = path.join(rootDir, 'qa-plan.json');
  let evidencePlan = null;
  let reportRoot = rootDir;
  let analyzerMinimumEffect = plan.minimumEffect;
  const profileStatuses = [];
  if (args['from-dir']) {
    const sealPath = path.join(rootDir, 'run-seal.json');
    if (fs.existsSync(sealPath)) {
      // Integrity-only: rebuilding reports from a sealed-but-incomplete run
      // (failed profiles under --keep-going) is legitimate; tampering is not.
      assertExperimentRun(rootDir, { completeness: false });
      reportRoot = path.join(path.dirname(rootDir), `${path.basename(rootDir)}-derived-${safeTimestampForFile()}`);
      console.log(`[qa-matrix] sealed source verified; derived reports will be written under ${reportRoot}`);
    }
    console.log(
      fs.existsSync(planPath)
        ? `[qa-matrix] report-only mode; preserved ${planPath}`
        : `[qa-matrix] report-only mode; no qa-plan.json written under ${rootDir}`,
    );
    if (fs.existsSync(planPath)) {
      const frozenPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
      analyzerMinimumEffect = unitInterval(
        frozenPlan.minimumEffect ?? plan.minimumEffect,
        'frozen qa-plan minimumEffect',
      );
    }
  } else {
    if (fs.existsSync(planPath)) {
      throw new Error(
        `Refusing to overwrite frozen QA plan at ${planPath}; use a new --trace-dir for a live run or --from-dir to rebuild reports`,
      );
    }
    for (const warning of plan.warnings) {
      console.warn(`[qa-matrix] warning: ${warning}`);
    }
    evidencePlan = buildQaEvidencePlan(plan);
    createRunPlan(rootDir, evidencePlan);
    writeFrozenPlan(planPath, plan);
    appendRunEvent(rootDir, {
      type: 'run_planned',
      dryRun: plan.dryRun,
      profiles: plan.profiles,
      policies: plan.policies,
    });
    appendRunEvent(rootDir, { type: 'run_started', dryRun: plan.dryRun });
    console.log(`[qa-matrix] wrote ${planPath}`);
    for (const job of plan.jobs) {
      appendRunEvent(rootDir, { type: 'profile_started', profile: job.profile, ordinal: job.ordinal });
      const status = runCommand(job.command, { label: `profile ${job.profile} (${job.ordinal}/${plan.jobs.length})` });
      profileStatuses.push({ profile: job.profile, status });
      appendRunEvent(rootDir, { type: 'profile_completed', profile: job.profile, exitCode: status });
      if (status !== 0 && !args['keep-going']) {
        throw new Error(`Profile ${job.profile} failed with status ${status}`);
      }
    }
  }

  const summaryFiles = walkSummaryFiles(rootDir);
  if (!summaryFiles.length) {
    throw new Error(`No auto-eval summaries found under ${path.relative(ROOT, rootDir)}`);
  }

  if (!args['no-analyze']) {
    if (evidencePlan) appendRunEvent(rootDir, { type: 'analysis_started', summaries: summaryFiles.length });
    const markdownPath = runAnalyzer({
      outputDir: reportRoot,
      summaryFiles,
      json: false,
      minimumEffect: analyzerMinimumEffect,
    });
    const jsonPath = runAnalyzer({
      outputDir: reportRoot,
      summaryFiles,
      json: true,
      minimumEffect: analyzerMinimumEffect,
    });
    if (evidencePlan) {
      appendRunEvent(rootDir, {
        type: 'analysis_completed',
        reports: [path.relative(rootDir, markdownPath), path.relative(rootDir, jsonPath)],
      });
    }
    console.log(`[qa-matrix] report ${markdownPath}`);
    console.log(`[qa-matrix] report ${jsonPath}`);
  }
  if (evidencePlan) {
    appendChildPolicyDrawEvents(rootDir, evidencePlan);
    appendObservedModelEvents(rootDir, evidencePlan);
    const status = profileStatuses.every((row) => row.status === 0)
      ? plan.dryRun
        ? 'dry_run'
        : 'complete'
      : 'incomplete';
    appendRunEvent(rootDir, {
      type: 'run_completed',
      status,
      profileStatuses,
      summaryCount: summaryFiles.length,
    });
    createRunSeal(rootDir, {
      status,
      metadata: {
        profiles: plan.profiles.length,
        policies: plan.policies.length,
        expectedDialogueRows: plan.expectedDialogueRows,
        summaryCount: summaryFiles.length,
      },
    });
    if (status === 'incomplete') {
      // Failed profiles never recorded their contracted draws, so full
      // verification cannot pass. Seal the partial evidence truthfully,
      // require it to be integrity-clean, surface the unmet contract items,
      // and fail the matrix without destroying the completed work.
      assertExperimentRun(rootDir, { completeness: false });
      const verification = verifyExperimentRun(rootDir);
      console.warn(`[qa-matrix] sealed ${rootDir} with status incomplete; integrity verified`);
      for (const error of verification.errors.slice(0, 12)) console.warn(`[qa-matrix]   unmet: ${error}`);
      if (verification.errors.length > 12) {
        console.warn(`[qa-matrix]   ... ${verification.errors.length - 12} more unmet item(s)`);
      }
      const failedProfiles = profileStatuses.filter((row) => row.status !== 0).map((row) => row.profile);
      throw new Error(
        `${failedProfiles.length} profile job(s) failed (${failedProfiles.join(', ')}); ` +
          `sealed incomplete run reports ${verification.errors.length} unmet contract item(s)`,
      );
    }
    assertExperimentRun(rootDir);
    console.log(`[qa-matrix] sealed and verified ${rootDir}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`[qa-matrix] error: ${error.message}`);
  process.exit(1);
}
