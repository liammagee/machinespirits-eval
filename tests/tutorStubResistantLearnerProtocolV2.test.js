import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistantLearnerCalibrationPlan,
  configureTutorStubResistantLearnerCalibrationFromCli,
  loadTutorStubResistantLearnerDesign,
  runTutorStubResistantLearnerCompilationPreflight,
  summarizeTutorStubResistantLearnerCalibration,
} from '../services/tutorStubResistantLearnerCalibration.js';
import { applyTutorStubResistanceActionRegisterStudyIntervention } from '../services/tutorStubResistanceActionRegisterStudy.js';
import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import {
  buildTutorStubResistantLearnerProtocolV2Entries,
  buildTutorStubResistantLearnerTypedApproval,
  runTutorStubResistantLearnerProtocolV2Preflight,
} from '../services/tutorStubResistantLearnerLaunchProtocolV2.js';
import {
  buildTutorStubResistantLearnerSemanticPrompt,
  createTutorStubResistantLearnerSemanticRuntime,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import {
  buildTutorStubRivalLearnerDagTurnRecord,
  evaluateTutorStubRivalDagConcession,
  mintTutorStubRivalLearnerDag,
  tutorStubRivalDagTurnDirective,
  tutorStubRivalLearnerDagPrompt,
} from '../services/tutorStubRivalLearnerDag.js';
import { parseTutorStubRivalAttentionAdjudicationV3 } from '../services/tutorStubRivalAttentionSemanticAdjudicationV3.js';
import { TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3 } from '../services/tutorStubResistanceSemanticAdjudicationV3.js';
import {
  adjudicateTutorStubStandingRivalryJudgesV3,
  buildTutorStubStandingRivalryPromptV3,
  wrapTutorStubStandingRivalryModelOutputV3,
} from '../services/tutorStubStandingRivalrySemanticAdjudicationV3.js';
import {
  loadTutorStubResistanceSemanticRegistration,
  tutorStubResistanceSemanticLabelAdheres,
} from '../services/tutorStubResistanceSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B1_PATH = 'config/tutor-stub-resistant-learner-b1-design.v2.json';
const R1_PATH = 'config/tutor-stub-resistant-learner-r1-design.v2.json';
const B1_V3_PATH = 'config/tutor-stub-resistant-learner-b1-design.v3.json';
const R1_V3_PATH = 'config/tutor-stub-resistant-learner-r1-design.v3.json';

function load(relativePath) {
  return {
    ...loadTutorStubResistantLearnerDesign({ designPath: relativePath, root: ROOT }),
    relativePath,
  };
}

function semanticPanel(values) {
  return {
    status: 'determinate',
    fields: Object.fromEntries(
      Object.entries(values).map(([field, value]) => [field, { status: 'determinate', value }]),
    ),
    seats: ['reader_a', 'reader_b'].map((judge_id) => ({
      judge_id,
      validation: {
        fields: Object.fromEntries(Object.entries(values).map(([field, value]) => [field, { eligible: true, value }])),
      },
    })),
  };
}

function b1Outcome(job, index) {
  return {
    primary: semanticPanel({
      learner_authored_tutor_or_bridge_pickup_within_five_turns: index % 2 === 0 ? 'yes' : 'no',
      final_selective_attention_resistance_retained: 'yes',
    }),
    fidelity: semanticPanel({
      delivered_action_family: job.action,
      delivered_question_contrast:
        job.action === 'ask_discriminating_question' ? 'requires_question' : 'forbids_question',
      delivered_register: job.register,
      prohibited_delivery: 'no',
    }),
  };
}

test('v2 designs preserve the two reader seats, zero call authority, and combined 4,806 ceiling', () => {
  const designs = [load(B1_PATH).design, load(R1_PATH).design];
  for (const design of designs) {
    assert.equal(design.schema, 'machinespirits.tutor-stub.resistant-learner-study-design.v2');
    assert.equal(design.callAuthority.grantsModelCalls, false);
    assert.deepEqual(design.measurement.readerPanel.judges, ['codex.gpt-5.6-sol', 'claude-code.sonnet-5']);
    assert.equal(design.calibration.readerAgreementRules.eligibilityDenominator, 'completed_rows');
    assert.match(design.measurement.readerPanel.evidenceContract, /must be null when value is no/iu);
  }
  assert.equal(
    designs.reduce((sum, design) => sum + design.attemptCeilings.calibrationMaximumReservations, 0),
    4806,
  );
  assert.match(designs[1].claimBoundary, /elicitation rates under a persona that permits the scored responses/iu);
});

test('v3 re-registers only the B1 trigger and R1 turn gate while carrying the v2 endpoint contract forward', () => {
  const [b1, r1] = [load(B1_V3_PATH).design, load(R1_V3_PATH).design];
  for (const design of [b1, r1]) {
    assert.equal(design.schema, 'machinespirits.tutor-stub.resistant-learner-study-design.v3');
    assert.equal(design.callAuthority.grantsModelCalls, false);
    assert.equal(
      design.measurement.readerPanel.protocolSource,
      'config/tutor-stub-resistant-learner-semantic-registration.v2.json',
    );
    assert.deepEqual(design.measurement.readerPanel.judges, ['codex.gpt-5.6-sol', 'claude-code.sonnet-5']);
    assert.equal(design.calibration.readerAgreementRules.eligibilityDenominator, 'completed_rows');
  }
  assert.equal(
    b1.population.triggerRegistration,
    'config/tutor-stub-resistant-learner-b1-trigger-registration.v3.json',
  );
  assert.equal(b1.models.triggerObservation.semantics, 'prospective_rival_attention_semantic_v3');
  assert.equal(
    r1.population.triggerRegistration,
    'config/tutor-stub-resistant-learner-r1-turn-gate-registration.v3.json',
  );
  assert.equal(r1.models.triggerObservation.semantics, 'prospective_standing_rivalry_semantic_v3');
  assert.equal(
    b1.attemptCeilings.calibrationMaximumReservations + r1.attemptCeilings.calibrationMaximumReservations,
    4806,
  );
  assert.match(r1.claimBoundary, /elicitation rates under a persona that permits the scored responses/iu);
});

test('B1 v3 rival work triggers and a stock boredom loop does not', () => {
  const caseId = 'B1-v3-authored-fixture';
  const rivalWork = 'The invoice timing still leaves the weekend-delivery node open, so I am comparing those dates.';
  const fired = parseTutorStubRivalAttentionAdjudicationV3({
    raw: {
      schema: 'machinespirits.tutor-stub.rival-attention-judge-response.v3',
      case_id: caseId,
      objective_advanced: 'rival_objective',
      work_status: 'new_evidence_bearing_work',
      evidence_quote: 'comparing those dates',
      confidence: 'medium',
      reason: 'The learner advances a rival timing question.',
    },
    caseId,
    learnerText: rivalWork,
    observedRoute: { provider: 'codex', model: 'gpt-5.6-sol' },
  });
  assert.equal(fired.measurement_disposition, 'rival_attention_trigger');
  assert.equal(fired.trigger_fires, true);

  const stock = parseTutorStubRivalAttentionAdjudicationV3({
    raw: {
      schema: 'machinespirits.tutor-stub.rival-attention-judge-response.v3',
      case_id: caseId,
      objective_advanced: 'neither',
      work_status: 'stock_affect_only',
      evidence_quote: null,
      confidence: 'high',
      reason: 'This reports boredom without advancing any objective.',
    },
    caseId,
    learnerText: 'I am bored. This is pointless. I am still bored.',
    observedRoute: { provider: 'codex', model: 'gpt-5.6-sol' },
  });
  assert.equal(stock.measurement_disposition, 'no_rival_attention_trigger');
  assert.equal(stock.trigger_fires, false);

  const loaded = load(B1_V3_PATH);
  const job = buildTutorStubResistantLearnerCalibrationPlan(loaded.design).jobs[0];
  const configure = () => {
    const state = {
      trace: [],
      turns: [],
      history: [],
      register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
      world: {},
    };
    configureTutorStubResistantLearnerCalibrationFromCli({
      args: {
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
        'resistant-learner-calibration-design': B1_V3_PATH,
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
      observationSemantics: loaded.design.models.triggerObservation.semantics,
    });
    return state;
  };
  const selection = { response_configuration: {}, selected_register: 'plain' };
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state: configure(),
    learnerText: rivalWork,
    classification: { turn: { discourse_move: 'counterexample', evidence_use: 'cites_public_evidence' } },
    tutorLearnerDag: { model: { turn: 1 } },
    semanticAdjudication: fired,
  });
  assert.equal(applied.resistance_action_register_intervention.status, 'applied');
  const notAppliedState = configure();
  const notApplied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state: notAppliedState,
    learnerText: 'I am bored. This is pointless. I am still bored.',
    classification: { turn: { discourse_move: 'off_task', evidence_use: 'none' } },
    tutorLearnerDag: { model: { turn: 1 } },
    semanticAdjudication: stock,
  });
  assert.equal(notApplied, selection);
  assert.ok(
    notAppliedState.resistanceActionRegisterStudy.history.at(-1).reasons.includes('no_single_axis_public_warrant'),
  );
});

test('R1 v3 makes an agreeing medium-confidence pair determinate and enforces exact-substring evidence', () => {
  const binding = loadTutorStubResistanceSemanticRegistration(
    'config/tutor-stub-resistant-learner-r1-turn-gate-registration.v3.json',
  );
  const registration = binding.registration;
  const caseId = 'R1-v3-authored-fixture';
  const source =
    'Your answer frame still lacks standing; I will compare the public timing test while reserving that wider dispute.';
  const publicContext = [
    { role: 'assistant', text: 'We can test the public timing distinction without settling the wider frame.' },
  ];
  const vector = {
    jurisdiction_dispute: 'yes',
    interlocutor_standing_or_right: 'yes',
    inquiry_or_question_frame_governance: 'yes',
    test_or_criterion_governance: 'no',
    other_jurisdictional_governance: 'no',
    licensed_participation: 'yes',
    participation_withholding: 'yes',
    productive_counterframing: 'yes',
    final_label: 'frame_defiant_or_productive_dispute',
  };
  const rows = registration.measurement.judges.map((judge, index) => {
    const prompt = buildTutorStubStandingRivalryPromptV3({ caseId, source, publicContext, judge });
    assert.ok(prompt.instructions.some((line) => line.includes('exact substring')));
    const modelOutput = {
      schema: 'machinespirits.tutor-stub.resistance-semantic-judge-response.v3',
      case_id: caseId,
      judgment: {
        ...vector,
        evidence_quotes: Object.fromEntries(
          TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [
            field,
            vector[field] === 'no' ? null : { source_id: 'utterance', quote: source },
          ]),
        ),
        confidence: index === 0 ? 'high' : 'medium',
        indeterminacy_reason: 'none',
      },
    };
    const response = wrapTutorStubStandingRivalryModelOutputV3({
      modelOutput,
      prompt,
      judge,
      observedProvider: judge.provider,
      observedModel: judge.model,
      observedEffort: judge.effort,
      independentRunId: `${caseId}-${judge.id}`,
      structuredOutput: true,
      prohibitedToolEvents: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
    });
    return { prompt, response };
  });
  const result = adjudicateTutorStubStandingRivalryJudgesV3({
    source,
    publicContext,
    caseId,
    responses: rows.map((row) => row.response),
    registration,
    prompts: Object.fromEntries(rows.map((row) => [row.response.provenance.judge_id, row.prompt])),
  });
  assert.equal(result.status, 'determinate');
  assert.equal(result.final_label, 'frame_defiant_or_productive_dispute');
  assert.equal(result.standing_rivalry_adherent_for_gate, true);
  assert.deepEqual(result.primary_label_measurement.eligible_confidence, ['high', 'medium']);
  assert.equal(
    tutorStubResistanceSemanticLabelAdheres({
      profileId: 'frame_refuser',
      label: result.final_label,
      observationSemantics: 'prospective_standing_rivalry_semantic_v3',
    }),
    true,
  );

  const bad = structuredClone(rows[0]);
  const judge = registration.measurement.judges[0];
  const badOutput = {
    schema: 'machinespirits.tutor-stub.resistance-semantic-judge-response.v3',
    case_id: caseId,
    judgment: {
      ...vector,
      evidence_quotes: Object.fromEntries(
        TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [
          field,
          vector[field] === 'no' ? null : { source_id: 'utterance', quote: 'a paraphrase not in the packet' },
        ]),
      ),
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
  assert.throws(
    () =>
      wrapTutorStubStandingRivalryModelOutputV3({
        modelOutput: badOutput,
        prompt: bad.prompt,
        judge,
        observedProvider: judge.provider,
        observedModel: judge.model,
        observedEffort: judge.effort,
        independentRunId: `${caseId}-bad`,
        structuredOutput: true,
        prohibitedToolEvents: 0,
        modelAttestationBasis: judge.modelAttestationBasis,
        modelIndependentlyAttested: false,
      }),
    /absent from declared source/iu,
  );
});

test('rival DAGs are deterministic derivation-pipeline products concealed from tutor and readers', () => {
  for (const relativePath of [B1_PATH, R1_PATH]) {
    const loaded = load(relativePath);
    const job = buildTutorStubResistantLearnerCalibrationPlan(loaded.design).jobs[0];
    const first = mintTutorStubRivalLearnerDag({ design: loaded.design, job, root: ROOT });
    const second = mintTutorStubRivalLearnerDag({ design: loaded.design, job, root: ROOT });
    assert.deepEqual(first, second);
    assert.ok(first.openNodes.length > 0);
    assert.equal(first.concealment.tutorVisible, false);
    assert.equal(first.concealment.readerVisible, false);
    assert.deepEqual(first.provenance.mintPipeline, [
      'dramaticDerivation.world.loadWorld',
      'dramaticDerivation.learnerDag.buildLearnerDagSnapshot',
      'dramaticDerivation.learnerDag.buildLearnerDag',
    ]);
    const prompt = tutorStubRivalLearnerDagPrompt({ design: loaded.design, job, root: ROOT });
    assert.match(prompt, new RegExp(first.sha256, 'u'));
    assert.match(prompt, /public_tutor_move_bears_on_open_rival_node/u);
    assert.doesNotMatch(prompt, /target rate|reader agreement|powered success/iu);
    if (job.study === 'B1') {
      assert.notEqual(first.rivalWorldId, first.tutorWorldId);
      assert.equal(first.authoredBridges.length, first.openNodes.length);
      assert.ok(first.authoredBridges.every((bridge) => bridge.tutorRuleId && bridge.rivalNodeId));
    } else {
      assert.equal(first.rivalWorldId, first.tutorWorldId);
      assert.deepEqual(first.authoredBridges, []);
    }
  }
});

test('the typed concession predicate, not learner roleplay, decides whether a tutor move bears on an open node', () => {
  const loaded = load(B1_PATH);
  const job = buildTutorStubResistantLearnerCalibrationPlan(loaded.design).jobs[0];
  const dag = mintTutorStubRivalLearnerDag({ design: loaded.design, job, root: ROOT });
  const node = dag.openNodes[0];
  const tokens = node.task
    .toLowerCase()
    .match(/[a-z0-9]+/gu)
    .filter((token) => token.length >= 5)
    .slice(0, 2);
  assert.equal(tokens.length, 2);
  const learner = `My other inquiry still needs ${tokens.join(' and ')}.`;
  const genericTutor = `I hear ${tokens.join(' and ')}.`;
  const bearingTutor = `Which evidence would test ${tokens.join(' against ')}?`;
  const generic = evaluateTutorStubRivalDagConcession({
    dag,
    history: [
      { role: 'user', content: learner },
      { role: 'assistant', content: genericTutor },
    ],
  });
  assert.equal(generic.eligible, false);
  const bearing = evaluateTutorStubRivalDagConcession({
    dag,
    history: [
      { role: 'user', content: learner },
      { role: 'assistant', content: bearingTutor },
    ],
  });
  assert.equal(bearing.eligible, true);
  assert.equal(bearing.qualifyingNodeId, node.id);
  const directive = tutorStubRivalDagTurnDirective({
    state: {
      privateRivalLearnerDag: dag,
      history: [
        { role: 'user', content: learner },
        { role: 'assistant', content: bearingTutor },
      ],
    },
  });
  assert.match(directive, /Typed concession condition: MET/u);
  assert.match(directive, /computed by the registered public-token rule/u);
  const turnRecord = buildTutorStubRivalLearnerDagTurnRecord({
    dag,
    history: [
      { role: 'user', content: learner },
      { role: 'assistant', content: bearingTutor },
    ],
    learnerText: `The ${tokens.join(' and ')} question remains open.`,
    turn: 2,
  });
  assert.equal(turnRecord.schema, 'machinespirits.tutor-stub.rival-learner-dag-turn.v1');
  assert.equal(turnRecord.rivalDagSha256, dag.sha256);
  assert.equal(turnRecord.typedConcession.eligible, true);
  assert.ok(turnRecord.publicLearnerWork.some((row) => row.workedThisTurn));
});

test('the automated learner carries the rival-DAG audit into its turn output', async () => {
  const loaded = load(B1_PATH);
  const job = buildTutorStubResistantLearnerCalibrationPlan(loaded.design).jobs[0];
  const dag = mintTutorStubRivalLearnerDag({ design: loaded.design, job, root: ROOT });
  const nodeWords = dag.openNodes[0].task
    .toLowerCase()
    .match(/[a-z0-9]+/gu)
    .filter((token) => token.length >= 5)
    .slice(0, 2);
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent() {},
    async callPromptModel() {
      return { text: `My other inquiry still needs ${nodeWords.join(' and ')}.`, provider: 'stub', model: 'stub' };
    },
    classificationFromCombinedAnalysis() {},
    extractCombinedLearnerAnalysis() {},
    learnerProfileContract() {
      return null;
    },
    learnerProfileIds: () => ['bored'],
    learnerProfilePrompt: () => 'bored',
    negativeFloorRegisters: [],
  });
  const generated = await runtime.generateAutomatedLearnerTurn({
    state: {
      history: [],
      turns: [],
      trace: [],
      world: null,
      privateRivalLearnerDag: dag,
    },
    resolved: { provider: 'stub', model: 'stub' },
    profile: tutorStubRivalLearnerDagPrompt({ design: loaded.design, job, root: ROOT }),
    turnNumber: 1,
  });
  assert.equal(generated.rivalLearnerDagTurn.rivalDagSha256, dag.sha256);
  assert.ok(generated.rivalLearnerDagTurn.publicLearnerWork.some((row) => row.workedThisTurn));
});

test('B1 v2 free compilation covers every world, action, register, and scene with hard delivery contracts', () => {
  const preflight = runTutorStubResistantLearnerCompilationPreflight({ loaded: load(B1_PATH), root: ROOT });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.rows.length, 72);
  assert.equal(preflight.expected_rows, 72);
  assert.equal(new Set(preflight.rows.map((row) => row.world)).size, 6);
  assert.equal(new Set(preflight.rows.map((row) => row.action)).size, 2);
  assert.equal(new Set(preflight.rows.map((row) => row.assigned_register)).size, 3);
  assert.equal(new Set(preflight.rows.map((row) => row.scene)).size, 2);
  assert.ok(preflight.rows.every((row) => row.compiled.instruction_source === 'study_design_override'));
  assert.ok(preflight.rows.every((row) => row.rival_dag_sha256));
  assert.ok(
    preflight.rows
      .filter((row) => row.action === 'ask_discriminating_question')
      .every((row) => /exactly one/iu.test(row.compiled.action_instruction) && row.question_allowed),
  );
  assert.ok(
    preflight.rows
      .filter((row) => row.action === 'stage_public_evidence_for_next_step')
      .every((row) => /only declarative/iu.test(row.compiled.action_instruction) && !row.question_allowed),
  );
  assert.ok(
    preflight.rows
      .filter((row) => row.assigned_register === 'plain')
      .every((row) => /do not use we/iu.test(row.compiled.realization_contrast_instruction)),
  );
});

test('v2 reader prompt and checker both require null evidence for no', async () => {
  const design = load(B1_PATH).design;
  const judge = { id: 'reader_a', modelRef: 'codex.gpt-5.6-sol', effort: 'low' };
  const prompt = buildTutorStubResistantLearnerSemanticPrompt({
    caseId: 'case-v2',
    study: 'B1',
    instrument: 'primary',
    publicPacket: { post_1: 'I am still working on the other ledger.' },
    judge,
    design,
  });
  assert.match(prompt.instructions.join('\n'), /value is no or indeterminate, evidence_quotes MUST be null/u);
  assert.ok(
    prompt.output_schema.properties.judgment.properties.learner_authored_tutor_or_bridge_pickup_within_five_turns
      .properties.evidence_quotes.anyOf,
  );

  async function adjudicate({ invalidNoEvidence = false } = {}) {
    const runtime = createTutorStubResistantLearnerSemanticRuntime({
      appendTraceEvent(target, event) {
        target.push(event);
      },
      resolveModel(modelRef) {
        return modelRef.startsWith('claude-code.')
          ? { provider: 'claude-code', model: 'claude-sonnet-5' }
          : { provider: 'codex', model: 'gpt-5.6-sol' };
      },
      async callPromptModel({ prompt: text, resolved }) {
        const packet = JSON.parse(text);
        const sourceId = packet.instrument === 'primary' ? 'post_1' : 'intervention';
        const source = packet.public_packet[sourceId];
        const values =
          packet.instrument === 'primary'
            ? {
                learner_authored_tutor_or_bridge_pickup_within_five_turns: 'no',
                final_selective_attention_resistance_retained: 'yes',
              }
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
                  evidence_quotes:
                    value === 'no' && !invalidNoEvidence ? null : [{ source_id: sourceId, text: source }],
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
      trace: [],
      resistanceActionRegisterStudy: {
        resistant_learner_calibration: true,
        resistant_learner_study: 'B1',
        design,
        job_id: 'case-v2',
        trigger_turn: 1,
        outcome_horizon_learner_turns: 5,
      },
      turns: [
        { turn: 1, learner: 'I am working on the other ledger.', tutor: 'Whether A or B?' },
        { turn: 2, learner: 'The other ledger still has an open mark.', tutor: 'A public mark remains.' },
        { turn: 3, learner: 'I am comparing its two entries.', tutor: 'The interval is public.' },
        { turn: 4, learner: 'Its second entry is still unresolved.', tutor: 'The source remains open.' },
        { turn: 5, learner: 'I still prioritize that entry.', tutor: 'One bounded difference remains.' },
      ],
    };
    return runtime.adjudicateFinalHorizon({
      state,
      turnNumber: 6,
      learnerText: 'The rival entry remains my priority.',
    });
  }

  const valid = await adjudicate();
  assert.equal(valid.measurement_disposition, 'determinate');
  const invalid = await adjudicate({ invalidNoEvidence: true });
  assert.equal(invalid.measurement_disposition, 'measurement_indeterminate');
});

test('v2 completed-row agreement floors remain reachable with retained substantive rows', () => {
  const design = load(B1_PATH).design;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design);
  const rows = plan.jobs.map((job, index) => ({
    job,
    status: index < 4 ? 'retained_substantive_failure' : 'complete',
    registered_failure: index < 4 ? { code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_TRIGGER_MISSING' } : null,
    outcome: index < 4 ? null : b1Outcome(job, index),
  }));
  const report = summarizeTutorStubResistantLearnerCalibration({ rows, design });
  assert.equal(report.status, 'passed');
  assert.equal(report.reader_agreement.denominator, 'completed_rows');
  assert.equal(report.reader_agreement.completed_rows, 14);
  assert.equal(report.reader_agreement.minimum_eligible_votes_per_seat_and_instrument, 12);
  assert.equal(report.reader_agreement.minimum_jointly_eligible_cases_per_field, 10);
  assert.equal(report.retained_substantive_failures.count, 4);
});

test('protocol v2 runs the same zero-call preflight, one stub smoke per role, and creates a typed approval record', async () => {
  const entries = buildTutorStubResistantLearnerProtocolV2Entries([load(B1_PATH), load(R1_PATH)]);
  const destination = '/private/tmp/resistant-learner-v2-absent-test-root';
  const preflight = await runTutorStubResistantLearnerProtocolV2Preflight({
    entries,
    root: ROOT,
    destination,
    destinationExists: () => false,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', version: 'test', model_calls: 0 }),
  });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.jobs, 36);
  assert.equal(preflight.planned_role_calls, 1530);
  assert.equal(preflight.hard_attempt_ceiling, 4806);
  assert.equal(preflight.model_calls_executed, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.role_smokes.length, preflight.route_table.length);
  assert.ok(preflight.role_smokes.every((smoke) => smoke.provider_model_calls === 0));
  assert.deepEqual(
    preflight.studies.map((study) => study.compilation.rows.length),
    [72, 12],
  );

  const approval = buildTutorStubResistantLearnerTypedApproval({
    signedBy: 'Operator',
    approvalPhrase: 'APPROVE CALIBRATION 4806',
    sourceCommit: 'a'.repeat(40),
    sourceTree: 'b'.repeat(40),
    dirty: true,
    preflight,
    approvedAt: '2026-08-23T00:00:00.000Z',
  });
  assert.equal(approval.approved_by, 'Operator');
  assert.equal(approval.source.enforcement, 'recorded_not_pinned');
  assert.equal(approval.destination, destination);
  assert.equal(approval.powered_run_authorized, false);
  assert.equal(approval.hard_attempt_ceiling, 4806);
  assert.throws(
    () =>
      buildTutorStubResistantLearnerTypedApproval({
        signedBy: 'Operator',
        approvalPhrase: 'GO',
        sourceCommit: 'a'.repeat(40),
        sourceTree: 'b'.repeat(40),
        preflight,
      }),
    /must be exactly/iu,
  );

  const blocked = await runTutorStubResistantLearnerProtocolV2Preflight({
    entries,
    root: ROOT,
    destination,
    destinationExists: () => true,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', version: 'test', model_calls: 0 }),
  });
  assert.equal(blocked.status, 'failed');
  assert.equal(blocked.checks.destination_absent, false);
});

test('protocol-v2 launcher accepts v3 designs with the full zero-call plan', async () => {
  const entries = buildTutorStubResistantLearnerProtocolV2Entries([load(B1_V3_PATH), load(R1_V3_PATH)]);
  const preflight = await runTutorStubResistantLearnerProtocolV2Preflight({
    entries,
    root: ROOT,
    destination: '/private/tmp/resistant-learner-v3-absent-test-root',
    destinationExists: () => false,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', version: 'test', model_calls: 0 }),
  });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.checks.designs_are_v2_or_v3, true);
  assert.equal(preflight.jobs, 36);
  assert.equal(preflight.planned_role_calls, 1530);
  assert.equal(preflight.hard_attempt_ceiling, 4806);
  assert.equal(preflight.model_calls_executed, 0);
  assert.equal(preflight.production_writes, 0);
  assert.ok(
    preflight.route_table.some((row) => row.transportRole === 'tutor_stub_resistant_learner_rival_attention_judge'),
  );
});

test('the legacy GO-note launcher refuses v2 and v3 designs before any model call', () => {
  for (const [b1Path, r1Path] of [
    [B1_PATH, R1_PATH],
    [B1_V3_PATH, R1_V3_PATH],
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-resistant-learner-calibration.js',
        '--b1-design',
        b1Path,
        '--r1-design',
        r1Path,
        '--dry-run',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /legacy GO-note launcher is v1-only/iu);
  }
});
