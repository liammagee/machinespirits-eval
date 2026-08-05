import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import yaml from 'yaml';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  analyzeTutorStubPrefetchPolicies,
  expandTutorStubLatencyBenchmark,
  parseTutorStubLatencyBenchmarkTrace,
  runTutorStubLatencyBenchmarkJobs,
  summarizeTutorStubLatencyBenchmark,
  validateTutorStubLatencyBenchmarkConfig,
} from '../services/tutorStubLatencyBenchmark.js';
import {
  buildTutorStubLearnerDagPreflight,
  buildTutorStubPublicLearnerAnalysisPrompt,
  buildTutorStubPublicLearnerAnalysisWorld,
} from '../services/tutorStubPublicLearnerAnalysis.js';
import { resolveTutorStubDiscoursePlane } from '../services/tutorStubDiscoursePlane.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'tutor-stub-latency-benchmark.yaml');
const SCREEN_CONFIG_PATH = path.join(ROOT, 'config', 'tutor-stub-latency-benchmark-v2-screen.yaml');

function config() {
  return yaml.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function screenConfig() {
  return yaml.parse(fs.readFileSync(SCREEN_CONFIG_PATH, 'utf8'));
}

test('latency benchmark expands a frozen object/meta/mixed one-factor matrix', () => {
  const source = config();
  const validated = validateTutorStubLatencyBenchmarkConfig(source);
  assert.equal(validated.caseCount, 3);
  assert.equal(validated.variantCount, 4);
  assert.deepEqual(
    validated.planeContract.map((row) => [row.caseId, row.resolvedPlane]),
    [
      ['object', 'object'],
      ['instructional-meta', 'instructional_meta'],
      ['mixed', 'mixed'],
    ],
  );
  const plan = expandTutorStubLatencyBenchmark({
    config: source,
    root: ROOT,
    traceRoot: '/tmp/tutor-stub-latency-test',
  });
  assert.equal(plan.jobs.length, 12);
  assert.deepEqual(
    new Set(plan.jobs.map((job) => job.expectedPlane)),
    new Set(['object', 'instructional_meta', 'mixed']),
  );
  assert.equal(plan.jobs.filter((job) => job.factor === 'baseline').length, 3);
  assert.ok(plan.jobs.every((job) => job.args.includes('--learner-analysis-prompt-profile')));
  assert.ok(plan.jobs.every((job) => job.args.includes('--mixed-tutor-prefetch-policy')));
});

test('v2 screening plan repeats only the viable latency candidates', () => {
  const plan = expandTutorStubLatencyBenchmark({
    config: screenConfig(),
    root: ROOT,
    traceRoot: '/tmp/tutor-stub-latency-v2-screen-test',
  });

  assert.equal(plan.draws, 3);
  assert.equal(plan.jobs.length, 36);
  assert.deepEqual(
    new Set(plan.jobs.map((job) => job.variantId)),
    new Set(['baseline-medium-sol', 'effort-low-sol', 'routing-medium-terra', 'prefetch-analysis-only']),
  );
  assert.equal(plan.jobs.filter((job) => job.factor === 'prefetch').length, 9);
  assert.ok(
    plan.jobs.filter((job) => job.factor === 'prefetch').every((job) => job.prefetchPolicy === 'analysis_only'),
  );
  assert.ok(plan.jobs.every((job) => job.promptProfile === 'baseline'));
});

test('frozen mixed case preserves its repair request and separate object contribution', () => {
  const learnerText =
    'Please explain “baseline” in plain English. Separately, I think student interviews should come before we choose one.';
  const discoursePlane = resolveTutorStubDiscoursePlane({
    learnerText,
    classification: {
      turn: {
        discourse_plane: 'object',
        discourse_move: 'claim',
        evidence_use: 'none',
      },
    },
  });

  assert.equal(discoursePlane.plane, 'mixed');
  assert.equal(discoursePlane.proof_effect, 'candidate');
  assert.equal(discoursePlane.freeze_learner_dag, false);
  assert.equal(discoursePlane.signals.requested_plane, 'object');
  assert.equal(discoursePlane.signals.meta_language_visible, true);
  assert.equal(discoursePlane.signals.surface_object_contribution_visible, true);
});

test('plain-English repair without a separate subject-matter claim stays instructional meta', () => {
  const discoursePlane = resolveTutorStubDiscoursePlane({
    learnerText: 'Please explain “baseline” in plain English.',
    classification: {
      turn: {
        discourse_plane: 'object',
        discourse_move: 'claim',
        evidence_use: 'none',
      },
    },
  });

  assert.equal(discoursePlane.plane, 'instructional_meta');
  assert.equal(discoursePlane.freeze_learner_dag, true);
  assert.equal(discoursePlane.signals.surface_object_contribution_visible, false);
});

test('object-level explanation request is not mistaken for instructional meta', () => {
  const discoursePlane = resolveTutorStubDiscoursePlane({
    learnerText: 'Please explain why student interviews should come first.',
    classification: {
      turn: {
        discourse_plane: 'object',
        discourse_move: 'question',
        evidence_use: 'none',
      },
    },
  });

  assert.equal(discoursePlane.plane, 'object');
});

test('tutor-stub dry run exposes opt-in compact analysis and analysis-only prefetch', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--dry-run',
      '--mixed-learner',
      '--world',
      'world_016_ai_syllabus_af1',
      '--dag',
      '--tutor-learner-dag',
      '--learner-analysis-prompt-profile',
      'compact_v1',
      '--mixed-tutor-prefetch-policy',
      'analysis_only',
      '--no-opening',
      '--no-trace',
      '--no-remember-settings',
    ],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TUTOR_STUB_SUMMARY_OPEN: '0' } },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"learnerAnalysisPromptProfile": "compact_v1"/u);
  assert.match(result.stdout, /"tutorPrefetchPolicy": "analysis_only"/u);
});

test('latency benchmark dry run exposes the fail-closed discourse-plane contract', () => {
  const result = spawnSync(process.execPath, ['scripts/run-tutor-stub-latency-benchmark.js', '--dry-run'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"planeContract"/u);
  assert.match(result.stdout, /"resolvedPlane": "mixed"/u);
  assert.match(result.stdout, /"schema": "machinespirits\.tutor-stub\.discourse-plane\.v2"/u);
});

test('latency benchmark rejects a mixed fixture without a distinguishable object clause', () => {
  const source = config();
  source.cases.find((row) => row.id === 'mixed').learner_text = 'Please explain “baseline” in plain English.';

  assert.throws(
    () => validateTutorStubLatencyBenchmarkConfig(source),
    /case mixed is not deterministic .* expected mixed, resolved instructional_meta/u,
  );
});

test('compact learner-analysis prompt removes only duplicate question text and JSON indentation', () => {
  const world = loadWorld(path.join(ROOT, 'config', 'drama-derivation', 'world-016-ai-syllabus-af1.yaml'));
  const publicWorld = buildTutorStubPublicLearnerAnalysisWorld(world);
  const preflight = buildTutorStubLearnerDagPreflight({ world, tutorTurn: 1 });
  const common = {
    learnerText: 'Can you explain baseline in simpler words?',
    topic: world.title,
    world: publicWorld,
    tutorTurn: 1,
    currentTutorText: world.setting,
    dagPreflight: preflight,
    publicStagedEvidence: [],
    registerPolicy: 'continuous_dynamical_system',
    registerEnabled: true,
  };
  const baseline = buildTutorStubPublicLearnerAnalysisPrompt({ ...common, promptProfile: 'baseline' });
  const compact = buildTutorStubPublicLearnerAnalysisPrompt({ ...common, promptProfile: 'compact_v1' });
  assert.ok(compact.length < baseline.length);
  assert.match(compact, /# Public rules/u);
  assert.match(compact, /# Learner-record extraction rules/u);
  assert.match(compact, /# JSON schema/u);
  assert.match(compact, new RegExp(preflight.contentSha256, 'u'));
  assert.doesNotMatch(compact, /# Public question\n/u);
  assert.match(compact, /Public question:/u);
});

test('latency trace parser reports plane, recovery, safety, tokens, and timing', () => {
  const job = {
    id: 'baseline__meta__d1',
    variantId: 'baseline',
    factor: 'baseline',
    caseId: 'meta',
    draw: 1,
    expectedPlane: 'instructional_meta',
    tutorModel: 'codex.gpt-5.6-terra',
    analysisModel: 'codex.gpt-5.6-sol',
    cliEffort: 'medium',
    promptProfile: 'baseline',
    prefetchPolicy: 'always',
  };
  const events = [
    {
      type: 'model_call',
      turn: 1,
      role: 'tutor_stub_learner_analysis',
      request: { promptAudit: { chars: 12000 } },
      response: { latencyMs: 9000, usage: { inputTokens: 10000, outputTokens: 400, totalTokens: 10400 } },
    },
    {
      type: 'model_call',
      turn: 1,
      role: 'tutor_stub_tutor',
      response: { latencyMs: 11000, usage: { inputTokens: 11000, outputTokens: 300, totalTokens: 11300 } },
    },
    {
      type: 'turn_timing_breakdown',
      turn: 1,
      timing: { foreground: { totalMs: 20200, analysisMs: 9000, tutorMs: 11000, localMs: 200 } },
    },
    {
      type: 'turn_complete',
      turn: 1,
      turnRecord: {
        learner: 'Can you explain “first implementation baseline” in simpler words? I am not following that phrase.',
        tutor: 'Here is the phrase in plain English.',
        classification: { turn: { discourse_plane: 'instructional_meta' } },
        responseConfiguration: { discourse_plane: { plane: 'instructional_meta' } },
        tutorResponseRepaired: false,
        tutorGuardAccounting: {
          finalDelivery: { source: 'original_candidate', auditOk: true, audits: { deliveryOk: true } },
        },
        tutorLeakAudit: { ok: true },
        tutorDramaticReleaseAudit: { ok: true },
        tutorQuestionSupportAudit: { ok: true },
      },
    },
  ];
  const result = parseTutorStubLatencyBenchmarkTrace({ events, job });
  assert.equal(result.planePass, true);
  assert.equal(result.runtimePlanePass, true);
  assert.equal(result.planeReclassified, false);
  assert.equal(result.firstDraftAccepted, true);
  assert.equal(result.recoveryCalls, 0);
  assert.equal(result.deterministicFallback, false);
  assert.equal(result.safetyPass, true);
  assert.equal(result.total.totalTokens, 21700);
  assert.equal(result.foreground.totalMs, 20200);
  const summary = summarizeTutorStubLatencyBenchmark([result]);
  assert.equal(summary.baseline.planeAccuracy, 1);
  assert.equal(summary.baseline.runtimePlaneAccuracy, 1);
  assert.equal(summary.baseline.foregroundLatencyMs.p95, 20200);
});

test('latency report distinguishes current contract rescoring from the plane used at runtime', () => {
  const learner =
    'Please explain “baseline” in plain English. Separately, I think student interviews should come before we choose one.';
  const job = {
    id: 'baseline__mixed__d1',
    variantId: 'baseline',
    factor: 'baseline',
    caseId: 'mixed',
    draw: 1,
    expectedPlane: 'mixed',
    learnerText: learner,
    tutorModel: 'codex.gpt-5.6-terra',
    analysisModel: 'codex.gpt-5.6-sol',
    cliEffort: 'medium',
    promptProfile: 'baseline',
    prefetchPolicy: 'always',
  };
  const events = [
    {
      type: 'turn_complete',
      turn: 1,
      turnRecord: {
        learner,
        tutor: 'A baseline is the first workable version. Your interview proposal can test which version to choose.',
        classification: {
          turn: { discourse_plane: 'object', discourse_move: 'claim', evidence_use: 'none' },
        },
        responseConfiguration: { discourse_plane: { plane: 'object' } },
        tutorGuardAccounting: {
          finalDelivery: { source: 'original_candidate', auditOk: true, audits: { deliveryOk: true } },
        },
        tutorLeakAudit: { ok: true },
        tutorDramaticReleaseAudit: { ok: true },
        tutorQuestionSupportAudit: { ok: true },
      },
    },
  ];

  const result = parseTutorStubLatencyBenchmarkTrace({ events, job });
  assert.equal(result.runtimeObservedPlane, 'object');
  assert.equal(result.runtimePlanePass, false);
  assert.equal(result.observedPlane, 'mixed');
  assert.equal(result.planePass, true);
  assert.equal(result.planeReclassified, true);
  assert.match(result.planeContractSchema, /discourse-plane\.v2$/u);

  const summary = summarizeTutorStubLatencyBenchmark([result]);
  assert.equal(summary.baseline.runtimePlaneAccuracy, 0);
  assert.equal(summary.baseline.planeAccuracy, 1);
  assert.equal(summary.baseline.planeReclassificationRate, 1);
});

test('prefetch report distinguishes saved background work from lost cache hits', () => {
  const events = [
    {
      type: 'model_call',
      turn: 1,
      role: 'tutor_stub_tutor_prefetch',
      response: { latencyMs: 10000, usage: { totalTokens: 12000 } },
    },
    {
      type: 'model_call',
      turn: 1,
      role: 'tutor_stub_tutor_prefetch_recovery',
      response: { latencyMs: 6000, usage: { totalTokens: 9000 } },
    },
    { type: 'mixed_learner_tutor_cache_hit', turn: 1 },
    { type: 'mixed_learner_tutor_cache_miss', turn: 2 },
    { type: 'mixed_learner_analysis_cache_hit' },
  ];
  const report = analyzeTutorStubPrefetchPolicies(events);
  assert.equal(report.observedAlways.tutorPrefetchCalls, 2);
  assert.equal(report.observedAlways.wastedTutorCalls, 0);
  assert.equal(report.counterfactualAnalysisOnly.avoidedBackgroundTutorLatencyMs, 16000);
  assert.equal(report.counterfactualAnalysisOnly.repliesLosingTutorCacheHit, 1);
});

test('latency job orchestration checkpoints failures and continues through the frozen plan', async () => {
  const jobs = [
    { id: 'first', variantId: 'baseline', caseId: 'object', draw: 1 },
    { id: 'second', variantId: 'baseline', caseId: 'mixed', draw: 1 },
    { id: 'third', variantId: 'baseline', caseId: 'instructional-meta', draw: 1 },
  ];
  const attempted = [];
  const checkpoints = [];
  const progress = await runTutorStubLatencyBenchmarkJobs({
    jobs,
    executeJob: async (job) => {
      attempted.push(job.id);
      if (job.id === 'second') {
        const error = new Error('guard exhaustion');
        error.benchmarkFailure = { exitCode: 1, tracePath: '/tmp/second.jsonl' };
        throw error;
      }
      return { jobId: job.id, variantId: job.variantId };
    },
    onCheckpoint: async (checkpoint) => checkpoints.push(checkpoint),
  });

  assert.deepEqual(attempted, ['first', 'second', 'third']);
  assert.equal(checkpoints.length, 3);
  assert.deepEqual(
    checkpoints.map((checkpoint) => [checkpoint.status, checkpoint.attemptedJobs, checkpoint.failedJobs]),
    [
      ['in_progress', 1, 0],
      ['in_progress', 2, 1],
      ['complete_with_failures', 3, 1],
    ],
  );
  assert.equal(progress.status, 'complete_with_failures');
  assert.equal(progress.completedJobs, 2);
  assert.equal(progress.failedJobs, 1);
  assert.equal(progress.failures[0].jobId, 'second');
  assert.equal(progress.failures[0].tracePath, '/tmp/second.jsonl');
  assert.equal(progress.failures[0].exitCode, 1);
});
