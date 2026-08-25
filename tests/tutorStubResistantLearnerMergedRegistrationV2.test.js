import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
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
  buildTutorStubResistantLearnerSemanticPrompt,
  createTutorStubResistantLearnerSemanticRuntime,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V1_DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v1.json';
const V2_DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v2.json';
const V2_REGISTRATION_PATH = 'config/tutor-stub-resistant-learner-merged-semantic-registration.v2.json';

function load(relativePath) {
  return loadTutorStubResistantLearnerDesign({ designPath: relativePath, root: ROOT });
}

function registrationV2() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, V2_REGISTRATION_PATH), 'utf8'));
}

function primaryPrompt({ design, study }) {
  return buildTutorStubResistantLearnerSemanticPrompt({
    caseId: 'v2-prompt-fixture',
    study,
    instrument: 'primary',
    publicPacket: { trigger: 'a', intervention: 'b' },
    judge: { id: 'probe', modelRef: 'codex.gpt-5.6-sol', effort: 'low' },
    design,
  });
}

function semanticRaw({ prompt, route, rung = '1', quote, face = 'faceA', caseId }) {
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
    text: JSON.stringify({
      schema: prompt.output_schema.properties.schema.enum[0],
      case_id: caseId ?? prompt.case_id,
      judgment,
    }),
    provider: route.provider,
    model: route.model,
    effort: 'low',
    structuredOutput: true,
    prohibitedToolEventCountObserved: true,
    prohibitedToolEventCount: 0,
  };
}

const FIXTURE_QUOTE = "I'm not choosing between those booking records yet.";
const SLIPPED_CASE_ID = 'faceA_semantic-fixture';

// script: one entry per transport call, in order. Each entry may slip the
// echoed case id and/or return an out-of-ladder rung value.
async function runScriptedPanel({ design, script }) {
  let callIndex = 0;
  const prompts = [];
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
      const step = script[callIndex];
      callIndex += 1;
      prompts.push(prompt);
      const parsed = JSON.parse(prompt);
      return semanticRaw({
        prompt: parsed,
        route: resolved,
        rung: step.rung ?? '1',
        quote: FIXTURE_QUOTE,
        face: 'faceA',
        caseId: step.slip ? SLIPPED_CASE_ID : undefined,
      });
    },
  });
  const state = {
    trace: [],
    resistanceActionRegisterStudy: {
      resistant_learner_calibration: true,
      resistant_learner_study: 'B1',
      job_id: 'faceA-semantic-fixture',
      design,
    },
  };
  const publicPacket = {
    trigger: 'The rival record still matters.',
    intervention: 'Which public record would separate the two live possibilities?',
    post_1: FIXTURE_QUOTE,
  };
  const result = await runtime.adjudicatePrimaryPanel({ state, turnNumber: 6, publicPacket });
  return { result, calls: callIndex, prompts, trace: state.trace };
}

test('v2 design supersedes v1 by byte pin and plans 36 jobs on the longer faceB horizon', () => {
  const v1 = load(V1_DESIGN_PATH);
  const v2 = load(V2_DESIGN_PATH);
  assert.equal(v2.design.revision, 2);
  assert.equal(v2.design.supersedes.priorDesign, V1_DESIGN_PATH);
  assert.equal(v2.design.supersedes.priorDesignSha256, crypto.createHash('sha256').update(v1.source).digest('hex'));
  assert.equal(v2.design.supersedes.reuse, false);
  assert.equal(v2.design.measurement.semanticRegistration, V2_REGISTRATION_PATH);
  assert.equal(v2.design.measurement.readerPanel.protocolSource, V2_REGISTRATION_PATH);

  const plan = buildTutorStubResistantLearnerCalibrationPlan(v2.design);
  assert.equal(plan.jobs.length, 36);
  const faceA = plan.jobs.filter((job) => job.face_id === 'faceA');
  const faceB = plan.jobs.filter((job) => job.face_id === 'faceB');
  assert.equal(faceA.length, 18);
  assert.equal(faceB.length, 18);
  assert.ok(faceA.every((job) => job.outcome_horizon_learner_turns === 5));
  assert.ok(faceB.every((job) => job.outcome_horizon_learner_turns === 8));

  const ceilings = v2.design.attemptCeilings;
  assert.equal(ceilings.plannedCallsPerDialogue, 56);
  assert.equal(ceilings.plannedCallsCalibration, 2016);
  assert.equal(ceilings.plannedCallsCalibration, plan.jobs.length * ceilings.plannedCallsPerDialogue);
  assert.equal(ceilings.maximumReservationsPerDialogue, 174);
  assert.equal(ceilings.calibrationMaximumReservations, 6264);
});

test('sealed v1 design still validates with its original horizon and ceilings', () => {
  const v1 = load(V1_DESIGN_PATH);
  assert.equal(v1.design.revision, 1);
  assert.equal(v1.design.supersedes, undefined);
  assert.equal(v1.design.populationStrata.faceB.population.outcomeHorizonPostTriggerLearnerTurns, 6);
  assert.equal(v1.design.attemptCeilings.plannedCallsCalibration, 1584);
  assert.equal(v1.design.attemptCeilings.calibrationMaximumReservations, 4968);
});

test('tampered v2 designs fail closed against the revision pins', () => {
  const pristine = load(V2_DESIGN_PATH).design;

  const shortHorizon = structuredClone(pristine);
  shortHorizon.populationStrata.faceB.population.outcomeHorizonPostTriggerLearnerTurns = 6;
  assert.equal(validateTutorStubResistantLearnerDesign(shortHorizon).valid, false);

  const wrongCeiling = structuredClone(pristine);
  wrongCeiling.attemptCeilings.plannedCallsCalibration = 1584;
  assert.equal(validateTutorStubResistantLearnerDesign(wrongCeiling).valid, false);

  const wrongPin = structuredClone(pristine);
  wrongPin.supersedes.priorDesignSha256 = wrongPin.supersedes.priorDesignSha256.replace(/^./, '0');
  assert.equal(validateTutorStubResistantLearnerDesign(wrongPin).valid, false);

  const unknownRevision = structuredClone(pristine);
  unknownRevision.revision = 3;
  assert.equal(validateTutorStubResistantLearnerDesign(unknownRevision).valid, false);

  assert.equal(validateTutorStubResistantLearnerDesign(pristine).valid, true);
});

test('v2 judge prompts carry the registered rung anchors and worked examples; v1 prompts carry none', () => {
  const v1 = load(V1_DESIGN_PATH).design;
  const v2 = load(V2_DESIGN_PATH).design;
  const registration = registrationV2();
  for (const [study, faceId] of [
    ['B1', 'faceA'],
    ['R1', 'faceB'],
  ]) {
    const face = registration.instrument.faces[faceId];
    const v2Text = primaryPrompt({ design: v2, study }).instructions.join('\n');
    for (const rung of ['0', '1', '2']) {
      assert.ok(v2Text.includes(`Rung ${rung} anchor: ${face.rungAnchors[rung]}`));
    }
    for (const example of face.workedExamples) {
      assert.ok(v2Text.includes(`Worked example (rung ${example.rung}): "${example.quote}"`));
    }
    const v1Text = primaryPrompt({ design: v1, study }).instructions.join('\n');
    assert.ok(!v1Text.includes('anchor:'));
    assert.ok(!v1Text.includes('Worked example'));
  }
  const horizonLine = primaryPrompt({ design: v2, study: 'R1' }).instructions[0];
  assert.ok(horizonLine.includes('8-post-trigger-learner-turn'));
});

test('echo-slip tolerance re-asks once with the byte-identical prompt and the seat recovers', async () => {
  const faceA = tutorStubResistantLearnerMergedFaceDesign(load(V2_DESIGN_PATH).design, 'faceA');
  const { result, calls, prompts, trace } = await runScriptedPanel({
    design: faceA,
    script: [{ slip: true }, {}, {}],
  });
  assert.equal(calls, 3);
  assert.equal(prompts[0], prompts[1]);
  assert.equal(result.status, 'determinate');
  assert.equal(result.fields.final_graded_engagement_rung.value, '1');
  assert.equal(result.seats.length, 2);
  const [first, second] = result.seats;
  assert.equal(first.validation.valid, true);
  assert.equal(first.echo_slip_retry_used, true);
  assert.equal(second.echo_slip_retry_used, false);
  const readerEvents = trace.filter((event) => event.type === 'resistant_learner_semantic_reader_result');
  assert.equal(readerEvents.length, 3);
  assert.deepEqual(
    readerEvents.map((event) => [event.echoSlipSeatAttempt, event.echoSlipRetryScheduled]),
    [
      [1, true],
      [2, false],
      [1, false],
    ],
  );
});

test('no retry when the slipped seat carries any other defect', async () => {
  const faceA = tutorStubResistantLearnerMergedFaceDesign(load(V2_DESIGN_PATH).design, 'faceA');
  const { result, calls } = await runScriptedPanel({
    design: faceA,
    script: [{ slip: true, rung: '9' }, {}],
  });
  assert.equal(calls, 2);
  const [first] = result.seats;
  assert.equal(first.validation.valid, false);
  assert.equal(first.echo_slip_retry_used, false);
});

test('a second identity slip leaves the seat invalid after exactly one retry', async () => {
  const faceA = tutorStubResistantLearnerMergedFaceDesign(load(V2_DESIGN_PATH).design, 'faceA');
  const { result, calls } = await runScriptedPanel({
    design: faceA,
    script: [{ slip: true }, { slip: true }, {}],
  });
  assert.equal(calls, 3);
  const [first, second] = result.seats;
  assert.equal(first.validation.valid, false);
  assert.deepEqual(first.validation.issues, ['identity_mismatch']);
  assert.equal(first.echo_slip_retry_used, true);
  assert.equal(second.validation.valid, true);
  assert.equal(result.status, 'measurement_indeterminate');
});

test('the sealed v1 instrument never retries an identity slip', async () => {
  const faceA = tutorStubResistantLearnerMergedFaceDesign(load(V1_DESIGN_PATH).design, 'faceA');
  const { result, calls } = await runScriptedPanel({
    design: faceA,
    script: [{ slip: true }, {}],
  });
  assert.equal(calls, 2);
  const [first] = result.seats;
  assert.equal(first.validation.valid, false);
  assert.deepEqual(first.validation.issues, ['identity_mismatch']);
  assert.ok(!('echo_slip_retry_used' in first));
});
