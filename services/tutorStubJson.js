/**
 * Repair only the narrow truncation produced when a model stops after complete
 * JSON values but omits one or two final container delimiters.
 *
 * The function refuses unterminated strings, mismatched delimiters, trailing
 * prose, and larger repairs. Callers still run JSON.parse on the result.
 */
export function closeTruncatedTutorStubJson(rawText, { maxClosers = 2 } = {}) {
  const text = String(rawText || '').trim();
  if (!text || !/^[{[]/u.test(text)) return null;
  const stack = [];
  let inString = false;
  let escaped = false;
  let rootClosed = false;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (rootClosed) {
      if (!/\s/u.test(ch)) return null;
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }
    if (ch === '}' || ch === ']') {
      const expected = ch === '}' ? '{' : '[';
      if (stack.pop() !== expected) return null;
      if (!stack.length) rootClosed = true;
    }
  }

  if (inString || escaped || !stack.length || stack.length > maxClosers) return null;
  const closers = stack
    .reverse()
    .map((ch) => (ch === '{' ? '}' : ']'))
    .join('');
  const repaired = `${text}${closers}`;
  try {
    JSON.parse(repaired);
    return repaired;
  } catch (_) {
    return null;
  }
}

export function normalizeTutorStubAnalysisEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const classification = value.classification;
  if (!classification || typeof classification !== 'object' || Array.isArray(classification)) return value;
  const nestedKeys = [
    ['learner_record', ['learner_record', 'learnerRecord', 'public_record', 'record']],
    ['register_selection', ['register_selection', 'registerSelection', 'tutor_register', 'register']],
  ];
  let normalized = value;
  let normalizedClassification = classification;
  for (const [canonical, aliases] of nestedKeys) {
    if (aliases.some((key) => value[key] !== undefined)) continue;
    const nestedKey = aliases.find((key) => classification[key] !== undefined);
    if (!nestedKey) continue;
    if (normalized === value) normalized = { ...value };
    if (normalizedClassification === classification) normalizedClassification = { ...classification };
    normalized[canonical] = classification[nestedKey];
    delete normalizedClassification[nestedKey];
  }
  if (normalized !== value) normalized.classification = normalizedClassification;
  return normalized;
}
