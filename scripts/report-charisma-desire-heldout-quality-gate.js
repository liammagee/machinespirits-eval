#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import yaml from 'yaml';

import { EVAL_ONLY_PROFILES } from '../services/evaluationRunner.js';
import { routeEngagementMode } from '../services/engagementModeRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCENARIO_PATH = path.join(ROOT, 'config', 'charisma-recognition-desire-scenarios.yaml');
const TUTOR_AGENTS_PATH = path.join(ROOT, 'config', 'tutor-agents.yaml');
const DB_PATH = process.env.EVAL_DB_PATH || path.join(ROOT, 'data', 'evaluations.db');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-heldout-quality-gate-summary.md');
const JSON_PATH = path.join(ROOT, 'exports', 'charisma-desire-heldout-quality-gate.json');
const MATRIX_JSON_PATH = path.join(ROOT, 'exports', 'charisma-desire-breakthrough-heldout-matrix.json');
const OPENROUTER_TIMEOUT_MS = '480000';

const CELL_193 = 'cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified';
const CELL_195 = 'cell_195_id_director_charisma_resistance_boredom_stake_scripted_control_verified';

const HELDOUT_SCENARIOS = [
  'charisma_desire_heldout_ai_syllabus_boredom',
  'charisma_desire_heldout_alignment_frustration',
  'charisma_desire_heldout_community_irrelevance',
  'charisma_desire_heldout_attention_question_flood',
  'charisma_desire_heldout_synthesis_rote_parroting',
];
const BASE_SCENARIO_ID = 'charisma_desire_resistance_breakthrough_probe';

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
    id: 'heldout_baseline_codex_tutor_codex_learner',
    profile: CELL_193,
    tutorStack: 'codexTutor',
    learnerStack: 'codexLearner',
    repeats: 2,
    roleContrast: 'heldout_reference',
    minPositiveRate: 0.5,
    purpose: 'Check whether the Codex-stack local signal survives held-out artifacts.',
  },
  {
    id: 'heldout_tutor_fixed_glm_learner',
    profile: CELL_193,
    tutorStack: 'codexTutor',
    learnerStack: 'glmLearner',
    repeats: 2,
    roleContrast: 'heldout_hold_tutor_fixed_vary_learner',
    minPositiveRate: 0.4,
    purpose: 'Check whether the held-out signal survives when only the dynamic learner stack changes.',
  },
  {
    id: 'heldout_learner_fixed_glm_tutor',
    profile: CELL_193,
    tutorStack: 'glmTutor',
    learnerStack: 'codexLearner',
    repeats: 2,
    roleContrast: 'heldout_hold_learner_fixed_vary_tutor_id',
    minPositiveRate: 0.4,
    purpose: 'Check whether the held-out signal survives when only the tutor/id stack changes.',
  },
  {
    id: 'heldout_full_glm_reference',
    profile: CELL_193,
    tutorStack: 'glmTutor',
    learnerStack: 'glmLearner',
    repeats: 2,
    roleContrast: 'heldout_full_glm_reference',
    minPositiveRate: 0.3,
    purpose: 'Check whether full GLM remains above the minimum artifact-level quality floor.',
  },
];

const SCRIPTED_ARMS = [
  {
    id: 'heldout_scripted_control_codex_tutor',
    profile: CELL_195,
    tutorStack: 'codexTutor',
    learnerStack: null,
    repeats: 1,
    roleContrast: 'heldout_fixed_resistant_turns_codex_tutor',
    maxPositiveRows: 0,
    purpose: 'Keep fixed scripted turns as a tutor-register control, not learner-outcome evidence.',
  },
  {
    id: 'heldout_scripted_control_glm_tutor',
    profile: CELL_195,
    tutorStack: 'glmTutor',
    learnerStack: null,
    repeats: 1,
    roleContrast: 'heldout_fixed_resistant_turns_glm_tutor',
    maxPositiveRows: 0,
    purpose: 'Verify GLM tutor/id register shape on fixed turns without counting scripted uptake.',
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

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
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

function runIdsFromFlags(flags) {
  return typeof flags.runs === 'string'
    ? flags.runs
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
}

function commandEnvForArm(arm) {
  const tutor = STACKS[arm.tutorStack];
  const learner = arm.learnerStack ? STACKS[arm.learnerStack] : {};
  const usesOpenRouter = [tutor.egoModel, tutor.superegoModel, learner.learnerModel].some((model) =>
    String(model || '').startsWith('openrouter.'),
  );
  const env = [
    'EVAL_CAPTURE_API_PAYLOADS=false',
    'ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000',
    'ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS=600000',
    'EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml',
  ];
  if (usesOpenRouter) env.unshift(`OPENROUTER_API_TIMEOUT_MS=${OPENROUTER_TIMEOUT_MS}`);
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
    `  --scenario ${HELDOUT_SCENARIOS.join(',')}`,
    `  --runs ${arm.repeats}`,
    '  --parallelism 1',
    `  --ego-model ${tutor.egoModel}`,
    `  --superego-model ${tutor.superegoModel}`,
  ];
  if (learner?.learnerModel) args.push(`  --learner-model ${learner.learnerModel}`);
  args.push('  --skip-rubric');
  args.push(`  --description "Charisma desire heldout quality gate: ${arm.id}"`);
  return `${commandEnvForArm(arm).join(' \\\n')} \\\n  ${args.join(' \\\n')}`;
}

function plannedRows(arms = ALL_ARMS) {
  return arms.reduce((sum, arm) => sum + HELDOUT_SCENARIOS.length * arm.repeats, 0);
}

function scenarioRows(scenarios) {
  return HELDOUT_SCENARIOS.map((scenarioId) => {
    const scenario = resolveHeldoutScenario(scenarios, scenarioId);
    return [
      scenarioId,
      scenario.resistance_signal_target || '-',
      scenario.current_content || '-',
      String(scenario.name || '').replace(/\|/g, '/'),
    ];
  });
}

function resolveHeldoutScenario(scenarios, scenarioId) {
  return {
    ...(scenarios[BASE_SCENARIO_ID] || {}),
    ...(scenarios[scenarioId] || {}),
  };
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
      String(HELDOUT_SCENARIOS.length * arm.repeats),
      arm.minPositiveRate == null ? `<= ${arm.maxPositiveRows} positive scripted rows` : `>= ${Math.round(arm.minPositiveRate * 100)}% positive`,
      arm.purpose,
    ];
  });
}

function validateConfig({ scenarios, profiles }) {
  const errors = [];
  const targets = new Set();
  const contentIds = new Set();
  for (const scenarioId of HELDOUT_SCENARIOS) {
    const scenarioOverride = scenarios[scenarioId];
    if (!scenarioOverride) {
      errors.push(`Missing held-out scenario ${scenarioId}`);
      continue;
    }
    const scenario = resolveHeldoutScenario(scenarios, scenarioId);
    if (scenario.extends !== 'charisma_desire_resistance_breakthrough_probe') {
      errors.push(`${scenarioId} must extend charisma_desire_resistance_breakthrough_probe`);
    }
    if (scenario.resistance_breakthrough_diagnostic !== true) {
      errors.push(`${scenarioId} must inherit resistance_breakthrough_diagnostic: true`);
    }
    if (!scenario.resistance_signal_target) {
      errors.push(`${scenarioId} must set resistance_signal_target`);
    } else {
      targets.add(scenario.resistance_signal_target);
    }
    if (!String(scenarioId).includes('heldout')) {
      errors.push(`${scenarioId} must be visibly marked as heldout`);
    }
    if (scenario.current_content) contentIds.add(scenario.current_content);
    const gate = (scenario.resistance_signal_gate || []).find((item) => item.id === scenario.resistance_signal_target);
    if (!gate) {
      errors.push(`${scenarioId} has no target resistance_signal_gate for ${scenario.resistance_signal_target}`);
    } else {
      const routed = routeEngagementMode({
        learnerMessage: gate.message || '',
        registerHistory: ['scaffolding'],
      });
      if (routed.selected_register !== 'charismatic_challenge') {
        errors.push(`${scenarioId} target gate expected charismatic_challenge, got ${routed.selected_register}`);
      }
      if (routed.resistance_signal !== scenario.resistance_signal_target) {
        errors.push(`${scenarioId} target gate expected ${scenario.resistance_signal_target}, got ${routed.resistance_signal}`);
      }
    }
  }
  for (const target of ['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting']) {
    if (!targets.has(target)) errors.push(`Held-out pool must include ${target}`);
  }
  if (contentIds.size < 4) errors.push('Held-out pool must span at least four current_content artifacts');
  if (contentIds.size === 1 && contentIds.has('479-lecture-3')) {
    errors.push('Held-out pool must not collapse to the lecture-3 controlled artifact');
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
  }
  return errors;
}

function armForRun(run) {
  return ALL_ARMS.find((arm) => String(run.description || '').includes(arm.id)) || null;
}

function emptyRunSummary(arm) {
  return {
    armId: arm.id,
    runIds: [],
    expectedRows: HELDOUT_SCENARIOS.length * arm.repeats,
    storedRows: 0,
    successfulRows: 0,
    failedRows: 0,
    requiredPassRows: 0,
    forbiddenPassRows: 0,
    scenarioCounts: HELDOUT_SCENARIOS.map((scenarioId) => `${scenarioId}:0/${arm.repeats}`),
    status: 'missing',
  };
}

function loadRunEvidence(runIds) {
  if (runIds.length === 0) return { runs: [], summaries: ALL_ARMS.map(emptyRunSummary) };
  const placeholders = runIds.map(() => '?').join(',');
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const runs = db
      .prepare(
        `SELECT id, status, description
         FROM evaluation_runs
         WHERE id IN (${placeholders})`,
      )
      .all(...runIds);
    const rows = db
      .prepare(
        `SELECT run_id, scenario_id, success, passes_required, passes_forbidden, error_message
         FROM evaluation_results
         WHERE run_id IN (${placeholders})`,
      )
      .all(...runIds);

    const summaries = ALL_ARMS.map((arm) => {
      const armRuns = runs.filter((run) => armForRun(run)?.id === arm.id);
      const armRunIds = armRuns.map((run) => run.id);
      const armRowsForRuns = rows.filter((row) => armRunIds.includes(row.run_id));
      const expectedRows = HELDOUT_SCENARIOS.length * arm.repeats;
      const successfulRows = armRowsForRuns.filter((row) => row.success === 1).length;
      const failedRows = armRowsForRuns.filter((row) => row.success === 0).length;
      const requiredPassRows = armRowsForRuns.filter((row) => row.success === 1 && row.passes_required === 1).length;
      const forbiddenPassRows = armRowsForRuns.filter((row) => row.success === 1 && row.passes_forbidden === 1).length;
      const scenarioCounts = HELDOUT_SCENARIOS.map((scenarioId) => {
        const count = armRowsForRuns.filter((row) => row.scenario_id === scenarioId && row.success === 1).length;
        return `${scenarioId.replace('charisma_desire_heldout_', '')}:${count}/${arm.repeats}`;
      });
      return {
        armId: arm.id,
        runIds: armRunIds,
        expectedRows,
        storedRows: armRowsForRuns.length,
        successfulRows,
        failedRows,
        requiredPassRows,
        forbiddenPassRows,
        scenarioCounts,
        status: successfulRows === expectedRows ? 'complete' : successfulRows > 0 ? 'partial' : 'missing',
      };
    });
    return { runs, summaries };
  } finally {
    db.close();
  }
}

function isPositiveAnalysis(row) {
  return (
    String(row.verdict || '').includes('candidate') ||
    row.verdict === 'productive_frustration_work' ||
    row.verdict === 'owned_generation_with_residual'
  );
}

function loadMatrixAnalyses(matrixJsonPath, runIds) {
  if (!fs.existsSync(matrixJsonPath)) return { analyses: [], missing: true };
  const data = parseJson(fs.readFileSync(matrixJsonPath, 'utf8'), {});
  const wanted = new Set(runIds);
  const analyses = Array.isArray(data.analyses)
    ? data.analyses.filter((row) => !runIds.length || wanted.has(row.runId))
    : [];
  return { analyses, missing: false, generatedAt: data.generatedAt || '' };
}

function summarizeMatrixByArm({ analyses, runs }) {
  const runToArm = new Map(runs.map((run) => [run.id, armForRun(run)?.id || 'unmapped']));
  const summaries = new Map(
    ALL_ARMS.map((arm) => [
      arm.id,
      {
        armId: arm.id,
        rows: 0,
        positiveOutcomes: 0,
        candidates: 0,
        routeHits: 0,
        targetMatches: 0,
        residualFloods: 0,
        reopenedCommitments: 0,
        meanScore: 0,
      },
    ]),
  );
  for (const row of analyses) {
    const armId = runToArm.get(row.runId);
    if (!summaries.has(armId)) continue;
    const summary = summaries.get(armId);
    summary.rows += 1;
    summary.positiveOutcomes += isPositiveAnalysis(row) ? 1 : 0;
    summary.candidates += String(row.verdict || '').includes('candidate') ? 1 : 0;
    summary.routeHits += row.routeHit ? 1 : 0;
    summary.targetMatches += row.targetMatched ? 1 : 0;
    summary.residualFloods += row.residualQuestionFlood ? 1 : 0;
    summary.reopenedCommitments += row.reopenedQuestionFloodCommitment ? 1 : 0;
    summary.meanScore += Number(row.lexicalScore || 0);
  }
  for (const summary of summaries.values()) {
    if (summary.rows) summary.meanScore /= summary.rows;
  }
  return [...summaries.values()];
}

function pct(n, d) {
  return d ? `${Math.round((n / d) * 100)}%` : '0%';
}

function decideGate({ runIds, runSummaries, matrixMissing, matrixSummaries }) {
  const reasons = [];
  let status = 'PENDING_NO_RUNS';
  if (!runIds.length) {
    reasons.push('supply run IDs after generating the six held-out arms');
    return { status, reasons, advance: 'Do not advance; held-out rows have not been generated.' };
  }
  const totalExpected = plannedRows();
  const totalSuccessful = runSummaries.reduce((sum, row) => sum + row.successfulRows, 0);
  const totalFailed = runSummaries.reduce((sum, row) => sum + row.failedRows, 0);
  if (totalFailed > 0) {
    status = 'FAIL_RUNTIME_COMPLETION';
    reasons.push(`${totalFailed} runtime failure rows are present`);
  }
  if (totalSuccessful < totalExpected) {
    status = status.startsWith('FAIL') ? status : 'PENDING_INCOMPLETE_RUNS';
    reasons.push(`only ${totalSuccessful}/${totalExpected} successful generation rows`);
  }
  if (matrixMissing || matrixSummaries.every((row) => row.rows === 0)) {
    status = status.startsWith('FAIL') ? status : 'PENDING_MATRIX_REPORT';
    reasons.push('run the held-out breakthrough matrix reporter before deciding quality');
    return { status, reasons, advance: 'Do not advance; quality rows have not been summarized.' };
  }

  for (const arm of DYNAMIC_ARMS) {
    const summary = matrixSummaries.find((row) => row.armId === arm.id);
    const expectedRows = HELDOUT_SCENARIOS.length * arm.repeats;
    if (!summary || summary.rows < expectedRows) {
      status = status.startsWith('FAIL') ? status : 'PENDING_MATRIX_REPORT';
      reasons.push(`${arm.id} has ${summary?.rows || 0}/${expectedRows} matrix rows`);
      continue;
    }
    const positiveRate = summary.positiveOutcomes / summary.rows;
    const routeRate = summary.routeHits / summary.rows;
    const targetRate = summary.targetMatches / summary.rows;
    if (positiveRate < arm.minPositiveRate) {
      status = 'FAIL_HELDOUT_QUALITY';
      reasons.push(`${arm.id} positive outcome rate ${pct(summary.positiveOutcomes, summary.rows)} below ${Math.round(arm.minPositiveRate * 100)}%`);
    }
    if (routeRate < 0.8) {
      status = 'FAIL_HELDOUT_QUALITY';
      reasons.push(`${arm.id} route-hit rate ${pct(summary.routeHits, summary.rows)} below 80%`);
    }
    if (targetRate < 0.8) {
      status = 'FAIL_HELDOUT_QUALITY';
      reasons.push(`${arm.id} target-match rate ${pct(summary.targetMatches, summary.rows)} below 80%`);
    }
  }

  for (const arm of SCRIPTED_ARMS) {
    const summary = matrixSummaries.find((row) => row.armId === arm.id);
    if (!summary) continue;
    if (summary.positiveOutcomes > arm.maxPositiveRows) {
      status = 'FAIL_SCRIPTED_CONTROL';
      reasons.push(`${arm.id} has ${summary.positiveOutcomes} positive scripted rows`);
    }
  }

  if (!reasons.length) {
    status = 'PASS_HELDOUT_ARTIFACT_GATE';
    reasons.push('all completion, role-swap quality, route/target, and scripted-control criteria passed');
  }
  const advance =
    status === 'PASS_HELDOUT_ARTIFACT_GATE'
      ? 'Advance only to a bounded paper/spec claim review: held-out artifact-level signal, no runtime promotion and no human-learning claim.'
      : status.startsWith('FAIL')
        ? 'Do not advance; inspect failed arms before opening any promotion or human/hybrid gate.'
        : 'Do not advance yet; complete the pending run/report evidence first.';
  return { status, reasons, advance };
}

function buildResultsRows(summaries) {
  return summaries.map((result) => [
    result.armId,
    result.runIds.join(', ') || '-',
    `${result.successfulRows}/${result.expectedRows}`,
    String(result.failedRows),
    `${result.requiredPassRows}/${result.successfulRows}`,
    `${result.forbiddenPassRows}/${result.successfulRows}`,
    result.status,
    result.scenarioCounts.join('; '),
  ]);
}

function buildMatrixRows(summaries) {
  return summaries.map((summary) => [
    summary.armId,
    String(summary.rows),
    `${summary.positiveOutcomes}/${summary.rows}`,
    `${summary.candidates}/${summary.rows}`,
    `${summary.routeHits}/${summary.rows}`,
    `${summary.targetMatches}/${summary.rows}`,
    `${summary.residualFloods}/${summary.rows}`,
    `${summary.reopenedCommitments}/${summary.rows}`,
    summary.rows ? summary.meanScore.toFixed(1) : '-',
  ]);
}

function buildReport({ generatedAt, errors, scenarios, runSummaries, matrixSummaries, gate }) {
  const commandBlocks = ALL_ARMS.map((arm) => `### ${arm.id}\n\n\`\`\`bash\n${buildRunCommand(arm)}\n\`\`\``);
  return `# Charisma/Desire Held-Out Quality Gate

Generated: ${generatedAt}

Status: ${errors.length === 0 ? 'PASS' : 'FAIL'}

Gate decision: \`${gate.status}\`

Advance: ${gate.advance}

## Question

Does the local charisma/desire selector retain artifact-level quality on held-out
derivation traces across model-role swaps, while scripted controls remain
negative and GLM/OpenRouter runtime behavior stays guarded?

This gate can support only a bounded claim: held-out artifact-level signal.
It authorizes no runtime policy promotion, no deployment claim, and no human-learning claim.

## Held-Out Artifact Pool

${markdownTable(['Scenario', 'Signal', 'Artifact', 'Name'], scenarioRows(scenarios))}

## Planned Arms

${markdownTable(
  ['Arm', 'Contrast', 'Profile', 'Tutor/id stack', 'Learner stack', 'Repeats', 'Rows', 'Quality criterion', 'Purpose'],
  armRows(),
)}

Planned rows: ${plannedRows()} generation-only rows.

Runtime guard for GLM/OpenRouter arms: \`OPENROUTER_API_TIMEOUT_MS=${OPENROUTER_TIMEOUT_MS}\`, \`OPENROUTER_REASONING_MAX_TOKENS=0\`, \`OPENROUTER_REASONING_EXCLUDE=true\`, and \`EVAL_CAPTURE_API_PAYLOADS=false\`.

## Run Completion

${markdownTable(
  ['Arm', 'Run IDs', 'Successful rows', 'Failed rows', 'Required pass', 'Forbidden pass', 'Status', 'Scenario counts'],
  buildResultsRows(runSummaries),
)}

## Quality Summary

${markdownTable(
  ['Arm', 'Rows', 'Positive', 'Candidates', 'Route hits', 'Target matches', 'Residual flood', 'Reopened', 'Mean score'],
  buildMatrixRows(matrixSummaries),
)}

## Decision Rules

- Runtime: all six arms must complete ${plannedRows()} successful generation rows with zero failed rows.
- Dynamic quality: each dynamic role-swap arm must meet its positive-local-outcome floor, with route-hit rate and target-match rate at or above 80%.
- Scripted controls: both scripted arms must stay at zero positive local outcomes because scripted uptake is not learner evidence.
- Claim boundary: a pass advances only to bounded paper/spec fold-in, not runtime promotion.

## Decision Reasons

${gate.reasons.map((reason) => `- ${reason}`).join('\n')}

## Planned Commands

${commandBlocks.join('\n\n')}

## After Runs

\`\`\`bash
EVAL_DB_PATH=/path/to/evaluations.db \\
EVAL_LOGS_DIR=/path/to/logs \\
node scripts/report-charisma-desire-breakthrough-matrix.js \\
  --scenario-set heldout \\
  --runs <comma-separated-heldout-run-ids>

EVAL_DB_PATH=/path/to/evaluations.db \\
EVAL_LOGS_DIR=/path/to/logs \\
node scripts/report-charisma-desire-heldout-quality-gate.js \\
  --runs <comma-separated-heldout-run-ids>
\`\`\`

## Validation

${errors.length === 0 ? '- No validation errors.' : errors.map((error) => `- ${error}`).join('\n')}
`;
}

function main() {
  const flags = parseArgs(process.argv);
  const checkOnly = flags.check === true;
  const runIds = runIdsFromFlags(flags);
  const matrixJsonPath = typeof flags['matrix-json'] === 'string' ? path.resolve(flags['matrix-json']) : MATRIX_JSON_PATH;
  const scenarios = readYaml(SCENARIO_PATH)?.scenarios || {};
  const profiles = readYaml(TUTOR_AGENTS_PATH)?.profiles || {};
  const errors = validateConfig({ scenarios, profiles });
  const { runs, summaries: runSummaries } = loadRunEvidence(runIds);
  const matrix = loadMatrixAnalyses(matrixJsonPath, runIds);
  const matrixSummaries = summarizeMatrixByArm({ analyses: matrix.analyses, runs });
  const gate = decideGate({
    runIds,
    runSummaries,
    matrixMissing: matrix.missing,
    matrixSummaries,
  });
  const data = {
    generatedAt: new Date().toISOString(),
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    gate,
    heldoutScenarios: HELDOUT_SCENARIOS,
    dynamicArms: DYNAMIC_ARMS,
    scriptedArms: SCRIPTED_ARMS,
    plannedRows: plannedRows(),
    resultRuns: runIds,
    runSummaries,
    matrixJsonPath,
    matrixSummaries,
    errors,
  };

  if (!checkOnly) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`);
    fs.writeFileSync(REPORT_PATH, buildReport({ generatedAt: data.generatedAt, errors, scenarios, runSummaries, matrixSummaries, gate }));
  }

  const successfulRows = runSummaries.reduce((sum, result) => sum + result.successfulRows, 0);
  console.log('Scenario set: charisma_desire_heldout_quality_gate');
  console.log(`Status: ${data.status}`);
  console.log(`Gate decision: ${gate.status}`);
  console.log(`Held-out scenarios: ${HELDOUT_SCENARIOS.length}`);
  console.log(`Isolation arms: ${ALL_ARMS.length}`);
  console.log(`Planned rows: ${data.plannedRows}`);
  console.log(`Observed rows: ${successfulRows}/${data.plannedRows}`);
  console.log(`Scripted control: ${CELL_195}`);
  console.log(`Dynamic profile: ${CELL_193}`);
  if (!checkOnly) console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

main();
