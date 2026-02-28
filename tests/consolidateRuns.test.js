/**
 * Tests for runConsolidator.js — Run consolidation logic.
 *
 * Covers:
 *   - Multi-cell consolidation: rows from different cells preserve per-cell counts
 *   - Multi-run merging: rows from N source runs merge into 1 consolidated run
 *   - Source run marking: fully emptied source runs get status = 'consolidated'
 *   - Partial emptying: source runs with remaining rows keep original status
 *   - Epoch scoping: only rows matching the epoch filter are consolidated
 *   - Idempotency: re-running on already-consolidated data is a no-op (--force reconsolidates)
 *   - Preview mode: no DB mutations when execute = false
 *   - Edge case: rows without config_hash still consolidate
 *   - Edge case: mixed judge models in same signature group
 *
 * Uses a temporary SQLite database (not the production DB).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { consolidateRuns } from '../services/runConsolidator.js';

// ── Test DB Setup ───────────────────────────────────────────────────────────

let db;
const testDbPath = path.join(os.tmpdir(), `consolidate-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.db`);

before(() => {
  db = new Database(testDbPath);
  db.pragma('journal_mode = WAL');

  // Create the same schema as evaluationStore.js
  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluation_runs (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      description TEXT,
      total_scenarios INTEGER DEFAULT 0,
      total_configurations INTEGER DEFAULT 0,
      total_tests INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      completed_at DATETIME,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS evaluation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT REFERENCES evaluation_runs(id),
      scenario_id TEXT NOT NULL,
      scenario_name TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      profile_name TEXT,
      hyperparameters TEXT,
      prompt_id TEXT,
      suggestions TEXT,
      raw_response TEXT,
      latency_ms INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost REAL,
      dialogue_rounds INTEGER,
      api_calls INTEGER,
      dialogue_id TEXT,
      score_relevance REAL,
      score_specificity REAL,
      score_pedagogical REAL,
      score_personalization REAL,
      score_actionability REAL,
      score_tone REAL,
      overall_score REAL,
      passes_required BOOLEAN,
      passes_forbidden BOOLEAN,
      required_missing TEXT,
      forbidden_found TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      judge_model TEXT,
      evaluation_reasoning TEXT,
      success BOOLEAN DEFAULT 1,
      error_message TEXT,
      tutor_first_turn_score REAL,
      config_hash TEXT,
      tutor_rubric_version TEXT,
      factor_recognition BOOLEAN,
      factor_multi_agent_tutor BOOLEAN,
      factor_multi_agent_learner BOOLEAN,
      learner_architecture TEXT,
      ego_model TEXT,
      superego_model TEXT,
      tutor_scores TEXT,
      tutor_overall_score REAL,
      tutor_last_turn_score REAL,
      tutor_development_score REAL,
      learner_scores TEXT,
      learner_overall_score REAL,
      dialogue_quality_score REAL
    );
  `);
});

after(() => {
  db.close();
  try { fs.unlinkSync(testDbPath); } catch { /* ignore */ }
  try { fs.unlinkSync(testDbPath + '-wal'); } catch { /* ignore */ }
  try { fs.unlinkSync(testDbPath + '-shm'); } catch { /* ignore */ }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function insertRun(id, { status = 'completed', description = 'test' } = {}) {
  db.prepare(`
    INSERT INTO evaluation_runs (id, created_at, description, status, completed_at, metadata)
    VALUES (?, datetime('now'), ?, ?, datetime('now'), '{}')
  `).run(id, description, status);
}

function insertRow(runId, {
  scenarioId = 'scenario_A',
  profileName = 'cell_80_base_single_unified',
  configHash = 'hash_cell_80',
  rubricVersion = '2.2',
  tutorScore = 75.0,
  judgeModel = 'claude-opus-4-6',
  success = 1,
  egoModel = 'nemotron',
} = {}) {
  return db.prepare(`
    INSERT INTO evaluation_results (
      run_id, scenario_id, scenario_name, provider, model, profile_name,
      config_hash, tutor_rubric_version, tutor_first_turn_score, overall_score,
      judge_model, success, suggestions, ego_model,
      factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner,
      learner_architecture, created_at
    ) VALUES (
      ?, ?, ?, 'openrouter', 'nemotron', ?,
      ?, ?, ?, ?,
      ?, ?, '["test"]', ?,
      0, 0, 0,
      'unified', datetime('now')
    )
  `).run(
    runId, scenarioId, scenarioId, profileName,
    configHash, rubricVersion, tutorScore, tutorScore,
    judgeModel, success, egoModel,
  ).lastInsertRowid;
}

function getRowCountByRun(runId) {
  return db.prepare('SELECT COUNT(*) as cnt FROM evaluation_results WHERE run_id = ?').get(runId).cnt;
}

function getRowCountByProfile(runId, profileName) {
  return db.prepare(
    'SELECT COUNT(*) as cnt FROM evaluation_results WHERE run_id = ? AND profile_name = ?'
  ).get(runId, profileName).cnt;
}

function getRunStatus(runId) {
  const row = db.prepare('SELECT status FROM evaluation_runs WHERE id = ?').get(runId);
  return row ? row.status : null;
}

function clearAllData() {
  db.exec('DELETE FROM evaluation_results');
  db.exec('DELETE FROM evaluation_runs');
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('consolidateRuns', () => {

  describe('multi-cell consolidation', () => {
    before(() => clearAllData());

    it('preserves per-cell row counts across multiple cells and runs', () => {
      // Set up: 3 cells × 2 scenarios × 3 runs = each cell×scenario has 3 rows
      const cells = [
        { profile: 'cell_80_base_single_unified', hash: 'hash_80' },
        { profile: 'cell_84_recog_single_unified', hash: 'hash_84' },
        { profile: 'cell_86_recog_multi_unified', hash: 'hash_86' },
      ];
      const scenarios = ['introductory_algebra', 'reading_comprehension'];
      const runIds = ['eval-2026-02-28-run1', 'eval-2026-02-28-run2', 'eval-2026-02-28-run3'];

      for (const runId of runIds) {
        insertRun(runId);
      }

      // Each run contributes 1 row per cell×scenario
      for (const runId of runIds) {
        for (const cell of cells) {
          for (const scenario of scenarios) {
            insertRow(runId, {
              scenarioId: scenario,
              profileName: cell.profile,
              configHash: cell.hash,
            });
          }
        }
      }

      // Verify setup: 3 runs × 3 cells × 2 scenarios = 18 rows total
      const totalBefore = db.prepare('SELECT COUNT(*) as cnt FROM evaluation_results').get().cnt;
      assert.equal(totalBefore, 18);

      // Execute consolidation
      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-multicell',
      });

      assert.equal(result.totalRows, 18);
      assert.equal(result.totalSignatures, 6); // 3 cells × 2 scenarios

      // Verify: all 18 rows now under consolidated run
      assert.equal(getRowCountByRun('consolidated-2.0-test-multicell'), 18);

      // Verify: each cell has exactly 6 rows (2 scenarios × 3 runs)
      assert.equal(getRowCountByProfile('consolidated-2.0-test-multicell', 'cell_80_base_single_unified'), 6);
      assert.equal(getRowCountByProfile('consolidated-2.0-test-multicell', 'cell_84_recog_single_unified'), 6);
      assert.equal(getRowCountByProfile('consolidated-2.0-test-multicell', 'cell_86_recog_multi_unified'), 6);

      // Verify: per cell×scenario, N=3
      for (const cell of cells) {
        for (const scenario of scenarios) {
          const count = db.prepare(
            'SELECT COUNT(*) as cnt FROM evaluation_results WHERE run_id = ? AND profile_name = ? AND scenario_id = ?'
          ).get('consolidated-2.0-test-multicell', cell.profile, scenario).cnt;
          assert.equal(count, 3, `Expected N=3 for ${cell.profile} × ${scenario}`);
        }
      }

      // Verify: source runs are empty and marked consolidated
      for (const runId of runIds) {
        assert.equal(getRowCountByRun(runId), 0);
        assert.equal(getRunStatus(runId), 'consolidated');
      }
    });
  });

  describe('multi-run merging', () => {
    before(() => clearAllData());

    it('merges rows from multiple source runs into one consolidated run', () => {
      insertRun('run-A');
      insertRun('run-B');

      // Both runs have the same cell+scenario (same signature)
      insertRow('run-A', { scenarioId: 's1', profileName: 'cell_1', configHash: 'h1' });
      insertRow('run-A', { scenarioId: 's2', profileName: 'cell_1', configHash: 'h1' });
      insertRow('run-B', { scenarioId: 's1', profileName: 'cell_1', configHash: 'h1' });
      insertRow('run-B', { scenarioId: 's2', profileName: 'cell_1', configHash: 'h1' });

      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-merge',
      });

      assert.equal(result.totalRows, 4);
      assert.equal(result.sourceRunIds.length, 2);
      assert.equal(getRowCountByRun('consolidated-2.0-test-merge'), 4);
    });
  });

  describe('source run status marking', () => {
    before(() => clearAllData());

    it('marks fully emptied source runs as consolidated', () => {
      insertRun('run-full');
      insertRow('run-full', { scenarioId: 's1' });

      consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-mark',
      });

      assert.equal(getRunStatus('run-full'), 'consolidated');
    });

    it('keeps source runs with remaining rows at original status', () => {
      clearAllData();

      insertRun('run-partial');
      // One eligible row (scored, success, v2.2 rubric)
      insertRow('run-partial', { scenarioId: 's1' });
      // One ineligible row (no score — will not be picked up by getAggregatedGroups)
      db.prepare(`
        INSERT INTO evaluation_results (
          run_id, scenario_id, provider, model, profile_name,
          config_hash, tutor_rubric_version, tutor_first_turn_score,
          success, suggestions, created_at
        ) VALUES (
          'run-partial', 's2', 'openrouter', 'nemotron', 'cell_80',
          'hash_80', '2.2', NULL,
          0, '[]', datetime('now')
        )
      `).run();

      consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-partial',
      });

      // Source run still has the ineligible row, so should NOT be marked consolidated
      assert.equal(getRowCountByRun('run-partial'), 1);
      assert.equal(getRunStatus('run-partial'), 'completed');
    });
  });

  describe('epoch scoping', () => {
    before(() => clearAllData());

    it('only consolidates rows matching the epoch filter', () => {
      insertRun('run-v22');
      insertRun('run-v10');

      // v2.2 row (epoch 2.0)
      insertRow('run-v22', { scenarioId: 's1', rubricVersion: '2.2' });
      // v1.0 row (pilot epoch)
      insertRow('run-v10', { scenarioId: 's1', rubricVersion: '1.0' });

      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-epoch',
      });

      // Only the v2.2 row should be consolidated
      assert.equal(result.totalRows, 1);
      assert.equal(getRowCountByRun('consolidated-2.0-test-epoch'), 1);

      // The v1.0 row stays in its original run
      assert.equal(getRowCountByRun('run-v10'), 1);
      assert.equal(getRunStatus('run-v10'), 'completed');
    });
  });

  describe('preview mode', () => {
    before(() => clearAllData());

    it('does not modify the database when execute = false', () => {
      insertRun('run-preview');
      insertRow('run-preview', { scenarioId: 's1' });

      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: false,
      });

      // Should report 1 row eligible
      assert.equal(result.totalRows, 1);

      // But the row should still be in the original run
      assert.equal(getRowCountByRun('run-preview'), 1);

      // No consolidated run should exist
      const consolidated = db.prepare(
        "SELECT COUNT(*) as cnt FROM evaluation_runs WHERE id LIKE 'consolidated-%'"
      ).get().cnt;
      assert.equal(consolidated, 0);
    });
  });

  describe('idempotency and --force', () => {
    before(() => clearAllData());

    it('blocks re-consolidation without --force', () => {
      insertRun('run-idem');
      insertRow('run-idem', { scenarioId: 's1' });

      // First consolidation
      consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-idem1',
      });

      // Second attempt without force should return error
      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
      });

      assert.equal(result.error, 'existing_consolidated_run');
      assert.ok(result.existingRunIds.includes('consolidated-2.0-test-idem1'));
    });

    it('allows re-consolidation with --force', () => {
      // The consolidated run from above should have 1 row
      assert.equal(getRowCountByRun('consolidated-2.0-test-idem1'), 1);

      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        force: true,
        runId: 'consolidated-2.0-test-idem2',
      });

      // Should succeed and move the 1 row to the new consolidated run
      assert.equal(result.totalRows, 1);
      assert.equal(getRowCountByRun('consolidated-2.0-test-idem2'), 1);
      assert.equal(getRowCountByRun('consolidated-2.0-test-idem1'), 0);
      assert.equal(getRunStatus('consolidated-2.0-test-idem1'), 'consolidated');
    });
  });

  describe('edge cases', () => {
    it('handles rows without config_hash', () => {
      clearAllData();
      insertRun('run-nohash');
      insertRow('run-nohash', { scenarioId: 's1', configHash: null });
      insertRow('run-nohash', { scenarioId: 's1', configHash: null });

      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-nohash',
      });

      // Both rows should consolidate (signature: no-hash::s1::2.2)
      assert.equal(result.totalRows, 2);
      assert.equal(getRowCountByRun('consolidated-2.0-test-nohash'), 2);
    });

    it('handles mixed judge models in same signature group', () => {
      clearAllData();
      insertRun('run-judges');
      insertRow('run-judges', { scenarioId: 's1', judgeModel: 'claude-opus-4-6' });
      insertRow('run-judges', { scenarioId: 's1', judgeModel: 'openrouter/gpt-5.2' });

      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-judges',
      });

      assert.equal(result.totalRows, 2);
      assert.ok(result.judgeModels['claude-opus-4-6'] >= 1);
      assert.ok(result.judgeModels['openrouter/gpt-5.2'] >= 1);
    });

    it('returns no_eligible_rows when DB is empty', () => {
      clearAllData();
      const result = consolidateRuns(db, { epoch: '2.0', execute: true });
      assert.equal(result.error, 'no_eligible_rows');
    });

    it('skips unscored rows (tutor_first_turn_score IS NULL)', () => {
      clearAllData();
      insertRun('run-unscored');
      // Scored row
      insertRow('run-unscored', { scenarioId: 's1', tutorScore: 80 });
      // Unscored row (NULL score)
      db.prepare(`
        INSERT INTO evaluation_results (
          run_id, scenario_id, provider, model, profile_name,
          config_hash, tutor_rubric_version, tutor_first_turn_score,
          success, suggestions, created_at
        ) VALUES (
          'run-unscored', 's2', 'openrouter', 'nemotron', 'cell_80',
          'hash_80', '2.2', NULL,
          1, '["test"]', datetime('now')
        )
      `).run();

      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-unscored',
      });

      // Only the scored row should be consolidated
      assert.equal(result.totalRows, 1);
      assert.equal(getRowCountByRun('run-unscored'), 1); // unscored row stays
    });

    it('skips failed rows (success = 0)', () => {
      clearAllData();
      insertRun('run-failed');
      insertRow('run-failed', { scenarioId: 's1', success: 1 });
      insertRow('run-failed', { scenarioId: 's2', success: 0 });

      const result = consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-failed',
      });

      // Only the successful row should be consolidated
      assert.equal(result.totalRows, 1);
      assert.equal(getRowCountByRun('run-failed'), 1); // failed row stays
      assert.equal(getRunStatus('run-failed'), 'completed'); // still has rows
    });
  });

  describe('transaction atomicity', () => {
    before(() => clearAllData());

    it('preserves row IDs through consolidation (no row duplication)', () => {
      insertRun('run-atoms');
      const rowId1 = insertRow('run-atoms', { scenarioId: 's1' });
      const rowId2 = insertRow('run-atoms', { scenarioId: 's2' });

      consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-atoms',
      });

      // Same row IDs should exist, just under the new run
      const row1 = db.prepare('SELECT run_id FROM evaluation_results WHERE id = ?').get(rowId1);
      const row2 = db.prepare('SELECT run_id FROM evaluation_results WHERE id = ?').get(rowId2);
      assert.equal(row1.run_id, 'consolidated-2.0-test-atoms');
      assert.equal(row2.run_id, 'consolidated-2.0-test-atoms');

      // Total row count should be unchanged (no duplication)
      const total = db.prepare('SELECT COUNT(*) as cnt FROM evaluation_results').get().cnt;
      assert.equal(total, 2);
    });
  });

  describe('consolidated run metadata', () => {
    before(() => clearAllData());

    it('records source run IDs and epoch in consolidated run metadata', () => {
      insertRun('run-meta-A');
      insertRun('run-meta-B');
      insertRow('run-meta-A', { scenarioId: 's1' });
      insertRow('run-meta-B', { scenarioId: 's1' });

      consolidateRuns(db, {
        epoch: '2.0',
        execute: true,
        runId: 'consolidated-2.0-test-meta',
      });

      const run = db.prepare('SELECT * FROM evaluation_runs WHERE id = ?').get('consolidated-2.0-test-meta');
      assert.equal(run.status, 'completed');

      const metadata = JSON.parse(run.metadata);
      assert.ok(metadata.sourceRunIds.includes('run-meta-A'));
      assert.ok(metadata.sourceRunIds.includes('run-meta-B'));
      assert.equal(metadata.epoch, '2.0');
      assert.equal(metadata.rowCount, 2);
    });
  });
});
