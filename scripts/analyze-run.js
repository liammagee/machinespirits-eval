#!/usr/bin/env node
import fs from 'fs';

const runId = process.argv[2] || 'eval-2026-02-03-c8d32121';
const logPath = `./logs/eval-progress/${runId}.jsonl`;

if (!fs.existsSync(logPath)) {
  console.error('Log file not found:', logPath);
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
const events = lines.map(l => JSON.parse(l));

// Filter to successful test_complete events
const successful = events.filter(e =>
  e.eventType === 'test_complete' &&
  e.success === true &&
  e.overallScore != null
);

console.log('Run:', runId);
console.log('Total successful results:', successful.length);
console.log('');

// Group by profile
const byProfile = {};
for (const r of successful) {
  const profile = r.profileName;
  if (!byProfile[profile]) byProfile[profile] = [];
  byProfile[profile].push(r.overallScore);
}

console.log('By Profile (avg score):');
for (const [profile, scores] of Object.entries(byProfile).sort((a,b) => {
  const avgA = a[1].reduce((s,v) => s+v, 0) / a[1].length;
  const avgB = b[1].reduce((s,v) => s+v, 0) / b[1].length;
  return avgB - avgA;
})) {
  const avg = scores.reduce((s,v) => s+v, 0) / scores.length;
  console.log(`  ${profile}: ${avg.toFixed(1)} (n=${scores.length})`);
}

// Factor analysis
const factors = {
  'Factor A (recognition)': { on: [], off: [] },
  'Factor B (tutor arch)': { multi: [], single: [] },
  'Factor C (learner arch)': { psycho: [], unified: [] }
};

for (const r of successful) {
  const profile = r.profileName;
  const score = r.overallScore;

  // Factor A: Recognition (cells 5-8 = on, cells 1-4 = off)
  if (profile.includes('recog')) factors['Factor A (recognition)'].on.push(score);
  else factors['Factor A (recognition)'].off.push(score);

  // Factor B: Tutor arch (cells 3,4,7,8 = multi, cells 1,2,5,6 = single)
  if (profile.includes('multi')) factors['Factor B (tutor arch)'].multi.push(score);
  else factors['Factor B (tutor arch)'].single.push(score);

  // Factor C: Learner arch (cells 2,4,6,8 = psycho, cells 1,3,5,7 = unified)
  if (profile.includes('psycho')) factors['Factor C (learner arch)'].psycho.push(score);
  else factors['Factor C (learner arch)'].unified.push(score);
}

console.log('');
console.log('Factor Analysis:');
for (const [factor, levels] of Object.entries(factors)) {
  const level1 = Object.keys(levels)[0];
  const level2 = Object.keys(levels)[1];
  const n1 = levels[level1].length;
  const n2 = levels[level2].length;
  if (n1 === 0 || n2 === 0) continue;
  const avg1 = levels[level1].reduce((s,v) => s+v, 0) / n1;
  const avg2 = levels[level2].reduce((s,v) => s+v, 0) / n2;
  const delta = avg1 - avg2;
  console.log(`  ${factor}:`);
  console.log(`    ${level1}: ${avg1.toFixed(1)} (n=${n1})`);
  console.log(`    ${level2}: ${avg2.toFixed(1)} (n=${n2})`);
  console.log(`    Delta: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`);
}

// Group by scenario
console.log('');
console.log('By Scenario:');
const byScenario = {};
for (const r of successful) {
  const scenario = r.scenarioId;
  if (!byScenario[scenario]) byScenario[scenario] = [];
  byScenario[scenario].push({ profile: r.profileName, score: r.overallScore });
}
for (const [scenario, data] of Object.entries(byScenario)) {
  const avg = data.reduce((s,d) => s + d.score, 0) / data.length;
  console.log(`  ${scenario}: avg=${avg.toFixed(1)} (n=${data.length})`);
}
