#!/usr/bin/env node
/**
 * validate-factorial-coverage.js — Check messages-mode 2×2×2 factorial completeness
 *
 * Verifies that the 8 factorial cells (80-87) have balanced coverage
 * for each model combination in the database. Reports:
 *   - Which model combinations exist
 *   - Per-combination: cell coverage, run counts, balance
 *   - Missing cells, unbalanced N, rubric/judge inconsistencies
 *
 * Usage:
 *   node scripts/validate-factorial-coverage.js                # All model combos
 *   node scripts/validate-factorial-coverage.js --run-id <id>  # Specific run only
 *   node scripts/validate-factorial-coverage.js --target-n 5   # Set target N (default: 3)
 *   node scripts/validate-factorial-coverage.js --json         # Machine-readable output
 *   node scripts/validate-factorial-coverage.js --scenario <id> # Filter by scenario
 *
 * See: notes/messages-mode-factorial-matrix.md
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');

// ── Factorial Design ────────────────────────────────────────────────────────

const FACTORIAL_CELLS = [
  { cell: 80, name: 'cell_80_messages_base_single_unified',    prompt: 'base',        tutor: 'single', learner: 'unified' },
  { cell: 81, name: 'cell_81_messages_base_single_psycho',     prompt: 'base',        tutor: 'single', learner: 'ego_superego' },
  { cell: 82, name: 'cell_82_messages_base_multi_unified',     prompt: 'base',        tutor: 'multi',  learner: 'unified' },
  { cell: 83, name: 'cell_83_messages_base_multi_psycho',      prompt: 'base',        tutor: 'multi',  learner: 'ego_superego' },
  { cell: 84, name: 'cell_84_messages_recog_single_unified',   prompt: 'recognition', tutor: 'single', learner: 'unified' },
  { cell: 85, name: 'cell_85_messages_recog_single_psycho',    prompt: 'recognition', tutor: 'single', learner: 'ego_superego' },
  { cell: 86, name: 'cell_86_messages_recog_multi_unified',    prompt: 'recognition', tutor: 'multi',  learner: 'unified' },
  { cell: 87, name: 'cell_87_messages_recog_multi_psycho',     prompt: 'recognition', tutor: 'multi',  learner: 'ego_superego' },
];

const CELL_NAMES = new Set(FACTORIAL_CELLS.map((c) => c.name));

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const runIdIdx = args.indexOf('--run-id');
const runIdFilter = runIdIdx !== -1 ? args[runIdIdx + 1] : null;
const targetNIdx = args.indexOf('--target-n');
const targetN = targetNIdx !== -1 ? parseInt(args[targetNIdx + 1], 10) : 3;
const scenarioIdx = args.indexOf('--scenario');
const scenarioFilter = scenarioIdx !== -1 ? args[scenarioIdx + 1] : null;

// ── Helpers ─────────────────────────────────────────────────────────────────

function bar(n, max, width = 8) {
  const filled = max > 0 ? Math.round((n / max) * width) : 0;
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/** Normalize model labels: strip 'openrouter.' prefix and org path for display */
function shortModel(m) {
  if (!m) return '—';
  return m.replace(/^openrouter\./, '').replace(/^[^/]+\//, '');
}

/** Build a model combination key from ego model only.
 *  Superego model is structural (present for multi-agent cells, absent for single),
 *  so we group by ego model and track superego models separately for display. */
function modelComboKey(egoModel) {
  return shortModel(egoModel) || 'default';
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  // Query all scored rows for factorial cells 80-87
  let whereClause = `WHERE profile_name IN (${[...CELL_NAMES].map(() => '?').join(',')})`;
  const params = [...CELL_NAMES];

  // Must have a tutor score (not just generated)
  whereClause += ` AND (tutor_first_turn_score IS NOT NULL OR tutor_overall_score IS NOT NULL)`;

  if (runIdFilter) {
    whereClause += ` AND run_id = ?`;
    params.push(runIdFilter);
  }
  if (scenarioFilter) {
    whereClause += ` AND scenario_id = ?`;
    params.push(scenarioFilter);
  }

  const rows = db.prepare(`
    SELECT
      profile_name,
      scenario_id,
      ego_model,
      superego_model,
      judge_model,
      tutor_rubric_version,
      learner_rubric_version,
      tutor_first_turn_score,
      tutor_overall_score,
      run_id
    FROM evaluation_results
    ${whereClause}
  `).all(...params);

  if (rows.length === 0) {
    if (jsonMode) {
      console.log(JSON.stringify({ error: 'No scored factorial rows found', rows: 0 }));
    } else {
      console.log('\nNo scored rows found for cells 80-87.');
      if (runIdFilter) console.log(`  (filtered to run_id = ${runIdFilter})`);
    }
    db.close();
    return;
  }

  // ── Group by model combination ──────────────────────────────────────────

  const combos = new Map(); // modelComboKey → { rows, cells, scenarios, judges, rubrics, runs, superegoModels }

  for (const row of rows) {
    const key = modelComboKey(row.ego_model);
    if (!combos.has(key)) {
      combos.set(key, { rows: [], cells: new Map(), scenarios: new Set(), judges: new Set(), rubrics: new Set(), runs: new Set(), superegoModels: new Set() });
    }
    const combo = combos.get(key);
    combo.rows.push(row);
    combo.scenarios.add(row.scenario_id);
    combo.judges.add(row.judge_model || 'unknown');
    combo.rubrics.add(row.tutor_rubric_version || 'unknown');
    combo.runs.add(row.run_id);
    if (row.superego_model) combo.superegoModels.add(shortModel(row.superego_model));

    // Track per-cell × scenario counts
    const cellKey = row.profile_name;
    if (!combo.cells.has(cellKey)) {
      combo.cells.set(cellKey, new Map()); // scenario → count
    }
    const scenarioMap = combo.cells.get(cellKey);
    scenarioMap.set(row.scenario_id, (scenarioMap.get(row.scenario_id) || 0) + 1);
  }

  // ── Analyze each combination ────────────────────────────────────────────

  const results = [];

  for (const [comboKey, combo] of combos) {
    const coveredCells = new Set(combo.cells.keys());
    const missingCells = FACTORIAL_CELLS.filter((c) => !coveredCells.has(c.name));

    // Per-cell min/max N (across scenarios)
    const cellNs = {};
    for (const fc of FACTORIAL_CELLS) {
      const scenarioMap = combo.cells.get(fc.name);
      if (scenarioMap) {
        const counts = [...scenarioMap.values()];
        cellNs[fc.name] = { min: Math.min(...counts), max: Math.max(...counts), scenarios: scenarioMap.size };
      } else {
        cellNs[fc.name] = { min: 0, max: 0, scenarios: 0 };
      }
    }

    const allMinN = Math.min(...Object.values(cellNs).map((c) => c.min));
    const allMaxN = Math.max(...Object.values(cellNs).map((c) => c.max));
    const isBalanced = allMinN === allMaxN && allMinN >= targetN;
    const isComplete = missingCells.length === 0;
    const multipleJudges = combo.judges.size > 1;
    const multipleRubrics = combo.rubrics.size > 1;

    const issues = [];
    if (!isComplete) issues.push(`Missing ${missingCells.length} cell(s)`);
    if (!isBalanced && isComplete) issues.push(`Unbalanced N (${allMinN}–${allMaxN}, target=${targetN})`);
    if (allMinN < targetN) issues.push(`Below target N (min=${allMinN}, target=${targetN})`);
    if (combo.superegoModels.size > 1) issues.push(`Multiple superego models: ${[...combo.superegoModels].join(', ')} — do not pool for ANOVA`);
    if (multipleJudges) issues.push(`Multiple judges: ${[...combo.judges].join(', ')}`);
    if (multipleRubrics) issues.push(`Multiple rubric versions: ${[...combo.rubrics].join(', ')}`);

    const superegoModels = [...combo.superegoModels];

    results.push({
      comboKey,
      superegoModels,
      totalRows: combo.rows.length,
      coveredCells: coveredCells.size,
      missingCells: missingCells.map((c) => c.name),
      scenarios: [...combo.scenarios].sort(),
      judges: [...combo.judges],
      rubrics: [...combo.rubrics],
      runs: [...combo.runs],
      cellNs,
      allMinN,
      allMaxN,
      isComplete,
      isBalanced,
      issues,
    });
  }

  // Sort: complete first, then by total rows descending
  results.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    return b.totalRows - a.totalRows;
  });

  // ── Output ────────────────────────────────────────────────────────────────

  if (jsonMode) {
    console.log(JSON.stringify({ targetN, totalRows: rows.length, combinations: results }, null, 2));
    db.close();
    return;
  }

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  MESSAGES-MODE 2×2×2 FACTORIAL COVERAGE`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`  Total scored rows: ${rows.length}   Target N per cell×scenario: ${targetN}`);
  if (runIdFilter) console.log(`  Filtered to run: ${runIdFilter}`);
  if (scenarioFilter) console.log(`  Filtered to scenario: ${scenarioFilter}`);
  console.log(`  Model combinations found: ${results.length}\n`);

  for (const r of results) {
    const status = r.isComplete && r.isBalanced ? '✅' : r.isComplete ? '⚠️' : '❌';
    const superegoStr = r.superegoModels.length > 0 ? r.superegoModels.join(', ') : '—';
    console.log(`${'─'.repeat(80)}`);
    console.log(`  ${status} Ego: ${r.comboKey}   Superego (multi cells): ${superegoStr}`);
    console.log(`     Rows: ${r.totalRows}   Cells: ${r.coveredCells}/8   Scenarios: ${r.scenarios.length}   Runs: ${r.runs.length}`);
    console.log(`     Judge(s): ${r.judges.join(', ')}   Rubric(s): ${r.rubrics.join(', ')}`);

    if (r.issues.length > 0) {
      console.log(`     Issues:`);
      for (const issue of r.issues) {
        console.log(`       - ${issue}`);
      }
    }

    // Cell grid
    console.log('');
    console.log('     Cell                                          Prompt   Tutor   Learner      N  Status');
    console.log('     ' + '─'.repeat(75));

    for (const fc of FACTORIAL_CELLS) {
      const ns = r.cellNs[fc.name];
      const nRange = ns.min === ns.max ? String(ns.min) : `${ns.min}-${ns.max}`;
      let cellStatus;
      if (ns.min === 0) cellStatus = '❌ MISSING';
      else if (ns.min < targetN) cellStatus = `⚠️  N<${targetN}`;
      else if (ns.min !== ns.max) cellStatus = '⚠️  unbal';
      else cellStatus = '✅';

      const shortName = fc.name.replace('cell_', '').replace('messages_', '');
      console.log(
        `     ${shortName.padEnd(48)} ${fc.prompt.padEnd(8)} ${fc.tutor.padEnd(7)} ${fc.learner.padEnd(13)} ${bar(ns.min, targetN)} ${nRange.padStart(3)}  ${cellStatus}`,
      );
    }
    console.log('');
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  const complete = results.filter((r) => r.isComplete && r.isBalanced);
  const partial = results.filter((r) => r.isComplete && !r.isBalanced);
  const incomplete = results.filter((r) => !r.isComplete);

  console.log(`${'═'.repeat(80)}`);
  console.log(`  SUMMARY`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`  ✅ Complete & balanced (N≥${targetN}): ${complete.length}`);
  if (complete.length > 0) {
    for (const r of complete) console.log(`     ego=${r.comboKey} (N=${r.allMinN}, ${r.totalRows} rows)`);
  }
  console.log(`  ⚠️  Complete but unbalanced:        ${partial.length}`);
  if (partial.length > 0) {
    for (const r of partial) console.log(`     ego=${r.comboKey} (N=${r.allMinN}-${r.allMaxN}, ${r.totalRows} rows)`);
  }
  console.log(`  ❌ Incomplete (missing cells):      ${incomplete.length}`);
  if (incomplete.length > 0) {
    for (const r of incomplete) console.log(`     ego=${r.comboKey} (${r.coveredCells}/8 cells, ${r.totalRows} rows)`);
  }
  console.log('');

  db.close();
}

main();
