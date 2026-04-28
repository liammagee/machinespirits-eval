#!/usr/bin/env node
/**
 * Score a run's tutor messages against the Weberian charisma rubric (v1.0).
 *
 * Used by cells 200 and 201 (id-director architecture). May also be run
 * against earlier cells (cell_4, cell_99, etc.) to generate cross-rubric
 * comparison data — see the design doc § "Comparative runs".
 *
 * Usage:
 *   node scripts/evaluate-charisma.js <runId> [--judge <model>] [--force]
 *                                              [--scenario <id>] [--profile <name>]
 *                                              [--limit <n>] [--verbose]
 *
 * Behaviour:
 *   - Loads each multi-turn row in the run (single-turn rows are skipped:
 *     charisma is most legible in dialogue, and there's no last-turn-of-arc
 *     to score for single-turn).
 *   - Reads the dialogue log to reconstruct turns; takes the tutor's last
 *     turn message as the unit of evaluation.
 *   - Builds the charisma judge prompt (rubricEvaluator.buildTutorCharismaEvaluationPrompt)
 *     and calls the judge via the existing callJudgeModel.
 *   - Persists scores via evaluationStore.updateResultTutorCharismaScores.
 *
 *   --force re-scores rows that already have charisma scores.
 *   --judge selects a judge model (e.g. openrouter.gpt). Defaults to the
 *     judge configured in evaluation-rubric.yaml.
 */

import 'dotenv/config';

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as evaluationStore from '../services/evaluationStore.js';
import {
  buildTutorCharismaEvaluationPrompt,
  calculateTutorCharismaScore,
  callJudgeModel,
  parseJudgeResponse,
  loadTutorCharismaRubric,
} from '../services/rubricEvaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EVAL_ROOT = path.resolve(__dirname, '..');
// Dialogue logs land in logs/tutor-dialogues/<dialogueId>.json — see
// dialogueLogService.js. Earlier code paths used logs/transcripts/ which
// holds processed transcript exports rather than raw turn-by-turn logs.
const LOGS_DIR = path.join(EVAL_ROOT, 'logs', 'tutor-dialogues');

function parseArgs(argv) {
  const args = argv.slice(2);
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function loadDialogueLog(dialogueId) {
  if (!dialogueId) return null;
  const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(logPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  } catch (e) {
    console.warn(`[evaluate-charisma] Could not parse dialogue log ${dialogueId}: ${e.message}`);
    return null;
  }
}

function extractTutorLastMessageAndExcerpt(dialogueLog) {
  if (!dialogueLog) return { tutorMessage: null, dialogueExcerpt: '(no dialogue log)' };

  const turns = Array.isArray(dialogueLog?.turnResults) ? dialogueLog.turnResults : [];
  let lastTutorMessage = null;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    const candidate = t?.suggestions?.[0]?.message || t?.tutorMessage || null;
    if (candidate && typeof candidate === 'string') {
      lastTutorMessage = candidate;
      break;
    }
  }

  // Build a recent-history excerpt using the last ~6 messages (learner+tutor).
  const excerptParts = [];
  for (const t of turns.slice(-3)) {
    if (t?.learnerMessage) excerptParts.push(`LEARNER: ${t.learnerMessage}`);
    const m = t?.suggestions?.[0]?.message || t?.tutorMessage;
    if (m) excerptParts.push(`TUTOR: ${m}`);
  }
  const dialogueExcerpt = excerptParts.length > 0 ? excerptParts.join('\n\n') : '(no prior turns)';

  return { tutorMessage: lastTutorMessage, dialogueExcerpt };
}

async function scoreRow(row, { judgeOverride, verbose }) {
  const dialogueLog = loadDialogueLog(row.dialogueId);
  const { tutorMessage, dialogueExcerpt } = extractTutorLastMessageAndExcerpt(dialogueLog);
  if (!tutorMessage) {
    return { ok: false, reason: 'no_tutor_message_found' };
  }

  const recognitionMode =
    row.profileName?.includes('recog') || row.factorRecognition === 1 || row.factorRecognition === true;

  const prompt = buildTutorCharismaEvaluationPrompt({
    tutorMessage,
    dialogueExcerpt,
    scenarioName: row.scenarioName || row.scenarioId || 'unknown',
    scenarioDescription: row.scenarioId || '',
    recognitionMode,
  });

  if (verbose) {
    console.log(`  prompt length: ${prompt.length} chars`);
  }

  const judgeOverrides = judgeOverride ? { model: judgeOverride } : {};
  let responseText;
  try {
    responseText = await callJudgeModel(prompt, judgeOverrides);
  } catch (err) {
    return { ok: false, reason: `judge_error: ${err.message}` };
  }

  let parsed;
  try {
    parsed = parseJudgeResponse(responseText);
  } catch (err) {
    return { ok: false, reason: `parse_error: ${err.message}`, raw: responseText.slice(0, 400) };
  }

  if (!parsed?.scores) {
    return { ok: false, reason: 'parse_missing_scores', raw: responseText.slice(0, 400) };
  }

  const overall = calculateTutorCharismaScore(parsed.scores);
  if (overall == null) {
    return { ok: false, reason: 'no_valid_dimension_scores' };
  }

  evaluationStore.updateResultTutorCharismaScores(row.id, {
    charismaScores: parsed.scores,
    charismaOverallScore: overall,
    charismaSummary: parsed.summary || null,
    charismaJudgeModel: judgeOverride || 'default',
  });

  return { ok: true, overall };
}

async function main() {
  const { positional, flags } = parseArgs(process.argv);
  const runId = positional[0];
  if (!runId) {
    console.error('Usage: evaluate-charisma.js <runId> [--judge <model>] [--force] [--scenario <id>] [--profile <name>] [--limit <n>] [--verbose]');
    process.exit(1);
  }

  const judgeOverride = typeof flags.judge === 'string' ? flags.judge : null;
  const force = !!flags.force;
  const verbose = !!flags.verbose;
  const scenarioFilter = typeof flags.scenario === 'string' ? flags.scenario : null;
  const profileFilter = typeof flags.profile === 'string' ? flags.profile : null;
  const limit = typeof flags.limit === 'string' ? Number.parseInt(flags.limit, 10) : null;

  const rubric = loadTutorCharismaRubric();
  if (!rubric) {
    console.error('config/evaluation-rubric-charisma.yaml not found or unparseable.');
    process.exit(1);
  }
  console.log(`Charisma rubric loaded: ${rubric.name} (v${rubric.version}, ${Object.keys(rubric.dimensions).length} dimensions)`);

  const all = evaluationStore.getResults(runId, {});
  if (all.length === 0) {
    console.error(`No results for run: ${runId}`);
    process.exit(1);
  }

  let toScore = all.filter(
    (r) =>
      r.success &&
      ((Array.isArray(r.suggestions) && r.suggestions.length > 1) ||
        (r.conversationMode === 'messages' && r.dialogueRounds > 1)),
  );

  if (scenarioFilter) toScore = toScore.filter((r) => r.scenarioId === scenarioFilter);
  if (profileFilter) toScore = toScore.filter((r) => (r.profileName || '').includes(profileFilter));
  if (!force) toScore = toScore.filter((r) => r.tutorCharismaOverallScore == null);
  if (limit && Number.isFinite(limit)) toScore = toScore.slice(0, limit);

  if (toScore.length === 0) {
    console.log('Nothing to score (use --force to re-score rows that already have charisma scores).');
    return;
  }

  console.log(`Scoring ${toScore.length} multi-turn row(s) for run ${runId}`);
  console.log(`  Judge: ${judgeOverride || 'default (from evaluation-rubric.yaml)'}`);
  console.log('');

  let succeeded = 0;
  let failed = 0;
  const overallScores = [];

  for (let i = 0; i < toScore.length; i++) {
    const row = toScore[i];
    const tag = `[${i + 1}/${toScore.length}]`;
    const profileName = row.profileName || `${row.provider}/${row.model}`;
    process.stdout.write(`${tag} ${row.scenarioId} / ${profileName} ... `);

    const outcome = await scoreRow(row, { judgeOverride, verbose });
    if (outcome.ok) {
      succeeded++;
      overallScores.push(outcome.overall);
      console.log(`charisma=${outcome.overall.toFixed(1)}/100`);
    } else {
      failed++;
      console.log(`FAIL (${outcome.reason})`);
      if (verbose && outcome.raw) {
        console.log(`    raw: ${outcome.raw}`);
      }
    }
  }

  console.log('');
  console.log(`Done. ${succeeded} succeeded, ${failed} failed.`);
  if (overallScores.length > 0) {
    const mean = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;
    const min = Math.min(...overallScores);
    const max = Math.max(...overallScores);
    console.log(
      `  charisma overall — mean ${mean.toFixed(1)} (range ${min.toFixed(1)}–${max.toFixed(1)}, n=${overallScores.length})`,
    );
  }
}

main().catch((err) => {
  console.error('[evaluate-charisma] Fatal:', err);
  process.exit(1);
});
