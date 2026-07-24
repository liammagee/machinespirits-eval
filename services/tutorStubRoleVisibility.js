/**
 * Dependency-free public-surface predicates for tutor-stub role performance.
 */

const ROLE_TOKEN_STOP_WORDS = new Set(
  'about after another before being from into reading role source that their them these this with'.split(' '),
);
const ROLE_ACTION_PATTERN =
  /\b(?:attesting|describing|giving|holding|identifying|opening|presenting|reading|reporting|showing|testifying|unfolding|voicing|witnessing)\b/iu;
const ROLE_OBJECT_TOKEN_STOP_WORDS = new Set('a an her his its our the their this those your'.split(' '));
const ROLE_POSSESSIVE_EVIDENCE_OBJECT_SOURCE =
  'account|archive|assay|badge|book|card|chart|coin|crucible|cupel|entry|exhibit|file|journal|ledger|log|notebook|notice|record|register|report|sample|sheet|shilling|slate|statement|swab|testimony|tool|touchstone';

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function roleIdentity(entry) {
  return oneLine(entry?.role).split(ROLE_ACTION_PATTERN)[0].trim();
}

function roleIdentityPattern(entry) {
  const identity = roleIdentity(entry);
  if (!identity) return null;
  const tokens = (identity.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).filter(
    (token) => !ROLE_TOKEN_STOP_WORDS.has(token.toLowerCase()),
  );
  if (!tokens.length) return null;
  return tokens
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/[-‐‑‒–—]/gu, '[-\\s]'))
    .join('(?:[-\\s]+|,\\s*)');
}

function roleEvidenceObjectPattern(entry) {
  const role = oneLine(entry?.role);
  const action = ROLE_ACTION_PATTERN.exec(role);
  if (!action) return null;
  const objectText = role.slice(action.index + action[0].length).trim();
  const tokens = (objectText.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).filter(
    (token) => !ROLE_OBJECT_TOKEN_STOP_WORDS.has(token.toLowerCase()),
  );
  if (!tokens.length) return null;
  return tokens
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/[-‐‑‒–—]/gu, '[-\\s]'))
    .join('(?:[-\\s]+|,\\s*)');
}

export function tutorStubRoleStageDirectionVisible({ text = '', frame = null } = {}) {
  const response = oneLine(text);
  const unquotedResponse = response.replace(/“[^”]*”/gu, ' ').replace(/"[^"\n]*"/gu, ' ');
  return (frame?.entries || [])
    .filter((entry) => entry.mode === 'enacted_role')
    .some((entry) => {
      const pattern = roleIdentityPattern(entry);
      if (!pattern) return false;
      const authoredSurface = oneLine(entry.surface);
      const withoutAuthoredEvidence = authoredSurface
        ? unquotedResponse.split(authoredSurface).join(' ')
        : unquotedResponse;
      const evidenceObjectPattern = roleEvidenceObjectPattern(entry);
      const stageDirectionSurface = evidenceObjectPattern
        ? withoutAuthoredEvidence.replace(
            new RegExp(`\\b(?:the\\s+)?${pattern}[’']s\\s+(?:the\\s+)?${evidenceObjectPattern}\\b`, 'giu'),
            ' ',
          )
        : withoutAuthoredEvidence;
      // A source role can possess a public record or exhibit without entering
      // the response as a narrated character. "I open the clerk's log" is an
      // object action; "the clerk opens the log" and "clerk:" remain
      // third-person stage directions.
      const withoutPossessiveEvidenceObject = stageDirectionSurface.replace(
        new RegExp(
          `\\b(?:the\\s+)?${pattern}[’']s\\s+(?:the\\s+)?(?:${ROLE_POSSESSIVE_EVIDENCE_OBJECT_SOURCE})\\b`,
          'giu',
        ),
        ' ',
      );
      return new RegExp(`\\b(?:the\\s+)?${pattern}\\b`, 'iu').test(withoutPossessiveEvidenceObject);
    });
}

export function tutorStubFirstPersonRoleVoiceVisible(text = '') {
  const response = oneLine(text);
  return /(?:“[^”]{0,900}\b(?:i|we|my|our)\b[^”]{0,900}”|"[^"]{0,900}\b(?:i|we|my|our)\b[^"]{0,900}")/iu.test(response);
}
