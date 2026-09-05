import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  boredomSemanticValidationFileSha256,
  computeTutorStubBoredomSemanticValidationMetrics,
  executeTutorStubBoredomSemanticValidation,
  validateTutorStubBoredomSemanticValidationAuthorization,
  validateTutorStubBoredomSemanticValidationRequest,
} from '../services/tutorStubBoredomSemanticValidation.js';
import {
  expectedVerdictV3,
  parseTutorStubBoredomSemanticAdjudication,
} from '../services/tutorStubBoredomSemanticAdjudicationV3.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_PATH = 'config/tutor-stub-boredom-semantic-validation-request.v4.json';
// The request records a digest for each file in its source closure. Comparing
// those digests with the files on disk answers a launch-time question: is the
// tree in front of me the tree that was measured? It is not a fact about the
// instrument, and any later commit to a listed file would otherwise turn every
// test in this file red. The digest guard has its own test below, and the
// launch script keeps the check on by default.
const INSTRUMENT_ONLY = { root: ROOT, verifySourceClosure: false };
const HELDOUT_PATH = 'config/tutor-stub-boredom-semantic-adjudication-heldout.v4.json';
const SOL_ROUTE = { provider: 'codex', model: 'gpt-5.6-sol' };

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

// The historical request pins the digests its closure had on the day it was
// frozen. Any later edit to any closure file makes it fail closed, and which
// file drifts first is not stable across branches, so the fixture rebinds
// every entry to current bytes rather than naming one file.
function readCurrentSourceFixtureRequest() {
  const request = readJson(REQUEST_PATH);
  const bridge = request.sourceClosure.find((entry) => entry.path === 'services/cliProviderBridge.js');
  assert.ok(bridge, 'historical request must bind the Claude CLI bridge');
  for (const entry of request.sourceClosure) {
    entry.sha256 = boredomSemanticValidationFileSha256(path.join(ROOT, entry.path));
  }
  // The measurement block mirrors one closure digest, and the validator refuses
  // when the two disagree, so the mirror moves with the closure.
  const adjudicationModule = request.measurement.adjudicationModule;
  const moduleEntry = request.sourceClosure.find((entry) => entry.path === adjudicationModule.path);
  assert.ok(moduleEntry, 'historical request must bind the adjudication module in its source closure');
  adjudicationModule.sha256 = moduleEntry.sha256;
  return request;
}

function referenceRawFor(row, { confidence = 0.95 } = {}) {
  const evidence = Object.entries(row.evidence || {}).map(([kind, text]) => {
    const start = row.text.indexOf(text);
    assert.ok(start >= 0, `${row.id}: reference evidence must be an exact span`);
    return { kind, start, end: start + text.length, text };
  });
  return {
    verdict: row.verdict,
    ...row.fields,
    confidence,
    evidence,
    reason: 'Mock reference adjudication for zero-call validation tests.',
  };
}

function referenceMockCallModel(corpus, { mutate = null, failures = null } = {}) {
  const byText = new Map(corpus.cases.map((row) => [row.text, row]));
  const failureBudget = new Map(failures || []);
  const calls = [];
  const callModel = async (agentConfig, systemPrompt, userPrompt, role, opts) => {
    const candidate = userPrompt.split('\n').slice(1, -1).join('\n');
    const row = byText.get(candidate);
    assert.ok(row, 'mock received an unknown candidate');
    const remaining = failureBudget.get(row.id) || 0;
    calls.push({ id: row.id, role, effort: opts?.effort });
    if (remaining > 0) {
      failureBudget.set(row.id, remaining - 1);
      const error = new Error('mock transport failure');
      error.code = 'MOCK_TRANSPORT';
      throw error;
    }
    let raw = referenceRawFor(row);
    if (typeof mutate === 'function') raw = mutate(row, raw) || raw;
    return {
      text: JSON.stringify(raw),
      provider: agentConfig.provider,
      model: agentConfig.model,
      effort: opts?.effort,
      structuredOutput: true,
      latencyMs: 5,
      usage: {},
    };
  };
  return { callModel, calls };
}

test('the historical request records bridge drift while a current-source fixture validates', () => {
  const request = readJson(REQUEST_PATH);
  const historical = validateTutorStubBoredomSemanticValidationRequest(request, { root: ROOT });
  const drifted = historical.digestRecords.filter((row) => row.drifted);
  assert.ok(drifted.some((row) => row.path.startsWith('services/')));
  for (const row of drifted) assert.notEqual(row.observedSha256, row.recordedSha256);
  const currentRequest = readCurrentSourceFixtureRequest();
  const validation = validateTutorStubBoredomSemanticValidationRequest(currentRequest, { root: ROOT });
  assert.equal(validation.provider, 'codex');
  assert.equal(validation.model, 'gpt-5.6-sol');
  assert.equal(validation.corpus.cases.length, 55);
});

test('request drift fails closed', () => {
  const request = readCurrentSourceFixtureRequest();
  for (const mutate of [
    (row) => (row.status = 'APPROVED'),
    (row) => (row.route.modelRef = 'codex.gpt-5.6-luna'),
    (row) => (row.route.effort = 'high'),
    (row) => (row.corpus.sha256 = '0'.repeat(64)),
    (row) => (row.scope.maximumModelCalls = 999),
    (row) => (row.scope.retryOrResumeAuthority = 'unbounded'),
    (row) => (row.scope.completedCallOutputsFinal = false),
    (row) => (row.scope.auxiliaryObservationPolicy = 'live_auxiliary'),
    (row) => (row.scope.liveStudyAuthorized = true),
    (row) => (row.scope.confirmationLaunchAuthorized = true),
    (row) => (row.gates.determinateSensitivityMinimum = 0.5),
    (row) => (row.measurement.minimumConfidence = 0.5),
    (row) => (row.measurement.outputSchemaSha256 = '0'.repeat(64)),
    (row) => (row.authorization = { approved: true }),
    (row) => row.sourceClosure.splice(0, 1),
  ]) {
    const mutated = structuredClone(request);
    mutate(mutated);
    assert.throws(() => validateTutorStubBoredomSemanticValidationRequest(mutated, INSTRUMENT_ONLY));
  }
});

test('the source-digest guard passes a matching tree and records a file whose bytes moved', () => {
  // The committed v4 request records the tree as it stood when the 55-case
  // corpus was spent. Some of those files have moved on since, which is what
  // "spent" means, so this test does not read the committed digests. It builds
  // a request whose digests match the tree right now, and checks the guard on
  // that: a matching tree passes, one wrong digest refuses.
  const request = readJson(REQUEST_PATH);
  const matching = structuredClone(request);
  for (const row of matching.sourceClosure) {
    row.sha256 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(ROOT, row.path)))
      .digest('hex');
  }
  const modulePath = matching.measurement.adjudicationModule.path;
  matching.measurement.adjudicationModule.sha256 = matching.sourceClosure.find((row) => row.path === modulePath).sha256;
  matching.confirmationRequest.sha256 = matching.sourceClosure.find(
    (row) => row.path === matching.confirmationRequest.path,
  ).sha256;
  validateTutorStubBoredomSemanticValidationRequest(matching, { root: ROOT });

  // Point one entry at bytes the file does not have. The check must record the
  // drift and must name the file it recorded it on.
  const drifted = structuredClone(matching);
  const entry = drifted.sourceClosure.find((row) => row.path === modulePath);
  entry.sha256 = '0'.repeat(64);
  // The measurement binding carries the same digest, so move it too. Otherwise
  // the request fails the earlier binding check and never reaches the guard.
  drifted.measurement.adjudicationModule.sha256 = entry.sha256;
  const record = validateTutorStubBoredomSemanticValidationRequest(drifted, { root: ROOT }).digestRecords.find(
    (row) => row.path === modulePath,
  );
  assert.equal(record.drifted, true);
  assert.equal(record.recordedSha256, '0'.repeat(64));
  assert.notEqual(record.observedSha256, record.recordedSha256);

  // Turning the check off is what instrument-behaviour tests do, and it must
  // let the same request through.
  validateTutorStubBoredomSemanticValidationRequest(drifted, INSTRUMENT_ONLY);
});

test('authorization binding fails closed on digest, scope, and approval drift', () => {
  const request = readCurrentSourceFixtureRequest();
  const requestSha256 = 'a'.repeat(64);
  const authorization = {
    schema: 'machinespirits.tutor-stub.boredom-semantic-validation-authorization.v4',
    status: 'APPROVED_FOR_BOUNDED_SEMANTIC_VALIDATION_CALLS',
    studyId: request.studyId,
    request: { path: REQUEST_PATH, sha256: requestSha256 },
    scope: {
      maximumModelCalls: request.scope.maximumModelCalls,
      modelRef: request.route.modelRef,
      effort: request.route.effort,
      artifactRoot: request.artifactRoot,
      liveStudyAuthorized: false,
      confirmationLaunchAuthorized: false,
    },
    approval: {
      explicitBoundedValidationCalls: true,
      approvedBy: 'human',
      approvedAt: '2026-08-20T00:00:00.000Z',
      evidence: 'User task message authorizing the empirical semantic-instrument validation.',
    },
  };
  const clean = validateTutorStubBoredomSemanticValidationAuthorization({
    authorization,
    request,
    requestPath: REQUEST_PATH,
    requestSha256,
  });
  assert.equal(clean.authorized, true);
  const cleanRecord = clean.digestRecords.find((row) => row.path === REQUEST_PATH);
  assert.ok(cleanRecord, 'the request digest is recorded');
  assert.equal(cleanRecord.drifted, false);

  // A drifted request digest is recorded, never refused: editing the request in
  // place must not turn into a re-approval ceremony (CLAUDE.md, 2026-08-21).
  const editedRequest = structuredClone(authorization);
  editedRequest.request.sha256 = 'b'.repeat(64);
  const drifted = validateTutorStubBoredomSemanticValidationAuthorization({
    authorization: editedRequest,
    request,
    requestPath: REQUEST_PATH,
    requestSha256,
  });
  assert.equal(drifted.authorized, true);
  const driftedRecord = drifted.digestRecords.find((row) => row.path === REQUEST_PATH);
  assert.equal(driftedRecord.drifted, true);
  assert.equal(driftedRecord.recordedSha256, 'b'.repeat(64));
  assert.equal(driftedRecord.observedSha256, requestSha256);

  for (const mutate of [
    (row) => (row.status = 'DRAFT'),
    (row) => (row.scope.maximumModelCalls = 9999),
    (row) => (row.scope.modelRef = 'codex.gpt-5.6-luna'),
    (row) => (row.scope.liveStudyAuthorized = true),
    (row) => (row.scope.confirmationLaunchAuthorized = true),
    (row) => (row.approval.explicitBoundedValidationCalls = false),
    (row) => (row.approval.approvedBy = 'agent'),
    (row) => (row.approval.evidence = ''),
  ]) {
    const mutated = structuredClone(authorization);
    mutate(mutated);
    assert.throws(() =>
      validateTutorStubBoredomSemanticValidationAuthorization({
        authorization: mutated,
        request,
        requestPath: REQUEST_PATH,
        requestSha256,
      }),
    );
  }
});

test('execution without an explicitly injected model caller refuses before any call', async () => {
  const request = readCurrentSourceFixtureRequest();
  await assert.rejects(
    () => executeTutorStubBoredomSemanticValidation({ request, ...INSTRUMENT_ONLY }),
    /explicitly injected model caller/,
  );
});

test('mock execution with reference outputs passes every predeclared gate at exactly 55 calls', async () => {
  const request = readCurrentSourceFixtureRequest();
  const corpus = readJson(HELDOUT_PATH);
  const { callModel, calls } = referenceMockCallModel(corpus);
  const result = await executeTutorStubBoredomSemanticValidation({ request, callModel, ...INSTRUMENT_ONLY });
  assert.equal(result.status, 'completed');
  assert.equal(result.accounting.modelCallsCompleted, 55);
  assert.equal(result.accounting.totalReservationsUsed, 55);
  assert.equal(calls.length, 55);
  assert.ok(calls.every((row) => row.effort === 'low'));
  assert.equal(result.metrics.determinate_sensitivity, 1);
  assert.equal(result.metrics.determinate_specificity, 1);
  assert.equal(result.metrics.reference_agreement, 1);
  assert.equal(result.metrics.ambiguous_indeterminate_rate, 1);
  assert.equal(result.metrics.low_confidence_indeterminate_rate, 1);
  assert.equal(result.pass, true);
});

test('a flipped actionable case fails the sensitivity gate without any retry', async () => {
  const request = readCurrentSourceFixtureRequest();
  const corpus = readJson(HELDOUT_PATH);
  const { callModel, calls } = referenceMockCallModel(corpus, {
    mutate: (row, raw) => {
      if (row.id !== 'sluice_actionable_02') return raw;
      return {
        ...raw,
        verdict: 'nonactionable_boredom',
        effort_withdrawal: false,
        evidence: raw.evidence.filter((entry) => entry.kind !== 'effort_withdrawal'),
      };
    },
  });
  const result = await executeTutorStubBoredomSemanticValidation({ request, callModel, ...INSTRUMENT_ONLY });
  assert.equal(result.status, 'completed');
  assert.equal(calls.length, 55);
  assert.equal(result.metrics.determinate_sensitivity, 8 / 9);
  assert.equal(result.gateResults.determinate_sensitivity, false);
  assert.equal(result.pass, false);
});

test('a malformed completed output is final measurement_indeterminate, never retried', async () => {
  const request = readCurrentSourceFixtureRequest();
  const corpus = readJson(HELDOUT_PATH);
  const { callModel, calls } = referenceMockCallModel(corpus, {
    mutate: (row, raw) => (row.id === 'moorings_negative_04' ? { garbage: true } : raw),
  });
  const result = await executeTutorStubBoredomSemanticValidation({ request, callModel, ...INSTRUMENT_ONLY });
  assert.equal(result.status, 'completed');
  assert.equal(calls.length, 55);
  const target = result.rows.find((row) => row.id === 'moorings_negative_04');
  assert.equal(target.observed, 'measurement_indeterminate');
  assert.equal(target.parse_ok, false);
  assert.equal(result.metrics.determinate_specificity, 39 / 40);
  assert.equal(result.metrics.reference_agreement, 54 / 55);
});

test('a resolved output with a transport-contract defect is final indeterminate, never retried', async () => {
  const request = readCurrentSourceFixtureRequest();
  const corpus = readJson(HELDOUT_PATH);
  const base = referenceMockCallModel(corpus);
  const callModel = async (agentConfig, systemPrompt, userPrompt, role, opts) => {
    const response = await base.callModel(agentConfig, systemPrompt, userPrompt, role, opts);
    const candidate = userPrompt.split('\n').slice(1, -1).join('\n');
    const row = corpus.cases.find((entry) => entry.text === candidate);
    if (row.id === 'fort_nonactionable_01') return { ...response, structuredOutput: false };
    return response;
  };
  const result = await executeTutorStubBoredomSemanticValidation({ request, callModel, ...INSTRUMENT_ONLY });
  assert.equal(result.status, 'completed');
  assert.equal(base.calls.length, 55);
  assert.equal(result.accounting.totalReservationsUsed, 55);
  const sealed = result.cases.find((row) => row.id === 'fort_nonactionable_01');
  assert.equal(sealed.attempts.length, 1);
  assert.equal(sealed.attempts[0].status, 'completed_final');
  assert.equal(sealed.observed, 'measurement_indeterminate');
  assert.ok(sealed.adjudication.issues.includes('transport_contract:structured_output_inactive'));
  assert.equal(sealed.adjudication.parse_ok, false);
  assert.equal(result.metrics.determinate_specificity, 39 / 40);
});

test('a thrown transport error consumes a bounded extra reservation and the final output is kept', async () => {
  const request = readCurrentSourceFixtureRequest();
  const corpus = readJson(HELDOUT_PATH);
  const { callModel, calls } = referenceMockCallModel(corpus, {
    failures: [['airfield_productive_01', 1]],
  });
  const result = await executeTutorStubBoredomSemanticValidation({ request, callModel, ...INSTRUMENT_ONLY });
  assert.equal(result.status, 'completed');
  assert.equal(calls.length, 56);
  assert.equal(result.accounting.modelCallsCompleted, 55);
  assert.equal(result.accounting.technicalFailureAttempts, 1);
  assert.equal(result.accounting.totalReservationsUsed, 56);
  assert.equal(result.pass, true);
  const sealed = result.cases.find((row) => row.id === 'airfield_productive_01');
  assert.equal(sealed.attempts.length, 2);
  assert.equal(sealed.attempts[0].status, 'technical_failure');
  assert.equal(sealed.attempts[1].status, 'completed_final');
});

test('reservation-ceiling exhaustion produces a categorical failure with no gate evaluation', async () => {
  const request = readCurrentSourceFixtureRequest();
  const corpus = readJson(HELDOUT_PATH);
  const { callModel } = referenceMockCallModel(corpus, {
    failures: [['airfield_productive_01', 3]],
  });
  const result = await executeTutorStubBoredomSemanticValidation({ request, callModel, ...INSTRUMENT_ONLY });
  assert.equal(result.status, 'failed_technical_ceiling');
  assert.equal(result.failedCaseId, 'airfield_productive_01');
  assert.equal(result.metrics, undefined);
  assert.equal(result.pass, undefined);
});

test('v3 evidence is quote-anchored: exact quotes with wrong offsets stay valid, non-substrings fail closed', () => {
  const corpus = readJson(HELDOUT_PATH);
  const row = corpus.cases.find((entry) => entry.id === 'airfield_productive_01');
  const raw = referenceRawFor(row);
  // Exact quotes, deliberately wrong offsets (the v1 kiln failure mode).
  const shifted = {
    ...raw,
    evidence: raw.evidence.map((entry) => ({ ...entry, start: entry.start + 1, end: entry.end + 1 })),
  };
  const anchored = parseTutorStubBoredomSemanticAdjudication({
    raw: shifted,
    candidate: row.text,
    observedRoute: SOL_ROUTE,
  });
  assert.equal(anchored.parse_ok, true);
  assert.equal(anchored.measurement_disposition, 'productive_uptake');
  assert.equal(
    anchored.evidence_audit.evidence.every((entry) => row.text.slice(entry.start, entry.end) === entry.text),
    true,
  );
  // A quote that is not an exact substring must fail closed.
  const invented = {
    ...raw,
    evidence: [{ ...raw.evidence[0], text: 'a span the candidate never contains' }],
  };
  const refused = parseTutorStubBoredomSemanticAdjudication({
    raw: invented,
    candidate: row.text,
    observedRoute: SOL_ROUTE,
  });
  assert.equal(refused.parse_ok, false);
  assert.equal(refused.measurement_disposition, 'measurement_indeterminate');
  assert.ok(refused.issues.some((issue) => issue.includes('text_not_substring')));
});

test('v3 taxonomy: bare uptake without a boredom cue is no_boredom, not productive_uptake', () => {
  const fields = {
    boredom_cue: false,
    effort_withdrawal: false,
    productive_uptake: true,
    process_impatience: false,
  };
  assert.equal(expectedVerdictV3(fields), 'no_boredom');
  assert.equal(expectedVerdictV3({ ...fields, boredom_cue: true }), 'productive_uptake');
  assert.equal(expectedVerdictV3({ ...fields, effort_withdrawal: true }), 'indeterminate');
  const corpus = readJson(HELDOUT_PATH);
  const row = corpus.cases.find((entry) => entry.id === 'pierhead_negative_07');
  assert.equal(row.verdict, 'no_boredom');
  const parsed = parseTutorStubBoredomSemanticAdjudication({
    raw: referenceRawFor(row),
    candidate: row.text,
    observedRoute: SOL_ROUTE,
  });
  assert.equal(parsed.parse_ok, true);
  assert.equal(parsed.measurement_disposition, 'no_boredom');
  // Declaring productive_uptake over the same fields is a verdict-field inconsistency.
  const inconsistent = parseTutorStubBoredomSemanticAdjudication({
    raw: { ...referenceRawFor(row), verdict: 'productive_uptake' },
    candidate: row.text,
    observedRoute: SOL_ROUTE,
  });
  assert.equal(inconsistent.parse_ok, false);
  assert.equal(inconsistent.measurement_disposition, 'measurement_indeterminate');
  assert.ok(inconsistent.issues.includes('verdict_field_inconsistency'));
});

test('low-confidence live outputs must land indeterminate or the gate fails', () => {
  const corpus = readJson(HELDOUT_PATH);
  const rows = corpus.cases.map((row) => ({
    id: row.id,
    expected: row.verdict === 'indeterminate' ? 'measurement_indeterminate' : row.verdict,
    observed: row.verdict === 'indeterminate' ? 'measurement_indeterminate' : row.verdict,
    parse_ok: true,
    route_matches: true,
    evidence_spans_valid: true,
    low_confidence: false,
    confidence: 0.95,
  }));
  const clean = computeTutorStubBoredomSemanticValidationMetrics({ corpus, rows });
  assert.equal(clean.metrics.low_confidence_indeterminate_rate, 1);
  assert.equal(clean.metrics.empirical_low_confidence_rows, 0);
  assert.equal(clean.pass, true);

  const leaky = structuredClone(rows);
  const target = leaky.find((row) => row.id === 'slipway_actionable_01');
  target.low_confidence = true;
  target.confidence = 0.7;
  const leakyAssessment = computeTutorStubBoredomSemanticValidationMetrics({ corpus, rows: leaky });
  assert.equal(leakyAssessment.metrics.empirical_low_confidence_rows, 1);
  assert.equal(leakyAssessment.metrics.empirical_low_confidence_indeterminate_rate, 0);
  assert.equal(leakyAssessment.metrics.low_confidence_indeterminate_rate, 0);
  assert.equal(leakyAssessment.gateResults.low_confidence_indeterminate_rate, false);
  assert.equal(leakyAssessment.pass, false);
});
