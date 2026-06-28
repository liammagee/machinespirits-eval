#!/usr/bin/env node

import 'dotenv/config';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import yaml from 'yaml';

import {
  buildTutorCharismaEvaluationPrompt,
  calculateTutorCharismaScore,
  callJudgeModel,
  loadTutorCharismaRubric,
  parseJudgeResponse,
} from '../services/rubricEvaluator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const SCENARIO_PATH = path.join(ROOT, 'config', 'charisma-recognition-desire-scenarios.yaml');
const LOGS_DIR = path.join(ROOT, 'logs', 'tutor-dialogues');
const CACHE_PATH = path.join(ROOT, 'exports', 'charisma-desire-adaptation-slices.json');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-adaptation-slices-summary.md');

const SWITCH_SCENARIO = 'charisma_desire_instruction_to_engagement_switch';
const TARGET_RUN_IDS = [
  'eval-2026-06-27-1ecb6a90', // budget floor
  'eval-2026-06-27-a9e8e0ed', // cell 163/169/180 comparator
  'eval-2026-06-27-bf8bc904', // cell 180 smoke
  'eval-2026-06-27-a9a4c920', // cell 181 repair smoke
  'eval-2026-06-27-e3fb5eb2', // cell 180/181 repeat matrix
  'eval-2026-06-27-a07768fe', // cell 182 smoke
  'eval-2026-06-27-49aeaa2c', // cell 183 failed smoke
  'eval-2026-06-27-eb5f4244', // cell 184 smoke
];

const ROUTER_CELLS = new Set(['180', '181', '182', '183', '184']);
const NON_ROUTER_CONTROL_CELLS = new Set(['163', '169']);

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {};
  const positional = [];
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
  return { flags, positional };
}

function fmt(value, digits = 1) {
  return value == null || Number.isNaN(Number(value)) ? '' : Number(value).toFixed(digits);
}

function mean(values) {
  const nums = values.filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function sampleSd(values) {
  const nums = values.filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  if (nums.length < 2) return null;
  const avg = mean(nums);
  return Math.sqrt(nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (nums.length - 1));
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function cleanCell(value, maxLength = 220) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '/')
    .replace(/[^\x20-\x7e]/g, '-')
    .slice(0, maxLength);
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function cellId(profileName) {
  if (profileName === 'budget') return 'budget';
  return /^cell_(\d+)/.exec(profileName || '')?.[1] || 'unknown';
}

function profileLabel(profileName) {
  const id = cellId(profileName);
  if (id === 'budget') return 'budget';
  return `cell ${id}`;
}

function profileGroup(profileName) {
  const id = cellId(profileName);
  if (id === 'budget') return 'budget_floor';
  if (NON_ROUTER_CONTROL_CELLS.has(id)) return 'non_router_charisma_control';
  if (ROUTER_CELLS.has(id)) return 'router_register_family';
  return 'other';
}

function loadScenarioData() {
  return yaml.parse(fs.readFileSync(SCENARIO_PATH, 'utf8'))?.scenarios || {};
}

function extractInitialLearnerMessage(scenario) {
  const context = scenario?.learner_context || '';
  const match = context.match(/-\s*User:\s*"([^"]+)"/);
  return match?.[1] || '';
}

function loadDialogueLog(dialogueId) {
  if (!dialogueId) return null;
  const logPath = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(logPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch {
    return null;
  }
}

function getLearnerMessage({ row, scenario, dialogueLog, turn }) {
  if (turn === 0) return extractInitialLearnerMessage(scenario);
  const fromTurnResult = dialogueLog?.turnResults?.[turn]?.learnerMessage;
  if (fromTurnResult) return fromTurnResult;
  const fromHistory = dialogueLog?.conversationHistory?.[turn - 1]?.learnerMessage;
  if (fromHistory) return fromHistory;
  return scenario?.turns?.[turn - 1]?.action_details?.message || row.scenario_id;
}

function getDialogueExcerpt(slices, currentIndex) {
  const parts = [];
  for (let i = Math.max(0, currentIndex - 1); i <= currentIndex; i += 1) {
    const slice = slices[i];
    if (!slice) continue;
    if (slice.learnerMessage) parts.push(`LEARNER turn ${slice.turn}: ${slice.learnerMessage}`);
    if (i < currentIndex && slice.tutorMessage) {
      parts.push(`TUTOR turn ${slice.turn}: ${slice.tutorMessage}`);
    }
  }
  return parts.length ? parts.join('\n\n') : '(no prior turns)';
}

function getTurnScore(tutorScores, turn) {
  const score = tutorScores?.[String(turn)] || tutorScores?.[turn];
  return score?.overallScore ?? score?.overall_score ?? null;
}

function makeSlices(row, scenarios) {
  const suggestions = parseJson(row.suggestions, []);
  const tutorScores = parseJson(row.tutor_scores, {});
  const trace = parseJson(row.id_construction_trace, []);
  const dialogueLog = loadDialogueLog(row.dialogue_id);
  const scenario = scenarios[row.scenario_id] || {};
  const rawSlices = suggestions.map((suggestion, turn) => {
    const traceTurn = trace.find((entry) => Number(entry.turn) === turn) || {};
    const tutorMessage = suggestion?.message || '';
    return {
      key: `${row.run_id}:${row.id}:${turn}`,
      rowId: row.id,
      runId: row.run_id,
      scenarioId: row.scenario_id,
      profileName: row.profile_name,
      profileLabel: profileLabel(row.profile_name),
      profileGroup: profileGroup(row.profile_name),
      turn,
      phase: turn === 0 ? 'pre_instruction' : 'post_adaptation',
      learnerMessage: getLearnerMessage({ row, scenario, dialogueLog, turn }),
      tutorMessage,
      tutorMessageHash: hashText(tutorMessage),
      v22TurnScore: getTurnScore(tutorScores, turn),
      dialogueCharisma: row.tutor_charisma_overall_score,
      register: traceTurn.engagementState?.selected_register || traceTurn.engagementState?.selected_mode || '',
      learnerSignal: traceTurn.engagementState?.learner_signal || '',
      agencyReturnPasses: traceTurn.agencyReturnVerification?.passes === true ? true : traceTurn.agencyReturnVerification ? false : null,
      parseStatus: traceTurn.construction?.parse_status || '',
      passesRequired: row.passes_required === 1,
      passesForbidden: row.passes_forbidden === 1,
    };
  });

  return rawSlices.map((slice, index) => ({
    ...slice,
    dialogueExcerpt: getDialogueExcerpt(rawSlices, index),
  }));
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return { version: 1, scores: {} };
  return parseJson(fs.readFileSync(CACHE_PATH, 'utf8'), { version: 1, scores: {} });
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

function attachCachedScores(slices, cache) {
  return slices.map((slice) => {
    const cached = cache.scores?.[slice.key];
    if (cached?.tutorMessageHash === slice.tutorMessageHash) {
      return {
        ...slice,
        sliceCharisma: cached.overall,
        sliceCharismaScores: cached.scores,
        sliceCharismaSummary: cached.summary,
        sliceCharismaJudgeModel: cached.judgeModel,
        sliceCharismaScoredAt: cached.scoredAt,
      };
    }
    return slice;
  });
}

async function scoreSlice(slice, judgeModel) {
  const prompt = buildTutorCharismaEvaluationPrompt({
    tutorMessage: slice.tutorMessage,
    dialogueExcerpt: slice.dialogueExcerpt,
    scenarioName: slice.scenarioId,
    scenarioDescription:
      slice.phase === 'post_adaptation'
        ? 'Post-adaptation tutor turn after the learner challenges the instructional register.'
        : 'Pre-adaptation instructional setup turn before the learner challenges the register.',
    recognitionMode: false,
  });
  const judgeOverrides = judgeModel ? { judgeOverride: { model: judgeModel } } : {};
  const responseText = await callJudgeModel(prompt, judgeOverrides);
  const parsed = parseJudgeResponse(responseText);
  const overall = calculateTutorCharismaScore(parsed.scores);
  if (overall == null) {
    throw new Error(`No valid charisma score for ${slice.key}`);
  }
  return {
    overall,
    scores: parsed.scores,
    summary: parsed.summary || null,
    judgeModel: judgeModel || 'default',
    scoredAt: new Date().toISOString(),
    tutorMessageHash: slice.tutorMessageHash,
  };
}

function aggregate(slices, groupBy) {
  const groups = new Map();
  for (const slice of slices) {
    const key = groupBy(slice);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(slice);
  }
  return [...groups.entries()].map(([key, rows]) => ({
    key,
    n: rows.length,
    v22: mean(rows.map((row) => row.v22TurnScore)),
    charisma: mean(rows.map((row) => row.sliceCharisma)),
    charismaSd: sampleSd(rows.map((row) => row.sliceCharisma)),
    agencyPassRate: mean(rows.map((row) => (row.agencyReturnPasses === true ? 1 : row.agencyReturnPasses === false ? 0 : null))),
  }));
}

function pairedDeltas(slices) {
  const byRow = new Map();
  for (const slice of slices) {
    if (!byRow.has(slice.rowId)) byRow.set(slice.rowId, []);
    byRow.get(slice.rowId).push(slice);
  }
  return [...byRow.values()]
    .map((rows) => {
      const pre = rows.find((row) => row.turn === 0);
      const post = rows.find((row) => row.turn === 1);
      if (!pre || !post) return null;
      return {
        runId: post.runId,
        profileName: post.profileName,
        profileLabel: post.profileLabel,
        profileGroup: post.profileGroup,
        postRegister: post.register || 'unrouted',
        v22Delta: post.v22TurnScore - pre.v22TurnScore,
        charismaDelta:
          post.sliceCharisma != null && pre.sliceCharisma != null ? post.sliceCharisma - pre.sliceCharisma : null,
        preCharisma: pre.sliceCharisma,
        postCharisma: post.sliceCharisma,
      };
    })
    .filter(Boolean);
}

function decisionSummary(slices) {
  const post = slices.filter((slice) => slice.phase === 'post_adaptation');
  const routerPost = post.filter((slice) => slice.profileGroup === 'router_register_family');
  const nonRouterPost = post.filter((slice) => slice.profileGroup === 'non_router_charisma_control');
  const budgetPost = post.filter((slice) => slice.profileGroup === 'budget_floor');
  const deltas = pairedDeltas(slices);
  const routerDeltas = deltas.filter((row) => row.profileGroup === 'router_register_family');
  const nonRouterDeltas = deltas.filter((row) => row.profileGroup === 'non_router_charisma_control');

  const routerPostMean = mean(routerPost.map((slice) => slice.sliceCharisma));
  const nonRouterPostMean = mean(nonRouterPost.map((slice) => slice.sliceCharisma));
  const budgetPostMean = mean(budgetPost.map((slice) => slice.sliceCharisma));
  const routerDeltaMean = mean(routerDeltas.map((row) => row.charismaDelta));
  const nonRouterDeltaMean = mean(nonRouterDeltas.map((row) => row.charismaDelta));

  const allScored = slices.every((slice) => slice.sliceCharisma != null);
  let verdict = 'not_ready';
  const reasons = [];
  if (!allScored) {
    reasons.push('Some slices lack charisma scores.');
  } else {
    if (budgetPostMean != null && budgetPostMean < 40) {
      reasons.push('The budget floor fails the disinterested post-switch learner.');
    } else {
      reasons.push('The budget floor does not clearly fail the post-switch learner.');
    }

    if (nonRouterPostMean != null && routerPostMean != null && nonRouterPostMean >= routerPostMean - 2) {
      verdict = 'disconfirmed_current_causal_claim';
      reasons.push(
        'Non-router charismatic controls do not fail relative to router post-switch slices; they exceed the router-family post mean in this corpus.',
      );
    } else if (
      routerPostMean != null &&
      nonRouterPostMean != null &&
      routerDeltaMean != null &&
      nonRouterDeltaMean != null &&
      routerPostMean >= nonRouterPostMean + 5 &&
      routerDeltaMean >= nonRouterDeltaMean + 5
    ) {
      verdict = 'supported';
      reasons.push('Router post-switch slices beat non-router controls by at least 5 points on level and delta.');
    } else {
      verdict = 'inconclusive';
      reasons.push('Router slices do not clear the pre-registered level-and-delta margin over controls.');
    }
  }

  return {
    verdict,
    routerPostMean,
    nonRouterPostMean,
    budgetPostMean,
    routerDeltaMean,
    nonRouterDeltaMean,
    reasons,
  };
}

function buildReport({ slices, cache, scoreMissing, judgeModel }) {
  const switchSlices = slices.filter((slice) => slice.scenarioId === SWITCH_SCENARIO);
  const postAgg = aggregate(
    switchSlices.filter((slice) => slice.phase === 'post_adaptation'),
    (slice) => `${slice.profileGroup}:${slice.profileLabel}:${slice.register || 'unrouted'}`,
  ).sort((a, b) => a.key.localeCompare(b.key));
  const phaseAgg = aggregate(
    switchSlices,
    (slice) => `${slice.profileGroup}:${slice.phase}`,
  ).sort((a, b) => a.key.localeCompare(b.key));
  const deltas = pairedDeltas(switchSlices);
  const decision = decisionSummary(switchSlices);

  const lines = [];
  lines.push('# Charisma Desire Adaptation Slice Summary');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- Scenario: `charisma_desire_instruction_to_engagement_switch`');
  lines.push('- Unit: tutor turn slices, not whole transcripts.');
  lines.push('- Pre slice: turn 0 instructional setup.');
  lines.push('- Post slice: turn 1 after the learner says the clear steps feel like a worksheet.');
  lines.push(`- Slice charisma cache: \`${path.relative(ROOT, CACHE_PATH)}\``);
  lines.push(`- Judge for newly scored slices: \`${judgeModel || 'default'}\``);
  lines.push(`- Scored missing slices this run: ${scoreMissing ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Decision');
  lines.push('');
  lines.push(`- Verdict: \`${decision.verdict}\``);
  lines.push(`- Router post-switch charisma mean: ${fmt(decision.routerPostMean)}`);
  lines.push(`- Non-router charismatic-control post-switch charisma mean: ${fmt(decision.nonRouterPostMean)}`);
  lines.push(`- Budget floor post-switch charisma mean: ${fmt(decision.budgetPostMean)}`);
  lines.push(`- Router pre-to-post charisma delta mean: ${fmt(decision.routerDeltaMean)}`);
  lines.push(`- Non-router pre-to-post charisma delta mean: ${fmt(decision.nonRouterDeltaMean)}`);
  for (const reason of decision.reasons) lines.push(`- ${reason}`);
  lines.push('');
  lines.push('## Post-Switch Slice Aggregates');
  lines.push('');
  lines.push(
    markdownTable(
      ['Group/Profile/Register', 'n', 'slice charisma', 'charisma sd', 'v2.2 turn', 'agency pass rate'],
      postAgg.map((row) => [
        row.key,
        String(row.n),
        fmt(row.charisma),
        fmt(row.charismaSd),
        fmt(row.v22),
        fmt(row.agencyPassRate, 2),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Pre/Post Aggregates');
  lines.push('');
  lines.push(
    markdownTable(
      ['Group/Phase', 'n', 'slice charisma', 'charisma sd', 'v2.2 turn', 'agency pass rate'],
      phaseAgg.map((row) => [
        row.key,
        String(row.n),
        fmt(row.charisma),
        fmt(row.charismaSd),
        fmt(row.v22),
        fmt(row.agencyPassRate, 2),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Paired Deltas');
  lines.push('');
  lines.push(
    markdownTable(
      ['Run', 'Profile', 'Group', 'Post register', 'pre charisma', 'post charisma', 'delta charisma', 'delta v2.2'],
      deltas.map((row) => [
        row.runId,
        row.profileLabel,
        row.profileGroup,
        row.postRegister,
        fmt(row.preCharisma),
        fmt(row.postCharisma),
        fmt(row.charismaDelta),
        fmt(row.v22Delta),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Slice Rows');
  lines.push('');
  lines.push(
    markdownTable(
      ['Run', 'Profile', 'Turn', 'Phase', 'Register', 'v2.2', 'slice charisma', 'dialogue charisma', 'Agency', 'Excerpt'],
      switchSlices.map((slice) => [
        slice.runId,
        slice.profileLabel,
        String(slice.turn),
        slice.phase,
        slice.register || 'unrouted',
        fmt(slice.v22TurnScore),
        fmt(slice.sliceCharisma),
        fmt(slice.dialogueCharisma),
        slice.agencyReturnPasses == null ? '' : slice.agencyReturnPasses ? 'yes' : 'no',
        cleanCell(slice.tutorMessage, 120),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    'This report deliberately avoids whole-transcript charisma as the decision unit. It asks whether the post-switch register turn itself gains charisma relative to controls.',
  );
  lines.push('');
  lines.push(
    'Budget-floor failure is only a weak setup check. The stronger setup check is whether non-router charismatic controls fail on the same post-switch learner turn. Here they do not fail: their post-switch mean exceeds the router-family mean, so the current learner setup does not isolate register change as the cause of charisma.',
  );
  lines.push('');
  lines.push(`Cache entries: ${Object.keys(cache.scores || {}).length}`);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const { flags } = parseArgs(process.argv);
  const checkOnly = flags.check === true;
  const scoreMissing = flags['score-missing'] === true;
  const force = flags.force === true;
  const limit = typeof flags.limit === 'string' ? Number.parseInt(flags.limit, 10) : null;
  const judgeModel = typeof flags.judge === 'string' ? flags.judge : 'claude-code.sonnet';
  const runIds = typeof flags.runs === 'string' ? flags.runs.split(',').map((id) => id.trim()).filter(Boolean) : TARGET_RUN_IDS;

  loadTutorCharismaRubric();
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const placeholders = runIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT
         id,
         run_id,
         scenario_id,
         profile_name,
         dialogue_id,
         suggestions,
         tutor_scores,
         id_construction_trace,
         tutor_charisma_overall_score,
         passes_required,
         passes_forbidden,
         success
       FROM evaluation_results
       WHERE run_id IN (${placeholders})
         AND scenario_id = ?
         AND success = 1
       ORDER BY scenario_id, profile_name, run_id, id`,
    )
    .all(...runIds, SWITCH_SCENARIO);

  const scenarios = loadScenarioData();
  let slices = rows.flatMap((row) => makeSlices(row, scenarios));
  const cache = loadCache();
  slices = attachCachedScores(slices, cache);

  if (scoreMissing) {
    const toScore = slices.filter((slice) => {
      if (slice.scenarioId !== SWITCH_SCENARIO) return false;
      if (force) return true;
      return slice.sliceCharisma == null;
    });
    const bounded = limit && Number.isFinite(limit) ? toScore.slice(0, limit) : toScore;
    console.log(`Scoring ${bounded.length}/${toScore.length} missing adaptation slice(s) with ${judgeModel}`);
    for (let i = 0; i < bounded.length; i += 1) {
      const slice = bounded[i];
      process.stdout.write(
        `[${i + 1}/${bounded.length}] ${slice.runId} ${slice.profileLabel} turn ${slice.turn} ${slice.phase} ... `,
      );
      const scored = await scoreSlice(slice, judgeModel);
      cache.scores[slice.key] = scored;
      slice.sliceCharisma = scored.overall;
      slice.sliceCharismaScores = scored.scores;
      slice.sliceCharismaSummary = scored.summary;
      slice.sliceCharismaJudgeModel = scored.judgeModel;
      slice.sliceCharismaScoredAt = scored.scoredAt;
      saveCache(cache);
      console.log(fmt(scored.overall));
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const report = buildReport({ slices, cache, scoreMissing, judgeModel });
  if (!checkOnly) fs.writeFileSync(REPORT_PATH, report);

  const missing = slices.filter((slice) => slice.scenarioId === SWITCH_SCENARIO && slice.sliceCharisma == null);
  const decision = decisionSummary(slices.filter((slice) => slice.scenarioId === SWITCH_SCENARIO));
  console.log(`Rows: ${rows.length}`);
  console.log(`Slices: ${slices.length}`);
  console.log(`Missing slice charisma: ${missing.length}`);
  console.log(`Verdict: ${decision.verdict}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  if (checkOnly && missing.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
