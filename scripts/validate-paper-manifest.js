#!/usr/bin/env node
/**
 * validate-paper-manifest.js — Level 1 paper manifest validation
 *
 * Reads config/paper-manifest.json, queries the DB, and reports any
 * discrepancies between expected and actual values. Run before building
 * the paper to catch N-count drift, stale totals, and stalled runs.
 *
 * Usage: node scripts/validate-paper-manifest.js [--fix-status]
 *   --fix-status  Mark stalled "running" runs as completed
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MANIFEST_PATH = join(ROOT, 'config', 'paper-manifest.json');
const DB_PATH = join(ROOT, 'data', 'evaluations.db');
const PAPER_PATH = join(ROOT, 'docs', 'research', 'paper-full.md');

const fixStatus = process.argv.includes('--fix-status');

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('Paper Manifest Validation');
  console.log('='.repeat(60));

  if (!existsSync(MANIFEST_PATH)) {
    fail(`Manifest not found: ${MANIFEST_PATH}`);
    return process.exit(1);
  }
  if (!existsSync(DB_PATH)) {
    fail(`Database not found: ${DB_PATH}`);
    return process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const db = new Database(DB_PATH, { readonly: !fixStatus });

  console.log(`\nManifest v${manifest.version} (${manifest.generated})`);
  console.log(`Expected: ${manifest.totals.evaluations} evaluations, ${manifest.totals.expected_scored} scored\n`);

  // 1. Validate each key evaluation against DB
  console.log('── Per-Run Validation ──────────────────────────────────────');
  let computedAttempts = 0;
  let computedScored = 0;

  for (const eval_ of manifest.key_evaluations) {
    const label = eval_.label;
    const runIds = eval_.run_ids;
    const judgePattern = eval_.primary_judge_pattern;

    // Query DB for actual counts
    const placeholders = runIds.map(() => '?').join(',');
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN overall_score IS NOT NULL THEN 1 ELSE 0 END) as scored
      FROM evaluation_results
      WHERE run_id IN (${placeholders})
        AND judge_model LIKE ?
    `).get(...runIds, judgePattern);

    const actualTotal = row?.total ?? 0;
    const actualScored = row?.scored ?? 0;

    // Special case: learner-side evaluation uses learner_overall_score
    let effectiveScored = actualScored;
    if (eval_.unit === 'learner turn') {
      const learnerRow = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN learner_overall_score IS NOT NULL THEN 1 ELSE 0 END) as scored
        FROM evaluation_results
        WHERE run_id IN (${placeholders})
          AND judge_model LIKE ?
      `).get(...runIds, judgePattern);
      effectiveScored = learnerRow?.scored ?? 0;
    }

    // Check run status
    for (const runId of runIds) {
      const runRow = db.prepare('SELECT status FROM evaluation_runs WHERE id = ?').get(runId);
      if (!runRow) {
        fail(`${label}: run ${runId} not found in evaluation_runs`);
      } else if (runRow.status !== 'completed') {
        if (fixStatus) {
          db.prepare("UPDATE evaluation_runs SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(runId);
          warn(`${label}: ${runId} was '${runRow.status}', fixed to 'completed'`);
        } else {
          fail(`${label}: ${runId} status='${runRow.status}' (expected 'completed'). Use --fix-status to fix.`);
        }
      }
    }

    // Compare counts
    // For attempts: some runs had failures cleaned from DB, so DB total may be <= expected_attempts
    // The key metric is scored count
    if (eval_.unit === 'learner turn') {
      if (effectiveScored !== eval_.expected_scored) {
        fail(`${label}: learner scored=${effectiveScored}, expected=${eval_.expected_scored}`);
      } else {
        pass(`${label}: ${effectiveScored} learner-scored ✓`);
      }
      computedAttempts += eval_.expected_attempts;
      computedScored += eval_.expected_scored;
    } else {
      if (actualScored !== eval_.expected_scored) {
        fail(`${label}: scored=${actualScored}, expected=${eval_.expected_scored}`);
      } else if (actualTotal < eval_.expected_scored) {
        fail(`${label}: total=${actualTotal} < scored=${eval_.expected_scored}`);
      } else {
        pass(`${label}: ${actualScored} scored (${actualTotal} total) ✓`);
      }
      computedAttempts += eval_.expected_attempts;
      computedScored += eval_.expected_scored;
    }
  }

  // 2. Validate totals
  console.log('\n── Totals Validation ───────────────────────────────────────');
  if (computedScored !== manifest.totals.expected_scored) {
    fail(`Scored total: sum of rows=${computedScored}, manifest=${manifest.totals.expected_scored}`);
  } else {
    pass(`Scored total: ${computedScored} ✓`);
  }
  if (computedAttempts !== manifest.totals.expected_attempts) {
    fail(`Attempts total: sum of rows=${computedAttempts}, manifest=${manifest.totals.expected_attempts}`);
  } else {
    pass(`Attempts total: ${computedAttempts} ✓`);
  }
  if (manifest.key_evaluations.length !== manifest.totals.evaluations) {
    fail(`Evaluation count: ${manifest.key_evaluations.length} rows, manifest says ${manifest.totals.evaluations}`);
  } else {
    pass(`Evaluation count: ${manifest.key_evaluations.length} ✓`);
  }

  // 3. Validate judge accounting
  console.log('\n── Judge Accounting ────────────────────────────────────────');
  let opusCount = 0;
  let sonnetCount = 0;
  const sonnetRuns = [];
  for (const eval_ of manifest.key_evaluations) {
    if (eval_.primary_judge_pattern.includes('sonnet')) {
      sonnetCount++;
      sonnetRuns.push(...eval_.run_ids);
    } else {
      opusCount++;
    }
  }
  if (opusCount !== manifest.totals.opus_primary_count) {
    fail(`Opus primary: counted ${opusCount}, manifest says ${manifest.totals.opus_primary_count}`);
  } else {
    pass(`Opus primary: ${opusCount} ✓`);
  }
  if (sonnetCount !== manifest.totals.sonnet_primary_count) {
    fail(`Sonnet primary: counted ${sonnetCount}, manifest says ${manifest.totals.sonnet_primary_count}`);
  } else {
    pass(`Sonnet primary: ${sonnetCount} (${sonnetRuns.join(', ')}) ✓`);
  }

  // 4. Validate paper prose references
  console.log('\n── Paper Prose Validation ──────────────────────────────────');
  if (existsSync(PAPER_PATH)) {
    const paper = readFileSync(PAPER_PATH, 'utf8');
    const expectedScored = manifest.totals.expected_scored.toLocaleString();
    const expectedAttempts = manifest.totals.expected_attempts.toLocaleString();

    // Check that the scored N appears consistently
    const scoredPattern = new RegExp(`N[=≈]\\s*${expectedScored.replace(',', ',')}`, 'g');
    const scoredMatches = paper.match(scoredPattern) || [];
    if (scoredMatches.length >= 4) {
      pass(`N=${expectedScored} appears ${scoredMatches.length} times in paper ✓`);
    } else {
      warn(`N=${expectedScored} appears only ${scoredMatches.length} times (expected ≥4)`);
    }

    // Check for stale N values
    const stalePatterns = [
      /N[=≈]\s*3,047/g,
      /N[=≈]\s*3,112/g,
      /N[=≈]\s*2,906/g,
      /3,130/g,
      /3,112/g,
    ];
    for (const pat of stalePatterns) {
      const matches = paper.match(pat) || [];
      if (matches.length > 0) {
        fail(`Stale N value found: ${pat.source} appears ${matches.length} times`);
      }
    }

    // Check Table 2 totals row
    const totalsRowPattern = new RegExp(
      `\\*\\*${expectedAttempts.replace(',', ',')}\\*\\*.*\\*\\*${expectedScored.replace(',', ',')}\\*\\*`
    );
    if (totalsRowPattern.test(paper)) {
      pass(`Table 2 totals row matches: ${expectedAttempts}/${expectedScored} ✓`);
    } else {
      fail(`Table 2 totals row doesn't match expected ${expectedAttempts}/${expectedScored}`);
    }

    // Check judge count in prose
    const judgePattern = /Twenty-(\w+) of the twenty-nine/;
    const judgeMatch = paper.match(judgePattern);
    if (judgeMatch) {
      const wordToNum = { 'eight': 28, 'seven': 27, 'six': 26, 'nine': 29 };
      const claimed = wordToNum[judgeMatch[1]];
      if (claimed === manifest.totals.opus_primary_count) {
        pass(`Judge prose: "Twenty-${judgeMatch[1]}" matches Opus count ${manifest.totals.opus_primary_count} ✓`);
      } else {
        fail(`Judge prose: "Twenty-${judgeMatch[1]}" (=${claimed}) doesn't match Opus count ${manifest.totals.opus_primary_count}`);
      }
    }

    // Check each run ID in Appendix D
    const allRunIds = manifest.key_evaluations.flatMap(e => e.run_ids);
    const uniqueRunIds = [...new Set(allRunIds)];
    let missingFromPaper = 0;
    for (const runId of uniqueRunIds) {
      if (!paper.includes(runId)) {
        fail(`Run ${runId} not found in paper`);
        missingFromPaper++;
      }
    }
    if (missingFromPaper === 0) {
      pass(`All ${uniqueRunIds.length} unique run IDs found in paper ✓`);
    }
  } else {
    warn(`Paper not found at ${PAPER_PATH}, skipping prose validation`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);
  if (failCount > 0) {
    console.log('\nFAILED — fix the issues above before building the paper.');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('\nPASSED with warnings.');
  } else {
    console.log('\nALL PASSED ✓');
  }
}

main();
