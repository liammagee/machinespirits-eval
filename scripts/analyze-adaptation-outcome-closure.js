#!/usr/bin/env node
/**
 * analyze-adaptation-outcome-closure.js
 *
 * Stage 3 Plan 2.0 trace analyzer. Reads persisted adaptive traces and reports
 * whether prospective contracts are complete, whether pending interventions
 * are closed by the next learner turn, whether expected transitions are
 * observable, whether failures/inconclusives update policy, whether failed
 * actions repeat under materially similar state, and which action families are
 * actually covered.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Database from 'better-sqlite3';
import { adaptationFamilyOf } from './analyze-adaptation-generalization.js';
import { observeInterventionOutcome } from '../services/adaptiveTutor/outcomeObserver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.EVAL_DB_PATH || path.join(REPO_ROOT, 'data', 'evaluations.db');
const LOGS_DIR = path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues');

function getOption(args, name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

function parseArgs(argv = process.argv.slice(2)) {
  const runIdArg = getOption(argv, 'run-id') || getOption(argv, 'run');
  if (!runIdArg) {
    throw new Error(
      'Usage: node scripts/analyze-adaptation-outcome-closure.js --run-id <runId>[,<runId2>] [--profile <name>] [--judge-model <label>] [--reobserve] [--out <path>] [--markdown <path>] [--json]',
    );
  }
  return {
    runIds: runIdArg
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    profile: getOption(argv, 'profile'),
    judgeModel: getOption(argv, 'judge-model'),
    out: getOption(argv, 'out'),
    markdown: getOption(argv, 'markdown'),
    reobserve: hasFlag(argv, 'reobserve'),
    json: hasFlag(argv, 'json'),
  };
}

function absRepoPath(p) {
  return path.isAbsolute(p) ? p : path.join(REPO_ROOT, p);
}

function placeholders(values) {
  return values.map(() => '?').join(',');
}

function loadRows(options) {
  const db = new Database(DB_PATH, { readonly: true });
  const params = [...options.runIds];
  let sql = `SELECT id, run_id, scenario_id, profile_name, dialogue_id, judge_model
             FROM evaluation_results
             WHERE run_id IN (${placeholders(options.runIds)})`;
  if (options.profile) {
    sql += ' AND profile_name = ?';
    params.push(options.profile);
  }
  if (options.judgeModel) {
    sql += ' AND judge_model = ?';
    params.push(options.judgeModel);
  }
  sql += ' ORDER BY profile_name, scenario_id, id';
  const rows = db.prepare(sql).all(...params);
  db.close();
  return rows;
}

function loadTrace(dialogueId) {
  if (!dialogueId) return null;
  const p = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function actionFromTurn(turn) {
  return (
    turn?.selectedPedagogicalAction?.action_type ||
    turn?.adaptationContract?.selected_action?.action_type ||
    turn?.tutorInternal?.adaptationAction ||
    null
  );
}

function contractComplete(contract) {
  return Boolean(
    contract &&
    contract.state_belief &&
    contract.selected_action?.action_type &&
    Array.isArray(contract.candidate_actions) &&
    contract.gate_result &&
    contract.realization_checks,
  );
}

function hasObservedTransition(record) {
  return Boolean(
    record?.expected_transition &&
    record?.observed_transition &&
    Array.isArray(record?.evidence) &&
    record.evidence.length > 0,
  );
}

function hasOutcomeEvidence(record) {
  return Array.isArray(record?.evidence) && record.evidence.length > 0;
}

function hasEvidenceCategory(record, category) {
  return (record?.evidence || []).some((entry) => entry?.categories?.[category] === true);
}

function evidenceBearingOutcome(record) {
  return hasOutcomeEvidence(record) && ['success', 'failure'].includes(record?.outcome);
}

function overlap(a = [], b = []) {
  const left = new Set(a);
  return b.some((item) => left.has(item));
}

function validateEvents(turn) {
  return (turn?.adaptationTrace || []).filter((entry) => entry?.type === 'validate_adaptation_contract');
}

function selectEvents(turn) {
  return (turn?.adaptationTrace || []).filter((entry) => entry?.type === 'select_pedagogical_action');
}

function countBy(values) {
  const out = {};
  for (const value of values.filter(Boolean)) out[value] = (out[value] || 0) + 1;
  return out;
}

function learnerTurnAfterTutorTurn(trace, tutorTurnIndex) {
  const dialogue = Array.isArray(trace?.original?.dialogue) ? trace.original.dialogue : [];
  let tutorCount = -1;
  for (let i = 0; i < dialogue.length; i += 1) {
    if (dialogue[i]?.role !== 'tutor') continue;
    tutorCount += 1;
    if (tutorCount !== Number(tutorTurnIndex)) continue;
    const nextLearner = dialogue.slice(i + 1).find((message) => message?.role === 'learner');
    return nextLearner?.content || '';
  }
  return '';
}

function reobserveClosedLedger(trace, finalLedger = []) {
  return finalLedger.map((record) => {
    if (record?.status !== 'closed') return record;
    const learnerTurn = learnerTurnAfterTutorTurn(trace, record.turn_index);
    const observed = observeInterventionOutcome({
      pendingIntervention: record,
      learnerTurn,
      turnIndex: record.closed_turn_index ?? Number(record.turn_index) + 1,
    });
    return {
      ...record,
      stored_outcome: record.outcome,
      stored_evidence: record.evidence || [],
      outcome: observed.outcome,
      observed_transition: observed.observed_transition,
      evidence: observed.evidence || [],
      reobserved: true,
    };
  });
}

export function analyzeTraceOutcomeClosure(trace, options = {}) {
  const perTurn = Array.isArray(trace?.original?.perTurn)
    ? [...trace.original.perTurn].sort((a, b) => a.turn - b.turn)
    : [];
  const storedFinalLedger = Array.isArray(trace?.original?.finalInterventionLedger)
    ? trace.original.finalInterventionLedger
    : [];
  const finalLedger = options.reobserve ? reobserveClosedLedger(trace, storedFinalLedger) : storedFinalLedger;
  const actions = perTurn.map(actionFromTurn).filter(Boolean);
  const families = actions.map(adaptationFamilyOf).filter(Boolean);
  const closed = finalLedger.filter((record) => record?.status === 'closed');
  const pending = finalLedger.filter((record) => record?.status === 'pending');
  const nonFinalTurns = perTurn.slice(0, Math.max(0, perTurn.length - 1)).map((turn) => Number(turn.turn));
  const closedTurnSet = new Set(closed.map((record) => Number(record.turn_index)));
  const nonFinalPendingClosedN = nonFinalTurns.filter((turn) => closedTurnSet.has(turn)).length;
  const outcomeCounts = countBy(closed.map((record) => record.outcome || 'unknown'));
  const evidenceBearingClosed = closed.filter(evidenceBearingOutcome);
  const falseSuccessFromAgreement = closed.filter(
    (record) => record?.outcome === 'success' && hasEvidenceCategory(record, 'mere agreement'),
  );
  const inconclusiveWithEvidence = closed.filter(
    (record) => record?.outcome === 'inconclusive' && hasOutcomeEvidence(record),
  );

  let nonSuccessRecords = 0;
  let policyUpdatedAfterNonSuccess = 0;
  let repeatedAfterNonSuccess = 0;
  for (const record of closed) {
    if (!['failure', 'inconclusive'].includes(record.outcome)) continue;
    nonSuccessRecords += 1;
    if (record.policy_update) policyUpdatedAfterNonSuccess += 1;
    const next = finalLedger.find((candidate) => Number(candidate?.turn_index) > Number(record.turn_index));
    if (
      next &&
      next.action_type === record.action_type &&
      overlap(next.hypothesis_ids || [], record.hypothesis_ids || [])
    ) {
      repeatedAfterNonSuccess += 1;
    }
  }

  const gateEvents = perTurn.flatMap(validateEvents);
  const gateBlocked = gateEvents.filter((event) => event.payload?.gate_allowed === false).length;
  const gateRepaired = gateEvents.filter((event) => event.payload?.repaired_from).length;
  const selectedThenRepaired = perTurn
    .flatMap((turn) => {
      const selected = selectEvents(turn).at(-1)?.payload?.action_type || null;
      const validated = validateEvents(turn).at(-1)?.payload || {};
      return validated.repaired_from
        ? [
            {
              turn: turn.turn,
              selected,
              repairedFrom: validated.repaired_from,
              finalAction: validated.action_type,
              gateViolations: validated.gate_violations || [],
            },
          ]
        : [];
    })
    .filter(Boolean);

  return {
    scenarioId: trace?.scenario?.id || null,
    profileName: trace?.profileName || null,
    turnN: perTurn.length,
    actionN: actions.length,
    contractN: perTurn.filter((turn) => turn.adaptationContract).length,
    completeContractN: perTurn.filter((turn) => contractComplete(turn.adaptationContract)).length,
    nonFinalPendingN: nonFinalTurns.length,
    nonFinalPendingClosedN,
    closedInterventionN: closed.length,
    pendingInterventionN: pending.length,
    observableTransitionN: closed.filter(hasObservedTransition).length,
    evidenceBearingOutcomeN: evidenceBearingClosed.length,
    evidenceBearingSuccessN: evidenceBearingClosed.filter((record) => record.outcome === 'success').length,
    evidenceBearingFailureN: evidenceBearingClosed.filter((record) => record.outcome === 'failure').length,
    inconclusiveWithEvidenceN: inconclusiveWithEvidence.length,
    falseSuccessFromAgreementN: falseSuccessFromAgreement.length,
    outcomeCounts,
    successN: outcomeCounts.success || 0,
    failureN: outcomeCounts.failure || 0,
    inconclusiveN: outcomeCounts.inconclusive || 0,
    nonSuccessRecords,
    policyUpdatedAfterNonSuccess,
    repeatedAfterNonSuccess,
    noUnreasonedRepeatN: Math.max(0, nonSuccessRecords - repeatedAfterNonSuccess),
    gateBlocked,
    gateRepaired,
    selectedThenRepaired,
    actionCounts: countBy(actions),
    actionFamilyCounts: countBy(families),
  };
}

function rate(n, d) {
  return d > 0 ? n / d : null;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

function mergeCounts(rows, field) {
  const out = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row[field] || {})) out[key] = (out[key] || 0) + value;
  }
  return out;
}

function profileAggregate(profileName, rows) {
  const actionN = sum(rows, 'actionN');
  const contractN = sum(rows, 'contractN');
  const completeContractN = sum(rows, 'completeContractN');
  const nonFinalPendingN = sum(rows, 'nonFinalPendingN');
  const nonFinalPendingClosedN = sum(rows, 'nonFinalPendingClosedN');
  const closedInterventionN = sum(rows, 'closedInterventionN');
  const observableTransitionN = sum(rows, 'observableTransitionN');
  const evidenceBearingOutcomeN = sum(rows, 'evidenceBearingOutcomeN');
  const evidenceBearingSuccessN = sum(rows, 'evidenceBearingSuccessN');
  const evidenceBearingFailureN = sum(rows, 'evidenceBearingFailureN');
  const inconclusiveWithEvidenceN = sum(rows, 'inconclusiveWithEvidenceN');
  const falseSuccessFromAgreementN = sum(rows, 'falseSuccessFromAgreementN');
  const nonSuccessRecords = sum(rows, 'nonSuccessRecords');
  const policyUpdatedAfterNonSuccess = sum(rows, 'policyUpdatedAfterNonSuccess');
  const repeatedAfterNonSuccess = sum(rows, 'repeatedAfterNonSuccess');
  const familyCounts = mergeCounts(rows, 'actionFamilyCounts');
  return {
    profileName,
    scenarioN: rows.length,
    actionN,
    contractN,
    completeContractN,
    contractCompletenessRate: rate(completeContractN, actionN),
    nonFinalPendingN,
    nonFinalPendingClosedN,
    interventionClosureRate: rate(nonFinalPendingClosedN, nonFinalPendingN),
    closedInterventionN,
    observableTransitionN,
    predictedTransitionObservabilityRate: rate(observableTransitionN, closedInterventionN),
    evidenceBearingOutcomeN,
    evidenceBearingOutcomeRate: rate(evidenceBearingOutcomeN, closedInterventionN),
    evidenceBearingSuccessN,
    evidenceBearingSuccessRate: rate(evidenceBearingSuccessN, closedInterventionN),
    evidenceBearingFailureN,
    evidenceBearingFailureRate: rate(evidenceBearingFailureN, closedInterventionN),
    inconclusiveWithEvidenceN,
    inconclusiveWithEvidenceRate: rate(inconclusiveWithEvidenceN, closedInterventionN),
    falseSuccessFromAgreementN,
    successN: sum(rows, 'successN'),
    failureN: sum(rows, 'failureN'),
    inconclusiveN: sum(rows, 'inconclusiveN'),
    confirmationRate: rate(sum(rows, 'successN'), closedInterventionN),
    disconfirmationRate: rate(sum(rows, 'failureN'), closedInterventionN),
    inconclusiveRate: rate(sum(rows, 'inconclusiveN'), closedInterventionN),
    nonSuccessRecords,
    policyUpdatedAfterNonSuccess,
    failureUpdateRate: rate(policyUpdatedAfterNonSuccess, nonSuccessRecords),
    repeatedAfterNonSuccess,
    noUnreasonedRepeatRate: rate(nonSuccessRecords - repeatedAfterNonSuccess, nonSuccessRecords),
    gateBlocked: sum(rows, 'gateBlocked'),
    gateRepaired: sum(rows, 'gateRepaired'),
    actionFamilyCounts: familyCounts,
    actionFamilyCoverageN: Object.keys(familyCounts).length,
    actionCounts: mergeCounts(rows, 'actionCounts'),
  };
}

export function buildOutcomeClosureReport(rows, options = {}) {
  const scenarios = [];
  for (const row of rows) {
    const trace = row.trace || loadTrace(row.dialogue_id || row.dialogueId);
    if (!trace) continue;
    const metrics = analyzeTraceOutcomeClosure(trace, { reobserve: options.reobserve === true });
    scenarios.push({
      ...metrics,
      rowId: row.id ?? null,
      runId: row.run_id || row.runId || null,
      profileName: row.profile_name || row.profileName || metrics.profileName,
      scenarioId: row.scenario_id || row.scenarioId || metrics.scenarioId,
      judgeModel: row.judge_model || row.judgeModel || null,
    });
  }
  const profiles = [...new Set(scenarios.map((row) => row.profileName).filter(Boolean))].map((profileName) =>
    profileAggregate(
      profileName,
      scenarios.filter((row) => row.profileName === profileName),
    ),
  );
  return {
    generatedAt: new Date().toISOString(),
    runIds: options.runIds || [...new Set(rows.map((row) => row.run_id || row.runId).filter(Boolean))],
    options: {
      profile: options.profile || null,
      judgeModel: options.judgeModel || null,
      reobserve: options.reobserve === true,
    },
    profiles,
    scenarios,
  };
}

function fmtPct(value) {
  return value == null ? '--' : `${(value * 100).toFixed(1)}%`;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Plan 2.0 Outcome Closure');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Run IDs: ${report.runIds.join(', ')}`);
  if (report.options.judgeModel) lines.push(`Judge model: ${report.options.judgeModel}`);
  if (report.options.reobserve) lines.push('Closure mode: reobserved from stored dialogue text');
  lines.push('');
  lines.push(
    '| Profile | Contract complete | Intervention closure | Transition observable | Observed success/failure | Success | Failure | Inconclusive | Inconclusive w/evidence | False success agreement | Failure update | No repeat after non-success | Gate repaired | Families |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const row of report.profiles) {
    lines.push(
      `| ${row.profileName} | ${row.completeContractN}/${row.actionN} (${fmtPct(row.contractCompletenessRate)}) | ${row.nonFinalPendingClosedN}/${row.nonFinalPendingN} (${fmtPct(row.interventionClosureRate)}) | ${row.observableTransitionN}/${row.closedInterventionN} (${fmtPct(row.predictedTransitionObservabilityRate)}) | ${row.evidenceBearingOutcomeN}/${row.closedInterventionN} (${fmtPct(row.evidenceBearingOutcomeRate)}) | ${row.successN} | ${row.failureN} | ${row.inconclusiveN} | ${row.inconclusiveWithEvidenceN}/${row.closedInterventionN} (${fmtPct(row.inconclusiveWithEvidenceRate)}) | ${row.falseSuccessFromAgreementN} | ${row.policyUpdatedAfterNonSuccess}/${row.nonSuccessRecords} (${fmtPct(row.failureUpdateRate)}) | ${row.nonSuccessRecords - row.repeatedAfterNonSuccess}/${row.nonSuccessRecords} (${fmtPct(row.noUnreasonedRepeatRate)}) | ${row.gateRepaired} | ${Object.entries(
        row.actionFamilyCounts,
      )
        .map(([family, count]) => `${family}=${count}`)
        .join(', ')} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log('\nPlan 2.0 outcome-closure report');
  console.log(`  runIds=${report.runIds.join(',')}`);
  if (report.options.judgeModel) console.log(`  judgeModel=${report.options.judgeModel}`);
  if (report.options.reobserve) console.log('  closureMode=reobserved');
  console.log('');
  console.log(
    '  profile                                      contract  closed  observable  obs-outcome  succ fail inconc  fail-update  no-repeat  repairs',
  );
  for (const row of report.profiles) {
    console.log(
      `  ${row.profileName.padEnd(44)} ${fmtPct(row.contractCompletenessRate).padStart(8)} ${fmtPct(row.interventionClosureRate).padStart(7)} ${fmtPct(row.predictedTransitionObservabilityRate).padStart(10)} ${fmtPct(row.evidenceBearingOutcomeRate).padStart(11)} ${String(row.successN).padStart(4)} ${String(row.failureN).padStart(4)} ${String(row.inconclusiveN).padStart(6)} ${fmtPct(row.failureUpdateRate).padStart(12)} ${fmtPct(row.noUnreasonedRepeatRate).padStart(10)} ${String(row.gateRepaired).padStart(7)}`,
    );
  }
}

async function main() {
  const options = parseArgs();
  const rows = loadRows(options);
  if (rows.length === 0) {
    throw new Error(
      `No rows found for runId(s)=${options.runIds.join(',')}${options.profile ? ` profile=${options.profile}` : ''}${options.judgeModel ? ` judgeModel=${options.judgeModel}` : ''}`,
    );
  }
  const report = buildOutcomeClosureReport(rows, options);
  printSummary(report);
  if (options.out) {
    const abs = absRepoPath(options.out);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${abs}`);
  }
  if (options.markdown) {
    const abs = absRepoPath(options.markdown);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, renderMarkdown(report));
    console.log(`Wrote ${abs}`);
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
