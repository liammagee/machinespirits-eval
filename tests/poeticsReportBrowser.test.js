import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { loadAuditRows } from '../scripts/audit-poetics-disagreements.js';
import {
  getBlindItem,
  getItem,
  listItems,
  listRuns,
  saveBrowserLabel,
  saveBrowserReviewFlag,
} from '../scripts/browse-poetics-scripts.js';
import { buildPoeticsReport, renderCsv, renderMarkdown } from '../scripts/report-poetics-sidecar.js';
import {
  openPoeticsStore,
  upsertPoeticsItem,
  upsertPoeticsReviewFlag,
  upsertPoeticsRun,
  upsertPoeticsScore,
} from '../services/poeticsStore.js';

function withDb(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-report-browser-'));
  const db = openPoeticsStore(path.join(root, 'poetics.db'));
  try {
    seed(db);
    return fn(db);
  } finally {
    db.close();
  }
}

function seed(db) {
  upsertPoeticsRun(db, {
    id: 'poetics-test-run',
    sourceRoot: 'config/poetics-calibration/poetics-test-run',
    batchId: 'poetics-test-run',
    generator: 'codex',
    metadata: {},
  });
  upsertPoeticsRun(db, {
    id: 'poetics-second-run',
    sourceRoot: 'config/poetics-calibration/poetics-second-run',
    batchId: 'poetics-second-run',
    generator: 'codex',
    metadata: {},
  });
  upsertPoeticsItem(db, {
    id: 'poetics-test-run:target-r01:none:T01',
    runId: 'poetics-test-run',
    unitId: 'target-r01',
    repeat: 'r01',
    arm: 'none',
    tid: 'T01',
    dramaId: 'D1',
    discipline: 'statistics',
    condition: 'base',
    intendedLean: 'flat',
    metadata: {},
  });
  upsertPoeticsItem(db, {
    id: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    runId: 'poetics-test-run',
    unitId: 'control-r01-d25-hard-trap',
    repeat: 'r01',
    arm: 'default',
    tid: 'T02',
    dramaId: 'D25',
    discipline: 'medicine',
    condition: 'base',
    intendedLean: 'hard_trap',
    controlFamily: 'd25-hard-trap',
    controlRole: 'hard_trap_control',
    metadata: {},
  });
  upsertPoeticsItem(db, {
    id: 'poetics-second-run:target-r01:reframe:T03',
    runId: 'poetics-second-run',
    unitId: 'target-r01',
    repeat: 'r01',
    arm: 'reframe',
    tid: 'T03',
    dramaId: 'D3',
    discipline: 'history',
    condition: 'recognition',
    intendedLean: 'recognition',
    metadata: {},
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-test-run:target-r01:none:T01',
    criticModel: 'qwen/qwen3.5-plus-02-15',
    scoreFile: 'scores/target-r01-none-qwen.json',
    formClass: 'flat',
    recontextualization: 0,
    statedInsight: 0,
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    criticModel: 'qwen/qwen3.5-plus-02-15',
    scoreFile: 'scores/control-r01-d25-qwen.json',
    formClass: 'trap',
    recontextualization: 0,
    statedInsight: 75,
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    criticModel: 'deepseek/deepseek-v4-pro',
    scoreFile: 'scores/control-r01-d25-deepseek.json',
    formClass: 'recognition',
    recontextualization: 75,
    statedInsight: 75,
    recoheredEarlier: 'the learner re-reads the earlier demand',
    statedInsightEvidence: 'Oh, I get it',
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-second-run:target-r01:reframe:T03',
    criticModel: 'qwen/qwen3.7-max',
    scoreFile: 'scores/target-r01-reframe-qwen37.json',
    formClass: 'recognition',
    recontextualization: 75,
    statedInsight: 25,
  });
  upsertPoeticsScore(db, {
    itemId: 'poetics-second-run:target-r01:reframe:T03',
    criticModel: 'deepseek/deepseek-v4-pro',
    scoreFile: 'scores/target-r01-reframe-deepseek.json',
    formClass: 'flat',
    recontextualization: 50,
    statedInsight: 25,
  });
  upsertPoeticsReviewFlag(db, {
    itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
    flaggerId: 'codex',
    flagType: 'human_review',
    priority: 'normal',
    reason: 'critic disagreement needs human perspective',
    metadata: {},
  });
}

describe('poetics sidecar report and browser', () => {
  it('renders target, control, and disagreement summaries from sidecar tables', () =>
    withDb((db) => {
      const report = buildPoeticsReport(db, { runId: 'poetics-test-run' });
      assert.equal(report.runs.length, 1);
      assert.equal(report.runs[0].itemCount, 2);
      assert.equal(report.runs[0].scoreCount, 3);
      assert.equal(report.runs[0].disagreements.length, 1);
      assert.match(renderMarkdown(report), /Critic Disagreements/);
      assert.match(renderMarkdown(report), /hard_trap_control/);
      assert.ok(renderCsv(report).includes('deepseek/deepseek-v4-pro'));
    }));

  it('lists runs and retrieves script details for the browser API layer', () =>
    withDb((db) => {
      const runs = listRuns(db);
      const run = runs.find((entry) => entry.id === 'poetics-test-run');
      assert.equal(run.itemCount, 2);
      assert.equal(run.reviewFlagCount, 1);

      const hardTraps = listItems(db, { runId: 'poetics-test-run', role: 'hard_trap_control' });
      assert.equal(hardTraps.length, 1);
      assert.equal(hardTraps[0].dramaId, 'D25');
      assert.equal(hardTraps[0].criticForms.length, 2);
      assert.equal(hardTraps[0].reviewFlagCount, 1);

      const detail = getItem(db, 'poetics-test-run:control-r01-d25-hard-trap:default:T02');
      assert.equal(detail.item.controlRole, 'hard_trap_control');
      assert.equal(detail.scores.length, 2);
      assert.equal(detail.reviewFlags.length, 1);
    }));

  it('supports blind browser labels without exposing critic scores', () =>
    withDb((db) => {
      const blindItems = listItems(db, { runId: 'poetics-test-run', blind: true });
      assert.equal(blindItems.length, 2);
      assert.ok(blindItems[0].blindId);
      assert.equal(blindItems[0].criticForms, undefined);

      const saved = saveBrowserLabel(db, {
        itemId: 'poetics-test-run:target-r01:none:T01',
        labellerId: 'reader-a',
        formClass: 'flat',
        rationale: 'no public recohering',
      });
      assert.equal(saved.label.form_class, 'flat');
      assert.equal(saved.label.perspective, 'human-browser');

      const blindDetail = getBlindItem(db, 'poetics-test-run:target-r01:none:T01', { labellerId: 'reader-a' });
      assert.equal(blindDetail.scores, undefined);
      assert.equal(blindDetail.reviewFlags, undefined);
      assert.equal(blindDetail.label.form_class, 'flat');
    }));

  it('persists review flags and serves them as a blind review queue', () =>
    withDb((db) => {
      const flagged = listItems(db, {
        runIds: ['poetics-test-run', 'poetics-second-run'],
        queue: 'review',
        blind: true,
      });
      assert.equal(flagged.length, 1);
      assert.equal(flagged[0].id, 'poetics-test-run:control-r01-d25-hard-trap:default:T02');
      assert.equal(flagged[0].criticForms, undefined);
      assert.equal(flagged[0].reviewFlagCount, 1);

      const saved = saveBrowserReviewFlag(db, {
        itemId: 'poetics-second-run:target-r01:reframe:T03',
        flaggerId: 'codex',
        reason: 'second disagreement for comparison',
      });
      assert.equal(saved.reviewFlags.length, 1);

      const queue = listItems(db, {
        runIds: ['poetics-test-run', 'poetics-second-run'],
        queue: 'review',
        blind: true,
      });
      assert.equal(queue.length, 2);
    }));

  it('builds a blind cross-run disagreement queue', () =>
    withDb((db) => {
      const queue = listItems(db, {
        runIds: ['poetics-test-run', 'poetics-second-run'],
        queue: 'disagreements',
        blind: true,
      });
      assert.equal(queue.length, 2);
      assert.deepEqual(queue.map((item) => item.runId).sort(), ['poetics-second-run', 'poetics-test-run']);
      assert.equal(queue[0].criticForms, undefined);

      saveBrowserLabel(db, {
        itemId: 'poetics-test-run:control-r01-d25-hard-trap:default:T02',
        labellerId: 'reader-a',
        formClass: 'trap',
      });
      const remaining = listItems(db, {
        runIds: ['poetics-test-run', 'poetics-second-run'],
        queue: 'disagreements',
        unlabelled: true,
        blind: true,
      });
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].id, 'poetics-second-run:target-r01:reframe:T03');
    }));

  it('surfaces focal-critic disagreement cases for qualitative audit', () =>
    withDb((db) => {
      const rows = loadAuditRows(db, {
        runId: 'poetics-test-run',
        critic: 'deepseek/deepseek-v4-pro',
        onlyDisagreements: true,
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].item.drama_id, 'D25');
      assert.equal(rows[0].scores.find((score) => score.critic === 'deepseek/deepseek-v4-pro').form, 'recognition');
    }));
});
