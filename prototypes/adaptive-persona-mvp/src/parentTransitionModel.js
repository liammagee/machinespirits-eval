import { PARENT_ACTION_FAMILY, parentActionFamilyAgreement } from './parentActionMapping.js';

export function applyParentActionTransitionModel({ stateTrace = [], scenario = {} } = {}) {
  const triggerTurn = readOptionalInteger(
    scenario.challenge_profile?.parent_trigger_turn,
    scenario.challenge_profile?.trigger_turn,
  );
  const modeled = [];
  for (const turn of stateTrace) {
    const previous = modeled.at(-1) || null;
    const transitionAction = chooseTransitionAction({
      turn,
      previous,
      triggerTurn,
      scenario,
    });
    modeled.push({
      ...turn,
      parentTransitionAction: transitionAction,
      parentTransitionFamilyAgreement: parentActionFamilyAgreement(
        turn.parentPolicyAction,
        transitionAction.action,
      ),
    });
  }
  return modeled;
}

export function transitionFamily(action) {
  return PARENT_ACTION_FAMILY[action] || action || 'unknown';
}

function chooseTransitionAction({ turn, previous, triggerTurn, scenario = {} }) {
  const raw = turn.parentCompatibleAction || {};
  const rawAction = raw.action || 'request_elaboration';
  const rawFamily = raw.family || transitionFamily(rawAction);
  const previousAction = previous?.parentTransitionAction?.action || null;
  const previousFamily = transitionFamily(previousAction);
  const text = String(turn.learner || turn.event?.learner || '').toLowerCase();
  const outcome = turn.event?.outcome || '';
  const affect = turn.event?.affect || '';
  const turnIndex = turn.turnIndex;
  const atTrigger = Number.isInteger(triggerTurn) && turnIndex === triggerTurn;
  const scenarioType = scenario.challenge_profile?.scenario_type || scenario.scenarioType || scenario.scenario_type || '';

  const learnerWork = /so |therefore|claim|means|would be|i think|actually|right|clicks|following|stress test|pressure point|aufhebung|confounder|third variable|i would|i can/.test(text);
  const localClarification = /getting lost|is .{0,40} same as|what'?s |what is |are they different|not what i was asking|misread|can you just explain/.test(text);
  const overload = /too many|moving parts|lost the thread|not clicking|third time|five times|don't really follow|getting lost/.test(text);
  const affective = /can't do this|wasting your time|not cut out|still isn't clicking|i just/.test(text) || affect === 'discouraged';
  const answerSeeking = /just tell|give me the answer|work backwards|walk me through the answer|answer to/.test(text);
  const substantivePressure = /uneasy|push|objection|pressure point|dispute|talking past|framework|methodological|smuggling|not buying/.test(text);
  const correctOrReady = outcome === 'correct' || /clicks|got it|following|i see|i already|right/.test(text);
  const overloadConceptBlend = /blur together|other three|can't figure out|lost what made it different|synthesis and sublation/.test(text);

  if (!previous) {
    return transition(rawAction, 'initial_raw', raw.confidence, 'first turn uses parent-compatible action');
  }

  if (atTrigger) {
    if (
      scenarioType === 'struggling_overload'
      && previousFamily === 'scaffold'
      && learnerWork
      && !overloadConceptBlend
    ) {
      return transition('mirror_and_extend', 'overload_trigger_scaffold_to_substantive', 0.76, 'learner used the reduced cognitive load to offer a tentative concept or example');
    }
    return transition(rawAction, 'trigger_anchor', raw.confidence, 'preserve scenario-trigger action before transition dynamics');
  }

  if (answerSeeking) {
    return transition('withhold_answer', 'dependency_guard', 0.84, 'transition model preserves productive struggle under answer seeking');
  }

  if (previousFamily === 'scaffold' && learnerWork && correctOrReady && !affective && !answerSeeking) {
    return transition('mirror_and_extend', 'scaffold_to_substantive', 0.78, 'learner work after scaffold supports extension');
  }

  if (previousFamily === 'diagnostic' && learnerWork && correctOrReady) {
    return transition('mirror_and_extend', 'diagnostic_to_substantive', 0.74, 'diagnostic evidence now supports a substantive move');
  }

  if (scenarioType === 'struggling_overload' && overload && previousFamily === 'substantive') {
    if (affect === 'discouraged' || /lose the thread|still not clicking/.test(text)) {
      return transition('acknowledge_and_redirect', 'substantive_to_overload_repair', 0.82, 'substantive extension produced affective overload; repair before more content');
    }
    return transition('lower_cognitive_load', 'substantive_to_load_scaffold', 0.82, 'substantive extension exposed working-memory overload');
  }

  if (scenarioType === 'struggling_overload' && overload && previousFamily === 'repair') {
    return transition('acknowledge_and_redirect', 'sustain_overload_repair', 0.80, 'continued overload after repair stays in affect/load repair');
  }

  if (affective && rawFamily !== 'repair' && /can't do this|wasting your time|not cut out|i just/.test(text)) {
    return transition('acknowledge_and_redirect', 'affect_repair', 0.82, 'transition model routes affective interruption into repair');
  }

  if (overload && previousFamily === 'diagnostic' && rawFamily === 'diagnostic') {
    return transition('lower_cognitive_load', 'load_scaffold', 0.80, 'transition model lowers cognitive load before extending');
  }

  if (
    localClarification
    && previousFamily === 'substantive'
    && /not what i was asking|misread|are they different|same as/.test(text)
  ) {
    return transition('repair_misrecognition', 'clarification_after_substantive', 0.78, 'substantive pressure became a local clarification request');
  }

  if (substantivePressure && rawFamily !== 'diagnostic' && rawFamily !== 'repair') {
    return transition('name_the_disagreement', 'substantive_pressure', 0.80, 'transition model names the disagreement instead of continuing scaffold');
  }

  if (previousFamily === 'repair') {
    if (/i already|already gave|already separated|already reproduced/.test(text)) {
      return transition('summarize_and_check', 'repair_to_consolidation', 0.75, 'repair produced learner-owned evidence');
    }
    if (overload && rawFamily === 'diagnostic') {
      return transition('lower_cognitive_load', 'repair_to_scaffold', 0.72, 'repair did not yet stabilize learner work');
    }
  }

  return transition(rawAction, 'raw_fallback', raw.confidence, 'transition model kept parent-compatible per-turn action');
}

function transition(action, transitionRule, confidence = 0.5, reason = '') {
  return {
    action,
    family: transitionFamily(action),
    confidence,
    transitionRule,
    reason,
  };
}

function readOptionalInteger(...values) {
  for (const value of values) {
    if (Number.isInteger(value)) return value;
  }
  return null;
}
