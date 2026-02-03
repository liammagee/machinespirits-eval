#!/usr/bin/env node
import fs from 'fs';

function getScores(runId, scenario) {
  const logPath = `./logs/eval-progress/${runId}.jsonl`;
  const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
  const events = lines.map(l => JSON.parse(l));
  const successful = events.filter(e =>
    e.eventType === 'test_complete' &&
    e.success === true &&
    e.overallScore != null &&
    e.scenarioId === scenario
  );

  const byProfile = {};
  for (const r of successful) {
    if (!byProfile[r.profileName]) byProfile[r.profileName] = [];
    byProfile[r.profileName].push(r.overallScore);
  }
  return byProfile;
}

const run1 = process.argv[2] || 'eval-2026-02-03-f5d4dd93';
const run2 = process.argv[3] || 'eval-2026-02-03-b391d999';

const scenarios = ['mood_frustration_to_breakthrough', 'misconception_correction_flow', 'mutual_transformation_journey'];

for (const scenario of scenarios) {
  console.log(`=== ${scenario} ===`);
  const s1 = getScores(run1, scenario);
  const s2 = getScores(run2, scenario);

  const profiles = ['cell_1_base_single_unified', 'cell_3_base_multi_unified', 'cell_5_recog_single_unified', 'cell_7_recog_multi_unified'];

  for (const p of profiles) {
    const scores1 = s1[p] || [];
    const scores2 = s2[p] || [];
    const avg1 = scores1.length > 0 ? (scores1.reduce((a, b) => a + b, 0) / scores1.length).toFixed(1) : 'N/A';
    const avg2 = scores2.length > 0 ? (scores2.reduce((a, b) => a + b, 0) / scores2.length).toFixed(1) : 'N/A';
    const shortP = p.replace('cell_', '').replace('_single_unified', '').replace('_multi_unified', '_m');
    console.log(`  ${shortP.padEnd(12)} ${run1.slice(-8)}=${avg1.padStart(5)} (${scores1.join(',').padEnd(20)})  ${run2.slice(-8)}=${avg2.padStart(5)} (${scores2.join(',')})`);
  }
  console.log('');
}
