export const TUTOR_STUB_QUESTION_SUPPORT_SCHEMA = 'machinespirits.tutor-stub.question-support.v1';

function labelsFor(classification = null) {
  const turn = classification?.turn || {};
  return [
    turn.request_type,
    turn.discourse_move,
    turn.evidence_use,
    turn.epistemic_stance,
    turn.affect,
    turn.pedagogical_need,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isStruggle(classification = null, learnerText = '') {
  return /confus|stepwise_support|plain_language|repair_request|answer_seeking|uncertain|not sure|don[’']?t know/iu.test(
    `${labelsFor(classification)} ${learnerText}`,
  );
}

function recentStruggleCount(recentTurns = []) {
  return (Array.isArray(recentTurns) ? recentTurns : [])
    .slice(-2)
    .filter((turn) => isStruggle(turn?.classification, turn?.learner || '')).length;
}

function recentlyUsedAdaptiveChoice(recentTurns = []) {
  return (Array.isArray(recentTurns) ? recentTurns : [])
    .slice(-2)
    .some((turn) => turn?.humanDiscourseFrame?.questionSupport?.adaptiveMultipleChoice === true);
}

function missingRows(assessment = null, bucket) {
  return (Array.isArray(assessment?.missingPremises) ? assessment.missingPremises : []).filter((row) => bucket(row));
}

/**
 * Choose how much support a learner-facing question needs without exposing
 * private proof-path content. This is deliberately separate from register:
 * warmth or precision cannot make an unanswerable question answerable.
 */
export function buildTutorStubQuestionSupport({
  tutorTurn = null,
  scaffoldState = null,
  assessment = null,
  classification = null,
  learnerText = '',
  recentTurns = [],
  multipleChoice = false,
} = {}) {
  const dueNow = scaffoldState?.releaseState?.dueNow || [];
  const futureMissing = missingRows(
    assessment,
    (row) =>
      (row?.bucket === 'unreleased' || row?.bucket === 'unscheduled') &&
      (row?.releaseTurn === null || !Number.isFinite(Number(tutorTurn)) || Number(row.releaseTurn) > Number(tutorTurn)),
  );
  const futureBucketCount =
    Number(assessment?.missingPremiseBuckets?.unreleased || 0) +
    Number(assessment?.missingPremiseBuckets?.unscheduled || 0);
  const nextRelease = scaffoldState?.releaseState?.nextRelease || null;
  const hasFutureGap = Boolean(
    futureMissing.length ||
    (futureBucketCount > 0 &&
      nextRelease &&
      (!Number.isFinite(Number(tutorTurn)) || Number(nextRelease.turn) > Number(tutorTurn))),
  );
  const currentStruggle = isStruggle(classification, learnerText);
  const struggleCount = recentStruggleCount(recentTurns) + (currentStruggle ? 1 : 0);
  const adaptiveChoiceCoolingDown = !multipleChoice && recentlyUsedAdaptiveChoice(recentTurns);

  if (dueNow.length) {
    const modality =
      multipleChoice || (struggleCount >= 2 && !adaptiveChoiceCoolingDown)
        ? 'stage_then_bounded_choice'
        : 'stage_then_ask';
    return {
      schema: TUTOR_STUB_QUESTION_SUPPORT_SCHEMA,
      answerability: 'answerable_after_staging',
      modality,
      adaptiveMultipleChoice: modality === 'stage_then_bounded_choice',
      guardRequired: false,
      struggleCount,
      adaptiveChoiceCoolingDown,
      reason:
        'the next needed evidence is due now and must enter the public discourse before the learner is questioned about it',
      tutorInstruction:
        modality === 'stage_then_bounded_choice'
          ? 'State the due evidence in ordinary scene language first, then offer 2-3 short interpretations grounded in that stated evidence; invite the learner to choose or answer freely.'
          : 'State the due evidence in ordinary scene language first, then ask what that newly public evidence changes. Do not quiz before staging it.',
    };
  }

  if (hasFutureGap) {
    const modality =
      multipleChoice || (struggleCount >= 1 && !adaptiveChoiceCoolingDown)
        ? 'bounded_directional_choice'
        : 'embedded_directional_hint';
    return {
      schema: TUTOR_STUB_QUESTION_SUPPORT_SCHEMA,
      answerability: 'direction_only_until_evidence_is_public',
      modality,
      adaptiveMultipleChoice: modality === 'bounded_directional_choice',
      guardRequired: true,
      struggleCount,
      adaptiveChoiceCoolingDown,
      reason:
        'a remaining best-path fact has not entered the public scene, so open recall would ask the learner to invent evidence',
      tutorInstruction:
        modality === 'bounded_directional_choice'
          ? 'Do not ask the learner to invent or name an unseen record, source, person, or fact. Name only the missing evidence category (for example custody rather than expertise), then offer 2-3 public-safe categories or interpretations. Do not include the actual unstaged record or answer.'
          : 'Do not ask the learner to invent or name an unseen record, source, person, or fact. Briefly state the direction of the missing support in the discourse (for example that possession needs custody evidence, not expert recognition), without revealing the unstaged fact. You may consolidate the current public inference without asking a question.',
    };
  }

  if (currentStruggle) {
    const modality =
      multipleChoice || (struggleCount >= 2 && !adaptiveChoiceCoolingDown)
        ? 'bounded_public_choice'
        : 'embedded_public_hint';
    return {
      schema: TUTOR_STUB_QUESTION_SUPPORT_SCHEMA,
      answerability: 'public_but_needs_scaffold',
      modality,
      adaptiveMultipleChoice: modality === 'bounded_public_choice',
      guardRequired: false,
      struggleCount,
      adaptiveChoiceCoolingDown,
      reason:
        'the needed material is public, but the learner has signalled that an unsupported open question is not enough',
      tutorInstruction:
        modality === 'bounded_public_choice'
          ? 'Restate the live public clue, then offer 2-3 short interpretations of it and invite the learner to choose or answer freely.'
          : 'Put the directional hint into the discourse before asking: restate the live public clue and narrow the relation the learner is being asked to notice.',
    };
  }

  return {
    schema: TUTOR_STUB_QUESTION_SUPPORT_SCHEMA,
    answerability: 'publicly_answerable',
    modality: 'open_question',
    adaptiveMultipleChoice: false,
    guardRequired: false,
    struggleCount,
    adaptiveChoiceCoolingDown,
    reason: 'the next move can be answered from evidence already in the public discourse',
    tutorInstruction: 'Ask one light question grounded in the public evidence already stated.',
  };
}

function openRecallQuestions(text) {
  return String(text || '')
    .split(/(?<=[?.!])\s+/u)
    .filter((sentence) => sentence.includes('?'))
    .filter((sentence) =>
      /\b(?:what|which)\s+(?:kind\s+of\s+)?(?:record|log|document|source|name|person|evidence)|\bwho\s+(?:held|owned|kept|signed|had)|\bwhat\s+name\b/iu.test(
        sentence,
      ),
    );
}

export function auditTutorStubQuestionSupportResponse({ text = '', support = null } = {}) {
  if (!support?.guardRequired) return { ok: true, issues: [] };
  const issues = [];
  const recall = openRecallQuestions(text);
  if (recall.length) {
    issues.push({
      type: 'unanswerable_open_recall',
      reason: 'asks the learner to name evidence or a person that has not yet entered the public scene',
      excerpts: recall,
    });
  }
  if (support.modality === 'bounded_directional_choice') {
    const hasChoice = /(?:\bA[).:]\s|\bB[).:]\s|\beither\b.+\bor\b)/isu.test(String(text || ''));
    if (!hasChoice) {
      issues.push({
        type: 'missing_bounded_choice',
        reason:
          'repeated uncertainty called for a small public-safe choice, but the draft left the learner with another unsupported open prompt',
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function deterministicTutorStubQuestionSupportFallback(support = null) {
  if (support?.modality === 'bounded_directional_choice') {
    return [
      'The mark identifies the tool, but expertise about a tool is not the same as having it.',
      'Which would safely connect it to a hand: A) a record of custody, B) a witness who only recognizes its cut, or C) mere presence near the forge?',
    ].join(' ');
  }
  return [
    'That is as far as the public evidence carries us for now.',
    'The missing link is evidence of who actually kept the tool, not a guess about what an unseen record says.',
  ].join(' ');
}
