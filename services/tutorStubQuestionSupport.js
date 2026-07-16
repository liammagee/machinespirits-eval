import { deterministicTutorStubContextualFallback } from './tutorStubResponseGuard.js';

export const TUTOR_STUB_QUESTION_SUPPORT_SCHEMA = 'machinespirits.tutor-stub.question-support.v1';

const ABSTRACT_PROOF_LANGUAGE_PATTERN =
  /\b(?:DAG|proof (?:branch|leaf|node|path)|supporting step|condition in the rule|whole case|(?:first|second|next|other|blank|die) branch)\b/iu;

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
  return /confus|plain_language|repair_request|uncertain|not sure|don[’']?t know/iu.test(
    `${labelsFor(classification)} ${learnerText}`,
  );
}

function isResponsivenessRepair(classification = null, learnerText = '') {
  return /unanswered|didn[’']?t answer|did not answer|not answer(?:ing|ed)|answer my question|not what i asked|ignored my question|response relevance|directly answer/iu.test(
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
  const responsiveRepairRequired = isResponsivenessRepair(classification, learnerText);
  const struggleCount = recentStruggleCount(recentTurns) + (currentStruggle ? 1 : 0);
  const adaptiveChoiceCoolingDown = !multipleChoice && recentlyUsedAdaptiveChoice(recentTurns);

  if (dueNow.length) {
    const modality = responsiveRepairRequired
      ? 'direct_answer_then_stage'
      : multipleChoice || (struggleCount >= 2 && !adaptiveChoiceCoolingDown)
        ? 'stage_then_bounded_choice'
        : 'stage_then_ask';
    return {
      schema: TUTOR_STUB_QUESTION_SUPPORT_SCHEMA,
      answerability: 'answerable_after_staging',
      modality,
      adaptiveMultipleChoice: modality === 'stage_then_bounded_choice',
      guardRequired: currentStruggle || responsiveRepairRequired,
      clarificationInvitationRequired: currentStruggle && !responsiveRepairRequired,
      responsiveRepairRequired,
      learnerMoves: ['answer_from_stated_clue', 'ask_which_clue', 'ask_what_term_means'],
      struggleCount,
      adaptiveChoiceCoolingDown,
      reason: responsiveRepairRequired
        ? 'the learner says their question was not answered, so responsiveness takes priority while the due evidence is staged'
        : 'the next needed evidence is due now and must enter the public discourse before the learner is questioned about it',
      tutorInstruction:
        responsiveRepairRequired
          ? 'First acknowledge that the learner’s question was not answered and answer it directly from the public record. Then stage the due evidence in ordinary scene language. Do not replace that direct answer with a new exercise; a short confirmation question is optional.'
          : modality === 'stage_then_bounded_choice'
          ? 'State the due evidence in ordinary scene language first, then offer 2-3 short choices using the people, objects, and records already named in the scene; invite the learner to choose or answer freely. Say what each choice means in this case. Avoid abstract labels such as “one condition,” “the rule,” or “the whole case.” If the learner is struggling, also say they may ask which clue or term needs explaining.'
          : 'State the due evidence in ordinary scene language first, then ask what that newly public evidence changes. Do not quiz before staging it. If the learner is struggling, explicitly permit a short question about which clue or term is unclear.',
    };
  }

  if (hasFutureGap) {
    const modality = responsiveRepairRequired
      ? 'direct_answer_then_direction'
      : multipleChoice || (struggleCount >= 1 && !adaptiveChoiceCoolingDown)
        ? 'bounded_directional_choice'
        : 'embedded_directional_hint';
    return {
      schema: TUTOR_STUB_QUESTION_SUPPORT_SCHEMA,
      answerability: 'direction_only_until_evidence_is_public',
      modality,
      adaptiveMultipleChoice: modality === 'bounded_directional_choice',
      guardRequired: true,
      clarificationInvitationRequired: currentStruggle && !responsiveRepairRequired,
      responsiveRepairRequired,
      learnerMoves: ['use_the_public_direction', 'ask_which_clue', 'ask_what_term_means'],
      struggleCount,
      adaptiveChoiceCoolingDown,
      reason: responsiveRepairRequired
        ? 'the learner says their question remains unanswered; answer from the existing public record before discussing any missing support'
        : 'a remaining best-path fact has not entered the public scene, so open recall would ask the learner to invent evidence',
      tutorInstruction:
        responsiveRepairRequired
          ? 'Directly answer the learner’s outstanding question using only evidence already stated. Explicitly distinguish what the record does establish from what it does not. Do not pivot into a new quiz or require a multiple-choice response; after answering, you may briefly name the category of support still missing without revealing it.'
          : modality === 'bounded_directional_choice'
          ? 'Do not ask the learner to invent or name an unseen record, source, person, or fact. Offer 2-3 short choices using only people, objects, and records already named in the scene. Say what each choice means in this case; avoid abstract labels such as “one condition,” “the rule,” or “the whole case.” Do not include the actual unstaged record or answer. If the learner is struggling, also say they may ask which clue or term needs explaining.'
          : 'Do not ask the learner to invent or name an unseen record, source, person, or fact. Briefly state the direction of the missing support in the discourse (for example that possession needs custody evidence, not expert recognition), without revealing the unstaged fact. You may consolidate the current public inference without asking a question. If you do ask a struggling learner a question, explicitly permit a short question about which clue or term is unclear.',
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
      guardRequired: true,
      clarificationInvitationRequired: true,
      responsiveRepairRequired: false,
      learnerMoves: ['answer_from_restated_clue', 'ask_which_clue', 'ask_what_term_means'],
      struggleCount,
      adaptiveChoiceCoolingDown,
      reason:
        'the needed material is public, but the learner has signalled that an unsupported open question is not enough',
      tutorInstruction:
        modality === 'bounded_public_choice'
          ? 'Restate the live public clue, then offer 2-3 short interpretations of it and invite the learner to choose or answer freely. Also say they may ask which clue or term needs explaining.'
          : 'Put the directional hint into the discourse before asking: restate the live public clue and narrow the relation the learner is being asked to notice. Explicitly say that a short question about which clue or term is unclear is a valid response.',
    };
  }

  return {
    schema: TUTOR_STUB_QUESTION_SUPPORT_SCHEMA,
    answerability: 'publicly_answerable',
    modality: 'open_question',
    adaptiveMultipleChoice: false,
    guardRequired: false,
    clarificationInvitationRequired: false,
    responsiveRepairRequired: false,
    learnerMoves: ['answer_from_public_evidence', 'ask_which_clue', 'ask_what_term_means'],
    struggleCount,
    adaptiveChoiceCoolingDown,
    reason: 'the next move can be answered from evidence already in the public discourse',
    tutorInstruction:
      'Ask one light question grounded in the public evidence already stated. Name the clue in plain language rather than referring vaguely to one mark, the record, or the evidence. If a compressed scene term or referent remains necessary, explicitly invite a short clarification question.',
  };
}

function openRecallQuestions(text) {
  return String(text || '')
    .split(/(?<=[?.!])\s+/u)
    .filter((sentence) => sentence.includes('?'))
    .filter(
      (sentence) =>
        !/\b(?:which|what)\b.{0,45}\b(?:clue|record|term|word|part|connection)\b.{0,55}\b(?:clarif|unclear|explain|examine|start|first|revisit)\b/iu.test(
          sentence,
        ),
    )
    .filter((sentence) =>
      /\bwhat\s+(?:kind\s+of\s+)?(?:record|log|document|source|name|person|evidence)|\bwhich\s+(?:new\s+|unseen\s+)?(?:record|log|document|source|name|person|evidence)\s+(?:would|could|might|shows?|proves?|names?)|\bwho\s+(?:held|owned|kept|signed|had)|\bwhat\s+name\b/iu.test(
        sentence,
      ),
    );
}

function invitesClarification(source) {
  return (
    /\b(?:ask|tell)\s+me\b.{0,80}\b(?:clue|term|word|part|meaning|unclear|explain)/isu.test(source) ||
    /\b(?:if|when)\b.{0,70}\b(?:unclear|not sure|unsure|doesn[’']?t make sense)\b.{0,80}\b(?:ask|say|tell)/isu.test(
      source,
    ) ||
    /\byou (?:can|may) (?:also )?ask\b/iu.test(source) ||
    /\b(?:you (?:can|could|may)|or)\b[^.!?]{0,45}\b(?:ask|clarif\w*|unpack\w*)\b[^.!?]{0,80}\b(?:clue|connection|means?|meaning|term|word|unclear)\b/iu.test(
      source,
    ) ||
    /\b(?:which|what)\b.{0,50}\b(?:clue|record|term|word|part|connection|distinction)\b.{0,55}\b(?:clarif\w*|unclear|explain\w*|unpack\w*|revisit\w*|examine\w*|start|first)\b/isu.test(
      source,
    ) ||
    /\b(?:pause|stop)\b.{0,35}\b(?:to\s+)?(?:clarif\w*|explain\w*|unpack\w*|restate\w*)\b/isu.test(source) ||
    /\b(?:you (?:can|may)|or)\b.{0,70}\bask me to (?:clarif\w*|explain\w*|unpack\w*|restate\w*)\b/isu.test(
      source,
    ) ||
    /\b(?:do|would) you want me to (?:say|tell you|explain)\b.{0,70}\bwhat\b.{0,45}\bmeans?\b/isu.test(
      source,
    ) ||
    /\bdoes (?:that|this|the distinction)\b.{0,45}\b(?:make sense|help)\b/isu.test(source)
  );
}

function directlyAnswersOutstandingQuestion(source) {
  return /\b(?:yes|no)\b[^.!?]{0,160}\b(?:record|log|evidence|entry|entered|check|ask|shows?|proves?|establishes?|does|doesn[’']?t|can|cannot)\b|\bthere (?:is|isn[’']?t|is not|was|wasn[’']?t|was not)\b|\b(?:the|that|this) (?:record|log|evidence|entry) (?:shows?|records?|establishes?|does|doesn[’']?t)|\bit (?:shows?|records?|establishes?|does|doesn[’']?t)\b|\bwe (?:can|cannot|can[’']?t|could|couldn[’']?t)\b/iu.test(
    source,
  );
}

export function auditTutorStubQuestionSupportResponse({ text = '', support = null } = {}) {
  const issues = [];
  const source = String(text || '');
  const abstractProofLanguage = source.match(ABSTRACT_PROOF_LANGUAGE_PATTERN)?.[0] || null;
  if (abstractProofLanguage) {
    issues.push({
      type: 'abstract_proof_language',
      reason: 'uses an internal proof-map label instead of the public people, objects, records, or actions',
      excerpt: abstractProofLanguage,
    });
  }
  if (!support?.guardRequired) return { ok: issues.length === 0, issues };
  if (support.responsiveRepairRequired && !directlyAnswersOutstandingQuestion(source)) {
    issues.push({
      type: 'missing_direct_response',
      reason: 'the learner said their question was not answered, but the draft pivots without directly answering it',
    });
  }
  const recall = openRecallQuestions(text);
  if (recall.length) {
    issues.push({
      type: 'unanswerable_open_recall',
      reason: 'asks the learner to name evidence or a person that has not yet entered the public scene',
      excerpts: recall,
    });
  }
  if (support.modality === 'bounded_directional_choice') {
    const hasChoice =
      /(?:\bA[).:]\s|\bB[).:]\s|\beither\b.+\bor\b|\bbetween\b.+\band\b)/isu.test(source) ||
      /\b(?:are|can|do|does|is|shall|should|would|what|which)\b[^?]{3,180}\bor\b[^?]{2,120}\?/isu.test(source) ||
      /\bchoose\b[^.!?]{0,240}\bor\b/isu.test(source);
    if (!hasChoice) {
      issues.push({
        type: 'missing_bounded_choice',
        reason:
          'repeated uncertainty called for a small public-safe choice, but the draft left the learner with another unsupported open prompt',
      });
    }
  }
  if (support.clarificationInvitationRequired && source.includes('?')) {
    if (!invitesClarification(source)) {
      issues.push({
        type: 'missing_clarification_invitation',
        reason:
          'the learner has signalled difficulty, but the tutor asks another question without making a clarifying question visibly available',
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function deterministicTutorStubQuestionSupportFallback(options = null) {
  const context = options?.support || options?.world || options?.dueEvidence ? options : { support: options };
  return deterministicTutorStubContextualFallback(context);
}
