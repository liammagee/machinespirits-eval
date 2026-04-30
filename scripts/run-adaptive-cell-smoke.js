#!/usr/bin/env node
// End-to-end smoke for the adaptive cell registration.
//
// Exercises runAdaptiveEvaluation against cell_110_langgraph_adaptive
// (loaded from config/tutor-agents.yaml + config/adaptive-trap-scenarios.yaml)
// in an isolated tmp DB. Bypasses eval-cli to keep the smoke scoped to
// the adaptive runner only; eval-cli's dispatch path can be exercised
// manually with:
//   node scripts/eval-cli.js run --profiles cell_110_langgraph_adaptive --runs 1 --dry-run
//
// No paid API calls.

import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-cell-'));
process.env.EVAL_DB_PATH = path.join(tmpDir, 'evaluations.db');
process.env.EVAL_LOGS_DIR = path.join(tmpDir, 'logs');
process.env.ADAPTIVE_TUTOR_LLM = 'mock';
fs.mkdirSync(path.join(process.env.EVAL_LOGS_DIR, 'tutor-dialogues'), { recursive: true });

const evalConfigLoader = await import('../services/evalConfigLoader.js');
const { runAdaptiveEvaluation } = await import('../services/adaptiveTutor/index.js');
const evaluationStore = await import('../services/evaluationStore.js');

const profileName = 'cell_110_langgraph_adaptive';
const evalProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[profileName];
if (!evalProfile) throw new Error(`profile ${profileName} not found in tutor-agents.yaml`);
if (evalProfile.runner !== 'adaptive') throw new Error(`profile ${profileName} not marked runner=adaptive`);

const summary = await runAdaptiveEvaluation({
  profileName,
  evalProfile,
  scenarios: 'all',
  runsPerConfig: 1,
  description: 'cell_110 smoke',
  dryRun: true,
  verbose: true,
});

console.log('\n--- summary ---');
console.log(JSON.stringify(summary, null, 2));

const fails = [];
const rows = evaluationStore.getResults(summary.runId);
if (rows.length === 0) fails.push('no rows persisted');
const expectedScenarioTypes = new Set([
  'false_confusion', 'polite_false_mastery', 'resistance_to_insight',
  'answer_seeking_to_productive_struggle', 'metaphor_boundary_case',
  'affective_shutdown', 'repair_after_misrecognition', 'sophistication_upgrade',
]);
const seenTypes = new Set();
for (const row of rows) {
  if (row.profileName !== profileName) fails.push(`profileName mismatch on ${row.scenarioId}: ${row.profileName}`);
  if (!expectedScenarioTypes.has(row.scenarioType)) fails.push(`unexpected scenarioType on ${row.scenarioId}: ${row.scenarioType}`);
  seenTypes.add(row.scenarioType);
  if (!row.dialogueId) fails.push(`no dialogueId on ${row.scenarioId}`);
  if (!Array.isArray(row.suggestions) || row.suggestions.length === 0) fails.push(`suggestions empty on ${row.scenarioId}`);
}
const missing = [...expectedScenarioTypes].filter((t) => !seenTypes.has(t));
if (missing.length) fails.push(`missing scenario types: ${missing.join(', ')}`);

if (fails.length) {
  console.error('\nCELL SMOKE FAILED:');
  for (const f of fails) console.error('  -', f);
  process.exit(1);
}
console.log(`\nCELL SMOKE PASSED — runId=${summary.runId} rows=${rows.length} (tmp=${tmpDir})`);
