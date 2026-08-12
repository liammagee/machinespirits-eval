import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  OUTCOME_PILOT_CHECKPOINT_SCHEMA,
  OUTCOME_PILOT_FREEZE_SCHEMA,
  createOutcomePilotBudget,
  executeOutcomePilot,
  runOutcomeGeneration,
  runReadersAfterFingerprintGuard,
  validateOutcomeFreezeFormForFrozenDecisionRunner,
  verifyOutcomePilotManifestBindings,
} from '../scripts/run-adaptive-warrant-outcome-pilot.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-pilot-harness-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function fingerprintCase(index) {
  return {
    transcript_before_decision: [{ turn: index, learner: `learner ${index}`, tutor: `tutor ${index}` }],
    current_learner_turn: { turn: index, learner: `current ${index}` },
    learner_record_at_decision: { grounded_count: index, voiced_derived_count: 0, total: index },
    learner_record_trajectory: [{ turn: index, grounded_count: index, voiced_derived_count: 0, total: index }],
  };
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

test('annotationCaseFingerprint failure blocks reader admission', async () => {
  let readerCalls = 0;
  await assert.rejects(
    runReadersAfterFingerprintGuard({
      cases: [fingerprintCase(1)],
      expectedCount: 2,
      runReaders: async () => { readerCalls += 1; },
    }),
    /expected 2 cases, got 1/u,
  );
  assert.equal(readerCalls, 0);
});

test('checkpoint resume skips a completed dialogue', async (t) => {
  const directory = temporaryDirectory(t);
  const checkpointPath = path.join(directory, 'checkpoint.json');
  const checkpoint = {
    schema: OUTCOME_PILOT_CHECKPOINT_SCHEMA,
    status: 'generation',
    call_budget: {
      plan: { generation: 18, presence_readers: 288, decision_readers: 288, total: 594 },
      actual: { generation: 1, presence_readers: 0, decision_readers: 0, total: 1 },
      delta: { generation: 17, presence_readers: 288, decision_readers: 288, total: 593 },
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
    runDialogue: async () => { launches += 1; return { status: 1 }; },
  });
  assert.equal(launches, 0);
  assert.equal(checkpoint.dialogues.length, 1);
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

test('continuous budget refuses the 595th reservation', (t) => {
  const directory = temporaryDirectory(t);
  const budget = createOutcomePilotBudget({ checkpointPath: path.join(directory, 'checkpoint.json') });
  budget.reserveMany('presence_readers', 594);
  assert.throws(() => budget.reserve('decision_readers'), /594-call budget exhausted/u);
  assert.equal(budget.state.call_budget.actual.total, 594);
});
