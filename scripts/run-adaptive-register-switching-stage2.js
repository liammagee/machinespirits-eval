#!/usr/bin/env node

// Adaptive register-switching experiment, Stage 2 only.
//
// The frozen Stage-1 runner remains untouched. This runner will not expose a
// paid action unless the approved plan SHA, the completed Stage-1 report, and
// the exact clean-checkout commit SHA all agree. It exposes no Stage-3 mode.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import yaml from 'yaml';

import {
  ADAPTIVE_REGISTER_SWITCHING as GRID,
  buildAdaptiveRegisterSwitchingPlan,
  validateAdaptiveRegisterSwitchingPlan,
} from '../services/adaptiveRegisterSwitching.js';
import {
  summarizeAdaptiveRegisterSwitchingStage2,
  validateAdaptiveRegisterSwitchingStage1Gate,
} from '../services/adaptiveRegisterSwitchingStage2.js';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';
import { calculateLearnerOverallScore } from '../services/learnerRubricEvaluator.js';
import { resolveEngagementRegister } from '../services/engagementRegisterRegistry.js';
import { mannerPresenceApplies } from '../services/registerMannerPresence.js';
import { lookupMannerPresence, readMannerPresence } from '../services/registerMannerPresenceReader.js';
import { evaluateRegisterStanceFidelity } from '../services/registerStanceFidelity.js';
import {
  analyzeCharismaDesireRows,
  isPositiveCharismaDesireOutcome,
} from './report-charisma-desire-breakthrough-matrix.js';
import { findDialogueLog } from './dump-turn-prompts.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_OUTPUT_DIR = 'exports/adaptive-register-switching/stage2';

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function canonicalRegister(name) {
  return resolveEngagementRegister(name)?.register || String(name || '').trim();
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function loadDialogueLog(row, root = ROOT) {
  for (const id of [row.dialogue_id, row.dialogue_content_hash]) {
    if (!id) continue;
    const found = findDialogueLog(id, { rootDir: root });
    if (!found?.file) continue;
    try {
      return JSON.parse(fs.readFileSync(found.file, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function getTurnResult(log, turnIndex) {
  return Array.isArray(log?.turnResults)
    ? log.turnResults.find((turn) => Number(turn.turnIndex) === Number(turnIndex)) || null
    : null;
}

function getLearnerMessage(log, turnIndex) {
  return getTurnResult(log, turnIndex)?.learnerMessage || '';
}

function getTutorMessage(log, traceTurn, turnIndex) {
  const result = getTurnResult(log, turnIndex);
  return (
    traceTurn?.tutorText ||
    result?.suggestions?.[0]?.message ||
    result?.suggestion?.message ||
    result?.tutorMessage ||
    ''
  );
}

function getRegisterScore(scores, registerName, turnIndex) {
  return scores?.[registerName]?.[`turn_${turnIndex}`] || null;
}

function learnerRubricSequence(row) {
  const parsed = parseJson(row.learner_scores, null);
  if (!parsed || typeof parsed !== 'object') return [];
  const multiAgent = String(row.learner_architecture || '').toLowerCase().includes('ego_superego');
  return Object.values(parsed)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      let score = Number(entry.overallScore);
      if (!Number.isFinite(score) && entry.scores && typeof entry.scores === 'object') {
        score = calculateLearnerOverallScore(entry.scores, multiAgent);
      }
      return { turnIndex: Number(entry.turnIndex), score };
    })
    .filter((entry) => Number.isFinite(entry.turnIndex) && Number.isFinite(entry.score))
    .sort((a, b) => a.turnIndex - b.turnIndex);
}

export function stage2GenerationCommand() {
  return [
    process.execPath,
    'scripts/eval-cli.js',
    'run',
    '--profiles',
    [GRID.arms.adaptive.profile, GRID.arms.routerWarm.profile, GRID.arms.pinnedSarcastic.profile].join(','),
    '--scenarios',
    GRID.scenarios.join(','),
    '--runs',
    String(GRID.stage2.repeatsPerScenario),
    '--parallelism',
    String(GRID.generation.parallelism),
    '--skip-rubric',
    '--tutor-model',
    GRID.generation.tutorModel,
    '--learner-model',
    GRID.generation.learnerModel,
    '--description',
    'Adaptive register switching Stage 2: frozen three-arm outcome batch',
  ];
}

export function stage2OutcomeScoringCommands(runId) {
  return [
    [
      process.execPath,
      'scripts/eval-cli.js',
      'evaluate',
      runId,
      '--judge-cli',
      GRID.scoring.tutorJudgeCli,
      '--model',
      GRID.scoring.tutorJudgeModel,
      '--parallelism',
      '1',
      '--tutor-only',
      '--skip-deliberation',
    ],
    [
      process.execPath,
      'scripts/eval-cli.js',
      'evaluate-learner',
      runId,
      '--judge-cli',
      GRID.scoring.learnerJudgeCli,
      '--model',
      GRID.scoring.learnerJudgeModel,
      '--parallelism',
      '1',
    ],
  ];
}

export function stage2RegisterScoringCommands(runId) {
  return GRID.edgedRegisters.map((registerName) => [
    process.execPath,
    'scripts/evaluate-register-rubric.js',
    runId,
    '--register',
    registerName,
    '--judge',
    GRID.scoring.registerJudge,
  ]);
}

export function stage2FollowUpCommands(
  runId = '<runId>',
  expectedSha = '<clean-commit-sha>',
  stage1Report = '<stage1-report>',
  approvedPlanSha = '<approved-plan-sha>',
) {
  const gate = [
    '--stage1-report',
    stage1Report,
    '--approved-plan-sha',
    approvedPlanSha,
    '--launch-approved',
    '--expected-sha',
    expectedSha,
  ];
  return [
    [process.execPath, 'scripts/run-adaptive-register-switching-stage2.js', '--score-outcomes-run', runId, ...gate],
    [process.execPath, 'scripts/run-adaptive-register-switching-stage2.js', '--score-register-run', runId, ...gate],
    [process.execPath, 'scripts/run-adaptive-register-switching-stage2.js', '--read-manner-run', runId, ...gate],
    [
      process.execPath,
      'scripts/run-adaptive-register-switching-stage2.js',
      '--report-run',
      runId,
      '--stage1-report',
      stage1Report,
      '--approved-plan-sha',
      approvedPlanSha,
    ],
  ];
}

function shellQuote(value) {
  const raw = String(value);
  return /^[A-Za-z0-9_./:=,<>-]+$/u.test(raw) ? raw : `'${raw.replaceAll("'", "'\\''")}'`;
}

function renderCommand(command, { scenarioEnv = false } = {}) {
  const prefix = scenarioEnv ? `EVAL_SCENARIOS_FILE=${GRID.scenarioSource} ` : '';
  return `${prefix}${command.map(shellQuote).join(' ')}`;
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

export function assertStage2LaunchAuthorization(expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha || '')) {
    throw new Error('--launch-approved also requires --expected-sha with the exact 40-character clean commit SHA');
  }
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (head !== expectedSha) throw new Error(`launch SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
  if (gitOutput(['status', '--porcelain'])) throw new Error('paid Stage-2 work requires a clean checkout');
  return head;
}

export function loadStage1Gate(stage1ReportPath, approvedPlanSha) {
  if (!stage1ReportPath) throw new Error('--stage1-report is required for every Stage-2 mode');
  const absolute = path.resolve(ROOT, stage1ReportPath);
  if (!fs.existsSync(absolute)) throw new Error(`Stage-1 report not found: ${absolute}`);
  const artifact = parseJson(fs.readFileSync(absolute, 'utf8'), null);
  const plan = buildAdaptiveRegisterSwitchingPlan();
  if (approvedPlanSha !== plan.planSha256) {
    throw new Error(`approved plan SHA mismatch: expected ${plan.planSha256}, got ${approvedPlanSha || 'missing'}`);
  }
  const gate = validateAdaptiveRegisterSwitchingStage1Gate(artifact, approvedPlanSha);
  if (!gate.ok) throw new Error(`Stage-1 gate failed: ${gate.errors.join('; ')}`);
  return { ...gate, artifactPath: absolute, artifactSha256: sha256File(absolute) };
}

function writeDryRunArtifact(plan, outputDir, stage1Gate, { launchSha = null } = {}) {
  const validation = validateAdaptiveRegisterSwitchingPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const artifact = {
    schema: 'machinespirits.adaptive-register-switching-stage2-dry-run.v1',
    modelCalls: 0,
    paidLaunchStatus: launchSha ? 'authorized_for_stage2_generation' : 'locked_pending_clean_commit_launch',
    stage3LaunchStatus: 'unavailable_in_this_runner',
    launchSha,
    validation,
    stage1Gate,
    planSha256: plan.planSha256,
    stage2Jobs: plan.stage2Jobs,
    generationCommand: renderCommand(stage2GenerationCommand(), { scenarioEnv: true }),
    followUpCommands: stage2FollowUpCommands(
      '<runId>',
      launchSha || '<clean-commit-sha>',
      stage1Gate.artifactPath,
      plan.planSha256,
    ).map((command) => renderCommand(command)),
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const artifactPath = path.join(outputDir, 'plan.json');
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifactPath;
}

function loadEvaluationRows(runId, { openDb = openEvaluationDbReadonly, root = ROOT } = {}) {
  const { db, dbPath, reason } = openDb(root);
  if (!db) throw new Error(`evaluation DB unavailable at ${dbPath}: ${reason}`);
  try {
    const scenarioMarks = GRID.scenarios.map(() => '?').join(', ');
    const profileMarks = Object.values(GRID.arms)
      .map(() => '?')
      .join(', ');
    return db
      .prepare(
        `SELECT id, run_id, scenario_id, profile_name, dialogue_id, dialogue_content_hash,
                suggestions, id_construction_trace, tutor_register_scores, success,
                learner_architecture, learner_scores, learner_overall_score,
                learner_judge_model, learner_rubric_version,
                tutor_scores, tutor_overall_score, tutor_first_turn_score,
                tutor_last_turn_score, judge_model, tutor_rubric_version
         FROM evaluation_results
         WHERE run_id = ?
           AND profile_name IN (${profileMarks})
           AND scenario_id IN (${scenarioMarks})
           AND success = 1
         ORDER BY profile_name, scenario_id, id`,
      )
      .all(runId, ...Object.values(GRID.arms).map((arm) => arm.profile), ...GRID.scenarios);
  } finally {
    db.close();
  }
}

export function stage2Dialogues(runId, options = {}) {
  const root = options.root || ROOT;
  const rows = loadEvaluationRows(runId, { ...options, root });
  const scenariosPath = path.join(root, GRID.scenarioSource);
  const scenarios = yaml.parse(fs.readFileSync(scenariosPath, 'utf8'))?.scenarios || {};
  const logsByRowId = new Map();
  for (const row of rows) logsByRowId.set(row.id, (options.loadLog || loadDialogueLog)(row, root));
  const outcomes = analyzeCharismaDesireRows(rows, scenarios, {
    loadLog: (row) => logsByRowId.get(row.id) || null,
  });
  const outcomesByRowId = new Map(outcomes.map((row) => [row.rowId, row]));

  return rows.map((row) => {
    const log = logsByRowId.get(row.id);
    const trace = parseJson(row.id_construction_trace, []);
    const registerScores = parseJson(row.tutor_register_scores, {});
    let seenResistance = false;
    const turns = (Array.isArray(trace) ? trace : [])
      .filter((entry) => Number.isInteger(Number(entry?.turn)) && entry?.engagementState)
      .sort((a, b) => Number(a.turn) - Number(b.turn))
      .map((traceTurn) => {
        const turnIndex = Number(traceTurn.turn);
        const state = traceTurn.engagementState || {};
        const selectedRegister = canonicalRegister(state.selected_register || state.selected_mode);
        const routerSelectedRegister = canonicalRegister(
          state.router_selected_register || state.router_selected_mode || state.selected_register || state.selected_mode,
        );
        const resistance = Boolean(state.resistance_signal);
        const phase = resistance ? 'resistance' : seenResistance ? 'uptake' : 'other';
        if (resistance) seenResistance = true;
        const learnerMessage = getLearnerMessage(log, turnIndex);
        const tutorMessage = getTutorMessage(log, traceTurn, turnIndex);
        const postLearnerMessage = getLearnerMessage(log, turnIndex + 1);
        const score = getRegisterScore(registerScores, selectedRegister, turnIndex);
        const presenceReading = lookupMannerPresence({ registerName: selectedRegister, learnerMessage, tutorMessage });
        return {
          turn: turnIndex,
          phase,
          selectedRegister,
          routerSelectedRegister,
          assignedRegisterArm: canonicalRegister(state.assigned_register_arm),
          registerAssignmentSource: state.register_assignment_source || null,
          routerMenu: Array.isArray(state.router_register_menu) ? [...state.router_register_menu] : null,
          learnerMessage,
          tutorMessage,
          postLearnerMessage,
          registerRubricScore: score?.overall ?? null,
          registerJudgeModel: score?.judge_model || null,
          stanceFidelity: evaluateRegisterStanceFidelity({
            registerName: selectedRegister,
            learnerMessage,
            tutorMessage,
            postLearnerMessage,
            presenceReading,
          }),
        };
      });
    const sequence = learnerRubricSequence(row);
    const outcome = outcomesByRowId.get(row.id);
    return {
      rowId: row.id,
      runId: row.run_id,
      scenarioId: row.scenario_id,
      profileName: row.profile_name,
      dialogueId: row.dialogue_id,
      dialogueTrace: Array.isArray(log?.dialogueTrace) ? log.dialogueTrace : [],
      dialogueLogMissing: !log,
      turns,
      outcomeVerdict: outcome?.verdict || null,
      positiveOutcome: outcome ? isPositiveCharismaDesireOutcome(outcome) : null,
      outcomeFold: outcome
        ? {
            targetSignal: outcome.targetSignal,
            resistanceTurn: outcome.resistanceTurn,
            tutorRegister: outcome.tutorRegister,
            routerSelectedRegister: outcome.routerSelectedRegister,
            preGenerated: outcome.preGenerated,
            postGenerated: outcome.postGenerated,
            targetMatched: outcome.targetMatched,
            lexicalScore: outcome.lexicalScore,
          }
        : null,
      learnerRubric: {
        first: sequence[0]?.score ?? null,
        last: sequence.at(-1)?.score ?? null,
        delta: sequence.length > 1 ? sequence.at(-1).score - sequence[0].score : null,
        turnCount: sequence.length,
        version: row.learner_rubric_version || null,
        judge: row.learner_judge_model || null,
      },
      tutorV22: {
        overall: row.tutor_overall_score,
        first: row.tutor_first_turn_score,
        last: row.tutor_last_turn_score,
        version: row.tutor_rubric_version || null,
        judge: row.judge_model || null,
      },
    };
  });
}

export function stage2MannerTargets(dialogues) {
  const targets = [];
  const seen = new Set();
  for (const dialogue of dialogues || []) {
    for (const turn of dialogue.turns || []) {
      if (!mannerPresenceApplies(turn.selectedRegister) || !String(turn.tutorMessage || '').trim()) continue;
      const key = `${dialogue.rowId}:${turn.turn}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({
        key,
        rowId: dialogue.rowId,
        dialogueId: dialogue.dialogueId,
        scenarioId: dialogue.scenarioId,
        turn: turn.turn,
        registerName: turn.selectedRegister,
        learnerMessage: turn.learnerMessage,
        tutorMessage: turn.tutorMessage,
      });
    }
  }
  return targets;
}

async function spawnAttended(command, { scenarioEnv = false } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      env: scenarioEnv ? { ...process.env, EVAL_SCENARIOS_FILE: GRID.scenarioSource } : process.env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`attended command stopped by ${signal}`));
      else if (code !== 0) reject(new Error(`attended command exited ${code}`));
      else resolve();
    });
  });
}

async function runOutcomeScoring(runId) {
  for (const command of stage2OutcomeScoringCommands(runId)) await spawnAttended(command, { scenarioEnv: true });
}

async function runRegisterScoring(runId) {
  for (const command of stage2RegisterScoringCommands(runId)) await spawnAttended(command, { scenarioEnv: true });
}

async function runMannerRead(runId) {
  const targets = stage2MannerTargets(stage2Dialogues(runId));
  console.log(`[register-switch:stage2] ${targets.length} edged turns to read for manner presence`);
  const failures = [];
  for (const [index, target] of targets.entries()) {
    process.stdout.write(
      `[${index + 1}/${targets.length}] ${target.scenarioId} turn ${target.turn} ${target.registerName} ... `,
    );
    const { reading, fromCache } = await readMannerPresence(target);
    console.log(`${reading.status}${reading.reason ? ` (${reading.reason})` : ''}${fromCache ? ' [cached]' : ''}`);
    if (!['present', 'absent'].includes(reading.status)) {
      failures.push(`${target.key}: ${reading.reason || 'unread'}`);
    }
  }
  if (failures.length) throw new Error(`manner-reading pass incomplete: ${failures.join('; ')}`);
}

function runReport(runId, outputDir, stage1Gate) {
  const dialogues = stage2Dialogues(runId);
  const report = summarizeAdaptiveRegisterSwitchingStage2(dialogues, { stage1Gate });
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${runId}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ runId, report, dialogues }, null, 2)}\n`);

  console.log(`[register-switch:stage2] report ${report.status} (${report.observedRows}/${report.expectedRows} rows)`);
  console.log(
    `[register-switch:stage2] provenance ${report.provenance.seatCalls} tutor-seat calls: ${
      Object.entries(report.provenance.observed)
        .map(([pair, count]) => `${pair} x${count}`)
        .join(', ') || 'none'
    }`,
  );
  for (const [arm, bucket] of Object.entries(report.conversion.byArm)) {
    console.log(`[register-switch:stage2] ${arm}: conversion ${bucket.positive}/${bucket.n} (${bucket.rate ?? 'n/a'})`);
  }
  console.log(
    `[register-switch:stage2] primary adaptive-vs-router-warm p=${
      report.conversion.primary.fisherExactTwoSidedP ?? 'n/a'
    }; difference=${report.conversion.primary.rateDifference ?? 'n/a'}`,
  );
  console.log(
    `[register-switch:stage2] secondary adaptive-vs-pinned-sarcastic p=${
      report.conversion.timingVsEdge.fisherExactTwoSidedP ?? 'n/a'
    }; difference=${report.conversion.timingVsEdge.rateDifference ?? 'n/a'}`,
  );
  for (const [arm, bucket] of Object.entries(report.learnerRubricChange.byArm)) {
    console.log(`[register-switch:stage2] learner delta ${arm}: n=${bucket.n}, mean=${bucket.mean ?? 'n/a'}`);
  }
  for (const [arm, bucket] of Object.entries(report.tutorV22Cost.byArm)) {
    console.log(`[register-switch:stage2] tutor v2.2 ${arm}: n=${bucket.n}, mean=${bucket.mean ?? 'n/a'}`);
  }
  for (const bucket of Object.values(report.fidelityByRegister)) {
    console.log(
      `[register-switch:stage2] ${bucket.register}: ${bucket.turns} turns; cue ${bucket.cueCompliant}; ` +
        `manner ${bucket.mannerPresent} present/${bucket.mannerAbsent} absent/${bucket.mannerUnread} unread; ` +
        `register mean ${bucket.registerRubricMean == null ? 'n/a' : bucket.registerRubricMean.toFixed(2)}`,
    );
  }
  for (const error of report.errors) console.log(`  - ${error}`);
  console.log(`[register-switch:stage2] decision ${report.decision || 'WITHHELD'}`);
  console.log('[register-switch:stage2] STOP — Stage 3 is not authorized or available');
  console.log(`[register-switch:stage2] ${path.relative(ROOT, jsonPath)}`);
  if (report.status !== 'COMPLETE') throw new Error('adaptive register-switching Stage-2 report failed closed');
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'approved-plan-sha': { type: 'string', default: '' },
      'stage1-report': { type: 'string', default: '' },
      'score-outcomes-run': { type: 'string', default: '' },
      'score-register-run': { type: 'string', default: '' },
      'read-manner-run': { type: 'string', default: '' },
      'report-run': { type: 'string', default: '' },
      'output-dir': { type: 'string', default: DEFAULT_OUTPUT_DIR },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: node scripts/run-adaptive-register-switching-stage2.js ' +
        '--stage1-report <Stage-1.json> --approved-plan-sha <sha> [--dry-run] ' +
        '[--launch-approved --expected-sha <commit>] ' +
        '[--score-outcomes-run <runId>|--score-register-run <runId>|--read-manner-run <runId>] ' +
        '[--report-run <runId>] [--output-dir <dir>]',
    );
    return;
  }

  const paidSubmodes = [
    values['score-outcomes-run'],
    values['score-register-run'],
    values['read-manner-run'],
  ].filter(Boolean);
  if (paidSubmodes.length > 1) throw new Error('choose one paid Stage-2 submode at a time');
  if (values['report-run'] && (values['launch-approved'] || paidSubmodes.length)) {
    throw new Error('--report-run is a zero-call reporting mode');
  }
  if (values['dry-run'] && (values['launch-approved'] || values['report-run'] || paidSubmodes.length)) {
    throw new Error('--dry-run cannot be combined with launch, scoring, reading, or reporting');
  }

  const stage1Gate = loadStage1Gate(values['stage1-report'], values['approved-plan-sha']);
  if (values['report-run']) {
    runReport(values['report-run'], path.resolve(ROOT, values['output-dir']), stage1Gate);
    return;
  }

  const launch = Boolean(values['launch-approved']);
  const launchSha = launch ? assertStage2LaunchAuthorization(values['expected-sha']) : null;
  if (paidSubmodes.length && !launch) throw new Error('paid Stage-2 scoring/reading requires --launch-approved');
  if (values['score-outcomes-run']) return runOutcomeScoring(values['score-outcomes-run']);
  if (values['score-register-run']) return runRegisterScoring(values['score-register-run']);
  if (values['read-manner-run']) return runMannerRead(values['read-manner-run']);

  const plan = buildAdaptiveRegisterSwitchingPlan();
  const outputDir = path.resolve(ROOT, values['output-dir']);
  const artifactPath = writeDryRunArtifact(plan, outputDir, stage1Gate, { launchSha });
  console.log(`[register-switch:stage2] approved plan SHA-256 ${plan.planSha256}`);
  console.log(
    `[register-switch:stage2] Stage-1 gate ${stage1Gate.reportDecision} from ${stage1Gate.runId}; ` +
      `artifact ${stage1Gate.artifactSha256}`,
  );
  console.log(
    `[register-switch:stage2] ${plan.stage2Jobs.length} rows = ${GRID.stage2.plannedRowsPerArm}/arm, ` +
      `${GRID.stage2.repeatsPerScenario}/arm-scenario`,
  );
  console.log(`[register-switch:stage2] tutor/learner stack ${GRID.generation.tutorModel}; serial parallelism 1`);
  console.log(
    `[register-switch:stage2] exact Fisher power 0.8522 for 0.50 vs 0.85 at ${GRID.stage2.plannedRowsPerArm}/arm`,
  );
  console.log(`[register-switch:stage2] ${path.relative(ROOT, artifactPath)}`);
  if (!launch) {
    console.log('[register-switch:stage2] paid Stage 2 locked; use --launch-approved --expected-sha <clean-commit>');
    console.log('[register-switch:stage2] STOP — clean-commit launch gate required before any paid call');
    return;
  }

  await spawnAttended(stage2GenerationCommand(), { scenarioEnv: true });
  console.log('[register-switch:stage2] generation done; attended follow-ups (do not restart on failure):');
  for (const command of stage2FollowUpCommands('<runId>', launchSha, values['stage1-report'], plan.planSha256)) {
    console.log(`  ${renderCommand(command)}`);
  }
  console.log('[register-switch:stage2] STOP after the fail-closed report; no Stage 3 mode exists');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[register-switch:stage2] ${error.message}`);
    process.exitCode = 1;
  });
}
