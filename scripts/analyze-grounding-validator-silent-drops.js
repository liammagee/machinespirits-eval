#!/usr/bin/env node
/**
 * Read-only audit of the A14 evidence-ledger grounding validator.
 *
 * Correct scope: cell 127/128. Cell 113's validator is the unrelated A13
 * post-policy tutorValidator and has no evidence ledger or hypothesis ids.
 *
 * Legacy limitation: historical cell-127/128 traces contain only end-of-turn
 * hypothesis snapshots. They can establish whether observable terminal states
 * are structurally supported by ledger ids, but cannot reveal raw validator
 * proposals that the graph dropped. Exact silent-drop rates are therefore
 * reported as null unless the trace contains grounding_validator_*_audit events.
 *
 * Usage:
 *   node scripts/analyze-grounding-validator-silent-drops.js
 *   node scripts/analyze-grounding-validator-silent-drops.js --run-id <id>[,<id>...]
 *   node scripts/analyze-grounding-validator-silent-drops.js --profile cell_127
 *   node scripts/analyze-grounding-validator-silent-drops.js --db /path/to/evaluations.db
 *   node scripts/analyze-grounding-validator-silent-drops.js --out exports/report.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  auditGroundingValidatorTrace,
  summarizeGroundingValidatorBranches,
} from '../services/adaptiveTutor/groundingValidatorAudit.js';
import { describeMissingEvaluationDb, openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function getOption(name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

const runIdArg = getOption('run-id') || getOption('run');
const profileFilter = getOption('profile');
const dbPathArg = getOption('db');
const logsPathArg = getOption('logs');
const outPath = getOption('out');
const logsDir = path.join(logsPathArg || process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues');
const defaultPrefixes = ['cell_127_state_policy_evidence_bound_validated', 'cell_128_state_policy_minimal_profile'];

const { db, dbPath, reason } = openEvaluationDbReadonly(REPO_ROOT, { explicitPath: dbPathArg });
if (!db) {
  console.log(describeMissingEvaluationDb(dbPath, reason));
  process.exit(0);
}

const where = ['dialogue_id IS NOT NULL'];
const params = [];
if (runIdArg) {
  const runIds = runIdArg
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  where.push(`run_id IN (${runIds.map(() => '?').join(',')})`);
  params.push(...runIds);
}
if (profileFilter) {
  where.push('profile_name LIKE ?');
  params.push(`${profileFilter}%`);
} else {
  where.push(`(${defaultPrefixes.map(() => 'profile_name LIKE ?').join(' OR ')})`);
  params.push(...defaultPrefixes.map((prefix) => `${prefix}%`));
}

const rows = db
  .prepare(
    `SELECT DISTINCT dialogue_id, run_id, scenario_id, scenario_type, profile_name
       FROM evaluation_results
      WHERE ${where.join(' AND ')}
      ORDER BY profile_name, run_id, scenario_id, dialogue_id`,
  )
  .all(...params);
db.close();

function loadTrace(dialogueId) {
  const tracePath = path.join(logsDir, `${dialogueId}.json`);
  if (!fs.existsSync(tracePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  } catch {
    return null;
  }
}

const auditedBranches = [];
const missingTraces = [];
for (const row of rows) {
  const trace = loadTrace(row.dialogue_id);
  if (!trace) {
    missingTraces.push({
      runId: row.run_id,
      profileName: row.profile_name,
      scenarioId: row.scenario_id,
      dialogueId: row.dialogue_id,
    });
    continue;
  }
  auditedBranches.push(
    ...auditGroundingValidatorTrace(trace, {
      runId: row.run_id,
      profileName: row.profile_name,
      scenarioId: row.scenario_id,
      scenarioType: row.scenario_type,
      dialogueId: row.dialogue_id,
    }),
  );
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = key(item);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

const summary = summarizeGroundingValidatorBranches(auditedBranches);
const byProfile = [...groupBy(auditedBranches, (branch) => branch.profileName).entries()].map(
  ([profileName, branches]) => ({ profileName, ...summarizeGroundingValidatorBranches(branches) }),
);

const report = {
  analysis: 'grounding-validator-silent-drop-audit',
  generatedAt: new Date().toISOString(),
  scopeCorrection: {
    cardAsWritten: 'cell_113 versus cell_112',
    codeGroundedScope: 'cell_127/128 groundingValidator; paired outcome contrast is cell_127 versus cell_126',
    reason:
      'cell_113 uses state_policy_with_validator and the post-policy tutorValidator; it has no evidence ledger or hypothesis-id verdicts',
  },
  evidenceBoundary: {
    exactLegacySilentDropRate:
      'unidentifiable because historical traces omit raw validator proposals, including proposals dropped for unknown hypothesis_id',
    observableLegacyMeasure:
      'first-observed terminal appearances and within-trace validated/contradicted transitions checked against the same-turn validated evidence ledger and prompt thresholds; updater-versus-validator attribution remains unidentifiable',
    prospectiveMeasure:
      'grounding_validator_call_audit and grounding_validator_decision_audit adaptationTrace events capture every proposed, applied, dropped, cited, and structurally grounded verdict',
  },
  dbPath,
  logsDir,
  runIdFilter: runIdArg || null,
  profileFilter: profileFilter || null,
  matchedRows: rows.length,
  missingTraceCount: missingTraces.length,
  summary,
  byProfile,
  missingTraces,
  branches: auditedBranches,
};

const pct = (value) => (value == null ? 'not identifiable' : `${(100 * value).toFixed(1)}%`);

console.log('\nGrounding-validator silent-drop audit');
console.log(`  db: ${dbPath}`);
console.log(`  logs: ${logsDir}`);
console.log(`  rows: ${rows.length}; branches: ${summary.trace_branches}; missing traces: ${missingTraces.length}`);
console.log(`  instrumented branches: ${summary.instrumented_branches}/${summary.trace_branches}`);
console.log(`  exact silent-drop rate: ${pct(summary.silent_drop_rate)}`);
console.log(
  `  observed terminal events: ${summary.observed_terminal_events} (${summary.first_observed_terminal_appearances} first appearances; ${summary.within_trace_terminal_transitions} within-trace transitions); structurally grounded snapshots: ${summary.structurally_grounded_observed_terminal_events} (${pct(summary.observed_terminal_event_grounding_rate)})`,
);
console.log(`  evidence boundary: ${summary.legacy_identifiability}`);

if (byProfile.length > 0) {
  console.log('\nBy profile:');
  for (const profile of byProfile) {
    console.log(
      `  ${profile.profileName}: branches=${profile.trace_branches}, instrumented=${profile.instrumented_branches}, decisions=${profile.raw_decisions_observed}, drops=${profile.dropped_decisions}, silent_drop=${pct(profile.silent_drop_rate)}, terminal_events=${profile.observed_terminal_events}, grounded_snapshot=${pct(profile.observed_terminal_event_grounding_rate)}`,
    );
  }
}

if (outPath) {
  const absolute = path.isAbsolute(outPath) ? outPath : path.join(REPO_ROOT, outPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nWrote ${absolute}`);
}
