import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  OUTCOME_PILOT_CALL_PLAN,
  OUTCOME_PILOT_CHECKPOINT_SCHEMA,
  OUTCOME_PILOT_FREEZE_SCHEMA,
  OUTCOME_PILOT_PER_DIALOGUE_CAP,
  createOutcomePilotBudget,
  executeOutcomePilot,
  guardOutcomeAnnotationFingerprints,
  guardOutcomeDialogueLearnerAnalysisCoverage,
  preflightOutcomePilotPromptAudits,
  renderOutcomePilotPromptConfiguration,
  runOutcomeGeneration,
  runReaderProcesses,
  runReadersAfterFingerprintGuard,
  validateOutcomeFreezeFormForFrozenDecisionRunner,
  verifyOutcomePilotManifestBindings,
} from '../scripts/run-adaptive-warrant-outcome-pilot.js';
import { annotationCaseFingerprint } from '../scripts/run-adaptive-warrant-baseline-study.js';
import { auditTutorStubPrompt, TUTOR_STUB_PROMPT_BUDGETS } from '../services/tutorStubPromptAudit.js';
import { auditTutorStubBaseSystemPrompt } from '../services/tutorStubSessionApplicationContext.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-pilot-harness-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function fingerprintCase(index) {
  return {
    sample_id: `case-${index}`,
    transcript_before_decision: [{ turn: index, learner: `learner ${index}`, tutor: `tutor ${index}` }],
    current_learner_turn: { turn: index, learner: `current ${index}` },
    learner_record_at_decision: { grounded_count: index, voiced_derived_count: 0, total: index },
    learner_record_trajectory: [{ turn: index, grounded_count: index, voiced_derived_count: 0, total: index }],
  };
}

function fingerprintKey(corpusCase, { dialogueId = `dialogue-${corpusCase.sample_id}`, turn } = {}) {
  return {
    sample_id: corpusCase.sample_id,
    job_id: dialogueId,
    turn: turn ?? corpusCase.current_learner_turn.turn,
    source_fingerprint: annotationCaseFingerprint(corpusCase),
  };
}

function v3Dialogue11FixtureEvents() {
  return fs
    .readFileSync(
      path.join(ROOT, 'tests/fixtures/adaptive-warrant-outcome-v3-dialogue-11-learner-analysis.jsonl'),
      'utf8',
    )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

test('paid execution refuses before any work when --go-note is absent', async () => {
  await assert.rejects(
    executeOutcomePilot({ acceptCharges: true, outputDir: '/tmp/must-not-exist-outcome-pilot' }),
    /--go-note is required/u,
  );
});

test('manifest guard refuses a menu SHA mismatch', (t) => {
  const directory = temporaryDirectory(t);
  const source = path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  manifest.standing_permission.menu_json_sha256 = '0'.repeat(64);
  const manifestPath = path.join(directory, 'pilot-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => verifyOutcomePilotManifestBindings({ manifestPath }), /menu JSON SHA mismatch/u);
});

test('manifest guard passes on the real frozen files (menu text carries one trailing newline)', () => {
  const result = verifyOutcomePilotManifestBindings({});
  assert.equal(typeof result, 'object');
  assert.deepEqual(result.manifest.presence_channel.caps_bytes, {
    response: 14000,
    packet: 60000,
  });
  assert.deepEqual(result.manifest.planned_calls, {
    generation: 540,
    presence_readers: 288,
    decision_readers: 288,
    total: 1116,
    arithmetic: '(18 x 30 cap) + (2 x 144) + (2 x 144) = 1116; measured live unit 26 per dialogue (report 069)',
    counter_before: 4198,
    counter_after_if_completed: 5314,
    ceiling: 19337,
    remaining_after_if_completed: 14023,
  });
});

test('real frozen worlds render all three conditions through the zero-call prompt preflight', (t) => {
  const directory = temporaryDirectory(t);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json'), 'utf8'),
  );
  const artifactPath = path.join(directory, 'prompt-audit-preflight.json');
  const artifact = preflightOutcomePilotPromptAudits({ manifest, outputPath: artifactPath });
  assert.equal(artifact.status, 'passed');
  assert.equal(artifact.makes_model_calls, false);
  assert.equal(artifact.model_calls, 0);
  assert.equal(artifact.renders.length, 6);
  assert.ok(artifact.renders.every((row) => row.ok && row.violations.length === 0));
  assert.ok(
    artifact.renders
      .filter((row) => row.condition !== 'standing_permission')
      .every(
        (row) =>
          row.surface === 'tutor_system' &&
          row.budget.maxChars === TUTOR_STUB_PROMPT_BUDGETS.tutor_system.maxChars &&
          row.budget.maxApproxTokens === TUTOR_STUB_PROMPT_BUDGETS.tutor_system.maxApproxTokens,
      ),
  );
  assert.ok(
    artifact.renders
      .filter((row) => row.condition === 'standing_permission')
      .every(
        (row) =>
          row.surface === 'tutor_system_standing' &&
          row.budget.maxChars === TUTOR_STUB_PROMPT_BUDGETS.tutor_system_standing.maxChars &&
          row.budget.maxApproxTokens === TUTOR_STUB_PROMPT_BUDGETS.tutor_system_standing.maxApproxTokens,
      ),
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(artifactPath, 'utf8')), artifact);
});

test('a genuine duplicate outside the real frozen standing-permission menu still fails', () => {
  const worldPath = 'docs/adaptation-refinement/outcome-study-a1/worlds/world_101_kestrel_signal_lamp.yaml';
  const rendered = renderOutcomePilotPromptConfiguration({
    worldPath,
    condition: 'standing_permission',
    seed: 515,
  });
  const standingInstructions = fs.readFileSync(
    path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.txt'),
    'utf8',
  );
  const duplicate =
    'This deliberately duplicated outer instruction must remain visible to the fail-closed prompt audit.';
  const audit = auditTutorStubBaseSystemPrompt({
    auditTutorStubPrompt,
    systemPrompt: `${rendered.systemPrompt}\n${duplicate}\n${duplicate}`,
    standingInstructions,
  });
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.some((violation) => violation.code === 'duplicate_instruction_lines'));
});

test('a genuine duplicate inside one real standing-permission branch still fails', () => {
  const worldPath = 'docs/adaptation-refinement/outcome-study-a1/worlds/world_101_kestrel_signal_lamp.yaml';
  const rendered = renderOutcomePilotPromptConfiguration({
    worldPath,
    condition: 'standing_permission',
    seed: 515,
  });
  const standingInstructions = fs.readFileSync(
    path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.txt'),
    'utf8',
  );
  const instruction =
    'Answer, credit, qualify, correct, or receive the learner’s concrete move; never use generic praise.';
  const duplicatedInstructions = standingInstructions.replace(instruction, `${instruction}\n${instruction}`);
  const audit = auditTutorStubBaseSystemPrompt({
    auditTutorStubPrompt,
    systemPrompt: rendered.systemPrompt.replace(standingInstructions, duplicatedInstructions),
    standingInstructions: duplicatedInstructions,
  });
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.some((violation) => violation.code === 'duplicate_instruction_lines'));
});

test('an oversized prompt on the real frozen standing surface still fails', () => {
  const worldPath = 'docs/adaptation-refinement/outcome-study-a1/worlds/world_102_marigold_archive_box.yaml';
  const rendered = renderOutcomePilotPromptConfiguration({
    worldPath,
    condition: 'standing_permission',
    seed: 515,
  });
  const standingInstructions = fs.readFileSync(
    path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.txt'),
    'utf8',
  );
  const audit = auditTutorStubBaseSystemPrompt({
    auditTutorStubPrompt,
    systemPrompt: `${rendered.systemPrompt}\n${'x'.repeat(TUTOR_STUB_PROMPT_BUDGETS.tutor_system_standing.maxChars)}`,
    standingInstructions,
  });
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.some((violation) => violation.code === 'character_budget_exceeded'));
  assert.ok(audit.violations.some((violation) => violation.code === 'approximate_token_budget_exceeded'));
});

test('annotationCaseFingerprint failure blocks reader admission', async () => {
  let readerCalls = 0;
  await assert.rejects(
    runReadersAfterFingerprintGuard({
      cases: [fingerprintCase(1)],
      expectedCount: 2,
      runReaders: async () => {
        readerCalls += 1;
      },
    }),
    /expected 2 cases, got 1/u,
  );
  assert.equal(readerCalls, 0);
});

test('annotationCaseFingerprint guard passes and reports legitimate byte twins with distinct identities', () => {
  const first = fingerprintCase(1);
  const twin = { ...structuredClone(first), sample_id: 'case-twin' };
  const result = guardOutcomeAnnotationFingerprints({
    cases: [first, twin],
    keyCases: [
      fingerprintKey(first, { dialogueId: 'dialogue-a', turn: 1 }),
      fingerprintKey(twin, { dialogueId: 'dialogue-b', turn: 1 }),
    ],
    expectedCount: 2,
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.observed_identity_count, 2);
  assert.equal(result.unique_content_fingerprint_count, 1);
  assert.deepEqual(result.byte_twin_groups, [
    {
      content_sha256: annotationCaseFingerprint(first),
      cases: [
        { sample_id: 'case-1', dialogue_id: 'dialogue-a', turn: 1 },
        { sample_id: 'case-twin', dialogue_id: 'dialogue-b', turn: 1 },
      ],
    },
  ]);
  assert.notEqual(result.fingerprints[0], result.fingerprints[1]);
});

test('annotationCaseFingerprint guard refuses a doubled dialogue and turn identity', () => {
  const first = fingerprintCase(1);
  const second = fingerprintCase(2);
  assert.throws(
    () =>
      guardOutcomeAnnotationFingerprints({
        cases: [first, second],
        keyCases: [
          fingerprintKey(first, { dialogueId: 'dialogue-a', turn: 1 }),
          fingerprintKey(second, { dialogueId: 'dialogue-a', turn: 1 }),
        ],
        expectedCount: 2,
      }),
    /identity guard found doubled identity dialogue-a turn 1/u,
  );
});

test('annotationCaseFingerprint guard refuses a case mutated after source extraction', () => {
  const corpusCase = fingerprintCase(1);
  const keyCase = fingerprintKey(corpusCase);
  corpusCase.current_learner_turn.learner = 'mutated bytes';
  assert.throws(
    () => guardOutcomeAnnotationFingerprints({ cases: [corpusCase], keyCases: [keyCase], expectedCount: 1 }),
    /integrity guard found mutated case case-1/u,
  );
});

test('annotationCaseFingerprint guard refuses count drift', () => {
  const corpusCase = fingerprintCase(1);
  assert.throws(
    () => guardOutcomeAnnotationFingerprints({ cases: [corpusCase], keyCases: [fingerprintKey(corpusCase)] }),
    /expected 144 cases, got 1/u,
  );
});

test('checkpoint resume skips a completed dialogue', async (t) => {
  const directory = temporaryDirectory(t);
  const checkpointPath = path.join(directory, 'checkpoint.json');
  const checkpoint = {
    schema: OUTCOME_PILOT_CHECKPOINT_SCHEMA,
    status: 'generation',
    call_budget: {
      plan: { generation: 540, presence_readers: 288, decision_readers: 288, total: 1116 },
      actual: { generation: 26, presence_readers: 0, decision_readers: 0, total: 26 },
      delta: { generation: 514, presence_readers: 288, decision_readers: 288, total: 1090 },
      events: [],
    },
    dialogues: [{ id: 'done-dialogue', status: 'complete' }],
    quarantined_dialogues: [],
  };
  const budget = createOutcomePilotBudget({ checkpointPath, checkpoint });
  let launches = 0;
  await runOutcomeGeneration({
    jobs: [{ id: 'done-dialogue', command: ['false'] }],
    checkpoint,
    budget,
    runDialogue: async () => {
      launches += 1;
      return { status: 1 };
    },
  });
  assert.equal(launches, 0);
  assert.equal(checkpoint.dialogues.length, 1);
});

test('resumed parent starts both readers fresh when neither child checkpoint exists', async (t) => {
  const rootDir = temporaryDirectory(t);
  const presenceRunDir = path.join(rootDir, 'presence-readers');
  const decisionRunDir = path.join(rootDir, 'decision-readers');
  const launches = [];
  const reservations = [];
  await runReaderProcesses({
    semanticCommand: ['node', 'semantic-reader'],
    decisionCommand: ['node', 'decision-reader'],
    presenceRunDir,
    decisionRunDir,
    rootDir,
    resume: true,
    checkpoint: { call_budget: { actual: { total: 0 } } },
    budget: { reserveMany: (...args) => reservations.push(args) },
    runProcess: async (command, options) => {
      launches.push({ command, options });
      return { status: 0 };
    },
  });
  assert.deepEqual(
    launches.map((launch) => launch.command),
    [
      ['node', 'semantic-reader'],
      ['node', 'decision-reader'],
    ],
  );
  assert.deepEqual(
    launches.map((launch) => launch.options.logPath),
    [path.join(rootDir, 'presence-readers-launcher.log'), path.join(rootDir, 'decision-readers-launcher.log')],
  );
  assert.equal(reservations.length, 2);
});

test('resumed parent resumes only a child whose own checkpoint exists', async (t) => {
  const rootDir = temporaryDirectory(t);
  const presenceRunDir = path.join(rootDir, 'presence-readers');
  const decisionRunDir = path.join(rootDir, 'decision-readers');
  fs.mkdirSync(presenceRunDir, { recursive: true });
  fs.writeFileSync(path.join(presenceRunDir, 'semantic-reader-run.json'), '{}\n');
  const launches = [];
  await runReaderProcesses({
    semanticCommand: ['node', 'semantic-reader'],
    decisionCommand: ['node', 'decision-reader'],
    presenceRunDir,
    decisionRunDir,
    rootDir,
    resume: true,
    checkpoint: { call_budget: { actual: { total: 0 } } },
    budget: { reserveMany: () => {} },
    runProcess: async (command, options) => {
      launches.push({ command, options });
      return { status: 0 };
    },
  });
  assert.deepEqual(
    launches.map((launch) => launch.command),
    [
      ['node', 'semantic-reader', '--resume'],
      ['node', 'decision-reader'],
    ],
  );
});

test('launcher quarantines the sealed v3 dialogue-11 coverage shape before counting it complete', async (t) => {
  const directory = temporaryDirectory(t);
  const failure = v3Dialogue11FixtureEvents().find((event) => event.type === 'learner_analysis_unanalyzed');
  const checkpoint = {
    schema: OUTCOME_PILOT_CHECKPOINT_SCHEMA,
    status: 'generation',
    call_budget: {
      plan: { ...OUTCOME_PILOT_CALL_PLAN },
      actual: { generation: 0, presence_readers: 0, decision_readers: 0, total: 0 },
      delta: { ...OUTCOME_PILOT_CALL_PLAN },
      events: [],
    },
    dialogues: [],
    quarantined_dialogues: [],
  };
  const budget = createOutcomePilotBudget({
    checkpointPath: path.join(directory, 'checkpoint.json'),
    checkpoint,
  });
  const row = {
    childStatus: 'ok',
    childEvidence: { ok: true, status: 'complete' },
    turnCount: 8,
    learnerAnalysisCoverage: 0.875,
    learnerAnalysisUnanalyzedTurns: [failure.turn],
    tracePath: null,
  };
  const guard = guardOutcomeDialogueLearnerAnalysisCoverage(row);
  assert.deepEqual(guard, {
    status: 'failed',
    coverage: 0.875,
    unanalyzed_turns: [5],
    reason: 'learner_analysis_coverage_below_one: turns 5',
  });
  await runOutcomeGeneration({
    jobs: [
      {
        id: 'dialogue-11',
        ordinal: 11,
        world: 'world_102',
        seed: 516,
        condition: 'gated',
        command: [],
        jobDir: path.join(directory, 'dialogues', 'dialogue-11'),
      },
    ],
    checkpoint,
    budget,
    runDialogue: async () => ({ status: 0, error: null }),
    collectJobResult: () => row,
  });
  assert.equal(checkpoint.dialogues[0].status, 'quarantined');
  assert.equal(checkpoint.dialogues[0].error, 'learner_analysis_coverage_below_one: turns 5');
  assert.equal(checkpoint.quarantined_dialogues.length, 1);
});

test('representative freeze validates in the form accepted by the frozen decision runner', () => {
  const binding = { path: '/tmp/frozen', sha256: 'a'.repeat(64) };
  const freeze = {
    schema: OUTCOME_PILOT_FREEZE_SCHEMA,
    status: 'frozen',
    protocol: binding,
    corpus: binding,
    annotation_handbook: binding,
    key: binding,
    study_plan: binding,
  };
  assert.deepEqual(validateOutcomeFreezeFormForFrozenDecisionRunner(freeze), {
    status: 'passed',
    form: OUTCOME_PILOT_FREEZE_SCHEMA,
  });
});

test('continuous budget refuses the 1117th reservation', (t) => {
  const directory = temporaryDirectory(t);
  const budget = createOutcomePilotBudget({ checkpointPath: path.join(directory, 'checkpoint.json') });
  budget.reserveMany('presence_readers', 1116);
  assert.throws(() => budget.reserve('decision_readers'), /1116-call budget exhausted/u);
  assert.equal(budget.state.call_budget.actual.total, 1116);
});

test('generation cap covers the measured live per-dialogue unit (report 069: 26 calls)', () => {
  assert.ok(OUTCOME_PILOT_PER_DIALOGUE_CAP >= 26);
  assert.equal(OUTCOME_PILOT_CALL_PLAN.generation, 18 * OUTCOME_PILOT_PER_DIALOGUE_CAP);
  assert.equal(
    OUTCOME_PILOT_CALL_PLAN.total,
    OUTCOME_PILOT_CALL_PLAN.generation +
      OUTCOME_PILOT_CALL_PLAN.presence_readers +
      OUTCOME_PILOT_CALL_PLAN.decision_readers,
  );
  assert.ok(OUTCOME_PILOT_CALL_PLAN.presence_readers >= 288);
});
