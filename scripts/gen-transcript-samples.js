#!/usr/bin/env node
/**
 * Generate public + full transcript sample files for dialogue(s).
 *
 * Usage:
 *   node scripts/gen-transcript-samples.js --result-id <id>
 *   node scripts/gen-transcript-samples.js --run-id <runId>
 *   node scripts/gen-transcript-samples.js                    # picks latest dynamic learner result
 *
 * Options:
 *   --result-id <id>     Generate for a specific DB result ID
 *   --run-id <runId>     Generate for all dialogue results in a run
 *   --out-dir <path>     Output directory (default: logs/transcript-samples)
 *   --prefix <text>      Filename prefix (e.g. "cell1-base" → cell1-base-public.txt)
 *   --allow-model-mix    Bypass canonical factorial tutor-ego model consistency check
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDialogueQualityPrompt } from '../services/rubricEvaluator.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', 'logs', 'tutor-dialogues');
const DEFAULT_OUT_DIR = path.resolve(__dirname, '..', 'logs', 'transcript-samples');
const FACTORIAL_2X2X2_PROFILE_SET = new Set([
  'cell_1_base_single_unified',
  'cell_2_base_single_psycho',
  'cell_3_base_multi_unified',
  'cell_4_base_multi_psycho',
  'cell_5_recog_single_unified',
  'cell_6_recog_single_psycho',
  'cell_7_recog_multi_unified',
  'cell_8_recog_multi_psycho',
]);

// ── Parse args ──────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { resultId: null, runId: null, outDir: null, prefix: null, allowModelMix: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--result-id': opts.resultId = args[++i]; break;
      case '--run-id': opts.runId = args[++i]; break;
      case '--out-dir': opts.outDir = args[++i]; break;
      case '--prefix': opts.prefix = args[++i]; break;
      case '--allow-model-mix': opts.allowModelMix = true; break;
      default: console.error(`Unknown option: ${args[i]}`); process.exit(1);
    }
  }
  return opts;
}

// ── DB helpers ──────────────────────────────────────────────────────────────

async function openDb() {
  const Database = (await import('better-sqlite3')).default;
  const dbPath = path.resolve(__dirname, '..', 'data', 'evaluations.db');
  return new Database(dbPath, { readonly: true });
}

function rowToResult(row) {
  return {
    id: row.id,
    runId: row.run_id,
    profileName: row.profile_name,
    scenarioId: row.scenario_id,
    dialogueId: row.dialogue_id,
    model: row.model,
    egoModel: row.ego_model,
    superegoModel: row.superego_model,
    judgeModel: row.judge_model,
    tutorFirstTurnScore: row.tutor_first_turn_score,
    holisticScore: row.holistic_overall_score,
    createdAt: row.created_at,
  };
}

function validateCanonicalTutorEgoModelConsistency(results, { allowModelMix = false } = {}) {
  if (allowModelMix) {
    return { ok: true, skipped: 'allow-model-mix' };
  }

  const canonicalRows = (results || []).filter((r) => FACTORIAL_2X2X2_PROFILE_SET.has(r.profileName));
  const canonicalProfiles = [...new Set(canonicalRows.map((r) => r.profileName).filter(Boolean))];
  if (canonicalProfiles.length < 2) {
    return { ok: true, skipped: 'insufficient-canonical-cells' };
  }

  const byProfile = new Map();
  for (const row of canonicalRows) {
    const profile = row.profileName || '(unknown-profile)';
    const model = row.egoModel || row.model || '(unknown-model)';
    if (!byProfile.has(profile)) {
      byProfile.set(profile, new Set());
    }
    byProfile.get(profile).add(model);
  }

  const profileRows = [...byProfile.entries()].map(([profileName, models]) => ({
    profileName,
    models: [...models].sort(),
  }));
  const uniqueEgoModels = [...new Set(profileRows.flatMap((r) => r.models))];
  const hasUnknown = uniqueEgoModels.some((m) => m === '(unknown-model)');

  if (uniqueEgoModels.length <= 1 && !hasUnknown) {
    return { ok: true, profileRows, uniqueEgoModels };
  }

  return {
    ok: false,
    profileRows,
    uniqueEgoModels,
    hasUnknown,
  };
}

// ── Generate transcript pair + metadata for one result ──────────────────────

function generateForResult(result, outDir, filenameBase, scenarioData) {
  const logPath = path.join(LOGS_DIR, `${result.dialogueId}.json`);
  if (!fs.existsSync(logPath)) {
    console.error(`  Dialogue log not found: ${logPath}`);
    return null;
  }

  const dialogueLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  const turns = dialogueLog.turnResults || [];
  const trace = dialogueLog.dialogueTrace || dialogueLog.trace || [];
  const scenario = scenarioData.scenarios?.[result.scenarioId] || {};

  const params = {
    turns,
    dialogueTrace: trace,
    scenarioName: scenario.name || result.scenarioId || 'unknown',
    scenarioDescription: scenario.description || '',
    topic: scenario.topic || scenario.name || result.scenarioId || 'unknown',
    turnCount: turns.length,
    learnerContext: dialogueLog.learnerContext || null,
  };

  const publicPrompt = buildDialogueQualityPrompt({ ...params, transcriptMode: 'public' });
  const fullPrompt = buildDialogueQualityPrompt({ ...params, transcriptMode: 'full' });

  fs.mkdirSync(outDir, { recursive: true });
  const pubPath = path.join(outDir, `${filenameBase}-public.txt`);
  const fullPath = path.join(outDir, `${filenameBase}-full.txt`);
  fs.writeFileSync(pubPath, publicPrompt);
  fs.writeFileSync(fullPath, fullPrompt);

  return {
    db_result_id: result.id,
    run_id: result.runId,
    profile_name: result.profileName,
    scenario_id: result.scenarioId,
    dialogue_id: result.dialogueId,
    model: result.model || null,
    ego_model: result.egoModel || null,
    superego_model: result.superegoModel || null,
    judge_model: result.judgeModel,
    tutor_first_turn_score: result.tutorFirstTurnScore,
    holistic_overall_score: result.holisticScore,
    created_at: result.createdAt,
    learner_architecture: dialogueLog.learnerArchitecture || null,
    turn_count: turns.length,
    trace_entries: trace.length,
    files: {
      public: path.basename(pubPath),
      full: path.basename(fullPath),
    },
  };
}

function failModelConsistency(details) {
  console.error('\nError: transcript sample set has mixed tutor ego models across canonical 2x2x2 cells.');
  console.error('This introduces a model confound in side-by-side transcript comparisons.');
  console.error('\nDetected tutor ego models by profile:');
  for (const row of details.profileRows || []) {
    console.error(`  - ${row.profileName}: ${row.models.join(', ')}`);
  }
  console.error('\nFix options:');
  console.error('  1) Regenerate from a model-consistent run');
  console.error('  2) Use --allow-model-mix only when you want to preserve known confounds');
  process.exit(1);
}

// ── Main ────────────────────────────────────────────────────────────────────

const opts = parseArgs();
const outDir = opts.outDir ? path.resolve(opts.outDir) : DEFAULT_OUT_DIR;
const scenarioData = evalConfigLoader.loadSuggestionScenarios?.() || {};
const db = await openDb();

let results;
if (opts.resultId) {
  const row = db.prepare('SELECT * FROM evaluation_results WHERE id = ?').get(opts.resultId);
  if (!row) { console.error(`Result ${opts.resultId} not found`); process.exit(1); }
  results = [rowToResult(row)];
} else if (opts.runId) {
  const rows = db.prepare(
    'SELECT * FROM evaluation_results WHERE run_id = ? AND dialogue_id IS NOT NULL ORDER BY profile_name, scenario_id'
  ).all(opts.runId);
  if (rows.length === 0) { console.error(`No dialogue results for run ${opts.runId}`); process.exit(1); }
  results = rows.map(rowToResult);
} else {
  const row = db.prepare(`
    SELECT * FROM evaluation_results
    WHERE dialogue_id IS NOT NULL
      AND (profile_name LIKE '%psycho%' OR profile_name LIKE '%ego_superego%')
    ORDER BY created_at DESC LIMIT 1
  `).get();
  if (!row) { console.error('No dynamic learner results found'); process.exit(1); }
  results = [rowToResult(row)];
}
db.close();

const consistency = validateCanonicalTutorEgoModelConsistency(results, { allowModelMix: opts.allowModelMix });
if (!consistency.ok) {
  failModelConsistency(consistency);
}

console.log(`Generating ${results.length} transcript pair(s) → ${outDir}\n`);

const metadata = {
  generated: new Date().toISOString().slice(0, 10),
  output_dir: outDir,
  transcripts: {},
};

for (const result of results) {
  const base = opts.prefix || result.dialogueId;
  const label = `${result.profileName} / ${result.scenarioId}`;
  process.stdout.write(`  ${label} ...`);

  const entry = generateForResult(result, outDir, base, scenarioData);
  if (entry) {
    metadata.transcripts[base] = entry;
    console.log(` OK (${entry.turn_count} turns)`);
  } else {
    console.log(' SKIPPED');
  }
}

// Write metadata
const metaPath = path.join(outDir, 'metadata.json');
// Merge with existing metadata if present
let existing = {};
if (fs.existsSync(metaPath)) {
  try { existing = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch { /* ignore */ }
}
const merged = {
  ...existing,
  ...metadata,
  transcripts: { ...(existing.transcripts || {}), ...metadata.transcripts },
};
fs.writeFileSync(metaPath, JSON.stringify(merged, null, 2) + '\n');
console.log(`\nMetadata: ${metaPath}`);

// Show excerpt for single-result mode
if (results.length === 1) {
  const base = opts.prefix || results[0].dialogueId;
  const pubPath = path.join(outDir, `${base}-public.txt`);
  const pubContent = fs.readFileSync(pubPath, 'utf-8');
  console.log('\n=== PUBLIC TRANSCRIPT EXCERPT ===');
  const pubMatch = pubContent.match(/## PUBLIC DIALOGUE TRANSCRIPT[\s\S]*?(?=## YOUR TASK)/);
  if (pubMatch) console.log(pubMatch[0].trim().slice(0, 1500));

  const fullPath = path.join(outDir, `${base}-full.txt`);
  const fullContent = fs.readFileSync(fullPath, 'utf-8');
  console.log('\n=== FULL TRANSCRIPT EXCERPT ===');
  const fullMatch = fullContent.match(/## FULL DIALOGUE TRANSCRIPT[\s\S]*?(?=## YOUR TASK)/);
  if (fullMatch) console.log(fullMatch[0].trim().slice(0, 2000));
}
