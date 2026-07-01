#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'yaml';

import { EVAL_ONLY_PROFILES } from '../services/evaluationRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCENARIO_PATH = path.join(ROOT, 'config', 'charisma-recognition-desire-scenarios.yaml');
const TUTOR_AGENTS_PATH = path.join(ROOT, 'config', 'tutor-agents.yaml');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-role-isolation-gate-summary.md');
const JSON_PATH = path.join(ROOT, 'exports', 'charisma-desire-role-isolation-gate.json');

const CELL_193 = 'cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified';
const CELL_195 = 'cell_195_id_director_charisma_resistance_boredom_stake_scripted_control_verified';

const CONTROLLED_SCENARIOS = [
  'charisma_desire_resistance_breakthrough_boredom',
  'charisma_desire_resistance_breakthrough_frustration',
  'charisma_desire_resistance_breakthrough_irrelevance',
  'charisma_desire_resistance_breakthrough_question_flood',
  'charisma_desire_resistance_breakthrough_rote_parroting',
];

const SCENARIO_LIST = CONTROLLED_SCENARIOS.join(',');

const STACKS = {
  codexTutor: {
    label: 'Codex tutor + Claude Sonnet 5 id',
    egoModel: 'codex.gpt-5.5',
    superegoModel: 'openrouter.sonnet-5',
  },
  glmTutor: {
    label: 'GLM tutor + GLM id',
    egoModel: 'openrouter.glm5_2',
    superegoModel: 'openrouter.glm5_2',
    openrouterRuntimeControl: true,
  },
  codexLearner: {
    label: 'Codex dynamic learner',
    learnerModel: 'codex.gpt-5.5',
  },
  glmLearner: {
    label: 'GLM dynamic learner',
    learnerModel: 'openrouter.glm5_2',
    openrouterRuntimeControl: true,
  },
};

const DYNAMIC_ARMS = [
  {
    id: 'baseline_codex_tutor_codex_learner',
    profile: CELL_193,
    tutorStack: 'codexTutor',
    learnerStack: 'codexLearner',
    repeats: 2,
    roleContrast: 'reference',
    purpose: 'Re-establish the local Codex-stack reference under the same gate.',
  },
  {
    id: 'tutor_fixed_glm_learner',
    profile: CELL_193,
    tutorStack: 'codexTutor',
    learnerStack: 'glmLearner',
    repeats: 2,
    roleContrast: 'hold_tutor_fixed_vary_learner',
    purpose: 'Test whether the mechanism fails when only the dynamic learner stack changes.',
  },
  {
    id: 'learner_fixed_glm_tutor',
    profile: CELL_193,
    tutorStack: 'glmTutor',
    learnerStack: 'codexLearner',
    repeats: 2,
    roleContrast: 'hold_learner_fixed_vary_tutor_id',
    purpose: 'Test whether the mechanism fails when only the tutor/id stack changes.',
  },
  {
    id: 'full_glm_reference',
    profile: CELL_193,
    tutorStack: 'glmTutor',
    learnerStack: 'glmLearner',
    repeats: 2,
    roleContrast: 'known_negative_full_stack_reference',
    purpose: 'Reproduce the known GLM-stack boundary as a same-grid reference.',
  },
];

const SCRIPTED_ARMS = [
  {
    id: 'scripted_control_codex_tutor',
    profile: CELL_195,
    tutorStack: 'codexTutor',
    learnerStack: null,
    repeats: 1,
    roleContrast: 'fixed_resistant_turns_codex_tutor',
    purpose: 'Check tutor register and validation with fixed scripted resistance turns.',
  },
  {
    id: 'scripted_control_glm_tutor',
    profile: CELL_195,
    tutorStack: 'glmTutor',
    learnerStack: null,
    repeats: 1,
    roleContrast: 'fixed_resistant_turns_glm_tutor',
    purpose: 'Check whether GLM tutor/id can produce the target register when learner drift is removed.',
  },
];

const ALL_ARMS = [...DYNAMIC_ARMS, ...SCRIPTED_ARMS];

const REQUIRED_CELL_193_FACTORS = [
  'id_director',
  'charisma_target',
  'recognition_desire',
  'agency_return',
  'agency_return_verifier',
  'agency_return_charisma_floor',
  'engagement_mode_router',
  'id_output_contract',
  'engagement_router_charisma_repair',
  'engagement_router_split_repair',
  'engagement_router_transfer_compression_repair',
  'engagement_router_resistance_tuning',
  'engagement_router_resistance_owned_test',
  'engagement_router_resistance_generation_repair',
  'engagement_router_resistance_commitment_probe',
  'engagement_router_resistance_boredom_stake',
  'agency_return_premature_certainty_guard',
];

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function commandEnvForArm(arm) {
  const tutor = STACKS[arm.tutorStack];
  const learner = arm.learnerStack ? STACKS[arm.learnerStack] : {};
  const env = [
    'ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000',
    'ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000',
    'EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml',
  ];
  if (tutor.openrouterRuntimeControl || learner.openrouterRuntimeControl) {
    env.unshift('OPENROUTER_REASONING_EXCLUDE=true');
    env.unshift('OPENROUTER_REASONING_MAX_TOKENS=0');
  }
  return env;
}

function buildRunCommand(arm) {
  const tutor = STACKS[arm.tutorStack];
  const learner = arm.learnerStack ? STACKS[arm.learnerStack] : null;
  const args = [
    'node scripts/eval-cli.js run',
    `  --profiles ${arm.profile}`,
    `  --scenario ${SCENARIO_LIST}`,
    `  --runs ${arm.repeats}`,
    '  --parallelism 1',
    `  --ego-model ${tutor.egoModel}`,
    `  --superego-model ${tutor.superegoModel}`,
  ];
  if (learner?.learnerModel) args.push(`  --learner-model ${learner.learnerModel}`);
  args.push('  --skip-rubric');
  args.push(`  --description "Charisma desire role isolation: ${arm.id}"`);
  return `${commandEnvForArm(arm).join(' \\\n')} \\\n  ${args.join(' \\\n')}`;
}

function buildReportCommand() {
  return [
    'node scripts/report-charisma-desire-breakthrough-matrix.js \\',
    '  --runs <comma-separated-role-isolation-run-ids>',
    '',
    '# Compare the reported run rows against the role-isolation arm map above.',
    '# Scripted-control rows are tutor-register controls, not learner-outcome evidence.',
  ].join('\n');
}

function plannedRows(arms = ALL_ARMS) {
  return arms.reduce((sum, arm) => sum + CONTROLLED_SCENARIOS.length * arm.repeats, 0);
}

function validateConfig({ scenarios, profiles }) {
  const errors = [];
  for (const scenarioId of CONTROLLED_SCENARIOS) {
    const scenario = scenarios[scenarioId];
    if (!scenario) {
      errors.push(`Missing controlled scenario ${scenarioId}`);
      continue;
    }
    if (scenario.extends !== 'charisma_desire_resistance_breakthrough_probe') {
      errors.push(`${scenarioId} must extend charisma_desire_resistance_breakthrough_probe`);
    }
  }

  for (const profileId of [CELL_193, CELL_195]) {
    if (!profiles[profileId]) errors.push(`Missing profile ${profileId}`);
    if (!EVAL_ONLY_PROFILES.includes(profileId)) errors.push(`${profileId} is not registered in EVAL_ONLY_PROFILES`);
  }

  const dynamic = profiles[CELL_193];
  const scripted = profiles[CELL_195];
  if (dynamic) {
    if (dynamic.learner_architecture !== 'ego_superego') {
      errors.push(`${CELL_193} must remain learner_architecture: ego_superego`);
    }
    if (dynamic.factors?.multi_agent_learner !== true) {
      errors.push(`${CELL_193} must keep factors.multi_agent_learner: true`);
    }
  }
  if (scripted) {
    if (scripted.learner_architecture !== 'unified') {
      errors.push(`${CELL_195} must use learner_architecture: unified`);
    }
    if (scripted.factors?.multi_agent_learner !== false) {
      errors.push(`${CELL_195} must set factors.multi_agent_learner: false`);
    }
    for (const factor of REQUIRED_CELL_193_FACTORS) {
      if (!scripted.factors?.[factor]) errors.push(`${CELL_195} must preserve factor ${factor}`);
    }
    if (scripted.factors?.engagement_router_resistance_glm_compact) {
      errors.push(`${CELL_195} must not include the failed GLM compact repair`);
    }
  }

  const baseline = DYNAMIC_ARMS.find((arm) => arm.id === 'baseline_codex_tutor_codex_learner');
  const tutorFixed = DYNAMIC_ARMS.find((arm) => arm.id === 'tutor_fixed_glm_learner');
  const learnerFixed = DYNAMIC_ARMS.find((arm) => arm.id === 'learner_fixed_glm_tutor');
  if (baseline && tutorFixed) {
    if (baseline.profile !== tutorFixed.profile || baseline.tutorStack !== tutorFixed.tutorStack) {
      errors.push('tutor_fixed_glm_learner must hold profile and tutor stack fixed against baseline');
    }
    if (baseline.learnerStack === tutorFixed.learnerStack) {
      errors.push('tutor_fixed_glm_learner must vary only the learner stack');
    }
  }
  if (baseline && learnerFixed) {
    if (baseline.profile !== learnerFixed.profile || baseline.learnerStack !== learnerFixed.learnerStack) {
      errors.push('learner_fixed_glm_tutor must hold profile and learner stack fixed against baseline');
    }
    if (baseline.tutorStack === learnerFixed.tutorStack) {
      errors.push('learner_fixed_glm_tutor must vary only the tutor/id stack');
    }
  }

  return errors;
}

function armRows() {
  return ALL_ARMS.map((arm) => {
    const tutor = STACKS[arm.tutorStack];
    const learner = arm.learnerStack ? STACKS[arm.learnerStack] : { label: 'scripted unified turns' };
    return [
      arm.id,
      arm.roleContrast,
      arm.profile,
      tutor.label,
      learner.label,
      String(arm.repeats),
      String(CONTROLLED_SCENARIOS.length * arm.repeats),
      arm.purpose,
    ];
  });
}

function scenarioRows() {
  return CONTROLLED_SCENARIOS.map((scenarioId) => [
    scenarioId,
    scenarioId.replace('charisma_desire_resistance_breakthrough_', ''),
  ]);
}

function buildReport({ generatedAt, errors }) {
  const commandBlocks = ALL_ARMS.map((arm) => `### ${arm.id}\n\n\`\`\`bash\n${buildRunCommand(arm)}\n\`\`\``);
  return `# Charisma/Desire Role-Isolation Gate

Generated: ${generatedAt}

Status: ${errors.length === 0 ? 'PASS' : 'FAIL'}

## Question

Does the cell 193 local resistance-breakthrough mechanism fail under GLM because
the tutor/id stack cannot produce the routed register, because the dynamic learner
does not respond to that register, or because both roles drift together?

This is a no-paid gate and command sheet. It authorizes role-isolation runs only;
it does not promote cell 193 beyond the current exploratory Codex-stack claim.

## Frozen Scenarios

${markdownTable(['Scenario', 'Signal'], scenarioRows())}

## Planned Arms

${markdownTable(['Arm', 'Contrast', 'Profile', 'Tutor/id stack', 'Learner stack', 'Repeats', 'Rows', 'Purpose'], armRows())}

Planned rows: ${plannedRows()} generation-only rows.

## Decision Rules

- If \`baseline_codex_tutor_codex_learner\` reproduces the local pass and \`tutor_fixed_glm_learner\` fails, the immediate suspect is dynamic learner gate drift.
- If \`baseline_codex_tutor_codex_learner\` reproduces the local pass and \`learner_fixed_glm_tutor\` fails, the immediate suspect is tutor/id register production.
- If \`scripted_control_glm_tutor\` passes route/target/validation while \`learner_fixed_glm_tutor\` fails, GLM tutor output can hit the public register but does not move the dynamic Codex learner.
- If \`scripted_control_glm_tutor\` fails route/target/validation, the failure is already tutor/id-side and should not be repaired by changing learner prompts.
- Scripted controls are not learner-outcome evidence; they only check tutor register shape and DB validation with fixed resistant turns.

## Planned Commands

${commandBlocks.join('\n\n')}

## After Runs

\`\`\`bash
${buildReportCommand()}
\`\`\`

## Validation

${errors.length === 0 ? '- No validation errors.' : errors.map((error) => `- ${error}`).join('\n')}
`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const scenarios = readYaml(SCENARIO_PATH)?.scenarios || {};
  const profiles = readYaml(TUTOR_AGENTS_PATH)?.profiles || {};
  const errors = validateConfig({ scenarios, profiles });
  const data = {
    generatedAt: new Date().toISOString(),
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    controlledScenarios: CONTROLLED_SCENARIOS,
    dynamicArms: DYNAMIC_ARMS,
    scriptedArms: SCRIPTED_ARMS,
    plannedRows: plannedRows(),
    errors,
  };

  if (!checkOnly) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`);
    fs.writeFileSync(REPORT_PATH, buildReport({ generatedAt: data.generatedAt, errors }));
  }

  console.log('Scenario set: charisma_desire_role_isolation');
  console.log(`Status: ${data.status}`);
  console.log(`Controlled scenarios: ${CONTROLLED_SCENARIOS.length}`);
  console.log(`Isolation arms: ${ALL_ARMS.length}`);
  console.log(`Planned rows: ${data.plannedRows}`);
  console.log(`Scripted control: ${CELL_195}`);
  if (!checkOnly) console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

main();
