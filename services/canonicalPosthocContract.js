import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { resolveTutorDialoguesDir } from './evaluationDataPaths.js';

export const CANONICAL_POSTHOC_CONTRACT_VERSION = 'canonical-posthoc-v1';

export class PosthocBoundaryError extends Error {
  constructor(message) {
    super(`[posthoc-boundary] ${message}`);
    this.name = 'PosthocBoundaryError';
  }
}

function fail(message) {
  throw new PosthocBoundaryError(message);
}

function present(value) {
  return value != null && String(value).trim() !== '';
}

function uniquePresent(rows, field) {
  return [
    ...new Set(
      rows
        .map((row) => row[field])
        .filter(present)
        .map(String),
    ),
  ].sort();
}

function requireSingleVersion(rows, field, label) {
  const missing = rows.filter((row) => !present(row[field]));
  if (missing.length > 0) {
    fail(`${label} is missing on ${missing.length} selected row(s)`);
  }
  const versions = uniquePresent(rows, field);
  if (versions.length !== 1) {
    fail(`${label} must be singular; found ${versions.join(', ') || 'none'}`);
  }
  return versions[0];
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function assertGroupFieldStable(group, field, label) {
  const values = uniquePresent(group, field);
  if (values.length !== 1 || group.some((row) => !present(row[field]))) {
    fail(`${label} differs across repeated judgments for response ${group[0].id}`);
  }
}

/**
 * Validate the strict input contract used by the canonical post-hoc pipeline.
 * Exploratory scripts remain independently runnable, but this path refuses to
 * combine rows whose scoring or trace provenance is not comparable.
 */
export function validateCanonicalPosthocInputs({ rootDir, dbPath, logsDir, runId, primaryJudge }) {
  if (!present(runId)) fail('run id is required');
  if (!present(primaryJudge)) fail('primary judge is required');
  if (!fs.existsSync(dbPath)) fail(`evaluation DB does not exist: ${dbPath}`);

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'evaluation_results'")
      .get();
    if (!table) fail('evaluation_results table is missing');

    const requiredColumns = [
      'id',
      'run_id',
      'dialogue_id',
      'suggestions',
      'success',
      'judge_model',
      'tutor_first_turn_score',
      'tutor_rubric_version',
      'learner_rubric_version',
      'config_hash',
      'dialogue_content_hash',
      'prompt_content_hash',
    ];
    const columns = new Set(
      db
        .prepare('PRAGMA table_info(evaluation_results)')
        .all()
        .map((column) => column.name),
    );
    const absentColumns = requiredColumns.filter((column) => !columns.has(column));
    if (absentColumns.length > 0) fail(`fixture/schema is missing required columns: ${absentColumns.join(', ')}`);

    const rows = db
      .prepare(
        `SELECT id, run_id, scenario_id, profile_name, attempt_index, dialogue_id,
                suggestions, success, judge_model, tutor_first_turn_score,
                tutor_rubric_version, learner_rubric_version,
                config_hash, dialogue_content_hash, prompt_content_hash,
                learner_scores
         FROM evaluation_results
         WHERE run_id = ?
         ORDER BY id`,
      )
      .all(runId);

    if (rows.length === 0) fail(`run ${runId} has no evaluation rows`);

    const scoredRows = rows.filter(
      (row) => row.success === 1 && row.tutor_first_turn_score != null && present(row.suggestions),
    );
    if (scoredRows.length === 0) fail(`run ${runId} has no successful scored rows`);

    const primaryRows = scoredRows.filter((row) => row.judge_model === primaryJudge);
    if (primaryRows.length === 0) fail(`primary judge ${primaryJudge} has no scored rows in ${runId}`);

    const tutorRubricVersion = requireSingleVersion(scoredRows, 'tutor_rubric_version', 'tutor rubric version');
    const learnerRows = scoredRows.filter((row) => present(row.learner_scores));
    const learnerRubricVersion = requireSingleVersion(learnerRows, 'learner_rubric_version', 'learner rubric version');

    const provenanceFields = ['config_hash', 'dialogue_content_hash', 'prompt_content_hash'];
    for (const field of provenanceFields) {
      const missing = scoredRows.filter((row) => !present(row[field]));
      if (missing.length > 0) fail(`${field} is missing on ${missing.length} scored row(s)`);
    }

    const responseGroups = groupBy(scoredRows, (row) => String(row.suggestions));
    let pairedResponses = 0;
    for (const group of responseGroups.values()) {
      const judges = uniquePresent(group, 'judge_model');
      const duplicateJudges = groupBy(group, (row) => row.judge_model);
      if ([...duplicateJudges.values()].some((judgeRows) => judgeRows.length > 1)) {
        fail(`response ${group[0].id} has duplicate rows for the same judge`);
      }
      if (judges.length > 1) {
        pairedResponses++;
        if (!judges.includes(primaryJudge)) {
          fail(`repeated judgment for response ${group[0].id} does not include primary judge ${primaryJudge}`);
        }
        for (const field of provenanceFields) {
          assertGroupFieldStable(group, field, field);
        }
      }
    }
    if (pairedResponses < 3) {
      fail(`at least 3 content-identical judge pairs are required; found ${pairedResponses}`);
    }

    const judges = uniquePresent(scoredRows, 'judge_model');
    if (judges.length < 2) fail('reliability analysis requires at least two judges');
    const nonPrimaryRows = scoredRows.filter((row) => row.judge_model !== primaryJudge);
    for (const row of nonPrimaryRows) {
      const peers = responseGroups.get(String(row.suggestions)) || [];
      if (!peers.some((peer) => peer.judge_model === primaryJudge)) {
        fail(`judge ${row.judge_model} row ${row.id} is not paired to the primary judge`);
      }
    }

    const dialoguesDir = resolveTutorDialoguesDir(rootDir, logsDir);
    const dialogueIds = [...new Set(primaryRows.map((row) => row.dialogue_id).filter(present))].sort();
    if (dialogueIds.length === 0) fail('primary-judge rows contain no dialogue ids');

    const traceVersions = new Set();
    for (const dialogueId of dialogueIds) {
      const logPath = path.join(dialoguesDir, `${dialogueId}.json`);
      if (!fs.existsSync(logPath)) fail(`dialogue log is missing: ${logPath}`);
      let log;
      try {
        log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      } catch (error) {
        fail(`dialogue log is invalid JSON (${dialogueId}): ${error.message}`);
      }
      if (!Number.isInteger(log.schemaVersion)) fail(`dialogue ${dialogueId} has no integer schemaVersion`);
      traceVersions.add(log.schemaVersion);
    }
    if (traceVersions.size !== 1) {
      fail(`trace schema version must be singular; found ${[...traceVersions].sort().join(', ')}`);
    }
    const traceSchemaVersion = [...traceVersions][0];
    if (traceSchemaVersion < 5) {
      fail(`trace schema version ${traceSchemaVersion} is below the canonical minimum (5)`);
    }

    return {
      contractVersion: CANONICAL_POSTHOC_CONTRACT_VERSION,
      runId,
      primaryJudge,
      rowCounts: {
        total: rows.length,
        scored: scoredRows.length,
        primary: primaryRows.length,
        ignoredMissingOrFailed: rows.length - scoredRows.length,
      },
      boundaries: {
        tutorRubricVersion,
        learnerRubricVersion,
        judges,
        pairedResponses,
        provenanceFields,
        traceSchemaVersion,
        dialogueCount: dialogueIds.length,
      },
    };
  } finally {
    db.close();
  }
}
