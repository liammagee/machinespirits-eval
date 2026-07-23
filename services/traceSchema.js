/**
 * Canonical trace-schema helpers shared by emitters and readers.
 *
 * Version 2.0 makes the learner ego's initial and revision stages explicit.
 * Readers continue to classify the historical `learner_ego` label by its
 * recorded stage or its position relative to the learner superego.
 */

export const TRACE_SCHEMA_VERSION = '2.0';

const INITIAL_STAGES = new Set(['initial', 'draft', 'reaction']);
const REVISION_STAGES = new Set(['adjudication', 'revision', 'revise', 'revised', 'final']);

function normalized(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function learnerDeliberationTraceAgent(deliberation = {}) {
  const role = normalized(deliberation.role);
  const stage = normalized(deliberation.stage);

  if (role === 'ego_initial') return 'learner_ego_initial';
  if (role === 'ego_revision') return 'learner_ego_revision';
  if (role === 'superego') return 'learner_superego';
  if (role === 'ego') {
    if (INITIAL_STAGES.has(stage)) return 'learner_ego_initial';
    if (REVISION_STAGES.has(stage)) return 'learner_ego_revision';
    return 'learner_ego';
  }

  return role ? `learner_${role}` : 'learner_unknown';
}

/**
 * Classify a canonical or historical learner trace entry.
 *
 * @returns {'initial'|'review'|'revision'|'final'|null}
 */
export function learnerTraceStage(entry, trace = null, index = -1) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.agent === 'learner_ego_initial') return 'initial';
  if (entry.agent === 'learner_superego') return 'review';
  if (entry.agent === 'learner_ego_revision') return 'revision';
  if ((entry.agent === 'learner' || entry.agent === 'user') && entry.action === 'final_output') return 'final';
  if (entry.agent !== 'learner_ego') return null;

  const recordedStage = normalized(entry.stage);
  if (INITIAL_STAGES.has(recordedStage)) return 'initial';
  if (REVISION_STAGES.has(recordedStage)) return 'revision';

  // Old traces omitted stage metadata. An ego entry after the learner
  // superego in the same turn is the revision; otherwise it is the initial.
  if (Array.isArray(trace) && index >= 0) {
    for (let i = index - 1; i >= 0; i--) {
      const previous = trace[i];
      if (previous?.turnIndex !== entry.turnIndex) break;
      if (
        ((previous?.agent === 'learner' || previous?.agent === 'user') && previous?.action === 'final_output') ||
        ((previous?.agent === 'tutor' || previous?.agent === 'user') && previous?.action === 'context_input')
      ) {
        break;
      }
      if (previous?.agent === 'learner_superego') return 'revision';
      if (previous?.agent === 'learner_ego' || previous?.agent === 'learner_ego_initial') break;
    }
  }
  return 'initial';
}

export function projectLearnerDeliberationTrace({ internalDeliberation, finalMessage, turnIndex, timestamp } = {}) {
  if (!Array.isArray(internalDeliberation) || internalDeliberation.length === 0) return [];

  const emittedAt = timestamp || new Date().toISOString();
  const entries = internalDeliberation.map((deliberation) => {
    const metrics = deliberation.metrics || null;
    const content = String(deliberation.content || '');
    return {
      agent: learnerDeliberationTraceAgent(deliberation),
      action: 'deliberation',
      traceSchemaVersion: TRACE_SCHEMA_VERSION,
      turnIndex,
      contextSummary: content.substring(0, 100),
      detail: content,
      latencyMs: metrics?.latencyMs ?? null,
      provider: metrics?.provider || null,
      metrics,
      apiPayload: deliberation.apiPayload || null,
      inputMessages: deliberation.inputMessages || null,
      timestamp: emittedAt,
    };
  });

  const finalDeliberation = internalDeliberation[internalDeliberation.length - 1];
  const finalMetrics = finalDeliberation?.metrics || null;
  const publicMessage = String(finalMessage || '');
  entries.push({
    agent: 'learner',
    action: 'final_output',
    traceSchemaVersion: TRACE_SCHEMA_VERSION,
    turnIndex,
    contextSummary: publicMessage.substring(0, 100),
    detail: publicMessage,
    latencyMs: finalMetrics?.latencyMs ?? null,
    provider: finalMetrics?.provider || null,
    metrics: finalMetrics,
    apiPayload: finalDeliberation?.apiPayload || null,
    inputMessages: null,
    timestamp: emittedAt,
  });

  return entries;
}

export default {
  TRACE_SCHEMA_VERSION,
  learnerDeliberationTraceAgent,
  learnerTraceStage,
  projectLearnerDeliberationTrace,
};
