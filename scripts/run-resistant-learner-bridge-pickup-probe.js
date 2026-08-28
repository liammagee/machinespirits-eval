#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { resolveModel } from '../services/evalConfigLoader.js';
import {
  buildTutorStubResistantLearnerCalibrationPlan,
  loadTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubResistantLearnerFinalHorizonPacket,
  buildTutorStubResistantLearnerSemanticPrompt,
  createTutorStubResistantLearnerSemanticRuntime,
  tutorStubResistantLearnerSemanticJudgeRoutes,
  tutorStubResistantLearnerSemanticSha256,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import { dispatchTutorStubCliBridgeRequest } from '../services/tutorStubCliRequest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-resistant-learner-b1-design.v3.json';
const SOURCE_DIRECTORY = 'resistant-learner-bridge-smoke-2026-08-24';
const DESTINATION_DIRECTORY = `${SOURCE_DIRECTORY}-pickup-probe`;

export const TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_ATTEMPT_CEILING = 12;
export const TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_JOB_IDS = Object.freeze([
  'B1-cal-warm-world_030_rowan_flat',
  'B1-cal-plain-world_029_riverside_clinic',
  'B1-cal-edged-world_031_tideway_makerspace',
]);
export const TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_USAGE = `Usage:
  EVAL_ARCHIVE_DIR=/path/to/machinespirits-eval-private \\
    node scripts/run-resistant-learner-bridge-pickup-probe.js --launch

Zero-call packet inspection:
  EVAL_ARCHIVE_DIR=/path/to/machinespirits-eval-private \\
    node scripts/run-resistant-learner-bridge-pickup-probe.js --dry-run

The attended launch reads the sealed bridge-smoke B1 transcripts and writes once to:
  $EVAL_ARCHIVE_DIR/artifacts/tutor-stub-live/${DESTINATION_DIRECTORY}

This is an unregistered descriptive primary-instrument probe. It creates no approval file, runs no
fidelity or register panel, retries no reader call, and never exceeds 12 model-call attempts.`;

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
}

function appendJsonLine(filePath, value) {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function gitOrNull(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function sourceProvenance() {
  return {
    commit: gitOrNull('rev-parse', 'HEAD'),
    tree: gitOrNull('rev-parse', 'HEAD^{tree}'),
    dirty: Boolean(gitOrNull('status', '--porcelain=v1', '--untracked-files=all')),
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readFileReadonly(filePath, encoding = null) {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    return fs.readFileSync(descriptor, encoding || undefined);
  } finally {
    fs.closeSync(descriptor);
  }
}

function readJsonReadonly(filePath) {
  return JSON.parse(readFileReadonly(filePath, 'utf8'));
}

function readJsonLinesReadonly(filePath) {
  return readFileReadonly(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1} is not valid JSON: ${error.message}`);
      }
    });
}

function one(rows, label) {
  if (rows.length !== 1) throw new Error(`pickup probe expected one ${label}, found ${rows.length}`);
  return rows[0];
}

function tracePathForJob(jobRoot) {
  const traceDirectory = path.join(jobRoot, 'traces');
  const files = fs
    .readdirSync(traceDirectory)
    .filter((name) => name.endsWith('.jsonl'))
    .sort();
  if (files.length !== 1) throw new Error(`pickup probe expected one sealed JSONL trace in ${jobRoot}`);
  return path.join(traceDirectory, files[0]);
}

function sourceArtifactDigest(transcriptPath, tracePath) {
  const transcript = readFileReadonly(transcriptPath);
  const trace = readFileReadonly(tracePath);
  return sha256(
    Buffer.concat([
      Buffer.from(`transcript.json\0${transcript.length}\0`),
      transcript,
      Buffer.from(`\0${path.basename(tracePath)}\0${trace.length}\0`),
      trace,
    ]),
  );
}

export function loadTutorStubResistantLearnerBridgePickupProbeInput({ jobId, sourceRoot, loaded, plan } = {}) {
  if (!TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_JOB_IDS.includes(jobId)) {
    throw new Error(`pickup probe job is not one of the three sealed B1 inputs: ${jobId}`);
  }
  const job = plan.jobs.find((candidate) => candidate.id === jobId);
  if (!job || job.study !== 'B1') throw new Error(`pickup probe cannot find registered B1 plan row ${jobId}`);
  const jobRoot = path.join(sourceRoot, 'jobs', jobId);
  const transcriptPath = path.join(jobRoot, 'transcript.json');
  const tracePath = tracePathForJob(jobRoot);
  const transcript = readJsonReadonly(transcriptPath);
  const events = readJsonLinesReadonly(tracePath);
  if (!Array.isArray(transcript?.turns)) throw new Error(`sealed transcript lacks turn records for ${jobId}`);
  const intervention = one(
    events.filter((event) => event.type === 'resistance_action_register_intervention_applied' && event.jobId === jobId),
    `${jobId} applied intervention`,
  );
  const outcome = one(
    events.filter((event) => event.type === 'resistance_action_register_outcome_learner_turn' && event.jobId === jobId),
    `${jobId} final learner outcome`,
  );
  one(
    events.filter(
      (event) => event.type === 'resistant_learner_bridge_smoke_final_readers_skipped' && event.jobId === jobId,
    ),
    `${jobId} final-reader skip record`,
  );
  if (events.some((event) => event.type === 'resistant_learner_semantic_reader_result')) {
    throw new Error(`sealed smoke input unexpectedly contains a reader result for ${jobId}`);
  }
  const triggerTurn = Number(intervention.turn);
  const turnNumber = Number(outcome.turn);
  if (
    !Number.isInteger(triggerTurn) ||
    !Number.isInteger(turnNumber) ||
    turnNumber !== triggerTurn + Number(job.outcome_horizon_learner_turns)
  ) {
    throw new Error(`sealed smoke horizon drifted for ${jobId}`);
  }
  const finalLearnerText = String(outcome.learnerText || '');
  const state = {
    trace: [],
    turns: transcript.turns,
    resistanceActionRegisterStudy: {
      resistant_learner_calibration: true,
      resistant_learner_study: 'B1',
      design: loaded.design,
      job_id: jobId,
      trigger_turn: triggerTurn,
      outcome_horizon_learner_turns: job.outcome_horizon_learner_turns,
    },
  };
  const publicPacket = buildTutorStubResistantLearnerFinalHorizonPacket(state, finalLearnerText);
  return {
    job,
    jobRoot,
    transcriptPath,
    tracePath,
    sourceArtifactDigest: sourceArtifactDigest(transcriptPath, tracePath),
    state,
    turnNumber,
    finalLearnerText,
    publicPacket,
    packetSha256: tutorStubResistantLearnerSemanticSha256(publicPacket),
    packetBytes: Buffer.from(JSON.stringify(publicPacket)),
  };
}

export function buildTutorStubResistantLearnerBridgePickupProbePlan({ archiveDir, root = ROOT } = {}) {
  const resolvedArchive = path.resolve(archiveDir || '');
  if (!archiveDir || !path.isAbsolute(archiveDir)) {
    throw new Error('EVAL_ARCHIVE_DIR must name the absolute private evaluation archive');
  }
  const loaded = loadTutorStubResistantLearnerDesign({ designPath: DESIGN_PATH, root });
  if (
    loaded.design.schema !== 'machinespirits.tutor-stub.resistant-learner-study-design.v3' ||
    loaded.design.studyId !== 'resistant-learner-b1-authored-pickup'
  ) {
    throw new Error('pickup probe requires the sealed B1 v3 design');
  }
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  const sourceRoot = path.join(resolvedArchive, 'artifacts', 'tutor-stub-live', SOURCE_DIRECTORY);
  const destination = path.join(resolvedArchive, 'artifacts', 'tutor-stub-live', DESTINATION_DIRECTORY);
  const inputs = TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_JOB_IDS.map((jobId) =>
    loadTutorStubResistantLearnerBridgePickupProbeInput({ jobId, sourceRoot, loaded, plan }),
  );
  const readers = tutorStubResistantLearnerSemanticJudgeRoutes(loaded.design);
  if (
    JSON.stringify(readers.map((reader) => reader.modelRef)) !==
      JSON.stringify(['codex.gpt-5.6-sol', 'claude-code.sonnet-5']) ||
    readers.some((reader) => reader.effort !== 'low')
  ) {
    throw new Error('pickup probe reader seats drifted from the B1 registration');
  }
  const plannedCalls = inputs.length * readers.length;
  const jobs = inputs.map((input) => ({
    id: input.job.id,
    packet_sha256: input.packetSha256,
    source_artifact_sha256: input.sourceArtifactDigest,
    reader_prompts: readers.map((judge) => {
      const prompt = buildTutorStubResistantLearnerSemanticPrompt({
        caseId: input.job.id,
        study: 'B1',
        instrument: 'primary',
        publicPacket: input.publicPacket,
        judge,
        design: loaded.design,
      });
      return {
        judge_id: judge.id,
        model_ref: judge.modelRef,
        prompt_sha256: tutorStubResistantLearnerSemanticSha256(prompt),
      };
    }),
  }));
  return {
    loaded,
    inputs,
    destination,
    plan: {
      schema: 'machinespirits.tutor-stub.resistant-learner-bridge-pickup-probe-plan.v1',
      exploratory: true,
      registered: false,
      source_root: sourceRoot,
      source_access: 'read_only',
      design_path: DESIGN_PATH,
      design_sha256: loaded.sha256,
      instrument: 'primary',
      excluded_instruments: ['fidelity', 'register'],
      generator_excluded: true,
      readers,
      jobs,
      planned_model_calls: plannedCalls,
      hard_attempt_ceiling: TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_ATTEMPT_CEILING,
      retry_policy: 'none',
      model_calls_executed: 0,
    },
  };
}

export function createTutorStubResistantLearnerBridgePickupProbeTransport({
  callBridge = callAIWithCliBridge,
  attemptCeiling = TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_ATTEMPT_CEILING,
} = {}) {
  let attempts = 0;
  async function callPromptModel({
    prompt,
    messageHistory = [],
    resolved,
    systemPrompt,
    role,
    maxTokens,
    trace,
    cliEffort,
    effort,
    outputSchema,
    turn,
    signal,
  }) {
    if (attempts >= attemptCeiling) {
      throw new Error('pickup probe hard attempt ceiling exhausted before model call');
    }
    attempts += 1;
    trace.push({
      type: 'model_call_budget_reserved',
      role,
      turn,
      attempt: attempts,
      hard_attempt_ceiling: attemptCeiling,
    });
    const startedAt = new Date().toISOString();
    try {
      const result = await dispatchTutorStubCliBridgeRequest(callBridge, {
        resolved,
        systemPrompt,
        userPrompt: prompt,
        role,
        messageHistory,
        effort: effort || cliEffort,
        outputSchema,
        signal,
      });
      const response = {
        text: result.text,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: {
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
          cost: result.cost || 0,
        },
        effort: result.effort || result.reasoningEffort || null,
        reasoningEffort: result.reasoningEffort || result.effort || null,
        structuredOutput: result.structuredOutput === true,
        prohibitedToolEventCount: Number(result.prohibitedToolEventCount || 0),
        prohibitedToolEventCountObserved:
          Object.hasOwn(result, 'prohibitedToolEventCount') && Number.isInteger(result.prohibitedToolEventCount),
        modelAttestationBasis: result.modelAttestationBasis || null,
        modelIndependentlyAttested: result.modelIndependentlyAttested === true,
      };
      trace.push({
        type: 'model_call',
        role,
        turn,
        startedAt,
        provider: response.provider,
        model: response.model,
        request: { systemPrompt, prompt, messageHistory, maxTokens, cliEffort, outputSchema },
        response: {
          text: response.text,
          effort: response.effort,
          structuredOutput: response.structuredOutput,
          prohibitedToolEventCount: response.prohibitedToolEventCount,
          prohibitedToolEventCountObserved: response.prohibitedToolEventCountObserved,
        },
      });
      return response;
    } catch (error) {
      trace.push({
        type: 'model_call_error',
        role,
        turn,
        startedAt,
        provider: resolved.provider,
        model: resolved.model,
        error: error.message,
      });
      throw error;
    }
  }
  return { callPromptModel, attempts: () => attempts };
}

function readerRecords(trace) {
  return trace
    .filter((event) => event.type === 'resistant_learner_semantic_reader_result')
    .map((event) => ({
      judge_id: event.judgeId,
      model_ref: event.modelRef,
      independent_run_id: event.independentRunId,
      transport_completed: event.transportCompleted,
      invalid_reason: event.invalidReason,
      record: event.record,
    }));
}

export async function executeTutorStubResistantLearnerBridgePickupProbe({
  destination,
  loaded,
  inputs,
  provenance = sourceProvenance(),
  callBridge = callAIWithCliBridge,
  resolveModelRef = resolveModel,
} = {}) {
  if (fs.existsSync(destination)) throw new Error('bridge pickup probe destination is create-once');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination, { recursive: false });
  const ledgerPath = path.join(destination, 'probe-ledger.jsonl');
  writeOnce(ledgerPath, '');
  const readers = tutorStubResistantLearnerSemanticJudgeRoutes(loaded.design);
  writeOnce(path.join(destination, 'probe-plan.json'), {
    schema: 'machinespirits.tutor-stub.resistant-learner-bridge-pickup-probe-execution-plan.v1',
    exploratory: true,
    registered: false,
    approval_file: null,
    source: provenance,
    instrument: 'primary',
    readers,
    hard_attempt_ceiling: TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_ATTEMPT_CEILING,
    jobs: inputs.map((input) => ({ id: input.job.id, packet_sha256: input.packetSha256 })),
  });
  appendJsonLine(ledgerPath, {
    at: new Date().toISOString(),
    type: 'probe_started',
    planned_dialogues: inputs.length,
    planned_model_calls: inputs.length * readers.length,
    hard_attempt_ceiling: TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_ATTEMPT_CEILING,
  });

  const transport = createTutorStubResistantLearnerBridgePickupProbeTransport({ callBridge });
  const dialogues = [];
  let executionHalt = null;
  for (const input of inputs) {
    const state = { ...input.state, trace: [] };
    const runtime = createTutorStubResistantLearnerSemanticRuntime({
      appendTraceEvent(target, event) {
        target.push(event);
      },
      callPromptModel: transport.callPromptModel,
      resolveModel: resolveModelRef,
    });
    let primary = null;
    const technicalIssues = [];
    try {
      primary = await runtime.adjudicatePrimaryPanel({
        state,
        turnNumber: input.turnNumber,
        publicPacket: input.publicPacket,
        throwOnReaderError: true,
      });
    } catch (error) {
      technicalIssues.push(error.message);
    }
    const records = readerRecords(state.trace);
    if (technicalIssues.length === 0 && records.length !== readers.length) {
      technicalIssues.push(`expected ${readers.length} reader records, found ${records.length}`);
    }
    const currentSourceDigest = sourceArtifactDigest(input.transcriptPath, input.tracePath);
    if (currentSourceDigest !== input.sourceArtifactDigest) {
      technicalIssues.push('sealed smoke source changed while the probe was reading it');
    }
    const dialogue = {
      job_id: input.job.id,
      packet_sha256: input.packetSha256,
      reader_records: records,
      field_agreement: primary?.fields || null,
      registered_both_agree_minimum_eligible_votes: primary?.minimum_eligible_votes || 2,
      model_calls: state.trace.filter((event) => event.type === 'model_call_budget_reserved').length,
      source_artifact_sha256: input.sourceArtifactDigest,
    };
    dialogues.push(dialogue);
    if (technicalIssues.length > 0) executionHalt = { job_id: input.job.id, technical_issues: technicalIssues };
    appendJsonLine(ledgerPath, {
      at: new Date().toISOString(),
      type: 'dialogue_scored',
      job_id: input.job.id,
      packet_sha256: input.packetSha256,
      model_calls: dialogue.model_calls,
      cumulative_model_calls: transport.attempts(),
      ...(executionHalt ? { execution_halt: executionHalt } : {}),
    });
    process.stdout.write(
      `pickup probe dialogue ${dialogues.length}/${inputs.length}; calls ${transport.attempts()}/${TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_ATTEMPT_CEILING}${executionHalt ? '; halted on technical failure' : ''}\n`,
    );
    if (executionHalt) break;
  }

  const report = {
    schema: 'machinespirits.tutor-stub.resistant-learner-bridge-pickup-probe-report.v1',
    exploratory: true,
    registered: false,
    generated_at: new Date().toISOString(),
    instrument: 'primary',
    hard_attempt_ceiling: TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_ATTEMPT_CEILING,
    model_calls: transport.attempts(),
    dialogues_planned: inputs.length,
    dialogues_recorded: dialogues.length,
    execution_halt: executionHalt,
    dialogues,
  };
  writeOnce(path.join(destination, 'probe-report.json'), report);
  appendJsonLine(ledgerPath, {
    at: new Date().toISOString(),
    type: 'probe_sealed',
    dialogues_recorded: dialogues.length,
    model_calls: transport.attempts(),
    execution_halt: executionHalt,
  });
  return report;
}

function archiveDirectoryFromEnvironment(env) {
  const archive = String(env.EVAL_ARCHIVE_DIR || '').trim();
  if (!archive || !path.isAbsolute(archive)) {
    throw new Error('EVAL_ARCHIVE_DIR must name the absolute private evaluation archive');
  }
  return archive;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({
    args: argv,
    options: {
      launch: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  process.stdout.write(`${TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_PICKUP_PROBE_USAGE}\n`);
  if (values.help || (!values.launch && !values['dry-run'])) return;
  if (values.launch && values['dry-run']) throw new Error('choose exactly one of --launch or --dry-run');
  const archiveDir = archiveDirectoryFromEnvironment(env);
  const built = buildTutorStubResistantLearnerBridgePickupProbePlan({ archiveDir });
  if (fs.existsSync(built.destination)) throw new Error('bridge pickup probe destination is create-once');
  if (values['dry-run']) {
    process.stdout.write(
      `${JSON.stringify(
        { ...built.plan, destination: built.destination, destination_absent: true, production_writes: 0 },
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('the bridge pickup probe launch requires one attended terminal invocation');
  }
  const report = await executeTutorStubResistantLearnerBridgePickupProbe({
    destination: built.destination,
    loaded: built.loaded,
    inputs: built.inputs,
  });
  process.stdout.write(`pickup probe report: ${path.join(built.destination, 'probe-report.json')}\n`);
  if (report.execution_halt) process.exitCode = 1;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
