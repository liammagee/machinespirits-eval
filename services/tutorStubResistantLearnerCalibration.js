import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { configureTutorStubBoredomProofDagExecution } from './tutorStubBoredomActionRegisterProofDagStudy.js';
import {
  applyTutorStubResistanceActionRegisterSafetyOverride,
  compileTutorStubResistanceActionRegisterStudyAssignment,
  createTutorStubResistanceActionRegisterStudyRuntime,
  loadTutorStubResistanceActionRegisterRegistration,
  tutorStubResistanceHostActionFamily,
} from './tutorStubResistanceActionRegisterStudy.js';
import { loadWorld } from './dramaticDerivation/world.js';
import { compileTutorStubTurnProgressionContract } from './tutorStubTurnProgressionContract.js';

const DESIGN_SCHEMA = 'machinespirits.tutor-stub.resistant-learner-study-design.v1';
const B1_ID = 'resistant-learner-b1-authored-pickup';
const R1_ID = 'resistant-learner-r1-graded-engagement';
const BOREDOM_TEMPLATE = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v8.json';
const REFUSER_TEMPLATE = 'config/tutor-stub-resistance-action-register-crossed-registration.v9.json';
const JUDGES = Object.freeze(['codex.gpt-5.6-sol', 'claude-code.sonnet-5', 'codex.gpt-5.5']);
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
  if (design?.schema !== DESIGN_SCHEMA || ![B1_ID, R1_ID].includes(studyId)) {
    issues.push('design identity is unsupported');
  }
  if (design?.status !== 'prospective_zero_call_design_pending_gate_1_go') {
    issues.push('design status drifted');
  }
  if (design?.callAuthority?.grantsModelCalls !== false) issues.push('design must not grant model calls');
  if (design?.calibration?.dialogues !== 18) issues.push('calibration must contain 18 dialogues');
  if (!Number.isInteger(design?.randomization?.masterSeed)) issues.push('randomization master seed is missing');
  if (!exactValues(design?.measurement?.readerPanel?.judges, JUDGES)) issues.push('reader panel drifted');
  if (
    design?.models?.tutor !== 'codex.gpt-5.6-luna' ||
    design?.models?.analysis !== 'codex.gpt-5.6-luna' ||
    design?.models?.learner !== 'codex.gpt-5.6-luna' ||
    design?.models?.cliEffort !== 'low'
  ) {
    issues.push('generator model route drifted');
  }
  const calls = Object.values(design?.attemptCeilings?.callPlanPerDialogue || {}).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
  const planned = Number(design?.attemptCeilings?.plannedCallsPerDialogue);
  const perDialogue = Number(design?.attemptCeilings?.maximumReservationsPerDialogue);
  const perCall = Number(design?.attemptCeilings?.maximumReservationsPerPlannedCall);
  if (
    calls !== planned ||
    perCall !== 3 ||
    perDialogue !== planned * perCall ||
    Number(design?.attemptCeilings?.calibrationMaximumReservations) !== perDialogue * 18
  ) {
    issues.push('attempt ceiling arithmetic drifted');
  }
  if (studyId === B1_ID) {
    const actions = design?.factors?.action?.levels || [];
    if (
      design?.revision !== 2 ||
      design?.supersedes?.priorDesignSha256 !==
        'f007fb9ad6be419035a07f2ef8409a233f0b994ae2bf62e827d5c7770945c157' ||
      design?.supersedes?.priorDisposition !== 'void_technical_failure_no_calibration_unit_completed' ||
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
      design?.randomization?.masterSeed !== 2026082301
    ) {
      issues.push('B1 population, factors, horizon, or seed drifted');
    }
  }
  if (studyId === R1_ID) {
    if (
      design?.personaContract?.id !== 'frame_refuser-r1-v1' ||
      !exactValues(design?.population?.worlds, ['world_005_marrick', 'world_030_rowan_flat']) ||
      !exactValues(
        design?.register?.levels?.map((row) => row.id),
        REGISTERS,
      ) ||
      design?.register?.runtimeMapping?.edged !== 'ironic' ||
      design?.intervention?.action !== 'test_bounded_distinction' ||
      design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 6 ||
      design?.randomization?.masterSeed !== 2026082302
    ) {
      issues.push('R1 persona, worlds, intervention, horizon, or seed drifted');
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
  };
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
      profile: 'frame_refuser-r1-v1',
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
  const worldRegistry = auditRuntimeWorldRegistry(loaded.design.population.worlds, root);
  const selectedJobs = b1
    ? REGISTERS.flatMap((register) =>
        Object.keys(B1_ACTION_LEVEL).map((action) =>
          plan.jobs.find((job) => job.register === register && job.action === action),
        ),
      )
    : loaded.design.population.worlds.flatMap((world) =>
        REGISTERS.map((register) => plan.jobs.find((job) => job.world === world && job.register === register)),
      );
  const personaPrompt = b1 ? null : tutorStubFrameRefuserR1Prompt(loaded.design);
  const personaLines = b1
    ? []
    : [
        ...loaded.design.personaContract.voice,
        ...loaded.design.personaContract.initialState,
        ...loaded.design.personaContract.afterBoundedLocalTest,
        loaded.design.personaContract.epistemicFreedom,
        ...loaded.design.personaContract.publicTurnRules,
      ];
  const rows = [];
  for (const job of selectedJobs) {
    for (const scene of ['bare', 'due_clue']) {
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
        issues.push('non_compliance_wording_missing');
      }
      if (!safety.passed) issues.push('protected_affect_guard_failed');
      if (!b1 && !personaLines.every((line) => personaPrompt.includes(line))) {
        issues.push('persona_prompt_line_missing');
      }
      rows.push({
        study: b1 ? 'B1' : 'R1',
        world: job.world,
        action: job.action,
        assigned_register: job.register,
        scene,
        compiled,
        question_allowed: progression.handoff_contract.question_allowed,
        safety,
        persona_prompt_sha256: personaPrompt ? sha256(personaPrompt) : null,
        issues,
        passed: issues.length === 0,
      });
    }
  }
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-compilation-preflight.v1',
    study: b1 ? 'B1' : 'R1',
    status: worldRegistry.passed && rows.every((row) => row.passed) ? 'passed_zero_call' : 'failed',
    expected_rows: 12,
    world_registry: worldRegistry,
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
  const definitions =
    study === 'B1'
      ? {
          primary: ['learner_authored_thread_pickup_within_five_turns'],
          fidelity: [
            'delivered_action_family',
            'delivered_question_contrast',
            'delivered_register',
            'prohibited_delivery',
          ],
        }
      : {
          primary: [
            'final_graded_frame_engagement_at_six_turns',
            'final_jurisdictional_dispute_retained',
            'whole_frame_compliance',
          ],
          fidelity: ['delivered_test_bounded_distinction', 'delivered_register', 'prohibited_delivery'],
        };
  const readerIds = ['reader_a', 'reader_b', 'reader_c'];
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
  const passed =
    Object.values(seatEligibility).every((seat) => seat.primary >= 16 && seat.fidelity >= 16) &&
    pairs.every(
      (pair) =>
        pair.jointly_eligible >= rules.minimumJointlyEligibleCasesPerSeatPairAndField &&
        pair.conditional_exact_agreement >= rules.minimumConditionalExactAgreementPerSeatPairAndField,
    );
  return { seat_eligibility: seatEligibility, pairs, passed };
}

function countBy(rows, key, values) {
  return Object.fromEntries(values.map((value) => [value, rows.filter((row) => row?.job?.[key] === value).length]));
}

export function summarizeTutorStubResistantLearnerCalibration({ rows, design }) {
  const study = design.studyId === B1_ID ? 'B1' : 'R1';
  const completed = rows.filter((row) => row.status === 'complete');
  const agreement = agreementSummary(completed, design);
  const prohibited = completed.filter((row) => panelField(row, 'fidelity', 'prohibited_delivery')?.value === 'yes');
  let statistics;
  let gates;
  if (study === 'B1') {
    const outcomeField = 'learner_authored_thread_pickup_within_five_turns';
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
    gates = {
      execution_complete: completed.length === 18,
      channel_alive: determinate.length >= 16 && yes.length >= 3 && no.length >= 3,
      action_and_question_fidelity: Object.values(actionFidelity).every((value) => value.correct >= 8),
      register_fidelity: Object.values(registerFidelity).every((value) => value.correct >= 5),
      reader_agreement: agreement.passed,
      safety: prohibited.length === 0,
    };
    statistics = {
      determinate: determinate.length,
      pickup_yes: yes.length,
      pickup_no: no.length,
      action_fidelity: actionFidelity,
      register_fidelity: registerFidelity,
    };
  } else {
    const outcomeField = 'final_graded_frame_engagement_at_six_turns';
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
    gates = {
      execution_complete: completed.length === 18,
      channel_alive:
        determinate.length >= 16 &&
        scores['0'] >= 2 &&
        scores['1'] >= 2 &&
        scores['2'] >= 2 &&
        Object.values(successByWorld).every((count) => count >= 1),
      persona_fidelity: jurisdictionRetained >= 16 && wholeFrameCompliance === 0,
      action_fidelity:
        actionCorrect.length >= 16 && design.population.worlds.every((world) => actionByWorld[world] >= 8),
      register_fidelity: Object.values(registerFidelity).every((value) => value.correct >= 5),
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
