#!/usr/bin/env node
/**
 * grade-adaptive-dialogue.js
 *
 * Bespoke 4-dimension graded rubric for adaptive-cell dialogues (cells with
 * runner: adaptive — 110, 111-113, 118-120). The v2.2 evaluator pipeline
 * skips adaptive rows because adaptive-trap-scenarios.yaml is not in the
 * evaluator's scenario-lookup chain (see services/evalConfigLoader.js
 * getScenario()). This script fills that gap:
 *
 *   1. Reads evaluation_results rows for adaptive cells.
 *   2. Loads the dialogue log from logs/tutor-dialogues/{dialogue_id}.json.
 *   3. Builds a prompt with scenario hidden state + transcript + 4-dim rubric.
 *   4. Pipes to `codex exec -` (uses the ChatGPT-subscription bridge, no
 *      OpenAI API key needed) and parses the JSON envelope via the same
 *      fence-extraction pattern eval-cli.js uses for CLI judges.
 *   5. Writes the 4 scores + reasoning + judge_model + grader_version to DB
 *      (adaptive_* columns added in services/evaluationStore.js).
 *
 * Complements scripts/analyze-strategy-shift.js: that script computes binary
 * mechanism signals (did the right family fire at trigger+window?). This
 * script answers the next question (given an action fired, was it
 * well-executed, calibrated, and pedagogically coherent?).
 *
 * Usage:
 *   node scripts/grade-adaptive-dialogue.js --run-id <runId> [options]
 *
 * Options:
 *   --run-id <id>        Run to grade (required, repeatable: pass comma-separated).
 *   --profile <cell>     Filter to a specific profile (substring match).
 *   --scenario <id>      Filter to a specific scenario_id.
 *   --limit N            Cap rows processed (useful for smoke tests).
 *   --dry-run            Build the prompt + print one example, don't call codex.
 *   --overwrite          Re-grade rows that already have adaptive scores
 *                        (default: skip rows where adaptive_trigger_recognition
 *                        is non-NULL).
 *   --model <name>       Pass to codex via -m (default: codex default, GPT-5).
 *   --verbose            Print per-row stdout from codex.
 */

import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
process.chdir(REPO_ROOT);

// Import for the side effect of running migrations (adaptive_* columns).
await import('../services/evaluationStore.js');

const DB_PATH = process.env.EVAL_DB_PATH || path.join(REPO_ROOT, 'data', 'evaluations.db');
const db = new Database(DB_PATH);

const GRADER_VERSION = '1.0';

// ─────────────────────────────────────── arg parsing
function parseArgs(argv) {
  const args = { runIds: [], profile: null, scenario: null, limit: null, dryRun: false, overwrite: false, model: null, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run-id') args.runIds.push(...argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--profile') args.profile = argv[++i];
    else if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--overwrite') args.overwrite = true;
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--verbose') args.verbose = true;
    else if (a === '-h' || a === '--help') {
      const help = fs.readFileSync(fileURLToPath(import.meta.url), 'utf-8').split('\n').slice(1, 45).join('\n');
      console.log(help);
      process.exit(0);
    } else {
      console.error(`unknown flag: ${a}`);
      process.exit(2);
    }
  }
  if (args.runIds.length === 0) {
    console.error('ERROR: --run-id required');
    process.exit(2);
  }
  return args;
}
const ARGS = parseArgs(process.argv.slice(2));

// ─────────────────────────────────────── row selection
function selectRows() {
  const placeholders = ARGS.runIds.map(() => '?').join(',');
  let sql = `
    SELECT id, run_id, scenario_id, profile_name, dialogue_id,
           adaptive_trigger_recognition
    FROM evaluation_results
    WHERE run_id IN (${placeholders})
      AND dialogue_id IS NOT NULL
  `;
  const params = [...ARGS.runIds];
  if (ARGS.profile) {
    sql += ' AND profile_name LIKE ?';
    params.push(`%${ARGS.profile}%`);
  }
  if (ARGS.scenario) {
    sql += ' AND scenario_id = ?';
    params.push(ARGS.scenario);
  }
  sql += ' ORDER BY created_at';
  if (ARGS.limit) sql += ` LIMIT ${parseInt(ARGS.limit, 10)}`;
  return db.prepare(sql).all(...params);
}

// ─────────────────────────────────────── dialogue trace loader
function loadTrace(dialogueId) {
  const logsDir = process.env.EVAL_LOGS_DIR || path.join(process.cwd(), 'logs');
  const p = path.join(logsDir, 'tutor-dialogues', `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    console.error(`  WARN: parse failed for ${dialogueId}: ${e.message}`);
    return null;
  }
}

// ─────────────────────────────────────── prompt construction
function buildPrompt(trace) {
  const scenario = trace.scenario || {};
  const hidden = scenario.hidden || {};
  const dialogue = trace.original?.dialogue || [];
  const perTurn = trace.original?.perTurn || [];

  const turns = dialogue.map((t, i) => {
    const role = t.role === 'tutor' ? 'TUTOR' : 'LEARNER';
    return `[turn ${Math.floor(i / 2)}] ${role}: ${t.content}`;
  }).join('\n\n');

  const policyTrace = perTurn
    .filter((pt) => pt.tutorInternal?.policyAction)
    .map((pt) => `  turn ${pt.turn}: ${pt.tutorInternal.policyAction}`)
    .join('\n');

  const scenarioJson = JSON.stringify({
    id: scenario.id,
    scenarioType: scenario.scenarioType,
    expectedStrategyShift: scenario.expectedStrategyShift,
    triggerTurn: hidden.triggerTurn,
    triggerSignal: hidden.triggerSignal,
    actualMisconception: hidden.actualMisconception,
    actualSophistication: hidden.actualSophistication,
    maxTurns: scenario.maxTurns,
  }, null, 2);

  return `You are evaluating an adaptive tutor's performance on a single "trap scenario" — a dialogue designed to test whether the tutor recognises a hidden trigger and shifts strategy accordingly.

# Scenario context (latent — the tutor does not see this)
${scenarioJson}

# Tutor's selected policy actions (one per turn, for context)
${policyTrace || '  (none recorded)'}

# Transcript
${turns}

# Your task

Score the tutor on the four dimensions below using a 1-5 integer scale. Be strict: 3 = adequate, 4 = strong, 5 = exemplary. Reserve 5 for executions that handle the trap cleanly *and* extend it productively.

1. **trigger_recognition** — Did the tutor identify the trap signal at or near the expected trigger turn (\`triggerTurn\`)? Look for: a shift in framing, a probe that targets the hidden phenomenon (\`actualMisconception\` / hidden state), or an explicit naming of the pattern. Score 1 if the tutor proceeded as though nothing was different; 5 if the recognition was precise and timely.

2. **strategy_execution** — Was the tutor's actual response *after* the trigger turn aligned with \`expectedStrategyShift\`? Strategy families: diagnostic, mirror_and_extend, name_the_disagreement, substantive_engagement, scope_test, slow_down, reframe. Score 1 if the family was wrong; 5 if the family matched and the timing was right (within 1-2 turns of trigger).

3. **strategy_quality** — *Given that an action was taken*, how well-crafted was it? Look for: specificity to the learner's actual move (not generic), calibration to inferred sophistication, no policy-label leakage, no profile-data leakage, no lecturing. Score 1 if the response was generic/leaky/off-tone; 5 if it was surgically tailored.

4. **pedagogical_coherence** — Does the whole dialogue trajectory cohere as a piece of teaching? Score 1 if the turns felt disconnected or contradictory; 5 if each turn built productively on the prior one, and the closing turn leaves the learner in a stronger position than the opening.

Respond with a JSON object only (no prose outside the JSON, no markdown fences required but tolerated):

{
  "scores": {
    "trigger_recognition": <1-5>,
    "strategy_execution": <1-5>,
    "strategy_quality": <1-5>,
    "pedagogical_coherence": <1-5>
  },
  "reasoning": {
    "trigger_recognition": "<1-2 sentence justification>",
    "strategy_execution": "<1-2 sentence justification>",
    "strategy_quality": "<1-2 sentence justification>",
    "pedagogical_coherence": "<1-2 sentence justification>"
  },
  "summary": "<one-sentence overall judgement>"
}`;
}

// ─────────────────────────────────────── codex CLI call
async function callCodex(prompt) {
  const cliArgs = ['exec', '-'];
  if (ARGS.model) cliArgs.push('-m', ARGS.model);
  const cliEnv = { ...process.env };

  const stdout = await new Promise((resolve, reject) => {
    const child = spawn('codex', cliArgs, { stdio: ['pipe', 'pipe', 'pipe'], env: cliEnv });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(err || out || `codex exited with code ${code}`));
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
  return { parsed: JSON.parse(jsonStr), rawStdout: stdout };
}

// ─────────────────────────────────────── persistence
const updateStmt = db.prepare(`
  UPDATE evaluation_results SET
    adaptive_trigger_recognition = @trigger,
    adaptive_strategy_execution = @execution,
    adaptive_strategy_quality = @quality,
    adaptive_pedagogical_coherence = @coherence,
    adaptive_grader_scores = @scoresJson,
    adaptive_grader_reasoning = @reasoning,
    adaptive_grader_judge_model = @model,
    adaptive_grader_version = @version
  WHERE id = @id
`);

function persistScores(rowId, parsed, modelLabel) {
  const s = parsed.scores || {};
  const r = parsed.reasoning || {};
  const reasoningBundle = JSON.stringify({
    per_dimension: r,
    summary: parsed.summary || null,
  });
  updateStmt.run({
    id: rowId,
    trigger: s.trigger_recognition ?? null,
    execution: s.strategy_execution ?? null,
    quality: s.strategy_quality ?? null,
    coherence: s.pedagogical_coherence ?? null,
    scoresJson: JSON.stringify(s),
    reasoning: reasoningBundle,
    model: modelLabel,
    version: GRADER_VERSION,
  });
}

// ─────────────────────────────────────── main loop
async function main() {
  const rows = selectRows();
  console.log(`PLAN: grade ${rows.length} rows from runs [${ARGS.runIds.join(', ')}]${ARGS.profile ? ` profile~${ARGS.profile}` : ''}${ARGS.scenario ? ` scenario=${ARGS.scenario}` : ''}`);
  console.log(`MODE: ${ARGS.dryRun ? 'DRY RUN' : 'WRITE'} | overwrite=${ARGS.overwrite} | model=${ARGS.model || '(codex default)'} | grader_version=${GRADER_VERSION}`);
  console.log('');

  const modelLabel = ARGS.model ? `codex-cli.${ARGS.model}` : 'codex-cli.default';
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const tag = `[${++processed}/${rows.length}]`;
    if (!ARGS.overwrite && row.adaptive_trigger_recognition != null) {
      console.log(`${tag} ${row.scenario_id} ${row.profile_name.slice(0, 40)} — already graded, skip`);
      skipped++;
      continue;
    }
    const trace = loadTrace(row.dialogue_id);
    if (!trace) {
      console.log(`${tag} ${row.scenario_id} ${row.profile_name.slice(0, 40)} — trace missing, skip`);
      skipped++;
      continue;
    }
    const prompt = buildPrompt(trace);
    if (ARGS.dryRun) {
      if (processed === 1) {
        console.log('=== DRY RUN: prompt for first row ===');
        console.log(prompt);
        console.log('=== END PROMPT ===');
      }
      continue;
    }
    try {
      const t0 = Date.now();
      const { parsed, rawStdout } = await callCodex(prompt);
      const dt = Date.now() - t0;
      persistScores(row.id, parsed, modelLabel);
      const s = parsed.scores || {};
      console.log(`${tag} ${row.scenario_id} ${row.profile_name.slice(0, 40)} | trig=${s.trigger_recognition} exec=${s.strategy_execution} qual=${s.strategy_quality} coh=${s.pedagogical_coherence} | ${dt}ms`);
      if (ARGS.verbose) {
        console.log('  raw stdout (first 500 chars):', rawStdout.slice(0, 500));
      }
    } catch (e) {
      errors++;
      console.error(`${tag} ${row.scenario_id} ${row.profile_name.slice(0, 40)} — ERROR: ${e.message}`);
    }
  }

  console.log('');
  console.log(`=== done: processed=${processed - skipped - errors} skipped=${skipped} errors=${errors} ===`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
