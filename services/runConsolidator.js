/**
 * runConsolidator.js — Core consolidation logic for accumulative runs
 *
 * Extracts the consolidation algorithm from the CLI script so it can be
 * tested in isolation with a temporary database.
 *
 * Usage:
 *   import { consolidateRuns } from '../services/runConsolidator.js';
 *   const result = consolidateRuns(db, { epoch: '2.0', execute: true });
 */

import { randomBytes } from 'crypto';
import { getEpochFilter } from './epochFilter.js';
import { getAggregatedGroups } from './evalSignature.js';

// ── Run ID Generation ───────────────────────────────────────────────────────

export function generateConsolidatedRunId(epoch) {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = randomBytes(4).toString('hex');
  return `consolidated-${epoch}-${date}-${suffix}`;
}

// ── Core Consolidation ──────────────────────────────────────────────────────

/**
 * Analyze and optionally execute run consolidation.
 *
 * @param {Database} db - better-sqlite3 database instance (read-write)
 * @param {Object} options
 * @param {string} options.epoch - Epoch key ('pilot', '2.0', 'all')
 * @param {boolean} options.execute - If true, apply changes; if false, preview only
 * @param {boolean} options.force - If true, reconsolidate even if existing consolidated run
 * @param {string} [options.description] - Custom description for the consolidated run
 * @param {string} [options.runId] - Override the generated run ID (useful for tests)
 * @returns {Object} Result summary
 */
export function consolidateRuns(db, options = {}) {
  const { epoch = '2.0', execute = false, force = false, description: userDescription, runId: overrideRunId } = options;

  // Check for existing consolidated run for this epoch
  const existingConsolidated = db.prepare(
    `SELECT id FROM evaluation_runs WHERE id LIKE ? AND status = 'completed'`
  ).all(`consolidated-${epoch}-%`);

  if (existingConsolidated.length > 0 && !force) {
    return {
      error: 'existing_consolidated_run',
      existingRunIds: existingConsolidated.map(r => r.id),
      message: 'Use --force to reconsolidate',
    };
  }

  // Get all aggregated groups for this epoch
  const groups = getAggregatedGroups(db, epoch);

  // Collect all eligible rows and their source runs
  const allRowIds = [];
  const allSourceRunIds = new Set();
  let multiRunGroupCount = 0;
  let singleRunGroupCount = 0;

  for (const [sig, group] of groups) {
    if (group.nRuns > 1) {
      multiRunGroupCount++;
    } else {
      singleRunGroupCount++;
    }
    for (const row of group.rows) {
      allRowIds.push(row.id);
      allSourceRunIds.add(row.run_id);
    }
  }

  const totalRows = allRowIds.length;
  const totalSignatures = groups.size;
  const sourceRunIds = [...allSourceRunIds].sort();

  if (totalRows === 0) {
    return {
      error: 'no_eligible_rows',
      epoch,
      totalRows: 0,
      message: 'No eligible rows found',
    };
  }

  // Compute N distribution
  const nDistribution = {};
  for (const [, group] of groups) {
    const bucket = group.n >= 3 ? '3+' : String(group.n);
    nDistribution[bucket] = (nDistribution[bucket] || 0) + 1;
  }

  // Judge model distribution
  const judgeModels = {};
  for (const [, group] of groups) {
    for (const row of group.rows) {
      const jm = row.judge_model || 'unknown';
      judgeModels[jm] = (judgeModels[jm] || 0) + 1;
    }
  }

  const consolidatedRunId = overrideRunId || generateConsolidatedRunId(epoch);
  const description = userDescription
    || `Consolidated ${epoch} epoch: ${totalRows} rows from ${sourceRunIds.length} source runs, ${totalSignatures} signatures`;

  // Preview mode — return analysis without modifying DB
  if (!execute) {
    return {
      epoch,
      consolidatedRunId,
      totalRows,
      totalSignatures,
      multiRunGroups: multiRunGroupCount,
      singleRunGroups: singleRunGroupCount,
      sourceRunIds,
      nDistribution,
      judgeModels,
      description,
    };
  }

  // ── Execute ─────────────────────────────────────────────────────────────

  // Find earliest and latest created_at among eligible rows
  const timeRange = db.prepare(`
    SELECT MIN(created_at) as earliest, MAX(created_at) as latest
    FROM evaluation_results
    WHERE id IN (${allRowIds.map(() => '?').join(',')})
  `).get(...allRowIds);

  const consolidate = db.transaction(() => {
    // 1. Create the consolidated run
    db.prepare(`
      INSERT INTO evaluation_runs (id, created_at, description, total_scenarios, total_configurations, total_tests, status, completed_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `).run(
      consolidatedRunId,
      timeRange.earliest,
      description,
      totalSignatures,
      1,
      totalRows,
      timeRange.latest,
      JSON.stringify({
        sourceRunIds,
        epoch,
        signatureCount: totalSignatures,
        rowCount: totalRows,
        multiRunGroups: multiRunGroupCount,
        singleRunGroups: singleRunGroupCount,
        nDistribution,
        judgeModels,
        consolidatedAt: new Date().toISOString(),
        force: force || false,
      })
    );

    // 2. Move all eligible rows to the consolidated run
    const updateStmt = db.prepare('UPDATE evaluation_results SET run_id = ? WHERE id = ?');
    for (const rowId of allRowIds) {
      updateStmt.run(consolidatedRunId, rowId);
    }

    // 3. Mark source runs that are now fully empty
    for (const sourceRunId of sourceRunIds) {
      const remaining = db.prepare(
        'SELECT COUNT(*) as cnt FROM evaluation_results WHERE run_id = ?'
      ).get(sourceRunId);

      if (remaining.cnt === 0) {
        db.prepare(
          `UPDATE evaluation_runs SET status = 'consolidated' WHERE id = ?`
        ).run(sourceRunId);
      }
    }
  });

  consolidate();

  // Count how many source runs were marked consolidated
  const markedConsolidated = db.prepare(
    `SELECT COUNT(*) as cnt FROM evaluation_runs WHERE id IN (${sourceRunIds.map(() => '?').join(',')}) AND status = 'consolidated'`
  ).get(...sourceRunIds);

  return {
    epoch,
    consolidatedRunId,
    totalRows,
    totalSignatures,
    multiRunGroups: multiRunGroupCount,
    singleRunGroups: singleRunGroupCount,
    sourceRunIds,
    sourceRunsMarkedConsolidated: markedConsolidated.cnt,
    nDistribution,
    judgeModels,
    description,
  };
}
