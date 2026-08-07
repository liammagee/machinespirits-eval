/**
 * One-off repair: `score_audit.result_id` was declared TEXT.
 *
 * It names `evaluation_results.id`, which is an INTEGER. SQLite's affinity
 * rules hid the mismatch, because every SQL join between the two converts on
 * the fly and matches. Code that rebuilds that join in memory gets no such
 * help: a Map keyed by the row id (a number) and a lookup by the audit row's
 * result_id (a string) agree on nothing, and report an empty result rather
 * than an error. That cost an hour of debugging on the worktree database copy.
 *
 * SQLite cannot retype a column in place, so the table is rebuilt. The copy
 * leans on affinity rather than CAST on purpose: a value that is not a lossless
 * integer is left as it stands instead of collapsing to 0. The archive held
 * none when this shipped — 117,825 rows, every one convertible.
 */

const SCORE_AUDIT_COLUMNS = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  operation TEXT NOT NULL,
  judge_model TEXT,
  rubric_version TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
`;

const COPIED_COLUMNS =
  'id, result_id, column_name, old_value, new_value, operation, judge_model, rubric_version, timestamp';

export function scoreAuditTableSql(tableName = 'score_audit') {
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${SCORE_AUDIT_COLUMNS})`;
}

/**
 * Rebuild `score_audit` with an INTEGER `result_id`, once. Callers must
 * recreate the table's indexes afterwards — dropping the old table drops them.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {'retyped'|'already-integer'|'skipped'} what happened
 */
export function retypeScoreAuditResultId(db) {
  try {
    const resultId = db
      .prepare('PRAGMA table_info(score_audit)')
      .all()
      .find((column) => column.name === 'result_id');
    if (!resultId || resultId.type === 'INTEGER') return 'already-integer';

    db.transaction(() => {
      db.exec(`
        CREATE TABLE score_audit_retyped (${SCORE_AUDIT_COLUMNS});
        INSERT INTO score_audit_retyped (${COPIED_COLUMNS})
          SELECT ${COPIED_COLUMNS} FROM score_audit;
        DROP TABLE score_audit;
        ALTER TABLE score_audit_retyped RENAME TO score_audit;
      `);
    })();
    return 'retyped';
  } catch (e) {
    // The shared archive may be held open by another process. The old
    // declaration still works for every SQL path, so leave it alone and try
    // again on the next open rather than failing the store outright.
    console.error('[evaluationStore] Migration skipped (score_audit.result_id retype):', e.message);
    return 'skipped';
  }
}
