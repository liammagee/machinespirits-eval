import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function writeEvalSummary(dir, learnerProfile, completedAt) {
  fs.mkdirSync(dir, { recursive: true });
  const stem = `auto-eval-${completedAt.replaceAll(':', '-').replaceAll('.', '-')}`;
  const jsonPath = path.join(dir, `${stem}.json`);
  const htmlPath = path.join(dir, `${stem}.html`);
  const rows = ['bland', 'field'].map((policy, index) => ({
    policy,
    status: 'ok',
    groundedClosure: index === 1,
    turnCount: 8 + index,
    bestPathCoverage: index === 1 ? 1 : 0.5,
    missingPremiseCount: index === 1 ? 0 : 3,
    leakCount: 0,
    registerCounts: policy === 'bland' ? { plain: 8 } : { precise: 5, warm: 4 },
    efficacyCounts: { positive_progress: 3, no_clear_progress: 5 },
    field: {
      final: { learnerMastery: index === 1 ? 0.9 : 0.6, learnerRisk: index === 1 ? 0.1 : 0.3 },
      delta: { learnerMastery: 0.3, learnerRisk: -0.2 },
    },
  }));
  const byPolicy = Object.fromEntries(
    rows.map((row) => [
      row.policy,
      {
        rows: 1,
        ok: 1,
        failed: 0,
        dryRun: 0,
        grounded: row.groundedClosure ? 1 : 0,
        groundedRate: row.groundedClosure ? 1 : 0,
        meanTurns: row.turnCount,
        meanCoverage: row.bestPathCoverage,
        meanMissing: row.missingPremiseCount,
        registerCounts: row.registerCounts,
        registerEntropy: row.policy === 'bland' ? 0 : 1,
        leakCount: 0,
        errorCount: 0,
      },
    ]),
  );
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.auto-eval.v1',
        startedAt: '2026-07-09T00:00:00.000Z',
        completedAt,
        config: {
          policies: ['bland', 'field'],
          autoLearnerProfileId: learnerProfile,
          autoLearnerModel: 'codex.gpt-5.5',
          world: 'world_005_marrick',
          dagMode: 'strict_dag',
          dryRun: false,
        },
        aggregates: {
          rows: 2,
          completed: 2,
          ok: 2,
          failed: 0,
          dryRun: 0,
          grounded: 1,
          groundedRate: 0.5,
          meanTurns: 8.5,
          meanCoverage: 0.75,
          meanMissing: 1.5,
          registerCounts: { plain: 8, precise: 5, warm: 4 },
          registerEntropy: 1,
          leakCount: 0,
          errorCount: 0,
          byPolicy,
        },
        rows,
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(htmlPath, '<!doctype html><title>fixture report</title>\n');
  return { jsonPath, htmlPath };
}

function writeRunState(dir, learnerProfile, updatedAt) {
  fs.writeFileSync(
    path.join(dir, 'run-state.json'),
    `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.auto-eval-run-state.v1',
        status: 'running',
        pid: 1234,
        startedAt: updatedAt,
        updatedAt,
        traceDir: dir,
        config: {
          policies: ['bland', 'field'],
          autoLearnerProfileId: learnerProfile,
          world: 'world_005_marrick',
          dagMode: 'strict_dag',
        },
        totals: { jobs: 2, completed: 1, active: 1, queued: 0, failed: 0, progressRate: 0.5 },
        jobs: [],
      },
      null,
      2,
    )}\n`,
  );
}

test('tutor-stub report index is cohort-first and preserves reporting UX state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-reporting-ux-'));
  const cohortRoot = path.join(root, 'custom-profile-pressure-run');
  const diligentDir = path.join(cohortRoot, 'diligent');
  const skipperDir = path.join(cohortRoot, 'proof_skipper');
  fs.mkdirSync(cohortRoot, { recursive: true });
  fs.writeFileSync(
    path.join(cohortRoot, 'qa-plan.json'),
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.qa-matrix-plan.v1',
      profiles: ['diligent', 'proof_skipper'],
      policies: ['bland', 'field'],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(cohortRoot, 'qa-matrix.json'),
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.cross-run-field.v1',
      qaMatrix: {
        baselinePolicy: 'bland',
        learnerProfiles: ['diligent', 'proof_skipper'],
        policies: ['bland', 'field'],
      },
      policySummary: [
        { policy: 'field', meanScore: 0.7, meanTurns: 9, meanEffectiveClosure: 0.5 },
        { policy: 'bland', meanScore: 0.5, meanTurns: 8, meanEffectiveClosure: 0 },
      ],
    })}\n`,
  );
  fs.writeFileSync(path.join(cohortRoot, 'qa-matrix.md'), '# QA matrix\n');
  fs.writeFileSync(
    path.join(cohortRoot, 'profile-discrimination.json'),
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.profile-discrimination.v2',
      summary: { averagePairwiseCosine: 0.91, maxSimilarityToControl: 0.95 },
      gate: {
        mode: 'contract_conditioned',
        pass: false,
        targetAverageCosine: 0.85,
        targetMaxToControl: 0.9,
        conditioned: { profiles: [{ profile: 'proof_skipper', pass: false }] },
      },
    })}\n`,
  );
  fs.writeFileSync(path.join(cohortRoot, 'profile-discrimination.md'), '# Profile gate\n');
  writeEvalSummary(diligentDir, 'diligent', '2026-07-09T00:01:00.000Z');
  writeEvalSummary(skipperDir, 'proof_skipper', '2026-07-09T00:02:00.000Z');
  writeRunState(diligentDir, 'diligent', new Date().toISOString());
  writeRunState(skipperDir, 'proof_skipper', '2020-01-01T00:00:00.000Z');

  execFileSync(process.execPath, ['scripts/run-tutor-stub-auto-eval.js', '--index', '--index-root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  const data = JSON.parse(fs.readFileSync(path.join(root, 'index-data.json'), 'utf8'));
  assert.equal(data.schema, 'machinespirits.tutor-stub.report-index-data.v2');
  assert.equal(data.cohorts.length, 1);
  const [cohort] = data.cohorts;
  assert.equal(cohort.id, 'custom-profile-pressure-run');
  assert.equal(cohort.status, 'running');
  assert.equal(cohort.decision, 'Experiment in progress');
  assert.deepEqual(cohort.profiles, ['diligent', 'proof_skipper']);
  assert.deepEqual(cohort.policies, ['bland', 'field']);
  assert.equal(cohort.discriminationGate.pass, false);
  assert.deepEqual(cohort.discriminationGate.failedProfiles, ['proof_skipper']);
  assert.ok(cohort.links.some((link) => link.label === 'QA summary'));
  assert.ok(cohort.links.some((link) => link.label === 'profile gate'));
  assert.equal(cohort.childReports.length, 2);
  assert.ok(data.rows.every((row) => row.reportScope.kind === 'qa_matrix_child'));
  assert.deepEqual(
    data.activeRuns.map((run) => run.status).sort(),
    ['running', 'stale'],
  );

  const client = fs.readFileSync(path.join(root, 'assets', 'tutor-stub-index.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'assets', 'tutor-stub-report.css'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(client, /renderCohortWorkspace/);
  assert.match(client, /machinespirits\.tutorStub\.reportIndex\.v1/);
  assert.match(client, /sessionStorage\.setItem/);
  assert.match(client, /report-index-card/);
  assert.match(client, /Needs attention/);
  assert.match(css, /\.cohort-workspace/);
  assert.match(css, /\.report-card-list/);
  assert.match(css, /\.report-shell \{ display:block; \}/);
  assert.match(shell, /data-index-data="index-data\.json"/);

  execFileSync(process.execPath, ['--check', path.join(root, 'assets', 'tutor-stub-index.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
});

test('individual tutor-stub reports expose progressive summaries and accessible replay tabs', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'run-tutor-stub-auto-eval.js'), 'utf8');
  assert.match(source, /class="read-first-cards"/);
  assert.match(source, /Full policy ranking and secondary metrics/);
  assert.match(source, /<details class="viz-sidebar"/);
  assert.match(source, /role="tab" aria-selected="true" aria-controls="tutor-stub-viz-canvas"/);
  assert.match(source, /button\.setAttribute\('aria-selected'/);
  assert.match(source, /\['profile gate', scope\.discriminationMarkdownHref\]/);
});
