import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  configureTutorStubResistanceManipulationValidationFromCli,
  loadTutorStubResistanceManipulationValidation,
} from '../services/tutorStubResistanceActionRegisterManipulationValidation.js';
import { assembleTutorStubResistanceManipulationValidationReport } from '../scripts/run-tutor-stub-resistance-action-register-manipulation-validation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN = 'config/tutor-stub-resistance-action-register-manipulation-validation.v1.json';

test('manipulation-validation design builds 60 unique balanced fresh jobs', () => {
  const loaded = loadTutorStubResistanceManipulationValidation({ designPath: DESIGN, root: ROOT });
  assert.equal(loaded.plan.jobs.length, 60);
  assert.equal(loaded.plan.jobs.filter((job) => job.realization === 'plain').length, 30);
  assert.equal(loaded.plan.jobs.filter((job) => job.realization === 'warm').length, 30);
  assert.equal(new Set(loaded.plan.jobs.map((job) => job.id)).size, 60);
  assert.equal(new Set(loaded.plan.jobs.map((job) => job.run_seed)).size, 60);
  for (let index = 1; index <= 10; index += 1) {
    const block = loaded.plan.jobs.filter((job) => job.block_id === `block_${String(index).padStart(2, '0')}`);
    assert.equal(block.length, 6);
    assert.equal(block.filter((job) => job.realization === 'plain').length, 3);
    assert.equal(block.filter((job) => job.realization === 'warm').length, 3);
  }
});

test('CLI configuration pins the validation dialogue and exposes no outcome horizon', () => {
  const loaded = loadTutorStubResistanceManipulationValidation({ designPath: DESIGN, root: ROOT });
  const job = loaded.plan.jobs[0];
  const state = { turns: [], history: [], trace: null };
  const events = [];
  configureTutorStubResistanceManipulationValidationFromCli({
    args: {
      'resistance-action-register-manipulation-validation-design': DESIGN,
      'resistance-action-register-manipulation-validation-job': job.id,
      'model-call-budget': '69',
      model: 'codex.gpt-5.6-luna',
      'classifier-model': 'codex.gpt-5.6-luna',
      'learner-record-model': 'codex.gpt-5.6-luna',
      'auto-learner-model': 'codex.gpt-5.6-luna',
      'cli-effort': 'low',
      'run-seed': String(job.run_seed),
      'eval-repeat': String(job.assignment_index),
      'eval-job-id': job.id,
      'no-opening': false,
      'acknowledge-research-use': true,
    },
    state,
    root: ROOT,
    autoLearnerEnabled: true,
    autoTurns: 2,
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    observationSemantics: 'prospective_frame_resistance_semantic_v5',
  });
  assert.equal(state.resistanceActionRegisterStudy.manipulation_validation, true);
  assert.equal(state.resistanceActionRegisterStudy.realization, job.realization);
  assert.equal(state.resistanceActionRegisterStudy.outcome_horizon_learner_turns, 0);
  assert.equal(state.resistanceActionRegisterStudy.final_learner_without_tutor_reply, false);
  assert.equal(events[0].confirmationOutcomeGeneratedOrJudged, false);
});

test('sealed report requires complete execution and every predeclared arm gate', () => {
  const loaded = loadTutorStubResistanceManipulationValidation({ designPath: DESIGN, root: ROOT });
  Object.defineProperty(loaded.design, '__sha256', { value: loaded.sha256, enumerable: false });
  const rows = loaded.plan.jobs.map((job) => ({
    case_id: job.id,
    assignment: job.realization,
    exit: { code: 0, signal: null },
    trace: `traces/${job.id}.jsonl`,
    transcript: `transcripts/${job.id}.json`,
    fidelity: {
      status: 'determinate',
      action_measurement: { status: 'determinate', value: 'yes' },
      register_measurement: { status: 'determinate', value: job.realization },
    },
  }));
  const passed = assembleTutorStubResistanceManipulationValidationReport(rows, loaded.design);
  assert.equal(passed.status, 'passed');
  assert.equal(passed.confirmation_launch_allowed, true);
  assert.ok(Object.values(passed.gates).every(Boolean));

  rows[0].exit.code = 1;
  const failed = assembleTutorStubResistanceManipulationValidationReport(rows, loaded.design);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.gates.execution_complete, false);
  assert.equal(failed.confirmation_launch_allowed, false);
});

test('the contrast repair audit note is carried as a digest record beside the two registrations', () => {
  const loaded = loadTutorStubResistanceManipulationValidation({ designPath: DESIGN, root: ROOT });
  assert.deepEqual(
    loaded.digestRecords.map((row) => row.label),
    ['base registration', 'fidelity instrument registration', 'contrast repair audit'],
  );
  const note = loaded.digestRecords.find((row) => row.label === 'contrast repair audit');
  assert.equal(note.path, loaded.design.execution.contrastRepairAuditPath);
  assert.equal(note.recordedSha256, loaded.design.execution.contrastRepairAuditSha256);
  assert.match(note.observedSha256, /^[0-9a-f]{64}$/u);
  assert.equal(typeof note.drifted, 'boolean');
});

test('a drifted contrast repair audit note is recorded by the loader, not refused', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'manip-validation-audit-drift-'));
  try {
    for (const relative of [
      'config/tutor-stub-resistance-action-register-crossed-registration.v9.json',
      'config/tutor-stub-resistance-action-register-crossed-registration.v10.json',
      'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v8.json',
      'notes/2026-08-22-v10-plain-warm-contrast-zero-call-audit.md',
    ]) {
      const target = path.join(fixture, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(ROOT, relative), target);
    }
    const design = JSON.parse(fs.readFileSync(path.join(ROOT, DESIGN), 'utf8'));
    design.execution.contrastRepairAuditSha256 = '0'.repeat(64);
    fs.writeFileSync(path.join(fixture, DESIGN), JSON.stringify(design, null, 2));

    const loaded = loadTutorStubResistanceManipulationValidation({ designPath: DESIGN, root: fixture });
    const note = loaded.digestRecords.find((row) => row.label === 'contrast repair audit');
    assert.equal(note.drifted, true);
    assert.equal(note.recordedSha256, '0'.repeat(64));
    assert.notEqual(note.observedSha256, note.recordedSha256);
    assert.equal(loaded.plan.jobs.length, 60);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
