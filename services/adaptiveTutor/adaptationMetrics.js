export const ADAPTATION_METRICS_VERSION = 'adaptation-metrics.v1.0';

function mean(values) {
  const nums = values.filter((v) => Number.isFinite(Number(v))).map(Number);
  return nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : 0;
}

function brierScore(probabilities = {}, trueLabel) {
  const labels = new Set([...Object.keys(probabilities), trueLabel]);
  if (!labels.size) return 0;
  let sum = 0;
  for (const label of labels) {
    const y = label === trueLabel ? 1 : 0;
    const p = Number(probabilities[label] || 0);
    sum += (p - y) ** 2;
  }
  return sum;
}

function probabilityMap(belief) {
  return Object.fromEntries((belief?.hypotheses || []).map((h) => [h.id, Number(h.probability || 0)]));
}

function topLabels(belief, n = 1) {
  return (belief?.hypotheses || [])
    .slice()
    .sort((a, b) => Number(b.probability || 0) - Number(a.probability || 0))
    .slice(0, n)
    .map((h) => h.id);
}

function averageAxis(rows, axis) {
  return mean(rows.map((row) => row.final_axes?.[axis]));
}

function pairedByScenario(rows, treatment, baseline) {
  const byScenario = new Map();
  for (const row of rows) {
    if (!byScenario.has(row.scenario_id)) byScenario.set(row.scenario_id, {});
    byScenario.get(row.scenario_id)[row.condition] = row;
  }
  return [...byScenario.values()]
    .filter((pair) => pair[treatment] && pair[baseline])
    .map((pair) => [pair[treatment], pair[baseline]]);
}

export function summarizeCondition(rows = [], condition) {
  const subset = rows.filter((row) => row.condition === condition);
  const stateTop1 = subset.map((row) => (topLabels(row.final_belief, 1).includes(row.hidden_state) ? 1 : 0));
  const stateTop2 = subset.map((row) => (topLabels(row.final_belief, 2).includes(row.hidden_state) ? 1 : 0));
  const briers = subset.map((row) => brierScore(probabilityMap(row.final_belief), row.hidden_state));
  const closed = subset.flatMap((row) => row.closed_interventions || []);
  const strict = subset.map((row) => (row.strict_joint_success ? 1 : 0));
  const fit = subset.map((row) => (row.action_state_fit ? 1 : 0));
  const control = subset.flatMap((row) => row.actions || []).map((a) => a.control_cost);
  const mismatch = subset.map((row) => (row.proof_release_mismatch ? 1 : 0));
  const regret = subset.map((row) => row.counterfactual_regret);

  return {
    n: subset.length,
    strictJointSuccess: mean(strict),
    stateTop1Accuracy: mean(stateTop1),
    stateTop2Accuracy: mean(stateTop2),
    stateBrierScore: mean(briers),
    interventionSuccessRate: closed.length ? mean(closed.map((r) => (r.outcome === 'success' ? 1 : 0))) : 0,
    interventionFailureRate: closed.length ? mean(closed.map((r) => (r.outcome === 'failure' ? 1 : 0))) : 0,
    actionStateFitRate: mean(fit),
    tutorControlCost: mean(control),
    proofReleaseMismatchRate: mean(mismatch),
    counterfactualRegret: mean(regret),
    finalProof: averageAxis(subset, 'proof'),
    finalRelease: averageAxis(subset, 'release'),
    finalOwnership: averageAxis(subset, 'ownership'),
  };
}

export function summarizeConditions(rows = [], conditions = []) {
  const out = {};
  for (const condition of conditions) out[condition] = summarizeCondition(rows, condition);
  return out;
}

function deterministicRandom(seed) {
  let x = seed || 123456789;
  return () => {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1000000) / 1000000;
  };
}

export function pairedDifferences(rows = [], treatment = 'closed_loop', baseline = 'legacy') {
  const pairs = pairedByScenario(rows, treatment, baseline);
  const metrics = [
    'strict_joint_success',
    'state_top1',
    'state_brier',
    'intervention_success',
    'proof_release_mismatch',
    'action_state_fit',
    'tutor_control_cost',
    'counterfactual_regret',
    'final_proof',
    'final_release',
    'final_ownership',
  ];
  const access = {
    strict_joint_success: (r) => (r.strict_joint_success ? 1 : 0),
    state_top1: (r) => (topLabels(r.final_belief, 1).includes(r.hidden_state) ? 1 : 0),
    state_brier: (r) => brierScore(probabilityMap(r.final_belief), r.hidden_state),
    intervention_success: (r) => mean((r.closed_interventions || []).map((i) => (i.outcome === 'success' ? 1 : 0))),
    proof_release_mismatch: (r) => (r.proof_release_mismatch ? 1 : 0),
    action_state_fit: (r) => (r.action_state_fit ? 1 : 0),
    tutor_control_cost: (r) => mean((r.actions || []).map((a) => a.control_cost)),
    counterfactual_regret: (r) => Number(r.counterfactual_regret || 0),
    final_proof: (r) => Number(r.final_axes?.proof || 0),
    final_release: (r) => Number(r.final_axes?.release || 0),
    final_ownership: (r) => Number(r.final_axes?.ownership || 0),
  };
  const out = {};
  for (const metric of metrics) {
    const diffs = pairs.map(([t, b]) => access[metric](t) - access[metric](b));
    out[metric] = { n: diffs.length, mean_difference: mean(diffs), diffs };
  }
  return out;
}

export function bootstrapMeanCI(values = [], { iterations = 1000, seed = 20260618, alpha = 0.05 } = {}) {
  const nums = values.filter((v) => Number.isFinite(Number(v))).map(Number);
  if (nums.length === 0) return { mean: 0, lower: 0, upper: 0, n: 0 };
  const rand = deterministicRandom(seed);
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    let sum = 0;
    for (let j = 0; j < nums.length; j += 1) {
      sum += nums[Math.floor(rand() * nums.length)];
    }
    samples.push(sum / nums.length);
  }
  samples.sort((a, b) => a - b);
  const lowerIdx = Math.max(0, Math.floor((alpha / 2) * samples.length));
  const upperIdx = Math.min(samples.length - 1, Math.floor((1 - alpha / 2) * samples.length));
  return { mean: mean(nums), lower: samples[lowerIdx], upper: samples[upperIdx], n: nums.length };
}

export function pairedBootstrapIntervals(rows = [], treatment = 'closed_loop', baseline = 'legacy') {
  const diffs = pairedDifferences(rows, treatment, baseline);
  return Object.fromEntries(
    Object.entries(diffs).map(([metric, row]) => [metric, bootstrapMeanCI(row.diffs, { seed: 20260618 })]),
  );
}

export function metricLabel(metric) {
  return (
    {
      strict_joint_success: 'Strict joint proof/release/ownership success',
      state_top1: 'State top-1 accuracy',
      state_brier: 'State Brier score (lower is better)',
      intervention_success: 'Intervention success rate',
      proof_release_mismatch: 'Proof/release mismatch rate',
      action_state_fit: 'Action-state fit rate',
      tutor_control_cost: 'Tutor control cost',
      counterfactual_regret: 'Counterfactual regret',
      final_proof: 'Final proof',
      final_release: 'Final release',
      final_ownership: 'Final ownership',
    }[metric] || metric
  );
}
