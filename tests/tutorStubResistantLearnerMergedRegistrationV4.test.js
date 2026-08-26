import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistantLearnerCalibrationPlan,
  loadTutorStubResistantLearnerDesign,
  tutorStubResistantLearnerMergedFaceDesign,
  validateTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  createTutorStubResistantLearnerSemanticRuntime,
  tutorStubResistantLearnerMergedSemanticRegistrationIssues,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import {
  TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_CODES,
  tutorStubRegisteredStudyOutcomeFromError,
} from '../services/tutorStubRegisteredStudyOutcome.js';
import {
  TUTOR_STUB_TUTOR_BOUNDED_TEST_NON_DELIVERY_CODE,
  applyTutorStubR1TutorDeliveryGate,
} from '../services/tutorStubR1TutorDeliveryGate.js';
import { createTutorStubTutorTurnPreparation } from '../services/tutorStubTutorTurnPreparation.js';
import {
  runTutorStubResistantLearnerMergedPreflight,
  tutorStubResistantLearnerMergedRouteTable,
} from '../services/tutorStubResistantLearnerMergedLaunch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V4_DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v4.json';
const V4_REGISTRATION_PATH = 'config/tutor-stub-resistant-learner-merged-semantic-registration.v4.json';
const SEALED = Object.freeze({
  'config/tutor-stub-resistant-learner-merged-design.v1.json':
    '9c5a6415758bfb154e11cf168b6d60c3376cd62ab9665f4ac5311fd1f71db903',
  'config/tutor-stub-resistant-learner-merged-design.v2.json':
    'eb1991fd301d12865983b4f6b8333ee77e7e869506c023858dc5faec08090744',
  'config/tutor-stub-resistant-learner-merged-design.v3.json':
    '4f9f2ce116ef2abef8ed9f8871035d23a8f023def7aec56c53da9590b1c19e0a',
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v1.json':
    'c76f63838a3649c7f3c6ec1a0201449e13d1aceda07596bdd8aee5144ce48bd6',
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v2.json':
    '43fc5b1e69dd9e4c48c186c4b36fcdd3d6542e2800b598bc74c84ef3852b634d',
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v3.json':
    '10842ae31b797a5dc705af95595d3c5a25754aa8feb48ff43ea855d98aabef14',
});

function loadDesign(relativePath = V4_DESIGN_PATH) {
  return loadTutorStubResistantLearnerDesign({ designPath: relativePath, root: ROOT });
}

function registrationV4() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, V4_REGISTRATION_PATH), 'utf8'));
}

test('revision 4 preserves every sealed v1-v3 file and registers the recomputed ceiling', () => {
  for (const [relativePath, expected] of Object.entries(SEALED)) {
    const source = fs.readFileSync(path.join(ROOT, relativePath));
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), expected, relativePath);
  }
  const loaded = loadDesign();
  const v3 = fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistant-learner-merged-design.v3.json'));
  assert.equal(loaded.design.revision, 4);
  assert.equal(loaded.design.supersedes.priorDesignSha256, crypto.createHash('sha256').update(v3).digest('hex'));
  assert.equal(validateTutorStubResistantLearnerDesign(loaded.design).valid, true);
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  assert.equal(plan.jobs.length, 36);
  assert.equal(loaded.design.attemptCeilings.callPlanPerDialogue.tutorDeliveryEnforcement, 3);
  assert.equal(loaded.design.attemptCeilings.plannedCallsPerDialogue, 62);
  assert.equal(loaded.design.attemptCeilings.plannedCallsCalibration, 2232);
  assert.equal(loaded.design.attemptCeilings.plannedCallReservationCeilingPerDialogue, 186);
  assert.equal(loaded.design.attemptCeilings.maximumReservationsPerDialogue, 192);
  assert.equal(loaded.design.attemptCeilings.calibrationMaximumReservations, 6912);
});

test('the full tutor-delivery contract and ceiling fail closed under every material tamper', () => {
  const pristine = loadDesign().design;
  const mutate = [
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.schema = 'v0'),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.appliesWhen = 'after_learner'),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.scope = 'every_turn'),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.position = 'after_public_commit'),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.check.kind = 'lexical_delivery_check'),
    (value) =>
      (value.populationStrata.faceB.tutorDeliveryContract.enforcement.check.adjudicatorSeat.modelRef =
        'codex.gpt-5.6-luna'),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.check.adjudicatorSeat.effort = 'high'),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.check.question = 'Was it good?'),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.check.labels = ['yes', 'no']),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.check.evidenceContract = 'anything'),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.repairsAllowedPerEpisode = 2),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.repairInstruction = 'Try again.'),
    (value) =>
      (value.populationStrata.faceB.tutorDeliveryContract.enforcement.exhaustionDisposition = 'learner_failure'),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.exhaustionNeverScored = false),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.typedFailureIsNotDeterminate = false),
    (value) => (value.attemptCeilings.callPlanPerDialogue.tutorDeliveryEnforcement = 2),
    (value) => (value.attemptCeilings.calibrationMaximumReservations = 6900),
  ];
  for (const tamper of mutate) {
    const candidate = structuredClone(pristine);
    tamper(candidate);
    assert.equal(validateTutorStubResistantLearnerDesign(candidate).valid, false);
  }
  const v3 = loadDesign('config/tutor-stub-resistant-learner-merged-design.v3.json').design;
  v3.populationStrata.faceB.tutorDeliveryContract.enforcement = structuredClone(
    pristine.populationStrata.faceB.tutorDeliveryContract.enforcement,
  );
  assert.equal(validateTutorStubResistantLearnerDesign(v3).valid, false);
});

test('semantic registration v4 freezes the v3 instrument and both typed dispositions', () => {
  const pristine = registrationV4();
  const judges = loadDesign().design.measurement.readerPanel.judges;
  const check = (registration) =>
    tutorStubResistantLearnerMergedSemanticRegistrationIssues({
      registrationPath: V4_REGISTRATION_PATH,
      registration,
      judges,
    });
  assert.deepEqual(check(pristine), []);
  assert.deepEqual(
    pristine.instrument,
    JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'config/tutor-stub-resistant-learner-merged-semantic-registration.v3.json'),
        'utf8',
      ),
    ).instrument,
  );
  for (const tamper of [
    (value) => (value.appliesToDesignRevision = 3),
    (value) => (value.supersedesRegistration.sha256 = '0'.repeat(64)),
    (value) => (value.instrument.faces.faceB.rungs['2'] = 'Any reply scores 2.'),
    (value) => delete value.dispositions.tutor_non_delivery,
    (value) => (value.dispositions.tutor_non_delivery = 'score rung zero'),
    (value) => (value.visibility.rivalDagVisible = true),
  ]) {
    const candidate = structuredClone(pristine);
    tamper(candidate);
    assert.ok(check(candidate).length > 0);
  }
});

function gateHarness(script) {
  const design = tutorStubResistantLearnerMergedFaceDesign(loadDesign().design, 'faceB');
  const trace = [];
  let repairCalls = 0;
  let adjudicationCalls = 0;
  const state = {
    trace,
    resistanceActionRegisterStudy: { resistant_learner_study: 'R1', design },
  };
  return {
    state,
    trace,
    repairCalls: () => repairCalls,
    adjudicationCalls: () => adjudicationCalls,
    run: (response = { text: 'Initial tutor draft.' }) =>
      applyTutorStubR1TutorDeliveryGate({
        state,
        response,
        turnNumber: 2,
        learnerText: 'Show what would give that question standing.',
        interventionApplied: true,
        appendTraceEvent(target, event) {
          target.push(event);
        },
        async adjudicateTutorDelivery({ candidateKind }) {
          const delivered = script[adjudicationCalls];
          adjudicationCalls += 1;
          return {
            label: delivered ? 'tutor_delivery_passed' : 'tutor_delivery_not_delivered',
            delivered,
            quote: delivered ? candidateKind : null,
          };
        },
        async repairTutor({ instruction, attempt }) {
          repairCalls += 1;
          assert.equal(attempt, 1);
          assert.equal(instruction, design.tutorDeliveryContract.enforcement.repairInstruction);
          return { text: 'Repaired tutor turn with one bounded public test.' };
        },
      }),
  };
}

test('tutor-delivery gate accepts, repairs once, and then throws only a tutor-named outcome', async () => {
  const passed = gateHarness([true]);
  assert.equal((await passed.run()).text, 'Initial tutor draft.');
  assert.equal(passed.repairCalls(), 0);

  const repaired = gateHarness([false, true]);
  assert.equal((await repaired.run()).text, 'Repaired tutor turn with one bounded public test.');
  assert.equal(repaired.repairCalls(), 1);
  assert.equal(repaired.adjudicationCalls(), 2);
  assert.equal(repaired.state.tutorDeliveryEnforcement.delivered, true);

  const exhausted = gateHarness([false, false]);
  await assert.rejects(exhausted.run(), (error) => {
    assert.equal(error.code, TUTOR_STUB_TUTOR_BOUNDED_TEST_NON_DELIVERY_CODE);
    assert.equal(error.disposition, 'typed_tutor_non_delivery_failure');
    assert.equal(error.substantiveStudyFailure, true);
    assert.equal(error.recoverable, false);
    assert.equal(error.neverScored, true);
    assert.equal(error.measurementDeterminate, false);
    assert.doesNotMatch(error.code, /learner_noncompliance/u);
    return true;
  });
  assert.equal(exhausted.repairCalls(), 1);
  assert.equal(exhausted.adjudicationCalls(), 2);
});

function deliveryAdjudicatorHarness(response) {
  const design = tutorStubResistantLearnerMergedFaceDesign(loadDesign().design, 'faceB');
  const prompts = [];
  const runtime = createTutorStubResistantLearnerSemanticRuntime({
    appendTraceEvent(target, event) {
      target.push(event);
    },
    resolveModel(modelRef) {
      assert.equal(modelRef, 'codex.gpt-5.6-sol');
      return { provider: 'codex', model: 'gpt-5.6-sol' };
    },
    async callPromptModel({ prompt, role, cliEffort }) {
      prompts.push(JSON.parse(prompt));
      assert.equal(role, 'tutor_stub_tutor_delivery_tutor_delivery_adjudicator');
      assert.equal(cliEffort, 'low');
      return { text: JSON.stringify(response) };
    },
  });
  const state = {
    trace: [],
    resistanceActionRegisterStudy: { resistant_learner_study: 'R1', design },
  };
  return { runtime, state, prompts };
}

test('registered tutor-delivery seat is evidence-bound and malformed verdicts stop indeterminate', async () => {
  const tutorText =
    'The standing dispute remains. What would give this question standing? Test the seal against the public registry; a match would support the booking record, and the wider frame remains disputed.';
  const accepted = deliveryAdjudicatorHarness({
    label: 'tutor_delivery_passed',
    quote: 'Test the seal against the public registry',
  });
  const verdict = await accepted.runtime.adjudicateTutorDelivery({
    state: accepted.state,
    tutorText,
    learnerText: 'The booking record has no standing yet.',
    turnNumber: 2,
  });
  assert.equal(verdict.delivered, true);
  assert.equal(
    accepted.prompts[0].question,
    accepted.state.resistanceActionRegisterStudy.design.tutorDeliveryContract.enforcement.check.question,
  );
  assert.deepEqual(accepted.prompts[0].labels, ['tutor_delivery_passed', 'tutor_delivery_not_delivered']);

  for (const response of [
    { label: 'tutor_delivery_passed', quote: null },
    { label: 'tutor_delivery_passed', quote: 'fabricated quote' },
    { label: 'tutor_delivery_not_delivered', quote: 'must be null' },
    { label: 'maybe', quote: null },
  ]) {
    const invalid = deliveryAdjudicatorHarness(response);
    await assert.rejects(
      () =>
        invalid.runtime.adjudicateTutorDelivery({
          state: invalid.state,
          tutorText,
          learnerText: 'The booking record has no standing yet.',
          turnNumber: 2,
        }),
      (error) => {
        assert.equal(error.code, 'tutor_stub_tutor_delivery_adjudication_indeterminate');
        assert.equal(error.measurementIndeterminate, true);
        assert.equal(error.neverScored, true);
        return true;
      },
    );
  }
});

test('both revision-4 tutor-delivery codes cross the child boundary as retained outcomes', () => {
  for (const code of [
    TUTOR_STUB_TUTOR_BOUNDED_TEST_NON_DELIVERY_CODE,
    'tutor_stub_tutor_delivery_adjudication_indeterminate',
  ]) {
    assert.ok(TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_CODES.includes(code));
    const error = Object.assign(new Error('registered outcome'), { code, substantiveStudyFailure: true });
    const outcome = tutorStubRegisteredStudyOutcomeFromError({ error, jobId: 'faceB-delivery-fixture' });
    assert.equal(outcome?.status, 'retained_substantive_failure');
    assert.equal(outcome?.code, code);
    assert.equal(outcome?.replacement_allowed, false);
  }
});

test('the real prompt assembly ships the exact registered tutor repair instruction', () => {
  const instruction = tutorStubResistantLearnerMergedFaceDesign(loadDesign().design, 'faceB').tutorDeliveryContract
    .enforcement.repairInstruction;
  const prepare = createTutorStubTutorTurnPreparation({
    appendTraceEvent() {},
    auditTutorStubSpeakerPrivilege: () => ({ ok: true, issues: [] }),
    buildTutorStubDramaticReleaseFrame: () => ({ active: false, entries: [] }),
    buildTutorStubFirstDraftContract: () => null,
    buildTutorStubGuardFindingsFeedForward: () => ({ prompt: null }),
    buildTutorStubResponseCompositionFrame: () => ({ active: false }),
    classifierTutorContext: () => '',
    committedReleaseRows: () => [],
    compileTutorStubPerformanceObligationContract: () => null,
    currentReleaseRows: () => [],
    dagTurnContext: () => '',
    emptyPlanAdvisory: '',
    humanDiscourseTutorContext: () => '',
    reconcileTutorStubPointOfActionHandoffEligibility: (value) => value,
    recoverTutorStubSpeakerPrompt: () => assert.fail('recovery should not run'),
    resolveTutorStubPublicCounterpressure: () => null,
    sanitizeTutorStubSpeakerAdvisory: ({ text }) => text,
    snapshotTutorStubPublicPremiseIds: () => new Set(),
    tutorCoachGuidanceContext: () => '',
    tutorLearnerDagModelContext: () => '',
    tutorMessageContext: () => ({ messages: [], replayedMessageCount: 0 }),
    tutorStubComprehensionPrompt: () => '',
    tutorStubDirectorGuidancePrompt: () => '',
    tutorStubFirstDraftContractPrompt: () => '',
    tutorStubPointOfActionPrompt: () => '',
    tutorStubTuningTurnAdvisory: () => '',
    tutorStubTurnFeedbackPrompt: () => '',
  });
  const prepared = prepare({
    history: [],
    learnerText: 'The booking record has no standing yet.',
    state: { world: {}, pointOfAction: { current: null }, turns: [] },
    systemPrompt: 'Public-safe tutor prompt.',
    world: {},
    passthrough: false,
    registeredTutorDeliveryRepairInstruction: instruction,
  });
  assert.match(prepared.effectiveSpeakerUserPrompt, /\[Registered tutor-delivery repair\]/u);
  assert.ok(prepared.effectiveSpeakerUserPrompt.includes(instruction));
  assert.ok(prepared.effectiveSpeakerInstructionTexts.includes(prepared.tutorDeliveryRepairAdvisory));
});

test('the tutor gate is before public commit and learner enforcement; the facade stays below 900 lines', () => {
  const orchestration = fs.readFileSync(path.join(ROOT, 'services/tutorStubTurnOrchestration.js'), 'utf8');
  const gate = orchestration.indexOf('response = await applyTutorStubR1TutorDeliveryGate({');
  assert.ok(gate > 0);
  assert.ok(gate < orchestration.indexOf('state.dialogueClosure = advanceTutorStubDialogueClosure', gate));
  assert.ok(gate < orchestration.indexOf('state.history.push', gate));
  const learnerRelease = fs.readFileSync(path.join(ROOT, 'services/tutorStubR1PostInterventionRelease.js'), 'utf8');
  assert.match(learnerRelease, /applyTutorStubR1PostInterventionRelease/u);
  const facade = fs.readFileSync(path.join(ROOT, 'services/tutorStubAutomatedLearnerGenerationRuntime.js'), 'utf8');
  assert.ok(facade.split('\n').length < 900);
});

test('revision-4 zero-call preflight covers tutor repair and delivery-seat roles without writing', async () => {
  const loaded = loadDesign();
  loaded.relativePath = V4_DESIGN_PATH;
  const destination = path.join(os.tmpdir(), `merged-v4-preflight-absent-${process.pid}`);
  const roles = [];
  const preflight = await runTutorStubResistantLearnerMergedPreflight({
    loaded,
    root: ROOT,
    destination,
    destinationExists: () => false,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => {
      roles.push(route.transportRole);
      return { ...route, status: 'passed_zero_call_stub', provider_model_calls: 0 };
    },
  });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.planned_role_calls, 2232);
  assert.equal(preflight.hard_attempt_ceiling, 6912);
  assert.equal(preflight.model_calls_executed, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(fs.existsSync(destination), false);
  assert.ok(roles.includes('tutor_stub_tutor_delivery_repair'));
  assert.ok(roles.includes('tutor_stub_tutor_delivery_tutor_delivery_adjudicator'));
  const v3Roles = tutorStubResistantLearnerMergedRouteTable(
    loadDesign('config/tutor-stub-resistant-learner-merged-design.v3.json').design,
  ).map((row) => row.transportRole);
  assert.ok(!v3Roles.includes('tutor_stub_tutor_delivery_repair'));
});
