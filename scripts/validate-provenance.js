#!/usr/bin/env node
/**
 * validate-provenance.js — Provenance chain validation for evaluation runs
 *
 * Verifies the full provenance chain for a given run (or all runs):
 *   1. Dialogue content hash coverage
 *   2. Dialogue log file integrity (hash match)
 *   3. Per-turn score provenance (contentTurnId + judgeInputHash)
 *   4. Turn ID log verification (recompute from log files)
 *   5. Config hash presence
 *   6. Score audit trail coverage
 *   7. Rubric version consistency (per-turn vs row-level)
 *
 * Usage:
 *   node scripts/validate-provenance.js <runId>           # validate a specific run
 *   node scripts/validate-provenance.js <runId> --verbose  # show per-row failure details
 *   node scripts/validate-provenance.js <runId> --json out.json  # structured JSON output
 *   node scripts/validate-provenance.js                    # validate ALL runs with scored rows
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';
import { verifyTurnIdsForRow } from '../services/provableDiscourse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'evaluations.db');
const LOG_DIR = join(ROOT, 'logs', 'tutor-dialogues');

// ── CLI Parsing ──────────────────────────────────────────────────────────────

function parseCli() {
  const args = process.argv.slice(2);
  const flags = { verbose: false };
  const values = {};
  let runId = null;

  const VALUE_OPTIONS = new Set(['json', 'db']);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--verbose') {
      flags.verbose = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (VALUE_OPTIONS.has(key) && i + 1 < args.length) {
        values[key] = args[++i];
      }
    } else if (!runId) {
      runId = arg;
    }
  }

  return { runId, verbose: flags.verbose, jsonPath: values.json || null, dbPath: values.db || null };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function pass(msg) {
  passCount++;
  console.log(`  ✓ ${msg}`);
}

function warn(msg) {
  warnCount++;
  console.log(`  ⚠ ${msg}`);
}

function fail(msg) {
  failCount++;
  console.log(`  ✗ ${msg}`);
}

function safeJsonParse(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function coverageStatus(covered, total, label) {
  if (total === 0) {
    warn(`${label}: no rows to check`);
    return 'warn';
  }
  const pct = ((covered / total) * 100).toFixed(1);
  if (covered === total) {
    pass(`${label}: ${covered}/${total} (100%)`);
    return 'pass';
  } else if (covered / total >= 0.9) {
    warn(`${label}: ${covered}/${total} (${pct}%) — pre-provenance rows expected`);
    return 'warn';
  } else {
    fail(`${label}: ${covered}/${total} (${pct}%)`);
    return 'fail';
  }
}

// ── Section 1: Dialogue Content Hash Coverage ────────────────────────────────

function checkDialogueHashCoverage(db, runId, verbose) {
  const rows = db
    .prepare(
      `SELECT id, dialogue_content_hash FROM evaluation_results
     WHERE run_id = ? AND tutor_scores IS NOT NULL`,
    )
    .all(runId);

  const withHash = rows.filter((r) => r.dialogue_content_hash != null);
  const without = rows.filter((r) => r.dialogue_content_hash == null);

  const status = coverageStatus(withHash.length, rows.length, 'Dialogue content hash coverage');

  if (verbose && without.length > 0) {
    for (const r of without.slice(0, 10)) {
      console.log(`    → missing: row ${r.id}`);
    }
    if (without.length > 10) console.log(`    → ... and ${without.length - 10} more`);
  }

  return {
    section: 'dialogue_hash_coverage',
    total: rows.length,
    covered: withHash.length,
    missing: without.length,
    status,
    failures: without.map((r) => ({ id: r.id, reason: 'missing_dialogue_content_hash' })),
  };
}

// ── Section 2: Dialogue Log File Integrity ───────────────────────────────────

function checkDialogueLogIntegrity(db, runId, verbose) {
  const rows = db
    .prepare(
      `SELECT id, dialogue_id, dialogue_content_hash FROM evaluation_results
     WHERE run_id = ? AND dialogue_content_hash IS NOT NULL AND dialogue_id IS NOT NULL`,
    )
    .all(runId);

  let matched = 0;
  let mismatched = 0;
  let missing = 0;
  let parseError = 0;
  const failures = [];

  for (const row of rows) {
    const filePath = join(LOG_DIR, `${row.dialogue_id}.json`);
    if (!existsSync(filePath)) {
      missing++;
      failures.push({ id: row.id, dialogueId: row.dialogue_id, reason: 'log_file_missing' });
      continue;
    }
    try {
      const content = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      const recomputedHash = createHash('sha256')
        .update(JSON.stringify(parsed, null, 2))
        .digest('hex');
      if (recomputedHash === row.dialogue_content_hash) {
        matched++;
      } else {
        mismatched++;
        failures.push({ id: row.id, dialogueId: row.dialogue_id, reason: 'hash_mismatch' });
      }
    } catch {
      parseError++;
      failures.push({ id: row.id, dialogueId: row.dialogue_id, reason: 'parse_error' });
    }
  }

  if (rows.length === 0) {
    warn('Dialogue log integrity: no rows with dialogue_content_hash to verify');
  } else if (mismatched === 0 && missing === 0 && parseError === 0) {
    pass(`Dialogue log integrity: ${matched}/${rows.length} verified`);
  } else {
    fail(
      `Dialogue log integrity: ${matched} match, ${mismatched} mismatch, ${missing} missing, ${parseError} parse error (of ${rows.length})`,
    );
  }

  if (verbose && failures.length > 0) {
    for (const f of failures.slice(0, 10)) {
      console.log(`    → ${f.reason}: row ${f.id} (dialogue ${f.dialogueId})`);
    }
    if (failures.length > 10) console.log(`    → ... and ${failures.length - 10} more`);
  }

  return {
    section: 'dialogue_log_integrity',
    total: rows.length,
    matched,
    mismatched,
    missing,
    parseError,
    status: mismatched === 0 && missing === 0 && parseError === 0 ? 'pass' : 'fail',
    failures,
  };
}

// ── Section 3: Per-Turn Score Provenance (contentTurnId + judgeInputHash) ────

function checkPerTurnProvenance(db, runId, verbose) {
  const rows = db
    .prepare(
      `SELECT id, tutor_scores FROM evaluation_results
     WHERE run_id = ? AND tutor_scores IS NOT NULL`,
    )
    .all(runId);

  let totalTurns = 0;
  let turnsWithContentTurnId = 0;
  let turnsWithJudgeInputHash = 0;
  const failuresTurnId = [];
  const failuresHash = [];

  for (const row of rows) {
    const tutorScores = safeJsonParse(row.tutor_scores);
    if (!tutorScores) continue;

    for (const [turnKey, turnValue] of Object.entries(tutorScores)) {
      if (!turnValue || typeof turnValue !== 'object') continue;
      totalTurns++;
      if (turnValue.contentTurnId) {
        turnsWithContentTurnId++;
      } else {
        failuresTurnId.push({ id: row.id, turn: turnKey });
      }
      if (turnValue.judgeInputHash) {
        turnsWithJudgeInputHash++;
      } else {
        failuresHash.push({ id: row.id, turn: turnKey });
      }
    }
  }

  coverageStatus(turnsWithContentTurnId, totalTurns, 'contentTurnId coverage');
  coverageStatus(turnsWithJudgeInputHash, totalTurns, 'judgeInputHash coverage');

  if (verbose) {
    if (failuresTurnId.length > 0) {
      const shown = failuresTurnId.slice(0, 5);
      for (const f of shown) console.log(`    → missing contentTurnId: row ${f.id}, turn ${f.turn}`);
      if (failuresTurnId.length > 5) console.log(`    → ... and ${failuresTurnId.length - 5} more`);
    }
    if (failuresHash.length > 0) {
      const shown = failuresHash.slice(0, 5);
      for (const f of shown) console.log(`    → missing judgeInputHash: row ${f.id}, turn ${f.turn}`);
      if (failuresHash.length > 5) console.log(`    → ... and ${failuresHash.length - 5} more`);
    }
  }

  return {
    section: 'per_turn_provenance',
    totalTurns,
    turnsWithContentTurnId,
    turnsWithJudgeInputHash,
    failuresTurnId,
    failuresHash,
  };
}

// ── Section 4: Turn ID Log Verification ──────────────────────────────────────

function checkTurnIdVerification(db, runId, verbose) {
  const rows = db
    .prepare(
      `SELECT id, dialogue_id, tutor_scores FROM evaluation_results
     WHERE run_id = ? AND tutor_scores IS NOT NULL AND dialogue_id IS NOT NULL`,
    )
    .all(runId);

  let verified = 0;
  let mismatched = 0;
  let unverifiable = 0;
  const failures = [];

  for (const row of rows) {
    const tutorScores = safeJsonParse(row.tutor_scores);
    if (!tutorScores) {
      unverifiable++;
      continue;
    }

    // Check if any turns have contentTurnId
    const hasAnyTurnId = Object.values(tutorScores).some((t) => t?.contentTurnId);
    if (!hasAnyTurnId) {
      unverifiable++;
      continue;
    }

    const verification = verifyTurnIdsForRow(row.dialogue_id, tutorScores, LOG_DIR);
    if (verification.size === 0) {
      unverifiable++;
      continue;
    }

    const allMatch = [...verification.values()].every((v) => v === true);
    if (allMatch) {
      verified++;
    } else {
      mismatched++;
      const failedTurns = [...verification.entries()].filter(([, v]) => !v).map(([idx]) => idx);
      failures.push({ id: row.id, dialogueId: row.dialogue_id, failedTurns });
    }
  }

  const checkable = verified + mismatched;
  if (checkable === 0 && unverifiable > 0) {
    warn(`Turn ID verification: ${unverifiable} row(s) unverifiable (no contentTurnIds or missing logs)`);
  } else if (mismatched === 0 && checkable > 0) {
    pass(`Turn ID verification: ${verified}/${checkable} verified (${unverifiable} unverifiable)`);
  } else {
    fail(`Turn ID verification: ${verified} verified, ${mismatched} mismatched (${unverifiable} unverifiable)`);
  }

  if (verbose && failures.length > 0) {
    for (const f of failures.slice(0, 10)) {
      console.log(`    → mismatch: row ${f.id} (dialogue ${f.dialogueId}), turns: ${f.failedTurns.join(', ')}`);
    }
    if (failures.length > 10) console.log(`    → ... and ${failures.length - 10} more`);
  }

  return {
    section: 'turn_id_verification',
    total: rows.length,
    verified,
    mismatched,
    unverifiable,
    status: mismatched === 0 ? 'pass' : 'fail',
    failures,
  };
}

// ── Section 5: Config Hash Presence ──────────────────────────────────────────

function checkConfigHashPresence(db, runId, verbose) {
  const rows = db
    .prepare(
      `SELECT id, config_hash FROM evaluation_results
     WHERE run_id = ? AND tutor_scores IS NOT NULL`,
    )
    .all(runId);

  const withHash = rows.filter((r) => r.config_hash != null);
  const without = rows.filter((r) => r.config_hash == null);

  const status = coverageStatus(withHash.length, rows.length, 'Config hash coverage');

  if (verbose && without.length > 0) {
    for (const r of without.slice(0, 10)) {
      console.log(`    → missing: row ${r.id}`);
    }
    if (without.length > 10) console.log(`    → ... and ${without.length - 10} more`);
  }

  return {
    section: 'config_hash_presence',
    total: rows.length,
    covered: withHash.length,
    missing: without.length,
    status,
    failures: without.map((r) => ({ id: r.id, reason: 'missing_config_hash' })),
  };
}

// ── Section 6: Score Audit Trail Coverage ────────────────────────────────────

function checkAuditTrailCoverage(db, runId, verbose) {
  const rows = db
    .prepare(
      `SELECT id FROM evaluation_results
     WHERE run_id = ? AND tutor_overall_score IS NOT NULL`,
    )
    .all(runId);

  let withAudit = 0;
  let withoutAudit = 0;
  const failures = [];

  for (const row of rows) {
    const auditRow = db.prepare('SELECT COUNT(*) AS c FROM score_audit WHERE result_id = ?').get(String(row.id));
    if (auditRow && auditRow.c > 0) {
      withAudit++;
    } else {
      withoutAudit++;
      failures.push({ id: row.id, reason: 'no_audit_entries' });
    }
  }

  const status = coverageStatus(withAudit, rows.length, 'Score audit trail coverage');

  if (verbose && failures.length > 0) {
    for (const f of failures.slice(0, 10)) {
      console.log(`    → no audit: row ${f.id}`);
    }
    if (failures.length > 10) console.log(`    → ... and ${failures.length - 10} more`);
  }

  return {
    section: 'audit_trail_coverage',
    total: rows.length,
    withAudit,
    withoutAudit,
    status,
    failures,
  };
}

// ── Section 7: Rubric Version Consistency ────────────────────────────────────

function checkRubricVersionConsistency(db, runId, verbose) {
  const rows = db
    .prepare(
      `SELECT id, tutor_scores, tutor_rubric_version FROM evaluation_results
     WHERE run_id = ? AND tutor_scores IS NOT NULL`,
    )
    .all(runId);

  let consistent = 0;
  let inconsistent = 0;
  let skipped = 0;
  const failures = [];

  for (const row of rows) {
    const tutorScores = safeJsonParse(row.tutor_scores);
    if (!tutorScores) {
      skipped++;
      continue;
    }

    let rowHasAnyVersion = false;
    let rowConsistent = true;

    for (const [turnKey, turnValue] of Object.entries(tutorScores)) {
      if (!turnValue || typeof turnValue !== 'object') continue;
      const perTurnVersion = turnValue.rubricVersion;
      if (perTurnVersion == null) continue;

      rowHasAnyVersion = true;
      if (row.tutor_rubric_version && perTurnVersion !== row.tutor_rubric_version) {
        rowConsistent = false;
        failures.push({
          id: row.id,
          turn: turnKey,
          perTurnVersion,
          rowVersion: row.tutor_rubric_version,
        });
      }
    }

    if (!rowHasAnyVersion) {
      skipped++;
    } else if (rowConsistent) {
      consistent++;
    } else {
      inconsistent++;
    }
  }

  if (consistent + inconsistent === 0) {
    warn(`Rubric version consistency: ${skipped} row(s) skipped (no per-turn rubricVersion fields)`);
  } else if (inconsistent === 0) {
    pass(`Rubric version consistency: ${consistent} consistent, ${skipped} skipped`);
  } else {
    fail(`Rubric version consistency: ${consistent} consistent, ${inconsistent} inconsistent, ${skipped} skipped`);
  }

  if (verbose && failures.length > 0) {
    for (const f of failures.slice(0, 10)) {
      console.log(
        `    → mismatch: row ${f.id} turn ${f.turn}: per-turn="${f.perTurnVersion}" vs row="${f.rowVersion}"`,
      );
    }
    if (failures.length > 10) console.log(`    → ... and ${failures.length - 10} more`);
  }

  return {
    section: 'rubric_version_consistency',
    total: rows.length,
    consistent,
    inconsistent,
    skipped,
    status: inconsistent === 0 ? 'pass' : 'fail',
    failures,
  };
}

// ── Run Validation ───────────────────────────────────────────────────────────

function validateRun(db, runId, verbose) {
  const runRow = db.prepare('SELECT id, description, created_at FROM evaluation_runs WHERE id = ?').get(runId);
  const desc = runRow?.description ? ` — ${runRow.description}` : '';
  console.log(`\n═══ Provenance Validation: ${runId}${desc} ═══`);

  const scoredCount = db
    .prepare(`SELECT COUNT(*) AS c FROM evaluation_results WHERE run_id = ? AND tutor_scores IS NOT NULL`)
    .get(runId);
  console.log(`  Scored rows: ${scoredCount?.c || 0}\n`);

  if (!scoredCount || scoredCount.c === 0) {
    warn(`No scored rows for run ${runId}, skipping`);
    return { runId, sections: [], skipped: true };
  }

  const sections = [];

  console.log('── 1. Dialogue Content Hash Coverage ──────────────────────');
  sections.push(checkDialogueHashCoverage(db, runId, verbose));

  console.log('\n── 2. Dialogue Log File Integrity ─────────────────────────');
  sections.push(checkDialogueLogIntegrity(db, runId, verbose));

  console.log('\n── 3. Per-Turn Score Provenance ────────────────────────────');
  sections.push(checkPerTurnProvenance(db, runId, verbose));

  console.log('\n── 4. Turn ID Log Verification ────────────────────────────');
  sections.push(checkTurnIdVerification(db, runId, verbose));

  console.log('\n── 5. Config Hash Presence ────────────────────────────────');
  sections.push(checkConfigHashPresence(db, runId, verbose));

  console.log('\n── 6. Score Audit Trail Coverage ──────────────────────────');
  sections.push(checkAuditTrailCoverage(db, runId, verbose));

  console.log('\n── 7. Rubric Version Consistency ──────────────────────────');
  sections.push(checkRubricVersionConsistency(db, runId, verbose));

  return { runId, sections, skipped: false };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const { runId, verbose, jsonPath, dbPath } = parseCli();

  const effectiveDbPath = dbPath || DB_PATH;
  if (!existsSync(effectiveDbPath)) {
    console.error(`Database not found: ${effectiveDbPath}`);
    process.exit(1);
  }

  const db = new Database(effectiveDbPath, { readonly: true });

  const results = [];

  if (runId) {
    // Validate a single run
    results.push(validateRun(db, runId, verbose));
  } else {
    // Validate all runs with scored rows
    const runs = db
      .prepare(`SELECT DISTINCT run_id FROM evaluation_results WHERE tutor_scores IS NOT NULL ORDER BY run_id`)
      .all();
    console.log(`\n═══ Provenance Validation: All Runs (${runs.length}) ═══`);
    for (const row of runs) {
      results.push(validateRun(db, row.run_id, verbose));
    }
  }

  db.close();

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log(`Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`);

  if (failCount > 0) {
    console.log('\nFAILED — provenance chain has broken links.');
  } else if (warnCount > 0) {
    console.log('\nPASSED with warnings (pre-provenance rows likely).');
  } else {
    console.log('\nALL PASSED ✓');
  }

  // ── JSON export ──────────────────────────────────────────────────────────
  if (jsonPath) {
    const output = {
      timestamp: new Date().toISOString(),
      summary: { pass: passCount, warn: warnCount, fail: failCount },
      runs: results,
    };
    writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\nJSON report written to: ${jsonPath}`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main();
