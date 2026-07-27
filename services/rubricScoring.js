/**
 * Shared rubric scale and scoring helpers.
 *
 * Historical rubrics use one 1-5 scale for every dimension. Rubric v3.0 adds
 * a 1-10 pedagogical-quality dimension alongside 1-5 content accuracy. These
 * helpers normalize each dimension independently before weighting, preserving
 * the exact historical calculation when all dimensions share the 1-5 scale.
 */

const DEFAULT_SCALE = Object.freeze({ min: 1, max: 5 });

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function resolveDimensionScale(rubric, dimension = {}) {
  const source = dimension?.scale || rubric?.scale || DEFAULT_SCALE;
  const min = finiteNumber(source.min);
  const max = finiteNumber(source.max);
  if (min == null || max == null || max <= min) {
    throw new Error(`Invalid rubric scale: min=${source.min}, max=${source.max}`);
  }
  return { min, max, labels: source.labels || rubric?.scale?.labels || {} };
}

export function normalizeDimensionScore(value, rubric, dimension = {}) {
  const score = finiteNumber(value);
  if (score == null) return null;
  const scale = resolveDimensionScale(rubric, dimension);
  if (score < scale.min || score > scale.max) return null;
  return ((score - scale.min) / (scale.max - scale.min)) * 100;
}

export function calculateWeightedRubricScore(scores, rubric, options = {}) {
  const dimensions = options.dimensions || rubric?.dimensions || {};
  const aliases = options.aliases || {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, dimension] of Object.entries(dimensions)) {
    const alias = aliases[key];
    const entry = scores?.[alias] ?? scores?.[key];
    if (entry && typeof entry === 'object' && entry.not_applicable === true) continue;
    const rawScore = entry && typeof entry === 'object' ? entry.score : entry;
    const normalized = normalizeDimensionScore(rawScore, rubric, dimension);
    const weight = finiteNumber(dimension.weight) || 0;
    if (normalized == null || weight <= 0) continue;
    weightedSum += normalized * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

export function dimensionScaleLabel(rubric, dimension) {
  const { min, max } = resolveDimensionScale(rubric, dimension);
  return `${min}-${max}`;
}

export function buildScaleInstructions(rubric, dimensions = rubric?.dimensions || {}) {
  const entries = Object.entries(dimensions);
  const ranges = new Set(entries.map(([, dimension]) => dimensionScaleLabel(rubric, dimension)));

  if (ranges.size === 1) {
    const range = [...ranges][0];
    const labels = rubric?.scale?.labels || {};
    const labelLines = Object.entries(labels)
      .map(([score, label]) => `- ${score}: ${label}`)
      .join('\n');
    return `Score each dimension from ${range}:${labelLines ? `\n${labelLines}` : ''}`;
  }

  const lines = entries.map(([key, dimension]) => {
    const scale = resolveDimensionScale(rubric, dimension);
    const name = dimension.name || key.replaceAll('_', ' ');
    const notApplicable = dimension.allow_not_applicable
      ? '; or score=null with not_applicable=true only when no assessable claim exists'
      : '';
    return `- ${name} (${key}): integer ${scale.min}-${scale.max}${notApplicable}`;
  });
  return `Use each dimension's declared scale:\n${lines.join('\n')}`;
}

export function exampleDimensionScore(rubric, dimension, offset = 0) {
  const { min, max } = resolveDimensionScale(rubric, dimension);
  const midpoint = Math.round((min + max) / 2);
  return Math.max(min, Math.min(max, midpoint + offset));
}
