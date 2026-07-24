const MAX_CODER_ID_CODEPOINTS = 80;
const MAX_CODER_ID_BYTES = 120;
// `~` was removed or replaced by both legacy sanitizers, so this prefix cannot
// be mistaken for an old filename suffix that merely happens to look encoded.
const ARTIFACT_TOKEN_PREFIX = 'cid~';

function identityError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function normalizeCoderId(value) {
  const coderId = String(value ?? '')
    .trim()
    .normalize('NFC');
  if (!coderId) throw identityError('coder_id is required', 'coder_id_required');
  if (Array.from(coderId).some((character) => character.codePointAt(0) <= 31 || character.codePointAt(0) === 127)) {
    throw identityError('coder_id cannot contain control characters', 'coder_id_invalid_characters');
  }
  if (Array.from(coderId).length > MAX_CODER_ID_CODEPOINTS || Buffer.byteLength(coderId, 'utf8') > MAX_CODER_ID_BYTES) {
    throw identityError('coder_id is too long', 'coder_id_too_long');
  }
  return coderId;
}

export function coderArtifactToken(value) {
  const coderId = normalizeCoderId(value);
  return `${ARTIFACT_TOKEN_PREFIX}${Buffer.from(coderId, 'utf8').toString('base64url')}`;
}

export function coderIdFromArtifactToken(token) {
  const value = String(token || '');
  if (!value.startsWith(ARTIFACT_TOKEN_PREFIX)) return null;
  const encoded = value.slice(ARTIFACT_TOKEN_PREFIX.length);
  if (!encoded || !/^[A-Za-z0-9_-]+$/u.test(encoded)) return null;
  try {
    const coderId = normalizeCoderId(Buffer.from(encoded, 'base64url').toString('utf8'));
    return coderArtifactToken(coderId) === value ? coderId : null;
  } catch {
    return null;
  }
}

export function legacyTaxonomyCoderKey(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^\w-]/gu, '');
}

export function legacyImpasseCoderKey(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .slice(0, 80);
}

export const CODER_IDENTITY_SCHEMA = 'machinespirits.labelling-game.coder-identity.v1';
