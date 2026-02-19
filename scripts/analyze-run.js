/**
 * Detailed statistical analysis of an evaluation run.
 * Usage: node scripts/analyze-run.mjs [run_id]
 */
import Database from 'better-sqlite3';
const db = new Database('data/evaluations.db');

const RUN_ID = process.argv[2] || db.prepare(
  'SELECT run_id FROM evaluation_results ORDER BY created_at DESC LIMIT 1'
).get()?.run_id;

if (!RUN_ID) { console.error('No run found'); process.exit(1); }
console.log(`Analyzing run: ${RUN_ID}\n`);

// ============================================================
// Helper functions
// ============================================================
function std(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function cohensD(group1, group2) {
  const m1 = group1.reduce((a, b) => a + b, 0) / group1.length;
  const m2 = group2.reduce((a, b) => a + b, 0) / group2.length;
  const s1 = std(group1);
  const s2 = std(group2);
  const pooled = Math.sqrt(((group1.length - 1) * s1 ** 2 + (group2.length - 1) * s2 ** 2) / (group1.length + group2.length - 2));
  return pooled === 0 ? 0 : (m1 - m2) / pooled;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ============================================================
// 1. Summary statistics
// ============================================================
const allScores = db.prepare(`
  SELECT overall_score FROM evaluation_results
  WHERE run_id = ? AND overall_score IS NOT NULL
`).all(RUN_ID).map(r => r.overall_score);

const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
const sd = std(allScores);
const median = percentile(allScores, 50);
const q1 = percentile(allScores, 25);
const q3 = percentile(allScores, 75);

console.log('=== DESCRIPTIVE STATISTICS ===');
console.log(`N = ${allScores.length}`);
console.log(`Mean: ${mean.toFixed(1)} (SD: ${sd.toFixed(1)})`);
console.log(`Median: ${median.toFixed(1)} (IQR: ${q1.toFixed(1)} – ${q3.toFixed(1)})`);
console.log(`Range: ${Math.min(...allScores).toFixed(1)} – ${Math.max(...allScores).toFixed(1)}`);

// ============================================================
// 2. Per-model statistics
// ============================================================
console.log('\n=== PER-MODEL STATISTICS ===');
const models = db.prepare(`
  SELECT DISTINCT model FROM evaluation_results
  WHERE run_id = ? AND overall_score IS NOT NULL
`).all(RUN_ID).map(r => r.model);

const modelData = {};
for (const m of models) {
  const scores = db.prepare(`
    SELECT overall_score FROM evaluation_results
    WHERE run_id = ? AND model = ? AND overall_score IS NOT NULL
  `).all(RUN_ID, m).map(r => r.overall_score);
  modelData[m] = scores;
  const mn = scores.reduce((a, b) => a + b, 0) / scores.length;
  const s = std(scores);
  console.log(`${m}: M=${mn.toFixed(1)}, SD=${s.toFixed(1)}, N=${scores.length}, Range=[${Math.min(...scores).toFixed(1)}, ${Math.max(...scores).toFixed(1)}]`);
}

// ============================================================
// 3. Pairwise effect sizes between models
// ============================================================
console.log('\n=== PAIRWISE EFFECT SIZES (Cohen\'s d) ===');
const modelNames = Object.keys(modelData).filter(m => modelData[m].length >= 3);
for (let i = 0; i < modelNames.length; i++) {
  for (let j = i + 1; j < modelNames.length; j++) {
    const d = cohensD(modelData[modelNames[i]], modelData[modelNames[j]]);
    const label = d > 0.8 ? 'large' : d > 0.5 ? 'medium' : d > 0.2 ? 'small' : 'negligible';
    console.log(`${modelNames[i]} vs ${modelNames[j]}: d=${d.toFixed(2)} (${label})`);
  }
}

// ============================================================
// 4. Per-dimension statistics
// ============================================================
console.log('\n=== DIMENSION STATISTICS ===');
const dims = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'];
const _dimCols = dims.map(d => `score_${d}`);

for (const dim of dims) {
  const col = `score_${dim}`;
  const vals = db.prepare(`
    SELECT ${col} as v FROM evaluation_results
    WHERE run_id = ? AND ${col} IS NOT NULL
  `).all(RUN_ID).map(r => r.v);
  if (vals.length === 0) continue;
  const mn = vals.reduce((a, b) => a + b, 0) / vals.length;
  const s = std(vals);
  console.log(`${dim.padEnd(20)} M=${mn.toFixed(2)}, SD=${s.toFixed(2)}, N=${vals.length}`);
}

// ============================================================
// 5. Per-dimension per-model
// ============================================================
console.log('\n=== DIMENSION × MODEL BREAKDOWN ===');
const header = 'Model'.padEnd(25) + dims.map(d => d.substring(0, 8).padStart(9)).join('');
console.log(header);
for (const m of modelNames) {
  let line = m.padEnd(25);
  for (const dim of dims) {
    const col = `score_${dim}`;
    const val = db.prepare(`
      SELECT AVG(${col}) as v FROM evaluation_results
      WHERE run_id = ? AND model = ? AND ${col} IS NOT NULL
    `).get(RUN_ID, m);
    line += (val?.v?.toFixed(2) || 'N/A').padStart(9);
  }
  console.log(line);
}

// ============================================================
// 6. Scenario difficulty ranking
// ============================================================
console.log('\n=== SCENARIO DIFFICULTY RANKING (hardest → easiest) ===');
const scenarioStats = db.prepare(`
  SELECT scenario_id,
    AVG(overall_score) as mean,
    COUNT(*) as n
  FROM evaluation_results
  WHERE run_id = ? AND overall_score IS NOT NULL
  GROUP BY scenario_id
  ORDER BY mean ASC
`).all(RUN_ID);

for (const s of scenarioStats) {
  const scores = db.prepare(`
    SELECT overall_score FROM evaluation_results
    WHERE run_id = ? AND scenario_id = ? AND overall_score IS NOT NULL
  `).all(RUN_ID, s.scenario_id).map(r => r.overall_score);
  const s_sd = std(scores);
  const bar = '█'.repeat(Math.round(s.mean / 5));
  console.log(`${s.scenario_id.padEnd(40)} ${s.mean.toFixed(1).padStart(5)} (SD=${s_sd.toFixed(1).padStart(5)}) ${bar}`);
}

// ============================================================
// 7. Inter-model agreement (scenario-level correlation)
// ============================================================
console.log('\n=== INTER-MODEL AGREEMENT ===');
const scenarios = db.prepare(`
  SELECT DISTINCT scenario_id FROM evaluation_results
  WHERE run_id = ? AND overall_score IS NOT NULL
`).all(RUN_ID).map(r => r.scenario_id);

// Check if models rank scenarios similarly
for (let i = 0; i < modelNames.length; i++) {
  for (let j = i + 1; j < modelNames.length; j++) {
    const pairs = [];
    for (const s of scenarios) {
      const s1 = db.prepare(`SELECT overall_score FROM evaluation_results WHERE run_id = ? AND model = ? AND scenario_id = ? AND overall_score IS NOT NULL`).get(RUN_ID, modelNames[i], s);
      const s2 = db.prepare(`SELECT overall_score FROM evaluation_results WHERE run_id = ? AND model = ? AND scenario_id = ? AND overall_score IS NOT NULL`).get(RUN_ID, modelNames[j], s);
      if (s1 && s2) pairs.push([s1.overall_score, s2.overall_score]);
    }
    if (pairs.length >= 3) {
      // Spearman rank correlation
      const ranked = pairs.map(([a, b], idx) => ({ a, b, idx }));
      ranked.sort((x, y) => x.a - y.a);
      ranked.forEach((r, i) => r.rankA = i + 1);
      ranked.sort((x, y) => x.b - y.b);
      ranked.forEach((r, i) => r.rankB = i + 1);
      const n = ranked.length;
      const dSquared = ranked.reduce((sum, r) => sum + (r.rankA - r.rankB) ** 2, 0);
      const rho = 1 - (6 * dSquared) / (n * (n * n - 1));
      const agreement = rho > 0.7 ? 'strong' : rho > 0.4 ? 'moderate' : rho > 0 ? 'weak' : 'none';
      console.log(`${modelNames[i]} vs ${modelNames[j]}: Spearman ρ=${rho.toFixed(2)} (${agreement} agreement, N=${n})`);
    }
  }
}

// ============================================================
// 8. Base vs Recognition score analysis
// ============================================================
console.log('\n=== BASE vs RECOGNITION SCORE ANALYSIS ===');
const dualRows = db.prepare(`
  SELECT model, base_score, recognition_score, overall_score
  FROM evaluation_results
  WHERE run_id = ? AND base_score IS NOT NULL AND recognition_score IS NOT NULL
`).all(RUN_ID);

if (dualRows.length > 0) {
  const bases = dualRows.map(r => r.base_score);
  const recogs = dualRows.map(r => r.recognition_score);
  const overalls = dualRows.map(r => r.overall_score);

  console.log(`N (with both scores): ${dualRows.length}`);
  console.log(`Base:        M=${(bases.reduce((a,b)=>a+b,0)/bases.length).toFixed(1)}, SD=${std(bases).toFixed(1)}`);
  console.log(`Recognition: M=${(recogs.reduce((a,b)=>a+b,0)/recogs.length).toFixed(1)}, SD=${std(recogs).toFixed(1)}`);
  console.log(`Overall:     M=${(overalls.reduce((a,b)=>a+b,0)/overalls.length).toFixed(1)}, SD=${std(overalls).toFixed(1)}`);

  const gap = cohensD(bases, recogs);
  console.log(`Base vs Recognition gap: d=${gap.toFixed(2)} (${gap > 0.8 ? 'large' : gap > 0.5 ? 'medium' : 'small'})`);

  // Per-model breakdown
  console.log('\nPer-model dual scores:');
  for (const m of modelNames) {
    const mRows = dualRows.filter(r => r.model === m);
    if (mRows.length === 0) continue;
    const mb = mRows.map(r => r.base_score);
    const mr = mRows.map(r => r.recognition_score);
    console.log(`  ${m}: Base=${(mb.reduce((a,b)=>a+b,0)/mb.length).toFixed(1)}, Recog=${(mr.reduce((a,b)=>a+b,0)/mr.length).toFixed(1)}, Gap=${((mb.reduce((a,b)=>a+b,0)/mb.length) - (mr.reduce((a,b)=>a+b,0)/mr.length)).toFixed(1)}, N=${mRows.length}`);
  }
} else {
  console.log('No results with both base_score and recognition_score');
}

// ============================================================
// 9. Variance decomposition (eta-squared)
// ============================================================
console.log('\n=== VARIANCE DECOMPOSITION ===');
// How much variance is explained by model vs scenario?
const grandMean = mean;
const SSTotal = allScores.reduce((sum, s) => sum + (s - grandMean) ** 2, 0);

// SS between models
let SSModel = 0;
for (const m of modelNames) {
  const mScores = modelData[m];
  const mMean = mScores.reduce((a, b) => a + b, 0) / mScores.length;
  SSModel += mScores.length * (mMean - grandMean) ** 2;
}

// SS between scenarios
let SSScenario = 0;
for (const s of scenarioStats) {
  const sMean = s.mean;
  SSScenario += s.n * (sMean - grandMean) ** 2;
}

const etaModel = SSModel / SSTotal;
const etaScenario = SSScenario / SSTotal;
const etaResidual = 1 - etaModel - etaScenario;

console.log(`Total SS: ${SSTotal.toFixed(1)}`);
console.log(`Model effect (η²):    ${(etaModel * 100).toFixed(1)}% — ${etaModel < 0.01 ? 'negligible' : etaModel < 0.06 ? 'small' : etaModel < 0.14 ? 'medium' : 'large'}`);
console.log(`Scenario effect (η²): ${(etaScenario * 100).toFixed(1)}% — ${etaScenario < 0.01 ? 'negligible' : etaScenario < 0.06 ? 'small' : etaScenario < 0.14 ? 'medium' : 'large'}`);
console.log(`Residual:              ${(etaResidual * 100).toFixed(1)}%`);

// ============================================================
// 10. High-variance scenarios (discriminating power)
// ============================================================
console.log('\n=== SCENARIO DISCRIMINATING POWER (cross-model variance) ===');
const scenarioVariance = [];
for (const s of scenarios) {
  const scores = db.prepare(`
    SELECT overall_score FROM evaluation_results
    WHERE run_id = ? AND scenario_id = ? AND overall_score IS NOT NULL
  `).all(RUN_ID, s).map(r => r.overall_score);
  if (scores.length >= 2) {
    const sv = std(scores);
    scenarioVariance.push({ id: s, sd: sv, range: Math.max(...scores) - Math.min(...scores) });
  }
}
scenarioVariance.sort((a, b) => b.sd - a.sd);
console.log('Scenario'.padEnd(40), 'SD'.padStart(6), 'Range'.padStart(7));
for (const s of scenarioVariance) {
  console.log(s.id.padEnd(40), s.sd.toFixed(1).padStart(6), s.range.toFixed(1).padStart(7));
}

console.log('\n=== ANALYSIS COMPLETE ===');
db.close();
