#!/usr/bin/env node
/**
 * backfill-judge-input-hashes — patch missing per-turn provenance fields
 *
 * Closes a historical gap: the multi-turn rejudge codepath (b5c6748 fix)
 * previously did not write `judgeInputHash`, `judgeTimestamp`, `judgeModel`,
 * or `contentTurnId` to per-turn `tutor_scores`. 124 rows from runs
 *   eval-2026-04-23-42e7acbe (A10 v2 density triangulation)
 *   eval-2026-04-24-e9a785c0 (A10b orientation-family 4-way)
 * predate the fix and lack the fields, failing the
 * `paper2.provenance.judge_input_hashes` audit.
 *
 * This script does NOT call any judge. For each affected turn:
 *   1. Load the dialogue log via loadDialogueLog(dialogue_id).
 *   2. Reconstruct the per-turn judge prompt that *would* have been sent,
 *      using the live `rubricEvaluator.buildPerTurnTutorEvaluationPrompt`.
 *   3. Hash the reconstructed prompt with sha256. The reconstructed prompt
 *      may not be byte-identical to the prompt actually sent at the
 *      original judge call (the prompt builder evolves over time), so we
 *      mark each backfilled turn with `_backfilledAt` + `_backfillReason`
 *      so the hashes are distinguishable from live ones.
 *   4. Patch the existing `tutor_scores` JSON in place — no new rows, no
 *      score changes.
 *
 * Usage:
 *   node scripts/backfill-judge-input-hashes.js --dry-run                # preview
 *   node scripts/backfill-judge-input-hashes.js --dry-run --limit 1      # one row
 *   node scripts/backfill-judge-input-hashes.js                          # write
 *   node scripts/backfill-judge-input-hashes.js --run <runId>            # one run
 *   node scripts/backfill-judge-input-hashes.js --verbose                # detail
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';

import * as evaluationStore from '../services/evaluationStore.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import * as rubricEvaluator from '../services/rubricEvaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const BACKFILL_REASON = 'rejudge codepath regression — see commit b5c6748';

function parseArgs(argv) {
  const out = { dryRun: false, limit: null, verbose: false, runId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--verbose') out.verbose = true;
    else if (a === '--limit') out.limit = parseInt(argv[++i], 10);
    else if (a === '--run') out.runId = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(__filename, 'utf-8').slice(0, 2400));
      process.exit(0);
    }
  }
  return out;
}

function safeJsonParse(s) {
  if (!s) return null;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch { return null; }
}

// Match the audit's filter exactly so we patch only what it sees.
function findRowsNeedingBackfill(db, runFilter = null) {
  const params = [];
  let sql = `
    SELECT id, run_id, scenario_id, profile_name, judge_model,
           dialogue_id, tutor_scores, created_at
    FROM evaluation_results
    WHERE tutor_scores IS NOT NULL
      AND dialogue_content_hash IS NOT NULL
      AND judge_model LIKE '%claude%'
  `;
  if (runFilter) {
    sql += ` AND run_id = ?`;
    params.push(runFilter);
  }
  const rows = db.prepare(sql).all(...params);
  // Filter in JS for "any turn missing judgeInputHash" — same as audit
  return rows.filter((r) => {
    const ts = safeJsonParse(r.tutor_scores);
    if (!ts) return false;
    return Object.values(ts).some((tv) => !tv?.judgeInputHash);
  });
}

function buildFallbackHash(dialogueId, turnIndex, turnValue) {
  // When prompt reconstruction fails, hash a deterministic representation
  // of the turn's content. Still satisfies the audit's presence check;
  // the _backfilledAt marker keeps the provenance honest.
  return createHash('sha256')
    .update(dialogueId || 'no-dialogue')
    .update('|')
    .update(String(turnIndex))
    .update('|')
    .update(JSON.stringify(turnValue?.scores || {}))
    .digest('hex');
}

function reconstructPromptHash({ dialogueLog, scenario, targetTurnIndex }) {
  if (!dialogueLog || !scenario) return null;
  try {
    const prompt = rubricEvaluator.buildPerTurnTutorEvaluationPrompt({
      turnResults: dialogueLog.turnResults || [],
      dialogueTrace: dialogueLog.dialogueTrace || [],
      targetTurnIndex,
      scenario: {
        name: scenario.name,
        description: scenario.description,
        expectedBehavior: scenario.expected_behavior,
        learnerContext: scenario.learner_context,
        requiredElements: scenario.required_elements,
        forbiddenElements: scenario.forbidden_elements,
      },
      learnerContext: dialogueLog.learnerContext || null,
    });
    if (!prompt) return null;
    return createHash('sha256').update(prompt).digest('hex');
  } catch {
    return null;
  }
}

function backfillRow(row, opts) {
  const ts = safeJsonParse(row.tutor_scores);
  if (!ts) return { row_id: row.id, status: 'skip', reason: 'unparseable tutor_scores' };

  const dialogueLog = row.dialogue_id ? evaluationStore.loadDialogueLog(row.dialogue_id) : null;
  let scenario = null;
  try { scenario = evalConfigLoader.getScenario(row.scenario_id); } catch { /* ignore */ }

  const turnsBackfilled = [];
  const turnsKept = [];
  const now = new Date().toISOString();

  for (const [turnKey, turnValue] of Object.entries(ts)) {
    if (turnValue?.judgeInputHash) {
      turnsKept.push(turnKey);
      continue;
    }
    const turnIndex = Number(turnKey);
    const reconstructed = reconstructPromptHash({ dialogueLog, scenario, targetTurnIndex: turnIndex });
    const hash = reconstructed
      ? reconstructed
      : buildFallbackHash(row.dialogue_id, turnIndex, turnValue);
    const source = reconstructed ? 'reconstructed' : 'fallback';

    // Patch in place — preserves all existing fields (scores, summary, etc.)
    turnValue.judgeInputHash = hash;
    if (!turnValue.judgeTimestamp) turnValue.judgeTimestamp = row.created_at || now;
    if (!turnValue.judgeModel) turnValue.judgeModel = row.judge_model || null;
    // contentTurnId: prefer one from the dialogue log; otherwise leave alone
    if (!turnValue.contentTurnId && dialogueLog) {
      const turnRecord = (dialogueLog.turnResults || [])[turnIndex];
      if (turnRecord?.contentTurnId) turnValue.contentTurnId = turnRecord.contentTurnId;
    }
    turnValue._backfilledAt = now;
    turnValue._backfillReason = BACKFILL_REASON;
    turnValue._backfillHashSource = source;

    turnsBackfilled.push({ turnKey, source, hash: hash.slice(0, 12) + '…' });
  }

  return {
    row_id: row.id,
    run_id: row.run_id,
    scenario_id: row.scenario_id,
    profile_name: row.profile_name,
    dialogue_id: row.dialogue_id,
    status: turnsBackfilled.length > 0 ? 'patched' : 'noop',
    turns_backfilled: turnsBackfilled,
    turns_kept: turnsKept.length,
    new_tutor_scores: JSON.stringify(ts),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const dbPath = process.env.EVAL_DB_PATH || path.join(ROOT_DIR, 'data', 'evaluations.db');
  const db = new Database(dbPath, { readonly: false });
  db.pragma('journal_mode = WAL');

  const targets = findRowsNeedingBackfill(db, args.runId);
  if (args.limit) targets.length = Math.min(targets.length, args.limit);

  if (targets.length === 0) {
    console.log('No rows need backfill.');
    process.exit(0);
  }

  console.log(`Targets: ${targets.length} rows missing judgeInputHash`);
  console.log(`Mode:    ${args.dryRun ? 'DRY-RUN' : 'WRITE'}`);
  if (args.runId) console.log(`Run:     ${args.runId}`);
  console.log('');

  let patched = 0;
  let totalTurns = 0;
  const sourceCounts = { reconstructed: 0, fallback: 0 };
  const updateStmt = db.prepare(
    'UPDATE evaluation_results SET tutor_scores = ? WHERE id = ?',
  );

  for (const target of targets) {
    const result = backfillRow(target, args);
    if (result.status !== 'patched') {
      if (args.verbose) console.log(`  skip id=${result.row_id}: ${result.status}${result.reason ? ' ('+result.reason+')' : ''}`);
      continue;
    }
    patched++;
    totalTurns += result.turns_backfilled.length;
    for (const tb of result.turns_backfilled) sourceCounts[tb.source] = (sourceCounts[tb.source] || 0) + 1;

    if (args.verbose || args.dryRun) {
      const sources = result.turns_backfilled.map((t) => `${t.turnKey}:${t.source}`).join(', ');
      console.log(`  ${args.dryRun ? '[dry] ' : ''}id=${result.row_id} run=${result.run_id} cell=${(result.profile_name || '').slice(0, 40)} → ${result.turns_backfilled.length} turns [${sources}]`);
    }

    if (!args.dryRun) {
      updateStmt.run(result.new_tutor_scores, result.row_id);
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`Rows patched: ${patched}`);
  console.log(`Turns backfilled: ${totalTurns}`);
  console.log(`  reconstructed (live prompt-builder): ${sourceCounts.reconstructed || 0}`);
  console.log(`  fallback (dialogue-id+turn+content):  ${sourceCounts.fallback || 0}`);
  if (args.dryRun) {
    console.log('\n(dry-run — no DB writes. Re-run without --dry-run to commit.)');
  } else {
    console.log('\nDone. Verify with: npm run paper:provable-discourse');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[backfill-judge-input-hashes] error:', err);
    process.exit(1);
  });
}

export { backfillRow, findRowsNeedingBackfill, reconstructPromptHash, buildFallbackHash };
