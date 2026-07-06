#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

import { routeEngagementMode } from '../services/engagementModeRouter.js';
import { resolveEngagementRegister } from '../services/engagementRegisterRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCENARIO_PATH = path.join(ROOT, 'config', 'charisma-recognition-desire-scenarios.yaml');
const TUTOR_AGENTS_PATH = path.join(ROOT, 'config', 'tutor-agents.yaml');
const EVALUATION_RUNNER_PATH = path.join(ROOT, 'services', 'evaluationRunner.js');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-router-stage0-sanity.md');
const ROUTER_PROFILE = 'cell_180_id_director_charisma_engagement_router_verified';
const REPAIR_PROFILE = 'cell_181_id_director_charisma_engagement_router_contract_repair_verified';
const SPLIT_REPAIR_PROFILE = 'cell_182_id_director_charisma_engagement_router_split_repair_verified';
const TRANSFER_STAKE_PROFILE = 'cell_183_id_director_charisma_engagement_router_transfer_stake_repair_verified';
const TRANSFER_COMPRESSION_PROFILE =
  'cell_184_id_director_charisma_engagement_router_transfer_compression_guard_verified';
const DYNAMIC_BREAKTHROUGH_PROFILE = 'cell_185_id_director_charisma_resistance_breakthrough_dynamic_verified';

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractInitialLearnerMessage(scenario) {
  const context = scenario?.learner_context || '';
  const match = context.match(/-\s*User:\s*"([^"]+)"/);
  return match?.[1] || '';
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function buildCases(scenarios) {
  const breakthroughProbe = scenarios.charisma_desire_resistance_breakthrough_probe;
  const resistanceGateCases = (breakthroughProbe?.resistance_signal_gate || []).map((gate) => ({
    scenarioId: 'charisma_desire_resistance_breakthrough_probe',
    turn: `gate_${gate.id}`,
    expectedRegister: gate.expected_register || 'charismatic_challenge',
    expectedResistanceSignal: gate.expected_resistance_signal || gate.id,
    message: gate.message || '',
    modeHistory: ['scaffolding'],
  }));

  return [
    {
      scenarioId: 'charisma_desire_authority_withheld',
      turn: 'initial',
      expectedRegister: 'accountable_bid_authority',
      message: extractInitialLearnerMessage(scenarios.charisma_desire_authority_withheld),
    },
    {
      scenarioId: 'charisma_desire_status_challenge',
      turn: 'initial',
      expectedRegister: 'accountable_bid_authority',
      message: extractInitialLearnerMessage(scenarios.charisma_desire_status_challenge),
    },
    {
      scenarioId: 'charisma_desire_status_challenge',
      turn: 'turn_1_accountability_demand',
      expectedRegister: 'plain_compression',
      message:
        scenarios.charisma_desire_status_challenge?.turns?.find((turn) => turn.id === 'turn_1_accountability_demand')
          ?.action_details?.message || '',
      modeHistory: ['accountable_bid_authority'],
    },
    {
      scenarioId: 'charisma_desire_conceptual_control',
      turn: 'initial',
      expectedRegister: 'clarity',
      message: extractInitialLearnerMessage(scenarios.charisma_desire_conceptual_control),
    },
    {
      scenarioId: 'charisma_desire_vulnerability_shift',
      turn: 'initial',
      expectedRegister: 'witnessing_restraint',
      message: extractInitialLearnerMessage(scenarios.charisma_desire_vulnerability_shift),
    },
    {
      scenarioId: 'charisma_desire_ai_syllabus_transfer',
      turn: 'initial',
      expectedRegister: 'transfer_grounding',
      message: extractInitialLearnerMessage(scenarios.charisma_desire_ai_syllabus_transfer),
      curriculumContext: scenarios.charisma_desire_ai_syllabus_transfer?.learner_context || '',
    },
    {
      scenarioId: 'charisma_desire_ai_syllabus_transfer',
      turn: 'turn_1_problem_formulation_case',
      expectedRegister: 'transfer_grounding',
      message:
        scenarios.charisma_desire_ai_syllabus_transfer?.turns?.find(
          (turn) => turn.id === 'turn_1_problem_formulation_case',
        )?.action_details?.message || '',
      modeHistory: ['transfer_grounding'],
      curriculumContext: scenarios.charisma_desire_ai_syllabus_transfer?.learner_context || '',
    },
    {
      scenarioId: 'charisma_desire_plain_language_stress',
      turn: 'initial',
      expectedRegister: 'plain_compression',
      message: extractInitialLearnerMessage(scenarios.charisma_desire_plain_language_stress),
    },
    {
      scenarioId: 'charisma_desire_plain_language_stress',
      turn: 'turn_1_plain_check',
      expectedRegister: 'lived_stakes_reentry',
      message:
        scenarios.charisma_desire_plain_language_stress?.turns?.find((turn) => turn.id === 'turn_1_plain_check')
          ?.action_details?.message || '',
      modeHistory: ['plain_compression'],
    },
    {
      scenarioId: 'charisma_desire_instruction_to_engagement_switch',
      turn: 'initial',
      expectedRegister: 'scaffolding',
      message: extractInitialLearnerMessage(scenarios.charisma_desire_instruction_to_engagement_switch),
    },
    {
      scenarioId: 'charisma_desire_instruction_to_engagement_switch',
      turn: 'turn_1_instruction_feels_dead',
      expectedRegister: 'charismatic_challenge',
      message:
        scenarios.charisma_desire_instruction_to_engagement_switch?.turns?.find(
          (turn) => turn.id === 'turn_1_instruction_feels_dead',
        )?.action_details?.message || '',
      modeHistory: ['scaffolding'],
    },
    {
      scenarioId: 'charisma_desire_resistance_breakthrough_probe',
      turn: 'initial',
      expectedRegister: 'scaffolding',
      message: extractInitialLearnerMessage(scenarios.charisma_desire_resistance_breakthrough_probe),
    },
    {
      scenarioId: 'charisma_desire_resistance_breakthrough_probe',
      turn: 'turn_1_resistant_boredom_frustration',
      expectedRegister: 'charismatic_challenge',
      expectedResistanceSignal: 'frustration',
      message:
        scenarios.charisma_desire_resistance_breakthrough_probe?.turns?.find(
          (turn) => turn.id === 'turn_1_resistant_boredom_frustration',
        )?.action_details?.message || '',
      modeHistory: ['scaffolding'],
    },
    ...resistanceGateCases,
  ];
}

function buildSmokeCommand() {
  return [
    'ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \\',
    'ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \\',
    'EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \\',
    '  node scripts/eval-cli.js run \\',
    `  --profiles ${ROUTER_PROFILE} \\`,
    '  --scenario charisma_desire_authority_withheld,charisma_desire_status_challenge,charisma_desire_ai_syllabus_transfer,charisma_desire_plain_language_stress,charisma_desire_instruction_to_engagement_switch,charisma_desire_resistance_breakthrough_probe \\',
    '  --runs 1 \\',
    '  --parallelism 1 \\',
    '  --ego-model codex.gpt-5.5 \\',
    '  --superego-model claude-code.sonnet-4-6 \\',
    '  --skip-rubric \\',
    '  --description "Charisma desire engagement router smoke"',
  ].join('\n');
}

function buildRepairSmokeCommand() {
  return [
    'ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \\',
    'ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \\',
    'EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \\',
    '  node scripts/eval-cli.js run \\',
    `  --profiles ${REPAIR_PROFILE} \\`,
    '  --scenario charisma_desire_ai_syllabus_transfer,charisma_desire_instruction_to_engagement_switch \\',
    '  --runs 1 \\',
    '  --parallelism 1 \\',
    '  --ego-model codex.gpt-5.5 \\',
    '  --superego-model claude-code.sonnet-4-6 \\',
    '  --skip-rubric \\',
    '  --description "Charisma desire router contract-repair smoke"',
  ].join('\n');
}

function buildSplitRepairSmokeCommand() {
  return [
    'ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \\',
    'ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \\',
    'EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \\',
    '  node scripts/eval-cli.js run \\',
    `  --profiles ${SPLIT_REPAIR_PROFILE} \\`,
    '  --scenario charisma_desire_ai_syllabus_transfer,charisma_desire_instruction_to_engagement_switch \\',
    '  --runs 1 \\',
    '  --parallelism 1 \\',
    '  --ego-model codex.gpt-5.5 \\',
    '  --superego-model claude-code.sonnet-4-6 \\',
    '  --skip-rubric \\',
    '  --description "Charisma desire router split-repair smoke"',
  ].join('\n');
}

function buildTransferStakeSmokeCommand() {
  return [
    'ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \\',
    'ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \\',
    'EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \\',
    '  node scripts/eval-cli.js run \\',
    `  --profiles ${TRANSFER_STAKE_PROFILE} \\`,
    '  --scenario charisma_desire_ai_syllabus_transfer,charisma_desire_instruction_to_engagement_switch \\',
    '  --runs 1 \\',
    '  --parallelism 1 \\',
    '  --ego-model codex.gpt-5.5 \\',
    '  --superego-model claude-code.sonnet-4-6 \\',
    '  --skip-rubric \\',
    '  --description "Charisma desire router transfer-stake smoke"',
  ].join('\n');
}

function buildTransferCompressionSmokeCommand() {
  return [
    'ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \\',
    'ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \\',
    'EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \\',
    '  node scripts/eval-cli.js run \\',
    `  --profiles ${TRANSFER_COMPRESSION_PROFILE} \\`,
    '  --scenario charisma_desire_ai_syllabus_transfer,charisma_desire_instruction_to_engagement_switch \\',
    '  --runs 1 \\',
    '  --parallelism 1 \\',
    '  --ego-model codex.gpt-5.5 \\',
    '  --superego-model claude-code.sonnet-4-6 \\',
    '  --skip-rubric \\',
    '  --description "Charisma desire router transfer-compression smoke"',
  ].join('\n');
}

function buildDynamicBreakthroughSmokeCommand() {
  return [
    'CLI_PROVIDER_CLAUDE_TIMEOUT_MS=600000 \\',
    'CLI_PROVIDER_CODEX_TIMEOUT_MS=600000 \\',
    'ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000 \\',
    'ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000 \\',
    'EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \\',
    '  node scripts/eval-cli.js run \\',
    `  --profiles ${DYNAMIC_BREAKTHROUGH_PROFILE} \\`,
    '  --scenario charisma_desire_resistance_breakthrough_probe \\',
    '  --runs 1 \\',
    '  --parallelism 1 \\',
    '  --ego-model codex.gpt-5.5 \\',
    '  --superego-model codex.gpt-5.5 \\',
    '  --learner-model codex.gpt-5.5 \\',
    '  --learner-ego-model codex.gpt-5.5 \\',
    '  --learner-superego-model codex.gpt-5.5 \\',
    '  --skip-rubric \\',
    '  --description "Charisma desire dynamic learner resistance-breakthrough smoke codex-only"',
  ].join('\n');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const scenarioData = readYaml(SCENARIO_PATH);
  const tutorAgents = readYaml(TUTOR_AGENTS_PATH);
  const evaluationRunnerSource = fs.readFileSync(EVALUATION_RUNNER_PATH, 'utf8');
  const scenarios = scenarioData?.scenarios || {};
  const profile = tutorAgents?.profiles?.[ROUTER_PROFILE];
  const repairProfile = tutorAgents?.profiles?.[REPAIR_PROFILE];
  const splitRepairProfile = tutorAgents?.profiles?.[SPLIT_REPAIR_PROFILE];
  const transferStakeProfile = tutorAgents?.profiles?.[TRANSFER_STAKE_PROFILE];
  const transferCompressionProfile = tutorAgents?.profiles?.[TRANSFER_COMPRESSION_PROFILE];
  const dynamicBreakthroughProfile = tutorAgents?.profiles?.[DYNAMIC_BREAKTHROUGH_PROFILE];
  const errors = [];

  if (!profile) {
    errors.push(`Missing router profile ${ROUTER_PROFILE}`);
  } else {
    if (profile.factors?.engagement_mode_router !== true) {
      errors.push(`${ROUTER_PROFILE} must set factors.engagement_mode_router: true`);
    }
    if (profile.factors?.agency_return_charisma_floor_mode !== 'accountable_bid_clean') {
      errors.push(`${ROUTER_PROFILE} must keep accountable_bid_clean as fallback floor`);
    }
  }
  if (!evaluationRunnerSource.includes(ROUTER_PROFILE)) {
    errors.push(`${ROUTER_PROFILE} is not registered in services/evaluationRunner.js`);
  }
  if (!repairProfile) {
    errors.push(`Missing repair profile ${REPAIR_PROFILE}`);
  } else {
    if (repairProfile.factors?.engagement_mode_router !== true) {
      errors.push(`${REPAIR_PROFILE} must set factors.engagement_mode_router: true`);
    }
    if (repairProfile.factors?.id_output_contract !== 'strict_compact_json') {
      errors.push(`${REPAIR_PROFILE} must set factors.id_output_contract: strict_compact_json`);
    }
    if (repairProfile.factors?.engagement_router_charisma_repair !== true) {
      errors.push(`${REPAIR_PROFILE} must set factors.engagement_router_charisma_repair: true`);
    }
    if (repairProfile.factors?.agency_return_charisma_floor_mode !== 'accountable_bid_clean') {
      errors.push(`${REPAIR_PROFILE} must keep accountable_bid_clean as fallback floor`);
    }
  }
  if (!evaluationRunnerSource.includes(REPAIR_PROFILE)) {
    errors.push(`${REPAIR_PROFILE} is not registered in services/evaluationRunner.js`);
  }
  if (!splitRepairProfile) {
    errors.push(`Missing split repair profile ${SPLIT_REPAIR_PROFILE}`);
  } else {
    if (splitRepairProfile.factors?.engagement_mode_router !== true) {
      errors.push(`${SPLIT_REPAIR_PROFILE} must set factors.engagement_mode_router: true`);
    }
    if (splitRepairProfile.factors?.id_output_contract !== 'strict_compact_json') {
      errors.push(`${SPLIT_REPAIR_PROFILE} must set factors.id_output_contract: strict_compact_json`);
    }
    if (splitRepairProfile.factors?.engagement_router_charisma_repair !== true) {
      errors.push(`${SPLIT_REPAIR_PROFILE} must set factors.engagement_router_charisma_repair: true`);
    }
    if (splitRepairProfile.factors?.engagement_router_split_repair !== true) {
      errors.push(`${SPLIT_REPAIR_PROFILE} must set factors.engagement_router_split_repair: true`);
    }
    if (splitRepairProfile.factors?.agency_return_charisma_floor_mode !== 'accountable_bid_clean') {
      errors.push(`${SPLIT_REPAIR_PROFILE} must keep accountable_bid_clean as fallback floor`);
    }
  }
  if (!evaluationRunnerSource.includes(SPLIT_REPAIR_PROFILE)) {
    errors.push(`${SPLIT_REPAIR_PROFILE} is not registered in services/evaluationRunner.js`);
  }
  if (!transferStakeProfile) {
    errors.push(`Missing transfer-stake profile ${TRANSFER_STAKE_PROFILE}`);
  } else {
    if (transferStakeProfile.factors?.engagement_mode_router !== true) {
      errors.push(`${TRANSFER_STAKE_PROFILE} must set factors.engagement_mode_router: true`);
    }
    if (transferStakeProfile.factors?.id_output_contract !== 'strict_compact_json') {
      errors.push(`${TRANSFER_STAKE_PROFILE} must set factors.id_output_contract: strict_compact_json`);
    }
    if (transferStakeProfile.factors?.engagement_router_charisma_repair !== true) {
      errors.push(`${TRANSFER_STAKE_PROFILE} must set factors.engagement_router_charisma_repair: true`);
    }
    if (transferStakeProfile.factors?.engagement_router_split_repair !== true) {
      errors.push(`${TRANSFER_STAKE_PROFILE} must set factors.engagement_router_split_repair: true`);
    }
    if (transferStakeProfile.factors?.engagement_router_transfer_stake_repair !== true) {
      errors.push(`${TRANSFER_STAKE_PROFILE} must set factors.engagement_router_transfer_stake_repair: true`);
    }
    if (transferStakeProfile.factors?.agency_return_charisma_floor_mode !== 'accountable_bid_clean') {
      errors.push(`${TRANSFER_STAKE_PROFILE} must keep accountable_bid_clean as fallback floor`);
    }
  }
  if (!evaluationRunnerSource.includes(TRANSFER_STAKE_PROFILE)) {
    errors.push(`${TRANSFER_STAKE_PROFILE} is not registered in services/evaluationRunner.js`);
  }
  if (!transferCompressionProfile) {
    errors.push(`Missing transfer-compression profile ${TRANSFER_COMPRESSION_PROFILE}`);
  } else {
    if (transferCompressionProfile.factors?.engagement_mode_router !== true) {
      errors.push(`${TRANSFER_COMPRESSION_PROFILE} must set factors.engagement_mode_router: true`);
    }
    if (transferCompressionProfile.factors?.id_output_contract !== 'strict_compact_json') {
      errors.push(`${TRANSFER_COMPRESSION_PROFILE} must set factors.id_output_contract: strict_compact_json`);
    }
    if (transferCompressionProfile.factors?.engagement_router_charisma_repair !== true) {
      errors.push(`${TRANSFER_COMPRESSION_PROFILE} must set factors.engagement_router_charisma_repair: true`);
    }
    if (transferCompressionProfile.factors?.engagement_router_split_repair !== true) {
      errors.push(`${TRANSFER_COMPRESSION_PROFILE} must set factors.engagement_router_split_repair: true`);
    }
    if (transferCompressionProfile.factors?.engagement_router_transfer_compression_repair !== true) {
      errors.push(
        `${TRANSFER_COMPRESSION_PROFILE} must set factors.engagement_router_transfer_compression_repair: true`,
      );
    }
    if (transferCompressionProfile.factors?.agency_return_premature_certainty_guard !== true) {
      errors.push(`${TRANSFER_COMPRESSION_PROFILE} must set factors.agency_return_premature_certainty_guard: true`);
    }
    if (transferCompressionProfile.factors?.engagement_router_transfer_stake_repair === true) {
      errors.push(`${TRANSFER_COMPRESSION_PROFILE} must not enable the failed cell 183 transfer-stake repair`);
    }
    if (transferCompressionProfile.factors?.agency_return_charisma_floor_mode !== 'accountable_bid_clean') {
      errors.push(`${TRANSFER_COMPRESSION_PROFILE} must keep accountable_bid_clean as fallback floor`);
    }
  }
  if (!evaluationRunnerSource.includes(TRANSFER_COMPRESSION_PROFILE)) {
    errors.push(`${TRANSFER_COMPRESSION_PROFILE} is not registered in services/evaluationRunner.js`);
  }
  if (!dynamicBreakthroughProfile) {
    errors.push(`Missing dynamic breakthrough profile ${DYNAMIC_BREAKTHROUGH_PROFILE}`);
  } else {
    if (dynamicBreakthroughProfile.factors?.engagement_mode_router !== true) {
      errors.push(`${DYNAMIC_BREAKTHROUGH_PROFILE} must set factors.engagement_mode_router: true`);
    }
    if (dynamicBreakthroughProfile.factors?.multi_agent_learner !== true) {
      errors.push(`${DYNAMIC_BREAKTHROUGH_PROFILE} must set factors.multi_agent_learner: true`);
    }
    if (dynamicBreakthroughProfile.learner_architecture !== 'ego_superego') {
      errors.push(`${DYNAMIC_BREAKTHROUGH_PROFILE} must set learner_architecture: ego_superego`);
    }
    if (dynamicBreakthroughProfile.factors?.agency_return_premature_certainty_guard !== true) {
      errors.push(`${DYNAMIC_BREAKTHROUGH_PROFILE} must keep the challenge certainty guard`);
    }
    if (dynamicBreakthroughProfile.factors?.agency_return_charisma_floor_mode !== 'accountable_bid_clean') {
      errors.push(`${DYNAMIC_BREAKTHROUGH_PROFILE} must keep accountable_bid_clean as fallback floor`);
    }
  }
  if (!evaluationRunnerSource.includes(DYNAMIC_BREAKTHROUGH_PROFILE)) {
    errors.push(`${DYNAMIC_BREAKTHROUGH_PROFILE} is not registered in services/evaluationRunner.js`);
  }

  const cases = buildCases(scenarios);
  const rows = [];
  for (const testCase of cases) {
    const expectedResolution = resolveEngagementRegister(testCase.expectedRegister, {
      fallback: testCase.expectedRegister,
    });
    const expectedRegister = expectedResolution?.register || testCase.expectedRegister;
    const legacyExpectedRegister =
      expectedResolution?.legacy_selected_register ||
      (expectedRegister !== testCase.expectedRegister ? testCase.expectedRegister : '');
    const routed = routeEngagementMode({
      learnerMessage: testCase.message,
      recentHistory: testCase.recentHistory || '',
      curriculumContext: testCase.curriculumContext || '',
      modeHistory: testCase.modeHistory || [],
    });
    const selectedResolution = resolveEngagementRegister(routed.selected_register || routed.selected_mode, {
      fallback: routed.selected_register || routed.selected_mode,
    });
    const selectedRegister = selectedResolution?.register || routed.selected_register || routed.selected_mode;
    const legacySelectedRegister =
      routed.legacy_selected_register ||
      selectedResolution?.legacy_selected_register ||
      (selectedRegister !== (routed.selected_register || routed.selected_mode)
        ? routed.selected_register || routed.selected_mode
        : '');
    const passed = selectedRegister === expectedRegister;
    if (!passed) {
      errors.push(
        `${testCase.scenarioId} ${testCase.turn}: expected ${expectedRegister}, got ${selectedRegister}`,
      );
    }
    if (testCase.expectedResistanceSignal && routed.resistance_signal !== testCase.expectedResistanceSignal) {
      errors.push(
        `${testCase.scenarioId} ${testCase.turn}: expected resistance signal ${testCase.expectedResistanceSignal}, got ${routed.resistance_signal || 'none'}`,
      );
    }
    rows.push([
      testCase.scenarioId.replace('charisma_desire_', ''),
      testCase.turn,
      expectedRegister,
      selectedRegister,
      legacyExpectedRegister,
      legacySelectedRegister,
      testCase.expectedResistanceSignal || '',
      routed.resistance_signal || '',
      passed ? 'yes' : 'no',
      routed.evidence_span.replace(/\|/g, '/'),
    ]);
  }

  const status = errors.length === 0 ? 'PASS' : 'FAIL';
  const report = `# Charisma Desire Engagement-Register Router Stage 0 Sanity

Generated: ${new Date().toISOString()}

Status: ${status}

## Router Profile

- Profile: \`${ROUTER_PROFILE}\`
- Fallback static floor: \`accountable_bid_clean\`
- Router factor: \`engagement_mode_router\`
- First-class router field: \`selected_register\` (\`selected_mode\` remains a backward-compatible alias)

## Repair Profile

- Profile: \`${REPAIR_PROFILE}\`
- Adds: \`id_output_contract: strict_compact_json\`
- Adds: \`engagement_router_charisma_repair: true\`
- Keeps: \`engagement_mode_router\` and \`accountable_bid_clean\` fallback floor

## Split Repair Profile

- Profile: \`${SPLIT_REPAIR_PROFILE}\`
- Adds: \`engagement_router_split_repair: true\`
- Keeps: strict id-output contract, router-charisma repair, engagement router,
  and \`accountable_bid_clean\` fallback floor

## Transfer Stake Profile

- Profile: \`${TRANSFER_STAKE_PROFILE}\`
- Adds: \`engagement_router_transfer_stake_repair: true\`
- Keeps: strict id-output contract, router-charisma repair, split repair,
  engagement router, and \`accountable_bid_clean\` fallback floor
- Status: failed design direction after \`eval-2026-06-27-49aeaa2c\`; do not
  use as the next repair target

## Transfer Compression Profile

- Profile: \`${TRANSFER_COMPRESSION_PROFILE}\`
- Adds: \`engagement_router_transfer_compression_repair: true\`
- Adds: \`agency_return_premature_certainty_guard: true\`
- Rejects: the failed cell 183 \`engagement_router_transfer_stake_repair\` move
- Keeps: strict id-output contract, router-charisma repair, split repair,
  engagement router, and \`accountable_bid_clean\` fallback floor

## Dynamic Breakthrough Profile

- Profile: \`${DYNAMIC_BREAKTHROUGH_PROFILE}\`
- Changes: cell 184 tutor-side design plus \`multi_agent_learner: true\`
- Learner architecture: \`ego_superego\`
- Purpose: generated learner uptake after resistant discourse

## Routing Cases

${markdownTable(['Scenario', 'Turn', 'Expected register', 'Selected register', 'Legacy expected', 'Legacy selected', 'Expected signal', 'Selected signal', 'Pass', 'Evidence'], rows)}

## Planned First Paid Smoke

\`\`\`bash
${buildSmokeCommand()}
\`\`\`

## Planned Repair Smoke

\`\`\`bash
${buildRepairSmokeCommand()}
\`\`\`

## Planned Split Repair Smoke

\`\`\`bash
${buildSplitRepairSmokeCommand()}
\`\`\`

## Planned Transfer-Stake Smoke

\`\`\`bash
${buildTransferStakeSmokeCommand()}
\`\`\`

## Planned Transfer-Compression Smoke

\`\`\`bash
${buildTransferCompressionSmokeCommand()}
\`\`\`

## Planned Dynamic-Learner Breakthrough Smoke

\`\`\`bash
${buildDynamicBreakthroughSmokeCommand()}
\`\`\`

## Validation

${errors.length === 0 ? '- No validation errors.' : errors.map((error) => `- ${error}`).join('\n')}
`;

  if (!checkOnly) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, report);
  }

  console.log(`Status: ${status}`);
  console.log(`Total routing cases: ${cases.length}`);
  if (!checkOnly) console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

main();
