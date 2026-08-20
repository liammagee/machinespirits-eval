import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildTutorStubBoredomProofDagPlan,
  validateTutorStubBoredomProofDagRegistration,
} from './tutorStubBoredomActionRegisterProofDagPreflight.js';

export const TUTOR_STUB_BOREDOM_PROOF_DAG_EXECUTION_START =
  'resistance_action_register_boredom_proof_dag_execution_start';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function runtimeRegistrationAdapter(registration, world) {
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-crossed-registration.v1',
    version: 1,
    status: 'frozen_design_hold',
    authorization: { modelCallsAuthorized: false, liveRunAuthorized: false },
    design: {
      world,
      dagMode: registration.design.dagMode,
      profiles: ['bored'],
      factors: {
        actionFit: {
          levels: ['matched'],
          assignments: { bored: { matched: registration.design.treatment.fixedPedagogicalMove } },
        },
        realization: { levels: ['plain', 'warm'], plain: 'plain', warm: 'warm' },
        replicationBlock: {
          levels: [
            'execution_batch_1',
            'execution_batch_2',
            'execution_batch_3',
            'execution_batch_4',
            'execution_batch_5',
            'execution_batch_6',
            'execution_batch_7',
            'execution_batch_8',
            'execution_batch_9',
          ],
        },
      },
      intervention: {
        applicationOrder: [...registration.design.treatment.applicationOrder],
        studyOnlyOptIn: true,
        legacyDefaultOutsideStudy: true,
      },
    },
  };
}

export function loadTutorStubBoredomProofDagStudy({ registrationPath } = {}) {
  const absolute = path.resolve(registrationPath);
  const source = fs.readFileSync(absolute, 'utf8');
  const registration = JSON.parse(source);
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  if (!validation.ok) throw new Error(`boredom proof-DAG registration invalid: ${validation.errors.join('; ')}`);
  return {
    path: absolute,
    source,
    sha256: sha256(source),
    registration,
    plan: buildTutorStubBoredomProofDagPlan(registration),
  };
}

export function resolveTutorStubBoredomProofDagJob({ loaded, jobId } = {}) {
  const job = loaded?.plan?.jobs?.find((candidate) => candidate.id === jobId);
  if (!job) throw new Error(`boredom proof-DAG job ${JSON.stringify(jobId)} is not registered`);
  return job;
}

export function configureTutorStubBoredomProofDagExecution({ state, loaded, jobId, appendTraceEvent } = {}) {
  if (!state || state.turns?.length || state.history?.length) {
    throw new Error('boredom proof-DAG execution requires a fresh empty dialogue state');
  }
  const job = resolveTutorStubBoredomProofDagJob({ loaded, jobId });
  state.resistanceActionRegisterStudy = {
    schema: 'machinespirits.tutor-stub.resistance-action-register-study-runtime.v1',
    enabled: true,
    authority: 'explicit_study_only_opt_in',
    profile: 'bored',
    action_fit: 'matched',
    realization: job.realization,
    repeat: job.batch_id,
    registration_path: path.relative(process.cwd(), loaded.path),
    registration_sha256: loaded.sha256,
    registration: runtimeRegistrationAdapter(loaded.registration, job.world),
    proof_dag_registration: clone(loaded.registration),
    consumed: false,
    history: [],
    dynamic_confirmation: true,
    dynamic_boredom_proof_dag: true,
    job_id: job.id,
    batch_id: job.batch_id,
    prefix_id: null,
    trigger_turn: null,
    trigger_learner_text: null,
    trigger_learner_sha256: null,
    maximum_trigger_turn: job.maximum_trigger_turn,
    outcome_horizon_learner_turns: loaded.registration.design.treatment.postTriggerLearnerTurns,
    final_learner_without_tutor_reply: true,
  };
  appendTraceEvent(state.trace, {
    type: TUTOR_STUB_BOREDOM_PROOF_DAG_EXECUTION_START,
    jobId: job.id,
    batchId: job.batch_id,
    assignmentIndex: job.assignment_index,
    runSeed: job.seed,
    world: job.world,
    registrationSha256: loaded.sha256,
    assignmentManifestSha256: job.assignment_manifest_sha256,
    assignmentRankSha256: job.assignment_rank_sha256,
    treatment: {
      profile: 'bored',
      action_fit: 'matched',
      realization: job.realization,
      pedagogical_move: job.pedagogical_move,
      register: job.realization,
    },
    triggerEligibleByTurn: job.maximum_trigger_turn,
    outcomeHorizonLearnerTurns: loaded.registration.design.treatment.postTriggerLearnerTurns,
    freshIndependentDialogue: true,
    priorDialogueReused: false,
    priorOutcomePooled: false,
    publicTranscriptChanged: false,
  });
  return job;
}

export function configureTutorStubBoredomProofDagFromCli({
  args,
  state,
  root,
  autoLearnerEnabled,
  autoTurns,
  appendTraceEvent,
  observationSemantics,
} = {}) {
  const registrationPath = args?.['boredom-proof-dag-registration'];
  const jobId = args?.['boredom-proof-dag-job'];
  if (!registrationPath || !jobId)
    throw new Error('boredom proof-DAG execution requires registration and job together');
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: path.resolve(root, registrationPath) });
  const job = resolveTutorStubBoredomProofDagJob({ loaded, jobId });
  const budget = Number(args['model-call-budget']);
  if (
    !autoLearnerEnabled ||
    Number(autoTurns) !== 4 ||
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > 60 ||
    args.model !== 'codex.gpt-5.6-luna' ||
    args['classifier-model'] !== 'codex.gpt-5.6-luna' ||
    args['learner-record-model'] !== 'codex.gpt-5.6-luna' ||
    args['auto-learner-model'] !== 'codex.gpt-5.6-luna' ||
    args['cli-effort'] !== 'low' ||
    args.world !== job.world ||
    args['auto-learner-profile'] !== 'bored' ||
    Number(args['run-seed']) !== job.seed ||
    Number(args['eval-repeat']) !== job.assignment_index ||
    args['eval-job-id'] !== job.id ||
    args['no-opening'] === true ||
    args['acknowledge-research-use'] !== true ||
    args['dag-mode'] !== 'strict_dag' ||
    args['register-policy'] !== 'field' ||
    args['register-palette'] !== 'plain,warm' ||
    observationSemantics !== 'prospective_v4'
  ) {
    throw new Error('boredom proof-DAG launch pins or remaining 60-attempt ceiling drifted');
  }
  configureTutorStubBoredomProofDagExecution({ state, loaded, jobId, appendTraceEvent });
  return { loaded, job };
}

export default {
  configureTutorStubBoredomProofDagExecution,
  configureTutorStubBoredomProofDagFromCli,
  loadTutorStubBoredomProofDagStudy,
  resolveTutorStubBoredomProofDagJob,
};
