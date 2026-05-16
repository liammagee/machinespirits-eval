export function summarizePairedDifferences(differences, { permutations = 10_000 } = {}) {
  const values = differences.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const n = values.length;
  const meanDiff = mean(values);
  const sdDiff = sampleSd(values);
  const se = n > 0 ? Number((sdDiff / Math.sqrt(n)).toFixed(3)) : null;
  const dz = sdDiff > 0 ? meanDiff / sdDiff : null;
  const ci = bootstrapCi(values, { iterations: permutations });
  const p = signFlipPValue(values, { iterations: permutations });
  return {
    n,
    meanDiff,
    sdDiff,
    se,
    cohenDz: dz == null ? null : Number(dz.toFixed(3)),
    bootstrap95Ci: ci,
    permutationP: p,
    winRate: n > 0 ? Number((values.filter((v) => v > 0).length / n).toFixed(3)) : null,
    tieRate: n > 0 ? Number((values.filter((v) => v === 0).length / n).toFixed(3)) : null,
    lossRate: n > 0 ? Number((values.filter((v) => v < 0).length / n).toFixed(3)) : null,
    nonTrivialPositive: meanDiff != null && ci[0] > 0 && p < 0.05,
  };
}

export function summarizeValues(values, { permutations = 10_000 } = {}) {
  const numeric = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const n = numeric.length;
  const sd = sampleSd(numeric);
  return {
    n,
    mean: mean(numeric),
    sd,
    se: n > 0 ? Number((sd / Math.sqrt(n)).toFixed(3)) : null,
    bootstrap95Ci: bootstrapCi(numeric, { iterations: permutations }),
  };
}

export function pairedMetricDifferences(reports, {
  baselineCondition,
  targetCondition,
  metric,
} = {}) {
  const rows = [];
  for (const report of reports) {
    for (const scenario of report.results || []) {
      const baseline = scenario.conditions?.[baselineCondition];
      const target = scenario.conditions?.[targetCondition];
      if (!baseline || !target) continue;
      for (const branchName of ['original', 'counterfactual']) {
        const baselineScore = metricValue(baseline[branchName], metric);
        const targetScore = metricValue(target[branchName], metric);
        if (typeof baselineScore !== 'number' || typeof targetScore !== 'number') continue;
        rows.push({
          repeat: report.repeat ?? null,
          scenarioId: scenario.scenarioId,
          discipline: scenario.discipline,
          branchName,
          baselineCondition,
          targetCondition,
          metric,
          baselineScore,
          targetScore,
          diff: Number((targetScore - baselineScore).toFixed(3)),
        });
      }
    }
  }
  return rows;
}

export function conditionMetricValues(reports, {
  condition,
  metric,
} = {}) {
  const rows = [];
  for (const report of reports) {
    for (const scenario of report.results || []) {
      const conditionResult = scenario.conditions?.[condition];
      if (!conditionResult) continue;
      for (const branchName of ['original', 'counterfactual']) {
        const score = metricValue(conditionResult[branchName], metric);
        if (typeof score !== 'number') continue;
        rows.push({
          repeat: report.repeat ?? null,
          scenarioId: scenario.scenarioId,
          discipline: scenario.discipline,
          branchName,
          condition,
          metric,
          score,
        });
      }
    }
  }
  return rows;
}

export function metricValue(branch, metric) {
  if (metric === 'mvp') return branch?.blindJudge?.weighted_score;
  if (metric === 'parent_dialogue') return branch?.parentDialogueJudge?.weighted_score;
  if (metric === 'deliberation') return branch?.reflexiveDeliberationJudge?.weighted_score;
  if (metric === 'psychodynamic') return branch?.psychodynamicAdaptationJudge?.weighted_score;
  if (metric === 'outcome') return branch?.outcomeTask?.success ? 100 : 0;
  return null;
}

function mean(values) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function sampleSd(values) {
  if (values.length < 2) return 0;
  const m = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - m) ** 2), 0) / (values.length - 1);
  return Number(Math.sqrt(variance).toFixed(3));
}

function bootstrapCi(values, { iterations }) {
  if (values.length === 0) return [null, null];
  if (values.length === 1) return [values[0], values[0]];
  const means = [];
  for (let i = 0; i < iterations; i++) {
    let total = 0;
    for (let j = 0; j < values.length; j++) {
      total += values[Math.floor(Math.random() * values.length)];
    }
    means.push(total / values.length);
  }
  means.sort((a, b) => a - b);
  return [
    Number(quantileSorted(means, 0.025).toFixed(3)),
    Number(quantileSorted(means, 0.975).toFixed(3)),
  ];
}

function signFlipPValue(values, { iterations }) {
  if (values.length === 0) return null;
  const observed = Math.abs(values.reduce((sum, value) => sum + value, 0) / values.length);
  if (observed === 0) return 1;
  const exactN = values.length <= 18 ? 2 ** values.length : null;
  let extreme = 0;
  const total = exactN || iterations;

  for (let i = 0; i < total; i++) {
    let sum = 0;
    for (let j = 0; j < values.length; j++) {
      const sign = exactN
        ? ((i >> j) & 1 ? 1 : -1)
        : (Math.random() < 0.5 ? 1 : -1);
      sum += values[j] * sign;
    }
    if (Math.abs(sum / values.length) >= observed) extreme += 1;
  }

  return Number(((extreme + 1) / (total + 1)).toFixed(4));
}

function quantileSorted(values, q) {
  const pos = (values.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (values[base + 1] === undefined) return values[base];
  return values[base] + rest * (values[base + 1] - values[base]);
}
