export const TUTOR_STUB_CONVERSATIONAL_COMPLETION_SCHEMA =
  'machinespirits.tutor-stub.conversational-completion.v1';

const QUESTION_MOVE_PATTERN = /\b(?:question|clarification|repair_request|plain_language_request)\b/iu;
const RESOLVING_MOVE_PATTERN =
  /\b(?:answer|evidence_adoption|metacognitive_reflection|hypothesis|inference|claim|conclusion|correction)\b/iu;
const UNSAFE_MOVE_PATTERN = /\b(?:distorts_public_evidence|fabricates_evidence|contradiction)\b/iu;
const NON_ANSWER_MOVE_PATTERN =
  /\b(?:affective_signal|resistance_or_low_agency|off_task|disengagement|pacing_request)\b/iu;
const QUALIFIED_MOVE_PATTERN = /\b(?:hypothesis|overleaps_evidence|possible|provisional|uncertain)\b/iu;
const CASE_CLOSING_PATTERN =
  /\b(?:culprit|guilty|verdict|final answer|case is closed|who (?:did|made|planted|struck|took))\b/iu;
const REOPEN_QUESTION_PATTERN =
  /\b(?:can we (?:record|say|write)|what can we safely say|what does (?:that|this|the .{0,35}) (?:establish|prove|show)|what remains (?:unknown|unproved|open)|does that (?:establish|prove|show)|would you agree)\b/iu;
const ENDORSEMENT_QUESTION_PATTERN =
  /\b(?:can we (?:record|say|write)|does that mean we can|would you agree|shall we (?:record|say|write))\b/iu;
const DIRECT_SHORT_ANSWER_PATTERN =
  /^(?:yes|no|right|exactly|it does|it does not|it doesn[’']t|we can|we cannot|we can[’']t|that does|that does not|that doesn[’']t)(?:\b|[.!?])/iu;

const TOKEN_STOPWORDS = new Set(
  'about after again also and are because before being can could did does from have how into its itself may might more most must not now only our should some such than that the their them then there these they this those through under very was were what when where which while who will with would you your'.split(
    ' ',
  ),
);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function lastQuestion(value) {
  const source = oneLine(value);
  if (!source.includes('?')) return '';
  const matches = source.match(/(?:^|[.!?]\s+)([^.!?]*\?)/gu);
  return oneLine(matches?.at(-1) || source.slice(source.lastIndexOf('.', source.lastIndexOf('?')) + 1)).replace(
    /^[.!?]\s*/u,
    '',
  );
}

function tokens(value) {
  return (
    oneLine(value)
      .toLowerCase()
      .replace(/[’']/gu, '')
      .match(/[a-z][a-z-]{2,}/gu)
      ?.filter((token) => !TOKEN_STOPWORDS.has(token)) || []
  );
}

function overlapCoefficient(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / Math.min(a.size, b.size);
}

function sharedTokenCount(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared;
}

function learnerAdvance(tutorLearnerDag = null) {
  return tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
}

export function resolveTutorStubConversationalCompletion({
  mode = 'strict_dag',
  learnerText = '',
  previousTutorText = '',
  classification = null,
  tutorLearnerDag = null,
  generousInference = null,
} = {}) {
  const learnerSurface = oneLine(learnerText);
  const sourceTutorQuestion = lastQuestion(previousTutorText);
  const turn = classification?.turn || {};
  const moveSignal = oneLine(
    [turn.request_type, turn.discourse_move, turn.evidence_use, turn.epistemic_stance].filter(Boolean).join(' '),
  );
  const summary = oneLine(turn.summary || learnerSurface);
  const advance = learnerAdvance(tutorLearnerDag);
  const base = {
    schema: TUTOR_STUB_CONVERSATIONAL_COMPLETION_SCHEMA,
    mode,
    active: mode !== 'strict_dag' && Boolean(learnerSurface && sourceTutorQuestion),
    status: 'open',
    resolved: false,
    sourceTutorQuestion: sourceTutorQuestion || null,
    learnerSurface: learnerSurface || null,
    acceptedMeaning: null,
    reason: null,
    reopenForbidden: false,
    requiresNewPressure: false,
    releaseNextClue: false,
    conceptSignature: [],
    instruction: null,
  };

  if (!base.active) return { ...base, reason: mode === 'strict_dag' ? 'strict_dag_mode' : 'no_adjacent_question' };
  if (learnerSurface.includes('?') || QUESTION_MOVE_PATTERN.test(moveSignal)) {
    return { ...base, reason: 'learner_asked_or_repaired_rather_than_answered' };
  }
  if (UNSAFE_MOVE_PATTERN.test(moveSignal)) {
    return { ...base, status: 'rejected', reason: 'learner_move_conflicts_with_public_evidence' };
  }
  if (NON_ANSWER_MOVE_PATTERN.test(moveSignal) && !/\b(?:hypothesis|inference|claim|evidence_adoption)\b/iu.test(moveSignal)) {
    return { ...base, reason: 'learner_move_changes_pacing_or_affect_without_answering_the_local_question' };
  }

  const supportedMoves = Number(advance?.supportedMoveCount || advance?.supported_move_count || 0);
  const contextualAnswer = generousInference?.applied === true;
  const classifiedResolution = RESOLVING_MOVE_PATTERN.test(moveSignal);
  const directShortAnswer =
    learnerSurface.split(/\s+/u).length <= 8 &&
    DIRECT_SHORT_ANSWER_PATTERN.test(learnerSurface) &&
    !CASE_CLOSING_PATTERN.test(sourceTutorQuestion);
  if (!supportedMoves && !contextualAnswer && !classifiedResolution && !directShortAnswer) {
    return { ...base, reason: 'no_public_signal_that_the_local_question_was_resolved' };
  }

  const qualified = QUALIFIED_MOVE_PATTERN.test(moveSignal) || Boolean(tutorLearnerDag?.accepted?.hypothesis);
  const status = qualified ? 'qualified' : 'accepted';
  const acceptedMeaning = contextualAnswer
    ? oneLine(generousInference.resolvedMeaning || summary)
    : summary;
  const conceptSignature = [...new Set(tokens(`${sourceTutorQuestion} ${acceptedMeaning}`))].slice(0, 16);
  return {
    ...base,
    status,
    resolved: true,
    acceptedMeaning,
    reason: supportedMoves
      ? 'the learner completed at least one supported public move'
      : qualified
        ? 'the learner supplied a relevant provisional answer that resolves the local question without establishing it as fact'
        : 'the learner supplied a relevant answer to the immediately preceding local question',
    reopenForbidden: true,
    requiresNewPressure: true,
    releaseNextClue: true,
    conceptSignature,
    instruction:
      'Credit or qualify this move once, without paraphrasing the same distinction into another question. Then advance to genuinely new public evidence or a new implication. Do not ask for a safer restatement of the resolved point.',
  };
}

function dueEvidenceVisible(text, dueEvidenceSurfaces = []) {
  const response = new Set(tokens(text));
  return (Array.isArray(dueEvidenceSurfaces) ? dueEvidenceSurfaces : [])
    .map((surface) => tokens(surface))
    .some((surfaceTokens) => {
      const overlap = surfaceTokens.filter((token) => response.has(token)).length;
      const required = Math.min(4, Math.max(2, Math.ceil(surfaceTokens.length * 0.4)));
      return overlap >= required;
    });
}

export function auditTutorStubConversationalCompletionResponse({
  text = '',
  completion = null,
  learnerText = '',
  dueEvidenceSurfaces = [],
} = {}) {
  if (!completion?.resolved || !completion?.reopenForbidden) {
    return { schema: TUTOR_STUB_CONVERSATIONAL_COMPLETION_SCHEMA, ok: true, active: false, issues: [] };
  }
  const responseQuestion = lastQuestion(text);
  const newEvidenceVisible = dueEvidenceVisible(text, dueEvidenceSurfaces);
  const sourceTokens = tokens(completion.sourceTutorQuestion || '');
  const responseQuestionTokens = tokens(responseQuestion);
  const questionOverlap = overlapCoefficient(sourceTokens, responseQuestionTokens);
  const sharedQuestionTokenCount = sharedTokenCount(sourceTokens, responseQuestionTokens);
  // A newly visible exhibit can legitimately answer the previous question and
  // then press the same subject one evidentiary step further (tool -> keeper,
  // record -> actor, mark -> source). Treat only an almost verbatim question as
  // reopening once new evidence is actually present; without new evidence the
  // lower threshold still catches polished restatement loops.
  const reopenOverlapThreshold = newEvidenceVisible ? 0.9 : 0.55;
  const overlapReopensResolvedPoint = newEvidenceVisible
    ? questionOverlap >= reopenOverlapThreshold && sharedQuestionTokenCount >= 3
    : questionOverlap >= reopenOverlapThreshold;
  const reopensResolvedPoint = Boolean(
    responseQuestion &&
      (overlapReopensResolvedPoint ||
        (!newEvidenceVisible && REOPEN_QUESTION_PATTERN.test(responseQuestion))),
  );
  const issues = [];
  if (reopensResolvedPoint) {
    issues.push({
      type: 'resolved_point_reopened',
      reason: 'asks the learner to restate or re-endorse a local point that was already adequately answered',
      sourceQuestion: completion.sourceTutorQuestion,
      responseQuestion,
      questionOverlap: Number(questionOverlap.toFixed(3)),
      sharedQuestionTokenCount,
    });
  }

  if (responseQuestion && ENDORSEMENT_QUESTION_PATTERN.test(responseQuestion)) {
    const basis = new Set(
      tokens(
        [
          completion.sourceTutorQuestion,
          completion.acceptedMeaning,
          learnerText,
          ...(Array.isArray(dueEvidenceSurfaces) ? dueEvidenceSurfaces : []),
        ].join(' '),
      ),
    );
    const novelClaimTokens = responseQuestionTokens.filter((token) => !basis.has(token));
    if (novelClaimTokens.length >= 2) {
      issues.push({
        type: 'unsupported_endorsement_request',
        reason: 'invites the learner to endorse a materially stronger proposition than the resolved move or available evidence supplies',
        responseQuestion,
        novelClaimTokens: [...new Set(novelClaimTokens)].slice(0, 8),
      });
    }
  }

  return {
    schema: TUTOR_STUB_CONVERSATIONAL_COMPLETION_SCHEMA,
    ok: issues.length === 0,
    active: true,
    newEvidenceVisible,
    questionOverlap: Number(questionOverlap.toFixed(3)),
    sharedQuestionTokenCount,
    issues,
  };
}

export function applyTutorStubConversationalCompletionSelection(selection = null, completion = null) {
  if (!selection || !completion?.resolved || !completion?.requiresNewPressure) {
    return { selection, changed: false, previousActionFamily: null };
  }
  if (selection.conversational_completion?.resolved === true) {
    return {
      selection,
      changed: false,
      previousActionFamily:
        selection.response_configuration?.compatibility?.pre_conversational_completion_action_family ||
        selection.response_configuration?.action_family ||
        selection.action_family ||
        null,
    };
  }
  const previousActionFamily =
    selection.response_configuration?.action_family || selection.action_family || null;
  if (['close_inquiry', 'clarify_term', 'receive_vulnerability', 'reanchor_public_evidence'].includes(previousActionFamily)) {
    return { selection, changed: false, previousActionFamily };
  }
  const updated = {
    ...selection,
    action_family: 'stage_next_step',
    expected_dag_move:
      'The previous local question is conversationally complete. Introduce or work with genuinely new public evidence; do not ask for the same distinction again.',
    expected_field_move:
      'Credit the learner once, then create forward movement through a new public pressure rather than another formulation check.',
    conversational_completion: completion,
    response_configuration: selection.response_configuration
      ? {
          ...selection.response_configuration,
          action_family: 'stage_next_step',
          conversational_completion: completion,
          compatibility: {
            ...(selection.response_configuration.compatibility || {}),
            pre_conversational_completion_action_family: previousActionFamily,
          },
        }
      : selection.response_configuration,
  };
  return { selection: updated, changed: previousActionFamily !== 'stage_next_step', previousActionFamily };
}
