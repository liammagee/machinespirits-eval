#!/usr/bin/env node
const Database = require('better-sqlite3');
const db = new Database('data/evaluations.db');

const RUN_ID = 'eval-2026-02-17-25aaae85';

// 1. Extended dimension analysis by cell
const rows = db.prepare(
  'SELECT profile_name, scenario_name, scores_with_reasoning, overall_score FROM evaluation_results WHERE run_id = ? AND overall_score IS NOT NULL'
).all(RUN_ID);

const dims = {};
rows.forEach(r => {
  const s = JSON.parse(r.scores_with_reasoning);
  const cell = r.profile_name.includes('66') ? 'descriptive' : r.profile_name.includes('67') ? 'prescriptive' : 'adversary';
  Object.entries(s).forEach(([dim, val]) => {
    if (!(dim in dims)) dims[dim] = { descriptive: [], prescriptive: [], adversary: [] };
    dims[dim][cell].push(val.score);
  });
});

const avg = arr => arr.length ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2) : 'n/a';

console.log('=== Extended Dimension Means (sorted by pooled, ascending) ===\n');
console.log('Dimension'.padEnd(30) + '| Descript | Prescrip | Adversary | Pooled');
console.log('-'.repeat(30) + '|----------|----------|-----------|-------');

const sorted = Object.entries(dims).sort((a, b) => {
  const poolA = [...a[1].descriptive, ...a[1].prescriptive, ...a[1].adversary];
  const poolB = [...b[1].descriptive, ...b[1].prescriptive, ...b[1].adversary];
  return (poolA.reduce((s, v) => s + v, 0) / poolA.length) - (poolB.reduce((s, v) => s + v, 0) / poolB.length);
});

sorted.forEach(([dim, cells]) => {
  const pool = [...cells.descriptive, ...cells.prescriptive, ...cells.adversary];
  console.log(
    dim.padEnd(30) + '| ' +
    avg(cells.descriptive).padEnd(9) + '| ' +
    avg(cells.prescriptive).padEnd(9) + '| ' +
    avg(cells.adversary).padEnd(10) + '| ' +
    avg(pool)
  );
});

// 2. By scenario
console.log('\n\n=== Dimension Means by Scenario (pooled across cells) ===\n');
const byScenario = {};
rows.forEach(r => {
  const scen = r.scenario_name.includes('Misconception') ? 'misconception' : 'mutual_transform';
  const s = JSON.parse(r.scores_with_reasoning);
  Object.entries(s).forEach(([dim, val]) => {
    const key = dim + '|' + scen;
    if (!(key in byScenario)) byScenario[key] = [];
    byScenario[key].push(val.score);
  });
});

const allDims = [...new Set(Object.keys(byScenario).map(k => k.split('|')[0]))];
console.log('Dimension'.padEnd(30) + '| Misconc  | Mutual T | Delta');
console.log('-'.repeat(30) + '|----------|----------|------');
allDims.sort((a, b) => {
  const ma = byScenario[a + '|misconception'] || [];
  const mb = byScenario[a + '|mutual_transform'] || [];
  return (avg(ma) - avg(mb)) - (avg(byScenario[b + '|misconception'] || []) - avg(byScenario[b + '|mutual_transform'] || []));
}).forEach(dim => {
  const m = byScenario[dim + '|misconception'] || [];
  const t = byScenario[dim + '|mutual_transform'] || [];
  const delta = (parseFloat(avg(m)) - parseFloat(avg(t))).toFixed(2);
  console.log(dim.padEnd(30) + '| ' + avg(m).padEnd(9) + '| ' + avg(t).padEnd(9) + '| ' + delta);
});

// 3. Qualitative reasoning extraction: most common failure patterns
console.log('\n\n=== Failure Pattern Analysis (scores <= 2) ===\n');
const failPatterns = {};
rows.forEach(r => {
  const s = JSON.parse(r.scores_with_reasoning);
  Object.entries(s).forEach(([dim, val]) => {
    if (val.score <= 2) {
      const key = dim;
      if (!(key in failPatterns)) failPatterns[key] = { count: 0, reasons: [] };
      failPatterns[key].count++;
      failPatterns[key].reasons.push(val.reasoning);
    }
  });
});

Object.entries(failPatterns)
  .sort((a, b) => b[1].count - a[1].count)
  .forEach(([dim, data]) => {
    console.log(`${dim}: ${data.count} failures (${(data.count / 90 * 100).toFixed(0)}% of dialogues)`);
    // Extract key phrases
    const phrases = {};
    data.reasons.forEach(r => {
      const lower = r.toLowerCase();
      if (lower.includes('ignor')) phrases['ignores context/history'] = (phrases['ignores context/history'] || 0) + 1;
      if (lower.includes('reset') || lower.includes('turn 0') || lower.includes('turn-0')) phrases['resets to turn 0'] = (phrases['resets to turn 0'] || 0) + 1;
      if (lower.includes('adapt')) phrases['fails to adapt'] = (phrases['fails to adapt'] || 0) + 1;
      if (lower.includes('fabricat') || lower.includes('invent')) phrases['fabricates/invents'] = (phrases['fabricates/invents'] || 0) + 1;
      if (lower.includes('repeat')) phrases['repeats same content'] = (phrases['repeats same content'] || 0) + 1;
      if (lower.includes('reject') || lower.includes('denied') || lower.includes('disavow')) phrases['ignores learner rejection'] = (phrases['ignores learner rejection'] || 0) + 1;
    });
    Object.entries(phrases).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
      console.log(`  - ${p}: ${c}/${data.count}`);
    });
    console.log('  Sample: "' + data.reasons[0].substring(0, 100) + '"');
    console.log('');
  });

// 4. High vs low score qualitative comparison
console.log('\n=== High vs Low Score Comparison ===\n');
const highRows = rows.filter(r => r.overall_score >= 70).sort((a, b) => b.overall_score - a.overall_score);
const lowRows = rows.filter(r => r.overall_score <= 35).sort((a, b) => a.overall_score - b.overall_score);

console.log(`High scorers (>=70): N=${highRows.length}, mean=${avg(highRows.map(r => r.overall_score))}`);
highRows.slice(0, 3).forEach(r => {
  const s = JSON.parse(r.scores_with_reasoning);
  console.log(`  Score ${r.overall_score.toFixed(1)}:`);
  console.log(`    tutor_adaptation: ${s.tutor_adaptation?.score} — "${s.tutor_adaptation?.reasoning}"`);
  console.log(`    mutual_recognition: ${s.mutual_recognition?.score} — "${s.mutual_recognition?.reasoning}"`);
  console.log(`    dialectical: ${s.dialectical_responsiveness?.score} — "${s.dialectical_responsiveness?.reasoning}"`);
});

console.log(`\nLow scorers (<=35): N=${lowRows.length}, mean=${avg(lowRows.map(r => r.overall_score))}`);
lowRows.slice(0, 3).forEach(r => {
  const s = JSON.parse(r.scores_with_reasoning);
  console.log(`  Score ${r.overall_score.toFixed(1)}:`);
  console.log(`    tutor_adaptation: ${s.tutor_adaptation?.score} — "${s.tutor_adaptation?.reasoning}"`);
  console.log(`    mutual_recognition: ${s.mutual_recognition?.score} — "${s.mutual_recognition?.reasoning}"`);
  console.log(`    dialectical: ${s.dialectical_responsiveness?.score} — "${s.dialectical_responsiveness?.reasoning}"`);
});

// 5. Bimodality check
console.log('\n\n=== Score Distribution (bins of 10) ===\n');
const bins = {};
rows.forEach(r => {
  const bin = Math.floor(r.overall_score / 10) * 10;
  bins[bin] = (bins[bin] || 0) + 1;
});
Object.keys(bins).sort((a, b) => a - b).forEach(bin => {
  const bar = '#'.repeat(bins[bin]);
  console.log(`${String(bin).padStart(3)}-${String(Number(bin) + 9).padStart(3)}: ${bar} (${bins[bin]})`);
});

db.close();
