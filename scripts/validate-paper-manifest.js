#!/usr/bin/env node
/**
 * validate-paper-manifest.js — Paper manifest and consistency validation
 *
 * Level 1: Reads config/paper-manifest.json, queries the DB, and reports any
 * discrepancies between expected and actual values.
 *
 * Level 2 (--deep): Paper-internal consistency checks that don't require the DB.
 * Catches N-count drift, broken cross-references, orphaned run IDs, and
 * Table 2 structural issues.
 *
 * Usage: node scripts/validate-paper-manifest.js [--fix-status] [--deep]
 *   --fix-status  Mark stalled "running" runs as completed
 *   --deep        Run deep paper-internal consistency checks (passes A–E)
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
const deepMode = process.argv.includes('--deep');

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

// Number words for matching spelled-out counts in prose
const WORD_TO_NUM = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  'twenty-one': 21, 'twenty-two': 22, 'twenty-three': 23, 'twenty-four': 24,
  'twenty-five': 25, 'twenty-six': 26, 'twenty-seven': 27, 'twenty-eight': 28,
  'twenty-nine': 29, 'thirty': 30, 'thirty-one': 31, 'thirty-two': 32,
  'thirty-three': 33, 'thirty-four': 34, 'thirty-five': 35, 'thirty-six': 36,
  'thirty-seven': 37, 'thirty-eight': 38, 'thirty-nine': 39, 'forty': 40,
};

function numToWord(n) {
  return Object.entries(WORD_TO_NUM).find(([, v]) => v === n)?.[0];
}

/**
 * Split paper into main body (for validation) and revision history (excluded).
 * Appendix E is revision history — references there are editorial notes, not claims.
 */
function splitPaper(paper) {
  const appendixEMatch = paper.match(/^## Appendix E/m);
  if (appendixEMatch) {
    const idx = paper.indexOf(appendixEMatch[0]);
    return { body: paper.slice(0, idx), revisionHistory: paper.slice(idx) };
  }
  return { body: paper, revisionHistory: '' };
}

// ── Level 1: Manifest ↔ DB ─────────────────────────────────────────────────

function runLevel1(manifest, db) {
  console.log('\n── Level 1: Manifest ↔ DB ─────────────────────────────────');

  // 1. Validate each key evaluation against DB
  console.log('\n  ── Per-Run Validation ──');
  let computedAttempts = 0;
  let computedScored = 0;

  for (const eval_ of manifest.key_evaluations) {
    const label = eval_.label;
    const runIds = eval_.run_ids;
    const judgePattern = eval_.primary_judge_pattern;

    const placeholders = runIds.map(() => '?').join(',');
    const profileFilter = eval_.profile_filter;
    const profileClause = profileFilter ? ' AND profile_name LIKE ?' : '';
    const params = [...runIds, judgePattern, ...(profileFilter ? [profileFilter] : [])];

    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN overall_score IS NOT NULL THEN 1 ELSE 0 END) as scored
      FROM evaluation_results
      WHERE run_id IN (${placeholders})
        AND judge_model LIKE ?${profileClause}
    `).get(...params);

    const actualTotal = row?.total ?? 0;
    const actualScored = row?.scored ?? 0;

    let effectiveScored = actualScored;
    if (eval_.unit === 'learner turn') {
      const learnerRow = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN learner_overall_score IS NOT NULL THEN 1 ELSE 0 END) as scored
        FROM evaluation_results
        WHERE run_id IN (${placeholders})
          AND judge_model LIKE ?${profileClause}
      `).get(...params);
      effectiveScored = learnerRow?.scored ?? 0;
    }

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

    if (eval_.unit === 'learner turn') {
      if (effectiveScored !== eval_.expected_scored) {
        fail(`${label}: learner scored=${effectiveScored}, expected=${eval_.expected_scored}`);
      } else {
        pass(`${label}: ${effectiveScored} learner-scored`);
      }
      computedAttempts += eval_.expected_attempts;
      computedScored += eval_.expected_scored;
    } else {
      if (actualScored !== eval_.expected_scored) {
        fail(`${label}: scored=${actualScored}, expected=${eval_.expected_scored}`);
      } else if (actualTotal < eval_.expected_scored) {
        fail(`${label}: total=${actualTotal} < scored=${eval_.expected_scored}`);
      } else {
        pass(`${label}: ${actualScored} scored (${actualTotal} total)`);
      }
      computedAttempts += eval_.expected_attempts;
      computedScored += eval_.expected_scored;
    }
  }

  // 2. Validate totals
  console.log('\n  ── Totals ──');
  if (computedScored !== manifest.totals.expected_scored) {
    fail(`Scored total: sum of rows=${computedScored}, manifest=${manifest.totals.expected_scored}`);
  } else {
    pass(`Scored total: ${computedScored}`);
  }
  if (computedAttempts !== manifest.totals.expected_attempts) {
    fail(`Attempts total: sum of rows=${computedAttempts}, manifest=${manifest.totals.expected_attempts}`);
  } else {
    pass(`Attempts total: ${computedAttempts}`);
  }
  if (manifest.key_evaluations.length !== manifest.totals.evaluations) {
    fail(`Evaluation count: ${manifest.key_evaluations.length} rows, manifest says ${manifest.totals.evaluations}`);
  } else {
    pass(`Evaluation count: ${manifest.key_evaluations.length}`);
  }

  // 3. Validate judge accounting
  console.log('\n  ── Judge Accounting ──');
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
    pass(`Opus primary: ${opusCount}`);
  }
  if (sonnetCount !== manifest.totals.sonnet_primary_count) {
    fail(`Sonnet primary: counted ${sonnetCount}, manifest says ${manifest.totals.sonnet_primary_count}`);
  } else {
    pass(`Sonnet primary: ${sonnetCount} (${sonnetRuns.join(', ')})`);
  }

  // 4. Validate paper prose references
  console.log('\n  ── Paper Prose ──');
  if (existsSync(PAPER_PATH)) {
    const paper = readFileSync(PAPER_PATH, 'utf8');
    const expectedScored = manifest.totals.expected_scored.toLocaleString();
    const expectedAttempts = manifest.totals.expected_attempts.toLocaleString();

    const scoredPattern = new RegExp(`N[=≈]\\s*${expectedScored.replace(',', ',')}`, 'g');
    const scoredMatches = paper.match(scoredPattern) || [];
    if (scoredMatches.length >= 4) {
      pass(`N=${expectedScored} appears ${scoredMatches.length} times in paper`);
    } else {
      warn(`N=${expectedScored} appears only ${scoredMatches.length} times (expected ≥4)`);
    }

    const stalePatterns = [
      /N[=≈]\s*3,047/g,
      /N[=≈]\s*3,112/g,
      /N[=≈]\s*2,906/g,
      /N[=≈]\s*3,292/g,
      /N[=≈]\s*3,347/g,
    ];
    for (const pat of stalePatterns) {
      const { body } = splitPaper(paper);
      const matches = body.match(pat) || [];
      if (matches.length > 0) {
        fail(`Stale N value found in body: ${pat.source} appears ${matches.length} times`);
      }
    }

    const totalsRowPattern = new RegExp(
      `\\*\\*${expectedAttempts.replace(',', ',')}\\*\\*.*\\*\\*${expectedScored.replace(',', ',')}\\*\\*`
    );
    if (totalsRowPattern.test(paper)) {
      pass(`Table 2 totals row matches: ${expectedAttempts}/${expectedScored}`);
    } else {
      fail(`Table 2 totals row doesn't match expected ${expectedAttempts}/${expectedScored}`);
    }

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
      pass(`All ${uniqueRunIds.length} unique run IDs found in paper`);
    }
  } else {
    warn(`Paper not found at ${PAPER_PATH}, skipping prose validation`);
  }
}

// ── Level 2: Deep Paper-Internal Checks ─────────────────────────────────────

function runDeepChecks(manifest) {
  console.log('\n── Level 2: Deep Paper Checks ─────────────────────────────');

  if (!existsSync(PAPER_PATH)) {
    fail(`Paper not found at ${PAPER_PATH}`);
    return;
  }

  const paper = readFileSync(PAPER_PATH, 'utf8');
  const { body } = splitPaper(paper);
  const paperLines = paper.split('\n');
  const _bodyLines = body.split('\n');

  // ── Pass A: Parse Table 2 from Markdown ──
  passA(paper, manifest);

  // ── Pass B: Paper-Wide N-Count Consistency ──
  passB(body, manifest);

  // ── Pass C: Table Cross-References ──
  passC(body, paper);

  // ── Pass D: Section Cross-References ──
  passD(body, paperLines);

  // ── Pass E: Run ID Audit ──
  passE(body, paper, manifest);
}

/**
 * Pass A: Parse Table 2 from the markdown and verify internal consistency.
 * Sums each row's attempts/scored and checks against the stated totals row.
 */
function passA(paper, manifest) {
  console.log('\n  ── Pass A: Table 2 Structure ──');

  const lines = paper.split('\n');

  // Find Table 2 header
  const headerIdx = lines.findIndex(l => /^\*\*Table 2:/.test(l.trim()));
  if (headerIdx === -1) {
    fail('Table 2 header not found');
    return;
  }

  // Find the table column header row (starts with | Evaluation)
  let tableStart = -1;
  for (let i = headerIdx; i < Math.min(headerIdx + 5, lines.length); i++) {
    if (/^\|\s*Evaluation\s*\|/.test(lines[i])) {
      tableStart = i;
      break;
    }
  }
  if (tableStart === -1) {
    fail('Table 2 column headers not found');
    return;
  }

  // Parse data rows (skip header and separator)
  const dataRows = [];
  let totalsRow = null;
  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;

    const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
    if (cells.length < 5) continue;

    // Check if this is the totals row
    if (/Paper totals/i.test(cells[0])) {
      const attempts = parseInt(cells[3].replace(/[*,]/g, ''), 10);
      const scored = parseInt(cells[4].replace(/[*,]/g, ''), 10);
      totalsRow = { attempts, scored };
      continue;
    }

    const label = cells[0].replace(/\$[^$]+\$/g, '×'); // normalize LaTeX
    const runId = cells[1].trim();
    const section = cells[2].trim();
    const attempts = parseInt(cells[3].replace(/,/g, ''), 10);
    const scored = parseInt(cells[4].replace(/,/g, ''), 10);
    const unit = cells[5] || '';

    if (isNaN(attempts) || isNaN(scored)) continue;

    dataRows.push({ label, runId, section, attempts, scored, unit, lineNum: i + 1 });
  }

  if (dataRows.length === 0) {
    fail('No data rows parsed from Table 2');
    return;
  }

  const computedAttempts = dataRows.reduce((s, r) => s + r.attempts, 0);
  const computedScored = dataRows.reduce((s, r) => s + r.scored, 0);

  pass(`${dataRows.length} rows parsed, computed: ${computedAttempts.toLocaleString()} attempts / ${computedScored.toLocaleString()} scored`);

  if (totalsRow) {
    if (totalsRow.attempts !== computedAttempts) {
      fail(`Totals row attempts=${totalsRow.attempts.toLocaleString()}, computed=${computedAttempts.toLocaleString()}`);
    } else if (totalsRow.scored !== computedScored) {
      fail(`Totals row scored=${totalsRow.scored.toLocaleString()}, computed=${computedScored.toLocaleString()}`);
    } else {
      pass(`Totals row matches computed sums`);
    }
  } else {
    warn('No totals row found in Table 2');
  }

  // Cross-check with manifest
  if (computedScored !== manifest.totals.expected_scored) {
    fail(`Table 2 scored (${computedScored}) ≠ manifest expected_scored (${manifest.totals.expected_scored})`);
  } else {
    pass(`Table 2 scored matches manifest (${computedScored})`);
  }
  if (dataRows.length !== manifest.totals.evaluations) {
    fail(`Table 2 rows (${dataRows.length}) ≠ manifest evaluations (${manifest.totals.evaluations})`);
  } else {
    pass(`Table 2 row count matches manifest (${dataRows.length})`);
  }
}

/**
 * Pass B: Find all large N-count patterns in the body and check consistency.
 * Also checks spelled-out evaluation counts (e.g., "thirty-six").
 */
function passB(body, manifest) {
  console.log('\n  ── Pass B: N-Count Consistency ──');

  const expectedScored = manifest.totals.expected_scored;
  const expectedAttempts = manifest.totals.expected_attempts;
  const evalCount = manifest.totals.evaluations;

  // Check that the paper total N appears consistently in the body
  const totalPattern = new RegExp(`N[=≈]\\s*${expectedScored.toLocaleString().replace(',', ',')}`, 'g');
  const totalMatches = body.match(totalPattern) || [];
  if (totalMatches.length >= 4) {
    pass(`Paper total N=${expectedScored.toLocaleString()} appears ${totalMatches.length} times in body`);
  } else {
    warn(`Paper total N=${expectedScored.toLocaleString()} appears only ${totalMatches.length} times (expected ≥4)`);
  }

  // Check for stale N values that look like old paper totals (within ±200 of current total)
  // These are the most dangerous drift: someone changed the total but missed a reference
  const nPattern = /N[=≈]\s*([\d,]+)/g;
  let match;
  const staleCandidate = [];
  while ((match = nPattern.exec(body)) !== null) {
    const raw = match[1].replace(/,/g, '');
    const num = parseInt(raw, 10);
    // Only flag values suspiciously close to the paper total (within ±200) but not equal
    if (num >= 2500 && num <= 5000 && num !== expectedScored && num !== expectedAttempts) {
      const distance = Math.abs(num - expectedScored);
      if (distance <= 200) {
        staleCandidate.push({ value: num, context: match[0] });
      }
    }
  }

  if (staleCandidate.length > 0) {
    for (const { value, context } of staleCandidate) {
      fail(`Possible stale total: ${value.toLocaleString()} ("${context}") — close to but ≠ paper total ${expectedScored.toLocaleString()}`);
    }
  } else {
    pass(`No stale N values near paper total detected`);
  }

  // Check spelled-out evaluation count
  const evalWord = numToWord(evalCount);
  if (evalWord) {
    const wordPattern = new RegExp(`${evalWord}\\s+(key\\s+)?evaluations`, 'gi');
    const wordMatches = body.match(wordPattern) || [];
    if (wordMatches.length > 0) {
      pass(`Evaluation count "${evalWord}" appears ${wordMatches.length} times`);
    } else {
      warn(`Spelled-out evaluation count "${evalWord}" not found in body`);
    }

    // Check for mismatched spelled-out counts
    const allEvalWordPattern = /(twenty|thirty|forty)-(\w+)\s+(key\s+)?evaluations/gi;
    let evalWordMatch;
    while ((evalWordMatch = allEvalWordPattern.exec(body)) !== null) {
      const foundWord = evalWordMatch[0].replace(/\s+(key\s+)?evaluations/i, '').toLowerCase();
      const foundNum = WORD_TO_NUM[foundWord];
      if (foundNum && foundNum !== evalCount) {
        fail(`Stale evaluation count: "${foundWord}" (=${foundNum}) in body, expected "${evalWord}" (=${evalCount})`);
      }
    }
  }
}

/**
 * Pass C: Parse all table headers and cross-references in the body.
 * Flags references to non-existent tables.
 */
function passC(body, fullPaper) {
  console.log('\n  ── Pass C: Table References ──');

  // Parse **Table N:** or **Table Nb:** headers from full paper
  const tableHeaderPattern = /\*\*Table (\d+[a-z]?)(?::|\.)/g;
  const definedTables = new Set();
  let match;
  while ((match = tableHeaderPattern.exec(fullPaper)) !== null) {
    definedTables.add(match[1]);
  }

  // Parse Table N references in body prose (not in table headers or Appendix E)
  const tableRefPattern = /Table (\d+[a-z]?)\b/g;
  const references = new Map(); // tableId → count
  while ((match = tableRefPattern.exec(body)) !== null) {
    const id = match[1];
    // Skip if this is inside a table header definition
    const lineStart = body.lastIndexOf('\n', match.index);
    const line = body.slice(lineStart, body.indexOf('\n', match.index + match[0].length));
    if (/\*\*Table \d+[a-z]?[:.]/i.test(line)) continue;

    references.set(id, (references.get(id) || 0) + 1);
  }

  const totalRefs = [...references.values()].reduce((s, c) => s + c, 0);
  pass(`${definedTables.size} tables defined, ${totalRefs} references in body`);

  let brokenRefs = 0;
  for (const [id, count] of references) {
    if (!definedTables.has(id)) {
      fail(`Table ${id} referenced ${count} time(s) but not defined`);
      brokenRefs++;
    }
  }
  if (brokenRefs === 0) {
    pass('All table references resolve to defined tables');
  }
}

/**
 * Pass D: Parse section headers and cross-references in the body.
 * Flags references to non-existent sections.
 */
function passD(body, paperLines) {
  console.log('\n  ── Pass D: Section References ──');

  // Parse section headers: ## N. or ### N.N
  const sectionPattern = /^#{2,3}\s+(\d+(?:\.\d+)?)\b/;
  const definedSections = new Set();
  for (const line of paperLines) {
    const match = line.match(sectionPattern);
    if (match) {
      definedSections.add(match[1]);
    }
  }

  // Also add appendix sections
  const appendixPattern = /^## Appendix ([A-Z])/;
  for (const line of paperLines) {
    const match = line.match(appendixPattern);
    if (match) {
      definedSections.add(`Appendix ${match[1]}`);
    }
  }

  // Parse "Section N.N" references in body
  const sectionRefPattern = /Section (\d+(?:\.\d+)?)\b/g;
  const references = new Map();
  let match;
  while ((match = sectionRefPattern.exec(body)) !== null) {
    const id = match[1];
    references.set(id, (references.get(id) || 0) + 1);
  }

  const totalRefs = [...references.values()].reduce((s, c) => s + c, 0);
  pass(`${definedSections.size} sections defined, ${totalRefs} "Section X.Y" references`);

  let brokenRefs = 0;
  for (const [id, count] of references) {
    // A reference to "Section 6" should match "## 6. Results"
    // A reference to "Section 6.3" should match "### 6.3 Full Factorial..."
    if (!definedSections.has(id)) {
      // Also check if the parent section exists (e.g., "Section 6" matches "## 6.")
      const parent = id.split('.')[0];
      if (id.includes('.') || !definedSections.has(parent)) {
        fail(`Section ${id} referenced ${count} time(s) but not defined`);
        brokenRefs++;
      }
    }
  }
  if (brokenRefs === 0) {
    pass('All section references resolve to defined sections');
  }
}

/**
 * Pass E: Audit run IDs — every run ID in prose should be in Table 2,
 * and every Table 2 run ID should appear somewhere in the paper.
 */
function passE(body, fullPaper, _manifest) {
  console.log('\n  ── Pass E: Run ID Audit ──');

  // Extract run IDs from Table 2 in the paper
  const table2RunIds = new Set();
  const table2Pattern = /eval-2026-\d{2}-\d{2}-[a-f0-9]{8}/g;
  const lines = fullPaper.split('\n');

  // Find Table 2 boundaries
  const headerIdx = lines.findIndex(l => /^\*\*Table 2:/.test(l.trim()));
  if (headerIdx === -1) {
    warn('Table 2 not found for run ID audit');
    return;
  }

  // Parse Table 2 run IDs
  for (let i = headerIdx; i < lines.length; i++) {
    const line = lines[i];
    if (i > headerIdx + 2 && !line.trim().startsWith('|')) break;
    let m;
    while ((m = table2Pattern.exec(line)) !== null) {
      table2RunIds.add(m[0]);
    }
  }

  // Extract all run IDs from body (excluding Appendix E)
  const bodyRunIds = new Set();
  const bodyPattern = /eval-2026-\d{2}-\d{2}-[a-f0-9]{8}/g;
  let bm;
  while ((bm = bodyPattern.exec(body)) !== null) {
    bodyRunIds.add(bm[0]);
  }

  pass(`${bodyRunIds.size} run IDs in body, ${table2RunIds.size} in Table 2`);

  // Check: every body run ID should be in Table 2 or Appendix D
  let orphaned = 0;
  for (const runId of bodyRunIds) {
    if (!table2RunIds.has(runId)) {
      // Check if it's in Appendix D
      const appendixDIdx = fullPaper.indexOf('## Appendix D');
      const appendixEIdx = fullPaper.indexOf('## Appendix E');
      if (appendixDIdx !== -1) {
        const appendixD = fullPaper.slice(appendixDIdx, appendixEIdx !== -1 ? appendixEIdx : undefined);
        if (!appendixD.includes(runId)) {
          warn(`Run ID ${runId} in body but not in Table 2 or Appendix D`);
          orphaned++;
        }
      }
    }
  }
  if (orphaned === 0) {
    pass('All body run IDs found in Table 2 or Appendix D');
  }

  // Check: every Table 2 run ID should appear somewhere in the paper body or appendices
  let unreferenced = 0;
  for (const runId of table2RunIds) {
    // Count appearances outside Table 2 (should appear at least in Appendix D)
    const fullCount = (fullPaper.match(new RegExp(runId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (fullCount <= 1) {
      warn(`Run ID ${runId} appears only in Table 2, nowhere else`);
      unreferenced++;
    }
  }
  if (unreferenced === 0) {
    pass('All Table 2 run IDs referenced elsewhere in paper');
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('═══ Paper Consistency Validation ═══');
  console.log('═'.repeat(50));

  if (!existsSync(MANIFEST_PATH)) {
    fail(`Manifest not found: ${MANIFEST_PATH}`);
    return process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  console.log(`\nManifest v${manifest.version} (${manifest.generated})`);
  console.log(`Expected: ${manifest.totals.evaluations} evaluations, ${manifest.totals.expected_scored.toLocaleString()} scored`);

  // Level 1: Manifest ↔ DB (always runs)
  if (existsSync(DB_PATH)) {
    const db = new Database(DB_PATH, { readonly: !fixStatus });
    runLevel1(manifest, db);
    db.close();
  } else {
    warn(`Database not found at ${DB_PATH}, skipping Level 1`);
  }

  // Level 2: Deep paper checks (only with --deep)
  if (deepMode) {
    runDeepChecks(manifest);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(`Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`);
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
