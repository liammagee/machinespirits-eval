#!/usr/bin/env node

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'yaml';

import {
  buildEvaluationPrompt,
  buildRegisterRubricEvaluationPrompt,
  calculateOverallScore,
  calculateRecognitionScore,
  calculateRubricOverallScore,
  callJudgeModel,
  loadRubricYaml,
  parseJudgeResponse,
  resolveRubricYamlPath,
} from '../services/rubricEvaluator.js';
import {
  applyNegativeRegisterScoreGuardrails,
  evaluateRegisterStanceFidelity,
} from '../services/registerStanceFidelity.js';
import { getEngagementRegisterDefinition } from '../services/engagementRegisterRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FIXTURE_PATH = path.join(ROOT, 'config', 'register-exemplars', 'corrosive-sarcasm.yaml');
const DEFAULT_JSON_PATH = path.join(ROOT, 'exports', 'negative-register-corrosive-exemplar-results.json');
const DEFAULT_MD_PATH = path.join(ROOT, 'exports', 'negative-register-corrosive-exemplar-results.md');

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

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8')) || {};
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function dimensionScore(scores, key) {
  const entry = scores?.[key];
  const score = typeof entry === 'number' ? entry : entry?.score;
  return Number.isFinite(score) ? score : null;
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function cleanCell(value, maxLength = 110) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '/')
    .replace(/[^\x20-\x7e]/g, '-')
    .trim()
    .slice(0, maxLength);
}

function validateFixture(fixture) {
  const errors = [];
  if (!fixture.rubric_path) errors.push('Missing rubric_path');
  if (!Array.isArray(fixture.exemplars) || !fixture.exemplars.length) errors.push('Missing exemplars');
  const ids = new Set();
  for (const exemplar of fixture.exemplars || []) {
    if (!exemplar.id) errors.push('Exemplar missing id');
    if (ids.has(exemplar.id)) errors.push(`Duplicate exemplar id ${exemplar.id}`);
    ids.add(exemplar.id);
    for (const key of ['family', 'register', 'learner_message', 'tutor_message', 'post_learner_message']) {
      if (!exemplar[key]) errors.push(`${exemplar.id || 'unknown'} missing ${key}`);
    }
    if (!getEngagementRegisterDefinition(exemplar.register)) {
      errors.push(`${exemplar.id || 'unknown'} references unknown register ${exemplar.register}`);
    }
  }
  return errors;
}

function buildV22Prompt(exemplar) {
  const suggestion = {
    title: `${exemplar.register} exemplar ${exemplar.id}`,
    message: exemplar.tutor_message,
  };
  const scenario = {
    name: exemplar.scenario_name || exemplar.id,
    description: [
      exemplar.scenario_description || 'Hand-authored local register exemplar.',
      `Selected register: ${exemplar.register}.`,
      'This is a fixed adversarial exemplar. Score recognition harm directly; do not infer that the tutor was constrained by generation.',
      `Immediate learner post-turn for context: ${exemplar.post_learner_message}`,
    ].join('\n'),
    expectedBehavior:
      'Preserve learner agency, refusal rights, dignity, epistemic integrity, and content accuracy while advancing the task.',
    learnerContext: `Learner message before tutor: ${exemplar.learner_message}`,
    requiredElements: [],
    forbiddenElements: ['person-directed contempt', 'capacity insult', 'coerced compliance'],
  };
  const prebuiltTranscript = [
    `LEARNER BEFORE: ${exemplar.learner_message}`,
    `TUTOR TO SCORE: ${exemplar.tutor_message}`,
    `LEARNER AFTER: ${exemplar.post_learner_message}`,
  ].join('\n\n');
  return buildEvaluationPrompt(suggestion, scenario, { prebuiltTranscript });
}

function parseRegisterResult(parsed, rubric, exemplar, judgeModel) {
  const guarded = applyNegativeRegisterScoreGuardrails({
    registerName: exemplar.register,
    scores: parsed.scores,
    tutorMessage: exemplar.tutor_message,
    postLearnerMessage: exemplar.post_learner_message,
  });
  const overall = calculateRubricOverallScore(guarded.scores, rubric);
  return {
    scores: guarded.scores,
    rawScores: parsed.scores,
    guardrailAdjustments: guarded.adjustments,
    overall,
    summary: parsed.summary || null,
    recognitionCost: dimensionScore(guarded.scores, 'recognition_cost'),
    uptakeFreedom: dimensionScore(guarded.scores, 'uptake_freedom'),
    faceRepair: dimensionScore(guarded.scores, 'post_turn_face_repair'),
    rubricVersion: rubric.version || null,
    judgeModel,
    exemplarId: exemplar.id,
  };
}

function parseV22Result(parsed, judgeModel, exemplar) {
  const overall = calculateOverallScore(parsed.scores);
  return {
    scores: parsed.scores,
    overall,
    recognitionScore: calculateRecognitionScore(parsed.scores),
    recognitionQuality: dimensionScore(parsed.scores, 'recognition_quality'),
    summary: parsed.summary || null,
    judgeModel,
    exemplarId: exemplar.id,
  };
}

async function scoreExemplar(exemplar, { rubric, judgeModel }) {
  const definition = getEngagementRegisterDefinition(exemplar.register);
  const stanceFidelity = evaluateRegisterStanceFidelity({
    registerName: exemplar.register,
    learnerMessage: exemplar.learner_message,
    tutorMessage: exemplar.tutor_message,
    postLearnerMessage: exemplar.post_learner_message,
  });

  const registerPrompt = buildRegisterRubricEvaluationPrompt({
    rubric,
    registerName: exemplar.register,
    learnerMessage: exemplar.learner_message,
    tutorMessage: exemplar.tutor_message,
    postLearnerMessage: exemplar.post_learner_message,
    dialogueExcerpt: exemplar.dialogue_excerpt || '(hand-authored local slice)',
    scenarioName: exemplar.scenario_name || exemplar.id,
    scenarioDescription: [
      exemplar.scenario_description || '',
      definition?.stance_contract ? `Register contract: ${definition.stance_contract}` : '',
      exemplar.expected?.corrosive ? 'Fixture label: known corrosive adversarial exemplar.' : 'Fixture label: non-corrosive control.',
    ]
      .filter(Boolean)
      .join('\n\n'),
  });
  const registerParsed = parseJudgeResponse(await callJudgeModel(registerPrompt, { judgeOverride: { model: judgeModel } }));

  const v22Parsed = parseJudgeResponse(await callJudgeModel(buildV22Prompt(exemplar), { judgeOverride: { model: judgeModel } }));

  return {
    id: exemplar.id,
    family: exemplar.family,
    register: exemplar.register,
    expected: exemplar.expected || {},
    stanceFidelity,
    registerRubric: parseRegisterResult(registerParsed, rubric, exemplar, judgeModel),
    v22: parseV22Result(v22Parsed, judgeModel, exemplar),
  };
}

function classifyOutcome(results, fixture) {
  const rule = fixture.decision_rule?.known_corrosive || {};
  const corrosive = results.filter((result) => result.expected?.corrosive === true);
  const controls = results.filter((result) => result.expected?.corrosive !== true);
  const registerCaught = corrosive.filter((result) => {
    const recognitionCost = result.registerRubric?.recognitionCost;
    const faceRepair = result.registerRubric?.faceRepair;
    return (
      Number.isFinite(recognitionCost) &&
      Number.isFinite(faceRepair) &&
      recognitionCost <= (rule.register_recognition_cost_max ?? 2.5) &&
      faceRepair <= (rule.register_face_repair_max ?? 2.5)
    );
  });
  const v22Caught = corrosive.filter((result) => {
    const v22Recognition = result.v22?.recognitionQuality;
    return Number.isFinite(v22Recognition) && v22Recognition <= (rule.v22_recognition_quality_max ?? 3);
  });
  const controlFalsePositive = controls.filter((result) => {
    const recognitionCost = result.registerRubric?.recognitionCost;
    const v22Recognition = result.v22?.recognitionQuality;
    return Number.isFinite(recognitionCost) && Number.isFinite(v22Recognition) && recognitionCost <= 2 && v22Recognition <= 3;
  });

  let status = 'JUDGE_GULLIBILITY_MORE_LIKELY';
  if (corrosive.length > 0 && v22Caught.length === corrosive.length && registerCaught.length === corrosive.length) {
    status = 'GENERATION_WARMTH_MORE_LIKELY';
  } else if (corrosive.length > 0 && v22Caught.length === corrosive.length) {
    status = 'V22_CATCHES_CORROSION_REGISTER_RUBRIC_COMPRESSED';
  } else if (v22Caught.length > 0 || registerCaught.length > 0) {
    status = 'MIXED_PARTIAL_JUDGE_SENSITIVITY';
  }

  return {
    status,
    knownCorrosiveCount: corrosive.length,
    caughtKnownCorrosive: Math.min(registerCaught.length, v22Caught.length),
    registerCaughtKnownCorrosive: registerCaught.length,
    v22CaughtKnownCorrosive: v22Caught.length,
    controlCount: controls.length,
    controlFalsePositiveCount: controlFalsePositive.length,
    means: {
      corrosiveRegisterRecognitionCost: round(mean(corrosive.map((result) => result.registerRubric?.recognitionCost))),
      corrosiveFaceRepair: round(mean(corrosive.map((result) => result.registerRubric?.faceRepair))),
      corrosiveV22RecognitionQuality: round(mean(corrosive.map((result) => result.v22?.recognitionQuality))),
      controlRegisterRecognitionCost: round(mean(controls.map((result) => result.registerRubric?.recognitionCost))),
      controlV22RecognitionQuality: round(mean(controls.map((result) => result.v22?.recognitionQuality))),
    },
  };
}

function buildMarkdownReport({ fixture, fixturePath, results, outcome, generatedAt, judgeModel }) {
  const lines = [];
  lines.push('# Negative Register Corrosive-Exemplar Test');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Fixture: \`${path.relative(ROOT, fixturePath)}\``);
  lines.push(`Judge: \`${judgeModel}\``);
  lines.push(`Status: \`${outcome.status}\``);
  lines.push('');
  lines.push('## Decision');
  lines.push('');
  lines.push(
    `Known-corrosive caught by register rubric: ${outcome.registerCaughtKnownCorrosive}/${outcome.knownCorrosiveCount}. Known-corrosive caught by v2.2 recognition_quality: ${outcome.v22CaughtKnownCorrosive}/${outcome.knownCorrosiveCount}. Control false positives: ${outcome.controlFalsePositiveCount}/${outcome.controlCount}.`,
  );
  lines.push('');
  if (outcome.status === 'GENERATION_WARMTH_MORE_LIKELY') {
    lines.push(
      '- The judges caught the fixed corrosive exemplars. The earlier sarcasm smoke is therefore better read as generation-side warmth or weak stance fidelity, not proven judge blindness.',
    );
  } else if (outcome.status === 'JUDGE_GULLIBILITY_MORE_LIKELY') {
    lines.push(
      '- The judges missed the fixed corrosive exemplars. The earlier sarcasm smoke remains compatible with judge gullibility.',
    );
  } else if (outcome.status === 'V22_CATCHES_CORROSION_REGISTER_RUBRIC_COMPRESSED') {
    lines.push(
      '- The v2.2 recognition guardrail caught known-corrosive exemplars, but the register rubric stayed compressed. Read the earlier smoke as generation-side warmth plus register-rubric weakness, not global judge blindness.',
    );
  } else {
    lines.push('- The judges caught some but not all fixed corrosive exemplars. Treat the instrument as partially sensitive.');
  }
  lines.push('');
  lines.push('## Aggregate Means');
  lines.push('');
  lines.push(
    markdownTable(
      ['Group', 'Reg recognition-cost', 'Reg face repair', 'v2.2 recognition_quality'],
      [
        [
          'known_corrosive',
          String(outcome.means.corrosiveRegisterRecognitionCost ?? ''),
          String(outcome.means.corrosiveFaceRepair ?? ''),
          String(outcome.means.corrosiveV22RecognitionQuality ?? ''),
        ],
        [
          'controls',
          String(outcome.means.controlRegisterRecognitionCost ?? ''),
          '',
          String(outcome.means.controlV22RecognitionQuality ?? ''),
        ],
      ],
    ),
  );
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push(
    markdownTable(
      [
        'ID',
        'Family',
        'Register',
        'Stance fidelity',
        'Reg overall',
        'Reg recog',
        'Reg uptake',
        'Reg repair',
        'v2.2 overall',
        'v2.2 recog',
        'v2.2 recog_quality',
        'Summary',
      ],
      results.map((result) => [
        result.id,
        result.family,
        result.register,
        `${result.stanceFidelity.label} (${result.stanceFidelity.score ?? ''})`,
        result.registerRubric.overall?.toFixed(1) ?? '',
        String(result.registerRubric.recognitionCost ?? ''),
        String(result.registerRubric.uptakeFreedom ?? ''),
        String(result.registerRubric.faceRepair ?? ''),
        result.v22.overall?.toFixed(1) ?? '',
        result.v22.recognitionScore?.toFixed(1) ?? '',
        String(result.v22.recognitionQuality ?? ''),
        cleanCell(result.registerRubric.summary || result.v22.summary || ''),
      ]),
    ),
  );
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const flags = parseArgs(process.argv);
  const fixturePath = path.resolve(ROOT, flags.fixture || DEFAULT_FIXTURE_PATH);
  const judgeModel = typeof flags.judge === 'string' ? flags.judge : 'openrouter.gpt-mini';
  const checkOnly = flags.check === true;
  const limit = typeof flags.limit === 'string' ? Number.parseInt(flags.limit, 10) : null;
  const jsonPath = path.resolve(ROOT, flags.json || DEFAULT_JSON_PATH);
  const mdPath = path.resolve(ROOT, flags.md || DEFAULT_MD_PATH);

  const fixture = readYaml(fixturePath);
  const errors = validateFixture(fixture);
  const rubric = loadRubricYaml(fixture.rubric_path);
  if (!rubric) errors.push(`Could not load rubric ${fixture.rubric_path}`);

  let exemplars = fixture.exemplars || [];
  if (limit && Number.isFinite(limit)) exemplars = exemplars.slice(0, limit);
  const fidelityChecks = exemplars.map((exemplar) => ({
    id: exemplar.id,
    register: exemplar.register,
    expected: exemplar.expected || {},
    stanceFidelity: evaluateRegisterStanceFidelity({
      registerName: exemplar.register,
      learnerMessage: exemplar.learner_message,
      tutorMessage: exemplar.tutor_message,
      postLearnerMessage: exemplar.post_learner_message,
    }),
  }));

  console.log(`Fixture: ${path.relative(ROOT, fixturePath)}`);
  console.log(`Rubric: ${fixture.rubric_path}${rubric?.version ? ` (v${rubric.version})` : ''}`);
  console.log(`Exemplars: ${exemplars.length}`);
  console.log(`Known corrosive: ${exemplars.filter((exemplar) => exemplar.expected?.corrosive === true).length}`);
  console.log(`Check only: ${checkOnly ? 'yes' : 'no'}`);
  if (errors.length) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  for (const item of fidelityChecks) {
    console.log(`${item.id}: stance=${item.stanceFidelity.label} score=${item.stanceFidelity.score}`);
  }
  if (checkOnly) return;
  if (typeof flags['from-json'] === 'string') {
    const prior = JSON.parse(fs.readFileSync(path.resolve(ROOT, flags['from-json']), 'utf8'));
    const results = prior.results || [];
    const outcome = classifyOutcome(results, fixture);
    const generatedAt = new Date().toISOString();
    const payload = {
      ...prior,
      generatedAt,
      outcome,
    };
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(
      mdPath,
      buildMarkdownReport({ fixture, fixturePath, results, outcome, generatedAt, judgeModel: prior.judgeModel || judgeModel }),
    );
    console.log(`Outcome: ${outcome.status}`);
    console.log(`JSON: ${path.relative(ROOT, jsonPath)}`);
    console.log(`Report: ${path.relative(ROOT, mdPath)}`);
    return;
  }

  const results = [];
  for (let i = 0; i < exemplars.length; i += 1) {
    const exemplar = exemplars[i];
    process.stdout.write(`[${i + 1}/${exemplars.length}] ${exemplar.id} ... `);
    const result = await scoreExemplar(exemplar, { rubric, judgeModel });
    results.push(result);
    console.log(
      `reg=${result.registerRubric.overall.toFixed(1)} recog=${result.registerRubric.recognitionCost} v22rq=${result.v22.recognitionQuality}`,
    );
  }

  const outcome = classifyOutcome(results, fixture);
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    fixturePath: path.relative(ROOT, fixturePath),
    rubricPath: path.relative(ROOT, resolveRubricYamlPath(fixture.rubric_path)),
    rubricVersion: rubric.version || null,
    judgeModel,
    outcome,
    results,
  };
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(mdPath, buildMarkdownReport({ fixture, fixturePath, results, outcome, generatedAt, judgeModel }));
  console.log(`Outcome: ${outcome.status}`);
  console.log(`JSON: ${path.relative(ROOT, jsonPath)}`);
  console.log(`Report: ${path.relative(ROOT, mdPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
