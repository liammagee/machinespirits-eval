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
  summarizeTutorStubResistantLearnerCalibration,
  tutorStubResistantLearnerMergedFaceDesign,
  validateTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubResistantLearnerSemanticPrompt,
  createTutorStubResistantLearnerSemanticRuntime,
  tutorStubResistantLearnerSemanticFieldConsensus,
  tutorStubResistantLearnerMergedSemanticRegistrationIssues,
} from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import {
  TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_CODES,
  tutorStubRegisteredStudyOutcomeFromError,
} from '../services/tutorStubRegisteredStudyOutcome.js';
import {
  TUTOR_STUB_TUTOR_DISCRIMINATING_QUESTION_NON_DELIVERY_CODE,
  applyTutorStubR1TutorDeliveryGate,
} from '../services/tutorStubR1TutorDeliveryGate.js';
import { runTutorStubResistantLearnerMergedPreflight } from '../services/tutorStubResistantLearnerMergedLaunch.js';
import {
  buildReplayTask,
  candidateContract,
  RESISTANT_LEARNER_V5_REHEARSAL_ATTEMPT_CEILING,
  V5_REGISTERED_READER_SEATS,
  V5_REHEARSAL_CANDIDATE,
  validateReplayOutput,
} from '../scripts/replay-tutor-stub-resistant-learner-v4-candidates.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v5.json';
const REGISTRATION_PATH = 'config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json';
const SEALED = Object.freeze({
  'config/tutor-stub-resistant-learner-merged-design.v1.json':
    '9c5a6415758bfb154e11cf168b6d60c3376cd62ab9665f4ac5311fd1f71db903',
  'config/tutor-stub-resistant-learner-merged-design.v2.json':
    'eb1991fd301d12865983b4f6b8333ee77e7e869506c023858dc5faec08090744',
  'config/tutor-stub-resistant-learner-merged-design.v3.json':
    '4f9f2ce116ef2abef8ed9f8871035d23a8f023def7aec56c53da9590b1c19e0a',
  'config/tutor-stub-resistant-learner-merged-design.v4.json':
    '2ec740b652c724c42fc49eca7302d4ace7e6d946c5b6d06d45df8ffbe434a969',
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v1.json':
    'c76f63838a3649c7f3c6ec1a0201449e13d1aceda07596bdd8aee5144ce48bd6',
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v2.json':
    '43fc5b1e69dd9e4c48c186c4b36fcdd3d6542e2800b598bc74c84ef3852b634d',
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v3.json':
    '10842ae31b797a5dc705af95595d3c5a25754aa8feb48ff43ea855d98aabef14',
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v4.json':
    '03133a7a7c74180cd07cbdbd776f61933d9cfd9f5b77b56e2a2e947408f323d4',
});

function loadDesign(relativePath = DESIGN_PATH) {
  return loadTutorStubResistantLearnerDesign({ designPath: relativePath, root: ROOT });
}

function registrationV5() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRATION_PATH), 'utf8'));
}

test('revision 5 preserves sealed v1-v4 bytes and recomputes the three-seat ceiling', () => {
  for (const [relativePath, expected] of Object.entries(SEALED)) {
    const bytes = fs.readFileSync(path.join(ROOT, relativePath));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected, relativePath);
  }
  const loaded = loadDesign();
  assert.equal(validateTutorStubResistantLearnerDesign(loaded.design).valid, true);
  assert.equal(buildTutorStubResistantLearnerCalibrationPlan(loaded.design).jobs.length, 36);
  assert.equal(loaded.design.attemptCeilings.callPlanPerDialogue.primaryReaderSeats, 3);
  assert.equal(loaded.design.attemptCeilings.callPlanPerDialogue.fidelityReaderSeats, 2);
  assert.equal(loaded.design.attemptCeilings.callPlanPerDialogue.echoSlipRetryReserve, 5);
  assert.equal(loaded.design.attemptCeilings.plannedCallsPerDialogue, 64);
  assert.equal(loaded.design.attemptCeilings.plannedCallsCalibration, 2304);
  assert.equal(loaded.design.attemptCeilings.plannedCallReservationCeilingPerDialogue, 192);
  assert.equal(loaded.design.attemptCeilings.maximumReservationsPerDialogue, 198);
  assert.equal(loaded.design.attemptCeilings.calibrationMaximumReservations, 7128);
  assert.equal(loaded.design.callAuthority.grantsModelCalls, false);
});

test('revision-5 design pin fails closed across both delivery contracts, measurement, policy, and claim', () => {
  const pristine = loadDesign().design;
  const mutations = [
    (value) => (value.populationStrata.faceA.tutorDeliveryContract.enforcement.check.question = 'Did it ask?'),
    (value) => (value.populationStrata.faceA.tutorDeliveryContract.enforcement.exhaustionCode = 'learner_failure'),
    (value) => (value.populationStrata.faceA.tutorDeliveryContract.enforcement.repairsAllowedPerEpisode = 2),
    (value) => (value.populationStrata.faceB.tutorDeliveryContract.enforcement.check.question = 'Did it bridge?'),
    (value) => (value.populationStrata.faceB.rivalDagPersona.concessionEnforcement.check.question = 'Any pickup?'),
    (value) => (value.populationStrata.faceA.measurement.rungs[1].definition = 'Any condition.'),
    (value) => (value.populationStrata.faceB.measurement.echoGuard = 'No echo guard.'),
    (value) => value.models.finalSemanticReaders.pop(),
    (value) => (value.measurement.readerPanel.fidelityJudges = ['claude-code.opus']),
    (value) => (value.calibration.commonChannelAliveRules.minimumMeanPairwiseExactAgreementBackstop = 0.49),
    (value) => (value.calibration.decisionPolicy.primaryReaderAgreementScope = ['delivered_register']),
    (value) =>
      (value.calibration.decisionPolicy.reportOnlyDiagnostics.mayAffectVerdictEligibilityScoringOrRowSelection = true),
    (value) => (value.claimBoundary = 'Anything may be claimed.'),
    (value) => (value.attemptCeilings.calibrationMaximumReservations = 6911),
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(pristine);
    mutate(candidate);
    assert.equal(validateTutorStubResistantLearnerDesign(candidate).valid, false);
  }
});

test('revision-5 semantic pin fails closed and restricts primary evidence to public learner turns only', async () => {
  const registration = registrationV5();
  const design = loadDesign().design;
  const check = (candidate) =>
    tutorStubResistantLearnerMergedSemanticRegistrationIssues({
      registrationPath: REGISTRATION_PATH,
      registration: candidate,
      judges: design.measurement.readerPanel.judges,
    });
  assert.deepEqual(check(registration), []);
  for (const mutate of [
    (value) => (value.instrument.faces.faceA.rungAnchors['2'] = 'Any public noun scores 2.'),
    (value) => (value.calibrationDecisionPolicy.primaryReaderAgreementScope = ['delivered_register']),
    (value) => delete value.dispositions.tutor_discriminating_question_non_delivery,
    (value) => (value.visibility.rivalDagVisible = true),
    (value) => (value.readerPanel.consensus = 'Any plurality wins.'),
    (value) => (value.readerPanel.validityBackstop.minimum = 0.49),
  ]) {
    const candidate = structuredClone(registration);
    mutate(candidate);
    assert.ok(check(candidate).length > 0);
  }

  const packet = {
    trigger: 'I am still tracing the clinic cancellations.',
    intervention: 'Whether the badge was copied or borrowed selects different access checks?',
    post_1: 'The badge log is the observable condition I would check.',
    tutor_1: 'The badge log distinguishes copied from borrowed access.',
  };
  const faceV5 = tutorStubResistantLearnerMergedFaceDesign(design, 'faceA');
  const faceV4 = tutorStubResistantLearnerMergedFaceDesign(
    loadDesign('config/tutor-stub-resistant-learner-merged-design.v4.json').design,
    'faceA',
  );
  const judge = faceV5.models.finalSemanticReaders[0];
  const promptV5 = buildTutorStubResistantLearnerSemanticPrompt({
    caseId: 'source-scope',
    study: 'B1',
    instrument: 'primary',
    publicPacket: packet,
    judge,
    design: faceV5,
  });
  const sourceEnumV5 =
    promptV5.output_schema.properties.judgment.properties.final_graded_engagement_rung.properties.evidence_quotes
      .anyOf[1].items.properties.source_id.enum;
  assert.deepEqual(sourceEnumV5, ['trigger', 'post_1']);
  const promptV4 = buildTutorStubResistantLearnerSemanticPrompt({
    caseId: 'source-scope',
    study: 'B1',
    instrument: 'primary',
    publicPacket: packet,
    judge,
    design: faceV4,
  });
  const sourceEnumV4 =
    promptV4.output_schema.properties.judgment.properties.final_graded_engagement_rung.properties.evidence_quotes
      .anyOf[1].items.properties.source_id.enum;
  assert.deepEqual(sourceEnumV4, Object.keys(packet));

  const run = async (faceDesign) => {
    const runtime = createTutorStubResistantLearnerSemanticRuntime({
      appendTraceEvent() {},
      resolveModel(modelRef) {
        return modelRef === 'codex.gpt-5.6-sol'
          ? { provider: 'codex', model: 'gpt-5.6-sol' }
          : modelRef === 'claude-code.sonnet-5'
            ? { provider: 'claude-code', model: 'claude-sonnet-5' }
            : { provider: 'claude-code', model: 'claude-opus-4-8' };
      },
      async callPromptModel({ prompt, resolved }) {
        const parsed = JSON.parse(prompt);
        return {
          text: JSON.stringify({
            schema: parsed.output_schema.properties.schema.enum[0],
            case_id: 'source-scope',
            judgment: {
              final_graded_engagement_rung: {
                value: '1',
                evidence_quotes: [{ source_id: 'intervention', text: packet.intervention }],
                confidence: 'high',
                indeterminacy_reason: 'none',
              },
              final_selective_attention_resistance_retained: {
                value: 'yes',
                evidence_quotes: [{ source_id: 'trigger', text: packet.trigger }],
                confidence: 'high',
                indeterminacy_reason: 'none',
              },
            },
          }),
          provider: resolved.provider,
          model: resolved.model,
          effort: 'low',
          structuredOutput: true,
          prohibitedToolEventCountObserved: true,
          prohibitedToolEventCount: 0,
        };
      },
    });
    return runtime.adjudicatePrimaryPanel({
      state: {
        trace: [],
        resistanceActionRegisterStudy: {
          resistant_learner_calibration: true,
          resistant_learner_study: 'B1',
          job_id: 'source-scope',
          design: faceDesign,
        },
      },
      turnNumber: 6,
      publicPacket: packet,
    });
  };
  assert.equal((await run(faceV5)).fields.final_graded_engagement_rung.status, 'measurement_indeterminate');
  assert.equal((await run(faceV4)).fields.final_graded_engagement_rung.status, 'determinate');
});

test('revision-5 rehearsal uses the registered three-seat panel and unchanged public-only anchors', () => {
  const registration = registrationV5();
  assert.deepEqual(
    V5_REGISTERED_READER_SEATS.map(({ modelRef, effort }) => ({ modelRef, effort })),
    [
      { modelRef: 'codex.gpt-5.6-sol', effort: 'low' },
      { modelRef: 'claude-code.sonnet-5', effort: 'low' },
      { modelRef: 'claude-code.opus', effort: 'low' },
    ],
  );
  assert.equal(RESISTANT_LEARNER_V5_REHEARSAL_ATTEMPT_CEILING, 384);
  for (const faceId of ['faceA', 'faceB']) {
    const contract = candidateContract({
      candidateId: V5_REHEARSAL_CANDIDATE.id,
      faceId,
      openNodes: [],
      publicPacket: {},
      bridgeAccepted: false,
    });
    assert.deepEqual(contract.anchors, registration.instrument.faces[faceId].rungAnchors);
    assert.equal(contract.echo_guard, registration.instrument.faces[faceId].echoGuard);
    assert.match(contract.visibility, /public transcript only/iu);
  }
});

test('revision-5 endpoint consensus is code-computed modal voting', () => {
  assert.equal(tutorStubResistantLearnerSemanticFieldConsensus(['1', '1', '2']).winner, '1');
  assert.equal(tutorStubResistantLearnerSemanticFieldConsensus(['2', '2', '2']).winner, '2');
  assert.equal(tutorStubResistantLearnerSemanticFieldConsensus(['0', '1', '2']).winner, null);
  assert.equal(tutorStubResistantLearnerSemanticFieldConsensus(['1', '1']).winner, '1');
});

test('revision-5 rehearsal accepts only verbatim public learner evidence', () => {
  const publicPacket = {
    trigger: 'I reserve the wider frame.',
    intervention: 'Would comparing A or B settle the local test?',
    post_1: 'The public record would distinguish A from B.',
    tutor_1: 'That record distinguishes A from B.',
  };
  const task = buildReplayTask({
    candidate: V5_REHEARSAL_CANDIDATE,
    replayCase: {
      caseId: 'synthetic-v5-rehearsal',
      faceId: 'faceA',
      publicPacket,
      openNodes: [],
      bridgeAccepted: false,
      packetSha256: 'fixture',
    },
    repetition: 1,
    seat: V5_REGISTERED_READER_SEATS[0],
  });
  const base = {
    case_id: 'synthetic-v5-rehearsal',
    candidate_id: V5_REHEARSAL_CANDIDATE.id,
    repetition: 1,
    face_id: 'faceA',
    value: '1',
    confidence: 'medium',
  };
  assert.deepEqual(
    validateReplayOutput(task, {
      ...base,
      evidence_quotes: [{ source_id: 'post_1', text: publicPacket.post_1 }],
    }),
    { valid: true, issues: [] },
  );
  assert.deepEqual(
    validateReplayOutput(task, {
      ...base,
      evidence_quotes: [{ source_id: 'tutor_1', text: publicPacket.tutor_1 }],
    }),
    {
      valid: false,
      issues: ['endpoint_evidence_source_not_public_learner_turn'],
    },
  );
});

test('face-A delivery gate repairs once and crosses the child boundary as tutor non-delivery', async () => {
  const design = tutorStubResistantLearnerMergedFaceDesign(loadDesign().design, 'faceA');
  const state = {
    trace: [],
    resistanceActionRegisterStudy: { resistant_learner_study: 'B1', design },
  };
  let calls = 0;
  await assert.rejects(
    () =>
      applyTutorStubR1TutorDeliveryGate({
        state,
        response: { text: 'What happened?' },
        turnNumber: 2,
        learnerText: 'The rival record still matters.',
        interventionApplied: true,
        appendTraceEvent(target, event) {
          target.push(event);
        },
        async adjudicateTutorDelivery() {
          calls += 1;
          return { delivered: false, quote: null };
        },
        async repairTutor({ instruction }) {
          assert.equal(instruction, design.tutorDeliveryContract.enforcement.repairInstruction);
          return { text: 'Whether the badge was copied or borrowed selects different access checks?' };
        },
      }),
    (error) => {
      assert.equal(error.code, TUTOR_STUB_TUTOR_DISCRIMINATING_QUESTION_NON_DELIVERY_CODE);
      assert.equal(error.substantiveStudyFailure, true);
      const outcome = tutorStubRegisteredStudyOutcomeFromError({ error, jobId: 'faceA-delivery' });
      assert.equal(outcome?.code, TUTOR_STUB_TUTOR_DISCRIMINATING_QUESTION_NON_DELIVERY_CODE);
      assert.equal(outcome?.replacement_allowed, false);
      return true;
    },
  );
  assert.equal(calls, 2);
  assert.ok(
    TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_CODES.includes(TUTOR_STUB_TUTOR_DISCRIMINATING_QUESTION_NON_DELIVERY_CODE),
  );
});

function syntheticFaceARows(design) {
  return buildTutorStubResistantLearnerCalibrationPlan(design)
    .jobs.filter((job) => job.face_id === 'faceA')
    .map((job) => {
      const primaryValues = {
        final_graded_engagement_rung: '1',
        final_selective_attention_resistance_retained: 'yes',
      };
      const fidelityValues = {
        delivered_action_family: 'neither',
        delivered_question_contrast: 'neither',
        delivered_register: 'neither',
        prohibited_delivery: 'no',
      };
      const primaryReaders = design.models.finalSemanticReaders;
      const fidelityReaders = primaryReaders.filter((reader) =>
        design.measurement.readerPanel.fidelityJudges.includes(reader.modelRef),
      );
      const makePanel = (instrument, values) => ({
        status: instrument === 'primary' ? 'determinate' : 'measurement_indeterminate',
        fields: Object.fromEntries(
          Object.entries(values).map(([field, value]) => [
            field,
            {
              status: 'determinate',
              value,
              eligible_judges: (instrument === 'primary' ? primaryReaders : fidelityReaders).map((reader) => reader.id),
            },
          ]),
        ),
        seats: (instrument === 'primary' ? primaryReaders : fidelityReaders).map((reader) => ({
          judge_id: reader.id,
          validation: {
            fields: Object.fromEntries(
              Object.entries(values).map(([field, value]) => [
                field,
                {
                  eligible: instrument === 'primary' || field === 'prohibited_delivery',
                  value,
                },
              ]),
            ),
          },
        })),
      });
      return {
        job,
        status: 'complete',
        outcome: {
          primary: makePanel('primary', primaryValues),
          fidelity: makePanel('fidelity', fidelityValues),
        },
      };
    });
}

test('revision-5 report verdict ignores report-only realization fields but keeps endpoint and safety gates', () => {
  const design = loadDesign().design;
  const report = summarizeTutorStubResistantLearnerCalibration({ rows: syntheticFaceARows(design), design });
  const faceA = report.faces.find((face) => face.face_id === 'faceA');
  assert.equal(faceA.status, 'passed');
  assert.equal(faceA.gates.primary_endpoint_reader_eligibility_and_validity_backstop, true);
  assert.equal(faceA.gates.determinate_absence_of_prohibited_delivery, true);
  assert.equal(faceA.report_only_diagnostics.action_fidelity.met_descriptive_threshold, false);
  assert.equal(faceA.report_only_diagnostics.affects_verdict_eligibility_scoring_or_row_selection, false);
  assert.deepEqual(faceA.reader_agreement.verdict_scope, ['final_graded_engagement_rung']);
});

test('revision-5 removed 0.8 pair gate cannot fail a modal panel and report-only margins cannot select rows', () => {
  const design = loadDesign().design;
  const rows = syntheticFaceARows(design);
  for (const row of rows.slice(0, 6)) {
    const readerC = row.outcome.primary.seats.find((seat) => seat.judge_id === 'reader_c');
    readerC.validation.fields.final_graded_engagement_rung.value = '0';
  }
  const report = summarizeTutorStubResistantLearnerCalibration({ rows, design });
  const faceA = report.faces.find((face) => face.face_id === 'faceA');
  const endpointPairs = faceA.reader_agreement.endpoint_panel.pairwise_exact_agreements;
  assert.ok(endpointPairs.some((pair) => pair.conditional_exact_agreement < 0.8));
  assert.ok(faceA.reader_agreement.endpoint_panel.mean_pairwise_exact_agreement >= 0.5);
  assert.equal(faceA.reader_agreement.endpoint_panel.majority_margins['2-1'], 6);
  assert.equal(faceA.gates.primary_endpoint_reader_eligibility_and_validity_backstop, true);
  assert.equal(faceA.status, 'passed');
  assert.equal(report.rows.length, 18);
  assert.equal(faceA.report_only_diagnostics.endpoint_panel.affects_verdict_beyond_registered_validity_backstop, false);
  assert.equal(faceA.report_only_diagnostics.affects_verdict_eligibility_scoring_or_row_selection, false);
});

test('revision-5 0.5 mean-pairwise backstop fails closed without recoding modal outcomes', () => {
  const design = loadDesign().design;
  const rows = syntheticFaceARows(design);
  for (const row of rows) {
    const readerC = row.outcome.primary.seats.find((seat) => seat.judge_id === 'reader_c');
    readerC.validation.fields.final_graded_engagement_rung.value = '0';
  }
  const report = summarizeTutorStubResistantLearnerCalibration({ rows, design });
  const faceA = report.faces.find((face) => face.face_id === 'faceA');
  assert.equal(faceA.statistics.determinate, 18);
  assert.equal(faceA.statistics.rung_counts['1'], 18);
  assert.equal(faceA.reader_agreement.endpoint_panel.mean_pairwise_exact_agreement, 1 / 3);
  assert.equal(faceA.gates.primary_endpoint_determinacy, true);
  assert.equal(faceA.gates.primary_endpoint_reader_eligibility_and_validity_backstop, false);
  assert.equal(faceA.status, 'measurement_indeterminate');
  assert.equal(report.rows.length, 18);
});

test('revision-5 zero-call preflight covers both face delivery roles and writes nothing', async () => {
  const loaded = loadDesign();
  loaded.relativePath = DESIGN_PATH;
  const destination = path.join(os.tmpdir(), `merged-v5-preflight-absent-${process.pid}`);
  const roles = [];
  const preflight = await runTutorStubResistantLearnerMergedPreflight({
    loaded,
    root: ROOT,
    destination,
    destinationExists: () => false,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => {
      roles.push(`${route.face_id}:${route.transportRole}`);
      return { ...route, status: 'passed_zero_call_stub', provider_model_calls: 0 };
    },
  });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.model_calls_executed, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(fs.existsSync(destination), false);
  assert.ok(roles.includes('faceA:tutor_stub_tutor_delivery_repair'));
  assert.ok(roles.includes('faceB:tutor_stub_tutor_delivery_repair'));
  assert.ok(roles.includes('faceA:tutor_stub_resistant_learner_B1_primary_reader_c'));
  assert.ok(roles.includes('faceB:tutor_stub_resistant_learner_R1_primary_reader_c'));
  assert.ok(!roles.includes('faceA:tutor_stub_resistant_learner_B1_fidelity_reader_c'));
  assert.ok(!roles.includes('faceB:tutor_stub_resistant_learner_R1_fidelity_reader_c'));
});
