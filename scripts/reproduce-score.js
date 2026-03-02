#!/usr/bin/env node
/**
 * reproduce-score.js — Score reproduction and verification
 *
 * Given a DB row and optional turn index, reconstructs the exact judge prompt,
 * verifies it matches the stored judgeInputHash, and optionally re-runs the
 * judge to compare scores.
 *
 * Usage:
 *   node scripts/reproduce-score.js --row-id <id> --turn 0              # verify prompt hash for turn 0
 *   node scripts/reproduce-score.js --row-id <id>                        # verify all turns in a row
 *   node scripts/reproduce-score.js --row-id <id> --turn 2 --rerun       # re-run the judge and compare
 *   node scripts/reproduce-score.js --row-id <id> --turn 0 --show-prompt # print the reconstructed prompt
 *   node scripts/reproduce-score.js --row-id <id> --json out.json        # structured output
 *   node scripts/reproduce-score.js --row-id <id> --model openrouter.gpt # override judge model for --rerun
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';
import { getScenario, setRubricPathOverride, clearRubricPathOverride } from '../services/evalConfigLoader.js';
import {
  buildPerTurnTutorEvaluationPrompt,
  buildEvaluationPrompt,
  calculateOverallScore,
} from '../services/rubricEvaluator.js';
import { verifyTurnIdsForRow } from '../services/provableDiscourse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'evaluations.db');
const LOG_DIR = join(ROOT, 'logs', 'tutor-dialogues');
const RUBRICS_DIR = join(ROOT, 'config', 'rubrics');

// ── CLI Parsing ──────────────────────────────────────────────────────────────

function parseCli() {
  const args = process.argv.slice(2);
  const flags = { showPrompt: false, rerun: false };
  const values = {};

  const VALUE_OPTIONS = new Set(['row-id', 'turn', 'json', 'db', 'model']);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--show-prompt') {
      flags.showPrompt = true;
    } else if (arg === '--rerun') {
      flags.rerun = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (VALUE_OPTIONS.has(key) && i + 1 < args.length) {
        values[key] = args[++i];
      }
    }
  }

  const rowId = values['row-id'];
  const turn = values['turn'] != null ? Number(values['turn']) : null;
  const jsonPath = values['json'] || null;
  const dbPath = values['db'] || null;
  const modelOverride = values['model'] || null;

  if (!rowId) {
    console.error(
      'Usage: node scripts/reproduce-score.js --row-id <id> [--turn N] [--show-prompt] [--rerun] [--json out.json] [--model <ref>]',
    );
    process.exit(1);
  }

  return { rowId, turn, jsonPath, dbPath, modelOverride, ...flags };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function pass(msg) {
  passCount++;
  console.log(`  ✓ ${msg}`);
}

function warn(msg) {
  warnCount++;
  console.log(`  ⚠ ${msg}`);
}

function fail(msg) {
  failCount++;
  console.log(`  ✗ ${msg}`);
}

function safeJsonParse(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function shortHash(hash) {
  return hash ? hash.slice(0, 16) + '...' : 'null';
}

/**
 * Set the rubric path override to match the version used when the row was scored.
 * Returns true if override was set, false if version dir not found.
 */
function setRubricVersionOverride(version) {
  if (!version) return false;
  const rubricPath = join(RUBRICS_DIR, `v${version}`, 'evaluation-rubric.yaml');
  if (existsSync(rubricPath)) {
    setRubricPathOverride(rubricPath);
    return true;
  }
  return false;
}

// ── Step 1: Load DB Row ──────────────────────────────────────────────────────

function loadRow(db, rowId) {
  const row = db.prepare('SELECT * FROM evaluation_results WHERE id = ?').get(rowId);
  if (!row) {
    console.error(`Row ${rowId} not found in evaluation_results`);
    process.exit(1);
  }
  return row;
}

// ── Step 2: Load & Verify Dialogue Log ───────────────────────────────────────

function loadAndVerifyDialogueLog(row) {
  const dialogueId = row.dialogue_id;
  if (!dialogueId) {
    return { log: null, dialogueId: null, hashStatus: 'no_dialogue' };
  }

  const filePath = join(LOG_DIR, `${dialogueId}.json`);
  if (!existsSync(filePath)) {
    fail(`Dialogue log not found: ${filePath}`);
    return { log: null, dialogueId, hashStatus: 'missing_file' };
  }

  let log;
  try {
    const content = readFileSync(filePath, 'utf8');
    log = JSON.parse(content);
  } catch (e) {
    fail(`Failed to parse dialogue log: ${e.message}`);
    return { log: null, dialogueId, hashStatus: 'parse_error' };
  }

  // Verify dialogue content hash if stored
  let hashStatus = 'no_stored_hash';
  if (row.dialogue_content_hash) {
    const recomputedHash = sha256(JSON.stringify(log, null, 2));
    if (recomputedHash === row.dialogue_content_hash) {
      pass(`Dialogue hash match: ${shortHash(recomputedHash)}`);
      hashStatus = 'match';
    } else {
      fail(
        `Dialogue hash mismatch: stored=${shortHash(row.dialogue_content_hash)} computed=${shortHash(recomputedHash)}`,
      );
      hashStatus = 'mismatch';
    }
  } else {
    warn('No dialogue_content_hash stored — cannot verify log integrity');
  }

  return { log, dialogueId, hashStatus };
}

// ── Step 3: Load Scenario ────────────────────────────────────────────────────

function loadScenarioContext(scenarioId) {
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    warn(`Scenario '${scenarioId}' not found — prompt reconstruction may be incomplete`);
    return {
      name: scenarioId,
      description: 'Unknown scenario',
      expectedBehavior: '',
      learnerContext: '',
      requiredElements: [],
      forbiddenElements: [],
    };
  }

  return {
    name: scenario.name,
    description: scenario.description,
    expectedBehavior: scenario.expected_behavior,
    learnerContext: scenario.learner_context,
    requiredElements: scenario.required_elements,
    forbiddenElements: scenario.forbidden_elements,
  };
}

// ── Step 4: Rebuild Judge Prompt & Verify Hash ───────────────────────────────

function rebuildAndVerifyPrompt(dialogueLog, scenarioContext, tutorScores, turnIndex) {
  const turnKey = String(turnIndex);
  const turnData = tutorScores[turnKey];

  if (!turnData || typeof turnData !== 'object') {
    fail(`Turn ${turnIndex}: no score data in tutor_scores`);
    return { prompt: null, hashStatus: 'no_turn_data', storedHash: null, rebuiltHash: null };
  }

  const storedHash = turnData.judgeInputHash || null;
  const turnResults = dialogueLog.turnResults || [];
  const dialogueTrace = dialogueLog.dialogueTrace || [];
  const learnerContext = dialogueLog.learnerContext || null;

  // Rebuild the prompt using the same function as the scoring pipeline
  const prompt = buildPerTurnTutorEvaluationPrompt({
    turnResults,
    dialogueTrace,
    targetTurnIndex: turnIndex,
    scenario: scenarioContext,
    learnerContext,
  });

  if (!prompt) {
    fail(`Turn ${turnIndex}: could not rebuild judge prompt (missing turn data in log)`);
    return { prompt: null, hashStatus: 'rebuild_failed', storedHash, rebuiltHash: null };
  }

  const rebuiltHash = sha256(prompt);

  if (!storedHash) {
    warn(`Turn ${turnIndex}: no judgeInputHash stored — cannot verify`);
    return { prompt, hashStatus: 'no_stored_hash', storedHash, rebuiltHash };
  }

  if (rebuiltHash === storedHash) {
    pass(`Turn ${turnIndex}: prompt hash match: ${shortHash(rebuiltHash)}`);
    return { prompt, hashStatus: 'match', storedHash, rebuiltHash };
  } else {
    fail(`Turn ${turnIndex}: prompt hash MISMATCH: stored=${shortHash(storedHash)} rebuilt=${shortHash(rebuiltHash)}`);
    return { prompt, hashStatus: 'mismatch', storedHash, rebuiltHash };
  }
}

function rebuildSingleTurnPrompt(row, scenarioContext) {
  // Single-turn rows: use buildEvaluationPrompt directly
  const suggestions = safeJsonParse(row.suggestions);
  const suggestion = Array.isArray(suggestions) ? suggestions[0] : suggestions;

  if (!suggestion) {
    fail('No suggestion found in row');
    return { prompt: null, hashStatus: 'no_suggestion' };
  }

  const prompt = buildEvaluationPrompt(suggestion, scenarioContext, { dialogueContext: null });
  const rebuiltHash = sha256(prompt);

  // Single-turn rows store hash differently — check tutor_scores if present
  const tutorScores = safeJsonParse(row.tutor_scores);
  const turnData = tutorScores?.['0'] || tutorScores;
  const storedHash = turnData?.judgeInputHash || null;

  if (!storedHash) {
    warn('Single-turn: no judgeInputHash stored — cannot verify');
    return { prompt, hashStatus: 'no_stored_hash', storedHash, rebuiltHash };
  }

  if (rebuiltHash === storedHash) {
    pass(`Single-turn: prompt hash match: ${shortHash(rebuiltHash)}`);
    return { prompt, hashStatus: 'match', storedHash, rebuiltHash };
  } else {
    fail(`Single-turn: prompt hash MISMATCH: stored=${shortHash(storedHash)} rebuilt=${shortHash(rebuiltHash)}`);
    return { prompt, hashStatus: 'mismatch', storedHash, rebuiltHash };
  }
}

// ── Step 5: Optional Re-Run ─────────────────────────────────────────────────

async function callClaudeJudge(prompt, model) {
  const claudeArgs = ['-p', '-', '--output-format', 'text'];
  if (model) claudeArgs.push('--model', model);

  const stdout = await new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDECODE;
    const child = spawn('claude', claudeArgs, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(err || out || `claude exited with code ${code}`));
      else resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });

  let jsonStr = stdout.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(jsonStr);
}

function compareScores(storedTurnData, rerunResult) {
  const storedScores = storedTurnData.scores || {};
  const rerunScores = rerunResult.scores || {};
  const storedOverall = storedTurnData.overallScore;
  const rerunOverall =
    rerunResult.overall_score != null ? rerunResult.overall_score : calculateOverallScore(rerunScores);

  const dimDeltas = [];
  const allDimKeys = new Set([...Object.keys(storedScores), ...Object.keys(rerunScores)]);

  for (const dim of allDimKeys) {
    const storedScore = storedScores[dim]?.score ?? storedScores[dim];
    const rerunScore = rerunScores[dim]?.score ?? rerunScores[dim];
    if (typeof storedScore === 'number' && typeof rerunScore === 'number') {
      const delta = rerunScore - storedScore;
      dimDeltas.push({ dim, stored: storedScore, rerun: rerunScore, delta });
    }
  }

  const overallDelta =
    typeof storedOverall === 'number' && typeof rerunOverall === 'number' ? rerunOverall - storedOverall : null;

  return { dimDeltas, storedOverall, rerunOverall, overallDelta };
}

// ── Verify contentTurnId ─────────────────────────────────────────────────────

function verifyContentTurnId(dialogueId, tutorScores, turnIndex) {
  if (!dialogueId) return 'no_dialogue';

  const turnKey = String(turnIndex);
  const turnData = tutorScores[turnKey];
  if (!turnData?.contentTurnId) return 'no_contentTurnId';

  const verification = verifyTurnIdsForRow(dialogueId, { [turnKey]: turnData }, LOG_DIR);
  if (verification.size === 0) return 'unverifiable';

  const result = verification.get(turnIndex);
  if (result === true) {
    pass(`Turn ${turnIndex}: contentTurnId verified`);
    return 'match';
  } else {
    fail(`Turn ${turnIndex}: contentTurnId MISMATCH`);
    return 'mismatch';
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { rowId, turn, jsonPath, dbPath, modelOverride, showPrompt, rerun } = parseCli();

  const effectiveDbPath = dbPath || DB_PATH;
  if (!existsSync(effectiveDbPath)) {
    console.error(`Database not found: ${effectiveDbPath}`);
    process.exit(1);
  }

  const db = new Database(effectiveDbPath, { readonly: true });

  // Step 1: Load DB row
  const row = loadRow(db, rowId);
  const tutorScores = safeJsonParse(row.tutor_scores);
  const scenarioId = row.scenario_id;
  const judgeModel = row.judge_model;
  const rubricVersion = row.tutor_rubric_version;

  console.log(`\n═══ Score Reproduction: row ${rowId} ═══`);
  console.log(`  Dialogue: ${row.dialogue_id || '(none — single-turn)'}`);
  console.log(`  Scenario: ${scenarioId}`);
  console.log(`  Judge: ${judgeModel || 'unknown'}`);
  console.log(`  Rubric: ${rubricVersion ? `v${rubricVersion}` : 'unknown'}`);

  // Set rubric version override to match the version used for scoring
  if (rubricVersion) {
    if (setRubricVersionOverride(rubricVersion)) {
      console.log(`  Rubric override: v${rubricVersion} loaded`);
    } else {
      warn(`Rubric version directory v${rubricVersion} not found — using default rubric`);
    }
  }

  // Step 2: Load & verify dialogue log
  console.log(`\n── Dialogue Log Verification ──`);
  const { log: dialogueLog, dialogueId, hashStatus: logHashStatus } = loadAndVerifyDialogueLog(row);

  // Step 3: Load scenario
  const scenarioContext = loadScenarioContext(scenarioId);

  // Determine which turns to process
  const isMultiTurn = dialogueLog?.isMultiTurn && dialogueLog?.turnResults?.length > 0;
  let turnIndices;

  if (turn != null) {
    turnIndices = [turn];
  } else if (isMultiTurn && tutorScores) {
    // All turns present in tutor_scores
    turnIndices = Object.keys(tutorScores)
      .filter((k) => /^\d+$/.test(k))
      .map(Number)
      .sort((a, b) => a - b);
  } else {
    turnIndices = [0];
  }

  const turnResults = [];

  for (const idx of turnIndices) {
    console.log(`\n── Turn ${idx} ──`);

    let promptResult;

    if (isMultiTurn && dialogueLog) {
      // Multi-turn: rebuild per-turn prompt
      promptResult = rebuildAndVerifyPrompt(dialogueLog, scenarioContext, tutorScores || {}, idx);

      // Verify contentTurnId
      if (tutorScores) {
        verifyContentTurnId(dialogueId, tutorScores, idx);
      }
    } else {
      // Single-turn: use direct buildEvaluationPrompt
      promptResult = rebuildSingleTurnPrompt(row, scenarioContext);
    }

    const turnData = tutorScores?.[String(idx)] || {};
    const storedScore = turnData.overallScore;
    if (typeof storedScore === 'number') {
      console.log(`  Stored score: ${storedScore.toFixed(1)}`);
    }

    // --show-prompt: print full prompt
    if (showPrompt && promptResult.prompt) {
      console.log(`\n── Reconstructed Prompt ──────────────────────────`);
      console.log(promptResult.prompt);
      console.log(`─────────────────────────────────────────────────`);
    }

    // --rerun: re-execute the judge
    let rerunComparison = null;
    if (rerun && promptResult.prompt) {
      const effectiveModel = modelOverride || judgeModel || null;
      console.log(`  Re-running judge${effectiveModel ? ` (model: ${effectiveModel})` : ''}...`);
      try {
        const rerunResult = await callClaudeJudge(promptResult.prompt, effectiveModel);
        rerunComparison = compareScores(turnData, rerunResult);

        if (rerunComparison.overallDelta != null) {
          const sign = rerunComparison.overallDelta >= 0 ? '+' : '';
          console.log(
            `  Re-scored: ${rerunComparison.rerunOverall.toFixed(1)} (Δ = ${sign}${rerunComparison.overallDelta.toFixed(1)})`,
          );
        }

        // Report per-dimension deltas
        const flagged = rerunComparison.dimDeltas.filter((d) => Math.abs(d.delta) > 1);
        if (flagged.length > 0) {
          warn(`${flagged.length} dimension(s) with |Δ| > 1:`);
          for (const d of flagged) {
            console.log(`    ${d.dim}: ${d.stored} → ${d.rerun} (Δ = ${d.delta > 0 ? '+' : ''}${d.delta})`);
          }
        } else {
          pass('All dimension deltas within expected variance (|Δ| ≤ 1)');
        }
      } catch (e) {
        fail(`Re-run failed: ${e.message}`);
      }
    }

    turnResults.push({
      turnIndex: idx,
      storedScore,
      promptHashStatus: promptResult.hashStatus,
      storedHash: promptResult.storedHash || null,
      rebuiltHash: promptResult.rebuiltHash || null,
      promptText: showPrompt ? promptResult.prompt : promptResult.prompt?.slice(0, 500) || null,
      rerunComparison,
    });
  }

  db.close();
  clearRubricPathOverride();

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log(`Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`);

  // ── JSON export ──────────────────────────────────────────────────────────
  if (jsonPath) {
    const output = {
      timestamp: new Date().toISOString(),
      rowId,
      dialogueId: dialogueId || null,
      scenarioId,
      judgeModel: judgeModel || null,
      rubricVersion: rubricVersion || null,
      dialogueLogHashStatus: logHashStatus,
      turns: turnResults,
      summary: { pass: passCount, warn: warnCount, fail: failCount },
    };
    writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\nJSON report written to: ${jsonPath}`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`Fatal error: ${e.message}`);
  process.exit(1);
});
