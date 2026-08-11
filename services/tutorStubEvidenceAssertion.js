import { tutorStubSplitSymbolWords } from './tutorStubFactModel.js';

export const TUTOR_STUB_EVIDENCE_ASSERTION_AUDIT_SCHEMA = 'machinespirits.tutor-stub.evidence-assertion-audit.v1';

const RELATION_SYMBOL_STOPWORDS = new Set([
  'are',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'is',
  'of',
  'on',
  'to',
]);

function evidenceTokenRoot(value) {
  const token = String(value || '').toLowerCase();
  if (token.length >= 7 && token.endsWith('ied')) return `${token.slice(0, -3)}y`;
  if (token.length >= 7 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length >= 7 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length >= 7 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length >= 6 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function structuredTokenRoot(value) {
  const token = String(value || '').toLowerCase();
  if (token.length >= 5 && token.endsWith('ied')) return `${token.slice(0, -3)}y`;
  if (token.length >= 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length >= 5 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length >= 5 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length >= 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function structuredTokenRoots(value) {
  return tutorStubSplitSymbolWords(value).map(structuredTokenRoot).filter(Boolean);
}

/** Treat inflections of an already-public clue word as public, not future leakage. */
export function tutorStubPrivateTokenAlreadyPublic(token, publicTokens = new Set()) {
  const publicSet = publicTokens instanceof Set ? publicTokens : new Set(publicTokens || []);
  if (publicSet.has(token)) return true;
  const root = evidenceTokenRoot(token);
  return [...publicSet].some((publicToken) => evidenceTokenRoot(publicToken) === root);
}

// The `to` of "ties X to Y" must be a word of its own. Without the hyphen
// guards, "I trace the winter-to-thaw entry with my finger" reads as one
// exhibit traced to another, because the `to` inside the compound carries word
// boundaries on both sides.
const CORRESPONDENCE_PATTERN =
  /\b(?:answer(?:s|ed)? to|correspond(?:s|ed)? to|identical to|match(?:es|ed)?|same (?:[\p{L}\p{N}-]+\s+)?(?:alloy|flaw|mark|metal|residue|strain|streak)|tie(?:s|d)?\b[^.!?;:]{0,55}(?<!-)\bto(?!-)|trace(?:s|d)?\b[^.!?;:]{0,55}(?<!-)\bto(?!-))\b/iu;
// A determined "the match" names a correspondence without claiming one, so the
// tutor can handle it as stage business. "a match between X and Y" still
// claims, and so is left alone.
const NAMED_MATCH_PATTERN =
  /\b(?:a|an|any|her|his|its|no|that|the|their|this)\s+match\b(?!\s*(?:between|for|to|with)\b)/giu;
const EVIDENCE_OBJECT_PATTERN =
  /\b(?:alloys?|assays?|coins?|crucibles?|dies?|entries|entry|flaws?|leavings|logs?|marks?|metals?|records?|residues?|samples?|shillings?|strains?|streaks?|tools?|traces?)\b/iu;
const NON_ASSERTIVE_PATTERN =
  /^(?:please\s+)?(?:examine|inspect)\b|\b(?:before|can|could|if|look for|may|might|must|need(?:s)? to|seek(?:s|ing)?|should|unless|until|whether|would)\b|\b(?:missing|required)\s+(?:link|test|evidence)\b|\bthe next (?:safe )?(?:check|evidence|record|test)\b|\b(?:where|how|what)\b[^.!?;]{0,35}\bto trace\b|\bneed(?:s|ed)?\b[^.!?;]{0,80}\bto\b|\b(?:do|does|did|has|have|is|are|was|were) not\b|\b(?:don[’']t|doesn[’']t|didn[’']t|hasn[’']t|haven[’']t|isn[’']t|aren[’']t|wasn[’']t|weren[’']t|never|no match|not yet|nor)\b|\b(?:no|neither)\b[^.!?;]{0,80}\b(?:answer(?:s|ed)? to|correspond(?:s|ed)? to|match(?:es|ed)?|tie(?:s|d)? (?:back )?to|trace(?:s|d)? (?:back )?to)\b/iu;
const PERSON_ATTRIBUTION_PATTERN =
  /\b(?:hand|holder|name|owner|person)\b[^.!?;]{0,24}\b(?:is|remains?|was)\s+(?:already\s+|now\s+)?tied to\b|\btie(?:s|d)?\b[^.!?;]{0,24}\b(?:her|him|person|them)\b[^.!?;]{0,12}\bto\b/iu;
const CUSTODY_ATTRIBUTION_PATTERN =
  /\b(?:burin|graver|tool)\b[^.!?;]{0,55}\btied to\b[^.!?;]{0,35}\b(?:custody|hand|holder|keeping|owner|possession)\b|\btie(?:s|d)?\b[^.!?;]{0,35}\b(?:burin|graver|tool)\b[^.!?;]{0,20}\bto\b[^.!?;]{0,35}\b(?:custody|hand|holder|keeping|owner|possession)\b/iu;
const TOOL_FUNCTION_ATTRIBUTION_PATTERN =
  /\b(?:graver|tool)\b[^.!?;]{0,42}\btied to\b[^.!?;]{0,24}\b(?:cutting|die-cutting|engraving|graving)\b/iu;
const RECORD_HANDLING_ATTRIBUTION_PATTERN =
  /\b(?:entry|job number|ledger|log|record)\b[^.!?;]{0,90}\btie(?:s|d)?\b[^.!?;]{0,55}\bto\b[^.!?;]{0,55}\b(?:access|custody|handled|handling|possession)\b/iu;
const SINGLE_DIE_RELATION_PATTERN =
  /\b(?:coins?|shillings?|twelve|them|all)\b[^.!?;]{0,100}\b(?:one|same|single)\b[^.!?;]{0,35}\bdie\b|\b(?:one|same|single)\b[^.!?;]{0,35}\bdie\b[^.!?;]{0,100}\b(?:coins?|shillings?|twelve|them|all)\b/iu;

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function clauses(value) {
  return oneLine(value)
    // A closing quotation mark belongs to the preceding sentence. Split after
    // it as well, otherwise the next host sentence can be glued onto an exact
    // authored SOURCE and change which evidence object appears to own the
    // correspondence.
    .split(/(?:(?<=[.!?;])|(?<=[.!?;][”"']))\s+/gu)
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
    (
      oneLine(value)
        .toLowerCase()
        .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || []
    ).filter((token) => EVIDENCE_OBJECT_PATTERN.test(token)),
  );
}

function assertedCorrespondence(value) {
  const surface = oneLine(value);
  return (
    surface &&
    !surface.endsWith('?') &&
    CORRESPONDENCE_PATTERN.test(surface.replace(NAMED_MATCH_PATTERN, ' ')) &&
    EVIDENCE_OBJECT_PATTERN.test(surface) &&
    !PERSON_ATTRIBUTION_PATTERN.test(surface) &&
    !CUSTODY_ATTRIBUTION_PATTERN.test(surface) &&
    !TOOL_FUNCTION_ATTRIBUTION_PATTERN.test(surface) &&
    !RECORD_HANDLING_ATTRIBUTION_PATTERN.test(surface) &&
    !NON_ASSERTIVE_PATTERN.test(surface)
  );
}

function structuredFactSupports(candidate, fact) {
  // Structured authorization is deliberately narrow: a grounded two-place
  // fact must contribute its relation and both ordered endpoints. This lets a
  // released fact cross prose costumes without turning any shared noun into a
  // blanket correspondence licence.
  if (!Array.isArray(fact) || fact.length !== 3) return false;
  const [relation, ...argumentsList] = fact;
  const candidateRoots = structuredTokenRoots(candidate);
  const relationRoot = structuredTokenRoots(relation).find((token) => !RELATION_SYMBOL_STOPWORDS.has(token));
  if (!relationRoot || !candidateRoots.includes(relationRoot)) return false;

  const argumentRoots = argumentsList.map((argument, argumentIndex) => {
    const otherRoots = new Set(
      argumentsList.flatMap((other, otherIndex) => (otherIndex === argumentIndex ? [] : structuredTokenRoots(other))),
    );
    return structuredTokenRoots(argument).filter((token) => token.length >= 3 && !otherRoots.has(token));
  });
  if (argumentRoots.some((roots) => roots.length === 0)) return false;

  let afterIndex = -1;
  for (const roots of argumentRoots) {
    const nextIndex = candidateRoots.findIndex((token, index) => index > afterIndex && roots.includes(token));
    if (nextIndex < 0) return false;
    afterIndex = nextIndex;
  }
  return true;
}

function publiclySupported(candidate, publicClauses, permittedFacts) {
  if (permittedFacts.some((fact) => structuredFactSupports(candidate, fact))) return true;
  const candidateTokens = evidenceTokens(candidate);
  return publicClauses.some((clause) => {
    if (SINGLE_DIE_RELATION_PATTERN.test(candidate) && SINGLE_DIE_RELATION_PATTERN.test(clause)) {
      return true;
    }
    if (!CORRESPONDENCE_PATTERN.test(clause)) return false;
    const publicTokens = evidenceTokens(clause);
    return [...candidateTokens].some((token) => publicTokens.has(token));
  });
}

export function auditTutorStubEvidenceAssertions({ text = '', permittedText = '', permittedFacts = [] } = {}) {
  const publicClauses = contextualizedEvidenceClauses(permittedText);
  const publicFacts = Array.isArray(permittedFacts) ? permittedFacts : [];
  const issues = contextualizedEvidenceClauses(text)
    .filter(assertedCorrespondence)
    .filter((clause) => !publiclySupported(clause, publicClauses, publicFacts))
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
