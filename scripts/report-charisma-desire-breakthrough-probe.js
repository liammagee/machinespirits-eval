#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import yaml from 'yaml';

import { routeEngagementMode } from '../services/engagementModeRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const SCENARIO_PATH = path.join(ROOT, 'config', 'charisma-recognition-desire-scenarios.yaml');
const LEARNER_AGENTS_PATH = path.join(ROOT, 'config', 'learner-agents.yaml');
const LOGS_DIR = path.join(ROOT, 'logs', 'tutor-dialogues');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-breakthrough-probe-summary.md');
const JSON_PATH = path.join(ROOT, 'exports', 'charisma-desire-breakthrough-probe.json');

const SCENARIO_ID = 'charisma_desire_resistance_breakthrough_probe';

const RESISTANCE_PATTERNS = [
  /\bfrustrat(?:ed|ing|ion)\b/i,
  /\bbored?\b/i,
  /\bboring\b/i,
  /\bdead\b/i,
  /\bworksheet\b/i,
  /\bmemor(?:ize|izing|ise|ising)\b/i,
  /\bformula\b/i,
  /\bdon't see the point\b/i,
  /\bi don't care\b/i,
];

const UPTAKE_PATTERNS = [
  /\bokay\b/i,
  /\bthat gives me\b/i,
  /\bway in\b/i,
  /\blet me try\b/i,
  /\bi see\b/i,
  /\bso\b/i,
  /\bnow\b/i,
  /\bactually\b/i,
];

const RENEWED_WORK_PATTERNS = [
  /\btry\b/i,
  /\btest\b/i,
  /\bwork on\b/i,
  /\bversion\b/i,
  /\bcan we\b/i,
  /\bone sentence\b/i,
  /\bapply\b/i,
  /\bcase\b/i,
];

const CONTENT_PATTERNS = [
  /\bmaster\b/i,
  /\bservant\b/i,
  /\bformation\b/i,
  /\bbildung\b/i,
  /\brecognition\b/i,
  /\blabor\b/i,
  /\bfear\b/i,
  /\bai tutor\b/i,
  /\bseat swap\b/i,
  /\bformula\b/i,
];

function parseArgs(argv) {
  const flags = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractInitialLearnerMessage(scenario) {
  const context = scenario?.learner_context || '';
  const match = context.match(/-\s*User:\s*"([^"]+)"/);
  return match?.[1] || '';
}

function countMatches(text, patterns) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[0]) return match[0];
  }
  return '';
}

function fmt(value, digits = 1) {
  return value == null || Number.isNaN(Number(value)) ? '' : Number(value).toFixed(digits);
}

function cleanCell(value, maxLength = 150) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '/')
    .replace(/[^\x20-\x7e]/g, '-')
    .slice(0, maxLength);
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function loadDialogueLog(row) {
  for (const id of [row.dialogue_id, row.dialogue_content_hash]) {
    if (!id) continue;
    const logPath = path.join(LOGS_DIR, `${id}.json`);
    if (fs.existsSync(logPath)) return parseJson(fs.readFileSync(logPath, 'utf8'), null);
  }
  return null;
}

function getTurnResult(log, turnIndex) {
  return log?.turnResults?.find((turn) => Number(turn.turnIndex) === Number(turnIndex)) || null;
}

function getLearnerMessage({ scenario, log, turnIndex }) {
  if (turnIndex === 0) return extractInitialLearnerMessage(scenario);
  const fromLog = getTurnResult(log, turnIndex)?.learnerMessage;
  if (fromLog) return fromLog;
  return scenario?.turns?.[turnIndex - 1]?.action_details?.message || '';
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scriptedLearnerMessage(scenario, turnIndex) {
  if (turnIndex === 0) return extractInitialLearnerMessage(scenario);
  return scenario?.turns?.[turnIndex - 1]?.action_details?.message || '';
}

function isGeneratedLearnerTurn({ scenario, log, turnIndex }) {
  if (turnIndex <= 0) return false;
  const turn = getTurnResult(log, turnIndex);
  if (!turn?.learnerMessage) return false;
  if (turn.learnerMessageGenerated === true) return true;
  const dynamicArchitecture = log?.learnerArchitecture === 'ego_superego';
  const noScriptedAction = !turn.learnerAction;
  const differsFromScript =
    normalizeText(turn.learnerMessage) !== normalizeText(scriptedLearnerMessage(scenario, turnIndex));
  return dynamicArchitecture && noScriptedAction && differsFromScript;
}

function getTutorMessage(row, turnIndex) {
  const suggestions = parseJson(row.suggestions, []);
  return suggestions?.[turnIndex]?.message || '';
}

function getRegister(row, turnIndex) {
  const trace = parseJson(row.id_construction_trace, []);
  const traceTurn = trace.find((entry) => Number(entry.turn) === Number(turnIndex));
  return traceTurn?.engagementState?.selected_register || traceTurn?.engagementState?.selected_mode || 'unrouted';
}

function findChallengeTurn(row) {
  const trace = parseJson(row.id_construction_trace, []);
  const challenge = trace.find(
    (entry) =>
      Number(entry.turn) > 0 &&
      (entry.engagementState?.selected_register || entry.engagementState?.selected_mode) === 'charismatic_challenge',
  );
  return challenge ? Number(challenge.turn) : 1;
}

function getV22(row, turnIndex) {
  const scores = parseJson(row.tutor_scores, {});
  const turn = scores?.[String(turnIndex)] || scores?.[turnIndex];
  return turn?.overallScore ?? turn?.overall_score ?? null;
}

function scoreTransition({ preLearner, tutorRegister, postLearner, postLearnerGenerated }) {
  const preResistance = countMatches(preLearner, RESISTANCE_PATTERNS);
  const postResistance = countMatches(postLearner, RESISTANCE_PATTERNS);
  const uptake = countMatches(postLearner, UPTAKE_PATTERNS);
  const renewedWork = countMatches(postLearner, RENEWED_WORK_PATTERNS);
  const content = countMatches(postLearner, CONTENT_PATTERNS);
  const routeHit = tutorRegister === 'charismatic_challenge';

  const lexicalScore =
    (preResistance > 0 ? 20 : 0) +
    (routeHit ? 20 : 0) +
    (uptake > 0 ? 20 : 0) +
    (renewedWork > 0 ? 20 : 0) +
    (content >= 2 ? 15 : content > 0 ? 8 : 0) +
    (postResistance === 0 ? 5 : 0);

  let verdict = 'no_breakthrough';
  if (!postLearner) {
    verdict = 'missing_post_learner_turn';
  } else if (preResistance === 0) {
    verdict = 'missing_resistant_precondition';
  } else if (!postLearnerGenerated) {
    verdict = 'scripted_not_outcome_evaluable';
  } else if (lexicalScore >= 70) {
    verdict = 'candidate_breakthrough';
  } else if (uptake > 0 || renewedWork > 0) {
    verdict = 'partial_uptake';
  }

  return {
    verdict,
    lexicalScore,
    preResistance,
    postResistance,
    uptake,
    renewedWork,
    content,
    routeHit,
    firstResistanceMarker: firstMatch(preLearner, RESISTANCE_PATTERNS),
    firstUptakeMarker: firstMatch(postLearner, UPTAKE_PATTERNS),
  };
}

function validateScenario(scenarios, learnerAgents) {
  const errors = [];
  const scenario = scenarios[SCENARIO_ID];
  if (!scenario) {
    errors.push(`Missing scenario ${SCENARIO_ID}`);
    return { scenario: null, errors };
  }
  if (scenario.resistance_breakthrough_diagnostic !== true) {
    errors.push(`${SCENARIO_ID} must set resistance_breakthrough_diagnostic: true`);
  }
  if (scenario.learner_persona && !learnerAgents?.personas?.[scenario.learner_persona]) {
    errors.push(`${SCENARIO_ID} references missing learner_persona ${scenario.learner_persona}`);
  }
  const initial = extractInitialLearnerMessage(scenario);
  const resistanceTurn = scenario.turns?.find((turn) => turn.id === 'turn_1_resistant_boredom_frustration');
  const uptakeTurn = scenario.turns?.find((turn) => turn.id === 'turn_2_breakthrough_probe');
  if (!initial) errors.push(`${SCENARIO_ID} must include an initial learner message in learner_context`);
  if (!resistanceTurn) errors.push(`${SCENARIO_ID} must include turn_1_resistant_boredom_frustration`);
  if (!uptakeTurn) errors.push(`${SCENARIO_ID} must include turn_2_breakthrough_probe`);

  const initialRoute = routeEngagementMode({ learnerMessage: initial });
  if (initialRoute.selected_register !== 'scaffolding') {
    errors.push(`${SCENARIO_ID} initial route expected scaffolding, got ${initialRoute.selected_register}`);
  }
  if (resistanceTurn) {
    const resistanceRoute = routeEngagementMode({
      learnerMessage: resistanceTurn.action_details?.message || '',
      registerHistory: ['scaffolding'],
    });
    if (resistanceRoute.selected_register !== 'charismatic_challenge') {
      errors.push(
        `${SCENARIO_ID} resistance route expected charismatic_challenge, got ${resistanceRoute.selected_register}`,
      );
    }
  }
  const gates = scenario.resistance_signal_gate || [];
  if (gates.length < 5) {
    errors.push(`${SCENARIO_ID} should define at least five resistance_signal_gate cases`);
  }
  for (const gate of gates) {
    const routed = routeEngagementMode({
      learnerMessage: gate.message || '',
      registerHistory: ['scaffolding'],
    });
    const expectedRegister = gate.expected_register || 'charismatic_challenge';
    const expectedSignal = gate.expected_resistance_signal || gate.id;
    if (routed.selected_register !== expectedRegister) {
      errors.push(`${SCENARIO_ID} gate ${gate.id}: expected ${expectedRegister}, got ${routed.selected_register}`);
    }
    if (routed.resistance_signal !== expectedSignal) {
      errors.push(
        `${SCENARIO_ID} gate ${gate.id}: expected resistance signal ${expectedSignal}, got ${routed.resistance_signal || 'none'}`,
      );
    }
  }

  return { scenario, errors };
}

function loadRows(runIds = []) {
  if (!fs.existsSync(DB_PATH)) return [];
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const clauses = ['scenario_id = ?', 'success = 1'];
  const params = [SCENARIO_ID];
  if (runIds.length) {
    clauses.push(`run_id IN (${runIds.map(() => '?').join(',')})`);
    params.push(...runIds);
  }
  return db
    .prepare(
      `SELECT
         id,
         run_id,
         profile_name,
         dialogue_id,
         suggestions,
         tutor_scores,
         id_construction_trace,
         tutor_charisma_overall_score,
         dialogue_content_hash,
         success
       FROM evaluation_results
       WHERE ${clauses.join(' AND ')}
       ORDER BY run_id, profile_name, id`,
    )
    .all(...params);
}

function analyzeRows(rows, scenario) {
  return rows.map((row) => {
    const log = loadDialogueLog(row);
    const challengeTurn = findChallengeTurn(row);
    const postTurn = challengeTurn + 1;
    const preLearner = getLearnerMessage({ row, scenario, log, turnIndex: challengeTurn });
    const postLearner = getLearnerMessage({ row, scenario, log, turnIndex: postTurn });
    const preLearnerGenerated = isGeneratedLearnerTurn({ scenario, log, turnIndex: challengeTurn });
    const postLearnerGenerated = isGeneratedLearnerTurn({ scenario, log, turnIndex: postTurn });
    const tutorRegister = getRegister(row, challengeTurn);
    const scored = scoreTransition({ preLearner, tutorRegister, postLearner, postLearnerGenerated });
    return {
      rowId: row.id,
      runId: row.run_id,
      profileName: row.profile_name,
      dialogueId: row.dialogue_id,
      challengeTurn,
      learnerArchitecture: log?.learnerArchitecture || '',
      tutorRegister,
      tutorV22: getV22(row, challengeTurn),
      tutorMessage: getTutorMessage(row, challengeTurn),
      preLearner,
      postLearner,
      preLearnerGenerated,
      postLearnerGenerated,
      dialogueCharisma: row.tutor_charisma_overall_score,
      ...scored,
    };
  });
}

function buildReport({ generatedAt, scenarioErrors, analyses }) {
  const rows = analyses || [];
  const status = scenarioErrors.length ? 'FAIL' : rows.length ? 'ANALYZED_ROWS' : 'READY_NO_ROWS';
  const outcomeEligible = rows.filter(
    (row) => row.preLearnerGenerated && row.postLearnerGenerated && row.preResistance > 0,
  );
  const candidateBreakthroughs = outcomeEligible.filter((row) => row.verdict === 'candidate_breakthrough');

  const lines = [];
  lines.push('# Charisma Desire Resistance-Breakthrough Probe');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  lines.push(`Status: \`${status}\``);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- No generation and no judge calls.');
  lines.push(`- Scenario: \`${SCENARIO_ID}\`.`);
  lines.push('- Outcome unit: local transition, not whole dialogue and not tutor charisma alone.');
  lines.push(
    '- Required transition: generated resistant learner signal -> `charismatic_challenge` tutor turn -> generated learner uptake.',
  );
  lines.push('- Resistance gate: boredom, frustration, irrelevance, excessive questioning, and rote parroting.');
  lines.push('- Scripted learner uptake is marked `scripted_not_outcome_evaluable`.');
  lines.push('');
  lines.push('## Validation');
  lines.push('');
  lines.push(
    scenarioErrors.length
      ? scenarioErrors.map((error) => `- ${error}`).join('\n')
      : '- Scenario shape and router expectations pass.',
  );
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push(`- Rows found: ${rows.length}`);
  lines.push(`- Outcome-eligible dynamic learner rows: ${outcomeEligible.length}`);
  lines.push(`- Candidate breakthroughs among eligible rows: ${candidateBreakthroughs.length}`);
  lines.push('');
  if (rows.length) {
    lines.push(
      markdownTable(
        [
          'Run',
          'Profile',
          'Learner arch',
          'Challenge turn',
          'Pre generated',
          'Post generated',
          'Register',
          'v2.2 turn',
          'Score',
          'Verdict',
          'Pre resistance',
          'Post uptake',
        ],
        rows.map((row) => [
          row.runId,
          row.profileName,
          row.learnerArchitecture,
          String(row.challengeTurn),
          row.preLearnerGenerated ? 'yes' : 'no',
          row.postLearnerGenerated ? 'yes' : 'no',
          row.tutorRegister,
          fmt(row.tutorV22),
          fmt(row.lexicalScore, 0),
          row.verdict,
          cleanCell(row.firstResistanceMarker || row.preLearner, 70),
          cleanCell(row.firstUptakeMarker || row.postLearner, 70),
        ]),
      ),
    );
    lines.push('');
  }
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    'This probe changes the target from "does the tutor sound charismatic?" to "does a charismatic-register move alter the learner state immediately after resistance?" The transition is only evaluable when the post-challenge learner turn is generated, because a scripted uptake line merely encodes the desired outcome.',
  );
  lines.push('');
  lines.push(
    'A future paid eval should therefore use a dynamic learner or an explicit one-side replay design for this scenario. Whole-dialogue v2.2, holistic quality, or slice-charisma can remain covariates, but they should not be the decision rule.',
  );
  lines.push('');
  return lines.join('\n');
}

function main() {
  const flags = parseArgs(process.argv);
  const checkOnly = flags.check === true;
  const runIds =
    typeof (flags.runs || flags['run-id']) === 'string'
      ? (flags.runs || flags['run-id'])
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
  const scenarios = readYaml(SCENARIO_PATH)?.scenarios || {};
  const learnerAgents = readYaml(LEARNER_AGENTS_PATH) || {};
  const { scenario, errors } = validateScenario(scenarios, learnerAgents);
  const rows = scenario ? loadRows(runIds) : [];
  const analyses = scenario ? analyzeRows(rows, scenario) : [];
  const data = {
    generatedAt: new Date().toISOString(),
    scenarioId: SCENARIO_ID,
    scenarioErrors: errors,
    analyses,
  };

  if (!checkOnly) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`);
    fs.writeFileSync(REPORT_PATH, buildReport(data));
  }

  const eligible = analyses.filter((row) => row.postLearnerGenerated);
  const candidates = eligible.filter((row) => row.verdict === 'candidate_breakthrough');
  console.log(`Scenario: ${SCENARIO_ID}`);
  console.log(`Status: ${errors.length ? 'FAIL' : analyses.length ? 'ANALYZED_ROWS' : 'READY_NO_ROWS'}`);
  console.log(`Rows found: ${analyses.length}`);
  console.log(`Outcome-eligible dynamic learner rows: ${eligible.length}`);
  console.log(`Candidate breakthroughs: ${candidates.length}`);
  if (!checkOnly) console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  if (errors.length) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

main();
