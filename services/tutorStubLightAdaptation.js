export const TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA = 'machinespirits.tutor-stub.light-adaptation.v1';
export const TUTOR_STUB_LIGHT_ADAPTATION_SIGNAL_SCHEMA = 'machinespirits.tutor-stub.light-adaptation-signal.v1';
export const DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD = 2;

const CONFUSION_PATTERN =
  /\b(?:confus\w*|uncertain|unsure|not sure|don[’']?t know|no idea|lost|doesn[’']?t make sense|plain language|step[- ]by[- ]step|slow down|one step at a time|repair request)\b/iu;
const FRUSTRATION_PATTERN =
  /\b(?:frustrat\w*|overwhelm\w*|irritat\w*|annoy\w*|fed up|stuck|giving up|disengag\w*|too much|pressure|defensive)\b/iu;
const RESOLUTION_PATTERN =
  /\b(?:now (?:i )?(?:understand|see|get it)|that makes sense|it makes sense now|clear now|got it|i understand)\b/iu;

function oneLine(value) {
  return String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function classificationSurface(classification = null) {
  const turn = classification?.turn || {};
  const overall = classification?.overall || {};
  return [
    turn.request_type,
    turn.discourse_move,
    turn.epistemic_stance,
    turn.affect,
    turn.pedagogical_need,
    turn.summary,
    overall.current_state,
    overall.next_best_tutor_move,
  ]
    .map(oneLine)
    .filter(Boolean)
    .join(' ');
}

export function normalizeTutorStubLightAdaptationThreshold(value) {
  const threshold = Number(value ?? DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD);
  if (!Number.isSafeInteger(threshold) || threshold < 2 || threshold > 8) {
    throw new Error('light adaptation threshold must be an integer between 2 and 8');
  }
  return threshold;
}

export function tutorStubLearnerDifficultySignal({ classification = null, learnerText = '' } = {}) {
  const classified = classificationSurface(classification);
  const publicText = oneLine(learnerText);
  const combined = `${classified} ${publicText}`.trim();
  const epistemicStance = oneLine(classification?.turn?.epistemic_stance);
  const confusion = CONFUSION_PATTERN.test(combined);
  const frustration = FRUSTRATION_PATTERN.test(combined);
  const resolved =
    /\b(?:grounded|integrated|confident)\b/iu.test(epistemicStance) ||
    (RESOLUTION_PATTERN.test(publicText) && !frustration);
  const signalTypes = [confusion && !resolved ? 'confusion' : null, frustration ? 'frustration' : null].filter(Boolean);
  return {
    schema: TUTOR_STUB_LIGHT_ADAPTATION_SIGNAL_SCHEMA,
    active: signalTypes.length > 0,
    signal_types: signalTypes,
    confusion: signalTypes.includes('confusion'),
    frustration: signalTypes.includes('frustration'),
    resolved,
    public_learner_surface: publicText || null,
    classification_surface: classified || null,
  };
}

export function buildTutorStubLightAdaptationDecision({
  enabled = false,
  threshold = DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD,
  state = null,
  classification = null,
  learnerText = '',
} = {}) {
  const normalizedThreshold = normalizeTutorStubLightAdaptationThreshold(threshold);
  const current = tutorStubLearnerDifficultySignal({ classification, learnerText });
  let streak = current.active ? 1 : 0;
  if (current.active) {
    for (const turn of [...(state?.turns || [])].reverse()) {
      const signal = tutorStubLearnerDifficultySignal({
        classification: turn?.classification,
        learnerText: turn?.learner,
      });
      if (!signal.active) break;
      streak += 1;
    }
  }
  const triggered = Boolean(enabled && current.active && streak >= normalizedThreshold);
  const priorSelection = state?.register?.history?.at(-1) || null;
  return {
    schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
    enabled: Boolean(enabled),
    threshold: normalizedThreshold,
    streak,
    triggered,
    current_signal: current,
    trigger: triggered ? 'continued_learner_confusion_or_frustration' : null,
    stochastic_axes: triggered ? ['engagement_stance', 'actorial_part'] : [],
    previous: {
      engagement_stance: priorSelection?.engagement_stance || priorSelection?.selected_register || null,
      actorial_part: priorSelection?.actorial_part || priorSelection?.response_configuration?.actorial_part || null,
    },
    selection_method: triggered ? 'seeded_uniform_excluding_previous' : null,
    assessment_influence: {
      trigger: true,
      engagement_stance_draw: false,
      actorial_part_draw: false,
      other_response_axes: true,
    },
    hard_constraints_preserved: ['authored_evidence_source', 'dialogue_closure', 'evidence_release', 'response_safety'],
  };
}
