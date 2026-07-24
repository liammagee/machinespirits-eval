import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

import {
  acquireTutorStubFirstDraftCellClaim,
  aggregateTutorStubFirstDraftCampaignPromptSize,
  aggregateTutorStubFirstDraftCampaignTokenUsage,
  applyTutorStubFirstDraftDevelopmentRuntimePreflight,
  assessTutorStubAcceptanceCell,
  assertTutorStubFirstDraftDevelopmentIterationVacant,
  buildTutorStubFirstDraftCampaignValidationReport,
  buildTutorStubFirstDraftPreflightFailureResult,
  expandTutorStubFirstDraftCampaign,
  loadTutorStubFirstDraftCampaign,
  loadTutorStubFirstDraftFrozenBundle,
  releaseTutorStubFirstDraftCellClaim,
  summarizeTutorStubWorkingScreen,
  tutorStubFirstDraftDevelopmentExecutionPlan,
  tutorStubFirstDraftFocusedTestSuites,
  tutorStubFirstDraftCampaignValidationArtifactPath,
  tutorStubFirstDraftGatePossibility,
  tutorStubFirstDraftInterruptedCellResult,
  tutorStubFirstDraftIterationStopping,
  tutorStubSourceSurfaceAccessibilityReady,
  tutorStubFirstDraftUnexpectedIterationArtifacts,
  tutorStubStrictOriginalCandidateAccepted,
  validateTutorStubFirstDraftCampaign,
  writeTutorStubFirstDraftJsonExclusive,
} from '../services/tutorStubFirstDraftCampaign.js';

import {
  TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
} from '../services/tutorStubJointPerformanceFirstDraft.js';
import { TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA } from '../services/tutorStubCompactSpeakingPrompt.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { refreshTutorStubFrozenFirstDraftRequest } from '../services/tutorStubFrozenReplay.js';
import {
  auditTutorStubSourceAccessibilityCompensation,
  compileTutorStubSourceAccessibilityContract,
} from '../services/tutorStubSourceAccessibilityContract.js';
import {
  buildTutorStubFirstDraftPreflightBoundary,
  buildTutorStubFirstDraftPreflightCertificate,
  materializeTutorStubFirstDraftPreflightCertificate,
  tutorStubFirstDraftHardCellBlocksRemaining,
  validateTutorStubFirstDraftPreflightCertificate,
} from '../services/tutorStubFirstDraftPreflightCertificate.js';

// These formerly host-gated cases now always run against the repo fixture
// fallback. Keep them sequential because they share the same immutable corpus.
const V_SERIES_REPO_SOURCE_FIXTURE_OPTS = { concurrency: false };

test('campaign token aggregation excludes unstarted cells and never treats missing usage as zero', () => {
  const complete = aggregateTutorStubFirstDraftCampaignTokenUsage([
    {
      completedTurns: 1,
      tokenUsageAvailable: true,
      tokenUsage: {
        inputTokens: 100,
        cachedInputTokens: 40,
        uncachedInputTokens: 60,
        outputTokens: 10,
        reasoningOutputTokens: 2,
        totalTokens: 110,
      },
    },
    {
      completedTurns: 1,
      tokenUsageAvailable: true,
      tokenUsage: {
        inputTokens: 120,
        cachedInputTokens: 50,
        uncachedInputTokens: 70,
        outputTokens: 12,
        reasoningOutputTokens: 3,
        totalTokens: 132,
      },
    },
    { completedTurns: 0, tokenUsageAvailable: false, tokenUsage: null },
  ]);
  assert.equal(complete.tokenUsageAvailable, true);
  assert.deepEqual(complete.tokenUsage, {
    inputTokens: 220,
    cachedInputTokens: 90,
    uncachedInputTokens: 130,
    outputTokens: 22,
    reasoningOutputTokens: 5,
    totalTokens: 242,
  });

  const missing = aggregateTutorStubFirstDraftCampaignTokenUsage([
    { completedTurns: 1, tokenUsageAvailable: false, tokenUsage: null },
  ]);
  assert.equal(missing.tokenUsageAvailable, false);
  assert.deepEqual(missing.tokenUsage, {
    inputTokens: null,
    cachedInputTokens: null,
    uncachedInputTokens: null,
    outputTokens: null,
    reasoningOutputTokens: null,
    totalTokens: null,
  });
});

test('campaign prompt-size aggregation carries per-call authored and residual measurements', () => {
  const report = (authored, observed) => ({
    schema: 'machinespirits.tutor-stub.prompt-size-report.v1',
    tokenizer: { id: 'fixture' },
    authoredTotal: { estimatedTokens: authored },
    observedProviderInput: { tokens: observed },
    inferredResidual: { tokens: observed - authored },
  });
  const summary = aggregateTutorStubFirstDraftCampaignPromptSize([
    { promptSizeReports: [report(10, 100)] },
    { promptSizeReports: [report(12, 120)] },
    { completedTurns: 0 },
  ]);
  assert.equal(summary.calls, 2);
  assert.equal(summary.totalAuthoredEstimatedTokens, 22);
  assert.equal(summary.totalObservedProviderInputTokens, 220);
  assert.equal(summary.totalInferredResidualTokens, 198);
});

function certificateFixture(tmp, overrides = {}) {
  for (const [fileName, content] of [
    ['engagementRegisterRegistry.js', 'export const version = 1;\n'],
    ['compiler.js', 'export const compile = true;\n'],
    ['focused.test.js', '// focused test\n'],
    ['fixture.json', '{}\n'],
  ]) {
    const filePath = path.join(tmp, fileName);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content);
  }
  const config = {
    id: 'campaign-a',
    artifacts: { root: '/tmp/artifact-a' },
    notes: 'not deterministic input',
    matrix: [{ id: 'cell-a', seed: 111 }],
    preflight: {
      world_quality: 'node compiler.js',
      focused_test_suites: [{ id: 'focused', test_files: ['focused.test.js'] }],
      model_free_fixtures: ['fixture.json'],
    },
    ...overrides.config,
  };
  const focusedTestSuites = overrides.focusedTestSuites || [{ id: 'focused', testFiles: ['focused.test.js'] }];
  const commands = overrides.commands || [
    { id: 'world-quality', kind: 'world_quality', suiteId: null, tap: false, argv: ['node', 'compiler.js'] },
    ...focusedTestSuites.map((suite) => ({
      id: `focused-${suite.id}`,
      kind: 'focused_test_suite',
      suiteId: suite.id,
      tap: true,
      argv: ['node', '--test', ...suite.testFiles],
    })),
  ];
  const built = buildTutorStubFirstDraftPreflightBoundary({
    root: tmp,
    config,
    commands,
    focusedTestSuites,
    implementationHead: overrides.implementationHead || 'head-a',
    runtime: overrides.runtime || { node: 'v-test', v8: 'v8-test', platform: 'test', arch: 'test' },
    implementationFiles: overrides.implementationFiles || ['engagementRegisterRegistry.js'],
    worldCompilerFiles: overrides.worldCompilerFiles || ['compiler.js'],
  });
  return { config, focusedTestSuites, commands, ...built };
}

function certificateReport(tmp, { status = 'pass', tests = 3, pass = 3, fail = 0 } = {}) {
  const commands = [
    { id: 'world-quality', order: 1, kind: 'world_quality', suiteId: null, tap: null },
    {
      id: 'focused-focused',
      order: 2,
      kind: 'focused_test_suite',
      suiteId: 'focused',
      tap: {
        tests,
        suites: 1,
        pass,
        fail,
        cancelled: 0,
        skipped: 0,
        todo: 0,
        durationMs: 1,
        failureNames: fail ? ['saved failure'] : [],
      },
    },
  ].map((command) => {
    const stem = `${command.order}-${command.id}`;
    const stdoutPath = path.join(tmp, `${stem}.stdout.log`);
    const stderrPath = path.join(tmp, `${stem}.stderr.log`);
    const stdout = Buffer.from(command.tap ? `# tests ${tests}\n# pass ${pass}\n# fail ${fail}\n` : 'world ok\n');
    const stderr = Buffer.from('');
    fs.writeFileSync(stdoutPath, stdout);
    fs.writeFileSync(stderrPath, stderr);
    return {
      schema: 'machinespirits.tutor-stub.first-draft-preflight-command-execution.v1',
      ...command,
      label: command.id,
      argv: command.tap ? ['node', '--test', 'focused.test.js'] : ['node', 'compiler.js'],
      command: command.tap ? '"node" "--test" "focused.test.js"' : '"node" "compiler.js"',
      attempt: 1,
      retryPolicy: 'none',
      startedAt: '2026-07-17T00:00:00.000Z',
      finishedAt: '2026-07-17T00:00:01.000Z',
      elapsedMs: 1000,
      status: status === 'pass' ? 'pass' : 'fail',
      exitCode: status === 'pass' ? 0 : 1,
      signal: null,
      spawnErrorCode: null,
      stdout: { path: stdoutPath, bytes: stdout.byteLength, sha256: createHash('sha256').update(stdout).digest('hex') },
      stderr: { path: stderrPath, bytes: 0, sha256: createHash('sha256').update(stderr).digest('hex') },
      makesModelCalls: false,
      modelCalls: 0,
    };
  });
  return {
    schema: 'machinespirits.tutor-stub.first-draft-preflight-execution.v1',
    generatedAt: '2026-07-17T00:00:01.000Z',
    status,
    startedAt: '2026-07-17T00:00:00.000Z',
    finishedAt: '2026-07-17T00:00:01.000Z',
    elapsedMs: 1000,
    executionPolicy: { sequential: true, attemptsPerCommand: 1, retryPolicy: 'none' },
    commands,
    failedCommand: status === 'pass' ? null : { kind: 'focused_test_suite' },
  };
}

test('preflight certificate key binds deterministic content but not campaign bookkeeping or HEAD', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-certificate-key-'));
  try {
    const baseline = certificateFixture(tmp);
    const metadataOnly = certificateFixture(tmp, {
      implementationHead: 'head-b',
      config: {
        id: 'campaign-b',
        purpose: 'changed purpose',
        artifacts: { root: '/elsewhere/results' },
        notes: 'different note',
        change_log: { speaking_prompt: 'bookkeeping only' },
        execution: { hard_cell: 'different-cell', maximum_concurrent_remaining_cells: 1 },
        stopping: { maximum_consecutive_iterations_without_improvement: 9 },
        matrix: [
          {
            id: 'different-cell',
            seed: 999,
            development_seed: 1000,
            source_trace: '/different/result/trace.jsonl',
            source_trace_sha256: 'metadata-only-hash',
          },
        ],
      },
    });
    assert.equal(metadataOnly.key, baseline.key);
    assert.notEqual(metadataOnly.observedHead, baseline.observedHead);

    const runtime = certificateFixture(tmp, {
      runtime: {
        node: 'v-other',
        v8: 'v8-test',
        npm: 'npm-test',
        platform: 'test',
        arch: 'test',
        environment: { NODE_OPTIONS: '--conditions=test' },
      },
    });
    assert.notEqual(runtime.key, baseline.key);

    const preflightChanged = certificateFixture(tmp, {
      config: {
        preflight: {
          world_quality: 'node compiler.js --changed',
          focused_test_suites: [{ id: 'focused', test_files: ['focused.test.js'] }],
          model_free_fixtures: ['fixture.json'],
        },
      },
    });
    assert.notEqual(preflightChanged.key, baseline.key);

    fs.writeFileSync(path.join(tmp, 'engagementRegisterRegistry.js'), 'export const version = 2;\n');
    const source = certificateFixture(tmp);
    assert.notEqual(source.key, baseline.key);

    fs.writeFileSync(path.join(tmp, 'engagementRegisterRegistry.js'), 'export const version = 1;\n');
    fs.writeFileSync(path.join(tmp, 'focused.test.js'), '// selected test changed\n');
    const selectedTestContent = certificateFixture(tmp);
    assert.notEqual(selectedTestContent.key, baseline.key);

    fs.writeFileSync(path.join(tmp, 'focused.test.js'), '// focused test\n');
    fs.writeFileSync(path.join(tmp, 'focused-b.test.js'), '// second test\n');
    const inventory = certificateFixture(tmp, {
      focusedTestSuites: [{ id: 'focused', testFiles: ['focused.test.js', 'focused-b.test.js'] }],
    });
    assert.notEqual(inventory.key, baseline.key);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('unselected governance tests cannot invalidate a focused preflight certificate', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-certificate-selection-'));
  try {
    fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
    const focusedPath = path.join(tmp, 'tests', 'focused.test.js');
    const outerPath = path.join(tmp, 'tests', 'tutorStubFirstDraftOuterLoop.test.js');
    fs.writeFileSync(focusedPath, '// selected\n');
    fs.writeFileSync(outerPath, '// outer governance v1\n');
    const focusedTestSuites = [{ id: 'focused', testFiles: ['tests/focused.test.js'] }];
    const baseline = certificateFixture(tmp, { focusedTestSuites });
    assert.equal(
      baseline.boundary.testDependencies.some((row) => row.path.endsWith('tutorStubFirstDraftOuterLoop.test.js')),
      false,
    );

    fs.writeFileSync(outerPath, '// outer governance v2\n');
    const unselectedChange = certificateFixture(tmp, { focusedTestSuites });
    assert.equal(unselectedChange.key, baseline.key);

    const selectedSuites = [
      {
        id: 'focused',
        testFiles: ['tests/focused.test.js', 'tests/tutorStubFirstDraftOuterLoop.test.js'],
      },
    ];
    const selected = certificateFixture(tmp, { focusedTestSuites: selectedSuites });
    fs.writeFileSync(outerPath, '// outer governance v3\n');
    const selectedChange = certificateFixture(tmp, { focusedTestSuites: selectedSuites });
    assert.notEqual(selectedChange.key, selected.key);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('selected tests bind their recursive local import closure', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-certificate-imports-'));
  try {
    fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'tests', 'focused.test.js'), "import './focused-helper.js';\n// selected\n");
    const helperPath = path.join(tmp, 'tests', 'focused-helper.js');
    fs.writeFileSync(helperPath, 'export const helper = 1;\n');
    const focusedTestSuites = [{ id: 'focused', testFiles: ['tests/focused.test.js'] }];
    const baseline = certificateFixture(tmp, { focusedTestSuites });
    assert.ok(baseline.boundary.testDependencies.some((row) => row.path === 'tests/focused-helper.js'));
    fs.writeFileSync(helperPath, 'export const helper = 2;\n');
    const changed = certificateFixture(tmp, { focusedTestSuites });
    assert.notEqual(changed.key, baseline.key);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('selected tests bind literal campaign config, prompt, and fixture resources', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-certificate-resources-'));
  try {
    fs.mkdirSync(path.join(tmp, 'tests', 'fixtures'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'prompts'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'config', 'tutor-stub-campaigns'), { recursive: true });
    const testPath = path.join(tmp, 'tests', 'focused.test.js');
    const configPath = path.join(tmp, 'config', 'tutor-stub-campaigns', 'first-draft-working-screens-v9.yaml');
    const promptPath = path.join(tmp, 'prompts', 'focused.md');
    const resourcePath = path.join(tmp, 'tests', 'fixtures', 'focused.json');
    fs.writeFileSync(
      testPath,
      [
        "const campaign = 'first-draft-working-screens-v9.yaml';",
        "const prompt = 'prompts/focused.md';",
        "const fixture = 'tests/fixtures/focused.json';",
        'void campaign; void prompt; void fixture;',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(configPath, 'schema: v1\n');
    fs.writeFileSync(promptPath, 'prompt v1\n');
    fs.writeFileSync(resourcePath, '{"version":1}\n');
    const focusedTestSuites = [{ id: 'focused', testFiles: ['tests/focused.test.js'] }];
    const baseline = certificateFixture(tmp, { focusedTestSuites });
    assert.deepEqual(baseline.boundary.testDependencies.map((row) => row.path).sort(), [
      'config/tutor-stub-campaigns/first-draft-working-screens-v9.yaml',
      'prompts/focused.md',
      'tests/fixtures/focused.json',
    ]);

    for (const [filePath, content] of [
      [configPath, 'schema: v2\n'],
      [promptPath, 'prompt v2\n'],
      [resourcePath, '{"version":2}\n'],
    ]) {
      const original = fs.readFileSync(filePath, 'utf8');
      fs.writeFileSync(filePath, content);
      const changed = certificateFixture(tmp, { focusedTestSuites });
      assert.notEqual(changed.key, baseline.key, filePath);
      fs.writeFileSync(filePath, original);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('passing preflight certificate is reusable and materializes complete captured evidence', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-certificate-hit-'));
  try {
    const { boundary, key, observedHead } = certificateFixture(tmp);
    const report = certificateReport(tmp);
    const certificate = buildTutorStubFirstDraftPreflightCertificate({
      boundary,
      key,
      report,
      observedHead,
    });
    assert.equal(certificate.status, 'pass');
    assert.equal(certificate.tapTotals.tests, 3);
    assert.deepEqual(certificate.failingNames, []);
    assert.deepEqual(validateTutorStubFirstDraftPreflightCertificate(certificate, { boundary, key }), {
      ok: true,
      reasons: [],
    });
    const iterationRoot = path.join(tmp, 'iteration-2');
    const reused = materializeTutorStubFirstDraftPreflightCertificate({
      certificate,
      iterationRoot,
      reportName: 'preflight-execution.json',
      campaignId: 'campaign-b',
      cellId: 'cell-b',
      certificatePath: path.join(tmp, `${key}.json`),
    });
    assert.equal(reused.status, 'pass');
    assert.equal(reused.preflightRevision.disposition, 'reused');
    assert.equal(reused.preflightRevision.tutorGenerationResult, false);
    assert.equal(fs.readFileSync(reused.commands[0].stdout.path, 'utf8'), 'world ok\n');
    assert.equal(reused.commands[1].tap.tests, 3);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('preflight certificates reject tamper, mismatch, failure, incompleteness, and zero TAP', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-certificate-reject-'));
  try {
    const { boundary, key } = certificateFixture(tmp);
    const passing = buildTutorStubFirstDraftPreflightCertificate({
      boundary,
      key,
      report: certificateReport(tmp),
    });
    const tampered = structuredClone(passing);
    tampered.commands[0].stdout.base64 = Buffer.from('tampered').toString('base64');
    assert.equal(validateTutorStubFirstDraftPreflightCertificate(tampered, { boundary, key }).ok, false);

    const missingTap = structuredClone(passing);
    missingTap.commands[1].tap = null;
    assert.ok(
      validateTutorStubFirstDraftPreflightCertificate(missingTap, { boundary, key }).reasons.includes(
        'command_evidence_mismatch',
      ),
    );

    const zeroOneSuite = structuredClone(passing);
    zeroOneSuite.commands[1].tap.tests = 0;
    zeroOneSuite.commands[1].tap.pass = 0;
    assert.ok(
      validateTutorStubFirstDraftPreflightCertificate(zeroOneSuite, { boundary, key }).reasons.includes(
        'command_evidence_mismatch',
      ),
    );

    const commandDrift = structuredClone(passing);
    commandDrift.commands[1].argv.push('--changed');
    assert.ok(
      validateTutorStubFirstDraftPreflightCertificate(commandDrift, { boundary, key }).reasons.includes(
        'command_evidence_mismatch',
      ),
    );

    const changedRuntime = certificateFixture(tmp, {
      runtime: { node: 'v-new', v8: 'v8-test', platform: 'test', arch: 'test' },
    });
    assert.equal(validateTutorStubFirstDraftPreflightCertificate(passing, changedRuntime).ok, false);

    const failed = buildTutorStubFirstDraftPreflightCertificate({
      boundary,
      key,
      report: certificateReport(tmp, { status: 'fail', tests: 3, pass: 2, fail: 1 }),
    });
    assert.equal(failed.status, 'fail');
    assert.equal(validateTutorStubFirstDraftPreflightCertificate(failed, { boundary, key }).ok, false);

    const zeroTap = buildTutorStubFirstDraftPreflightCertificate({
      boundary,
      key,
      report: certificateReport(tmp, { tests: 0, pass: 0, fail: 0 }),
    });
    assert.equal(zeroTap.status, 'incomplete');
    assert.ok(validateTutorStubFirstDraftPreflightCertificate(zeroTap, { boundary, key }).reasons.includes('zero_tap'));

    const incomplete = structuredClone(passing);
    incomplete.complete = false;
    assert.ok(
      validateTutorStubFirstDraftPreflightCertificate(incomplete, { boundary, key }).reasons.includes('incomplete'),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('one valid TAP suite cannot mask a second exit-zero suite with missing TAP', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-certificate-two-suite-'));
  try {
    fs.writeFileSync(path.join(tmp, 'focused-b.test.js'), '// second focused test\n');
    const focusedTestSuites = [
      { id: 'focused', testFiles: ['focused.test.js'] },
      { id: 'focused_b', testFiles: ['focused-b.test.js'] },
    ];
    const commands = [
      { id: 'world-quality', kind: 'world_quality', suiteId: null, tap: false, argv: ['node', 'compiler.js'] },
      {
        id: 'focused-focused',
        kind: 'focused_test_suite',
        suiteId: 'focused',
        tap: true,
        argv: ['node', '--test', 'focused.test.js'],
      },
      {
        id: 'focused-focused_b',
        kind: 'focused_test_suite',
        suiteId: 'focused_b',
        tap: true,
        argv: ['node', '--test', 'focused-b.test.js'],
      },
    ];
    const { boundary, key } = certificateFixture(tmp, { focusedTestSuites, commands });
    const report = certificateReport(tmp);
    const missingTap = structuredClone(report.commands[1]);
    missingTap.id = 'focused-focused_b';
    missingTap.order = 3;
    missingTap.suiteId = 'focused_b';
    missingTap.argv = ['node', '--test', 'focused-b.test.js'];
    missingTap.tap = null;
    report.commands.push(missingTap);
    const certificate = buildTutorStubFirstDraftPreflightCertificate({ boundary, key, report });
    assert.equal(certificate.status, 'incomplete');
    assert.equal(certificate.commandEvidenceComplete, false);
    assert.equal(validateTutorStubFirstDraftPreflightCertificate(certificate, { boundary, key }).ok, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('mandatory staged diagnostics cannot be bypassed by complete-all-cells', () => {
  const execution = {
    hard_cell_must_pass_before_remaining: true,
    mandatory_stage_dependency: true,
  };
  assert.equal(
    tutorStubFirstDraftHardCellBlocksRemaining({
      execution,
      hardCellStatus: 'fail',
      completeAllCells: true,
    }),
    true,
  );
  assert.equal(
    tutorStubFirstDraftHardCellBlocksRemaining({
      execution: { ...execution, mandatory_stage_dependency: false },
      hardCellStatus: 'fail',
      completeAllCells: true,
    }),
    false,
  );
  assert.equal(
    tutorStubFirstDraftHardCellBlocksRemaining({
      execution,
      hardCellStatus: 'pass',
      completeAllCells: true,
    }),
    false,
  );
});

function workingConfig(tmp) {
  const trace = path.join(tmp, 'source.jsonl');
  const fixture = path.join(tmp, 'fixture.json');
  fs.writeFileSync(trace, '{}\n');
  fs.writeFileSync(fixture, '{}\n');
  return {
    schema: 'machinespirits.tutor-stub.first-draft-working-screen.v1',
    id: 'working-test',
    held_out: false,
    fixed_configuration: {
      draws_per_turn: 1,
      max_live_model_jobs: 3,
      semantic_adjudication: true,
      adjudicator_effort: 'low',
    },
    preflight: { model_free_fixtures: [fixture] },
    artifacts: { root: path.join(tmp, 'out') },
    matrix: [
      {
        id: 'hard',
        priority: 1,
        world: 'world_hard',
        learner_profile: 'answer_seeking',
        source_trace: trace,
        turns: [2, 3, 7, 10],
        development_seed: 81001,
        seed_status: 'reusable_non_held_out_development',
      },
      {
        id: 'next',
        priority: 2,
        world: 'world_next',
        learner_profile: 'answer_seeking',
        source_trace: trace,
        turns: [3, 4, 6, 7],
        development_seed: 81002,
        seed_status: 'reusable_non_held_out_development',
      },
    ],
    gates_per_cell: {
      required_originals_accepted: 3,
      required_turns: 4,
      maximum_safety_failures: 0,
      maximum_fallbacks: 0,
      minimum_mean_configuration_realization: 0.9,
      require_transcript_specific_uptake: true,
    },
  };
}

function enableStructuredGeneration(config) {
  config.fixed_configuration.structured_generation = true;
  config.gates_per_cell.require_structured_output = true;
  config.gates_per_cell.require_structured_slot_ownership = true;
  config.gates_per_cell.require_exact_source_once = true;
  return config;
}

function enableJointPerformanceGeneration(config) {
  config.fixed_configuration.joint_performance_generation = true;
  config.fixed_configuration.joint_performance_schema = TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA;
  config.fixed_configuration.joint_performance_composition_schema = TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA;
  config.fixed_configuration.joint_performance_audit_schema = TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA;
  config.gates_per_cell.require_joint_performance_output = true;
  config.gates_per_cell.require_joint_performance_ownership = true;
  config.gates_per_cell.require_exact_host_source_occurrences = true;
  return config;
}

function enableCompactSpeakerPrompt(config) {
  enableJointPerformanceGeneration(config);
  config.fixed_configuration.compact_speaker_prompt = true;
  config.fixed_configuration.compact_speaker_prompt_schema = TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA;
  config.gates_per_cell.require_compact_speaker_prompt = true;
  return config;
}

function confirmationConfig(tmp) {
  const config = enableJointPerformanceGeneration(workingConfig(tmp));
  const trace = config.matrix[0].source_trace;
  fs.writeFileSync(
    trace,
    [1, 2, 3, 4]
      .map((turn) =>
        JSON.stringify({
          type: 'tutor_response_guard_accounting',
          turn,
          accounting: { finalDelivery: { source: 'original_candidate' } },
        }),
      )
      .join('\n') + '\n',
  );
  config.fixed_configuration.draws_per_turn = 4;
  config.gates_per_cell.required_turns = 4;
  config.gates_per_cell.required_originals_accepted = 4;
  config.gates_per_cell.required_prefixes = 1;
  config.gates_per_cell.required_draws_per_prefix = 4;
  config.gates_per_cell.minimum_mean_configuration_realization = 1;
  config.gates_per_cell.configuration_realization_enforcement = 'gate';
  config.matrix = [
    ['hard', 1, 5, 81001],
    ['second', 2, 5, 81002],
    ['third', 3, 2, 81003],
    ['fourth', 4, 4, 81004],
  ].map(([id, priority, turn, development_seed]) => ({
    id,
    priority,
    world: `world_${id}`,
    learner_profile: id === 'hard' ? 'answer_seeking' : 'diligent',
    source_trace: trace,
    turns: [turn],
    development_seed,
    seed_status: 'reusable_non_held_out_development',
    prefix_integrity: {
      target_turn: turn,
      required_prior_delivery_source: 'original_candidate',
      verified_prior_turns: Array.from({ length: turn - 1 }, (_, index) => index + 1),
    },
  }));
  config.execution = {
    hardest_cell_first: true,
    hard_cell: 'hard',
    hard_cell_must_pass_before_remaining: true,
    remaining_cells_execution: 'concurrent',
    maximum_concurrent_remaining_cells: 3,
    one_job_per_cell: true,
    forbid_duplicate_active_or_completed_cells: true,
    complete_all_cells_after_hard_cell_passes: true,
    stop_cell_when_gate_mathematically_impossible: true,
    preserve_unstarted_seeds_as_unconsumed: true,
  };
  return config;
}

test('development confirmation runs one hard cell then three remaining cells with one preflight', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-development-execution-'));
  try {
    const config = confirmationConfig(tmp);
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 8 });
    const execution = tutorStubFirstDraftDevelopmentExecutionPlan({ plan, config });
    assert.equal(plan.maxConcurrency, 3);
    assert.equal(execution.hardCell.id, 'hard');
    assert.deepEqual(
      execution.remainingCells.map((cell) => cell.id),
      ['second', 'third', 'fourth'],
    );
    assert.equal(execution.remainingConcurrency, 3);
    assert.equal(execution.preflightRuns, 1);
    assert.equal(execution.hardCellMustPassBeforeRemaining, true);
    assert.equal(execution.completeAllCellsAfterHardCellPasses, true);
    assert.equal(execution.oneJobPerCell, true);
    assert.equal(execution.forbidDuplicateActiveOrCompletedCells, true);
    assert.equal(execution.stopCellWhenGateMathematicallyImpossible, true);
    assert.equal(execution.preserveUnstartedSeedsAsUnconsumed, true);
    for (const cell of plan.cells) {
      assert.equal(cell.commands.length, 1);
      const drawsIndex = cell.commands[0].argv.indexOf('--draws');
      assert.equal(cell.commands[0].argv[drawsIndex + 1], '4');
      assert.equal(cell.commands[0].argv.includes('--stop-on-first-rejection'), true);
      assert.match(cell.commands[0].outputPath, new RegExp(`${cell.id}/turn-${cell.turns[0]}\\.json$`, 'u'));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('structured focused test suites preserve the complete legacy gate inventory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-focused-suites-'));
  try {
    fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'services', '__tests__'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'tests', 'alpha.test.js'), '// alpha\n');
    fs.writeFileSync(path.join(tmp, 'services', '__tests__', 'beta.test.js'), '// beta\n');
    const config = workingConfig(tmp);
    config.preflight.focused_tests = 'node --test tests/alpha.test.js services/__tests__/beta.test.js';
    config.preflight.focused_test_suites = [
      { id: 'contracts', test_files: ['tests/alpha.test.js'] },
      { id: 'integration', test_files: ['services/__tests__/beta.test.js'] },
    ];
    assert.deepEqual(tutorStubFirstDraftFocusedTestSuites(config, { root: tmp }), [
      { id: 'contracts', testFiles: ['tests/alpha.test.js'] },
      { id: 'integration', testFiles: ['services/__tests__/beta.test.js'] },
    ]);
    const validation = validateTutorStubFirstDraftCampaign({ config, root: tmp });
    assert.deepEqual(validation.focusedTestSuites, [
      { id: 'contracts', testFiles: ['tests/alpha.test.js'] },
      { id: 'integration', testFiles: ['services/__tests__/beta.test.js'] },
    ]);

    const shrunk = structuredClone(config);
    shrunk.preflight.focused_test_suites = [{ id: 'contracts', test_files: ['tests/alpha.test.js'] }];
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: shrunk, root: tmp }),
      /refusing to shrink or change the deterministic gate/u,
    );

    const duplicateId = structuredClone(config);
    duplicateId.preflight.focused_test_suites[1].id = 'contracts';
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: duplicateId, root: tmp }),
      /duplicate focused test suite id/u,
    );

    const duplicateFile = structuredClone(config);
    duplicateFile.preflight.focused_test_suites[1].test_files = ['tests/alpha.test.js'];
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: duplicateFile, root: tmp }),
      /duplicate focused test file across suites/u,
    );

    const absoluteFile = structuredClone(config);
    absoluteFile.preflight.focused_test_suites[0].test_files = [path.join(tmp, 'tests', 'alpha.test.js')];
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: absoluteFile, root: tmp }),
      /must be repo-relative/u,
    );

    const missingFile = structuredClone(config);
    missingFile.preflight.focused_test_suites[0].test_files = ['tests/missing.test.js'];
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: missingFile, root: tmp }),
      /focused test file is missing/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('atomic development cell claims reject duplicate live or crash-restart attempts', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-cell-claim-'));
  try {
    const outputDir = path.join(tmp, 'iteration-8', 'hard');
    const first = acquireTutorStubFirstDraftCellClaim({
      outputDir,
      cellId: 'hard',
      seed: 20261600,
      configSha256: 'config-hash',
      sourceTraceSha256: 'trace-hash',
      expectedInventory: [1, 2, 3, 4].map((draw) => ({ turn: 5, draw })),
      pid: 101,
    });
    assert.equal(fs.existsSync(first.claimPath), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(first.claimPath, 'utf8')), {
      schema: 'machinespirits.tutor-stub.first-draft-cell-claim.v1',
      cellId: 'hard',
      outputDir,
      seed: 20261600,
      configSha256: 'config-hash',
      sourceTraceSha256: 'trace-hash',
      expectedInventory: [1, 2, 3, 4].map((draw) => ({ turn: 5, draw })),
      pid: 101,
      acquiredAt: first.claim.acquiredAt,
      disposition: 'active_or_crash_preserved',
    });
    assert.throws(
      () => acquireTutorStubFirstDraftCellClaim({ outputDir, cellId: 'hard', pid: 102 }),
      /active or crash-preserved development claim/u,
    );
    releaseTutorStubFirstDraftCellClaim(first.claimPath);
    const replacement = acquireTutorStubFirstDraftCellClaim({ outputDir, cellId: 'hard', pid: 103 });
    assert.equal(JSON.parse(fs.readFileSync(replacement.claimPath, 'utf8')).pid, 103);
    releaseTutorStubFirstDraftCellClaim(replacement.claimPath);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('interrupted cells distinguish partial consumption from zero-output indeterminacy', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-interrupted-cell-'));
  try {
    const cell = {
      id: 'hard',
      world: 'world_hard',
      learnerProfile: 'answer_seeking',
      seed: 20261600,
      turns: [5],
    };
    const reportPath = path.join(tmp, 'turn-5.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify({
        schema: 'machinespirits.tutor-stub.frozen-replay.v1',
        drawsPerTurn: 4,
        admissionState: { status: 'in_progress', completedDraws: 2, unstartedDraws: 2 },
        results: [
          { turn: 5, draw: 1 },
          { turn: 5, draw: 2 },
        ],
      }),
    );
    const partial = tutorStubFirstDraftInterruptedCellResult({
      cell,
      reportPath,
      error: new Error('transport interrupted'),
    });
    assert.equal(partial.seedDisposition, 'consumed_development_incomplete');
    assert.equal(partial.completedTurns, 2);
    assert.deepEqual(partial.unstartedDraws, ['5:3', '5:4']);
    assert.equal(partial.partialCheckpoint.completedDraws, 2);

    fs.writeFileSync(
      reportPath,
      JSON.stringify({
        schema: 'machinespirits.tutor-stub.frozen-replay.v1',
        drawsPerTurn: 4,
        admissionState: { status: 'in_progress', completedDraws: 0, unstartedDraws: 4 },
        results: [],
      }),
    );
    const empty = tutorStubFirstDraftInterruptedCellResult({
      cell,
      reportPath,
      error: new Error('transport interrupted'),
    });
    assert.equal(empty.seedDisposition, 'indeterminate_zero_output_claim_preserved');
    assert.equal(empty.completedTurns, 0);
    assert.deepEqual(empty.unstartedDraws, ['5:1', '5:2', '5:3', '5:4']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('four-draw confirmation requires the exact unique turn and draw inventory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-draw-inventory-'));
  try {
    const config = confirmationConfig(tmp);
    const cell = config.matrix[0];
    const report = (draws) => ({
      results: draws.map(({ turn = 5, draw }) => ({
        turn,
        draw,
        latencyMs: 10,
        usage: {
          inputTokens: 100,
          cachedInputTokens: 25,
          uncachedInputTokens: 75,
          outputTokens: 10,
          reasoningOutputTokens: 2,
          totalTokens: 110,
        },
        tokenUsageAvailable: true,
        audit: {
          ok: true,
          safetyFailure: false,
          failureClusters: [],
          audits: {
            responseCompositionAudit: { ok: true },
            actorialRealizationAudit: { ok: true },
            responseConfigurationAudit: { realization_rate: 1 },
            jointPerformanceAudit: { ok: true },
          },
        },
      })),
    });
    const complete = summarizeTutorStubWorkingScreen({
      cell,
      reports: [report([1, 2, 3, 4].map((draw) => ({ draw })))],
      config,
    });
    assert.equal(complete.drawInventory.ok, true);
    assert.equal(complete.gates.drawInventory, true);
    assert.equal(complete.tokenUsageAvailable, true);
    assert.deepEqual(complete.tokenUsage, {
      inputTokens: 400,
      cachedInputTokens: 100,
      uncachedInputTokens: 300,
      outputTokens: 40,
      reasoningOutputTokens: 8,
      totalTokens: 440,
    });

    const partialUsageReport = report([1, 2, 3, 4].map((draw) => ({ draw })));
    partialUsageReport.results[1].usage.cachedInputTokens = null;
    partialUsageReport.results[1].usage.uncachedInputTokens = null;
    partialUsageReport.results[1].usage.reasoningOutputTokens = null;
    const partialUsage = summarizeTutorStubWorkingScreen({
      cell,
      reports: [partialUsageReport],
      config,
    });
    assert.equal(partialUsage.tokenUsageAvailable, true);
    assert.equal(partialUsage.tokenUsage.cachedInputTokens, null);
    assert.equal(partialUsage.tokenUsage.uncachedInputTokens, null);
    assert.equal(partialUsage.tokenUsage.reasoningOutputTokens, null);
    assert.equal(partialUsage.tokenUsage.totalTokens, 440);

    const duplicate = summarizeTutorStubWorkingScreen({
      cell,
      reports: [report([1, 1, 3, 4].map((draw) => ({ draw })))],
      config,
    });
    assert.deepEqual(duplicate.drawInventory.duplicateKeys, ['5:1']);
    assert.deepEqual(duplicate.drawInventory.missingKeys, ['5:2']);
    assert.equal(duplicate.gates.drawInventory, false);
    assert.equal(duplicate.status, 'fail');

    const wrongTurn = summarizeTutorStubWorkingScreen({
      cell,
      reports: [report([1, 2, 3].map((draw) => ({ draw })).concat({ turn: 6, draw: 4 }))],
      config,
    });
    assert.deepEqual(wrongTurn.drawInventory.missingKeys, ['5:4']);
    assert.deepEqual(wrongTurn.drawInventory.unexpectedKeys, ['6:4']);
    assert.equal(wrongTurn.status, 'fail');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'V7 draw inventory binds every row and report to the exact frozen target',
  V_SERIES_REPO_SOURCE_FIXTURE_OPTS,
  () => {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const configPath = path.join(repoRoot, 'config/tutor-stub-campaigns/first-draft-working-screens-v7.yaml');
    const loaded = loadTutorStubFirstDraftCampaign(configPath, { root: repoRoot });
    const plan = expandTutorStubFirstDraftCampaign({ config: loaded.config, root: repoRoot, iteration: 8 });
    const cell = plan.cells[0];
    const report = {
      sourceTrace: cell.sourceTrace,
      results: [1, 2, 3, 4].map((draw) => ({
        turn: 5,
        turnId: '2026-07-16T07-03-36-147Z:t005',
        draw,
        worldId: 'world_025_tallow_street',
        learnerProfile: 'answer_seeking',
        developmentSeed: '20261600',
        latencyMs: 10,
        audit: {
          ok: true,
          safetyFailure: false,
          failureClusters: [],
          audits: {
            responseCompositionAudit: { ok: true },
            actorialRealizationAudit: { ok: true },
            responseConfigurationAudit: { realization_rate: 1 },
          },
        },
      })),
    };
    const bound = summarizeTutorStubWorkingScreen({ cell, reports: [report], config: loaded.config });
    assert.equal(bound.drawInventory.ok, true);
    const drift = structuredClone(report);
    drift.results[2].learnerProfile = 'diligent';
    const rejected = summarizeTutorStubWorkingScreen({ cell, reports: [drift], config: loaded.config });
    assert.deepEqual(rejected.drawInventory.bindingFailures, ['5:3:learner_profile']);
    assert.equal(rejected.drawInventory.ok, false);
  },
);

test(
  'V8 expands the structural working panel hard-cell first with fresh development labels',
  V_SERIES_REPO_SOURCE_FIXTURE_OPTS,
  () => {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const configPath = path.join(repoRoot, 'config/tutor-stub-campaigns/first-draft-working-screens-v8.yaml');
    const loaded = loadTutorStubFirstDraftCampaign(configPath, { root: repoRoot });
    const plan = expandTutorStubFirstDraftCampaign({ config: loaded.config, root: repoRoot, iteration: 1 });
    assert.equal(plan.maxConcurrency, 3);
    assert.equal(plan.preflightReady, false);
    assert.equal(plan.preflightBlockers.length, 1);
    assert.equal(plan.preflightBlockers[0].type, 'source_surface_accessibility');
    assert.equal(plan.preflightBlockers[0].cellId, 'ravensmark_affective_resistant');
    assert.equal(plan.preflightBlockers[0].sources[0].sentenceCount, 1);
    assert.equal(plan.preflightBlockers[0].sources[0].averageSentenceWords, 36);
    assert.equal(plan.preflightBlockers[0].sources[0].audienceMaximum, 23);
    assert.equal(plan.preflightBlockers[0].sources[0].lexicalMaximum, 23);
    assert.deepEqual(
      plan.cells.map((cell) => ({
        id: cell.id,
        priority: cell.priority,
        seed: cell.seed,
        turns: cell.turns,
      })),
      [
        { id: 'tallow_answer_seeking', priority: 1, seed: 20261800, turns: [5] },
        { id: 'ravensmark_affective_resistant', priority: 2, seed: 20261801, turns: [5] },
        { id: 'larkspur_premature_closure', priority: 3, seed: 20261802, turns: [2] },
        { id: 'foxtrot_diligent', priority: 4, seed: 20261803, turns: [4] },
      ],
    );
    for (const cell of plan.cells) {
      assert.equal(cell.commands.length, 1);
      const argv = cell.commands[0].argv;
      assert.equal(argv.includes('--original-only'), true);
      assert.equal(argv.includes('--joint-performance-generation'), true);
      assert.equal(argv.includes('--semantic-adjudication'), false);
      assert.equal(argv.includes('--stop-on-first-rejection'), true);
      assert.equal(argv[argv.indexOf('--draws') + 1], '4');
      assert.equal(argv[argv.indexOf('--concurrency') + 1], '1');
      assert.deepEqual(
        cell.structural_targets,
        loaded.config.matrix.find((entry) => entry.id === cell.id).structural_targets,
      );
      assert.deepEqual(
        cell.structural_activation,
        loaded.config.matrix.find((entry) => entry.id === cell.id).structural_activation,
      );
    }
    assert.equal(loaded.config.fixed_configuration.adjudication_policy, 'deterministic_only');
    assert.equal(loaded.config.gates_per_cell.require_deterministic_only_audit, true);
    assert.equal(loaded.config.gates_per_cell.maximum_semantic_adjudicator_calls, 0);
    assert.equal(loaded.config.execution.require_clean_worktree, true);
    assert.deepEqual(
      loaded.config.matrix.map((cell) => ({
        id: cell.id,
        targets: cell.structural_targets,
        sourceModes: cell.structural_activation?.deterministic_host_source_renderer?.expected_modes || [],
      })),
      [
        {
          id: 'tallow_answer_seeking',
          targets: [
            'handoff_contract_and_cross_slot_progression',
            'typed_turn_focus_relation',
            'shared_writable_request_classifier',
          ],
          sourceModes: [],
        },
        {
          id: 'ravensmark_affective_resistant',
          targets: ['deterministic_host_source_renderer', 'typed_turn_focus_relation'],
          sourceModes: ['presented_exhibit'],
        },
        {
          id: 'larkspur_premature_closure',
          targets: [
            'deterministic_host_source_renderer',
            'typed_due_source_action_referent',
            'handoff_contract_and_cross_slot_progression',
            'typed_turn_focus_relation',
          ],
          sourceModes: ['enacted_role'],
        },
        {
          id: 'foxtrot_diligent',
          targets: [
            'deterministic_host_source_renderer',
            'handoff_contract_and_cross_slot_progression',
            'typed_turn_focus_relation',
          ],
          sourceModes: ['presented_exhibit'],
        },
      ],
    );
  },
);

test(
  'V8 reports a valid predeclaration separately from its failed deterministic preflight',
  V_SERIES_REPO_SOURCE_FIXTURE_OPTS,
  () => {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const configPath = path.join(repoRoot, 'config/tutor-stub-campaigns/first-draft-working-screens-v8.yaml');
    const loaded = loadTutorStubFirstDraftCampaign(configPath, { root: repoRoot });
    const plan = expandTutorStubFirstDraftCampaign({
      config: loaded.config,
      root: repoRoot,
      iteration: 1,
    });
    const frozen = {
      gitHead: 'committed-head',
      configPath,
      configSha256: 'config-hash',
      cleanWorktreeRequired: true,
      worktreeClean: true,
      worktree: { required: true, checked: true, clean: true, status: 'clean', changeCount: 0 },
    };
    const validation = buildTutorStubFirstDraftCampaignValidationReport({
      plan,
      config: loaded.config,
      configPath,
      frozen,
    });
    assert.equal(validation.valid, true);
    assert.equal(validation.preflightReady, false);
    assert.equal(validation.preflightBlockers.length, 1);
    assert.equal(validation.preflightBlockers[0].cellId, 'ravensmark_affective_resistant');
    assert.deepEqual(validation.frozen, frozen);
    assert.equal(validation.cells[0].targetBundle.request_model, 'gpt-5.6-terra');
    assert.equal(validation.cells[0].targetBundle.request_effort, 'low');
    assert.match(validation.cells[0].outputDir, /first-draft-working-screens-v8\/iteration-1/u);

    const result = buildTutorStubFirstDraftPreflightFailureResult({
      plan,
      config: loaded.config,
      configPath,
      iteration: 1,
      frozen,
      validationArtifactPath: path.join(plan.iterationRoot, 'campaign-validation.json'),
    });
    assert.equal(result.heldOut, false);
    assert.equal(result.iteration, 1);
    assert.equal(result.workingIteration, 1);
    assert.equal(result.modelCalls, 0);
    assert.equal(result.candidates, 0);
    assert.equal(result.completedCandidates, 0);
    assert.equal(result.commandFailure, null);
    assert.deepEqual(result.seedInventory.retired, []);
    assert.equal(result.seedInventory.unconsumed.length, 4);
    assert.equal(result.frozen.worktreeClean, true);
    assert.equal(result.cells.length, 4);
    for (const cell of result.cells) {
      assert.equal(cell.seedDisposition, 'unconsumed_development_preflight_failure');
      assert.equal(cell.completedTurns, 0);
      assert.deepEqual(cell.unstartedTurns, cell.turns);
      assert.ok(cell.sourceTraceSha256);
      assert.ok(cell.outputDir);
      assert.equal(cell.commands.length, 1);
      assert.equal(cell.commands[0].argv.includes('--original-only'), true);
      assert.equal(cell.requestModel, 'gpt-5.6-terra');
      assert.equal(cell.requestEffort, 'low');
      assert.deepEqual(
        cell.structuralTargets,
        loaded.config.matrix.find((entry) => entry.id === cell.id).structural_targets,
      );
    }

    const retired = buildTutorStubFirstDraftPreflightFailureResult({
      plan,
      config: {
        ...loaded.config,
        execution: {
          ...loaded.config.execution,
          preserve_unstarted_seeds_as_unconsumed: false,
        },
      },
      configPath,
      iteration: 1,
      frozen,
    });
    assert.deepEqual(retired.seedInventory.unconsumed, []);
    assert.equal(retired.seedInventory.retired.length, 4);
    assert.ok(retired.cells.every((cell) => cell.seedDisposition === 'retired_development_preflight_failure'));
  },
);

test(
  'deterministic preflight command failures preserve validation, exact failure, and zero-call seed state',
  V_SERIES_REPO_SOURCE_FIXTURE_OPTS,
  () => {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const sourceConfigPath = path.join(repoRoot, 'config/tutor-stub-campaigns/first-draft-working-screens-v9.yaml');
    const sourceConfig = loadTutorStubFirstDraftCampaign(sourceConfigPath, { root: repoRoot }).config;
    const cases = [
      {
        kind: 'world_quality',
        exitCode: 7,
        configure(preflight) {
          preflight.world_quality = `${process.execPath} -e 'process.exit(7)'`;
          preflight.focused_tests = 'true';
        },
      },
      {
        kind: 'focused_tests',
        exitCode: 8,
        configure(preflight) {
          preflight.world_quality = 'true';
          preflight.focused_tests = `${process.execPath} -e 'process.exit(8)'`;
        },
      },
      {
        kind: 'model_free_fixture',
        exitCode: 1,
        configure(preflight, root) {
          const invalidFixture = path.join(root, 'invalid-fixture.json');
          fs.writeFileSync(invalidFixture, '{ invalid json\n');
          preflight.world_quality = 'true';
          preflight.focused_tests = 'true';
          preflight.model_free_fixtures = [invalidFixture];
        },
      },
    ];

    for (const testCase of cases) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), `first-draft-preflight-${testCase.kind}-`));
      try {
        const binDir = path.join(root, 'bin');
        const artifactRoot = path.join(root, 'artifacts');
        const configPath = path.join(root, 'campaign.yaml');
        fs.mkdirSync(binDir, { recursive: true });
        const fakeGit = path.join(binDir, 'git');
        fs.writeFileSync(
          fakeGit,
          '#!/bin/sh\nif [ "$1" = "rev-parse" ]; then echo test-head; exit 0; fi\nif [ "$1" = "status" ]; then exit 0; fi\nexit 2\n',
        );
        fs.chmodSync(fakeGit, 0o755);

        const config = structuredClone(sourceConfig);
        config.artifacts.root = artifactRoot;
        testCase.configure(config.preflight, root);
        fs.writeFileSync(configPath, YAML.stringify(config));

        const execution = spawnSync(
          process.execPath,
          [
            'scripts/run-tutor-stub-first-draft-campaign.js',
            '--config',
            configPath,
            '--mode',
            'development',
            '--iteration',
            '1',
          ],
          {
            cwd: repoRoot,
            encoding: 'utf8',
            env: {
              ...process.env,
              PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
              TUTOR_STUB_PREFLIGHT_CERTIFICATE_DIR: path.join(root, 'certificates'),
            },
          },
        );

        assert.equal(execution.status, 1, `${testCase.kind}: ${execution.stderr}`);
        assert.match(execution.stderr, new RegExp(`exited with status ${testCase.exitCode}`, 'u'));
        const iterationRoot = path.join(artifactRoot, 'iteration-1');
        const validationPath = path.join(iterationRoot, 'campaign-validation.json');
        const resultPath = path.join(iterationRoot, 'working-screen-result.json');
        const preflightExecutionPath = path.join(iterationRoot, 'preflight-execution.json');
        assert.equal(fs.existsSync(validationPath), true);
        assert.equal(fs.existsSync(resultPath), true);
        assert.equal(fs.existsSync(preflightExecutionPath), true);
        const validation = JSON.parse(fs.readFileSync(validationPath, 'utf8'));
        assert.equal(validation.valid, true);
        assert.equal(validation.preflightReady, true);
        assert.equal(validation.makesModelCalls, false);
        const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        assert.equal(result.status, 'preflight_failed');
        assert.equal(result.commandFailure.kind, testCase.kind);
        assert.equal(result.commandFailure.exitCode, testCase.exitCode);
        assert.equal(
          result.commandFailure.label,
          `tallow_answer_seeking ${
            testCase.kind === 'world_quality'
              ? 'world quality'
              : testCase.kind === 'focused_tests'
                ? 'focused tests'
                : 'model-free fixture'
          }`,
        );
        assert.equal(
          result.commandFailure.command,
          result.commandFailure.argv.map((part) => JSON.stringify(part)).join(' '),
        );
        assert.equal(result.commandFailure.reason, `exited with status ${testCase.exitCode}`);
        assert.equal(result.commandFailure.signal, null);
        assert.equal(result.commandFailure.spawnErrorCode, null);
        assert.equal(result.preflightExecutionArtifactPath, preflightExecutionPath);
        assert.equal(result.commandFailure.preflightExecutionArtifactPath, preflightExecutionPath);
        assert.deepEqual(
          result.commandFailure.argv.slice(0, 2),
          testCase.kind === 'model_free_fixture'
            ? [process.execPath, 'scripts/replay-tutor-stub-frozen-turns.js']
            : ['/bin/sh', '-lc'],
        );
        assert.equal(result.makesModelCalls, false);
        assert.equal(result.modelCalls, 0);
        assert.equal(result.candidates, 0);
        assert.equal(result.completedCandidates, 0);
        assert.equal(result.completedTurns, 0);
        assert.deepEqual(result.seedInventory.retired, []);
        assert.equal(result.seedInventory.unconsumed.length, result.cells.length);
        assert.ok(result.cells.every((cell) => cell.seedDisposition === 'unconsumed_development_preflight_failure'));
        assert.ok(result.cells.every((cell) => cell.completedCandidates === 0));
        const preflightExecution = JSON.parse(fs.readFileSync(preflightExecutionPath, 'utf8'));
        assert.equal(preflightExecution.status, 'fail');
        assert.equal(preflightExecution.executionPolicy.attemptsPerCommand, 1);
        assert.equal(preflightExecution.executionPolicy.retryPolicy, 'none');
        assert.equal(preflightExecution.makesModelCalls, false);
        assert.equal(preflightExecution.modelCalls, 0);
        assert.equal(
          preflightExecution.commands.length,
          testCase.kind === 'world_quality' ? 1 : testCase.kind === 'focused_tests' ? 2 : 3,
        );
        const failedExecution = preflightExecution.commands.at(-1);
        assert.equal(failedExecution.status, 'fail');
        assert.equal(failedExecution.attempt, 1);
        assert.equal(failedExecution.retryPolicy, 'none');
        assert.equal(failedExecution.exitCode, testCase.exitCode);
        for (const streamName of ['stdout', 'stderr']) {
          const artifact = failedExecution[streamName];
          const bytes = fs.readFileSync(artifact.path);
          assert.equal(artifact.bytes, bytes.byteLength);
          assert.equal(artifact.sha256, createHash('sha256').update(bytes).digest('hex'));
        }
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  },
);

test(
  'structured focused suite failure is captured once and blocks every model call',
  V_SERIES_REPO_SOURCE_FIXTURE_OPTS,
  () => {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-structured-preflight-'));
    const testFile = path.join(
      repoRoot,
      'tests',
      'fixtures',
      'tutor-stub-first-draft',
      'captured-deterministic-failure.test.js',
    );
    try {
      const relativeTestFile = path.relative(repoRoot, testFile);
      const binDir = path.join(root, 'bin');
      const artifactRoot = path.join(root, 'artifacts');
      const configPath = path.join(root, 'campaign.yaml');
      fs.mkdirSync(binDir, { recursive: true });
      const fakeGit = path.join(binDir, 'git');
      fs.writeFileSync(
        fakeGit,
        '#!/bin/sh\nif [ "$1" = "rev-parse" ]; then echo test-head; exit 0; fi\nif [ "$1" = "status" ]; then exit 0; fi\nexit 2\n',
      );
      fs.chmodSync(fakeGit, 0o755);
      const sourceConfigPath = path.join(repoRoot, 'config/tutor-stub-campaigns/first-draft-working-screens-v9.yaml');
      const config = structuredClone(loadTutorStubFirstDraftCampaign(sourceConfigPath, { root: repoRoot }).config);
      config.artifacts.root = artifactRoot;
      config.preflight.world_quality = 'true';
      config.preflight.focused_tests = `node --test ${relativeTestFile}`;
      config.preflight.focused_test_suites = [{ id: 'failure_capture', test_files: [relativeTestFile] }];
      config.preflight.model_free_fixtures = [];
      fs.writeFileSync(configPath, YAML.stringify(config));

      const childEnv = {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
        TUTOR_STUB_PREFLIGHT_CERTIFICATE_DIR: path.join(root, 'certificates'),
      };
      delete childEnv.NODE_TEST_CONTEXT;
      const execution = spawnSync(
        process.execPath,
        [
          'scripts/run-tutor-stub-first-draft-campaign.js',
          '--config',
          configPath,
          '--mode',
          'development',
          '--iteration',
          '1',
        ],
        {
          cwd: repoRoot,
          encoding: 'utf8',
          env: childEnv,
        },
      );

      assert.equal(execution.status, 1, execution.stderr);
      assert.match(`${execution.stdout}\n${execution.stderr}`, /captured deterministic failure sentinel/u);
      const iterationRoot = path.join(artifactRoot, 'iteration-1');
      const reportPath = path.join(iterationRoot, 'preflight-execution.json');
      const resultPath = path.join(iterationRoot, 'working-screen-result.json');
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      assert.equal(report.status, 'fail');
      assert.equal(report.modelCalls, 0);
      assert.equal(report.testInventory.suiteCount, 1);
      assert.equal(report.testInventory.fileCount, 1);
      assert.deepEqual(report.testInventory.suites, [{ id: 'failure_capture', testFiles: [relativeTestFile] }]);
      assert.equal(report.commands.length, 2);
      const suiteExecution = report.commands[1];
      assert.equal(suiteExecution.kind, 'focused_test_suite');
      assert.equal(suiteExecution.suiteId, 'failure_capture');
      assert.equal(suiteExecution.attempt, 1);
      assert.equal(suiteExecution.retryPolicy, 'none');
      assert.deepEqual(suiteExecution.argv.slice(0, 4), [
        process.execPath,
        '--test',
        '--test-concurrency=1',
        '--test-reporter=tap',
      ]);
      assert.equal(suiteExecution.tap.tests, 1);
      assert.equal(suiteExecution.tap.pass, 0);
      assert.equal(suiteExecution.tap.fail, 1);
      assert.ok(suiteExecution.tap.failureNames.includes('captured deterministic failure sentinel'));
      assert.equal(result.status, 'preflight_failed');
      assert.equal(result.modelCalls, 0);
      assert.equal(result.candidates, 0);
      assert.equal(result.commandFailure.kind, 'focused_test_suite');
      assert.equal(result.preflightExecutionArtifactPath, reportPath);
      assert.ok(result.cells.every((cell) => cell.completedCandidates === 0));
      assert.ok(result.cells.every((cell) => cell.seedDisposition === 'unconsumed_development_preflight_failure'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);

test('zero-test TAP is a failed captured suite and cannot unlock a replay', V_SERIES_REPO_SOURCE_FIXTURE_OPTS, () => {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-zero-tap-'));
  try {
    const binDir = path.join(root, 'bin');
    const artifactRoot = path.join(root, 'artifacts');
    const configPath = path.join(root, 'campaign.yaml');
    const invalidFixture = path.join(root, 'invalid-fixture.json');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(invalidFixture, '{ invalid json\n');
    const fakeGit = path.join(binDir, 'git');
    fs.writeFileSync(
      fakeGit,
      '#!/bin/sh\nif [ "$1" = "rev-parse" ]; then echo test-head; exit 0; fi\nif [ "$1" = "status" ]; then exit 0; fi\nexit 2\n',
    );
    fs.chmodSync(fakeGit, 0o755);
    const sourceConfigPath = path.join(repoRoot, 'config/tutor-stub-campaigns/first-draft-working-screens-v9.yaml');
    const config = structuredClone(loadTutorStubFirstDraftCampaign(sourceConfigPath, { root: repoRoot }).config);
    config.artifacts.root = artifactRoot;
    config.preflight.world_quality = 'true';
    config.preflight.focused_tests = 'node --test tests/processUtils.test.js';
    config.preflight.focused_test_suites = [{ id: 'zero_tap', test_files: ['tests/processUtils.test.js'] }];
    // This is a safety barrier for the test itself: even if Node changes its
    // recursive-test behavior, the campaign still stops before a replay.
    config.preflight.model_free_fixtures = [invalidFixture];
    fs.writeFileSync(configPath, YAML.stringify(config));

    const execution = spawnSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-first-draft-campaign.js',
        '--config',
        configPath,
        '--mode',
        'development',
        '--iteration',
        '1',
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
          NODE_TEST_CONTEXT: process.env.NODE_TEST_CONTEXT || 'child-v8',
          TUTOR_STUB_PREFLIGHT_CERTIFICATE_DIR: path.join(root, 'certificates'),
        },
      },
    );

    assert.equal(execution.status, 1, execution.stderr);
    assert.doesNotMatch(execution.stdout, /frozen turn/u);
    const iterationRoot = path.join(artifactRoot, 'iteration-1');
    const reportPath = path.join(iterationRoot, 'preflight-execution.json');
    const resultPath = path.join(iterationRoot, 'working-screen-result.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    assert.equal(report.status, 'fail');
    assert.equal(report.modelCalls, 0);
    assert.equal(report.commands.length, 2);
    const suiteExecution = report.commands[1];
    assert.equal(suiteExecution.kind, 'focused_test_suite');
    assert.equal(suiteExecution.exitCode, 0);
    assert.equal(suiteExecution.status, 'fail');
    assert.equal(suiteExecution.failureKind, 'tap_validation');
    assert.equal(suiteExecution.failureReason, 'TAP reported zero tests');
    assert.equal(suiteExecution.tap.tests, null);
    assert.equal(report.failedCommand.failureKind, 'tap_validation');
    assert.equal(report.failedCommand.reason, 'TAP reported zero tests');
    assert.equal(result.commandFailure.kind, 'focused_test_suite');
    assert.equal(result.commandFailure.reason, 'TAP reported zero tests');
    assert.equal(result.commandFailure.execution.status, 'fail');
    assert.equal(result.modelCalls, 0);
    assert.equal(result.candidates, 0);
    assert.ok(result.cells.every((cell) => cell.completedCandidates === 0));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test(
  'V9 preflight makes the dense Ravensmark source effectively accessible without changing direct controls',
  V_SERIES_REPO_SOURCE_FIXTURE_OPTS,
  () => {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const configPath = path.join(repoRoot, 'config/tutor-stub-campaigns/first-draft-working-screens-v9.yaml');
    const loaded = loadTutorStubFirstDraftCampaign(configPath, { root: repoRoot });
    const plan = expandTutorStubFirstDraftCampaign({
      config: loaded.config,
      root: repoRoot,
      iteration: 1,
    });

    assert.equal(plan.valid, true);
    assert.equal(plan.preflightReady, true);
    assert.deepEqual(plan.preflightBlockers, []);
    const ravensmark = plan.structuralPreflight.find((entry) => entry.cellId === 'ravensmark_affective_resistant');
    assert.equal(ravensmark.directAccessible, false);
    assert.equal(ravensmark.compensationRequired, true);
    assert.equal(ravensmark.compensationContractReady, true);
    assert.equal(ravensmark.compensationVisible, null);
    assert.equal(ravensmark.effectiveMode, 'compensated');
    assert.equal(ravensmark.owner, 'performance_response');
    assert.equal(ravensmark.ok, true);
    for (const id of ['larkspur_premature_closure', 'foxtrot_diligent']) {
      const direct = plan.structuralPreflight.find((entry) => entry.cellId === id);
      assert.equal(direct.directAccessible, true);
      assert.equal(direct.compensationRequired, false);
      assert.equal(direct.compensationContractReady, false);
      assert.equal(direct.compensationVisible, null);
      assert.equal(direct.effectiveMode, 'direct');
      assert.equal(direct.ok, true);
    }
    for (const cell of plan.cells) {
      assert.deepEqual(
        cell.commands[0].argv.slice(
          cell.commands[0].argv.indexOf('--source-accessibility-policy'),
          cell.commands[0].argv.indexOf('--source-accessibility-policy') + 2,
        ),
        ['--source-accessibility-policy', 'direct_or_compensated_v1'],
      );
    }

    const schemaDrift = structuredClone(loaded.config);
    schemaDrift.fixed_configuration.source_accessibility_schema =
      'machinespirits.tutor-stub.source-accessibility-contract.v0';
    assert.throws(
      () =>
        expandTutorStubFirstDraftCampaign({
          config: schemaDrift,
          root: repoRoot,
          iteration: 1,
        }),
      /source accessibility schema does not match the runtime contract/u,
    );
  },
);

test('source accessibility readiness requires the exact expected source inventory', () => {
  assert.equal(tutorStubSourceSurfaceAccessibilityReady([], 1), false);
  assert.equal(tutorStubSourceSurfaceAccessibilityReady([{ ok: true }], 2), false);
  assert.equal(tutorStubSourceSurfaceAccessibilityReady([{ ok: false }], 1), false);
  assert.equal(tutorStubSourceSurfaceAccessibilityReady([{ ok: true }], 1), true);
});

test('campaign accessibility readiness accepts one ready compensation but fails closed on dense multi-source input', () => {
  const dense =
    'The private-seal register has one entry for the dusk-seal: Elian, night notary of the lower quay, drew it for curfew warrants and returned it chipped at the raven wing after the coffer left town.';
  const configuration = {
    audience_register: 'domain_apprentice',
    lexical_accessibility: 'standard',
    source_accessibility_owner: 'performance_response',
  };
  const one = compileTutorStubSourceAccessibilityContract({
    sources: [{ id: 'source_1', text: dense }],
    configuration,
    policy: 'direct_or_compensated_v1',
  });
  assert.equal(tutorStubSourceSurfaceAccessibilityReady(one.source_accessibility, 1, one), true);

  const multiple = compileTutorStubSourceAccessibilityContract({
    sources: [
      { id: 'source_1', text: dense },
      { id: 'source_2', text: `${dense} Again.` },
    ],
    configuration,
    policy: 'direct_or_compensated_v1',
  });
  assert.equal(multiple.effective_mode, 'blocked');
  assert.equal(tutorStubSourceSurfaceAccessibilityReady(multiple.source_accessibility, 2, multiple), false);
});

test('a required dirty worktree becomes a recorded zero-call preflight blocker', () => {
  const plan = {
    valid: true,
    preflightReady: true,
    preflightBlockers: [],
    cells: [],
  };
  const frozen = {
    cleanWorktreeRequired: true,
    worktreeClean: false,
    worktree: { required: true, checked: true, clean: false, status: 'dirty', changeCount: 2 },
  };
  const blocked = applyTutorStubFirstDraftDevelopmentRuntimePreflight({ plan, frozen });
  assert.equal(blocked.valid, true);
  assert.equal(blocked.preflightReady, false);
  assert.deepEqual(blocked.preflightBlockers, [
    {
      type: 'unclean_worktree',
      reason: 'development campaign requires a clean committed worktree',
      worktree: frozen.worktree,
    },
  ]);
});

test(
  'V8 validation fails closed if its clean-worktree requirement is removed',
  V_SERIES_REPO_SOURCE_FIXTURE_OPTS,
  () => {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const configPath = path.join(repoRoot, 'config/tutor-stub-campaigns/first-draft-working-screens-v8.yaml');
    const loaded = loadTutorStubFirstDraftCampaign(configPath, { root: repoRoot });
    const drift = structuredClone(loaded.config);
    drift.execution.require_clean_worktree = false;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: drift, root: repoRoot }),
      /must require a clean worktree/u,
    );
  },
);

test(
  'V8 activation preflight recompiles the legacy frozen request before checking typed contracts',
  V_SERIES_REPO_SOURCE_FIXTURE_OPTS,
  () => {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const configPath = path.join(repoRoot, 'config/tutor-stub-campaigns/first-draft-working-screens-v8.yaml');
    const config = loadTutorStubFirstDraftCampaign(configPath, { root: repoRoot }).config;
    const tallow = config.matrix.find((cell) => cell.id === 'tallow_answer_seeking');
    const extracted = loadTutorStubFirstDraftFrozenBundle({ root: repoRoot, cell: tallow, turn: 5 });
    const legacyRequest = extracted.request.messages.at(-1).content;
    assert.doesNotMatch(legacyRequest, /writable_entry|turn-progression-contract/iu);
    const world = loadWorld(path.join(repoRoot, 'config/drama-derivation/world-025-tallow-street.yaml'));
    const refreshed = refreshTutorStubFrozenFirstDraftRequest({ bundle: extracted, world });
    assert.equal(refreshed.firstDraftContract.progression.complete, true);
    assert.equal(refreshed.firstDraftContract.progression.learner_uptake.mode, 'writable_entry');
    assert.equal(refreshed.firstDraftContract.progression.handoff_contract.question_allowed, false);
    assert.match(refreshed.request.messages.at(-1).content, /Begin exactly “Write:”/iu);
  },
);

test('working summary gates declared structural activation and deterministic-only adjudication per draw', () => {
  const config = {
    fixed_configuration: { joint_performance_generation: true, adjudication_policy: 'deterministic_only' },
    gates_per_cell: {
      required_turns: 1,
      required_originals_accepted: 1,
      required_draws_per_prefix: 1,
      minimum_mean_configuration_realization: 1,
      maximum_safety_failures: 0,
      maximum_fallbacks: 0,
      maximum_semantic_adjudicator_calls: 0,
      maximum_semantic_adjudicator_errors: 0,
      require_source_surface_accessibility: true,
      require_structural_target_activation: true,
      require_deterministic_only_audit: true,
    },
  };
  const cell = {
    id: 'source-turn',
    world: 'world',
    learnerProfile: 'diligent',
    seed: 1,
    turns: [2],
    structural_targets: [
      'deterministic_host_source_renderer',
      'typed_due_source_action_referent',
      'handoff_contract_and_cross_slot_progression',
      'typed_turn_focus_relation',
    ],
    structural_activation: {
      deterministic_host_source_renderer: {
        required: true,
        expected_modes: ['enacted_role'],
        require_lexical_accessibility_axis: true,
      },
      typed_due_source_action_referent: { required: true },
      handoff_contract_and_cross_slot_progression: { required: true },
      typed_turn_focus_relation: { required: true },
    },
  };
  const source = { id: 'source_1', mode: 'enacted_role', surface: 'A public clue.', text: '“A public clue.”' };
  const directAccessibilityContract = compileTutorStubSourceAccessibilityContract({
    sources: [source],
    configuration: {
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      source_accessibility_owner: 'performance_response',
    },
    policy: 'direct_or_compensated_v1',
  });
  const directCandidate = 'Uptake. Performance. “A public clue.” Response. What changed?';
  const directSourceStart = directCandidate.indexOf(source.text);
  const directResponseText = 'Response.';
  const directResponseStart = directCandidate.indexOf(directResponseText);
  const directSourceSpan = {
    id: 'source_1',
    kind: 'source',
    owner: 'host',
    text: source.text,
    start: directSourceStart,
    end: directSourceStart + source.text.length,
  };
  const directResponseSpan = {
    id: 'performance_response',
    kind: 'host',
    owner: 'model',
    text: directResponseText,
    start: directResponseStart,
    end: directResponseStart + directResponseText.length,
  };
  const directAccessibilityAudit = auditTutorStubSourceAccessibilityCompensation({
    contract: directAccessibilityContract,
    text: directCandidate,
    owner: null,
    sourceSpan: directSourceSpan,
    compensationSpan: directResponseSpan,
  });
  const bundle = {
    turn: 2,
    selectedResponseConfiguration: {
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
    },
    frames: { dramaticRelease: { active: true, entries: [{ mode: 'enacted_role', surface: source.surface }] } },
    firstDraftContract: {
      evidence: { source_accessibility: directAccessibilityContract },
      progression: {
        complete: true,
        handoff_contract: { mode: 'question_on_due_source', required_target_terms: ['public', 'clue'] },
      },
    },
  };
  const result = {
    turn: 2,
    draw: 1,
    latencyMs: 10,
    semanticAdjudication: { called: false, adjudication: null, error: null },
    jointPerformanceGeneration: {
      ok: true,
      composition: {
        text: directCandidate,
        sourceCount: 1,
        sources: [source],
        spans: [directSourceSpan, directResponseSpan],
        sourceAccessibilityContract: directAccessibilityContract,
        sourceAccessibilityAudit: directAccessibilityAudit,
      },
    },
    audit: {
      ok: true,
      safetyFailure: false,
      failureClusters: [],
      audits: {
        actorialRealizationAudit: { ok: true },
        responseCompositionAudit: { ok: true },
        responseConfigurationAudit: {
          realization_rate: 1,
          axes: { lexical_accessibility: { selected: 'standard', visible: true } },
        },
        jointPerformanceAudit: {
          ok: true,
          axes: { source_action_alignment: { visible: true } },
          sourceActionAlignment: {
            active: true,
            ok: true,
            sources: [{ required: [{ kind: 'role_carrier', label: 'public log' }] }],
          },
        },
        sourceAccessibilityAudit: directAccessibilityAudit,
        turnProgressionAudit: {
          active: true,
          ok: true,
          learner_uptake: { mode: 'direct_response', visible: true },
          handoff: { target_coverage: { count: 2, coverage: 1 } },
        },
      },
    },
  };
  const passing = summarizeTutorStubWorkingScreen({
    cell,
    reports: [{ bundles: [bundle], results: [result] }],
    config,
  });
  assert.equal(passing.gates.structuralTargetActivation, true);
  assert.equal(passing.gates.deterministicOnlyAudit, true);
  assert.equal(passing.gates.sourceSurfaceAccessibility, true);
  assert.equal(passing.sourceSurfaceAccessibilities[0].candidateAuditRequired, true);
  assert.equal(passing.sourceSurfaceAccessibilities[0].candidateAuditPassed, true);
  assert.equal(passing.sourceSurfaceAccessibilities[0].sources[0].sentenceCount, 1);
  assert.equal(passing.sourceSurfaceAccessibilities[0].sources[0].averageSentenceWords, 3);
  assert.equal(passing.status, 'pass');
  const drift = structuredClone(result);
  drift.jointPerformanceGeneration.composition.sources[0].mode = 'presented_exhibit';
  drift.semanticAdjudication = { called: true, adjudication: { recognized: true }, error: null };
  const rejected = summarizeTutorStubWorkingScreen({
    cell,
    reports: [{ bundles: [bundle], results: [drift] }],
    config,
  });
  assert.equal(rejected.gates.structuralTargetActivation, false);
  assert.equal(rejected.gates.deterministicOnlyAudit, false);
  assert.equal(rejected.gates.semanticAdjudicatorCalls, false);
  assert.equal(rejected.status, 'fail');

  const denseSurface =
    'This authored public clue uses one deliberately overlong sentence with many extra ordinary words so its forced source span exceeds both selected readability budgets without help from the surrounding host prose.';
  const denseBundle = structuredClone(bundle);
  denseBundle.frames.dramaticRelease.entries[0].surface = denseSurface;
  const denseResult = structuredClone(result);
  denseResult.jointPerformanceGeneration.composition.text = `Uptake. ${denseSurface} What changed?`;
  denseResult.jointPerformanceGeneration.composition.sources[0].surface = denseSurface;
  denseResult.jointPerformanceGeneration.composition.sources[0].text = denseSurface;
  denseResult.jointPerformanceGeneration.composition.spans[0].text = denseSurface;
  const dense = summarizeTutorStubWorkingScreen({
    cell,
    reports: [{ bundles: [denseBundle], results: [denseResult] }],
    config,
  });
  assert.equal(dense.gates.sourceSurfaceAccessibility, false);
  assert.equal(dense.sourceSurfaceAccessibilityFailures, 1);
  assert.equal(dense.sourceSurfaceAccessibilities[0].sources[0].lexicalVisible, false);
  assert.equal(dense.status, 'fail');
});

test('working summary requires the generated compensation owner to clear the candidate audit', () => {
  const sourceText =
    "The private-seal register has one entry for the dusk-seal: Elian, night notary of the lower quay, drew it for curfew warrants and returned it chipped at the raven's wing the morning after the coffer left town.";
  const compensationText = 'Elian drew it for curfew warrants and returned it chipped after the coffer left town.';
  const configuration = {
    audience_register: 'domain_apprentice',
    lexical_accessibility: 'standard',
    source_accessibility_owner: 'performance_response',
  };
  const contract = compileTutorStubSourceAccessibilityContract({
    sources: [{ id: 'source_1', mode: 'presented_exhibit', text: sourceText }],
    configuration,
    policy: 'direct_or_compensated_v1',
  });
  const candidate = `I hear the delay. I open the register. ${sourceText} ${compensationText} Compare the chip next.`;
  const sourceStart = candidate.indexOf(sourceText);
  const compensationStart = candidate.indexOf(compensationText);
  const sourceSpan = {
    id: 'source_1',
    kind: 'source',
    owner: 'host',
    text: sourceText,
    start: sourceStart,
    end: sourceStart + sourceText.length,
  };
  const compensationSpan = {
    id: 'performance_response',
    kind: 'host',
    owner: 'model',
    text: compensationText,
    start: compensationStart,
    end: compensationStart + compensationText.length,
  };
  const accessibilityAudit = auditTutorStubSourceAccessibilityCompensation({
    contract,
    text: candidate,
    owner: 'performance_response',
    sourceSpan,
    compensationSpan,
  });
  assert.equal(accessibilityAudit.ok, true, accessibilityAudit.issues.join(', '));
  const bundle = {
    turn: 5,
    selectedResponseConfiguration: configuration,
    frames: {
      dramaticRelease: {
        active: true,
        entries: [{ mode: 'presented_exhibit', surface: sourceText }],
      },
    },
    firstDraftContract: {
      evidence: { source_accessibility: contract },
      progression: { complete: true, handoff_contract: { required_target_terms: [] } },
    },
  };
  const result = {
    turn: 5,
    draw: 1,
    latencyMs: 10,
    semanticAdjudication: { called: false, adjudication: null, error: null },
    jointPerformanceGeneration: {
      ok: true,
      composition: {
        text: candidate,
        sourceCount: 1,
        sources: [{ id: 'source_1', mode: 'presented_exhibit', text: sourceText }],
        spans: [sourceSpan, compensationSpan],
        sourceAccessibilityContract: contract,
        sourceAccessibilityAudit: accessibilityAudit,
      },
    },
    audit: {
      ok: true,
      safetyFailure: false,
      failureClusters: [],
      audits: {
        actorialRealizationAudit: { ok: true },
        responseCompositionAudit: { ok: true },
        responseConfigurationAudit: { realization_rate: 1 },
        sourceAccessibilityAudit: accessibilityAudit,
      },
    },
  };
  const config = {
    fixed_configuration: {
      joint_performance_generation: true,
      adjudication_policy: 'deterministic_only',
      source_accessibility_policy: 'direct_or_compensated_v1',
    },
    gates_per_cell: {
      required_turns: 1,
      required_originals_accepted: 1,
      required_draws_per_prefix: 1,
      minimum_mean_configuration_realization: 1,
      maximum_safety_failures: 0,
      maximum_fallbacks: 0,
      maximum_semantic_adjudicator_calls: 0,
      maximum_semantic_adjudicator_errors: 0,
      require_source_surface_accessibility: true,
      require_structural_target_activation: true,
      require_deterministic_only_audit: true,
    },
  };
  const cell = {
    id: 'compensated-source',
    world: 'world',
    learnerProfile: 'affective_resistant',
    seed: 1,
    turns: [5],
    structural_targets: ['source_accessibility_compensation'],
    structural_activation: {
      source_accessibility_compensation: {
        required: true,
        expected_effective_mode: 'compensated',
        expected_owner: 'performance_response',
      },
    },
  };
  const passing = summarizeTutorStubWorkingScreen({
    cell,
    reports: [{ bundles: [bundle], results: [result] }],
    config,
  });
  const metric = passing.sourceSurfaceAccessibilities[0];
  assert.equal(metric.directAccessible, false);
  assert.equal(metric.compensationRequired, true);
  assert.equal(metric.compensationContractReady, true);
  assert.equal(metric.compensationVisible, true);
  assert.equal(metric.effectiveMode, 'compensated');
  assert.equal(metric.candidateAuditPassed, true);
  assert.equal(passing.gates.sourceSurfaceAccessibility, true);
  assert.equal(passing.gates.structuralTargetActivation, true);
  assert.equal(passing.status, 'pass');

  const summarizeMutation = (mutated) =>
    summarizeTutorStubWorkingScreen({
      cell,
      reports: [{ bundles: [bundle], results: [mutated] }],
      config,
    });
  const hidden = structuredClone(result);
  hidden.audit.audits.sourceAccessibilityAudit.visible = false;
  hidden.audit.audits.sourceAccessibilityAudit.ok = false;
  const rejected = summarizeMutation(hidden);
  assert.equal(rejected.sourceSurfaceAccessibilities[0].compensationVisible, true);
  assert.equal(rejected.sourceSurfaceAccessibilities[0].rowRecordedAuditConsistent, false);
  assert.equal(rejected.sourceSurfaceAccessibilities[0].candidateAuditPassed, false);
  assert.equal(rejected.gates.sourceSurfaceAccessibility, false);
  assert.equal(rejected.gates.structuralTargetActivation, false);
  assert.equal(rejected.status, 'fail');

  const minimal = structuredClone(result);
  const minimalAudit = {
    schema: accessibilityAudit.schema,
    ok: true,
    visible: true,
    effective_mode: 'compensated',
    owner: 'performance_response',
  };
  minimal.audit.audits.sourceAccessibilityAudit = structuredClone(minimalAudit);
  minimal.jointPerformanceGeneration.composition.sourceAccessibilityAudit = structuredClone(minimalAudit);
  const minimalRejected = summarizeMutation(minimal);
  assert.equal(minimalRejected.sourceSurfaceAccessibilities[0].rowRecordedAuditSchemaValid, true);
  assert.equal(minimalRejected.sourceSurfaceAccessibilities[0].recordedAuditsConsistent, false);
  assert.equal(minimalRejected.gates.sourceSurfaceAccessibility, false);

  const stale = structuredClone(result);
  stale.audit.audits.sourceAccessibilityAudit.word_count = 1;
  stale.jointPerformanceGeneration.composition.sourceAccessibilityAudit.word_count = 1;
  const staleRejected = summarizeMutation(stale);
  assert.equal(staleRejected.sourceSurfaceAccessibilities[0].recordedAuditsConsistent, false);
  assert.equal(staleRejected.gates.sourceSurfaceAccessibility, false);

  const contractTamper = structuredClone(result);
  contractTamper.jointPerformanceGeneration.composition.sourceAccessibilityContract.compensation.max_words += 1;
  const contractRejected = summarizeMutation(contractTamper);
  assert.equal(contractRejected.sourceSurfaceAccessibilities[0].compositionContractConsistent, false);
  assert.equal(contractRejected.gates.sourceSurfaceAccessibility, false);

  const spanTamper = structuredClone(result);
  spanTamper.jointPerformanceGeneration.composition.spans[0].end -= 1;
  const spanRejected = summarizeMutation(spanTamper);
  assert.equal(spanRejected.sourceSurfaceAccessibilities[0].canonicalAuditSpans.ok, false);
  assert.equal(spanRejected.sourceSurfaceAccessibilities[0].candidateAuditPassed, false);
  assert.equal(spanRejected.gates.sourceSurfaceAccessibility, false);
});

test('working summary reports and hard-gates every declared intervention maximum', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-intervention-gates-'));
  try {
    const config = workingConfig(tmp);
    Object.assign(config.gates_per_cell, {
      maximum_mechanical_repairs: 0,
      maximum_model_rewrites: 0,
      maximum_semantic_recognition_corrections: 0,
      maximum_transport_normalizations: 0,
    });
    const reports = [2, 3, 7, 10].map((turn, index) => ({
      summary:
        index === 0
          ? {
              mechanicalRepairs: 1,
              modelRewrites: 1,
              deterministicFallbacks: 1,
              transportNormalizedOutputs: 1,
              transportNormalizationCount: 1,
            }
          : {},
      results: [
        {
          turn,
          draw: 1,
          latencyMs: 10,
          deterministicAudit: index === 0 ? { audits: { actorialRealizationAudit: { ok: false } } } : null,
          audit: {
            ok: true,
            safetyFailure: false,
            failureClusters: [],
            audits: {
              responseCompositionAudit: { ok: true },
              actorialRealizationAudit: { ok: true },
              responseConfigurationAudit: { realization_rate: 1 },
            },
          },
        },
      ],
    }));
    const summary = summarizeTutorStubWorkingScreen({ cell: config.matrix[0], reports, config });
    assert.equal(summary.mechanicalRepairs, 1);
    assert.equal(summary.modelRewrites, 1);
    assert.equal(summary.deterministicFallbacks, 1);
    assert.equal(summary.semanticRecognitionCorrections, 1);
    assert.equal(summary.transportNormalizationCount, 1);
    assert.equal(summary.gates.mechanicalRepairs, false);
    assert.equal(summary.gates.modelRewrites, false);
    assert.equal(summary.gates.fallbacks, false);
    assert.equal(summary.gates.semanticRecognitionCorrections, false);
    assert.equal(summary.gates.transportNormalizations, false);
    assert.equal(summary.status, 'fail');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('development confirmation rejects contaminated prefixes and orchestration drift', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-development-contamination-'));
  try {
    const contaminated = confirmationConfig(tmp);
    fs.appendFileSync(
      contaminated.matrix[0].source_trace,
      `${JSON.stringify({
        type: 'tutor_response_guard_accounting',
        turn: 4,
        accounting: { finalDelivery: { source: 'model_rewrite' } },
      })}\n`,
    );
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: contaminated, root: tmp }),
      /prior delivery turn inventory|prior non-original tutor delivery/u,
    );

    const excessive = confirmationConfig(tmp);
    excessive.execution.maximum_concurrent_remaining_cells = 4;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: excessive, root: tmp }),
      /remaining development concurrency/u,
    );

    const duplicateGuard = confirmationConfig(tmp);
    duplicateGuard.execution.forbid_duplicate_active_or_completed_cells = false;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: duplicateGuard, root: tmp }),
      /duplicate development cell guard/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

function acceptanceGateConfig(turns = 10) {
  return {
    fixed_configuration: { turns },
    strict_delivery_gates_per_cell: {
      final_delivery_audit_failures: 0,
      maximum_deterministic_fallback_turns: 1,
      error_count: 0,
      quarantine_count: 0,
      meta_performance_turns: 0,
      role_stage_direction_turns: 0,
      source_replacement_turns: 0,
      duplicate_clue_delivery_turns: 0,
      minimum_host_visibility_rate: 1,
      minimum_mean_configuration_realization: 0.9,
      minimum_distinct_host_parts: 2,
    },
    first_draft_gates: {
      minimum_accounted_turn_rate: 1,
      minimum_aggregate_original_candidate_acceptance_rate: 0.7,
      minimum_cell_original_candidate_acceptance_rate: 0.6,
      maximum_aggregate_model_rewrite_rate: 0.3,
      maximum_model_rewrite_turns_per_cell: 4,
      maximum_total_deterministic_fallback_turns: 2,
      require_all_four_cells: true,
    },
  };
}

test('development validation artifacts are immutable per iteration while dry validation remains at campaign root', () => {
  const artifactRoot = path.join('/tmp', 'first-draft-validation-path');
  assert.equal(
    tutorStubFirstDraftCampaignValidationArtifactPath({
      artifactRoot,
      mode: 'development',
      iteration: 2,
    }),
    path.join(artifactRoot, 'iteration-2', 'campaign-validation.json'),
  );
  assert.equal(
    tutorStubFirstDraftCampaignValidationArtifactPath({ artifactRoot, mode: 'validate', iteration: 2 }),
    path.join(artifactRoot, 'campaign-validation.json'),
  );
  assert.equal(
    tutorStubFirstDraftCampaignValidationArtifactPath({ artifactRoot, mode: 'acceptance', iteration: 2 }),
    path.join(artifactRoot, 'campaign-validation.json'),
  );
  assert.throws(
    () => tutorStubFirstDraftCampaignValidationArtifactPath({ artifactRoot, mode: 'development', iteration: 0 }),
    /working iteration must be an integer >= 1/u,
  );
  assert.throws(
    () => tutorStubFirstDraftCampaignValidationArtifactPath({ artifactRoot, mode: 'unknown', iteration: 1 }),
    /unsupported campaign mode/u,
  );
  assert.deepEqual(tutorStubFirstDraftUnexpectedIterationArtifacts(['campaign-validation.json']), []);
  assert.deepEqual(
    tutorStubFirstDraftUnexpectedIterationArtifacts([
      'campaign-validation.json',
      'marrick_v27_joint_performance',
      'working-screen-result.json',
    ]),
    ['marrick_v27_joint_performance', 'working-screen-result.json'],
  );
});

test('development validation and result artifacts refuse silent overwrite', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-immutable-artifacts-'));
  try {
    const iterationRoot = path.join(tmp, 'iteration-1');
    assert.deepEqual(assertTutorStubFirstDraftDevelopmentIterationVacant(iterationRoot), {
      vacant: true,
      existing: [],
    });
    const validationPath = path.join(iterationRoot, 'campaign-validation.json');
    const resultPath = path.join(iterationRoot, 'working-screen-result.json');
    writeTutorStubFirstDraftJsonExclusive(validationPath, { version: 1 });
    assert.throws(
      () => writeTutorStubFirstDraftJsonExclusive(validationPath, { version: 2 }),
      /refusing to overwrite existing campaign artifact/u,
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(validationPath, 'utf8')), { version: 1 });
    assert.throws(
      () => assertTutorStubFirstDraftDevelopmentIterationVacant(iterationRoot),
      /immutable artifacts.*campaign-validation\.json/iu,
    );

    writeTutorStubFirstDraftJsonExclusive(resultPath, { version: 1 });
    assert.throws(
      () => writeTutorStubFirstDraftJsonExclusive(resultPath, { version: 2 }),
      /refusing to overwrite existing campaign artifact/u,
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(resultPath, 'utf8')), { version: 1 });
    const archiveRoot = `${iterationRoot}-archived-zero-call`;
    fs.renameSync(iterationRoot, archiveRoot);
    assert.deepEqual(assertTutorStubFirstDraftDevelopmentIterationVacant(iterationRoot), {
      vacant: true,
      existing: [],
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(archiveRoot, 'campaign-validation.json'), 'utf8')), {
      version: 1,
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(archiveRoot, 'working-screen-result.json'), 'utf8')), {
      version: 1,
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('campaign validation expands one original-only command per frozen turn without model calls', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-campaign-'));
  try {
    const config = enableStructuredGeneration(workingConfig(tmp));
    const validation = validateTutorStubFirstDraftCampaign({ config, root: tmp });
    assert.equal(validation.kind, 'working_screen');
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 2 });
    assert.equal(plan.cells.length, 2);
    assert.deepEqual(
      plan.cells.map((cell) => cell.id),
      ['hard', 'next'],
    );
    assert.equal(plan.cells[0].commands.length, 4);
    for (const command of plan.cells.flatMap((cell) => cell.commands)) {
      assert.ok(command.argv.includes('--original-only'));
      assert.ok(command.argv.includes('--development-seed'));
      assert.ok(command.argv.includes('--semantic-adjudication'));
      assert.ok(command.argv.includes('--structured-generation'));
      assert.ok(command.argv.includes('--adjudicator-effort'));
      assert.ok(!command.argv.includes('--dry-run'));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('campaign validator fails closed when structured generation omits any structured gate', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-structured-gates-'));
  try {
    for (const gate of [
      'require_structured_output',
      'require_structured_slot_ownership',
      'require_exact_source_once',
    ]) {
      const missing = enableStructuredGeneration(workingConfig(tmp));
      delete missing.gates_per_cell[gate];
      assert.throws(
        () => validateTutorStubFirstDraftCampaign({ config: missing, root: tmp }),
        new RegExp(`gates_per_cell\\.${gate}: true`, 'u'),
      );

      const disabled = enableStructuredGeneration(workingConfig(tmp));
      disabled.gates_per_cell[gate] = false;
      assert.throws(
        () => validateTutorStubFirstDraftCampaign({ config: disabled, root: tmp }),
        new RegExp(`gates_per_cell\\.${gate}: true`, 'u'),
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('joint-performance campaign validation propagates only the explicit v2 replay flag', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-joint-performance-'));
  try {
    const config = enableJointPerformanceGeneration(workingConfig(tmp));
    config.gates_per_cell.maximum_transport_normalizations = 1;
    const validation = validateTutorStubFirstDraftCampaign({ config, root: tmp });
    assert.equal(validation.kind, 'working_screen');
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 1 });
    for (const command of plan.cells.flatMap((cell) => cell.commands)) {
      assert.ok(command.argv.includes('--joint-performance-generation'));
      assert.ok(!command.argv.includes('--structured-generation'));
      assert.ok(command.argv.includes('--original-only'));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('compact speaker campaign validation propagates the opt-in replay flag and schema', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-compact-speaker-'));
  try {
    const config = enableCompactSpeakerPrompt(workingConfig(tmp));
    config.gates_per_cell.maximum_transport_normalizations = 1;
    const validation = validateTutorStubFirstDraftCampaign({ config, root: tmp });
    assert.equal(validation.kind, 'working_screen');
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 1 });
    for (const command of plan.cells.flatMap((cell) => cell.commands)) {
      assert.ok(command.argv.includes('--joint-performance-generation'));
      assert.ok(command.argv.includes('--compact-speaker-prompt'));
      assert.ok(!command.argv.includes('--structured-generation'));
      assert.ok(command.argv.includes('--original-only'));
    }
    const report = buildTutorStubFirstDraftCampaignValidationReport({
      root: tmp,
      config,
      validation,
      plan,
    });
    assert.equal(report.generationMode, 'joint_performance_v2_compact_no_source');
    assert.equal(report.compactSpeakerPrompt, true);
    assert.equal(report.compactSpeakerPromptSchema, TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('development campaign propagates only the guarded non-equivalent Codex base override', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-codex-base-override-'));
  try {
    const instructions = path.join(tmp, 'config', 'tutor-stub-codex-speaker-instructions.md');
    fs.mkdirSync(path.dirname(instructions), { recursive: true });
    fs.writeFileSync(instructions, 'Speak only as the public tutor.\n');
    const config = enableCompactSpeakerPrompt(workingConfig(tmp));
    config.fixed_configuration.development_codex_instructions_file = 'config/tutor-stub-codex-speaker-instructions.md';
    config.gates_per_cell.maximum_transport_normalizations = 1;
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 1 });
    for (const command of plan.cells.flatMap((cell) => cell.commands)) {
      const index = command.argv.indexOf('--development-codex-instructions-file');
      assert.ok(index > -1);
      assert.equal(command.argv[index + 1], instructions);
    }
    const report = buildTutorStubFirstDraftCampaignValidationReport({ config, plan });
    assert.equal(report.speakerTransportMode, 'codex_cli_development_base_override_non_equivalent');
    assert.equal(report.developmentCodexInstructionsFile, 'config/tutor-stub-codex-speaker-instructions.md');

    config.fixed_configuration.development_codex_instructions_file = '../arbitrary.md';
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config, root: tmp }),
      /restricted to config\/tutor-stub-codex-speaker-instructions\.md/iu,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('compact speaker campaign validation fails closed on mode, schema, or gate drift', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-compact-speaker-gates-'));
  try {
    const withoutJoint = workingConfig(tmp);
    withoutJoint.fixed_configuration.compact_speaker_prompt = true;
    withoutJoint.fixed_configuration.compact_speaker_prompt_schema = TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA;
    withoutJoint.gates_per_cell.require_compact_speaker_prompt = true;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: withoutJoint, root: tmp }),
      /compact speaker prompt requires.*joint_performance_generation/iu,
    );

    const wrongSchema = enableCompactSpeakerPrompt(workingConfig(tmp));
    wrongSchema.fixed_configuration.compact_speaker_prompt_schema = 'drifted';
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: wrongSchema, root: tmp }),
      new RegExp(`compact working screen must declare.*${TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA}`, 'u'),
    );

    const missingGate = enableCompactSpeakerPrompt(workingConfig(tmp));
    delete missingGate.gates_per_cell.require_compact_speaker_prompt;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: missingGate, root: tmp }),
      /gates_per_cell\.require_compact_speaker_prompt: true/iu,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('joint-performance campaign validation fails closed on mode, schema, or gate drift', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-joint-performance-gates-'));
  try {
    const conflicting = enableJointPerformanceGeneration(enableStructuredGeneration(workingConfig(tmp)));
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: conflicting, root: tmp }),
      /generation modes are mutually exclusive/iu,
    );

    for (const field of [
      'joint_performance_schema',
      'joint_performance_composition_schema',
      'joint_performance_audit_schema',
    ]) {
      const config = enableJointPerformanceGeneration(workingConfig(tmp));
      delete config.fixed_configuration[field];
      assert.throws(
        () => validateTutorStubFirstDraftCampaign({ config, root: tmp }),
        new RegExp(`fixed_configuration\\.${field}`, 'u'),
      );
    }

    for (const gate of [
      'require_joint_performance_output',
      'require_joint_performance_ownership',
      'require_exact_host_source_occurrences',
    ]) {
      const config = enableJointPerformanceGeneration(workingConfig(tmp));
      delete config.gates_per_cell[gate];
      assert.throws(
        () => validateTutorStubFirstDraftCampaign({ config, root: tmp }),
        new RegExp(`gates_per_cell\\.${gate}: true`, 'u'),
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working summary enforces v2 joint output, ownership, and N host-owned SOURCE occurrences', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-joint-performance-summary-'));
  try {
    const config = enableJointPerformanceGeneration(workingConfig(tmp));
    config.gates_per_cell.maximum_transport_normalizations = 1;
    const reports = [2, 3, 7, 10].map((turn, index) => {
      const entries = index === 0 ? [{ surface: 'First public source.' }, { surface: 'Second public source.' }] : [];
      const sourceSpans = entries.map((entry, sourceIndex) => ({
        id: `source_${sourceIndex + 1}`,
        kind: 'source',
        owner: 'host',
        text: entry.surface,
      }));
      const sourceText = entries.map((entry) => entry.surface).join(' ');
      return {
        bundles: [
          {
            turn,
            turnId: `run:t${turn}`,
            frames: { dramaticRelease: { active: entries.length > 0, entries } },
          },
        ],
        results: [
          {
            turn,
            turnId: `run:t${turn}`,
            latencyMs: 100,
            jointPerformanceGeneration: {
              ok: true,
              parsed: {
                transport_normalizations:
                  index === 0 ? [{ slot: 'performance.response', type: 'trim_outer_whitespace', count: 1 }] : [],
              },
              composition: {
                text: `We enter the scene. ${sourceText} What do you see?`.replace(/\s+/gu, ' ').trim(),
                sourceCount: entries.length,
                spans: sourceSpans,
              },
            },
            audit: {
              ok: true,
              safetyFailure: false,
              failureClusters: [],
              audits: {
                responseCompositionAudit: { ok: true },
                actorialRealizationAudit: { ok: true },
                responseConfigurationAudit: { realization_rate: 1 },
                jointPerformanceAudit: { ok: true },
              },
            },
          },
        ],
      };
    });

    const passing = summarizeTutorStubWorkingScreen({ cell: config.matrix[0], reports, config });
    assert.equal(passing.validJointPerformanceOutputs, 4);
    assert.equal(passing.transportNormalizedOutputs, 1);
    assert.equal(passing.transportNormalizationCount, 1);
    assert.deepEqual(passing.transportNormalizations, [
      {
        turn: 2,
        turnId: 'run:t2',
        draw: null,
        slot: 'performance.response',
        type: 'trim_outer_whitespace',
        count: 1,
      },
    ]);
    assert.equal(passing.jointPerformanceOwnershipPasses, 4);
    assert.equal(passing.exactHostSourceOccurrencePasses, 4);
    assert.deepEqual(
      passing.hostSourceOccurrences.map((row) => [
        row.expectedOccurrenceCount,
        row.sourceSpanCount,
        row.hostOwnedSourceSpanCount,
        row.actualOccurrenceCount,
      ]),
      [
        [2, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    );
    assert.equal(passing.gates.jointPerformanceOutput, true);
    assert.equal(passing.gates.jointPerformanceOwnership, true);
    assert.equal(passing.gates.exactHostSourceOccurrences, true);
    assert.equal(passing.status, 'pass');

    const wrongOwner = structuredClone(reports);
    wrongOwner[0].results[0].jointPerformanceGeneration.composition.spans[1].owner = 'model';
    const rejected = summarizeTutorStubWorkingScreen({ cell: config.matrix[0], reports: wrongOwner, config });
    assert.equal(rejected.gates.exactHostSourceOccurrences, false);
    assert.equal(rejected.status, 'fail');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working summary requires compact prompt provenance on every completed draw', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-compact-speaker-summary-'));
  try {
    const config = enableCompactSpeakerPrompt(workingConfig(tmp));
    config.gates_per_cell.maximum_transport_normalizations = 1;
    const reports = [2, 3, 7, 10].map((turn) => ({
      bundles: [
        {
          turn,
          turnId: `run:t${turn}`,
          frames: { dramaticRelease: { active: false, entries: [] } },
          compactSpeakingPrompt: {
            schema: TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA,
            mode: 'compact-no-source.v1',
            publicHistoryPreservedExactly: true,
            v2OutputShapePreserved: true,
            noNewEvidence: true,
            promptSize: { authoredTotal: { estimatedTokens: 2302 } },
            maxEstimatedTokens: 2500,
          },
        },
      ],
      results: [
        {
          turn,
          turnId: `run:t${turn}`,
          latencyMs: 100,
          jointPerformanceGeneration: {
            ok: true,
            parsed: { transport_normalizations: [] },
            composition: { text: 'A concrete reply.', sourceCount: 0, spans: [] },
          },
          audit: {
            ok: true,
            safetyFailure: false,
            failureClusters: [],
            audits: {
              responseCompositionAudit: { ok: true },
              actorialRealizationAudit: { ok: true },
              responseConfigurationAudit: { realization_rate: 1 },
              jointPerformanceAudit: { ok: true },
            },
          },
        },
      ],
    }));

    const passing = summarizeTutorStubWorkingScreen({ cell: config.matrix[0], reports, config });
    assert.equal(passing.compactSpeakerPromptPasses, 4);
    assert.equal(passing.compactSpeakerPromptFailures, 0);
    assert.equal(passing.gates.compactSpeakerPrompt, true);

    const missing = structuredClone(reports);
    delete missing[1].bundles[0].compactSpeakingPrompt;
    const rejected = summarizeTutorStubWorkingScreen({ cell: config.matrix[0], reports: missing, config });
    assert.equal(rejected.compactSpeakerPromptPasses, 3);
    assert.equal(rejected.compactSpeakerPromptFailures, 1);
    assert.equal(rejected.gates.compactSpeakerPrompt, false);
    assert.equal(rejected.status, 'fail');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working summary reports and enforces each named structured-generation gate', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-structured-summary-'));
  try {
    const config = enableStructuredGeneration(workingConfig(tmp));
    const turns = [2, 3, 7, 10];
    const reports = turns.map((turn, index) => {
      const active = index % 2 === 0;
      const surface = `Public source ${turn}.`;
      const sourceSpan = { id: 'source_1', kind: 'source', text: surface };
      return {
        bundles: [
          {
            turn,
            turnId: `run:t${turn}`,
            frames: {
              dramaticRelease: {
                active,
                entries: active ? [{ surface }] : [],
              },
            },
          },
        ],
        results: [
          {
            turn,
            turnId: `run:t${turn}`,
            latencyMs: 100,
            structuredGeneration: {
              ok: true,
              composition: {
                text: active ? `I open the record. ${surface} What changes?` : 'I open the record. What changes?',
                sourceCount: active ? 1 : 0,
                spans: active ? [sourceSpan] : [],
              },
            },
            audit: {
              ok: true,
              safetyFailure: false,
              failureClusters: [],
              audits: {
                responseCompositionAudit: { ok: true },
                actorialRealizationAudit: { ok: true },
                responseConfigurationAudit: { realization_rate: 1 },
                structuredSlotOwnershipAudit: { ok: true },
              },
            },
          },
        ],
      };
    });

    const passing = summarizeTutorStubWorkingScreen({ cell: config.matrix[0], reports, config });
    assert.equal(passing.validStructuredOutputs, 4);
    assert.equal(passing.structuredOutputFailures, 0);
    assert.equal(passing.structuredSlotOwnershipPasses, 4);
    assert.equal(passing.structuredSlotOwnershipFailures, 0);
    assert.equal(passing.exactSourceOccurrencePasses, 4);
    assert.equal(passing.exactSourceOccurrenceFailures, 0);
    assert.deepEqual(
      passing.structuredSourceOccurrences.map((row) => [
        row.turn,
        row.expectedOccurrenceCount,
        row.actualOccurrenceCount,
      ]),
      [
        [2, 1, 1],
        [3, 0, 0],
        [7, 1, 1],
        [10, 0, 0],
      ],
    );
    assert.equal(passing.gates.structuredOutput, true);
    assert.equal(passing.gates.structuredSlotOwnership, true);
    assert.equal(passing.gates.exactSourceOnce, true);
    assert.equal(passing.status, 'pass');

    const multipleSources = structuredClone(reports);
    multipleSources[0].bundles[0].frames.dramaticRelease.entries.push({ surface: 'Second public source 2.' });
    multipleSources[0].results[0].structuredGeneration.composition.text =
      'I open the record. Public source 2. Second public source 2. What changes?';
    multipleSources[0].results[0].structuredGeneration.composition.sourceCount = 2;
    multipleSources[0].results[0].structuredGeneration.composition.spans.push({
      id: 'source_2',
      kind: 'source',
      text: 'Second public source 2.',
    });
    const multipleSourceSummary = summarizeTutorStubWorkingScreen({
      cell: config.matrix[0],
      reports: multipleSources,
      config,
    });
    assert.deepEqual(
      [
        multipleSourceSummary.structuredSourceOccurrences[0].expectedOccurrenceCount,
        multipleSourceSummary.structuredSourceOccurrences[0].declaredSourceCount,
        multipleSourceSummary.structuredSourceOccurrences[0].sourceSpanCount,
        multipleSourceSummary.structuredSourceOccurrences[0].actualOccurrenceCount,
      ],
      [2, 2, 2, 2],
    );
    assert.equal(multipleSourceSummary.gates.exactSourceOnce, true);

    const malformed = structuredClone(reports);
    malformed[0].results[0].structuredGeneration.ok = false;
    const malformedSummary = summarizeTutorStubWorkingScreen({ cell: config.matrix[0], reports: malformed, config });
    assert.equal(malformedSummary.gates.structuredOutput, false);
    assert.equal(malformedSummary.status, 'fail');

    const substituted = structuredClone(reports);
    substituted[1].results[0].audit.audits.structuredSlotOwnershipAudit.ok = false;
    const substitutedSummary = summarizeTutorStubWorkingScreen({
      cell: config.matrix[0],
      reports: substituted,
      config,
    });
    assert.equal(substitutedSummary.gates.structuredSlotOwnership, false);
    assert.equal(substitutedSummary.status, 'fail');

    const duplicated = structuredClone(reports);
    duplicated[0].results[0].structuredGeneration.composition.text =
      'I open the record. Public source 2. Public source 2. What changes?';
    const duplicatedSummary = summarizeTutorStubWorkingScreen({ cell: config.matrix[0], reports: duplicated, config });
    assert.equal(duplicatedSummary.structuredSourceOccurrences[0].actualOccurrenceCount, 2);
    assert.equal(duplicatedSummary.gates.exactSourceOnce, false);
    assert.equal(duplicatedSummary.status, 'fail');

    const sourceOnInactiveTurn = structuredClone(reports);
    sourceOnInactiveTurn[1].results[0].structuredGeneration.composition.spans = [
      { id: 'source_1', kind: 'source', text: 'Unexpected source.' },
    ];
    const inactiveSummary = summarizeTutorStubWorkingScreen({
      cell: config.matrix[0],
      reports: sourceOnInactiveTurn,
      config,
    });
    assert.equal(inactiveSummary.structuredSourceOccurrences[1].actualOccurrenceCount, 1);
    assert.equal(inactiveSummary.gates.exactSourceOnce, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working gate becomes impossible after two rejected originals and leaves later turns unneeded', () => {
  assert.deepEqual(tutorStubFirstDraftGatePossibility({ accepted: 0, completed: 2, total: 4, required: 3 }), {
    accepted: 0,
    completed: 2,
    remaining: 2,
    required: 3,
    maximumPossibleAccepted: 2,
    possible: false,
    passed: false,
  });
  assert.equal(tutorStubFirstDraftGatePossibility({ accepted: 2, completed: 3, total: 4, required: 3 }).possible, true);
});

test('working summary counts original acceptance, safety, uptake, and latency without recovery', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-summary-'));
  try {
    const config = workingConfig(tmp);
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 1 });
    const reports = [2, 3, 7, 10].map((turn, index) => ({
      results: [
        {
          turn,
          latencyMs: 100 + index,
          audit: {
            ok: index !== 3,
            safetyFailure: false,
            hardFailureClusters: index === 3 ? ['response_composition:missing_learner_uptake'] : [],
            audits: {
              responseCompositionAudit: { ok: index !== 3 },
              actorialRealizationAudit: { ok: index !== 3 },
              responseConfigurationAudit: { realization_rate: index === 3 ? 0.5 : 1 },
            },
          },
        },
      ],
    }));
    const summary = summarizeTutorStubWorkingScreen({ cell: plan.cells[0], reports, config });
    assert.equal(summary.originalCandidatesAccepted, 3);
    assert.equal(summary.mechanicalRepairs, 0);
    assert.equal(summary.modelRewrites, 0);
    assert.equal(summary.deterministicFallbacks, 0);
    assert.equal(summary.safetyFailures, 0);
    assert.equal(summary.meanConfigurationRealization, 0.875);
    assert.equal(summary.gates.configurationRealization, false);
    assert.equal(summary.status, 'fail', 'the required transcript-specific uptake gate remains strict');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working screen cannot pass when full configuration realization becomes mathematically impossible', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-configuration-'));
  try {
    const config = workingConfig(tmp);
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 1 });
    const reports = [2, 3].map((turn) => ({
      results: [
        {
          turn,
          latencyMs: 100,
          audit: {
            ok: true,
            safetyFailure: false,
            hardFailureClusters: [],
            audits: {
              responseCompositionAudit: { ok: true },
              actorialRealizationAudit: { ok: true },
              responseConfigurationAudit: { realization_rate: 0.5 },
            },
          },
        },
      ],
    }));
    const summary = summarizeTutorStubWorkingScreen({ cell: plan.cells[0], reports, config });
    assert.equal(summary.possibility.originalAcceptance.possible, true);
    assert.equal(summary.possibility.configurationRealization.maximumPossibleMean, 0.75);
    assert.equal(summary.possibility.possible, false);
    assert.equal(summary.status, 'fail');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working screen can report aggregate non-actorial realization without making it a delivery-development veto', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-configuration-report-'));
  try {
    const config = workingConfig(tmp);
    config.gates_per_cell.configuration_realization_enforcement = 'report_only';
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp, iteration: 1 });
    const reports = [2, 3, 7, 10].map((turn, index) => ({
      results: [
        {
          turn,
          latencyMs: 100,
          audit: {
            ok: true,
            safetyFailure: false,
            hardFailureClusters: [],
            audits: {
              responseCompositionAudit: { ok: true },
              actorialRealizationAudit: { ok: true },
              responseConfigurationAudit: { realization_rate: index === 3 ? 0.5 : 1 },
            },
          },
        },
      ],
    }));
    const summary = summarizeTutorStubWorkingScreen({ cell: plan.cells[0], reports, config });
    assert.equal(summary.meanConfigurationRealization, 0.875);
    assert.equal(summary.configurationRealizationEnforcement, 'report_only');
    assert.equal(summary.possibility.configurationRealization.passed, false);
    assert.equal(summary.possibility.possible, true);
    assert.equal(summary.gates.configurationRealization, true);
    assert.equal(summary.status, 'pass');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('working screen clusters every rejected original including unresolved advisory performance misses', () => {
  const reports = [
    {
      results: [
        {
          turn: 2,
          candidate: 'Public candidate one.',
          latencyMs: 10,
          deterministicAudit: { ok: false },
          audit: {
            ok: false,
            safetyFailure: false,
            failureClusters: ['actorialRealizationAudit:missing_selected_performance_tactic'],
            hardFailureClusters: [],
            audits: { responseConfigurationAudit: { realization_rate: 5 / 6 } },
          },
          semanticAdjudication: { called: true, adjudication: { recognized: false }, latencyMs: 5 },
        },
      ],
    },
    {
      results: [
        {
          turn: 3,
          candidate: 'Public candidate two.',
          latencyMs: 10,
          deterministicAudit: { ok: false },
          audit: {
            ok: false,
            safetyFailure: false,
            failureClusters: ['actorialRealizationAudit:missing_selected_performance_tactic'],
            hardFailureClusters: ['actorial_realization:missing_selected_performance_tactic'],
            audits: { responseConfigurationAudit: { realization_rate: 4 / 6 } },
          },
          semanticAdjudication: { called: false, latencyMs: 0 },
        },
      ],
    },
  ];
  const summary = summarizeTutorStubWorkingScreen({
    cell: { id: 'hard', world: 'world', learnerProfile: 'answer_seeking', seed: 1, turns: [2, 3, 4, 5] },
    reports,
    config: {
      gates_per_cell: {
        required_turns: 4,
        required_originals_accepted: 3,
        minimum_mean_configuration_realization: 0.9,
        maximum_safety_failures: 0,
        require_transcript_specific_uptake: false,
      },
    },
  });

  assert.deepEqual(summary.dominantFailureClusters, [
    { cluster: 'actorialRealizationAudit:missing_selected_performance_tactic', count: 2 },
  ]);
});

test('development stopping gate halts only after two consecutive non-improving iterations', () => {
  const first = tutorStubFirstDraftIterationStopping({
    current: { completedTurns: 8, originalCandidatesAccepted: 4 },
    previous: null,
  });
  assert.equal(first.stop, false);
  assert.equal(first.consecutiveWithoutImprovement, 0);

  const second = tutorStubFirstDraftIterationStopping({
    current: { completedTurns: 8, originalCandidatesAccepted: 4 },
    previous: {
      completedTurns: 8,
      originalCandidatesAccepted: 4,
      stopping: first,
    },
  });
  assert.equal(second.stop, false);
  assert.equal(second.consecutiveWithoutImprovement, 1);

  const third = tutorStubFirstDraftIterationStopping({
    current: { completedTurns: 8, originalCandidatesAccepted: 4 },
    previous: {
      completedTurns: 8,
      originalCandidatesAccepted: 4,
      stopping: second,
    },
  });
  assert.equal(third.stop, true);
  assert.equal(third.consecutiveWithoutImprovement, 2);

  const improved = tutorStubFirstDraftIterationStopping({
    current: { completedTurns: 8, originalCandidatesAccepted: 5 },
    previous: {
      completedTurns: 8,
      originalCandidatesAccepted: 4,
      stopping: second,
    },
  });
  assert.equal(improved.stop, false);
  assert.equal(improved.consecutiveWithoutImprovement, 0);
});

test('development stopping counts configuration realization improvement without conflating semantic corrections', () => {
  const previous = {
    completedTurns: 1,
    originalCandidatesAccepted: 1,
    meanConfigurationRealization: 0.667,
    semanticRecognitionCorrections: 0,
    stopping: { consecutiveWithoutImprovement: 1 },
  };
  const configurationImproved = tutorStubFirstDraftIterationStopping({
    current: {
      completedTurns: 1,
      originalCandidatesAccepted: 1,
      meanConfigurationRealization: 0.833,
      semanticRecognitionCorrections: 0,
    },
    previous,
  });
  assert.equal(configurationImproved.measurableImprovement, true);
  assert.equal(configurationImproved.configurationRealizationImproved, true);
  assert.equal(configurationImproved.consecutiveWithoutImprovement, 0);

  const recognitionOnly = tutorStubFirstDraftIterationStopping({
    current: {
      completedTurns: 1,
      originalCandidatesAccepted: 1,
      meanConfigurationRealization: 0.667,
      semanticRecognitionCorrections: 1,
    },
    previous,
  });
  assert.equal(recognitionOnly.measurableImprovement, false);
  assert.equal(recognitionOnly.configurationRealizationImproved, false);
  assert.equal(recognitionOnly.semanticRecognitionCorrections, 1);
  assert.equal(recognitionOnly.consecutiveWithoutImprovement, 2);
  assert.equal(recognitionOnly.stop, true);
});

test('development stopping does not reward an early-stopped survivor rate', () => {
  const previous = {
    completedTurns: 4,
    originalCandidatesAccepted: 3,
    meanConfigurationRealization: 0.91675,
    safetyFailures: 0,
    deterministicFallbacks: 0,
    stopping: { consecutiveWithoutImprovement: 0 },
  };
  const current = tutorStubFirstDraftIterationStopping({
    current: {
      completedTurns: 2,
      originalCandidatesAccepted: 2,
      meanConfigurationRealization: 0.9165,
      safetyFailures: 0,
      deterministicFallbacks: 0,
    },
    previous,
  });

  assert.equal(current.comparableCompletion, false);
  assert.equal(current.measurableImprovement, false);
  assert.equal(current.consecutiveWithoutImprovement, 1);
  assert.equal(current.stop, false);
});

test('a predeclared final frontier attempt stops when the full working screen does not pass', () => {
  const result = tutorStubFirstDraftIterationStopping({
    current: {
      completedTurns: 3,
      originalCandidatesAccepted: 3,
      meanConfigurationRealization: 1,
      workingScreenPassed: false,
    },
    previous: {
      completedTurns: 2,
      originalCandidatesAccepted: 1,
      meanConfigurationRealization: 0.833,
      stopping: { consecutiveWithoutImprovement: 1 },
    },
    requireWorkingScreenPass: true,
  });

  assert.equal(result.measurableImprovement, true);
  assert.equal(result.stop, true);
  assert.equal(result.reason, 'predeclared_final_frontier_attempt_failed');
});

test('acceptance assessment keeps original, repair, fallback, safety, and latency separate', () => {
  const report = {
    rows: [
      {
        status: 'ok',
        turnCount: 4,
        guardAccounting: {
          turns: 4,
          accountedTurns: 4,
          originalCandidateAcceptedTurns: 4,
          strictOriginalCandidateAcceptedTurns: 3,
          mechanicalRepairTurns: 1,
          modelRepairTurns: 0,
          deterministicFallbackTurns: 0,
          finalDeliveryAuditFailures: 0,
          totalOriginalCandidateLatencyMs: 400,
          totalTutorGenerationLatencyMs: 500,
        },
        characterAdaptation: {
          hostVisibleTurns: 4,
          hostPartCounts: { examiner: 2, advocate: 2 },
          metaPerformanceTurns: 0,
          roleStageDirectionTurns: 0,
          sourceReplacementTurns: 0,
          duplicateClueDeliveryTurns: 0,
        },
        responseConfigurationVisibility: { mean_realization_rate: 1 },
        diagnosticCollection: { quarantineCount: 0 },
        errorCount: 0,
      },
    ],
    aggregates: { errorCount: 0 },
  };
  const config = acceptanceGateConfig(4);
  config.first_draft_gates.minimum_cell_original_candidate_acceptance_rate = 0.75;
  const assessment = assessTutorStubAcceptanceCell(report, config);
  assert.equal(assessment.status, 'pass');
  assert.equal(assessment.observed.originalCandidateAcceptanceRate, 0.75);
  assert.equal(assessment.observed.originalCandidateDeliveryRate, 1);
  assert.equal(assessment.observed.accountedTurnRate, 1);
  assert.equal(assessment.observed.mechanicalRepairs, 1);
  assert.equal(assessment.observed.modelRewrites, 0);
  assert.equal(assessment.observed.deterministicFallbacks, 0);
  assert.equal(assessment.observed.finalSafetyFailures, 0);
  assert.equal(assessment.observed.meanOriginalLatencyMs, 100);
  assert.equal(assessment.observed.meanTotalTutorLatencyMs, 125);
});

test('acceptance first-draft gate uses strict originals while preserving ordinary original delivery', () => {
  const config = acceptanceGateConfig(4);
  config.first_draft_gates.minimum_cell_original_candidate_acceptance_rate = 0.75;
  const report = {
    rows: [
      {
        status: 'ok',
        turnCount: 4,
        guardAccounting: {
          turns: 4,
          accountedTurns: 4,
          originalCandidateAcceptedTurns: 4,
          strictOriginalCandidateAcceptedTurns: 2,
        },
        characterAdaptation: {
          hostVisibleTurns: 4,
          hostPartCounts: { examiner: 2, advocate: 2 },
        },
        responseConfigurationVisibility: { mean_realization_rate: 1 },
      },
    ],
    aggregates: { errorCount: 0 },
  };
  const assessment = assessTutorStubAcceptanceCell(report, config);
  assert.equal(assessment.observed.originalCandidatesDelivered, 4);
  assert.equal(assessment.observed.strictOriginalCandidatesAccepted, 2);
  assert.equal(assessment.gates.originalAcceptance, false);
  assert.equal(assessment.status, 'fail');
});

test('strict original accounting requires original delivery and selected part/tactic realization', () => {
  const strictOriginal = {
    finalDelivery: { source: 'original_candidate' },
    originalCandidate: { audits: { actorialRealizationAudit: { ok: true } } },
  };
  assert.equal(tutorStubStrictOriginalCandidateAccepted(strictOriginal), true);
  assert.equal(
    tutorStubStrictOriginalCandidateAccepted({
      ...strictOriginal,
      originalCandidate: { audits: { actorialRealizationAudit: { ok: false } } },
    }),
    false,
  );
  assert.equal(
    tutorStubStrictOriginalCandidateAccepted({
      ...strictOriginal,
      finalDelivery: { source: 'policy_repair_candidate' },
    }),
    false,
  );
});

test('acceptance requires the declared turn horizon and complete guard accounting', () => {
  const config = acceptanceGateConfig(4);
  const baseRow = {
    status: 'ok',
    turnCount: 4,
    guardAccounting: {
      turns: 4,
      accountedTurns: 4,
      originalCandidateAcceptedTurns: 4,
      strictOriginalCandidateAcceptedTurns: 4,
    },
    characterAdaptation: {
      hostVisibleTurns: 4,
      hostPartCounts: { examiner: 2, advocate: 2 },
    },
    responseConfigurationVisibility: { mean_realization_rate: 1 },
  };
  const short = assessTutorStubAcceptanceCell(
    { rows: [{ ...baseRow, turnCount: 3 }], aggregates: { errorCount: 0 } },
    config,
  );
  assert.equal(short.gates.complete, false);
  assert.equal(short.status, 'fail');

  const unaccounted = assessTutorStubAcceptanceCell(
    {
      rows: [
        {
          ...baseRow,
          guardAccounting: { ...baseRow.guardAccounting, accountedTurns: 3 },
        },
      ],
      aggregates: { errorCount: 0 },
    },
    config,
  );
  assert.equal(unaccounted.observed.accountedTurnRate, 0.75);
  assert.equal(unaccounted.gates.accountedTurns, false);
  assert.equal(unaccounted.status, 'fail');
});

test('acceptance expansion freezes explicit palette and safety-turn controls', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-acceptance-'));
  try {
    const config = {
      ...acceptanceGateConfig(10),
      schema: 'machinespirits.tutor-stub.first-draft-generalization-plan.v1',
      id: 'acceptance-test',
      fixed_configuration: {
        mode: 'strict',
        turns: 10,
        safety_turns: 80,
        policy: 'continuous_dynamical_system',
        register_palette: 'all',
        dag_mode: 'defeasible_human_scaffold',
        register_temperature: 0.15,
        register_overlay_threshold: 0.7,
        dag_fact_dropout: 0,
        dag_fact_dropout_seed: 1,
        release_speed: 1,
        tutor_model: 'codex.gpt-5.6-terra',
        analysis_model: 'codex.gpt-5.6-sol',
        learner_model: 'codex.gpt-5.6-terra',
        cli_effort: 'low',
        max_tokens: 4096,
        history_turns: 4,
      },
      artifacts: { live_root: path.join(tmp, 'live') },
      matrix: [
        ['hard', 1, 'answer_seeking', 91001],
        ['second', 2, 'diligent', 91002],
        ['third', 3, 'premature_closure', 91003],
        ['fourth', 4, 'low_trust_skeptic', 91004],
      ].map(([id, priority, learner_profile, seed]) => ({
        id,
        priority,
        world: `world_${id}`,
        learner_profile,
        seed,
      })),
      change_control: { maximum_concurrent_cells: 3, hardest_cell_first: true },
    };
    const plan = expandTutorStubFirstDraftCampaign({ config, root: tmp });
    const hard = plan.cells[0].argv;

    assert.deepEqual(hard.slice(hard.indexOf('--register-palette'), hard.indexOf('--register-palette') + 2), [
      '--register-palette',
      'all',
    ]);
    assert.deepEqual(hard.slice(hard.indexOf('--safety-turns'), hard.indexOf('--safety-turns') + 2), [
      '--safety-turns',
      '80',
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('acceptance validation fails closed when a required strict or first-draft gate is omitted', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-acceptance-gates-'));
  try {
    const base = {
      ...acceptanceGateConfig(10),
      schema: 'machinespirits.tutor-stub.first-draft-generalization-plan.v1',
      id: 'acceptance-gate-test',
      fixed_configuration: {
        ...acceptanceGateConfig(10).fixed_configuration,
        safety_turns: 80,
        register_palette: 'all',
      },
      artifacts: { live_root: path.join(tmp, 'live') },
      matrix: [
        ['hard', 1, 'answer_seeking', 92001],
        ['second', 2, 'diligent', 92002],
        ['third', 3, 'premature_closure', 92003],
        ['fourth', 4, 'low_trust_skeptic', 92004],
      ].map(([id, priority, learner_profile, seed]) => ({
        id,
        priority,
        world: `world_${id}`,
        learner_profile,
        seed,
      })),
      change_control: { maximum_concurrent_cells: 3, hardest_cell_first: true },
    };

    const missingStrict = structuredClone(base);
    delete missingStrict.strict_delivery_gates_per_cell.minimum_mean_configuration_realization;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: missingStrict, root: tmp }),
      /minimum mean configuration realization must be a number between 0 and 1/u,
    );

    const missingFirstDraft = structuredClone(base);
    delete missingFirstDraft.first_draft_gates.minimum_accounted_turn_rate;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: missingFirstDraft, root: tmp }),
      /minimum accounted turn rate must be a number between 0 and 1/u,
    );

    const missingAllCells = structuredClone(base);
    delete missingAllCells.first_draft_gates.require_all_four_cells;
    assert.throws(
      () => validateTutorStubFirstDraftCampaign({ config: missingAllCells, root: tmp }),
      /acceptance must require all four cells/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
