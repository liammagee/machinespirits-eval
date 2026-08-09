import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FROZEN_PLAN_HASH,
  buildLearnerProfileWorldDeconfoundPlan,
  runLearnerProfileWorldDeconfoundPaidPlan,
  validateLearnerProfileWorldDeconfoundPaidGate,
  verifyLearnerProfileWorldDeconfoundDelivery,
  writeLearnerProfileWorldDeconfoundPlan,
} from '../scripts/prepare-learner-profile-world-deconfound.js';
import { readLearnerProfileWorldDeconfoundDesign } from '../scripts/review-learner-profile-world-deconfound.js';

import yaml from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('prospective deconfound plan builds twenty unique jobs over a balanced 2x2', () => {
  const outputDir = path.join(ROOT, '.test-tmp', 'learner-profile-world-plan-unit');
  const plan = buildLearnerProfileWorldDeconfoundPlan(readLearnerProfileWorldDeconfoundDesign(), {
    root: ROOT,
    outputDir,
    sourceSha: '0123456789abcdef0123456789abcdef01234567',
  });

  assert.equal(plan.status, 'prepared_not_authorized');
  assert.equal(plan.paidAuthorization, 'not_authorized');
  assert.equal(plan.jobs.length, 20);
  assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 20);
  assert.deepEqual(
    Object.values(plan.worlds).map(({ cell, sourceCell }) => ({ cell, sourceCell })),
    [
      { cell: 'record_keeper_in_alder', sourceCell: true },
      { cell: 'record_keeper_in_rowan', sourceCell: false },
      { cell: 'tenant_in_rowan', sourceCell: true },
      { cell: 'tenant_in_alder', sourceCell: false },
    ],
  );
  assert.match(plan.historicalBoundary, /not independently reproduced/u);
  assert.ok(
    plan.jobs.every((job) => {
      const index = job.argv.indexOf('--artifact-archive');
      return index >= 0 && job.argv[index + 1] === 'required';
    }),
  );
  assert.deepEqual(plan.postRunArchive, {
    liveTracePolicy: 'required',
    liveTraceBoundary: 'redacted events mirrored outside the worktree before continuation',
    requiredBeforeCloseout: true,
    script: 'scripts/archive-run-artifacts.js',
    command: 'node scripts/archive-run-artifacts.js <completed-cohort-output-dir>',
    includeTraces: true,
    reason: 'The prospective traces are primary evidence and must not remain only under ignored exports/.',
  });
});

test('prospective deconfound delivery check proves all four private briefs and public voices reach dry-run prompts', () => {
  fs.mkdirSync(path.join(ROOT, '.test-tmp'), { recursive: true });
  const outputDir = fs.mkdtempSync(path.join(ROOT, '.test-tmp', 'learner-profile-world-plan-'));
  try {
    const plan = buildLearnerProfileWorldDeconfoundPlan(readLearnerProfileWorldDeconfoundDesign(), {
      root: ROOT,
      outputDir,
      sourceSha: '0123456789abcdef0123456789abcdef01234567',
    });
    const planPath = writeLearnerProfileWorldDeconfoundPlan(plan, { root: ROOT });
    const delivery = verifyLearnerProfileWorldDeconfoundDelivery(plan, { root: ROOT });

    assert.ok(fs.existsSync(planPath));
    assert.equal(delivery.length, 4);
    assert.deepEqual(
      delivery.map(({ cell }) => cell),
      ['record_keeper_in_alder', 'record_keeper_in_rowan', 'tenant_in_rowan', 'tenant_in_alder'],
    );
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('paid plan materialization is idempotent but refuses to overwrite a drifted frozen plan', () => {
  fs.mkdirSync(path.join(ROOT, '.test-tmp'), { recursive: true });
  const outputDir = fs.mkdtempSync(path.join(ROOT, '.test-tmp', 'learner-profile-world-immutable-plan-'));
  try {
    const plan = buildLearnerProfileWorldDeconfoundPlan(readLearnerProfileWorldDeconfoundDesign(), {
      root: ROOT,
      outputDir,
      sourceSha: '0123456789abcdef0123456789abcdef01234567',
    });
    const planPath = writeLearnerProfileWorldDeconfoundPlan(plan, { root: ROOT, immutable: true });
    assert.equal(writeLearnerProfileWorldDeconfoundPlan(plan, { root: ROOT, immutable: true }), planPath);
    fs.appendFileSync(planPath, 'drift\n');
    assert.throws(
      () => writeLearnerProfileWorldDeconfoundPlan(plan, { root: ROOT, immutable: true }),
      /refusing to overwrite drifted frozen launch plan/u,
    );
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('paid gate requires the one-line authorization flip and the tracked frozen certificate', () => {
  const designPath = path.join(ROOT, 'config', 'learner-profile-world-deconfound.yaml');
  const certificatePath = path.join(ROOT, 'config', 'learner-profile-world-deconfound-certificate.json');
  const frozenRaw = fs.readFileSync(designPath, 'utf8');
  const certificateRaw = fs.readFileSync(certificatePath, 'utf8');
  const certificate = JSON.parse(certificateRaw);

  assert.throws(
    () =>
      validateLearnerProfileWorldDeconfoundPaidGate({
        design: yaml.parse(frozenRaw),
        designRaw: frozenRaw,
        certificate,
        certificateRaw,
        certificateTracked: true,
        root: ROOT,
      }),
    /must carry paid_authorization: authorized/u,
  );

  const authorizedRaw = frozenRaw.replace('paid_authorization: not_authorized', 'paid_authorization: authorized');
  const gate = validateLearnerProfileWorldDeconfoundPaidGate({
    design: yaml.parse(authorizedRaw),
    designRaw: authorizedRaw,
    certificate,
    certificateRaw,
    certificateTracked: true,
    root: ROOT,
  });
  assert.equal(gate.frozenPlanHash, FROZEN_PLAN_HASH);
  assert.equal(gate.report.dialogues, 20);
  assert.equal(gate.report.models.tutor, 'claude-code.claude-sonnet-5');
  assert.equal(gate.report.models.learner, 'codex.gpt-5.6-terra');
  assert.equal(gate.report.models.analysis, 'codex.gpt-5.6-sol');

  assert.throws(
    () =>
      validateLearnerProfileWorldDeconfoundPaidGate({
        design: yaml.parse(authorizedRaw),
        designRaw: authorizedRaw,
        certificate,
        certificateRaw,
        certificateTracked: false,
        root: ROOT,
      }),
    /requires the certificate bytes tracked at HEAD/u,
  );

  const driftedCertificate = structuredClone(certificate);
  driftedCertificate.frozen_artifacts.quiet_detector_v1.sha256 = '0'.repeat(64);
  assert.throws(
    () =>
      validateLearnerProfileWorldDeconfoundPaidGate({
        design: yaml.parse(authorizedRaw),
        designRaw: authorizedRaw,
        certificate: driftedCertificate,
        certificateRaw: JSON.stringify(driftedCertificate),
        certificateTracked: true,
        root: ROOT,
      }),
    /qd-v1 hash no longer matches/u,
  );
});

test('paid runner checkpoints, resumes without repeating jobs, and seals outcomes for archive', () => {
  fs.mkdirSync(path.join(ROOT, '.test-tmp'), { recursive: true });
  const outputDir = fs.mkdtempSync(path.join(ROOT, '.test-tmp', 'learner-profile-world-paid-run-'));
  try {
    const plan = buildLearnerProfileWorldDeconfoundPlan(readLearnerProfileWorldDeconfoundDesign(), {
      root: ROOT,
      outputDir,
      sourceSha: '0123456789abcdef0123456789abcdef01234567',
    });
    const gate = {
      frozenPlanHash: FROZEN_PLAN_HASH,
      certificateSha256: 'a'.repeat(64),
      launchSourceSha: '1'.repeat(40),
    };
    const calls = [];
    const spawnJob = (job) => {
      calls.push(job.id);
      return { status: 0, signal: null };
    };

    const first = runLearnerProfileWorldDeconfoundPaidPlan(plan, gate, {
      root: ROOT,
      checkpointEvery: 3,
      spawnJob,
    });
    assert.equal(first.attempted, 3);
    assert.equal(first.state.status, 'checkpointed');
    assert.equal(first.state.completedJobs.length, 3);
    assert.equal(first.state.outcomeReadAllowed, false);

    const second = runLearnerProfileWorldDeconfoundPaidPlan(plan, gate, {
      root: ROOT,
      checkpointEvery: 4,
      spawnJob,
    });
    assert.equal(second.state.completedJobs.length, 7);

    const final = runLearnerProfileWorldDeconfoundPaidPlan(plan, gate, {
      root: ROOT,
      checkpointEvery: 20,
      spawnJob,
    });
    assert.equal(final.state.status, 'completed_pending_archive');
    assert.equal(final.state.completedJobs.length, 20);
    assert.equal(final.state.archiveRequired, true);
    assert.equal(new Set(calls).size, 20);
    assert.equal(calls.length, 20);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('paid runner refuses an automatic retry after a failed in-flight job', () => {
  fs.mkdirSync(path.join(ROOT, '.test-tmp'), { recursive: true });
  const outputDir = fs.mkdtempSync(path.join(ROOT, '.test-tmp', 'learner-profile-world-paid-failure-'));
  try {
    const plan = buildLearnerProfileWorldDeconfoundPlan(readLearnerProfileWorldDeconfoundDesign(), {
      root: ROOT,
      outputDir,
      sourceSha: '0123456789abcdef0123456789abcdef01234567',
    });
    const gate = {
      frozenPlanHash: FROZEN_PLAN_HASH,
      certificateSha256: 'b'.repeat(64),
      launchSourceSha: '2'.repeat(40),
    };
    assert.throws(
      () =>
        runLearnerProfileWorldDeconfoundPaidPlan(plan, gate, {
          root: ROOT,
          checkpointEvery: 1,
          spawnJob: () => ({ status: 1, signal: null }),
        }),
      /checkpoint sealed and automatic retry refused/u,
    );
    assert.throws(
      () =>
        runLearnerProfileWorldDeconfoundPaidPlan(plan, gate, {
          root: ROOT,
          checkpointEvery: 1,
          spawnJob: () => ({ status: 0, signal: null }),
        }),
      /has failed job .* refusing an automatic retry/u,
    );
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
