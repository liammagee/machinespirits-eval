export const TUTOR_STUB_SIDE_ARC_SCHEMA = 'machinespirits.tutor-stub.side-arc.v1';

export function projectTutorStubSideArcState({
  dagMode,
  classification = null,
  learnerText = '',
  scaffoldState = null,
  generousInference = null,
}) {
  if (generousInference?.applied) {
    return {
      schema: TUTOR_STUB_SIDE_ARC_SCHEMA,
      mode: dagMode,
      detected: false,
      type: null,
      status: 'contextual_answer_resolved',
      returnTarget: null,
      learnerNeed: 'Acknowledge the resolved local inference and advance.',
      reason: 'A high-confidence adjacent elliptical answer completed the current local move.',
    };
  }
  const turn = classification?.turn || {};
  const labels = [turn.request_type, turn.discourse_move, turn.epistemic_stance, turn.affect]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const text = String(learnerText || '').toLowerCase();
  let type = null;
  let reason = 'no side arc detected';
  if (/plain|simpl|clarif|what do you mean|old language|confus|translate|wording/u.test(`${labels} ${text}`)) {
    type = 'clarification_or_plain_language';
    reason = 'learner is asking for clarification, translation, or simpler wording';
  } else if (/challenge|authority_refusal|low_trust|why|how do we know|prove|smuggling/u.test(`${labels} ${text}`)) {
    type = 'warrant_challenge';
    reason = 'learner is challenging the warrant or the tutor authority behind it';
  } else if (/resistant|affective|frustrat|pressure|defensive|too much|lost/u.test(`${labels} ${text}`)) {
    type = 'affective_repair';
    reason = 'learner is signalling affective resistance, pressure, or loss of agency';
  } else if (/off_task|unrelated/u.test(labels)) {
    type = 'off_task_or_contextual';
    reason = 'learner moved away from the proof path';
  }
  return {
    schema: TUTOR_STUB_SIDE_ARC_SCHEMA,
    mode: dagMode,
    detected: Boolean(type),
    type,
    status: type ? 'active_return_required' : 'none',
    returnTarget: type ? scaffoldState?.returnTarget || null : null,
    learnerNeed: type ? turn.pedagogical_need || classification?.overall?.next_best_tutor_move || null : null,
    reason,
  };
}
