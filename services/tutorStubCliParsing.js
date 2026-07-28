export function parseTutorStubNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return parsed;
}

export function parseTutorStubPositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function parseTutorStubOptionalBoundedInt(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function parseTutorStubCommaSeparatedStrings(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseTutorStubAutoTurns(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (['0', 'none', 'unbounded', 'until-grounded', 'grounded'].includes(raw)) return null;
  return parseTutorStubPositiveInt(value, '--auto-turns');
}
