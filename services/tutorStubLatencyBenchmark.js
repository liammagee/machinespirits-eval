import fs from 'node:fs';
import path from 'node:path';

import { resolveTutorStubDiscoursePlane } from './tutorStubDiscoursePlane.js';

export const TUTOR_STUB_LATENCY_BENCHMARK_SCHEMA = 'machinespirits.tutor-stub.latency-benchmark.v1';
export const TUTOR_STUB_LATENCY_BENCHMARK_REPORT_SCHEMA = 'machinespirits.tutor-stub.latency-benchmark-report.v2';

const PLANES = new Set(['object', 'instructional_meta', 'mixed']);
const FACTORS = new Set(['baseline', 'effort', 'routing', 'prompt', 'prefetch']);
const PROMPT_PROFILES = new Set(['baseline', 'compact_v1']);
const PREFETCH_POLICIES = new Set(['always', 'analysis_only']);

function requiredText(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function modelRef(value, label) {
  const ref = requiredText(value, label);
  if (!/^[a-z0-9_-]+\.[a-z0-9._-]+$/iu.test(ref)) {
    throw new Error(`${label} must use provider.model notation`);
  }
  return ref;
}

function positiveInt(value, label, fallback = 1) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new Error(`${label} must be an integer from 1 to 20`);
  }
  return parsed;
}

function uniqueRows(rows, label) {
  const ids = new Set();
  for (const row of rows) {
    const id = requiredText(row?.id, `${label} id`);
    if (ids.has(id)) throw new Error(`duplicate ${label} id: ${id}`);
    ids.add(id);
  }
}

export function validateTutorStubLatencyBenchmarkConfig(config) {
  if (config?.schema !== TUTOR_STUB_LATENCY_BENCHMARK_SCHEMA) {
    throw new Error(`benchmark schema must be ${TUTOR_STUB_LATENCY_BENCHMARK_SCHEMA}`);
  }
  requiredText(config.id, 'benchmark id');
  const defaults = config.defaults || {};
  requiredText(defaults.world, 'defaults.world');
  modelRef(defaults.tutor_model, 'defaults.tutor_model');
  modelRef(defaults.analysis_model, 'defaults.analysis_model');
  const cases = Array.isArray(config.cases) ? config.cases : [];
  const variants = Array.isArray(config.variants) ? config.variants : [];
  if (!cases.length) throw new Error('benchmark requires at least one case');
  if (!variants.length) throw new Error('benchmark requires at least one variant');
  uniqueRows(cases, 'case');
  uniqueRows(variants, 'variant');
  for (const row of cases) {
    requiredText(row.learner_text, `case ${row.id} learner_text`);
    if (!PLANES.has(row.expected_plane)) {
      throw new Error(`case ${row.id} expected_plane must be object, instructional_meta, or mixed`);
    }
    const resolved = resolveTutorStubDiscoursePlane({ learnerText: row.learner_text });
    if (resolved.plane !== row.expected_plane) {
      throw new Error(
        `case ${row.id} is not deterministic under ${resolved.schema}: expected ${row.expected_plane}, resolved ${resolved.plane}`,
      );
    }
  }
  let baselineCount = 0;
  for (const row of variants) {
    const factor = String(row.factor || '').trim();
    if (!FACTORS.has(factor)) throw new Error(`variant ${row.id} has unknown factor ${factor}`);
    if (factor === 'baseline') baselineCount += 1;
    modelRef(row.tutor_model || defaults.tutor_model, `variant ${row.id} tutor_model`);
    modelRef(row.analysis_model || defaults.analysis_model, `variant ${row.id} analysis_model`);
    const effort = String(row.cli_effort || defaults.cli_effort || 'medium');
    if (!['low', 'medium', 'high', 'xhigh', 'max', 'config'].includes(effort)) {
      throw new Error(`variant ${row.id} has invalid cli_effort ${effort}`);
    }
    const profile = String(row.prompt_profile || defaults.prompt_profile || 'baseline');
    if (!PROMPT_PROFILES.has(profile)) throw new Error(`variant ${row.id} has invalid prompt_profile ${profile}`);
    const prefetch = String(row.prefetch_policy || defaults.prefetch_policy || 'always');
    if (!PREFETCH_POLICIES.has(prefetch)) throw new Error(`variant ${row.id} has invalid prefetch_policy ${prefetch}`);
  }
  if (baselineCount !== 1) throw new Error(`benchmark requires exactly one baseline variant; found ${baselineCount}`);
  return {
    schema: TUTOR_STUB_LATENCY_BENCHMARK_SCHEMA,
    id: config.id,
    caseCount: cases.length,
    variantCount: variants.length,
    draws: positiveInt(config.draws, 'draws'),
    planeContract: cases.map((row) => {
      const resolved = resolveTutorStubDiscoursePlane({ learnerText: row.learner_text });
      return {
        caseId: row.id,
        expectedPlane: row.expected_plane,
        resolvedPlane: resolved.plane,
        schema: resolved.schema,
      };
    }),
  };
}

export function expandTutorStubLatencyBenchmark({ config, root = process.cwd(), traceRoot, factors = null } = {}) {
  const validation = validateTutorStubLatencyBenchmarkConfig(config);
  const defaults = config.defaults || {};
  const factorSet = factors?.length ? new Set(['baseline', ...factors]) : null;
  const jobs = [];
  for (const variant of config.variants) {
    if (factorSet && !factorSet.has(variant.factor)) continue;
    for (const testCase of config.cases) {
      for (let draw = 1; draw <= validation.draws; draw += 1) {
        const id = `${variant.id}__${testCase.id}__d${draw}`;
        const jobTraceDir = path.resolve(traceRoot, id);
        jobs.push({
          id,
          benchmarkId: config.id,
          variantId: variant.id,
          factor: variant.factor,
          caseId: testCase.id,
          draw,
          expectedPlane: testCase.expected_plane,
          learnerText: testCase.learner_text,
          tutorModel: variant.tutor_model || defaults.tutor_model,
          analysisModel: variant.analysis_model || defaults.analysis_model,
          cliEffort: variant.cli_effort || defaults.cli_effort || 'medium',
          promptProfile: variant.prompt_profile || defaults.prompt_profile || 'baseline',
          prefetchPolicy: variant.prefetch_policy || defaults.prefetch_policy || 'always',
          traceDir: jobTraceDir,
          settingsFile: path.join(jobTraceDir, 'settings.json'),
          args: [
            '--once',
            testCase.learner_text,
            '--world',
            testCase.world || defaults.world,
            '--tutor',
            testCase.tutor || defaults.tutor || 'dramatic-detective',
            '--tuning',
            'off',
            '--dag',
            '--tutor-learner-dag',
            '--dag-mode',
            defaults.dag_mode || 'defeasible_human_scaffold',
            '--register-policy',
            defaults.register_policy || 'continuous_dynamical_system',
            '--model',
            variant.tutor_model || defaults.tutor_model,
            '--classifier-model',
            variant.analysis_model || defaults.analysis_model,
            '--learner-record-model',
            variant.analysis_model || defaults.analysis_model,
            '--cli-effort',
            variant.cli_effort || defaults.cli_effort || 'medium',
            '--learner-analysis-prompt-profile',
            variant.prompt_profile || defaults.prompt_profile || 'baseline',
            '--mixed-tutor-prefetch-policy',
            variant.prefetch_policy || defaults.prefetch_policy || 'always',
            '--history-turns',
            String(defaults.history_turns || 4),
            '--max-tokens',
            String(defaults.max_tokens || 4096),
            '--opening-realizer',
            'deterministic',
            '--trace-dir',
            jobTraceDir,
            '--settings-file',
            path.join(jobTraceDir, 'settings.json'),
            '--no-remember-settings',
            '--no-turn-feedback',
            '--no-response-details',
            '--no-closeout-report',
            '--no-memory-summary',
            '--no-interim-animation',
            '--no-stream',
            '--no-color',
          ],
          cwd: path.resolve(root),
        });
      }
    }
  }
  return { ...validation, jobs };
}

export function readTutorStubTraceEvents(tracePath) {
  return fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function usageForCalls(calls) {
  return calls.reduce(
    (sum, event) => {
      const usage = event.response?.usage || {};
      sum.inputTokens += Number(usage.inputTokens || 0);
      sum.outputTokens += Number(usage.outputTokens || 0);
      sum.totalTokens += Number(usage.totalTokens || 0);
      sum.latencyMs += Number(event.response?.latencyMs || 0);
      return sum;
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, latencyMs: 0 },
  );
}

export function parseTutorStubLatencyBenchmarkTrace({ events, job, tracePath = null } = {}) {
  const complete = events.find((event) => event.type === 'turn_complete' && Number(event.turn) === 1);
  const timingEvent = events.find((event) => event.type === 'turn_timing_breakdown' && Number(event.turn) === 1);
  if (!complete?.turnRecord) throw new Error(`benchmark job ${job.id} produced no completed turn`);
  const record = complete.turnRecord;
  const calls = events.filter((event) => event.type === 'model_call' && Number(event.turn) === 1);
  const analysisCalls = calls.filter((event) => /learner_analysis/u.test(event.role || ''));
  const tutorCalls = calls.filter((event) => /^tutor_stub_tutor(?:_|$)/u.test(event.role || ''));
  const recoveryCalls = tutorCalls.filter((event) => /recovery/u.test(event.role || ''));
  const runtimeObservedPlane =
    record.responseConfiguration?.discourse_plane?.plane ||
    record.classification?.turn?.discourse_plane ||
    record.humanDiscourseFrame?.discoursePlane?.plane ||
    null;
  const learnerText = String(record.learner || job.learnerText || '').trim();
  const rescoredDiscoursePlane = learnerText
    ? resolveTutorStubDiscoursePlane({
        learnerText,
        classification: record.classification || null,
        sideArc: record.humanDiscourseFrame?.sideArc || record.humanDiscourseFrame?.side_arc || null,
      })
    : null;
  const observedPlane = rescoredDiscoursePlane?.plane || runtimeObservedPlane;
  const finalDelivery = record.tutorGuardAccounting?.finalDelivery || {};
  const finalDeliverySource = finalDelivery.source || finalDelivery.kind || null;
  const deterministicFallback = Boolean(
    record.tutorDeterministicFallback || finalDeliverySource === 'deterministic_fallback',
  );
  const firstDraftAccepted = Boolean(
    !deterministicFallback &&
    recoveryCalls.length === 0 &&
    (finalDeliverySource === 'original_candidate' || record.tutorResponseRepaired === false),
  );
  const finalDeliveryAuditPassed = finalDelivery.auditOk === true || finalDelivery.audits?.deliveryOk === true;
  const safetyPass = Boolean(
    finalDeliverySource &&
    finalDeliveryAuditPassed &&
    record.tutorLeakAudit?.ok === true &&
    record.tutorDramaticReleaseAudit?.ok !== false &&
    record.tutorQuestionSupportAudit?.ok !== false,
  );
  return {
    schema: TUTOR_STUB_LATENCY_BENCHMARK_REPORT_SCHEMA,
    jobId: job.id,
    variantId: job.variantId,
    factor: job.factor,
    caseId: job.caseId,
    draw: job.draw,
    tracePath,
    expectedPlane: job.expectedPlane,
    observedPlane,
    runtimeObservedPlane,
    runtimePlanePass: runtimeObservedPlane === job.expectedPlane,
    planeContractSchema: rescoredDiscoursePlane?.schema || null,
    planeReclassified: Boolean(runtimeObservedPlane && runtimeObservedPlane !== observedPlane),
    planePass: observedPlane === job.expectedPlane,
    tutorModel: job.tutorModel,
    analysisModel: job.analysisModel,
    cliEffort: job.cliEffort,
    promptProfile: job.promptProfile,
    prefetchPolicy: job.prefetchPolicy,
    firstDraftAccepted,
    recoveryCalls: recoveryCalls.length,
    deterministicFallback,
    safetyPass,
    foreground: timingEvent?.timing?.foreground || record.turnTiming?.foreground || null,
    analysis: usageForCalls(analysisCalls),
    tutor: usageForCalls(tutorCalls),
    total: usageForCalls(calls),
    promptCharacters: analysisCalls.reduce((sum, event) => sum + Number(event.request?.promptAudit?.chars || 0), 0),
    deliveredTutorText: String(record.tutor || ''),
  };
}

function quantile(values, proportion) {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * proportion) - 1)];
}

export function summarizeTutorStubLatencyBenchmark(results = []) {
  const variants = {};
  for (const row of results) {
    const bucket = variants[row.variantId] || [];
    bucket.push(row);
    variants[row.variantId] = bucket;
  }
  return Object.fromEntries(
    Object.entries(variants).map(([variantId, rows]) => {
      const foreground = rows.map((row) => row.foreground?.totalMs).filter(Number.isFinite);
      const analysis = rows.map((row) => row.analysis.latencyMs).filter(Number.isFinite);
      const tutor = rows.map((row) => row.tutor.latencyMs).filter(Number.isFinite);
      return [
        variantId,
        {
          jobs: rows.length,
          planeAccuracy: rows.filter((row) => row.planePass).length / rows.length,
          runtimePlaneAccuracy: rows.filter((row) => row.runtimePlanePass ?? row.planePass).length / rows.length,
          planeReclassificationRate: rows.filter((row) => row.planeReclassified).length / rows.length,
          firstDraftAcceptanceRate: rows.filter((row) => row.firstDraftAccepted).length / rows.length,
          recoveryRate: rows.filter((row) => row.recoveryCalls > 0).length / rows.length,
          fallbackRate: rows.filter((row) => row.deterministicFallback).length / rows.length,
          safetyPassRate: rows.filter((row) => row.safetyPass).length / rows.length,
          foregroundLatencyMs: { p50: quantile(foreground, 0.5), p95: quantile(foreground, 0.95) },
          analysisLatencyMs: { p50: quantile(analysis, 0.5), p95: quantile(analysis, 0.95) },
          tutorLatencyMs: { p50: quantile(tutor, 0.5), p95: quantile(tutor, 0.95) },
          totalTokens: rows.reduce((sum, row) => sum + row.total.totalTokens, 0),
          promptCharacters: rows.reduce((sum, row) => sum + row.promptCharacters, 0),
        },
      ];
    }),
  );
}

export function analyzeTutorStubPrefetchPolicies(events = []) {
  const tutorPrefetchCalls = events.filter(
    (event) => event.type === 'model_call' && /^tutor_stub_tutor_prefetch(?:_|$)/u.test(event.role || ''),
  );
  const tutorHits = events.filter((event) => event.type === 'mixed_learner_tutor_cache_hit').length;
  const tutorHitTurns = new Set(
    events
      .filter((event) => event.type === 'mixed_learner_tutor_cache_hit' && Number.isFinite(Number(event.turn)))
      .map((event) => Number(event.turn)),
  );
  const tutorMisses = events.filter((event) => event.type === 'mixed_learner_tutor_cache_miss').length;
  const analysisHits = events.filter((event) => event.type === 'mixed_learner_analysis_cache_hit').length;
  const usage = usageForCalls(tutorPrefetchCalls);
  return {
    schema: 'machinespirits.tutor-stub.prefetch-policy-counterfactual.v1',
    observedAlways: {
      tutorPrefetchCalls: tutorPrefetchCalls.length,
      tutorHits,
      tutorMisses,
      analysisHits,
      backgroundTutorLatencyMs: usage.latencyMs,
      backgroundTutorTokens: usage.totalTokens,
      wastedTutorCalls: tutorPrefetchCalls.filter((event) => !tutorHitTurns.has(Number(event.turn))).length,
    },
    counterfactualAnalysisOnly: {
      avoidedBackgroundTutorCalls: tutorPrefetchCalls.length,
      avoidedBackgroundTutorLatencyMs: usage.latencyMs,
      avoidedBackgroundTutorTokens: usage.totalTokens,
      repliesLosingTutorCacheHit: tutorHits,
      interpretation:
        'Model-free counterfactual: learner-suggestion and learner-analysis prefetch remain; every tutor cache hit becomes a foreground tutor call.',
    },
  };
}
