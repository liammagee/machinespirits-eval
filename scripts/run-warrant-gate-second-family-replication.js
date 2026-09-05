#!/usr/bin/env node

/**
 * Second-family replication of the passive warrant-gate main block.
 *
 * Same design as the first block (relay 096, paper §6.25): 72 dialogues,
 * three conditions, two worlds, eight turns, low-agency learner, two decision
 * readers at batch size 1. Only the model seats change: tutor and learner on
 * claude-code.opus-5; readers on codex.gpt-5.6-sol. The analysis seat stays on
 * codex.gpt-5.6-luna, the first-block model (amendment of 2026-09-05: Opus 5 in
 * that seat failed the strict semantic-event validator on record-entry turns).
 *
 * The default invocation prints the plan and makes zero model calls. The paid
 * path needs --accept-charges and --go "<the words the user wrote in chat>";
 * the launcher records them as given. Provenance is recorded, never enforced:
 * the run ledger writes down the commit, tree and dirty flag, and nothing here
 * refuses to run over them.
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { createDurablePaidModelAttemptBudget } from '../services/durablePaidModelAttemptBudget.js';
import { admitPaidStudyLaunch, sealInterruptedPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';

import { collectAdaptiveWarrantStudyJobResult } from './run-adaptive-warrant-baseline-study.js';
import { auditOutcomeMainBlockSeedFreshness } from './run-adaptive-warrant-outcome-main-block.js';
import {
  OUTCOME_PILOT_PER_DIALOGUE_CAP,
  buildOutcomePilotJobs,
  guardOutcomeAnnotationFingerprints,
  guardOutcomeDialogueLearnerAnalysisCoverage,
  preflightOutcomePilotPromptAudits,
  prepareOutcomeCases,
  writeOutcomeCorpusArtifacts,
  writeOutcomePilotAssemblyRunView,
} from './run-adaptive-warrant-outcome-pilot.js';
import {
  ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
  assembleAdaptiveWarrantAnnotationResponse,
  prepareAdaptiveWarrantAnnotationBatches,
} from './prepare-adaptive-warrant-annotation-batches.js';
import {
  OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  describeOutcomeMeasures7And8FromStoredEvents,
  extractOutcomeDialogueFromTraceRows,
  scoreOutcomeDecisionCases,
  scoreOutcomeDialogue,
} from './score-adaptive-warrant-outcome-study.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SECOND_FAMILY_STUDY_ID = 'warrant-gate-second-family-replication';
export const SECOND_FAMILY_RUN_SCHEMA = 'machinespirits.adaptation-refinement.warrant-outcome-second-family-run.v1';
export const SECOND_FAMILY_SCORE_SCHEMA = 'machinespirits.adaptation-refinement.warrant-outcome-second-family-score.v1';
export const SECOND_FAMILY_MANIFEST_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-outcome-second-family-manifest.v1';
export const DEFAULT_SECOND_FAMILY_MANIFEST =
  'docs/adaptation-refinement/outcome-study-a1/second-family-replication-manifest.json';
export const DEFAULT_SECOND_FAMILY_REGISTRATION =
  'docs/adaptation-refinement/warrant-gate-second-family-replication.md';
export const SECOND_FAMILY_CEILING = 3360;
export const SECOND_FAMILY_READER_IDS = Object.freeze(['decision-reader-a', 'decision-reader-b']);
export const SECOND_FAMILY_READER_ALLOWANCE = 48;
export const SECOND_FAMILY_TURNS_PER_DIALOGUE = 8;
// Registered rail: one disclosed retake per quarantined dialogue. A dialogue past
// that is dropped at the next recovery and the block continues without it
// (fourth amendment, 2026-09-05, dialogue 53).
export const SECOND_FAMILY_RETAKES_PER_DIALOGUE = 1;
export const SECOND_FAMILY_SEATS = Object.freeze({
  tutor: 'claude-code.opus-5',
  analysis: 'codex.gpt-5.6-luna',
  learner: 'claude-code.opus-5',
  decision_readers: 'codex.gpt-5.6-sol',
});
export const SECOND_FAMILY_REPLICATION_BAR = Object.freeze({
  r1_minimum_dialogue_gap: 5,
  r2_minimum_points: 10,
});
const DEFAULT_STUDY_STATE_ROOT = path.join(ROOT, '.tutor-stub-traces', '.paid-study-state');
const READER_SYSTEM_PROMPT =
  'You are one isolated independent research reader. Use only the supplied frozen packet. Return exactly the schema-bound JSON object and do not use tools.';
const BATCH_RESPONSE_FIELDS = Object.freeze([
  'schema',
  'reader_id',
  'batch_id',
  'study_id',
  'corpus_sha256',
  'cases_by_sample_id',
]);
const READER_TRANSPORT_RETRIES_PER_BATCH = 3;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function resolveFromRoot(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ROOT, filePath);
}

function relativeToRoot(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).split(path.sep).join('/');
}

function nowIso() {
  return new Date().toISOString();
}

function parseModelRef(modelRef) {
  const [provider, ...rest] = String(modelRef || '').split('.');
  const model = rest.join('.');
  if (!provider || !model) throw new Error(`model ref ${modelRef} must read provider.model`);
  return { provider, model };
}

// ---------------------------------------------------------------------------
// Manifest and plan
// ---------------------------------------------------------------------------

export function loadSecondFamilyManifest(manifestPath = DEFAULT_SECOND_FAMILY_MANIFEST) {
  const resolved = resolveFromRoot(manifestPath);
  const manifest = readJson(resolved);
  if (manifest.schema !== SECOND_FAMILY_MANIFEST_SCHEMA) throw new Error('second-family manifest schema mismatch');
  if (manifest.study_id !== SECOND_FAMILY_STUDY_ID) throw new Error('second-family manifest study_id mismatch');
  const assignment = manifest.interleaved_condition_assignment || [];
  const expectedDialogues = manifest.assignment.dialogues;
  if (assignment.length !== expectedDialogues) {
    throw new Error(`manifest lists ${assignment.length} dialogues, registered ${expectedDialogues}`);
  }
  const perCondition = new Map();
  for (const row of assignment) perCondition.set(row.condition, (perCondition.get(row.condition) || 0) + 1);
  for (const condition of manifest.conditions) {
    if (perCondition.get(condition) !== manifest.assignment.dialogues_per_condition) {
      throw new Error(`condition ${condition} does not carry ${manifest.assignment.dialogues_per_condition} dialogues`);
    }
  }
  const seeds = new Set(assignment.map((row) => row.seed));
  if (seeds.size !== manifest.seeds.length || manifest.seeds.some((seed) => !seeds.has(seed))) {
    throw new Error('manifest assignment seeds do not match the registered seed list');
  }
  const expectedCases = expectedDialogues * manifest.assignment.turns_per_dialogue;
  if (manifest.case_extraction.expected_case_count !== expectedCases) {
    throw new Error(
      `manifest expects ${manifest.case_extraction.expected_case_count} cases, design gives ${expectedCases}`,
    );
  }
  const plannedReads = expectedCases * manifest.channels.decision.readers.length;
  if (manifest.channels.decision.planned_calls !== plannedReads) {
    throw new Error(`manifest plans ${manifest.channels.decision.planned_calls} reads, design gives ${plannedReads}`);
  }
  return { manifest, manifestPath: resolved };
}

export function describeSecondFamilyPlan(manifest) {
  const perCondition = Object.fromEntries(
    manifest.conditions.map((condition) => [
      condition,
      manifest.interleaved_condition_assignment.filter((row) => row.condition === condition).length,
    ]),
  );
  const generationCap = manifest.assignment.dialogues * OUTCOME_PILOT_PER_DIALOGUE_CAP;
  const readerPlan = manifest.channels.decision.planned_calls;
  const readerAllowance = manifest.channels.decision.failed_attempt_allowance;
  return {
    study_id: manifest.study_id,
    dialogues: manifest.assignment.dialogues,
    dialogues_per_condition: perCondition,
    dialogues_per_seed: manifest.assignment.dialogues_per_seed,
    turns_per_dialogue: manifest.assignment.turns_per_dialogue,
    learner_profile: manifest.assignment.learner_profile,
    worlds: manifest.worlds.map((world) => world.id),
    seeds: [...manifest.seeds],
    cases: manifest.case_extraction.expected_case_count,
    readers: [...manifest.channels.decision.readers],
    reader_batch_size: manifest.channels.decision.batch_size,
    reader_calls_planned: readerPlan,
    reader_failed_attempt_allowance: readerAllowance,
    reader_attempt_cap: readerPlan + readerAllowance,
    generation_cap_per_dialogue: OUTCOME_PILOT_PER_DIALOGUE_CAP,
    generation_cap: generationCap,
    ceiling: manifest.planned_calls.ceiling,
    seats: {
      tutor: manifest.seats.tutor,
      analysis: manifest.seats.analysis,
      learner: manifest.seats.learner,
      decision_readers: manifest.seats.decision_readers,
    },
    replication_bar: { ...SECOND_FAMILY_REPLICATION_BAR },
    zero_model_calls: true,
  };
}

export function renderSecondFamilyPlan(plan) {
  const lines = [
    `Study: ${plan.study_id}`,
    `Dialogues: ${plan.dialogues} (${Object.entries(plan.dialogues_per_condition)
      .map(([condition, count]) => `${condition} ${count}`)
      .join(', ')}); ${plan.dialogues_per_seed} per seed; ${plan.turns_per_dialogue} turns each`,
    `Worlds: ${plan.worlds.join(', ')}; seeds ${plan.seeds[0]}-${plan.seeds.at(-1)}; learner ${plan.learner_profile}`,
    `Seats: tutor ${plan.seats.tutor}, analysis ${plan.seats.analysis}, learner ${plan.seats.learner}, readers ${plan.seats.decision_readers}`,
    `Decision cases: ${plan.cases}; readers ${plan.readers.join(' + ')} at batch size ${plan.reader_batch_size}; ${plan.reader_calls_planned} planned reads + ${plan.reader_failed_attempt_allowance} failed-attempt allowance`,
    `Generation cap: ${plan.generation_cap_per_dialogue} per dialogue, ${plan.generation_cap} total; ceiling ${plan.ceiling}`,
    `Replication bar: R1 gated minus best control >= ${plan.replication_bar.r1_minimum_dialogue_gap} dialogues with a break; R2 gated consensus correctness >= both controls + ${plan.replication_bar.r2_minimum_points} points`,
    'Model calls made by this invocation: 0',
  ];
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export function buildSecondFamilyJobs({
  manifest,
  rootDir,
  dryRun = false,
  learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  seats = SECOND_FAMILY_SEATS,
} = {}) {
  const worlds = manifest.worlds.map((world) => ({ ...world, path: resolveFromRoot(world.path) }));
  return buildOutcomePilotJobs({
    manifest: { ...manifest, worlds },
    rootDir,
    dryRun,
    studyLabel: 'second-family',
    learnerProfile,
    seats: { tutor: seats.tutor, analysis: seats.analysis, learner: seats.learner },
  });
}

// ---------------------------------------------------------------------------
// Replication bar
// ---------------------------------------------------------------------------

function countBreaks(dialogueScores, condition) {
  const rows = dialogueScores.filter((row) => row.condition === condition);
  return {
    dialogues: rows.length,
    with_break: rows.filter((row) => row.measure_4_deference_break.first_turn !== null).length,
    persisting_break: rows.filter((row) => row.measure_4_deference_break.persists_to_end).length,
  };
}

export function judgeSecondFamilyReplication({
  dialogueScores = [],
  decisionByCondition = {},
  bar = SECOND_FAMILY_REPLICATION_BAR,
} = {}) {
  const breaks = {
    bare: countBreaks(dialogueScores, 'bare'),
    gated: countBreaks(dialogueScores, 'gated'),
    standing_permission: countBreaks(dialogueScores, 'standing_permission'),
  };
  const bestControlBreaks = Math.max(breaks.bare.with_break, breaks.standing_permission.with_break);
  const r1Gap = breaks.gated.with_break - bestControlBreaks;
  const r1Verdict =
    r1Gap >= bar.r1_minimum_dialogue_gap ? 'replicated' : r1Gap > 0 ? 'direction_only' : 'not_replicated';

  const rate = (condition) => {
    const value = decisionByCondition[condition]?.correctness_rate;
    return Number.isFinite(value) ? value : null;
  };
  const gatedRate = rate('gated');
  const bareRate = rate('bare');
  const standingRate = rate('standing_permission');
  const rates = { bare: bareRate, gated: gatedRate, standing_permission: standingRate };
  let r2Verdict = 'not_computable';
  let r2MarginPoints = null;
  if (gatedRate !== null && bareRate !== null && standingRate !== null) {
    r2MarginPoints = Math.round((gatedRate - Math.max(bareRate, standingRate)) * 1000) / 10;
    r2Verdict =
      r2MarginPoints >= bar.r2_minimum_points ? 'replicated' : r2MarginPoints > 0 ? 'direction_only' : 'not_replicated';
  }
  return {
    r1_deference_break: {
      name: 'gated dialogues with a deference break exceed the best control',
      minimum_dialogue_gap: bar.r1_minimum_dialogue_gap,
      by_condition: breaks,
      best_control_with_break: bestControlBreaks,
      gap: r1Gap,
      verdict: r1Verdict,
    },
    r2_decision_correctness: {
      name: 'gated consensus decision correctness exceeds both controls',
      minimum_points: bar.r2_minimum_points,
      correctness_rate_by_condition: rates,
      margin_points: r2MarginPoints,
      verdict: r2Verdict,
    },
    overall: r1Verdict === 'replicated' && r2Verdict === 'replicated' ? 'replicated' : 'not_replicated',
  };
}

// Report-only descriptions from the stored generation-time events: arming and
// challenge turns per gated dialogue (P1' and P2b of relay 096) and the number
// of challenges the standing-permission learner accepted.
export function describeSecondFamilyArming({ dialogueId, condition, rows }) {
  const turns = (rows || [])
    .filter((row) => row?.type === 'turn_complete' && row.turnRecord)
    .map((row) => row.turnRecord)
    .sort((left, right) => Number(left.turn) - Number(right.turn));
  const basisOf = (record) =>
    record.warrant_gate_decision?.warrant_basis ?? record.warrantGateDecision?.warrant_basis ?? null;
  const familyOf = (record) =>
    record.actual_action_family ||
    record.delivered_action_family ||
    record.deliveredResponseConfiguration?.action_family ||
    record.responseConfiguration?.action_family ||
    null;
  const armedTurns = turns
    .filter((record) => String(basisOf(record) || '').startsWith('sustained_deference:'))
    .map((record) => Number(record.turn));
  const challengeTurns = turns
    .filter((record) => familyOf(record) === 'challenge_resistance')
    .map((record) => Number(record.turn));
  return {
    dialogue_id: dialogueId,
    condition,
    armed_turns: armedTurns,
    first_armed_turn: armedTurns[0] ?? null,
    challenge_turns: challengeTurns,
    first_challenge_turn: challengeTurns[0] ?? null,
    armed_and_challenged: armedTurns.length > 0 && challengeTurns.length > 0,
  };
}

export function summarizeSecondFamilyReportOnly({ arming = [], dialogueScores = [] } = {}) {
  const gated = arming.filter((row) => row.condition === 'gated');
  const scoresById = new Map(dialogueScores.map((row) => [row.dialogue_id, row]));
  const armedAndChallenged = gated.filter((row) => row.armed_and_challenged);
  const gatedWithBreak = gated.filter(
    (row) => scoresById.get(row.dialogue_id)?.measure_4_deference_break.first_turn !== null,
  );
  const breakWithinThreeAfterChallenge = gatedWithBreak.filter((row) => {
    const breakTurn = scoresById.get(row.dialogue_id).measure_4_deference_break.first_turn;
    return (
      row.first_challenge_turn !== null &&
      breakTurn > row.first_challenge_turn &&
      breakTurn - row.first_challenge_turn <= 3
    );
  });
  const standing = arming.filter((row) => row.condition === 'standing_permission');
  return {
    p1_prime_armed_and_challenged: {
      gated_dialogues: gated.length,
      armed_and_challenged: armedAndChallenged.length,
      rate: gated.length ? armedAndChallenged.length / gated.length : null,
      first_block_rate: 'see paper §6.25',
    },
    p2b_break_within_three_turns_after_first_challenge: {
      gated_dialogues_with_break: gatedWithBreak.length,
      within_three_turns_after_first_challenge: breakWithinThreeAfterChallenge.length,
    },
    standing_permission_challenge_turns: standing.reduce((total, row) => total + row.challenge_turns.length, 0),
    gated_challenge_turns: gated.reduce((total, row) => total + row.challenge_turns.length, 0),
    status: 'report_only',
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function spawnLogged(command, { cwd = ROOT, logPath = null, env = {} } = {}) {
  return new Promise((resolve) => {
    if (logPath) fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const log = logPath ? fs.createWriteStream(logPath, { flags: 'a' }) : null;
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: { ...process.env, NO_COLOR: '1', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => log?.write(chunk));
    child.stderr.on('data', (chunk) => log?.write(chunk));
    let error = null;
    child.on('error', (cause) => {
      error = cause.message;
    });
    child.on('close', (status, signal) => {
      log?.end();
      resolve({ status, signal, error, logPath });
    });
  });
}

function countReservedEvents(tracePath) {
  if (!tracePath || !fs.existsSync(tracePath)) return 0;
  return fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(
      (line) =>
        line.includes('"type":"model_call_budget_reserved"') || line.includes('"type": "model_call_budget_reserved"'),
    ).length;
}

function completedDialogue(checkpoint, jobId) {
  return checkpoint.dialogues.find((row) => row.id === jobId && row.status === 'complete') || null;
}

function droppedDialogue(checkpoint, jobId) {
  return checkpoint.dialogues.some((row) => row.id === jobId && row.status === 'dropped');
}

// The registered design is 72 dialogues. A dropped dialogue lowers every
// downstream count by its eight turns; the manifest keeps the registered plan.
export function describeSecondFamilyBlockCounts({ manifest, dialogues = [] } = {}) {
  const completed = dialogues.filter((row) => row.status === 'complete');
  const dropped = dialogues.filter((row) => row.status === 'dropped');
  const readers = manifest.channels.decision.readers.length;
  const cases = completed.length * manifest.assignment.turns_per_dialogue;
  const reads = cases * readers;
  return {
    registered_dialogues: manifest.assignment.dialogues,
    completed: completed.length,
    dropped: dropped.map((row) => ({ id: row.id, order: row.order, condition: row.condition, attempts: row.attempts })),
    cases,
    reads,
    reader_attempt_cap: reads + manifest.channels.decision.failed_attempt_allowance,
  };
}

export async function runSecondFamilyGeneration({
  jobs,
  checkpoint,
  admission,
  persist,
  runDialogue = spawnLogged,
  collectJobResult = collectAdaptiveWarrantStudyJobResult,
  perDialogueCap = OUTCOME_PILOT_PER_DIALOGUE_CAP,
  maximumTurn = SECOND_FAMILY_TURNS_PER_DIALOGUE,
  retakesPerDialogue = SECOND_FAMILY_RETAKES_PER_DIALOGUE,
  log = () => {},
} = {}) {
  for (const job of jobs) {
    if (completedDialogue(checkpoint, job.id)) continue;
    if (droppedDialogue(checkpoint, job.id)) continue;
    const priorAttempts = checkpoint.dialogues.filter((row) => row.id === job.id).length;
    if (priorAttempts > retakesPerDialogue) {
      const droppedRow = {
        id: job.id,
        order: job.ordinal,
        world: job.world,
        seed: job.seed,
        condition: job.condition,
        status: 'dropped',
        attempts: priorAttempts,
        retakes_permitted: retakesPerDialogue,
        dropped_at: nowIso(),
        reserved_calls: 0,
        error: `dialogue used its original attempt and its ${retakesPerDialogue} registered retake(s); dropped from the block`,
      };
      checkpoint.dialogues.push(droppedRow);
      admission.record({ type: 'dialogue_dropped', dialogue_id: job.id, attempts: priorAttempts });
      persist();
      log(`dialogue ${job.id} dropped after ${priorAttempts} attempts; the block continues without it`);
      continue;
    }
    const capacity = admission.allocateModelAttemptCapacity(perDialogueCap, {
      unit_id: job.id,
      world_id: job.world,
      reservation_scope: 'per_dialogue_fail_before_call_ceiling',
    });
    const env = admission.attemptLedgerEnvironment({ unitId: job.id, capacity, maximumTurn });
    admission.record({
      type: 'dialogue_dispatched',
      dialogue_id: job.id,
      retake_of_quarantined_attempts: priorAttempts,
    });
    const started = nowIso();
    const processResult = await runDialogue(job.command, {
      cwd: ROOT,
      logPath: path.join(path.dirname(job.jobDir), '..', 'logs', `${job.id}.log`),
      env,
    });
    let row;
    try {
      row = collectJobResult(job, processResult);
    } catch (error) {
      row = { childStatus: 'evidence_invalid', error: error.message, tracePath: null, turnCount: 0 };
    }
    const reservations = countReservedEvents(row.tracePath);
    admission.releaseModelAttemptCapacity(capacity, { unit_id: job.id, reserved_calls: reservations });
    const coverageGuard = guardOutcomeDialogueLearnerAnalysisCoverage(row);
    const complete =
      processResult.status === 0 &&
      row.childStatus === 'ok' &&
      row.turnCount === maximumTurn &&
      coverageGuard.status === 'passed';
    const checkpointRow = {
      id: job.id,
      order: job.ordinal,
      world: job.world,
      seed: job.seed,
      condition: job.condition,
      status: complete ? 'complete' : 'quarantined',
      retake_of_quarantined_attempts: priorAttempts,
      started_at: started,
      completed_at: nowIso(),
      reserved_calls: reservations,
      run_record_path: path.join(job.jobDir, 'run-state.json'),
      trace_path: row.tracePath || null,
      learner_analysis_coverage_guard: coverageGuard,
      error: complete
        ? null
        : coverageGuard.status === 'failed'
          ? coverageGuard.reason
          : row.error || processResult.error || `child exit ${processResult.status}`,
      result: row,
    };
    checkpoint.dialogues.push(checkpointRow);
    admission.record({
      type: complete ? 'dialogue_complete' : 'dialogue_quarantined',
      dialogue_id: job.id,
      reserved_calls: reservations,
      error: checkpointRow.error,
    });
    persist();
    if (!complete) {
      const error = new Error(`dialogue ${job.id} quarantined: ${checkpointRow.error}`);
      error.code = 'dialogue_quarantined';
      error.recoveryPermitted = true;
      throw error;
    }
  }
  return checkpoint.dialogues;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

function parseJsonObject(text, batchId) {
  try {
    const value = JSON.parse(String(text || '').trim());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch (error) {
    throw new Error(`${batchId} returned invalid JSON: ${error.message}`);
  }
}

function exactFields(value, expected, label) {
  const actual = Object.keys(value || {}).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} must contain exactly ${expected.join(', ')}`);
  }
}

export function acceptSecondFamilyReaderResponse({ rawText, manifest, reader, batch }) {
  const parsed = parseJsonObject(rawText, batch.batch_id);
  exactFields(parsed, BATCH_RESPONSE_FIELDS, `${batch.batch_id} model response`);
  if (
    parsed.schema !== ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA ||
    parsed.reader_id !== reader.reader_id ||
    parsed.batch_id !== batch.batch_id ||
    parsed.study_id !== manifest.study_id ||
    parsed.corpus_sha256 !== manifest.corpus.sha256
  ) {
    throw new Error(`${batch.batch_id} model response binding mismatch`);
  }
  const responseIds = Object.keys(parsed.cases_by_sample_id || {}).sort();
  const expectedIds = [...batch.required_sample_ids].sort();
  if (JSON.stringify(responseIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`${batch.batch_id} model response sample-id mismatch`);
  }
  return parsed;
}

function completedBatch(run, readerId, batchId) {
  return run.batches.find((row) => row.reader_id === readerId && row.batch_id === batchId && row.status === 'complete');
}

export async function runSecondFamilyReaders({
  collectionManifest,
  collectionManifestPath,
  outputDir,
  runPath,
  run,
  budget,
  readerModel = SECOND_FAMILY_SEATS.decision_readers,
  attemptCap,
  callModel = callAIWithCliBridge,
  effort = 'medium',
  persist = () => {},
} = {}) {
  const { provider, model } = parseModelRef(readerModel);
  const resolvedOutput = path.resolve(outputDir);
  for (const reader of collectionManifest.readers) {
    for (const batch of reader.batches) {
      if (completedBatch(run, reader.reader_id, batch.batch_id)) continue;
      let transportFailures = 0;
      while (true) {
        if (run.calls_attempted >= attemptCap) {
          run.status = 'incomplete_reader_attempt_cap';
          atomicWriteJson(runPath, run);
          const error = new Error(`reader attempt cap ${attemptCap} reached`);
          error.recoveryPermitted = false;
          throw error;
        }
        const packet = readJson(batch.packet_path);
        const outputSchema = readJson(batch.output_schema_path);
        // The budget adapter keeps the attempt lifecycle on itself; the
        // reservation it returns is a frozen record with no methods. The
        // first paid reader call of the second family (2026-09-05) died on
        // `reservation.markDispatched is not a function`, masked by the same
        // error from `reservation.fail` in the catch, before any model call.
        const reservation = budget.reserve({
          role: 'decision_reader',
          unitId: `${reader.reader_id}:${batch.batch_id}`,
        });
        run.calls_attempted += 1;
        run.exposed_sample_ids = [...new Set([...run.exposed_sample_ids, ...batch.required_sample_ids])].sort();
        atomicWriteJson(runPath, run);
        const started = Date.now();
        let rawResponse = null;
        let result = null;
        try {
          budget.markDispatched();
          result = await callModel(
            { provider, model },
            READER_SYSTEM_PROMPT,
            JSON.stringify(packet),
            `second-family-${reader.reader_id}-${batch.batch_id}`,
            {
              outputSchema,
              effort,
              timeoutMs: 600_000,
              maxStdoutBytes: 512_000,
              maxStderrBytes: 64_000,
            },
          );
          rawResponse = String(result?.text || '');
          if (!rawResponse.trim())
            throw Object.assign(new Error(`${batch.batch_id} returned no text`), { transport: true });
          const parsed = acceptSecondFamilyReaderResponse({
            rawText: rawResponse,
            manifest: collectionManifest,
            reader,
            batch,
          });
          const outputPath = path.join(resolvedOutput, reader.reader_id, batch.expected_response_filename);
          atomicWriteJson(outputPath, parsed);
          budget.persistResponse(outputPath);
          budget.complete();
          run.calls_completed += 1;
          run.batches.push({
            reader_id: reader.reader_id,
            batch_id: batch.batch_id,
            attempt_id: reservation.attemptId || null,
            status: 'complete',
            packet_sha256: batch.packet_sha256,
            output_schema_sha256: batch.output_schema_sha256,
            response_path: outputPath,
            response_sha256: fileSha256(outputPath),
            latency_ms: Date.now() - started,
            returned_provider: result.provider || null,
            returned_model: result.model || null,
            model_attestation_basis: result.modelAttestationBasis || null,
            model_independently_attested: result.modelIndependentlyAttested === true,
            prohibited_tool_event_count: Number(result.prohibitedToolEventCount || 0),
          });
          atomicWriteJson(runPath, run);
          persist();
          break;
        } catch (error) {
          budget.fail(error);
          const transport = rawResponse === null || error.transport === true;
          const failedRow = {
            reader_id: reader.reader_id,
            batch_id: batch.batch_id,
            attempt_id: reservation.attemptId || null,
            status: 'failed',
            failure_kind: transport ? 'transport_response_free' : 'contract',
            packet_sha256: batch.packet_sha256,
            output_schema_sha256: batch.output_schema_sha256,
            latency_ms: Date.now() - started,
            error: error.message,
            exposed_sample_ids: [...batch.required_sample_ids],
          };
          if (!transport) {
            const quarantinePath = path.join(
              resolvedOutput,
              'quarantine',
              reader.reader_id,
              `${batch.batch_id}.attempt-${run.calls_attempted}.txt`,
            );
            fs.mkdirSync(path.dirname(quarantinePath), { recursive: true });
            fs.writeFileSync(quarantinePath, rawResponse);
            failedRow.quarantine_path = quarantinePath;
            failedRow.quarantine_sha256 = fileSha256(quarantinePath);
          }
          run.batches.push(failedRow);
          atomicWriteJson(runPath, run);
          persist();
          if (transport && transportFailures < READER_TRANSPORT_RETRIES_PER_BATCH) {
            transportFailures += 1;
            continue;
          }
          run.status = transport ? 'incomplete_transport_failure' : 'incomplete_contract_failure';
          atomicWriteJson(runPath, run);
          const stop = new Error(
            transport
              ? `reader ${reader.reader_id} batch ${batch.batch_id}: ${READER_TRANSPORT_RETRIES_PER_BATCH + 1} response-free attempts`
              : `reader ${reader.reader_id} batch ${batch.batch_id} returned a response outside the contract; quarantined at ${failedRow.quarantine_path}`,
          );
          stop.code = transport ? 'reader_transport_failure' : 'reader_contract_failure';
          stop.recoveryPermitted = true;
          throw stop;
        }
      }
    }
  }
  run.status = 'complete';
  run.completed_at = nowIso();
  run.collection_manifest_sha256 = fileSha256(collectionManifestPath);
  atomicWriteJson(runPath, run);
  persist();
  return run;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function scoreSecondFamily({ completed, dropped = [], built, assembled, assemblyRunPath }) {
  const keyBySampleId = new Map(built.key.cases.map((row) => [row.sample_id, row]));
  const left = new Map(assembled.get('decision-reader-a').cases.map((row) => [row.sample_id, row]));
  const right = new Map(assembled.get('decision-reader-b').cases.map((row) => [row.sample_id, row]));
  const decisionCases = built.corpus.cases.map((row) => {
    const key = keyBySampleId.get(row.sample_id);
    return {
      sample_id: row.sample_id,
      dialogue_id: key.job_id,
      turn: key.turn,
      condition: key.condition,
      reader_a_decision: left.get(row.sample_id)?.commitment_transition_warranted,
      reader_b_decision: right.get(row.sample_id)?.commitment_transition_warranted,
      logged_observe_decision: key.gate?.revision_warranted ?? key.shadow?.revision_warranted,
    };
  });
  const traceRowsById = new Map(completed.map((row) => [row.id, readJsonl(row.trace_path)]));
  const dialogues = completed.map((row) =>
    extractOutcomeDialogueFromTraceRows({
      dialogue_id: row.id,
      condition: row.condition,
      rows: traceRowsById.get(row.id),
    }),
  );
  const dialogueScores = dialogues.map(scoreOutcomeDialogue);
  const decisionOverall = scoreOutcomeDecisionCases(decisionCases, assemblyRunPath);
  const decisionByCondition = Object.fromEntries(
    ['bare', 'gated', 'standing_permission'].map((condition) => [
      condition,
      scoreOutcomeDecisionCases(
        decisionCases.filter((row) => row.condition === condition),
        assemblyRunPath,
      ),
    ]),
  );
  const arming = completed.map((row) =>
    describeSecondFamilyArming({ dialogueId: row.id, condition: row.condition, rows: traceRowsById.get(row.id) }),
  );
  return {
    schema: SECOND_FAMILY_SCORE_SCHEMA,
    zero_model_calls: true,
    study_id: SECOND_FAMILY_STUDY_ID,
    conditions_scored: [...new Set(dialogueScores.map((row) => row.condition))].sort(),
    dialogues_scored: completed.length,
    dialogues_dropped: dropped,
    replication: judgeSecondFamilyReplication({ dialogueScores, decisionByCondition }),
    measure_1_decision_correctness: { overall: decisionOverall, by_condition: decisionByCondition },
    dialogue_measures_2_6: dialogueScores,
    report_only: summarizeSecondFamilyReportOnly({ arming, dialogueScores }),
    arming_by_dialogue: arming,
    descriptive_measures_7_8: describeOutcomeMeasures7And8FromStoredEvents(built.key.cases),
  };
}

// ---------------------------------------------------------------------------
// Paid path
// ---------------------------------------------------------------------------

function resolveReaderPlanDirs(rootDir) {
  return {
    collectionDir: path.join(rootDir, 'decision-reader-collection'),
    runDir: path.join(rootDir, 'decision-reader-run'),
    runPath: path.join(rootDir, 'decision-reader-run', 'run.json'),
  };
}

function freshCheckpoint({ manifest, manifestPath, seats, learnerProfile, ceiling, admission, rootDir }) {
  return {
    schema: SECOND_FAMILY_RUN_SCHEMA,
    study_id: SECOND_FAMILY_STUDY_ID,
    status: 'launched',
    started_at: nowIso(),
    destination: rootDir,
    manifest: { path: relativeToRoot(manifestPath), sha256: fileSha256(manifestPath) },
    registration: { path: DEFAULT_SECOND_FAMILY_REGISTRATION },
    seats: { ...seats },
    learner_profile: learnerProfile,
    ceiling,
    provenance: {
      policy: 'recorded_not_enforced',
      source: { ...admission.source },
      authorization: { ...admission.authorization },
      sealed_inputs: {
        worlds: manifest.worlds.map((world) => ({
          id: world.id,
          path: world.path,
          sha256: fileSha256(resolveFromRoot(world.path)),
        })),
        standing_permission_menu: {
          path: manifest.standing_permission_menu.path,
          sha256: fileSha256(resolveFromRoot(manifest.standing_permission_menu.path)),
        },
        annotation_handbook: {
          path: manifest.annotation_handbook.path,
          sha256: fileSha256(resolveFromRoot(manifest.annotation_handbook.path)),
        },
      },
    },
    recovered_from: null,
    seed_freshness: null,
    prompt_preflight: null,
    dialogues: [],
    corpus: null,
    reader_collection: null,
    reader_run: null,
    score: null,
    stop: null,
  };
}

// Recovery inherits only what still describes the run. After an in-place
// amendment (2026-09-05: analysis seat, one seed) the predecessor's seed
// freshness and prompt preflight answer to inputs that no longer apply, so
// they are recomputed rather than copied. A completed dialogue generated
// under different generation seats is never reused: that would pool across
// the amendment, and the launch refuses instead.
const GENERATION_SEATS = ['tutor', 'analysis', 'learner'];

export function inheritCheckpoint({ previousDestination, fresh, manifest }) {
  const previousPath = path.join(previousDestination, 'checkpoint.json');
  if (!fs.existsSync(previousPath)) throw new Error(`recovery predecessor has no checkpoint at ${previousPath}`);
  const previous = readJson(previousPath);
  if (previous.schema !== SECOND_FAMILY_RUN_SCHEMA || previous.study_id !== SECOND_FAMILY_STUDY_ID) {
    throw new Error('recovery predecessor is not a second-family checkpoint');
  }
  const previousSeeds = Array.isArray(previous.seed_freshness?.seeds) ? previous.seed_freshness.seeds : null;
  const sameSeeds = previousSeeds !== null && JSON.stringify(previousSeeds) === JSON.stringify(manifest.seeds);
  const sameGenerationSeats = GENERATION_SEATS.every((seat) => previous.seats?.[seat] === fresh.seats[seat]);
  const completedUnderOtherSeats = sameGenerationSeats
    ? []
    : (previous.dialogues || []).filter((row) => row.status === 'complete').map((row) => row.id);
  if (completedUnderOtherSeats.length) {
    throw new Error(
      `recovery predecessor completed ${completedUnderOtherSeats.length} dialogue(s) under different generation seats ` +
        `(${GENERATION_SEATS.map((seat) => `${seat} ${previous.seats?.[seat]}`).join(', ')}); ` +
        'an amended seat set is a fresh block, not a continuation',
    );
  }
  return {
    ...fresh,
    recovered_from: {
      destination: previousDestination,
      checkpoint_sha256: fileSha256(previousPath),
      stop: previous.stop,
      lineage: [...(previous.recovered_from?.lineage || []), previousDestination],
      inherited: {
        seed_freshness: sameSeeds,
        prompt_preflight: sameGenerationSeats,
        previous_seeds: previousSeeds,
        previous_seats: previous.seats || null,
      },
    },
    seed_freshness: sameSeeds ? previous.seed_freshness : null,
    prompt_preflight: sameGenerationSeats ? previous.prompt_preflight : null,
    dialogues: [...previous.dialogues],
    corpus: previous.corpus,
    reader_collection: previous.reader_collection,
    reader_run: previous.reader_run,
  };
}

function readerRunSkeleton({ readerModel, sourceCommit }) {
  return {
    schema: 'machinespirits.adaptation-refinement.warrant-outcome-second-family-reader-run.v1',
    status: 'running',
    study_id: null,
    source_commit: sourceCommit,
    model: readerModel,
    started_at: nowIso(),
    completed_at: null,
    calls_attempted: 0,
    calls_completed: 0,
    exposed_sample_ids: [],
    batches: [],
  };
}

export async function executeSecondFamilyReplication({
  manifestPath = DEFAULT_SECOND_FAMILY_MANIFEST,
  registrationPath = DEFAULT_SECOND_FAMILY_REGISTRATION,
  goApproval,
  launchCommit = null,
  destination,
  recoveryFrom = null,
  studyStateRoot = DEFAULT_STUDY_STATE_ROOT,
  ceiling = SECOND_FAMILY_CEILING,
  learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  seats = SECOND_FAMILY_SEATS,
  runDialogue = spawnLogged,
  callModel = callAIWithCliBridge,
  collectJobResult = collectAdaptiveWarrantStudyJobResult,
  preflightPrompts = preflightOutcomePilotPromptAudits,
  seedFreshnessAudit = auditOutcomeMainBlockSeedFreshness,
  log = (line) => process.stderr.write(`${line}\n`),
} = {}) {
  const { manifest, manifestPath: resolvedManifestPath } = loadSecondFamilyManifest(manifestPath);
  const rootDir = path.resolve(destination);
  const admission = admitPaidStudyLaunch({
    root: ROOT,
    designPath: registrationPath,
    launchCommit,
    goApproval,
    spendCap: ceiling,
    destination: rootDir,
    ledgerName: 'run-ledger.jsonl',
    studyId: SECOND_FAMILY_STUDY_ID,
    studyStateRoot: path.resolve(studyStateRoot),
    recoveryFrom: recoveryFrom ? path.resolve(recoveryFrom) : null,
  });
  const checkpointPath = path.join(rootDir, 'checkpoint.json');
  const fresh = freshCheckpoint({
    manifest,
    manifestPath: resolvedManifestPath,
    seats,
    learnerProfile,
    ceiling,
    admission,
    rootDir,
  });
  const checkpoint = recoveryFrom
    ? inheritCheckpoint({ previousDestination: path.resolve(recoveryFrom), fresh, manifest })
    : fresh;
  const persist = () => atomicWriteJson(checkpointPath, checkpoint);
  persist();
  admission.record({
    type: 'checkpoint_opened',
    recovered_from: checkpoint.recovered_from?.destination || null,
    completed_dialogues: checkpoint.dialogues.filter((row) => row.status === 'complete').length,
  });

  const seal = (status, extra = {}) => {
    checkpoint.status = status;
    checkpoint.completed_at = nowIso();
    persist();
    const recoverable = extra.recovery_permitted === true;
    admission.close({
      type: 'run_sealed',
      status: recoverable ? 'technical_failure' : status,
      recovery_permitted: recoverable,
      checkpoint_path: checkpointPath,
      ...extra,
    });
  };

  try {
    // Stage 1: seed freshness, recorded.
    if (!checkpoint.seed_freshness) {
      checkpoint.seed_freshness = seedFreshnessAudit({ seeds: manifest.seeds, excludeRoots: [rootDir] });
      persist();
      if (checkpoint.seed_freshness.status !== 'passed') {
        const error = new Error(`seed freshness failed: ${JSON.stringify(checkpoint.seed_freshness.hits)}`);
        error.recoveryPermitted = false;
        throw error;
      }
      log(`seed freshness passed for seeds ${manifest.seeds[0]}-${manifest.seeds.at(-1)}`);
    }

    // Stage 2: zero-call prompt preflight with the registered seats.
    if (!checkpoint.prompt_preflight) {
      const preflightPath = path.join(rootDir, 'prompt-preflight.json');
      const audits = preflightPrompts({
        manifest: {
          ...manifest,
          worlds: manifest.worlds.map((world) => ({ ...world, path: resolveFromRoot(world.path) })),
        },
        outputPath: preflightPath,
        learnerProfile,
        seats: { tutor: seats.tutor, analysis: seats.analysis, learner: seats.learner },
      });
      checkpoint.prompt_preflight = { path: preflightPath, status: audits?.status ?? 'written' };
      persist();
      log('prompt preflight written');
    }

    // Stage 3: generation.
    const jobs = buildSecondFamilyJobs({ manifest, rootDir, learnerProfile, seats });
    checkpoint.status = 'generation';
    persist();
    await runSecondFamilyGeneration({ jobs, checkpoint, admission, persist, runDialogue, collectJobResult, log });
    const completed = checkpoint.dialogues
      .filter((row) => row.status === 'complete')
      .sort((left, right) => left.order - right.order);
    const counts = describeSecondFamilyBlockCounts({ manifest, dialogues: checkpoint.dialogues });
    if (completed.length + counts.dropped.length !== manifest.assignment.dialogues) {
      throw new Error(
        `${completed.length} of ${manifest.assignment.dialogues} dialogues complete (${counts.dropped.length} dropped)`,
      );
    }
    if (counts.reads > manifest.channels.decision.planned_calls) {
      throw new Error(`block needs ${counts.reads} reads, registered ${manifest.channels.decision.planned_calls}`);
    }
    checkpoint.block_counts = counts;
    persist();
    log(`generation complete: ${completed.length} dialogues, ${counts.dropped.length} dropped, ${counts.cases} cases`);

    // Stage 4: cases, fingerprint guard, corpus artifacts, reader plan.
    let built;
    let collection;
    const readerDirs = checkpoint.reader_collection
      ? {
          collectionDir: checkpoint.reader_collection.collection_dir,
          runDir: checkpoint.reader_run.run_dir,
          runPath: checkpoint.reader_run.run_path,
        }
      : resolveReaderPlanDirs(rootDir);
    if (checkpoint.corpus && checkpoint.reader_collection) {
      built = { corpus: readJson(checkpoint.corpus.corpus_path), key: readJson(checkpoint.corpus.key_path) };
      collection = {
        manifest: readJson(checkpoint.reader_collection.manifest_path),
        manifestPath: checkpoint.reader_collection.manifest_path,
      };
    } else {
      checkpoint.status = 'case_extraction';
      persist();
      built = prepareOutcomeCases({
        rows: completed.map((row) => row.result),
        manifest,
        rootDir,
        samplingSeed: 'second-family-frozen-order',
        learnerProfile,
        expectedCaseCount: counts.cases,
      });
      const fingerprintGuard = guardOutcomeAnnotationFingerprints({
        cases: built.corpus.cases,
        keyCases: built.key.cases,
        expectedCount: counts.cases,
      });
      if (fingerprintGuard?.status && fingerprintGuard.status !== 'passed') {
        throw new Error(`post-generation fingerprint guard ${fingerprintGuard.status}`);
      }
      const artifacts = writeOutcomeCorpusArtifacts({ rootDir, built });
      checkpoint.corpus = {
        corpus_path: artifacts.corpusPath,
        corpus_sha256: fileSha256(artifacts.corpusPath),
        key_path: artifacts.keyPath,
        case_count: built.corpus.cases.length,
        fingerprint_guard: fingerprintGuard,
      };
      persist();
      const prepared = prepareAdaptiveWarrantAnnotationBatches({
        corpusPath: artifacts.corpusPath,
        handbookPath: resolveFromRoot(manifest.annotation_handbook.path),
        outputDir: readerDirs.collectionDir,
        corpusRole: 'natural_prevalence',
        readerIds: [...SECOND_FAMILY_READER_IDS],
        batchSize: manifest.channels.decision.batch_size,
        annotationModel: seats.decision_readers,
        maxAnnotationCalls: counts.reader_attempt_cap,
        provenance: {
          source_commit: admission.source.commit,
          source_tree: admission.source.tree,
          source_branch: admission.source.branch,
          source_dirty: admission.source.dirty,
        },
      });
      collection = { manifest: prepared.manifest, manifestPath: prepared.manifestPath };
      const batchCount = prepared.manifest.readers.reduce((total, reader) => total + reader.batches.length, 0);
      if (batchCount !== counts.reads) {
        throw new Error(`reader plan carries ${batchCount} batches, block needs ${counts.reads}`);
      }
      checkpoint.reader_collection = {
        collection_dir: readerDirs.collectionDir,
        manifest_path: prepared.manifestPath,
        manifest_sha256: fileSha256(prepared.manifestPath),
        batches: batchCount,
      };
      const run = readerRunSkeleton({ readerModel: seats.decision_readers, sourceCommit: admission.source.commit });
      run.study_id = prepared.manifest.study_id;
      run.source_commit = prepared.manifest.source_commit;
      fs.mkdirSync(readerDirs.runDir, { recursive: true });
      atomicWriteJson(readerDirs.runPath, run);
      checkpoint.reader_run = { run_dir: readerDirs.runDir, run_path: readerDirs.runPath, status: run.status };
      persist();
      log(`reader plan prepared: ${batchCount} batches`);
    }

    // Stage 5: reader dispatch on the second family.
    const run = readJson(readerDirs.runPath);
    if (run.status !== 'complete') {
      checkpoint.status = 'decision_readers';
      persist();
      const budget = createDurablePaidModelAttemptBudget({ admission, limit: ceiling, unitPrefix: 'reader' });
      await runSecondFamilyReaders({
        collectionManifest: collection.manifest,
        collectionManifestPath: collection.manifestPath,
        outputDir: readerDirs.runDir,
        runPath: readerDirs.runPath,
        run,
        budget,
        readerModel: seats.decision_readers,
        attemptCap: counts.reader_attempt_cap,
        callModel,
        persist: () => {
          checkpoint.reader_run = {
            ...checkpoint.reader_run,
            status: run.status,
            calls_attempted: run.calls_attempted,
            calls_completed: run.calls_completed,
          };
          persist();
        },
      });
      log(`readers complete: ${run.calls_completed} responses from ${run.calls_attempted} attempts`);
    }

    // Stage 6: assembly and scoring, zero calls.
    checkpoint.status = 'scoring';
    persist();
    const assemblyRun = writeOutcomePilotAssemblyRunView({
      runPath: readerDirs.runPath,
      outputPath: path.join(rootDir, 'decision-reader-assembly-run-view.json'),
    });
    const assembled = new Map();
    for (const readerId of SECOND_FAMILY_READER_IDS) {
      assembled.set(
        readerId,
        assembleAdaptiveWarrantAnnotationResponse({
          manifestPath: collection.manifestPath,
          readerId,
          annotationRunId: `${SECOND_FAMILY_STUDY_ID}-${readerId}`,
          responseDir: path.join(readerDirs.runDir, readerId),
          outputPath: path.join(rootDir, `${readerId}.assembled.json`),
          runPath: assemblyRun.path,
        }).response,
      );
    }
    const score = scoreSecondFamily({
      completed,
      dropped: counts.dropped,
      built,
      assembled,
      assemblyRunPath: assemblyRun.path,
    });
    const scorePath = path.join(rootDir, 'second-family-score.json');
    atomicWriteJson(scorePath, score);
    checkpoint.score = { path: scorePath, sha256: fileSha256(scorePath), replication: score.replication.overall };
    seal('complete', {
      score_path: scorePath,
      replication: score.replication.overall,
      dropped_dialogues: counts.dropped.map((row) => row.id),
    });
    log(`scored: replication ${score.replication.overall}`);
    return { checkpoint, checkpointPath, score, scorePath };
  } catch (error) {
    checkpoint.stop = {
      at: nowIso(),
      code: error.code || null,
      message: error.message,
      recovery_permitted: error.recoveryPermitted === true,
    };
    seal(error.recoveryPermitted === true ? 'stopped_recoverable' : 'failed', {
      recovery_permitted: error.recoveryPermitted === true,
      error: error.message,
      code: error.code || null,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  return [
    'Usage:',
    '  node scripts/run-warrant-gate-second-family-replication.js',
    '      (prints the plan; zero model calls)',
    '  node scripts/run-warrant-gate-second-family-replication.js --accept-charges \\',
    '      --go "<the words the user wrote in chat, starting GO>" \\',
    '      --out <fresh-absolute-dir> [--launch-commit <sha>] [--ceiling 3360] [--recovery-from <previous-out>]',
    '  node scripts/run-warrant-gate-second-family-replication.js --seal-interrupted <out> --reason "<why>"',
    '',
    'Seat flags (defaults are the registered seats):',
    `  --tutor-model ${SECOND_FAMILY_SEATS.tutor}  --analysis-model ${SECOND_FAMILY_SEATS.analysis}`,
    `  --learner-model ${SECOND_FAMILY_SEATS.learner}  --reader-model ${SECOND_FAMILY_SEATS.decision_readers}`,
    `  --learner-profile ${OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE}  --study-state-root ${relativeToRoot(DEFAULT_STUDY_STATE_ROOT)}`,
    '',
  ].join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: 'string', default: DEFAULT_SECOND_FAMILY_MANIFEST },
      registration: { type: 'string', default: DEFAULT_SECOND_FAMILY_REGISTRATION },
      'accept-charges': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      go: { type: 'string' },
      'launch-commit': { type: 'string' },
      out: { type: 'string' },
      'recovery-from': { type: 'string' },
      'seal-interrupted': { type: 'string' },
      reason: { type: 'string' },
      ceiling: { type: 'string', default: String(SECOND_FAMILY_CEILING) },
      'study-state-root': { type: 'string', default: DEFAULT_STUDY_STATE_ROOT },
      'learner-profile': { type: 'string', default: OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE },
      'tutor-model': { type: 'string', default: SECOND_FAMILY_SEATS.tutor },
      'analysis-model': { type: 'string', default: SECOND_FAMILY_SEATS.analysis },
      'learner-model': { type: 'string', default: SECOND_FAMILY_SEATS.learner },
      'reader-model': { type: 'string', default: SECOND_FAMILY_SEATS.decision_readers },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(usage());
    return;
  }
  if (values['seal-interrupted']) {
    const sealed = sealInterruptedPaidStudyLaunch({
      studyId: SECOND_FAMILY_STUDY_ID,
      studyStateRoot: path.resolve(values['study-state-root']),
      destination: path.resolve(values['seal-interrupted']),
      reason: values.reason || 'operator sealed an interrupted launch',
    });
    process.stdout.write(`${JSON.stringify(sealed, null, 2)}\n`);
    return;
  }
  const { manifest } = loadSecondFamilyManifest(values.manifest);
  const seats = {
    tutor: values['tutor-model'],
    analysis: values['analysis-model'],
    learner: values['learner-model'],
    decision_readers: values['reader-model'],
  };
  const ceiling = Number(values.ceiling);
  if (!Number.isInteger(ceiling) || ceiling < 1) throw new Error('--ceiling must be a positive integer');
  if (ceiling > manifest.planned_calls.ceiling) {
    throw new Error(`--ceiling ${ceiling} exceeds the registered ceiling ${manifest.planned_calls.ceiling}`);
  }
  if (!values['accept-charges']) {
    const plan = describeSecondFamilyPlan(manifest);
    plan.seats = seats;
    plan.ceiling = ceiling;
    process.stdout.write(renderSecondFamilyPlan(plan));
    if (values['dry-run']) {
      const jobs = buildSecondFamilyJobs({
        manifest,
        rootDir: path.resolve(values.out || '/tmp/second-family-dry-run'),
        dryRun: true,
        learnerProfile: values['learner-profile'],
        seats,
      });
      process.stdout.write(`Dry-run jobs: ${jobs.length}\nFirst job command: ${jobs[0].command.slice(1).join(' ')}\n`);
    }
    return;
  }
  for (const flag of ['go', 'out']) {
    if (!values[flag]) throw new Error(`--${flag} is required with --accept-charges`);
  }
  if (!path.isAbsolute(values.out)) throw new Error('--out must be an absolute, not yet existing directory');
  const result = await executeSecondFamilyReplication({
    manifestPath: values.manifest,
    registrationPath: values.registration,
    goApproval: values.go,
    launchCommit: values['launch-commit'] || null,
    destination: values.out,
    recoveryFrom: values['recovery-from'] || null,
    studyStateRoot: values['study-state-root'],
    ceiling,
    learnerProfile: values['learner-profile'],
    seats,
  });
  process.stdout.write(
    `${JSON.stringify({ status: result.checkpoint.status, score: result.scorePath, replication: result.score.replication.overall }, null, 2)}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`[second-family] ${error.message}\n`);
    process.exitCode = 1;
  });
}
