const ELLIPTICAL_SAME_PATTERN =
  /^(?:(?:yes[,;:]?\s*)?(?:(?:it|that|this|they|he|she|the (?:one|person|hand))\s+)?(?:will|would|must|should|could|has to|have to|is|are|was|were)?\s*(?:be\s+)?)?(?:the\s+)?same(?:\s+(?:one|person|hand|place|source))?[.!]*$/iu;
const BINARY_REPLY_PATTERN = /^(?:yes|right|exactly|correct|no|not so)[.!]*$/iu;
const UNCERTAINTY_OR_QUESTION_PATTERN = /\?|\b(?:maybe|perhaps|possibly|i guess|not sure|uncertain)\b/iu;
const CONTRADICTION_PATTERN = /\b(?:but|however|instead|different|not the same|someone else)\b/iu;
const CASE_CLOSING_PATTERN =
  /\b(?:culprit|guilty|verdict|final answer|who (?:struck|made|coined)|write (?:their|the) name|name the (?:person|suspect|culprit))\b/iu;
const SINGLE_REFERENT_PATTERN =
  /\b(?:one hand alone|one person alone|the same hand|a single hand|a single person|only (?:one|that person|that hand|the person|the hand)|the one hand)\b/iu;
const OPEN_LOCAL_QUESTION_PATTERN = /^(?:what|which|who)\b/iu;
const OPEN_LOCAL_SCOPE_PATTERN = /\b(?:rule out|compare|feature|mark|difference|change|show|follow)\b/iu;

const QUESTION_STOPWORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'be',
  'can',
  'could',
  'do',
  'does',
  'from',
  'has',
  'have',
  'how',
  'in',
  'is',
  'it',
  'license',
  'make',
  'mean',
  'of',
  'on',
  'one',
  'say',
  'show',
  'that',
  'the',
  'these',
  'think',
  'this',
  'to',
  'us',
  'what',
  'which',
  'who',
  'will',
  'would',
  'write',
  'you',
  'your',
]);

function lastQuestion(text) {
  const source = String(text || '').trim();
  if (!source.includes('?')) return '';
  const matches = source.match(/(?:^|[.!?]\s+)([^.!?]*\?)/gu);
  return String(matches?.at(-1) || source.slice(source.lastIndexOf('.', source.lastIndexOf('?')) + 1))
    .replace(/^[.!?]\s*/u, '')
    .trim();
}
function isBinaryQuestion(question) {
  return /^(?:do|does|did|is|are|was|were|can|could|would|will|has|have|so)\b/iu.test(String(question || '').trim());
}

function normalizedQuestionTokens(text) {
  return (
    String(text || '')
      .toLowerCase()
      .replace(/[’']/gu, '')
      .match(/[a-z][a-z-]*/gu)
      ?.map((token) => token.replace(/(?:ies)$/u, 'y').replace(/(?:s)$/u, ''))
      .filter((token) => token.length >= 3 && !QUESTION_STOPWORDS.has(token)) || []
  );
}

function overlapCoefficient(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap / Math.min(a.size, b.size);
}

/**
 * Resolve only high-confidence, immediately adjacent learner ellipsis.
 *
 * This does not add a fact to the strict learner DAG. It tells the human
 * scaffold that the learner has already answered the local spoken question,
 * so the tutor should carry the obvious bridge and move on.
 */
export function resolveTutorStubGenerousInference({
  mode,
  learnerText,
  previousTutorText,
  branchId = null,
  classification = null,
} = {}) {
  const surface = String(learnerText || '').trim();
  const tutorText = String(previousTutorText || '').trim();
  const sourceQuestion = lastQuestion(tutorText);
  const labels = [
    classification?.turn?.evidence_use,
    classification?.turn?.epistemic_stance,
    classification?.turn?.discourse_move,
  ]
    .filter(Boolean)
    .join(' ');
  const base = {
    schema: 'machinespirits.tutor-stub.generous-inference.v1',
    applied: false,
    kind: null,
    confidence: 'none',
    learnerSurface: surface || null,
    sourceTutorQuestion: sourceQuestion || null,
    resolvedMeaning: null,
    reason: null,
    tutorInstruction: null,
  };

  if (mode !== 'defeasible_human_scaffold') return { ...base, reason: 'mode_not_defeasible' };
  if (!surface || !sourceQuestion) return { ...base, reason: 'no_adjacent_question_and_answer' };
  if (branchId === 'join' || CASE_CLOSING_PATTERN.test(sourceQuestion)) {
    return { ...base, reason: 'case_closing_question_requires_explicit_grounding' };
  }
  if (UNCERTAINTY_OR_QUESTION_PATTERN.test(surface) || CONTRADICTION_PATTERN.test(surface)) {
    return { ...base, reason: 'learner_did_not_make_a_clear_affirmative_move' };
  }
  const sameReply = ELLIPTICAL_SAME_PATTERN.test(surface);
  const binaryReply = BINARY_REPLY_PATTERN.test(surface) && isBinaryQuestion(sourceQuestion);
  const openLocalReply =
    OPEN_LOCAL_QUESTION_PATTERN.test(sourceQuestion) &&
    OPEN_LOCAL_SCOPE_PATTERN.test(sourceQuestion) &&
    surface.split(/\s+/u).length <= 6 &&
    !/[.!?]\s+\S/u.test(surface);
  if (/distorts_public_evidence|resistant/iu.test(labels)) {
    return { ...base, reason: 'classifier_detected_unsafe_or_conflicting_move' };
  }
  if (/overleaps_evidence/iu.test(labels) && !openLocalReply) {
    return { ...base, reason: 'classifier_detected_unsafe_or_conflicting_move' };
  }
  if (!sameReply && !binaryReply && !openLocalReply) return { ...base, reason: 'not_a_supported_elliptical_reply' };
  if (sameReply && !SINGLE_REFERENT_PATTERN.test(tutorText)) {
    return { ...base, reason: 'no_single_public_referent_to_resolve_same' };
  }

  const kind = sameReply
    ? 'contextual_same_referent'
    : binaryReply
      ? 'contextual_binary_answer'
      : 'contextual_open_answer';
  return {
    ...base,
    applied: true,
    kind,
    confidence: 'high',
    resolvedMeaning: sameReply
      ? 'The learner affirms that the current local conclusion has the same single referent identified in the preceding public question.'
      : binaryReply
        ? 'The learner directly answers the preceding yes-or-no question.'
        : 'The learner gives a short answer whose referent and scope are supplied by the immediately preceding public question.',
    reason:
      'The immediately preceding public question supplies one unambiguous local referent and the reply resolves against it.',
    tutorInstruction:
      'Treat the immediately preceding local question as answered. Do not ask the learner to restate, rename, or re-prove that step; carry the obvious public bridge internally and advance.',
  };
}

export function auditTutorStubGenerousInferenceResponse({ text, resolution } = {}) {
  if (!resolution?.applied) return { ok: true, issues: [], similarity: 0 };
  const sourceQuestion = resolution.sourceTutorQuestion || '';
  const responseQuestion = lastQuestion(text);
  if (!responseQuestion) return { ok: true, issues: [], similarity: 0 };
  const sourceTokens = normalizedQuestionTokens(sourceQuestion);
  const responseTokens = normalizedQuestionTokens(responseQuestion);
  const similarity = overlapCoefficient(sourceTokens, responseTokens);
  const repeatedAcknowledgementDemand =
    /\b(?:what does that|what would that|who (?:cast|cut|worked|made)|write about who|name (?:the|that)|which person|which hand)\b/iu.test(
      responseQuestion,
    );
  const repeated = sourceTokens.length >= 2 && responseTokens.length >= 2 && similarity >= 0.72;
  const issues =
    repeated && repeatedAcknowledgementDemand
      ? [
          {
            type: 'redundant_local_requestion',
            reason:
              'the tutor asks the already-resolved local question again after a high-confidence contextual answer',
            sourceQuestion,
            responseQuestion,
          },
        ]
      : [];
  return { ok: issues.length === 0, issues, similarity };
}
