import { classifyTutorStubGuardIssue, tutorStubGuardIssueRows } from './tutorStubGuardDisposition.js';

export const TUTOR_STUB_SELF_CORRECTION_DISCLOSURE_SCHEMA = 'machinespirits.tutor-stub.self-correction-disclosure.v1';
export const TUTOR_STUB_SELF_CORRECTION_AUDIT_SCHEMA = 'machinespirits.tutor-stub.self-correction-disclosure-audit.v1';

/**
 * The disclosure is invited, never templated. This family only *recognises*
 * that a self-correction happened, so the outcome can be labelled and counted;
 * nothing rejects a draft for failing to match it. Adding a phrase here does
 * not make the tutor say it.
 */
const DISCLOSURE_MARKER_PATTERN =
  /\b(?:i (?:was going to|was about to|nearly|almost|started to|had started to|first)\s+(?:say|said|write|wrote|ask|asked|answer|answered|put)|i (?:caught|corrected|stopped|checked) myself|(?:that|which) (?:would have|wouldn[’']t have|does not|doesn[’']t)\s+(?:answer|address)\s+(?:you|your)|before i (?:answer|go on|say)[^.?!]*\bi\b|let me (?:take that back|start again|put that differently)|on second thought)\b/iu;

/**
 * Harness vocabulary. The disclosure brief tells the model why its own draft
 * was rejected, so it has the words to describe the machinery — and no learner
 * should hear them. This is about the private apparatus, not about evidence;
 * the leak audit still owns evidence boundaries and stays hard.
 *
 * Words a detective could plausibly speak in scene are deliberately absent
 * ("check", "contract", "attempt", "policy", "record"). A guard that fires on
 * ordinary speech would push the model away from disclosing at all, which is
 * the outcome this rung exists to make possible.
 */
const HARNESS_MACHINERY_PATTERN =
  /\b(?:guard(?:rail)?s?|audit(?:s|ed|or)?|validator|rubric|schema|prompts?|draft(?:s|ed|ing)?|fallback|rejected by|pipeline|harness|system message|token overlap|focus terms?|hard (?:check|issue)s?)\b/iu;

const QUOTE_PATTERN = /[“"]([^”"]{6,})[”"]/gu;
const SENTENCE_SPLIT_PATTERN = /(?<=[.?!])\s+/u;

/**
 * Quotation marks do heavy ordinary work in this harness — the learner's own
 * words, a Write entry, a piece of released evidence. Only a quote that follows
 * a self-correction marker inside the same sentence is a claim about what the
 * tutor was going to say, and only those are checked against the real drafts.
 */
function claimedNearMissQuotes(surface = '') {
  const claims = [];
  for (const sentence of String(surface).split(SENTENCE_SPLIT_PATTERN)) {
    const marker = sentence.match(DISCLOSURE_MARKER_PATTERN);
    if (!marker) continue;
    const after = sentence.slice(marker.index + marker[0].length);
    claims.push(...[...after.matchAll(QUOTE_PATTERN)].map((match) => match[1]));
  }
  return claims;
}

function oneLine(value = '') {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function comparable(value = '') {
  return oneLine(value)
    .toLowerCase()
    .replace(/[’']/gu, "'")
    .replace(/[^a-z0-9' ]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Decide whether this turn is one where the deterministic fallback is about to
 * publish while carrying an advisory for a finding that killed the model's own
 * drafts.
 *
 * The predicate reuses the disposition catalog rather than restating it: an
 * issue qualifies exactly when classifying it with `terminalFallback` set
 * downgrades it to an advisory it would not otherwise get. That is the same
 * accommodation the fallback relies on, read from the one place it is defined.
 *
 * It also requires that *every* hard finding be of that kind. A draft that also
 * crossed an evidence boundary is a different situation: the fallback is
 * replacing something the tutor should not have said, not quietly absorbing an
 * unanswered question, and there is nothing there worth disclosing.
 */
export function tutorStubDisclosableGuardCorrection({ audits = null, attempts = [] } = {}) {
  const base = {
    schema: TUTOR_STUB_SELF_CORRECTION_DISCLOSURE_SCHEMA,
    disclosable: false,
    findings: [],
    nearMiss: null,
    reason: null,
  };
  const rows = tutorStubGuardIssueRows(audits);
  if (!rows.length) return { ...base, reason: 'no_recorded_guard_findings' };
  const hardRows = rows.filter((issue) => classifyTutorStubGuardIssue(issue).strictDisposition === 'hard');
  if (!hardRows.length) return { ...base, reason: 'no_hard_findings_to_disclose' };
  const findings = hardRows.filter(
    (issue) =>
      classifyTutorStubGuardIssue(issue, { terminalFallback: true }).legacyOverride ===
      'terminal_fallback_conversational_advisory',
  );
  if (!findings.length) return { ...base, reason: 'no_conversational_finding_would_be_waived_on_the_fallback' };
  if (findings.length !== hardRows.length) {
    return { ...base, findings, reason: 'a hard finding remains that the fallback would not waive' };
  }
  const modelAttempts = (Array.isArray(attempts) ? attempts : []).filter((attempt) =>
    oneLine(attempt?.candidate?.text),
  );
  const nearMissAttempt = modelAttempts.at(-1);
  if (!nearMissAttempt) return { ...base, findings, reason: 'no_prior_attempt_text_to_disclose' };
  return {
    ...base,
    disclosable: true,
    findings,
    nearMiss: {
      attempt: nearMissAttempt.attempt ?? null,
      kind: nearMissAttempt.kind || null,
      text: oneLine(nearMissAttempt.candidate.text),
    },
    reason: 'the terminal fallback would publish while waiving a finding that rejected the model drafts',
  };
}

/**
 * Build the brief for one further attempt.
 *
 * What changes here is the addressee, not the wording. Every earlier repair
 * prompt asks the model to fix a draft the learner never saw; this one tells it
 * the learner may notice the change of course and that saying so is allowed.
 * Nothing prescribes a phrase — a draft that simply answers well, with no
 * disclosure at all, is an equally good outcome.
 */
export function tutorStubSelfCorrectionDisclosurePrompt({
  correction = null,
  learnerText = '',
  turnProgressionContract = null,
  minimalRecoveryPrompt = '',
} = {}) {
  if (!correction?.disclosable) return '';
  const learner = oneLine(learnerText);
  const nearMiss = oneLine(correction.nearMiss?.text);
  const reasons = correction.findings
    .map((finding) => oneLine(finding.reason || finding.type))
    .filter(Boolean)
    .slice(0, 3);
  const uptake = turnProgressionContract?.learner_uptake || null;
  const lines = [
    'SELF-CORRECTION PASS.',
    learner ? `The learner said: ${learner}` : '',
    nearMiss ? `You drafted: ${nearMiss}` : '',
    reasons.length ? `That draft does not answer them: ${reasons.join('; ')}.` : '',
    uptake?.learner_surface ? `Answer what they actually said: ${oneLine(uptake.learner_surface)}` : '',
    'Write the turn again so it answers them.',
    'The learner is present for this. If your first attempt went somewhere it should not have, you may say so to them in your own words, in the register of this scene — a working detective can think aloud and change course. You may also simply answer well and say nothing about it. Both are acceptable; neither is required.',
    'If you refer to what you were going to say, refer only to what you actually drafted above. Do not invent a discarded line.',
    'Never name the machinery. The learner has no idea there are drafts, checks, or rules behind your speech, and must not learn it here. Speak only as the character in the scene.',
    minimalRecoveryPrompt ? oneLine(minimalRecoveryPrompt) : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Recognise a self-correction for reporting. Never a gate.
 */
export function detectTutorStubSelfCorrectionDisclosure(text = '') {
  const surface = oneLine(text);
  const match = surface.match(DISCLOSURE_MARKER_PATTERN);
  return { disclosed: Boolean(match), marker: match?.[0] || null };
}

/**
 * Guard the disclosure, not the wording.
 *
 * Two things can go wrong that no other check catches. The tutor can invent a
 * discarded line it never drafted, which is a lie told to gain the learner's
 * trust. And it can describe the apparatus, because the brief just handed it
 * the vocabulary. Everything else about the draft is judged by the normal
 * chain, unchanged.
 */
export function auditTutorStubSelfCorrectionDisclosure({ text = '', priorAttemptTexts = [] } = {}) {
  const surface = oneLine(text);
  const detection = detectTutorStubSelfCorrectionDisclosure(surface);
  const issues = [];
  const priors = (Array.isArray(priorAttemptTexts) ? priorAttemptTexts : []).map(comparable).filter(Boolean);
  const quoted = claimedNearMissQuotes(surface);
  const unsupportedQuotes = quoted.filter((quote) => {
    const needle = comparable(quote);
    return needle.length >= 6 && !priors.some((prior) => prior.includes(needle));
  });
  for (const quote of unsupportedQuotes) {
    issues.push({
      type: 'fabricated_self_correction_quote',
      reason: 'the disclosed near-miss does not appear in any draft the tutor actually produced',
      quote,
    });
  }
  const machinery = surface.match(HARNESS_MACHINERY_PATTERN);
  if (detection.disclosed && machinery) {
    issues.push({
      type: 'harness_machinery_in_public_speech',
      reason: 'the disclosure names the private apparatus behind the tutor’s speech',
      term: machinery[0],
    });
  }
  return {
    schema: TUTOR_STUB_SELF_CORRECTION_AUDIT_SCHEMA,
    active: true,
    ok: issues.length === 0,
    disclosed: detection.disclosed,
    marker: detection.marker,
    claimedNearMissQuotes: quoted,
    issues,
  };
}
