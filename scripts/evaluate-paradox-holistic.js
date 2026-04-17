#!/usr/bin/env node
/**
 * evaluate-paradox-holistic.js — Holistic-only scoring for the learner paradox run.
 *
 * Adds learner_holistic_overall_score to rows in the original d=3.05 paradox run
 * (eval-2026-02-20-25c78e91) WITHOUT rescoring the v1.0 rubric (which would cause
 * cross-version contamination per CLAUDE.md).
 *
 * For each row:
 *   1. Load logs/tutor-dialogues/<dialogueId>.json
 *   2. Extract learner + tutor turns from the dialogue trace
 *   3. Build the learner-holistic prompt (reuses services/learnerRubricEvaluator.js)
 *   4. Call the OpenRouter judge (default: Sonnet 4.5, same judge panel as paper)
 *   5. SQL UPDATE only the four holistic fields (no rubric_version overwrite)
 *
 * Feeds analyze-learner-paradox-holistic.js for the final d-comparison on the
 * exact 48 rows that produced d=3.05.
 *
 * Usage:
 *   node scripts/evaluate-paradox-holistic.js                             # default
 *   node scripts/evaluate-paradox-holistic.js --run <runId>
 *   node scripts/evaluate-paradox-holistic.js --judge anthropic/claude-sonnet-4.5
 *   node scripts/evaluate-paradox-holistic.js --limit 5                   # dry-run size
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildLearnerHolisticEvaluationPrompt } from '../services/learnerRubricEvaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const LOGS_DIR = path.join(ROOT, 'logs', 'tutor-dialogues');

const args = process.argv.slice(2);
const getOption = (name, def) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
};

const RUN_ID = getOption('run', 'eval-2026-02-20-25c78e91');
const JUDGE_MODEL = getOption('judge', 'anthropic/claude-sonnet-4.5');
const LIMIT = parseInt(getOption('limit', '0'), 10);
const FORCE = args.includes('--force');
const VERBOSE = args.includes('--verbose');

// --- Mirror of eval-cli.js extractLearnerTurnsFromTrace ------------------
function extractLearnerTurnsFromTrace(trace, isMultiAgent, conversationHistory) {
  const learnerTurns = [];
  let turnMarkers = trace.filter(
    (t) => (t.agent === 'learner' || t.agent === 'user') && t.action === 'turn_action',
  );
  if (turnMarkers.length === 0) {
    turnMarkers = trace.filter(
      (t) =>
        (t.agent === 'learner_synthesis' && t.action === 'response') ||
        (t.agent === 'learner' && t.action === 'final_output'),
    );
  }
  const convHistByTurn = {};
  if (Array.isArray(conversationHistory)) {
    conversationHistory.forEach((ch, i) => {
      if (ch.learnerMessage) convHistByTurn[i] = ch.learnerMessage;
    });
  }
  for (const ta of turnMarkers) {
    let rawMessage =
      ta.action === 'final_output' ? ta.detail || ta.contextSummary || '' : ta.contextSummary || '';
    const externalMatch = rawMessage.match(/\[EXTERNAL\]:?\s*([\s\S]*)/i);
    if (externalMatch) rawMessage = externalMatch[1].trim();
    const turnData = {
      turnIndex: ta.turnIndex,
      externalMessage: rawMessage,
      internalDeliberation: [],
    };
    if (!turnData.externalMessage && ta.turnIndex != null) {
      turnData.externalMessage = convHistByTurn[ta.turnIndex - 1] || '';
    }
    learnerTurns.push(turnData);
  }
  return learnerTurns;
}

function reconstructTurns(dialogueLog, learnerTurns) {
  const reconstructed = [];
  const turnResults = dialogueLog.turnResults || [];
  if (turnResults.length > 0) {
    const sug = turnResults[0].suggestions?.[0];
    reconstructed.push({
      turnNumber: 0,
      phase: 'tutor',
      externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
    });
  }
  for (let lt = 0; lt < learnerTurns.length; lt++) {
    reconstructed.push({
      turnNumber: lt + 1,
      phase: 'learner',
      externalMessage: learnerTurns[lt].externalMessage,
      internalDeliberation: learnerTurns[lt].internalDeliberation,
    });
    const tutorTurn = turnResults[lt + 1];
    if (tutorTurn) {
      const sug = tutorTurn.suggestions?.[0];
      reconstructed.push({
        turnNumber: lt + 1,
        phase: 'tutor',
        externalMessage: sug?.message || sug?.text || JSON.stringify(sug),
      });
    }
  }
  return reconstructed;
}

async function callJudge(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        max_tokens: 1500,
        temperature: 0.0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in response');
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: ${content.slice(0, 100)}`);
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function computeOverall(scores) {
  if (!scores || typeof scores !== 'object') return null;
  const values = Object.values(scores)
    .map((v) => (typeof v === 'object' && v !== null ? Number(v.score) : Number(v)))
    .filter((v) => Number.isFinite(v));
  if (values.length === 0) return null;
  // Scale 1-5 → 0-100 (standard rubric convention)
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return ((mean - 1) / 4) * 100;
}

async function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`DB not found: ${DB_PATH}`);
    process.exit(1);
  }
  const db = new Database(DB_PATH);
  const rows = db
    .prepare(
      `
      SELECT id, dialogue_id, profile_name, scenario_id, learner_architecture,
             learner_overall_score, learner_holistic_overall_score
      FROM evaluation_results
      WHERE run_id = ? AND dialogue_id IS NOT NULL
      ORDER BY profile_name, id
    `,
    )
    .all(RUN_ID);
  console.error(`Run ${RUN_ID}: ${rows.length} rows with dialogue_id`);

  let target = rows.filter((r) => FORCE || r.learner_holistic_overall_score == null);
  if (LIMIT > 0) target = target.slice(0, LIMIT);
  console.error(`Target: ${target.length} rows ${FORCE ? '(forced)' : 'missing holistic'}`);
  console.error(`Judge: ${JUDGE_MODEL}\n`);

  const updateStmt = db.prepare(`
    UPDATE evaluation_results
    SET learner_holistic_scores = ?,
        learner_holistic_overall_score = ?,
        learner_holistic_summary = ?,
        learner_holistic_judge_model = ?
    WHERE id = ?
  `);

  let done = 0;
  let failed = 0;
  for (const r of target) {
    const tag = `[${done + failed + 1}/${target.length}] ${r.profile_name}/${r.scenario_id}`;
    const logPath = path.join(LOGS_DIR, `${r.dialogue_id}.json`);
    if (!existsSync(logPath)) {
      console.error(`${tag} ... SKIP (log missing: ${r.dialogue_id})`);
      failed++;
      continue;
    }
    let dialogueLog;
    try {
      dialogueLog = JSON.parse(readFileSync(logPath, 'utf-8'));
    } catch (e) {
      console.error(`${tag} ... SKIP (${e.message})`);
      failed++;
      continue;
    }
    const trace = dialogueLog.dialogueTrace || [];
    const learnerArch = dialogueLog.learnerArchitecture || r.learner_architecture || 'unified';
    const isMultiAgent =
      learnerArch.includes('ego_superego') ||
      learnerArch === 'multi_agent' ||
      learnerArch.includes('psychodynamic');
    const learnerTurns = extractLearnerTurnsFromTrace(trace, isMultiAgent, dialogueLog.conversationHistory);
    if (learnerTurns.length === 0) {
      console.error(`${tag} ... SKIP (no learner turns)`);
      failed++;
      continue;
    }
    const reconstructed = reconstructTurns(dialogueLog, learnerTurns);
    const personaDescription = dialogueLog.learnerContext || 'No persona description available';
    const prompt = buildLearnerHolisticEvaluationPrompt({
      turns: reconstructed,
      personaId: r.profile_name,
      personaDescription,
      learnerArchitecture: isMultiAgent ? 'multi_agent' : 'unified',
      scenarioName: r.scenario_id,
      topic: r.scenario_id,
    });

    try {
      const parsed = await callJudge(prompt);
      const overall = computeOverall(parsed.scores) ?? Number(parsed.overall_score);
      if (!Number.isFinite(overall)) {
        console.error(`${tag} ... FAIL (no valid overall score)`);
        failed++;
        continue;
      }
      updateStmt.run(
        JSON.stringify(parsed.scores || {}),
        overall,
        parsed.summary || null,
        JUDGE_MODEL,
        r.id,
      );
      console.error(`${tag} ... holistic=${overall.toFixed(1)}${VERBOSE ? `  ${(parsed.summary || '').slice(0, 80)}` : ''}`);
      done++;
    } catch (err) {
      console.error(`${tag} ... FAIL: ${err.message.slice(0, 150)}`);
      failed++;
    }
  }

  db.close();
  console.error(`\nDone: ${done} scored, ${failed} failed`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
