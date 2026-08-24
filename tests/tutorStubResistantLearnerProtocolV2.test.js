import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
import {
  buildTutorStubFirstDraftContract,
  tutorStubFirstDraftContractPrompt,
} from '../services/tutorStubFirstDraftContract.js';
import { applyTutorStubResistanceActionRegisterStudyIntervention } from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  createTutorStubAutomatedLearnerGenerationRuntime,
  throwFrameRefuserAdherenceExhaustion,
} from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import {
  BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED_CODE,
  selectTutorStubBoredomSemanticAdjudicatorFactory,
  throwTutorStubBoredomProofDagAdherenceExhaustion,
} from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import {
  readTutorStubRegisteredStudyOutcome,
  tutorStubRegisteredStudyOutcomeFromError,
  writeTutorStubRegisteredStudyOutcome,
} from '../services/tutorStubRegisteredStudyOutcome.js';
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
import {
  TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3,
  parseTutorStubRivalAttentionAdjudicationV3,
} from '../services/tutorStubRivalAttentionSemanticAdjudicationV3.js';
import { TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3 } from '../services/tutorStubResistanceSemanticAdjudicationV3.js';
import {
  TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3,
  adjudicateTutorStubStandingRivalryJudgesV3,
  buildTutorStubStandingRivalryPromptV3,
  wrapTutorStubStandingRivalryModelOutputV3,
} from '../services/tutorStubStandingRivalrySemanticAdjudicationV3.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_STANDING_RIVALRY_V3,
  loadTutorStubResistanceSemanticRegistration,
  tutorStubResistanceSemanticLabelAdheres,
  tutorStubResistanceSemanticRegistrationPathForObservation,
} from '../services/tutorStubResistanceSemanticRuntime.js';
import {
  extractTutorStubResistantLearnerCalibrationRow,
  runTutorStubResistantLearnerCalibrationChild,
  tutorStubResistantLearnerCalibrationChildSpec,
  tutorStubResistantLearnerCalibrationHaltReason,
} from '../scripts/run-tutor-stub-resistant-learner-calibration.js';

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

function configureB1V3CalibrationState({ loaded, job }) {
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
}

function captureThrownError(callback) {
  let caught = null;
  try {
    callback();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, 'expected callback to throw an Error');
  return caught;
}

function installZeroCallCodexStub(binDir) {
  const executable = path.join(binDir, 'codex');
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args.includes('--version')) {
  process.stdout.write('codex-cli gate1c-zero-call-stub\\n');
  process.exit(0);
}
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  fs.appendFileSync(process.env.FAKE_CODEX_LOG, JSON.stringify({ args, inputBytes: input.length }) + '\\n');
  process.stderr.write('gate1c zero-call stub transport reached\\n');
  process.exit(42);
});
`,
    'utf8',
  );
  fs.chmodSync(executable, 0o755);
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
  const selection = { response_configuration: {}, selected_register: 'plain' };
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state: configureB1V3CalibrationState({ loaded, job }),
    learnerText: rivalWork,
    classification: { turn: { discourse_move: 'counterexample', evidence_use: 'cites_public_evidence' } },
    tutorLearnerDag: { model: { turn: 1 } },
    semanticAdjudication: fired,
  });
  assert.equal(applied.resistance_action_register_intervention.status, 'applied');
  const notAppliedState = configureB1V3CalibrationState({ loaded, job });
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

test('B1 v3 ships the assigned discriminating-question and concrete register directives in the tutor prompt', () => {
  const loaded = load(B1_V3_PATH);
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  const rivalWork = 'The invoice timing still leaves two live delivery accounts open, so I am comparing the dates.';
  const fired = parseTutorStubRivalAttentionAdjudicationV3({
    raw: {
      schema: 'machinespirits.tutor-stub.rival-attention-judge-response.v3',
      case_id: 'B1-v3-shipped-prompt',
      objective_advanced: 'rival_objective',
      work_status: 'new_evidence_bearing_work',
      evidence_quote: 'comparing the dates',
      confidence: 'high',
      reason: 'The learner advances a rival timing question.',
    },
    caseId: 'B1-v3-shipped-prompt',
    learnerText: rivalWork,
    observedRoute: { provider: 'codex', model: 'gpt-5.6-sol' },
  });
  const registerMarkers = {
    warm: /Make the warm register audible with exactly one shared-inquiry marker/u,
    plain: /Make the plain register audible through short neutral work language/u,
    edged: /Make the edged register audible with exactly one restrained dry work challenge/u,
  };

  for (const register of Object.keys(registerMarkers)) {
    const job = plan.jobs.find(
      (candidate) => candidate.action === 'ask_discriminating_question' && candidate.register === register,
    );
    assert.ok(job, `expected a B1 v3 discriminating-question job for ${register}`);
    const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
      selection: { response_configuration: {}, selected_register: 'plain' },
      state: configureB1V3CalibrationState({ loaded, job }),
      learnerText: rivalWork,
      classification: { turn: { discourse_move: 'counterexample', evidence_use: 'cites_public_evidence' } },
      tutorLearnerDag: { model: { turn: 1 } },
      semanticAdjudication: fired,
    });
    const contract = buildTutorStubFirstDraftContract({
      learnerText: rivalWork,
      publicQuestion: 'Which public account fits the delivery timing?',
      responseConfiguration: applied.response_configuration,
    });
    const shippedPrompt = tutorStubFirstDraftContractPrompt(contract);
    assert.match(shippedPrompt, /End the turn with exactly one question/u);
    assert.match(shippedPrompt, /name two live already-public possibilities/u);
    assert.match(shippedPrompt, /the already-public observation that separates them/u);
    assert.match(shippedPrompt, /Put the only question mark at the end of the turn/u);
    assert.match(shippedPrompt, registerMarkers[register]);
  }
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
  const notMetDirective = tutorStubRivalDagTurnDirective({
    state: {
      privateRivalLearnerDag: dag,
      history: [
        { role: 'user', content: learner },
        { role: 'assistant', content: genericTutor },
      ],
    },
  });
  assert.match(
    notMetDirective,
    /Typed concession condition: NOT MET\. Continue the next open rival node; do not engage the tutor-world request merely as roleplay\./u,
  );
  assert.match(notMetDirective, /Never mention this private state publicly\./u);
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
  assert.match(directive, new RegExp(`Typed concession condition: MET for ${node.id}`, 'u'));
  assert.match(directive, /Take one bridge step: connect this overlap to a public tutor-world item in your own words/u);
  assert.match(directive, /Keep at least one rival node open/u);
  assert.doesNotMatch(directive, /Engage only that bounded overlap/u);
  assert.match(directive, /computed by the registered public-token rule/u);
  assert.match(directive, /Never mention this private state publicly\./u);
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
  const learner = `My other inquiry still needs ${nodeWords.join(' and ')}.`;
  const bearingTutor = `Which evidence would test ${nodeWords.join(' against ')}?`;
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
      history: [
        { role: 'user', content: learner },
        { role: 'assistant', content: bearingTutor },
      ],
      turns: [],
      trace: [],
      world: null,
      privateRivalLearnerDag: dag,
    },
    resolved: { provider: 'stub', model: 'stub' },
    profile: tutorStubRivalLearnerDagPrompt({ design: loaded.design, job, root: ROOT }),
    turnNumber: 2,
  });
  assert.match(
    generated.promptSnapshot.userPrompt,
    /Take one bridge step: connect this overlap to a public tutor-world item in your own words/u,
  );
  assert.doesNotMatch(generated.promptSnapshot.userPrompt, /Engage only that bounded overlap/u);
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

test('Gate 1c observation names keep their v3 adjudicator routes instead of falling back to v2', async () => {
  const runtimeDependencies = {
    appendTraceEvent() {},
    async callPromptModel() {
      throw new Error('model transport is not part of this zero-call routing test');
    },
    classificationFromCombinedAnalysis() {},
    extractCombinedLearnerAnalysis() {},
    learnerProfileContract() {
      return null;
    },
    learnerProfileIds: () => ['bored', 'frame_refuser'],
    learnerProfilePrompt: () => 'test profile',
    negativeFloorRegisters: [],
  };
  assert.doesNotThrow(() =>
    createTutorStubAutomatedLearnerGenerationRuntime({
      ...runtimeDependencies,
      env: { TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3 },
    }),
  );
  const standingRuntime = createTutorStubAutomatedLearnerGenerationRuntime({
    ...runtimeDependencies,
    adjudicateResistanceSemanticCandidate: async () => ({
      observationSemantics: TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3,
      aggregate: { status: 'determinate', final_label: 'frame_refuser' },
    }),
    env: { TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3 },
  });
  assert.equal(
    standingRuntime.automatedLearnerTraceMetadata.observationSemantics,
    TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3,
  );
  assert.equal(
    tutorStubResistanceSemanticRegistrationPathForObservation(TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3),
    TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_STANDING_RIVALRY_V3,
  );
  const standingRegistration = loadTutorStubResistanceSemanticRegistration(
    TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_STANDING_RIVALRY_V3,
  );
  assert.equal(standingRegistration.registration.observationSemantics, TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3);

  const factory = selectTutorStubBoredomSemanticAdjudicatorFactory({
    args: { 'resistant-learner-calibration-design': B1_V3_PATH },
    root: ROOT,
  });
  let observedRole = null;
  const adjudicate = factory(
    async ({ role, resolved }) => {
      observedRole = role;
      return {
        text: JSON.stringify({
          schema: 'machinespirits.tutor-stub.rival-attention-judge-response.v3',
          case_id: 'B1-routing:turn:1',
          objective_advanced: 'rival_objective',
          work_status: 'new_evidence_bearing_work',
          evidence_quote: 'compare the dates',
          confidence: 'high',
          reason: 'The learner performs new work on the rival timing objective.',
        }),
        provider: resolved.provider,
        model: resolved.model,
      };
    },
    () => ({ provider: 'codex', model: 'gpt-5.6-sol' }),
  );
  const routed = await adjudicate({
    learnerText: 'I will compare the dates before returning to your accusation.',
    state: { history: [], trace: [], resistanceActionRegisterStudy: { job_id: 'B1-routing' } },
    turn: 1,
  });
  assert.equal(observedRole, 'tutor_stub_resistant_learner_rival_attention_judge');
  assert.equal(routed.measurement_disposition, 'rival_attention_trigger');
  assert.equal(routed.version, 3);
});

test('Gate 1c v3 observation names pass the completed-turn marker path without changing rival-attention v9 clauses', async () => {
  const boredContract = {
    intent: { failureOperator: 'withhold effort from the tutor-world thread' },
    observabilityContract: {
      eligiblePolicies: ['*'],
      eligibility: 'all_turns',
      markerClauses: [[{ field: 'boredWithholding', values: [true] }]],
      mustShowByTurn: 2,
      minEligibleRate: 0.5,
    },
  };
  const state = {
    history: [{ role: 'assistant', content: 'Which account should we test next?' }],
    turns: [
      {
        learner: 'Fine. Is this trial nearly done?',
        tutor: 'Which account should we test next?',
        classification: {
          turn: {
            request_type: 'off_task_or_mixed',
            discourse_move: 'off_task',
            evidence_use: 'none',
            epistemic_stance: 'resistant',
            agency: 'complying',
          },
        },
        registerSelection: null,
      },
    ],
    trace: [],
    register: { policy: 'field' },
    world: null,
    historyTurns: 4,
  };

  for (const observationSemantics of [
    TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3,
    TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3,
  ]) {
    const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
      appendTraceEvent() {},
      adjudicateResistanceSemanticCandidate: async () => ({
        observationSemantics,
        aggregate: { status: 'determinate', final_label: 'frame_refuser' },
      }),
      async callPromptModel() {
        return { text: 'Stub learner reply.', provider: 'stub', model: 'stub' };
      },
      classificationFromCombinedAnalysis() {},
      env: { TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: observationSemantics },
      extractCombinedLearnerAnalysis() {},
      learnerProfileContract: () => boredContract,
      learnerProfileIds: () => ['bored'],
      learnerProfilePrompt: () => 'test bored profile',
      negativeFloorRegisters: [],
    });
    const generated = await runtime.generateAutomatedLearnerTurn({
      state,
      resolved: { provider: 'stub', model: 'stub' },
      profile: 'bored',
      turnNumber: 2,
    });
    assert.equal(generated.text, 'Stub learner reply.');
    assert.match(generated.promptSnapshot.userPrompt, /# Private behavior cue/iu);
    if (observationSemantics === TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3) {
      assert.match(generated.promptSnapshot.userPrompt, /This turn may repair or progress/iu);
    }
  }
});

test('bored proof-DAG adherence exhaustion round-trips as a retained substantive outcome', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gate1c-bored-adherence-outcome-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'registered-study-outcome.json');
  const error = captureThrownError(() => throwTutorStubBoredomProofDagAdherenceExhaustion({ repairAttempts: 2 }));
  const outcome = tutorStubRegisteredStudyOutcomeFromError({ error, jobId: 'B1-bored-adherence' });

  assert.equal(outcome.code, BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED_CODE);
  assert.equal(outcome.replacement_allowed, false);
  assert.deepEqual(writeTutorStubRegisteredStudyOutcome({ filePath, error, jobId: 'B1-bored-adherence' }), outcome);
  assert.deepEqual(readTutorStubRegisteredStudyOutcome({ filePath, expectedJobId: 'B1-bored-adherence' }), {
    present: true,
    valid: true,
    outcome,
    issues: [],
  });
});

test('a failed child with a valid boredom adherence outcome is retained and does not halt the flight', (t) => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'gate1c-bored-adherence-row-'));
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  const job = { id: 'B1-bored-adherence-row' };
  const jobRoot = path.join(destination, 'jobs', job.id);
  const traceDir = path.join(jobRoot, 'traces');
  fs.mkdirSync(traceDir, { recursive: true });
  const spec = {
    jobRoot,
    traceDir,
    transcript: path.join(jobRoot, 'transcript.json'),
    registeredStudyOutcome: path.join(jobRoot, 'registered-study-outcome.json'),
  };
  const error = captureThrownError(() => throwTutorStubBoredomProofDagAdherenceExhaustion({ repairAttempts: 2 }));
  writeTutorStubRegisteredStudyOutcome({ filePath: spec.registeredStudyOutcome, error, jobId: job.id });

  const row = extractTutorStubResistantLearnerCalibrationRow({
    job,
    spec,
    exit: { code: 1, signal: null, spawn_error: null },
  });
  assert.equal(row.status, 'retained_substantive_failure');
  assert.equal(row.registered_failure.code, BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED_CODE);
  assert.equal(tutorStubResistantLearnerCalibrationHaltReason(row), null);
});

test('frame-refuser adherence exhaustion remains an unregistered technical failure', () => {
  const error = captureThrownError(() =>
    throwFrameRefuserAdherenceExhaustion({ profile: 'frame_refuser', repairAttempts: 1 }),
  );
  assert.equal(error.code, 'TUTOR_STUB_FRAME_REFUSER_ADHERENCE_EXHAUSTED');
  assert.equal(error.disposition, 'technical_failure_no_public_candidate');
  assert.equal(tutorStubRegisteredStudyOutcomeFromError({ error, jobId: 'R1-frame-refuser' }), null);
});

test('the launcher child path boots one B1 and one R1 v3 job through a zero-call stub transport', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gate1c-child-boot-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const binDir = path.join(temporary, 'bin');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(archiveDir, { recursive: true });
  installZeroCallCodexStub(binDir);

  for (const [designPath, expectedSemantics] of [
    [B1_V3_PATH, TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3],
    [R1_V3_PATH, TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3],
  ]) {
    const loaded = load(designPath);
    const job = buildTutorStubResistantLearnerCalibrationPlan(loaded.design).jobs[0];
    const destination = path.join(temporary, job.study.toLowerCase());
    const stubLog = path.join(temporary, `${job.study.toLowerCase()}-stub.jsonl`);
    const spec = tutorStubResistantLearnerCalibrationChildSpec({ loaded, job, destination });
    assert.equal(spec.env.TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS, expectedSemantics);
    assert.ok(spec.args.includes('scripts/tutor-stub.js'));
    assert.ok(spec.args.includes('--resistant-learner-calibration-design'));
    spec.env = {
      ...spec.env,
      PATH: `${binDir}${path.delimiter}${spec.env.PATH || ''}`,
      EVAL_ARCHIVE_DIR: archiveDir,
      FAKE_CODEX_LOG: stubLog,
      CLI_PROVIDER_CODEX_TIMEOUT_MS: '2000',
      CLI_PROVIDER_VERSION_TIMEOUT_MS: '2000',
      OPENAI_API_KEY: '',
      OPENROUTER_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    };
    const exit = await runTutorStubResistantLearnerCalibrationChild(spec);
    assert.equal(exit.spawn_error, null);
    const stderr = fs.readFileSync(spec.stderr, 'utf8');
    assert.ok(
      fs.existsSync(stubLog),
      `${job.study} child must reach the local Codex stub after boot; child stderr: ${stderr}`,
    );
    assert.ok(fs.readFileSync(stubLog, 'utf8').trim().length > 0);
    assert.doesNotMatch(stderr, /unsupported automated-learner observation semantics/iu);
    assert.match(stderr, /codex CLI exited with code 42/iu);
  }
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
