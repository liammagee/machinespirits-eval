import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  computeTutorStubBoredomSemanticValidationMetrics,
  executeTutorStubBoredomSemanticValidation,
  validateTutorStubBoredomSemanticValidationAuthorization,
  validateTutorStubBoredomSemanticValidationRequest,
} from '../services/tutorStubBoredomSemanticValidation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_PATH = 'config/tutor-stub-boredom-semantic-validation-request.v1.json';
const HELDOUT_PATH = 'config/tutor-stub-boredom-semantic-adjudication-heldout.v1.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
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

test('the validation request validates against the frozen corpus, route, and closure', () => {
  const request = readJson(REQUEST_PATH);
  const validation = validateTutorStubBoredomSemanticValidationRequest(request, { root: ROOT });
  assert.equal(validation.provider, 'codex');
  assert.equal(validation.model, 'gpt-5.6-sol');
  assert.equal(validation.corpus.cases.length, 22);
});

test('request drift fails closed', () => {
  const request = readJson(REQUEST_PATH);
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
    assert.throws(() => validateTutorStubBoredomSemanticValidationRequest(mutated, { root: ROOT }));
  }
});

test('authorization binding fails closed on digest, scope, and approval drift', () => {
  const request = readJson(REQUEST_PATH);
  const requestSha256 = 'a'.repeat(64);
  const authorization = {
    schema: 'machinespirits.tutor-stub.boredom-semantic-validation-authorization.v1',
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
  assert.equal(
    validateTutorStubBoredomSemanticValidationAuthorization({
      authorization,
      request,
      requestPath: REQUEST_PATH,
      requestSha256,
    }),
    true,
  );
  for (const mutate of [
    (row) => (row.status = 'DRAFT'),
    (row) => (row.request.sha256 = 'b'.repeat(64)),
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

test('mock execution with reference outputs passes every predeclared gate at exactly 22 calls', async () => {
  const request = readJson(REQUEST_PATH);
  const corpus = readJson(HELDOUT_PATH);
  const { callModel, calls } = referenceMockCallModel(corpus);
  const result = await executeTutorStubBoredomSemanticValidation({ request, root: ROOT, callModel });
  assert.equal(result.status, 'completed');
  assert.equal(result.accounting.modelCallsCompleted, 22);
  assert.equal(result.accounting.totalReservationsUsed, 22);
  assert.equal(calls.length, 22);
  assert.ok(calls.every((row) => row.effort === 'low'));
  assert.equal(result.metrics.determinate_sensitivity, 1);
  assert.equal(result.metrics.determinate_specificity, 1);
  assert.equal(result.metrics.reference_agreement, 1);
  assert.equal(result.metrics.ambiguous_indeterminate_rate, 1);
  assert.equal(result.metrics.low_confidence_indeterminate_rate, 1);
  assert.equal(result.pass, true);
});

test('a flipped actionable case fails the sensitivity gate without any retry', async () => {
  const request = readJson(REQUEST_PATH);
  const corpus = readJson(HELDOUT_PATH);
  const { callModel, calls } = referenceMockCallModel(corpus, {
    mutate: (row, raw) => {
      if (row.id !== 'museum_actionable_02') return raw;
      return {
        ...raw,
        verdict: 'nonactionable_boredom',
        effort_withdrawal: false,
        evidence: raw.evidence.filter((entry) => entry.kind !== 'effort_withdrawal'),
      };
    },
  });
  const result = await executeTutorStubBoredomSemanticValidation({ request, root: ROOT, callModel });
  assert.equal(result.status, 'completed');
  assert.equal(calls.length, 22);
  assert.equal(result.metrics.determinate_sensitivity, 0.8);
  assert.equal(result.gateResults.determinate_sensitivity, false);
  assert.equal(result.pass, false);
});

test('a malformed completed output is final measurement_indeterminate, never retried', async () => {
  const request = readJson(REQUEST_PATH);
  const corpus = readJson(HELDOUT_PATH);
  const { callModel, calls } = referenceMockCallModel(corpus, {
    mutate: (row, raw) => (row.id === 'mint_negative_03' ? { garbage: true } : raw),
  });
  const result = await executeTutorStubBoredomSemanticValidation({ request, root: ROOT, callModel });
  assert.equal(result.status, 'completed');
  assert.equal(calls.length, 22);
  const target = result.rows.find((row) => row.id === 'mint_negative_03');
  assert.equal(target.observed, 'measurement_indeterminate');
  assert.equal(target.parse_ok, false);
  assert.equal(result.metrics.determinate_specificity, 14 / 15);
  assert.equal(result.metrics.reference_agreement, 21 / 22);
});

test('a thrown transport error consumes a bounded extra reservation and the final output is kept', async () => {
  const request = readJson(REQUEST_PATH);
  const corpus = readJson(HELDOUT_PATH);
  const { callModel, calls } = referenceMockCallModel(corpus, {
    failures: [['harbor_productive_01', 1]],
  });
  const result = await executeTutorStubBoredomSemanticValidation({ request, root: ROOT, callModel });
  assert.equal(result.status, 'completed');
  assert.equal(calls.length, 23);
  assert.equal(result.accounting.modelCallsCompleted, 22);
  assert.equal(result.accounting.technicalFailureAttempts, 1);
  assert.equal(result.accounting.totalReservationsUsed, 23);
  assert.equal(result.pass, true);
  const sealed = result.cases.find((row) => row.id === 'harbor_productive_01');
  assert.equal(sealed.attempts.length, 2);
  assert.equal(sealed.attempts[0].status, 'technical_failure');
  assert.equal(sealed.attempts[1].status, 'completed_final');
});

test('reservation-ceiling exhaustion produces a categorical failure with no gate evaluation', async () => {
  const request = readJson(REQUEST_PATH);
  const corpus = readJson(HELDOUT_PATH);
  const { callModel } = referenceMockCallModel(corpus, {
    failures: [['harbor_productive_01', 3]],
  });
  const result = await executeTutorStubBoredomSemanticValidation({ request, root: ROOT, callModel });
  assert.equal(result.status, 'failed_technical_ceiling');
  assert.equal(result.failedCaseId, 'harbor_productive_01');
  assert.equal(result.metrics, undefined);
  assert.equal(result.pass, undefined);
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
  const target = leaky.find((row) => row.id === 'canal_actionable_01');
  target.low_confidence = true;
  target.confidence = 0.7;
  const leakyAssessment = computeTutorStubBoredomSemanticValidationMetrics({ corpus, rows: leaky });
  assert.equal(leakyAssessment.metrics.empirical_low_confidence_rows, 1);
  assert.equal(leakyAssessment.metrics.empirical_low_confidence_indeterminate_rate, 0);
  assert.equal(leakyAssessment.metrics.low_confidence_indeterminate_rate, 0);
  assert.equal(leakyAssessment.gateResults.low_confidence_indeterminate_rate, false);
  assert.equal(leakyAssessment.pass, false);
});
