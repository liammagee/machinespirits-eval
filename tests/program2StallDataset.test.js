import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { auditProgram2StallCandidate, PROGRAM2_STALL_DETECTOR_VERSION } from '../services/program2StallAudit.js';
import { buildProgram2StallDataset } from '../services/program2StallDataset.js';

function assignment({ duePremises = ['p_due'] } = {}) {
  return {
    schema: 'machinespirits.tutor-stub.point-of-action-turn.v1',
    detector_version: PROGRAM2_STALL_DETECTOR_VERSION,
    arm: 'committee',
    turn: 7,
    assigned_trigger: 'stagnant_repeat',
    inputs: {
      stagnation: 0.8,
      proposed_action_family: 'stage_next_step',
      previous_action_families: ['stage_next_step', 'stage_next_step', 'stage_next_step', 'stage_next_step'],
      due_premises: duePremises,
    },
  };
}

function compliance() {
  return {
    schema: 'machinespirits.tutor-stub.point-of-action-compliance.v1',
    detector_version: PROGRAM2_STALL_DETECTOR_VERSION,
    arm: 'committee',
    turn: 7,
    trigger: 'stagnant_repeat',
    compliant: true,
    realized_action_family: 'stage_next_step',
    released_premise_count: 1,
    question_count: 1,
  };
}

function turnRecord(text) {
  return {
    turn: 7,
    turnId: 'job-1:t007',
    tutor: text,
    tutorLeakAudit: { ok: true },
    tutorGuardAccounting: {
      outcome: 'guarded_original_accepted',
      originalCandidate: { audits: { leakAudit: { ok: true } } },
      finalDelivery: { audits: { auditOk: true } },
    },
  };
}

function writeFixture(root) {
  const text = 'Here is the due public premise. What follows?';
  fs.mkdirSync(path.join(root, 'traces', 'job-1'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'launch-plan.json'),
    JSON.stringify({ plan: { jobs: [{ id: 'job-1', arm: 'committee', profile: 'proof_skipper' }] } }),
  );
  const events = [
    { type: 'run_start', metadata: { provenance: { git: { sha: 'abc' } } } },
    { type: 'point_of_action_assignment', turn: 7, turnId: 'job-1:t007', pointOfAction: assignment() },
    { type: 'point_of_action_compliance', turn: 7, turnId: 'job-1:t007', compliance: compliance() },
    {
      type: 'model_call',
      role: 'tutor_stub_tutor',
      turn: 7,
      turnId: 'job-1:t007',
      request: { systemPrompt: 'Teach safely.', messages: [], config: { maxTokens: 100 } },
      response: { text },
    },
    { type: 'turn_complete', turn: 7, turnId: 'job-1:t007', turnRecord: turnRecord(text) },
    { type: 'run_end' },
  ];
  fs.writeFileSync(
    path.join(root, 'traces', 'job-1', 'sealed.jsonl'),
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
}

describe('Program-2 exploratory stall dataset', () => {
  it('requires an explicit override when the frozen corpus floor fails', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-stall-dataset-gate-'));
    try {
      writeFixture(tmpDir);
      assert.throws(
        () =>
          buildProgram2StallDataset({
            rootSpecs: [{ label: 'fixture', root: tmpDir }],
            outputDir: path.join(tmpDir, 'out'),
          }),
        /stall corpus gate failed/u,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('emits a deterministic, explicitly unlicensed under-floor dataset', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-stall-dataset-'));
    try {
      writeFixture(tmpDir);
      const outputDir = path.join(tmpDir, 'out');
      const result = buildProgram2StallDataset({
        rootSpecs: [{ label: 'fixture', root: tmpDir }],
        outputDir,
        allowUnderFloor: true,
      });
      assert.equal(result.report.rawMoments, 1);
      assert.equal(result.report.sourceEligible, 1);
      assert.equal(result.report.licensedForTraining, false);
      assert.equal(result.report.splits.trainEligible, 1);
      assert.equal(result.evaluationRows[0].freshTextAuditability, 'deterministic_due_release');
      assert.equal(fs.readFileSync(path.join(outputDir, 'taskB-stall-sft.jsonl'), 'utf8').trim().length > 0, true);
      const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'stall-dataset-manifest.json'), 'utf8'));
      assert.match(manifest.trainingProhibitedReason, /1\/100/u);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('grades due-premise text deterministically and refuses to invent a no-due semantic action label', () => {
    const due = auditProgram2StallCandidate({
      assignment: assignment(),
      tutorText: 'Here is the due premise. What follows?',
      releasedPremiseCount: 1,
      guardsPassed: true,
    });
    assert.equal(due.evaluable, true);
    assert.equal(due.compliant, true);

    const noDue = auditProgram2StallCandidate({
      assignment: assignment({ duePremises: [] }),
      tutorText: 'Try a different public exhibit. What follows?',
      releasedPremiseCount: 0,
      guardsPassed: true,
    });
    assert.equal(noDue.evaluable, false);
    assert.equal(noDue.compliant, null);
    assert.match(noDue.unevaluableReason, /not observable from text alone/u);
  });
});
