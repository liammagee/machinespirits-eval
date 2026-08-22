#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import {
  loadTutorStubResistanceSemanticRegistration,
  tutorStubResistanceSemanticRuntimeInstrument,
} from '../services/tutorStubResistanceSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--') || index + 1 >= argv.length) throw new Error('invalid recovery arguments');
    values[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

function replaceArg(args, flag, value) {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) throw new Error(`recovery child command is missing ${flag}`);
  args[index + 1] = String(value);
}

function countReservations(tracePath) {
  return readJsonLines(tracePath).filter((event) => event.type === 'model_call_budget_reserved').length;
}

function modelCallReplayEntry(event) {
  return {
    role: event.role,
    turn: event.turn,
    provider: event.provider,
    model: event.model,
    request: event.request,
    response: event.response,
  };
}

function bridgeResponseRecord(raw) {
  return {
    text: raw.text,
    latencyMs: raw.latencyMs || 0,
    usage: {
      inputTokens: raw.inputTokens || 0,
      outputTokens: raw.outputTokens || 0,
      totalTokens: (raw.inputTokens || 0) + (raw.outputTokens || 0),
      cost: raw.cost || 0,
    },
    streamed: false,
    effort: raw.effort || raw.reasoningEffort || null,
    streamedEvents: raw.streamedEvents || 0,
    invalidStreamLines: raw.invalidStreamLines || 0,
    outputSource: raw.outputSource || null,
    structuredOutput: raw.structuredOutput === true,
    prohibitedToolEventCount: Number.isInteger(raw.prohibitedToolEventCount) ? raw.prohibitedToolEventCount : null,
    prohibitedToolEventCountObserved: Number.isInteger(raw.prohibitedToolEventCount),
    modelAttestationBasis: raw.modelAttestationBasis || null,
    modelIndependentlyAttested: raw.modelIndependentlyAttested === true,
  };
}

async function recoverJudge({ events, tracePath, recoveryRoot, maximumAttempts }) {
  const failedJudges = events.filter(
    (event) =>
      event.type === 'resistance_semantic_judge_result' &&
      event.transportCompleted === false &&
      event.validModelEnvelope === false &&
      event.record === null,
  );
  if (failedJudges.length !== 1) throw new Error('judge-only recovery requires exactly one response-free judge');
  const failed = failedJudges[0];
  const aggregateEvent = events.find((event) => event.type === 'resistance_semantic_adjudication');
  const terminal = events.find((event) => event.type === 'auto_learner_profile_measurement_indeterminate');
  if (!aggregateEvent || !terminal || aggregateEvent.aggregate?.status !== 'measurement_indeterminate') {
    throw new Error('judge-only recovery requires one preserved technical indeterminate aggregate');
  }
  const judgeEvents = events.filter((event) => event.type === 'resistance_semantic_judge_result');
  const valid = judgeEvents.filter((event) => event.validModelEnvelope === true && event.record);
  if (valid.length !== 2) throw new Error('judge-only recovery requires exactly two preserved valid judge records');

  const registrationBinding = loadTutorStubResistanceSemanticRegistration(failed.registrationPath);
  const instrument = tutorStubResistanceSemanticRuntimeInstrument(registrationBinding);
  const judge = registrationBinding.registration.measurement.judges.find((entry) => entry.id === failed.judgeId);
  if (!judge || judge.provider !== failed.expectedProvider || judge.model !== failed.expectedModel) {
    throw new Error('failed semantic judge route drifted');
  }
  const prompt = JSON.parse(failed.userPrompt);
  const prompts = Object.fromEntries(judgeEvents.map((event) => [event.judgeId, JSON.parse(event.userPrompt)]));
  const source = terminal.learnerText;
  const attemptPath = path.join(recoveryRoot, 'judge-attempts.jsonl');
  let raw = null;
  let record = null;
  let attempts = 0;
  let lastError = null;
  while (!record && attempts < maximumAttempts) {
    attempts += 1;
    const independentRunId = crypto.randomUUID();
    try {
      raw = await callAIWithCliBridge(
        { provider: judge.provider, model: judge.model },
        failed.systemPrompt,
        failed.userPrompt,
        `${failed.role}_technical_recovery`,
        { effort: judge.effort, outputSchema: failed.outputSchema },
      );
      const modelOutput = JSON.parse(String(raw.text || '').trim());
      if (modelOutput.case_id !== failed.caseId) throw new Error('recovered semantic response case id mismatch');
      record = instrument.wrapModelOutput({
        modelOutput,
        prompt,
        judge,
        observedProvider: raw.provider,
        observedModel: raw.model,
        observedEffort: raw.effort || raw.reasoningEffort,
        independentRunId,
        structuredOutput: raw.structuredOutput,
        prohibitedToolEvents:
          Number.isInteger(raw.prohibitedToolEventCount) ? raw.prohibitedToolEventCount : null,
        modelAttestationBasis: raw.modelAttestationBasis,
        modelIndependentlyAttested: raw.modelIndependentlyAttested,
      });
      fs.appendFileSync(
        attemptPath,
        `${JSON.stringify({ attempt: attempts, status: 'complete', independentRunId, provider: raw.provider, model: raw.model })}\n`,
      );
    } catch (error) {
      lastError = error;
      fs.appendFileSync(
        attemptPath,
        `${JSON.stringify({ attempt: attempts, status: 'response_free_or_invalid', error: error.message })}\n`,
      );
      if (attempts < maximumAttempts) {
        const delay = attempts === 1 ? 15000 : 45000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  if (!record) throw new Error(`judge-only recovery exhausted: ${lastError?.message || 'no valid response'}`);

  const responses = [...valid.map((event) => event.record), record];
  const aggregate = instrument.adjudicate({
    source,
    publicContext: aggregateEvent.publicContext,
    caseId: failed.caseId,
    responses,
    registration: registrationBinding.registration,
    prompts,
    advisorySignals: aggregateEvent.aggregate?.advisory_signals || [],
  });
  const failedRequest = [...events]
    .reverse()
    .find((event) => event.type === 'model_call_error' && event.role === failed.role)?.request;
  if (!failedRequest) throw new Error('failed judge request envelope is missing');
  const prefixRoles = ['tutor_stub_opening', 'tutor_stub_auto_learner', 'tutor_stub_learner_analysis'];
  const prefix = prefixRoles.map((role) => {
    const event = events.find((candidate) => candidate.type === 'model_call' && candidate.role === role);
    if (!event) throw new Error(`frozen prefix is missing ${role}`);
    return modelCallReplayEntry(event);
  });
  const recoveredEntry = {
    role: failed.role,
    turn: failed.turn,
    provider: judge.provider,
    model: judge.model,
    request: failedRequest,
    response: bridgeResponseRecord(raw),
  };
  const preservedJudgeEntries = ['semantic_judge_b', 'semantic_judge_c'].map((judgeId) => {
    const event = events.find(
      (candidate) =>
        candidate.type === 'model_call' &&
        candidate.role === `tutor_stub_resistance_semantic_${judgeId}`,
    );
    if (!event) throw new Error(`frozen prefix is missing ${judgeId}`);
    return modelCallReplayEntry(event);
  });
  const replay = {
    schema: 'machinespirits.tutor-stub.frozen-model-call-prefix-replay.v1',
    source_trace: path.relative(ROOT, tracePath),
    source_trace_sha256: sha256(fs.readFileSync(tracePath)),
    entries: [...prefix, recoveredEntry, ...preservedJudgeEntries],
  };
  const replayPath = path.join(recoveryRoot, 'frozen-prefix-replay.json');
  writeJson(replayPath, replay);
  writeJson(path.join(recoveryRoot, 'judge-recovery-result.json'), {
    schema: 'machinespirits.tutor-stub.resistance-semantic-judge-recovery-result.v1',
    status: aggregate.status,
    judge_id: failed.judgeId,
    attempts,
    source_trace_sha256: replay.source_trace_sha256,
    recovered_record: record,
    aggregate,
    replay_sha256: sha256(fs.readFileSync(replayPath)),
  });
  return { aggregate, attempts, replayPath };
}

function runContinuation({ batchDir, plan, initial, recoveryRoot, replayPath, recoveryAttempts }) {
  const failedRows = initial.results.filter((row) => row.status === 'failed');
  if (failedRows.length !== 1) throw new Error('continuation requires exactly one failed batch row');
  const failedRow = failedRows[0];
  const job = plan.jobs.find((entry) => entry.id === failedRow.job_id);
  if (!job) throw new Error('failed batch job is absent from the preserved plan');
  const sourceTrace = path.resolve(ROOT, failedRow.trace);
  const priorJobReservations = countReservations(sourceTrace);
  const remaining = plan.budget.maximum_model_attempt_reservations_per_dialogue - priorJobReservations - recoveryAttempts;
  if (remaining <= 0) throw new Error('judge-only recovery exhausted the dialogue attempt ceiling');

  const jobRoot = path.join(recoveryRoot, 'continued-job');
  const traceDir = path.join(jobRoot, 'traces');
  const transcript = path.join(jobRoot, 'transcript.json');
  fs.mkdirSync(jobRoot, { recursive: false });
  fs.mkdirSync(traceDir, { recursive: false });
  const args = [...job.command.args];
  replaceArg(args, '--model-call-budget', remaining);
  replaceArg(args, '--trace-dir', path.relative(ROOT, traceDir));
  replaceArg(args, '--save', path.relative(ROOT, transcript));
  const stdoutPath = path.join(jobRoot, 'stdout.log');
  const stderrPath = path.join(jobRoot, 'stderr.log');
  const stdoutFd = fs.openSync(stdoutPath, 'wx');
  const stderrFd = fs.openSync(stderrPath, 'wx');
  const child = spawnSync(job.command.executable, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      ...job.command.env,
      TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH: replayPath,
    },
    stdio: ['ignore', stdoutFd, stderrFd],
  });
  fs.closeSync(stdoutFd);
  fs.closeSync(stderrFd);
  const traces = fs.readdirSync(traceDir).filter((name) => name.endsWith('.jsonl'));
  if (child.status !== 0 || traces.length !== 1) {
    throw new Error(`continued dialogue failed with exit ${child.status}; traces ${traces.length}`);
  }
  const tracePath = path.join(traceDir, traces[0]);
  const continuationReservations = countReservations(tracePath);
  const initialReservations = plan.jobs.reduce((sum, entry) => {
    const row = initial.results.find((candidate) => candidate.job_id === entry.id);
    return sum + (row?.trace ? countReservations(path.resolve(ROOT, row.trace)) : 0);
  }, 0);
  const totalReservations = initialReservations + recoveryAttempts + continuationReservations;
  if (
    priorJobReservations + recoveryAttempts + continuationReservations >
      plan.budget.maximum_model_attempt_reservations_per_dialogue ||
    totalReservations > plan.budget.maximum_model_attempt_reservations
  ) {
    throw new Error('judge-only continuation exceeded an unchanged attempt ceiling');
  }
  const recoveredRow = {
    job_id: job.id,
    status: 'complete',
    exit_code: 0,
    signal: child.signal || null,
    trace: path.relative(ROOT, tracePath),
    trace_sha256: sha256(fs.readFileSync(tracePath)),
    trace_bytes: fs.statSync(tracePath).size,
    trace_error: null,
    failure: null,
    stdout: path.relative(ROOT, stdoutPath),
    stderr: path.relative(ROOT, stderrPath),
    transcript: path.relative(ROOT, transcript),
    origin: 'judge_only_technical_recovery_with_frozen_prefix_replay',
  };
  const finalRows = plan.jobs.map((entry) => {
    if (entry.id === job.id) return recoveredRow;
    return { ...initial.results.find((row) => row.job_id === entry.id), origin: 'initial_valid_unit' };
  });
  const finalPath = path.join(batchDir, 'batch-final-result.json');
  writeJson(finalPath, {
    schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-result.v1',
    batch_id: plan.batch_id,
    status: 'complete',
    completed_dialogues: 4,
    failed_or_missing_dialogues: 0,
    maximum_model_attempt_reservations: plan.budget.maximum_model_attempt_reservations,
    observed_model_attempt_reservations: totalReservations,
    technical_recovery_used: true,
    recovery_unit_ids: [job.id],
    results: finalRows,
  });
  writeJson(path.join(batchDir, 'batch-seal.json'), {
    schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-seal.v1',
    status: 'sealed_complete',
    batch_id: plan.batch_id,
    plan_sha256: sha256(fs.readFileSync(path.join(batchDir, 'batch-plan.json'))),
    result_sha256: sha256(fs.readFileSync(finalPath)),
    recovery_result_sha256: sha256(fs.readFileSync(path.join(recoveryRoot, 'judge-recovery-result.json'))),
    dialogues: 4,
    hard_ceiling: plan.budget.maximum_model_attempt_reservations,
    valid_unit_reruns: false,
    outcome_selection: false,
  });
  return { recoveredRow, continuationReservations, totalReservations };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchDir = path.resolve(ROOT, args['batch-dir'] || '');
  const recoveryRoot = path.resolve(ROOT, args.out || '');
  const maximumAttempts = Number(args['max-attempts'] || 3);
  if (!args['batch-dir'] || !args.out || !Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new Error('usage: --batch-dir <incomplete-block> --out <fresh-recovery-dir> [--max-attempts 3]');
  }
  if (fs.existsSync(recoveryRoot)) throw new Error('judge-only recovery destination must be fresh and absent');
  const plan = readJson(path.join(batchDir, 'batch-plan.json'));
  const initial = readJson(path.join(batchDir, 'batch-result.json'));
  if (initial.status !== 'incomplete' || fs.existsSync(path.join(batchDir, 'batch-seal.json'))) {
    throw new Error('judge-only recovery requires one unsealed incomplete batch');
  }
  const failed = initial.results.filter((row) => row.status === 'failed');
  if (failed.length !== 1 || !failed[0].trace) throw new Error('judge-only recovery requires one preserved failed trace');
  const tracePath = path.resolve(ROOT, failed[0].trace);
  fs.mkdirSync(recoveryRoot, { recursive: false });
  writeJson(path.join(recoveryRoot, 'recovery-plan.json'), {
    schema: 'machinespirits.tutor-stub.resistance-semantic-judge-recovery-plan.v1',
    status: 'planned_missing_judge_only',
    batch_plan_sha256: sha256(fs.readFileSync(path.join(batchDir, 'batch-plan.json'))),
    batch_result_sha256: sha256(fs.readFileSync(path.join(batchDir, 'batch-result.json'))),
    failed_trace_sha256: sha256(fs.readFileSync(tracePath)),
    maximum_attempts: maximumAttempts,
    learner_or_tutor_regeneration_allowed: false,
    preserved_valid_judges_required: 2,
  });
  const recovered = await recoverJudge({
    events: readJsonLines(tracePath),
    tracePath,
    recoveryRoot,
    maximumAttempts,
  });
  if (recovered.aggregate.status !== 'determinate') {
    console.log(JSON.stringify({ status: 'measurement_indeterminate', attempts: recovered.attempts }, null, 2));
    process.exitCode = 2;
    return;
  }
  const continuation = runContinuation({
    batchDir,
    plan,
    initial,
    recoveryRoot,
    replayPath: recovered.replayPath,
    recoveryAttempts: recovered.attempts,
  });
  console.log(
    JSON.stringify(
      {
        status: 'complete',
        judge_recovery_attempts: recovered.attempts,
        continuation_model_attempt_reservations: continuation.continuationReservations,
        batch_model_attempt_reservations: continuation.totalReservations,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
