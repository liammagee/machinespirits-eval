import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { recordFileDigest } from './recordedFileDigest.js';
import { loadTutorStubResistanceActionRegisterRegistration } from './tutorStubResistanceActionRegisterStudy.js';

export const TUTOR_STUB_RESISTANCE_MANIPULATION_VALIDATION_SCHEMA =
  'machinespirits.tutor-stub.resistance-action-register-manipulation-validation.v1';

const ASSIGNMENTS = Object.freeze([
  Object.freeze({ token: 'plain_1', realization: 'plain' }),
  Object.freeze({ token: 'plain_2', realization: 'plain' }),
  Object.freeze({ token: 'plain_3', realization: 'plain' }),
  Object.freeze({ token: 'warm_1', realization: 'warm' }),
  Object.freeze({ token: 'warm_2', realization: 'warm' }),
  Object.freeze({ token: 'warm_3', realization: 'warm' }),
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function repositoryPath(root, relative, label) {
  if (!relative || path.isAbsolute(relative)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(root, relative);
  const rebased = path.relative(root, absolute);
  if (rebased.startsWith('..') || path.isAbsolute(rebased)) throw new Error(`${label} escapes repository root`);
  return absolute;
}

function assertDesign(design, root) {
  const size = design?.scientificDesign?.sampleSize;
  const execution = design?.execution;
  if (
    design?.schema !== TUTOR_STUB_RESISTANCE_MANIPULATION_VALIDATION_SCHEMA ||
    design?.version !== 1 ||
    design?.stage !== 'prospective_manipulation_validation_only' ||
    size?.total !== 60 ||
    size?.perArm !== 30 ||
    size?.balancedBlocks !== 10 ||
    size?.dialoguesPerBlock !== 6 ||
    design?.scientificDesign?.powering?.passThresholdPerArm !== 28 ||
    design?.scientificDesign?.randomization?.masterSeed !== 20260828 ||
    execution?.plannedRoleCallDerivationPerDialogue?.total !== 23 ||
    execution?.maximumReservationsPerPlannedCall !== 3 ||
    execution?.maximumModelAttemptsPerDialogue !== 69 ||
    execution?.studyModelAttemptCeiling !== 4140 ||
    execution?.programmeLedgerBefore !== 4893 ||
    execution?.programmeModelAttemptCeiling !== 10000 ||
    execution?.programmeLedgerAfterStudyMaximum !== 9033 ||
    execution?.noInterimOutcomeAnalysis !== true
  ) {
    throw new Error('manipulation-validation design contract drifted');
  }
  // The contrast repair audit is a written record of what was measured before
  // this design was cut, so it keeps its byte pin. The two registrations are
  // recorded: correcting one of them is not a design change.
  const auditPath = repositoryPath(root, execution.contrastRepairAuditPath, 'contrast repair audit');
  if (fileSha256(auditPath) !== execution.contrastRepairAuditSha256) {
    throw new Error('contrast repair audit digest drifted');
  }
  return [
    [execution.baseRegistrationPath, execution.baseRegistrationSha256, 'base registration'],
    [design.instrument.registrationPath, design.instrument.registrationSha256, 'fidelity instrument registration'],
  ].map(([relative, recordedSha256, label]) => {
    repositoryPath(root, relative, label);
    return recordFileDigest({ root, filePath: relative, recordedSha256, label });
  });
}

export function buildTutorStubResistanceManipulationValidationPlan(design) {
  const seed = design.scientificDesign.randomization.masterSeed;
  const jobs = [];
  for (let blockIndex = 1; blockIndex <= 10; blockIndex += 1) {
    const blockId = `block_${String(blockIndex).padStart(2, '0')}`;
    const ranked = ASSIGNMENTS.map((entry) => ({
      ...entry,
      score_sha256: sha256(`sha256_ranked_balanced_block_permutation_v1:${seed}:${blockId}:${entry.token}`),
    })).sort((left, right) => left.score_sha256.localeCompare(right.score_sha256));
    ranked.forEach((assignment, slotIndex) => {
      const slot = slotIndex + 1;
      const id = `manip-v1-b${String(blockIndex).padStart(2, '0')}-s${String(slot).padStart(2, '0')}`;
      const seedHex = sha256(`${seed}:${id}`).slice(0, 8);
      jobs.push({
        id,
        block_id: blockId,
        slot,
        assignment_index: jobs.length + 1,
        run_seed: Number.parseInt(seedHex, 16) & 0x7fffffff,
        realization: assignment.realization,
        assignment_token: assignment.token,
        score_sha256: assignment.score_sha256,
      });
    });
  }
  if (
    jobs.length !== 60 ||
    jobs.filter((job) => job.realization === 'plain').length !== 30 ||
    jobs.filter((job) => job.realization === 'warm').length !== 30 ||
    new Set(jobs.map((job) => job.id)).size !== 60 ||
    new Set(jobs.map((job) => job.run_seed)).size !== 60
  ) {
    throw new Error('manipulation-validation plan is not 60 unique balanced dialogues');
  }
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-manipulation-validation-plan.v1',
    jobs,
    assignment_sha256: sha256(
      JSON.stringify(
        jobs.map(({ id, block_id, slot, realization, run_seed }) => ({
          id,
          block_id,
          slot,
          realization,
          run_seed,
        })),
      ),
    ),
  };
}

export function loadTutorStubResistanceManipulationValidation({ designPath, root = process.cwd() } = {}) {
  const requested = path.isAbsolute(designPath) ? designPath : path.resolve(root, designPath);
  const absolute = repositoryPath(root, path.relative(root, requested), 'validation design');
  const source = fs.readFileSync(absolute, 'utf8');
  const design = JSON.parse(source);
  const digestRecords = assertDesign(design, root);
  const base = loadTutorStubResistanceActionRegisterRegistration(
    repositoryPath(root, design.execution.baseRegistrationPath, 'base registration'),
  );
  return {
    path: absolute,
    source,
    sha256: sha256(source),
    digestRecords,
    design,
    base,
    plan: buildTutorStubResistanceManipulationValidationPlan(design),
  };
}

export function configureTutorStubResistanceManipulationValidationFromCli({
  args,
  state,
  root,
  autoLearnerEnabled,
  autoTurns,
  appendTraceEvent,
  observationSemantics,
} = {}) {
  const loaded = loadTutorStubResistanceManipulationValidation({
    designPath: path.resolve(root, args['resistance-action-register-manipulation-validation-design']),
    root,
  });
  const job = loaded.plan.jobs.find(
    (candidate) => candidate.id === args['resistance-action-register-manipulation-validation-job'],
  );
  const budget = Number(args['model-call-budget']);
  if (
    !job ||
    !autoLearnerEnabled ||
    Number(autoTurns) !== 2 ||
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > 69 ||
    args.model !== 'codex.gpt-5.6-luna' ||
    args['classifier-model'] !== 'codex.gpt-5.6-luna' ||
    args['learner-record-model'] !== 'codex.gpt-5.6-luna' ||
    args['auto-learner-model'] !== 'codex.gpt-5.6-luna' ||
    args['cli-effort'] !== 'low' ||
    Number(args['run-seed']) !== job.run_seed ||
    Number(args['eval-repeat']) !== job.assignment_index ||
    args['eval-job-id'] !== job.id ||
    args['no-opening'] === true ||
    args['acknowledge-research-use'] !== true ||
    observationSemantics !== 'prospective_frame_resistance_semantic_v5'
  ) {
    throw new Error('manipulation-validation launch pins or per-dialogue attempt ceiling drifted');
  }
  state.resistanceActionRegisterStudy = {
    schema: 'machinespirits.tutor-stub.resistance-action-register-study-runtime.v1',
    enabled: true,
    authority: 'explicit_study_only_opt_in',
    profile: 'frame_refuser',
    action_fit: 'matched',
    realization: job.realization,
    repeat: job.block_id,
    registration_path: path.relative(root, loaded.base.path),
    registration_sha256: loaded.base.sha256,
    registration: loaded.base.registration,
    consumed: false,
    history: [],
    dynamic_confirmation: true,
    manipulation_validation: true,
    validation_design_path: path.relative(root, loaded.path),
    validation_design_sha256: loaded.sha256,
    job_id: job.id,
    batch_id: job.block_id,
    trigger_turn: null,
    trigger_learner_text: null,
    trigger_learner_sha256: null,
    maximum_trigger_turn: 2,
    outcome_horizon_learner_turns: 0,
    final_learner_without_tutor_reply: false,
  };
  appendTraceEvent(state.trace, {
    type: 'resistance_action_register_manipulation_validation_start',
    jobId: job.id,
    blockId: job.block_id,
    assignmentIndex: job.assignment_index,
    runSeed: job.run_seed,
    designSha256: loaded.sha256,
    assignment: job.realization,
    assignmentConcealedFromPreTriggerGeneratorAndFromJudges: true,
    confirmationOutcomeGeneratedOrJudged: false,
    publicTranscriptChanged: false,
  });
  return { loaded, job };
}

export default {
  buildTutorStubResistanceManipulationValidationPlan,
  configureTutorStubResistanceManipulationValidationFromCli,
  loadTutorStubResistanceManipulationValidation,
};
