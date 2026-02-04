#!/usr/bin/env node
import fs from 'fs';

const runId = 'eval-2026-02-03-f5d4dd93';
const logPath = `./logs/eval-progress/${runId}.jsonl`;

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
const events = lines.map(l => JSON.parse(l));

// Find test_complete events for struggling_learner
const strugglingTests = events.filter(e =>
  e.eventType === 'test_complete' &&
  e.scenarioId === 'struggling_learner' &&
  e.success
);

console.log(`=== STRUGGLING_LEARNER Scenario Analysis ===`);
console.log(`Total test completions: ${strugglingTests.length}\n`);

// Group by profile
const byProfile = {};
for (const t of strugglingTests) {
  if (!byProfile[t.profileName]) byProfile[t.profileName] = [];
  byProfile[t.profileName].push(t.overallScore);
}

console.log('Scores by profile:');
for (const [profile, scores] of Object.entries(byProfile).sort()) {
  const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
  console.log(`  ${profile}: ${scores.join(', ')} (avg: ${avg.toFixed(1)})`);
}

// Now look at concept_confusion
const confusionTests = events.filter(e =>
  e.eventType === 'test_complete' &&
  e.scenarioId === 'concept_confusion' &&
  e.success
);

console.log(`\n=== CONCEPT_CONFUSION Scenario Analysis ===`);
console.log(`Total test completions: ${confusionTests.length}\n`);

const byProfile2 = {};
for (const t of confusionTests) {
  if (!byProfile2[t.profileName]) byProfile2[t.profileName] = [];
  byProfile2[t.profileName].push(t.overallScore);
}

console.log('Scores by profile:');
for (const [profile, scores] of Object.entries(byProfile2).sort()) {
  const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
  console.log(`  ${profile}: ${scores.join(', ')} (avg: ${avg.toFixed(1)})`);
}

// Now let's look at the validation rules for these scenarios
console.log('\n=== Validation Rules ===');
console.log('Loading validation rules from scenarios...');

// Read the scenario files to get the validation rules
const scenarioPath = './config/scenarios.yaml';
try {
  const scenarioYaml = fs.readFileSync(scenarioPath, 'utf8');
  // Simple extraction of struggling_learner validation rules
  const strugglingMatch = scenarioYaml.match(/struggling_learner:[\s\S]*?validation:[\s\S]*?required_elements:[\s\S]*?\[(.*?)\][\s\S]*?forbidden_elements:[\s\S]*?\[(.*?)\]/);
  if (strugglingMatch) {
    console.log('struggling_learner validation rules:');
    console.log('  required:', strugglingMatch[1]);
    console.log('  forbidden:', strugglingMatch[2]);
  }
} catch (e) {
  console.log('Could not load scenarios.yaml');
}

// Now analyze all scenarios to find the pattern
console.log('\n=== Score Distribution Analysis ===');
const allTests = events.filter(e => e.eventType === 'test_complete' && e.success && e.overallScore != null);

// Compare scores between base and recognition profiles
const baseProfiles = ['cell_1_base_single_unified', 'cell_2_base_single_psycho', 'cell_3_base_multi_unified', 'cell_4_base_multi_psycho'];
const recogProfiles = ['cell_5_recog_single_unified', 'cell_6_recog_single_psycho', 'cell_7_recog_multi_unified', 'cell_8_recog_multi_psycho'];

// Count 50s and 100s for each profile type
let baseFifties = 0, baseHundreds = 0, baseTotal = 0;
let recogFifties = 0, recogHundreds = 0, recogTotal = 0;

for (const t of allTests) {
  if (baseProfiles.includes(t.profileName)) {
    baseTotal++;
    if (t.overallScore === 50) baseFifties++;
    else if (t.overallScore === 100) baseHundreds++;
  } else if (recogProfiles.includes(t.profileName)) {
    recogTotal++;
    if (t.overallScore === 50) recogFifties++;
    else if (t.overallScore === 100) recogHundreds++;
  }
}

console.log('Base profiles:');
console.log(`  Total tests: ${baseTotal}`);
console.log(`  Score 100 (full pass): ${baseHundreds} (${(baseHundreds/baseTotal*100).toFixed(1)}%)`);
console.log(`  Score 50 (partial): ${baseFifties} (${(baseFifties/baseTotal*100).toFixed(1)}%)`);

console.log('\nRecognition profiles:');
console.log(`  Total tests: ${recogTotal}`);
console.log(`  Score 100 (full pass): ${recogHundreds} (${(recogHundreds/recogTotal*100).toFixed(1)}%)`);
console.log(`  Score 50 (partial): ${recogFifties} (${(recogFifties/recogTotal*100).toFixed(1)}%)`);

// Now by scenario - which have validation rules that recognition fails more often?
console.log('\n=== Per-Scenario Validation Pass Rates ===');
const scenarios = [...new Set(allTests.map(t => t.scenarioId))];

const results = [];
for (const s of scenarios) {
  const baseTests = allTests.filter(t => baseProfiles.includes(t.profileName) && t.scenarioId === s);
  const recogTests = allTests.filter(t => recogProfiles.includes(t.profileName) && t.scenarioId === s);

  const basePassRate = baseTests.filter(t => t.overallScore === 100).length / baseTests.length;
  const recogPassRate = recogTests.filter(t => t.overallScore === 100).length / recogTests.length;

  results.push({
    scenario: s,
    basePassRate,
    recogPassRate,
    delta: basePassRate - recogPassRate,
    baseTests: baseTests.length,
    recogTests: recogTests.length
  });
}

results.sort((a, b) => b.delta - a.delta);

console.log('Scenario'.padEnd(45), 'Base%', 'Recog%', 'Delta');
console.log('-'.repeat(70));
for (const r of results) {
  console.log(
    r.scenario.padEnd(45),
    (r.basePassRate * 100).toFixed(0).padStart(4) + '%',
    (r.recogPassRate * 100).toFixed(0).padStart(5) + '%',
    ((r.delta > 0 ? '+' : '') + (r.delta * 100).toFixed(0) + '%').padStart(7)
  );
}
