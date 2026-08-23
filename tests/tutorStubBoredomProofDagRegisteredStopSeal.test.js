import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REGISTERED_STOP_FAILURE_DISPOSITIONS,
  isRegisteredStop,
  sealTutorStubBoredomProofDagBatchWithRegisteredStops,
} from '../scripts/run-tutor-stub-boredom-action-register-proof-dag.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION_PATH = path.join(ROOT, 'config/tutor-stub-boredom-action-register-proof-dag-registration.v5.json');

const TRIGGER_MISSING_STOP = Object.freeze({
  category: 'substantive_registered_failure',
  code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_TRIGGER_MISSING',
  disposition: 'substantive_registered_failure_stop_no_replacement',
  recoverable: false,
});

const INDETERMINATE_STOP = Object.freeze({
  category: 'substantive_registered_failure',
  code: 'TUTOR_STUB_BOREDOM_MEASUREMENT_INDETERMINATE',
  disposition: 'measurement_indeterminate_stop_no_repair_no_replacement',
  recoverable: false,
});

const TECHNICAL_FAILURE = Object.freeze({
  category: 'technical_recoverable',
  code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_CODEX_TRANSPORT_RETRY_EXHAUSTED',
  disposition: 'bounded_missing_or_failed_unit_recovery_eligible',
  recoverable: true,
});

// The registration is the authority for which endings stop a unit for good.
// This walks it rather than trusting a list written here, so a stop added to
// the registration and not to the runtime fails a test instead of surfacing as
// an unsealable paid batch.
function registeredStopDispositionsFromRegistration() {
  const design = JSON.parse(fs.readFileSync(REGISTRATION_PATH, 'utf8')).design.freshPrefixGeneration;
  return Object.entries(design)
    .filter(([key, value]) => key.endsWith('Disposition') && typeof value === 'string' && value.includes('stop'))
    .map(([, value]) => value);
}

function writeTrace(directory, events) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, '2026-08-22T00-00-00-000Z.jsonl'),
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
}

const RESERVED = { type: 'model_call_budget_reserved' };
const COMPLETED = { type: 'resistance_action_register_outcome_learner_turn' };
const TRANSPORT_EXHAUSTED = {
  type: 'model_call_error',
  cliPolicyViolation: { reason: 'call_retry_limit_reached', audit: { prohibited_event_count: 0 } },
};
const TRIGGER_MISSING_EVENT = {
  type: 'resistance_action_register_boredom_proof_dag_substantive_failure',
  code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_TRIGGER_MISSING',
  disposition: 'substantive_registered_failure_stop_no_replacement',
};

function sha256Of(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// A four-unit batch whose first pass lost two units to transport failures, and
// whose one allowed recovery brought one back and ended the other in a
// registered stop. This is the shape the live run actually produced.
function buildSpentRecoveryBatch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boredom-stop-seal-'));
  const ids = ['unit-1', 'unit-2', 'unit-3', 'unit-4'];
  const recoveredIds = ['unit-2', 'unit-4'];
  const jobs = ids.map((id) => ({
    id,
    batch_id: 'execution_batch_test',
    command: { job_root: path.join(root, 'jobs', id), trace_dir: path.join(root, 'jobs', id, 'traces') },
  }));
  for (const job of jobs) {
    writeTrace(
      job.command.trace_dir,
      recoveredIds.includes(job.id) ? [RESERVED, TRANSPORT_EXHAUSTED] : [RESERVED, RESERVED, COMPLETED],
    );
  }
  fs.writeFileSync(
    path.join(root, 'batch-plan.json'),
    `${JSON.stringify(
      {
        batch_id: 'execution_batch_test',
        destination: root,
        budget: {
          dialogues: 4,
          maximum_model_attempt_reservations_per_dialogue: 123,
          maximum_model_attempt_reservations: 492,
        },
        jobs,
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(root, 'batch-result.json'),
    `${JSON.stringify(
      {
        batch_id: 'execution_batch_test',
        status: 'incomplete',
        results: jobs.map((job) => {
          const failed = recoveredIds.includes(job.id);
          return {
            job_id: job.id,
            status: failed ? 'failed' : 'complete',
            trace: path.join(job.command.trace_dir, '2026-08-22T00-00-00-000Z.jsonl'),
            trace_sha256: `initial-${job.id}`,
            failure: failed ? { ...TECHNICAL_FAILURE } : null,
          };
        }),
      },
      null,
      2,
    )}\n`,
  );
  const recoveryRoot = path.join(root, 'recoveries', 'recovery-001');
  const recoveryJobs = recoveredIds.map((id) => ({
    id,
    batch_id: 'execution_batch_test',
    command: {
      job_root: path.join(recoveryRoot, 'jobs', id),
      trace_dir: path.join(recoveryRoot, 'jobs', id, 'traces'),
    },
  }));
  writeTrace(recoveryJobs[0].command.trace_dir, [RESERVED, COMPLETED]);
  writeTrace(recoveryJobs[1].command.trace_dir, [RESERVED, TRIGGER_MISSING_EVENT]);
  fs.mkdirSync(recoveryRoot, { recursive: true });
  fs.writeFileSync(
    path.join(recoveryRoot, 'recovery-plan.json'),
    `${JSON.stringify(
      {
        batch_id: 'execution_batch_test',
        original_plan_sha256: sha256Of(path.join(root, 'batch-plan.json')),
        original_result_sha256: sha256Of(path.join(root, 'batch-result.json')),
        jobs: recoveryJobs,
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(recoveryRoot, 'recovery-result.json'),
    `${JSON.stringify(
      {
        batch_id: 'execution_batch_test',
        results: [
          {
            job_id: 'unit-2',
            status: 'complete',
            trace: path.join(recoveryJobs[0].command.trace_dir, '2026-08-22T00-00-00-000Z.jsonl'),
            trace_sha256: 'recovered-unit-2',
            failure: null,
          },
          {
            job_id: 'unit-4',
            status: 'failed',
            trace: path.join(recoveryJobs[1].command.trace_dir, '2026-08-22T00-00-00-000Z.jsonl'),
            trace_sha256: 'stopped-unit-4',
            failure: { ...TRIGGER_MISSING_STOP },
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return root;
}

test('both registered stops the v5 registration names are recognised as stops', () => {
  assert.equal(isRegisteredStop(INDETERMINATE_STOP), true);
  assert.equal(isRegisteredStop(TRIGGER_MISSING_STOP), true);
  assert.equal(isRegisteredStop(TECHNICAL_FAILURE), false);
  assert.equal(isRegisteredStop(null), false);
  assert.equal(isRegisteredStop({ ...TRIGGER_MISSING_STOP, recoverable: true }), false);
  assert.equal(isRegisteredStop({ ...TRIGGER_MISSING_STOP, disposition: 'something_else' }), false);
});

test('the registration names no stop the runtime cannot recognise', () => {
  const registered = registeredStopDispositionsFromRegistration();
  assert.equal(registered.length, REGISTERED_STOP_FAILURE_DISPOSITIONS.length);
  assert.equal(
    registered.some((value) => value.startsWith('measurement_indeterminate_stop')),
    true,
  );
  assert.equal(
    registered.some((value) => value === 'stop_incomplete_no_replacement_no_analysis'),
    true,
  );
  // The registration and the runtime spell the same two endings differently,
  // so the map is checked by what each side means, not by string equality.
  assert.deepEqual([...REGISTERED_STOP_FAILURE_DISPOSITIONS].sort(), [
    'measurement_indeterminate_stop_no_repair_no_replacement',
    'substantive_registered_failure_stop_no_replacement',
  ]);
});

test('a batch whose one recovery ended in a registered stop can still be sealed', () => {
  const root = buildSpentRecoveryBatch();
  const seal = sealTutorStubBoredomProofDagBatchWithRegisteredStops({ destination: root });

  assert.equal(seal.status, 'sealed_with_registered_stops');
  assert.equal(seal.dialogues, 4);
  assert.equal(seal.completed_dialogues, 3);
  assert.deepEqual(seal.registered_indeterminate_stops, ['unit-4']);
  assert.equal(seal.valid_unit_reruns, false);
  assert.equal(seal.outcome_selection, false);
  assert.ok(seal.recovery_plan_sha256);
  assert.ok(seal.recovery_result_sha256);
  assert.equal(seal.observed_model_attempt_reservations, 8);

  const final = JSON.parse(fs.readFileSync(path.join(root, 'batch-final-result.json'), 'utf8'));
  assert.equal(final.status, 'incomplete');
  assert.equal(final.completed_dialogues, 3);
  assert.equal(final.failed_or_missing_dialogues, 1);
  assert.equal(final.technical_recovery_used, true);
  assert.deepEqual(final.recovery_unit_ids.sort(), ['unit-2', 'unit-4']);
  assert.equal(final.results.length, 4);
  assert.equal(final.observed_model_attempt_reservations, 8);
  assert.equal(seal.result_sha256, sha256Of(path.join(root, 'batch-final-result.json')));

  const byId = new Map(final.results.map((row) => [row.job_id, row]));
  assert.equal(byId.get('unit-1').origin, 'initial_valid_unit');
  assert.equal(byId.get('unit-1').trace_sha256, 'initial-unit-1');
  assert.equal(byId.get('unit-2').origin, 'bounded_technical_recovery_missing_or_failed_unit');
  assert.equal(byId.get('unit-2').trace_sha256, 'recovered-unit-2');
  assert.equal(byId.get('unit-4').status, 'failed');
  assert.equal(byId.get('unit-4').trace_sha256, 'stopped-unit-4');
  assert.equal(isRegisteredStop(byId.get('unit-4').failure), true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('the seal still refuses a recovery whose units all completed', () => {
  const root = buildSpentRecoveryBatch();
  const recoveryResultPath = path.join(root, 'recoveries', 'recovery-001', 'recovery-result.json');
  const recovery = JSON.parse(fs.readFileSync(recoveryResultPath, 'utf8'));
  recovery.results[1] = { ...recovery.results[1], status: 'complete', failure: null };
  writeTrace(path.join(root, 'recoveries', 'recovery-001', 'jobs', 'unit-4', 'traces'), [RESERVED, COMPLETED]);
  fs.writeFileSync(recoveryResultPath, `${JSON.stringify(recovery, null, 2)}\n`);

  assert.throws(
    () => sealTutorStubBoredomProofDagBatchWithRegisteredStops({ destination: root }),
    /refuses a recovery that completed/,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('the seal still refuses a recovery that ended in an unregistered failure', () => {
  const root = buildSpentRecoveryBatch();
  const recoveryResultPath = path.join(root, 'recoveries', 'recovery-001', 'recovery-result.json');
  const recovery = JSON.parse(fs.readFileSync(recoveryResultPath, 'utf8'));
  recovery.results[1] = {
    ...recovery.results[1],
    failure: {
      category: 'unclassified_nonrecoverable',
      code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_FAILURE_UNCLASSIFIED',
      disposition: 'manual_review_required_no_recovery',
      recoverable: false,
    },
  };
  fs.writeFileSync(recoveryResultPath, `${JSON.stringify(recovery, null, 2)}\n`);

  assert.throws(
    () => sealTutorStubBoredomProofDagBatchWithRegisteredStops({ destination: root }),
    /neither complete nor a registered stop/,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

// The v5 registration says an uneven block needs no amendment, because it
// conditions on realised per-world counts from the start. The analyzer's gate
// was written for v4 and hard-carried v4's answer. These pin the two apart, so
// a registration that changes its conditioning cannot silently disagree with
// the reader again.
test('v5 registers the realised-count conditioning the analyzer gate reads', () => {
  const registration = JSON.parse(fs.readFileSync(REGISTRATION_PATH, 'utf8'));
  assert.equal(
    registration.measurement.primaryEndpoint.conditioning,
    'condition_on_each_world_success_total_and_that_world_realised_plain_and_warm_counts',
  );
  assert.match(registration.measurement.primaryEndpoint.conditioningNote, /needs no amendment/);
});

test('v4 does not register it, so a short v4 study still needs a written amendment', () => {
  const v4Path = path.join(ROOT, 'config/tutor-stub-boredom-action-register-proof-dag-registration.v4.json');
  const registration = JSON.parse(fs.readFileSync(v4Path, 'utf8'));
  assert.equal(
    registration.measurement.primaryEndpoint.conditioning,
    'condition_on_each_world_success_total_and_the_predeclared_three_plain_three_warm_allocation',
  );
});
