import { calculateWeightedRubricScore } from './rubricScoring.js';

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

export function pearsonCorrelation(left, right) {
  const n = Math.min(left.length, right.length);
  if (n < 3) return null;
  const xMean = mean(left.slice(0, n));
  const yMean = mean(right.slice(0, n));
  let covariance = 0;
  let xVariance = 0;
  let yVariance = 0;
  for (let index = 0; index < n; index += 1) {
    const x = left[index] - xMean;
    const y = right[index] - yMean;
    covariance += x * y;
    xVariance += x * x;
    yVariance += y * y;
  }
  if (xVariance === 0 || yVariance === 0) return null;
  return covariance / Math.sqrt(xVariance * yVariance);
}

function jacobiEigenvalues(matrix) {
  const size = matrix.length;
  if (size === 1) return [matrix[0][0]];
  const working = matrix.map((row) => [...row]);
  for (let iteration = 0; iteration < 200; iteration += 1) {
    let p = 0;
    let q = 1;
    let largest = 0;
    for (let row = 0; row < size; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        if (Math.abs(working[row][column]) > largest) {
          largest = Math.abs(working[row][column]);
          p = row;
          q = column;
        }
      }
    }
    if (largest < 1e-12) break;
    const angle = 0.5 * Math.atan2(2 * working[p][q], working[p][p] - working[q][q]);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (let index = 0; index < size; index += 1) {
      const ip = working[index][p];
      const iq = working[index][q];
      working[index][p] = cosine * ip + sine * iq;
      working[index][q] = -sine * ip + cosine * iq;
    }
    for (let index = 0; index < size; index += 1) {
      const pi = working[p][index];
      const qi = working[q][index];
      working[p][index] = cosine * pi + sine * qi;
      working[q][index] = -sine * pi + cosine * qi;
    }
  }
  return working.map((row, index) => row[index]).sort((a, b) => b - a);
}

function numericScore(entry) {
  if (entry && typeof entry === 'object' && entry.not_applicable === true) return null;
  const raw = entry && typeof entry === 'object' ? entry.score : entry;
  const score = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof score === 'number' && Number.isFinite(score) ? score : null;
}

export function extractScoreVectors(payload, dimensionKeys) {
  if (!payload || typeof payload !== 'object') return [];
  const entries = Object.entries(payload);
  const isTurnKeyed = entries.some(([key, value]) => /^\d+$/u.test(key) && value?.scores);
  const candidates = isTurnKeyed
    ? entries
        .filter(([key, value]) => /^\d+$/u.test(key) && value?.scores)
        .map(([key, value]) => ({ observationKey: key, scores: value.scores }))
    : [{ observationKey: 'holistic', scores: payload.scores || payload }];

  return candidates.map(({ observationKey, scores }) => ({
    observationKey,
    scores: Object.fromEntries(dimensionKeys.map((key) => [key, numericScore(scores?.[key])])),
  }));
}

function correlationSummary(complete, dimensionKeys) {
  if (dimensionKeys.length < 2 || complete.length < 3) return null;
  const matrix = dimensionKeys.map((left) =>
    dimensionKeys.map((right) => {
      if (left === right) return 1;
      return pearsonCorrelation(
        complete.map((observation) => observation.scores[left]),
        complete.map((observation) => observation.scores[right]),
      );
    }),
  );
  if (matrix.some((row) => row.some((value) => value == null))) return null;
  const offDiagonal = [];
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = row + 1; column < matrix.length; column += 1) {
      offDiagonal.push(matrix[row][column]);
    }
  }
  const eigenvalues = jacobiEigenvalues(matrix);
  return {
    matrix,
    mean_absolute_interdimension_correlation: mean(offDiagonal.map(Math.abs)),
    pc1_share: eigenvalues[0] / eigenvalues.reduce((sum, value) => sum + value, 0),
    eigenvalues,
    kaiser_count: eigenvalues.filter((value) => value > 1).length,
  };
}

function crossJudgeSummary(complete, rubric) {
  const groups = new Map();
  for (const observation of complete) {
    if (!observation.itemKey || !observation.judge) continue;
    const key = `${observation.itemKey}:${observation.observationKey}`;
    if (!groups.has(key)) groups.set(key, new Map());
    const aggregate = calculateWeightedRubricScore(observation.scores, rubric);
    if (aggregate != null) groups.get(key).set(observation.judge, aggregate);
  }

  const pairs = [];
  for (const [itemKey, byJudge] of groups) {
    const judges = [...byJudge.keys()].sort();
    for (let leftIndex = 0; leftIndex < judges.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < judges.length; rightIndex += 1) {
        pairs.push({
          itemKey,
          leftJudge: judges[leftIndex],
          rightJudge: judges[rightIndex],
          left: byJudge.get(judges[leftIndex]),
          right: byJudge.get(judges[rightIndex]),
        });
      }
    }
  }
  if (!pairs.length) return { n_pairs: 0, pearson_r: null, mean_absolute_error: null };
  return {
    n_pairs: pairs.length,
    pearson_r: pearsonCorrelation(
      pairs.map((pair) => pair.left),
      pairs.map((pair) => pair.right),
    ),
    mean_absolute_error: mean(pairs.map((pair) => Math.abs(pair.left - pair.right))),
  };
}

export function analyzeRubricInstrument(observations, rubric) {
  const dimensions = rubric?.dimensions || {};
  const dimensionKeys = Object.keys(dimensions);
  const complete = observations.filter((observation) =>
    dimensionKeys.every((key) => numericScore(observation.scores?.[key]) != null),
  );
  const perDimension = {};
  for (const key of dimensionKeys) {
    const values = observations
      .map((observation) => numericScore(observation.scores?.[key]))
      .filter((value) => value != null);
    const scale = dimensions[key].scale || rubric.scale || { min: 1, max: 5 };
    perDimension[key] = {
      n: values.length,
      mean: mean(values),
      standard_deviation: standardDeviation(values),
      observed_min: values.length ? Math.min(...values) : null,
      observed_max: values.length ? Math.max(...values) : null,
      floor_rate: values.length ? values.filter((value) => value === scale.min).length / values.length : null,
      ceiling_rate: values.length ? values.filter((value) => value === scale.max).length / values.length : null,
    };
  }

  return {
    rubric_version: rubric?.version || null,
    observations_total: observations.length,
    observations_complete: complete.length,
    dimensions: perDimension,
    factor_structure: correlationSummary(complete, dimensionKeys),
    coverage: {
      scenarios: new Set(observations.map((item) => item.scenario).filter(Boolean)).size,
      candidate_generators: new Set(observations.map((item) => item.generator).filter(Boolean)).size,
      profiles: new Set(observations.map((item) => item.profile).filter(Boolean)).size,
      judges: new Set(observations.map((item) => item.judge).filter(Boolean)).size,
    },
    cross_judge: crossJudgeSummary(observations, rubric),
  };
}
