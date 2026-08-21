import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildTutorStubResistanceRecoverySemanticZeroCallFixture } from '../services/tutorStubResistanceRecoverySemanticAdjudicationV2.js';
import {
  buildTutorStubResistanceRecoverySemanticBlindedValidationCases,
  loadTutorStubResistanceRecoverySemanticValidation,
  runTutorStubResistanceRecoverySemanticValidationPreflight,
  tutorStubResistanceRecoverySemanticOpaqueCaseId,
  validateTutorStubResistanceRecoverySemanticValidationRegistration,
} from '../services/tutorStubResistanceRecoverySemanticValidation.js';
import {
  analyzeTutorStubResistanceRecoverySemanticValidation,
  buildTutorStubResistanceRecoverySemanticValidationPlan,
  runTutorStubResistanceRecoverySemanticValidation,
  writeTutorStubResistanceRecoverySemanticValidationReport,
} from '../services/tutorStubResistanceRecoverySemanticValidationRuntime.js';
import { validatePaidStudyEndpointGoCertificate } from '../services/paidStudyEndpointPreflight.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTRACT = 'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v2.json';
const CERTIFICATE =
  'config/paid-study-endpoints/tutor-stub-resistance-recovery-semantic-validation.v2.endpoint-go.json';

function json(repoPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, repoPath), 'utf8'));
}

function fixtureModelCall(loaded, calls) {
  return async ({ provider, model }, _system, user, role, options) => {
    const prompt = JSON.parse(user);
    const source = loaded.corpus.cases.find(
      (row) => tutorStubResistanceRecoverySemanticOpaqueCaseId(row) === prompt.case_id,
    );
    const judge = loaded.instrument.measurement.judges.find((row) => row.id === prompt.judge.id);
    const fixture = buildTutorStubResistanceRecoverySemanticZeroCallFixture({
      corpusCase: { ...source, case_id: prompt.case_id },
      judge,
    });
    calls.push({ role, caseId: prompt.case_id, judgeId: judge.id });
    return {
      text: JSON.stringify(fixture.modelOutput),
      provider,
      model,
      effort: options.effort,
      structuredOutput: true,
      prohibitedToolEventCount: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
    };
  };
}

function routeResolver(loaded) {
  return (modelRef) => {
    const judge = loaded.instrument.measurement.judges.find((row) => row.modelRef === modelRef);
    return { provider: judge.provider, model: judge.model };
  };
}

function findArchiveManifest(root) {
  const matches = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name === 'archive-manifest.json') matches.push(target);
    }
  };
  visit(root);
  assert.equal(matches.length, 1);
  return matches[0];
}

test('outcome heldout is frozen, blinded, stratified, and zero-call endpoint wiring passes', () => {
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  assert.equal(loaded.registration.version, 2);
  assert.equal(
    loaded.registration.instrument.registrationPath,
    'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v2.json',
  );
  assert.equal(
    loaded.registration.executionReadiness.liveExecutorStatus,
    'zero_call_ready_pending_digest_bound_go_request_and_model_authority',
  );
  assert.equal(loaded.corpus.cases.length, 120);
  const blinded = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases);
  assert.equal(blinded.length, 120);
  assert.equal(new Set(blinded.map((row) => row.case_id)).size, 120);
  const exposed = JSON.stringify(blinded);
  for (const row of loaded.corpus.cases) assert.equal(exposed.includes(row.case_id), false);
  assert.equal(exposed.includes('"expected"'), false);
  assert.ok(blinded.every((row) => typeof row.intervening_tutor === 'string' && row.intervening_tutor.length > 0));
  for (const mutate of [
    (value) => (value.executionReadiness.liveExecutorStatus = 'pending_shared_checkpoint_runtime_adapter'),
    (value) => (value.heldout.interveningTutorDependentCases = 23),
    (value) => (value.authorization.extra = true),
  ]) {
    const registration = structuredClone(loaded.registration);
    mutate(registration);
    const validation = validateTutorStubResistanceRecoverySemanticValidationRegistration({
      registration,
      instrument: {
        registration: loaded.instrument,
        sha256: loaded.instrumentSha256,
      },
      corpus: loaded.corpus,
      corpusSha256: loaded.corpusSha256,
      developmentCorpus: json(loaded.instrument.instrument.developmentCorpusPath),
    });
    assert.equal(validation.valid, false);
  }
  const contract = json(CONTRACT);
  const preflight = runTutorStubResistanceRecoverySemanticValidationPreflight({ contract });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(
    preflight.outcome_semantic_validation_readiness_audit.live_accuracy_agreement_validity_and_coverage_gates,
    'pending_live_validation',
  );
  const certificate = validatePaidStudyEndpointGoCertificate({
    certificate: json(CERTIFICATE),
    contract,
    preflight,
  });
  assert.equal(certificate.ok, true, certificate.errors.join('; '));
});

test('outcome validation runtime seals exactly 120 opaque cases and analyzer joins gold only after seal', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-semantic-validation-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const sourceCommit = '1'.repeat(40);
  const sourceTree = '2'.repeat(40);
  const goRequestSha256 = '3'.repeat(64);
  const calls = [];
  try {
    const plan = buildTutorStubResistanceRecoverySemanticValidationPlan({
      sourceCommit,
      sourceTree,
      destination,
      goRequestPath: 'config/future-outcome-validation-request.json',
      goRequestSha256,
      loaded,
    });
    assert.equal(plan.cases.length, 120);
    assert.equal(JSON.stringify(plan).includes('ho-merits'), false);
    await runTutorStubResistanceRecoverySemanticValidation({
      destination,
      sourceCommit,
      sourceTree,
      goRequestPath: 'config/future-outcome-validation-request.json',
      goRequestSha256,
      sourceDirty: false,
      archiveDir,
      resolveModelRef: routeResolver(loaded),
      callModel: fixtureModelCall(loaded, calls),
    });
    assert.equal(calls.length, 240);
    const report = analyzeTutorStubResistanceRecoverySemanticValidation({
      destination,
      expectedSourceCommit: sourceCommit,
      expectedSourceTree: sourceTree,
      expectedGoRequestPath: 'config/future-outcome-validation-request.json',
      expectedGoRequestSha256: goRequestSha256,
      sourceDirty: false,
      archiveDir,
    });
    assert.equal(report.status, 'passed');
    assert.equal(report.score.metrics.raw_full_vector_interjudge_agreement, 1);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('outcome validation rejects an unavailable durable archive before creating the destination', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-semantic-missing-archive-'));
  const destination = path.join(temporary, 'run');
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  try {
    await assert.rejects(
      runTutorStubResistanceRecoverySemanticValidation({
        destination,
        sourceCommit: '1'.repeat(40),
        sourceTree: '2'.repeat(40),
        goRequestPath: 'config/future-outcome-validation-request.json',
        goRequestSha256: '3'.repeat(64),
        sourceDirty: false,
        archiveDir: path.join(temporary, 'absent-private-archive'),
        resolveModelRef: routeResolver(loaded),
        callModel: fixtureModelCall(loaded, []),
      }),
      /requires a durable private archive/u,
    );
    assert.equal(fs.existsSync(destination), false);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('outcome validation resume preserves Judge A and calls only the never-prepared Judge B', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-semantic-resume-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const calls = [];
  const options = {
    destination,
    sourceCommit: '4'.repeat(40),
    sourceTree: '5'.repeat(40),
    goRequestPath: 'config/future-outcome-validation-request.json',
    goRequestSha256: '6'.repeat(64),
    sourceDirty: false,
    archiveDir,
    resolveModelRef: routeResolver(loaded),
    callModel: fixtureModelCall(loaded, calls),
  };
  let interrupted = false;
  try {
    await assert.rejects(
      runTutorStubResistanceRecoverySemanticValidation({
        ...options,
        afterJudgeCheckpoint: ({ judgeId }) => {
          if (!interrupted && judgeId === loaded.instrument.measurement.judges[0].id) {
            interrupted = true;
            throw new Error('synthetic coordinator interruption after Judge A');
          }
        },
      }),
      /synthetic coordinator interruption/u,
    );
    const firstCase = calls[0].caseId;
    assert.equal(calls.filter((row) => row.caseId === firstCase).length, 1);
    await runTutorStubResistanceRecoverySemanticValidation({ ...options, resume: true });
    assert.equal(
      calls.filter((row) => row.caseId === firstCase && row.judgeId === loaded.instrument.measurement.judges[0].id)
        .length,
      1,
    );
    assert.equal(
      calls.filter((row) => row.caseId === firstCase && row.judgeId === loaded.instrument.measurement.judges[1].id)
        .length,
      1,
    );
    assert.equal(calls.length, 240);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('outcome resume authenticates the complete durable archive before any additional judge call', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-semantic-resume-archive-auth-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const calls = [];
  const options = {
    destination,
    sourceCommit: '4'.repeat(40),
    sourceTree: '5'.repeat(40),
    goRequestPath: 'config/future-outcome-validation-request.json',
    goRequestSha256: '6'.repeat(64),
    sourceDirty: false,
    archiveDir,
    resolveModelRef: routeResolver(loaded),
    callModel: fixtureModelCall(loaded, calls),
  };
  try {
    await assert.rejects(
      runTutorStubResistanceRecoverySemanticValidation({
        ...options,
        afterJudgeCheckpoint: () => {
          throw new Error('synthetic interruption after first durable outcome response');
        },
      }),
      /synthetic interruption/u,
    );
    assert.equal(calls.length, 1);
    const manifestFile = findArchiveManifest(archiveDir);
    const original = fs.readFileSync(manifestFile, 'utf8');
    const driftedBinding = JSON.parse(original);
    driftedBinding.source.commit = 'f'.repeat(40);
    fs.writeFileSync(manifestFile, `${JSON.stringify(driftedBinding, null, 2)}\n`);
    await assert.rejects(
      runTutorStubResistanceRecoverySemanticValidation({ ...options, resume: true }),
      /archive manifest binding/u,
    );
    assert.equal(calls.length, 1);

    const missingPrior = JSON.parse(original);
    const priorIndex = missingPrior.entries.findIndex((entry) => entry.stage === 'checkpoint_initialized');
    assert.ok(priorIndex >= 0);
    missingPrior.entries.splice(priorIndex, 1);
    missingPrior.entries.forEach((entry, index) => {
      entry.sequence = index + 1;
    });
    fs.writeFileSync(manifestFile, `${JSON.stringify(missingPrior, null, 2)}\n`);
    await assert.rejects(
      runTutorStubResistanceRecoverySemanticValidation({ ...options, resume: true }),
      /noncurrent orphan transition|entry inventory drifted/u,
    );
    assert.equal(calls.length, 1);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('outcome validation dispatches an already prepared third attempt without a fourth reservation', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-semantic-third-prepared-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const successfulCalls = [];
  const fixture = fixtureModelCall(loaded, successfulCalls);
  let dispatches = 0;
  let prepared = 0;
  const flaky = async (...args) => {
    dispatches += 1;
    if (dispatches <= 2) {
      const error = new Error('synthetic transient transport failure');
      error.code = 'CLI_PROVIDER_TURN_FAILED';
      error.provider = 'codex';
      throw error;
    }
    return fixture(...args);
  };
  const options = {
    destination,
    sourceCommit: 'd'.repeat(40),
    sourceTree: 'e'.repeat(40),
    goRequestPath: 'config/future-outcome-validation-request.json',
    goRequestSha256: 'f'.repeat(64),
    sourceDirty: false,
    archiveDir,
    resolveModelRef: routeResolver(loaded),
    callModel: flaky,
    waitForRetry: async () => {},
  };
  try {
    await assert.rejects(
      runTutorStubResistanceRecoverySemanticValidation({
        ...options,
        afterPreparedCheckpoint: () => {
          prepared += 1;
          if (prepared === 3) throw new Error('synthetic crash after third outcome preparation');
        },
      }),
      /synthetic crash after third outcome preparation/u,
    );
    assert.equal(dispatches, 2);
    const { seal } = await runTutorStubResistanceRecoverySemanticValidation({ ...options, resume: true });
    assert.equal(dispatches, 242);
    assert.equal(seal.reservations, 242);
    assert.equal(seal.judge_results, 240);
    const report = analyzeTutorStubResistanceRecoverySemanticValidation({
      destination,
      expectedSourceCommit: options.sourceCommit,
      expectedSourceTree: options.sourceTree,
      expectedGoRequestPath: options.goRequestPath,
      expectedGoRequestSha256: options.goRequestSha256,
      sourceDirty: false,
      archiveDir,
    });
    assert.equal(report.status, 'passed');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('outcome validation never recalls a dispatched Judge B with an ambiguous response', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-semantic-ambiguous-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const calls = [];
  const options = {
    destination,
    sourceCommit: '7'.repeat(40),
    sourceTree: '8'.repeat(40),
    goRequestPath: 'config/future-outcome-validation-request.json',
    goRequestSha256: '9'.repeat(64),
    sourceDirty: false,
    archiveDir,
    resolveModelRef: routeResolver(loaded),
    callModel: fixtureModelCall(loaded, calls),
  };
  let interruptedCase = null;
  try {
    await assert.rejects(
      runTutorStubResistanceRecoverySemanticValidation({
        ...options,
        afterDispatchCheckpoint: ({ caseId, judgeId }) => {
          if (!interruptedCase && judgeId === loaded.instrument.measurement.judges[1].id) {
            interruptedCase = caseId;
            throw new Error('synthetic crash after Judge B dispatch');
          }
        },
      }),
      /synthetic crash after Judge B dispatch/u,
    );
    await runTutorStubResistanceRecoverySemanticValidation({ ...options, resume: true });
    assert.equal(
      calls.filter(
        (row) => row.caseId === interruptedCase && row.judgeId === loaded.instrument.measurement.judges[0].id,
      ).length,
      1,
    );
    assert.equal(
      calls.filter(
        (row) => row.caseId === interruptedCase && row.judgeId === loaded.instrument.measurement.judges[1].id,
      ).length,
      0,
    );
    assert.equal(calls.length, 239);
    const report = analyzeTutorStubResistanceRecoverySemanticValidation({
      destination,
      expectedSourceCommit: options.sourceCommit,
      expectedSourceTree: options.sourceTree,
      expectedGoRequestPath: options.goRequestPath,
      expectedGoRequestSha256: options.goRequestSha256,
      sourceDirty: false,
      archiveDir,
    });
    assert.equal(report.status, 'failed');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('outcome validation reconciles local seal and report writes without model recall or alternate content', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-semantic-terminal-reconcile-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const calls = [];
  const options = {
    destination,
    sourceCommit: 'a'.repeat(40),
    sourceTree: 'b'.repeat(40),
    goRequestPath: 'config/future-outcome-validation-request.json',
    goRequestSha256: 'c'.repeat(64),
    sourceDirty: false,
    archiveDir,
    resolveModelRef: routeResolver(loaded),
    callModel: fixtureModelCall(loaded, calls),
  };
  try {
    await assert.rejects(
      runTutorStubResistanceRecoverySemanticValidation({
        ...options,
        afterSealLocalWrite: () => {
          throw new Error('synthetic crash after local seal');
        },
      }),
      /synthetic crash after local seal/u,
    );
    assert.equal(calls.length, 240);
    await runTutorStubResistanceRecoverySemanticValidation({ ...options, resume: true });
    assert.equal(calls.length, 240);
    const reportOptions = {
      destination,
      expectedSourceCommit: options.sourceCommit,
      expectedSourceTree: options.sourceTree,
      expectedGoRequestPath: options.goRequestPath,
      expectedGoRequestSha256: options.goRequestSha256,
      sourceDirty: false,
      archiveDir,
    };
    await assert.rejects(
      async () =>
        writeTutorStubResistanceRecoverySemanticValidationReport({
          ...reportOptions,
          afterReportLocalWrite: () => {
            throw new Error('synthetic crash after local report');
          },
        }),
      /synthetic crash after local report/u,
    );
    const report = writeTutorStubResistanceRecoverySemanticValidationReport(reportOptions);
    assert.equal(report.status, 'passed');
    assert.equal(calls.length, 240);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('outcome archive rejects manifest topology drift and local/archive final-artifact splits', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-semantic-archive-integrity-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'archive');
  fs.mkdirSync(archiveDir);
  const loaded = loadTutorStubResistanceRecoverySemanticValidation();
  const options = {
    destination,
    sourceCommit: '1'.repeat(40),
    sourceTree: '2'.repeat(40),
    goRequestPath: 'config/future-outcome-validation-request.json',
    goRequestSha256: '3'.repeat(64),
    sourceDirty: false,
    archiveDir,
    resolveModelRef: routeResolver(loaded),
    callModel: fixtureModelCall(loaded, []),
  };
  try {
    await runTutorStubResistanceRecoverySemanticValidation(options);
    const analyzeOptions = {
      destination,
      expectedSourceCommit: options.sourceCommit,
      expectedSourceTree: options.sourceTree,
      expectedGoRequestPath: options.goRequestPath,
      expectedGoRequestSha256: options.goRequestSha256,
      sourceDirty: false,
      archiveDir,
    };
    const manifestFile = findArchiveManifest(archiveDir);
    const original = fs.readFileSync(manifestFile, 'utf8');
    const manifest = JSON.parse(original);
    manifest.entries[0].logical_path = 'changed-plan.json';
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    assert.throws(
      () => analyzeTutorStubResistanceRecoverySemanticValidation(analyzeOptions),
      /archive entry.*topology|archive.*binding/u,
    );

    fs.writeFileSync(manifestFile, original);
    const withoutFinal = JSON.parse(original);
    const finalIndex = withoutFinal.entries.findIndex((entry) => entry.stage === 'checkpoint_sealed');
    assert.ok(finalIndex >= 0);
    withoutFinal.entries.splice(finalIndex, 1);
    withoutFinal.entries.forEach((entry, index) => {
      entry.sequence = index + 1;
    });
    fs.writeFileSync(manifestFile, `${JSON.stringify(withoutFinal, null, 2)}\n`);
    assert.throws(
      () => analyzeTutorStubResistanceRecoverySemanticValidation(analyzeOptions),
      /local final artifact|transition inventory/u,
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
