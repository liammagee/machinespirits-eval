export const TUTOR_STUB_EVIDENCE_ASSERTION_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.evidence-assertion-audit.v1';

const CORRESPONDENCE_PATTERN =
  /\b(?:answer(?:s|ed)? to|correspond(?:s|ed)? to|identical to|match(?:es|ed)?|same (?:alloy|flaw|mark|metal|residue|streak)|tie(?:s|d)? (?:back )?to|trace(?:s|d)? (?:back )?to)\b/iu;
const EVIDENCE_OBJECT_PATTERN =
  /\b(?:alloys?|assays?|coins?|crucibles?|dies?|entries|entry|flaws?|leavings|logs?|marks?|metals?|records?|residues?|samples?|shillings?|streaks?|tools?|traces?)\b/iu;
const NON_ASSERTIVE_PATTERN =
  /\b(?:before|can|could|if|look for|may|might|must|need(?:s)? to|seek(?:s|ing)?|should|unless|until|whether|would)\b|\b(?:missing|required)\s+(?:link|test|evidence)\b|\bneed(?:s|ed)?\b[^.!?;]{0,80}\bto\b|\b(?:do|does|did|has|have|is|are|was|were) not\b|\b(?:don[’']t|doesn[’']t|didn[’']t|hasn[’']t|haven[’']t|isn[’']t|aren[’']t|wasn[’']t|weren[’']t|never|no match|not yet|nor)\b|\b(?:no|neither)\b[^.!?;]{0,80}\b(?:answer(?:s|ed)? to|correspond(?:s|ed)? to|match(?:es|ed)?|tie(?:s|d)? (?:back )?to|trace(?:s|d)? (?:back )?to)\b/iu;
const PERSON_ATTRIBUTION_PATTERN =
  /\b(?:hand|holder|name|owner|person)\b[^.!?;]{0,18}\b(?:is|remains?|was) tied to\b/iu;
const CUSTODY_ATTRIBUTION_PATTERN =
  /\b(?:graver|tool)\b[^.!?;]{0,42}\btied to (?:its )?(?:holder|owner)\b/iu;
const TOOL_FUNCTION_ATTRIBUTION_PATTERN =
  /\b(?:graver|tool)\b[^.!?;]{0,42}\btied to\b[^.!?;]{0,24}\b(?:cutting|die-cutting|engraving|graving)\b/iu;

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function clauses(value) {
  return oneLine(value)
    .split(/(?<=[.!?;])\s+/gu)
    .map((part) => part.trim())
    .filter(Boolean);
}

function contextualizedEvidenceClauses(value) {
  const rows = clauses(value);
  return rows.map((clause, index) => {
    if (EVIDENCE_OBJECT_PATTERN.test(clause) || !CORRESPONDENCE_PATTERN.test(clause) || index === 0) return clause;
    const previous = rows[index - 1];
    return EVIDENCE_OBJECT_PATTERN.test(previous) ? `${previous} ${clause}` : clause;
  });
}

function evidenceTokens(value) {
  return new Set(
    (oneLine(value).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || []).filter((token) =>
      EVIDENCE_OBJECT_PATTERN.test(token),
    ),
  );
}

function assertedCorrespondence(value) {
  const surface = oneLine(value);
  return (
    surface &&
    !surface.endsWith('?') &&
    CORRESPONDENCE_PATTERN.test(surface) &&
    EVIDENCE_OBJECT_PATTERN.test(surface) &&
    !PERSON_ATTRIBUTION_PATTERN.test(surface) &&
    !CUSTODY_ATTRIBUTION_PATTERN.test(surface) &&
    !TOOL_FUNCTION_ATTRIBUTION_PATTERN.test(surface) &&
    !NON_ASSERTIVE_PATTERN.test(surface)
  );
}

function publiclySupported(candidate, publicClauses) {
  const candidateTokens = evidenceTokens(candidate);
  return publicClauses.some((clause) => {
    if (!CORRESPONDENCE_PATTERN.test(clause)) return false;
    const publicTokens = evidenceTokens(clause);
    return [...candidateTokens].some((token) => publicTokens.has(token));
  });
}

export function auditTutorStubEvidenceAssertions({ text = '', permittedText = '' } = {}) {
  const publicClauses = contextualizedEvidenceClauses(permittedText);
  const issues = contextualizedEvidenceClauses(text)
    .filter(assertedCorrespondence)
    .filter((clause) => !publiclySupported(clause, publicClauses))
    .map((clause) => ({
      type: 'unsupported_evidence_correspondence',
      reason: 'states that public exhibits match or trace to one another before that correspondence is public',
      text: clause,
    }));
  return {
    schema: TUTOR_STUB_EVIDENCE_ASSERTION_AUDIT_SCHEMA,
    ok: issues.length === 0,
    issues,
  };
}
