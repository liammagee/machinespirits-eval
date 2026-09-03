import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ACTION_OUTCOME_COLLECTION_PHASE_PLAN,
  createActionOutcomeCollectionWorkflowStatus,
} from '../services/actionOutcomeCollectionWorkflowStatus.js';
import {
  blockLongRunningWorkflow,
  completeLongRunningWorkflowPhase,
  estimateLongRunningWorkflowEta,
  loadLongRunningWorkflowStatus,
  startLongRunningWorkflowPhase,
  updateLongRunningWorkflowProgress,
  writeLongRunningWorkflowStatusAtomic,
} from '../services/longRunningWorkflowStatus.js';
import { renderLongRunningWorkflowStatus } from '../scripts/report-long-running-workflow-status.js';

const START = '2026-09-02T12:00:00.000Z';

function initialStatus() {
  return createActionOutcomeCollectionWorkflowStatus({
    workflowId: 'fixture-action-outcome-workflow',
    at: START,
    units: { complete: 0, active: 0, failed: 0, missing: 4 },
    calls: { completed: 0, failed: 0, reserved: 0, hard_ceiling: 400 },
  });
}

function generationHandoff() {
  return completeLongRunningWorkflowPhase(initialStatus(), {
    phase: 'GENERATING',
    nextPhase: 'EXTRACTING',
    at: '2026-09-02T12:10:00.000Z',
    handoffExplanation: 'Generation is sealed and extraction has not started.',
    units: { complete: 4, active: 0, failed: 0, missing: 0 },
    calls: { completed: 100, failed: 0, reserved: 400, hard_ceiling: 400 },
    recentUnitDurationsMs: [100_000, 110_000, 90_000, 105_000],
    modelActivity: {
      state: 'inactive',
      explanation: 'The generation process is sealed and no child is running.',
    },
    nextAction: {
      description: 'Start zero-call extraction.',
      stopping_condition: 'Stop on a source or schema mismatch.',
    },
  });
}

test('action-outcome workflow preserves the full ordered phase sequence through true completion', () => {
  assert.deepEqual(ACTION_OUTCOME_COLLECTION_PHASE_PLAN, [
    'PREFLIGHT',
    'GENERATING',
    'EXTRACTING',
    'AUDITING',
    'PACKAGING',
    'WORKFLOW_COMPLETE',
  ]);
  assert.throws(
    () => startLongRunningWorkflowPhase(initialStatus(), { phase: 'AUDITING', at: START }),
    /incomplete preceding phases/u,
  );
  let status = generationHandoff();
  status = startLongRunningWorkflowPhase(status, {
    phase: 'EXTRACTING',
    at: '2026-09-02T12:11:00.000Z',
    modelActivity: { state: 'inactive', explanation: 'Extraction is zero-call.' },
  });
  status = completeLongRunningWorkflowPhase(status, {
    phase: 'EXTRACTING',
    nextPhase: 'AUDITING',
    at: '2026-09-02T12:12:00.000Z',
    startNextImmediately: true,
    modelActivity: { state: 'inactive', explanation: 'Audit is zero-call.' },
  });
  status = completeLongRunningWorkflowPhase(status, {
    phase: 'AUDITING',
    nextPhase: 'PACKAGING',
    at: '2026-09-02T12:13:00.000Z',
    handoffExplanation: 'Audit is complete and packet preparation has not started.',
  });
  status = startLongRunningWorkflowPhase(status, {
    phase: 'PACKAGING',
    at: '2026-09-02T12:14:00.000Z',
    modelActivity: { state: 'inactive', explanation: 'Packaging is zero-call.' },
  });
  status = completeLongRunningWorkflowPhase(status, {
    phase: 'PACKAGING',
    nextPhase: 'WORKFLOW_COMPLETE',
    at: '2026-09-02T12:15:00.000Z',
    startNextImmediately: true,
  });

  assert.equal(status.current_phase, 'WORKFLOW_COMPLETE');
  assert.equal(status.workflow_status, 'complete');
  assert.deepEqual(status.completed_phases, ACTION_OUTCOME_COLLECTION_PHASE_PLAN);
  assert.equal(status.model_activity.state, 'inactive');
});

test('generation completion becomes an explicit silent-handoff state, not workflow completion', () => {
  const status = generationHandoff();
  assert.equal(status.current_phase, 'HANDOFF_PENDING');
  assert.equal(status.phase_status, 'pending');
  assert.equal(status.workflow_status, 'handoff_pending');
  assert.deepEqual(status.completed_phases, ['PREFLIGHT', 'GENERATING']);
  assert.equal(status.blocker.next_phase, 'EXTRACTING');
  assert.match(status.blocker.message, /extraction has not started/u);
  assert.equal(status.model_activity.state, 'inactive');
  assert.notEqual(status.workflow_status, 'complete');
});

test('bounded recovery is a distinct phase with durable recovery history', () => {
  const status = createActionOutcomeCollectionWorkflowStatus({
    workflowId: 'fixture-action-outcome-recovery',
    at: START,
    recovering: true,
  });
  assert.equal(status.current_phase, 'RECOVERING');
  assert.equal(status.repair_or_recovery_history.length, 1);
  assert.equal(status.repair_or_recovery_history[0].kind, 'recovery');
  assert.match(status.repair_or_recovery_history[0].scope, /never-attempted units/u);
});

test('canonical workflow status renders concise human-readable headings', () => {
  const output = renderLongRunningWorkflowStatus(generationHandoff());
  assert.deepEqual(
    output
      .split('\n')
      .slice(0, 11)
      .map((line) => line.split(':', 1)[0]),
    [
      'State',
      'What is happening now',
      'Overall progress',
      'Timing',
      'Model activity',
      'Units',
      'Calls',
      'Repairs or recovery',
      'Current issue',
      'Next action',
      'Human decision required',
    ],
  );
  assert.match(output, /^State: HANDOFF_PENDING \(handoff_pending\)$/mu);
  assert.match(output, /^Model activity: inactive /mu);
});

test('a blocked extraction records the observed defect and complete repair disclosure', () => {
  const extracting = startLongRunningWorkflowPhase(generationHandoff(), {
    phase: 'EXTRACTING',
    at: '2026-09-02T12:11:00.000Z',
    modelActivity: { state: 'inactive', explanation: 'Extraction is zero-call.' },
  });
  const blocked = blockLongRunningWorkflow(extracting, {
    blockedPhase: 'EXTRACTING',
    operation: 'Load the registered v2 extraction schema',
    error: 'unsupported collection design version: v2',
    at: '2026-09-02T12:11:05.000Z',
    repairRequired: true,
    repair: {
      paid_work_or_data_affected: 'No paid work or sealed data was changed; generation was already sealed.',
      why_code_change_required: 'The maintained loader dispatches only the historical v1 schema.',
      proposed_change: 'Dispatch v2 to its registered loader and add a version-routing regression.',
      remains_blocked: 'Extraction and all later phases remain blocked until the repair passes review.',
      eta_after_repair: 'inferred 5–10 minutes from the focused test duration',
    },
    modelActivity: { state: 'inactive', explanation: 'The failed extraction is zero-call.' },
    nextAction: {
      description: 'Implement and review the version-routing repair.',
      stopping_condition: 'Stop until the focused regression and audit preflight pass.',
    },
  });

  assert.equal(blocked.current_phase, 'BLOCKED');
  assert.equal(blocked.blocker.blocked_phase, 'EXTRACTING');
  assert.equal(blocked.blocker.repair_required, true);
  assert.equal(blocked.repair_or_recovery_history.length, 1);
  assert.match(blocked.repair_or_recovery_history[0].observed_error, /unsupported collection design/u);
  assert.match(blocked.repair_or_recovery_history[0].proposed_change, /Dispatch v2/u);
  assert.equal(blocked.model_activity.state, 'inactive');
});

test('ETA is inferred from recent completed units and unavailable without enough evidence', () => {
  const inferred = estimateLongRunningWorkflowEta({
    recentUnitDurationsMs: [60_000, 120_000, 90_000],
    remainingUnits: 2,
    asOf: START,
  });
  assert.equal(inferred.eta_range.basis, 'inferred');
  assert.equal(inferred.eta_range.earliest_at, '2026-09-02T12:02:00.000Z');
  assert.equal(inferred.eta_range.latest_at, '2026-09-02T12:04:00.000Z');
  assert.equal(inferred.recent_observed_pace.sample_size, 3);

  const unavailable = estimateLongRunningWorkflowEta({
    recentUnitDurationsMs: [60_000],
    remainingUnits: 2,
    asOf: START,
  });
  assert.equal(unavailable.eta_range.basis, 'unavailable');
  assert.match(unavailable.eta_range.explanation, /At least two/u);
});

test('atomic status loading recovers the previous valid record after an interrupted primary write', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'long-workflow-status-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'status.json');
  const first = initialStatus();
  writeLongRunningWorkflowStatusAtomic(target, first);
  const second = updateLongRunningWorkflowProgress(first, {
    at: '2026-09-02T12:01:00.000Z',
    units: { complete: 1, active: 0, failed: 0, missing: 3 },
    calls: { completed: 25, failed: 0, reserved: 100, hard_ceiling: 400 },
    recentUnitDurationsMs: [60_000],
  });
  writeLongRunningWorkflowStatusAtomic(target, second);
  fs.writeFileSync(target, '{"interrupted":');

  const loaded = loadLongRunningWorkflowStatus(target);
  assert.equal(loaded.status.units.complete, 0);
  assert.equal(loaded.recovered_from, `${target}.previous`);
  assert.match(loaded.warnings[0], /Recovered workflow status/u);

  writeLongRunningWorkflowStatusAtomic(target, second);
  fs.writeFileSync(target, '{"interrupted-again":');
  const recoveredAgain = loadLongRunningWorkflowStatus(target);
  assert.equal(recoveredAgain.status.units.complete, 0, 'a corrupt primary must not replace the valid backup');
});
