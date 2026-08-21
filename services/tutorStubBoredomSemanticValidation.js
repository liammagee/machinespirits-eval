import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { resolveModel } from './evalConfigLoader.js';
import {
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL,
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF,
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER,
  TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA,
  adjudicateTutorStubBoredomObservation,
  parseTutorStubBoredomSemanticAdjudication,
} from './tutorStubBoredomSemanticAdjudication.js';

export const BOREDOM_SEMANTIC_VALIDATION_REQUEST_SCHEMA =
  'machinespirits.tutor-stub.boredom-semantic-validation-request.v1';
export const BOREDOM_SEMANTIC_VALIDATION_AUTHORIZATION_SCHEMA =
  'machinespirits.tutor-stub.boredom-semantic-validation-authorization.v1';
export const BOREDOM_SEMANTIC_VALIDATION_RESULT_SCHEMA =
  'machinespirits.tutor-stub.boredom-semantic-validation-result.v1';
export const BOREDOM_SEMANTIC_VALIDATION_STUDY_ID = 'tutor-stub-boredom-semantic-validation-v1';

const EXPECTED_CORPUS_SHA256 = 'ad61f7b104c8202889c9f9eb00090a900aafea5d5bf55d7e3b89cf41db300f93';
const EXPECTED_RETRY_AUTHORITY = 'bounded_technical_recovery_thrown_transport_errors_only';
const EXPECTED_AUXILIARY_POLICY = 'null_neutral_semantic_seat_only';
const EXPECTED_PROMPT_AUTHORITY = 'frozen_adjudication_module_functions_only';

export function boredomSemanticValidationSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function boredomSemanticValidationFileSha256(filePath) {
  return boredomSemanticValidationSha256(fs.readFileSync(filePath));
}

export function boredomSemanticValidationOutputSchemaSha256() {
  return boredomSemanticValidationSha256(JSON.stringify(TUTOR_STUB_BOREDOM_SEMANTIC_OUTPUT_SCHEMA));
}

function refuse(message) {
  throw new Error(`boredom semantic validation refuses: ${message}`);
}

function assert(condition, message) {
  if (!condition) refuse(message);
}

function assertSha256(value, label) {
  assert(/^[0-9a-f]{64}$/u.test(String(value || '')), `${label} must be a lowercase SHA-256 digest`);
}

function resolveRepositoryFile(root, relativePath, label) {
  assert(typeof relativePath === 'string' && relativePath.length > 0, `${label} path is required`);
  assert(!path.isAbsolute(relativePath), `${label} path must be repository-relative`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  assert(resolved.startsWith(`${resolvedRoot}${path.sep}`), `${label} path escapes the repository`);
  assert(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), `${label} file is missing: ${relativePath}`);
  return resolved;
}

export function loadBoredomSemanticHeldoutCorpus({ root = path.resolve('.'), corpusPath }) {
  const resolved = resolveRepositoryFile(root, corpusPath, 'held-out corpus');
  const bytes = fs.readFileSync(resolved);
  return { corpus: JSON.parse(bytes.toString('utf8')), sha256: boredomSemanticValidationSha256(bytes) };
}

export function validateTutorStubBoredomSemanticValidationRequest(
  request,
  { root = path.resolve('.'), resolveModelRef = resolveModel, verifySourceClosure = true } = {},
) {
  assert(request?.schema === BOREDOM_SEMANTIC_VALIDATION_REQUEST_SCHEMA, 'request schema mismatch');
  assert(request.status === 'HOLD_PENDING_EXPLICIT_APPROVAL', 'request must retain HOLD_PENDING_EXPLICIT_APPROVAL');
  assert(request.studyId === BOREDOM_SEMANTIC_VALIDATION_STUDY_ID, 'study id mismatch');
  assert(request.authorization === null, 'the request must not embed or inherit authorization');

  assert(request.route?.modelRef === TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF, 'model route must be Sol');
  assert(request.route?.provider === TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER, 'provider must be codex');
  assert(request.route?.model === TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL, 'model must be gpt-5.6-sol');
  assert(request.route?.effort === 'low', 'reasoning effort must be low');
  assert(request.route?.timeoutMs === 120000, 'timeout must remain 120000ms');
  assert(request.route?.maxStdoutBytes === 1048576, 'stdout limit must remain 1 MiB');
  assert(request.route?.maxStderrBytes === 262144, 'stderr limit must remain 256 KiB');
  assert(request.route?.role === 'tutor_stub_boredom_performance_adjudication', 'route role mismatch');

  const resolved = resolveModelRef(request.route.modelRef);
  assert(resolved?.provider === request.route.provider, 'resolved provider differs from request');
  assert(resolved?.model === request.route.model, 'resolved model differs from request');
  assert(resolved?.isConfigured === true, 'requested CLI model route is not configured');

  assert(request.corpus?.path === 'config/tutor-stub-boredom-semantic-adjudication-heldout.v1.json', 'corpus path');
  assert(request.corpus?.sha256 === EXPECTED_CORPUS_SHA256, 'corpus digest must remain the frozen held-out digest');
  const { corpus, sha256: observedCorpusSha256 } = loadBoredomSemanticHeldoutCorpus({
    root,
    corpusPath: request.corpus.path,
  });
  assert(observedCorpusSha256 === request.corpus.sha256, 'held-out corpus bytes differ from the frozen digest');
  assert(Array.isArray(corpus.cases) && corpus.cases.length === 22, 'held-out corpus must contain exactly 22 cases');

  assert(request.scope?.plannedModelCalls === 22, 'planned model calls must be exactly 22 (one per case)');
  assert(request.scope?.maximumReservationsPerCase === 3, 'maximum reservations per case must be 3');
  assert(request.scope?.maximumModelCalls === 66, 'maximum model calls must be 66');
  assert(request.scope?.retryOrResumeAuthority === EXPECTED_RETRY_AUTHORITY, 'retry authority mismatch');
  assert(request.scope?.completedCallOutputsFinal === true, 'completed call outputs must be final');
  assert(request.scope?.auxiliaryObservationPolicy === EXPECTED_AUXILIARY_POLICY, 'auxiliary policy mismatch');
  assert(request.scope?.liveStudyAuthorized === false, 'the validation must not authorize the live study');
  assert(request.scope?.confirmationLaunchAuthorized === false, 'the validation must not authorize the confirmation');

  assert(
    request.measurement?.adjudicationModule?.path === 'services/tutorStubBoredomSemanticAdjudication.js',
    'adjudication module path mismatch',
  );
  assertSha256(request.measurement?.adjudicationModule?.sha256, 'adjudication module');
  assert(request.measurement?.promptAuthority === EXPECTED_PROMPT_AUTHORITY, 'prompt authority mismatch');
  assert(request.measurement?.minimumConfidence === 0.8, 'minimum confidence must remain 0.8');
  assert(
    request.measurement?.outputSchemaSha256 === boredomSemanticValidationOutputSchemaSha256(),
    'structured-output schema digest drift',
  );

  const gates = corpus.predeclaredGates;
  assert(request.gates?.determinateSensitivityMinimum === gates.determinateSensitivityMinimum, 'sensitivity gate');
  assert(request.gates?.determinateSpecificityMinimum === gates.determinateSpecificityMinimum, 'specificity gate');
  assert(request.gates?.referenceAgreementMinimum === gates.referenceAgreementMinimum, 'agreement gate');
  assert(
    request.gates?.ambiguousIndeterminateRateMinimum === gates.ambiguousIndeterminateRateMinimum,
    'ambiguous gate',
  );
  assert(
    request.gates?.lowConfidenceIndeterminateRateMinimum === gates.lowConfidenceIndeterminateRateMinimum,
    'low-confidence gate',
  );

  assert(
    typeof request.artifactRoot === 'string' &&
      request.artifactRoot.startsWith('.tutor-stub-auto-eval/boredom-semantic-validation-v1-'),
    'artifact root is outside the ignored validation namespace',
  );
  assert(
    !path.isAbsolute(request.artifactRoot) && !request.artifactRoot.includes('..'),
    'artifact root must be contained',
  );

  assert(request.ledger?.programmeCeiling === 5000, 'programme ceiling mismatch');
  assert(request.ledger?.plannedAttempts === 22, 'planned attempt accounting mismatch');
  assert(request.ledger?.maximumAttempts === 66, 'maximum attempt accounting mismatch');

  assert(Array.isArray(request.sourceClosure) && request.sourceClosure.length >= 10, 'source closure is incomplete');
  const seen = new Set();
  const sourceClosure = request.sourceClosure.map((entry) => {
    assert(entry && typeof entry === 'object', 'source-closure entry must be an object');
    assert(!seen.has(entry.path), `duplicate source-closure path: ${entry.path}`);
    seen.add(entry.path);
    assertSha256(entry.sha256, `source closure ${entry.path}`);
    const resolvedPath = resolveRepositoryFile(root, entry.path, 'source-closure');
    const observedSha256 = boredomSemanticValidationFileSha256(resolvedPath);
    if (verifySourceClosure) {
      assert(observedSha256 === entry.sha256, `source-closure SHA mismatch: ${entry.path}`);
    }
    return { path: entry.path, sha256: entry.sha256, observedSha256 };
  });
  for (const requiredPath of [
    'services/tutorStubBoredomSemanticValidation.js',
    'scripts/run-tutor-stub-boredom-semantic-validation.js',
    'services/tutorStubBoredomSemanticAdjudication.js',
    'services/resistantLearnerObservation.js',
    'services/cliProviderBridge.js',
    'services/evalConfigLoader.js',
    'config/providers.yaml',
    'config/tutor-stub-boredom-semantic-adjudication-heldout.v1.json',
    'config/tutor-stub-boredom-action-register-proof-dag-registration.v3.json',
    'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v3.json',
  ]) {
    assert(seen.has(requiredPath), `source closure is missing ${requiredPath}`);
  }
  const moduleEntry = request.sourceClosure.find((entry) => entry.path === request.measurement.adjudicationModule.path);
  assert(
    moduleEntry?.sha256 === request.measurement.adjudicationModule.sha256,
    'adjudication module digest differs between measurement binding and source closure',
  );

  assert(
    request.confirmationRequest?.path ===
      'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v3.json',
    'confirmation request binding path mismatch',
  );
  assertSha256(request.confirmationRequest?.sha256, 'confirmation request binding');
  const confirmationEntry = request.sourceClosure.find((entry) => entry.path === request.confirmationRequest.path);
  assert(
    confirmationEntry?.sha256 === request.confirmationRequest.sha256,
    'confirmation request digest differs between binding and source closure',
  );

  return {
    provider: resolved.provider,
    model: resolved.model,
    modelRef: request.route.modelRef,
    corpus,
    corpusSha256: observedCorpusSha256,
    sourceClosure,
  };
}

export function validateTutorStubBoredomSemanticValidationAuthorization({
  authorization,
  request,
  requestPath,
  requestSha256,
}) {
  assert(authorization?.schema === BOREDOM_SEMANTIC_VALIDATION_AUTHORIZATION_SCHEMA, 'authorization schema mismatch');
  assert(authorization.status === 'APPROVED_FOR_BOUNDED_SEMANTIC_VALIDATION_CALLS', 'authorization status mismatch');
  assert(authorization.studyId === request.studyId, 'authorization study id mismatch');
  assert(authorization.request?.path === requestPath, 'authorization request path mismatch');
  assertSha256(authorization.request?.sha256, 'authorization request');
  assert(authorization.request.sha256 === requestSha256, 'authorization request SHA mismatch');
  assert(
    authorization.scope?.maximumModelCalls === request.scope.maximumModelCalls,
    'authorization call ceiling mismatch',
  );
  assert(authorization.scope?.modelRef === request.route.modelRef, 'authorization model route mismatch');
  assert(authorization.scope?.effort === request.route.effort, 'authorization effort mismatch');
  assert(authorization.scope?.artifactRoot === request.artifactRoot, 'authorization artifact root mismatch');
  assert(authorization.scope?.liveStudyAuthorized === false, 'authorization must not approve the live study');
  assert(
    authorization.scope?.confirmationLaunchAuthorized === false,
    'authorization must not approve the confirmation launch',
  );
  assert(
    authorization.approval?.explicitBoundedValidationCalls === true,
    'explicit bounded validation approval is absent',
  );
  assert(authorization.approval?.approvedBy === 'human', 'authorization must record human approval');
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(authorization.approval?.approvedAt || ''),
    'authorization approval timestamp must be UTC ISO-8601',
  );
  assert(
    typeof authorization.approval?.evidence === 'string' && authorization.approval.evidence.trim().length > 0,
    'authorization approval evidence is required',
  );
  return true;
}

function expectedDispositionForCase(row) {
  return row.verdict === 'indeterminate' ? 'measurement_indeterminate' : row.verdict;
}

function deterministicLowConfidenceProbe(corpus) {
  const row = corpus.cases.find((entry) => entry.verdict === 'actionable_boredom');
  const evidence = Object.entries(row.evidence || {}).map(([kind, text]) => {
    const start = row.text.indexOf(text);
    assert(start >= 0, `${row.id}: probe evidence is not an exact candidate span`);
    return { kind, start, end: start + text.length, text };
  });
  const probe = parseTutorStubBoredomSemanticAdjudication({
    raw: {
      verdict: row.verdict,
      ...row.fields,
      confidence: 0.79,
      evidence,
      reason: 'Deterministic sub-threshold confidence probe for the low-confidence gate.',
    },
    candidate: row.text,
    observedRoute: {
      provider: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER,
      model: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL,
    },
  });
  return probe.measurement_disposition === 'measurement_indeterminate' ? 1 : 0;
}

export function computeTutorStubBoredomSemanticValidationMetrics({ corpus, rows }) {
  assert(Array.isArray(rows) && rows.length === corpus.cases.length, 'metrics require one row per corpus case');
  const determinate = rows.filter((row) => row.expected !== 'measurement_indeterminate');
  const positive = determinate.filter((row) => row.expected === 'actionable_boredom');
  const negative = determinate.filter((row) => row.expected !== 'actionable_boredom');
  const ambiguous = rows.filter((row) => row.expected === 'measurement_indeterminate');
  const lowConfidenceRows = rows.filter((row) => row.low_confidence === true);
  const lowConfidenceIndeterminate = lowConfidenceRows.filter((row) => row.observed === 'measurement_indeterminate');
  const probe = deterministicLowConfidenceProbe(corpus);
  const empiricalLowConfidenceRate =
    lowConfidenceRows.length === 0 ? null : lowConfidenceIndeterminate.length / lowConfidenceRows.length;
  const metrics = {
    determinate_sensitivity: positive.filter((row) => row.observed === row.expected).length / positive.length,
    determinate_specificity: negative.filter((row) => row.observed === row.expected).length / negative.length,
    reference_agreement: rows.filter((row) => row.observed === row.expected).length / rows.length,
    ambiguous_indeterminate_rate:
      ambiguous.filter((row) => row.observed === 'measurement_indeterminate').length / ambiguous.length,
    low_confidence_indeterminate_rate:
      empiricalLowConfidenceRate === null ? probe : Math.min(probe, empiricalLowConfidenceRate),
    deterministic_low_confidence_probe: probe,
    empirical_low_confidence_rows: lowConfidenceRows.length,
    empirical_low_confidence_indeterminate_rate: empiricalLowConfidenceRate,
  };
  const gates = corpus.predeclaredGates;
  const gateResults = {
    determinate_sensitivity: metrics.determinate_sensitivity >= gates.determinateSensitivityMinimum,
    determinate_specificity: metrics.determinate_specificity >= gates.determinateSpecificityMinimum,
    reference_agreement: metrics.reference_agreement >= gates.referenceAgreementMinimum,
    ambiguous_indeterminate_rate: metrics.ambiguous_indeterminate_rate >= gates.ambiguousIndeterminateRateMinimum,
    low_confidence_indeterminate_rate:
      metrics.low_confidence_indeterminate_rate >= gates.lowConfidenceIndeterminateRateMinimum,
  };
  return {
    metrics,
    gates,
    gateResults,
    pass: Object.values(gateResults).every(Boolean),
  };
}

export async function executeTutorStubBoredomSemanticValidation({
  request,
  root = path.resolve('.'),
  callModel,
  now = () => new Date().toISOString(),
  onCaseSealed = null,
} = {}) {
  assert(
    typeof callModel === 'function',
    'boredom semantic validation requires an explicitly injected model caller; the service never dials the bridge by default',
  );
  const validation = validateTutorStubBoredomSemanticValidationRequest(request, { root });
  const resolved = { provider: validation.provider, model: validation.model };
  let totalCalls = 0;
  const promptCaller = async ({ prompt, systemPrompt, role, outputSchema, maxTokens, signal }) => {
    totalCalls += 1;
    assert(totalCalls <= request.scope.maximumModelCalls, 'model-call ceiling exceeded');
    const response = await callModel(resolved, systemPrompt, prompt, role, {
      effort: request.route.effort,
      timeoutMs: request.route.timeoutMs,
      maxStdoutBytes: request.route.maxStdoutBytes,
      maxStderrBytes: request.route.maxStderrBytes,
      outputSchema,
      maxTokens,
      signal,
    });
    assert(response?.structuredOutput === true, 'structured-output transport was not active');
    assert(response?.effort === request.route.effort, 'observed effort differs from requested effort');
    return response;
  };

  const caseResults = [];
  const rows = [];
  for (const row of validation.corpus.cases) {
    const attempts = [];
    let adjudication = null;
    for (let attempt = 1; attempt <= request.scope.maximumReservationsPerCase; attempt += 1) {
      try {
        adjudication = await adjudicateTutorStubBoredomObservation({
          candidate: row.text,
          auxiliaryObservation: null,
          callModel: promptCaller,
          resolved,
        });
        attempts.push({ attempt, status: 'completed_final', completedAt: now() });
        break;
      } catch (error) {
        attempts.push({
          attempt,
          status: 'technical_failure',
          errorCode: error?.code || error?.name || 'ERROR',
          errorMessage: String(error?.message || error),
          failedAt: now(),
        });
      }
    }
    const sealed = {
      id: row.id,
      candidate: row.text,
      expected: expectedDispositionForCase(row),
      attempts,
      adjudication,
      observed: adjudication ? adjudication.measurement_disposition : null,
      completed: Boolean(adjudication),
    };
    caseResults.push(sealed);
    if (typeof onCaseSealed === 'function') onCaseSealed(sealed);
    if (!adjudication) {
      return {
        schema: BOREDOM_SEMANTIC_VALIDATION_RESULT_SCHEMA,
        status: 'failed_technical_ceiling',
        studyId: request.studyId,
        failedAt: now(),
        failedCaseId: row.id,
        modelCallsCompleted: totalCalls - attempts.filter((entry) => entry.status === 'technical_failure').length,
        totalReservationsUsed: totalCalls,
        retryOrResumeAuthority: request.scope.retryOrResumeAuthority,
        interpretation:
          'A held-out case exhausted its bounded technical reservations without a completed model call. ' +
          'The validation is categorically incomplete; no gate can pass and no confirmation launch is possible.',
        cases: caseResults,
      };
    }
    rows.push({
      id: row.id,
      expected: sealed.expected,
      observed: adjudication.measurement_disposition,
      parse_ok: adjudication.parse_ok,
      route_matches: adjudication.independent_route.matches,
      evidence_spans_valid: adjudication.evidence_audit.pass,
      low_confidence: adjudication.low_confidence,
      confidence: adjudication.confidence,
    });
  }

  const assessment = computeTutorStubBoredomSemanticValidationMetrics({ corpus: validation.corpus, rows });
  return {
    schema: BOREDOM_SEMANTIC_VALIDATION_RESULT_SCHEMA,
    status: 'completed',
    studyId: request.studyId,
    completedAt: now(),
    corpus: { path: request.corpus.path, sha256: validation.corpusSha256, cases: validation.corpus.cases.length },
    route: {
      modelRef: validation.modelRef,
      provider: validation.provider,
      model: validation.model,
      effort: request.route.effort,
    },
    accounting: {
      plannedModelCalls: request.scope.plannedModelCalls,
      modelCallsCompleted: rows.length,
      technicalFailureAttempts: totalCalls - rows.length,
      totalReservationsUsed: totalCalls,
      maximumModelCalls: request.scope.maximumModelCalls,
    },
    retryOrResumeAuthority: request.scope.retryOrResumeAuthority,
    rows,
    metrics: assessment.metrics,
    gates: assessment.gates,
    gateResults: assessment.gateResults,
    pass: assessment.pass,
    liveStudyAuthorized: false,
    confirmationLaunchAuthorized: false,
    cases: caseResults,
  };
}
