import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildLearnerProfileWorldDeconfoundPlan,
  verifyLearnerProfileWorldDeconfoundDelivery,
  writeLearnerProfileWorldDeconfoundPlan,
} from '../scripts/prepare-learner-profile-world-deconfound.js';
import { readLearnerProfileWorldDeconfoundDesign } from '../scripts/review-learner-profile-world-deconfound.js';

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
