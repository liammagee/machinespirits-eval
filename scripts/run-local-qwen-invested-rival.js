#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import {
  buildContinuityProofPlan,
  buildContinuityRequest,
  loadContinuityPlan,
  parseContinuityReply,
  runContinuityArm,
} from '../services/localQwenRefusalContinuity.js';
import { renderContinuityReport } from '../services/localQwenRefusalContinuityReport.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { loadRubric } from '../services/evalConfigLoader.js';
import { loadLearnerRubric } from '../services/learnerRubricEvaluator.js';
import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import { loadDialogueRubric } from '../services/rubricEvaluator.js';
import {
  buildBenchmarkJobs,
  normalizeScores,
  readBenchmarkArm,
  scoreBenchmarkArms,
} from './score-local-qwen-resistant-learner-benchmark.js';
import { discoverLoadedModel, manageServer } from './run-local-qwen-resistant-learner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = 'config/tutor-stub-local-learners/qwen-invested-rival-theorist.v1.yaml';
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

function normalized(text) {
  return String(text || '')
    .normalize('NFC')
    .replace(/[‘’]/gu, "'");
}

export function investedRivalDeliveredSourceContext(plan, arm) {
  const records = arm.snapshot.proofControl.releasedPremiseIds.map((id) => {
    const source = plan.world.premises.find((premise) => premise.id === id);
    const turn = arm.snapshot.turns.find((row) => normalized(row.tutor).includes(normalized(source.surface)));
    if (!turn) throw new Error('committed source is absent from the final public transcript');
    return `Delivered in housemate turn ${turn.turn}: ${source.surface}`;
  });
  return [
    `Public opening situation supplied to both speakers: ${plan.world.opening_frame.situation}`,
    'The housemate is authorized to introduce these authored observations. New disclosed scene evidence is not automatically an invented assertion.',
    ...records,
  ].join('\n');
}

function paidStudyBudget(admission, limit, priorAttemptCount = 0) {
  return {
    reserve(detail = {}) {
      const reservation = admission.reserveModelAttempts(1, detail);
      return {
        call: priorAttemptCount + reservation.study_reserved,
        limit,
        remaining: reservation.remaining,
        studyReserved: priorAttemptCount + reservation.study_reserved,
      };
    },
    snapshot() {
      return { used: priorAttemptCount + admission.studyReserved, limit };
    },
  };
}

export function configuredServiceModel(service, arm) {
  const target = service?.profiles?.[arm?.profile]?.model?.target;
  if (typeof target !== 'string' || !target.trim()) {
    throw new Error(`service target required for arm ${arm?.id || 'unknown'}`);
  }
  return target.trim();
}

export function runtimeServiceArm(service, arm, loadedModel) {
  const target = configuredServiceModel(service, arm);
  if (loadedModel !== target) {
    throw new Error('loaded model does not exactly match the configured service target');
  }
  return { ...arm, model: target };
}

function requiredStrings(record, keys, label) {
  for (const key of keys) {
    if (typeof record?.[key] !== 'string' || !record[key].trim()) {
      throw new Error(`${label} ${key} required`);
    }
  }
}

export function buildInvestedRivalPlan(root = ROOT, configPath = DEFAULT_CONFIG) {
  const plan = loadContinuityPlan(root, configPath);
  if (
    plan.id !== 'qwen-invested-rival-theorist-v1' ||
    plan.total_attempt_ceiling !== 48 ||
    plan.recovery_attempt_reserve !== 8 ||
    plan.generationCap !== 32 ||
    plan.judge_calls !== 8 ||
    plan.tutor_control !== 'public_proof_dag'
  ) {
    throw new Error('invested-rival plan differs from the proposed 32 + 8 + 8 attempt design');
  }
  if (
    plan.arms.length !== 2 ||
    plan.arms.some((arm) => arm.mode !== 'direct' || (arm.tutorMode || 'direct') !== 'direct') ||
    plan.arms.map((arm) => arm.variant).join(',') !== 'normal,abliterated'
  ) {
    throw new Error('invested-rival plan requires normal then abliterated direct arms with no superego');
  }
  requiredStrings(
    plan.assessment,
    ['scenario_name', 'scenario_description', 'topic', 'profile_id', 'expected_behavior', 'quality_instructions'],
    'assessment',
  );
  requiredStrings(
    plan.report,
    [
      'page_title',
      'rail_title',
      'headline',
      'subtitle',
      'interchange_label',
      'setup_title',
      'setup_description',
      'quality_description',
      'comparison_description',
      'rubric_description',
      'transcript_description',
      'proof_description',
      'scope_description',
    ],
    'report',
  );
  for (const rubric of [loadRubric(), loadLearnerRubric(), loadDialogueRubric()]) {
    if (String(rubric.version) !== '2.2') throw new Error('active rubric changed from registered v2.2');
  }
  return {
    ...plan,
    assessmentContext: {
      scenarioName: plan.assessment.scenario_name,
      scenarioDescription: plan.assessment.scenario_description,
      topic: plan.assessment.topic,
      profileId: plan.assessment.profile_id,
      characterBrief: plan.characterBrief,
      expectedBehavior: plan.assessment.expected_behavior,
      qualityInstructions: plan.assessment.quality_instructions,
    },
    reportMeta: Object.fromEntries(
      Object.entries(plan.report).map(([key, value]) => [
        key.replace(/_([a-z])/gu, (_match, letter) => letter.toUpperCase()),
        value,
      ]),
    ),
  };
}

function sourceProvenance(plan, extra = {}) {
  return {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    createdAt: new Date().toISOString(),
    sourceRoot: ROOT,
    studyId: plan.id,
    totalAttemptCeiling: plan.total_attempt_ceiling,
    generationAttemptMaximum: plan.generationCap,
    plannedAssessmentAttempts: plan.judge_calls,
    technicalRecoveryReserve: plan.recovery_attempt_reserve,
    noteQuotationScope: 'prior_or_current_public_speech',
    configuredModels: {
      learner: Object.fromEntries(plan.arms.map((arm) => [arm.id, arm.model])),
      tutor: 'codex.gpt-5.6-sol',
      judge: 'claude-code.claude-opus-5',
    },
    ...extra,
  };
}

function syntheticArms(plan) {
  return plan.arms.map((arm) => {
    let releasedPremiseIds = [];
    const turns = [];
    for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
      const proof = buildContinuityProofPlan({ plan, turn, releasedPremiseIds });
      releasedPremiseIds = [...releasedPremiseIds, ...proof.requiredReleases.map((row) => row.premise)];
      turns.push({
        turn,
        learner: `Synthetic learner turn ${turn}; layout and packet fixture, not model output.`,
        tutor:
          proof.sources.map((source) => source.text).join(' ') ||
          `Synthetic tutor turn ${turn}; layout and packet fixture, not model output.`,
      });
    }
    return {
      ...arm,
      opening: plan.world.opening_frame.authored_text,
      transcript: [
        `Opening: ${plan.world.opening_frame.authored_text}`,
        ...turns.flatMap((row) => [`Learner ${row.turn}: ${row.learner}`, `Tutor ${row.turn}: ${row.tutor}`]),
      ].join('\n'),
      wallTimeMs: 0,
      repetition: { meanLexicalSurpriseAfterOpening: null },
      technical: {
        learnerMechanism: { calls: 0, medianLatencyMs: null, totalLatencyMs: 0 },
        learnerFinal: { calls: 0, meanEndToEndOutputTokensPerSecond: null },
        tutor: { calls: 0, totalLatencyMs: 0 },
      },
      snapshot: {
        turns,
        ledgers: { learner: { settled: [], open: [] }, tutor: { settled: [], open: [] } },
        maxExchanges: plan.max_exchanges,
        disposition: 'exchange_cap',
        proofControl: {
          releasedPremiseIds,
          scheduledPremises: plan.world.premises.length,
          publicProofEntailed: true,
          inquiryDisposition: 'public_evidence_sufficient_learner_understanding_unassessed',
        },
      },
    };
  });
}

function writePreparation(outDir, plan, provenance) {
  writeJson(path.join(outDir, 'plan.json'), { ...plan, provenance });
  const opening = [{ role: 'assistant', content: plan.world.opening_frame.authored_text }];
  for (const speaker of ['learner', 'tutor']) {
    writeJson(
      path.join(outDir, `${speaker}-preflight.json`),
      buildContinuityRequest({ plan, speaker, turn: 1, history: opening }),
    );
  }
  let releasedPremiseIds = [];
  const proofPreflight = [];
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    const request = buildContinuityRequest({
      plan,
      speaker: 'tutor',
      turn,
      history: opening,
      releasedPremiseIds,
    });
    proofPreflight.push(request);
    releasedPremiseIds = [...releasedPremiseIds, ...request.proofPlan.requiredReleases.map((row) => row.premise)];
  }
  writeJson(path.join(outDir, 'proof-preflight.json'), proofPreflight);

  const previewArms = syntheticArms(plan);
  const sourceContexts = Object.fromEntries(
    previewArms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(plan, arm)]),
  );
  const packets = buildBenchmarkJobs(previewArms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: sourceContexts,
  });
  writeJson(path.join(outDir, 'judge-packet-preflight.json'), {
    synthetic: true,
    modelCalls: 0,
    packets,
  });
  const preview = renderContinuityReport({
    arms: previewArms,
    evaluation: { scores: [], attemptsUsed: 0 },
    provenance: { ...provenance, budget: { used: 0, limit: plan.total_attempt_ceiling } },
    characterBrief: plan.characterBrief,
    proofControl: true,
    comparisonLabel: 'Claim boundary',
    corrections: [
      'The character wants a defensible answer and begins with a public rival explanation.',
      'Answered objections should be conceded rather than renamed or reopened.',
      'Sol remains responsible for due public evidence and the live inference.',
      'Acting, teaching, repetition and character fidelity remain separate readings.',
    ],
    reportMeta: plan.reportMeta,
    mock: true,
  });
  fs.writeFileSync(path.join(outDir, 'report-preview.html'), preview.html, { flag: 'wx' });
  writeJson(path.join(outDir, 'public-preview.json'), preview.interchange);
  fs.copyFileSync(path.join(ROOT, plan.design), path.join(outDir, 'design.md'), fs.constants.COPYFILE_EXCL);
  return { packets: packets.length, preview: path.join(outDir, 'report-preview.html') };
}

function reportResult({ outDir, plan, arms, evaluation, provenance }) {
  const result = {
    arms,
    evaluation,
    provenance,
    characterBrief: plan.characterBrief,
    proofControl: true,
    comparisonLabel: 'Claim boundary',
    corrections: [
      'The same character, public opening, proof schedule, Sol route and settings apply to both arms.',
      'The learner brief contains no hidden answer, future clue, recurrence target or score threshold.',
      'A repair offer does not answer the causal rival; a defeated objection should be acknowledged.',
      'The two checkpoint packages may differ beyond abliteration, so results are descriptive.',
    ],
    reportMeta: plan.reportMeta,
  };
  writeJson(path.join(outDir, 'report-data.json'), result);
  const rendered = renderContinuityReport(result);
  fs.writeFileSync(path.join(outDir, 'report.html'), rendered.html, { flag: 'wx' });
  writeJson(path.join(outDir, 'public-dialogues.json'), rendered.interchange);
}

function publicSourceContexts(plan, arms) {
  return Object.fromEntries(arms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(plan, arm)]));
}

async function scoreArms({ plan, arms, outDir, budget, priorScores = [], priorAttempts = 0, ceiling = 8 }) {
  return scoreBenchmarkArms(arms, path.join(outDir, 'evaluation'), {
    ceiling,
    extendedQuality: true,
    allowOneBasedIndices: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
    priorScores,
    priorAttempts,
    callJudge: async (...args) => {
      const reservation = budget.reserve({ role: args[3] });
      fs.appendFileSync(path.join(outDir, 'attempts.jsonl'), `${JSON.stringify(reservation)}\n`);
      return callAIWithCliBridge(...args);
    },
  });
}

async function runFresh(plan, outDir, admission, generationRecovery = null) {
  const priorAttemptCount = generationRecovery?.stop.budget.used || 0;
  const budget = paidStudyBudget(admission, plan.total_attempt_ceiling, priorAttemptCount);
  const arms = [...(generationRecovery?.priorArms || [])];
  try {
    const provenance = sourceProvenance(plan, {
      commit: admission.source.commit,
      tree: admission.source.tree,
      dirty: false,
      detached: true,
      mainRef: admission.source.main_ref,
      mainCommit: admission.source.main_commit,
      authorization: admission.authorization,
      recovery: Boolean(generationRecovery),
      ...(generationRecovery
        ? {
            recoverySource: generationRecovery.sourceDir,
            recoveredGeneration: generationRecovery.failure,
            priorAttemptCount,
            linkedRecoveryStudyId: admission.study_id,
            linkedRecoveryAttemptCeiling: admission.spend_cap,
            privateLedgerPolicy: 'drop_unsupported_quote_rows_preserve_public_speech',
            reusedCompletedArms: arms.map((arm) => arm.id),
          }
        : {}),
    });
    writePreparation(outDir, plan, provenance);
    const service = yaml.parse(fs.readFileSync(path.join(ROOT, plan.service_config), 'utf8'));
    service.workspace.path = plan.mtp_chat_root;
    service.timing.jsonl_path = path.join(outDir, 'service-timings.jsonl');
    const servicePath = path.join(outDir, 'service.yaml');
    fs.writeFileSync(servicePath, yaml.stringify(service), { flag: 'wx' });
    for (const arm of plan.arms) {
      if (arms.some((completed) => completed.id === arm.id)) continue;
      const started = Date.now();
      let ownsServer = false;
      try {
        await manageServer(plan.mtp_chat_root, arm.profile, 'start', servicePath);
        ownsServer = true;
        const loaded = await discoverLoadedModel(plan.base_url, { modelIdContains: arm.model });
        const runtimeArm = runtimeServiceArm(service, arm, loaded);
        await runContinuityArm({
          plan,
          arm: runtimeArm,
          outDir: path.join(outDir, arm.id),
          budget,
          ...(generationRecovery ? { unsupportedQuotationPolicy: 'drop' } : {}),
          ...(generationRecovery?.firstLearnerReply && arm.id === 'A'
            ? {
                firstLearnerReply: generationRecovery.firstLearnerReply,
              }
            : {}),
        });
      } finally {
        if (ownsServer) await manageServer(plan.mtp_chat_root, arm.profile, 'stop', servicePath);
      }
      arms.push(
        readBenchmarkArm({
          ...arm,
          path: path.join(outDir, arm.id, 'dialogue.json'),
          wallTimeMs: Date.now() - started,
        }),
      );
    }
    writeJson(path.join(outDir, 'arms.json'), arms);
    const evaluation = await scoreArms({ plan, arms, outDir, budget });
    const finalProvenance = { ...provenance, budget: budget.snapshot() };
    reportResult({ outDir, plan, arms, evaluation, provenance: finalProvenance });
    writeJson(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      arms: arms.map((arm) => ({
        id: arm.id,
        exchanges: arm.snapshot.turns.length,
        disposition: arm.snapshot.disposition,
      })),
      assessments: evaluation.scores.length,
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      completed_arms: arms.length,
      completed_assessments: evaluation.scores.length,
      reserved_attempts: admission.reserved,
      ...(generationRecovery ? { recovery_from: generationRecovery.sourceDir } : {}),
    });
    return { outDir, dryRun: false, attempts: budget.snapshot().used };
  } catch (error) {
    let recoveryPermitted = false;
    if (arms.length === 2) {
      try {
        technicalRecoveryEligible(outDir);
        recoveryPermitted = true;
      } catch {
        recoveryPermitted = false;
      }
    }
    writeJson(path.join(outDir, 'stopped.json'), {
      error: error.message,
      budget: budget.snapshot(),
      armsCompleted: arms.length,
      recoveryPermitted,
    });
    admission.close({
      type: 'run_sealed',
      status: recoveryPermitted ? 'technical_failure' : 'failed',
      error: error.message,
      completed_arms: arms.length,
      reserved_attempts: admission.reserved,
      ...(generationRecovery ? { recovery_from: generationRecovery.sourceDir } : {}),
      ...(recoveryPermitted ? { recovery_permitted: true } : {}),
    });
    throw error;
  }
}

export function readGenerationRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  if (sourcePlan.id !== plan.id || sourcePlan.provenance?.recovery) {
    throw new Error('generation recovery must start from the original invested-rival run');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  if (
    stop.armsCompleted !== 0 ||
    stop.budget?.used !== 1 ||
    !/^unsupported (?:open|settled) quotation$/u.test(stop.error || '')
  ) {
    throw new Error('generation recovery requires the preserved first-turn private-ledger quotation failure');
  }
  for (const forbidden of [
    path.join(sourceDir, 'A', 'dialogue.json'),
    path.join(sourceDir, 'A', 'checkpoint-1.json'),
    path.join(sourceDir, 'B'),
    path.join(sourceDir, 'evaluation'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('generation recovery source contains accepted downstream output');
  }
  const request = JSON.parse(fs.readFileSync(path.join(sourceDir, 'A', '1-learner.request.json'), 'utf8'));
  const response = JSON.parse(fs.readFileSync(path.join(sourceDir, 'A', '1-learner.response.json'), 'utf8'));
  const dropped = [];
  const parsed = parseContinuityReply(response.text, request.messageHistory, {
    unsupportedQuotationPolicy: 'drop',
    onUnsupportedQuotation: (row) => dropped.push(row),
  });
  if (!dropped.length) throw new Error('generation recovery source has no unsupported private ledger quotation');
  return {
    sourceDir,
    sourcePlan,
    stop,
    failure: { error: stop.error, droppedPrivateLedgerRows: dropped },
    firstLearnerReply: {
      source: path.join(sourceDir, 'A', '1-learner.response.json'),
      request,
      response,
      parsedSpeech: parsed.speech,
    },
  };
}

export function generationRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  if (
    !Number.isInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    priorAttemptCount >= plan.total_attempt_ceiling
  ) {
    throw new Error('generation recovery requires a positive preserved attempt count below the study ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v1`,
    spendCap: plan.total_attempt_ceiling - priorAttemptCount,
    priorAttemptCount,
  };
}

function readJsonLines(file) {
  return fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function recoveredArmElapsedMs(snapshot, sourceDir) {
  const tracePath = path.isAbsolute(snapshot.trace) ? snapshot.trace : path.resolve(ROOT, snapshot.trace);
  const timestamps = readJsonLines(tracePath)
    .map((event) => Date.parse(event.at))
    .filter(Number.isFinite);
  if (!timestamps.length) return 0;
  const timingPath = path.join(sourceDir, 'service-timings.jsonl');
  const ready = fs.existsSync(timingPath)
    ? readJsonLines(timingPath).find(
        (event) => event.event === 'server_ready' && Number.isFinite(Date.parse(event.timestamp)),
      )
    : null;
  const startedAt = ready ? Date.parse(ready.timestamp) - Number(ready.seconds || 0) * 1000 : Math.min(...timestamps);
  return Math.max(0, Math.max(...timestamps) - startedAt);
}

export function readArmBoundaryRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v1` ||
    provenance.priorAttemptCount !== 1
  ) {
    throw new Error('arm-boundary recovery must start from the first linked generation recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const expectedAttempts = plan.max_exchanges * 2;
  if (
    stop.error !== 'loaded model does not exactly match the planned arm' ||
    stop.armsCompleted !== 1 ||
    stop.budget?.used !== expectedAttempts
  ) {
    throw new Error('arm-boundary recovery requires the preserved configured-model identity failure');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const reserved = runEvents
    .filter((event) => event.type === 'model_attempt_reserved')
    .reduce((sum, event) => sum + Number(event.count || 0), 0);
  if (reserved + provenance.priorAttemptCount !== stop.budget.used) {
    throw new Error('arm-boundary recovery accounting differs from the preserved predecessor');
  }
  for (const forbidden of [
    path.join(sourceDir, 'B'),
    path.join(sourceDir, 'arms.json'),
    path.join(sourceDir, 'evaluation'),
    path.join(sourceDir, 'completed.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('arm-boundary recovery source contains downstream output');
  }
  const arm = plan.arms[0];
  const snapshotPath = path.join(sourceDir, arm.id, 'dialogue.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  if (snapshot.turns?.length !== plan.max_exchanges) {
    throw new Error('arm-boundary recovery requires the complete first arm');
  }
  const priorArm = readBenchmarkArm({
    ...arm,
    path: snapshotPath,
    wallTimeMs: recoveredArmElapsedMs(snapshot, sourceDir),
  });
  return {
    sourceDir,
    sourcePlan,
    stop,
    failure: { error: stop.error, boundary: 'before_arm_B_dispatch' },
    priorArms: [priorArm],
  };
}

export function armBoundaryRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  if (
    !Number.isInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    priorAttemptCount >= plan.total_attempt_ceiling
  ) {
    throw new Error('arm-boundary recovery requires a positive preserved attempt count below the study ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v2`,
    spendCap: plan.total_attempt_ceiling - priorAttemptCount,
    priorAttemptCount,
  };
}

export function readLocalModelRouteRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v2` ||
    provenance.priorAttemptCount !== 16 ||
    provenance.reusedCompletedArms?.join(',') !== 'A'
  ) {
    throw new Error('local-route recovery must start from the second linked generation recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  if (stop.error !== 'Qwen HTTP 400' || stop.armsCompleted !== 1 || stop.budget?.used !== 17) {
    throw new Error('local-route recovery requires the preserved first abliterated request failure');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const reserved = runEvents
    .filter((event) => event.type === 'model_attempt_reserved')
    .reduce((sum, event) => sum + Number(event.count || 0), 0);
  if (reserved !== 1 || reserved + provenance.priorAttemptCount !== stop.budget.used) {
    throw new Error('local-route recovery accounting differs from the preserved predecessor');
  }
  const armStop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'B', 'stopped.json'), 'utf8'));
  const traceEvents = readJsonLines(path.join(sourceDir, 'B', 'trace.jsonl'));
  const transport = traceEvents.find((event) => event.type === 'provider_event')?.event;
  const request = JSON.parse(fs.readFileSync(path.join(sourceDir, 'B', '1-learner.request.json'), 'utf8'));
  const expectedRequest = buildContinuityRequest({
    plan,
    speaker: 'learner',
    turn: 1,
    history: [{ role: 'assistant', content: plan.world.opening_frame.authored_text }],
  });
  if (
    armStop.error !== 'Qwen HTTP 400' ||
    armStop.turns?.length !== 0 ||
    armStop.partialTurn?.turn !== 1 ||
    transport?.status !== 400 ||
    !/Repository Not Found[\s\S]*Qwen3\.8-27B-Uncensored-MLX\/4-bit/iu.test(String(transport.body || '')) ||
    request.systemPrompt !== expectedRequest.systemPrompt ||
    request.prompt !== expectedRequest.prompt ||
    JSON.stringify(request.messageHistory) !== JSON.stringify(expectedRequest.messageHistory)
  ) {
    throw new Error('local-route recovery requires the saved repository-lookup transport failure');
  }
  for (const forbidden of [
    path.join(sourceDir, 'B', '1-learner.response.json'),
    path.join(sourceDir, 'B', 'dialogue.json'),
    path.join(sourceDir, 'arms.json'),
    path.join(sourceDir, 'evaluation'),
    path.join(sourceDir, 'completed.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('local-route recovery source contains downstream output');
  }
  const prior = readArmBoundaryRecovery(plan, provenance.recoverySource);
  return {
    sourceDir,
    sourcePlan,
    stop,
    failure: {
      error: stop.error,
      boundary: 'first_arm_B_learner_request',
      transport: { status: transport.status, body: transport.body },
    },
    priorArms: prior.priorArms,
  };
}

export function localModelRouteRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  if (
    !Number.isInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    priorAttemptCount >= plan.total_attempt_ceiling
  ) {
    throw new Error('local-route recovery requires a positive preserved attempt count below the study ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v3`,
    spendCap: plan.total_attempt_ceiling - priorAttemptCount,
    priorAttemptCount,
  };
}

function readPriorScores(sourceDir, arms) {
  const evaluationDir = path.join(sourceDir, 'evaluation');
  const rows = [];
  for (const arm of arms) {
    for (const kind of ['tutor', 'learner', 'dialogue', 'quality']) {
      const file = path.join(evaluationDir, `${arm.id}-${kind}.json`);
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      rows.push({ arm: arm.id, kind, raw, scored: normalizeScores(kind, raw) });
    }
  }
  return rows;
}

export function technicalRecoveryEligible(sourceDir) {
  const ledger = path.join(sourceDir, 'evaluation', 'judge-ledger.jsonl');
  const events = fs
    .readFileSync(ledger, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const failures = events.filter((event) => event.event === 'failed');
  if (failures.length !== 1) throw new Error('assessment recovery requires exactly one failed packet');
  const failure = failures[0];
  const base = path.join(sourceDir, 'evaluation', `${failure.arm}-${failure.kind}`);
  const response = fs.existsSync(`${base}.response.txt`) ? fs.readFileSync(`${base}.response.txt`, 'utf8') : '';
  const error = JSON.parse(fs.readFileSync(`${base}.error.json`, 'utf8'));
  const responseFreeStructuredFailure =
    error.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' &&
    error.classification === 'response_free_error' &&
    error.reason === 'result_error_without_structured_output';
  const technical =
    responseFreeStructuredFailure ||
    /empty|transport|timeout|timed out|network|ECONN|exit code|temporarily unavailable/iu.test(
      [error.message, error.code, error.classification, error.reason].filter(Boolean).join(' '),
    );
  if (response.trim() || !technical) {
    throw new Error('nonempty or substantive assessment failure is not eligible for recovery');
  }
  return {
    priorAttempts: events.filter((event) => event.event === 'reserved').length,
    failure: { arm: failure.arm, kind: failure.kind, error },
  };
}

function readAssessmentRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  if (sourcePlan.id !== plan.id || sourcePlan.provenance?.recovery) {
    throw new Error('assessment recovery must start from the original invested-rival run');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const arms = JSON.parse(fs.readFileSync(path.join(sourceDir, 'arms.json'), 'utf8'));
  if (arms.length !== 2 || stop.armsCompleted !== 2) {
    throw new Error('generation failure is not eligible for replacement recovery');
  }
  const eligibility = technicalRecoveryEligible(sourceDir);
  const priorScores = readPriorScores(sourceDir, arms);
  return { sourcePlan, stop, arms, eligibility, priorScores };
}

export function readLinkedAssessmentRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v3` ||
    provenance.linkedRecoveryAttemptCeiling !== 31 ||
    provenance.priorAttemptCount !== 17
  ) {
    throw new Error('linked assessment recovery must start from the local-route generation recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const arms = JSON.parse(fs.readFileSync(path.join(sourceDir, 'arms.json'), 'utf8'));
  if (
    stop.armsCompleted !== 2 ||
    stop.budget?.used !== 37 ||
    stop.budget?.limit !== plan.total_attempt_ceiling ||
    arms.map((arm) => arm.id).join(',') !== 'A,B' ||
    arms.some((arm) => arm.snapshot?.turns?.length !== plan.max_exchanges)
  ) {
    throw new Error('linked assessment recovery requires both preserved eight-exchange arms at 37/48 attempts');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const runReserved = runEvents
    .filter((event) => event.type === 'model_attempt_reserved')
    .reduce((sum, event) => sum + Number(event.count || 0), 0);
  const runSeal = runEvents.findLast((event) => event.type === 'run_sealed');
  if (
    runReserved !== 20 ||
    provenance.priorAttemptCount + runReserved !== stop.budget.used ||
    runSeal?.status !== 'failed' ||
    runSeal?.reserved_attempts !== runReserved
  ) {
    throw new Error('linked assessment recovery accounting differs from the preserved predecessor');
  }
  const eligibility = technicalRecoveryEligible(sourceDir);
  const judgeEvents = readJsonLines(path.join(sourceDir, 'evaluation', 'judge-ledger.jsonl'));
  const completed = judgeEvents.filter((event) => event.event === 'completed');
  if (
    eligibility.priorAttempts !== 4 ||
    eligibility.failure.arm !== 'A' ||
    eligibility.failure.kind !== 'quality' ||
    completed.map((event) => `${event.arm}/${event.kind}`).join(',') !== 'A/tutor,A/learner,A/dialogue'
  ) {
    throw new Error('linked assessment recovery requires three accepted A assessments and one failed A quality packet');
  }
  const expectedJob = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
  }).find((job) => job.arm === eligibility.failure.arm && job.kind === eligibility.failure.kind);
  const failedBase = path.join(sourceDir, 'evaluation', `${eligibility.failure.arm}-${eligibility.failure.kind}`);
  if (
    fs.readFileSync(`${failedBase}.prompt.txt`, 'utf8') !== expectedJob.prompt ||
    JSON.stringify(JSON.parse(fs.readFileSync(`${failedBase}.schema.json`, 'utf8'))) !==
      JSON.stringify(expectedJob.outputSchema)
  ) {
    throw new Error('linked assessment recovery packet differs from the current transcript and rubric');
  }
  for (const forbidden of [
    path.join(sourceDir, 'completed.json'),
    path.join(sourceDir, 'report-data.json'),
    path.join(sourceDir, 'report.html'),
    path.join(sourceDir, 'evaluation', 'scores.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('linked assessment recovery source contains completed output');
  }
  const priorScores = readPriorScores(sourceDir, arms);
  if (priorScores.map((score) => `${score.arm}/${score.kind}`).join(',') !== 'A/tutor,A/learner,A/dialogue') {
    throw new Error('linked assessment recovery accepted-score set differs from the judge ledger');
  }
  return { sourcePlan, stop, arms, eligibility, priorScores, linked: true };
}

export function linkedAssessmentRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  if (
    !Number.isInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    priorAttemptCount >= plan.total_attempt_ceiling
  ) {
    throw new Error('linked assessment recovery requires preserved attempts below the study ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v4`,
    spendCap: plan.total_attempt_ceiling - priorAttemptCount,
    priorAttemptCount,
  };
}

async function recoverAssessments(plan, sourceDir, outDir, admission, recovery) {
  const { stop, arms, eligibility, priorScores } = recovery;
  const priorAttemptCount = recovery.linked ? stop.budget.used : 0;
  const budget = paidStudyBudget(admission, plan.total_attempt_ceiling, priorAttemptCount);
  try {
    if (admission.studyReserved !== (recovery.linked ? 0 : stop.budget.used)) {
      throw new Error('study-wide attempt ledger differs from the preserved predecessor');
    }
    const provenance = sourceProvenance(plan, {
      commit: admission.source.commit,
      tree: admission.source.tree,
      dirty: false,
      detached: true,
      mainRef: admission.source.main_ref,
      mainCommit: admission.source.main_commit,
      authorization: admission.authorization,
      recovery: true,
      recoverySource: sourceDir,
      recoveredPacket: eligibility.failure,
      priorAttemptCount: stop.budget.used,
      ...(recovery.linked
        ? {
            linkedRecoveryStudyId: admission.study_id,
            linkedRecoveryAttemptCeiling: admission.spend_cap,
            reusedCompletedArms: arms.map((arm) => arm.id),
            reusedCompletedAssessments: priorScores.map((score) => `${score.arm}/${score.kind}`),
          }
        : {}),
    });
    writeJson(path.join(outDir, 'plan.json'), { ...plan, provenance });
    writeJson(path.join(outDir, 'arms.json'), arms);
    const evaluation = await scoreArms({
      plan,
      arms,
      outDir,
      budget,
      priorScores,
      priorAttempts: eligibility.priorAttempts,
      ceiling: plan.judge_calls + plan.recovery_attempt_reserve,
    });
    const finalProvenance = { ...provenance, budget: budget.snapshot() };
    reportResult({ outDir, plan, arms, evaluation, provenance: finalProvenance });
    writeJson(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      assessments: evaluation.scores.length,
      recovery: eligibility.failure,
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      completed_assessments: evaluation.scores.length,
      reserved_attempts: admission.reserved,
      recovery_from: sourceDir,
    });
    return { outDir, dryRun: false, recovery: true, attempts: budget.snapshot().used };
  } catch (error) {
    writeJson(path.join(outDir, 'stopped.json'), {
      error: error.message,
      budget: budget.snapshot(),
      recovery: eligibility.failure,
    });
    admission.close({
      type: 'run_sealed',
      status: 'failed',
      error: error.message,
      reserved_attempts: admission.reserved,
      recovery_from: sourceDir,
    });
    throw error;
  }
}

function admitLiveRun(plan, values, outDir, recoveryFrom = null, contractOverride = {}) {
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires --accept-charges, --launch-commit, --go-note-commit, and --go-note-path');
  }
  return admitPaidStudyLaunch({
    root: ROOT,
    designPath: plan.design,
    launchCommit: values['launch-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    spendCap: contractOverride.spendCap || plan.total_attempt_ceiling,
    destination: outDir,
    studyId: contractOverride.studyId || plan.id,
    studyStateRoot: path.resolve(ROOT, values['study-state-root'] || '.tutor-stub-traces/.paid-study-state'),
    ...(recoveryFrom ? { recoveryFrom } : {}),
  });
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      live: { type: 'boolean', default: false },
      config: { type: 'string' },
      output: { type: 'string' },
      'recover-assessments': { type: 'boolean', default: false },
      'recover-generation': { type: 'boolean', default: false },
      'recover-arm-boundary': { type: 'boolean', default: false },
      'recover-local-model-route': { type: 'boolean', default: false },
      'recover-linked-assessments': { type: 'boolean', default: false },
      from: { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'study-state-root': { type: 'string' },
    },
  });
  const plan = buildInvestedRivalPlan(ROOT, values.config || DEFAULT_CONFIG);
  if (values['recover-linked-assessments']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-arm-boundary'] ||
      values['recover-local-model-route'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-linked-assessments requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-linked-assessment-recovery-v1`);
    const recovery = readLinkedAssessmentRecovery(plan, sourceDir);
    const recoveryContract = linkedAssessmentRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'linked_assessment_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.arms.map((arm) => arm.id),
      reused_completed_assessments: recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'linked assessment recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('linked assessment recovery ledger was not empty at launch');
    }
    return recoverAssessments(plan, sourceDir, outDir, admission, recovery);
  }
  if (values['recover-local-model-route']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-arm-boundary'] ||
      values['recover-linked-assessments'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-local-model-route requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-local-model-route-recovery-v1`);
    const recovery = readLocalModelRouteRecovery(plan, sourceDir);
    const recoveryContract = localModelRouteRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'linked_local_model_route_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.priorArms.map((arm) => arm.id),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'linked local-route recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('linked local-route recovery ledger was not empty at launch');
    }
    return runFresh(plan, outDir, admission, recovery);
  }
  if (values['recover-arm-boundary']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-local-model-route'] ||
      values['recover-linked-assessments'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-arm-boundary requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-arm-boundary-recovery-v1`);
    const recovery = readArmBoundaryRecovery(plan, sourceDir);
    const recoveryContract = armBoundaryRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'linked_arm_boundary_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.priorArms.map((arm) => arm.id),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'linked arm-boundary recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('linked arm-boundary recovery ledger was not empty at launch');
    }
    return runFresh(plan, outDir, admission, recovery);
  }
  if (values['recover-generation']) {
    if (!values.live || !values.from || values['recover-linked-assessments'] || values['recover-assessments']) {
      throw new Error('--recover-generation requires --live and --from, without --recover-assessments');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-generation-recovery-v1`);
    const recovery = readGenerationRecovery(plan, sourceDir);
    const recoveryContract = generationRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'linked_generation_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'linked recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('linked recovery ledger was not empty at launch');
    }
    return runFresh(plan, outDir, admission, recovery);
  }
  if (values['recover-assessments']) {
    if (!values.live || !values.from) {
      throw new Error('--recover-assessments requires --live and --from');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-assessment-recovery-v1`);
    const recovery = readAssessmentRecovery(plan, sourceDir);
    const admission = admitLiveRun(plan, values, outDir, sourceDir);
    return recoverAssessments(plan, sourceDir, outDir, admission, recovery);
  }
  const outDir = values.live
    ? path.resolve(ROOT, values.output || plan.output)
    : values.output
      ? path.resolve(ROOT, values.output)
      : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-invested-rival-')), 'dry-run');
  if (values.live) {
    const admission = admitLiveRun(plan, values, outDir);
    return runFresh(plan, outDir, admission);
  }
  fs.mkdirSync(outDir, { recursive: false });
  const provenance = sourceProvenance(plan, { recovery: false, modelCalls: 0, dryRun: true });
  const preparation = writePreparation(outDir, plan, provenance);
  return { outDir, dryRun: true, attempts: 0, ...preparation };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
