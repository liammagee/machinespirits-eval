import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { fisherExactPower, fisherExactTwoSidedP } from '../services/edgedRegisterCalibration.js';
import {
  buildTutorStubResistanceActionRegisterConfirmationPlan,
  configureTutorStubResistanceActionRegisterConfirmationExecution,
  loadTutorStubResistanceActionRegisterConfirmation,
  runTutorStubResistanceActionRegisterConfirmationPreflight,
} from '../services/tutorStubResistanceActionRegisterConfirmation.js';
import {
  applyTutorStubResistanceActionRegisterStudyIntervention,
  tutorStubResistanceActionRegisterTreatmentEligibility,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  RESISTANT_LEARNER_OBSERVATION_SEMANTICS,
  observeResistantLearnerTurn,
} from '../services/resistantLearnerObservation.js';
import {
  hashPaidStudyEndpointValue,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';
import { analyzeTutorStubResistanceActionRegisterConfirmation } from '../scripts/analyze-tutor-stub-resistance-action-register-confirmation.js';
import {
  buildTutorStubResistanceActionRegisterConfirmationBatchPlan,
  buildTutorStubResistanceActionRegisterConfirmationRecoveryJob,
  classifyTutorStubResistanceActionRegisterConfirmationChildFailure,
  selectTutorStubResistanceActionRegisterConfirmationRecoveryCandidates,
} from '../scripts/run-tutor-stub-resistance-action-register-confirmation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v3.json');
const ENDPOINT = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v1.json',
);
const CERTIFICATE = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v1.endpoint-go.json',
);
const REGISTRATION_V4 = path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v4.json');
const ENDPOINT_V2 = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v2.json',
);
const CERTIFICATE_V2 = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v2.endpoint-go.json',
);
const REGISTRATION_V5 = path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v5.json');
const ENDPOINT_V3 = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v3.json',
);
const CERTIFICATE_V3 = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v3.endpoint-go.json',
);
const REGISTRATION_V6 = path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v6.json');
const ENDPOINT_V4 = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v4.json',
);
const CERTIFICATE_V4 = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v4.endpoint-go.json',
);
const REGISTRATION_V7 = path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v7.json');
const ENDPOINT_V5 = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v5.json',
);
const CERTIFICATE_V5 = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v5.endpoint-go.json',
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function mutateSealedBatchTrace(root, jobId, mutate) {
  const resultPath = path.join(root, 'batch-result.json');
  const sealPath = path.join(root, 'batch-seal.json');
  const resultBefore = fs.readFileSync(resultPath);
  const sealBefore = fs.readFileSync(sealPath);
  const result = readJson(resultPath);
  const row = result.results.find((candidate) => candidate.job_id === jobId);
  const tracePath = path.resolve(ROOT, row.trace);
  const traceBefore = fs.readFileSync(tracePath);
  const events = traceBefore
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const mutated = mutate(events);
  const source = `${mutated.map((event) => JSON.stringify(event)).join('\n')}\n`;
  fs.writeFileSync(tracePath, source);
  row.trace_sha256 = sha256(source);
  row.trace_bytes = Buffer.byteLength(source);
  writeJson(resultPath, result);
  const seal = readJson(sealPath);
  seal.result_sha256 = sha256(fs.readFileSync(resultPath));
  writeJson(sealPath, seal);
  return () => {
    fs.writeFileSync(tracePath, traceBefore);
    fs.writeFileSync(resultPath, resultBefore);
    fs.writeFileSync(sealPath, sealBefore);
  };
}

function route() {
  return { ref: 'codex.gpt-5.6-luna', provider: 'codex', model: 'gpt-5.6-luna', cli: true };
}

function callEvents(role, turn) {
  return [
    { type: 'model_call_budget_reserved', role, turn, provider: 'codex', model: 'gpt-5.6-luna' },
    { type: 'model_call', role, turn, provider: 'codex', model: 'gpt-5.6-luna', response: { effort: 'low' } },
  ];
}

function classification(recovered) {
  return recovered
    ? {
        turn: {
          request_type: 'bounded_test_response',
          discourse_move: 'evidence_adoption',
          evidence_use: 'cites_public_evidence',
          epistemic_stance: 'grounded',
          agency: 'attempting',
        },
      }
    : {
        turn: {
          request_type: 'authority_refusal_or_status_challenge',
          discourse_move: 'challenge',
          evidence_use: 'none',
          epistemic_stance: 'resistant',
          agency: 'steering',
        },
      };
}

function syntheticTrace({ job, plan, triggerTurn, recovered, safetyOverrideReason = null }) {
  const outcomeTurn = triggerTurn + 2;
  const triggerText =
    'I reject your authority to set this bounded test, and I will not supply evidence or answer within it.';
  const recoveryText = 'I will test the bounded public die mark against the clipped edge.';
  const refusalText = 'I reject your authority and will not answer, examine, or participate in this test.';
  const triggerSha = sha256(triggerText);
  const calls = [
    ...callEvents('tutor_stub_opening', 0),
    ...Array.from({ length: outcomeTurn }, (_, index) => callEvents('tutor_stub_auto_learner', index + 1)).flat(),
    ...Array.from({ length: outcomeTurn }, (_, index) => callEvents('tutor_stub_learner_analysis', index + 1)).flat(),
    ...Array.from({ length: outcomeTurn - 1 }, (_, index) => callEvents('tutor_stub_tutor', index + 1)).flat(),
  ];
  const completed = Array.from({ length: outcomeTurn - 1 }, (_, index) => {
    const turn = index + 1;
    const isTrigger = turn === triggerTurn;
    const isPost = turn === triggerTurn + 1;
    return {
      type: 'turn_complete',
      turn,
      turnRecord: {
        learner: isTrigger
          ? triggerText
          : isPost
            ? recovered
              ? recoveryText
              : refusalText
            : 'I am inspecting the public record.',
        classification: isTrigger ? classification(false) : classification(isPost && recovered),
        ...(isTrigger
          ? {
              tutorLearnerDagModel: { metrics: { missingPremiseCount: 6, groundedCount: 4 } },
              responseConfigurationAudit: {
                axes: {
                  action_family: { selected: 'clarify_distinction', visible: true },
                  engagement_stance: {
                    selected: safetyOverrideReason ? 'plain' : job.treatment.register,
                    visible: true,
                  },
                },
              },
            }
          : {}),
      },
    };
  });
  return [
    {
      type: 'run_start',
      metadata: {
        provenance: { git: { sha: plan.source.commit, dirty: false } },
        lab: { admission: { modelCallBudget: 60 } },
        experiment: {
          runSeed: job.run_seed,
          profile: 'frame_refuser',
          policy: 'field',
          repeat: job.assignment_index,
          jobId: job.id,
        },
        autoLearner: {
          observationSemantics: job.command.env.TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS,
          maxTurns: 4,
          profileId: 'frame_refuser',
          modelRef: 'codex.gpt-5.6-luna',
        },
        sessionRecipe: {
          schema: 'machinespirits.tutor-stub.session-recipe.v1',
          config: {
            identity: {
              models: { classifier: route(), learner: route(), reasoning: route(), tutor: route() },
              world: { id: 'world_005_marrick' },
            },
            options: {
              'cli-effort': 'low',
              'run-seed': String(job.run_seed),
              'auto-turns': '4',
              'model-call-budget': '60',
              'dag-mode': 'strict_dag',
              'register-policy': 'field',
              'register-palette': 'plain,warm',
              'eval-repeat': String(job.assignment_index),
              'eval-job-id': job.id,
              'no-auto-stop-on-grounded': true,
            },
          },
        },
      },
    },
    {
      type: 'resistance_action_register_confirmation_execution_start',
      jobId: job.id,
      batchId: job.block_id,
      assignmentIndex: job.assignment_index,
      runSeed: job.run_seed,
      registrationSha256: plan.source.registration_sha256,
      freshIndependentDialogue: true,
      calibrationDialogueReused: false,
    },
    {
      type: 'resistance_action_register_intervention_applied',
      turn: triggerTurn,
      triggerTurn,
      triggerLearnerSha256: triggerSha,
      intervention: {
        status: safetyOverrideReason ? 'safety_override_nonadherent' : 'applied',
        assignment: {
          action_fit: 'matched',
          pedagogical_move: 'test_bounded_distinction',
          realization: job.treatment.realization,
          register: job.treatment.register,
          repeat: job.block_id,
          batch_id: job.block_id,
        },
        safety_override: {
          applied: Boolean(safetyOverrideReason),
          assigned_register: job.treatment.register,
          delivered_register: safetyOverrideReason ? 'plain' : job.treatment.register,
          reason: safetyOverrideReason,
        },
      },
    },
    ...calls,
    ...completed,
    {
      type: 'resistance_action_register_outcome_learner_turn',
      turn: outcomeTurn,
      triggerTurn,
      triggerLearnerSha256: triggerSha,
      learnerText: recovered ? recoveryText : refusalText,
      classification: classification(recovered),
      tutorLearnerDag: {
        model: { metrics: { missingPremiseCount: recovered ? 5 : 6, groundedCount: recovered ? 5 : 4 } },
      },
      tutorReplyGenerated: false,
    },
  ];
}

function writeTraceResult({ job, plan, recovered, traceDirectory, safetyOverrideReason = null }) {
  fs.mkdirSync(traceDirectory, { recursive: true });
  const tracePath = path.join(traceDirectory, `${job.id}.jsonl`);
  const source = `${syntheticTrace({
    job,
    plan,
    triggerTurn: job.slot % 2 === 0 ? 2 : 1,
    recovered,
    safetyOverrideReason,
  })
    .map((event) => JSON.stringify(event))
    .join('\n')}\n`;
  fs.writeFileSync(tracePath, source);
  return {
    job_id: job.id,
    status: 'complete',
    exit_code: 0,
    signal: null,
    trace: path.relative(ROOT, tracePath),
    trace_sha256: sha256(source),
    trace_bytes: Buffer.byteLength(source),
    stdout: path.relative(ROOT, path.join(path.dirname(traceDirectory), 'stdout.log')),
    stderr: path.relative(ROOT, path.join(path.dirname(traceDirectory), 'stderr.log')),
    transcript: path.relative(ROOT, job.command.transcript),
  };
}

function traceReservations(tracePath) {
  return fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === 'model_call_budget_reserved').length;
}

function writeSyntheticBatch(root, plan, recoveryByJob, { recoverJobId = null, safetyOverrideJobId = null } = {}) {
  fs.mkdirSync(path.join(root, 'jobs'), { recursive: true });
  writeJson(path.join(root, 'batch-plan.json'), plan);
  const results = [];
  for (const job of plan.jobs) {
    if (job.id === recoverJobId) {
      results.push({
        job_id: job.id,
        status: 'failed',
        exit_code: 1,
        signal: null,
        failure: {
          category: 'technical_recoverable',
          code: 'TUTOR_STUB_CONFIRMATION_CHILD_TECHNICAL_FAILURE',
          disposition: 'bounded_missing_or_failed_unit_recovery_eligible',
          recoverable: true,
        },
      });
      continue;
    }
    results.push(
      writeTraceResult({
        job,
        plan,
        recovered: recoveryByJob.get(job.id),
        traceDirectory: job.command.trace_dir,
        safetyOverrideReason: job.id === safetyOverrideJobId ? 'comprehension_repair' : null,
      }),
    );
  }
  const initialResult = {
    schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-result.v1',
    batch_id: plan.batch_id,
    status: recoverJobId ? 'incomplete' : 'complete',
    completed_dialogues: recoverJobId ? 3 : 4,
    failed_or_missing_dialogues: recoverJobId ? 1 : 0,
    maximum_model_attempt_reservations: 240,
    results,
  };
  const initialResultPath = path.join(root, 'batch-result.json');
  writeJson(initialResultPath, initialResult);
  let finalResultPath = initialResultPath;
  let recoveryHashes = {};
  if (recoverJobId) {
    const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION });
    const original = plan.jobs.find((job) => job.id === recoverJobId);
    const registeredJob = loaded.plan.jobs.find((job) => job.id === recoverJobId);
    const recoveryRoot = path.join(root, 'recoveries', 'recovery-001');
    const recoveryJob = buildTutorStubResistanceActionRegisterConfirmationRecoveryJob({
      loaded,
      job: registeredJob,
      destination: recoveryRoot,
      priorModelAttemptReservations: 0,
    });
    const recoveryPlanPath = path.join(recoveryRoot, 'recovery-plan.json');
    fs.mkdirSync(recoveryRoot, { recursive: true });
    writeJson(recoveryPlanPath, {
      schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-recovery-plan.v1',
      status: 'planned_missing_or_failed_only',
      batch_id: plan.batch_id,
      source: plan.source,
      original_plan_sha256: sha256(fs.readFileSync(path.join(root, 'batch-plan.json'))),
      original_result_sha256: sha256(fs.readFileSync(initialResultPath)),
      used_reservations_before_recovery: results
        .filter((row) => row.status === 'complete')
        .reduce((sum, row) => sum + traceReservations(path.resolve(ROOT, row.trace)), 0),
      hard_ceiling: 240,
      valid_unit_ids_excluded: results
        .filter((row) => row.status === 'complete')
        .map((row) => row.job_id)
        .sort(),
      jobs: [recoveryJob],
    });
    const recoveryRow = writeTraceResult({
      job: { ...original, command: recoveryJob.command },
      plan,
      recovered: recoveryByJob.get(recoverJobId),
      traceDirectory: recoveryJob.command.trace_dir,
      safetyOverrideReason: recoverJobId === safetyOverrideJobId ? 'comprehension_repair' : null,
    });
    recoveryRow.transcript = path.relative(ROOT, recoveryJob.command.transcript);
    const recoveryResultPath = path.join(recoveryRoot, 'recovery-result.json');
    writeJson(recoveryResultPath, {
      schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-recovery-result.v1',
      batch_id: plan.batch_id,
      results: [recoveryRow],
    });
    const finalRows = plan.jobs.map((job) =>
      job.id === recoverJobId
        ? { ...recoveryRow, origin: 'bounded_technical_recovery_missing_or_failed_unit' }
        : { ...results.find((row) => row.job_id === job.id), origin: 'initial_valid_unit' },
    );
    const totals = Object.fromEntries(
      finalRows.map((row) => [row.job_id, traceReservations(path.resolve(ROOT, row.trace))]),
    );
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
    finalResultPath = path.join(root, 'batch-final-result.json');
    writeJson(finalResultPath, {
      schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-result.v1',
      batch_id: plan.batch_id,
      status: 'complete',
      completed_dialogues: 4,
      failed_or_missing_dialogues: 0,
      maximum_model_attempt_reservations: 240,
      observed_model_attempt_reservations: total,
      observed_model_attempt_reservations_by_job: totals,
      technical_recovery_used: true,
      recovery_unit_ids: [recoverJobId],
      results: finalRows,
    });
    recoveryHashes = {
      recovery_plan_sha256: sha256(fs.readFileSync(recoveryPlanPath)),
      recovery_result_sha256: sha256(fs.readFileSync(recoveryResultPath)),
      observed_model_attempt_reservations: total,
      observed_model_attempt_reservations_by_job: totals,
    };
  }
  writeJson(path.join(root, 'batch-seal.json'), {
    schema: 'machinespirits.tutor-stub.resistance-action-register-confirmation-live-batch-seal.v1',
    status: 'sealed_complete',
    batch_id: plan.batch_id,
    plan_sha256: sha256(fs.readFileSync(path.join(root, 'batch-plan.json'))),
    result_sha256: sha256(fs.readFileSync(finalResultPath)),
    ...recoveryHashes,
    dialogues: 4,
    hard_ceiling: 240,
    valid_unit_reruns: false,
    outcome_selection: false,
  });
}

test('V3 registration predeclares the minimum powered fresh 18-per-arm confirmation and exact hard ceiling', () => {
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION });
  const plan = buildTutorStubResistanceActionRegisterConfirmationPlan({ registration: loaded.registration });
  assert.equal(plan.jobs.length, 36);
  assert.equal(plan.jobs.filter((job) => job.treatment.realization === 'plain').length, 18);
  assert.equal(plan.jobs.filter((job) => job.treatment.realization === 'warm').length, 18);
  assert.equal(new Set(plan.jobs.map((job) => job.run_seed)).size, 36);
  assert.equal(plan.randomization.master_seed, 20260821);
  assert.equal(plan.randomization.algorithm, 'sha256_ranked_balanced_block_permutation_v1');
  assert.match(plan.randomization.assignment_sha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(buildTutorStubResistanceActionRegisterConfirmationPlan({ registration: loaded.registration }), plan);
  const alternate = structuredClone(loaded.registration);
  alternate.design.randomization.masterSeed += 1;
  const alternatePlan = buildTutorStubResistanceActionRegisterConfirmationPlan({ registration: alternate });
  assert.notEqual(alternatePlan.randomization.assignment_sha256, plan.randomization.assignment_sha256);
  assert.notDeepEqual(
    alternatePlan.jobs.map((job) => job.treatment.realization),
    plan.jobs.map((job) => job.treatment.realization),
  );
  assert.ok(fisherExactPower(17, 1 / 6, 4 / 6, 0.05) < 0.8);
  assert.ok(fisherExactPower(18, 1 / 6, 4 / 6, 0.05) >= 0.8);
  assert.equal(loaded.registration.executionReadiness.combinedMaximumModelAttemptReservations, 2160);
  assert.equal(loaded.registration.authorization.requiredCeilingAmendment.to, 2345);
});

test('V4 successor freezes the failed trigger corpus and admits only observer-qualified nonparticipatory refusal', () => {
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION_V4 });
  assert.equal(loaded.plan.jobs.length, 36);
  assert.equal(loaded.plan.jobs.filter((job) => job.treatment.realization === 'plain').length, 18);
  assert.equal(loaded.plan.jobs.filter((job) => job.treatment.realization === 'warm').length, 18);
  assert.equal(loaded.registration.authorization.programmeLedgerBeforeThisConfirmation.reservedAttempts, 219);
  assert.deepEqual(loaded.registration.authorization.requiredCeilingAmendment, {
    from: 2345,
    to: 2379,
    increase: 34,
    basis: '219 already reserved plus the unchanged exact 2160-reservation hard fresh confirmation envelope',
    authorized: false,
  });
  assert.equal(loaded.registration.preservation.stoppedConfirmationV1.excludedFromSuccessor, true);
  assert.equal(
    loaded.registration.preservation.stoppedConfirmationV1.privateArchiveCommit,
    '4604cc31920913e10b3e04565bf3d70def7c112e',
  );
  assert.ok(loaded.plan.jobs.every((job) => job.id.startsWith('frame_refuser-confirmation-v2-')));
  assert.equal(new Set(loaded.plan.jobs.map((job) => job.run_seed)).size, 36);

  const t1 =
    'I reject the premise that Verrell’s guilt is the question to settle before the assay; I will not supply evidence or answer under that frame.';
  const t2 =
    'I do not grant your proposed reading of the trial-book authority, so I will not examine its pages or supply an evidence-bearing entry under it.';
  const resistant = {
    turn: {
      summary: 'Rejects premature guilt framing and declines to answer without evidence.',
      request_type: 'authority_refusal_or_status_challenge',
      discourse_move: 'challenge',
      evidence_use: 'none',
      epistemic_stance: 'reflective',
      affect: 'guarded',
      agency: 'steering',
      learner_advance: { supportedMoveCount: 0 },
    },
  };
  const runtime = {
    registration: loaded.registration,
    profile: 'frame_refuser',
    consumed: false,
    dynamic_confirmation: true,
  };
  const t1Eligibility = tutorStubResistanceActionRegisterTreatmentEligibility({
    runtime,
    learnerText: t1,
    classification: resistant,
    tutorLearnerDag: { model: { turn: 1 }, advance: { supportedMoveCount: 0 } },
  });
  assert.equal(t1Eligibility.eligible, true);
  assert.equal(t1Eligibility.timing.phase, 'uptake');
  assert.equal(t1Eligibility.confirmation_observer_first_refusal, true);
  assert.deepEqual(t1Eligibility.reasons, []);

  const t2Observation = observeResistantLearnerTurn({
    learnerText: t2,
    classification: resistant,
    semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV5,
  });
  assert.equal(t2Observation.ambiguous, false);
  assert.ok(t2Observation.observations.some((row) => row.type === 'frame_jurisdiction_refusal'));
  assert.equal(
    observeResistantLearnerTurn({
      learnerText: t2,
      classification: resistant,
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4,
    }).observations.length,
    0,
  );

  const productive = tutorStubResistanceActionRegisterTreatmentEligibility({
    runtime,
    learnerText:
      'Now I see why the trial-book entry matters; I can examine its pages and supply an evidence-bearing entry.',
    classification: classification(true),
    tutorLearnerDag: { model: { turn: 1 }, advance: { supportedMoveCount: 1 } },
  });
  assert.equal(productive.eligible, false);
  assert.ok(productive.reasons.includes('no_single_axis_public_warrant'));
  assert.ok(productive.reasons.includes('content_bearing_uptake_already_visible'));
});

test('confirmation recovery admits only missing or classified technical failures and refuses substantive outcomes', () => {
  const plan = { jobs: [{ id: 'valid' }, { id: 'failed' }, { id: 'missing' }] };
  const technical = {
    results: [
      { job_id: 'valid', status: 'complete' },
      {
        job_id: 'failed',
        status: 'failed',
        failure: { category: 'technical_recoverable', recoverable: true },
      },
    ],
  };
  const selected = selectTutorStubResistanceActionRegisterConfirmationRecoveryCandidates({ plan, initial: technical });
  assert.deepEqual([...selected.valid.keys()], ['valid']);
  assert.deepEqual(
    selected.missing.map((job) => job.id),
    ['failed', 'missing'],
  );
  const substantive = structuredClone(technical);
  substantive.results[1].failure = {
    category: 'substantive_registered_failure',
    code: 'TUTOR_STUB_RESISTANCE_ACTION_REGISTER_CONFIRMATION_TRIGGER_MISSING',
    recoverable: false,
  };
  assert.throws(
    () => selectTutorStubResistanceActionRegisterConfirmationRecoveryCandidates({ plan, initial: substantive }),
    /refuses nontechnical or unclassified failure/u,
  );
  const unclassified = structuredClone(technical);
  delete unclassified.results[1].failure;
  assert.throws(
    () => selectTutorStubResistanceActionRegisterConfirmationRecoveryCandidates({ plan, initial: unclassified }),
    /refuses nontechnical or unclassified failure/u,
  );
  const signaledComplete = structuredClone(technical);
  signaledComplete.results[1].failure = classifyTutorStubResistanceActionRegisterConfirmationChildFailure({
    events: [{ type: 'resistance_action_register_outcome_learner_turn', turn: 4 }],
    signal: 'SIGTERM',
  });
  assert.deepEqual(signaledComplete.results[1].failure, {
    category: 'completed_output_nonrecoverable',
    code: 'TUTOR_STUB_CONFIRMATION_TERMINAL_OUTCOME_ALREADY_RECORDED',
    disposition: 'manual_validity_review_required_no_rerun',
    recoverable: false,
  });
  assert.throws(
    () => selectTutorStubResistanceActionRegisterConfirmationRecoveryCandidates({ plan, initial: signaledComplete }),
    /refuses nontechnical or unclassified failure/u,
  );
  const semanticStart = {
    type: 'run_start',
    metadata: { autoLearner: { observationSemantics: 'prospective_frame_resistance_semantic_v1' } },
  };
  for (const events of [
    [semanticStart, { type: 'resistance_semantic_judge_result', judgeId: 'semantic_judge_a' }],
    [semanticStart, { type: 'model_call', role: 'tutor_stub_auto_learner', turn: 1 }],
  ]) {
    assert.deepEqual(classifyTutorStubResistanceActionRegisterConfirmationChildFailure({ events, signal: 'SIGTERM' }), {
      category: 'measurement_indeterminate_nonrecoverable',
      code: 'TUTOR_STUB_RESISTANCE_SEMANTIC_MEASUREMENT_INDETERMINATE',
      disposition: 'stop_no_judge_or_unit_rerun_replacement_or_selection',
      recoverable: false,
    });
  }
  assert.deepEqual(
    classifyTutorStubResistanceActionRegisterConfirmationChildFailure({
      events: [
        semanticStart,
        { type: 'model_call', role: 'tutor_stub_auto_learner', turn: 1 },
        {
          type: 'model_call_error',
          role: 'tutor_stub_tutor',
          cliPolicyViolation: {
            reason: 'call_retry_limit_reached',
            audit: { prohibited_event_count: 0 },
          },
        },
      ],
      signal: null,
    }),
    {
      category: 'measurement_indeterminate_nonrecoverable',
      code: 'TUTOR_STUB_RESISTANCE_SEMANTIC_MEASUREMENT_INDETERMINATE',
      disposition: 'stop_no_judge_or_unit_rerun_replacement_or_selection',
      recoverable: false,
    },
  );
  assert.deepEqual(
    classifyTutorStubResistanceActionRegisterConfirmationChildFailure({
      events: [
        semanticStart,
        { type: 'model_call', role: 'tutor_stub_auto_learner', turn: 3 },
        { type: 'resistance_action_register_outcome_learner_turn', turn: 3 },
      ],
      signal: 'SIGTERM',
    }),
    {
      category: 'completed_output_nonrecoverable',
      code: 'TUTOR_STUB_CONFIRMATION_TERMINAL_OUTCOME_ALREADY_RECORDED',
      disposition: 'manual_validity_review_required_no_rerun',
      recoverable: false,
    },
  );
});

test('V3 endpoint and certificate pass zero-call readiness with calibration excluded', () => {
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION });
  const contract = JSON.parse(fs.readFileSync(ENDPOINT, 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(CERTIFICATE, 'utf8'));
  const preflight = runTutorStubResistanceActionRegisterConfirmationPreflight({
    contract,
    registration: loaded.registration,
  });
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.confirmation_readiness_audit.minimum_n_per_arm, 18);
  assert.equal(preflight.confirmation_readiness_audit.calibration_dialogues_reused_or_pooled, 0);
  assert.equal(certificate.contract_sha256, hashPaidStudyEndpointValue(contract));
  assert.equal(validation.ok, true, validation.errors.join('; '));
});

test('V4 successor endpoint and certificate pass zero-call readiness with the incomplete V1 block excluded', () => {
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION_V4 });
  const contract = JSON.parse(fs.readFileSync(ENDPOINT_V2, 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(CERTIFICATE_V2, 'utf8'));
  const preflight = runTutorStubResistanceActionRegisterConfirmationPreflight({
    contract,
    registration: loaded.registration,
  });
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.confirmation_readiness_audit.programme_ceiling_required, 2379);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV1.reused, false);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV1.pooled, false);
  assert.equal(validation.ok, true, validation.errors.join('; '));
});

test('V5 preserves the powered successor design while separating the 5000 operational safeguard', (t) => {
  const v4 = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION_V4 });
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION_V5 });
  assert.deepEqual(loaded.plan.jobs, v4.plan.jobs);
  assert.deepEqual(loaded.plan.randomization, v4.plan.randomization);
  assert.equal(loaded.registration.authorization.requiredCeilingAmendment.to, 5000);
  assert.equal(loaded.registration.authorization.requiredCeilingAmendment.increase, 2655);
  assert.deepEqual(loaded.registration.executionReadiness.programmeLedgerAfterMaximum, {
    reservedAttempts: 2379,
    ceiling: 5000,
    remaining: 2621,
  });
  assert.equal(
    loaded.registration.executionReadiness.attemptAccountingRole,
    'operational_execution_safeguard_only_not_scientific_endpoint_or_design_objective',
  );

  const contract = JSON.parse(fs.readFileSync(ENDPOINT_V3, 'utf8'));
  assert.equal(
    contract.channels.frozen_registration.implementation,
    'config/tutor-stub-resistance-action-register-crossed-registration.v5.json',
  );
  const certificate = JSON.parse(fs.readFileSync(CERTIFICATE_V3, 'utf8'));
  const preflight = runTutorStubResistanceActionRegisterConfirmationPreflight({
    contract,
    registration: loaded.registration,
  });
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.confirmation_readiness_audit.combined_maximum_model_attempt_reservations, 2160);
  assert.equal(preflight.confirmation_readiness_audit.programme_ledger_after_confirmation_maximum, 2379);
  assert.equal(preflight.confirmation_readiness_audit.programme_ceiling_required, 5000);
  assert.equal(
    preflight.confirmation_readiness_audit.attempt_accounting_role,
    'operational_execution_safeguard_only_not_scientific_endpoint_or_design_objective',
  );
  assert.equal(certificate.contract_sha256, hashPaidStudyEndpointValue(contract));
  assert.equal(validation.ok, true, validation.errors.join('; '));

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-v5-registration-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  for (const mutation of [
    (value) => {
      value.authorization.requiredCeilingAmendment.authorized = true;
    },
    (value) => {
      value.preservation.supersedesRegistrationPath =
        'config/tutor-stub-resistance-action-register-crossed-registration.v3.json';
    },
  ]) {
    const invalid = structuredClone(loaded.registration);
    mutation(invalid);
    const invalidPath = path.join(temporary, `${crypto.randomUUID()}.json`);
    writeJson(invalidPath, invalid);
    assert.throws(
      () => loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: invalidPath }),
      /successor confirmation design/u,
    );
  }
});

test('V6 binds the stopped V3 block, prospective-v6 repair, and a wholly fresh powered successor', () => {
  for (const [relativePath, expected] of Object.entries({
    'config/tutor-stub-resistance-action-register-crossed-registration.v4.json':
      '1ac49ff01a34db731b917b9f1618926e642e3bf748d06c5b987ac4ade93b3408',
    'config/tutor-stub-resistance-action-register-crossed-registration.v5.json':
      '4a1d7a745dd4ec62b93ce7397147f0d78a1b188ff576908ba4a56326c3636bf9',
    'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v1.json':
      '16f93e48f0b19fe23f0b91dabc9ac318f210ecbba6fbe954d76677d43fb78554',
    'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v2.json':
      '94973232d87e812b947981f85c12345bb413302dd54bad87b1f478c0a356b34b',
    'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v3.json':
      'e3df720358cc597e686f0007bfc1ce1a5d0b4a11273a725ce87b484d20c3fec9',
  })) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relativePath))), expected, `${relativePath} changed`);
  }
  const v5 = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION_V5 });
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION_V6 });
  assert.equal(loaded.plan.jobs.length, 36);
  assert.equal(loaded.plan.jobs.filter((job) => job.treatment.realization === 'plain').length, 18);
  assert.equal(loaded.plan.jobs.filter((job) => job.treatment.realization === 'warm').length, 18);
  assert.ok(loaded.plan.jobs.every((job) => job.id.startsWith('frame_refuser-confirmation-v3-')));
  assert.notDeepEqual(loaded.plan.randomization, v5.plan.randomization);
  assert.equal(loaded.registration.design.trigger.observationSemantics, 'prospective_v6');
  assert.deepEqual(loaded.registration.authorization.programmeLedgerBeforeThisConfirmation, {
    reservedAttempts: 255,
    ceiling: 5000,
    remaining: 4745,
  });
  assert.deepEqual(loaded.registration.executionReadiness.programmeLedgerAfterMaximum, {
    reservedAttempts: 2415,
    ceiling: 5000,
    remaining: 2585,
  });
  assert.equal(loaded.registration.preservation.stoppedConfirmationV3.reservedAttempts, 36);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV3.completedCalls, 35);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV3.excludedFromSuccessor, true);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV3.reused, false);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV3.pooled, false);
  assert.equal(loaded.registration.confirmation.priorIncompleteConfirmationV3DialoguesReused, 0);
  assert.equal(loaded.registration.confirmation.priorIncompleteConfirmationV3DialoguesPooled, 0);

  for (const learnerText of [
    'I do not grant your choice of object authority, so I will neither examine the balance nor supply evidence under that frame.',
    'I do not grant your proposed assay or its blank record authority, so I will neither examine the balance nor offer evidence under that frame.',
  ]) {
    const input = {
      learnerText,
      classification: classification(false),
    };
    assert.equal(
      observeResistantLearnerTurn({
        ...input,
        semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV5,
      }).observations.length,
      0,
      learnerText,
    );
    assert.ok(
      observeResistantLearnerTurn({
        ...input,
        semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV6,
      }).observations.some((row) => row.type === 'frame_jurisdiction_refusal'),
      learnerText,
    );
  }

  const contract = JSON.parse(fs.readFileSync(ENDPOINT_V4, 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(CERTIFICATE_V4, 'utf8'));
  const preflight = runTutorStubResistanceActionRegisterConfirmationPreflight({
    contract,
    registration: loaded.registration,
  });
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.confirmation_readiness_audit.programme_ledger_after_confirmation_maximum, 2415);
  assert.equal(preflight.confirmation_readiness_audit.programme_ceiling_required, 5000);
  assert.equal(certificate.contract_sha256, hashPaidStudyEndpointValue(contract));
  assert.equal(validation.ok, true, validation.errors.join('; '));
});

test('V7 composes object-attributed and anaphoric authority refusals without widening V1-V6', () => {
  const positives = [
    'I do not grant the metal’s leavings authority to set the question, so I will not permit that examination or answer on its merits.',
    'I reject your question and the verdict you set beneath it; I will not permit that test, examine the leavings, or answer on its merits.',
    'That is your question, not mine; I reject its authority and will not answer it or supply evidence under that frame.',
    'I do not grant the ledger’s entries standing to govern this inquiry, so I will not permit an inspection or answer under it.',
    'This is the panel’s scoring question, not mine; I deny its right and will not answer or provide evidence within that frame.',
    'That is your question, not mine; I reject its authority and will not answer it or inspect any public record under that frame.',
  ];
  for (const learnerText of positives) {
    const input = { learnerText, classification: classification(false) };
    const prior = observeResistantLearnerTurn({
      ...input,
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV6,
    });
    const repaired = observeResistantLearnerTurn({
      ...input,
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV7,
    });
    assert.equal(
      prior.observations.some((row) => row.type === 'frame_jurisdiction_refusal'),
      false,
      learnerText,
    );
    assert.equal(
      repaired.observations.some((row) => row.type === 'frame_jurisdiction_dispute'),
      true,
      learnerText,
    );
    assert.equal(
      repaired.observations.some((row) => row.type === 'frame_jurisdiction_refusal'),
      true,
      learnerText,
    );
  }

  const negatives = [
    'I do not grant the metal’s leavings authority to prove the assay is accurate, because the sample is contaminated.',
    'I do not grant the foreman’s assistants authority to set the metal on the shelf, so I will not permit that placement.',
    'That is your question, not mine; I accept its authority and will answer it from the public record.',
    'That is your deadline, not mine; I reject its authority and will not file the administrative form.',
    'I reject your question, but I will examine one bounded test and answer from the public evidence.',
    'That is your question, not mine; I reject its authority and will not answer it, but I will inspect the public record under a narrower question.',
    'The panel’s criterion is wrong because its denominator is invalid, so I reject the calculation on its merits.',
  ];
  for (const learnerText of negatives) {
    const observed = observeResistantLearnerTurn({
      learnerText,
      classification: classification(false),
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV7,
    });
    assert.equal(
      observed.observations.some((row) => row.type === 'frame_jurisdiction_refusal'),
      false,
      learnerText,
    );
  }
});

test('V7 binds the stopped V4 block, new standing authority, and zero-call endpoint readiness', () => {
  for (const [relativePath, expected] of Object.entries({
    'config/tutor-stub-resistance-action-register-crossed-registration.v1.json':
      '8e2e2a6c5fde795b668d2a9ecc81a527e29a0d970aaf419badde5fb037fa87e7',
    'config/tutor-stub-resistance-action-register-crossed-registration.v2.json':
      '4e8fa84320ba54743920fa5bb0d9228656cd6bb80ca4ba9fe68470c2ed7658e2',
    'config/tutor-stub-resistance-action-register-crossed-registration.v3.json':
      '2a5fc326b4fad3e6746a1a79ea02885a9857d9542b8b91596b7367c4c62ddc10',
    'config/tutor-stub-resistance-action-register-crossed-registration.v4.json':
      '1ac49ff01a34db731b917b9f1618926e642e3bf748d06c5b987ac4ade93b3408',
    'config/tutor-stub-resistance-action-register-crossed-registration.v5.json':
      '4a1d7a745dd4ec62b93ce7397147f0d78a1b188ff576908ba4a56326c3636bf9',
    'config/tutor-stub-resistance-action-register-crossed-registration.v6.json':
      '80c193e614e50839fd4ea30f163a17a627cc18a7a52cfc163de2ef1db537a895',
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v1.json':
      'c57edc411c0238ca4a5efcb835834f41cec3a79e3f404bb98bfcc9ff8f981b4b',
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v2.json':
      '19e6170f857a8ef97fddd1fa6bcd8cd67d41a4d9f518bed8b9608bd416fc123d',
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v3.json':
      '14c284998fc8a54cdb38b33c4e9aadde22e673cfb59db5b0b812da3cea88445a',
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v4.json':
      'c3efc0a228cc364c67a2c9a0f9dc8d0333f7e06167b06cdcc7f5bc78dc2ec277',
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v1.endpoint-go.json':
      '02efd289ced8401f0e44d5766a16841bff96ea6b0baccc34b4da702b1960b6f1',
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v2.endpoint-go.json':
      'cab993230efdc25941c05a43f37d7f536a8942906014678dd7f5083327ef0115',
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v3.endpoint-go.json':
      'e55bdcf5c5fbbf33a5130243eadbcb41fde0217af2c0f7e2d90e7d4f6d1e0d29',
    'config/paid-study-endpoints/tutor-stub-resistance-action-register-confirmation.v4.endpoint-go.json':
      '5aa5daef5c80b4b9606e712e16646ab19137d6cab90161460e1be74670ec3138',
    'config/tutor-stub-resistance-action-register-warm-plain-confirmation-study-go-request.v4.json':
      '8c25d6afcae9b9c5689f3130664048c63d303a440412af7f4ba138a6a9337aab',
  })) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relativePath))), expected, `${relativePath} changed`);
  }

  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION_V7 });
  assert.equal(loaded.plan.jobs.length, 36);
  assert.ok(loaded.plan.jobs.every((job) => job.id.startsWith('frame_refuser-confirmation-v4-')));
  assert.equal(loaded.registration.design.trigger.observationSemantics, 'prospective_v7');
  assert.equal(
    loaded.registration.authorization.standingAuthorizationAttachmentSha256,
    '538aa73239072ea618e2c8308edf562f1dd7495b78574e35a3db2f549302c1ce',
  );
  assert.deepEqual(loaded.registration.authorization.programmeLedgerBeforeThisConfirmation, {
    reservedAttempts: 293,
    ceiling: 5000,
    remaining: 4707,
  });
  assert.deepEqual(loaded.registration.executionReadiness.programmeLedgerAfterMaximum, {
    reservedAttempts: 2453,
    ceiling: 5000,
    remaining: 2547,
  });
  assert.equal(loaded.registration.preservation.stoppedConfirmationV4.reservedAttempts, 38);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV4.completedCalls, 38);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV4.dialoguesSubstantiveFailure, 2);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV4.excludedFromSuccessor, true);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV4.reused, false);
  assert.equal(loaded.registration.preservation.stoppedConfirmationV4.pooled, false);

  const contract = JSON.parse(fs.readFileSync(ENDPOINT_V5, 'utf8'));
  const certificate = JSON.parse(fs.readFileSync(CERTIFICATE_V5, 'utf8'));
  const preflight = runTutorStubResistanceActionRegisterConfirmationPreflight({
    contract,
    registration: loaded.registration,
  });
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.confirmation_readiness_audit.programme_ledger_after_confirmation_maximum, 2453);
  assert.equal(preflight.confirmation_readiness_audit.programme_ceiling_required, 5000);
  assert.equal(certificate.contract_sha256, hashPaidStudyEndpointValue(contract));
  assert.equal(validation.ok, true, validation.errors.join('; '));
});

test('fresh confirmation configuration remains dormant before a public trigger and binds one randomized treatment', () => {
  const events = [];
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION });
  const state = {
    trace: null,
    turns: [],
    history: [],
    register: { palette: ['plain', 'warm'], history: [] },
    world: {},
  };
  const job = configureTutorStubResistanceActionRegisterConfirmationExecution({
    state,
    loaded,
    jobId: loaded.plan.jobs[0].id,
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
  });
  const selection = { response_configuration: {}, selected_register: 'plain' };
  const unchanged = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'I am inspecting the public record.',
    classification: classification(true),
    tutorLearnerDag: { model: { turn: 1 } },
  });
  assert.equal(unchanged, selection);
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'I reject your authority to set this bounded test, and I will not answer within it.',
    classification: classification(false),
    tutorLearnerDag: { model: { turn: 2 } },
  });
  assert.equal(applied.selected_register, job.treatment.register);
  assert.equal(state.resistanceActionRegisterStudy.trigger_turn, 2);
  assert.match(state.resistanceActionRegisterStudy.trigger_learner_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(events[0].freshIndependentDialogue, true);
});

test('combined confirmation analyzer accepts only all nine sealed fresh batches and runs the fixed Fisher test once', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-confirmation-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION });
  const recoveryByJob = new Map();
  let plainIndex = 0;
  let warmIndex = 0;
  for (const job of loaded.plan.jobs) {
    if (job.treatment.realization === 'plain') {
      plainIndex += 1;
      recoveryByJob.set(job.id, plainIndex <= 4);
    } else {
      warmIndex += 1;
      recoveryByJob.set(job.id, warmIndex <= 13);
    }
  }
  const roots = [];
  for (let index = 0; index < 9; index += 1) {
    const blockId = `block_${String(index + 1).padStart(2, '0')}`;
    const root = path.join(temp, blockId);
    const plan = buildTutorStubResistanceActionRegisterConfirmationBatchPlan({
      registrationPath: path.relative(ROOT, REGISTRATION),
      batchId: blockId,
      destination: root,
      expectedSourceCommit: head,
    });
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, recoveryByJob, {
      recoverJobId: index === 0 ? plan.jobs[0].id : null,
      safetyOverrideJobId: index === 1 ? plan.jobs.find((job) => job.treatment.realization === 'warm').id : null,
    });
    roots.push(root);
  }
  const report = analyzeTutorStubResistanceActionRegisterConfirmation({
    batchRoots: roots,
    registrationPath: path.relative(ROOT, REGISTRATION),
    expectedSourceCommit: head,
  });
  assert.equal(report.assembly.dialogues, 36);
  assert.equal(report.assembly.calibration_dialogues_reused, 0);
  assert.deepEqual(report.primary_analysis.plain, { recovered: 4, total: 18, rate: 4 / 18 });
  assert.deepEqual(report.primary_analysis.warm, { recovered: 13, total: 18, rate: 13 / 18 });
  assert.equal(report.primary_analysis.p_value, fisherExactTwoSidedP(13, 18, 4, 18));
  assert.equal(report.primary_analysis.test, 'fisher_exact_two_sided');
  assert.equal(report.rows.filter((row) => row.execution.technical_recovery_used).length, 1);
  const protectedRow = report.rows.find((row) => row.fidelity.protected_condition);
  assert.equal(protectedRow.realization, 'warm');
  assert.deepEqual(protectedRow.fidelity, {
    action_visible: true,
    register_visible: false,
    safety_override: true,
    protected_condition: true,
  });
  assert.equal(report.treatment_fidelity.protected_condition_count, 1);
  assert.equal(report.treatment_fidelity.protected_condition_rate, 1 / 36);
  assert.equal(report.treatment_fidelity.safety_override_count, 1);
  assert.equal(report.treatment_fidelity.safety_override_rate, 1 / 36);

  const recoveredInitialResultPath = path.join(roots[0], 'batch-result.json');
  const recoveredInitialResultBefore = fs.readFileSync(recoveredInitialResultPath);
  const recoveredInitialResult = readJson(recoveredInitialResultPath);
  recoveredInitialResult.results.find((row) => row.status === 'failed').failure = {
    category: 'substantive_registered_failure',
    code: 'TUTOR_STUB_RESISTANCE_ACTION_REGISTER_CONFIRMATION_TRIGGER_MISSING',
    recoverable: false,
  };
  writeJson(recoveredInitialResultPath, recoveredInitialResult);
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterConfirmation({
        batchRoots: roots,
        registrationPath: path.relative(ROOT, REGISTRATION),
        expectedSourceCommit: head,
      }),
    /technically recoverable incomplete result/u,
  );
  fs.writeFileSync(recoveredInitialResultPath, recoveredInitialResultBefore);

  const mutationRoot = roots[2];
  const mutationPlan = readJson(path.join(mutationRoot, 'batch-plan.json'));
  const turnTwoTriggerJob = mutationPlan.jobs.find((job) => job.slot === 2);
  let restore = mutateSealedBatchTrace(mutationRoot, turnTwoTriggerJob.id, (events) =>
    events.map((event) =>
      event.type === 'turn_complete' && event.turn === 1
        ? {
            ...event,
            turnRecord: {
              ...event.turnRecord,
              learner:
                'I reject your authority to set this bounded test, but I am ashamed and overwhelmed and need plain language.',
              classification: classification(false),
            },
          }
        : event,
    ),
  );
  assert.equal(
    analyzeTutorStubResistanceActionRegisterConfirmation({
      batchRoots: roots,
      registrationPath: path.relative(ROOT, REGISTRATION),
      expectedSourceCommit: head,
    }).assembly.dialogues,
    36,
  );
  restore();

  restore = mutateSealedBatchTrace(mutationRoot, turnTwoTriggerJob.id, (events) =>
    events.map((event) =>
      event.type === 'turn_complete' && event.turn === 1
        ? {
            ...event,
            turnRecord: {
              ...event.turnRecord,
              learner:
                'I reject your authority to set this bounded test, and I will not supply evidence or answer within it.',
              classification: classification(false),
            },
          }
        : event,
    ),
  );
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterConfirmation({
        batchRoots: roots,
        registrationPath: path.relative(ROOT, REGISTRATION),
        expectedSourceCommit: head,
      }),
    /first eligible fresh public trigger provenance/u,
  );
  restore();

  restore = mutateSealedBatchTrace(mutationRoot, turnTwoTriggerJob.id, (events) => [
    ...events,
    structuredClone(events.find((event) => event.type === 'turn_complete' && event.turn === 1)),
  ]);
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterConfirmation({
        batchRoots: roots,
        registrationPath: path.relative(ROOT, REGISTRATION),
        expectedSourceCommit: head,
      }),
    /exact unique public turn sequence/u,
  );
  restore();

  restore = mutateSealedBatchTrace(mutationRoot, turnTwoTriggerJob.id, (events) => [
    ...events,
    structuredClone(events.find((event) => event.type === 'run_start')),
  ]);
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterConfirmation({
        batchRoots: roots,
        registrationPath: path.relative(ROOT, REGISTRATION),
        expectedSourceCommit: head,
      }),
    /lacks its exact fresh execution/u,
  );
  restore();

  const alternateSourceCommit = execFileSync('git', ['rev-parse', 'HEAD^'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const alternateSourceTree = execFileSync('git', ['rev-parse', `${alternateSourceCommit}^{tree}`], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const mixedSourceRoot = roots.at(-1);
  const mixedSourcePlanPath = path.join(mixedSourceRoot, 'batch-plan.json');
  const mixedSourceSealPath = path.join(mixedSourceRoot, 'batch-seal.json');
  const originalMixedSourcePlan = fs.readFileSync(mixedSourcePlanPath);
  const originalMixedSourceSeal = fs.readFileSync(mixedSourceSealPath);
  const mixedSourcePlan = readJson(mixedSourcePlanPath);
  mixedSourcePlan.source.commit = alternateSourceCommit;
  mixedSourcePlan.source.tree = alternateSourceTree;
  writeJson(mixedSourcePlanPath, mixedSourcePlan);
  const mixedSourceSeal = readJson(mixedSourceSealPath);
  mixedSourceSeal.plan_sha256 = sha256(fs.readFileSync(mixedSourcePlanPath));
  writeJson(mixedSourceSealPath, mixedSourceSeal);
  const mixedSourceTraceRestores = mixedSourcePlan.jobs.map((job) =>
    mutateSealedBatchTrace(mixedSourceRoot, job.id, (events) =>
      events.map((event) =>
        event.type === 'run_start'
          ? {
              ...event,
              metadata: {
                ...event.metadata,
                provenance: {
                  ...event.metadata.provenance,
                  git: { ...event.metadata.provenance.git, sha: alternateSourceCommit },
                },
              },
            }
          : event,
      ),
    ),
  );
  const mixedSourceReport = analyzeTutorStubResistanceActionRegisterConfirmation({
    batchRoots: roots,
    registrationPath: path.relative(ROOT, REGISTRATION),
    expectedSourceCommit: head,
    allowedBatchSourceCommits: [head, alternateSourceCommit],
  });
  assert.equal(mixedSourceReport.source.batch_commits.block_09, alternateSourceCommit);
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterConfirmation({
        batchRoots: roots,
        registrationPath: path.relative(ROOT, REGISTRATION),
        expectedSourceCommit: head,
      }),
    /source, result, or seal contract/u,
  );
  for (const restoreMixedSourceTrace of mixedSourceTraceRestores.reverse()) restoreMixedSourceTrace();
  fs.writeFileSync(mixedSourcePlanPath, originalMixedSourcePlan);
  fs.writeFileSync(mixedSourceSealPath, originalMixedSourceSeal);

  const firstTraceDir = path.join(roots[1], 'jobs', loaded.plan.jobs[4].id, 'traces');
  fs.writeFileSync(path.join(firstTraceDir, 'alternative.jsonl'), '{}\n');
  assert.throws(
    () =>
      analyzeTutorStubResistanceActionRegisterConfirmation({
        batchRoots: roots,
        registrationPath: path.relative(ROOT, REGISTRATION),
        expectedSourceCommit: head,
      }),
    /alternatives are forbidden/u,
  );
});

test('V4 successor analyzer composes the prospective-v5 trigger path over 36 wholly fresh traces', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-confirmation-v4-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const loaded = loadTutorStubResistanceActionRegisterConfirmation({ registrationPath: REGISTRATION_V4 });
  const recoveryByJob = new Map(loaded.plan.jobs.map((job, index) => [job.id, index % 3 !== 0]));
  const roots = [];
  for (let index = 0; index < 9; index += 1) {
    const blockId = `block_${String(index + 1).padStart(2, '0')}`;
    const root = path.join(temp, blockId);
    const plan = buildTutorStubResistanceActionRegisterConfirmationBatchPlan({
      registrationPath: path.relative(ROOT, REGISTRATION_V4),
      batchId: blockId,
      destination: root,
      expectedSourceCommit: head,
    });
    fs.mkdirSync(root, { recursive: true });
    writeSyntheticBatch(root, plan, recoveryByJob);
    roots.push(root);
  }
  const report = analyzeTutorStubResistanceActionRegisterConfirmation({
    batchRoots: roots,
    registrationPath: path.relative(ROOT, REGISTRATION_V4),
    expectedSourceCommit: head,
  });
  assert.equal(report.assembly.dialogues, 36);
  assert.equal(report.assembly.calibration_dialogues_reused, 0);
  assert.equal(report.primary_analysis.test, 'fisher_exact_two_sided');
  assert.equal(report.rows.length, 36);
  assert.ok(report.rows.every((row) => row.execution.technical_recovery_used === false));
});
