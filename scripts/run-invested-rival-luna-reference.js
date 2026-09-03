#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import {
  buildContinuityProofPlan,
  buildContinuityRequest,
  callContinuityModel,
  CONTINUITY_OUTPUT_SCHEMA,
  runContinuityArm,
} from '../services/localQwenRefusalContinuity.js';
import { renderContinuityReport } from '../services/localQwenRefusalContinuityReport.js';
import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import {
  benchmarkOutputSchemaIssues,
  buildBenchmarkJobs,
  readBenchmarkArm,
  scoreBenchmarkArms,
} from './score-local-qwen-resistant-learner-benchmark.js';
import {
  allowUnknownRootOutputFields,
  buildInvestedRivalPlan,
  investedRivalDeliveredSourceContext,
  projectRegisteredRootOutput,
} from './run-local-qwen-invested-rival.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = 'config/tutor-stub-local-learners/invested-rival-luna-reference.v1.yaml';
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function reportMeta(config) {
  return {
    ...Object.fromEntries(
      Object.entries(config.report).map(([key, value]) => [
        key.replace(/_([a-z])/gu, (_match, letter) => letter.toUpperCase()),
        value,
      ]),
    ),
    learnerFamilyLabel: 'learner',
    attemptScopeLabel: 'new paid attempts used',
    opusAttemptScopeLabel: 'new Opus attempts used',
  };
}

export function buildLunaReferencePlan(root = ROOT, configPath = DEFAULT_CONFIG) {
  const config = yaml.parse(fs.readFileSync(path.resolve(root, configPath), 'utf8'));
  const base = buildInvestedRivalPlan(root, config.source_config);
  if (
    config.id !== 'invested-rival-luna-reference-v1' ||
    config.total_attempt_ceiling !== 23 ||
    config.generation_attempt_ceiling !== 16 ||
    config.assessment_packets !== 5 ||
    config.response_free_recovery_reserve !== 2 ||
    config.generation_attempt_ceiling + config.assessment_packets + config.response_free_recovery_reserve !==
      config.total_attempt_ceiling
  ) {
    throw new Error('Luna reference attempt plan differs from the registered 23-attempt design');
  }
  if (
    config.models.learner !== 'codex.gpt-5.6-luna' ||
    config.models.tutor !== 'codex.gpt-5.6-sol' ||
    config.models.judge !== 'claude-code.claude-opus-5'
  ) {
    throw new Error('Luna reference model route drift');
  }
  const arm = {
    id: 'C',
    label: 'Luna learner',
    displayLabel: 'Luna learner · direct',
    variant: 'luna',
    mode: 'direct',
    tutorMode: 'direct',
    profile: 'codex',
    provider: 'codex',
    model: config.models.learner,
  };
  return {
    ...base,
    id: config.id,
    design: config.design,
    output: config.output,
    total_attempt_ceiling: config.total_attempt_ceiling,
    recovery_attempt_reserve: config.response_free_recovery_reserve,
    generationCap: config.generation_attempt_ceiling,
    judge_calls: config.assessment_packets,
    arms: [arm],
    lunaArm: arm,
    models: config.models,
    sealedQwenReference: config.sealed_qwen_reference,
    reportMeta: reportMeta(config),
  };
}

export function readSealedQwenReference(plan, sourceDir) {
  const root = path.resolve(sourceDir);
  const expected = plan.sealedQwenReference;
  const files = {
    publicDialogues: path.join(root, 'public-dialogues.json'),
    scores: path.join(root, 'evaluation', 'scores.json'),
    reportData: path.join(root, 'report-data.json'),
  };
  const hashes = {
    publicDialogues: sha256(files.publicDialogues),
    scores: sha256(files.scores),
    reportData: sha256(files.reportData),
  };
  if (
    hashes.publicDialogues !== expected.public_dialogues_sha256 ||
    hashes.scores !== expected.scores_sha256 ||
    hashes.reportData !== expected.report_data_sha256
  ) {
    throw new Error('sealed Qwen reference hash drift');
  }
  const report = JSON.parse(fs.readFileSync(files.reportData, 'utf8'));
  const evaluation = JSON.parse(fs.readFileSync(files.scores, 'utf8'));
  if (
    report.provenance?.studyId !== expected.study_id ||
    report.provenance?.commit !== expected.launch_commit ||
    report.provenance?.configuredModels?.learner?.A !== expected.normal_model ||
    report.provenance?.configuredModels?.learner?.B !== expected.abliterated_model ||
    report.provenance?.configuredModels?.tutor !== plan.models.tutor ||
    report.provenance?.configuredModels?.judge !== plan.models.judge ||
    report.arms?.map((arm) => `${arm.id}:${arm.model}:${arm.snapshot?.turns?.length}`).join(',') !==
      `A:${expected.normal_model}:8,B:${expected.abliterated_model}:8` ||
    evaluation.scores?.map((score) => `${score.arm}/${score.kind}`).join(',') !==
      'A/tutor,A/learner,A/dialogue,A/quality,B/tutor,B/learner,B/dialogue,B/quality'
  ) {
    throw new Error('sealed Qwen reference content differs from the registered comparison');
  }
  return { root, hashes, arms: report.arms, evaluation };
}

export async function callLunaReferenceModel(args, callCli = callAIWithCliBridge) {
  if (args.speaker === 'tutor') return callContinuityModel({ ...args, callCli });
  return callCli(
    { provider: 'codex', model: 'gpt-5.6-luna' },
    args.request.systemPrompt,
    args.request.prompt,
    args.role,
    {
      effort: 'medium',
      timeoutMs: 180_000,
      messageHistory: args.request.messageHistory,
      outputSchema: CONTINUITY_OUTPUT_SCHEMA,
      onEvent: args.onEvent,
      singleAttempt: true,
    },
  );
}

function paidBudget(admission, limit) {
  return {
    reserve(detail = {}) {
      const reservation = admission.reserveModelAttempts(1, detail);
      return { call: reservation.study_reserved, limit, remaining: reservation.remaining };
    },
    snapshot() {
      return { used: admission.studyReserved, limit };
    },
  };
}

function retryableResponseFreeFailure(error) {
  return (
    error?.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' &&
    error?.classification === 'response_free_error' &&
    ['result_error_without_structured_output', 'provider_rejected_invalid_structured_output'].includes(error?.reason)
  );
}

function providerRejectedInvalidOutput(response, projection, outputSchema) {
  if (response?.structuredOutputRecovery?.providerValidated !== false) return null;
  const issues = benchmarkOutputSchemaIssues(JSON.parse(projection.text), outputSchema);
  if (!issues.length) return null;
  const error = new Error(
    `claude CLI provider-rejected structured output failed the registered schema (${issues.slice(0, 8).join(', ')})`,
  );
  error.code = 'CLI_PROVIDER_RESPONSE_FREE_ERROR';
  error.classification = 'response_free_error';
  error.reason = 'provider_rejected_invalid_structured_output';
  error.responseFree = true;
  return error;
}

export function makeLunaJudgeCaller({
  budget,
  outDir,
  maximumResponseFreeRetries = 2,
  priorPhysicalAttempts = 0,
  priorResponseFreeRetries = 0,
  callCli = callAIWithCliBridge,
}) {
  if (
    !Number.isSafeInteger(priorPhysicalAttempts) ||
    priorPhysicalAttempts < 0 ||
    !Number.isSafeInteger(priorResponseFreeRetries) ||
    priorResponseFreeRetries < 0 ||
    priorResponseFreeRetries > priorPhysicalAttempts ||
    priorResponseFreeRetries > maximumResponseFreeRetries
  ) {
    throw new Error('invalid prior judge-attempt counters');
  }
  let physicalAttempts = priorPhysicalAttempts;
  let responseFreeRetries = priorResponseFreeRetries;
  const caller = async (agent, systemPrompt, userPrompt, role, options) => {
    for (;;) {
      const reservation = budget.reserve({ role, stage: 'assessment' });
      physicalAttempts += 1;
      let rawOutput;
      try {
        const response = await callCli(agent, systemPrompt, userPrompt, role, {
          ...options,
          outputSchema: allowUnknownRootOutputFields(options.outputSchema),
          onRawOutput: (output) => {
            rawOutput = output;
          },
        });
        const projection = projectRegisteredRootOutput(response.text, options.outputSchema);
        const providerFailure = providerRejectedInvalidOutput(response, projection, options.outputSchema);
        if (providerFailure) throw providerFailure;
        budget.complete?.();
        options.onRawOutput?.(rawOutput);
        fs.appendFileSync(
          path.join(outDir, 'assessment-physical-attempts.jsonl'),
          `${JSON.stringify({ role, attempt: physicalAttempts, reservation, status: 'candidate_returned', discardedRootKeys: projection.discardedRootKeys })}\n`,
        );
        return { ...response, text: projection.text, outputProjection: projection };
      } catch (error) {
        budget.fail?.(error);
        fs.appendFileSync(
          path.join(outDir, 'assessment-physical-attempts.jsonl'),
          `${JSON.stringify({ role, attempt: physicalAttempts, reservation, status: 'failed', code: error.code, classification: error.classification, reason: error.reason, message: error.message })}\n`,
        );
        if (!retryableResponseFreeFailure(error) || responseFreeRetries >= maximumResponseFreeRetries) throw error;
        responseFreeRetries += 1;
      }
    }
  };
  caller.snapshot = () => ({ physicalAttempts, responseFreeRetries });
  return caller;
}

function syntheticLunaArm(plan) {
  let releasedPremiseIds = [];
  const turns = [];
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    const proof = buildContinuityProofPlan({ plan, turn, releasedPremiseIds });
    releasedPremiseIds = [...releasedPremiseIds, ...proof.requiredReleases.map((row) => row.premise)];
    turns.push({
      turn,
      learner: `Synthetic Luna learner turn ${turn}; packet fixture, not model output.`,
      tutor: proof.sources.map((source) => source.text).join(' ') || `Synthetic Sol tutor turn ${turn}.`,
    });
  }
  return {
    ...plan.lunaArm,
    opening: plan.world.opening_frame.authored_text,
    transcript: turns
      .flatMap((row) => [`Learner ${row.turn}: ${row.learner}`, `Tutor ${row.turn}: ${row.tutor}`])
      .join('\n'),
    wallTimeMs: 0,
    repetition: { meanLexicalSurpriseAfterOpening: null },
    technical: {
      learnerMechanism: { calls: 0, medianLatencyMs: null, totalLatencyMs: 0 },
      learnerFinal: { calls: 0, meanEndToEndOutputTokensPerSecond: null },
      tutor: { calls: 0, totalLatencyMs: 0 },
    },
    snapshot: {
      turns,
      maxExchanges: plan.max_exchanges,
      disposition: 'exchange_cap',
      proofControl: { releasedPremiseIds, publicProofEntailed: true },
    },
  };
}

function renderCombined({ plan, qwen, luna, evaluation, provenance, outDir, mock = false }) {
  const result = {
    arms: [...qwen.arms, luna],
    evaluation,
    provenance,
    characterBrief: plan.characterBrief,
    proofControl: true,
    comparisonLabel: 'Post-hoc descriptive reference',
    corrections: [
      'The two Qwen dialogues and their eight assessments are sealed inputs and were not regenerated or rejudged.',
      'Luna receives the same character, opening, public proof schedule and Sol tutor, but was added after the Qwen outcomes were known.',
      'Surplus provider root fields are discarded; every registered value is then checked by the unchanged strict local schema.',
      'This is a single-dialogue acting reference, not a causal model-family comparison or model ranking.',
    ],
    reportMeta: plan.reportMeta,
    mock,
  };
  writeJson(path.join(outDir, mock ? 'report-preview-data.json' : 'report-data.json'), result);
  const rendered = renderContinuityReport(result);
  fs.writeFileSync(path.join(outDir, mock ? 'report-preview.html' : 'report.html'), rendered.html, { flag: 'wx' });
  writeJson(path.join(outDir, mock ? 'public-preview.json' : 'public-dialogues.json'), rendered.interchange);
}

function provenance(plan, admission, qwen) {
  return {
    commit: admission.source.commit,
    tree: admission.source.tree,
    dirty: false,
    detached: true,
    studyId: plan.id,
    totalAttemptCeiling: plan.total_attempt_ceiling,
    generationAttemptMaximum: plan.generationCap,
    plannedAssessmentPackets: plan.judge_calls,
    responseFreeRecoveryReserve: plan.recovery_attempt_reserve,
    configuredModels: { learner: plan.models.learner, tutor: plan.models.tutor, judge: plan.models.judge },
    authorization: admission.authorization,
    sealedQwenReference: { root: qwen.root, hashes: qwen.hashes, studyId: plan.sealedQwenReference.study_id },
  };
}

async function dryRun(plan, qwen, outDir) {
  if (fs.existsSync(outDir)) throw new Error('dry-run destination is create-once');
  fs.mkdirSync(outDir, { recursive: true });
  const luna = syntheticLunaArm(plan);
  let releasedPremiseIds = [];
  const preflight = [];
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    const request = buildContinuityRequest({
      plan,
      speaker: 'tutor',
      turn,
      history: [{ role: 'assistant', content: plan.world.opening_frame.authored_text }],
      releasedPremiseIds,
    });
    preflight.push(request);
    releasedPremiseIds = [...releasedPremiseIds, ...request.proofPlan.requiredReleases.map((row) => row.premise)];
  }
  const packets = buildBenchmarkJobs([luna], {
    extendedQuality: true,
    splitQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: { C: investedRivalDeliveredSourceContext(plan, luna) },
  });
  if (packets.length !== plan.judge_calls) throw new Error('dry-run packet count drift');
  writeJson(path.join(outDir, 'preflight.json'), {
    modelCalls: 0,
    qwen: qwen.hashes,
    tutorRequests: preflight,
    packets,
  });
  renderCombined({
    plan,
    qwen,
    luna,
    evaluation: { scores: qwen.evaluation.scores, attemptsUsed: 0, plannedNewAssessmentPackets: 5 },
    provenance: { totalAttemptCeiling: 23, budget: { used: 0, limit: 23 }, synthetic: true },
    outDir,
    mock: true,
  });
  return { outDir, dryRun: true, packets: packets.length };
}

async function liveRun(plan, qwen, outDir, admission) {
  const budget = paidBudget(admission, plan.total_attempt_ceiling);
  const started = Date.now();
  try {
    admission.record({ type: 'sealed_qwen_reference_verified', hashes: qwen.hashes, new_model_attempts: 0 });
    writeJson(path.join(outDir, 'plan.json'), { ...plan, sealedQwenReferenceRoot: qwen.root });
    await runContinuityArm({
      plan,
      arm: plan.lunaArm,
      outDir: path.join(outDir, 'C'),
      budget,
      callModel: callLunaReferenceModel,
      unsupportedQuotationPolicy: 'drop',
    });
    const luna = readBenchmarkArm({
      ...plan.lunaArm,
      path: path.join(outDir, 'C', 'dialogue.json'),
      wallTimeMs: Date.now() - started,
    });
    writeJson(path.join(outDir, 'luna-arm.json'), luna);
    const judge = makeLunaJudgeCaller({ budget, outDir });
    const newEvaluation = await scoreBenchmarkArms([luna], path.join(outDir, 'evaluation'), {
      ceiling: 5,
      extendedQuality: true,
      splitQuality: true,
      allowOneBasedIndices: true,
      assessmentContext: plan.assessmentContext,
      publicSourceContextByArm: { C: investedRivalDeliveredSourceContext(plan, luna) },
      callJudge: judge,
    });
    const judgeUse = judge.snapshot();
    const evaluation = {
      ...newEvaluation,
      scores: [...qwen.evaluation.scores, ...newEvaluation.scores],
      reusedAssessments: qwen.evaluation.scores.length,
      newLogicalAssessments: newEvaluation.scores.length,
      plannedNewAssessmentPackets: 5,
      newPhysicalAttempts: judgeUse.physicalAttempts,
      responseFreeRetries: judgeUse.responseFreeRetries,
    };
    const finalProvenance = { ...provenance(plan, admission, qwen), budget: budget.snapshot() };
    renderCombined({ plan, qwen, luna, evaluation, provenance: finalProvenance, outDir });
    writeJson(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      lunaExchanges: luna.snapshot.turns.length,
      lunaDisposition: luna.snapshot.disposition,
      reusedQwenAssessments: qwen.evaluation.scores.length,
      newLogicalAssessments: newEvaluation.scores.length,
      newAssessmentPackets: 5,
      judgePhysicalAttempts: judgeUse.physicalAttempts,
      responseFreeRetries: judgeUse.responseFreeRetries,
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      completed_arms: 1,
      completed_assessments: newEvaluation.scores.length,
      reused_qwen_assessments: qwen.evaluation.scores.length,
      reserved_attempts: admission.reserved,
    });
    return { outDir, dryRun: false, attempts: budget.snapshot().used };
  } catch (error) {
    if (!fs.existsSync(path.join(outDir, 'stopped.json'))) {
      writeJson(path.join(outDir, 'stopped.json'), { error: error.message, budget: budget.snapshot() });
    }
    admission.close({
      type: 'run_sealed',
      status: 'failed',
      error: error.message,
      reserved_attempts: admission.reserved,
    });
    throw error;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      live: { type: 'boolean', default: false },
      config: { type: 'string' },
      reference: { type: 'string' },
      output: { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'study-state-root': { type: 'string' },
    },
  });
  if (!values.reference) throw new Error('--reference is required');
  const plan = buildLunaReferencePlan(ROOT, values.config || DEFAULT_CONFIG);
  const qwen = readSealedQwenReference(plan, values.reference);
  const outDir = path.resolve(ROOT, values.output || plan.output);
  if (!values.live) return dryRun(plan, qwen, outDir);
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires the shared launch arguments');
  }
  const admission = admitPaidStudyLaunch({
    root: ROOT,
    designPath: plan.design,
    launchCommit: values['launch-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    spendCap: plan.total_attempt_ceiling,
    destination: outDir,
    studyId: plan.id,
    studyStateRoot: path.resolve(ROOT, values['study-state-root'] || '.tutor-stub-traces/.paid-study-state'),
  });
  return liveRun(plan, qwen, outDir, admission);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
