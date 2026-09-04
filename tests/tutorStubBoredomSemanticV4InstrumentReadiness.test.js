import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubBoredomProofDagPlan,
  buildTutorStubBoredomProofDagSyntheticCases,
  loadTutorStubBoredomProofDagRegistration,
  runTutorStubBoredomProofDagEndpointPreflight,
  validateTutorStubBoredomProofDagRegistration,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';
import {
  hashPaidStudyEndpointValue,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';
import { selectTutorStubBoredomSemanticAdjudicatorFactory } from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import { createTutorStubBoredomSemanticAdjudicator as createV1Adjudicator } from '../services/tutorStubBoredomSemanticAdjudication.js';
import {
  auxiliaryContradictsFields,
  createTutorStubBoredomSemanticAdjudicator as createV3Adjudicator,
  parseTutorStubBoredomSemanticAdjudication,
} from '../services/tutorStubBoredomSemanticAdjudicationV3.js';
import {
  RESISTANT_LEARNER_OBSERVATION_SEMANTICS,
  observeResistantLearnerTurn,
} from '../services/resistantLearnerObservation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v4.json';
const CONTRACT = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v4.json';
const CERTIFICATE = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v4.endpoint-go.json';
const HELDOUT = 'config/tutor-stub-boredom-semantic-adjudication-heldout.v4.json';
const INSTRUMENT = 'services/tutorStubBoredomSemanticAdjudicationV3.js';
const SUPERSEDED_HOLD_REQUEST = 'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v3.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function fileSha256(relativePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex');
}

test('v4 registration pins the validated Sol V3 instrument and keeps the powered design unchanged', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT, registrationPath: REGISTRATION });
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.equal(registration.version, 4);
  assert.equal(registration.design.observationSemantics, 'prospective_v9');
  const adjudicator = registration.measurement.semanticAdjudicator;
  assert.equal(adjudicator.schema, 'machinespirits.tutor-stub.boredom-semantic-adjudication.v3');
  assert.equal(adjudicator.modelRef, 'codex.gpt-5.6-sol');
  assert.equal(adjudicator.generatorSelfJudgmentAllowed, false);
  assert.equal(adjudicator.lexicalSilenceMayVetoSemanticPositive, false);
  assert.equal(adjudicator.modulePath, INSTRUMENT);
  // The instrument is a code file, so its digest is recorded and never pinned
  // (CLAUDE.md, 2026-08-21). Comparing the registration's stored digest with a
  // fresh hash of the same file made every one-line fix a design change.
  assert.match(adjudicator.moduleSha256, /^[0-9a-f]{64}$/u);
  assert.equal(adjudicator.heldoutCorpus.path, HELDOUT);
  assert.equal(adjudicator.heldoutCorpus.sha256, fileSha256(HELDOUT));
  assert.equal(adjudicator.heldoutCorpus.cases, 55);
  assert.equal(adjudicator.empiricalValidationStatus, 'passed_all_predeclared_gates_on_sealed_heldout_v4_corpus');
  assert.equal(adjudicator.confirmationLaunchReady, true);
  assert.equal(adjudicator.empiricalValidation.determinateSensitivity, 1);
  assert.equal(adjudicator.empiricalValidation.determinateSpecificity, 1);
  assert.equal(adjudicator.empiricalValidation.referenceAgreement, 1);
  assert.equal(adjudicator.empiricalValidation.ambiguousIndeterminateRate, 1);
  assert.equal(adjudicator.empiricalValidation.lowConfidenceIndeterminateRate, 1);
  assert.equal(adjudicator.empiricalValidation.reservationsUsed, 55);
  assert.equal(adjudicator.empiricalValidation.retries, 0);
  assert.equal(
    adjudicator.empiricalValidation.reportSha256,
    '7ff7810e28f7e037af12fbd852445efab9538bc1c946c529356a0c009a51763c',
  );
  assert.equal(registration.executionReadiness.dialogue.measurementIndeterminateRepairCalls, 0);
  assert.equal(registration.executionReadiness.dialogue.oneCumulativeFullLearnerRepairCalls, 0);
  assert.equal(registration.executionReadiness.hardStudyAttemptCeiling, 2160);
  const plan = buildTutorStubBoredomProofDagPlan(registration);
  assert.equal(plan.jobs.length, 36);
  assert.equal(plan.jobs.filter((row) => row.realization === 'plain').length, 18);
  assert.equal(plan.jobs.filter((row) => row.realization === 'warm').length, 18);
});

test('v4 endpoint and certificate pass at zero calls with launch authorization still pending', () => {
  const registration = readJson(REGISTRATION);
  const contract = readJson(CONTRACT);
  const certificate = readJson(CERTIFICATE);
  const preflight = runTutorStubBoredomProofDagEndpointPreflight({ contract, registration });
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(
    preflight.readiness.status,
    'passed_zero_call_hold_empirical_semantic_validation_passed_launch_authorization_pending',
  );
  assert.equal(preflight.readiness.independent_semantic_adjudicator, 'codex.gpt-5.6-sol');
  assert.equal(
    preflight.readiness.empirical_semantic_validation_status,
    'passed_all_predeclared_gates_on_sealed_heldout_v4_corpus',
  );
  assert.equal(preflight.readiness.confirmation_launch_ready, true);
  assert.equal(preflight.assembly_audit.endpoint_status.independent_boredom_semantic_measurement, 'complete');
  assert.equal(contract.runner.batch_contract.programme_ledger_before, 446);
  assert.equal(contract.runner.batch_contract.combined_maximum_with_both_confirmations, 4766);
  assert.equal(hashPaidStudyEndpointValue(contract), certificate.contract_sha256);
  const validation = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.match(certificate.authorization_scope, /authorizes no confirmation-model call/u);
  assert.match(certificate.launch_gate, /separately committed explicit human approval/u);
});

test('v4 instrument pins, gates, and repair prohibitions fail closed', () => {
  const registration = readJson(REGISTRATION);
  for (const mutate of [
    (row) => (row.measurement.semanticAdjudicator.modelRef = 'codex.gpt-5.6-luna'),
    (row) =>
      (row.measurement.semanticAdjudicator.schema = 'machinespirits.tutor-stub.boredom-semantic-adjudication.v1'),
    (row) => (row.measurement.semanticAdjudicator.heldoutCorpus.sha256 = '0'.repeat(64)),
    (row) => (row.measurement.semanticAdjudicator.empiricalValidationStatus = 'pending'),
    (row) => (row.measurement.semanticAdjudicator.confirmationLaunchReady = false),
    (row) => (row.measurement.semanticAdjudicator.empiricalValidation.determinateSensitivity = 0.9),
    (row) => (row.executionReadiness.dialogue.measurementIndeterminateRepairCalls = 1),
  ]) {
    const mutated = structuredClone(registration);
    mutate(mutated);
    assert.equal(validateTutorStubBoredomProofDagRegistration(mutated).ok, false);
  }
});

test('a drifted v4 instrument module digest is recorded and does not fail the registration', () => {
  const registration = readJson(REGISTRATION);
  registration.measurement.semanticAdjudicator.moduleSha256 = '0'.repeat(64);
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  assert.equal(validation.ok, true, validation.errors.join('; '));
  const record = validation.digestRecords.find((row) => row.path === INSTRUMENT);
  assert.equal(record.drifted, true);
  assert.equal(record.recordedSha256, '0'.repeat(64));
  assert.notEqual(record.observedSha256, record.recordedSha256);
});

test('v4 synthetic rows carry determinate semantic measurement for every dialogue', () => {
  const registration = readJson(REGISTRATION);
  const cases = buildTutorStubBoredomProofDagSyntheticCases(registration);
  assert.equal(cases.length, 36);
  assert.ok(cases.every((row) => row.semantic_measurement.disposition === 'actionable_boredom'));
  assert.ok(cases.every((row) => row.semantic_measurement.independent_route_matches === true));
  assert.ok(cases.every((row) => row.semantic_measurement.evidence_spans_valid === true));
  assert.ok(cases.every((row) => row.semantic_measurement.indeterminate === false));
});

test('host adjudicator seam selects the factory from the registration schema and fails closed on drift', (t) => {
  const noRegistration = selectTutorStubBoredomSemanticAdjudicatorFactory({ args: {}, root: ROOT });
  assert.equal(noRegistration, createV1Adjudicator);
  const v4Factory = selectTutorStubBoredomSemanticAdjudicatorFactory({
    args: { 'boredom-proof-dag-registration': REGISTRATION },
    root: ROOT,
  });
  assert.equal(v4Factory, createV3Adjudicator);
  const v1Factory = selectTutorStubBoredomSemanticAdjudicatorFactory({
    args: {
      'boredom-proof-dag-registration': 'config/tutor-stub-boredom-action-register-proof-dag-registration.v2.json',
    },
    root: ROOT,
  });
  assert.equal(v1Factory, createV1Adjudicator);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-adjudicator-seam-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const unknownPath = path.join(temporary, 'unknown-schema-registration.json');
  fs.writeFileSync(
    unknownPath,
    `${JSON.stringify({ measurement: { semanticAdjudicator: { schema: 'machinespirits.tutor-stub.boredom-semantic-adjudication.v99' } } })}\n`,
  );
  assert.throws(
    () =>
      selectTutorStubBoredomSemanticAdjudicatorFactory({
        args: { 'boredom-proof-dag-registration': unknownPath },
        root: temporary,
      }),
    /unsupported boredom semantic adjudication schema/u,
  );
});

// Only sealed data keeps a hard byte pin: the validation certificate and the
// held-out corpus. The registration, the endpoint contract, the go request and
// the instrument are deliberately absent. They are the files a defect
// correction has to touch, so their digests are recorded and read, never
// enforced (CLAUDE.md, 2026-08-21).
test('the sealed certificate and held-out corpus bytes remain exact', () => {
  const expected = {
    [CERTIFICATE]: '68769dec56cee01c4aee5d0f396f9a25faa4b5cb6f175ac503df8b060a91a489',
    [HELDOUT]: '5f65dd5dc3e193c9dc0368b4155a550bc9b5acd56de78e62704e35f750f50aa0',
  };
  for (const [relativePath, sha256] of Object.entries(expected)) {
    assert.equal(fileSha256(relativePath), sha256, relativePath);
  }
});

test('the recorded contract and superseded HOLD request stay readable and well formed', () => {
  for (const relativePath of [CONTRACT, SUPERSEDED_HOLD_REQUEST]) {
    assert.match(fileSha256(relativePath), /^[0-9a-f]{64}$/u, relativePath);
    assert.equal(typeof readJson(relativePath), 'object');
  }
});

// The live batch-1 regression. Every one of these cases is deterministic and
// makes no model call: the auxiliary/verdict comparison is pure arithmetic over
// the judge's own fields, so it can be pinned exactly.
const LIVE_BATCH_1_CANDIDATE = 'Sure. We can examine the coins first.';

function auxiliaryFor(disposition) {
  return { schema: 'machinespirits.resistant-learner.boredom-effort-composition.v1', disposition };
}

function judgeOutput({ verdict, fields, evidence, confidence = 0.99 }) {
  return {
    verdict,
    boredom_cue: fields.boredom_cue === true,
    effort_withdrawal: fields.effort_withdrawal === true,
    productive_uptake: fields.productive_uptake === true,
    process_impatience: fields.process_impatience === true,
    confidence,
    evidence,
    reason: 'fixture',
  };
}

test('an auxiliary that agrees with the judge no longer voids the measurement', () => {
  // Replays job bored-confirm-w1-d2 turn 1 byte for byte. Before the fix this
  // returned measurement_indeterminate and stopped a paid dialogue, even though
  // the judge was healthy and the auxiliary agreed with it.
  const observation = observeResistantLearnerTurn({
    learnerText: LIVE_BATCH_1_CANDIDATE,
    classification: { turn: { discourse_move: 'proposal', evidence_use: 'none' } },
    semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV9,
  }).boredom_composition;
  assert.equal(observation.disposition, 'negative_productive_uptake_precedes_cue');

  const adjudication = parseTutorStubBoredomSemanticAdjudication({
    raw: judgeOutput({
      verdict: 'no_boredom',
      fields: { productive_uptake: true },
      evidence: [{ kind: 'productive_uptake', start: 6, end: 37, text: 'We can examine the coins first.' }],
    }),
    candidate: LIVE_BATCH_1_CANDIDATE,
    auxiliaryObservation: observation,
  });

  assert.equal(adjudication.parse_ok, true, adjudication.issues.join('; '));
  assert.equal(adjudication.low_confidence, false);
  assert.equal(adjudication.semantic_verdict, 'no_boredom');
  assert.equal(adjudication.auxiliary.polarity, 'productive_uptake');
  assert.equal(adjudication.auxiliary.contradiction, false);
  assert.equal(adjudication.measurement_disposition, 'no_boredom');
});

test('auxiliary contradiction is decided on the judge fields, not on the verdict name', () => {
  // Polarity names and verdict names are different vocabularies over one field
  // space. `productive_uptake` collapses to the verdict `no_boredom` whenever no
  // boredom cue is present, so comparing the two as strings called that pairing
  // a contradiction. Each row below states what the auxiliary asserts and
  // whether the judge fields can stand with it.
  const cases = [
    { polarity: 'neutral', fields: {}, contradicts: false },
    { polarity: 'neutral', fields: { boredom_cue: true, effort_withdrawal: true }, contradicts: false },
    // ambiguous auxiliary keeps failing closed, exactly as before
    { polarity: 'indeterminate', fields: { productive_uptake: true }, contradicts: true },
    { polarity: 'indeterminate', fields: { boredom_cue: true, effort_withdrawal: true }, contradicts: true },
    // uptake seen and no actionable withdrawal
    { polarity: 'productive_uptake', fields: { productive_uptake: true }, contradicts: false },
    { polarity: 'productive_uptake', fields: { productive_uptake: true, boredom_cue: true }, contradicts: false },
    { polarity: 'productive_uptake', fields: {}, contradicts: true },
    { polarity: 'productive_uptake', fields: { boredom_cue: true }, contradicts: true },
    { polarity: 'productive_uptake', fields: { productive_uptake: true, effort_withdrawal: true }, contradicts: true },
    // cue plus withdrawal and no uptake
    {
      polarity: 'actionable_boredom',
      fields: { boredom_cue: true, effort_withdrawal: true },
      contradicts: false,
    },
    { polarity: 'actionable_boredom', fields: { effort_withdrawal: true }, contradicts: true },
    { polarity: 'actionable_boredom', fields: { boredom_cue: true }, contradicts: true },
    {
      polarity: 'actionable_boredom',
      fields: { boredom_cue: true, effort_withdrawal: true, productive_uptake: true },
      contradicts: true,
    },
  ];
  for (const row of cases) {
    const fields = {
      boredom_cue: row.fields.boredom_cue === true,
      effort_withdrawal: row.fields.effort_withdrawal === true,
      productive_uptake: row.fields.productive_uptake === true,
      process_impatience: row.fields.process_impatience === true,
    };
    assert.equal(
      auxiliaryContradictsFields(row.polarity, fields),
      row.contradicts,
      `${row.polarity} against ${JSON.stringify(row.fields)}`,
    );
  }
});

test('every auxiliary disposition the observer can emit maps to a polarity the contradiction rule handles', () => {
  // The held-out corpus carries no auxiliary column and the gate harness passes
  // auxiliaryObservation: null, so the gates could never reach this rule. These
  // dispositions come from resistantLearnerObservation.js, and each one must
  // agree with at least one field set — a polarity that contradicts everything
  // would silently void every dialogue that produced it, which is the failure
  // mode that stopped batch 1.
  const dispositions = [
    'negative_no_boredom_cue',
    'negative_permission_seeking',
    'negative_boredom_without_actionable_withdrawal',
    'negative_productive_uptake_precedes_cue',
    'positive_actionable_withdrawal_without_uptake',
    'ambiguous_withdrawal_and_productive_uptake',
  ];
  const fieldSets = [];
  for (const boredom_cue of [false, true]) {
    for (const effort_withdrawal of [false, true]) {
      for (const productive_uptake of [false, true]) {
        fieldSets.push({ boredom_cue, effort_withdrawal, productive_uptake, process_impatience: false });
      }
    }
  }
  for (const disposition of dispositions) {
    const adjudication = parseTutorStubBoredomSemanticAdjudication({
      raw: judgeOutput({
        verdict: 'no_boredom',
        fields: {},
        evidence: [],
      }),
      candidate: LIVE_BATCH_1_CANDIDATE,
      auxiliaryObservation: auxiliaryFor(disposition),
    });
    const polarity = adjudication.auxiliary.polarity;
    const agreeing = fieldSets.filter((fields) => !auxiliaryContradictsFields(polarity, fields));
    if (disposition === 'ambiguous_withdrawal_and_productive_uptake') {
      assert.equal(polarity, 'indeterminate');
      assert.equal(agreeing.length, 0, 'the ambiguous auxiliary is meant to fail closed everywhere');
      continue;
    }
    assert.ok(agreeing.length > 0, `${disposition} contradicts every possible judge reading`);
  }
});

test('a null auxiliary stays neutral, which is why the sealed gates never exercised the rule', () => {
  const corpus = readJson(HELDOUT);
  assert.equal(corpus.cases.length, 55);
  for (const row of corpus.cases) {
    assert.ok(!Object.hasOwn(row, 'auxiliary'), 'the sealed corpus carries no auxiliary column');
  }
  const adjudication = parseTutorStubBoredomSemanticAdjudication({
    raw: judgeOutput({ verdict: 'no_boredom', fields: {}, evidence: [] }),
    candidate: LIVE_BATCH_1_CANDIDATE,
    auxiliaryObservation: null,
  });
  assert.equal(adjudication.auxiliary.polarity, 'neutral');
  assert.equal(adjudication.auxiliary.contradiction, false);
});

// The added diagnostics must not move a single verdict. This walks the whole
// decision space — every judge field pattern, every auxiliary polarity, and
// confidence above and below the minimum — and checks the answers against the
// rules as they read before the diagnostics went in, spelled out again here so
// the check is independent rather than a restatement of the code under test.
function verdictBeforeDiagnostics(f) {
  if (f.productive_uptake && f.effort_withdrawal) return 'indeterminate';
  if (f.productive_uptake && f.boredom_cue) return 'productive_uptake';
  if (f.productive_uptake) return 'no_boredom';
  if (f.boredom_cue && f.effort_withdrawal) return 'actionable_boredom';
  if (f.boredom_cue || f.process_impatience) return 'nonactionable_boredom';
  return 'no_boredom';
}

function contradictionBeforeDiagnostics(polarity, f) {
  if (polarity === 'indeterminate') return true;
  const asserted = {
    productive_uptake: { productive_uptake: true, effort_withdrawal: false },
    actionable_boredom: { boredom_cue: true, effort_withdrawal: true, productive_uptake: false },
  }[polarity];
  if (!asserted) return false;
  return Object.entries(asserted).some(([field, value]) => Boolean(f[field]) !== value);
}

const CANDIDATE_FOR_EVERY_FIELD = 'Whatever. I stopped. We can examine the coins. Are we done yet?';
const EVIDENCE_SPANS = {
  boredom_cue: 'Whatever',
  effort_withdrawal: 'I stopped',
  productive_uptake: 'We can examine the coins',
  process_impatience: 'Are we done yet?',
};

test('the diagnostics change no verdict anywhere in the decision space', () => {
  const names = ['boredom_cue', 'effort_withdrawal', 'productive_uptake', 'process_impatience'];
  const dispositions = [
    'negative_no_boredom_cue',
    'positive_actionable_withdrawal_without_uptake',
    'negative_productive_uptake_precedes_cue',
    'ambiguous_withdrawal_and_productive_uptake',
  ];
  let checked = 0;
  for (let mask = 0; mask < 16; mask += 1) {
    const fields = Object.fromEntries(names.map((name, bit) => [name, Boolean(mask & (1 << bit))]));
    const evidence = names
      .filter((name) => fields[name])
      .map((name) => ({
        kind: name,
        start: CANDIDATE_FOR_EVERY_FIELD.indexOf(EVIDENCE_SPANS[name]),
        end: CANDIDATE_FOR_EVERY_FIELD.indexOf(EVIDENCE_SPANS[name]) + EVIDENCE_SPANS[name].length,
        text: EVIDENCE_SPANS[name],
      }));
    const expectedVerdict = verdictBeforeDiagnostics(fields);
    for (const disposition of dispositions) {
      for (const confidence of [0.99, 0.5]) {
        const adjudication = parseTutorStubBoredomSemanticAdjudication({
          raw: judgeOutput({ verdict: expectedVerdict, fields, evidence, confidence }),
          candidate: CANDIDATE_FOR_EVERY_FIELD,
          auxiliaryObservation: auxiliaryFor(disposition),
        });
        assert.equal(adjudication.semantic_verdict, expectedVerdict, `verdict moved for ${JSON.stringify(fields)}`);
        const polarity = adjudication.auxiliary.polarity;
        assert.equal(adjudication.auxiliary.contradiction, contradictionBeforeDiagnostics(polarity, fields));
        const stoppedBefore =
          !adjudication.parse_ok ||
          confidence < 0.8 ||
          contradictionBeforeDiagnostics(polarity, fields) ||
          expectedVerdict === 'indeterminate';
        assert.equal(
          adjudication.measurement_disposition,
          stoppedBefore ? 'measurement_indeterminate' : expectedVerdict,
          `disposition moved for ${JSON.stringify(fields)} with ${disposition} at ${confidence}`,
        );
        // Every stop names at least one cause, and no cause is named without a stop.
        assert.equal(adjudication.stop_reasons.length > 0, stoppedBefore);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 128);
});

test('a stopped measurement says which rule stopped it and what the auxiliary saw', () => {
  // Replays job bored-confirm-w1-d4 turn 1 from live batch 1, third attempt.
  // The judge read plain effort withdrawal at 0.99; the auxiliary called the
  // same turn productive uptake; the run stopped and the record said only
  // `contradiction: true`, which could not be diagnosed after the fact.
  const candidate = 'I stopped at the first step and left the evidence unexamined.';
  const adjudication = parseTutorStubBoredomSemanticAdjudication({
    raw: judgeOutput({
      verdict: 'no_boredom',
      fields: { effort_withdrawal: true },
      evidence: [{ kind: 'effort_withdrawal', start: 0, end: 9, text: 'I stopped' }],
    }),
    candidate,
    auxiliaryObservation: {
      schema: 'machinespirits.resistant-learner.boredom-effort-composition.v1',
      disposition: 'negative_productive_uptake_precedes_cue',
      productive_uptake_evidence: null,
      classifier_content_bearing: true,
      supported_move_count: 0,
      actionable_withdrawal_evidence: null,
      cue_evidence: null,
      permission_seeking: false,
    },
  });
  assert.equal(adjudication.measurement_disposition, 'measurement_indeterminate');
  assert.deepEqual(adjudication.stop_reasons, ['auxiliary_disagrees_with_judge_fields']);
  assert.deepEqual(adjudication.auxiliary.disagreements, [
    { field: 'productive_uptake', auxiliary_asserts: true, judge_reports: false },
    { field: 'effort_withdrawal', auxiliary_asserts: false, judge_reports: true },
  ]);
  // The point of the diagnostics: the regex was silent, so the block came from
  // the classifier calling the turn content-bearing, not from a mood pattern.
  assert.equal(adjudication.auxiliary.triggered_signals.uptake_from_regex, null);
  assert.equal(adjudication.auxiliary.triggered_signals.uptake_from_classifier_content, true);
  assert.equal(adjudication.auxiliary.triggered_signals.uptake_from_supported_moves, 0);
});

test('a plain statement of giving up is not read as taking up the work', () => {
  // The four turn-1 replies from live batch 1, third attempt, with the exact
  // discourse labels the analysis model gave them (recorded in each job trace).
  // All four were stopped because the auxiliary called them productive uptake.
  // Reflection on one's own work no longer sits in the content-bearing set, so a
  // learner saying it has stopped now reads as what it is.
  const withheld = [
    {
      job: 'bored-confirm-w1-d1',
      text: 'I have stopped before choosing a public test; the trial-book has no finding yet.',
      evidence_use: 'none',
    },
    {
      job: 'bored-confirm-w1-d2',
      text: 'I stopped at naming Verrell and left the evidence unexamined.',
      evidence_use: 'none',
    },
    {
      job: 'bored-confirm-w1-d4',
      text: 'I stopped at the first step and left the evidence unexamined.',
      evidence_use: 'none',
    },
    {
      job: 'bored-confirm-w1-d5',
      text: 'I stopped at naming Verrell, before any coin or testimony was examined.',
      evidence_use: 'repeats_setup',
    },
  ];

  for (const row of withheld) {
    const observed = observeResistantLearnerTurn({
      learnerText: row.text,
      classification: { turn: { discourse_move: 'metacognitive_reflection', evidence_use: row.evidence_use } },
      tutorLearnerDag: null,
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV9,
    });
    const composition = observed.boredom_composition;
    assert.ok(composition, `${row.job}: the boredom composition must be present`);
    assert.equal(composition.classifier_content_bearing, false, `${row.job}: reflection is not taking up the work`);
    assert.equal(composition.productive_uptake, false, `${row.job}: no uptake input may fire on this turn`);
    assert.equal(composition.productive_uptake_evidence, null, `${row.job}: the regex was silent here too`);
  }
});

test('real forward moves still count as taking up the work', () => {
  // Guards the correction above. Dropping reflection must not blunt the three
  // moves that do carry the inquiry forward, nor the evidence-side inputs.
  const forward = [
    { discourse_move: 'hypothesis', evidence_use: 'none' },
    { discourse_move: 'inference', evidence_use: 'none' },
    { discourse_move: 'evidence_adoption', evidence_use: 'none' },
    { discourse_move: 'metacognitive_reflection', evidence_use: 'cites_public_evidence' },
    { discourse_move: 'metacognitive_reflection', evidence_use: 'links_evidence_to_rule' },
    { discourse_move: 'metacognitive_reflection', evidence_use: 'revises_from_evidence' },
  ];

  for (const turn of forward) {
    const observed = observeResistantLearnerTurn({
      learnerText: 'The clipped edge is the deciding mark, so Verrell cannot be the striker.',
      classification: { turn },
      tutorLearnerDag: null,
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV9,
    });
    assert.equal(
      observed.boredom_composition?.classifier_content_bearing,
      true,
      `${turn.discourse_move} + ${turn.evidence_use} must still count as taking up the work`,
    );
  }
});
