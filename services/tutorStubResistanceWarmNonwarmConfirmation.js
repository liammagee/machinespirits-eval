import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { recordFileDigest } from './recordedFileDigest.js';
import { createTutorStubResistanceActionRegisterStudyRuntime } from './tutorStubResistanceActionRegisterStudy.js';
import { loadTutorStubResistanceActionRegisterRegistration } from './tutorStubResistanceActionRegisterStudy.js';

const DESIGN_SCHEMA = 'machinespirits.tutor-stub.resistance-action-register-warm-nonwarm-confirmation-design.v1';
const BASE_REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v10.json';
const RANDOMIZATION_ALGORITHM = 'sha256_ranked_balanced_block_permutation_v1';
const TOKENS = Object.freeze([
  Object.freeze({ token: 'nonwarm_1', assigned_arm: 'nonwarm_reference', realization: 'plain' }),
  Object.freeze({ token: 'nonwarm_2', assigned_arm: 'nonwarm_reference', realization: 'plain' }),
  Object.freeze({ token: 'warm_1', assigned_arm: 'warm_shared_invitation', realization: 'warm' }),
  Object.freeze({ token: 'warm_2', assigned_arm: 'warm_shared_invitation', realization: 'warm' }),
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function canonicalSha256(value) {
  return sha256(JSON.stringify(canonical(value)));
}

function randomizedAssignments(seed, blockId) {
  return TOKENS.map((entry) => ({
    ...entry,
    score_sha256: sha256(`${RANDOMIZATION_ALGORITHM}:${seed}:${blockId}:${entry.token}`),
  }))
    .sort((left, right) => left.score_sha256.localeCompare(right.score_sha256))
    .map((entry, index) => ({ ...entry, permutation_rank: index + 1 }));
}

// The path guard stays a refusal: a binding that names nothing, or names a file
// outside the repository, is a broken design. The digest is a record.
function assertRepoFilePathAndRecordDigest(root, binding, label) {
  const absolute = path.resolve(root, binding?.path || '');
  const rebased = path.relative(root, absolute);
  if (!binding?.path || rebased.startsWith('..') || path.isAbsolute(rebased) || !fs.existsSync(absolute)) {
    throw new Error(`${label} path is invalid`);
  }
  return recordFileDigest({ root, filePath: binding.path, recordedSha256: binding.sha256, label });
}

export function validateTutorStubResistanceWarmNonwarmDesign(design, root = process.cwd()) {
  const issues = [];
  if (
    design?.schema !== DESIGN_SCHEMA ||
    design?.status !== 'prospective_executable_smoke_passed_ready_for_merged_launch'
  ) {
    issues.push('design identity or status drifted');
  }
  const sample = design?.sampleSize || {};
  if (
    sample.allocatedTotal !== 200 ||
    sample.allocatedPerArm !== 100 ||
    sample.balancedBlocks !== 50 ||
    sample.dialoguesPerBlock !== 4 ||
    sample.assignmentsPerArmPerBlock !== 2 ||
    sample.minimumDeterminatePerArm !== 89 ||
    sample.powerMethod !== 'exact_enumeration_of_two_sided_fisher_rejection_region' ||
    sample.alpha !== 0.05 ||
    sample.targetPower !== 0.9 ||
    sample.powerAtMinimumDeterminatePerArm < 0.9
  ) {
    issues.push('sample size, power, or blocking drifted');
  }
  if (
    design?.randomization?.masterSeed !== 20260829 ||
    design?.analysis?.test !== 'two_sided_fisher_exact' ||
    design?.analysis?.interimAnalysis !== false ||
    design?.analysis?.analysisCount !== 1 ||
    design?.models?.generator?.modelRef !== 'codex.gpt-5.6-luna' ||
    JSON.stringify(design?.models?.semanticJudges?.map((judge) => judge.modelRef)) !==
      JSON.stringify(['codex.gpt-5.6-sol', 'claude-code.sonnet-5']) ||
    !design?.models?.removedModels?.includes('codex.gpt-5.5')
  ) {
    issues.push('seed, analysis, or model route drifted');
  }
  if (
    design?.prelaunchValidation?.status !== 'satisfied_by_existing_v8_fresh_heldout_and_passing_v6_smoke_b' ||
    design?.prelaunchValidation?.repeatValidationIfExactInstrumentInputsUnchanged !== false
  ) {
    issues.push('completed validation or no-repeat boundary drifted');
  }
  const digestRecords = [];
  try {
    digestRecords.push(
      assertRepoFilePathAndRecordDigest(root, design?.measurement?.triggerInstrument, 'trigger instrument'),
      assertRepoFilePathAndRecordDigest(root, design?.measurement?.outcomeAndFidelityInstrument, 'outcome instrument'),
    );
  } catch (error) {
    issues.push(error.message);
  }
  const spend = design?.spendCeiling || {};
  if (
    spend.maximumReservationsPerDialogue !== 102 ||
    spend.plannedRoleCallsPerDialogue !== 34 ||
    spend.maximumReservationsPerPlannedCall !== 3 ||
    spend.confirmationMaximumModelAttemptReservations !== 20400 ||
    spend.recordedProgrammeLedgerBeforeConfirmation !== 5594 ||
    spend.programmeModelAttemptCeiling !== 25994
  ) {
    issues.push('attempt safeguard drifted');
  }
  if (
    design?.execution?.maximumReservationsPerDialogueAcrossInitialAndRecoveryAttempts !== 102 ||
    design?.execution?.technicalRecovery?.maximumProcessAttemptsPerUnit !== 3 ||
    design?.execution?.technicalRecovery?.validUnitRerun !== false ||
    design?.execution?.technicalRecovery?.semanticIndeterminacyRecovery !== false ||
    design?.execution?.technicalRecovery?.outcomeSelection !== false ||
    design?.exclusions?.reuse !== false ||
    design?.exclusions?.pooling !== false
  ) {
    issues.push('recovery or exclusion boundary drifted');
  }
  return { valid: issues.length === 0, issues, digestRecords };
}

export function loadTutorStubResistanceWarmNonwarmDesign({ designPath, root = process.cwd() } = {}) {
  const absolute = path.resolve(root, designPath || '');
  const source = fs.readFileSync(absolute);
  const design = JSON.parse(source);
  const validation = validateTutorStubResistanceWarmNonwarmDesign(design, root);
  if (!validation.valid) throw new Error(`warm/nonwarm design invalid: ${validation.issues.join('; ')}`);
  return { path: absolute, source, sha256: sha256(source), design, digestRecords: validation.digestRecords };
}

export function buildTutorStubResistanceWarmNonwarmPlan(design) {
  const seed = design.randomization.masterSeed;
  const jobs = [];
  let index = 0;
  for (let block = 1; block <= design.sampleSize.balancedBlocks; block += 1) {
    const blockId = `block_${String(block).padStart(2, '0')}`;
    for (const [slotIndex, assignment] of randomizedAssignments(seed, blockId).entries()) {
      index += 1;
      jobs.push({
        id: `frame_refuser-warm-nonwarm-confirmation-${blockId}-s${slotIndex + 1}`,
        block_id: blockId,
        slot: slotIndex + 1,
        assignment_index: index,
        run_seed: seed * 1000 + index,
        assigned_arm: assignment.assigned_arm,
        treatment: {
          profile: 'frame_refuser',
          action_fit: 'matched',
          realization: assignment.realization,
          pedagogical_move: 'test_bounded_distinction',
          host_action_family: 'clarify_distinction',
          register: assignment.realization,
        },
        randomization: {
          master_seed: seed,
          algorithm: RANDOMIZATION_ALGORITHM,
          assignment_token: assignment.token,
          permutation_rank: assignment.permutation_rank,
          score_sha256: assignment.score_sha256,
        },
      });
    }
  }
  if (
    jobs.length !== 200 ||
    jobs.filter((job) => job.assigned_arm === 'warm_shared_invitation').length !== 100 ||
    jobs.filter((job) => job.assigned_arm === 'nonwarm_reference').length !== 100 ||
    new Set(jobs.map((job) => job.id)).size !== 200 ||
    new Set(jobs.map((job) => job.run_seed)).size !== 200
  ) {
    throw new Error('warm/nonwarm plan must contain 200 unique jobs balanced 100 per arm');
  }
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-warm-nonwarm-plan.v1',
    status: 'planned_zero_call',
    jobs,
    assignment_sha256: canonicalSha256(
      jobs.map(({ id, block_id, slot, assigned_arm, run_seed, randomization }) => ({
        id,
        block_id,
        slot,
        assigned_arm,
        run_seed,
        randomization,
      })),
    ),
  };
}

export function configureTutorStubResistanceWarmNonwarmFromCli({
  args,
  state,
  root,
  autoLearnerEnabled,
  autoTurns,
  appendTraceEvent,
  observationSemantics,
} = {}) {
  const designPath = args?.['resistance-warm-nonwarm-confirmation-design'];
  const jobId = args?.['resistance-warm-nonwarm-confirmation-job'];
  const loaded = loadTutorStubResistanceWarmNonwarmDesign({ designPath, root });
  const plan = buildTutorStubResistanceWarmNonwarmPlan(loaded.design);
  const job = plan.jobs.find((candidate) => candidate.id === jobId);
  if (!job) throw new Error(`warm/nonwarm confirmation job ${JSON.stringify(jobId)} is not registered`);
  const budget = Number(args['model-call-budget']);
  if (
    !state ||
    state.turns?.length ||
    state.history?.length ||
    !autoLearnerEnabled ||
    Number(autoTurns) !== 4 ||
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > 102 ||
    args.model !== 'codex.gpt-5.6-luna' ||
    args['classifier-model'] !== 'codex.gpt-5.6-luna' ||
    args['learner-record-model'] !== 'codex.gpt-5.6-luna' ||
    args['auto-learner-model'] !== 'codex.gpt-5.6-luna' ||
    args['cli-effort'] !== 'low' ||
    Number(args['run-seed']) !== job.run_seed ||
    Number(args['eval-repeat']) !== job.assignment_index ||
    args['eval-job-id'] !== job.id ||
    args['acknowledge-research-use'] !== true ||
    observationSemantics !== loaded.design.measurement.triggerInstrument.observationSemantics ||
    loaded.design.measurement.triggerInstrument.path !==
      'config/tutor-stub-resistance-semantic-adjudication-registration.v6.json'
  ) {
    throw new Error('warm/nonwarm confirmation launch pins or remaining attempt ceiling drifted');
  }
  const base = loadTutorStubResistanceActionRegisterRegistration(path.resolve(root, BASE_REGISTRATION));
  const runtime = createTutorStubResistanceActionRegisterStudyRuntime({
    registration: base.registration,
    registrationPath: BASE_REGISTRATION,
    registrationSha256: base.sha256,
    profile: 'frame_refuser',
    actionFit: 'matched',
    realization: job.treatment.realization,
    repeat: 'block_01',
  });
  runtime.registration.version = 11;
  runtime.registration.design.trigger.observationSemantics =
    loaded.design.measurement.triggerInstrument.observationSemantics;
  runtime.registration.outcomeSemanticAdjudication = {
    instrumentRegistrationPath: loaded.design.measurement.outcomeAndFidelityInstrument.path,
    instrumentRegistrationSha256: loaded.design.measurement.outcomeAndFidelityInstrument.sha256,
  };
  runtime.repeat = job.block_id;
  state.resistanceActionRegisterStudy = {
    ...runtime,
    dynamic_confirmation: true,
    warm_nonwarm_confirmation: true,
    engineering_smoke_excluded_from_confirmation: false,
    job_id: job.id,
    batch_id: job.block_id,
    assigned_arm: job.assigned_arm,
    assignment_index: job.assignment_index,
    design_path: path.relative(root, loaded.path),
    design_sha256: loaded.sha256,
    prefix_id: null,
    trigger_turn: null,
    trigger_learner_text: null,
    trigger_learner_sha256: null,
    maximum_trigger_turn: 2,
    outcome_horizon_learner_turns: 2,
    final_learner_without_tutor_reply: true,
  };
  appendTraceEvent(state.trace, {
    type: 'resistance_warm_nonwarm_confirmation_execution_start',
    jobId: job.id,
    batchId: job.block_id,
    assignedArm: job.assigned_arm,
    assignmentIndex: job.assignment_index,
    runSeed: job.run_seed,
    designPath: path.relative(root, loaded.path),
    designSha256: loaded.sha256,
    treatment: structuredClone(job.treatment),
    triggerEligibleByTurn: 2,
    outcomeHorizonLearnerTurns: 2,
    freshIndependentDialogue: true,
    priorDialogueReusedOrPooled: false,
    publicTranscriptChanged: false,
  });
  return { loaded, plan, job };
}
