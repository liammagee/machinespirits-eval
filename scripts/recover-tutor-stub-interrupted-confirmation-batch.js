#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
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
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
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

function onlyTrace(traceDir) {
  const files = fs.readdirSync(traceDir).filter((name) => name.endsWith('.jsonl'));
  if (files.length !== 1) throw new Error(`expected exactly one trace in ${traceDir}; found ${files.length}`);
  return path.join(traceDir, files[0]);
}

function countReservations(tracePath) {
  return readJsonLines(tracePath).filter((event) => event.type === 'model_call_budget_reserved').length;
}

function replayEntry(event) {
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

function failedSemanticJudges(events) {
  return events.filter(
    (event) =>
      event.type === 'resistance_semantic_judge_result' &&
      event.transportCompleted === false &&
      event.validModelEnvelope === false &&
      event.record === null,
  );
}

function assertRecoverableFrozenPrefix(events, jobId) {
  if (
    events.some((event) =>
      [
        'resistance_semantic_judge_result',
        'resistance_action_register_outcome_learner_turn',
        'auto_learner_profile_measurement_indeterminate',
      ].includes(event.type),
    )
  ) {
    throw new Error(`frozen-prefix recovery refuses a semantic or outcome response for ${jobId}`);
  }
  const errors = events.filter((event) => event.type === 'model_call_error');
  if (
    errors.length !== 1 ||
    !/\b(timed out|response[- ]free|no structured output)\b/iu.test(String(errors[0].error || ''))
  ) {
    throw new Error(`frozen-prefix recovery requires one response-free technical error for ${jobId}`);
  }
}

async function recoverOneJudge({ failed, events, attemptsPath, maximumAttempts }) {
  const binding = loadTutorStubResistanceSemanticRegistration(failed.registrationPath);
  const instrument = tutorStubResistanceSemanticRuntimeInstrument(binding);
  const judge = binding.registration.measurement.judges.find((entry) => entry.id === failed.judgeId);
  if (!judge || judge.provider !== failed.expectedProvider || judge.model !== failed.expectedModel) {
    throw new Error(`semantic judge route drifted for ${failed.judgeId}`);
  }
  const errorEvent = [...events]
    .reverse()
    .find((event) => event.type === 'model_call_error' && event.role === failed.role && event.turn === failed.turn);
  if (!errorEvent?.request) throw new Error(`response-free request is missing for ${failed.judgeId}`);
  const prompt = JSON.parse(failed.userPrompt);
  let lastError = null;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const independentRunId = crypto.randomUUID();
    try {
      const raw = await callAIWithCliBridge(
        { provider: judge.provider, model: judge.model },
        failed.systemPrompt,
        failed.userPrompt,
        `${failed.role}_technical_recovery`,
        { effort: judge.effort, outputSchema: failed.outputSchema },
      );
      const modelOutput = JSON.parse(String(raw.text || '').trim());
      if (modelOutput.case_id !== failed.caseId) throw new Error('recovered semantic response case id mismatch');
      instrument.wrapModelOutput({
        modelOutput,
        prompt,
        judge,
        observedProvider: raw.provider,
        observedModel: raw.model,
        observedEffort: raw.effort || raw.reasoningEffort,
        independentRunId,
        structuredOutput: raw.structuredOutput,
        prohibitedToolEvents: Number.isInteger(raw.prohibitedToolEventCount) ? raw.prohibitedToolEventCount : null,
        modelAttestationBasis: raw.modelAttestationBasis,
        modelIndependentlyAttested: raw.modelIndependentlyAttested,
      });
      fs.appendFileSync(
        attemptsPath,
        `${JSON.stringify({ judge_id: failed.judgeId, attempt, status: 'complete', independentRunId, provider: raw.provider, model: raw.model })}\n`,
      );
      return {
        attempts: attempt,
        entry: {
          role: failed.role,
          turn: failed.turn,
          provider: failed.expectedProvider,
          model: failed.expectedModel,
          request: errorEvent.request,
          response: bridgeResponseRecord(raw),
        },
      };
    } catch (error) {
      lastError = error;
      fs.appendFileSync(
        attemptsPath,
        `${JSON.stringify({ judge_id: failed.judgeId, attempt, status: 'response_free_or_invalid', error: error.message })}\n`,
      );
      if (attempt < maximumAttempts) {
        const delay = attempt === 1 ? 15000 : 45000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(`judge recovery exhausted for ${failed.judgeId}: ${lastError?.message || 'no valid response'}`);
}

async function buildJobReplay({ job, sourceTrace, jobRoot, maximumAttempts }) {
  const events = readJsonLines(sourceTrace);
  const failedJudges = failedSemanticJudges(events);
  const attemptsPath = path.join(jobRoot, 'judge-attempts.jsonl');
  const replacements = new Map();
  let recoveryAttempts = 0;
  for (const failed of failedJudges) {
    const recovered = await recoverOneJudge({ failed, events, attemptsPath, maximumAttempts });
    replacements.set(`${failed.role}\u0000${failed.turn}`, recovered.entry);
    recoveryAttempts += recovered.attempts;
  }
  const entries = [];
  for (const event of events) {
    if (event.type === 'model_call') entries.push(replayEntry(event));
    if (event.type === 'model_call_error') {
      const key = `${event.role}\u0000${event.turn}`;
      if (replacements.has(key)) entries.push(replacements.get(key));
    }
  }
  if (!entries.length) throw new Error(`no completed model-call prefix exists for ${job.id}`);
  const replay = {
    schema: 'machinespirits.tutor-stub.frozen-model-call-prefix-replay.v1',
    source_trace: path.relative(ROOT, sourceTrace),
    source_trace_sha256: sha256(fs.readFileSync(sourceTrace)),
    technical_judge_recovery_attempts: recoveryAttempts,
    entries,
  };
  const replayPath = path.join(jobRoot, 'frozen-prefix-replay.json');
  writeJson(replayPath, replay);
  return { replayPath, recoveryAttempts, replayEntries: entries.length };
}

function runJob({ job, sourceTrace, jobRoot, replay, perDialogueCap }) {
  const priorReservations = countReservations(sourceTrace);
  const remaining = perDialogueCap - priorReservations - replay.recoveryAttempts;
  if (remaining <= 0) throw new Error(`dialogue ceiling exhausted before recovery for ${job.id}`);
  const traceDir = path.join(jobRoot, 'traces');
  const transcript = path.join(jobRoot, 'transcript.json');
  fs.mkdirSync(traceDir, { recursive: false });
  const args = [...job.command.args];
  replaceArg(args, '--model-call-budget', remaining);
  replaceArg(args, '--trace-dir', path.relative(ROOT, traceDir));
  replaceArg(args, '--save', path.relative(ROOT, transcript));
  const stdoutPath = path.join(jobRoot, 'stdout.log');
  const stderrPath = path.join(jobRoot, 'stderr.log');
  const stdoutFd = fs.openSync(stdoutPath, 'wx');
  const stderrFd = fs.openSync(stderrPath, 'wx');
  return new Promise((resolve, reject) => {
    const child = spawn(job.command.executable, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        ...job.command.env,
        TUTOR_STUB_FROZEN_MODEL_CALL_REPLAY_PATH: replay.replayPath,
      },
      stdio: ['ignore', stdoutFd, stderrFd],
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      fs.closeSync(stdoutFd);
      fs.closeSync(stderrFd);
      const traces = fs.readdirSync(traceDir).filter((name) => name.endsWith('.jsonl'));
      resolve({
        code,
        signal,
        tracePath: traces.length === 1 ? path.join(traceDir, traces[0]) : null,
        traceCount: traces.length,
        transcript,
        stdoutPath,
        stderrPath,
        priorReservations,
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchDir = path.resolve(ROOT, args['batch-dir'] || '');
  const recoveryRoot = path.resolve(ROOT, args.out || '');
  const maximumAttempts = Number(args['max-judge-attempts'] || 3);
  if (!args['batch-dir'] || !args.out || !Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new Error('usage: --batch-dir <interrupted-block> --out <fresh-recovery-dir> [--max-judge-attempts 3]');
  }
  if (fs.existsSync(recoveryRoot)) throw new Error('interrupted-batch recovery destination must be fresh and absent');
  const planPath = path.join(batchDir, 'batch-plan.json');
  const plan = readJson(planPath);
  const initialResultPath = path.join(batchDir, 'batch-result.json');
  const initial = fs.existsSync(initialResultPath) ? readJson(initialResultPath) : null;
  if (
    fs.existsSync(path.join(batchDir, 'batch-final-result.json')) ||
    fs.existsSync(path.join(batchDir, 'batch-seal.json'))
  ) {
    throw new Error('interrupted-batch recovery requires an unsealed create-once batch');
  }
  if (
    initial &&
    (initial.status !== 'incomplete' ||
      initial.results?.length !== plan.jobs.length ||
      initial.results.some((row) => row.status !== 'failed' || !row.trace))
  ) {
    throw new Error('interrupted-batch recovery requires only preserved failed rows');
  }
  const perDialogueCap = plan.budget.maximum_model_attempt_reservations_per_dialogue;
  const perBatchCap = plan.budget.maximum_model_attempt_reservations;
  fs.mkdirSync(path.join(recoveryRoot, 'jobs'), { recursive: true });
  const sources = plan.jobs.map((job) => {
    const row = initial?.results?.find((candidate) => candidate.job_id === job.id);
    const sourceTrace = row?.trace ? path.resolve(ROOT, row.trace) : onlyTrace(job.command.trace_dir);
    assertRecoverableFrozenPrefix(readJsonLines(sourceTrace), job.id);
    return { job, sourceTrace };
  });
  const initialReservationsByJob = Object.fromEntries(
    sources.map(({ job, sourceTrace }) => [job.id, countReservations(sourceTrace)]),
  );
  writeJson(path.join(recoveryRoot, 'recovery-plan.json'), {
    schema: 'machinespirits.tutor-stub.interrupted-confirmation-batch-recovery-plan.v1',
    status: 'planned_frozen_prefix_only',
    batch_id: plan.batch_id,
    original_plan_sha256: sha256(fs.readFileSync(planPath)),
    original_result_sha256: initial ? sha256(fs.readFileSync(initialResultPath)) : null,
    initial_model_attempt_reservations_by_job: initialReservationsByJob,
    maximum_semantic_judge_recovery_attempts_per_missing_judge: maximumAttempts,
    learner_or_tutor_regeneration_allowed: false,
    completed_model_calls_replayed_without_reservation: true,
  });

  const prepared = [];
  for (const source of sources) {
    const jobRoot = path.join(recoveryRoot, 'jobs', source.job.id);
    fs.mkdirSync(jobRoot, { recursive: false });
    const replay = await buildJobReplay({ ...source, jobRoot, maximumAttempts });
    prepared.push({ ...source, jobRoot, replay });
  }
  const executions = await Promise.all(
    prepared.map((entry) => runJob({ ...entry, perDialogueCap })),
  );
  const rows = [];
  const totals = {};
  for (let index = 0; index < prepared.length; index += 1) {
    const entry = prepared[index];
    const execution = executions[index];
    if (execution.code !== 0 || execution.traceCount !== 1 || !fs.existsSync(execution.transcript)) {
      throw new Error(
        `continued dialogue ${entry.job.id} failed with exit ${execution.code}; traces ${execution.traceCount}`,
      );
    }
    const continuationReservations = countReservations(execution.tracePath);
    const total = execution.priorReservations + entry.replay.recoveryAttempts + continuationReservations;
    if (total > perDialogueCap) throw new Error(`dialogue ceiling exceeded for ${entry.job.id}`);
    totals[entry.job.id] = total;
    rows.push({
      job_id: entry.job.id,
      status: 'complete',
      exit_code: 0,
      signal: execution.signal || null,
      trace: path.relative(ROOT, execution.tracePath),
      trace_sha256: sha256(fs.readFileSync(execution.tracePath)),
      trace_bytes: fs.statSync(execution.tracePath).size,
      trace_error: null,
      failure: null,
      stdout: path.relative(ROOT, execution.stdoutPath),
      stderr: path.relative(ROOT, execution.stderrPath),
      transcript: path.relative(ROOT, execution.transcript),
      origin: 'interrupted_technical_recovery_with_frozen_prefix_replay',
      replayed_model_calls: entry.replay.replayEntries,
      technical_judge_recovery_attempts: entry.replay.recoveryAttempts,
      continuation_model_attempt_reservations: continuationReservations,
    });
  }
  rows.sort((left, right) => left.job_id.localeCompare(right.job_id));
  const totalReservations = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (totalReservations > perBatchCap) throw new Error('interrupted recovery exceeded the unchanged batch ceiling');
  const recoveryResultPath = path.join(recoveryRoot, 'recovery-result.json');
  writeJson(recoveryResultPath, {
    schema: 'machinespirits.tutor-stub.interrupted-confirmation-batch-recovery-result.v1',
    status: 'complete',
    batch_id: plan.batch_id,
    observed_model_attempt_reservations: totalReservations,
    observed_model_attempt_reservations_by_job: totals,
    results: rows,
  });
  const finalPath = path.join(batchDir, 'batch-final-result.json');
  writeJson(finalPath, {
    schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-result.v1',
    batch_id: plan.batch_id,
    status: 'complete',
    completed_dialogues: plan.jobs.length,
    failed_or_missing_dialogues: 0,
    maximum_model_attempt_reservations: perBatchCap,
    observed_model_attempt_reservations: totalReservations,
    observed_model_attempt_reservations_by_job: totals,
    technical_recovery_used: true,
    recovery_unit_ids: plan.jobs.map((job) => job.id),
    results: rows,
  });
  writeJson(path.join(batchDir, 'batch-seal.json'), {
    schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-seal.v1',
    status: 'sealed_complete',
    batch_id: plan.batch_id,
    plan_sha256: sha256(fs.readFileSync(planPath)),
    result_sha256: sha256(fs.readFileSync(finalPath)),
    recovery_plan_sha256: sha256(fs.readFileSync(path.join(recoveryRoot, 'recovery-plan.json'))),
    recovery_result_sha256: sha256(fs.readFileSync(recoveryResultPath)),
    dialogues: plan.jobs.length,
    hard_ceiling: perBatchCap,
    observed_model_attempt_reservations: totalReservations,
    observed_model_attempt_reservations_by_job: totals,
    valid_unit_reruns: false,
    outcome_selection: false,
  });
  console.log(JSON.stringify({ status: 'complete', batch_id: plan.batch_id, observed_model_attempt_reservations: totalReservations }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
