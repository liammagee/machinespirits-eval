#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const runId = process.argv[2] || 'eval-2026-02-03-f5d4dd93';
const logPath = `./logs/eval-progress/${runId}.jsonl`;

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
const events = lines.map(l => JSON.parse(l));
const tests = events.filter(e => e.eventType === 'test_complete' && e.success && e.overallScore != null);

// Group by profile and scenario
const byProfileScenario = {};
for (const t of tests) {
  const key = t.profileName + '|' + t.scenarioId;
  if (!byProfileScenario[key]) byProfileScenario[key] = [];
  byProfileScenario[key].push(t.overallScore);
}

const scenarios = [...new Set(tests.map(t => t.scenarioId))];

// Compare cell_2 vs cell_6 (both single+psycho, but base vs recog)
console.log('=== cell_2 (base+single+psycho) vs cell_6 (recog+single+psycho) ===');
console.log('Scenario'.padEnd(35), 'cell_2', 'cell_6', 'Delta');
console.log('-'.repeat(60));
let total2 = 0, total6 = 0, count = 0;
for (const s of scenarios) {
  const c2 = byProfileScenario['cell_2_base_single_psycho|' + s] || [];
  const c6 = byProfileScenario['cell_6_recog_single_psycho|' + s] || [];
  const avg2 = c2.length ? (c2.reduce((a,b)=>a+b,0)/c2.length) : null;
  const avg6 = c6.length ? (c6.reduce((a,b)=>a+b,0)/c6.length) : null;
  const delta = (avg2 !== null && avg6 !== null) ? (avg2 - avg6) : null;
  console.log(
    s.padEnd(35),
    (avg2 !== null ? avg2.toFixed(1) : 'N/A').padStart(5),
    (avg6 !== null ? avg6.toFixed(1) : 'N/A').padStart(5),
    (delta !== null ? (delta > 0 ? '+' : '') + delta.toFixed(1) : '-').padStart(6)
  );
  if (avg2 !== null && avg6 !== null) {
    total2 += avg2;
    total6 += avg6;
    count++;
  }
}
console.log('-'.repeat(60));
console.log('Average'.padEnd(35), (total2/count).toFixed(1).padStart(5), (total6/count).toFixed(1).padStart(5), ((total2-total6)/count > 0 ? '+' : '') + ((total2-total6)/count).toFixed(1).padStart(5));

// Now compare all base vs all recognition
console.log('\n=== All BASE profiles vs All RECOGNITION profiles ===');
const baseProfiles = ['cell_1_base_single_unified', 'cell_2_base_single_psycho', 'cell_3_base_multi_unified', 'cell_4_base_multi_psycho'];
const recogProfiles = ['cell_5_recog_single_unified', 'cell_6_recog_single_psycho', 'cell_7_recog_multi_unified', 'cell_8_recog_multi_psycho'];

console.log('Scenario'.padEnd(35), 'Base', 'Recog', 'Delta');
console.log('-'.repeat(60));
let totalBase = 0, totalRecog = 0, countScen = 0;
for (const s of scenarios) {
  let baseScores = [], recogScores = [];
  for (const p of baseProfiles) {
    baseScores.push(...(byProfileScenario[p + '|' + s] || []));
  }
  for (const p of recogProfiles) {
    recogScores.push(...(byProfileScenario[p + '|' + s] || []));
  }
  const avgBase = baseScores.length ? baseScores.reduce((a,b)=>a+b,0)/baseScores.length : null;
  const avgRecog = recogScores.length ? recogScores.reduce((a,b)=>a+b,0)/recogScores.length : null;
  const delta = (avgBase !== null && avgRecog !== null) ? (avgRecog - avgBase) : null;
  console.log(
    s.padEnd(35),
    (avgBase !== null ? avgBase.toFixed(1) : 'N/A').padStart(5),
    (avgRecog !== null ? avgRecog.toFixed(1) : 'N/A').padStart(5),
    (delta !== null ? (delta > 0 ? '+' : '') + delta.toFixed(1) : '-').padStart(6)
  );
  if (avgBase !== null && avgRecog !== null) {
    totalBase += avgBase;
    totalRecog += avgRecog;
    countScen++;
  }
}
console.log('-'.repeat(60));
console.log('Average'.padEnd(35), (totalBase/countScen).toFixed(1).padStart(5), (totalRecog/countScen).toFixed(1).padStart(5), ((totalRecog-totalBase)/countScen > 0 ? '+' : '') + ((totalRecog-totalBase)/countScen).toFixed(1).padStart(5));

// Check raw scores for cell_2 to see variance
console.log('\n=== cell_2 raw scores (to check variance) ===');
for (const s of scenarios) {
  const scores = byProfileScenario['cell_2_base_single_psycho|' + s] || [];
  if (scores.length > 0) {
    console.log(s.padEnd(35), scores.join(', '));
  }
}

// Check which scenarios cell_2 wins vs loses
console.log('\n=== Where cell_2 beats cell_6 vs where it loses ===');
let wins = [], losses = [], ties = [];
for (const s of scenarios) {
  const c2 = byProfileScenario['cell_2_base_single_psycho|' + s] || [];
  const c6 = byProfileScenario['cell_6_recog_single_psycho|' + s] || [];
  if (c2.length && c6.length) {
    const avg2 = c2.reduce((a,b)=>a+b,0)/c2.length;
    const avg6 = c6.reduce((a,b)=>a+b,0)/c6.length;
    const delta = avg2 - avg6;
    if (delta > 5) wins.push({ scenario: s, delta });
    else if (delta < -5) losses.push({ scenario: s, delta });
    else ties.push({ scenario: s, delta });
  }
}
console.log('cell_2 WINS (>5 pts):');
wins.sort((a,b) => b.delta - a.delta).forEach(w => console.log(`  ${w.scenario}: +${w.delta.toFixed(1)}`));
console.log('cell_2 LOSES (<-5 pts):');
losses.sort((a,b) => a.delta - b.delta).forEach(l => console.log(`  ${l.scenario}: ${l.delta.toFixed(1)}`));
console.log('TIES (±5 pts):');
ties.forEach(t => console.log(`  ${t.scenario}: ${t.delta > 0 ? '+' : ''}${t.delta.toFixed(1)}`));

// Analyze dialogue files for validation patterns
console.log('\n=== Dialogue Validation Analysis ===');

const dir = 'logs/tutor-dialogues';
const files = fs.readdirSync(dir).filter(f => f.startsWith('dialogue-177008') || f.startsWith('dialogue-177009'));

const forbidden = ['next lecture', 'move on to', 'continue with'];

let results = { budget: [], recognition: [] };

for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const s = d.suggestions?.[0];
    if (s == null) continue;

    const userText = ((s.title || '') + ' ' + (s.message || '')).toLowerCase();
    const fullText = JSON.stringify(d.suggestions).toLowerCase();

    const hasReview = fullText.includes('review');
    const hasForbidden = forbidden.some(fb => userText.includes(fb));

    const profile = d.profileName === 'budget' ? 'budget' : d.profileName === 'recognition' ? 'recognition' : null;
    if (profile) {
      results[profile].push({
        hasReview,
        hasForbidden,
        score: (hasReview ? 50 : 0) + (hasForbidden ? 0 : 50)
      });
    }
  } catch (e) {}
}

for (const profile of ['budget', 'recognition']) {
  const r = results[profile];
  if (r.length === 0) continue;
  const avgScore = r.reduce((a, b) => a + b.score, 0) / r.length;
  const reviewPass = r.filter(x => x.hasReview).length;
  const forbiddenPass = r.filter(x => x.hasForbidden === false).length;
  console.log(profile + ':');
  console.log('  Samples:', r.length);
  console.log('  Review present (required):', reviewPass, '(' + (reviewPass/r.length*100).toFixed(1) + '%)');
  console.log('  Forbidden absent:', forbiddenPass, '(' + (forbiddenPass/r.length*100).toFixed(1) + '%)');
  console.log('  Avg validation score:', avgScore.toFixed(1));
  console.log('');
}
