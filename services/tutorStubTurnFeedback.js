import { tutorStubFeedbackAdaptationPrompt } from './tutorStubFeedbackLearning.js';
import { TUTOR_STUB_FEEDBACK_REASONS, normalizeTutorStubFeedbackReason } from './tutorStubTuning.js';

export const TUTOR_STUB_TURN_FEEDBACK_STATE_SCHEMA = 'machinespirits.tutor-stub.turn-feedback-state.v1';
export const TUTOR_STUB_TURN_FEEDBACK_SCHEMA = 'machinespirits.tutor-stub.turn-feedback.v1';

const RATINGS = new Set(['up', 'down']);

function normalizedRating(value) {
  const rating = String(value || '')
    .trim()
    .toLowerCase();
  return RATINGS.has(rating) ? rating : null;
}

export function createTutorStubTurnFeedbackState({ enabled = true, automatedLearner = false } = {}) {
  return {
    schema: TUTOR_STUB_TURN_FEEDBACK_STATE_SCHEMA,
    enabled: Boolean(enabled && !automatedLearner),
    defaultOn: true,
    optional: true,
    automatedLearner: Boolean(automatedLearner),
    target: null,
    rating: null,
    reason: null,
    comment: null,
    scope: null,
    ratedAt: null,
    history: [],
  };
}

export function requestTutorStubTurnFeedback(state, target = {}) {
  if (!state?.enabled || state.automatedLearner) return null;
  const tutorTurn = Number.isFinite(Number(target.tutorTurn)) ? Number(target.tutorTurn) : null;
  state.target = {
    tutorTurn,
    tutorTurnId: String(target.tutorTurnId || '').trim() || null,
    kind: String(target.kind || 'tutor_response').trim() || 'tutor_response',
    requestedAt: String(target.requestedAt || '').trim() || new Date().toISOString(),
  };
  state.rating = null;
  state.reason = null;
  state.comment = null;
  state.scope = null;
  state.ratedAt = null;
  return tutorStubTurnFeedbackEnvelope(state);
}

export function setTutorStubTurnFeedbackRating(
  state,
  rating,
  { ratedAt = null, reason = null, comment = null, scope = null } = {},
) {
  const normalized = normalizedRating(rating);
  if (!normalized) throw new Error('turn feedback rating must be up or down');
  if (!state?.enabled || state.automatedLearner || !state.target) return null;
  state.rating = normalized;
  state.reason = reason ? normalizeTutorStubFeedbackReason(reason, normalized) : null;
  state.comment =
    String(comment || '')
      .replace(/\s+/gu, ' ')
      .trim()
      .slice(0, 500) || null;
  state.scope = String(scope || TUTOR_STUB_FEEDBACK_REASONS[state.reason]?.scope || '').trim() || null;
  state.ratedAt = String(ratedAt || '').trim() || new Date().toISOString();
  return tutorStubTurnFeedbackEnvelope(state);
}

export function clearTutorStubTurnFeedbackTarget(state) {
  if (!state) return null;
  state.target = null;
  state.rating = null;
  state.reason = null;
  state.comment = null;
  state.scope = null;
  state.ratedAt = null;
  return tutorStubTurnFeedbackEnvelope(state);
}

export function clearTutorStubTurnFeedbackRating(state) {
  if (!state) return null;
  state.rating = null;
  state.reason = null;
  state.comment = null;
  state.scope = null;
  state.ratedAt = null;
  return tutorStubTurnFeedbackEnvelope(state);
}

export function setTutorStubTurnFeedbackEnabled(state, enabled) {
  if (!state) return null;
  state.enabled = Boolean(enabled && !state.automatedLearner);
  if (!state.enabled) clearTutorStubTurnFeedbackTarget(state);
  return tutorStubTurnFeedbackEnvelope(state);
}

export function tutorStubTurnFeedbackEnvelope(state) {
  const enabled = Boolean(state?.enabled && !state?.automatedLearner);
  const target = enabled ? state?.target || null : null;
  const rating = target ? normalizedRating(state?.rating) : null;
  return {
    schema: TUTOR_STUB_TURN_FEEDBACK_SCHEMA,
    enabled,
    requested: Boolean(target),
    supplied: Boolean(target && rating),
    rating,
    reason: rating ? state?.reason || null : null,
    reasonLabel: rating && state?.reason ? TUTOR_STUB_FEEDBACK_REASONS[state.reason]?.label || state.reason : null,
    comment: rating ? state?.comment || null : null,
    scope: rating ? state?.scope || null : null,
    targetTutorTurn: target?.tutorTurn ?? null,
    targetTutorTurnId: target?.tutorTurnId || null,
    targetKind: target?.kind || null,
    requestedAt: target?.requestedAt || null,
    ratedAt: rating ? state?.ratedAt || null : null,
    source: enabled ? 'human_learner' : state?.automatedLearner ? 'automated_learner_disabled' : 'disabled',
  };
}

export function tutorStubTurnFeedbackArrowRating({
  line = '',
  key = {},
  feedback = null,
  busy = false,
  interactiveMode = 'learner',
  interfaceBlocked = false,
} = {}) {
  if (
    String(line).length > 0 ||
    busy ||
    interfaceBlocked ||
    interactiveMode === 'auto' ||
    !feedback?.enabled ||
    !feedback?.requested ||
    key?.shift ||
    key?.ctrl ||
    key?.meta
  ) {
    return null;
  }
  if (key?.name === 'left') return 'down';
  if (key?.name === 'right') return 'up';
  return null;
}

export function tutorStubTurnFeedbackEscapeDismissal({
  line = '',
  key = {},
  feedback = null,
  interactiveMode = 'learner',
  interfaceBlocked = false,
  selectionActive = false,
} = {}) {
  return Boolean(
    key?.name === 'escape' &&
    !key?.shift &&
    !key?.ctrl &&
    String(line).length === 0 &&
    !interfaceBlocked &&
    !selectionActive &&
    interactiveMode !== 'auto' &&
    feedback?.enabled &&
    feedback?.requested,
  );
}

export function commitTutorStubTurnFeedback(state, { learnerTurn = null, learnerTurnId = null } = {}) {
  if (!state) return null;
  const feedback = tutorStubTurnFeedbackEnvelope(state);
  if (feedback.requested) {
    state.history.push({
      ...feedback,
      learnerTurn: Number.isFinite(Number(learnerTurn)) ? Number(learnerTurn) : null,
      learnerTurnId: String(learnerTurnId || '').trim() || null,
      committedAt: new Date().toISOString(),
    });
  }
  clearTutorStubTurnFeedbackTarget(state);
  return feedback;
}

export function tutorStubTurnFeedbackPrompt(feedback, { adaptationPlan = null } = {}) {
  const rating = feedback?.supplied ? normalizedRating(feedback.rating) : null;
  if (!rating) return null;
  const reading =
    rating === 'up'
      ? 'The learner marked your previous public response helpful.'
      : 'The learner marked your previous public response unhelpful.';
  const action =
    rating === 'up'
      ? 'Preserve the useful quality, but still respond to the learner’s new words and avoid repeating the prior response.'
      : 'Change something observable now: make the response clearer, more direct, better grounded, or differently paced according to the current learner evidence.';
  const typedDirection = feedback.reason ? TUTOR_STUB_FEEDBACK_REASONS[feedback.reason]?.rule || null : null;
  return [
    '[Private learner feedback on your previous response]',
    reading,
    'Treat this as one subjective self-assessment signal alongside the public learner turn and objective reasoning-state movement.',
    action,
    typedDirection
      ? `The learner selected this bounded reason: ${feedback.reasonLabel}. Apply this reviewed interpretation: ${typedDirection}`
      : null,
    tutorStubFeedbackAdaptationPrompt(adaptationPlan),
    'Do not mention the rating, the feedback request, or this private note in public speech.',
    '[End private learner feedback]',
  ]
    .filter(Boolean)
    .join('\n');
}

export function tutorStubTurnFeedbackRegisterPrompt(feedback) {
  const rating = feedback?.supplied ? normalizedRating(feedback.rating) : null;
  if (!rating) return null;
  const reason = feedback?.reasonLabel ? ` Their reason was: ${feedback.reasonLabel}.` : '';
  return rating === 'up'
    ? `The learner gave the previous tutor response a thumbs-up.${reason} Use that as one subjective efficacy signal when selecting the next engagement stance; do not confuse it with the content of the learner turn.`
    : `The learner gave the previous tutor response a thumbs-down.${reason} Treat the prior stance or realization as needing visible adaptation when selecting the next engagement stance; do not confuse the rating with the content of the learner turn.`;
}

export function tutorStubTurnFeedbackLabel(feedback) {
  if (!feedback?.requested) return 'not requested';
  const reason = feedback.reasonLabel ? ` · ${feedback.reasonLabel}` : '';
  if (feedback.rating === 'up') return `👍 helpful${reason}`;
  if (feedback.rating === 'down') return `👎 not helpful${reason}`;
  return 'not rated';
}
