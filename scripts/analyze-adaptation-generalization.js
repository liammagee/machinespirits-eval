#!/usr/bin/env node
/**
 * analyze-adaptation-generalization.js
 *
 * Stage 2 Plan 2.0 analyzer for paired hidden-state generalization suites.
 * It reads adaptive traces, scores the typed Plan 2.0 action at trigger+1,
 * and asks whether paired scenarios diverge only when the scenario
 * annotations say they should.
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
const DEFAULT_SCENARIO_FILE = 'config/adaptive-generalization-counterfactual-scenarios.yaml';

const ADAPTATION_ACTION_FAMILIES = Object.freeze({
  agency_preservation: ['observe_no_intervention'],
  diagnostic: ['diagnose_with_discriminating_question', 'request_evidence', 'elicit_prediction'],
  substantive_engagement: ['contrast_models', 'challenge_without_telling', 'name_the_disagreement', 'mirror_and_extend'],
  scaffolding: [
    'ask_strategy_choice',
    'fade_hint',
    'minimal_hint',
    'lower_cognitive_load',
    'reanchor_goal',
    'summarize_and_release',
    'explain_principle',
    'model_worked_example',
    'withhold_answer',
  ],
  repair_affective: ['acknowledge_and_redirect', 'repair_misrecognition'],
  calibration: ['repair_overconfidence'],
});

const ADAPTATION_ACTION_TO_FAMILY = (() => {
  const map = new Map();
  for (const [family, actions] of Object.entries(ADAPTATION_ACTION_FAMILIES)) {
    for (const action of actions) map.set(action, family);
  }
  return map;
})();

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
      'Usage: node scripts/analyze-adaptation-generalization.js --run-id <runId>[,<runId2>] [--profile <name>] [--judge-model <label>] [--scenario-file <path>] [--out <path>] [--markdown <path>] [--json]',
    );
  }
  return {
    runIds: runIdArg
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    profile: getOption(argv, 'profile'),
    judgeModel: getOption(argv, 'judge-model'),
    scenarioFile: getOption(argv, 'scenario-file') || DEFAULT_SCENARIO_FILE,
    out: getOption(argv, 'out'),
    markdown: getOption(argv, 'markdown'),
    json: hasFlag(argv, 'json'),
  };
}

function absRepoPath(p) {
  return path.isAbsolute(p) ? p : path.join(REPO_ROOT, p);
}

export function loadScenarioDefinitions(scenarioFile = DEFAULT_SCENARIO_FILE) {
  const abs = absRepoPath(scenarioFile);
  const parsed = yaml.parse(fs.readFileSync(abs, 'utf-8'));
  const scenarios = Array.isArray(parsed?.scenarios) ? parsed.scenarios : [];
  return new Map(scenarios.map((scenario) => [scenario.id, scenario]));
}

function placeholders(values) {
  return values.map(() => '?').join(',');
}

function loadRows(options) {
  const db = new Database(DB_PATH, { readonly: true });
  const params = [...options.runIds];
  let sql = `SELECT id, run_id, scenario_id, scenario_type, scenario_name, profile_name, dialogue_id, dialogue_content_hash, judge_model, raw_response
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

export function adaptationFamilyOf(action) {
  return ADAPTATION_ACTION_TO_FAMILY.get(action) || null;
}

function expectedAdaptationActions(scenario) {
  return asList(scenario?.expected_adaptation_action);
}

function expectedFamilies(scenario) {
  return [...new Set(expectedAdaptationActions(scenario).map(adaptationFamilyOf).filter(Boolean))];
}

export function actualActionAtTrigger(trace) {
  const triggerTurn = Number(trace?.scenario?.hidden?.triggerTurn);
  const shiftTurn = scoredTutorTurnAfterTrigger(triggerTurn);
  const turns = Array.isArray(trace?.original?.perTurn) ? trace.original.perTurn : [];
  const turn = turns.find((record) => Number(record?.turn) === shiftTurn);
  return {
    triggerTurn,
    shiftTurn,
    adaptationAction:
      turn?.selectedPedagogicalAction?.action_type ||
      turn?.adaptationContract?.selected_action?.action_type ||
      turn?.tutorInternal?.adaptationAction ||
      null,
    legacyPolicyAction: turn?.tutorInternal?.policyAction || null,
  };
}

export function scoreScenarioRow(row, scenario, trace) {
  const actual = actualActionAtTrigger(trace);
  const expectedActions = expectedAdaptationActions(scenario);
  const expectedFamilyList = expectedFamilies(scenario);
  const actualFamily = adaptationFamilyOf(actual.adaptationAction);
  return {
    rowId: row.id ?? null,
    runId: row.run_id || row.runId || null,
    profileName: row.profile_name || row.profileName || null,
    scenarioId: row.scenario_id || row.scenarioId || scenario?.id || null,
    pairId: scenario?.pair_id || null,
    pairVariant: scenario?.pair_variant || null,
    pairExpectation: scenario?.pair_expectation || null,
    judgeModel: row.judge_model || row.judgeModel || null,
    expectedAdaptationActions: expectedActions,
    expectedFamilies: expectedFamilyList,
    actualAdaptationAction: actual.adaptationAction,
    actualLegacyPolicyAction: actual.legacyPolicyAction,
    actualFamily,
    triggerTurn: actual.triggerTurn,
    shiftTurn: actual.shiftTurn,
    exactMatched: expectedActions.length > 0 ? expectedActions.includes(actual.adaptationAction) : null,
    familyMatched: expectedFamilyList.length > 0 ? expectedFamilyList.includes(actualFamily) : null,
    traceFound: Boolean(trace),
  };
}

function uniqueNonNull(values) {
  return [...new Set(values.filter((value) => value != null && value !== ''))];
}

function rate(n, d) {
  return d > 0 ? n / d : null;
}

function profileAggregate(profileName, scenarioScores, pairScores) {
  const evaluableScenarios = scenarioScores.filter((row) => row.traceFound && row.actualAdaptationAction);
  const exactN = evaluableScenarios.filter((row) => row.exactMatched === true).length;
  const familyN = evaluableScenarios.filter((row) => row.familyMatched === true).length;
  const completePairs = pairScores.filter((pair) => pair.complete);
  const divergentPairs = completePairs.filter((pair) => pair.expectedRelation === 'divergent_action');
  const samePairs = completePairs.filter((pair) => pair.expectedRelation === 'same_action');
  const divergentActionPairs = divergentPairs.filter((pair) => pair.actualActionDiverged).length;
  const divergentFamilyPairs = divergentPairs.filter((pair) => pair.actualFamilyDiverged).length;
  const pairSpecificityPairs = divergentPairs.filter((pair) => pair.pairSpecificityMatched).length;
  const sameCompatiblePairs = samePairs.filter((pair) => pair.sameStateCompatible).length;
  const falsePositivePairs = samePairs.filter((pair) => pair.actualActionDiverged).length;

  return {
    profileName,
    scenarioEvaluableN: evaluableScenarios.length,
    scenarioExactMatchedN: exactN,
    scenarioFamilyMatchedN: familyN,
    scenarioExactRate: rate(exactN, evaluableScenarios.length),
    scenarioFamilyRate: rate(familyN, evaluableScenarios.length),
    pairN: completePairs.length,
    divergentPairN: divergentPairs.length,
    divergentActionPairN: divergentActionPairs,
    divergentFamilyPairN: divergentFamilyPairs,
    pairSpecificityN: pairSpecificityPairs,
    pairSpecificityRate: rate(pairSpecificityPairs, divergentPairs.length),
    differentStateActionDivergenceRate: rate(divergentActionPairs, divergentPairs.length),
    differentStateFamilyDivergenceRate: rate(divergentFamilyPairs, divergentPairs.length),
    sameStateControlN: samePairs.length,
    sameStateCompatibleN: sameCompatiblePairs,
    sameStateCompatibilityRate: rate(sameCompatiblePairs, samePairs.length),
    falsePositiveDivergenceN: falsePositivePairs,
    falsePositiveDivergenceRate: rate(falsePositivePairs, samePairs.length),
  };
}

export function buildPairSpecificityReport(rows, scenarioMap, options = {}) {
  const scenarioScores = [];
  for (const row of rows) {
    const scenarioId = row.scenario_id || row.scenarioId;
    const scenario = scenarioMap instanceof Map ? scenarioMap.get(scenarioId) : scenarioMap?.[scenarioId];
    if (!scenario) continue;
    const trace = row.trace || loadTrace(row.dialogue_id || row.dialogueId);
    scenarioScores.push(scoreScenarioRow(row, scenario, trace));
  }

  const byProfilePair = new Map();
  for (const score of scenarioScores.filter((row) => row.pairId)) {
    const key = `${score.profileName}::${score.pairId}`;
    if (!byProfilePair.has(key)) byProfilePair.set(key, []);
    byProfilePair.get(key).push(score);
  }

  const pairs = [];
  for (const [key, items] of byProfilePair.entries()) {
    const [profileName, pairId] = key.split('::');
    const expectedRelations = uniqueNonNull(items.map((item) => item.pairExpectation));
    const expectedActions = uniqueNonNull(items.flatMap((item) => item.expectedAdaptationActions));
    const expectedFamiliesForPair = uniqueNonNull(items.flatMap((item) => item.expectedFamilies));
    const actualActions = uniqueNonNull(items.map((item) => item.actualAdaptationAction));
    const actualFamilies = uniqueNonNull(items.map((item) => item.actualFamily));
    const expectedRelation =
      expectedRelations.includes('same_action') || expectedActions.length <= 1 ? 'same_action' : 'divergent_action';
    const complete = items.length >= 2 && items.every((item) => item.traceFound && item.actualAdaptationAction);
    const allExact = items.every((item) => item.exactMatched === true);
    const allFamily = items.every((item) => item.familyMatched === true);
    const actualActionDiverged = actualActions.length > 1;
    const actualFamilyDiverged = actualFamilies.length > 1;
    const pairSpecificityMatched = complete && expectedRelation === 'divergent_action' && actualActionDiverged && allFamily;
    const sameStateCompatible = complete && expectedRelation === 'same_action' && !actualActionDiverged && allFamily;
    pairs.push({
      profileName,
      pairId,
      expectedRelation,
      complete,
      variants: items.map((item) => ({
        scenarioId: item.scenarioId,
        pairVariant: item.pairVariant,
        expectedAdaptationActions: item.expectedAdaptationActions,
        expectedFamilies: item.expectedFamilies,
        actualAdaptationAction: item.actualAdaptationAction,
        actualFamily: item.actualFamily,
        exactMatched: item.exactMatched,
        familyMatched: item.familyMatched,
      })),
      expectedActions,
      expectedFamilies: expectedFamiliesForPair,
      actualActions,
      actualFamilies,
      allExactMatched: allExact,
      allFamilyMatched: allFamily,
      actualActionDiverged,
      actualFamilyDiverged,
      pairSpecificityMatched,
      sameStateCompatible,
    });
  }

  const profiles = uniqueNonNull(scenarioScores.map((row) => row.profileName)).map((profileName) =>
    profileAggregate(
      profileName,
      scenarioScores.filter((row) => row.profileName === profileName),
      pairs.filter((pair) => pair.profileName === profileName),
    ),
  );

  return {
    generatedAt: new Date().toISOString(),
    runIds: options.runIds || uniqueNonNull(rows.map((row) => row.run_id || row.runId)),
    options: {
      scenarioFile: options.scenarioFile || DEFAULT_SCENARIO_FILE,
      profile: options.profile || null,
      judgeModel: options.judgeModel || null,
    },
    profiles,
    pairs,
    scenarios: scenarioScores,
  };
}

function fmtPct(value) {
  return value == null ? '--' : `${(value * 100).toFixed(1)}%`;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Plan 2.0 Generalization Pair Specificity');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Run IDs: ${report.runIds.join(', ')}`);
  if (report.options.judgeModel) lines.push(`Judge model: ${report.options.judgeModel}`);
  lines.push(`Scenario file: ${report.options.scenarioFile}`);
  lines.push('');
  lines.push('## Profile Summary');
  lines.push('');
  lines.push(
    '| Profile | Scenario exact | Scenario family | Pair specificity | Different-state action divergence | Same-state compatibility | False-positive divergence |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const row of report.profiles) {
    lines.push(
      `| ${row.profileName} | ${row.scenarioExactMatchedN}/${row.scenarioEvaluableN} (${fmtPct(row.scenarioExactRate)}) | ${row.scenarioFamilyMatchedN}/${row.scenarioEvaluableN} (${fmtPct(row.scenarioFamilyRate)}) | ${row.pairSpecificityN}/${row.divergentPairN} (${fmtPct(row.pairSpecificityRate)}) | ${row.divergentActionPairN}/${row.divergentPairN} (${fmtPct(row.differentStateActionDivergenceRate)}) | ${row.sameStateCompatibleN}/${row.sameStateControlN} (${fmtPct(row.sameStateCompatibilityRate)}) | ${row.falsePositiveDivergenceN}/${row.sameStateControlN} (${fmtPct(row.falsePositiveDivergenceRate)}) |`,
    );
  }
  lines.push('');
  lines.push('## Pair Details');
  lines.push('');
  lines.push('| Profile | Pair | Expected | Actual actions | Actual families | Pass |');
  lines.push('|---|---|---|---|---|---:|');
  for (const pair of report.pairs) {
    const pass = pair.expectedRelation === 'same_action' ? pair.sameStateCompatible : pair.pairSpecificityMatched;
    lines.push(
      `| ${pair.profileName} | ${pair.pairId} | ${pair.expectedRelation} | ${pair.actualActions.join(', ') || '--'} | ${pair.actualFamilies.join(', ') || '--'} | ${pass ? 'yes' : 'no'} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log('\nPlan 2.0 generalization pair-specificity report');
  console.log(`  runIds=${report.runIds.join(',')}`);
  if (report.options.judgeModel) console.log(`  judgeModel=${report.options.judgeModel}`);
  console.log(`  scenarioFile=${report.options.scenarioFile}`);
  console.log('');
  console.log(
    '  profile                                      scenario  family   pair-spec  diff-div  same-compat  false-pos',
  );
  for (const row of report.profiles) {
    console.log(
      `  ${row.profileName.padEnd(44)} ${`${row.scenarioExactMatchedN}/${row.scenarioEvaluableN}`.padStart(8)} ${fmtPct(row.scenarioFamilyRate).padStart(8)} ${`${row.pairSpecificityN}/${row.divergentPairN}`.padStart(9)} ${fmtPct(row.differentStateActionDivergenceRate).padStart(9)} ${fmtPct(row.sameStateCompatibilityRate).padStart(12)} ${fmtPct(row.falsePositiveDivergenceRate).padStart(10)}`,
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
  const report = buildPairSpecificityReport(rows, scenarioMap, options);
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
