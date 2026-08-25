import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { classifyTraceEvents, analyzeRunRoot } from '../scripts/analyze-merged-calibration-trigger-window-clip.js';

const RIVAL_V3 = 'machinespirits.tutor-stub.rival-attention-adjudication.v3';
const BOREDOM_V1 = 'machinespirits.tutor-stub.boredom-semantic-adjudication.v1';

function adjudication(turn, schema, disposition) {
  return {
    type: 'boredom_semantic_adjudication',
    turn,
    adjudication: { schema, measurement_disposition: disposition },
  };
}

function passedOver(turn, maximumTriggerTurn) {
  return {
    type: 'boredom_semantic_measurement_indeterminate_passed_over',
    turn,
    maximumTriggerTurn,
  };
}

function exhausted(turn) {
  return { type: 'auto_learner_profile_adherence_exhausted', turn, profile: 'bored' };
}

test('a unit killed at turn 2 with no trigger fired, inside the open window, is a window clip', () => {
  const result = classifyTraceEvents([
    adjudication(1, RIVAL_V3, 'measurement_indeterminate'),
    passedOver(1, 4),
    exhausted(2),
  ]);
  assert.equal(result.classification, 'trigger_window_clip');
  assert.equal(result.triggerTurn, null);
  assert.equal(result.exhaustedTurn, 2);
  assert.equal(result.windowEnd, 4);
});

test('a unit judged by the boredom v1 instrument is wrong_instrument, not a window clip', () => {
  const result = classifyTraceEvents([
    adjudication(1, BOREDOM_V1, 'measurement_indeterminate'),
    passedOver(1, 4),
    exhausted(2),
  ]);
  assert.equal(result.classification, 'wrong_instrument');
});

test('a unit whose trigger fired before the kill is not a window clip', () => {
  const result = classifyTraceEvents([adjudication(1, RIVAL_V3, 'rival_attention_trigger'), exhausted(2)]);
  assert.equal(result.classification, 'other_substantive');
  assert.equal(result.triggerTurn, 1);
});

test('a unit killed after the window closed is not a window clip', () => {
  const result = classifyTraceEvents([
    adjudication(1, RIVAL_V3, 'measurement_indeterminate'),
    passedOver(1, 4),
    exhausted(5),
  ]);
  assert.equal(result.classification, 'other_substantive');
});

test('analyzeRunRoot reads the ledger and traces and flags only the clipped unit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'window-clip-test-'));
  const ledger = [
    {
      type: 'unit_complete',
      job_id: 'clipped-unit',
      face_id: 'faceA',
      status: 'retained_substantive_failure',
      registered_failure_code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED',
    },
    {
      type: 'unit_complete',
      job_id: 'triggered-unit',
      face_id: 'faceA',
      status: 'retained_substantive_failure',
      registered_failure_code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED',
    },
    { type: 'unit_complete', job_id: 'faceB-unit', face_id: 'faceB', status: 'complete' },
  ];
  fs.writeFileSync(path.join(root, 'run-ledger.jsonl'), ledger.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
  const traces = {
    'clipped-unit': [adjudication(1, RIVAL_V3, 'measurement_indeterminate'), passedOver(1, 4), exhausted(2)],
    'triggered-unit': [adjudication(1, RIVAL_V3, 'rival_attention_trigger'), exhausted(3)],
  };
  for (const [jobId, events] of Object.entries(traces)) {
    const tracesDir = path.join(root, 'jobs', jobId, 'traces');
    fs.mkdirSync(tracesDir, { recursive: true });
    fs.writeFileSync(
      path.join(tracesDir, 'attempt-1.jsonl'),
      events.map((event) => JSON.stringify(event)).join('\n') + '\n',
    );
  }
  const report = analyzeRunRoot(root);
  assert.equal(report.deadFaceAUnitCount, 2);
  assert.deepEqual(
    report.windowClipped.map((unit) => unit.jobId),
    ['clipped-unit'],
  );
  assert.deepEqual(
    report.wrongInstrument.map((unit) => unit.jobId),
    [],
  );
  fs.rmSync(root, { recursive: true, force: true });
});
