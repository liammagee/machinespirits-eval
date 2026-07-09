import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function writeSummary(filePath, { learnerProfile, bland, field }) {
  const byPolicy = {
    bland: {
      rows: 1,
      ok: 1,
      failed: 0,
      dryRun: 0,
      grounded: bland.grounded,
      groundedRate: bland.grounded,
      meanTurns: bland.turns,
      meanCoverage: bland.coverage,
      meanMissing: bland.missing,
      registerCounts: { plain: 2 },
      registerEntropy: 0,
      leakCount: 0,
      errorCount: 0,
    },
    field: {
      rows: 1,
      ok: 1,
      failed: 0,
      dryRun: 0,
      grounded: field.grounded,
      groundedRate: field.grounded,
      meanTurns: field.turns,
      meanCoverage: field.coverage,
      meanMissing: field.missing,
      registerCounts: { precise: 1, warm: 1 },
      registerEntropy: 1,
      leakCount: 0,
      errorCount: 0,
    },
  };
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.auto-eval.v1',
        startedAt: '2026-07-08T00:00:00.000Z',
        completedAt: `2026-07-08T00:0${learnerProfile === 'diligent' ? '1' : '2'}:00.000Z`,
        config: {
          policies: ['bland', 'field'],
          autoLearnerProfileId: learnerProfile,
          world: 'world_005_marrick',
          dryRun: false,
        },
        aggregates: {
          rows: 2,
          completed: 2,
          ok: 2,
          failed: 0,
          dryRun: 0,
          grounded: bland.grounded + field.grounded,
          groundedRate: (bland.grounded + field.grounded) / 2,
          meanTurns: (bland.turns + field.turns) / 2,
          meanCoverage: (bland.coverage + field.coverage) / 2,
          meanMissing: (bland.missing + field.missing) / 2,
          registerCounts: { plain: 2, precise: 1, warm: 1 },
          registerEntropy: 1.5,
          leakCount: 0,
          errorCount: 0,
          byPolicy,
        },
      },
      null,
      2,
    )}\n`,
  );
}

test('cross-run analyzer emits policy x learner QA robustness', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-analysis-'));
  try {
    const diligentPath = path.join(tmp, 'auto-eval-diligent.json');
    const skepticalPath = path.join(tmp, 'auto-eval-skeptical.json');
    writeSummary(diligentPath, {
      learnerProfile: 'diligent',
      bland: { grounded: 1, turns: 24, coverage: 0.45, missing: 4 },
      field: { grounded: 1, turns: 12, coverage: 0.9, missing: 1 },
    });
    writeSummary(skepticalPath, {
      learnerProfile: 'skeptical',
      bland: { grounded: 0, turns: 48, coverage: 0.35, missing: 5 },
      field: { grounded: 1, turns: 18, coverage: 0.78, missing: 2 },
    });

    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-auto-evals.js',
          diligentPath,
          skepticalPath,
          '--json',
          '--qa',
          '--baseline-policy',
          'bland',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    assert.equal(report.qaMatrix.schema, 'machinespirits.tutor-stub.qa-matrix.v1');
    assert.deepEqual(report.qaMatrix.learnerProfiles, ['diligent', 'skeptical']);
    assert.deepEqual(report.qaMatrix.policies, ['bland', 'field']);
    const field = report.qaMatrix.policyRobustness.find((row) => row.policy === 'field');
    assert.equal(field.observedLearners, 2);
    assert.ok(field.meanDeltaVsBaseline > 0);
    assert.ok(field.worstScore > 0);
    const skepticalCell = report.qaMatrix.cells.find(
      (cell) => cell.learnerProfile === 'skeptical' && cell.policy === 'field',
    );
    assert.ok(skepticalCell.deltaVsBaseline > 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('qa matrix runner prints a reproducible focused-suite plan', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--print-plan',
        '--json',
        '--suite',
        'focused',
        '--profiles',
        'diligent,skeptical',
        '--runs',
        '1',
        '--trace-dir',
        '.tutor-stub-auto-eval/test-qa-plan',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.equal(plan.schema, 'machinespirits.tutor-stub.qa-matrix-plan.v1');
  assert.deepEqual(plan.profiles, ['diligent', 'skeptical']);
  assert.deepEqual(plan.policies, [
    'bland',
    'dynamic',
    'state',
    'field',
    'trajectory',
    'dynamical_system',
    'empirical_dynamical_system',
  ]);
  assert.equal(plan.expectedDialogueRows, 14);
  assert.equal(plan.jobs.length, 2);
  assert.ok(plan.jobs[0].command.includes('--auto-learner-profile-id'));
  assert.ok(plan.jobs[0].command.includes('diligent'));
});
