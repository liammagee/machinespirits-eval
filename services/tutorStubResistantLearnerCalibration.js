import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { configureTutorStubBoredomProofDagExecution } from './tutorStubBoredomActionRegisterProofDagStudy.js';
import {
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL,
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF,
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER,
} from './tutorStubBoredomSemanticAdjudicationV3.js';
import {
  applyTutorStubResistanceActionRegisterSafetyOverride,
  compileTutorStubResistanceActionRegisterStudyAssignment,
  createTutorStubResistanceActionRegisterStudyRuntime,
  loadTutorStubResistanceActionRegisterRegistration,
  tutorStubResistanceHostActionFamily,
} from './tutorStubResistanceActionRegisterStudy.js';
import { loadWorld } from './dramaticDerivation/world.js';
import { tutorStubResistantLearnerSemanticJudgeRoutes } from './tutorStubResistantLearnerSemanticRuntime.js';
import {
  loadTutorStubResistanceSemanticRegistration,
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4,
} from './tutorStubResistanceSemanticRuntime.js';
import { compileTutorStubTurnProgressionContract } from './tutorStubTurnProgressionContract.js';
import { mintTutorStubRivalLearnerDag, tutorStubRivalLearnerDagPrompt } from './tutorStubRivalLearnerDag.js';

const DESIGN_SCHEMA_V1 = 'machinespirits.tutor-stub.resistant-learner-study-design.v1';
const DESIGN_SCHEMA_V2 = 'machinespirits.tutor-stub.resistant-learner-study-design.v2';
const B1_ID = 'resistant-learner-b1-authored-pickup';
const R1_ID = 'resistant-learner-r1-graded-engagement';
const BOREDOM_TEMPLATE = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v8.json';
const REFUSER_TEMPLATE = 'config/tutor-stub-resistance-action-register-crossed-registration.v9.json';
const JUDGES = Object.freeze(['codex.gpt-5.6-sol', 'claude-code.sonnet-5']);
const REGISTERS = Object.freeze(['warm', 'plain', 'edged']);
const B1_WORLDS = Object.freeze([
  'world_022_foxtrot_jukebox',
  'world_026_skyway_bakery',
  'world_028_larkspur_fridge',
  'world_029_riverside_clinic',
  'world_030_rowan_flat',
  'world_031_tideway_makerspace',
]);
const B1_ACTION_LEVEL = Object.freeze({
  ask_discriminating_question: 'ask_question',
  stage_public_evidence_for_next_step: 'carry_on',
});
const LUNA_MODEL_REF = 'codex.gpt-5.6-luna';

function routeFields({ id, modelRef, provider, model, effort }) {
  return { id, modelRef, provider, model, effort };
}

export function tutorStubResistantLearnerRuntimeModelRoutes(design) {
  const b1 = design?.studyId === B1_ID;
  const resistanceV4Judges = b1
    ? []
    : loadTutorStubResistanceSemanticRegistration(TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4).registration
        .measurement.judges;
  const triggerObservation = b1
    ? {
        semantics: 'prospective_v9',
        judges: [
          {
            id: 'boredom_observer',
            modelRef: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF,
            provider: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER,
            model: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL,
            effort: 'low',
          },
        ],
      }
    : {
        semantics: 'prospective_frame_resistance_semantic_v4',
        judges: JUDGES.map((modelRef) => {
          const judge = resistanceV4Judges.find((candidate) => candidate.modelRef === modelRef);
          if (!judge) throw new Error(`registered R1 trigger route is missing ${modelRef}`);
          return routeFields(judge);
        }),
      };
  return {
    tutor: LUNA_MODEL_REF,
    analysis: LUNA_MODEL_REF,
    analysisScope: 'classifier_and_learner_record_support_only',
    learner: LUNA_MODEL_REF,
    cliEffort: 'low',
    triggerObservation,
    finalSemanticReaders: tutorStubResistantLearnerSemanticJudgeRoutes(design),
  };
}

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

function exactValues(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

export function validateTutorStubResistantLearnerDesign(design) {
  const issues = [];
  const studyId = design?.studyId;
  const v1 = design?.schema === DESIGN_SCHEMA_V1;
  const v2 = design?.schema === DESIGN_SCHEMA_V2;
  if ((!v1 && !v2) || ![B1_ID, R1_ID].includes(studyId)) {
    issues.push('design identity is unsupported');
  }
  const expectedStatus = v2
    ? 'prospective_zero_call_design_pending_typed_approval'
    : 'prospective_zero_call_design_pending_gate_1_go';
  if (design?.status !== expectedStatus) {
    issues.push('design status drifted');
  }
  if (design?.callAuthority?.grantsModelCalls !== false) issues.push('design must not grant model calls');
  if (design?.calibration?.dialogues !== 18) issues.push('calibration must contain 18 dialogues');
  if (!Number.isInteger(design?.randomization?.masterSeed)) issues.push('randomization master seed is missing');
  if (!exactValues(design?.measurement?.readerPanel?.judges, JUDGES)) issues.push('reader panel drifted');
  if ([B1_ID, R1_ID].includes(studyId)) {
    try {
      if (!exactValues(design?.models, tutorStubResistantLearnerRuntimeModelRoutes(design))) {
        issues.push('model route closure drifted');
      }
    } catch (error) {
      issues.push(`model route closure failed: ${error.message}`);
    }
  }
  const calls = Object.values(design?.attemptCeilings?.callPlanPerDialogue || {}).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
  const planned = Number(design?.attemptCeilings?.plannedCallsPerDialogue);
  const plannedReservationCeiling = Number(design?.attemptCeilings?.plannedCallReservationCeilingPerDialogue);
  const perDialogue = Number(design?.attemptCeilings?.maximumReservationsPerDialogue);
  const authorizationHeadroom = Number(design?.attemptCeilings?.authorizationHeadroomReservationsPerDialogue);
  const perCall = Number(design?.attemptCeilings?.maximumReservationsPerPlannedCall);
  if (
    calls !== planned ||
    perCall !== 3 ||
    plannedReservationCeiling !== planned * perCall ||
    authorizationHeadroom !== 6 ||
    perDialogue !== plannedReservationCeiling + authorizationHeadroom ||
    Number(design?.attemptCeilings?.calibrationMaximumReservations) !== perDialogue * 18
  ) {
    issues.push('attempt ceiling arithmetic drifted');
  }
  if (studyId === B1_ID) {
    const actions = design?.factors?.action?.levels || [];
    if (
      v1 &&
      (design?.revision !== 4 ||
        design?.operatorAmendment?.priorDesignSha256 !==
          '8bd814ed97cc572f11b1b316432c8e2f52db36ca85ae152c668cf48e28260b75' ||
        design?.operatorAmendment?.outcomeBlind !== true ||
        design?.supersedes?.priorDesignSha256 !== '03235175002fdab1a28492a809215df8744eba8f1eac25eb99126e786c37d1bb' ||
        design?.supersedes?.priorDisposition !==
          'void_technical_route_authorization_mismatch_no_calibration_unit_completed' ||
        design?.supersedes?.earlierTechnicalStop?.priorDesignSha256 !==
          'f007fb9ad6be419035a07f2ef8409a233f0b994ae2bf62e827d5c7770945c157' ||
        design?.supersedes?.reuse !== false ||
        design?.population?.profile !== 'bored' ||
        !exactValues(design?.population?.worlds, B1_WORLDS) ||
        !exactValues(
          actions.map((row) => row.id),
          Object.keys(B1_ACTION_LEVEL),
        ) ||
        !exactValues(
          design?.factors?.register?.levels?.map((row) => row.id),
          REGISTERS,
        ) ||
        !exactValues(design?.factors?.register?.runtimeMapping?.edgedByAction, {
          ask_discriminating_question: 'sarcastic',
          stage_public_evidence_for_next_step: 'ironic',
        }) ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 5 ||
        design?.randomization?.masterSeed !== 2026082301)
    ) {
      issues.push('B1 population, factors, horizon, or seed drifted');
    }
    if (
      v2 &&
      (design?.revision !== 1 ||
        design?.supersedesDesign !== 'config/tutor-stub-resistant-learner-b1-design.v1.json' ||
        design?.population?.profile !== 'bored-rival-dag-v2' ||
        design?.population?.baseCompatibilityId !== 'bored' ||
        !exactValues(design?.population?.worlds, B1_WORLDS) ||
        !exactValues(
          actions.map((row) => row.id),
          Object.keys(B1_ACTION_LEVEL),
        ) ||
        !exactValues(
          design?.factors?.register?.levels?.map((row) => row.id),
          REGISTERS,
        ) ||
        design?.rivalDagPersona?.mechanism !== 'content_rivalry' ||
        design?.rivalDagPersona?.concessionCondition?.kind !== 'public_tutor_move_bears_on_open_rival_node' ||
        design?.rivalDagPersona?.concessionCondition?.matchingAlgorithm?.id !== 'normalized_public_token_overlap_v1' ||
        design?.measurement?.primaryEndpoint?.id !== 'learner_authored_tutor_or_bridge_pickup_within_five_turns' ||
        design?.measurement?.readerPanel?.protocolSource !==
          'config/tutor-stub-resistant-learner-semantic-registration.v2.json' ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 5 ||
        design?.randomization?.masterSeed !== 2026082301)
    ) {
      issues.push('B1 v2 rival-DAG design drifted');
    }
  }
  if (studyId === R1_ID) {
    if (
      v1 &&
      (design?.revision !== 3 ||
        design?.operatorAmendment?.priorDesignSha256 !==
          'b0d328594a2a0dc51543b44836e5a5d827955d404572c2b682d36a2d3e97c95e' ||
        design?.operatorAmendment?.outcomeBlind !== true ||
        design?.supersedes?.priorDesignSha256 !== '28e961c68c8a7ce989f2b05d7182646f3fd9665a9954e1ebded5efe5239a0946' ||
        design?.supersedes?.priorDisposition !== 'void_technical_route_authorization_mismatch_r1_not_started' ||
        design?.supersedes?.reuse !== false ||
        design?.personaContract?.id !== 'frame_refuser-r1-v1' ||
        !exactValues(design?.population?.worlds, ['world_005_marrick', 'world_030_rowan_flat']) ||
        !exactValues(
          design?.register?.levels?.map((row) => row.id),
          REGISTERS,
        ) ||
        design?.register?.runtimeMapping?.edged !== 'ironic' ||
        design?.intervention?.action !== 'test_bounded_distinction' ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 6 ||
        design?.randomization?.masterSeed !== 2026082302)
    ) {
      issues.push('R1 persona, worlds, intervention, horizon, or seed drifted');
    }
    if (
      v2 &&
      (design?.revision !== 1 ||
        design?.supersedesDesign !== 'config/tutor-stub-resistant-learner-r1-design.v1.json' ||
        design?.population?.profile !== 'frame_refuser-r1-rival-dag-v2' ||
        design?.population?.baseCompatibilityId !== 'frame_refuser' ||
        !exactValues(design?.population?.worlds, ['world_005_marrick', 'world_030_rowan_flat']) ||
        !exactValues(
          design?.register?.levels?.map((row) => row.id),
          REGISTERS,
        ) ||
        design?.rivalDagPersona?.mechanism !== 'standing_rivalry' ||
        design?.rivalDagPersona?.concessionCondition?.kind !== 'public_tutor_move_bears_on_open_rival_node' ||
        design?.rivalDagPersona?.concessionCondition?.matchingAlgorithm?.id !== 'normalized_public_token_overlap_v1' ||
        design?.intervention?.action !== 'test_bounded_distinction' ||
        design?.measurement?.primaryEndpoint?.id !== 'final_graded_rival_frame_engagement_at_six_turns' ||
        design?.measurement?.readerPanel?.protocolSource !==
          'config/tutor-stub-resistant-learner-semantic-registration.v2.json' ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 6 ||
        design?.randomization?.masterSeed !== 2026082302)
    ) {
      issues.push('R1 v2 rival-DAG design drifted');
    }
  }
  return { valid: issues.length === 0, issues };
}

export function loadTutorStubResistantLearnerDesign({ designPath, root = process.cwd() } = {}) {
  const absolute = path.resolve(root, designPath || '');
  const source = fs.readFileSync(absolute);
  const design = JSON.parse(source);
  const validation = validateTutorStubResistantLearnerDesign(design);
  if (!validation.valid) throw new Error(`resistant-learner design invalid: ${validation.issues.join('; ')}`);
  return { path: absolute, source, sha256: sha256(source), design };
}

function ranked(values, seed, block) {
  return values
    .map((value) => ({ value, rank_sha256: sha256(`${seed}:${block}:${value}`) }))
    .sort((left, right) => left.rank_sha256.localeCompare(right.rank_sha256));
}

function orderedJobs(jobs, seed) {
  return jobs
    .map((job) => ({ ...job, order_sha256: sha256(`${seed}:job-order:${job.id}`) }))
    .sort((left, right) => left.order_sha256.localeCompare(right.order_sha256))
    .map((job, index) => ({ ...job, assignment_index: index + 1, run_seed: seed * 100 + index + 1 }));
}

function buildB1Jobs(design) {
  const seed = design.randomization.masterSeed;
  const worlds = design.population.worlds;
  const jobs = [];
  for (const register of REGISTERS) {
    const rankedWorlds = ranked(worlds, seed, `B1:${register}`);
    for (const [index, rankedWorld] of rankedWorlds.entries()) {
      const action = index < worlds.length / 2 ? 'ask_discriminating_question' : 'stage_public_evidence_for_next_step';
      const world = rankedWorld.value;
      jobs.push({
        id: `B1-cal-${register}-${world}`,
        study: 'B1',
        world,
        register,
        action,
        pedagogical_move: action,
        pedagogical_move_level: B1_ACTION_LEVEL[action],
        host_action_family: tutorStubResistanceHostActionFamily(action),
        maximum_trigger_turn: 4,
        outcome_horizon_learner_turns: 5,
        allocation_rank_sha256: rankedWorld.rank_sha256,
      });
    }
  }
  return orderedJobs(jobs, seed).map((job, index) => ({
    ...job,
    batch_id: `batch_${String(Math.floor(index / 6) + 1).padStart(2, '0')}`,
    seed: job.run_seed,
    realization: job.register,
    assignment_manifest_sha256: canonicalSha256({
      id: job.id,
      world: job.world,
      register: job.register,
      action: job.action,
      seed: job.run_seed,
    }),
    assignment_rank_sha256: job.order_sha256,
  }));
}

function buildR1Jobs(design) {
  const seed = design.randomization.masterSeed;
  const jobs = [];
  for (const world of design.population.worlds) {
    for (const register of REGISTERS) {
      for (let repeat = 1; repeat <= 3; repeat += 1) {
        jobs.push({
          id: `R1-cal-${world}-${register}-r${repeat}`,
          study: 'R1',
          world,
          register,
          action: 'test_bounded_distinction',
          pedagogical_move: 'test_bounded_distinction',
          host_action_family: tutorStubResistanceHostActionFamily('test_bounded_distinction'),
          maximum_trigger_turn: 2,
          outcome_horizon_learner_turns: 6,
          repeat,
        });
      }
    }
  }
  return orderedJobs(jobs, seed).map((job, index) => ({
    ...job,
    batch_id: `batch_${String(Math.floor(index / 6) + 1).padStart(2, '0')}`,
    realization: job.register,
  }));
}

export function buildTutorStubResistantLearnerCalibrationPlan(design) {
  const validation = validateTutorStubResistantLearnerDesign(design);
  if (!validation.valid) throw new Error(`resistant-learner design invalid: ${validation.issues.join('; ')}`);
  const jobs = design.studyId === B1_ID ? buildB1Jobs(design) : buildR1Jobs(design);
  if (jobs.length !== 18 || new Set(jobs.map((job) => job.id)).size !== 18) {
    throw new Error('resistant-learner calibration requires 18 unique jobs');
  }
  const plan = {
    schema: 'machinespirits.tutor-stub.resistant-learner-calibration-plan.v1',
    status: 'planned_zero_call',
    study_id: design.studyId,
    master_seed: design.randomization.masterSeed,
    jobs,
  };
  plan.assignment_sha256 = canonicalSha256(jobs);
  return plan;
}

export function tutorStubFrameRefuserR1Prompt(design) {
  const contract = design?.personaContract;
  if (contract?.id !== 'frame_refuser-r1-v1') throw new Error('R1 prompt requires frame_refuser-r1-v1');
  const section = (title, lines) => [title, ...(lines || []).map((line) => `- ${line}`), ''];
  return [
    'You are simulating this automated learner profile: frame_refuser',
    '',
    `Private prospective contract: ${contract.id}`,
    '',
    ...section('Voice:', contract.voice),
    ...section('Initial state:', contract.initialState),
    ...section('After a bounded local test:', contract.afterBoundedLocalTest),
    `Epistemic freedom: ${contract.epistemicFreedom}`,
    '',
    ...section('Public-turn rules:', contract.publicTurnRules),
    'Apply this private contract to every learner turn. Never quote, name, or describe the contract.',
  ].join('\n');
}

function configureB1({ state, root, loaded, plan, job, appendTraceEvent }) {
  const template = JSON.parse(fs.readFileSync(path.join(root, BOREDOM_TEMPLATE), 'utf8'));
  template.design.treatment.realizations = [...REGISTERS];
  const runtimeLoaded = {
    ...loaded,
    registration: template,
    plan: {
      ...plan,
      batches: [...new Set(plan.jobs.map((row) => row.batch_id))].map((id) => ({ id })),
    },
  };
  configureTutorStubBoredomProofDagExecution({ state, loaded: runtimeLoaded, jobId: job.id, appendTraceEvent });
  Object.assign(state.resistanceActionRegisterStudy, {
    resistant_learner_calibration: true,
    resistant_learner_study: 'B1',
    design: structuredClone(loaded.design),
    design_path: path.relative(root, loaded.path),
    design_sha256: loaded.sha256,
    assignment_index: job.assignment_index,
  });
  if (loaded.design.schema === DESIGN_SCHEMA_V2) {
    state.resistanceActionRegisterStudy.study_assignment_instruction_overrides = structuredClone(
      loaded.design.tutorDeliveryContract,
    );
    state.privateRivalLearnerDag = mintTutorStubRivalLearnerDag({ design: loaded.design, job, root });
  }
}

function configureR1({ state, root, loaded, job, appendTraceEvent }) {
  const base = loadTutorStubResistanceActionRegisterRegistration(path.join(root, REFUSER_TEMPLATE));
  const runtime = createTutorStubResistanceActionRegisterStudyRuntime({
    registration: base.registration,
    registrationPath: REFUSER_TEMPLATE,
    registrationSha256: base.sha256,
    profile: 'frame_refuser',
    actionFit: 'matched',
    realization: 'plain',
    repeat: 'block_01',
  });
  runtime.registration.design.world = job.world;
  runtime.registration.design.factors.realization = Object.fromEntries([
    ['levels', [...REGISTERS]],
    ['plain', 'plain'],
    ['warm', 'warm'],
    ['edgedByAssignedMove', { test_bounded_distinction: 'ironic' }],
    ['edgeFollowsAssignedMoveNotLearnerProfile', true],
    ['faceThreatExcluded', true],
  ]);
  runtime.realization = job.register;
  runtime.repeat = job.batch_id;
  state.resistanceActionRegisterStudy = {
    ...runtime,
    dynamic_confirmation: true,
    resistant_learner_calibration: true,
    resistant_learner_study: 'R1',
    design: structuredClone(loaded.design),
    design_path: path.relative(root, loaded.path),
    design_sha256: loaded.sha256,
    engineering_smoke_excluded_from_confirmation: false,
    job_id: job.id,
    batch_id: job.batch_id,
    assignment_index: job.assignment_index,
    prefix_id: null,
    trigger_turn: null,
    trigger_learner_text: null,
    trigger_learner_sha256: null,
    maximum_trigger_turn: 2,
    outcome_horizon_learner_turns: 6,
    final_learner_without_tutor_reply: true,
    ...(loaded.design.schema === DESIGN_SCHEMA_V2
      ? { study_assignment_instruction_overrides: structuredClone(loaded.design.tutorDeliveryContract) }
      : {}),
  };
  if (loaded.design.schema === DESIGN_SCHEMA_V2) {
    state.privateRivalLearnerDag = mintTutorStubRivalLearnerDag({ design: loaded.design, job, root });
  }
  appendTraceEvent(state.trace, {
    type: 'resistant_learner_calibration_execution_start',
    study: 'R1',
    jobId: job.id,
    batchId: job.batch_id,
    assignmentIndex: job.assignment_index,
    runSeed: job.run_seed,
    world: job.world,
    designPath: path.relative(root, loaded.path),
    designSha256: loaded.sha256,
    treatment: {
      profile: loaded.design.schema === DESIGN_SCHEMA_V2 ? loaded.design.population.profile : 'frame_refuser-r1-v1',
      action: job.action,
      host_action_family: job.host_action_family,
      register: job.register,
    },
    triggerEligibleByTurn: 2,
    outcomeHorizonLearnerTurns: 6,
    freshIndependentDialogue: true,
    priorDialogueReusedOrPooled: false,
    publicTranscriptChanged: false,
  });
}

export function configureTutorStubResistantLearnerCalibrationFromCli({
  args,
  state,
  root,
  autoLearnerEnabled,
  autoLearnerProfileId,
  autoTurns,
  appendTraceEvent,
  observationSemantics,
} = {}) {
  const designPath = args?.['resistant-learner-calibration-design'];
  const jobId = args?.['resistant-learner-calibration-job'];
  const loaded = loadTutorStubResistantLearnerDesign({ designPath, root });
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  const job = plan.jobs.find((candidate) => candidate.id === jobId);
  if (!job) throw new Error(`resistant-learner calibration job ${JSON.stringify(jobId)} is not registered`);
  const b1 = loaded.design.studyId === B1_ID;
  const expectedTurns = job.maximum_trigger_turn + job.outcome_horizon_learner_turns;
  const expectedObservation = b1 ? 'prospective_v9' : 'prospective_frame_resistance_semantic_v4';
  const budget = Number(args['model-call-budget']);
  if (
    !state ||
    state.turns?.length ||
    state.history?.length ||
    !autoLearnerEnabled ||
    Number(autoTurns) !== expectedTurns ||
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > loaded.design.attemptCeilings.maximumReservationsPerDialogue ||
    args.model !== 'codex.gpt-5.6-luna' ||
    args['classifier-model'] !== 'codex.gpt-5.6-luna' ||
    args['learner-record-model'] !== 'codex.gpt-5.6-luna' ||
    args['auto-learner-model'] !== 'codex.gpt-5.6-luna' ||
    args['cli-effort'] !== 'low' ||
    args.world !== job.world ||
    autoLearnerProfileId !== (b1 ? 'bored' : 'frame_refuser') ||
    Number(args['run-seed']) !== job.run_seed ||
    Number(args['eval-repeat']) !== job.assignment_index ||
    args['eval-job-id'] !== job.id ||
    args['acknowledge-research-use'] !== true ||
    args['dag-mode'] !== 'strict_dag' ||
    args['register-policy'] !== 'field' ||
    args['register-palette'] !== 'warm,plain,ironic,sarcastic' ||
    observationSemantics !== expectedObservation
  ) {
    throw new Error('resistant-learner calibration launch pins or per-dialogue ceiling drifted');
  }
  if (b1) configureB1({ state, root, loaded, plan, job, appendTraceEvent });
  else configureR1({ state, root, loaded, job, appendTraceEvent });
  return { loaded, plan, job };
}

function preflightScene(kind) {
  return {
    learnerText: 'I dispute the wider frame and have stopped following this thread.',
    publicQuestion: 'What does the public record support, rule out, or leave open?',
    responseCompositionFrame: {
      discourse_plane: { plane: 'inquiry' },
      learner_move: { evidence_use: 'none' },
      learner_dag: { bottleneck: null, final_secret_entailed: false, asserted_secret: false },
      due_evidence_surfaces:
        kind === 'due_clue' ? ['The public ledger records two deliveries during the bounded interval.'] : [],
    },
  };
}

function safetyOverrideProbe(compiled) {
  if (!compiled.edged_safety_override_supported) return { required: false, passed: true };
  const selection = {
    response_configuration: {},
    resistance_action_register_intervention: {
      status: 'applied',
      assignment: { register: compiled.delivered_register },
      safety_override: {
        applied: false,
        assigned_register: compiled.delivered_register,
        delivered_register: compiled.delivered_register,
        reason: null,
      },
    },
  };
  const suppressed = applyTutorStubResistanceActionRegisterSafetyOverride(selection, {
    reason: 'protected_affect',
  });
  return {
    required: true,
    passed:
      suppressed.selected_register === 'plain' &&
      suppressed.resistance_action_register_intervention?.status === 'safety_override_nonadherent' &&
      suppressed.resistance_action_register_intervention?.safety_override?.assigned_register ===
        compiled.delivered_register,
    observed: suppressed.resistance_action_register_intervention?.safety_override || null,
  };
}

function auditRuntimeWorldRegistry(worlds, root) {
  const worldDirectory = path.join(root, 'config', 'drama-derivation');
  const productionWorldIds = new Set(
    fs
      .readdirSync(worldDirectory)
      .filter((name) => /^world-.*\.yaml$/u.test(name))
      .map((name) => loadWorld(path.join(worldDirectory, name)))
      .filter((world) => world.eligibility?.status === 'production')
      .map((world) => world.id),
  );
  const missing = worlds.filter((world) => !productionWorldIds.has(world));
  return {
    checked_worlds: [...worlds],
    production_world_count: productionWorldIds.size,
    missing_or_nonproduction_worlds: missing,
    passed: missing.length === 0,
  };
}

export function runTutorStubResistantLearnerCompilationPreflight({ loaded, root = process.cwd() } = {}) {
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded?.design);
  const b1 = loaded.design.studyId === B1_ID;
  const v2 = loaded.design.schema === DESIGN_SCHEMA_V2;
  const worldRegistry = auditRuntimeWorldRegistry(loaded.design.population.worlds, root);
  const runtimeModelRoutes = tutorStubResistantLearnerRuntimeModelRoutes(loaded.design);
  const modelRoute = {
    declared: loaded.design.models,
    runtime: runtimeModelRoutes,
    passed: exactValues(loaded.design.models, runtimeModelRoutes),
  };
  const selectedJobs = b1
    ? v2
      ? loaded.design.population.worlds.flatMap((world) =>
          REGISTERS.flatMap((register) =>
            Object.keys(B1_ACTION_LEVEL).map((action) => {
              const configurationJob = plan.jobs.find((job) => job.register === register && job.action === action);
              return {
                configurationJob,
                auditJob: {
                  ...configurationJob,
                  id: `B1-compile-${world}-${register}-${action}`,
                  world,
                },
              };
            }),
          ),
        )
      : REGISTERS.flatMap((register) =>
          Object.keys(B1_ACTION_LEVEL).map((action) => {
            const job = plan.jobs.find((candidate) => candidate.register === register && candidate.action === action);
            return { configurationJob: job, auditJob: job };
          }),
        )
    : loaded.design.population.worlds.flatMap((world) =>
        REGISTERS.map((register) => {
          const job = plan.jobs.find((candidate) => candidate.world === world && candidate.register === register);
          return { configurationJob: job, auditJob: job };
        }),
      );
  const personaLines =
    b1 || v2
      ? []
      : [
          ...loaded.design.personaContract.voice,
          ...loaded.design.personaContract.initialState,
          ...loaded.design.personaContract.afterBoundedLocalTest,
          loaded.design.personaContract.epistemicFreedom,
          ...loaded.design.personaContract.publicTurnRules,
        ];
  const rows = [];
  for (const { configurationJob, auditJob } of selectedJobs) {
    for (const scene of ['bare', 'due_clue']) {
      const job = configurationJob;
      const state = {
        trace: [],
        turns: [],
        history: [],
        register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
        world: {},
      };
      if (b1) configureB1({ state, root, loaded, plan, job, appendTraceEvent() {} });
      else configureR1({ state, root, loaded, job, appendTraceEvent() {} });
      const compiled = compileTutorStubResistanceActionRegisterStudyAssignment(state.resistanceActionRegisterStudy);
      const action = b1 ? loaded.design.factors.action.levels.find((candidate) => candidate.id === job.action) : null;
      const progression = compileTutorStubTurnProgressionContract({
        ...preflightScene(scene),
        actionFamily: compiled.host_action_family,
        registeredQuestionRule: action?.deliveredContrastRule || null,
      });
      const expectedQuestion = b1
        ? action.deliveredContrastRule === 'requires_question'
        : progression.handoff_contract.question_allowed;
      const safety = safetyOverrideProbe(compiled);
      const rivalDag = v2 ? mintTutorStubRivalLearnerDag({ design: loaded.design, job: auditJob, root }) : null;
      const personaPrompt = v2
        ? tutorStubRivalLearnerDagPrompt({ design: loaded.design, job: auditJob, root })
        : b1
          ? null
          : tutorStubFrameRefuserR1Prompt(loaded.design);
      const issues = [];
      if (compiled.pedagogical_move !== job.action) issues.push('pedagogical_move_drift');
      if (compiled.assigned_realization !== job.register) issues.push('assigned_realization_drift');
      if (!String(compiled.action_instruction || '').includes('public'))
        issues.push('public_evidence_boundary_missing');
      if (!String(compiled.realization_contrast_instruction || '').trim()) {
        issues.push('register_instruction_missing');
      }
      if (progression.handoff_contract.question_allowed !== expectedQuestion) {
        issues.push('question_permission_drift');
      }
      if (!b1 && !/reject the wider frame/iu.test(compiled.action_instruction)) {
        if (!v2 || !/wider frame disputed|wider frame/iu.test(compiled.action_instruction)) {
          issues.push('non_compliance_wording_missing');
        }
      }
      if (!safety.passed) issues.push('protected_affect_guard_failed');
      if (!b1 && !v2 && !personaLines.every((line) => personaPrompt.includes(line))) {
        issues.push('persona_prompt_line_missing');
      }
      if (v2 && compiled.instruction_source !== 'study_design_override') {
        issues.push('v2_delivery_contract_not_compiled');
      }
      if (v2 && b1 && job.action === 'ask_discriminating_question') {
        if (!/exactly one/iu.test(compiled.action_instruction) || !/whether/iu.test(compiled.action_instruction)) {
          issues.push('discriminating_question_contract_incomplete');
        }
      }
      if (v2 && b1 && job.action === 'stage_public_evidence_for_next_step') {
        if (!/declarative/iu.test(compiled.action_instruction) || !/no question/iu.test(compiled.action_instruction)) {
          issues.push('no_question_contract_incomplete');
        }
      }
      if (v2 && job.register === 'plain') {
        if (!/concise neutral/iu.test(compiled.realization_contrast_instruction)) {
          issues.push('plain_register_contract_incomplete');
        }
      }
      if (v2 && (!rivalDag || !personaPrompt.includes(rivalDag.sha256))) {
        issues.push('rival_dag_prompt_binding_failed');
      }
      rows.push({
        study: b1 ? 'B1' : 'R1',
        world: auditJob.world,
        action: job.action,
        assigned_register: job.register,
        scene,
        compiled,
        question_allowed: progression.handoff_contract.question_allowed,
        safety,
        persona_prompt_sha256: personaPrompt ? sha256(personaPrompt) : null,
        rival_dag_sha256: rivalDag?.sha256 || null,
        issues,
        passed: issues.length === 0,
      });
    }
  }
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-compilation-preflight.v1',
    study: b1 ? 'B1' : 'R1',
    status:
      worldRegistry.passed && modelRoute.passed && rows.every((row) => row.passed) ? 'passed_zero_call' : 'failed',
    expected_rows: b1 && v2 ? 72 : 12,
    world_registry: worldRegistry,
    model_route: modelRoute,
    rows,
    model_calls: 0,
    production_writes: 0,
  };
}

function panelField(row, instrument, field) {
  return row?.outcome?.[instrument]?.fields?.[field] || null;
}

function readerField(row, instrument, readerId, field) {
  return row?.outcome?.[instrument]?.seats?.find((seat) => seat.judge_id === readerId)?.validation?.fields?.[field];
}

function agreementSummary(rows, design) {
  const study = design.studyId === B1_ID ? 'B1' : 'R1';
  const v2 = design.schema === DESIGN_SCHEMA_V2;
  const primaryEndpoint = design.measurement.primaryEndpoint.id;
  const definitions =
    study === 'B1'
      ? {
          primary: v2
            ? [primaryEndpoint, 'final_selective_attention_resistance_retained']
            : ['learner_authored_thread_pickup_within_five_turns'],
          fidelity: [
            'delivered_action_family',
            'delivered_question_contrast',
            'delivered_register',
            'prohibited_delivery',
          ],
        }
      : {
          primary: [primaryEndpoint, 'final_jurisdictional_dispute_retained', 'whole_frame_compliance'],
          fidelity: ['delivered_test_bounded_distinction', 'delivered_register', 'prohibited_delivery'],
        };
  const readerIds = design.models.finalSemanticReaders.map((reader) => reader.id);
  const seatEligibility = Object.fromEntries(
    readerIds.map((readerId) => [
      readerId,
      Object.fromEntries(
        Object.entries(definitions).map(([instrument, fields]) => [
          instrument,
          rows.filter((row) => fields.every((field) => readerField(row, instrument, readerId, field)?.eligible)).length,
        ]),
      ),
    ]),
  );
  const pairs = [];
  for (let leftIndex = 0; leftIndex < readerIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < readerIds.length; rightIndex += 1) {
      const left = readerIds[leftIndex];
      const right = readerIds[rightIndex];
      for (const [instrument, fields] of Object.entries(definitions)) {
        for (const field of fields) {
          const joint = rows
            .map((row) => ({
              left: readerField(row, instrument, left, field),
              right: readerField(row, instrument, right, field),
            }))
            .filter((entry) => entry.left?.eligible && entry.right?.eligible);
          const agreements = joint.filter((entry) => entry.left.value === entry.right.value).length;
          pairs.push({
            readers: [left, right],
            instrument,
            field,
            jointly_eligible: joint.length,
            exact_agreements: agreements,
            conditional_exact_agreement: joint.length ? agreements / joint.length : null,
          });
        }
      }
    }
  }
  const rules = design.calibration.readerAgreementRules;
  const seatMinimum = v2
    ? Math.max(
        Number(rules.minimumEligibleVotesFloor),
        Math.ceil(rows.length * Number(rules.minimumEligibleVoteRatePerSeatAndInstrument)),
      )
    : 16;
  const jointMinimum = v2
    ? Math.max(
        Number(rules.minimumJointlyEligibleCasesFloor),
        Math.ceil(rows.length * Number(rules.minimumJointlyEligibleRatePerField)),
      )
    : Number(rules.minimumJointlyEligibleCasesPerSeatPairAndField);
  const passed =
    Object.values(seatEligibility).every((seat) => seat.primary >= seatMinimum && seat.fidelity >= seatMinimum) &&
    pairs.every(
      (pair) =>
        pair.jointly_eligible >= jointMinimum &&
        pair.conditional_exact_agreement >= rules.minimumConditionalExactAgreementPerSeatPairAndField,
    );
  return {
    denominator: v2 ? 'completed_rows' : 'registered_18_rows',
    completed_rows: rows.length,
    minimum_eligible_votes_per_seat_and_instrument: seatMinimum,
    minimum_jointly_eligible_cases_per_field: jointMinimum,
    seat_eligibility: seatEligibility,
    pairs,
    passed,
  };
}

function countBy(rows, key, values) {
  return Object.fromEntries(values.map((value) => [value, rows.filter((row) => row?.job?.[key] === value).length]));
}

function rateFloorCount(total, rate, floor = 0) {
  return Math.max(Number(floor || 0), Math.ceil(total * Number(rate || 0)));
}

export function summarizeTutorStubResistantLearnerCalibration({ rows, design }) {
  const study = design.studyId === B1_ID ? 'B1' : 'R1';
  const v2 = design.schema === DESIGN_SCHEMA_V2;
  const completed = rows.filter((row) => row.status === 'complete');
  const retainedSubstantiveFailures = rows.filter((row) => row.status === 'retained_substantive_failure');
  const executed = completed.length + retainedSubstantiveFailures.length;
  const agreement = agreementSummary(completed, design);
  const prohibited = completed.filter((row) => panelField(row, 'fidelity', 'prohibited_delivery')?.value === 'yes');
  let statistics;
  let gates;
  if (study === 'B1') {
    const outcomeField = design.measurement.primaryEndpoint.id;
    const determinate = completed.filter((row) => panelField(row, 'primary', outcomeField)?.status === 'determinate');
    const yes = determinate.filter((row) => panelField(row, 'primary', outcomeField).value === 'yes');
    const no = determinate.filter((row) => panelField(row, 'primary', outcomeField).value === 'no');
    const actionFidelity = Object.fromEntries(
      Object.keys(B1_ACTION_LEVEL).map((action) => {
        const assigned = completed.filter((row) => row.job.action === action);
        const expectedContrast = action === 'ask_discriminating_question' ? 'requires_question' : 'forbids_question';
        const correct = assigned.filter(
          (row) =>
            panelField(row, 'fidelity', 'delivered_action_family')?.value === action &&
            panelField(row, 'fidelity', 'delivered_question_contrast')?.value === expectedContrast,
        ).length;
        return [action, { assigned: assigned.length, correct }];
      }),
    );
    const registerFidelity = Object.fromEntries(
      REGISTERS.map((register) => {
        const assigned = completed.filter((row) => row.job.register === register);
        return [
          register,
          {
            assigned: assigned.length,
            correct: assigned.filter((row) => panelField(row, 'fidelity', 'delivered_register')?.value === register)
              .length,
          },
        ];
      }),
    );
    const determinateFidelity = completed.filter((row) => row.outcome?.fidelity?.status === 'determinate');
    const resistanceRetained = v2
      ? completed.filter(
          (row) => panelField(row, 'primary', 'final_selective_attention_resistance_retained')?.value === 'yes',
        ).length
      : null;
    const v2Rules = design.calibration;
    const determinateMinimum = v2
      ? rateFloorCount(
          completed.length,
          v2Rules.channelAliveRules.minimumDeterminateOutcomeRate,
          v2Rules.channelAliveRules.minimumDeterminateOutcomeFloor,
        )
      : 16;
    const fidelityMinimum = v2
      ? rateFloorCount(completed.length, v2Rules.fidelityRules.minimumDeterminatePanelRateOnCompletedRows)
      : 16;
    const resistanceMinimum = v2
      ? rateFloorCount(
          completed.length,
          v2Rules.personaRules.minimumResistanceRetainedRateOnCompletedRows,
          v2Rules.personaRules.minimumResistanceRetainedFloor,
        )
      : null;
    gates = {
      execution_complete: executed === 18,
      channel_alive: determinate.length >= determinateMinimum && yes.length >= 3 && no.length >= 3,
      ...(v2 ? { persona_fidelity: resistanceRetained >= resistanceMinimum } : {}),
      action_and_question_fidelity: Object.values(actionFidelity).every((value) =>
        v2
          ? value.correct >=
            rateFloorCount(value.assigned, v2Rules.fidelityRules.minimumCorrectActionAndQuestionContrastRatePerAction)
          : value.correct >= 8,
      ),
      register_fidelity: Object.values(registerFidelity).every((value) =>
        v2
          ? value.correct >= rateFloorCount(value.assigned, v2Rules.fidelityRules.minimumCorrectRegisterRatePerRegister)
          : value.correct >= 5,
      ),
      ...(v2 ? { fidelity_panels: determinateFidelity.length >= fidelityMinimum } : {}),
      reader_agreement: agreement.passed,
      safety: prohibited.length === 0,
    };
    statistics = {
      determinate: determinate.length,
      pickup_yes: yes.length,
      pickup_no: no.length,
      ...(v2
        ? {
            selective_attention_resistance_retained: resistanceRetained,
            completed_rows_denominator: completed.length,
            determinate_minimum: determinateMinimum,
            resistance_minimum: resistanceMinimum,
          }
        : {}),
      action_fidelity: actionFidelity,
      register_fidelity: registerFidelity,
    };
  } else {
    const outcomeField = design.measurement.primaryEndpoint.id;
    const determinate = completed.filter((row) => panelField(row, 'primary', outcomeField)?.status === 'determinate');
    const scores = Object.fromEntries(
      ['0', '1', '2'].map((score) => [
        score,
        determinate.filter((row) => panelField(row, 'primary', outcomeField).value === score).length,
      ]),
    );
    const successByWorld = Object.fromEntries(
      design.population.worlds.map((world) => [
        world,
        determinate.filter(
          (row) => row.job.world === world && ['1', '2'].includes(panelField(row, 'primary', outcomeField).value),
        ).length,
      ]),
    );
    const jurisdictionRetained = completed.filter(
      (row) => panelField(row, 'primary', 'final_jurisdictional_dispute_retained')?.value === 'yes',
    ).length;
    const wholeFrameCompliance = completed.filter(
      (row) => panelField(row, 'primary', 'whole_frame_compliance')?.value === 'yes',
    ).length;
    const actionCorrect = completed.filter(
      (row) => panelField(row, 'fidelity', 'delivered_test_bounded_distinction')?.value === 'yes',
    );
    const actionByWorld = countBy(actionCorrect, 'world', design.population.worlds);
    const registerFidelity = Object.fromEntries(
      REGISTERS.map((register) => {
        const assigned = completed.filter((row) => row.job.register === register);
        return [
          register,
          {
            assigned: assigned.length,
            correct: assigned.filter((row) => panelField(row, 'fidelity', 'delivered_register')?.value === register)
              .length,
          },
        ];
      }),
    );
    const determinateFidelity = completed.filter((row) => row.outcome?.fidelity?.status === 'determinate');
    const v2Rules = design.calibration;
    const determinateMinimum = v2
      ? rateFloorCount(
          completed.length,
          v2Rules.channelAliveRules.minimumDeterminateOutcomeRate,
          v2Rules.channelAliveRules.minimumDeterminateOutcomeFloor,
        )
      : 16;
    const jurisdictionMinimum = v2
      ? rateFloorCount(
          completed.length,
          v2Rules.personaRules.minimumJurisdictionRetainedRateOnCompletedRows,
          v2Rules.personaRules.minimumJurisdictionRetainedFloor,
        )
      : 16;
    const fidelityMinimum = v2
      ? rateFloorCount(completed.length, v2Rules.fidelityRules.minimumDeterminatePanelRateOnCompletedRows)
      : 16;
    const score2Rows = determinate.filter((row) => panelField(row, 'primary', outcomeField).value === '2');
    const everyScore2Retains = score2Rows.every(
      (row) => panelField(row, 'primary', 'final_jurisdictional_dispute_retained')?.value === 'yes',
    );
    gates = {
      execution_complete: executed === 18,
      channel_alive:
        determinate.length >= determinateMinimum &&
        scores['0'] >= 2 &&
        scores['1'] >= 2 &&
        scores['2'] >= 2 &&
        Object.values(successByWorld).every((count) => count >= 1),
      persona_fidelity:
        jurisdictionRetained >= jurisdictionMinimum && wholeFrameCompliance === 0 && (!v2 || everyScore2Retains),
      action_fidelity:
        (v2
          ? actionCorrect.length >=
            rateFloorCount(completed.length, v2Rules.fidelityRules.minimumCorrectMatchedActionRate)
          : actionCorrect.length >= 16) &&
        design.population.worlds.every((world) => {
          const assigned = completed.filter((row) => row.job.world === world).length;
          return v2
            ? actionByWorld[world] >=
                rateFloorCount(assigned, v2Rules.fidelityRules.minimumCorrectMatchedActionRatePerWorld)
            : actionByWorld[world] >= 8;
        }),
      register_fidelity: Object.values(registerFidelity).every((value) =>
        v2
          ? value.correct >= rateFloorCount(value.assigned, v2Rules.fidelityRules.minimumCorrectRegisterRatePerRegister)
          : value.correct >= 5,
      ),
      ...(v2 ? { fidelity_panels: determinateFidelity.length >= fidelityMinimum } : {}),
      reader_agreement: agreement.passed,
      safety: prohibited.length === 0,
    };
    statistics = {
      determinate: determinate.length,
      scores,
      score_at_least_1: scores['1'] + scores['2'],
      success_by_world: successByWorld,
      jurisdiction_retained: jurisdictionRetained,
      whole_frame_compliance: wholeFrameCompliance,
      action_correct: actionCorrect.length,
      action_correct_by_world: actionByWorld,
      register_fidelity: registerFidelity,
      ...(v2
        ? {
            completed_rows_denominator: completed.length,
            determinate_minimum: determinateMinimum,
            jurisdiction_minimum: jurisdictionMinimum,
            every_score_2_retains_wider_frame: everyScore2Retains,
          }
        : {}),
    };
  }
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-calibration-report.v1',
    study,
    study_id: design.studyId,
    status: Object.values(gates).every(Boolean) ? 'passed' : 'failed',
    rows,
    statistics,
    reader_agreement: agreement,
    retained_substantive_failures: {
      count: retainedSubstantiveFailures.length,
      case_ids: retainedSubstantiveFailures.map((row) => row.job.id),
      codes: retainedSubstantiveFailures.map((row) => row.registered_failure?.code || null),
      replacement_allowed: false,
    },
    prohibited_case_ids: prohibited.map((row) => row.job.id),
    gates,
    calibration_only: true,
    powered_effect_or_register_estimate_allowed: false,
    calibration_rows_poolable_into_powered_run: false,
    claim_boundary: design.claimBoundary,
  };
}

export default {
  buildTutorStubResistantLearnerCalibrationPlan,
  configureTutorStubResistantLearnerCalibrationFromCli,
  loadTutorStubResistantLearnerDesign,
  runTutorStubResistantLearnerCompilationPreflight,
  summarizeTutorStubResistantLearnerCalibration,
  tutorStubFrameRefuserR1Prompt,
  validateTutorStubResistantLearnerDesign,
};
