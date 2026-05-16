export function tokenize(text) {
  return String(text || '').toLowerCase().match(/\b[\w']+\b/g) || [];
}

export function jaccardSimilarity(a, b) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

export function jaccardDistance(a, b) {
  return 1 - jaccardSimilarity(a, b);
}

export function includesAny(text, patterns) {
  const value = String(text || '').toLowerCase();
  return patterns.some((pattern) => value.includes(pattern));
}
