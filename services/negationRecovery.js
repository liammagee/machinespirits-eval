// Negation recovery — the outcome-side half of the sarcastic_determinate
// register (notes/2026-08-06-sarcasm-determinate-negation-preregistration.md).
//
// The register treats sarcasm as a double negation with a determinate target:
// the tutor mock-praises a named learner claim P so the learner can derive
// not-P. This module answers the follow-up question: did the learner then
// voice the corrected claim in their own words?
//
// Two paths share one result shape:
//   - deterministic: when the corrected claim is authored (fixtures, or any
//     future world with a fixed claim set), token matching in the style of
//     services/dramaticDerivation/answerSurface.js decides recovery.
//   - judge_required: on free-text scenarios there is no authored correction,
//     so the caller sends buildNegationRecoveryJudgePrompt() to a sonnet-class
//     judge and parses the strict JSON reply with parseNegationRecoveryJudgeReply().
//
// The deterministic path is validated by tests; the judge path is validated
// against the hand-authored fixture before it may score a paid run.

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase();
}

const STOP_TOKENS = new Set([
  'the',
  'and',
  'that',
  'this',
  'with',
  'from',
  'for',
  'not',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
  'but',
  'you',
  'your',
  'its',
  'his',
  'her',
  'they',
  'them',
  'then',
  'than',
  'into',
  'out',
  'about',
  'what',
  'when',
  'which',
  'because',
  'does',
  'did',
  'can',
  'could',
  'would',
  'should',
]);

export function claimTokens(text) {
  return [
    ...new Set(
      normalize(text)
        .split(/[^a-z0-9']+/)
        .map((token) => token.replace(/'s$/, ''))
        .filter((token) => token.length > 2 && !STOP_TOKENS.has(token)),
    ),
  ];
}

// A corrected claim counts as voiced when the learner's reply carries most of
// its content tokens. 0.6 keeps paraphrase room while refusing one-word echoes;
// the fixture pins the boundary cases.
const RECOVERY_TOKEN_THRESHOLD = 0.6;

export function evaluateNegationRecoveryDeterministic({ correctedClaim, postLearnerMessage }) {
  const claim = claimTokens(correctedClaim);
  if (!claim.length) {
    return {
      mode: 'deterministic',
      recovered: false,
      reason: 'empty_corrected_claim',
      overlap: 0,
      threshold: RECOVERY_TOKEN_THRESHOLD,
    };
  }
  const reply = new Set(claimTokens(postLearnerMessage));
  const hits = claim.filter((token) => reply.has(token));
  const overlap = hits.length / claim.length;
  return {
    mode: 'deterministic',
    recovered: overlap >= RECOVERY_TOKEN_THRESHOLD,
    overlap: Number(overlap.toFixed(3)),
    threshold: RECOVERY_TOKEN_THRESHOLD,
    matchedTokens: hits,
    claimTokenCount: claim.length,
  };
}

export function evaluateNegationRecovery({ tutorMessage, postLearnerMessage, correctedClaim = null }) {
  if (correctedClaim) {
    return evaluateNegationRecoveryDeterministic({ correctedClaim, postLearnerMessage });
  }
  return {
    mode: 'judge_required',
    recovered: null,
    prompt: buildNegationRecoveryJudgePrompt({ tutorMessage, postLearnerMessage }),
  };
}

export function buildNegationRecoveryJudgePrompt({ tutorMessage, postLearnerMessage }) {
  return [
    'You are scoring one tutoring exchange for two yes/no facts. The tutor turn',
    'was written under a contract: sarcasm must name a specific learner claim',
    '(quoted or restated) and mock-praise it so that exactly one corrected claim',
    'is derivable from the reversal.',
    '',
    'TUTOR TURN:',
    '---',
    String(tutorMessage || '').trim(),
    '---',
    '',
    'LEARNER REPLY (the next learner turn):',
    '---',
    String(postLearnerMessage || '').trim(),
    '---',
    '',
    'Answer strictly as minified JSON with exactly these keys and no prose:',
    '{"named_target_claim": true|false, "target_claim": "<the learner claim the sarcasm names, or empty>",',
    ' "derivable_correction": "<the corrected claim the reversal implies, or empty>",',
    ' "learner_voiced_correction": true|false,',
    ' "voiced_evidence": "<shortest learner-reply quote that voices the correction, or empty>"}',
    '',
    'Rules: named_target_claim is true only if the tutor turn quotes or restates',
    'a specific claim from the learner, not a general attitude. ',
    'learner_voiced_correction is true only if the learner states the corrected',
    'claim in their own words — agreeing noises, apologies, or repeating the',
    "tutor's sarcasm verbatim do not count.",
  ].join('\n');
}

export function parseNegationRecoveryJudgeReply(text) {
  const raw = String(text || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return { mode: 'judge', parseError: 'no_json_object', recovered: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch (err) {
    return { mode: 'judge', parseError: `bad_json:${err.message}`, recovered: null };
  }
  return {
    mode: 'judge',
    namedTargetClaim: parsed.named_target_claim === true,
    targetClaim: String(parsed.target_claim || ''),
    derivableCorrection: String(parsed.derivable_correction || ''),
    recovered: parsed.learner_voiced_correction === true,
    voicedEvidence: String(parsed.voiced_evidence || ''),
  };
}

export default {
  claimTokens,
  evaluateNegationRecovery,
  evaluateNegationRecoveryDeterministic,
  buildNegationRecoveryJudgePrompt,
  parseNegationRecoveryJudgeReply,
};
