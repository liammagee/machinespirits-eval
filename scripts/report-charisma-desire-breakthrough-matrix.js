#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import yaml from 'yaml';

import { routeEngagementMode } from '../services/engagementModeRouter.js';
import { resolveEvaluationDbPath, resolveTutorDialoguesDir } from '../services/evaluationDataPaths.js';
import { evaluateRegisterStanceFidelity } from '../services/registerStanceFidelity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DB_PATH = resolveEvaluationDbPath(ROOT);
const SCENARIO_PATH = path.join(ROOT, 'config', 'charisma-recognition-desire-scenarios.yaml');
const LEARNER_AGENTS_PATH = path.join(ROOT, 'config', 'learner-agents.yaml');
const LOGS_DIR = resolveTutorDialoguesDir(ROOT);
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-breakthrough-matrix-summary.md');
const JSON_PATH = path.join(ROOT, 'exports', 'charisma-desire-breakthrough-matrix.json');

const ROUTER_PROFILE = 'cell_185_id_director_charisma_resistance_breakthrough_dynamic_verified';
const STATIC_PROFILE = 'cell_186_id_director_charisma_static_floor_breakthrough_dynamic_verified';
const TUNED_ROUTER_PROFILE = 'cell_187_id_director_charisma_resistance_tuned_breakthrough_dynamic_verified';
const OWNED_TEST_ROUTER_PROFILE = 'cell_188_id_director_charisma_resistance_owned_test_breakthrough_dynamic_verified';
const PRECISION_ROUTER_PROFILE = 'cell_189_id_director_charisma_resistance_precision_breakthrough_dynamic_verified';
const GENERATION_ROUTER_PROFILE = 'cell_190_id_director_charisma_resistance_generation_breakthrough_dynamic_verified';
const QUESTION_LOCK_ROUTER_PROFILE =
  'cell_191_id_director_charisma_resistance_question_lock_breakthrough_dynamic_verified';
const COMMITMENT_PROBE_ROUTER_PROFILE =
  'cell_192_id_director_charisma_resistance_commitment_probe_breakthrough_dynamic_verified';
const BOREDOM_STAKE_ROUTER_PROFILE =
  'cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified';
const GLM_COMPACT_ROUTER_PROFILE = 'cell_194_id_director_charisma_resistance_glm_compact_breakthrough_dynamic_verified';
const IRONIC_CHALLENGE_PROFILE = 'cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified';
const SARCASTIC_CHALLENGE_PROFILE = 'cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified';
const FACE_THREAT_CHALLENGE_PROFILE = 'cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified';

const ROLE_ISOLATION_PREFIX = 'Charisma desire role isolation:';
const ROLE_ISOLATION_ARMS = [
  {
    id: 'baseline_codex_tutor_codex_learner',
    contrast: 'reference',
    evidence: 'dynamic outcome',
    expectedRows: 10,
  },
  {
    id: 'tutor_fixed_glm_learner',
    contrast: 'hold tutor fixed; vary learner',
    evidence: 'dynamic outcome',
    expectedRows: 10,
  },
  {
    id: 'learner_fixed_glm_tutor',
    contrast: 'hold learner fixed; vary tutor/id',
    evidence: 'dynamic outcome',
    expectedRows: 10,
  },
  {
    id: 'full_glm_reference',
    contrast: 'full GLM stack reference',
    evidence: 'dynamic outcome',
    expectedRows: 10,
  },
  {
    id: 'scripted_control_codex_tutor',
    contrast: 'fixed resistant turns; Codex tutor/id',
    evidence: 'register control',
    expectedRows: 5,
  },
  {
    id: 'scripted_control_glm_tutor',
    contrast: 'fixed resistant turns; GLM tutor/id',
    evidence: 'register control',
    expectedRows: 5,
  },
];
const ROLE_ISOLATION_ARM_BY_ID = new Map(ROLE_ISOLATION_ARMS.map((arm) => [arm.id, arm]));

const CONTROLLED_SCENARIOS = [
  'charisma_desire_resistance_breakthrough_boredom',
  'charisma_desire_resistance_breakthrough_frustration',
  'charisma_desire_resistance_breakthrough_irrelevance',
  'charisma_desire_resistance_breakthrough_question_flood',
  'charisma_desire_resistance_breakthrough_rote_parroting',
];
const BASE_SCENARIO_ID = 'charisma_desire_resistance_breakthrough_probe';

const SIGNAL_PATTERNS = {
  boredom: [/\bbored?\b/i, /\bboring\b/i, /\bdead\b/i, /\bdisengag/i],
  frustration: [/\bfrustrat(?:ed|ing|ion)\b/i, /\bannoyed\b/i, /\bfed up\b/i],
  irrelevance: [
    /\birrelevant\b/i,
    /\bpointless\b/i,
    /\bwhat(?:'s| is) the point\b/i,
    /\bdon't see the point\b/i,
    /\bwhy should i care\b/i,
    /\bwhat does this have to do with\b/i,
  ],
  question_flood: [/\bwhy\b.*\bwhy\b/i, /\bwhat am i supposed to do with\b/i, /\?[^?]*\?[^?]*\?/],
  rote_parroting: [/\bparrot(?:ing)?\b/i, /\brepeat(?:ing)?\b/i, /\bmemor(?:ize|izing|ise|ising)\b/i, /\bformula\b/i],
};

const UPTAKE_PATTERNS = [/\bokay\b/i, /\bnow\b/i, /\bi see\b/i, /\bless\bored\b/i, /\bthat gives me\b/i];
const RENEWED_WORK_PATTERNS = [
  /\btry\b/i,
  /\btest\b/i,
  /\bcheck\b/i,
  /\brevis(?:e|ed|ing)\b/i,
  /\b(?:case|example|test) proves\b/i,
  /\bproves it\b/i,
  /\bwork\b/i,
  /\bworking\b/i,
  /\bwould\b/i,
  /\bif\b/i,
  /\bmy (?:turn|sentence|example|counterexample) is\b/i,
  /\bthe deciding (?:feature|phrase|case) is\b/i,
];
const CONTENT_PATTERNS = [
  /\bmaster\b/i,
  /\bservant\b/i,
  /\brecognition\b/i,
  /\bwork(?:ing)?\b/i,
  /\bfear\b/i,
  /\bdesire\b/i,
  /\bindependence\b/i,
  /\bindependent\b/i,
  /\bdurable\b/i,
  /\bformation\b/i,
  /\bformed\b/i,
];
const OWN_LANGUAGE_EVIDENCE_PATTERNS = [
  /\bmy (?:turn|sentence|example|counterexample) is\b/i,
  /\bconcrete (?:case|example)\b/i,
  /\b(?:specific|concrete) (?:correction|feature|case|example|mistake)\b/i,
  /\b(?:changed|revised) sentence\b/i,
  /\b(?:lab|lecture|passage|paragraph|phrase|line|object|table|revision|mistake|correction|student|worker)\b/i,
  /\b(?:cup|shelf|chatbot|classmate|teacher|cardboard|faq|assistant|supervisor|plank|slide deck)\b/i,
  /\bcan account for\b/i,
];

function normalizeForMatching(value) {
  return String(value || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');
}

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

function resolveControlledScenario(scenarios, scenarioId) {
  const base = scenarios[BASE_SCENARIO_ID] || {};
  return {
    ...base,
    ...(scenarios[scenarioId] || {}),
  };
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCell(value, maxLength = 120) {
  return normalizeText(value)
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

function countMatches(text, patterns) {
  const normalized = normalizeForMatching(text);
  return patterns.reduce((sum, pattern) => sum + (pattern.test(normalized) ? 1 : 0), 0);
}

function questionCount(text) {
  return (String(text || '').match(/\?/g) || []).length;
}

function hasAnswerFirstCommitment(text) {
  const normalized = normalizeForMatching(text).slice(0, 220);
  return /\b(?:my hinge is|my answer is|the hinge is|provisional hinge|provisional (?:hold|break)|the passage decides|the deciding (?:feature|phrase|case) is|the phrase i(?:'d| would)?\s+(?:test|use)\s+is|(?:it|that|the hinge)\s+(?:holds?|breaks?)|forced obedience cannot|i(?:'ll| will)?\s+(?:make\s+(?:a\s+provisional\s+)?(?:commitment|commit)|make\s+the\s+commitment\s+provisionally|(?:tentatively|provisionally)\s+(?:hold|break)|(?:still\s+)?(?:choose|pick|commit|mark|\*+hold\*+|hold|\*+break\*+|break))|i(?:'d| would)\s+(?:hold|break)|i think my break point is|commit first|hold the hinge|break the hinge|okay,? provisionally)(?=\W|$)/i.test(
    normalized,
  );
}

function hasCommitmentWarrant(text) {
  const normalized = normalizeForMatching(text).slice(0, 500);
  return /\b(?:because|since|if|unless|warrant|the reason is|decides|holds|breaks|counterexample|deciding (?:feature|phrase|case)|passage|paragraph|phrase|line|forming activity|mind of (?:his|her|their) own)\b|§\s*\d+/i.test(
    normalized,
  );
}

function classifyQuestionFloodCommitment({ targetSignal, observedSignal, postLearner }) {
  if (targetSignal !== 'question_flood' || observedSignal !== 'question_flood') return '';
  const postQuestions = questionCount(postLearner);
  const answerFirst = hasAnswerFirstCommitment(postLearner);
  const warrant = hasCommitmentWarrant(postLearner);
  const reopenedByHedge =
    postQuestions > 0 &&
    /\b(?:conditionally|but why|can you|what exactly|i'?m still unsure|i still don'?t know)\b/i.test(
      normalizeForMatching(postLearner),
    );
  if (postQuestions >= 3) return 'reopened_flood';
  if (!answerFirst) return 'no_answer_first';
  if (!warrant) return 'answer_without_warrant';
  if (reopenedByHedge) return 'conditional_reopen';
  return 'usable_commitment';
}

function firstMatch(text, patterns) {
  const normalized = normalizeForMatching(text);
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[0]) return match[0];
  }
  return '';
}

function matchesSignal(text, signal) {
  if (signal === 'question_flood') return questionCount(text) >= 3;
  return countMatches(text, SIGNAL_PATTERNS[signal] || []) > 0;
}

function classifySignal(text, preferredSignal = '') {
  if (preferredSignal && matchesSignal(text, preferredSignal)) return preferredSignal;
  for (const [signal, patterns] of Object.entries(SIGNAL_PATTERNS)) {
    if (countMatches(text, patterns) > 0) return signal;
  }
  return '';
}

function isReliefMarker(text, signal) {
  const normalized = normalizeForMatching(text);
  if (signal === 'boredom') return /\bless\s+(?:dead|bored|boring)\b/i.test(normalized);
  if (signal === 'irrelevance')
    return /\bthe point\b/i.test(normalized) && /\bnow\b|\bokay\b|\bi (?:can|would|think)\b/i.test(normalized);
  return false;
}

function isStillResistant(text, signal) {
  const normalized = normalizeForMatching(text);
  if (!signal) return false;
  if (isReliefMarker(normalized, signal)) return false;
  if (signal === 'frustration' && /\bstill\s+frustrat/i.test(normalized)) return true;
  if (
    signal === 'rote_parroting' &&
    /\bstill\s+(?:feel|feels|feeling).{0,60}\b(?:repeat|repeating|parrot|formula|matching phrases|slots)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (signal === 'question_flood') return matchesSignal(normalized, signal);
  return matchesSignal(normalized, signal);
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

function scriptedLearnerMessage(scenario, turnIndex) {
  if (turnIndex === 0) {
    const match = String(scenario?.learner_context || '').match(/-\s*User:\s*"([^"]+)"/);
    return match?.[1] || '';
  }
  return scenario?.turns?.[turnIndex - 1]?.action_details?.message || '';
}

function getLearnerMessage({ scenario, log, turnIndex }) {
  if (turnIndex === 0) return scriptedLearnerMessage(scenario, 0);
  return getTurnResult(log, turnIndex)?.learnerMessage || scriptedLearnerMessage(scenario, turnIndex);
}

function getTutorMessage({ row, log, turnIndex }) {
  const turn = getTurnResult(log, turnIndex);
  if (turn?.suggestions?.[0]?.message) return turn.suggestions[0].message;
  if (turn?.tutorMessage) return turn.tutorMessage;
  const suggestions = parseJson(row.suggestions, []);
  return suggestions?.[turnIndex]?.message || suggestions?.[0]?.message || '';
}

function isGeneratedLearnerTurn({ scenario, log, turnIndex }) {
  if (turnIndex <= 0) return false;
  const turn = getTurnResult(log, turnIndex);
  if (!turn?.learnerMessage) return false;
  if (turn.learnerMessageGenerated === true) return true;
  return (
    log?.learnerArchitecture === 'ego_superego' &&
    !turn.learnerAction &&
    normalizeText(turn.learnerMessage) !== normalizeText(scriptedLearnerMessage(scenario, turnIndex))
  );
}

function getLearnerResistanceGate({ log, turnIndex }) {
  const turn = getTurnResult(log, turnIndex);
  return turn?.learnerResistanceSignalGate || null;
}

function getTraceTurn(row, turnIndex) {
  const trace = parseJson(row.id_construction_trace, []);
  return trace.find((entry) => Number(entry.turn) === Number(turnIndex)) || null;
}

function getRegister(row, turnIndex) {
  const traceTurn = getTraceTurn(row, turnIndex);
  return traceTurn?.engagementState?.selected_register || traceTurn?.engagementState?.selected_mode || 'unrouted';
}

function getRouterSelectedRegister(row, turnIndex) {
  const traceTurn = getTraceTurn(row, turnIndex);
  return (
    traceTurn?.engagementState?.router_selected_register ||
    traceTurn?.engagementState?.router_selected_mode ||
    traceTurn?.engagementState?.selected_register ||
    traceTurn?.engagementState?.selected_mode ||
    'unrouted'
  );
}

function getAssignedRegisterArm(row, turnIndex) {
  const traceTurn = getTraceTurn(row, turnIndex);
  return traceTurn?.engagementState?.assigned_register_arm || '';
}

function getResistanceSignal(row, turnIndex) {
  const traceTurn = getTraceTurn(row, turnIndex);
  return traceTurn?.engagementState?.resistance_signal || '';
}

function getResistanceStrategy(row, turnIndex) {
  const traceTurn = getTraceTurn(row, turnIndex);
  return traceTurn?.engagementState?.resistance_strategy || '';
}

function getRegisterRubricScore(row, registerName, turnIndex) {
  const scores = parseJson(row.tutor_register_scores, {});
  const slice = scores?.[registerName]?.[`turn_${turnIndex}`];
  return slice?.overall ?? null;
}

function getRegisterRubricDimensionScore(row, registerName, turnIndex, dimensionKey) {
  const scores = parseJson(row.tutor_register_scores, {});
  const slice = scores?.[registerName]?.[`turn_${turnIndex}`];
  const entry = slice?.scores?.[dimensionKey];
  const score = typeof entry === 'number' ? entry : entry?.score;
  return typeof score === 'number' ? score : null;
}

function findResistanceTurn({ scenario, log, targetSignal }) {
  const turns = Array.isArray(log?.turnResults) ? log.turnResults : [];
  for (const turn of turns) {
    const turnIndex = Number(turn.turnIndex);
    if (turnIndex <= 0 || !isGeneratedLearnerTurn({ scenario, log, turnIndex })) continue;
    const learnerMessage = getLearnerMessage({ scenario, log, turnIndex });
    if (classifySignal(learnerMessage, targetSignal) === targetSignal) return turnIndex;
  }
  for (const turn of turns) {
    const turnIndex = Number(turn.turnIndex);
    if (turnIndex > 0 && isGeneratedLearnerTurn({ scenario, log, turnIndex })) return turnIndex;
  }
  return 1;
}

function scoreTransition({ targetSignal, observedSignal, postLearner, preGenerated, postGenerated, routeHit }) {
  const uptake = countMatches(postLearner, UPTAKE_PATTERNS);
  const renewedWork = countMatches(postLearner, RENEWED_WORK_PATTERNS);
  const content = countMatches(postLearner, CONTENT_PATTERNS);
  const ownLanguageEvidence = countMatches(postLearner, OWN_LANGUAGE_EVIDENCE_PATTERNS);
  const postQuestionCount = questionCount(postLearner);
  const answerFirstCommitment =
    targetSignal === 'question_flood' && observedSignal === 'question_flood' && hasAnswerFirstCommitment(postLearner);
  const questionFloodCommitment = classifyQuestionFloodCommitment({ targetSignal, observedSignal, postLearner });
  const usableQuestionFloodCommitment = questionFloodCommitment === 'usable_commitment';
  const reopenedQuestionFloodCommitment = ['conditional_reopen', 'reopened_flood'].includes(questionFloodCommitment);
  const residualQuestionFlood = targetSignal === 'question_flood' && postQuestionCount >= 3;
  const postStillResistant = isStillResistant(postLearner, observedSignal);
  const productiveDespiteResistance =
    observedSignal === 'frustration' && postStillResistant && renewedWork > 0 && content > 0;
  const roteOwnedGeneration =
    observedSignal === 'rote_parroting' && postStillResistant && renewedWork > 0 && ownLanguageEvidence > 0;
  const targetMatched = observedSignal === targetSignal;

  const lexicalScore =
    (preGenerated ? 10 : 0) +
    (postGenerated ? 10 : 0) +
    (targetMatched ? 20 : 0) +
    (routeHit ? 15 : 0) +
    (uptake > 0 ? 15 : 0) +
    (renewedWork > 0 ? 15 : 0) +
    (content + ownLanguageEvidence >= 2 ? 10 : content + ownLanguageEvidence > 0 ? 5 : 0) +
    (!postStillResistant ? 5 : 0);

  let verdict = 'no_breakthrough';
  if (!preGenerated || !targetMatched) {
    verdict = 'missing_target_resistance';
  } else if (!postGenerated) {
    verdict = 'missing_post_learner_turn';
  } else if (lexicalScore >= 70 && !postStillResistant) {
    verdict = routeHit ? 'candidate_router_breakthrough' : 'candidate_nonrouter_breakthrough';
  } else if (productiveDespiteResistance) {
    verdict = 'productive_frustration_work';
  } else if (roteOwnedGeneration) {
    verdict = 'owned_generation_with_residual';
  } else if (uptake > 0 || renewedWork > 0) {
    verdict = 'partial_uptake';
  }

  return {
    lexicalScore,
    verdict,
    uptake,
    renewedWork,
    content,
    ownLanguageEvidence,
    postQuestionCount,
    answerFirstCommitment,
    questionFloodCommitment,
    usableQuestionFloodCommitment,
    reopenedQuestionFloodCommitment,
    residualQuestionFlood,
    targetMatched,
    postStillResistant,
    productiveDespiteResistance,
    roteOwnedGeneration,
  };
}

function isPositiveOutcome(row) {
  return (
    row.verdict.includes('candidate') ||
    row.verdict === 'productive_frustration_work' ||
    row.verdict === 'owned_generation_with_residual'
  );
}

function validateScenarios(scenarios, learnerAgents) {
  const errors = [];
  for (const scenarioId of CONTROLLED_SCENARIOS) {
    if (!scenarios[scenarioId]) {
      errors.push(`Missing controlled scenario ${scenarioId}`);
      continue;
    }
    const scenario = resolveControlledScenario(scenarios, scenarioId);
    if (scenario.resistance_breakthrough_diagnostic !== true) {
      errors.push(`${scenarioId} must set resistance_breakthrough_diagnostic: true`);
    }
    if (!scenario.resistance_signal_target) {
      errors.push(`${scenarioId} must set resistance_signal_target`);
    }
    if (!scenario.learner_persona || !learnerAgents?.personas?.[scenario.learner_persona]) {
      errors.push(`${scenarioId} references missing learner_persona ${scenario.learner_persona || 'none'}`);
    }
    const targetGate = (scenario.resistance_signal_gate || []).find(
      (gate) => gate.id === scenario.resistance_signal_target,
    );
    if (!targetGate) {
      errors.push(`${scenarioId} has no resistance_signal_gate for ${scenario.resistance_signal_target}`);
      continue;
    }
    const routed = routeEngagementMode({
      learnerMessage: targetGate.message || '',
      registerHistory: ['scaffolding'],
    });
    if (routed.selected_register !== 'charismatic_challenge') {
      errors.push(`${scenarioId} target gate expected charismatic_challenge, got ${routed.selected_register}`);
    }
    if (routed.resistance_signal !== scenario.resistance_signal_target) {
      errors.push(
        `${scenarioId} target gate expected ${scenario.resistance_signal_target}, got ${routed.resistance_signal}`,
      );
    }
    if (
      targetGate.expected_resistance_strategy &&
      routed.resistance_strategy !== targetGate.expected_resistance_strategy
    ) {
      errors.push(
        `${scenarioId} target gate expected strategy ${targetGate.expected_resistance_strategy}, got ${
          routed.resistance_strategy || 'none'
        }`,
      );
    }
  }
  return errors;
}

function loadRows(runIds = []) {
  if (!fs.existsSync(DB_PATH)) return [];
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const registerScoresSelect = databaseHasColumn(db, 'evaluation_results', 'tutor_register_scores')
    ? 'r.tutor_register_scores'
    : 'NULL AS tutor_register_scores';
  const params = [...CONTROLLED_SCENARIOS];
  const clauses = [`r.scenario_id IN (${CONTROLLED_SCENARIOS.map(() => '?').join(',')})`, 'r.success = 1'];
  clauses.push(`NOT (
    r.judge_model IS NOT NULL
    AND r.judge_model != ''
    AND EXISTS (
      SELECT 1
      FROM evaluation_results base
      WHERE base.run_id = r.run_id
        AND base.scenario_id = r.scenario_id
        AND base.profile_name = r.profile_name
        AND base.dialogue_id = r.dialogue_id
        AND base.success = 1
        AND (base.judge_model IS NULL OR base.judge_model = '')
    )
  )`);
  if (runIds.length) {
    clauses.push(`r.run_id IN (${runIds.map(() => '?').join(',')})`);
    params.push(...runIds);
  }
  return db
    .prepare(
      `SELECT
         r.id,
         r.run_id,
         r.scenario_id,
         r.profile_name,
         r.dialogue_id,
         r.suggestions,
         r.id_construction_trace,
         ${registerScoresSelect},
         r.tutor_scores,
         r.dialogue_content_hash,
         r.success
       FROM evaluation_results r
       WHERE ${clauses.join(' AND ')}
       ORDER BY r.scenario_id, r.profile_name, r.id`,
    )
    .all(...params);
}

function databaseHasTable(db, tableName) {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName);
  return Boolean(row);
}

function databaseHasColumn(db, tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function roleIsolationArmFromDescription(description) {
  const raw = String(description || '');
  if (!raw.startsWith(ROLE_ISOLATION_PREFIX)) return null;
  const suffix = raw.slice(ROLE_ISOLATION_PREFIX.length).trim();
  return ROLE_ISOLATION_ARMS.find((arm) => suffix === arm.id || suffix.startsWith(`${arm.id} `)) || null;
}

function loadRoleIsolationRunMap(runIds = []) {
  const byRunId = new Map();
  const uniqueRunIds = [...new Set(runIds.filter(Boolean))];
  if (!uniqueRunIds.length || !fs.existsSync(DB_PATH)) return byRunId;

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    if (!databaseHasTable(db, 'evaluation_runs')) return byRunId;
    const rows = db
      .prepare(
        `SELECT id, description, status, total_tests
         FROM evaluation_runs
         WHERE id IN (${uniqueRunIds.map(() => '?').join(',')})`,
      )
      .all(...uniqueRunIds);
    for (const row of rows) {
      const arm = roleIsolationArmFromDescription(row.description);
      if (!arm) continue;
      byRunId.set(row.id, {
        ...arm,
        runStatus: row.status || '',
        totalTests: Number(row.total_tests || 0),
      });
    }
  } finally {
    db.close();
  }
  return byRunId;
}

function analyzeRows(rows, scenarios) {
  return rows.map((row) => {
    const scenario = resolveControlledScenario(scenarios, row.scenario_id);
    const log = loadDialogueLog(row);
    const targetSignal = scenario.resistance_signal_target || '';
    const resistanceTurn = findResistanceTurn({ scenario, log, targetSignal });
    const postTurn = resistanceTurn + 1;
    const preLearner = getLearnerMessage({ scenario, log, turnIndex: resistanceTurn });
    const postLearner = getLearnerMessage({ scenario, log, turnIndex: postTurn });
    const preGenerated = isGeneratedLearnerTurn({ scenario, log, turnIndex: resistanceTurn });
    const postGenerated = isGeneratedLearnerTurn({ scenario, log, turnIndex: postTurn });
    const learnerGate = getLearnerResistanceGate({ log, turnIndex: resistanceTurn });
    const tutorRegister = getRegister(row, resistanceTurn);
    const tutorMessage = getTutorMessage({ row, log, turnIndex: resistanceTurn });
    const routerSelectedRegister = getRouterSelectedRegister(row, resistanceTurn);
    const assignedRegisterArm = getAssignedRegisterArm(row, resistanceTurn);
    const observedSignal = classifySignal(preLearner, targetSignal);
    const routerSignal = getResistanceSignal(row, resistanceTurn);
    const routerStrategy = getResistanceStrategy(row, resistanceTurn);
    const routeHit = routerSelectedRegister === 'charismatic_challenge';
    const registerRubricScore = getRegisterRubricScore(row, tutorRegister, resistanceTurn);
    const stanceFidelity = evaluateRegisterStanceFidelity({
      registerName: tutorRegister,
      learnerMessage: preLearner,
      tutorMessage,
      postLearnerMessage: postLearner,
    });
    const scored = scoreTransition({
      targetSignal,
      observedSignal,
      preLearner,
      postLearner,
      preGenerated,
      postGenerated,
      routeHit,
    });
    return {
      rowId: row.id,
      runId: row.run_id,
      scenarioId: row.scenario_id,
      targetSignal,
      profileName: row.profile_name,
      arm:
        row.profile_name === ROUTER_PROFILE
          ? 'router'
          : row.profile_name === TUNED_ROUTER_PROFILE
            ? 'router_tuned'
            : row.profile_name === OWNED_TEST_ROUTER_PROFILE
              ? 'router_owned_test'
              : row.profile_name === PRECISION_ROUTER_PROFILE
                ? 'router_precision'
                : row.profile_name === GENERATION_ROUTER_PROFILE
                  ? 'router_generation'
                  : row.profile_name === QUESTION_LOCK_ROUTER_PROFILE
                    ? 'router_question_lock'
                    : row.profile_name === COMMITMENT_PROBE_ROUTER_PROFILE
                      ? 'router_commitment_probe'
                      : row.profile_name === BOREDOM_STAKE_ROUTER_PROFILE
                        ? 'router_boredom_stake'
                        : row.profile_name === GLM_COMPACT_ROUTER_PROFILE
                          ? 'router_glm_compact'
                          : row.profile_name === IRONIC_CHALLENGE_PROFILE
                            ? 'ironic_challenge'
                            : row.profile_name === SARCASTIC_CHALLENGE_PROFILE
                              ? 'sarcastic_challenge'
                              : row.profile_name === FACE_THREAT_CHALLENGE_PROFILE
                                ? 'face_threat_challenge'
                                : row.profile_name === STATIC_PROFILE
                                  ? 'static_floor'
                                  : 'other',
      learnerArchitecture: log?.learnerArchitecture || '',
      resistanceTurn,
      preGenerated,
      postGenerated,
      learnerGateMatched: learnerGate?.matched === true,
      learnerGateObservedSignal: learnerGate?.observedSignal || '',
      learnerGateAttempts: Array.isArray(learnerGate?.attempts) ? learnerGate.attempts.length : 0,
      tutorRegister,
      tutorMessage,
      routerSelectedRegister,
      assignedRegisterArm,
      routeHit,
      registerRubricScore,
      stanceFidelity,
      registerRecognitionCostScore: getRegisterRubricDimensionScore(row, tutorRegister, resistanceTurn, 'recognition_cost'),
      registerUptakeFreedomScore: getRegisterRubricDimensionScore(row, tutorRegister, resistanceTurn, 'uptake_freedom'),
      registerFaceRepairScore: getRegisterRubricDimensionScore(row, tutorRegister, resistanceTurn, 'post_turn_face_repair'),
      observedSignal,
      routerSignal,
      routerStrategy,
      preMarker: firstMatch(preLearner, SIGNAL_PATTERNS[observedSignal] || []),
      postMarker: firstMatch(postLearner, UPTAKE_PATTERNS),
      preLearner,
      postLearner,
      ...scored,
    };
  });
}

function summarize(analyses) {
  const byArm = new Map();
  const byTargetArm = new Map();
  for (const row of analyses) {
    for (const [map, key] of [
      [byArm, row.arm],
      [byTargetArm, `${row.targetSignal}::${row.arm}`],
    ]) {
      if (!map.has(key)) {
        map.set(key, {
          key,
          rows: 0,
          eligible: 0,
          candidates: 0,
          productiveFrustration: 0,
          roteOwnedGeneration: 0,
          positiveOutcomes: 0,
          routeHits: 0,
          targetMatches: 0,
          gateMatches: 0,
          gatedRows: 0,
          answerFirst: 0,
          usableCommitments: 0,
          reopenedCommitments: 0,
          residualFloods: 0,
          scoreSum: 0,
          registerScoreSum: 0,
          registerScoreCount: 0,
          registerRecognitionCostSum: 0,
          registerRecognitionCostCount: 0,
          registerUptakeFreedomSum: 0,
          registerUptakeFreedomCount: 0,
          registerFaceRepairSum: 0,
          registerFaceRepairCount: 0,
          stanceFidelityApplicable: 0,
          stanceFidelityPassed: 0,
          stanceFidelityScoreSum: 0,
          stanceFidelityEvidenceRows: 0,
          stanceFidelityEvidencePositiveOutcomes: 0,
          stanceFidelityExcludedNoncompliance: 0,
          stanceFidelityInvalidViolations: 0,
        });
      }
      const item = map.get(key);
      const eligible = row.preGenerated && row.postGenerated && row.targetMatched;
      const candidate = row.verdict.includes('candidate');
      const productiveFrustration = row.verdict === 'productive_frustration_work';
      const roteOwnedGeneration = row.verdict === 'owned_generation_with_residual';
      item.rows += 1;
      item.eligible += eligible ? 1 : 0;
      item.candidates += candidate ? 1 : 0;
      item.productiveFrustration += productiveFrustration ? 1 : 0;
      item.roteOwnedGeneration += roteOwnedGeneration ? 1 : 0;
      item.positiveOutcomes += isPositiveOutcome(row) ? 1 : 0;
      item.routeHits += row.routeHit ? 1 : 0;
      item.targetMatches += row.targetMatched ? 1 : 0;
      item.gateMatches += row.learnerGateMatched ? 1 : 0;
      item.gatedRows += row.learnerGateAttempts ? 1 : 0;
      item.answerFirst += row.answerFirstCommitment ? 1 : 0;
      item.usableCommitments += row.usableQuestionFloodCommitment ? 1 : 0;
      item.reopenedCommitments += row.reopenedQuestionFloodCommitment ? 1 : 0;
      item.residualFloods += row.residualQuestionFlood ? 1 : 0;
      item.scoreSum += row.lexicalScore || 0;
      if (row.registerRubricScore != null && !Number.isNaN(Number(row.registerRubricScore))) {
        item.registerScoreSum += Number(row.registerRubricScore);
        item.registerScoreCount += 1;
      }
      if (row.registerRecognitionCostScore != null && !Number.isNaN(Number(row.registerRecognitionCostScore))) {
        item.registerRecognitionCostSum += Number(row.registerRecognitionCostScore);
        item.registerRecognitionCostCount += 1;
      }
      if (row.registerUptakeFreedomScore != null && !Number.isNaN(Number(row.registerUptakeFreedomScore))) {
        item.registerUptakeFreedomSum += Number(row.registerUptakeFreedomScore);
        item.registerUptakeFreedomCount += 1;
      }
      if (row.registerFaceRepairScore != null && !Number.isNaN(Number(row.registerFaceRepairScore))) {
        item.registerFaceRepairSum += Number(row.registerFaceRepairScore);
        item.registerFaceRepairCount += 1;
      }
      if (row.stanceFidelity?.applies) {
        item.stanceFidelityApplicable += 1;
        item.stanceFidelityPassed += row.stanceFidelity.passed ? 1 : 0;
        item.stanceFidelityScoreSum += Number(row.stanceFidelity.score || 0);
        item.stanceFidelityEvidenceRows += row.stanceFidelity.countsAsArmEvidence ? 1 : 0;
        item.stanceFidelityEvidencePositiveOutcomes +=
          row.stanceFidelity.countsAsArmEvidence && isPositiveOutcome(row) ? 1 : 0;
        item.stanceFidelityExcludedNoncompliance += row.stanceFidelity.countsAsExcludedNoncompliance ? 1 : 0;
        item.stanceFidelityInvalidViolations += row.stanceFidelity.countsAsInvalidViolation ? 1 : 0;
      }
    }
  }
  return { byArm: [...byArm.values()], byTargetArm: [...byTargetArm.values()] };
}

function summarizeStanceGate(analyses) {
  const rows = analyses.filter((row) => row.stanceFidelity?.applies);
  const byArm = new Map();
  for (const row of rows) {
    if (!byArm.has(row.arm)) {
      byArm.set(row.arm, {
        arm: row.arm,
        assignedRows: 0,
        faithfulRows: 0,
        faithfulPositiveOutcomes: 0,
        excludedNoncompliance: 0,
        invalidViolations: 0,
        scoreSum: 0,
        labels: {},
      });
    }
    const item = byArm.get(row.arm);
    item.assignedRows += 1;
    item.faithfulRows += row.stanceFidelity.countsAsArmEvidence ? 1 : 0;
    item.faithfulPositiveOutcomes += row.stanceFidelity.countsAsArmEvidence && isPositiveOutcome(row) ? 1 : 0;
    item.excludedNoncompliance += row.stanceFidelity.countsAsExcludedNoncompliance ? 1 : 0;
    item.invalidViolations += row.stanceFidelity.countsAsInvalidViolation ? 1 : 0;
    item.scoreSum += Number(row.stanceFidelity.score || 0);
    item.labels[row.stanceFidelity.label] = (item.labels[row.stanceFidelity.label] || 0) + 1;
  }

  return {
    rows: rows.length,
    faithfulRows: rows.filter((row) => row.stanceFidelity.countsAsArmEvidence).length,
    faithfulPositiveOutcomes: rows.filter((row) => row.stanceFidelity.countsAsArmEvidence && isPositiveOutcome(row)).length,
    excludedNoncompliance: rows.filter((row) => row.stanceFidelity.countsAsExcludedNoncompliance).length,
    invalidViolations: rows.filter((row) => row.stanceFidelity.countsAsInvalidViolation).length,
    byArm: [...byArm.values()],
  };
}

function summarizeRows(rows, key) {
  const item = {
    key,
    rows: 0,
    candidates: 0,
    routeHits: 0,
    gateMatches: 0,
    gatedRows: 0,
    answerFirst: 0,
    usableCommitments: 0,
    reopenedCommitments: 0,
    residualFloods: 0,
  };
  for (const row of rows) {
    item.rows += 1;
    item.candidates += row.verdict.includes('candidate') ? 1 : 0;
    item.routeHits += row.routeHit ? 1 : 0;
    item.gateMatches += row.learnerGateMatched ? 1 : 0;
    item.gatedRows += row.learnerGateAttempts ? 1 : 0;
    item.answerFirst += row.answerFirstCommitment ? 1 : 0;
    item.usableCommitments += row.usableQuestionFloodCommitment ? 1 : 0;
    item.reopenedCommitments += row.reopenedQuestionFloodCommitment ? 1 : 0;
    item.residualFloods += row.residualQuestionFlood ? 1 : 0;
  }
  return item;
}

function rate(item, field) {
  return item?.rows ? item[field] / item.rows : null;
}

function questionFloodGate(analyses) {
  const rows = analyses.filter((row) => row.targetSignal === 'question_flood');
  const byArm = new Map();
  for (const arm of ['router_owned_test', 'router_generation', 'router_commitment_probe']) {
    byArm.set(
      arm,
      summarizeRows(
        rows.filter((row) => row.arm === arm),
        arm,
      ),
    );
  }

  const owned = byArm.get('router_owned_test');
  const generation = byArm.get('router_generation');
  const probe = byArm.get('router_commitment_probe');
  const requiredRows = 2;
  const benchmarkUsable = Math.max(rate(owned, 'usableCommitments') ?? 0, rate(generation, 'usableCommitments') ?? 0);
  const benchmarkCandidate = Math.max(rate(owned, 'candidates') ?? 0, rate(generation, 'candidates') ?? 0);

  let status = 'PENDING_NO_COMMITMENT_PROBE_ROWS';
  const reasons = [];
  if (probe.rows > 0 && probe.rows < requiredRows) {
    status = 'NEEDS_MORE_COMMITMENT_PROBE_ROWS';
    reasons.push(`only ${probe.rows}/${requiredRows} commitment-probe rows`);
  } else if (probe.rows >= requiredRows) {
    const routeClean = probe.routeHits === probe.rows;
    const gateClean = probe.gatedRows === 0 || probe.gateMatches === probe.gatedRows;
    const candidateOk = rate(probe, 'candidates') >= benchmarkCandidate;
    const usableOk = rate(probe, 'usableCommitments') >= benchmarkUsable;
    const reopenedClean = probe.reopenedCommitments === 0;
    const residualClean = probe.residualFloods === 0;
    if (routeClean && gateClean && candidateOk && usableOk && reopenedClean && residualClean) {
      status = 'PROMOTE_COMMITMENT_PROBE_FOR_QUESTION_FLOOD';
    } else {
      status = 'DO_NOT_PROMOTE_COMMITMENT_PROBE';
      if (!routeClean) reasons.push('route hits are not clean');
      if (!gateClean) reasons.push('target gate is not clean');
      if (!candidateOk) reasons.push('candidate rate is below current comparators');
      if (!usableOk) reasons.push('usable-commitment rate is below current comparators');
      if (!reopenedClean) reasons.push('reopened commitments remain');
      if (!residualClean) reasons.push('residual floods remain');
    }
  }
  if (!reasons.length && status === 'PENDING_NO_COMMITMENT_PROBE_ROWS') {
    reasons.push('run cell192 against question_flood before deciding');
  }

  return {
    status,
    requiredRows,
    benchmarkCandidate,
    benchmarkUsable,
    reasons,
    rows: [...byArm.values()],
  };
}

function emptyRoleIsolationArmSummary(arm) {
  return {
    key: arm.id,
    contrast: arm.contrast,
    evidence: arm.evidence,
    expectedRows: arm.expectedRows,
    rows: 0,
    preGenerated: 0,
    postGenerated: 0,
    eligible: 0,
    candidates: 0,
    positiveOutcomes: 0,
    routeHits: 0,
    targetMatches: 0,
    gateMatches: 0,
    gatedRows: 0,
    missingPostTurns: 0,
    scoreSum: 0,
  };
}

function addRoleIsolationRow(summary, row) {
  const eligible = row.preGenerated && row.postGenerated && row.targetMatched;
  summary.rows += 1;
  summary.preGenerated += row.preGenerated ? 1 : 0;
  summary.postGenerated += row.postGenerated ? 1 : 0;
  summary.eligible += eligible ? 1 : 0;
  summary.candidates += row.verdict.includes('candidate') ? 1 : 0;
  summary.positiveOutcomes += isPositiveOutcome(row) ? 1 : 0;
  summary.routeHits += row.routeHit ? 1 : 0;
  summary.targetMatches += row.targetMatched ? 1 : 0;
  summary.gateMatches += row.learnerGateMatched ? 1 : 0;
  summary.gatedRows += row.learnerGateAttempts ? 1 : 0;
  summary.missingPostTurns += row.verdict === 'missing_post_learner_turn' ? 1 : 0;
  summary.scoreSum += row.lexicalScore || 0;
}

function roleIsolationArmInterpretation(row) {
  if (!row.rows) return 'not represented in this run set';
  if (row.evidence === 'register control') {
    return row.routeHits === row.rows && row.targetMatches >= row.rows - 1
      ? 'register shape passes; not learner-outcome evidence'
      : 'register-control weakness';
  }
  if (row.key === 'baseline_codex_tutor_codex_learner') {
    return row.routeHits === row.rows && row.targetMatches === row.rows && row.positiveOutcomes >= 5
      ? 'local Codex-stack reference reproduced'
      : 'reference weakened';
  }
  if (row.key === 'tutor_fixed_glm_learner') {
    return row.postGenerated < row.rows || row.targetMatches < row.rows
      ? 'learner-side completion/target drift'
      : 'GLM learner held the outcome path';
  }
  if (row.key === 'learner_fixed_glm_tutor') {
    return row.routeHits === row.rows && row.targetMatches === row.rows && row.positiveOutcomes >= 5
      ? 'GLM tutor/id works with Codex learner'
      : 'tutor/id-side weakness';
  }
  if (row.key === 'full_glm_reference') {
    return row.postGenerated < row.rows || row.targetMatches < row.rows || row.routeHits < row.rows
      ? 'full GLM remains unstable'
      : 'full GLM matched the local mechanism';
  }
  return '';
}

function diagnoseRoleIsolation(byArm) {
  const arm = (id) =>
    byArm.find((row) => row.key === id) || emptyRoleIsolationArmSummary(ROLE_ISOLATION_ARM_BY_ID.get(id));
  const totalRows = byArm.reduce((sum, row) => sum + row.rows, 0);
  const expectedRows = byArm.reduce((sum, row) => sum + row.expectedRows, 0);
  if (totalRows < expectedRows) {
    return {
      status: 'INCOMPLETE_ROLE_ISOLATION_GRID',
      bullets: [`Only ${totalRows}/${expectedRows} planned role-isolation rows are represented.`],
    };
  }

  const baseline = arm('baseline_codex_tutor_codex_learner');
  const tutorFixed = arm('tutor_fixed_glm_learner');
  const learnerFixed = arm('learner_fixed_glm_tutor');
  const fullGlm = arm('full_glm_reference');
  const scriptedGlm = arm('scripted_control_glm_tutor');
  const scriptedCodex = arm('scripted_control_codex_tutor');

  const learnerFixedStable =
    learnerFixed.rows > 0 &&
    learnerFixed.routeHits === learnerFixed.rows &&
    learnerFixed.targetMatches === learnerFixed.rows &&
    learnerFixed.positiveOutcomes >= baseline.positiveOutcomes;
  const scriptedControlsPass =
    scriptedCodex.rows > 0 &&
    scriptedGlm.rows > 0 &&
    scriptedCodex.routeHits === scriptedCodex.rows &&
    scriptedGlm.routeHits === scriptedGlm.rows &&
    scriptedCodex.targetMatches >= scriptedCodex.rows - 1 &&
    scriptedGlm.targetMatches >= scriptedGlm.rows - 1;
  const glmLearnerDrifts =
    tutorFixed.postGenerated < tutorFixed.rows ||
    tutorFixed.targetMatches < tutorFixed.rows ||
    fullGlm.postGenerated < fullGlm.rows ||
    fullGlm.targetMatches < fullGlm.rows;

  if (learnerFixedStable && scriptedControlsPass && glmLearnerDrifts) {
    return {
      status: 'DYNAMIC_LEARNER_COMPLETION_AND_TARGET_DRIFT_BOUNDARY',
      bullets: [
        `Baseline reproduces the local reference (${baseline.positiveOutcomes}/${baseline.rows} positive; ${baseline.candidates}/${baseline.rows} strict candidates).`,
        `Holding the learner fixed while swapping in GLM tutor/id does not break the path (${learnerFixed.positiveOutcomes}/${learnerFixed.rows} positive; ${learnerFixed.candidates}/${learnerFixed.rows} strict candidates).`,
        `Both scripted controls route the public register cleanly enough (${scriptedCodex.routeHits}/${scriptedCodex.rows} Codex route hits; ${scriptedGlm.routeHits}/${scriptedGlm.rows} GLM route hits), so the GLM boundary is not primarily public register production.`,
        `Rows involving a GLM dynamic learner lose completion or target stability: tutor-fixed/GLM-learner has ${tutorFixed.postGenerated}/${tutorFixed.rows} post turns and ${tutorFixed.targetMatches}/${tutorFixed.rows} target matches; full GLM has ${fullGlm.postGenerated}/${fullGlm.rows} post turns and ${fullGlm.targetMatches}/${fullGlm.rows} target matches.`,
        'Conclusion: keep the claim scoped to the Codex/Claude-stack local mechanism and a GLM boundary diagnosis; do not promote a full-GLM or general model-stack robustness claim.',
      ],
    };
  }

  if (!learnerFixedStable && !scriptedControlsPass) {
    return {
      status: 'TUTOR_ID_REGISTER_PRODUCTION_BOUNDARY',
      bullets: [
        'Both the learner-fixed GLM tutor/id arm and the scripted GLM tutor control are weak, so the immediate suspect is tutor/id register production.',
      ],
    };
  }

  return {
    status: 'MIXED_ROLE_ISOLATION_BOUNDARY',
    bullets: [
      'The six-arm grid is complete, but the observed pattern does not isolate a single failure side under the built-in decision rules.',
      'Treat the result as a scoped boundary diagnosis, not as a promoted model-stack robustness claim.',
    ],
  };
}

function summarizeRoleIsolation(analyses) {
  const roleRows = analyses.filter((row) => row.roleIsolationArm);
  if (!roleRows.length) return null;

  const byArm = new Map(ROLE_ISOLATION_ARMS.map((arm) => [arm.id, emptyRoleIsolationArmSummary(arm)]));
  for (const row of roleRows) {
    const summary = byArm.get(row.roleIsolationArm);
    if (summary) addRoleIsolationRow(summary, row);
  }
  const rows = [...byArm.values()];
  return {
    rows: roleRows.length,
    expectedRows: ROLE_ISOLATION_ARMS.reduce((sum, arm) => sum + arm.expectedRows, 0),
    byArm: rows,
    diagnosis: diagnoseRoleIsolation(rows),
  };
}

function pct(n, d) {
  return d ? `${Math.round((n / d) * 100)}%` : '0%';
}

function fraction(n, d) {
  return d ? `${n}/${d}` : '-';
}

function buildReport({ generatedAt, errors, analyses }) {
  const status = errors.length ? 'FAIL' : analyses.length ? 'ANALYZED_ROWS' : 'READY_NO_ROWS';
  const summary = summarize(analyses);
  const stanceGate = summarizeStanceGate(analyses);
  const roleSummary = summarizeRoleIsolation(analyses);
  const qfGate = questionFloodGate(analyses);
  const lines = [];
  lines.push('# Charisma Desire Resistance-Breakthrough Matrix');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  lines.push(`Status: \`${status}\``);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- No generation and no judge calls.');
  lines.push('- Matrix unit: five target resistance signals x router profile versus static-floor dynamic comparator.');
  lines.push('- Outcome unit: generated resistant learner turn -> tutor response -> generated learner uptake.');
  lines.push(`- Router profile: \`${ROUTER_PROFILE}\`.`);
  lines.push(`- Tuned router profile: \`${TUNED_ROUTER_PROFILE}\`.`);
  lines.push(`- Owned-test router profile: \`${OWNED_TEST_ROUTER_PROFILE}\`.`);
  lines.push(`- Precision router profile: \`${PRECISION_ROUTER_PROFILE}\`.`);
  lines.push(`- Generation router profile: \`${GENERATION_ROUTER_PROFILE}\`.`);
  lines.push(`- Question-lock router profile: \`${QUESTION_LOCK_ROUTER_PROFILE}\`.`);
  lines.push(`- Commitment-probe router profile: \`${COMMITMENT_PROBE_ROUTER_PROFILE}\`.`);
  lines.push(`- Boredom-stake router profile: \`${BOREDOM_STAKE_ROUTER_PROFILE}\`.`);
  lines.push(`- GLM-compact router profile: \`${GLM_COMPACT_ROUTER_PROFILE}\`.`);
  lines.push(`- Ironic assigned-arm profile: \`${IRONIC_CHALLENGE_PROFILE}\`.`);
  lines.push(`- Sarcastic assigned-arm profile: \`${SARCASTIC_CHALLENGE_PROFILE}\`.`);
  lines.push(`- Face-threat simulated-only assigned-arm profile: \`${FACE_THREAT_CHALLENGE_PROFILE}\`.`);
  lines.push(`- Static-floor comparator: \`${STATIC_PROFILE}\`.`);
  lines.push('');
  lines.push('## Validation');
  lines.push('');
  lines.push(
    errors.length
      ? errors.map((error) => `- ${error}`).join('\n')
      : '- Controlled scenarios and target gates validate.',
  );
  lines.push('');
  if (stanceGate.rows) {
    lines.push('## Negative-Register Stance Gate');
    lines.push('');
    lines.push(
      '- Gate rule: only `faithful` rows count as assigned-register effect evidence for negative-register arms.',
    );
    lines.push(
      '- `weak_or_warm_in_costume` and `not_instantiated` are treatment-noncompliance exclusions; `invalid_person_attack` is a corrosive violation, not successful register execution.',
    );
    lines.push(
      `- Overall: ${stanceGate.faithfulRows}/${stanceGate.rows} faithful evidence rows; ` +
        `${stanceGate.faithfulPositiveOutcomes}/${stanceGate.faithfulRows || 0} faithful positive local outcomes; ` +
        `${stanceGate.excludedNoncompliance} noncompliance exclusions; ${stanceGate.invalidViolations} invalid violations.`,
    );
    lines.push('');
    lines.push(
      markdownTable(
        ['Arm', 'Assigned rows', 'Faithful evidence', 'Faithful positive', 'Excluded', 'Invalid', 'Mean fidelity', 'Labels'],
        stanceGate.byArm.map((row) => [
          row.arm,
          String(row.assignedRows),
          `${row.faithfulRows}/${row.assignedRows}`,
          `${row.faithfulPositiveOutcomes}/${row.faithfulRows || 0}`,
          String(row.excludedNoncompliance),
          String(row.invalidViolations),
          row.assignedRows ? (row.scoreSum / row.assignedRows).toFixed(1) : '',
          Object.entries(row.labels)
            .map(([label, count]) => `${label}:${count}`)
            .join(', '),
        ]),
      ),
    );
    lines.push('');
  }
  lines.push('## Arm Summary');
  lines.push('');
  if (summary.byArm.length) {
    lines.push(
      markdownTable(
        [
          'Arm',
          'Rows',
          'Eligible',
          'Candidates',
          'Positive',
          'Rote owned',
          'Route hits',
          'Target matches',
          'Gate matches',
          'Answer-first',
          'Usable commit',
          'Reopened',
          'Residual flood',
          'Mean score',
          'Mean register score',
          'Reg recog',
          'Reg uptake',
          'Reg repair',
          'Faithful evidence',
          'Faithful positive',
          'Excluded',
          'Invalid',
          'Stance fidelity',
        ],
        summary.byArm.map((row) => [
          row.key,
          String(row.rows),
          `${row.eligible}/${row.rows}`,
          `${row.candidates}/${row.rows}`,
          `${row.positiveOutcomes}/${row.rows}`,
          `${row.roteOwnedGeneration}/${row.rows}`,
          `${row.routeHits}/${row.rows} (${pct(row.routeHits, row.rows)})`,
          `${row.targetMatches}/${row.rows}`,
          row.gatedRows ? `${row.gateMatches}/${row.gatedRows}` : '-',
          `${row.answerFirst}/${row.rows}`,
          `${row.usableCommitments}/${row.rows}`,
          `${row.reopenedCommitments}/${row.rows}`,
          `${row.residualFloods}/${row.rows}`,
          row.rows ? (row.scoreSum / row.rows).toFixed(1) : '',
          row.registerScoreCount ? (row.registerScoreSum / row.registerScoreCount).toFixed(1) : '',
          row.registerRecognitionCostCount
            ? (row.registerRecognitionCostSum / row.registerRecognitionCostCount).toFixed(1)
            : '',
          row.registerUptakeFreedomCount ? (row.registerUptakeFreedomSum / row.registerUptakeFreedomCount).toFixed(1) : '',
          row.registerFaceRepairCount ? (row.registerFaceRepairSum / row.registerFaceRepairCount).toFixed(1) : '',
          row.stanceFidelityApplicable ? `${row.stanceFidelityEvidenceRows}/${row.stanceFidelityApplicable}` : '',
          row.stanceFidelityApplicable
            ? `${row.stanceFidelityEvidencePositiveOutcomes}/${row.stanceFidelityEvidenceRows || 0}`
            : '',
          row.stanceFidelityApplicable ? String(row.stanceFidelityExcludedNoncompliance) : '',
          row.stanceFidelityApplicable ? String(row.stanceFidelityInvalidViolations) : '',
          row.stanceFidelityApplicable
            ? `${row.stanceFidelityPassed}/${row.stanceFidelityApplicable} (${(
                row.stanceFidelityScoreSum / row.stanceFidelityApplicable
              ).toFixed(1)})`
            : '',
        ]),
      ),
    );
  } else {
    lines.push('- No controlled rows found.');
  }
  lines.push('');
  lines.push('## Target x Arm');
  lines.push('');
  if (summary.byTargetArm.length) {
    lines.push(
      markdownTable(
        [
          'Target/Arm',
          'Rows',
          'Eligible',
          'Candidates',
          'Positive',
          'Rote owned',
          'Route hits',
          'Gate matches',
          'Answer-first',
          'Usable commit',
          'Reopened',
          'Residual flood',
          'Mean score',
          'Mean register score',
          'Reg recog',
          'Reg uptake',
          'Reg repair',
          'Faithful evidence',
          'Faithful positive',
          'Excluded',
          'Invalid',
          'Stance fidelity',
        ],
        summary.byTargetArm.map((row) => [
          row.key,
          String(row.rows),
          `${row.eligible}/${row.rows}`,
          `${row.candidates}/${row.rows}`,
          `${row.positiveOutcomes}/${row.rows}`,
          `${row.roteOwnedGeneration}/${row.rows}`,
          `${row.routeHits}/${row.rows}`,
          row.gatedRows ? `${row.gateMatches}/${row.gatedRows}` : '-',
          `${row.answerFirst}/${row.rows}`,
          `${row.usableCommitments}/${row.rows}`,
          `${row.reopenedCommitments}/${row.rows}`,
          `${row.residualFloods}/${row.rows}`,
          row.rows ? (row.scoreSum / row.rows).toFixed(1) : '',
          row.registerScoreCount ? (row.registerScoreSum / row.registerScoreCount).toFixed(1) : '',
          row.registerRecognitionCostCount
            ? (row.registerRecognitionCostSum / row.registerRecognitionCostCount).toFixed(1)
            : '',
          row.registerUptakeFreedomCount ? (row.registerUptakeFreedomSum / row.registerUptakeFreedomCount).toFixed(1) : '',
          row.registerFaceRepairCount ? (row.registerFaceRepairSum / row.registerFaceRepairCount).toFixed(1) : '',
          row.stanceFidelityApplicable ? `${row.stanceFidelityEvidenceRows}/${row.stanceFidelityApplicable}` : '',
          row.stanceFidelityApplicable
            ? `${row.stanceFidelityEvidencePositiveOutcomes}/${row.stanceFidelityEvidenceRows || 0}`
            : '',
          row.stanceFidelityApplicable ? String(row.stanceFidelityExcludedNoncompliance) : '',
          row.stanceFidelityApplicable ? String(row.stanceFidelityInvalidViolations) : '',
          row.stanceFidelityApplicable
            ? `${row.stanceFidelityPassed}/${row.stanceFidelityApplicable} (${(
                row.stanceFidelityScoreSum / row.stanceFidelityApplicable
              ).toFixed(1)})`
            : '',
        ]),
      ),
    );
  } else {
    lines.push('- No target rows found.');
  }
  lines.push('');
  if (roleSummary) {
    lines.push('## Role-Isolation Arm Summary');
    lines.push('');
    lines.push(
      '- This section is populated only for runs whose `evaluation_runs.description` starts with `Charisma desire role isolation:`.',
    );
    lines.push('- Scripted-control arms are tutor-register checks, not learner-outcome evidence.');
    lines.push('');
    lines.push(
      markdownTable(
        [
          'Arm',
          'Contrast',
          'Evidence',
          'Rows',
          'Eligible',
          'Candidates',
          'Positive',
          'Route hits',
          'Target matches',
          'Gate matches',
          'Post generated',
          'Missing post',
          'Mean score',
          'Interpretation',
        ],
        roleSummary.byArm.map((row) => [
          row.key,
          row.contrast,
          row.evidence,
          `${row.rows}/${row.expectedRows}`,
          `${row.eligible}/${row.rows || row.expectedRows}`,
          `${row.candidates}/${row.rows || row.expectedRows}`,
          `${row.positiveOutcomes}/${row.rows || row.expectedRows}`,
          `${row.routeHits}/${row.rows || row.expectedRows}`,
          `${row.targetMatches}/${row.rows || row.expectedRows}`,
          row.gatedRows ? `${row.gateMatches}/${row.gatedRows}` : '-',
          `${row.postGenerated}/${row.rows || row.expectedRows}`,
          `${row.missingPostTurns}/${row.rows || row.expectedRows}`,
          row.rows ? (row.scoreSum / row.rows).toFixed(1) : '',
          roleIsolationArmInterpretation(row),
        ]),
      ),
    );
    lines.push('');
    lines.push('## Role-Isolation Diagnosis');
    lines.push('');
    lines.push(`Status: \`${roleSummary.diagnosis.status}\``);
    lines.push('');
    lines.push(roleSummary.diagnosis.bullets.map((bullet) => `- ${bullet}`).join('\n'));
    lines.push('');
  }
  lines.push('');
  lines.push('## Question-Flood Gate');
  lines.push('');
  lines.push(`Status: \`${qfGate.status}\``);
  lines.push('');
  lines.push(
    '- Promotion rule: promote `cell_192` for question-flood only if it has at least ' +
      `${qfGate.requiredRows} rows, clean route/gate preconditions, candidate rate at least the current comparators, ` +
      'usable-commitment rate at least the current comparators, and zero reopened or residual-flood outcomes.',
  );
  lines.push('');
  lines.push(
    markdownTable(
      [
        'Arm',
        'Rows',
        'Candidates',
        'Route hits',
        'Gate matches',
        'Answer-first',
        'Usable commit',
        'Reopened',
        'Residual flood',
      ],
      qfGate.rows.map((row) => [
        row.key,
        String(row.rows),
        fraction(row.candidates, row.rows),
        fraction(row.routeHits, row.rows),
        row.gatedRows ? `${row.gateMatches}/${row.gatedRows}` : '-',
        fraction(row.answerFirst, row.rows),
        fraction(row.usableCommitments, row.rows),
        fraction(row.reopenedCommitments, row.rows),
        fraction(row.residualFloods, row.rows),
      ]),
    ),
  );
  lines.push('');
  lines.push(qfGate.reasons.map((reason) => `- ${reason}`).join('\n'));
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  if (analyses.length) {
    lines.push(
      markdownTable(
        [
          'Run',
          'Target',
          'Arm',
          'Profile',
          'Register',
          'Assigned',
          'Router selected',
          'Register score',
          'Reg recog',
          'Reg uptake',
          'Reg repair',
          'Stance fidelity',
          'Stance gate',
          'Observed',
          'Router signal',
          'Strategy',
          'Gate',
          'Generated',
          'Score',
          'Verdict',
          'Post ?',
          'Rote owned',
          'Answer first',
          'Commitment',
          'Pre',
          'Post',
        ],
        analyses.map((row) => [
          row.runId,
          row.targetSignal,
          row.arm,
          row.profileName,
          row.tutorRegister,
          row.assignedRegisterArm,
          row.routerSelectedRegister,
          row.registerRubricScore == null ? '' : Number(row.registerRubricScore).toFixed(1),
          row.registerRecognitionCostScore == null ? '' : Number(row.registerRecognitionCostScore).toFixed(1),
          row.registerUptakeFreedomScore == null ? '' : Number(row.registerUptakeFreedomScore).toFixed(1),
          row.registerFaceRepairScore == null ? '' : Number(row.registerFaceRepairScore).toFixed(1),
          row.stanceFidelity?.applies
            ? `${row.stanceFidelity.label} (${row.stanceFidelity.score ?? ''})`
            : '',
          row.stanceFidelity?.applies ? row.stanceFidelity.gate : '',
          row.observedSignal,
          row.routerSignal,
          row.routerStrategy,
          row.learnerGateAttempts
            ? `${row.learnerGateMatched ? 'matched' : 'missed'} (${row.learnerGateAttempts})`
            : '-',
          `${row.preGenerated ? 'pre' : '-'}+${row.postGenerated ? 'post' : '-'}`,
          String(row.lexicalScore),
          row.verdict,
          String(row.postQuestionCount),
          row.roteOwnedGeneration ? 'yes' : '',
          row.answerFirstCommitment ? 'yes' : '',
          row.questionFloodCommitment,
          cleanCell(row.preLearner, 70),
          cleanCell(row.postLearner, 70),
        ]),
      ),
    );
  } else {
    lines.push('- No rows.');
  }
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
  const errors = validateScenarios(scenarios, learnerAgents);
  const rows = loadRows(runIds);
  const roleIsolationRuns = loadRoleIsolationRunMap(rows.map((row) => row.run_id));
  const analyses = analyzeRows(rows, scenarios).map((row) => {
    const roleIsolationArm = roleIsolationRuns.get(row.runId);
    if (!roleIsolationArm) return row;
    return {
      ...row,
      roleIsolationArm: roleIsolationArm.id,
      roleIsolationContrast: roleIsolationArm.contrast,
      roleIsolationEvidence: roleIsolationArm.evidence,
    };
  });
  const roleIsolationSummary = summarizeRoleIsolation(analyses);
  const data = {
    generatedAt: new Date().toISOString(),
    scenarioIds: CONTROLLED_SCENARIOS,
    profiles: [
      ROUTER_PROFILE,
      TUNED_ROUTER_PROFILE,
      OWNED_TEST_ROUTER_PROFILE,
      PRECISION_ROUTER_PROFILE,
      GENERATION_ROUTER_PROFILE,
      QUESTION_LOCK_ROUTER_PROFILE,
      COMMITMENT_PROBE_ROUTER_PROFILE,
      BOREDOM_STAKE_ROUTER_PROFILE,
      GLM_COMPACT_ROUTER_PROFILE,
      IRONIC_CHALLENGE_PROFILE,
      SARCASTIC_CHALLENGE_PROFILE,
      FACE_THREAT_CHALLENGE_PROFILE,
      STATIC_PROFILE,
    ],
    errors,
    analyses,
    summary: summarize(analyses),
    stanceGate: summarizeStanceGate(analyses),
    roleIsolation: roleIsolationSummary,
    questionFloodGate: questionFloodGate(analyses),
  };

  if (!checkOnly) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`);
    fs.writeFileSync(REPORT_PATH, buildReport({ generatedAt: data.generatedAt, errors, analyses }));
  }

  const candidates = analyses.filter((row) => row.verdict.includes('candidate'));
  const positiveOutcomes = analyses.filter(isPositiveOutcome);
  console.log('Scenario set: charisma_desire_resistance_breakthrough_controlled');
  console.log(`Status: ${errors.length ? 'FAIL' : analyses.length ? 'ANALYZED_ROWS' : 'READY_NO_ROWS'}`);
  console.log(`Controlled scenarios: ${CONTROLLED_SCENARIOS.length}`);
  console.log(`Profiles: ${data.profiles.join(',')}`);
  console.log(`Rows found: ${analyses.length}`);
  console.log(`Candidate breakthroughs: ${candidates.length}`);
  console.log(`Positive local outcomes: ${positiveOutcomes.length}`);
  if (data.stanceGate.rows) {
    console.log(
      `Negative-register stance gate: ${data.stanceGate.faithfulRows}/${data.stanceGate.rows} faithful; ` +
        `${data.stanceGate.excludedNoncompliance} excluded; ${data.stanceGate.invalidViolations} invalid`,
    );
  }
  if (roleIsolationSummary) {
    const populatedArms = roleIsolationSummary.byArm.filter((row) => row.rows > 0).length;
    console.log(`Role-isolation arms: ${populatedArms}/${ROLE_ISOLATION_ARMS.length}`);
    console.log(`Role-isolation diagnosis: ${roleIsolationSummary.diagnosis.status}`);
  }
  console.log(`Question-flood gate: ${data.questionFloodGate.status}`);
  if (!checkOnly) console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  if (errors.length) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

main();
