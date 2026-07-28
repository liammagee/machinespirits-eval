#!/usr/bin/env node
/**
 * audit-trap-reveal-events.js — read-only structural audit of the trap-scenario
 * state schema (workplan item: audit-trap-state-schema-for-typed-reveal-events).
 *
 * Question. `strategy_shift_correctness` (scripts/analyze-strategy-shift.js)
 * scores the tutor's policy action at trigger+1. Does the persisted state trace
 * hold a typed, turn-stamped record of what was disclosed at or before that
 * turn — or does the scored shift rest on the scenario answer key plus a label
 * the tutor's own model emitted?
 *
 * What counts as a typed reveal event. A schema-declared record carrying BOTH
 * a turn stamp AND a payload naming what became known, written from observation
 * of the dialogue rather than copied from the scenario's hidden block:
 *
 *   evidenceLog entry     — turn + verbatim quote + type + validated  → counts
 *   hypothesis            — created_at_turn + claim                   → counts
 *   tomProbes             — turn-indexed infoaccess/answerability     → partial
 *                           (dates access, names no content)
 *   trapEvents entry      — turn + literal type + signal              → does NOT
 *                           count: services/adaptiveTutor/graph.js learnerTurn
 *                           copies hiddenLearnerState.triggerSignal verbatim at
 *                           the scripted turn, so it records the SCENARIO firing,
 *                           not the tutor observing
 *   learnerProfile        — updatedAtTurn only                        → does NOT
 *                           count: one profile-wide scalar, no per-fact stamp,
 *                           and makeLearnerProfileUpdate writes it every turn
 *                           unconditionally, so its presence carries no
 *                           information about whether anything was revealed
 *
 * Reads existing dialogue logs and the evaluation DB. Generates nothing.
 *
 * Usage:
 *   node scripts/audit-trap-reveal-events.js
 *   node scripts/audit-trap-reveal-events.js --run-id <runId>[,<runId2>,...]
 *   node scripts/audit-trap-reveal-events.js --profile cell_110_langgraph_adaptive
 *   node scripts/audit-trap-reveal-events.js --out exports/trap-reveal-audit.json
 *   node scripts/audit-trap-reveal-events.js --db /path/to/evaluations.db
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openEvaluationDbReadonly, describeMissingEvaluationDb } from '../services/evaluationDbReadonly.js';
import { scoredTutorTurnAfterTrigger } from './lib/trapTurnConvention.js';
import { codingFor, NWM_QUERY_TYPES } from './lib/trapRevealQueryCoding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues');

const args = process.argv.slice(2);
const getOption = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const runIdArg = getOption('run-id') || getOption('run');
const profileFilter = getOption('profile');
const outPath = getOption('out');
const dbPathArg = getOption('db');

// Default scope: the four cells the audit card names. Prefix match so the
// legacy short cell names in older runs are picked up alongside canonical ones.
const DEFAULT_CELL_PREFIXES = Object.freeze([
  'cell_110_langgraph_adaptive',
  'cell_111_a13_C1_recognition_only',
  'cell_113_a13_C4_validator',
  'cell_124_langgraph_adaptive_crosssuite',
]);

const { db, dbPath, reason } = openEvaluationDbReadonly(REPO_ROOT, { explicitPath: dbPathArg });
if (!db) {
  console.log(describeMissingEvaluationDb(dbPath, reason));
  process.exit(0);
}

const where = [];
const params = [];
if (runIdArg) {
  const runIds = runIdArg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  where.push(`run_id IN (${runIds.map(() => '?').join(',')})`);
  params.push(...runIds);
}
if (profileFilter) {
  where.push('profile_name LIKE ?');
  params.push(`${profileFilter}%`);
} else {
  where.push(`(${DEFAULT_CELL_PREFIXES.map(() => 'profile_name LIKE ?').join(' OR ')})`);
  params.push(...DEFAULT_CELL_PREFIXES.map((p) => `${p}%`));
}

const rows = db
  .prepare(
    `SELECT DISTINCT dialogue_id, run_id, scenario_id, scenario_type, profile_name
       FROM evaluation_results
      WHERE ${where.join(' AND ')} AND dialogue_id IS NOT NULL
      ORDER BY profile_name, scenario_id`,
  )
  .all(...params);
db.close();

if (rows.length === 0) {
  console.log(`No trap-cell rows matched in ${dbPath}; nothing to audit.`);
  process.exit(0);
}

function loadTrace(dialogueId) {
  const p = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Classify the state recorded at (and before) the scored turn.
 * `verdict` is one of: 'typed_reveal', 'partial', 'none'.
 */
function auditScoredTurn(branch, triggerTurn) {
  const perTurn = Array.isArray(branch?.perTurn) ? [...branch.perTurn].sort((a, b) => a.turn - b.turn) : [];
  const scoredTurn = scoredTutorTurnAfterTrigger(triggerTurn);
  const at = perTurn.find((t) => t.turn === scoredTurn) || null;

  const evidenceAtOrBefore = (at?.evidenceLog || []).filter((e) => Number(e.turn) <= scoredTurn);
  const hypothesesAtOrBefore = (at?.hypotheses || []).filter((h) => Number(h.created_at_turn) <= scoredTurn);
  const tomProbes = at?.learnerProfile?.tomProbes || null;
  const tomDates =
    tomProbes && ((tomProbes.infoaccess_list || []).length > 0 || (tomProbes.answerability_list || []).length > 0);
  const trapEventsAtOrBefore = (at?.trapEvents || []).filter((e) => Number(e.turn) <= scoredTurn);

  let verdict = 'none';
  if (evidenceAtOrBefore.length > 0 || hypothesesAtOrBefore.length > 0) verdict = 'typed_reveal';
  else if (tomDates) verdict = 'partial';

  return {
    scoredTurn,
    scoredTurnPresent: Boolean(at),
    policyAction: at?.tutorInternal?.policyAction ?? null,
    learnerProfilePresent: Boolean(at?.learnerProfile),
    learnerProfileUpdatedAtTurn: at?.learnerProfile?.updatedAtTurn ?? null,
    // The only date the profile carries, and the graph writes it every turn
    // regardless of whether anything was disclosed — recorded so the gap list
    // can show it is not doing the work a reveal event would do.
    profileDateIsBookkeepingOnly: Boolean(at?.learnerProfile),
    evidenceLogCount: evidenceAtOrBefore.length,
    hypothesisCount: hypothesesAtOrBefore.length,
    tomProbesPresent: Boolean(tomProbes),
    tomProbesDateAccess: Boolean(tomDates),
    trapEventCount: trapEventsAtOrBefore.length,
    verdict,
  };
}

const findings = [];
let missingTraces = 0;

for (const row of rows) {
  const trace = loadTrace(row.dialogue_id);
  if (!trace) {
    missingTraces++;
    continue;
  }
  const triggerTurn = trace.scenario?.hidden?.triggerTurn ?? trace.scenario?.hidden?.trigger_turn ?? -1;
  if (!Number.isFinite(triggerTurn) || triggerTurn < 0) continue;

  const coding = codingFor(row.scenario_id);
  const audit = auditScoredTurn(trace.original, triggerTurn);

  findings.push({
    profileName: row.profile_name,
    runId: row.run_id,
    scenarioId: row.scenario_id,
    scenarioType: row.scenario_type,
    dialogueId: row.dialogue_id,
    triggerTurn,
    expectedShift: trace.scenario?.expectedStrategyShift ?? null,
    nwmQueries: coding?.queries ?? null,
    revealedBy: coding?.revealedBy ?? null,
    codingNote: coding?.note ?? null,
    ...audit,
  });
}

const byProfile = new Map();
for (const f of findings) {
  if (!byProfile.has(f.profileName)) byProfile.set(f.profileName, []);
  byProfile.get(f.profileName).push(f);
}

const summary = [...byProfile.entries()].map(([profileName, group]) => {
  const scored = group.filter((f) => f.policyAction != null);
  return {
    profileName,
    scoredTrapTurns: scored.length,
    withTypedReveal: scored.filter((f) => f.verdict === 'typed_reveal').length,
    withPartial: scored.filter((f) => f.verdict === 'partial').length,
    withNone: scored.filter((f) => f.verdict === 'none').length,
    withNoLearnerProfileAtAll: scored.filter((f) => !f.learnerProfilePresent).length,
  };
});

// Query-type coverage: for each NWM query type, how many scored trap turns
// requiring it have nothing typed underneath.
const queryCoverage = NWM_QUERY_TYPES.map((q) => {
  const relevant = findings.filter((f) => f.policyAction != null && (f.nwmQueries || []).includes(q));
  return {
    queryType: q,
    scoredTrapTurnsRequiringIt: relevant.length,
    ungrounded: relevant.filter((f) => f.verdict === 'none').length,
  };
});

const report = {
  dbPath,
  logsDir: LOGS_DIR,
  runIdFilter: runIdArg || null,
  profileFilter: profileFilter || null,
  totalRows: rows.length,
  missingTraces,
  auditedTrapTurns: findings.length,
  summary,
  queryCoverage,
  findings,
};

console.log(`\nTrap-scenario typed-reveal audit`);
console.log(`  db     : ${dbPath}`);
console.log(`  logs   : ${LOGS_DIR}`);
console.log(`  rows   : ${rows.length} (${missingTraces} traces missing on disk)`);
console.log(`  audited: ${findings.length} scored trap turns\n`);

console.log('By profile:');
console.log('  profile                                   scored  typed  partial   none   no_profile');
for (const s of summary) {
  console.log(
    `  ${String(s.profileName).padEnd(40)} ${String(s.scoredTrapTurns).padStart(6)} ${String(s.withTypedReveal).padStart(6)} ${String(s.withPartial).padStart(8)} ${String(s.withNone).padStart(6)} ${String(s.withNoLearnerProfileAtAll).padStart(12)}`,
  );
}

console.log('\nBy NWM query type (scored trap turns requiring it / of those, ungrounded):');
for (const q of queryCoverage) {
  console.log(
    `  ${q.queryType.padEnd(18)} ${String(q.scoredTrapTurnsRequiringIt).padStart(5)}   ungrounded: ${q.ungrounded}`,
  );
}

const ungrounded = findings.filter((f) => f.policyAction != null && f.verdict === 'none');
if (ungrounded.length) {
  console.log(`\nScored shifts with no typed reveal event under them (${ungrounded.length}):`);
  for (const f of ungrounded) {
    console.log(
      `  ${f.profileName} / ${f.scenarioId} @ turn ${f.scoredTurn} — policy=${f.policyAction}, profile=${f.learnerProfilePresent ? `present(updatedAtTurn=${f.learnerProfileUpdatedAtTurn})` : 'ABSENT'}, evidence=0, hypotheses=0`,
    );
  }
}

if (outPath) {
  const abs = path.isAbsolute(outPath) ? outPath : path.join(REPO_ROOT, outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${abs}`);
}
