/**
 * evalSignature.js — Eval signature and cross-run aggregation
 *
 * Defines the eval signature as a composite key:
 *   config_hash + scenario_id + tutor_rubric_version
 *
 * Rows with identical signatures are inherently comparable regardless of run_id.
 * This enables accumulative data collection: multiple `--runs 1` executions
 * can be aggregated into a virtual combined dataset.
 *
 * Usage:
 *   import { getAggregatedGroups, getAggregatedStats } from '../services/evalSignature.js';
 *   const groups = getAggregatedGroups(db, '2.0');
 *   const stats = getAggregatedStats(db, '2.0');
 */

import { getEpochFilter } from './epochFilter.js';

// ── Signature Computation ───────────────────────────────────────────────────

/**
 * Compute the eval signature for a row.
 * This is a logical composite key — not stored in the DB.
 */
export function computeEvalSignature(row) {
  const configHash = row.config_hash || row.configHash || 'no-hash';
  const scenarioId = row.scenario_id || row.scenarioId || 'unknown';
  const rubricVersion = row.tutor_rubric_version || row.rubricVersion || 'unknown';
  return `${configHash}::${scenarioId}::${rubricVersion}`;
}

// ── Aggregated Groups ───────────────────────────────────────────────────────

/**
 * Query the DB and group rows by eval signature.
 * Returns a Map of signature → { rows, summary }.
 *
 * @param {Database} db - better-sqlite3 database instance
 * @param {string} epoch - epoch key ('pilot', '2.0', 'all')
 * @param {Object} [filters] - optional filters { profileName, scenarioId }
 * @returns {Map<string, Object>}
 */
export function getAggregatedGroups(db, epoch = '2.0', filters = {}) {
  const epochFilter = getEpochFilter(epoch);

  let sql = `
    SELECT id, run_id, config_hash, scenario_id, scenario_name, profile_name,
           tutor_rubric_version, tutor_first_turn_score, tutor_overall_score,
           tutor_scores, learner_scores, tutor_development_score,
           tutor_last_turn_score, dialogue_id, dialogue_rounds,
           factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner,
           learner_architecture, model, ego_model, superego_model,
           judge_model, created_at, success
    FROM evaluation_results
    WHERE success = 1
      AND tutor_first_turn_score IS NOT NULL
      ${epochFilter.and}
  `;

  const params = [];

  if (filters.profileName) {
    sql += ` AND profile_name LIKE ?`;
    params.push(`%${filters.profileName}%`);
  }
  if (filters.scenarioId) {
    sql += ` AND scenario_id = ?`;
    params.push(filters.scenarioId);
  }

  sql += ` ORDER BY config_hash, scenario_id, created_at`;

  const rows = db.prepare(sql).all(...params);
  const groups = new Map();

  for (const row of rows) {
    const sig = computeEvalSignature(row);

    if (!groups.has(sig)) {
      groups.set(sig, {
        configHash: row.config_hash,
        scenarioId: row.scenario_id,
        scenarioName: row.scenario_name,
        profileName: row.profile_name,
        rubricVersion: row.tutor_rubric_version,
        factorRecognition: row.factor_recognition,
        factorMultiTutor: row.factor_multi_agent_tutor,
        factorMultiLearner: row.factor_multi_agent_learner,
        learnerArchitecture: row.learner_architecture,
        model: row.ego_model || row.model,
        runIds: new Set(),
        rows: [],
        scores: [],
      });
    }

    const group = groups.get(sig);
    group.runIds.add(row.run_id);
    group.rows.push(row);
    if (row.tutor_first_turn_score != null) {
      group.scores.push(row.tutor_first_turn_score);
    }
  }

  // Convert runIds Set to Array for serialization
  for (const group of groups.values()) {
    group.runIds = [...group.runIds];
    group.n = group.scores.length;
    group.nRuns = group.runIds.length;
    if (group.scores.length > 0) {
      group.mean = group.scores.reduce((a, b) => a + b, 0) / group.scores.length;
      group.sd =
        group.scores.length > 1
          ? Math.sqrt(group.scores.reduce((s, v) => s + (v - group.mean) ** 2, 0) / (group.scores.length - 1))
          : 0;
    }
  }

  return groups;
}

// ── Aggregated Stats ────────────────────────────────────────────────────────

/**
 * Compute summary statistics for the accumulation status.
 *
 * @param {Database} db
 * @param {string} epoch
 * @returns {Object} { totalRows, totalGroups, byN, byProfile, validationIssues }
 */
export function getAggregatedStats(db, epoch = '2.0') {
  const groups = getAggregatedGroups(db, epoch);

  const byN = { 1: 0, 2: 0, '3+': 0 };
  const byProfile = {};
  const validationIssues = [];

  for (const [sig, group] of groups) {
    // Count by N
    if (group.n === 1) byN[1]++;
    else if (group.n === 2) byN[2]++;
    else byN['3+']++;

    // Count by profile
    const profile = group.profileName || 'unknown';
    if (!byProfile[profile]) {
      byProfile[profile] = { total: 0, scenarios: new Set(), nSum: 0 };
    }
    byProfile[profile].total++;
    byProfile[profile].scenarios.add(group.scenarioId);
    byProfile[profile].nSum += group.n;

    // Validation: check for config_hash consistency
    if (!group.configHash) {
      validationIssues.push({
        signature: sig,
        issue: 'missing_config_hash',
        profileName: group.profileName,
        scenarioId: group.scenarioId,
        n: group.n,
      });
    }

    // Validation: check for config drift (rows with same profile+scenario but different config_hash)
    const uniqueHashes = new Set(group.rows.map((r) => r.config_hash).filter(Boolean));
    if (uniqueHashes.size > 1) {
      validationIssues.push({
        signature: sig,
        issue: 'config_hash_drift',
        profileName: group.profileName,
        scenarioId: group.scenarioId,
        hashes: [...uniqueHashes],
        n: group.n,
      });
    }
  }

  // Convert profile sets
  for (const p of Object.values(byProfile)) {
    p.scenarios = [...p.scenarios];
  }

  return {
    totalRows: [...groups.values()].reduce((s, g) => s + g.n, 0),
    totalGroups: groups.size,
    byN,
    byProfile,
    validationIssues,
    groups,
  };
}

/**
 * Find which cell×scenario combinations need more data to reach target N.
 *
 * @param {Database} db
 * @param {string} epoch
 * @param {number} targetN - desired minimum N per group (default: 3)
 * @returns {Array<Object>} gaps sorted by priority (most needed first)
 */
export function findAccumulationGaps(db, epoch = '2.0', targetN = 3) {
  const groups = getAggregatedGroups(db, epoch);
  const gaps = [];

  for (const [_sig, group] of groups) {
    if (group.n < targetN) {
      gaps.push({
        profileName: group.profileName,
        scenarioId: group.scenarioId,
        currentN: group.n,
        needed: targetN - group.n,
        currentMean: group.mean,
        runIds: group.runIds,
      });
    }
  }

  // Sort: prioritize groups with N=0, then N=1, then by profile name
  gaps.sort((a, b) => a.currentN - b.currentN || a.profileName.localeCompare(b.profileName));
  return gaps;
}
