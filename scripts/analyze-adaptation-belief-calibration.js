#!/usr/bin/env node
/**
 * analyze-adaptation-belief-calibration.js
 *
 * Plan 2.1 trace analyzer. Reads adaptive traces and asks whether the
 * learner-state belief at the trigger-plus-one policy turn covers the hidden
 * state the scenario is meant to instantiate. This is a diagnostic layer: it
 * does not rejudge tutor quality and does not rewrite historical rows.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Database from 'better-sqlite3';
import yaml from 'yaml';
import { scoredTutorTurnAfterTrigger } from './lib/trapTurnConvention.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.EVAL_DB_PATH || path.join(REPO_ROOT, 'data', 'evaluations.db');
const LOGS_DIR = path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues');

const ACTION_TO_FALLBACK_HYPOTHESIS = Object.freeze({
  observe_no_intervention: 'productive_progress',
  minimal_hint: 'missing_prerequisite',
  explain_principle: 'missing_prerequisite',
  model_worked_example: 'missing_prerequisite',
  name_the_disagreement: 'substantive_objection',
  challenge_without_telling: 'substantive_objection',
  acknowledge_and_redirect: 'affective_shutdown',
  lower_cognitive_load: 'working_memory_overload',
  withhold_answer: 'answer_seeking',
  reanchor_goal: 'task_misread',
  repair_misrecognition: 'tutor_misread',
  mirror_and_extend: 'sophistication_upgrade',
  contrast_models: 'boundary_case',
  request_evidence: 'procedure_without_rationale',
  elicit_prediction: 'low_confidence',
  ask_strategy_choice: 'approval_dependency',
  diagnose_with_discriminating_question: 'false_mastery',
});

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
      'Usage: node scripts/analyze-adaptation-belief-calibration.js --run-id <runId>[,<runId2>] --scenario-file <path> [--profile <name>] [--judge-model <label>] [--out <path>] [--markdown <path>] [--json]',
    );
  }
  return {
    runIds: runIdArg
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    scenarioFile: getOption(argv, 'scenario-file') || 'config/adaptive-generalization-counterfactual-scenarios.yaml',
    profile: getOption(argv, 'profile'),
    judgeModel: getOption(argv, 'judge-model'),
    out: getOption(argv, 'out'),
    markdown: getOption(argv, 'markdown'),
    json: hasFlag(argv, 'json'),
  };
}

function absRepoPath(p) {
  return path.isAbsolute(p) ? p : path.join(REPO_ROOT, p);
}

function placeholders(values) {
  return values.map(() => '?').join(',');
}

export function loadScenarioDefinitions(scenarioFile) {
  const parsed = yaml.parse(fs.readFileSync(absRepoPath(scenarioFile), 'utf-8'));
  const scenarios = Array.isArray(parsed?.scenarios) ? parsed.scenarios : [];
  return new Map(scenarios.map((scenario) => [scenario.id, scenario]));
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

function asList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function expectedActionFromScenario(scenario = {}) {
  const direct = asList(scenario.expected_adaptation_action)[0];
  if (direct) return direct;
  const policyMatch = scenario.success_criteria?.policy_match || {};
  return (
    policyMatch.expected_adaptation_action_at_trigger_plus_one ||
    asList(policyMatch.expected_adaptation_action_at_trigger_plus_one_any_of)[0] ||
    null
  );
}

export function inferExpectedHypothesis(scenario = {}) {
  if (scenario.expected_belief_hypothesis) return scenario.expected_belief_hypothesis;
  const text = `${scenario.scenario_type || ''} ${scenario.hidden?.actual_misconception || ''} ${scenario.hidden?.trigger_signal || ''}`.toLowerCase();
  const rules = [
    [/productive progress|independent next|learner-owned/u, 'productive_progress'],
    [/missing prerequisite|base meaning|basic concept|lacks? .*concept/u, 'missing_prerequisite'],
    [/substantive objection|methodological disagreement|pseudoscience|point in dispute|no misconception/u, 'substantive_objection'],
    [/affective shutdown|self-doubt|wasting your time|not cut out|cannot do this/u, 'affective_shutdown'],
    [/working[- ]memory|too many (moving )?parts|overload|lose the thread/u, 'working_memory_overload'],
    [/answer seeking|oracle|just tell|work backwards|activity avoidance|answer-source/u, 'answer_seeking'],
    [/task misread|misread the task|definition when it asks|asks for an argument/u, 'task_misread'],
    [/tutor misread|misrecognition|correcting what question|not what i was asking|mix-up/u, 'tutor_misread'],
    [/false mastery|polite affirmation|hides confusion/u, 'false_mastery'],
    [/additive|recipe|synthesis as additive|ingredients/u, 'additive_misconception'],
    [/metaphor|mirror|overextension/u, 'metaphor_overextension'],
    [/sophistication|brandom|advanced reading|undermodels/u, 'sophistication_upgrade'],
    [/boundary|limit[- ]?case|master.?slave|one-sided/u, 'boundary_case'],
    [/low confidence|not sure|unsure/u, 'low_confidence'],
  ];
  for (const [pattern, hypothesis] of rules) {
    if (pattern.test(text)) return hypothesis;
  }
  return ACTION_TO_FALLBACK_HYPOTHESIS[expectedActionFromScenario(scenario)] || null;
}

function beliefTurnFromTrace(trace) {
  const triggerTurn = Number(trace?.scenario?.hidden?.triggerTurn);
  const shiftTurn = scoredTutorTurnAfterTrigger(triggerTurn);
  const turns = Array.isArray(trace?.original?.perTurn) ? trace.original.perTurn : [];
  const turn = turns.find((record) => Number(record?.turn) === shiftTurn);
  return { triggerTurn, shiftTurn, turn: turn || null, belief: turn?.learnerStateBelief || null };
}

function probabilityOf(belief, id) {
  return Number((belief?.hypotheses || []).find((h) => h.id === id)?.probability || 0);
}

function brierScore(belief, expectedHypothesis) {
  if (!belief || !expectedHypothesis) return null;
  const labels = new Set([expectedHypothesis, ...(belief.hypotheses || []).map((h) => h.id)]);
  let sum = 0;
  for (const label of labels) {
    const y = label === expectedHypothesis ? 1 : 0;
    const p = probabilityOf(belief, label);
    sum += (p - y) ** 2;
  }
  return Number(sum.toFixed(6));
}

function topHypotheses(belief, n) {
  return (belief?.hypotheses || [])
    .slice()
    .sort((a, b) => Number(b.probability || 0) - Number(a.probability || 0))
    .slice(0, n)
    .map((h) => h.id);
}

function topProbability(belief) {
  return Number((belief?.hypotheses || [])[0]?.probability || 0);
}

function topTwoMargin(belief) {
  const hypotheses = belief?.hypotheses || [];
  if (hypotheses.length < 2) return null;
  return Number((Number(hypotheses[0].probability || 0) - Number(hypotheses[1].probability || 0)).toFixed(6));
}

function unsupportedHighConfidence(belief, threshold = 0.7) {
  return (belief?.hypotheses || []).some(
    (h) => Number(h.probability || 0) >= threshold && (!Array.isArray(h.evidence) || h.evidence.length === 0),
  );
}

export function scoreBeliefCalibrationRow(row, scenario, trace) {
  const expectedHypothesis = inferExpectedHypothesis(scenario);
  const { triggerTurn, shiftTurn, belief } = beliefTurnFromTrace(trace);
  const top1 = topHypotheses(belief, 1);
  const top2 = topHypotheses(belief, 2);
  const top3 = topHypotheses(belief, 3);
  return {
    rowId: row.id ?? null,
    runId: row.run_id || row.runId || null,
    profileName: row.profile_name || row.profileName || trace?.profileName || null,
    scenarioId: row.scenario_id || row.scenarioId || scenario?.id || null,
    judgeModel: row.judge_model || row.judgeModel || null,
    expectedHypothesis,
    triggerTurn,
    shiftTurn,
    beliefFound: Boolean(belief),
    hypothesisN: belief?.hypotheses?.length || 0,
    topHypothesis: top1[0] || null,
    topProbability: topProbability(belief),
    topTwoMargin: topTwoMargin(belief),
    brierScore: brierScore(belief, expectedHypothesis),
    top1Correct: expectedHypothesis ? top1.includes(expectedHypothesis) : null,
    top2Correct: expectedHypothesis ? top2.includes(expectedHypothesis) : null,
    top3Correct: expectedHypothesis ? top3.includes(expectedHypothesis) : null,
    expectedProbability: expectedHypothesis ? probabilityOf(belief, expectedHypothesis) : null,
    unsupportedHighConfidence: unsupportedHighConfidence(belief),
  };
}

function mean(values) {
  const nums = values.filter((v) => Number.isFinite(Number(v))).map(Number);
  return nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : null;
}

function rate(values) {
  const evaluable = values.filter((v) => v != null);
  return evaluable.length ? evaluable.filter(Boolean).length / evaluable.length : null;
}

function expectedCalibrationError(rows, bins = 5) {
  const evaluable = rows.filter((row) => row.beliefFound && row.top1Correct != null);
  if (!evaluable.length) return null;
  let ece = 0;
  for (let i = 0; i < bins; i += 1) {
    const lo = i / bins;
    const hi = (i + 1) / bins;
    const bucket = evaluable.filter((row) => row.topProbability >= lo && (i === bins - 1 ? row.topProbability <= hi : row.topProbability < hi));
    if (!bucket.length) continue;
    const acc = rate(bucket.map((row) => row.top1Correct));
    const conf = mean(bucket.map((row) => row.topProbability));
    ece += (bucket.length / evaluable.length) * Math.abs(acc - conf);
  }
  return Number(ece.toFixed(6));
}

function profileAggregate(profileName, rows) {
  const evaluable = rows.filter((row) => row.beliefFound && row.expectedHypothesis);
  return {
    profileName,
    scenarioN: rows.length,
    evaluableN: evaluable.length,
    missingBeliefN: rows.filter((row) => !row.beliefFound).length,
    missingExpectedHypothesisN: rows.filter((row) => !row.expectedHypothesis).length,
    top1Accuracy: rate(evaluable.map((row) => row.top1Correct)),
    top2Coverage: rate(evaluable.map((row) => row.top2Correct)),
    top3Coverage: rate(evaluable.map((row) => row.top3Correct)),
    meanExpectedProbability: mean(evaluable.map((row) => row.expectedProbability)),
    meanTopProbability: mean(evaluable.map((row) => row.topProbability)),
    meanTopTwoMargin: mean(evaluable.map((row) => row.topTwoMargin)),
    meanBrierScore: mean(evaluable.map((row) => row.brierScore)),
    expectedCalibrationError: expectedCalibrationError(evaluable),
    unsupportedHighConfidenceN: evaluable.filter((row) => row.unsupportedHighConfidence).length,
    unsupportedHighConfidenceRate: rate(evaluable.map((row) => row.unsupportedHighConfidence)),
  };
}

export function buildBeliefCalibrationReport(rows, scenarioMap, options = {}) {
  const scenarios = [];
  for (const row of rows) {
    const scenarioId = row.scenario_id || row.scenarioId;
    const scenario = scenarioMap instanceof Map ? scenarioMap.get(scenarioId) : scenarioMap?.[scenarioId];
    if (!scenario) continue;
    const trace = row.trace || loadTrace(row.dialogue_id || row.dialogueId);
    scenarios.push(scoreBeliefCalibrationRow(row, scenario, trace));
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
      scenarioFile: options.scenarioFile || null,
      profile: options.profile || null,
      judgeModel: options.judgeModel || null,
    },
    profiles,
    scenarios,
  };
}

function fmtPct(value) {
  return value == null ? '--' : `${(value * 100).toFixed(1)}%`;
}

function fmtNum(value) {
  return value == null ? '--' : Number(value).toFixed(3);
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Plan 2.1 Belief Calibration');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Run IDs: ${report.runIds.join(', ')}`);
  if (report.options.judgeModel) lines.push(`Judge model: ${report.options.judgeModel}`);
  lines.push(`Scenario file: ${report.options.scenarioFile}`);
  lines.push('');
  lines.push('## Profile Summary');
  lines.push('');
  lines.push('| Profile | Evaluable | Top-1 | Top-2 | Top-3 | Brier | ECE | Expected p | Top margin | Unsupported high-conf |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.profiles) {
    lines.push(
      `| ${row.profileName} | ${row.evaluableN}/${row.scenarioN} | ${fmtPct(row.top1Accuracy)} | ${fmtPct(row.top2Coverage)} | ${fmtPct(row.top3Coverage)} | ${fmtNum(row.meanBrierScore)} | ${fmtNum(row.expectedCalibrationError)} | ${fmtNum(row.meanExpectedProbability)} | ${fmtNum(row.meanTopTwoMargin)} | ${row.unsupportedHighConfidenceN}/${row.evaluableN} (${fmtPct(row.unsupportedHighConfidenceRate)}) |`,
    );
  }
  lines.push('');
  lines.push('## Scenario Details');
  lines.push('');
  lines.push('| Profile | Scenario | Expected | Top hypothesis | Expected p | Top-1 | Top-2 | Brier |');
  lines.push('|---|---|---|---|---:|---:|---:|---:|');
  for (const row of report.scenarios) {
    lines.push(
      `| ${row.profileName} | ${row.scenarioId} | ${row.expectedHypothesis || '--'} | ${row.topHypothesis || '--'} | ${fmtNum(row.expectedProbability)} | ${row.top1Correct ? 'yes' : 'no'} | ${row.top2Correct ? 'yes' : 'no'} | ${fmtNum(row.brierScore)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log('\nPlan 2.1 belief-calibration report');
  console.log(`  runIds=${report.runIds.join(',')}`);
  if (report.options.judgeModel) console.log(`  judgeModel=${report.options.judgeModel}`);
  console.log(`  scenarioFile=${report.options.scenarioFile}`);
  console.log('');
  console.log('  profile                                      eval     top1    top2    top3   brier     ece  unsupported');
  for (const row of report.profiles) {
    console.log(
      `  ${row.profileName.padEnd(44)} ${`${row.evaluableN}/${row.scenarioN}`.padStart(6)} ${fmtPct(row.top1Accuracy).padStart(8)} ${fmtPct(row.top2Coverage).padStart(7)} ${fmtPct(row.top3Coverage).padStart(7)} ${fmtNum(row.meanBrierScore).padStart(7)} ${fmtNum(row.expectedCalibrationError).padStart(7)} ${fmtPct(row.unsupportedHighConfidenceRate).padStart(12)}`,
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
  const scenarioMap = loadScenarioDefinitions(options.scenarioFile);
  const report = buildBeliefCalibrationReport(rows, scenarioMap, options);
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

