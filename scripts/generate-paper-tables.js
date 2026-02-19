#!/usr/bin/env node
/**
 * generate-paper-tables.js — Level 3 paper manifest table generation + prose validation
 *
 * Reads config/paper-manifest.json, queries the DB, and:
 * 1. Generates Table 2 (Evaluation Sample Summary) markdown
 * 2. Generates Appendix D (Reproducibility Run IDs) markdown
 * 3. Validates all prose N-count references in paper-full.md
 * 4. Reports any discrepancies
 *
 * Usage:
 *   node scripts/generate-paper-tables.js              # validate only
 *   node scripts/generate-paper-tables.js --generate   # output generated tables
 *   node scripts/generate-paper-tables.js --diff       # show diffs against paper
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

const doGenerate = process.argv.includes('--generate');
const doDiff = process.argv.includes('--diff');

// ── Helpers ─────────────────────────────────────────────────────────────────

function commaNum(n) {
  return n.toLocaleString('en-US');
}

function numToWord(n) {
  const words = {
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    20: 'twenty',
    21: 'twenty-one',
    22: 'twenty-two',
    23: 'twenty-three',
    24: 'twenty-four',
    25: 'twenty-five',
    26: 'twenty-six',
    27: 'twenty-seven',
    28: 'twenty-eight',
    29: 'twenty-nine',
    30: 'thirty',
    31: 'thirty-one',
  };
  return words[n] || String(n);
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found: ${MANIFEST_PATH}`);
    process.exit(1);
  }
  if (!existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const db = new Database(DB_PATH, { readonly: true });

  // ── Query actual data ───────────────────────────────────────────────────

  const evalData = [];
  let totalAttempts = 0;
  let totalScored = 0;

  for (const eval_ of manifest.key_evaluations) {
    const runIds = eval_.run_ids;
    const judgePattern = eval_.primary_judge_pattern;
    const placeholders = runIds.map(() => '?').join(',');

    let scored;
    if (eval_.unit === 'learner turn') {
      const row = db
        .prepare(
          `
        SELECT COUNT(*) as total,
               SUM(CASE WHEN learner_overall_score IS NOT NULL THEN 1 ELSE 0 END) as scored
        FROM evaluation_results
        WHERE run_id IN (${placeholders}) AND judge_model LIKE ?
      `,
        )
        .get(...runIds, judgePattern);
      scored = row?.scored ?? 0;
    } else {
      const row = db
        .prepare(
          `
        SELECT COUNT(*) as total,
               SUM(CASE WHEN overall_score IS NOT NULL THEN 1 ELSE 0 END) as scored
        FROM evaluation_results
        WHERE run_id IN (${placeholders}) AND judge_model LIKE ?
      `,
        )
        .get(...runIds, judgePattern);
      scored = row?.scored ?? 0;
    }

    evalData.push({
      ...eval_,
      actual_scored: scored,
      run_id_display: runIds.join(', '),
    });

    totalAttempts += eval_.expected_attempts;
    totalScored += scored;
  }

  // ── Generate Table 2 ───────────────────────────────────────────────────

  if (doGenerate || doDiff) {
    console.log('═══ Generated Table 2: Evaluation Sample Summary ═══\n');

    const lines = [
      '| Evaluation | Run ID | Section | Total Attempts | Scored | Unit |',
      '|------------|--------|---------|----------------|--------|------|',
    ];

    for (const e of evalData) {
      const label = e.label.replace(/×/g, '$\\times$');
      lines.push(
        `| ${label} | ${e.run_id_display} | ${e.section} | ${e.expected_attempts} | ${e.actual_scored} | ${e.unit} |`,
      );
    }

    lines.push(`| **Paper totals** | — | — | **${commaNum(totalAttempts)}** | **${commaNum(totalScored)}** | — |`);

    console.log(lines.join('\n'));
    console.log();
  }

  // ── Generate Appendix D ─────────────────────────────────────────────────

  if (doGenerate || doDiff) {
    console.log('═══ Generated Appendix D: Reproducibility and Key Evaluation Run IDs ═══\n');

    const uniqueEvals = manifest.key_evaluations;
    const _uniqueRunIds = [...new Set(uniqueEvals.flatMap((e) => e.run_ids))];

    // Find duplicate run IDs (same run used for multiple evaluations)
    const runIdCounts = {};
    for (const e of uniqueEvals) {
      for (const rid of e.run_ids) {
        runIdCounts[rid] = (runIdCounts[rid] || 0) + 1;
      }
    }
    const duplicateRuns = Object.entries(runIdCounts)
      .filter(([, count]) => count > 1)
      .map(([rid]) => rid);

    // Multi-ID evals
    const multiIdEvals = uniqueEvals.filter((e) => e.run_ids.length > 1);

    const notes = [];
    if (duplicateRuns.length > 0) {
      notes.push(
        `${duplicateRuns.join(', ')} serves both ${uniqueEvals
          .filter((e) => e.run_ids.some((r) => duplicateRuns.includes(r)))
          .map((e) => e.label.toLowerCase())
          .join(' and ')}`,
      );
    }
    if (multiIdEvals.length > 0) {
      notes.push(`${multiIdEvals[0].run_ids.join(' and ')} are combined as one ${multiIdEvals[0].label.toLowerCase()}`);
    }

    console.log(
      `The ${numToWord(uniqueEvals.length)} key evaluations are listed below${notes.length > 0 ? ` (${notes.join('; ')})` : ''}:\n`,
    );

    const dLines = ['| Finding | Run ID | Section |', '|---------|--------|---------|'];
    for (const e of evalData) {
      dLines.push(`| ${e.label} | ${e.run_id_display} | ${e.section} |`);
    }

    console.log(dLines.join('\n'));
    console.log();
  }

  // ── Prose validation ──────────────────────────────────────────────────

  console.log('═══ Prose N-Count Validation ═══\n');

  if (!existsSync(PAPER_PATH)) {
    console.log('  Paper not found, skipping prose validation');
    return;
  }

  const paper = readFileSync(PAPER_PATH, 'utf8');
  const _lines = paper.split('\n');
  let issues = 0;

  const expectedScored = commaNum(totalScored);
  const expectedAttempts = commaNum(totalAttempts);

  // Check: paper-total N references (only those with comma-separated thousands)
  // Per-evaluation N values (N=262, N=88, etc.) are intentionally excluded.
  // Revision history (Appendix E) is excluded as it describes past states.
  const appendixEStart = paper.indexOf('## Appendix E');
  const mainBody = appendixEStart > 0 ? paper.substring(0, appendixEStart) : paper;

  const nPattern = /N[=≈]\s*([\d,]+)\s*(?:primary\s+)?scored/g;
  let match;
  while ((match = nPattern.exec(mainBody)) !== null) {
    const found = match[1];
    // Only check values with commas (>= 1,000) — these are paper totals
    if (found.includes(',') && found !== expectedScored) {
      const lineNum = mainBody.substring(0, match.index).split('\n').length;
      console.log(`  ✗ Line ${lineNum}: found "N=${found} scored", expected "N=${expectedScored} scored"`);
      issues++;
    }
  }

  // Check: manifest prose_n_references patterns all appear
  if (manifest.prose_n_references) {
    for (const ref of manifest.prose_n_references) {
      if (!mainBody.includes(ref.pattern)) {
        console.log(`  ✗ Expected pattern "${ref.pattern}" not found in ${ref.location}`);
        issues++;
      }
    }
  }

  // Check: no stale N values (in main body only, not revision history)
  const staleValues = ['3,047', '3,112', '3,130', '2,906'];
  for (const stale of staleValues) {
    const staleRe = new RegExp(stale.replace(',', ','), 'g');
    let m;
    while ((m = staleRe.exec(mainBody)) !== null) {
      const lineNum = mainBody.substring(0, m.index).split('\n').length;
      console.log(`  ✗ Line ${lineNum}: stale N value "${stale}" found`);
      issues++;
    }
  }

  // Check: Table 2 totals row
  const totalsPattern = new RegExp(
    `\\*\\*${expectedAttempts.replace(/,/g, ',')}\\*\\*.*\\*\\*${expectedScored.replace(/,/g, ',')}\\*\\*`,
  );
  if (!totalsPattern.test(paper)) {
    console.log(`  ✗ Table 2 totals row doesn't match expected ${expectedAttempts}/${expectedScored}`);
    issues++;
  }

  // Check: evaluation count in prose
  const countWord = numToWord(manifest.totals.evaluations);
  const countPattern = new RegExp(`${countWord} key evaluations`, 'g');
  const countMatches = paper.match(countPattern) || [];
  if (countMatches.length === 0) {
    console.log(`  ✗ "${countWord} key evaluations" not found in paper`);
    issues++;
  }

  // Check: judge accounting
  const opusWord = numToWord(manifest.totals.opus_primary_count);
  const opusCapWord = opusWord.charAt(0).toUpperCase() + opusWord.slice(1);
  if (!paper.includes(`${opusCapWord} of the ${countWord}`)) {
    console.log(`  ✗ Judge accounting: expected "${opusCapWord} of the ${countWord}" not found`);
    issues++;
  }

  // Check: each run ID appears in paper
  const allRunIds = manifest.key_evaluations.flatMap((e) => e.run_ids);
  const uniqueRunIds = [...new Set(allRunIds)];
  for (const runId of uniqueRunIds) {
    if (!paper.includes(runId)) {
      console.log(`  ✗ Run ID ${runId} not found in paper`);
      issues++;
    }
  }

  // Check: per-row scored counts match Table 2
  for (const e of evalData) {
    if (e.actual_scored !== e.expected_scored) {
      console.log(`  ✗ ${e.label}: DB scored=${e.actual_scored}, manifest expected=${e.expected_scored}`);
      issues++;
    }

    // Check the row appears in paper with correct scored count
    const rowPattern = new RegExp(
      `${e.run_ids[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\\|.*\\|.*${e.expected_scored}`,
    );
    if (!rowPattern.test(paper)) {
      console.log(`  ⚠ ${e.label}: scored count ${e.expected_scored} may not appear in Table 2 row`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  if (issues === 0) {
    console.log(`  ✓ All prose N-counts consistent (${expectedScored} scored, ${expectedAttempts} attempts)`);
    console.log(`  ✓ All ${uniqueRunIds.length} run IDs present in paper`);
    console.log(`  ✓ Judge accounting correct (${opusCapWord} of ${countWord} Opus-primary)`);
    console.log('\n  ALL PASSED ✓');
  } else {
    console.log(`\n  ${issues} issue(s) found`);
    process.exit(1);
  }

  db.close();
}

main();
