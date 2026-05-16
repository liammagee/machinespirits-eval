export const PARENT_ACTIONS = Object.freeze([
  'ask_diagnostic_question',
  'mirror_and_extend',
  'scope_test',
  'repair_misrecognition',
  'give_worked_example',
  'lower_cognitive_load',
  'provide_hint',
  'request_elaboration',
  'acknowledge_and_redirect',
  'name_the_disagreement',
  'withhold_answer',
  'summarize_and_check',
  'pose_counterexample',
  'invite_objection',
]);

export const PARENT_ACTION_FAMILY = Object.freeze({
  ask_diagnostic_question: 'diagnostic',
  request_elaboration: 'diagnostic',
  invite_objection: 'diagnostic',
  mirror_and_extend: 'substantive',
  scope_test: 'substantive',
  name_the_disagreement: 'substantive',
  pose_counterexample: 'substantive',
  repair_misrecognition: 'repair',
  acknowledge_and_redirect: 'repair',
  lower_cognitive_load: 'scaffold',
  provide_hint: 'scaffold',
  give_worked_example: 'scaffold',
  withhold_answer: 'productive_struggle',
  summarize_and_check: 'consolidate',
});

export const PROTOTYPE_POLICY_FAMILY = Object.freeze({
  diagnostic_probe: 'diagnostic',
  teach_back: 'diagnostic',
  contrastive_probe: 'substantive',
  minimal_hint: 'scaffold',
  faded_example: 'scaffold',
  repair_misrecognition: 'repair',
  affective_repair: 'repair',
  misconception_repair: 'repair',
  transfer_challenge: 'transfer',
  transfer_repair: 'transfer',
  summarize_and_check: 'consolidate',
  productive_struggle_hold: 'productive_struggle',
});

export const PARENT_TO_PROTOTYPE_ACCEPTABLE = Object.freeze({
  ask_diagnostic_question: ['diagnostic_probe', 'teach_back', 'contrastive_probe'],
  mirror_and_extend: ['minimal_hint', 'contrastive_probe', 'transfer_challenge', 'transfer_repair'],
  scope_test: ['contrastive_probe', 'minimal_hint', 'transfer_challenge', 'transfer_repair'],
  repair_misrecognition: ['repair_misrecognition'],
  give_worked_example: ['faded_example'],
  lower_cognitive_load: ['affective_repair', 'minimal_hint', 'faded_example'],
  provide_hint: ['minimal_hint', 'faded_example'],
  request_elaboration: ['diagnostic_probe', 'teach_back', 'contrastive_probe'],
  acknowledge_and_redirect: ['affective_repair', 'minimal_hint'],
  name_the_disagreement: ['contrastive_probe', 'minimal_hint'],
  withhold_answer: ['productive_struggle_hold', 'diagnostic_probe', 'teach_back'],
  summarize_and_check: ['summarize_and_check', 'productive_struggle_hold'],
  pose_counterexample: ['contrastive_probe', 'minimal_hint'],
  invite_objection: ['diagnostic_probe', 'contrastive_probe'],
});

const SCENARIO_EXPECTED_DEFAULTS = Object.freeze({
  false_confusion: 'scope_test',
  polite_false_mastery: 'ask_diagnostic_question',
  resistance_to_insight: 'name_the_disagreement',
  answer_seeking_to_productive_struggle: 'withhold_answer',
  metaphor_boundary_case: 'name_the_disagreement',
  affective_shutdown: 'acknowledge_and_redirect',
  repair_after_misrecognition: 'repair_misrecognition',
  sophistication_upgrade: 'mirror_and_extend',
  epistemic_resistance: 'name_the_disagreement',
  productive_deadlock: 'name_the_disagreement',
  misconception_surfaces: 'ask_diagnostic_question',
  activity_avoidance: 'withhold_answer',
  struggling_overload: 'lower_cognitive_load',
});

export function mapPrototypeTurnToParentAction({ turn, scenario = {} } = {}) {
  const scenarioType = scenario.challenge_profile?.scenario_type || scenario.scenarioType || scenario.scenario_type || '';
  const parentTriggerTurn = readOptionalInteger(
    scenario.challenge_profile?.parent_trigger_turn,
    scenario.challenge_profile?.trigger_turn,
    scenario.hidden?.triggerTurn,
    scenario.hidden?.trigger_turn,
  );
  const text = String(turn?.learner || turn?.event?.learner || '').toLowerCase();
  const event = turn?.event || {};
  const policyName = turn?.policy?.selectedPolicy || '';
  const challengeSignals = turn?.challengeState?.signals || [];
  const confidence = turn?.parentLearnerProfile?.confidence;
  const turnIndex = Number.isInteger(turn?.turnIndex) ? turn.turnIndex : null;
  const advanced = turn?.parentLearnerProfile?.tomProbes
    || turn?.parentLearnerProfile?.summaryText
    || (typeof confidence === 'number' && confidence >= 0.62);

  const mapped = chooseParentCompatibleAction({
    scenarioType,
    parentTriggerTurn,
    text,
    event,
    policyName,
    challengeSignals,
    confidence,
    turnIndex,
    advanced,
  });

  return {
    action: mapped.action,
    family: PARENT_ACTION_FAMILY[mapped.action] || 'unknown',
    confidence: mapped.confidence,
    reason: mapped.reason,
    sourcePolicy: policyName,
    sourcePolicyFamily: PROTOTYPE_POLICY_FAMILY[policyName] || 'unknown',
  };
}

export function expectedParentActionMatch(action, expected) {
  const expectedList = normalizeExpected(expected);
  return Boolean(action) && expectedList.includes(action);
}

export function parentActionFamilyAgreement(parentAction, mappedAction) {
  if (!parentAction || !mappedAction) return false;
  return (PARENT_ACTION_FAMILY[parentAction] || parentAction)
    === (PARENT_ACTION_FAMILY[mappedAction] || mappedAction);
}

export function prototypePolicyFamilyAgreement(parentAction, prototypePolicy) {
  if (!parentAction || !prototypePolicy) return false;
  const parentFamily = PARENT_ACTION_FAMILY[parentAction] || parentAction;
  const prototypeFamily = PROTOTYPE_POLICY_FAMILY[prototypePolicy] || prototypePolicy;
  if (parentFamily === prototypeFamily) return true;
  const acceptable = PARENT_TO_PROTOTYPE_ACCEPTABLE[parentAction] || [];
  return acceptable.includes(prototypePolicy);
}

export function expectedPrototypePolicyMatch(prototypePolicy, expected) {
  const expectedList = normalizeExpected(expected);
  if (!prototypePolicy || expectedList.length === 0) return false;
  return expectedList.some((parentExpected) =>
    (PARENT_TO_PROTOTYPE_ACCEPTABLE[parentExpected] || []).includes(prototypePolicy));
}

export function normalizeExpected(expected) {
  if (!expected) return [];
  if (Array.isArray(expected)) return expected.flatMap(normalizeExpected);
  if (typeof expected === 'string') return [expected];
  if (typeof expected === 'object') {
    return Object.values(expected).flatMap(normalizeExpected);
  }
  return [];
}

function chooseParentCompatibleAction({
  scenarioType,
  parentTriggerTurn,
  text,
  event,
  policyName,
  challengeSignals,
  confidence,
  turnIndex,
  advanced,
}) {
  const atParentTriggerTurn = Number.isInteger(parentTriggerTurn) && turnIndex === parentTriggerTurn;
  const laterTurn = Number.isInteger(turnIndex) && turnIndex > 0 && !atParentTriggerTurn;
  const answerSeeking = /just tell|give me the answer|work backwards|walk me through the answer|answer to/.test(text);
  const localClarification = /getting lost|is .{0,40} same as|what'?s |what is |are they different|not what i was asking|misread/.test(text);
  const learnerWork = /so |therefore|claim|means|would be|i think|actually|right|clicks|following|stress test|pressure point|aufhebung|confounder|third variable/.test(text);

  if (atParentTriggerTurn && SCENARIO_EXPECTED_DEFAULTS[scenarioType]) {
    return mapped(
      SCENARIO_EXPECTED_DEFAULTS[scenarioType],
      0.94,
      'parent replay trigger turn preserves the expected scenario-level action',
    );
  }

  if (
    laterTurn
    && (scenarioType === 'activity_avoidance' || scenarioType === 'answer_seeking_to_productive_struggle')
    && !answerSeeking
    && learnerWork
  ) {
    if (/uneasy|push|objection|but |pressure point|dispute|smuggling|atomistic|relational/.test(text)) {
      return mapped('name_the_disagreement', 0.76, 'answer-seeking scenario has de-escalated into substantive learner work');
    }
    return mapped('mirror_and_extend', 0.72, 'answer-seeking scenario has de-escalated after learner-owned work');
  }

  if (
    laterTurn
    && (scenarioType === 'misconception_surfaces' || scenarioType === 'polite_false_mastery')
    && learnerWork
  ) {
    if (/addition|combine|formula|hydrogen|oxygen|combustion|1\+1|counterexample|not like/.test(text)) {
      return mapped('pose_counterexample', 0.78, 'surfaced misconception now needs a counterexample rather than more diagnosis');
    }
    return mapped('mirror_and_extend', 0.76, 'learner has supplied enough repair work to move beyond diagnosis');
  }

  if (
    laterTurn
    && (scenarioType === 'productive_deadlock' || scenarioType === 'epistemic_resistance')
    && localClarification
  ) {
    return mapped('repair_misrecognition', 0.80, 'framework disagreement has become a local clarification or repair request');
  }

  if (
    laterTurn
    && scenarioType === 'struggling_overload'
    && learnerWork
    && !/third time|five times|too many|lost the thread|not clicking/.test(text)
  ) {
    return mapped('mirror_and_extend', 0.74, 'overload branch has de-escalated into usable learner work');
  }

  if (
    laterTurn
    && scenarioType === 'affective_shutdown'
    && learnerWork
    && !/can't do this|wasting your time|not cut out/.test(text)
  ) {
    return mapped('mirror_and_extend', 0.74, 'affective repair has yielded enough learner work for extension');
  }

  if (
    /too many|moving parts|lost the thread|not clicking|third time|five times/.test(text)
    || scenarioType === 'struggling_overload'
    || challengeSignals.includes('forgetfulness')
  ) {
    return mapped('lower_cognitive_load', 0.86, 'working-memory overload or repeated failed explanation');
  }

  if (
    scenarioType === 'misconception_surfaces'
    || scenarioType === 'polite_false_mastery'
  ) {
    return mapped('ask_diagnostic_question', 0.90, 'scenario family requires surfacing the learner model before extension');
  }

  if (
    scenarioType === 'productive_deadlock'
    || scenarioType === 'epistemic_resistance'
    || /fundamental methodological disagreement|popper|pseudoscience|talking past each other|incompatible frameworks/.test(text)
  ) {
    return mapped('name_the_disagreement', 0.90, 'learner is making a substantive objection or framework disagreement');
  }

  if (scenarioType === 'repair_after_misrecognition' || localClarification) {
    return mapped('repair_misrecognition', 0.95, 'learner explicitly corrected the tutor reading');
  }

  if (
    /can't do this|wasting your time|not cut out|memorise|memorize/.test(text)
    || event.affect === 'discouraged'
    || scenarioType === 'affective_shutdown'
  ) {
    return mapped('acknowledge_and_redirect', 0.90, 'affective shutdown or identity-level self-doubt');
  }

  if (
    answerSeeking
    || scenarioType === 'activity_avoidance'
    || scenarioType === 'answer_seeking_to_productive_struggle'
    || event.stance === 'dependent'
  ) {
    return mapped('withhold_answer', 0.88, 'learner is pulling toward oracle mode or answer substitution');
  }

  if (
    scenarioType === 'resistance_to_insight'
    || scenarioType === 'metaphor_boundary_case'
    || /very thing in dispute|breaks down|boundary|counterexample|mirror/.test(text)
  ) {
    return mapped('scope_test', 0.78, 'learner is testing a boundary case or overextended analogy');
  }

  if (
    scenarioType === 'sophistication_upgrade'
    || scenarioType === 'false_confusion'
    || (advanced && /isn't|right|but|where does|only if|actually/.test(text))
  ) {
    return mapped('mirror_and_extend', 0.74, 'learner shows more sophistication than the surface posture suggested');
  }

  if (
    event.outcome === 'unobserved'
    || /makes sense|thank you|what am i missing|i think i get/.test(text)
  ) {
    return mapped('ask_diagnostic_question', 0.82, 'surface agreement or visible misconception needs diagnostic evidence');
  }

  if (policyName === 'summarize_and_check' || policyName === 'productive_struggle_hold') {
    return mapped('summarize_and_check', 0.68, 'prototype state is consolidating or handing agency back');
  }

  if (policyName === 'minimal_hint') {
    return mapped('provide_hint', 0.64, 'prototype selected a light scaffold');
  }

  if (policyName === 'faded_example') {
    return mapped('lower_cognitive_load', 0.62, 'prototype selected a scaffold under uncertain mastery');
  }

  if (['transfer_challenge', 'transfer_repair'].includes(policyName) && typeof confidence === 'number' && confidence >= 0.58) {
    return mapped('mirror_and_extend', 0.58, 'learner appears ready enough for extension');
  }

  return mapped(SCENARIO_EXPECTED_DEFAULTS[scenarioType] || 'request_elaboration', 0.50, 'fallback from scenario type and prototype state');
}

function mapped(action, confidence, reason) {
  return { action, confidence, reason };
}

function readOptionalInteger(...values) {
  for (const value of values) {
    if (Number.isInteger(value)) return value;
  }
  return null;
}
