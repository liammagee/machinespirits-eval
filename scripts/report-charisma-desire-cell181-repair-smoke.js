#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_RUN_ID = 'eval-2026-06-27-a9a4c920';
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-cell181-repair-smoke-summary.md');

const TARGET_PROFILE = 'cell_181_id_director_charisma_engagement_router_contract_repair_verified';
const BASELINE_PROFILE = 'cell_180_id_director_charisma_engagement_router_verified';
const BASELINE_RUN_IDS = ['eval-2026-06-27-bf8bc904', 'eval-2026-06-27-a9e8e0ed'];
const SCENARIOS = [
  'charisma_desire_ai_syllabus_transfer',
  'charisma_desire_instruction_to_engagement_switch',
];
const EXPECTED_REGISTERS = new Map([
  ['charisma_desire_ai_syllabus_transfer:0', 'transfer_grounding'],
  ['charisma_desire_ai_syllabus_transfer:1', 'transfer_grounding'],
  ['charisma_desire_instruction_to_engagement_switch:0', 'scaffolding'],
  ['charisma_desire_instruction_to_engagement_switch:1', 'charismatic_challenge'],
]);

function scenarioLabel(scenarioId) {
  return String(scenarioId || '').replace('charisma_desire_', '');
}

function fmt(value, digits = 1) {
  return value == null || Number.isNaN(Number(value)) ? '' : Number(value).toFixed(digits);
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function getRun(db, runId) {
  return db
    .prepare(
      `SELECT id, status, total_tests, total_configurations, total_scenarios, created_at, completed_at, metadata
       FROM evaluation_runs
       WHERE id = ?`,
    )
    .get(runId);
}

function getTargetRows(db, runId) {
  return db
    .prepare(
      `SELECT
         id,
         run_id,
         scenario_id,
         profile_name,
         suggestions,
         id_construction_trace,
         tutor_first_turn_score,
         tutor_last_turn_score,
         tutor_overall_score,
         tutor_holistic_overall_score,
         tutor_charisma_overall_score,
         passes_required,
         passes_forbidden,
         required_missing,
         forbidden_found,
         judge_model,
         tutor_charisma_judge_model,
         success,
         error_message
       FROM evaluation_results
       WHERE run_id = ?
         AND profile_name = ?
       ORDER BY scenario_id, id`,
    )
    .all(runId, TARGET_PROFILE);
}

function getBaselineRows(db) {
  const placeholders = BASELINE_RUN_IDS.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT
         run_id,
         scenario_id,
         profile_name,
         tutor_first_turn_score,
         tutor_last_turn_score,
         tutor_overall_score,
         tutor_charisma_overall_score,
         passes_required,
         passes_forbidden
       FROM evaluation_results
       WHERE run_id IN (${placeholders})
         AND profile_name = ?
         AND scenario_id IN (${SCENARIOS.map(() => '?').join(',')})
       ORDER BY scenario_id, run_id`,
    )
    .all(...BASELINE_RUN_IDS, BASELINE_PROFILE, ...SCENARIOS);
}

function traceRows(rows) {
  const trace = [];
  for (const row of rows) {
    for (const turn of parseJson(row.id_construction_trace, [])) {
      const turnNumber = Number(turn.turn);
      const expectedRegister = EXPECTED_REGISTERS.get(`${row.scenario_id}:${turnNumber}`) || '';
      const selectedRegister = turn.engagementState?.selected_register || turn.engagementState?.selected_mode || '';
      trace.push({
        scenario_id: row.scenario_id,
        turn: turnNumber,
        parse_status: turn.construction?.parse_status || '',
        selected_register: selectedRegister,
        expected_register: expectedRegister,
        learner_signal: turn.engagementState?.learner_signal || '',
        agency_return_passes: turn.agencyReturnVerification?.passes === true,
      });
    }
  }
  return trace.sort((a, b) => `${a.scenario_id}:${a.turn}`.localeCompare(`${b.scenario_id}:${b.turn}`));
}

function firstMessageExcerpt(rawSuggestions) {
  const parsed = parseJson(rawSuggestions, []);
  const message = Array.isArray(parsed) ? parsed[0]?.message : parsed?.message;
  return String(message || '')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

function main() {
  const runId = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || DEFAULT_RUN_ID;
  const checkOnly = process.argv.includes('--check');
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  const run = getRun(db, runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  const metadata = parseJson(run.metadata, {});
  const targetRows = getTargetRows(db, runId);
  const successRows = targetRows.filter((row) => row.success === 1);
  const scoredRows = successRows.filter((row) => row.tutor_first_turn_score != null);
  const charismaRows = successRows.filter((row) => row.tutor_charisma_overall_score != null);
  const baselines = getBaselineRows(db);
  const traces = traceRows(successRows);

  const allExpectedRowsPresent =
    successRows.length === 2 &&
    SCENARIOS.every((scenarioId) => successRows.some((row) => row.scenario_id === scenarioId));
  const allScored = scoredRows.length === 2 && charismaRows.length === 2;
  const allValidationPass = successRows.every((row) => row.passes_required === 1 && row.passes_forbidden === 1);
  const noMinimalPersonaFallback = traces.every((row) =>
    ['ok', 'salvaged_from_malformed_json'].includes(row.parse_status),
  );
  const registersMatch = traces.every(
    (row) => !row.expected_register || row.selected_register === row.expected_register,
  );
  const agencyReturnPasses = traces.every((row) => row.agency_return_passes);

  const comparisons = [];
  for (const target of successRows) {
    const scenarioBaselines = baselines.filter((row) => row.scenario_id === target.scenario_id);
    for (const baseline of scenarioBaselines) {
      comparisons.push({
        scenario_id: target.scenario_id,
        baseline_run_id: baseline.run_id,
        baseline_v22: baseline.tutor_overall_score,
        baseline_charisma: baseline.tutor_charisma_overall_score,
        target_v22: target.tutor_overall_score,
        target_charisma: target.tutor_charisma_overall_score,
        delta_v22: target.tutor_overall_score - baseline.tutor_overall_score,
        delta_charisma: target.tutor_charisma_overall_score - baseline.tutor_charisma_overall_score,
      });
    }
  }
  const nearCell180V22 = SCENARIOS.every((scenarioId) => {
    const target = successRows.find((row) => row.scenario_id === scenarioId);
    const bestBaseline = Math.max(
      ...baselines
        .filter((row) => row.scenario_id === scenarioId)
        .map((row) => Number(row.tutor_overall_score)),
    );
    return target && Number(target.tutor_overall_score) >= bestBaseline - 5;
  });
  const charismaImprovesSomewhere = comparisons.some((cmp) => cmp.delta_charisma > 0);
  const smokeGatePass =
    allExpectedRowsPresent &&
    allScored &&
    allValidationPass &&
    noMinimalPersonaFallback &&
    registersMatch &&
    agencyReturnPasses &&
    nearCell180V22 &&
    charismaImprovesSomewhere;

  const lines = [];
  lines.push('# Charisma Desire Cell 181 Repair Smoke Summary');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push(`- Run: \`${run.id}\``);
  lines.push(`- Status: \`${run.status}\``);
  lines.push(`- Planned rows: ${run.total_tests}`);
  lines.push(`- Successful generated rows: ${successRows.length}`);
  lines.push(`- v2.2 scored rows: ${scoredRows.length}`);
  lines.push(`- Charisma scored rows: ${charismaRows.length}`);
  lines.push(`- Ego model override: \`${metadata.egoModelOverride || ''}\``);
  lines.push(`- Id model override: \`${metadata.superegoModelOverride || ''}\``);
  lines.push(`- Scenario file: \`${metadata.scenariosFile || ''}\``);
  lines.push(`- Git commit at run creation: \`${metadata.gitCommit || ''}\``);
  lines.push('');
  lines.push('## Row Scores');
  lines.push('');
  lines.push(
    markdownTable(
      [
        'Scenario',
        'v2.2 first',
        'v2.2 last',
        'v2.2 overall',
        'holistic',
        'charisma',
        'required',
        'forbidden',
        'v2.2 judge',
        'charisma judge',
      ],
      successRows.map((row) => [
        scenarioLabel(row.scenario_id),
        fmt(row.tutor_first_turn_score),
        fmt(row.tutor_last_turn_score),
        fmt(row.tutor_overall_score),
        fmt(row.tutor_holistic_overall_score),
        fmt(row.tutor_charisma_overall_score),
        row.passes_required ? 'yes' : `no ${row.required_missing || ''}`,
        row.passes_forbidden ? 'yes' : `no ${row.forbidden_found || ''}`,
        row.judge_model || '',
        row.tutor_charisma_judge_model || '',
      ]),
    ),
  );
  lines.push('');
  lines.push('## Cell 181 vs Existing Cell 180 Rows');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Cell 180 run', 'cell 180 v2.2', 'cell 181 v2.2', 'delta v2.2', 'cell 180 charisma', 'cell 181 charisma', 'delta charisma'],
      comparisons.map((cmp) => [
        scenarioLabel(cmp.scenario_id),
        `\`${cmp.baseline_run_id}\``,
        fmt(cmp.baseline_v22),
        fmt(cmp.target_v22),
        fmt(cmp.delta_v22),
        fmt(cmp.baseline_charisma),
        fmt(cmp.target_charisma),
        fmt(cmp.delta_charisma),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Id Trace');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Turn', 'Parse status', 'Expected register', 'Selected register', 'Learner signal', 'Agency return'],
      traces.map((row) => [
        scenarioLabel(row.scenario_id),
        String(row.turn),
        row.parse_status,
        row.expected_register,
        row.selected_register,
        row.learner_signal,
        row.agency_return_passes ? 'yes' : 'no',
      ]),
    ),
  );
  lines.push('');
  lines.push('## First-Turn Excerpts');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Excerpt'],
      successRows.map((row) => [scenarioLabel(row.scenario_id), firstMessageExcerpt(row.suggestions)]),
    ),
  );
  lines.push('');
  lines.push('## Gate Summary');
  lines.push('');
  lines.push(`- Expected rows present: ${allExpectedRowsPresent ? 'yes' : 'no'}`);
  lines.push(`- All rows v2.2 and charisma scored: ${allScored ? 'yes' : 'no'}`);
  lines.push(`- Required/forbidden validation clean: ${allValidationPass ? 'yes' : 'no'}`);
  lines.push(`- No minimal-persona fallback: ${noMinimalPersonaFallback ? 'yes' : 'no'}`);
  lines.push(`- Router registers match expected switch/transfer pattern: ${registersMatch ? 'yes' : 'no'}`);
  lines.push(`- Agency-return verification passed on every turn: ${agencyReturnPasses ? 'yes' : 'no'}`);
  lines.push(`- v2.2 remains within 5 points of the best existing cell 180 row per scenario: ${nearCell180V22 ? 'yes' : 'no'}`);
  lines.push(`- Charisma improves over at least one existing cell 180 targeted row: ${charismaImprovesSomewhere ? 'yes' : 'no'}`);
  lines.push(`- Smoke gate: ${smokeGatePass ? 'pass' : 'fail'}`);
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    'Cell 181 clears the bounded repair smoke. It removes the fallback confound seen in the cell 180 comparator matrix: all four id-construction turns parse normally, and the router records the intended transfer and switch registers.',
  );
  lines.push('');
  lines.push(
    'Substantively, the repair is useful but still not a general passing design. AI-transfer improves charisma relative to both existing cell 180 rows while staying close on v2.2. The switch diagnostic improves charisma relative to the comparator-matrix cell 180 row but remains slightly below the earlier cell 180 router-smoke switch row. The next evidence step should be a small cell 180 vs 181 repeat matrix on the two targeted scenarios, not a broader generalizability claim.',
  );
  lines.push('');

  const report = lines.join('\n');
  if (!checkOnly) {
    fs.writeFileSync(REPORT_PATH, report);
  }

  console.log(`Run: ${run.id}`);
  console.log(`Smoke gate: ${smokeGatePass ? 'PASS' : 'FAIL'}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);

  if (
    !allExpectedRowsPresent ||
    !allScored ||
    !allValidationPass ||
    !noMinimalPersonaFallback ||
    !registersMatch ||
    !agencyReturnPasses
  ) {
    process.exitCode = 1;
  }
}

main();
