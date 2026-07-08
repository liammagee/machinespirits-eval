import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('tutor-stub auto-eval summaries ingest into namespaced SQL tables', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-ingest-'));
  const dbPath = path.join(tmp, 'evaluations.db');
  const summaryPath = path.join(tmp, 'auto-eval-2026-07-08T00-00-00-000Z.json');
  const tracePath = path.join(tmp, 'trace.jsonl');
  fs.writeFileSync(tracePath, '');
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.auto-eval.v1',
        startedAt: '2026-07-08T00:00:00.000Z',
        completedAt: '2026-07-08T00:01:00.000Z',
        failed: false,
        config: {
          runs: 1,
          turns: 'until-grounded',
          untilGrounded: true,
          safetyTurns: 120,
          parallelism: 1,
          policies: ['field'],
          model: 'openai.mini',
          analysisModel: 'codex.gpt-5.5',
          autoLearnerModel: 'openai.mini',
          autoLearnerProfileId: 'skeptical',
          maxTokens: 4096,
          historyTurns: 4,
          memorySummary: { enabled: true, rawRecentTurns: 4 },
          world: 'world_005_marrick',
          traceDir: tmp,
        },
        aggregates: {
          rows: 1,
          completed: 1,
          ok: 1,
          failed: 0,
          dryRun: 0,
          grounded: 1,
          groundedRate: 1,
          meanTurns: 12,
          meanCoverage: 1,
          meanMissing: 0,
          registerCounts: { plain: 2, precise: 3 },
          registerEntropy: 0.971,
          leakCount: 0,
          errorCount: 0,
        },
        rows: [
          {
            policy: 'field',
            runIndex: 1,
            status: 'ok',
            exitCode: 0,
            signal: null,
            log: path.join(tmp, 'field-r1.log'),
            trace: tracePath,
            traceRelative: 'trace.jsonl',
            events: 10,
            turnCount: 12,
            lastTurn: 12,
            stopReason: 'auto_grounded_closure',
            groundedClosure: true,
            bestPathCoverage: 1,
            missingPremiseCount: 0,
            bottleneck: 'grounded_asserted_secret',
            finalLearner: 'Edony struck the light shillings.',
            finalTutor: 'Case closed.',
            registerCounts: { plain: 2, precise: 3 },
            registerEntropy: 0.971,
            efficacyCounts: { positive_progress: 1 },
            leakCount: 0,
            repairedCount: 1,
            fallbackCount: 0,
            errorCount: 0,
            field: { final: { mastery: 1 } },
          },
        ],
        report: { html: path.join(tmp, 'auto-eval-2026-07-08T00-00-00-000Z.html') },
      },
      null,
      2,
    )}\n`,
  );

  execFileSync(process.execPath, ['scripts/ingest-tutor-stub-auto-evals.js', summaryPath, '--db', dbPath], {
    cwd: ROOT,
    stdio: 'pipe',
  });

  const analysis = JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/analyze-tutor-stub-auto-evals.js', '--db', dbPath, '--no-ledger', '--no-dir', '--json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    ),
  );
  assert.deepEqual(analysis.sources, { db: 1 });
  assert.equal(analysis.latest.runId, 'auto-eval-2026-07-08T00-00-00-000Z');
  assert.equal(analysis.policySummary[0].policy, 'field');

  const db = new Database(dbPath, { readonly: true });
  try {
    const run = db.prepare('SELECT id, auto_learner_profile_id, ok_rows, grounded_rows FROM tutor_stub_eval_runs').get();
    assert.equal(run.id, 'auto-eval-2026-07-08T00-00-00-000Z');
    assert.equal(run.auto_learner_profile_id, 'skeptical');
    assert.equal(run.ok_rows, 1);
    assert.equal(run.grounded_rows, 1);

    const row = db.prepare('SELECT policy, turn_count, grounded_closure FROM tutor_stub_eval_rows').get();
    assert.equal(row.policy, 'field');
    assert.equal(row.turn_count, 12);
    assert.equal(row.grounded_closure, 1);

    const registerTotal = db.prepare('SELECT SUM(count) AS total FROM tutor_stub_register_counts').get();
    assert.equal(registerTotal.total, 5);

    const view = db.prepare('SELECT policy, rows, ok_rate, grounded_rate FROM v_tutor_stub_policy_summary').get();
    assert.equal(view.policy, 'field');
    assert.equal(view.rows, 1);
    assert.equal(view.ok_rate, 1);
    assert.equal(view.grounded_rate, 1);
  } finally {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
