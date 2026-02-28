#!/usr/bin/env node
/**
 * consolidate-runs.js — Persist accumulative run groupings
 *
 * The eval system uses accumulative data collection: multiple `--runs 1`
 * executions produce rows with identical eval signatures. This script
 * consolidates those scattered rows into a single run per epoch, moving
 * rows by UPDATE-ing their run_id.
 *
 * Default mode is dry-run (preview). Pass --execute to apply.
 *
 * Usage:
 *   node scripts/consolidate-runs.js                          # Preview (default)
 *   node scripts/consolidate-runs.js --execute                # Apply consolidation
 *   node scripts/consolidate-runs.js --epoch pilot            # Consolidate pilot data
 *   node scripts/consolidate-runs.js --epoch 2.0              # Default epoch
 *   node scripts/consolidate-runs.js --description "Paper 2.0 consolidated N=3"
 *   node scripts/consolidate-runs.js --execute --json         # Machine-readable output
 *   node scripts/consolidate-runs.js --execute --force        # Re-consolidate even if existing
 *
 * Related:
 *   - analyze-accumulation.js         — Cell×scenario gap analysis and power analysis
 *   - validate-factorial-coverage.js  — 2×2×2 factorial balance check (cells 80-87, model-aware)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { parseEpochArg, printEpochBanner } from '../services/epochFilter.js';
import { consolidateRuns } from '../services/runConsolidator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const MANIFESTS_DIR = path.join(ROOT, 'logs', 'run-manifests');

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const epoch = parseEpochArg(args);
const execute = args.includes('--execute');
const jsonMode = args.includes('--json');
const force = args.includes('--force');

const descIdx = args.indexOf('--description');
const userDescription = descIdx !== -1 ? args[descIdx + 1] : null;

// ── Helpers ─────────────────────────────────────────────────────────────────

function writeManifest(runId, metadata) {
  try {
    if (!fs.existsSync(MANIFESTS_DIR)) {
      fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
    }
    const manifestPath = path.join(MANIFESTS_DIR, `${runId}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(metadata, null, 2));
    return manifestPath;
  } catch {
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  if (!jsonMode) {
    printEpochBanner(epoch);
  }

  const result = consolidateRuns(db, {
    epoch,
    execute,
    force,
    description: userDescription,
  });

  // Handle errors
  if (result.error === 'existing_consolidated_run') {
    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`\n  ⚠  Consolidated run(s) already exist for epoch "${epoch}":`);
      for (const id of result.existingRunIds) {
        console.error(`     → ${id}`);
      }
      console.error(`\n  Use --force to reconsolidate.\n`);
    }
    db.close();
    process.exit(1);
  }

  if (result.error === 'no_eligible_rows') {
    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n  No eligible rows found for epoch "${epoch}". Nothing to consolidate.\n`);
    }
    db.close();
    return;
  }

  // Preview mode
  if (!execute) {
    if (jsonMode) {
      console.log(JSON.stringify({ mode: 'preview', ...result }, null, 2));
    } else {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`  Run Consolidation Preview — Epoch: ${epoch}`);
      console.log(`${'═'.repeat(60)}\n`);
      console.log(`  Rows eligible:       ${result.totalRows}`);
      console.log(`  Unique signatures:   ${result.totalSignatures}`);
      console.log(`  Source runs:         ${result.sourceRunIds.length}`);
      console.log(`  Multi-run groups:    ${result.multiRunGroups}  (rows from >1 run)`);
      console.log(`  Single-run groups:   ${result.singleRunGroups}`);
      console.log('');
      console.log(`  N distribution:`);
      for (const [bucket, count] of Object.entries(result.nDistribution).sort()) {
        console.log(`    N=${bucket}: ${count} groups`);
      }
      console.log('');
      console.log(`  Judge models:`);
      for (const [model, count] of Object.entries(result.judgeModels).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${model}: ${count} rows`);
      }
      console.log('');
      console.log(`  Would create: ${result.consolidatedRunId}`);
      console.log(`  Would move:   ${result.totalRows} rows`);
      console.log(`  Would mark ${result.sourceRunIds.length} source runs as 'consolidated'`);
      console.log('');
      console.log(`  Run with --execute to apply.\n`);
    }

    db.close();
    return;
  }

  // Execute mode — write manifest
  const manifestPath = writeManifest(result.consolidatedRunId, {
    run_id: result.consolidatedRunId,
    description: result.description,
    total_rows: result.totalRows,
    epoch,
    source_run_ids: result.sourceRunIds,
    signature_count: result.totalSignatures,
    n_distribution: result.nDistribution,
    judge_models: result.judgeModels,
    consolidated_at: new Date().toISOString(),
  });

  if (jsonMode) {
    console.log(JSON.stringify({
      mode: 'executed',
      ...result,
      manifestPath,
    }, null, 2));
  } else {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  Run Consolidation — Epoch: ${epoch}`);
    console.log(`${'═'.repeat(60)}\n`);
    console.log(`  Created run: ${result.consolidatedRunId}`);
    console.log(`  Moved ${result.totalRows} rows from ${result.sourceRunIds.length} source runs`);
    console.log(`  Marked ${result.sourceRunsMarkedConsolidated} source runs as 'consolidated'`);
    if (manifestPath) {
      console.log(`  Wrote manifest: ${path.relative(ROOT, manifestPath)}`);
    }
    console.log('');
    console.log(`  Signature breakdown:`);
    for (const [bucket, count] of Object.entries(result.nDistribution).sort()) {
      console.log(`    N=${bucket}: ${count} groups`);
    }
    console.log('');
    console.log(`  Done.\n`);
  }

  db.close();
}

main();
