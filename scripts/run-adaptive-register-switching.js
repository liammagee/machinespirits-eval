#!/usr/bin/env node

// Adaptive register-switching experiment, Stage 1 only.
//
// --dry-run writes and prints the frozen plan with zero model calls. Every paid
// mode needs --launch-approved plus the exact clean-checkout commit SHA. The
// runner intentionally exposes no Stage-2 launch mode.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  ADAPTIVE_REGISTER_SWITCHING as GRID,
  buildAdaptiveRegisterSwitchingPlan,
  checkAdaptiveTutorStackProvenance,
  summarizeAdaptiveRegisterSwitchingStage1,
  validateAdaptiveRegisterSwitchingPlan,
} from '../services/adaptiveRegisterSwitching.js';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';
import { resolveEngagementRegister } from '../services/engagementRegisterRegistry.js';
import { mannerPresenceApplies } from '../services/registerMannerPresence.js';
import {
  lookupMannerPresence,
  readMannerPresence,
} from '../services/registerMannerPresenceReader.js';
import { evaluateRegisterStanceFidelity } from '../services/registerStanceFidelity.js';
import { findDialogueLog } from './dump-turn-prompts.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

function canonicalRegister(name) {
  return resolveEngagementRegister(name)?.register || String(name || '').trim();
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

function loadDialogueLog(dialogueId, root = ROOT) {
  const found = findDialogueLog(dialogueId, { rootDir: root });
  if (!found?.file) return null;
  try {
    return JSON.parse(fs.readFileSync(found.file, 'utf8'));
  } catch {
    return null;
  }
}

export function generationCommand() {
  return [
    process.execPath,
    'scripts/eval-cli.js',
    'run',
    '--profiles',
    GRID.arms.adaptive.profile,
    '--scenarios',
    GRID.scenarios.join(','),
    '--runs',
    String(GRID.stage1.repeatsPerScenario),
    '--parallelism',
    String(GRID.generation.parallelism),
    '--skip-rubric',
    '--tutor-model',
    GRID.generation.tutorModel,
    '--learner-model',
    GRID.generation.learnerModel,
    '--description',
    'Adaptive register switching Stage 1: adaptive arm router-behaviour pilot only',
  ];
}

export function followUpCommands(runId = '<runId>', expectedSha = '<clean-commit-sha>') {
  const authorization = ['--launch-approved', '--expected-sha', expectedSha];
  return [
    [
      process.execPath,
      'scripts/run-adaptive-register-switching.js',
      '--score-register-run',
      runId,
      ...authorization,
    ],
    [
      process.execPath,
      'scripts/run-adaptive-register-switching.js',
      '--read-manner-run',
      runId,
      ...authorization,
    ],
    [process.execPath, 'scripts/run-adaptive-register-switching.js', '--report-run', runId],
  ];
}

export function registerScoringCommands(runId) {
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

export function assertLaunchAuthorization(expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha || '')) {
    throw new Error('--launch-approved also requires --expected-sha with the exact 40-character clean commit SHA');
  }
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (head !== expectedSha) throw new Error(`launch SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
  if (gitOutput(['status', '--porcelain'])) throw new Error('paid Stage-1 work requires a clean checkout');
  return head;
}

function writePlanArtifact(plan, outputDir, { launchSha = null } = {}) {
  const validation = validateAdaptiveRegisterSwitchingPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const artifact = {
    schema: 'machinespirits.adaptive-register-switching-dry-run.v1',
    modelCalls: 0,
    paidLaunchStatus: launchSha ? 'authorized_for_stage1_generation' : 'locked_pending_explicit_operator_approval',
    stage2LaunchStatus: 'unavailable_in_this_runner',
    launchSha,
    validation,
    plan,
    generationCommand: renderCommand(generationCommand(), { scenarioEnv: true }),
    followUpCommands: followUpCommands().map((command) => renderCommand(command)),
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
    const placeholders = GRID.scenarios.map(() => '?').join(', ');
    return db
      .prepare(
        `SELECT id, run_id, scenario_id, profile_name, dialogue_id,
                id_construction_trace, tutor_register_scores, success
         FROM evaluation_results
         WHERE run_id = ?
           AND profile_name = ?
           AND scenario_id IN (${placeholders})
           AND success = 1
         ORDER BY scenario_id, id`,
      )
      .all(runId, GRID.arms.adaptive.profile, ...GRID.scenarios);
  } finally {
    db.close();
  }
}

/**
 * Zero-call analysis rows. The DB is resolved only through the read-only helper;
 * dialogue text comes from the stored log; manner readings are cache lookups.
 */
export function stage1Dialogues(runId, options = {}) {
  const root = options.root || ROOT;
  const rows = loadEvaluationRows(runId, { ...options, root });
  return rows.map((row) => {
    const log = (options.loadLog || loadDialogueLog)(row.dialogue_id, root);
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
        const presenceReading = lookupMannerPresence({
          registerName: selectedRegister,
          learnerMessage,
          tutorMessage,
        });
        return {
          turn: turnIndex,
          phase,
          learnerSignal: state.learner_signal || null,
          resistanceSignal: state.resistance_signal || null,
          selectedRegister,
          routerSelectedRegister,
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
    return {
      rowId: row.id,
      runId: row.run_id,
      scenarioId: row.scenario_id,
      profileName: row.profile_name,
      dialogueId: row.dialogue_id,
      turns,
      dialogueTrace: Array.isArray(log?.dialogueTrace) ? log.dialogueTrace : [],
      dialogueLogMissing: !log,
    };
  });
}

export function mannerTargets(dialogues) {
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

async function runGeneration() {
  await spawnAttended(generationCommand(), { scenarioEnv: true });
}

async function runRegisterScoring(runId) {
  // The frozen Stage-1 measure covers edged turns only. Keep the two registers
  // as separate attended passes so each slice opens its own registered rubric,
  // and stop immediately if either pass fails.
  for (const command of registerScoringCommands(runId)) {
    await spawnAttended(command, { scenarioEnv: true });
  }
}

async function runMannerRead(runId) {
  const targets = mannerTargets(stage1Dialogues(runId));
  console.log(`[register-switch] ${targets.length} edged turns to read for manner presence`);
  const failures = [];
  for (const [index, target] of targets.entries()) {
    process.stdout.write(
      `[${index + 1}/${targets.length}] ${target.scenarioId} turn ${target.turn} ${target.registerName} ... `,
    );
    const { reading, fromCache } = await readMannerPresence(target);
    const suffix = fromCache ? ' [cached]' : '';
    console.log(`${reading.status}${reading.reason ? ` (${reading.reason})` : ''}${suffix}`);
    if (reading.status !== 'present' && reading.status !== 'absent') {
      failures.push(`${target.key}: ${reading.reason || 'unread'}`);
    }
  }
  if (failures.length) throw new Error(`manner-reading pass incomplete: ${failures.join('; ')}`);
}

function runReport(runId, outputDir) {
  const dialogues = stage1Dialogues(runId);
  const provenance = checkAdaptiveTutorStackProvenance(dialogues);
  const report = summarizeAdaptiveRegisterSwitchingStage1(dialogues, { provenance });
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${runId}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ runId, report, dialogues }, null, 2)}\n`);

  console.log(`[register-switch] Stage 1 report ${report.status} (${report.observedRows}/${report.expectedRows} rows)`);
  console.log(
    `[register-switch] provenance ${provenance.seatCalls} tutor-seat calls: ` +
      `${Object.entries(provenance.observed)
        .map(([pair, count]) => `${pair} x${count}`)
        .join(', ') || 'none'}`,
  );
  const behavior = report.routerBehavior;
  console.log(
    `[register-switch] switches ${behavior.registerSwitches}; resistance edge ` +
      `${behavior.resistanceEdges}/${behavior.resistanceTurns}; uptake edge ` +
      `${behavior.uptakeEdges}/${behavior.uptakeTurns}; other edge ${behavior.otherEdges}`,
  );
  for (const bucket of Object.values(report.fidelityByRegister)) {
    console.log(
      `[register-switch] ${bucket.register}: ${bucket.turns} turns; cue gate ${bucket.cueCompliant}; ` +
        `manner ${bucket.mannerPresent} present/${bucket.mannerAbsent} absent/${bucket.mannerUnread} unread; ` +
        `register mean ${bucket.registerRubricMean == null ? 'n/a' : bucket.registerRubricMean.toFixed(2)}`,
    );
  }
  for (const error of report.errors) console.log(`  - ${error}`);
  console.log(`[register-switch] decision ${report.decision || 'WITHHELD'}`);
  console.log('[register-switch] Stage 2 remains unauthorized and unavailable in this runner');
  console.log(`[register-switch] ${path.relative(ROOT, jsonPath)}`);
  if (report.status !== 'COMPLETE') throw new Error('adaptive register-switching Stage-1 report failed closed');
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'score-register-run': { type: 'string', default: '' },
      'read-manner-run': { type: 'string', default: '' },
      'report-run': { type: 'string', default: '' },
      'output-dir': { type: 'string', default: 'exports/adaptive-register-switching' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: node scripts/run-adaptive-register-switching.js [--dry-run] ' +
        '[--launch-approved --expected-sha <sha>] ' +
        '[--score-register-run <runId> --launch-approved --expected-sha <sha>] ' +
        '[--read-manner-run <runId> --launch-approved --expected-sha <sha>] ' +
        '[--report-run <runId>] [--output-dir <dir>]',
    );
    return;
  }

  const paidSubmodes = [values['score-register-run'], values['read-manner-run']].filter(Boolean);
  if (paidSubmodes.length > 1) throw new Error('choose one paid Stage-1 submode at a time');
  if (values['report-run'] && (values['launch-approved'] || paidSubmodes.length)) {
    throw new Error('--report-run is a zero-call reporting mode');
  }
  if (values['dry-run'] && (values['launch-approved'] || values['report-run'] || paidSubmodes.length)) {
    throw new Error('--dry-run cannot be combined with launch, scoring, reading, or reporting');
  }
  if (values['report-run']) {
    runReport(values['report-run'], path.resolve(ROOT, values['output-dir']));
    return;
  }

  const launch = Boolean(values['launch-approved']);
  const launchSha = launch ? assertLaunchAuthorization(values['expected-sha']) : null;
  if (paidSubmodes.length && !launch) throw new Error('paid scoring/reading requires --launch-approved');
  if (values['score-register-run']) {
    await runRegisterScoring(values['score-register-run']);
    return;
  }
  if (values['read-manner-run']) {
    await runMannerRead(values['read-manner-run']);
    return;
  }

  const plan = buildAdaptiveRegisterSwitchingPlan();
  const outputDir = path.resolve(ROOT, values['output-dir']);
  const artifactPath = writePlanArtifact(plan, outputDir, { launchSha });
  console.log(`[register-switch] plan SHA-256 ${plan.planSha256}`);
  console.log(`[register-switch] Stage 1: ${plan.stage1Jobs.length} adaptive-arm rows`);
  console.log(`[register-switch] adaptive ${GRID.arms.adaptive.profile}`);
  console.log(`[register-switch] router menu additions ${GRID.arms.adaptive.routerRegisterMenu.join(', ')}`);
  console.log(`[register-switch] tutor/learner stack ${GRID.generation.tutorModel}`);
  console.log(
    `[register-switch] frozen Stage-2 power: ${GRID.stage2.plannedRowsPerArm}/arm ` +
      `(${GRID.stage2.plannedRows} total), exact Fisher power 0.8522 for 0.50 vs 0.85`,
  );
  console.log(`[register-switch] ${path.relative(ROOT, artifactPath)}`);
  if (!launch) {
    console.log('[register-switch] paid Stage 1 locked; use --launch-approved --expected-sha <clean-commit>');
    console.log('[register-switch] STOP — explicit operator approval required before any paid call');
    return;
  }

  await runGeneration();
  console.log('[register-switch] Stage-1 generation done; attended follow-ups (do not restart on failure):');
  for (const command of followUpCommands('<runId>', launchSha)) console.log(`  ${renderCommand(command)}`);
  console.log('[register-switch] Stage 2 remains locked');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[register-switch] ${error.message}`);
    process.exitCode = 1;
  });
}
