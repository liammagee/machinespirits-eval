import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  loadTutorStubResistantLearnerDesign,
  tutorStubFrameRefuserDepthArmDesign,
  tutorStubResistantLearnerMergedFaceDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubResistantLearnerSemanticPrompt,
  createTutorStubResistantLearnerSemanticRuntime,
  tutorStubResistantLearnerMergedSemanticRegistrationIssues,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MERGED_DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v5.json';
const DEPTH_DESIGN_PATH = 'config/tutor-stub-frame-refuser-depth-design.v5.json';
const REGISTRATION_V5_PATH = 'config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json';
const REGISTRATION_V6_PATH = 'config/tutor-stub-resistant-learner-merged-semantic-registration.v6.json';
// CLAUDE.md (2026-08-21, 2026-09-03): byte pins are for sealed data only.
// Designs and registrations are files a defect correction has to touch, so a
// pin here turns red on a one-line fix and pushes the next agent to write a
// numbered copy. Their digests are recorded and read, never enforced.
const RECORDED_PRIOR_ERA = Object.freeze([
  MERGED_DESIGN_PATH,
  REGISTRATION_V5_PATH,
  'config/tutor-stub-frame-refuser-depth-design.v4.json',
]);

function readRegistration(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function loadDesign(relativePath) {
  return loadTutorStubResistantLearnerDesign({ designPath: relativePath, root: ROOT });
}

function depthTreatmentArmDesign() {
  return tutorStubFrameRefuserDepthArmDesign(loadDesign(DEPTH_DESIGN_PATH).design, 'treatment', { root: ROOT });
}

test('revision 6 reads the v5-era bytes and moves only its four registered amendment surfaces', () => {
  for (const relativePath of RECORDED_PRIOR_ERA) {
    const bytes = fs.readFileSync(path.join(ROOT, relativePath));
    assert.match(crypto.createHash('sha256').update(bytes).digest('hex'), /^[0-9a-f]{64}$/u, relativePath);
    assert.equal(typeof JSON.parse(bytes.toString('utf8')), 'object', relativePath);
  }
  const v5 = readRegistration(REGISTRATION_V5_PATH);
  const v6 = readRegistration(REGISTRATION_V6_PATH);
  assert.equal(v6.version, 6);
  assert.equal(v6.appliesToDesignRevision, 5);
  assert.equal(v6.supersedesRegistration.path, REGISTRATION_V5_PATH);
  assert.match(v6.supersedesRegistration.sha256, /^[0-9a-f]{64}$/u);
  assert.equal(v6.supersedesRegistration.reuse, false);

  // Amendment 1: the evidence instruction states the null contract outright.
  assert.ok(v6.evidenceContract.promptInstruction.includes('Null means the JSON literal null'));
  assert.ok(v6.evidenceContract.promptInstruction.includes('Never attach quotes to justify a no.'));
  // Amendment 2: the registered one-retry evidence-null slip tolerance.
  const slip = v6.readerPanel.evidenceNullSlipTolerance;
  assert.equal(slip.retryOn, 'evidence_invalid_null_required_as_only_field_issue');
  assert.equal(slip.maximumRetriesPerSeatCall, 1);
  assert.equal(slip.promptChange, 'none');
  assert.equal(slip.secondFailureDisposition, 'field_remains_ineligible');
  assert.equal(slip.recordedOnSeatRecord, true);
  // Amendment 3 (schema salience) is exercised in the prompt test below.
  // Amendment 4: three face-B worked examples appended after the sealed four.
  assert.equal(v6.instrument.faces.faceB.workedExamples.length, 7);
  assert.deepEqual(v6.instrument.faces.faceB.workedExamples.slice(0, 4), v5.instrument.faces.faceB.workedExamples);
  assert.deepEqual(
    v6.instrument.faces.faceB.workedExamples.slice(4).map((example) => example.rung),
    ['1', '1', '2'],
  );

  // Everything else is byte-identical to v5: rungs, anchors, echo guard,
  // endpoint, consensus, backstop, judges, visibility, dispositions, policy.
  assert.deepEqual(v6.instrument.faces.faceA, v5.instrument.faces.faceA);
  const faceBWithoutExamples = ({ workedExamples: _workedExamples, ...rest }) => rest;
  assert.deepEqual(faceBWithoutExamples(v6.instrument.faces.faceB), faceBWithoutExamples(v5.instrument.faces.faceB));
  const panelWithoutSlip = ({ evidenceNullSlipTolerance: _evidenceNullSlipTolerance, ...rest }) => rest;
  assert.deepEqual(panelWithoutSlip(v6.readerPanel), v5.readerPanel);
  const contractWithoutInstruction = ({ promptInstruction: _promptInstruction, ...rest }) => rest;
  assert.deepEqual(contractWithoutInstruction(v6.evidenceContract), contractWithoutInstruction(v5.evidenceContract));
  assert.deepEqual(v6.instrument.endpointValues, v5.instrument.endpointValues);
  assert.equal(v6.instrument.endpointDefinition, v5.instrument.endpointDefinition);
  assert.deepEqual(v6.visibility, v5.visibility);
  assert.deepEqual(v6.dispositions, v5.dispositions);
  assert.deepEqual(v6.calibrationDecisionPolicy, v5.calibrationDecisionPolicy);
});

test('revision-6 checker passes the registered file and fails closed on every amendment surface', () => {
  const judges = loadDesign(MERGED_DESIGN_PATH).design.measurement.readerPanel.judges;
  const check = (registrationPath, candidate) =>
    tutorStubResistantLearnerMergedSemanticRegistrationIssues({
      registrationPath,
      registration: candidate,
      judges,
    });
  const v6 = readRegistration(REGISTRATION_V6_PATH);
  assert.deepEqual(check(REGISTRATION_V6_PATH, v6), []);
  for (const mutate of [
    (value) => delete value.readerPanel.evidenceNullSlipTolerance,
    (value) => (value.readerPanel.evidenceNullSlipTolerance.retryOn = 'any_evidence_issue'),
    (value) => (value.readerPanel.evidenceNullSlipTolerance.maximumRetriesPerSeatCall = 2),
    (value) => (value.readerPanel.evidenceNullSlipTolerance.promptChange = 'sharpened'),
    (value) => (value.readerPanel.evidenceNullSlipTolerance.secondFailureDisposition = 'retry_until_valid'),
    (value) => value.instrument.faces.faceB.workedExamples.pop(),
    (value) =>
      (value.evidenceContract.promptInstruction = value.evidenceContract.promptInstruction.replace(
        'Null means the JSON literal null',
        'Null usually means null',
      )),
    (value) => (value.readerPanel.consensus = 'Any plurality wins.'),
  ]) {
    const candidate = structuredClone(v6);
    mutate(candidate);
    assert.ok(check(REGISTRATION_V6_PATH, candidate).length > 0);
  }
  // The tolerance is registered from v6 onward only: a v5 file that grows the
  // block without a superseding registration must fail its own pin.
  const v5 = readRegistration(REGISTRATION_V5_PATH);
  assert.deepEqual(check(REGISTRATION_V5_PATH, v5), []);
  const v5WithSlip = structuredClone(v5);
  v5WithSlip.readerPanel.evidenceNullSlipTolerance = structuredClone(v6.readerPanel.evidenceNullSlipTolerance);
  assert.ok(check(REGISTRATION_V5_PATH, v5WithSlip).length > 0);
});

test('revision-6 schema salience appears only where the depth arm projection binds the v6 protocol', () => {
  const armDesign = depthTreatmentArmDesign();
  const parentFaceB = tutorStubResistantLearnerMergedFaceDesign(loadDesign(MERGED_DESIGN_PATH).design, 'faceB');
  // The projection override is the amendment's carrier: the depth arm reads
  // the v6 protocol while the sealed parent face keeps its v5 pointer.
  assert.equal(armDesign.measurement.readerPanel.protocolSource, REGISTRATION_V6_PATH);
  assert.equal(parentFaceB.measurement.readerPanel.protocolSource, REGISTRATION_V5_PATH);
  const packet = {
    trigger: 'I dispute the standing of your wider question.',
    intervention: 'The mint-yard ledger separates the two crucibles?',
    post_1: 'I will run the touchstone assay under protest while reserving the wider frame.',
    tutor_1: 'The assay bears on the named condition.',
  };
  const build = (design, instrument) =>
    buildTutorStubResistantLearnerSemanticPrompt({
      caseId: 'salience-scope',
      study: 'R1',
      instrument,
      publicPacket: instrument === 'fidelity' ? { intervention: packet.intervention } : packet,
      judge: design.models.finalSemanticReaders[0],
      design,
    });
  const evidenceQuotesSchema = (prompt, field) =>
    prompt.output_schema.properties.judgment.properties[field].properties.evidence_quotes;
  const v6Primary = build(armDesign, 'primary');
  assert.match(evidenceQuotesSchema(v6Primary, 'final_graded_engagement_rung').description, /JSON literal null/u);
  assert.match(evidenceQuotesSchema(v6Primary, 'whole_frame_compliance').description, /JSON literal null/u);
  assert.ok(v6Primary.instructions.some((line) => line.includes('Never attach quotes to justify a no.')));
  const v6Fidelity = build(armDesign, 'fidelity');
  assert.match(
    evidenceQuotesSchema(v6Fidelity, 'delivered_test_bounded_distinction').description,
    /JSON literal null/u,
  );
  // The sealed v5 prompt bytes must not move: no description, old instruction.
  const v5Primary = build(parentFaceB, 'primary');
  assert.equal(evidenceQuotesSchema(v5Primary, 'final_graded_engagement_rung').description, undefined);
  assert.equal(evidenceQuotesSchema(v5Primary, 'whole_frame_compliance').description, undefined);
  assert.ok(!v5Primary.instructions.some((line) => line.includes('Never attach quotes to justify a no.')));
});

const SLIP_PACKET = Object.freeze({
  trigger: 'I dispute the standing of your wider question.',
  intervention: 'The mint-yard ledger separates the two crucibles?',
  post_1: 'I will run the touchstone assay under protest while reserving the wider frame.',
  tutor_1: 'The assay bears on the named condition.',
});

// A faceB primary seat answer whose only defect, when slipComplianceQuotes is
// true, is the revision-4 slip: a stated no-vote carrying quotes where the
// contract demands JSON null.
function seatOutput(prompt, { slipComplianceQuotes }) {
  const parsed = JSON.parse(prompt);
  return JSON.stringify({
    schema: parsed.output_schema.properties.schema.enum[0],
    case_id: parsed.case_id,
    judgment: {
      final_graded_engagement_rung: {
        value: '2',
        evidence_quotes: [{ source_id: 'post_1', text: SLIP_PACKET.post_1 }],
        confidence: 'high',
        indeterminacy_reason: 'none',
      },
      final_jurisdictional_dispute_retained: {
        value: 'yes',
        evidence_quotes: [{ source_id: 'trigger', text: SLIP_PACKET.trigger }],
        confidence: 'high',
        indeterminacy_reason: 'none',
      },
      whole_frame_compliance: {
        value: 'no',
        evidence_quotes: slipComplianceQuotes ? [{ source_id: 'trigger', text: SLIP_PACKET.trigger }] : null,
        confidence: 'high',
        indeterminacy_reason: 'none',
      },
    },
  });
}

async function runPrimaryPanel({ design, respond }) {
  const trace = [];
  const attemptsByRole = new Map();
  const runtime = createTutorStubResistantLearnerSemanticRuntime({
    appendTraceEvent(target, event) {
      target.push(event);
    },
    resolveModel(modelRef) {
      return modelRef === 'codex.gpt-5.6-sol'
        ? { provider: 'codex', model: 'gpt-5.6-sol' }
        : modelRef === 'claude-code.sonnet-5'
          ? { provider: 'claude-code', model: 'claude-sonnet-5' }
          : { provider: 'claude-code', model: 'claude-opus-5' };
    },
    async callPromptModel({ prompt, resolved, role }) {
      const attempt = (attemptsByRole.get(role) || 0) + 1;
      attemptsByRole.set(role, attempt);
      return {
        text: respond({ prompt, attempt }),
        provider: resolved.provider,
        model: resolved.model,
        effort: 'low',
        structuredOutput: true,
        prohibitedToolEventCountObserved: true,
        prohibitedToolEventCount: 0,
      };
    },
  });
  const panel = await runtime.adjudicatePrimaryPanel({
    state: {
      trace,
      resistanceActionRegisterStudy: {
        resistant_learner_calibration: true,
        resistant_learner_study: 'R1',
        job_id: 'depth-slip-case',
        design,
      },
    },
    turnNumber: 9,
    publicPacket: { ...SLIP_PACKET },
  });
  return { panel, trace, attemptsByRole };
}

test('revision-6 evidence-null slip retry recovers a quotes-on-no seat with one byte-identical re-ask', async () => {
  const { panel, trace, attemptsByRole } = await runPrimaryPanel({
    design: depthTreatmentArmDesign(),
    respond: ({ prompt, attempt }) => seatOutput(prompt, { slipComplianceQuotes: attempt === 1 }),
  });
  assert.equal(attemptsByRole.size, 3);
  for (const attempts of attemptsByRole.values()) assert.equal(attempts, 2);
  assert.equal(panel.status, 'determinate');
  assert.equal(panel.fields.whole_frame_compliance.status, 'determinate');
  assert.equal(panel.fields.whole_frame_compliance.value, 'no');
  assert.equal(panel.fields.whole_frame_compliance.eligible_vote_count, 3);
  assert.equal(panel.seats.length, 3);
  for (const seat of panel.seats) {
    assert.equal(seat.evidence_null_slip_retry_used, true);
    assert.equal(seat.echo_slip_retry_used, false);
    assert.equal(seat.validation.valid, true);
  }
  const readerEvents = trace.filter((event) => event.type === 'resistant_learner_semantic_reader_result');
  assert.equal(readerEvents.length, 6);
  assert.equal(readerEvents.filter((event) => event.evidenceNullSlipRetryScheduled === true).length, 3);
  assert.ok(readerEvents.every((event) => event.echoSlipRetryScheduled === false));
});

test('revision-6 second slip leaves the field ineligible and never earns a third call', async () => {
  const { panel, attemptsByRole } = await runPrimaryPanel({
    design: depthTreatmentArmDesign(),
    respond: ({ prompt }) => seatOutput(prompt, { slipComplianceQuotes: true }),
  });
  // The ceiling reserves headroom for one echo retry and one evidence retry,
  // but a repeated evidence slip spends only its own: two calls, never three.
  for (const attempts of attemptsByRole.values()) assert.equal(attempts, 2);
  assert.equal(panel.status, 'measurement_indeterminate');
  assert.equal(panel.fields.whole_frame_compliance.status, 'measurement_indeterminate');
  assert.deepEqual(panel.fields.whole_frame_compliance.eligible_judges, []);
  assert.equal(panel.fields.final_graded_engagement_rung.status, 'determinate');
  assert.equal(panel.fields.final_jurisdictional_dispute_retained.status, 'determinate');
  for (const seat of panel.seats) {
    assert.equal(seat.evidence_null_slip_retry_used, true);
    assert.equal(seat.validation.fields.whole_frame_compliance.eligible, false);
    assert.deepEqual(seat.validation.fields.whole_frame_compliance.issues, ['evidence_invalid']);
  }
});

test('sealed v5 parent face grants the slip no retry and records no tolerance flag', async () => {
  const { panel, attemptsByRole } = await runPrimaryPanel({
    design: tutorStubResistantLearnerMergedFaceDesign(loadDesign(MERGED_DESIGN_PATH).design, 'faceB'),
    respond: ({ prompt }) => seatOutput(prompt, { slipComplianceQuotes: true }),
  });
  for (const attempts of attemptsByRole.values()) assert.equal(attempts, 1);
  assert.equal(panel.fields.whole_frame_compliance.status, 'measurement_indeterminate');
  for (const seat of panel.seats) {
    assert.ok(!('evidence_null_slip_retry_used' in seat));
    assert.equal(seat.validation.fields.whole_frame_compliance.eligible, false);
  }
});
