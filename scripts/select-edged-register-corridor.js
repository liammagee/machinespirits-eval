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
 * Endpoint outcomes from a revised-endpoint reading file (§2.16): one JSON
 * object per line, positive when the learner did the task the tutor set.
 * `partlyCounts` is the §2.16.1 sensitivity variant, never the primary.
 */
function revisedPositives(readingsPath, { partlyCounts = false } = {}) {
  const file = path.resolve(ROOT, readingsPath);
  if (!fs.existsSync(file)) throw new Error(`no endpoint readings at ${file}`);
  const positives = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const entry = JSON.parse(trimmed);
    const answer = entry?.reading?.did_task;
    if (!['yes', 'partly', 'no'].includes(answer)) {
      throw new Error(`row ${entry?.rowId}: did_task is ${JSON.stringify(answer)}`);
    }
    positives.set(entry.rowId, answer === 'yes' || (partlyCounts && answer === 'partly'));
  }
  if (!positives.size) throw new Error(`no readings in ${file}`);
  return positives;
}

/**
 * Pooled rows per cell: {scenario, rows: [{rowId, ordinal, positive,
 * eligible}]}. Fail-closed on any completed job whose row or dialogue log
 * cannot be read back — an unreadable row is unmeasured, and an unmeasured
 * row must not silently shrink a corridor denominator.
 *
 * `positives` supplies a revised endpoint keyed by row id; without it the
 * outcome comes from the lexical classifier the M-C2 read voided.
 * `scenarioFilter` defaults to the confirmed cells.
 */
function pooledCellRows(state, { positives = null, scenarioFilter = null } = {}) {
  const confirmedCells = new Set(state.screenDecision?.decision?.confirmed || []);
  if (!confirmedCells.size) throw new Error('state carries no confirmed cells; run --decide-screen first');
  const wanted = scenarioFilter || confirmedCells;

  const scenariosPath = path.join(ROOT, GRID.scenarioSource);
  const scenarios = yaml.parse(fs.readFileSync(scenariosPath, 'utf8'))?.scenarios || {};
  const errors = [];
  const jobsByCell = new Map();
  const rowRecords = [];

  withReadonlyDb((db) => {
    for (const job of state.jobs) {
      if (!wanted.has(job.scenario)) continue;
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
    throw new Error('corridor pool failed closed: not every pooled row can be read back');
  }

  let positiveByRowId;
  if (positives) {
    const missing = rowRecords.filter(({ row }) => !positives.has(row.id)).map(({ job }) => job.ordinal);
    if (missing.length) {
      throw new Error(`revised endpoint has no reading for job ordinal(s) ${missing.join(', ')}`);
    }
    positiveByRowId = positives;
  } else {
    const outcomes = analyzeCharismaDesireRows(
      rowRecords.map((record) => record.row),
      scenarios,
      { loadLog: (row) => loadDialogueLog(row) },
    );
    positiveByRowId = new Map(outcomes.map((outcome) => [outcome.rowId, isPositiveCharismaDesireOutcome(outcome)]));
  }

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

/**
 * The five cells the screen left at n=5 — two dropped at floor and ceiling,
 * three screened but unconfirmed. Their screen verdicts were taken on the
 * voided lexical endpoint, so a revised endpoint has to show what it says
 * about them. Reported as information only: no cell can be kept at n=5.
 */
function reportUnconfirmedCells(state, positives) {
  const confirmed = new Set(state.screenDecision?.decision?.confirmed || []);
  const others = new Set(
    state.jobs.filter((job) => job.status === 'completed' && !confirmed.has(job.scenario)).map((job) => job.scenario),
  );
  if (!others.size) return;
  const cellRows = pooledCellRows(state, { positives, scenarioFilter: others });
  console.log(
    '[edged-corridor] revised endpoint on cells the screen left at n=5 — information only, none can be kept:',
  );
  for (const cell of cellRows.sort((a, b) => a.scenario.localeCompare(b.scenario))) {
    const hits = cell.rows.filter((row) => row.positive).length;
    const eligible = cell.rows.filter((row) => row.eligible).length;
    console.log(
      `[edged-corridor]   ${cell.scenario}: ${hits}/${cell.rows.length} conversions, ${eligible}/${cell.rows.length} edge-eligible`,
    );
  }
}

function runCorridor(state, batchDir, { positives = null, label = '', partlyCounts = false } = {}) {
  const cellRows = pooledCellRows(state, { positives });
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
    endpoint: positives ? { kind: 'revised-reader', partlyCounts } : { kind: 'lexical-classifier-voided' },
    decision,
    auditSample: sample,
  };
  const suffix = label ? `-${label}` : '';
  const reportPath = writeJson(path.join(batchDir, `corridor-report${suffix}.json`), report);
  console.log(`[edged-corridor] ${path.relative(ROOT, reportPath)}`);
  if (!positives) {
    const template = sample.map((entry) => ({ ...entry, humanPositive: null, note: '' }));
    const templatePath = writeJson(path.join(batchDir, 'audit-readings-template.json'), template);
    console.log(
      `[edged-corridor] M-C2: ${sample.length} rows for the human reader — fill humanPositive in ` +
        `${path.relative(ROOT, templatePath)} and re-run with --audit-readings`,
    );
  } else {
    reportUnconfirmedCells(state, positives);
  }
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
      'endpoint-readings': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/select-edged-register-corridor.js --batch-dir <dir> ' +
        '[--audit-readings <readings.json>] [--endpoint-readings <readings.jsonl>]',
    );
    return;
  }
  if (!values['batch-dir']) throw new Error('--batch-dir is required');
  const batchDir = path.resolve(ROOT, values['batch-dir']);
  const state = loadState(batchDir);
  if (values['audit-readings']) {
    runAuditVerdict(state, batchDir, values['audit-readings']);
    return;
  }
  if (values['endpoint-readings']) {
    // §2.16.1, fixed before any per-cell number was visible: primary conversion
    // is did_task === 'yes' only; yes-plus-partly runs beside it as a
    // sensitivity variant. Both are written, neither overwrites the voided
    // lexical report.
    const readingsPath = path.resolve(ROOT, values['endpoint-readings']);
    console.log('[edged-corridor] revised endpoint, PRIMARY (did_task = yes)');
    runCorridor(state, batchDir, {
      positives: revisedPositives(readingsPath, { partlyCounts: false }),
      label: 'revised-primary',
    });
    console.log('');
    console.log('[edged-corridor] revised endpoint, SENSITIVITY (did_task = yes or partly)');
    runCorridor(state, batchDir, {
      positives: revisedPositives(readingsPath, { partlyCounts: true }),
      label: 'revised-sensitivity',
      partlyCounts: true,
    });
    return;
  }
  runCorridor(state, batchDir);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[edged-corridor] ${error.message}`);
    process.exitCode = 1;
  });
}
