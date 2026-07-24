export const TUTOR_STUB_TURN_TIMING_SCHEMA = 'machinespirits.tutor-stub.turn-timing.v1';

function nonNegativeMs(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function timestampMs(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function tutorStubLearnerAnalysisModelLatencyMs({ classification = null, tutorLearnerDag = null } = {}) {
  const classificationLatency = nonNegativeMs(classification?.latencyMs);
  if (classification?.combined) return classificationLatency;
  return classificationLatency + nonNegativeMs(tutorLearnerDag?.extractor?.latencyMs);
}

export function buildTutorStubTurnTiming({
  startedAtMs,
  analysisStartedAtMs = startedAtMs,
  analysisCompletedAtMs = analysisStartedAtMs,
  tutorStartedAtMs = analysisCompletedAtMs,
  completedAtMs = Date.now(),
  analysisSource = 'foreground',
  tutorSource = 'foreground',
  classification = null,
  tutorLearnerDag = null,
  response = null,
} = {}) {
  const completed = timestampMs(completedAtMs, Date.now());
  const started = Math.min(timestampMs(startedAtMs, completed), completed);
  const analysisStarted = Math.max(started, Math.min(timestampMs(analysisStartedAtMs, started), completed));
  const analysisCompleted = Math.max(
    analysisStarted,
    Math.min(timestampMs(analysisCompletedAtMs, analysisStarted), completed),
  );
  const tutorStarted = Math.max(
    analysisCompleted,
    Math.min(timestampMs(tutorStartedAtMs, analysisCompleted), completed),
  );
  const totalMs = nonNegativeMs(completed - started);
  const analysisMs = nonNegativeMs(analysisCompleted - analysisStarted);
  const tutorMs = nonNegativeMs(completed - tutorStarted);
  const localMs = nonNegativeMs(totalMs - analysisMs - tutorMs);
  const generation = response?.guardAccounting?.generation || null;
  const tutorModelLatencyMs = nonNegativeMs(generation?.totalModelLatencyMs ?? response?.latencyMs);
  const originalCandidateLatencyMs = nonNegativeMs(
    generation?.originalCandidateLatencyMs ?? response?.finalCandidateLatencyMs ?? response?.latencyMs,
  );
  const recoveryLatencyMs = nonNegativeMs(generation?.recoveryLatencyMs);
  const modelCallCount = Number.isFinite(Number(generation?.modelCallCount))
    ? Math.max(0, Math.round(Number(generation.modelCallCount)))
    : tutorModelLatencyMs > 0
      ? 1
      : 0;

  return {
    schema: TUTOR_STUB_TURN_TIMING_SCHEMA,
    foreground: {
      totalMs,
      analysisMs,
      tutorMs,
      localMs,
    },
    analysis: {
      source: analysisSource,
      elapsedMs: analysisMs,
      modelLatencyMs: tutorStubLearnerAnalysisModelLatencyMs({ classification, tutorLearnerDag }),
      prefetched: analysisSource === 'prefetched' || analysisSource === 'precomputed',
    },
    tutor: {
      source: tutorSource,
      elapsedMs: tutorMs,
      modelLatencyMs: tutorModelLatencyMs,
      modelCallCount,
      originalCandidateLatencyMs,
      recoveryLatencyMs,
      prefetched: tutorSource === 'prefetched',
      deterministicFallback: Boolean(response?.deterministicFallback),
    },
  };
}

function compactDuration(ms) {
  const value = nonNegativeMs(ms);
  if (value > 0 && value < 100) return '<0.1s';
  return `${(value / 1000).toFixed(1)}s`;
}

function sourceSuffix(source) {
  if (source === 'prefetched' || source === 'precomputed') return ' (prefetched)';
  if (source === 'disabled') return ' (off)';
  if (source === 'deterministic') return ' (local)';
  return '';
}

export function formatTutorStubTurnTiming(timing) {
  if (!timing?.foreground) return '';
  const tutor = timing.tutor || {};
  const recovery = nonNegativeMs(tutor.recoveryLatencyMs);
  const recoverySuffix = recovery
    ? ` (${Math.max(2, Number(tutor.modelCallCount) || 2)} calls; recovery ${compactDuration(recovery)})`
    : sourceSuffix(tutor.source);
  return [
    `time > wait ${compactDuration(timing.foreground.totalMs)}`,
    `analysis ${compactDuration(timing.foreground.analysisMs)}${sourceSuffix(timing.analysis?.source)}`,
    `tutor ${compactDuration(timing.foreground.tutorMs)}${recoverySuffix}`,
    `local ${compactDuration(timing.foreground.localMs)}`,
  ].join(' · ');
}
