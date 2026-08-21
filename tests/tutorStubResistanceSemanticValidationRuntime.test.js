import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildTutorStubResistanceSemanticZeroCallFixtureResponse } from '../services/tutorStubResistanceSemanticAdjudication.js';
import {
  loadTutorStubResistanceSemanticValidation,
  tutorStubResistanceSemanticOpaqueCaseId,
} from '../services/tutorStubResistanceSemanticValidation.js';
import {
  analyzeTutorStubResistanceSemanticValidation,
  runTutorStubResistanceSemanticValidation,
  writeTutorStubResistanceSemanticValidationReport,
} from '../services/tutorStubResistanceSemanticValidationRuntime.js';

const SOURCE_COMMIT = '1'.repeat(40);
const SOURCE_TREE = '2'.repeat(40);
const GO_REQUEST_PATH = 'config/future-semantic-validation-go-request.json';
const GO_REQUEST_SHA256 = 'a'.repeat(64);

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
  return analyzeTutorStubResistanceSemanticValidation({
    destination,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedGoRequestPath: GO_REQUEST_PATH,
    expectedGoRequestSha256: GO_REQUEST_SHA256,
    sourceDirty: false,
    archiveDir,
  });
}

function run(destination, options = {}) {
  const loaded = loadTutorStubResistanceSemanticValidation();
  const archiveDir = path.join(path.dirname(destination), 'private-archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  return runTutorStubResistanceSemanticValidation({
    destination,
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    goRequestPath: GO_REQUEST_PATH,
    goRequestSha256: GO_REQUEST_SHA256,
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
    sourceDirty: false,
    archiveDir: path.join(path.dirname(destination), 'private-archive'),
  });
  assert.equal(report.status, 'passed');
  assert.equal(report.cases.length, 80);
  assert.ok(report.cases.every((row) => row.case_id && row.execution_case_id.startsWith('sv-')));
  assert.throws(() => analyze(destination), /file set is not exact|analysis already exists/u);
  await assert.rejects(
    run(destination, { resume: true, callModel: fixtureCaller([]) }),
    /sealed or analyzed semantic validation cannot be resumed/u,
  );
  assert.throws(
    () =>
      writeTutorStubResistanceSemanticValidationReport({
        destination,
        expectedSourceCommit: SOURCE_COMMIT,
        expectedSourceTree: SOURCE_TREE,
        expectedGoRequestPath: GO_REQUEST_PATH,
        expectedGoRequestSha256: GO_REQUEST_SHA256,
        sourceDirty: false,
        archiveDir: path.join(path.dirname(destination), 'private-archive'),
      }),
    /create-once/u,
  );
});

test('resume after one preserved response never recalls that case and seals it indeterminate', async (t) => {
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
  assert.equal(resumedCalls.filter((row) => row.caseId === preservedCaseId).length, 0);
  assert.equal(resumedCalls.length, 158);
  assert.equal(seal.judge_results, 159);
  assert.equal(seal.reservations, 159);
  const report = analyze(destination);
  assert.equal(report.status, 'failed');
  const partial = report.cases.find((row) => row.execution_case_id === preservedCaseId);
  assert.equal(partial.status, 'measurement_indeterminate');
  assert.equal(partial.judge_results, 1);
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
        sourceDirty: true,
        archiveDir: path.join(path.dirname(destination), 'private-archive'),
      }),
    /clean source tree/u,
  );
  const caseId = fs.readdirSync(path.join(destination, 'cases'))[0];
  fs.writeFileSync(path.join(destination, 'cases', caseId, 'alternate.json'), '{}\n');
  assert.throws(() => analyze(destination), /file set is not exact/u);
});
