export function clamp01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.min(1, Math.max(0, Number(value)));
}

export function round3(value) {
  return Number((Number(value) || 0).toFixed(3));
}

export function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export function normalizeBy(value, denominator) {
  if (!Number.isFinite(Number(denominator)) || Number(denominator) <= 0) return 0;
  return clamp01(Number(value || 0) / Number(denominator));
}

export function countWords(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function tokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9_]+/u)
      .filter((token) => token.length > 3),
  );
}

export function tokenOverlap(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / union.size;
}

export function questionCount(lines) {
  return lines.reduce((sum, line) => sum + (String(line.text || '').match(/\?/g) || []).length, 0);
}

export function positiveCueCount(lines) {
  const rx = /\b(good|yes|right|exactly|useful|fair|clear|strong|nice)\b/iu;
  return lines.filter((line) => rx.test(line.text || '')).length;
}

export function lineText(lines) {
  return lines.map((line) => line.text || '').join(' ');
}

export function vectorDelta(dimensions, previousDimensions, keys) {
  return Object.fromEntries(
    keys.map((key) => [key, round3((dimensions[key] || 0) - (previousDimensions?.[key] || 0))]),
  );
}

export function magnitude(vector, keys) {
  return round3(Math.sqrt(keys.reduce((sum, key) => sum + (Number(vector[key]) || 0) ** 2, 0)));
}

export function withDynamics(dimensions, previous, keys) {
  const velocity = previous
    ? vectorDelta(dimensions, previous.dimensions, keys)
    : Object.fromEntries(keys.map((key) => [key, 0]));
  const previousVelocity = previous?.dynamics?.velocity || {};
  const acceleration = previous
    ? vectorDelta(velocity, previousVelocity, keys)
    : Object.fromEntries(keys.map((key) => [key, 0]));
  const speed = magnitude(velocity, keys);
  const accelerationMagnitude = magnitude(acceleration, keys);
  return {
    dimensions,
    dynamics: {
      velocity,
      acceleration,
      speed,
      accelerationMagnitude,
      curvature: speed > 0 ? round3(accelerationMagnitude / Math.max(speed, 0.001)) : 0,
    },
  };
}

export function distanceDelta(turn, trajectory, previousTurn) {
  const current = trajectory?.get?.(turn);
  const previous = previousTurn === null ? null : trajectory?.get?.(previousTurn);
  if (!current || !previous) return 0;
  return Math.max(0, Number(previous.D || 0) - Number(current.D || 0));
}

export function releaseDensity(turn, releasesByTurn, totalPremises) {
  return normalizeBy((releasesByTurn?.get?.(turn) || []).length, Math.max(1, totalPremises));
}

export function learnerMisconceptionPressure(learnerTurn) {
  const count = learnerTurn?.summary?.attractorCounts?.misconception_attractor || 0;
  return normalizeBy(count, Math.max(1, learnerTurn?.summary?.nodeCount || 1));
}

export function learnerHypothesisPressure(learnerTurn) {
  const evidence = learnerTurn?.evidenceNodes || [];
  const hypotheses = evidence.filter((node) => (node.statuses || []).includes('hypothesis')).length;
  return normalizeBy(hypotheses, 3);
}
