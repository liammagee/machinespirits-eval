import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import { buildTutorStubResistanceSemanticZeroCallFixtureResponse } from '../services/tutorStubResistanceSemanticAdjudication.js';
import { buildTutorStubResistanceSemanticZeroCallFixtureResponseV2 } from '../services/tutorStubResistanceSemanticAdjudicationV2.js';
import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3,
  buildTutorStubResistanceSemanticZeroCallFixtureResponseV3,
} from '../services/tutorStubResistanceSemanticAdjudicationV3.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import {
  loadTutorStubResistanceSemanticValidation,
  tutorStubResistanceSemanticOpaqueCaseId,
} from '../services/tutorStubResistanceSemanticValidation.js';
import {
  loadTutorStubResistanceSemanticValidationV2,
  tutorStubResistanceSemanticOpaqueCaseIdV2,
} from '../services/tutorStubResistanceSemanticValidationV2.js';
import {
  loadTutorStubResistanceSemanticValidationV3,
  tutorStubResistanceSemanticOpaqueCaseIdV3,
} from '../services/tutorStubResistanceSemanticValidationV3.js';
import {
  analyzeTutorStubResistanceSemanticValidation,
  auditTutorStubResistanceSemanticValidationAttempts,
  buildTutorStubResistanceSemanticValidationPlan,
  runTutorStubResistanceSemanticValidation,
  writeTutorStubResistanceSemanticValidationReport,
} from '../services/tutorStubResistanceSemanticValidationRuntime.js';

const SOURCE_COMMIT = '1'.repeat(40);
const SOURCE_TREE = '2'.repeat(40);
const GO_REQUEST_PATH = 'config/future-semantic-validation-go-request.json';
const GO_REQUEST_SHA256 = 'a'.repeat(64);

function goRequestFor(loaded, { revision = null, programmeLedgerBefore = null } = {}) {
  const readiness = loaded.registration.executionReadiness;
  const before = programmeLedgerBefore ?? readiness.programmeLedgerBefore;
  return {
    semanticAdjudicationValidation: {
      type: `prospective_resistance_semantic_adjudication_heldout_validation_v${loaded.registration.version}`,
      ...(revision === null ? {} : { requestRevision: revision }),
    },
    budget: {
      plannedCases: readiness.plannedCases,
      plannedModelCalls: readiness.plannedModelCalls,
      maximumReservationsPerPlannedCall: readiness.maximumReservationsPerPlannedCall,
      maximumPlannedModelAttempts: readiness.hardValidationReservations,
      programmeLedgerBefore: before,
      programmeLedgerAfterMaximum: before + readiness.hardValidationReservations,
      programmeCeiling: readiness.programmeCeiling,
      retryOrResumeAuthority: 'bounded_technical_recovery',
    },
  };
}

function fixtureCallerV3(calls, loaded) {
  return async (agentConfig, systemPrompt, userPrompt, role, options) => {
    const prompt = JSON.parse(userPrompt);
    const corpusCase = loaded.corpus.cases.find(
      (row) => tutorStubResistanceSemanticOpaqueCaseIdV3(row) === prompt.case_id,
    );
    const judge = loaded.instrument.registration.measurement.judges.find(
      (row) => role === `tutor_stub_resistance_semantic_${row.id}`,
    );
    assert.ok(corpusCase);
    assert.ok(judge);
    const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({
      corpusCase: { ...corpusCase, case_id: prompt.case_id },
      judge,
    });
    calls.push({ agentConfig, systemPrompt, userPrompt, role, options });
    return {
      text: JSON.stringify(fixture.modelOutput),
      provider: judge.provider,
      model: judge.model,
      effort: judge.effort,
      structuredOutput: true,
      prohibitedToolEventCount: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
    };
  };
}

function fixtureCaller(calls) {
  const loaded = loadTutorStubResistanceSemanticValidation();
  return async (agentConfig, systemPrompt, userPrompt, role, options) => {
    const prompt = JSON.parse(userPrompt);
    const corpusCase = loaded.corpus.cases.find(
      (row) => tutorStubResistanceSemanticOpaqueCaseId(row) === prompt.case_id,
    );
    const judge = loaded.instrument.registration.measurement.judges.find(
      (row) => role === `tutor_stub_resistance_semantic_${row.id}`,
    );
    assert.ok(corpusCase);
    assert.ok(judge);
    assert.equal(agentConfig.provider, judge.provider);
    assert.equal(agentConfig.model, judge.model);
    assert.equal(options.effort, 'low');
    assert.ok(!userPrompt.includes(corpusCase.case_id));
    const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponse({
      corpusCase: { ...corpusCase, case_id: prompt.case_id },
      judge,
    });
    calls.push({ caseId: prompt.case_id, judgeId: judge.id });
    return {
      text: JSON.stringify(fixture.modelOutput),
      provider: judge.provider,
      model: judge.model,
      effort: judge.effort,
      structuredOutput: true,
      prohibitedToolEventCount: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
    };
  };
}

function analyze(destination) {
  const archiveDir = path.join(path.dirname(destination), 'private-archive');
  const loaded = loadTutorStubResistanceSemanticValidation();
  return analyzeTutorStubResistanceSemanticValidation({
    destination,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: goRequestFor(loaded),
    sourceDirty: false,
    archiveDir,
  });
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

function run(destination, options = {}) {
  const loaded = options.loaded || loadTutorStubResistanceSemanticValidation();
  const archiveDir = path.join(path.dirname(destination), 'private-archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  return runTutorStubResistanceSemanticValidation({
    destination,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: goRequestFor(loaded),
    sourceDirty: false,
    archiveDir,
    waitForRetry: async () => {},
    resolveModelRef: (modelRef) => {
      const judge = loaded.instrument.registration.measurement.judges.find((row) => row.modelRef === modelRef);
      return { provider: judge.provider, model: judge.model };
    },
    ...options,
  });
}

function fixtureCallerV2(calls, loaded) {
  return async (agentConfig, systemPrompt, userPrompt, role, options) => {
    const prompt = JSON.parse(userPrompt);
    const corpusCase = loaded.corpus.cases.find(
      (row) => tutorStubResistanceSemanticOpaqueCaseIdV2(row) === prompt.case_id,
    );
    const judge = loaded.instrument.registration.measurement.judges.find(
      (row) => role === `tutor_stub_resistance_semantic_${row.id}`,
    );
    assert.ok(corpusCase);
    assert.ok(judge);
    assert.equal(agentConfig.provider, judge.provider);
    assert.equal(agentConfig.model, judge.model);
    assert.equal(options.effort, 'low');
    assert.equal(userPrompt.includes(corpusCase.case_id), false);
    const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponseV2({
      corpusCase: { ...corpusCase, case_id: prompt.case_id },
      judge,
    });
    calls.push({ caseId: prompt.case_id, judgeId: judge.id });
    return {
      text: JSON.stringify(fixture.modelOutput),
      provider: judge.provider,
      model: judge.model,
      effort: judge.effort,
      structuredOutput: true,
      prohibitedToolEventCount: 0,
      modelAttestationBasis: judge.modelAttestationBasis,
      modelIndependentlyAttested: false,
    };
  };
}

function providerChild({ stdoutText, onEnd }) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {};
  child.stdin = {
    write() {},
    end() {
      onEnd?.();
      queueMicrotask(() => {
        child.stdout.end(stdoutText);
        child.stderr.end();
        child.emit('close', 0);
      });
    },
  };
  return child;
}

function bridgeFixtureCallerV3(calls, providerSchemas, loaded) {
  return async (agentConfig, systemPrompt, userPrompt, role, options) => {
    const prompt = JSON.parse(userPrompt);
    const corpusCase = loaded.corpus.cases.find(
      (row) => tutorStubResistanceSemanticOpaqueCaseIdV3(row) === prompt.case_id,
    );
    const judge = loaded.instrument.registration.measurement.judges.find(
      (row) => role === `tutor_stub_resistance_semantic_${row.id}`,
    );
    assert.ok(corpusCase);
    assert.ok(judge);
    const fixture = buildTutorStubResistanceSemanticZeroCallFixtureResponseV3({
      corpusCase: { ...corpusCase, case_id: prompt.case_id },
      judge,
    });
    calls.push({ caseId: prompt.case_id, judgeId: judge.id, provider: agentConfig.provider });
    return callAIWithCliBridge(agentConfig, systemPrompt, userPrompt, role, {
      ...options,
      timeoutMs: 1000,
      spawnImpl: (_command, args) => {
        if (agentConfig.provider === 'codex') {
          const schemaPath = args[args.indexOf('--output-schema') + 1];
          const outputPath = args[args.indexOf('-o') + 1];
          providerSchemas.push({ provider: 'codex', schema: JSON.parse(fs.readFileSync(schemaPath, 'utf8')) });
          return providerChild({
            stdoutText: '{"type":"turn.completed"}\n',
            onEnd: () => fs.writeFileSync(outputPath, `${JSON.stringify(fixture.modelOutput)}\n`),
          });
        }
        const schema = JSON.parse(args[args.indexOf('--json-schema') + 1]);
        providerSchemas.push({ provider: 'claude-code', schema });
        return providerChild({
          stdoutText: JSON.stringify([
            {
              type: 'result',
              subtype: 'success',
              is_error: false,
              structured_output: fixture.modelOutput,
            },
          ]),
        });
      },
    });
  };
}

test('V3 runtime composes frozen local validation with Codex-only provider schema normalization', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v3-provider-schema-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'private-archive');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  fs.mkdirSync(archiveDir, { recursive: true });
  const loaded = loadTutorStubResistanceSemanticValidationV3();
  const calls = [];
  const providerSchemas = [];
  const { seal } = await runTutorStubResistanceSemanticValidation({
    destination,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: goRequestFor(loaded),
    sourceDirty: false,
    archiveDir,
    loaded,
    waitForRetry: async () => {},
    resolveModelRef: (modelRef) => {
      const judge = loaded.instrument.registration.measurement.judges.find((row) => row.modelRef === modelRef);
      return { provider: judge.provider, model: judge.model };
    },
    callModel: bridgeFixtureCallerV3(calls, providerSchemas, loaded),
  });
  assert.equal(calls.length, 160);
  assert.equal(seal.reservations, 160);
  const codexSchemas = providerSchemas.filter((row) => row.provider === 'codex').map((row) => row.schema);
  const claudeSchemas = providerSchemas.filter((row) => row.provider === 'claude-code').map((row) => row.schema);
  assert.equal(codexSchemas.length, 80);
  assert.equal(claudeSchemas.length, 80);
  assert.ok(codexSchemas.every((schema) => !JSON.stringify(schema).includes('"oneOf"')));
  assert.ok(codexSchemas.every((schema) => JSON.stringify(schema).includes('"anyOf"')));
  for (const schema of claudeSchemas) assert.deepEqual(schema, TUTOR_STUB_RESISTANCE_SEMANTIC_OUTPUT_SCHEMA_V3);
  const checkpoint = JSON.parse(
    fs.readFileSync(
      path.join(destination, 'cases', Object.keys(seal.case_checkpoint_sha256)[0], 'checkpoint.json'),
      'utf8',
    ),
  );
  assert.ok(
    checkpoint.judge_results.every(
      (row) => row.record.schema === 'machinespirits.tutor-stub.resistance-semantic-adjudication-record.v3',
    ),
  );
  const report = writeTutorStubResistanceSemanticValidationReport({
    destination,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: goRequestFor(loaded),
    sourceDirty: false,
    archiveDir,
    loaded,
  });
  assert.equal(report.status, 'passed');
});

test('successor V3 retries exact pre-response Claude exit-code-one failures with safe telemetry and request-derived ledger', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v3-claude-retry-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const loaded = loadTutorStubResistanceSemanticValidationV3();
  const goRequest = goRequestFor(loaded, { revision: 2, programmeLedgerBefore: 661 });
  const successfulCalls = [];
  const fixture = fixtureCallerV3(successfulCalls, loaded);
  const observedCalls = [];
  const retryDelays = [];
  let claudeFailures = 0;
  const callModel = async (...args) => {
    observedCalls.push(args);
    if (args[0].provider === 'claude-code' && claudeFailures < 2) {
      claudeFailures += 1;
      const error = new Error('claude CLI exited with code 1');
      error.code = 'CLI_PROVIDER_EXIT_FAILED';
      error.exitCode = 1;
      error.stdoutBytes = 0;
      error.stderrBytes = 77 + claudeFailures;
      throw error;
    }
    return fixture(...args);
  };
  const { plan, seal } = await run(destination, {
    loaded,
    goRequest,
    callModel,
    waitForRetry: async (delayMs) => retryDelays.push(delayMs),
  });
  assert.equal(plan.budget.programme_ledger_before, 661);
  assert.equal(plan.budget.programme_ledger_after_maximum, 1141);
  assert.equal(seal.reservations, 162);
  assert.deepEqual(retryDelays, [5000, 15000]);
  const repeated = observedCalls.filter((args) => args[0].provider === 'claude-code').slice(0, 3);
  assert.equal(repeated.length, 3);
  for (const args of repeated.slice(1)) {
    assert.deepEqual(args[0], repeated[0][0]);
    assert.equal(args[1], repeated[0][1]);
    assert.equal(args[2], repeated[0][2]);
    assert.equal(args[3], repeated[0][3]);
    assert.deepEqual(args[4], repeated[0][4]);
  }
  const checkpoint = JSON.parse(
    fs.readFileSync(
      path.join(destination, 'cases', Object.keys(seal.case_checkpoint_sha256)[0], 'checkpoint.json'),
      'utf8',
    ),
  );
  const claudeResult = checkpoint.judge_results.find((row) => row.role.endsWith('judge_b'));
  assert.deepEqual(claudeResult.attempts, [
    {
      attempt: 1,
      status: 'transport_failed',
      error_code: 'CLI_PROVIDER_EXIT_FAILED',
      exit_code: 1,
      stdout_bytes: 0,
      stderr_bytes: 78,
    },
    {
      attempt: 2,
      status: 'transport_failed',
      error_code: 'CLI_PROVIDER_EXIT_FAILED',
      exit_code: 1,
      stdout_bytes: 0,
      stderr_bytes: 79,
    },
    { attempt: 3, status: 'returned' },
  ]);
  assert.equal(JSON.stringify(checkpoint).includes('stderr content'), false);
  assert.equal(
    writeTutorStubResistanceSemanticValidationReport({
      destination,
      expectedSourceCommit: SOURCE_COMMIT,
      expectedSourceTree: SOURCE_TREE,
      expectedGoRequestPath: GO_REQUEST_PATH,
      expectedGoRequestSha256: GO_REQUEST_SHA256,
      expectedGoRequest: goRequest,
      sourceDirty: false,
      archiveDir: path.join(temporary, 'private-archive'),
      loaded,
    }).status,
    'passed',
  );

  const stale = goRequestFor(loaded, { revision: 2, programmeLedgerBefore: 651 });
  assert.throws(
    () =>
      buildTutorStubResistanceSemanticValidationPlan({
        sourceCommit: SOURCE_COMMIT,
        sourceTree: SOURCE_TREE,
        destination: path.join(temporary, 'stale'),
        goRequestPath: GO_REQUEST_PATH,
        goRequestSha256: GO_REQUEST_SHA256,
        goRequest: stale,
        loaded,
      }),
    /GO request budget does not match/u,
  );
  const future = goRequestFor(loaded, { revision: 3, programmeLedgerBefore: 696 });
  const futurePlan = buildTutorStubResistanceSemanticValidationPlan({
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    destination: path.join(temporary, 'future'),
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: future,
    loaded,
  });
  assert.equal(futurePlan.budget.programme_ledger_before, 696);
  assert.equal(futurePlan.budget.programme_ledger_after_maximum, 1176);
});

test('revision-4 V3 retries exact Claude response-free envelopes with digest-only telemetry', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v3-response-free-retry-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const loaded = loadTutorStubResistanceSemanticValidationV3();
  const successfulCalls = [];
  const fixture = fixtureCallerV3(successfulCalls, loaded);
  const retryDelays = [];
  let failures = 0;
  const callModel = async (...args) => {
    if (args[0].provider === 'claude-code' && failures < 2) {
      failures += 1;
      const error = new Error('redacted response-free error');
      error.code = 'CLI_PROVIDER_RESPONSE_FREE_ERROR';
      error.provider = 'claude-code';
      error.classification = 'response_free_error';
      error.responseFree = true;
      error.exitCode = 1;
      error.stdoutBytes = 165;
      error.stderrBytes = 0;
      error.stdoutSha256 = 'a'.repeat(64);
      error.stderrSha256 = 'b'.repeat(64);
      throw error;
    }
    return fixture(...args);
  };
  const goRequest = goRequestFor(loaded, { revision: 4, programmeLedgerBefore: 728 });
  const { plan, seal } = await run(destination, {
    loaded,
    goRequest,
    callModel,
    waitForRetry: async (delayMs) => retryDelays.push(delayMs),
  });
  assert.equal(plan.budget.programme_ledger_before, 728);
  assert.equal(plan.budget.programme_ledger_after_maximum, 1208);
  assert.equal(seal.reservations, 162);
  assert.deepEqual(retryDelays, [5000, 15000]);
  const checkpoint = JSON.parse(
    fs.readFileSync(
      path.join(destination, 'cases', Object.keys(seal.case_checkpoint_sha256)[0], 'checkpoint.json'),
      'utf8',
    ),
  );
  const claudeResult = checkpoint.judge_results.find((row) => row.role.endsWith('judge_b'));
  const responseFreeAttempt = {
    status: 'transport_failed',
    error_code: 'CLI_PROVIDER_RESPONSE_FREE_ERROR',
    classification: 'response_free_error',
    response_free: true,
    exit_code: 1,
    stdout_bytes: 165,
    stderr_bytes: 0,
    stdout_sha256: 'a'.repeat(64),
    stderr_sha256: 'b'.repeat(64),
  };
  assert.deepEqual(claudeResult.attempts, [
    { attempt: 1, ...responseFreeAttempt },
    { attempt: 2, ...responseFreeAttempt },
    { attempt: 3, status: 'returned' },
  ]);
  assert.equal(JSON.stringify(checkpoint).includes('redacted response-free error'), false);
  assert.equal(
    writeTutorStubResistanceSemanticValidationReport({
      destination,
      expectedSourceCommit: SOURCE_COMMIT,
      expectedSourceTree: SOURCE_TREE,
      expectedGoRequestPath: GO_REQUEST_PATH,
      expectedGoRequestSha256: GO_REQUEST_SHA256,
      expectedGoRequest: goRequest,
      sourceDirty: false,
      archiveDir: path.join(temporary, 'private-archive'),
      loaded,
    }).status,
    'passed',
  );
});

test('V2 keeps Claude exit-code-one terminal without the successor-V3 retry opt-in', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v2-no-claude-retry-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const loaded = loadTutorStubResistanceSemanticValidationV2();
  const successfulCalls = [];
  const fixture = fixtureCallerV2(successfulCalls, loaded);
  let failed = false;
  const callModel = async (...args) => {
    if (!failed && args[0].provider === 'claude-code') {
      failed = true;
      const error = new Error('claude CLI exited with code 1');
      error.code = 'CLI_PROVIDER_EXIT_FAILED';
      error.exitCode = 1;
      error.stdoutBytes = 0;
      error.stderrBytes = 42;
      throw error;
    }
    return fixture(...args);
  };
  const { seal } = await run(destination, { loaded, callModel });
  assert.equal(seal.reservations, 160);
  const firstCheckpoint = JSON.parse(
    fs.readFileSync(
      path.join(destination, 'cases', Object.keys(seal.case_checkpoint_sha256)[0], 'checkpoint.json'),
      'utf8',
    ),
  );
  const claudeResult = firstCheckpoint.judge_results.find((row) => row.role.endsWith('judge_b'));
  assert.deepEqual(claudeResult.attempts, [
    { attempt: 1, status: 'transport_failed', error_code: 'CLI_PROVIDER_EXIT_FAILED' },
  ]);
});

test('successor V3 does not retry or admit no-response telemetry for exit two or nonzero stdout', async (t) => {
  for (const failure of [
    { exitCode: 2, stdoutBytes: 0, stderrBytes: 31 },
    { exitCode: 1, stdoutBytes: 1, stderrBytes: 32 },
  ]) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v3-nonretryable-'));
    const destination = path.join(temporary, 'run');
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
    const loaded = loadTutorStubResistanceSemanticValidationV3();
    const successfulCalls = [];
    const fixture = fixtureCallerV3(successfulCalls, loaded);
    let failed = false;
    const callModel = async (...args) => {
      if (!failed && args[0].provider === 'claude-code') {
        failed = true;
        const error = new Error(`claude CLI exited with code ${failure.exitCode}`);
        error.code = 'CLI_PROVIDER_EXIT_FAILED';
        Object.assign(error, failure);
        throw error;
      }
      return fixture(...args);
    };
    const goRequest = goRequestFor(loaded, { revision: 2, programmeLedgerBefore: 661 });
    const { seal } = await run(destination, { loaded, goRequest, callModel });
    assert.equal(seal.reservations, 160);
    const checkpoint = JSON.parse(
      fs.readFileSync(
        path.join(destination, 'cases', Object.keys(seal.case_checkpoint_sha256)[0], 'checkpoint.json'),
        'utf8',
      ),
    );
    const claudeResult = checkpoint.judge_results.find((row) => row.role.endsWith('judge_b'));
    assert.deepEqual(claudeResult.attempts, [
      { attempt: 1, status: 'transport_failed', error_code: 'CLI_PROVIDER_EXIT_FAILED' },
    ]);
    assert.notEqual(claudeResult.invalid_reason, 'claude CLI exited before an accepted semantic response');
    assert.equal(
      writeTutorStubResistanceSemanticValidationReport({
        destination,
        expectedSourceCommit: SOURCE_COMMIT,
        expectedSourceTree: SOURCE_TREE,
        expectedGoRequestPath: GO_REQUEST_PATH,
        expectedGoRequestSha256: GO_REQUEST_SHA256,
        expectedGoRequest: goRequest,
        sourceDirty: false,
        archiveDir: path.join(temporary, 'private-archive'),
        loaded,
      }).status,
      'failed',
    );
  }

  const safeAttempt = {
    attempt: 1,
    status: 'transport_failed',
    error_code: 'CLI_PROVIDER_EXIT_FAILED',
    exit_code: 1,
    stdout_bytes: 0,
    stderr_bytes: 4,
  };
  assert.deepEqual(
    auditTutorStubResistanceSemanticValidationAttempts({
      attempts: [safeAttempt],
      safeClaudeExitTelemetryAllowed: true,
    }),
    [],
  );
  for (const mutation of [
    { ...safeAttempt, exit_code: 2 },
    { ...safeAttempt, stdout_bytes: 1 },
  ]) {
    assert.deepEqual(
      auditTutorStubResistanceSemanticValidationAttempts({
        attempts: [mutation],
        safeClaudeExitTelemetryAllowed: true,
      }),
      ['judge attempt status sequence is invalid'],
    );
  }
});

test('additive v2 validation uses quote-only responses under the same checkpointed no-recall runtime', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-v2-'));
  const destination = path.join(temporary, 'run');
  const archiveDir = path.join(temporary, 'private-archive');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  fs.mkdirSync(archiveDir, { recursive: true });
  const loaded = loadTutorStubResistanceSemanticValidationV2();
  const calls = [];
  const { seal } = await runTutorStubResistanceSemanticValidation({
    destination,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
    goRequest: goRequestFor(loaded),
    sourceDirty: false,
    archiveDir,
    loaded,
    waitForRetry: async () => {},
    resolveModelRef: (modelRef) => {
      const judge = loaded.instrument.registration.measurement.judges.find((row) => row.modelRef === modelRef);
      return { provider: judge.provider, model: judge.model };
    },
    callModel: fixtureCallerV2(calls, loaded),
  });
  assert.equal(calls.length, 160);
  assert.equal(seal.reservations, 160);
  const checkpoint = JSON.parse(
    fs.readFileSync(
      path.join(destination, 'cases', Object.keys(seal.case_checkpoint_sha256)[0], 'checkpoint.json'),
      'utf8',
    ),
  );
  assert.ok(
    checkpoint.judge_results.every(
      (row) => row.record.schema === 'machinespirits.tutor-stub.resistance-semantic-adjudication-record.v2',
    ),
  );
  const report = writeTutorStubResistanceSemanticValidationReport({
    destination,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: goRequestFor(loaded),
    sourceDirty: false,
    archiveDir,
    loaded,
  });
  assert.equal(report.status, 'passed');
  assert.ok(report.cases.every((row) => row.execution_case_id.startsWith('sv2-')));
});

test('checkpointed validation executes 80 opaque cases, seals 160 responses, and joins gold only in analysis', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const calls = [];
  const { seal } = await run(destination, { callModel: fixtureCaller(calls) });
  assert.equal(calls.length, 160);
  assert.equal(seal.cases, 80);
  assert.equal(seal.judge_results, 160);
  assert.equal(seal.reservations, 160);
  const executionBytes = [
    fs.readFileSync(path.join(destination, 'plan.json'), 'utf8'),
    ...fs
      .readdirSync(path.join(destination, 'cases'))
      .map((caseId) => fs.readFileSync(path.join(destination, 'cases', caseId, 'checkpoint.json'), 'utf8')),
  ].join('\n');
  const loaded = loadTutorStubResistanceSemanticValidation();
  assert.ok(!executionBytes.includes('"expected"'));
  for (const corpusCase of loaded.corpus.cases) assert.ok(!executionBytes.includes(corpusCase.case_id));
  const report = writeTutorStubResistanceSemanticValidationReport({
    destination,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: goRequestFor(loaded),
    sourceDirty: false,
    archiveDir: path.join(path.dirname(destination), 'private-archive'),
  });
  assert.equal(report.status, 'passed');
  assert.equal(report.cases.length, 80);
  assert.ok(report.cases.every((row) => row.case_id && row.execution_case_id.startsWith('sv-')));
  assert.throws(() => analyze(destination), /file set is not exact|analysis already exists/u);
  const resumedCalls = [];
  const resumed = await run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) });
  assert.equal(resumedCalls.length, 0);
  assert.deepEqual(resumed.seal, seal);
  const reconciledReport = writeTutorStubResistanceSemanticValidationReport({
    destination,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    expectedGoRequest: goRequestFor(loaded),
    sourceDirty: false,
    archiveDir: path.join(path.dirname(destination), 'private-archive'),
  });
  assert.deepEqual(reconciledReport, report);
});

test('resume after one preserved response calls only the never-started second judge', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-partial-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const firstCalls = [];
  await assert.rejects(
    run(destination, {
      callModel: fixtureCaller(firstCalls),
      afterJudgeCheckpoint: async () => {
        throw new Error('simulated coordinator crash after preserved response');
      },
    }),
    /simulated coordinator crash/u,
  );
  assert.equal(firstCalls.length, 1);
  const preservedCaseId = firstCalls[0].caseId;
  const resumedCalls = [];
  const { seal } = await run(destination, {
    resume: true,
    callModel: fixtureCaller(resumedCalls),
  });
  assert.equal(resumedCalls.filter((row) => row.caseId === preservedCaseId).length, 1);
  assert.notEqual(resumedCalls.find((row) => row.caseId === preservedCaseId).judgeId, firstCalls[0].judgeId);
  assert.equal(resumedCalls.length, 159);
  assert.equal(seal.judge_results, 160);
  assert.equal(seal.reservations, 160);
  const report = analyze(destination);
  assert.equal(report.status, 'passed');
  const partial = report.cases.find((row) => row.execution_case_id === preservedCaseId);
  assert.equal(partial.status, 'determinate');
  assert.equal(partial.judge_results, 2);
});

test('resume authenticates the complete durable archive before any additional judge call', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-resume-archive-auth-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const firstCalls = [];
  await assert.rejects(
    run(destination, {
      callModel: fixtureCaller(firstCalls),
      afterJudgeCheckpoint: () => {
        throw new Error('synthetic interruption after first durable response');
      },
    }),
    /synthetic interruption/u,
  );
  assert.equal(firstCalls.length, 1);
  const manifestFile = findArchiveManifest(path.join(temporary, 'private-archive'));
  const original = fs.readFileSync(manifestFile, 'utf8');
  const driftedBinding = JSON.parse(original);
  driftedBinding.source.commit = 'f'.repeat(40);
  fs.writeFileSync(manifestFile, `${JSON.stringify(driftedBinding, null, 2)}\n`);
  const resumedCalls = [];
  await assert.rejects(
    run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) }),
    /archive.*binding drifted/u,
  );
  assert.equal(resumedCalls.length, 0);

  const missingPrior = JSON.parse(original);
  const priorIndex = missingPrior.entries.findIndex((entry) => entry.stage === 'checkpoint_initialized');
  assert.ok(priorIndex >= 0);
  missingPrior.entries.splice(priorIndex, 1);
  missingPrior.entries.forEach((entry, index) => {
    entry.sequence = index + 1;
  });
  fs.writeFileSync(manifestFile, `${JSON.stringify(missingPrior, null, 2)}\n`);
  await assert.rejects(
    run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) }),
    /noncurrent orphan transition|entry inventory drifted/u,
  );
  assert.equal(resumedCalls.length, 0);
});

test('resume after a prepared but undispatched attempt may fill the case without selecting outcomes', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-zero-response-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const firstCalls = [];
  await assert.rejects(
    run(destination, {
      callModel: fixtureCaller(firstCalls),
      afterPreparedCheckpoint: async () => {
        throw new Error('simulated crash before dispatch');
      },
    }),
    /simulated crash before dispatch/u,
  );
  assert.equal(firstCalls.length, 0);
  const resumedCalls = [];
  const { seal } = await run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) });
  assert.equal(resumedCalls.length, 160);
  assert.equal(seal.judge_results, 160);
  assert.equal(seal.reservations, 160);
  assert.equal(analyze(destination).status, 'passed');
});

test('resume dispatches an already prepared third attempt without creating a fourth reservation', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-third-prepared-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const successfulCalls = [];
  const fixture = fixtureCaller(successfulCalls);
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
  await assert.rejects(
    run(destination, {
      callModel: flaky,
      afterPreparedCheckpoint: () => {
        prepared += 1;
        if (prepared === 3) throw new Error('synthetic crash after third preparation');
      },
    }),
    /synthetic crash after third preparation/u,
  );
  assert.equal(dispatches, 2);
  const { seal } = await run(destination, { resume: true, callModel: flaky });
  assert.equal(dispatches, 162);
  assert.equal(seal.reservations, 162);
  assert.equal(seal.judge_results, 160);
  assert.equal(analyze(destination).status, 'passed');
});

test('resume reconciles a byte-identical durable-archive orphan without recalling a judge', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-archive-orphan-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  let interrupted = false;
  await assert.rejects(
    run(destination, {
      callModel: fixtureCaller([]),
      afterArchiveEntryWrite: ({ stage }) => {
        if (stage === 'checkpoint_prepared' && !interrupted) {
          interrupted = true;
          throw new Error('simulated archive entry to manifest crash');
        }
      },
    }),
    /simulated archive entry to manifest crash/u,
  );
  const resumedCalls = [];
  const { seal } = await run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) });
  assert.equal(resumedCalls.length, 160);
  assert.equal(seal.reservations, 160);
  assert.equal(analyze(destination).status, 'passed');
});

test('resume reconciles a local prepared checkpoint before dispatching it once', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-local-prepared-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  let interrupted = false;
  await assert.rejects(
    run(destination, {
      callModel: fixtureCaller([]),
      afterLocalCheckpointWrite: ({ stage }) => {
        if (stage === 'checkpoint_prepared' && !interrupted) {
          interrupted = true;
          throw new Error('simulated local prepared to archive crash');
        }
      },
    }),
    /simulated local prepared to archive crash/u,
  );
  const resumedCalls = [];
  const { seal } = await run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) });
  assert.equal(resumedCalls.length, 160);
  assert.equal(seal.reservations, 160);
  assert.equal(analyze(destination).status, 'passed');
});

test('resume reconciles a local dispatched checkpoint without recalling the ambiguous judge', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-local-dispatched-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  let interrupted = false;
  await assert.rejects(
    run(destination, {
      callModel: fixtureCaller([]),
      afterLocalCheckpointWrite: ({ stage }) => {
        if (stage === 'checkpoint_dispatched' && !interrupted) {
          interrupted = true;
          throw new Error('simulated local dispatched to archive crash');
        }
      },
    }),
    /simulated local dispatched to archive crash/u,
  );
  const resumedCalls = [];
  const { seal } = await run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) });
  assert.equal(resumedCalls.length, 158);
  assert.equal(seal.judge_results, 159);
  assert.equal(analyze(destination).status, 'failed');
});

test('resume after a dispatched attempt with no checkpointed response never recalls the ambiguous judge', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-dispatched-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const firstCalls = [];
  await assert.rejects(
    run(destination, {
      callModel: fixtureCaller(firstCalls),
      afterDispatchCheckpoint: async () => {
        throw new Error('simulated ambiguous crash after dispatch');
      },
    }),
    /simulated ambiguous crash/u,
  );
  assert.equal(firstCalls.length, 0);
  const resumedCalls = [];
  const { seal } = await run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) });
  assert.equal(resumedCalls.length, 158);
  assert.equal(seal.judge_results, 159);
  assert.equal(seal.reservations, 159);
  const report = analyze(destination);
  assert.equal(report.status, 'failed');
  const ambiguous = report.cases.find((row) => row.reservations === 1 && row.judge_results === 1);
  assert.equal(ambiguous.status, 'measurement_indeterminate');
});

test('resume after Judge A and an ambiguous Judge B dispatch never recalls either judge', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-second-dispatched-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const loaded = loadTutorStubResistanceSemanticValidation();
  const secondJudgeId = loaded.instrument.registration.measurement.judges[1].id;
  const firstCalls = [];
  await assert.rejects(
    run(destination, {
      callModel: fixtureCaller(firstCalls),
      afterDispatchCheckpoint: ({ judgeId }) => {
        if (judgeId === secondJudgeId) throw new Error('simulated ambiguous second-judge dispatch');
      },
    }),
    /simulated ambiguous second-judge dispatch/u,
  );
  assert.equal(firstCalls.length, 1);
  const preservedCaseId = firstCalls[0].caseId;
  const resumedCalls = [];
  const { seal } = await run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) });
  assert.equal(resumedCalls.filter((row) => row.caseId === preservedCaseId).length, 0);
  assert.equal(resumedCalls.length, 158);
  assert.equal(seal.judge_results, 160);
  assert.equal(seal.reservations, 160);
  const report = analyze(destination);
  assert.equal(report.status, 'failed');
  const ambiguous = report.cases.find((row) => row.execution_case_id === preservedCaseId);
  assert.equal(ambiguous.status, 'measurement_indeterminate');
  assert.equal(ambiguous.judge_results, 2);
});

test('seal publication reconciles local-only and entry-only crash boundaries without model recall', async (t) => {
  for (const crashStage of ['local', 'archive']) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), `semantic-validation-seal-${crashStage}-`));
    const destination = path.join(temporary, 'run');
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
    const calls = [];
    let interrupted = false;
    await assert.rejects(
      run(destination, {
        callModel: fixtureCaller(calls),
        afterSealLocalWrite:
          crashStage === 'local'
            ? () => {
                throw new Error('simulated seal local to archive crash');
              }
            : null,
        afterArchiveEntryWrite:
          crashStage === 'archive'
            ? ({ stage }) => {
                if (stage === 'seal' && !interrupted) {
                  interrupted = true;
                  throw new Error('simulated seal entry to manifest crash');
                }
              }
            : null,
      }),
      /simulated seal/u,
    );
    assert.equal(calls.length, 160);
    const resumedCalls = [];
    const { seal } = await run(destination, { resume: true, callModel: fixtureCaller(resumedCalls) });
    assert.equal(resumedCalls.length, 0);
    assert.equal(seal.judge_results, 160);
    assert.equal(analyze(destination).status, 'passed');
  }
});

test('report publication reconciles local-only and entry-only crash boundaries without recomputation drift', async (t) => {
  for (const crashStage of ['local', 'archive']) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), `semantic-validation-report-${crashStage}-`));
    const destination = path.join(temporary, 'run');
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
    await run(destination, { callModel: fixtureCaller([]) });
    let interrupted = false;
    const reportOptions = {
      destination,
      expectedSourceCommit: SOURCE_COMMIT,
      expectedSourceTree: SOURCE_TREE,
      expectedGoRequestPath: GO_REQUEST_PATH,
      expectedGoRequestSha256: GO_REQUEST_SHA256,
      expectedGoRequest: goRequestFor(loadTutorStubResistanceSemanticValidation()),
      sourceDirty: false,
      archiveDir: path.join(path.dirname(destination), 'private-archive'),
    };
    assert.throws(
      () =>
        writeTutorStubResistanceSemanticValidationReport({
          ...reportOptions,
          afterReportLocalWrite:
            crashStage === 'local'
              ? () => {
                  throw new Error('simulated report local to archive crash');
                }
              : null,
          afterArchiveEntryWrite:
            crashStage === 'archive'
              ? ({ stage }) => {
                  if (stage === 'report' && !interrupted) {
                    interrupted = true;
                    throw new Error('simulated report entry to manifest crash');
                  }
                }
              : null,
        }),
      /simulated report/u,
    );
    const before = fs.readFileSync(path.join(destination, 'report.json'));
    const report = writeTutorStubResistanceSemanticValidationReport(reportOptions);
    assert.equal(report.status, 'passed');
    assert.ok(fs.readFileSync(path.join(destination, 'report.json')).equals(before));
  }
});

test('analysis requires the external source binding and rejects alternate case artifacts', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-tamper-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  await run(destination, { callModel: fixtureCaller([]) });
  assert.throws(
    () =>
      analyzeTutorStubResistanceSemanticValidation({
        destination,
        expectedSourceCommit: '3'.repeat(40),
        expectedSourceTree: SOURCE_TREE,
        expectedGoRequestPath: GO_REQUEST_PATH,
        expectedGoRequestSha256: GO_REQUEST_SHA256,
        expectedGoRequest: goRequestFor(loadTutorStubResistanceSemanticValidation()),
        sourceDirty: false,
      }),
    /plan does not match/u,
  );
  assert.throws(
    () =>
      analyzeTutorStubResistanceSemanticValidation({
        destination,
        expectedSourceCommit: SOURCE_COMMIT,
        expectedSourceTree: SOURCE_TREE,
        expectedGoRequestPath: GO_REQUEST_PATH,
        expectedGoRequestSha256: GO_REQUEST_SHA256,
        expectedGoRequest: goRequestFor(loadTutorStubResistanceSemanticValidation()),
        sourceDirty: true,
        archiveDir: path.join(path.dirname(destination), 'private-archive'),
      }),
    /clean source tree/u,
  );
  const caseId = fs.readdirSync(path.join(destination, 'cases'))[0];
  fs.writeFileSync(path.join(destination, 'cases', caseId, 'alternate.json'), '{}\n');
  assert.throws(() => analyze(destination), /file set is not exact/u);
});

test('archive verification rejects manifest topology drift and local/archive final-artifact splits', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-validation-archive-integrity-'));
  const destination = path.join(temporary, 'run');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  await run(destination, { callModel: fixtureCaller([]) });
  const manifestFile = findArchiveManifest(path.join(temporary, 'private-archive'));
  const original = fs.readFileSync(manifestFile, 'utf8');
  const manifest = JSON.parse(original);
  manifest.entries[0].logical_path = 'changed-plan.json';
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => analyze(destination), /archive.*topology|durable archive invalid/u);

  fs.writeFileSync(manifestFile, original);
  const withoutFinal = JSON.parse(original);
  const finalIndex = withoutFinal.entries.findIndex((entry) => entry.stage === 'checkpoint_sealed');
  assert.ok(finalIndex >= 0);
  withoutFinal.entries.splice(finalIndex, 1);
  withoutFinal.entries.forEach((entry, index) => {
    entry.sequence = index + 1;
  });
  fs.writeFileSync(manifestFile, `${JSON.stringify(withoutFinal, null, 2)}\n`);
  assert.throws(() => analyze(destination), /local final artifact|transition inventory/u);
});
