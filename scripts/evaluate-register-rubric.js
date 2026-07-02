#!/usr/bin/env node

import 'dotenv/config';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as evaluationStore from '../services/evaluationStore.js';
import { getScenario } from '../services/evalConfigLoader.js';
import {
  buildRegisterRubricEvaluationPrompt,
  calculateRubricOverallScore,
  callJudgeModel,
  loadRubricYaml,
  parseJudgeResponse,
  resolveRubricYamlPath,
} from '../services/rubricEvaluator.js';
import { getEngagementRegisterDefinition, getRegisterRubricPath } from '../services/engagementRegisterRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_HOME = process.env.MS_DATA_HOME || path.join(os.homedir(), '.machinespirits-data');
const LOG_ROOTS = [
  process.env.EVAL_LOGS_DIR || null,
  fs.existsSync(DATA_HOME) ? path.join(DATA_HOME, 'logs') : null,
  path.join(ROOT, 'logs'),
].filter(Boolean);

function parseArgs(argv) {
  const args = argv.slice(2);
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { positional, flags };
}

function loadDialogueLog(dialogueId) {
  if (!dialogueId) return null;
  for (const root of LOG_ROOTS) {
    const candidates = [
      path.join(root, 'tutor-dialogues', `${dialogueId}.json`),
      path.join(root, `${dialogueId}.json`),
    ];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      try {
        return JSON.parse(fs.readFileSync(candidate, 'utf-8'));
      } catch (err) {
        console.warn(`[evaluate-register-rubric] Could not parse ${candidate}: ${err.message}`);
        return null;
      }
    }
  }
  return null;
}

function extractInitialLearnerMessage(scenario) {
  const context = scenario?.learner_context || '';
  const match = context.match(/-\s*User:\s*"([^"]+)"/);
  return match?.[1] || '';
}

function getTurnResult(log, turnIndex) {
  return Array.isArray(log?.turnResults)
    ? log.turnResults.find((turn) => Number(turn.turnIndex) === Number(turnIndex)) || null
    : null;
}

function getLearnerMessage({ scenario, log, turnIndex }) {
  if (turnIndex === 0) {
    return getTurnResult(log, turnIndex)?.learnerMessage || extractInitialLearnerMessage(scenario);
  }
  return (
    getTurnResult(log, turnIndex)?.learnerMessage || scenario?.turns?.[turnIndex - 1]?.action_details?.message || ''
  );
}

function getTutorMessage({ row, log, turnIndex }) {
  const fromLog =
    getTurnResult(log, turnIndex)?.suggestions?.[0]?.message || getTurnResult(log, turnIndex)?.tutorMessage;
  if (fromLog) return fromLog;
  return row.suggestions?.[turnIndex]?.message || '';
}

function getDialogueExcerpt({ scenario, log, row, turnIndex }) {
  const parts = [];
  for (let i = Math.max(0, turnIndex - 1); i < turnIndex; i += 1) {
    const learner = getLearnerMessage({ scenario, log, turnIndex: i });
    const tutor = getTutorMessage({ row, log, turnIndex: i });
    if (learner) parts.push(`LEARNER turn ${i}: ${learner}`);
    if (tutor) parts.push(`TUTOR turn ${i}: ${tutor}`);
  }
  return parts.length ? parts.join('\n\n') : '(no prior turns)';
}

function getTurnTutorScore(row, turnIndex) {
  const tutorScores = row.tutorScores || {};
  return tutorScores?.[String(turnIndex)] || tutorScores?.[turnIndex] || null;
}

function getRecognitionQuality(turnScore) {
  const entry = turnScore?.recognition_quality || turnScore?.recognitionQuality;
  return typeof entry === 'number' ? entry : (entry?.score ?? null);
}

function rubricPathForRegister(registerName) {
  const direct = getRegisterRubricPath(registerName);
  if (direct) return direct;
  if (registerName === 'charismatic_challenge') return 'config/evaluation-rubric-charisma.yaml';
  return null;
}

function makeSlices(row, { registerFilter = null } = {}) {
  const trace = Array.isArray(row.idConstructionTrace) ? row.idConstructionTrace : [];
  const log = loadDialogueLog(row.dialogueId);
  const scenario = getScenario(row.scenarioId, { forceReload: true }) || { id: row.scenarioId };
  const slices = [];

  for (const traceTurn of trace) {
    const turnIndex = Number(traceTurn.turn);
    if (!Number.isInteger(turnIndex) || turnIndex < 0) continue;
    const engagementState = traceTurn.engagementState || traceTurn.engagement_state || {};
    const registerName = engagementState.selected_register || engagementState.selected_mode || '';
    if (!registerName) continue;
    if (registerFilter && registerName !== registerFilter) continue;

    const rubricPath = rubricPathForRegister(registerName);
    if (!rubricPath) continue;

    const turnScore = getTurnTutorScore(row, turnIndex);
    const sliceKey = `turn_${turnIndex}`;
    slices.push({
      rowId: row.id,
      runId: row.runId,
      profileName: row.profileName,
      scenarioId: row.scenarioId,
      dialogueId: row.dialogueId,
      turnIndex,
      sliceKey,
      registerName,
      rubricPath,
      tutorMessage: getTutorMessage({ row, log, turnIndex }),
      learnerMessage: getLearnerMessage({ scenario, log, turnIndex }),
      postLearnerMessage: getLearnerMessage({ scenario, log, turnIndex: turnIndex + 1 }),
      dialogueExcerpt: getDialogueExcerpt({ scenario, log, row, turnIndex }),
      scenarioName: scenario.name || scenario.id || row.scenarioId,
      scenarioDescription: scenario.description || row.scenarioId,
      learnerSignal: engagementState.learner_signal || '',
      resistanceSignal: engagementState.resistance_signal || '',
      resistanceStrategy: engagementState.resistance_strategy || '',
      v22TurnScore: turnScore?.overallScore ?? turnScore?.overall_score ?? null,
      recognitionQuality: getRecognitionQuality(turnScore),
      alreadyScored: row.tutorRegisterScores?.[registerName]?.[sliceKey]?.overall != null,
    });
  }

  return slices;
}

function shouldScore(slice, { force }) {
  return force || !slice.alreadyScored;
}

async function scoreSlice(slice, { judgeModel = null }) {
  const rubric = loadRubricYaml(slice.rubricPath);
  if (!rubric?.dimensions) {
    return { ok: false, reason: `rubric_missing_or_invalid:${slice.rubricPath}` };
  }

  const definition = getEngagementRegisterDefinition(slice.registerName);
  const prompt = buildRegisterRubricEvaluationPrompt({
    rubric,
    registerName: slice.registerName,
    tutorMessage: slice.tutorMessage,
    learnerMessage: slice.learnerMessage,
    postLearnerMessage: slice.postLearnerMessage,
    dialogueExcerpt: slice.dialogueExcerpt,
    scenarioName: slice.scenarioName,
    scenarioDescription: [
      slice.scenarioDescription,
      definition?.stance_contract ? `Register contract: ${definition.stance_contract}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  });

  const judgeOverrides = judgeModel ? { judgeOverride: { model: judgeModel } } : {};
  let responseText;
  try {
    responseText = await callJudgeModel(prompt, judgeOverrides);
  } catch (err) {
    return { ok: false, reason: `judge_error:${err.message}` };
  }

  let parsed;
  try {
    parsed = parseJudgeResponse(responseText);
  } catch (err) {
    return { ok: false, reason: `parse_error:${err.message}`, raw: responseText.slice(0, 400) };
  }

  if (!parsed?.scores) return { ok: false, reason: 'parse_missing_scores', raw: responseText.slice(0, 400) };

  const overall = calculateRubricOverallScore(parsed.scores, rubric);
  if (overall == null) return { ok: false, reason: 'no_valid_dimension_scores' };

  evaluationStore.updateResultTutorRegisterScore(slice.rowId, {
    register: slice.registerName,
    sliceKey: slice.sliceKey,
    scores: parsed.scores,
    overall,
    summary: parsed.summary || null,
    rubricVersion: rubric.version || null,
    rubricPath: path.relative(ROOT, resolveRubricYamlPath(slice.rubricPath)),
    judgeModel: judgeModel || 'default',
    sliceRef: {
      run_id: slice.runId,
      scenario_id: slice.scenarioId,
      profile_name: slice.profileName,
      dialogue_id: slice.dialogueId,
      turn: slice.turnIndex,
      learner_signal: slice.learnerSignal,
      resistance_signal: slice.resistanceSignal,
      resistance_strategy: slice.resistanceStrategy,
      v22_turn_score: slice.v22TurnScore,
      recognition_quality: slice.recognitionQuality,
    },
  });

  return { ok: true, overall };
}

async function main() {
  const { positional, flags } = parseArgs(process.argv);
  const runId = positional[0];
  if (!runId) {
    console.error(
      'Usage: evaluate-register-rubric.js <runId> [--register <name>] [--judge <model>] [--scenario <id>] [--profile <name>] [--limit <n>] [--force] [--check]',
    );
    process.exit(1);
  }

  const registerFilter = typeof flags.register === 'string' ? flags.register : null;
  const scenarioFilter = typeof flags.scenario === 'string' ? flags.scenario : null;
  const profileFilter = typeof flags.profile === 'string' ? flags.profile : null;
  const judgeModel = typeof flags.judge === 'string' ? flags.judge : null;
  const force = flags.force === true;
  const checkOnly = flags.check === true;
  const limit = typeof flags.limit === 'string' ? Number.parseInt(flags.limit, 10) : null;

  let rows = evaluationStore.getResults(runId, {});
  rows = rows.filter((row) => row.success);
  if (scenarioFilter) rows = rows.filter((row) => row.scenarioId === scenarioFilter);
  if (profileFilter) rows = rows.filter((row) => (row.profileName || '').includes(profileFilter));

  let slices = rows.flatMap((row) => makeSlices(row, { registerFilter }));
  const totalEligible = slices.length;
  slices = slices.filter((slice) => shouldScore(slice, { force }));
  if (limit && Number.isFinite(limit)) slices = slices.slice(0, limit);

  console.log(`Rows: ${rows.length}`);
  console.log(`Eligible register slices: ${totalEligible}`);
  console.log(`Pending register slices: ${slices.length}`);
  if (registerFilter) console.log(`Register filter: ${registerFilter}`);
  if (checkOnly) {
    const byRegister = new Map();
    for (const slice of rows.flatMap((row) => makeSlices(row, { registerFilter }))) {
      const current = byRegister.get(slice.registerName) || { eligible: 0, pending: 0 };
      current.eligible += 1;
      if (shouldScore(slice, { force })) current.pending += 1;
      byRegister.set(slice.registerName, current);
    }
    for (const [register, counts] of [...byRegister.entries()].sort()) {
      console.log(`${register}: eligible=${counts.eligible} pending=${counts.pending}`);
    }
    return;
  }

  if (!slices.length) {
    console.log('Nothing to score.');
    return;
  }

  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < slices.length; i += 1) {
    const slice = slices[i];
    process.stdout.write(
      `[${i + 1}/${slices.length}] ${slice.runId} ${slice.profileName} ${slice.scenarioId} ${slice.registerName} ${slice.sliceKey} ... `,
    );
    const result = await scoreSlice(slice, { judgeModel });
    if (result.ok) {
      succeeded += 1;
      console.log(result.overall.toFixed(1));
    } else {
      failed += 1;
      console.log(`FAIL ${result.reason}`);
    }
  }

  console.log(`Scored: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
