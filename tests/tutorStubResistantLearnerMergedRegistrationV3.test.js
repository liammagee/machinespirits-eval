import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import {
  buildTutorStubResistantLearnerCalibrationPlan,
  loadTutorStubResistantLearnerDesign,
  tutorStubResistantLearnerMergedFaceDesign,
  validateTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubResistantLearnerSemanticPrompt,
  createTutorStubResistantLearnerSemanticRuntime,
  tutorStubResistantLearnerMergedSemanticRegistrationIssues,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import {
  TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_CODES,
  tutorStubRegisteredStudyOutcomeFromError,
} from '../services/tutorStubRegisteredStudyOutcome.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V2_DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v2.json';
const V3_DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v3.json';
const V3_REGISTRATION_PATH = 'config/tutor-stub-resistant-learner-merged-semantic-registration.v3.json';

function load(relativePath) {
  return loadTutorStubResistantLearnerDesign({ designPath: relativePath, root: ROOT });
}

function registrationV3() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, V3_REGISTRATION_PATH), 'utf8'));
}

function primaryPrompt({ design, study }) {
  return buildTutorStubResistantLearnerSemanticPrompt({
    caseId: 'v3-prompt-fixture',
    study,
    instrument: 'primary',
    publicPacket: { trigger: 'a', intervention: 'b' },
    judge: { id: 'probe', modelRef: 'codex.gpt-5.6-sol', effort: 'low' },
    design,
  });
}

// The typed concession rule is lexical: the learner solicitation and the
// tutor's latest turn must each share >=2 content tokens with the named open
// rival node, and the tutor turn must carry an operation marker ("test").
// ledger/seal/harbor/registry give 4 shared tokens on both sides.
const MET_NODE_TASK = 'compare the ledger seal against the harbor registry';
const MET_HISTORY = [
  { role: 'user', content: 'show me the ledger seal and the harbor registry first' },
  { role: 'assistant', content: 'We can test whether the ledger seal matches the harbor registry entry.' },
];
const NOT_MET_HISTORY = [
  { role: 'user', content: 'show me the ledger seal and the harbor registry first' },
  { role: 'assistant', content: 'Good work so far.' },
];

function fixtureDag(faceDesign) {
  return {
    sha256: 'fixture-dag',
    relation: 'rival',
    concessionCondition: {
      kind: 'typed_public_overlap',
      matchingAlgorithm: structuredClone(faceDesign.rivalDagPersona.concessionCondition.matchingAlgorithm),
      engageWhen: 'fixture',
      otherwise: 'fixture',
      nonQualifying: [],
    },
    openNodes: [{ id: 'r1', task: MET_NODE_TASK }],
  };
}

function scriptedBridgeAdjudicator(script) {
  const calls = [];
  return {
    calls,
    async fn({ learnerText, nodeText, latestTutorText, candidateKind }) {
      const step = script[calls.length];
      calls.push({ learnerText, nodeText, latestTutorText, candidateKind });
      if (!step) throw new Error('bridge adjudicator called more often than scripted');
      return {
        label: step.taken ? 'bridge_step_taken' : 'bridge_step_not_taken',
        taken: step.taken,
        quote: step.taken ? 'connects the ledger seal to the harbor registry' : null,
      };
    },
  };
}

const REPAIRED_TEXT =
  'That registry test does connect the ledger seal to your harbor registry entry, and it shows which record the seal supports; the wider frame question stays open.';

function enforcementHarness({ design, history, dag, adjudicator, repairText = REPAIRED_TEXT }) {
  const analysisTexts = [];
  let repairCalls = 0;
  const trace = [];
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent(target, event) {
      target.push(event);
    },
    adjudicateResistanceSemanticCandidate() {
      throw new Error('post-trigger R1 must not invoke the legacy semantic adherence panel');
    },
    ...(adjudicator ? { adjudicateRivalDagBridgeStep: adjudicator.fn } : {}),
    async callPromptModel({ role }) {
      if (role !== 'tutor_stub_auto_learner') {
        throw new Error(`unexpected model call for role ${role}`);
      }
      repairCalls += 1;
      return { text: repairText };
    },
    classificationFromCombinedAnalysis: (raw) => raw.classification,
    env: { TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: 'prospective_frame_resistance_semantic_v4' },
    async extractCombinedLearnerAnalysis({ learnerText }) {
      analysisTexts.push(learnerText);
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
    history,
    register: { policy: 'field' },
    classifier: { enabled: true },
    learnerDag: { enabled: true },
    world: {},
    ...(dag ? { privateRivalLearnerDag: dag } : {}),
    resistanceActionRegisterStudy: {
      resistant_learner_calibration: true,
      resistant_learner_study: 'R1',
      consumed: true,
      design,
    },
  };
  const enforce = (generatedText) =>
    runtime.enforceAutomatedLearnerProfile({
      state,
      resolved: {},
      profile: 'frame_refuser',
      turnNumber: 8,
      generated: { text: generatedText },
      precomputeFinalLearnerAnalysis: true,
    });
  return {
    enforce,
    state,
    trace,
    analysisTexts,
    repairCallCount: () => repairCalls,
  };
}

const REFUSAL_DRAFT = 'Your ledger seal and harbor registry test still sit inside the frame I dispute.';

test('v3 design supersedes v2 by byte pin and plans 36 jobs with the bridge-step call budget', () => {
  const v2 = load(V2_DESIGN_PATH);
  const v3 = load(V3_DESIGN_PATH);
  assert.equal(v3.design.revision, 3);
  assert.equal(v3.design.supersedes.priorDesign, V2_DESIGN_PATH);
  assert.equal(v3.design.supersedes.priorDesignSha256, crypto.createHash('sha256').update(v2.source).digest('hex'));
  assert.equal(v3.design.supersedes.reuse, false);
  assert.equal(v3.design.measurement.semanticRegistration, V3_REGISTRATION_PATH);
  assert.equal(v3.design.measurement.readerPanel.protocolSource, V3_REGISTRATION_PATH);

  const plan = buildTutorStubResistantLearnerCalibrationPlan(v3.design);
  assert.equal(plan.jobs.length, 36);
  const faceB = plan.jobs.filter((job) => job.face_id === 'faceB');
  assert.equal(faceB.length, 18);
  assert.ok(faceB.every((job) => job.outcome_horizon_learner_turns === 8));

  const ceilings = v3.design.attemptCeilings;
  assert.equal(ceilings.callPlanPerDialogue.bridgeStepEnforcement, 3);
  assert.equal(ceilings.plannedCallsPerDialogue, 59);
  assert.equal(ceilings.plannedCallsCalibration, 2124);
  assert.equal(ceilings.plannedCallsCalibration, plan.jobs.length * ceilings.plannedCallsPerDialogue);
  assert.equal(ceilings.plannedCallReservationCeilingPerDialogue, 177);
  assert.equal(ceilings.maximumReservationsPerDialogue, 183);
  assert.equal(ceilings.calibrationMaximumReservations, 6588);
});

test('sealed v2 design still validates and carries no bridge-step enforcement', () => {
  const v2 = load(V2_DESIGN_PATH).design;
  assert.equal(validateTutorStubResistantLearnerDesign(v2).valid, true);
  assert.equal(v2.populationStrata.faceB.rivalDagPersona.concessionEnforcement, undefined);
});

test('tampered v3 designs fail closed against the revision pins', () => {
  const pristine = load(V3_DESIGN_PATH).design;
  assert.equal(validateTutorStubResistantLearnerDesign(pristine).valid, true);

  const missingEnforcement = structuredClone(pristine);
  delete missingEnforcement.populationStrata.faceB.rivalDagPersona.concessionEnforcement;
  assert.equal(validateTutorStubResistantLearnerDesign(missingEnforcement).valid, false);

  const wrongScope = structuredClone(pristine);
  wrongScope.populationStrata.faceB.rivalDagPersona.concessionEnforcement.scope = 'every_met_turn';
  assert.equal(validateTutorStubResistantLearnerDesign(wrongScope).valid, false);

  const extraRepair = structuredClone(pristine);
  extraRepair.populationStrata.faceB.rivalDagPersona.concessionEnforcement.repairsAllowedPerEpisode = 2;
  assert.equal(validateTutorStubResistantLearnerDesign(extraRepair).valid, false);

  const scoredAsRungZero = structuredClone(pristine);
  scoredAsRungZero.populationStrata.faceB.rivalDagPersona.concessionEnforcement.exhaustionNeverScoredAsRung0 = false;
  assert.equal(validateTutorStubResistantLearnerDesign(scoredAsRungZero).valid, false);

  const wrongCeiling = structuredClone(pristine);
  wrongCeiling.attemptCeilings.plannedCallsCalibration = 2016;
  assert.equal(validateTutorStubResistantLearnerDesign(wrongCeiling).valid, false);

  const wrongPin = structuredClone(pristine);
  wrongPin.supersedes.priorDesignSha256 = wrongPin.supersedes.priorDesignSha256.replace(/^./, '0');
  assert.equal(validateTutorStubResistantLearnerDesign(wrongPin).valid, false);

  const unknownRevision = structuredClone(pristine);
  unknownRevision.revision = 4;
  assert.equal(validateTutorStubResistantLearnerDesign(unknownRevision).valid, false);

  const v2WithEnforcement = load(V2_DESIGN_PATH).design;
  v2WithEnforcement.populationStrata.faceB.rivalDagPersona.concessionEnforcement = structuredClone(
    pristine.populationStrata.faceB.rivalDagPersona.concessionEnforcement,
  );
  assert.equal(validateTutorStubResistantLearnerDesign(v2WithEnforcement).valid, false);
});

test('v3 judge prompts carry the registered endpoint definition; v2 prompts do not', () => {
  const v2 = load(V2_DESIGN_PATH).design;
  const v3 = load(V3_DESIGN_PATH).design;
  const registration = registrationV3();
  const endpointLine = `Endpoint definition: ${registration.instrument.endpointDefinition}`;
  assert.ok(registration.instrument.endpointDefinition.includes('highest rung'));
  for (const study of ['B1', 'R1']) {
    const v3Text = primaryPrompt({ design: v3, study }).instructions.join('\n');
    assert.ok(v3Text.includes(endpointLine));
    const v2Text = primaryPrompt({ design: v2, study }).instructions.join('\n');
    assert.ok(!v2Text.includes('Endpoint definition:'));
  }
  const horizonLine = primaryPrompt({ design: v3, study: 'R1' }).instructions[0];
  assert.ok(horizonLine.includes('8-post-trigger-learner-turn'));
});

test('a MET draft that takes the bridge step passes through without a repair call', async () => {
  const faceB = tutorStubResistantLearnerMergedFaceDesign(load(V3_DESIGN_PATH).design, 'faceB');
  const adjudicator = scriptedBridgeAdjudicator([{ taken: true }]);
  const harness = enforcementHarness({
    design: faceB,
    history: MET_HISTORY,
    dag: fixtureDag(faceB),
    adjudicator,
  });
  const bridgingDraft =
    'The ledger seal does match the harbor registry entry, which supports your record; my wider frame objection stands.';
  const result = await harness.enforce(bridgingDraft);
  assert.equal(result.repaired, false);
  assert.equal(result.passed, null);
  assert.equal(result.generated.text, bridgingDraft);
  assert.equal(adjudicator.calls.length, 1);
  assert.equal(adjudicator.calls[0].candidateKind, 'initial');
  assert.equal(adjudicator.calls[0].nodeText, MET_NODE_TASK);
  assert.equal(adjudicator.calls[0].latestTutorText, MET_HISTORY[1].content);
  assert.equal(harness.repairCallCount(), 0);
  assert.deepEqual(harness.analysisTexts, [bridgingDraft]);
  assert.deepEqual(harness.state.rivalDagBridgeEnforcement, {
    consumed: true,
    turn: 8,
    taken: true,
    nodeId: 'r1',
    repairAttempts: 0,
  });
  const enforcementEvent = harness.trace.find((event) => event.type === 'rival_dag_bridge_step_enforcement');
  assert.equal(enforcementEvent.taken, true);
  assert.equal(enforcementEvent.scope, 'first_met_episode_per_dialogue');
  assert.equal(harness.trace.at(-1).type, 'auto_learner_profile_adherence_released_after_registered_intervention');
});

test('a refused bridge step gets exactly one repair and the repaired text is scored', async () => {
  const faceB = tutorStubResistantLearnerMergedFaceDesign(load(V3_DESIGN_PATH).design, 'faceB');
  const adjudicator = scriptedBridgeAdjudicator([{ taken: false }, { taken: true }]);
  const harness = enforcementHarness({
    design: faceB,
    history: MET_HISTORY,
    dag: fixtureDag(faceB),
    adjudicator,
  });
  const result = await harness.enforce(REFUSAL_DRAFT);
  assert.equal(result.repaired, true);
  assert.equal(result.generated.text, REPAIRED_TEXT);
  assert.equal(adjudicator.calls.length, 2);
  assert.equal(adjudicator.calls[0].learnerText, REFUSAL_DRAFT);
  assert.equal(adjudicator.calls[1].learnerText, REPAIRED_TEXT);
  assert.equal(adjudicator.calls[1].candidateKind, 'learner-repair-1');
  assert.equal(harness.repairCallCount(), 1);
  assert.deepEqual(harness.analysisTexts, [REPAIRED_TEXT]);
  const repairEvent = harness.trace.find((event) => event.type === 'rival_dag_bridge_step_repair_requested');
  assert.equal(repairEvent.attempt, 1);
  assert.equal(repairEvent.draft, REFUSAL_DRAFT);
  const enforcementEvent = harness.trace.find((event) => event.type === 'rival_dag_bridge_step_enforcement');
  assert.equal(enforcementEvent.taken, true);
  assert.equal(enforcementEvent.repairAttempts, 1);
  assert.equal(harness.state.rivalDagBridgeEnforcement.consumed, true);
});

test('exhausted repairs raise the typed learner_noncompliance failure, never a score', async () => {
  const faceB = tutorStubResistantLearnerMergedFaceDesign(load(V3_DESIGN_PATH).design, 'faceB');
  const adjudicator = scriptedBridgeAdjudicator([{ taken: false }, { taken: false }]);
  const harness = enforcementHarness({
    design: faceB,
    history: MET_HISTORY,
    dag: fixtureDag(faceB),
    adjudicator,
  });
  await assert.rejects(
    () => harness.enforce(REFUSAL_DRAFT),
    (error) => {
      assert.equal(error.code, 'tutor_stub_learner_noncompliance');
      assert.equal(error.disposition, 'typed_learner_noncompliance_failure');
      assert.equal(error.substantiveStudyFailure, true);
      assert.equal(error.recoverable, false);
      assert.equal(error.neverScoredAsRung0, true);
      return true;
    },
  );
  assert.equal(adjudicator.calls.length, 2);
  assert.equal(harness.repairCallCount(), 1);
  assert.deepEqual(harness.analysisTexts, []);
  const exhaustedEvent = harness.trace.find((event) => event.type === 'rival_dag_bridge_step_noncompliance_exhausted');
  assert.equal(exhaustedEvent.repairAttempts, 1);
  assert.equal(exhaustedEvent.disposition, 'typed_learner_noncompliance_failure');
  assert.equal(harness.state.rivalDagBridgeEnforcement.taken, false);
});

test('a consumed episode and a not-MET turn both skip the adjudicator', async () => {
  const faceB = tutorStubResistantLearnerMergedFaceDesign(load(V3_DESIGN_PATH).design, 'faceB');

  const consumed = enforcementHarness({
    design: faceB,
    history: MET_HISTORY,
    dag: fixtureDag(faceB),
    adjudicator: scriptedBridgeAdjudicator([]),
  });
  consumed.state.rivalDagBridgeEnforcement = { consumed: true, turn: 6, taken: true, nodeId: 'r1', repairAttempts: 0 };
  const consumedResult = await consumed.enforce(REFUSAL_DRAFT);
  assert.equal(consumedResult.repaired, false);
  assert.deepEqual(consumed.analysisTexts, [REFUSAL_DRAFT]);

  const notMet = enforcementHarness({
    design: faceB,
    history: NOT_MET_HISTORY,
    dag: fixtureDag(faceB),
    adjudicator: scriptedBridgeAdjudicator([]),
  });
  const notMetResult = await notMet.enforce(REFUSAL_DRAFT);
  assert.equal(notMetResult.repaired, false);
  assert.equal(
    notMet.trace.some((event) => event.type === 'rival_dag_bridge_step_enforcement'),
    false,
  );
});

test('the sealed v2 design releases MET turns without any bridge-step adjudication', async () => {
  const faceB = tutorStubResistantLearnerMergedFaceDesign(load(V2_DESIGN_PATH).design, 'faceB');
  const harness = enforcementHarness({
    design: faceB,
    history: MET_HISTORY,
    dag: fixtureDag(faceB),
    adjudicator: null,
  });
  const result = await harness.enforce(REFUSAL_DRAFT);
  assert.equal(result.repaired, false);
  assert.deepEqual(harness.analysisTexts, [REFUSAL_DRAFT]);
  assert.equal(
    harness.trace.some((event) => String(event.type).startsWith('rival_dag_bridge_step')),
    false,
  );
  assert.equal(harness.trace.at(-1).type, 'auto_learner_profile_adherence_released_after_registered_intervention');
});

function bridgeAdjudicatorRuntime({ design, respond, resolve }) {
  const prompts = [];
  const runtime = createTutorStubResistantLearnerSemanticRuntime({
    appendTraceEvent(target, event) {
      target.push(event);
    },
    resolveModel:
      resolve ||
      ((modelRef) => {
        assert.equal(modelRef, 'codex.gpt-5.6-sol');
        return { provider: 'codex', model: 'gpt-5.6-sol' };
      }),
    async callPromptModel({ prompt }) {
      prompts.push(JSON.parse(prompt));
      return { text: JSON.stringify(respond(prompts.at(-1))) };
    },
  });
  const state = {
    trace: [],
    resistanceActionRegisterStudy: {
      resistant_learner_calibration: true,
      resistant_learner_study: 'R1',
      job_id: 'faceB-bridge-fixture',
      design,
    },
  };
  return { runtime, state, prompts };
}

test('the registered bridge-step adjudicator seat returns a typed verdict with the quote', async () => {
  const faceB = tutorStubResistantLearnerMergedFaceDesign(load(V3_DESIGN_PATH).design, 'faceB');
  const { runtime, state, prompts } = bridgeAdjudicatorRuntime({
    design: faceB,
    respond: () => ({ label: 'bridge_step_taken', quote: 'does match the harbor registry entry' }),
  });
  const verdict = await runtime.adjudicateRivalDagBridgeStep({
    state,
    learnerText: 'The ledger seal does match the harbor registry entry; my frame objection stands.',
    turnNumber: 8,
    nodeText: MET_NODE_TASK,
    latestTutorText: MET_HISTORY[1].content,
  });
  assert.deepEqual(verdict, {
    label: 'bridge_step_taken',
    taken: true,
    quote: 'does match the harbor registry entry',
  });
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].schema, 'machinespirits.tutor-stub.rival-dag-bridge-step-adjudication.v1');
  assert.deepEqual(prompts[0].labels, ['bridge_step_taken', 'bridge_step_not_taken']);
  assert.equal(prompts[0].named_open_rival_item, MET_NODE_TASK);
  const traceEvent = state.trace.find((event) => event.type === 'rival_dag_bridge_step_adjudication');
  assert.equal(traceEvent.seatId, 'bridge_step_adjudicator');
  assert.equal(traceEvent.validLabel, true);
});

test('an unregistered label from the adjudicator fails the measurement, not the learner', async () => {
  const faceB = tutorStubResistantLearnerMergedFaceDesign(load(V3_DESIGN_PATH).design, 'faceB');
  const { runtime, state } = bridgeAdjudicatorRuntime({
    design: faceB,
    respond: () => ({ label: 'maybe', quote: null }),
  });
  await assert.rejects(
    () =>
      runtime.adjudicateRivalDagBridgeStep({
        state,
        learnerText: REFUSAL_DRAFT,
        turnNumber: 8,
        nodeText: MET_NODE_TASK,
        latestTutorText: MET_HISTORY[1].content,
      }),
    (error) => {
      assert.equal(error.code, 'tutor_stub_rival_dag_bridge_step_adjudication_indeterminate');
      assert.equal(error.measurementIndeterminate, true);
      assert.equal(error.recoverable, false);
      return true;
    },
  );
  const traceEvent = state.trace.find((event) => event.type === 'rival_dag_bridge_step_adjudication');
  assert.equal(traceEvent.validLabel, false);
  assert.equal(traceEvent.label, null);
});

test('the adjudicator refuses a drifted route and an unregistered design', async () => {
  const faceBv3 = tutorStubResistantLearnerMergedFaceDesign(load(V3_DESIGN_PATH).design, 'faceB');
  const drifted = bridgeAdjudicatorRuntime({
    design: faceBv3,
    respond: () => ({ label: 'bridge_step_taken', quote: 'x' }),
    resolve: () => ({ provider: 'openrouter', model: 'nemotron' }),
  });
  await assert.rejects(
    () =>
      drifted.runtime.adjudicateRivalDagBridgeStep({
        state: drifted.state,
        learnerText: REFUSAL_DRAFT,
        turnNumber: 8,
        nodeText: MET_NODE_TASK,
        latestTutorText: MET_HISTORY[1].content,
      }),
    /bridge-step adjudicator route drift/,
  );

  const faceBv2 = tutorStubResistantLearnerMergedFaceDesign(load(V2_DESIGN_PATH).design, 'faceB');
  const unregistered = bridgeAdjudicatorRuntime({
    design: faceBv2,
    respond: () => ({ label: 'bridge_step_taken', quote: 'x' }),
  });
  await assert.rejects(
    () =>
      unregistered.runtime.adjudicateRivalDagBridgeStep({
        state: unregistered.state,
        learnerText: REFUSAL_DRAFT,
        turnNumber: 8,
        nodeText: MET_NODE_TASK,
        latestTutorText: MET_HISTORY[1].content,
      }),
    /bridge-step enforcement is not registered/,
  );
});

test('both revision-3 typed failure codes cross the child-process boundary as registered outcomes', () => {
  for (const code of [
    'tutor_stub_learner_noncompliance',
    'tutor_stub_rival_dag_bridge_step_adjudication_indeterminate',
  ]) {
    assert.ok(TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_CODES.includes(code));
    const error = new Error('typed failure');
    error.code = code;
    error.substantiveStudyFailure = true;
    const outcome = tutorStubRegisteredStudyOutcomeFromError({ error, jobId: 'faceB-bridge-fixture' });
    assert.equal(outcome?.status, 'retained_substantive_failure');
    assert.equal(outcome?.code, code);
    assert.equal(outcome?.recoverable, false);
    assert.equal(outcome?.replacement_allowed, false);
  }
});

test('a taken verdict without a verbatim learner-draft quote is indeterminate, never a pass', async () => {
  const faceB = tutorStubResistantLearnerMergedFaceDesign(load(V3_DESIGN_PATH).design, 'faceB');
  const draft = 'The ledger seal does match the harbor registry entry; my frame objection stands.';
  for (const quote of [null, 'a fabricated quote that is not in the draft', '   ']) {
    const { runtime, state } = bridgeAdjudicatorRuntime({
      design: faceB,
      respond: () => ({ label: 'bridge_step_taken', quote }),
    });
    await assert.rejects(
      () =>
        runtime.adjudicateRivalDagBridgeStep({
          state,
          learnerText: draft,
          turnNumber: 8,
          nodeText: MET_NODE_TASK,
          latestTutorText: MET_HISTORY[1].content,
        }),
      (error) => {
        assert.equal(error.code, 'tutor_stub_rival_dag_bridge_step_adjudication_indeterminate');
        assert.equal(error.measurementIndeterminate, true);
        return true;
      },
    );
    const traceEvent = state.trace.find((event) => event.type === 'rival_dag_bridge_step_adjudication');
    assert.equal(traceEvent.quoteVerified, false);
    assert.equal(traceEvent.quote, null);
  }
});

test('tampered enforcement contracts fail the design validator', () => {
  const pristine = load(V3_DESIGN_PATH).design;
  const enforcementOf = (design) => design.populationStrata.faceB.rivalDagPersona.concessionEnforcement;

  const tampers = [
    (enforcement) => {
      enforcement.check.adjudicatorSeat.model = 'gpt-5.6-luna';
    },
    (enforcement) => {
      enforcement.check.adjudicatorSeat.effort = 'high';
    },
    (enforcement) => {
      enforcement.check.labels = ['bridge_step_taken', 'bridge_step_not_taken', 'unsure'];
    },
    (enforcement) => {
      enforcement.check.question = 'Did the learner comply?';
    },
    (enforcement) => {
      enforcement.repairInstruction = 'Please try again.';
    },
    (enforcement) => {
      enforcement.check.rejectedMechanicalChecks.measurements.met_turns_narrowed_markers_min3 = 5;
    },
  ];
  for (const tamper of tampers) {
    const design = structuredClone(pristine);
    tamper(enforcementOf(design));
    assert.equal(validateTutorStubResistantLearnerDesign(design).valid, false);
  }
});

test('the v3 semantic registration validates exactly and tampered copies fail closed', () => {
  const pristine = registrationV3();
  const judges = load(V3_DESIGN_PATH).design.measurement.readerPanel.judges;
  const check = (registration) =>
    tutorStubResistantLearnerMergedSemanticRegistrationIssues({
      registrationPath: V3_REGISTRATION_PATH,
      registration,
      judges,
    });
  assert.deepEqual(check(pristine), []);

  const tampers = [
    (registration) => {
      registration.instrument.endpointDefinition =
        'final_graded_engagement_rung is the highest rung of the final turn.';
    },
    (registration) => {
      registration.appliesToDesignRevision = 4;
    },
    (registration) => {
      registration.supersedesRegistration.sha256 = registration.supersedesRegistration.sha256.replace(/^./, '0');
    },
    (registration) => {
      registration.visibility.rivalDagVisible = true;
    },
    (registration) => {
      delete registration.dispositions.learner_noncompliance;
    },
    (registration) => {
      registration.instrument.faces.faceB.rungAnchors['2'] = 'Any engagement scores 2.';
    },
    (registration) => {
      registration.instrument.faces.faceA.workedExamples.pop();
    },
  ];
  for (const tamper of tampers) {
    const registration = structuredClone(pristine);
    tamper(registration);
    assert.equal(check(registration).length > 0, true);
  }
});
