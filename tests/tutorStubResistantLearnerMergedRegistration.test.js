import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistantLearnerCalibrationPlan,
  configureTutorStubResistantLearnerCalibrationFromCli,
  loadTutorStubResistantLearnerDesign,
  tutorStubResistantLearnerMergedFaceDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubResistantLearnerMergedApproval,
  runTutorStubResistantLearnerMergedPreflight,
} from '../services/tutorStubResistantLearnerMergedLaunch.js';
import {
  createTutorStubResistantLearnerSemanticRuntime,
  foldTutorStubResistantLearnerMergedEvidencePunctuation,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import { TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3 } from '../services/tutorStubResistanceSemanticAdjudicationV3.js';
import { selectTutorStubBoredomSemanticAdjudicatorFactory } from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import { tutorStubResistanceActionRegisterTreatmentEligibility } from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1,
  adjudicateTutorStubStandingRivalryJudgesV3,
  buildTutorStubStandingRivalryPromptV3,
  wrapTutorStubStandingRivalryModelOutputV3,
} from '../services/tutorStubStandingRivalrySemanticAdjudicationV3.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_MERGED_STANDING_RIVALRY_V1,
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_STANDING_RIVALRY_V3,
  loadTutorStubResistanceSemanticRegistration,
  tutorStubResistanceSemanticLabelAdheres,
} from '../services/tutorStubResistanceSemanticRuntime.js';
import { executeTutorStubResistantLearnerMergedCalibration } from '../scripts/run-tutor-stub-resistant-learner-merged-calibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v1.json';
const B1_V3_PATH = 'config/tutor-stub-resistant-learner-b1-design.v3.json';
const R1_V3_PATH = 'config/tutor-stub-resistant-learner-r1-design.v3.json';

function load(relativePath = DESIGN_PATH) {
  return { ...loadTutorStubResistantLearnerDesign({ designPath: relativePath, root: ROOT }), relativePath };
}

function calibrationState() {
  return {
    trace: [],
    turns: [],
    history: [],
    register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
    world: {},
  };
}

function configureMergedJob(loaded, job) {
  const faceDesign = tutorStubResistantLearnerMergedFaceDesign(loaded.design, job.face_id);
  const state = calibrationState();
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
      'resistant-learner-calibration-design': DESIGN_PATH,
      'resistant-learner-calibration-job': job.id,
    },
    state,
    root: ROOT,
    autoLearnerEnabled: true,
    autoLearnerProfileId: job.study === 'B1' ? 'bored' : 'frame_refuser',
    autoTurns: job.maximum_trigger_turn + job.outcome_horizon_learner_turns,
    appendTraceEvent(target, event) {
      target.push(event);
    },
    observationSemantics: faceDesign.models.triggerObservation.semantics,
  });
  return state;
}

function standingResponseRows({ binding, labels }) {
  const registration = binding.registration;
  const caseId = 'merged-standing-class-fixture';
  const source =
    'Your answer frame still lacks standing; I will compare the public timing test while reserving that wider dispute.';
  const publicContext = [
    { role: 'assistant', text: 'We can test the public timing distinction without settling the wider frame.' },
  ];
  const baseVector = {
    jurisdiction_dispute: 'yes',
    interlocutor_standing_or_right: 'yes',
    inquiry_or_question_frame_governance: 'yes',
    test_or_criterion_governance: 'no',
    other_jurisdictional_governance: 'no',
    licensed_participation: 'yes',
    participation_withholding: 'yes',
    productive_counterframing: 'yes',
  };
  const rows = registration.measurement.judges.map((judge, index) => {
    const prompt = buildTutorStubStandingRivalryPromptV3({ caseId, source, publicContext, judge });
    const vector = {
      ...baseVector,
      ...(labels[index] === 'frame_refuser' ? { licensed_participation: 'no', productive_counterframing: 'no' } : {}),
      final_label: labels[index],
    };
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
  return {
    source,
    publicContext,
    caseId,
    registration,
    responses: rows.map((row) => row.response),
    prompts: Object.fromEntries(rows.map((row) => [row.response.provenance.judge_id, row.prompt])),
  };
}

function semanticRaw({ prompt, route, rung = '1', quote, face = 'faceA' }) {
  const persona =
    face === 'faceA'
      ? { final_selective_attention_resistance_retained: 'yes' }
      : { final_jurisdictional_dispute_retained: 'yes', whole_frame_compliance: 'no' };
  const judgment = {
    final_graded_engagement_rung: {
      value: rung,
      evidence_quotes: rung === '0' || rung === 'indeterminate' ? null : [{ source_id: 'post_1', text: quote }],
      confidence: rung === 'indeterminate' ? 'low' : 'high',
      indeterminacy_reason: rung === 'indeterminate' ? 'semantic_ambiguity' : 'none',
    },
    ...Object.fromEntries(
      Object.entries(persona).map(([field, value]) => [
        field,
        {
          value,
          evidence_quotes: value === 'no' ? null : [{ source_id: 'post_1', text: quote }],
          confidence: 'high',
          indeterminacy_reason: 'none',
        },
      ]),
    ),
  };
  return {
    text: JSON.stringify({ schema: prompt.output_schema.properties.schema.enum[0], case_id: prompt.case_id, judgment }),
    provider: route.provider,
    model: route.model,
    effort: 'low',
    structuredOutput: true,
    prohibitedToolEventCountObserved: true,
    prohibitedToolEventCount: 0,
  };
}

async function runPrimaryPanel({ design, face = 'faceA', rungs = ['1', '1'], quote }) {
  let callIndex = 0;
  const runtime = createTutorStubResistantLearnerSemanticRuntime({
    appendTraceEvent(target, event) {
      target.push(event);
    },
    resolveModel(modelRef) {
      return modelRef === 'codex.gpt-5.6-sol'
        ? { provider: 'codex', model: 'gpt-5.6-sol' }
        : { provider: 'claude-code', model: 'claude-sonnet-5' };
    },
    async callPromptModel({ prompt, resolved }) {
      const parsed = JSON.parse(prompt);
      const rung = rungs[callIndex];
      callIndex += 1;
      return semanticRaw({ prompt: parsed, route: resolved, rung, quote, face });
    },
  });
  const study = face === 'faceA' ? 'B1' : 'R1';
  const state = {
    trace: [],
    resistanceActionRegisterStudy: {
      resistant_learner_calibration: true,
      resistant_learner_study: study,
      job_id: `${face}-semantic-fixture`,
      design,
    },
  };
  const publicPacket = {
    trigger: 'The rival record still matters.',
    intervention: 'Which public record would separate the two live possibilities?',
    post_1: 'I’m not choosing between those booking records yet.',
  };
  const result = await runtime.adjudicatePrimaryPanel({ state, turnNumber: 6, publicPacket });
  return { result, calls: callIndex };
}

test('merged design builds the agreed 36-job plan and complete zero-call preflight', async () => {
  const loaded = load();
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  assert.equal(plan.jobs.length, 36);
  assert.equal(plan.jobs.filter((job) => job.face_id === 'faceA').length, 18);
  assert.equal(plan.jobs.filter((job) => job.face_id === 'faceB').length, 18);
  assert.ok(
    plan.jobs.filter((job) => job.face_id === 'faceA').every((job) => job.action === 'ask_discriminating_question'),
  );
  assert.ok(
    plan.jobs.filter((job) => job.face_id === 'faceB').every((job) => job.action === 'test_bounded_distinction'),
  );
  assert.equal(loaded.design.randomization.masterSeed, 2026082401);
  assert.equal(loaded.design.attemptCeilings.plannedCallsCalibration, 1584);
  assert.equal(loaded.design.attemptCeilings.calibrationMaximumReservations, 4968);

  const destination = path.join(os.tmpdir(), `merged-preflight-absent-${process.pid}`);
  const preflight = await runTutorStubResistantLearnerMergedPreflight({
    loaded,
    root: ROOT,
    destination,
    destinationExists() {
      return false;
    },
    probeRoute(route) {
      return { ...route, status: 'passed_zero_call', model_calls: 0 };
    },
    async smokeRole(route) {
      return { ...route, status: 'passed_zero_call_stub', provider_model_calls: 0 };
    },
  });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.jobs, 36);
  assert.equal(preflight.compilation.rival_dag_count, 36);
  assert.equal(preflight.compilation.rows.length, 48);
  assert.equal(preflight.planned_role_calls, 1584);
  assert.equal(preflight.hard_attempt_ceiling, 4968);
  assert.equal(preflight.model_calls_executed, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(fs.existsSync(destination), false);
});

test('merged face-B gate agrees on adherence class while the sealed v3 gate remains exact-label', () => {
  const labels = ['frame_refuser', 'frame_defiant_or_productive_dispute'];
  const mergedBinding = loadTutorStubResistanceSemanticRegistration(
    TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_MERGED_STANDING_RIVALRY_V1,
  );
  const mergedFixture = standingResponseRows({ binding: mergedBinding, labels });
  const merged = adjudicateTutorStubStandingRivalryJudgesV3(mergedFixture);
  assert.equal(merged.status, 'determinate');
  assert.equal(merged.adherence_class_measurement.value, 'adherent');
  assert.equal(merged.final_label, 'adherent_label_set');
  assert.equal(merged.standing_rivalry_adherent_for_gate, true);
  assert.equal(
    tutorStubResistanceSemanticLabelAdheres({
      profileId: 'frame_refuser',
      label: merged.final_label,
      observationSemantics: TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1,
    }),
    true,
  );

  const sealedBinding = loadTutorStubResistanceSemanticRegistration(
    TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_STANDING_RIVALRY_V3,
  );
  const sealedFixture = standingResponseRows({ binding: sealedBinding, labels });
  const sealed = adjudicateTutorStubStandingRivalryJudgesV3(sealedFixture);
  assert.equal(sealed.status, 'measurement_indeterminate');
  assert.equal(sealed.final_label, 'indeterminate');
});

test('merged punctuation folding admits the real apostrophe pair and exact-rung consensus stays both-agree', async () => {
  const loaded = load();
  const faceA = tutorStubResistantLearnerMergedFaceDesign(loaded.design, 'faceA');
  assert.equal(
    foldTutorStubResistantLearnerMergedEvidencePunctuation('“I’m here”—now\u00a0ready'),
    '"I\'m here"-now ready',
  );
  const quote = "I'm not choosing between those booking records yet.";
  const agreeing = await runPrimaryPanel({ design: faceA, quote, rungs: ['1', '1'] });
  assert.equal(agreeing.calls, 2);
  assert.equal(agreeing.result.status, 'determinate');
  assert.equal(agreeing.result.fields.final_graded_engagement_rung.value, '1');
  assert.ok(
    agreeing.result.seats.every(
      (seat) =>
        seat.validation.fields.final_graded_engagement_rung.evidence[0].match_normalization ===
        'registered_punctuation_folding_v1',
    ),
  );

  const split = await runPrimaryPanel({ design: faceA, quote, rungs: ['1', '2'] });
  assert.equal(split.result.status, 'measurement_indeterminate');
  assert.equal(split.result.fields.final_graded_engagement_rung.value, 'indeterminate');
  const rung2 = await runPrimaryPanel({ design: faceA, quote, rungs: ['2', '2'] });
  assert.equal(rung2.result.status, 'determinate');
  assert.equal(rung2.result.fields.final_graded_engagement_rung.value, '2');
});

test('each v3 face design still plans eighteen calibration jobs', () => {
  // The digest pins on the v3 design, registration and prompt bytes that lived
  // here were removed on 2026-09-03 (CLAUDE.md, edit in place). Provenance is
  // the commit hash in the run ledger; git diff is the tamper check.
  for (const relativePath of [B1_V3_PATH, R1_V3_PATH]) {
    const loaded = load(relativePath);
    assert.equal(buildTutorStubResistantLearnerCalibrationPlan(loaded.design).jobs.length, 18, relativePath);
  }
});

test('merged child configuration reaches both face runtimes and ships the registered moves', () => {
  const loaded = load();
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  const faceAJob = plan.jobs.find((job) => job.face_id === 'faceA' && job.register === 'plain');
  const faceBJob = plan.jobs.find((job) => job.face_id === 'faceB' && job.register === 'plain');
  const faceAState = configureMergedJob(loaded, faceAJob);
  const faceBState = configureMergedJob(loaded, faceBJob);
  assert.equal(faceAState.resistanceActionRegisterStudy.design.mergedFaceId, 'faceA');
  assert.equal(faceAState.resistanceActionRegisterStudy.resistant_learner_study, 'B1');
  assert.equal(faceBState.resistanceActionRegisterStudy.design.mergedFaceId, 'faceB');
  assert.equal(faceBState.resistanceActionRegisterStudy.resistant_learner_study, 'R1');
  assert.match(
    faceAState.resistanceActionRegisterStudy.study_assignment_instruction_overrides.actionInstructions
      .ask_discriminating_question,
    /whether-A-or-B/u,
  );
  assert.match(
    faceBState.resistanceActionRegisterStudy.study_assignment_instruction_overrides.actionInstructions
      .test_bounded_distinction,
    /under protest/u,
  );
});

test('merged approval is unversioned and retired execution refuses before a child starts', async () => {
  const loaded = load();
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'merged-create-once-'));
  const preflight = {
    study_id: loaded.design.studyId,
    destination,
    jobs: 36,
    planned_role_calls: 1584,
    hard_attempt_ceiling: 4968,
  };
  const approval = buildTutorStubResistantLearnerMergedApproval({
    signedBy: 'Operator',
    approvalPhrase: 'APPROVE CALIBRATION 4968',
    preflight,
    approvedAt: '2026-08-24T00:00:00.000Z',
  });
  assert.equal(Object.hasOwn(approval, 'schema'), false);
  assert.equal(Object.hasOwn(approval, 'version'), false);
  let childCalls = 0;
  await assert.rejects(
    executeTutorStubResistantLearnerMergedCalibration({
      loaded,
      destination,
      parallelism: 1,
      preflight,
      approval,
      provenance: { commit: 'a'.repeat(40), tree: 'b'.repeat(40), dirty: false, enforcement: 'recorded_not_pinned' },
      childSpec() {
        childCalls += 1;
      },
    }),
    /paid launcher retired: tutor-stub-resistant-learner-merged-calibration/u,
  );
  assert.equal(childCalls, 0);
  fs.rmSync(destination, { recursive: true, force: true });
});

test('the merged design routes the faceA trigger seat to the rival-attention v3 adjudicator', async () => {
  const factory = selectTutorStubBoredomSemanticAdjudicatorFactory({
    args: { 'resistant-learner-calibration-design': DESIGN_PATH },
    root: ROOT,
  });
  let observedRole = null;
  const adjudicate = factory(
    async ({ role, resolved }) => {
      observedRole = role;
      return {
        text: JSON.stringify({
          schema: 'machinespirits.tutor-stub.rival-attention-judge-response.v3',
          case_id: 'merged-routing:turn:1',
          objective_advanced: 'rival_objective',
          work_status: 'new_evidence_bearing_work',
          evidence_quote: 'compare the booking records',
          confidence: 'high',
          reason: 'The learner performs new work on the rival objective.',
        }),
        provider: resolved.provider,
        model: resolved.model,
      };
    },
    () => ({ provider: 'codex', model: 'gpt-5.6-sol' }),
  );
  const routed = await adjudicate({
    learnerText: 'I will compare the booking records before returning to your question.',
    state: { history: [], trace: [], resistanceActionRegisterStudy: { job_id: 'merged-routing' } },
    turn: 1,
  });
  assert.equal(observedRole, 'tutor_stub_resistant_learner_rival_attention_judge');
  assert.equal(routed.measurement_disposition, 'rival_attention_trigger');
  assert.equal(routed.version, 3);
});

test('merged faceB treatment eligibility binds the merged registration instead of throwing the v4 panel guard', () => {
  const loaded = load();
  const faceB = tutorStubResistantLearnerMergedFaceDesign(loaded.design, 'faceB');
  const runtime = {
    consumed: false,
    profile: 'frame_refuser',
    resistant_learner_calibration: true,
    resistant_learner_study: 'R1',
    design: faceB,
    registration: {
      design: { trigger: { observationSemantics: TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1 } },
    },
  };
  const eligibility = tutorStubResistanceActionRegisterTreatmentEligibility({
    runtime,
    learnerText: 'Before your question can stand, we need evidence that a fitting opened under raised pressure.',
    classification: null,
    tutorLearnerDag: { advance: { supportedMoveCount: 0 } },
    turnNumber: 1,
    semanticAdjudication: null,
  });
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes('semantic_measurement_indeterminate_missing_or_stale'));
});
