import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import {
  buildTutorStubResistantLearnerCalibrationPlan,
  configureTutorStubResistantLearnerCalibrationFromCli,
  loadTutorStubResistantLearnerDesign,
  runTutorStubResistantLearnerCompilationPreflight,
  summarizeTutorStubResistantLearnerCalibration,
  tutorStubFrameRefuserR1Prompt,
  tutorStubResistantLearnerRuntimeModelRoutes,
  validateTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  createTutorStubResistantLearnerSemanticRuntime,
  tutorStubResistantLearnerSemanticFieldConsensus,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import { applyTutorStubResistanceActionRegisterStudyIntervention } from '../services/tutorStubResistanceActionRegisterStudy.js';
import { TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V4 } from '../services/tutorStubResistanceSemanticAdjudicationV4.js';
import {
  applyTutorStubResistantLearnerCalibrationSemanticPanel,
  createLazyTutorStubResistanceSemanticAdjudicator,
  loadTutorStubResistanceSemanticRegistration,
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4,
} from '../services/tutorStubResistanceSemanticRuntime.js';
import {
  tutorStubResistantLearnerCalibrationHaltReason,
  tutorStubResistantLearnerGoNoteBindingIssues,
} from '../scripts/run-tutor-stub-resistant-learner-calibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B1_PATH = 'config/tutor-stub-resistant-learner-b1-design.v1.json';
const R1_PATH = 'config/tutor-stub-resistant-learner-r1-design.v1.json';

function load(relativePath) {
  return loadTutorStubResistantLearnerDesign({ designPath: relativePath, root: ROOT });
}

function baseArgs(loaded, job) {
  return {
    'model-call-budget': String(loaded.design.attemptCeilings.maximumReservationsPerDialogue),
    model: 'codex.gpt-5.6-luna',
    'classifier-model': 'codex.gpt-5.6-luna',
    'learner-record-model': 'codex.gpt-5.6-luna',
    'auto-learner-model': 'codex.gpt-5.6-luna',
    'cli-effort': 'low',
    world: job.world,
    'run-seed': String(job.run_seed),
    'eval-repeat': String(job.assignment_index),
    'eval-job-id': job.id,
    'acknowledge-research-use': true,
    'dag-mode': 'strict_dag',
    'register-policy': 'field',
    'register-palette': 'warm,plain,ironic,sarcastic',
  };
}

function configuredState() {
  return {
    trace: [],
    turns: [],
    history: [],
    register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
    world: {},
  };
}

function boredClassification({ protectedAffect = false } = {}) {
  return {
    turn: {
      request_type: protectedAffect ? 'vulnerability_or_moral_exposure' : 'off_task_or_mixed',
      discourse_move: 'off_task',
      evidence_use: 'none',
      epistemic_stance: 'resistant',
      agency: 'complying',
    },
  };
}

function semanticPanel(values) {
  const fields = Object.fromEntries(
    Object.entries(values).map(([field, value]) => [field, { status: 'determinate', value }]),
  );
  const seats = ['reader_a', 'reader_b'].map((judge_id) => ({
    judge_id,
    validation: {
      fields: Object.fromEntries(Object.entries(values).map(([field, value]) => [field, { eligible: true, value }])),
    },
  }));
  return { status: 'determinate', fields, seats };
}

test('registered B1 and R1 calibration plans are deterministic and exactly balanced', () => {
  const b1Design = load(B1_PATH).design;
  assert.deepEqual(b1Design.population.worlds, [
    'world_022_foxtrot_jukebox',
    'world_026_skyway_bakery',
    'world_028_larkspur_fridge',
    'world_029_riverside_clinic',
    'world_030_rowan_flat',
    'world_031_tideway_makerspace',
  ]);
  const b1 = buildTutorStubResistantLearnerCalibrationPlan(b1Design);
  const b1Again = buildTutorStubResistantLearnerCalibrationPlan(b1Design);
  assert.deepEqual(b1, b1Again);
  assert.equal(b1.jobs.length, 18);
  assert.deepEqual(
    Object.fromEntries(
      ['ask_discriminating_question', 'stage_public_evidence_for_next_step'].map((action) => [
        action,
        b1.jobs.filter((job) => job.action === action).length,
      ]),
    ),
    { ask_discriminating_question: 9, stage_public_evidence_for_next_step: 9 },
  );
  for (const register of ['warm', 'plain', 'edged']) {
    const block = b1.jobs.filter((job) => job.register === register);
    assert.equal(block.length, 6);
    assert.equal(block.filter((job) => job.action === 'ask_discriminating_question').length, 3);
    assert.equal(block.filter((job) => job.action === 'stage_public_evidence_for_next_step').length, 3);
  }
  for (const world of load(B1_PATH).design.population.worlds) {
    assert.equal(b1.jobs.filter((job) => job.world === world).length, 3);
  }

  const r1 = buildTutorStubResistantLearnerCalibrationPlan(load(R1_PATH).design);
  assert.equal(r1.jobs.length, 18);
  for (const world of load(R1_PATH).design.population.worlds) {
    assert.equal(r1.jobs.filter((job) => job.world === world).length, 9);
    for (const register of ['warm', 'plain', 'edged']) {
      assert.equal(r1.jobs.filter((job) => job.world === world && job.register === register).length, 3);
    }
  }
});

test('designs declare every runtime model route and reject Luna-only or reader-route drift', () => {
  const b1 = load(B1_PATH).design;
  const r1 = load(R1_PATH).design;
  for (const design of [b1, r1]) {
    assert.deepEqual(design.models, tutorStubResistantLearnerRuntimeModelRoutes(design));
    assert.deepEqual(
      design.models.finalSemanticReaders.map((judge) => judge.modelRef),
      ['codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
    );
    assert.equal(
      design.measurement.readerPanel.fieldConsensus,
      'both valid medium/high-confidence votes agree, else measurement_indeterminate',
    );
    assert.equal(design.measurement.readerPanel.judgeCException, undefined);
  }
  assert.deepEqual(
    b1.models.triggerObservation.judges.map((judge) => judge.modelRef),
    ['codex.gpt-5.6-sol'],
  );
  assert.deepEqual(
    r1.models.triggerObservation.judges.map((judge) => judge.modelRef),
    ['codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
  );
  assert.deepEqual(
    [b1, r1].map((design) => design.attemptCeilings.plannedCallsPerDialogue),
    [41, 44],
  );
  assert.equal(
    [b1, r1].reduce((sum, design) => sum + design.attemptCeilings.calibrationMaximumReservations, 0),
    4806,
  );

  const lunaOnly = structuredClone(b1);
  delete lunaOnly.models.triggerObservation;
  delete lunaOnly.models.finalSemanticReaders;
  assert.ok(validateTutorStubResistantLearnerDesign(lunaOnly).issues.includes('model route closure drifted'));

  const changedReader = structuredClone(r1);
  changedReader.models.finalSemanticReaders[1].modelRef = 'codex.gpt-5.6-luna';
  assert.ok(validateTutorStubResistantLearnerDesign(changedReader).issues.includes('model route closure drifted'));
});

test('R1 trigger composition applies the scoped two-seat override without mutating frozen v4', async () => {
  const design = load(R1_PATH).design;
  const base = loadTutorStubResistanceSemanticRegistration(TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4);
  assert.equal(base.registration.measurement.judges.length, 3);
  const runtimeState = {
    resistant_learner_calibration: true,
    resistant_learner_study: 'R1',
    design,
  };
  const scoped = applyTutorStubResistantLearnerCalibrationSemanticPanel(base, runtimeState);
  assert.deepEqual(
    scoped.runtimePanelOverride.judges.map((judge) => judge.modelRef),
    ['codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
  );
  assert.equal(scoped.runtimePanelOverride.panelSize, 2);
  assert.equal(scoped.registration.measurement.judges.length, 3);
  assert.equal(base.registration.measurement.judges.length, 3);

  let observedBinding = null;
  const adjudicate = createLazyTutorStubResistanceSemanticAdjudicator(
    {},
    {
      observationSemantics: TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V4,
      loadRegistration: () => base,
      createRuntime({ registrationBinding }) {
        observedBinding = registrationBinding;
        return {
          async adjudicateCandidate() {
            return { status: 'synthetic_zero_call' };
          },
        };
      },
    },
  );
  const result = await adjudicate({ state: { resistanceActionRegisterStudy: runtimeState } });
  assert.equal(result.status, 'synthetic_zero_call');
  assert.deepEqual(
    observedBinding.runtimePanelOverride.judges.map((judge) => judge.modelRef),
    ['codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
  );
});

test('two-seat final fields require Sol-Sonnet agreement', () => {
  assert.equal(tutorStubResistantLearnerSemanticFieldConsensus(['yes', 'yes']).winner, 'yes');
  assert.equal(tutorStubResistantLearnerSemanticFieldConsensus(['yes', 'no']).winner, null);
  assert.equal(tutorStubResistantLearnerSemanticFieldConsensus(['yes']).winner, null);
});

test('R1 injects every persona contract instruction verbatim and no outcome target', () => {
  const design = load(R1_PATH).design;
  const prompt = tutorStubFrameRefuserR1Prompt(design);
  for (const value of [
    ...design.personaContract.voice,
    ...design.personaContract.initialState,
    ...design.personaContract.afterBoundedLocalTest,
    design.personaContract.epistemicFreedom,
    ...design.personaContract.publicTurnRules,
  ]) {
    assert.ok(prompt.includes(value), `missing persona line: ${value}`);
  }
  assert.match(prompt, /simulating this automated learner profile: frame_refuser/u);
  assert.doesNotMatch(prompt, /0\.25|score at least|powered success|wilson|jeffreys/iu);
});

test('CLI configuration resolves edged B1 and R1 jobs through the live study adapters without calls', () => {
  for (const [relativePath, profileId, observation] of [
    [B1_PATH, 'bored', 'prospective_v9'],
    [R1_PATH, 'frame_refuser', 'prospective_frame_resistance_semantic_v4'],
  ]) {
    const loaded = load(relativePath);
    const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
    const job = plan.jobs.find((candidate) => candidate.register === 'edged');
    const state = configuredState();
    const args = {
      ...baseArgs(loaded, job),
      'resistant-learner-calibration-design': relativePath,
      'resistant-learner-calibration-job': job.id,
    };
    const configured = configureTutorStubResistantLearnerCalibrationFromCli({
      args,
      state,
      root: ROOT,
      autoLearnerEnabled: true,
      autoLearnerProfileId: profileId,
      autoTurns: job.maximum_trigger_turn + job.outcome_horizon_learner_turns,
      appendTraceEvent(target, event) {
        target.push(event);
      },
      observationSemantics: observation,
    });
    assert.equal(configured.job.id, job.id);
    assert.equal(state.resistanceActionRegisterStudy.realization, 'edged');
    assert.deepEqual(state.resistanceActionRegisterStudy.registration.design.factors.realization.levels, [
      'warm',
      'plain',
      'edged',
    ]);
  }
});

test('B1 edged assignments compile through the actual move mapping and suppress to plain under protected affect', () => {
  const loaded = load(B1_PATH);
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  for (const action of ['ask_discriminating_question', 'stage_public_evidence_for_next_step']) {
    const job = plan.jobs.find((candidate) => candidate.register === 'edged' && candidate.action === action);
    const configure = ({ protectedAffect = false } = {}) => {
      const state = configuredState();
      configureTutorStubResistantLearnerCalibrationFromCli({
        args: {
          ...baseArgs(loaded, job),
          'resistant-learner-calibration-design': B1_PATH,
          'resistant-learner-calibration-job': job.id,
        },
        state,
        root: ROOT,
        autoLearnerEnabled: true,
        autoLearnerProfileId: 'bored',
        autoTurns: 9,
        appendTraceEvent(target, event) {
          target.push(event);
        },
        observationSemantics: 'prospective_v9',
      });
      return applyTutorStubResistanceActionRegisterStudyIntervention({
        selection: { response_configuration: {}, selected_register: 'plain' },
        state,
        learnerText: protectedAffect
          ? 'I am ashamed and overwhelmed, and I have stopped following this.'
          : 'This is tedious; I stopped following the evidence.',
        classification: boredClassification({ protectedAffect }),
        tutorLearnerDag: { model: { turn: 2 } },
        semanticAdjudication: { measurement_disposition: 'actionable_boredom' },
      });
    };
    const applied = configure();
    assert.equal(
      applied.resistance_action_register_intervention.assignment.register,
      action.startsWith('ask_') ? 'sarcastic' : 'ironic',
    );
    assert.match(
      applied.response_configuration.study_realization_contrast_instruction,
      /work-directed irony|dry challenge/u,
    );
    const suppressed = configure({ protectedAffect: true });
    assert.equal(suppressed.selected_register, 'plain');
    assert.equal(suppressed.resistance_action_register_intervention.status, 'safety_override_nonadherent');
    assert.equal(suppressed.resistance_action_register_intervention.safety_override.reason, 'protected_affect');
  }
});

test('zero-call compilation preflight covers the registered action, register, world, and scene cross-products', () => {
  const b1 = runTutorStubResistantLearnerCompilationPreflight({ loaded: load(B1_PATH), root: ROOT });
  assert.equal(b1.status, 'passed_zero_call');
  assert.equal(b1.world_registry.passed, true);
  assert.deepEqual(b1.world_registry.missing_or_nonproduction_worlds, []);
  assert.equal(b1.world_registry.checked_worlds.length, 6);
  assert.equal(b1.model_route.passed, true);
  assert.deepEqual(b1.model_route.runtime, b1.model_route.declared);
  assert.equal(b1.rows.length, 12);
  assert.equal(b1.rows.filter((row) => row.assigned_register === 'edged').length, 4);
  assert.ok(
    b1.rows
      .filter((row) => row.action === 'stage_public_evidence_for_next_step')
      .every((row) => row.question_allowed === false),
  );
  assert.ok(
    b1.rows.filter((row) => row.action === 'ask_discriminating_question').every((row) => row.question_allowed === true),
  );

  const r1 = runTutorStubResistantLearnerCompilationPreflight({ loaded: load(R1_PATH), root: ROOT });
  assert.equal(r1.status, 'passed_zero_call');
  assert.equal(r1.world_registry.passed, true);
  assert.equal(r1.model_route.passed, true);
  assert.deepEqual(r1.model_route.runtime, r1.model_route.declared);
  assert.equal(r1.rows.length, 12);
  assert.equal(new Set(r1.rows.map((row) => row.world)).size, 2);
  assert.equal(new Set(r1.rows.map((row) => row.assigned_register)).size, 3);
  assert.ok(r1.rows.filter((row) => row.assigned_register === 'edged').every((row) => row.safety.passed));
  assert.ok(r1.rows.every((row) => row.persona_prompt_sha256));
});

test('the independent B1 semantic panel votes from public quotes and keeps fidelity separate', async () => {
  const design = load(B1_PATH).design;
  const trace = [];
  let calls = 0;
  const runtime = createTutorStubResistantLearnerSemanticRuntime({
    appendTraceEvent(target, event) {
      target.push(event);
    },
    resolveModel(modelRef) {
      return {
        provider: modelRef.startsWith('claude-code.') ? 'claude-code' : 'codex',
        model: modelRef === 'claude-code.sonnet-5' ? 'claude-sonnet-5' : modelRef.slice('codex.'.length),
      };
    },
    async callPromptModel({ prompt, resolved }) {
      calls += 1;
      const packet = JSON.parse(prompt);
      const sourceId = packet.instrument === 'primary' ? 'post_1' : 'intervention';
      const quote = packet.public_packet[sourceId];
      const values =
        packet.instrument === 'primary'
          ? { learner_authored_thread_pickup_within_five_turns: 'yes' }
          : {
              delivered_action_family: 'ask_discriminating_question',
              delivered_question_contrast: 'requires_question',
              delivered_register: 'warm',
              prohibited_delivery: 'no',
            };
      return {
        text: JSON.stringify({
          schema: packet.output_schema.properties.schema.enum[0],
          case_id: packet.case_id,
          judgment: Object.fromEntries(
            Object.entries(values).map(([field, value]) => [
              field,
              {
                value,
                evidence_quotes: [{ source_id: sourceId, text: quote }],
                confidence: 'high',
                indeterminacy_reason: 'none',
              },
            ]),
          ),
        }),
        ...resolved,
        effort: 'low',
        structuredOutput: true,
        prohibitedToolEventCountObserved: true,
        prohibitedToolEventCount: 0,
      };
    },
  });
  const state = {
    trace,
    resistanceActionRegisterStudy: {
      resistant_learner_calibration: true,
      resistant_learner_study: 'B1',
      design,
      job_id: 'B1-semantic-test',
      trigger_turn: 2,
      outcome_horizon_learner_turns: 5,
    },
    turns: [
      {
        turn: 2,
        learner: 'This has become tedious.',
        tutor: 'The two public entries differ. Which one bears on timing?',
      },
      { turn: 3, learner: 'The later entry supports the shorter interval.', tutor: 'Keep that interval in view.' },
      { turn: 4, learner: 'It rules out the week-long gap.', tutor: 'The public clock is still available.' },
      { turn: 5, learner: 'The route remains open.', tutor: 'Stay with that public route.' },
      { turn: 6, learner: 'The second mark fits it.', tutor: 'One public limit remains.' },
    ],
  };
  const result = await runtime.adjudicateFinalHorizon({
    state,
    turnNumber: 7,
    learnerText: 'The clue leaves the source open but fixes the interval.',
  });
  assert.equal(calls, 4);
  assert.equal(result.primary.fields.learner_authored_thread_pickup_within_five_turns.value, 'yes');
  assert.equal(result.fidelity.fields.delivered_action_family.value, 'ask_discriminating_question');
  assert.equal(result.measurement_disposition, 'determinate');
  assert.equal(trace.filter((event) => event.type === 'resistant_learner_semantic_reader_result').length, 4);
});

test('a malformed semantic envelope makes every reader field ineligible', async () => {
  const design = load(B1_PATH).design;
  const runtime = createTutorStubResistantLearnerSemanticRuntime({
    appendTraceEvent() {},
    resolveModel(modelRef) {
      if (modelRef === 'claude-code.sonnet-5') return { provider: 'claude-code', model: 'claude-sonnet-5' };
      return { provider: 'codex', model: modelRef.slice('codex.'.length) };
    },
    async callPromptModel({ prompt, resolved }) {
      const packet = JSON.parse(prompt);
      const sourceId = packet.instrument === 'primary' ? 'post_1' : 'intervention';
      const valueFor = (field) =>
        ({
          learner_authored_thread_pickup_within_five_turns: 'yes',
          delivered_action_family: 'ask_discriminating_question',
          delivered_question_contrast: 'requires_question',
          delivered_register: 'warm',
          prohibited_delivery: 'no',
        })[field];
      return {
        text: JSON.stringify({
          schema: packet.output_schema.properties.schema.enum[0],
          case_id: packet.case_id,
          judgment: Object.fromEntries(
            packet.output_schema.properties.judgment.required.map((field) => [
              field,
              {
                value: valueFor(field),
                evidence_quotes: [{ source_id: sourceId, text: packet.public_packet[sourceId] }],
                confidence: 'high',
                indeterminacy_reason: 'none',
              },
            ]),
          ),
          extra_top_level_key: true,
        }),
        ...resolved,
        effort: 'low',
        structuredOutput: true,
        prohibitedToolEventCountObserved: true,
        prohibitedToolEventCount: 0,
      };
    },
  });
  const state = {
    trace: [],
    resistanceActionRegisterStudy: {
      resistant_learner_calibration: true,
      resistant_learner_study: 'B1',
      design,
      job_id: 'bad-envelope',
      trigger_turn: 1,
      outcome_horizon_learner_turns: 5,
    },
    turns: [1, 2, 3, 4, 5].map((turn) => ({ turn, learner: `learner ${turn}`, tutor: `tutor ${turn}` })),
  };
  const result = await runtime.adjudicateFinalHorizon({ state, turnNumber: 6, learnerText: 'final learner' });
  assert.equal(result.measurement_disposition, 'measurement_indeterminate');
  assert.deepEqual(result.primary.fields.learner_authored_thread_pickup_within_five_turns.eligible_judges, []);
  assert.ok(result.primary.seats.every((seat) => seat.validation.valid === false));
});

test('R1 releases legacy adherence after the registered intervention without a repair call', async () => {
  let analysisCalls = 0;
  const trace = [];
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent(target, event) {
      target.push(event);
    },
    adjudicateResistanceSemanticCandidate() {
      throw new Error('post-trigger R1 must not invoke the legacy semantic adherence panel');
    },
    callPromptModel() {
      throw new Error('post-trigger R1 must not redraft the learner');
    },
    classificationFromCombinedAnalysis: (raw) => raw.classification,
    env: { TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: 'prospective_frame_resistance_semantic_v4' },
    async extractCombinedLearnerAnalysis() {
      analysisCalls += 1;
      return { classification: { turn: {} }, dagPreflight: { public: true } };
    },
    learnerProfileContract: () => ({
      intent: { failureOperator: 'jurisdictional refusal' },
      observabilityContract: { eligiblePolicies: ['*'], eligibility: 'always', mustShowByTurn: 1, minEligibleRate: 1 },
    }),
    learnerProfileIds: () => ['frame_refuser'],
    learnerProfilePrompt: () => 'frame_refuser prompt',
    negativeFloorRegisters: [],
  });
  const state = {
    trace,
    turns: [],
    history: [],
    register: { policy: 'field' },
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    world: {},
    resistanceActionRegisterStudy: {
      resistant_learner_calibration: true,
      resistant_learner_study: 'R1',
      consumed: true,
    },
  };
  const result = await runtime.enforceAutomatedLearnerProfile({
    state,
    resolved: {},
    profile: 'frame_refuser',
    turnNumber: 8,
    generated: { text: 'The local timing distinction holds, but your wider frame still does not.' },
    precomputeFinalLearnerAnalysis: true,
  });
  assert.equal(result.repaired, false);
  assert.equal(result.passed, null);
  assert.equal(analysisCalls, 1);
  assert.equal(trace.at(-1).type, 'auto_learner_profile_adherence_released_after_registered_intervention');
});

test('calibration summaries enforce the registered channel, fidelity, persona, and agreement gates', () => {
  const b1Design = load(B1_PATH).design;
  const b1Plan = buildTutorStubResistantLearnerCalibrationPlan(b1Design);
  const b1Rows = b1Plan.jobs.map((job, index) => ({
    job,
    status: 'complete',
    outcome: {
      primary: semanticPanel({ learner_authored_thread_pickup_within_five_turns: index < 9 ? 'yes' : 'no' }),
      fidelity: semanticPanel({
        delivered_action_family: job.action,
        delivered_question_contrast:
          job.action === 'ask_discriminating_question' ? 'requires_question' : 'forbids_question',
        delivered_register: job.register,
        prohibited_delivery: 'no',
      }),
    },
  }));
  assert.equal(summarizeTutorStubResistantLearnerCalibration({ rows: b1Rows, design: b1Design }).status, 'passed');

  const r1Design = load(R1_PATH).design;
  const r1Plan = buildTutorStubResistantLearnerCalibrationPlan(r1Design);
  const r1Rows = r1Plan.jobs.map((job, index) => ({
    job,
    status: 'complete',
    outcome: {
      primary: semanticPanel({
        final_graded_frame_engagement_at_six_turns: String(index % 3),
        final_jurisdictional_dispute_retained: 'yes',
        whole_frame_compliance: 'no',
      }),
      fidelity: semanticPanel({
        delivered_test_bounded_distinction: 'yes',
        delivered_register: job.register,
        prohibited_delivery: 'no',
      }),
    },
  }));
  assert.equal(summarizeTutorStubResistantLearnerCalibration({ rows: r1Rows, design: r1Design }).status, 'passed');
});

test('combined launcher dry-run binds both calibrations and executes zero model calls', () => {
  const output = execFileSync(
    process.execPath,
    [
      'scripts/run-tutor-stub-resistant-learner-calibration.js',
      '--b1-design',
      B1_PATH,
      '--r1-design',
      R1_PATH,
      '--dry-run',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const report = JSON.parse(output);
  assert.equal(report.status, 'passed_zero_call');
  assert.equal(report.jobs, 36);
  assert.equal(report.planned_role_calls, 1530);
  assert.equal(report.hard_attempt_ceiling, 4806);
  assert.equal(report.model_calls_executed, 0);
  assert.deepEqual(
    report.studies.map((study) => study.jobs),
    [18, 18],
  );
  assert.ok(report.studies.every((study) => study.compilation_preflight.status === 'passed_zero_call'));
  assert.ok(report.studies.every((study) => study.compilation_preflight.model_route.passed === true));
});

test('GO binding fails closed unless every model route and the create-once destination are explicit', () => {
  const binding = {
    launchCommit: 'a'.repeat(40),
    designPaths: [B1_PATH, R1_PATH],
    spendCap: 4806,
    modelRefs: ['codex.gpt-5.6-luna', 'codex.gpt-5.6-sol', 'claude-code.sonnet-5'],
    destination: '/private/artifacts/resistant-learner-gate1-route-corrected',
  };
  const complete = [
    'GO',
    'corrected calibration',
    binding.launchCommit,
    ...binding.designPaths,
    ...binding.modelRefs,
    String(binding.spendCap),
    binding.destination,
    'frame_refuser-r1-v1',
  ].join('\n');
  assert.deepEqual(tutorStubResistantLearnerGoNoteBindingIssues({ text: complete, ...binding }), []);
  assert.deepEqual(
    tutorStubResistantLearnerGoNoteBindingIssues({
      text: complete.replace('claude-code.sonnet-5', 'omitted-reader'),
      ...binding,
    }),
    ['model_routes'],
  );
  assert.deepEqual(
    tutorStubResistantLearnerGoNoteBindingIssues({ text: complete.replace(binding.destination, 'other'), ...binding }),
    ['destination'],
  );
});

test('combined launcher halts on the first technical failure or prohibited delivery', () => {
  assert.equal(
    tutorStubResistantLearnerCalibrationHaltReason({ status: 'failed', job: { id: 'B1-failed' } }),
    'technical failure in B1-failed',
  );
  assert.equal(
    tutorStubResistantLearnerCalibrationHaltReason({
      status: 'complete',
      job: { id: 'R1-prohibited' },
      outcome: { fidelity: { fields: { prohibited_delivery: { value: 'yes' } } } },
    }),
    'confirmed prohibited delivery in R1-prohibited',
  );
  assert.equal(tutorStubResistantLearnerCalibrationHaltReason({ status: 'complete', job: { id: 'B1-clean' } }), null);
});
