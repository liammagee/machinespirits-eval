#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  buildParentReplayReport,
  renderParentReplayHtml,
  renderParentReplayMarkdown,
  replayParentTrace,
} from '../src/parentReplayAdapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..', '..');

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? null : process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function csvArg(name, fallback = []) {
  const raw = argValue(name);
  return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : fallback;
}

function resolveOutDir() {
  const explicit = argValue('out');
  return explicit ? path.resolve(explicit) : path.resolve(ROOT, 'outputs/parent-stack-replay');
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function dialoguePath(dialogueId) {
  return path.join(REPO_ROOT, 'logs', 'tutor-dialogues', `${dialogueId}.json`);
}

function loadTraceForRow(row) {
  const p = dialoguePath(row.dialogueId);
  if (!fs.existsSync(p)) {
    throw new Error(`Dialogue log not found for ${row.dialogueId}: ${p}`);
  }
  return { trace: loadJson(p), source: p };
}

function loadRowsFromDb() {
  const dbPath = path.resolve(argValue('db') || path.join(REPO_ROOT, 'data/evaluations.db'));
  const limit = Number(argValue('limit') || 8);
  const runIds = csvArg('run-id');
  const dialogueIds = csvArg('dialogue-id');
  const profile = argValue('profile');
  const scenario = argValue('scenario');
  const latest = hasFlag('latest') || (runIds.length === 0 && dialogueIds.length === 0);
  const db = new Database(dbPath, { readonly: true });
  const params = [];
  let sql = `
    SELECT run_id AS runId,
           scenario_id AS scenarioId,
           scenario_name AS scenarioName,
           scenario_type AS scenarioType,
           profile_name AS profileName,
           dialogue_id AS dialogueId,
           created_at AS createdAt
    FROM evaluation_results
    WHERE dialogue_id IS NOT NULL
  `;
  if (dialogueIds.length) {
    sql += ` AND dialogue_id IN (${dialogueIds.map(() => '?').join(',')})`;
    params.push(...dialogueIds);
  } else if (runIds.length) {
    sql += ` AND run_id IN (${runIds.map(() => '?').join(',')})`;
    params.push(...runIds);
  } else if (latest) {
    sql += ` AND (profile_name LIKE '%adaptive%' OR scenario_type LIKE '%trap%' OR conversation_mode = 'adaptive_trap')`;
  }
  if (profile) {
    sql += ' AND profile_name LIKE ?';
    params.push(`%${profile}%`);
  }
  if (scenario) {
    sql += ' AND scenario_id LIKE ?';
    params.push(`%${scenario}%`);
  }
  sql += ' ORDER BY created_at DESC';
  if (Number.isFinite(limit) && limit > 0) sql += ` LIMIT ${limit}`;
  const rows = db.prepare(sql).all(...params);
  db.close();
  return rows;
}

const inputPaths = csvArg('inputs');
const rows = inputPaths.length ? [] : loadRowsFromDb();
const replayItems = inputPaths.length
  ? inputPaths.map((inputPath) => {
      const p = path.resolve(inputPath);
      return {
        trace: loadJson(p),
        row: { dialogueId: path.basename(p, '.json') },
        source: p,
      };
    })
  : rows.map((row) => ({ ...loadTraceForRow(row), row }));

if (replayItems.length === 0) {
  console.error('No parent dialogue traces selected. Use --run-id, --dialogue-id, --inputs, or --latest.');
  process.exit(2);
}

const replays = replayItems.map(({ trace, row, source }) => replayParentTrace({ trace, row, source }));
const inputDescription = inputPaths.length
  ? `inputs=${inputPaths.join(',')}`
  : rows.length
    ? `rows=${rows.length}; runIds=${[...new Set(rows.map((r) => r.runId))].join(',')}`
    : 'none';
const report = buildParentReplayReport({ replays, inputDescription });

const outDir = resolveOutDir();
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `parent-stack-replay-${stamp}.json`);
const htmlPath = path.join(outDir, `parent-stack-replay-${stamp}.html`);
const mdPath = path.join(outDir, `parent-stack-replay-${stamp}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(htmlPath, renderParentReplayHtml(report));
fs.writeFileSync(mdPath, renderParentReplayMarkdown(report));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log(`Wrote ${mdPath}`);
console.log(`Prototype trigger match rate: ${(report.triggerAlignment.prototypeAcceptableRate * 100).toFixed(1)}% (${report.triggerAlignment.count} trigger branches)`);
console.log(`Parent-compatible trigger match rate: ${(report.triggerAlignment.parentCompatibleRate * 100).toFixed(1)}% (${report.triggerAlignment.count} trigger branches)`);
console.log(`Raw prototype/parent family agreement: ${((report.familyAgreement.prototypeRate ?? report.familyAgreement.rate) * 100).toFixed(1)}% (${report.familyAgreement.count} labelled turns)`);
console.log(`Parent-compatible family agreement: ${(report.familyAgreement.parentCompatibleRate * 100).toFixed(1)}% (${report.familyAgreement.count} labelled turns)`);
console.log(`Transition-aware family agreement: ${(report.familyAgreement.transitionAwareRate * 100).toFixed(1)}% (${report.familyAgreement.count} labelled turns)`);
console.log(`Transition-aware family transition agreement: ${(report.actionTransitions.transitionAwareRate * 100).toFixed(1)}% (${report.actionTransitions.count} transitions)`);
