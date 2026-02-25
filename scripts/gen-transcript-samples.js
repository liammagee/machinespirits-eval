#!/usr/bin/env node
/**
 * Generate public + full transcript sample files for a dynamic learner dialogue.
 * Picks the first dynamic learner result from the DB and writes both transcripts.
 *
 * Usage: node scripts/gen-transcript-samples.js [--result-id <id>]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDialogueQualityPrompt } from '../services/rubricEvaluator.js';
import * as store from '../services/evaluationStore.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');
const OUT_DIR = path.resolve(__dirname, '..', 'logs', 'transcript-samples');

// Parse --result-id flag
const resultIdArg = process.argv.indexOf('--result-id');
const specificId = resultIdArg !== -1 ? process.argv[resultIdArg + 1] : null;

// Parse --run-id flag
const runIdArg = process.argv.indexOf('--run-id');
const specificRunId = runIdArg !== -1 ? process.argv[runIdArg + 1] : null;

// Find a dynamic learner result
let result;
if (specificId) {
  // Use raw sqlite to get by id
  const Database = (await import('better-sqlite3')).default;
  const dbPath = path.resolve(__dirname, '..', 'data', 'evaluations.db');
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT * FROM evaluation_results WHERE id = ?').get(specificId);
  db.close();
  if (!row) { console.error(`Result ${specificId} not found`); process.exit(1); }
  result = {
    id: row.id,
    runId: row.run_id,
    configName: row.profile_name,
    scenarioId: row.scenario_id,
    dialogueId: row.dialogue_id,
  };
} else {
  // Pick a dynamic learner result via raw sqlite
  const Database = (await import('better-sqlite3')).default;
  const dbPath = path.resolve(__dirname, '..', 'data', 'evaluations.db');
  const db = new Database(dbPath, { readonly: true });
  let sql = `
    SELECT * FROM evaluation_results
    WHERE dialogue_id IS NOT NULL
      AND (profile_name LIKE '%psycho%' OR profile_name LIKE '%ego_superego%')
  `;
  const params = [];
  if (specificRunId) {
    sql += ' AND run_id = ?';
    params.push(specificRunId);
  }
  sql += ' ORDER BY created_at DESC LIMIT 1';
  const row = db.prepare(sql).get(...params);
  db.close();
  if (!row) { console.error('No dynamic learner results found'); process.exit(1); }
  result = {
    id: row.id,
    runId: row.run_id,
    configName: row.profile_name,
    scenarioId: row.scenario_id,
    dialogueId: row.dialogue_id,
  };
}

console.log(`Result: ${result.id}`);
console.log(`Config: ${result.configName}`);
console.log(`DialogueId: ${result.dialogueId}`);

// Load dialogue log
const logPath = path.join(LOGS_DIR, `${result.dialogueId}.json`);
if (!fs.existsSync(logPath)) {
  console.error(`Dialogue log not found: ${logPath}`);
  process.exit(1);
}
const dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));

// Build conversation history from turnResults
const conversationHistory = dialogueLog.turnResults || [];

// Get dialogue trace
const dialogueTrace = dialogueLog.dialogueTrace || dialogueLog.trace || [];

// Load scenario info
const scenarioId = result.scenarioId;
const scenarioData = evalConfigLoader.loadSuggestionScenarios?.() || {};
const scenario = scenarioData.scenarios?.[scenarioId] || {};

const promptParams = {
  turns: conversationHistory,
  dialogueTrace,
  scenarioName: scenario.name || scenarioId || 'unknown',
  scenarioDescription: scenario.description || '',
  topic: scenario.topic || scenario.name || scenarioId || 'unknown',
  turnCount: conversationHistory.length,
  learnerContext: dialogueLog.learnerContext || null,
};

// Generate both prompts
const publicPrompt = buildDialogueQualityPrompt({ ...promptParams, transcriptMode: 'public' });
const fullPrompt = buildDialogueQualityPrompt({ ...promptParams, transcriptMode: 'full' });

// Write to disk
fs.mkdirSync(OUT_DIR, { recursive: true });
const base = `${result.dialogueId}`;
const pubPath = path.join(OUT_DIR, `${base}-public.txt`);
const fullPath = path.join(OUT_DIR, `${base}-full.txt`);

fs.writeFileSync(pubPath, publicPrompt);
fs.writeFileSync(fullPath, fullPrompt);

console.log(`\nWritten:`);
console.log(`  Public: ${pubPath}`);
console.log(`  Full:   ${fullPath}`);

// Show just the transcript sections for quick review
console.log('\n=== PUBLIC TRANSCRIPT EXCERPT ===');
const pubMatch = publicPrompt.match(/## PUBLIC DIALOGUE TRANSCRIPT[\s\S]*?(?=## YOUR TASK)/);
if (pubMatch) console.log(pubMatch[0].trim().slice(0, 1500));

console.log('\n=== FULL TRANSCRIPT EXCERPT ===');
const fullMatch = fullPrompt.match(/## FULL DIALOGUE TRANSCRIPT[\s\S]*?(?=## YOUR TASK)/);
if (fullMatch) console.log(fullMatch[0].trim().slice(0, 2000));
