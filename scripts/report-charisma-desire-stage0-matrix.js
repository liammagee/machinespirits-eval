#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCENARIO_PATH = path.join(ROOT, 'config', 'charisma-recognition-desire-scenarios.yaml');
const TUTOR_AGENTS_PATH = path.join(ROOT, 'config', 'tutor-agents.yaml');
const EVALUATION_RUNNER_PATH = path.join(ROOT, 'services', 'evaluationRunner.js');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-stage0-matrix-sanity.md');

const PILOT_SCENARIOS = [
  'charisma_desire_authority_withheld',
  'charisma_desire_status_challenge',
  'charisma_desire_conceptual_control',
  'charisma_desire_vulnerability_shift',
  'charisma_desire_ai_syllabus_transfer',
  'charisma_desire_plain_language_stress',
];

const ROBUSTNESS_ONLY_SCENARIOS = ['charisma_desire_partial_uptake'];

const PILOT_PROFILES = [
  'cell_169_id_director_charisma_accountable_bid_clean_floor_verified',
  'cell_163_id_director_charisma_agency_return_warm_floor_verified',
  'cell_104_recog_id_director_charisma_register',
  'cell_107_id_director_witness_exemplars',
];

const RUNS_PER_PROFILE_SCENARIO = 3;

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validatePhraseList(scenarioId, owner, name, value, errors) {
  assert(Array.isArray(value), `${scenarioId} ${owner}.${name} must be an array`, errors);
  if (!Array.isArray(value)) return;
  assert(value.length > 0, `${scenarioId} ${owner}.${name} must not be empty`, errors);
  for (const phrase of value) {
    assert(
      typeof phrase === 'string' && phrase.trim().length > 0,
      `${scenarioId} ${owner}.${name} contains a blank/non-string phrase`,
      errors,
    );
  }
}

function contentPathForRef(contentRef, courseIds = []) {
  const match = /^(.+)-lecture-(\d+)$/.exec(contentRef || '');
  if (!match) return null;
  const [, courseId, lectureNumber] = match;
  if (courseIds.length > 0 && !courseIds.includes(courseId)) return null;
  return path.join(ROOT, 'content', 'courses', courseId, `lecture-${lectureNumber}.md`);
}

function validateScenario(id, scenario, errors) {
  assert(scenario?.id === id, `${id} must repeat its key in the id field`, errors);
  assert(scenario?.type === 'suggestion', `${id} must be a suggestion scenario`, errors);
  assert(scenario?.charisma_desire_test === true, `${id} must set charisma_desire_test: true`, errors);
  assert(
    typeof scenario?.learner_context === 'string' && scenario.learner_context.trim().length > 0,
    `${id} must include learner_context`,
    errors,
  );
  assert(
    typeof scenario?.expected_behavior === 'string' && scenario.expected_behavior.trim().length > 0,
    `${id} must include expected_behavior`,
    errors,
  );
  validatePhraseList(id, 'scenario', 'required_elements_any', scenario?.required_elements_any, errors);
  validatePhraseList(id, 'scenario', 'forbidden_elements', scenario?.forbidden_elements, errors);

  for (const courseId of scenario?.course_ids || []) {
    const courseDir = path.join(ROOT, 'content', 'courses', courseId);
    assert(fs.existsSync(courseDir), `${id} references missing course directory ${courseDir}`, errors);
  }

  const contentPath = contentPathForRef(scenario?.current_content, scenario?.course_ids || []);
  assert(Boolean(contentPath), `${id} has unsupported current_content ${scenario?.current_content}`, errors);
  if (contentPath) {
    assert(fs.existsSync(contentPath), `${id} references missing content file ${contentPath}`, errors);
  }

  for (const turn of scenario?.turns || []) {
    assert(typeof turn.id === 'string' && turn.id.length > 0, `${id} has a turn without id`, errors);
    assert(
      typeof turn.expected_behavior === 'string' && turn.expected_behavior.trim().length > 0,
      `${id} ${turn.id} must include expected_behavior`,
      errors,
    );
    validatePhraseList(id, turn.id, 'required_elements_any', turn.required_elements_any, errors);
    validatePhraseList(id, turn.id, 'forbidden_elements', turn.forbidden_elements, errors);
  }
}

function buildRunCommand() {
  const scenarioList = PILOT_SCENARIOS.join(',');
  const profileList = PILOT_PROFILES.join(',');
  return [
    'ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \\',
    'ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \\',
    'EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \\',
    '  node scripts/eval-cli.js run \\',
    `  --profiles ${profileList} \\`,
    `  --scenario ${scenarioList} \\`,
    `  --runs ${RUNS_PER_PROFILE_SCENARIO} \\`,
    '  --parallelism 2 \\',
    '  --ego-model codex.gpt-5.5 \\',
    '  --superego-model claude-code.sonnet-4-6 \\',
    '  --skip-rubric \\',
    '  --description "Stage 1 charisma desire generalizability pilot"',
  ].join('\n');
}

function buildScoringCommands() {
  return [
    'node scripts/eval-cli.js evaluate <runId> --judge-cli codex',
    'node scripts/evaluate-charisma.js <runId> --judge claude-code.sonnet',
  ].join('\n');
}

function markdownList(values) {
  return values.map((value) => `- \`${value}\``).join('\n');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const errors = [];
  const scenarioData = readYaml(SCENARIO_PATH);
  const tutorAgents = readYaml(TUTOR_AGENTS_PATH);
  const evaluationRunnerSource = fs.readFileSync(EVALUATION_RUNNER_PATH, 'utf8');
  const scenarioMap = scenarioData?.scenarios || {};
  const profileMap = tutorAgents?.profiles || {};

  for (const scenarioId of PILOT_SCENARIOS) {
    const scenario = scenarioMap[scenarioId];
    assert(Boolean(scenario), `Missing pilot scenario ${scenarioId}`, errors);
    if (!scenario) continue;
    assert(scenario.stage0_pilot === true, `${scenarioId} must set stage0_pilot: true`, errors);
    validateScenario(scenarioId, scenario, errors);
  }

  for (const scenarioId of ROBUSTNESS_ONLY_SCENARIOS) {
    const scenario = scenarioMap[scenarioId];
    assert(Boolean(scenario), `Missing robustness-only scenario ${scenarioId}`, errors);
    if (!scenario) continue;
    assert(scenario.stage0_pilot !== true, `${scenarioId} must remain out of the Stage 0 pilot decision grid`, errors);
    validateScenario(scenarioId, scenario, errors);
  }

  for (const profileName of PILOT_PROFILES) {
    assert(Boolean(profileMap[profileName]), `Missing tutor profile ${profileName}`, errors);
    assert(
      evaluationRunnerSource.includes(profileName),
      `Profile ${profileName} is not registered in services/evaluationRunner.js`,
      errors,
    );
  }

  const totalRows = PILOT_SCENARIOS.length * PILOT_PROFILES.length * RUNS_PER_PROFILE_SCENARIO;
  const generatedFixture = 'config/drama-derivation/world-016-ai-syllabus-af1.yaml';
  const aiSyllabusScenario = scenarioMap.charisma_desire_ai_syllabus_transfer;
  assert(
    aiSyllabusScenario?.learner_context?.includes('campus FAQ'),
    'AI syllabus transfer scenario must reference the generated campus FAQ fixture context',
    errors,
  );

  const status = errors.length === 0 ? 'PASS' : 'FAIL';
  const report = `# Charisma Desire Stage 0 Matrix Sanity

Generated: ${new Date().toISOString()}

Status: ${status}

## Matrix

- Scenario file: \`config/charisma-recognition-desire-scenarios.yaml\`
- Pilot scenarios: ${PILOT_SCENARIOS.length}
- Pilot profiles: ${PILOT_PROFILES.length}
- Runs per profile-scenario: ${RUNS_PER_PROFILE_SCENARIO}
- Total planned rows: ${totalRows}

## Pilot Scenarios

${markdownList(PILOT_SCENARIOS)}

## Robustness-Only Scenarios

${markdownList(ROBUSTNESS_ONLY_SCENARIOS)}

\`charisma_desire_partial_uptake\` is intentionally excluded from the primary decision grid because it mixes recognition-theory content, Hayles/AI-cognition content, and learner uptake of a tutor phrase.

## Pilot Profiles

${markdownList(PILOT_PROFILES)}

## AI Material Routing

- Transfer scenario: \`charisma_desire_ai_syllabus_transfer\`
- Standard content: \`content/courses/479/lecture-8.md\`
- Recent generated fixture context: \`${generatedFixture}\`
- Boundary: this is a generated-AI-material transfer check inside the available 479 course corpus, not yet a separate non-479 curriculum transfer.

## Planned Stage 1 Command

\`\`\`bash
${buildRunCommand()}
\`\`\`

## Planned Stage 1 Scoring

\`\`\`bash
${buildScoringCommands()}
\`\`\`

## Validation

${errors.length === 0 ? '- No validation errors.' : errors.map((error) => `- ${error}`).join('\n')}
`;

  if (!checkOnly) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, report);
  }

  console.log(`Status: ${status}`);
  console.log(`Total planned rows: ${totalRows}`);
  if (!checkOnly) console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

main();
