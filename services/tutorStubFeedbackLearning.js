export const TUTOR_STUB_FEEDBACK_ADAPTATION_PLAN_SCHEMA = 'machinespirits.tutor-stub.feedback-adaptation-plan.v1';
export const TUTOR_STUB_FEEDBACK_ADAPTATION_AUDIT_SCHEMA = 'machinespirits.tutor-stub.feedback-adaptation-audit.v1';
export const TUTOR_STUB_FEEDBACK_OBSERVATION_SCHEMA = 'machinespirits.tutor-stub.feedback-observation.v1';
export const TUTOR_STUB_FEEDBACK_RATING_RECORD_SCHEMA = 'machinespirits.tutor-stub.feedback-rating-record.v1';

export const TUTOR_STUB_RESPONSE_CONFIGURATION_AXES = [
  'engagement_stance',
  'action_family',
  'audience_register',
  'lexical_accessibility',
  'scene_immersion',
  'actorial_part',
];

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function jsonClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function feedbackRating(feedback) {
  const rating = String(feedback?.rating || '')
    .trim()
    .toLowerCase();
  return feedback?.supplied && (rating === 'up' || rating === 'down') ? rating : null;
}

function responseConfiguration(value) {
  return (
    value?.responseConfiguration ||
    value?.response_configuration ||
    value?.registerSelection?.response_configuration ||
    null
  );
}

function configurationValue(configuration, axis) {
  if (!configuration) return null;
  if (axis === 'engagement_stance') {
    return configuration.engagement_stance || configuration.selected_register || null;
  }
  return configuration[axis] || null;
}

function configurationSnapshot(value) {
  const configuration = responseConfiguration(value) || value?.registerSelection || value || null;
  if (!configuration || typeof configuration !== 'object') return null;
  return Object.fromEntries(
    TUTOR_STUB_RESPONSE_CONFIGURATION_AXES.map((axis) => [axis, configurationValue(configuration, axis)]),
  );
}

function changedConfigurationAxes(targetConfiguration, nextConfiguration) {
  if (!targetConfiguration || !nextConfiguration) return [];
  return TUTOR_STUB_RESPONSE_CONFIGURATION_AXES.filter((axis) => {
    const before = configurationValue(targetConfiguration, axis);
    const after = configurationValue(nextConfiguration, axis);
    return Boolean(before && after && before !== after);
  });
}

function wordSet(value) {
  return new Set(
    oneLine(value)
      .toLowerCase()
      .match(/[\p{L}\p{N}']+/gu) || [],
  );
}

function jaccardSimilarity(left, right) {
  const a = wordSet(left);
  const b = wordSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function visibleChangedAxes(changedAxes, audit) {
  return changedAxes.filter((axis) => audit?.axes?.[axis]?.visible === true);
}

function targetSafety(targetTurn) {
  const auditValues = [
    targetTurn?.tutorLeakAudit,
    targetTurn?.tutorHumanScaffoldAudit,
    targetTurn?.tutorQuestionSupportAudit,
    targetTurn?.tutorDramaticReleaseAudit,
    targetTurn?.tutorRepetitionAudit,
    targetTurn?.tutorDialogueClosureAudit,
  ].filter(Boolean);
  return {
    passed: auditValues.every((audit) => audit.ok !== false),
    evaluatedAuditCount: auditValues.length,
    repaired: Boolean(targetTurn?.tutorResponseRepaired),
    deterministicFallback: Boolean(targetTurn?.tutorDeterministicFallback),
  };
}

export function buildTutorStubFeedbackRatingRecord({ feedback, targetTurn, provenance = {} } = {}) {
  const rating = feedbackRating(feedback);
  if (!rating || !targetTurn) return null;
  const targetSelection = targetTurn.registerSelection || null;
  const probability =
    targetSelection?.selection_probability ??
    targetSelection?.selected_probability ??
    targetSelection?.probability ??
    targetSelection?.random?.decision?.probability ??
    null;
  return {
    schema: TUTOR_STUB_FEEDBACK_RATING_RECORD_SCHEMA,
    observationType: 'immediate_observational_preference',
    causalClaim: false,
    recordedAt: new Date().toISOString(),
    feedback: {
      rating,
      helpfulness: rating === 'up' ? 1 : -1,
      reason: feedback.reason || null,
      reasonLabel: feedback.reasonLabel || null,
      comment: oneLine(feedback.comment) || null,
      scope: feedback.scope || null,
      source: feedback.source || 'human_learner',
      requestedAt: feedback.requestedAt || null,
      ratedAt: feedback.ratedAt || null,
    },
    ratedResponse: {
      turn: targetTurn.turn ?? feedback.targetTutorTurn ?? null,
      turnId: targetTurn.turnId || feedback.targetTutorTurnId || null,
      kind: feedback.targetKind || (targetTurn.opening ? 'opening' : 'tutor_response'),
      text: oneLine(targetTurn.tutor || targetTurn.text),
      responseConfiguration: configurationSnapshot(targetTurn),
      responseConfigurationAudit: jsonClone(targetTurn.responseConfigurationAudit || null),
      selectionPolicy: targetSelection?.policy || null,
      selectionProbability: Number.isFinite(Number(probability)) ? Number(probability) : null,
      provider: targetTurn.provider || null,
      model: targetTurn.model || null,
      latencyMs: targetTurn.latencyMs ?? null,
      safety: targetSafety(targetTurn),
    },
    provenance: {
      runId: provenance.runId || null,
      trace: provenance.trace || null,
      worldId: provenance.worldId || null,
      learnerProfileId: provenance.learnerProfileId || null,
      interactionMode: provenance.interactionMode || 'learner',
      ...jsonClone(provenance),
    },
  };
}

export function findTutorStubFeedbackTargetTurn({ feedback, turns = [], opening = null } = {}) {
  if (!feedback?.requested) return null;
  const targetId = oneLine(feedback.targetTutorTurnId);
  const targetTurn = Number(feedback.targetTutorTurn);
  const exact = turns.find(
    (turn) =>
      (targetId && oneLine(turn?.turnId) === targetId) ||
      (Number.isFinite(targetTurn) && Number(turn?.turn) === targetTurn),
  );
  if (exact) return exact;
  if (targetTurn === 0 && opening) {
    return {
      turn: 0,
      turnId: targetId || opening.turnId || null,
      tutor: opening.text || '',
      provider: opening.provider || null,
      model: opening.model || null,
      responseConfiguration: opening.responseConfiguration || null,
      responseConfigurationAudit: opening.responseConfigurationAudit || null,
      opening: true,
    };
  }
  return null;
}

export function buildTutorStubFeedbackAdaptationPlan({ feedback, targetTurn, nextSelection } = {}) {
  const rating = feedbackRating(feedback);
  if (!rating || !targetTurn) return null;
  const targetConfiguration = responseConfiguration(targetTurn);
  const nextConfiguration =
    responseConfiguration(nextSelection) || nextSelection?.response_configuration || nextSelection;
  const changedAxes = changedConfigurationAxes(targetConfiguration, nextConfiguration);
  const retainedAxes = TUTOR_STUB_RESPONSE_CONFIGURATION_AXES.filter((axis) => {
    const before = configurationValue(targetConfiguration, axis);
    const after = configurationValue(nextConfiguration, axis);
    return Boolean(before && after && before === after);
  });
  const configurationUnavailable = Boolean(!targetConfiguration || !nextConfiguration);
  const sameConfiguration = Boolean(targetConfiguration && nextConfiguration && changedAxes.length === 0);
  const requiresRealizationChange = Boolean(configurationUnavailable || sameConfiguration);
  return {
    schema: TUTOR_STUB_FEEDBACK_ADAPTATION_PLAN_SCHEMA,
    rating,
    source: 'human_learner',
    targetTutorTurn: feedback.targetTutorTurn ?? targetTurn.turn ?? null,
    targetTutorTurnId: feedback.targetTutorTurnId || targetTurn.turnId || null,
    targetConfiguration: configurationSnapshot(targetTurn),
    nextConfiguration: configurationSnapshot(nextSelection),
    changedAxes,
    retainedAxes,
    configurationUnavailable,
    sameConfiguration,
    requiresRealizationChange,
    currentTurnContract:
      rating === 'up'
        ? {
            preserveHelpfulQualities: retainedAxes,
            respondToCurrentLearner: true,
            avoidVerbatimRepetition: true,
          }
        : {
            makeObservableChange: true,
            selectedConfigurationChanges: changedAxes,
            ifSelectionUnchanged: [
              'acknowledge the learner before developing the lesson',
              'use a shorter and more concrete sentence pattern',
              'avoid the previous response frame and pacing',
            ],
          },
    constraints: {
      private: true,
      safetyAndPublicEvidencePrecedePreference: true,
      appliesForOneTutorResponse: true,
      doesNotAlterLearnerMeaning: true,
    },
  };
}

export function tutorStubFeedbackAdaptationPrompt(plan) {
  if (!plan) return null;
  const changed = plan.changedAxes?.length ? plan.changedAxes.join(', ') : 'none selected by the policy';
  const retained = plan.retainedAxes?.length ? plan.retainedAxes.slice(0, 3).join(', ') : 'no named configuration axis';
  return [
    '[Private one-turn response adaptation contract]',
    plan.rating === 'up'
      ? `The learner found the rated response helpful. Preserve useful qualities in ${retained}, while answering the learner's new words.`
      : `The learner found the rated response unhelpful. The selected configuration changes are: ${changed}. Make at least one change visible in the public response.`,
    plan.rating === 'down' && plan.requiresRealizationChange
      ? 'Because no configuration change is available, change the realization instead: acknowledge first, use shorter and more concrete language, and do not reuse the prior response frame.'
      : null,
    'Do not quote, mention, or explain the rating. Do not let it override public-evidence, safety, or closure constraints.',
    'This contract expires after this tutor response.',
    '[End private one-turn response adaptation contract]',
  ]
    .filter(Boolean)
    .join('\n');
}

export function auditTutorStubFeedbackAdaptation({ plan, targetTurn, currentTurn } = {}) {
  if (!plan || !targetTurn || !currentTurn) return null;
  const targetText = oneLine(targetTurn.tutor || targetTurn.text);
  const currentText = oneLine(currentTurn.tutor || currentTurn.text);
  const priorSimilarity = jaccardSimilarity(targetText, currentText);
  const currentConfiguration = responseConfiguration(currentTurn);
  const changedAxes = changedConfigurationAxes(responseConfiguration(targetTurn), currentConfiguration);
  const currentAudit = currentTurn.responseConfigurationAudit || null;
  const visibleAxes = visibleChangedAxes(changedAxes, currentAudit);
  const surfaceDistinct = Boolean(currentText && targetText !== currentText && priorSimilarity < 0.82);
  const acknowledgedThenDeveloped =
    currentTurn.responseComposition?.audit?.uptake?.present === true ||
    currentTurn.responseComposition?.uptake?.length > 0 ||
    currentTurn.responseCompositionAudit?.uptake?.present === true ||
    null;
  const observableChange = Boolean(surfaceDistinct && (visibleAxes.length > 0 || plan.requiresRealizationChange));
  const passed =
    plan.rating === 'down' ? observableChange : Boolean(surfaceDistinct && acknowledgedThenDeveloped !== false);
  return {
    schema: TUTOR_STUB_FEEDBACK_ADAPTATION_AUDIT_SCHEMA,
    rating: plan.rating,
    targetTutorTurnId: plan.targetTutorTurnId,
    passed,
    observableChange,
    surfaceDistinct,
    priorWordSetSimilarity: Number(priorSimilarity.toFixed(3)),
    changedAxes,
    visibleChangedAxes: visibleAxes,
    sameConfigurationRecovery: Boolean(plan.sameConfiguration && surfaceDistinct),
    realizationOnlyRecovery: Boolean(plan.requiresRealizationChange && surfaceDistinct),
    acknowledgedThenDeveloped,
    interpretation: 'one-turn contract compliance, not a causal estimate of learning',
  };
}

export function buildTutorStubFeedbackObservation({
  feedback,
  targetTurn,
  learnerTurn,
  currentTurn,
  previousRegisterEfficacy = null,
  adaptationPlan = null,
  adaptationAudit = null,
  provenance = {},
} = {}) {
  const rating = feedbackRating(feedback);
  if (!rating || !targetTurn || !learnerTurn) return null;
  const ratingRecord = buildTutorStubFeedbackRatingRecord({ feedback, targetTurn, provenance });
  return {
    schema: TUTOR_STUB_FEEDBACK_OBSERVATION_SCHEMA,
    observationType: 'observational_preference_with_next-turn_outcomes',
    causalClaim: false,
    recordedAt: new Date().toISOString(),
    feedback: ratingRecord.feedback,
    ratedResponse: ratingRecord.ratedResponse,
    learnerResponse: {
      turn: learnerTurn.turn ?? null,
      turnId: learnerTurn.turnId || null,
      text: oneLine(learnerTurn.text || learnerTurn.learner),
      messageCount: learnerTurn.messageCount ?? learnerTurn.messages?.length ?? 1,
      classification: jsonClone(learnerTurn.classification || null),
    },
    outcomes: {
      subjectiveHelpfulness: rating === 'up' ? 1 : -1,
      objectiveProgress: previousRegisterEfficacy
        ? {
            label: previousRegisterEfficacy.label || null,
            progressScore: previousRegisterEfficacy.progressScore ?? null,
            dagProgress: previousRegisterEfficacy.dagProgress ?? null,
            fieldDelta: previousRegisterEfficacy.field?.delta ?? null,
            selfAssessmentScore: previousRegisterEfficacy.selfAssessmentScore ?? null,
          }
        : null,
      nextResponseAdaptation: jsonClone(adaptationAudit),
    },
    nextTutorResponse: currentTurn
      ? {
          turn: currentTurn.turn ?? null,
          turnId: currentTurn.turnId || null,
          responseConfiguration: configurationSnapshot(currentTurn),
          responseConfigurationAudit: jsonClone(currentTurn.responseConfigurationAudit || null),
          safety: targetSafety(currentTurn),
        }
      : null,
    adaptationPlan: jsonClone(adaptationPlan),
    provenance: ratingRecord.provenance,
  };
}
