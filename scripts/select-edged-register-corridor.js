#!/usr/bin/env node

// Zero-call corridor selection for the edged-register calibration
// (notes/2026-08-16-edged-register-calibration-draft.md §2.4–§2.5).
//
// Reads a calibration batch's state.json plus the evaluation DB (readonly)
// and dialogue logs, pools screen+confirm rows per confirmed cell, applies
// the frozen corridor rule and the M-C1 edge-eligibility screen, and writes
// corridor-report.json plus the M-C2 audit sample for the human reader.
// --audit-readings applies the M-C2 verdict to a filled readings file.
// Every step is deterministic local computation — no model call anywhere.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import yaml from 'yaml';

import { EDGED_REGISTER_CALIBRATION as GRID } from '../services/edgedRegisterCalibration.js';
import { auditSample, auditVerdict, corridorDecision, rowEdgeEligibility } from '../services/edgedRegisterCorridor.js';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';
import {
  analyzeCharismaDesireRows,
  isPositiveCharismaDesireOutcome,
} from './report-charisma-desire-breakthrough-matrix.js';
import { findDialogueLog } from './dump-turn-prompts.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export function learnerTurnsFromDialogueLog(log) {
  const turns = Array.isArray(log?.turnResults) ? log.turnResults : [];
  return turns.map((turn, index) => ({
    turnIndex: turn?.turnIndex ?? index,
    text: turn?.learnerMessage || '',
  }));
}

function loadState(batchDir) {
  const file = path.join(batchDir, 'state.json');
  if (!fs.existsSync(file)) throw new Error(`no state at ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function withReadonlyDb(fn) {
  const { db, dbPath, reason } = openEvaluationDbReadonly(ROOT);
  if (!db) throw new Error(`evaluation DB unavailable at ${dbPath}: ${reason}`);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function loadRow(db, rowId) {
  return db
    .prepare(
      `SELECT id, run_id, scenario_id, profile_name, dialogue_id, dialogue_content_hash, success
       FROM evaluation_results WHERE id = ?`,
    )
    .get(rowId);
}

function loadDialogueLog(row) {
  for (const id of [row.dialogue_id, row.dialogue_content_hash]) {
    if (!id) continue;
    const found = findDialogueLog(id, { rootDir: ROOT });
    if (found?.log) return found.log;
  }
  return null;
}

/**
 * Pooled rows per confirmed cell: {scenario, rows: [{rowId, ordinal,
 * positive, eligible}]}. Fail-closed on any completed job whose row or
 * dialogue log cannot be read back — an unreadable row is unmeasured, and
 * an unmeasured row must not silently shrink a corridor denominator.
 */
function pooledCellRows(state) {
  const confirmedCells = new Set(state.screenDecision?.decision?.confirmed || []);
  if (!confirmedCells.size) throw new Error('state carries no confirmed cells; run --decide-screen first');

  const scenariosPath = path.join(ROOT, GRID.scenarioSource);
  const scenarios = yaml.parse(fs.readFileSync(scenariosPath, 'utf8'))?.scenarios || {};
  const errors = [];
  const jobsByCell = new Map();
  const rowRecords = [];

  withReadonlyDb((db) => {
    for (const job of state.jobs) {
      if (!confirmedCells.has(job.scenario)) continue;
      if (job.status !== 'completed' || !job.rowId) {
        errors.push(`job ${job.ordinal} (${job.scenario}) is ${job.status}; the pool needs every row measured`);
        continue;
      }
      const row = loadRow(db, job.rowId);
      if (!row) {
        errors.push(`job ${job.ordinal} (${job.scenario}): row ${job.rowId} not found in the evaluation DB`);
        continue;
      }
      rowRecords.push({ job, row });
    }
  });
  if (errors.length) {
    for (const error of errors) console.error(`[edged-corridor] ${error}`);
    throw new Error('corridor pool failed closed: not every confirmed-cell row can be read back');
  }

  const outcomes = analyzeCharismaDesireRows(
    rowRecords.map((record) => record.row),
    scenarios,
    { loadLog: (row) => loadDialogueLog(row) },
  );
  const positiveByRowId = new Map(outcomes.map((outcome) => [outcome.rowId, isPositiveCharismaDesireOutcome(outcome)]));

  for (const { job, row } of rowRecords) {
    const log = loadDialogueLog(row);
    if (!log) throw new Error(`job ${job.ordinal} (${job.scenario}): dialogue log unreadable for row ${row.id}`);
    if (!positiveByRowId.has(row.id)) throw new Error(`job ${job.ordinal}: row ${row.id} was not classified`);
    const { eligible, moments } = rowEdgeEligibility(learnerTurnsFromDialogueLog(log));
    const cell = jobsByCell.get(job.scenario) || { scenario: job.scenario, rows: [] };
    cell.rows.push({
      rowId: row.id,
      ordinal: job.ordinal,
      positive: positiveByRowId.get(row.id),
      eligible,
      eligibleMoments: moments,
    });
    jobsByCell.set(job.scenario, cell);
  }
  return [...jobsByCell.values()];
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function runCorridor(state, batchDir) {
  const cellRows = pooledCellRows(state);
  const decision = corridorDecision(cellRows);
  if (!decision.ok) {
    for (const error of decision.errors) console.error(`[edged-corridor] ${error}`);
    throw new Error('corridor decision failed closed');
  }
  for (const cell of decision.cells) {
    console.log(
      `[edged-corridor] ${cell.scenario}: ${cell.positives}/${cell.rows} conversions, ` +
        `${cell.eligibleRows}/${cell.rows} edge-eligible rows -> ${cell.verdict}`,
    );
  }
  if (decision.baseline) {
    console.log(
      `[edged-corridor] pooled kept-cell rate ${decision.baseline.successes}/${decision.baseline.trials}` +
        ` = ${decision.baseline.rate.toFixed(3)}; powering baseline (upper ${Math.round(
          decision.baseline.confidence * 100,
        )}% bound) = ${decision.baseline.upperBound.toFixed(3)}`,
    );
  }
  const sample = auditSample(cellRows, decision);
  const report = {
    schema: 'machinespirits.edged-register-corridor-report.v1',
    planSha256: state.planSha256,
    decidedAt: new Date().toISOString(),
    decision,
    auditSample: sample,
  };
  const reportPath = writeJson(path.join(batchDir, 'corridor-report.json'), report);
  const template = sample.map((entry) => ({ ...entry, humanPositive: null, note: '' }));
  const templatePath = writeJson(path.join(batchDir, 'audit-readings-template.json'), template);
  console.log(`[edged-corridor] ${path.relative(ROOT, reportPath)}`);
  console.log(
    `[edged-corridor] M-C2: ${sample.length} rows for the human reader — fill humanPositive in ` +
      `${path.relative(ROOT, templatePath)} and re-run with --audit-readings`,
  );
  if (decision.killStudy) {
    console.log('[edged-corridor] NO CELL KEPT after §2.4 + §2.5 — registered stop rule 1: the study stops here');
    process.exitCode = 2;
  }
}

function runAuditVerdict(state, batchDir, readingsPath) {
  const reportPath = path.join(batchDir, 'corridor-report.json');
  if (!fs.existsSync(reportPath)) throw new Error(`no corridor report at ${reportPath}; run the corridor pass first`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (report.planSha256 !== state.planSha256) {
    throw new Error('corridor report and batch state carry different plan SHAs');
  }
  const readings = JSON.parse(fs.readFileSync(path.resolve(ROOT, readingsPath), 'utf8'));
  const verdict = auditVerdict(report.auditSample, readings);
  if (!verdict.ok) {
    for (const error of verdict.errors) console.error(`[edged-corridor] ${error}`);
    throw new Error('audit verdict failed closed: the readings do not cover the fixed sample');
  }
  const verdictPath = writeJson(path.join(batchDir, 'audit-verdict.json'), {
    schema: 'machinespirits.edged-register-audit-verdict.v1',
    planSha256: state.planSha256,
    recordedAt: new Date().toISOString(),
    ...verdict,
  });
  console.log(
    `[edged-corridor] M-C2: ${verdict.disagreements}/${verdict.audited} disagreements ` +
      `(${(verdict.disagreementRate * 100).toFixed(1)}%)`,
  );
  console.log(`[edged-corridor] ${path.relative(ROOT, verdictPath)}`);
  if (verdict.endpointVoid) {
    console.log(
      '[edged-corridor] DISAGREEMENT ABOVE 20% — the endpoint is revised before registration and ' +
        'the corridor estimates are VOID for selection (§2.5 M-C2)',
    );
    process.exitCode = 2;
  } else {
    console.log('[edged-corridor] endpoint audit passed; corridor estimates stand for selection');
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      'batch-dir': { type: 'string', default: '' },
      'audit-readings': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/select-edged-register-corridor.js --batch-dir <dir> [--audit-readings <readings.json>]',
    );
    return;
  }
  if (!values['batch-dir']) throw new Error('--batch-dir is required');
  const batchDir = path.resolve(ROOT, values['batch-dir']);
  const state = loadState(batchDir);
  if (values['audit-readings']) runAuditVerdict(state, batchDir, values['audit-readings']);
  else runCorridor(state, batchDir);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[edged-corridor] ${error.message}`);
    process.exitCode = 1;
  });
}
