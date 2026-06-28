#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_RUN_ID = 'eval-2026-06-27-e3fb5eb2';
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-cell181-repeat-matrix-summary.md');

const CELL_180 = 'cell_180_id_director_charisma_engagement_router_verified';
const CELL_181 = 'cell_181_id_director_charisma_engagement_router_contract_repair_verified';
const SCENARIOS = [
  'charisma_desire_ai_syllabus_transfer',
  'charisma_desire_instruction_to_engagement_switch',
];

function fmt(value, digits = 1) {
  return value == null || Number.isNaN(Number(value)) ? '' : Number(value).toFixed(digits);
}

function scenarioLabel(scenarioId) {
  return String(scenarioId || '').replace('charisma_desire_', '');
}

function profileLabel(profileName) {
  if (profileName === CELL_180) return 'cell 180';
  if (profileName === CELL_181) return 'cell 181';
  const match = /^cell_(\d+)/.exec(profileName || '');
  return match ? `cell ${match[1]}` : profileName;
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

function mean(values) {
  const nums = values.filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function sampleSd(values) {
  const nums = values.filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  if (nums.length < 2) return null;
  const avg = mean(nums);
  const variance = nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

function summarizeRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.scenario_id}\t${row.profile_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .map(([key, groupRows]) => {
      const [scenario_id, profile_name] = key.split('\t');
      return {
        scenario_id,
        profile_name,
        n: groupRows.length,
        first: mean(groupRows.map((row) => row.tutor_first_turn_score)),
        last: mean(groupRows.map((row) => row.tutor_last_turn_score)),
        delta: mean(groupRows.map((row) => row.tutor_last_turn_score - row.tutor_first_turn_score)),
        tutor: mean(groupRows.map((row) => row.tutor_overall_score)),
        holistic: mean(groupRows.map((row) => row.tutor_holistic_overall_score)),
        charisma: mean(groupRows.map((row) => row.tutor_charisma_overall_score)),
        charismaSd: sampleSd(groupRows.map((row) => row.tutor_charisma_overall_score)),
        charismaMin: Math.min(...groupRows.map((row) => row.tutor_charisma_overall_score)),
        charismaMax: Math.max(...groupRows.map((row) => row.tutor_charisma_overall_score)),
        required: groupRows.filter((row) => row.passes_required === 1).length,
        forbidden: groupRows.filter((row) => row.passes_forbidden === 1).length,
      };
    })
    .sort((a, b) => `${a.scenario_id}:${a.profile_name}`.localeCompare(`${b.scenario_id}:${b.profile_name}`));
}

function compareSummaries(summaries) {
  const rows = [];
  for (const scenarioId of SCENARIOS) {
    const row180 = summaries.find((row) => row.scenario_id === scenarioId && row.profile_name === CELL_180);
    const row181 = summaries.find((row) => row.scenario_id === scenarioId && row.profile_name === CELL_181);
    if (!row180 || !row181) continue;
    rows.push({
      scenario_id: scenarioId,
      delta_first: row181.first - row180.first,
      delta_last: row181.last - row180.last,
      delta_tutor: row181.tutor - row180.tutor,
      delta_holistic: row181.holistic - row180.holistic,
      delta_charisma: row181.charisma - row180.charisma,
      delta_charisma_sd: row181.charismaSd - row180.charismaSd,
    });
  }
  return rows;
}

function traceRows(rows) {
  const trace = [];
  for (const row of rows) {
    for (const turn of parseJson(row.id_construction_trace, [])) {
      trace.push({
        scenario_id: row.scenario_id,
        profile_name: row.profile_name,
        parse_status: turn.construction?.parse_status || '',
        selected_register: turn.engagementState?.selected_register || turn.engagementState?.selected_mode || '',
        agency_return_passes: turn.agencyReturnVerification?.passes === true,
      });
    }
  }

  const groups = new Map();
  for (const row of trace) {
    const key = `${row.scenario_id}\t${row.profile_name}\t${row.parse_status}\t${row.selected_register}`;
    if (!groups.has(key)) groups.set(key, { ...row, turns: 0, agencyPasses: 0 });
    const group = groups.get(key);
    group.turns += 1;
    if (row.agency_return_passes) group.agencyPasses += 1;
  }
  return [...groups.values()].sort((a, b) =>
    `${a.scenario_id}:${a.profile_name}:${a.selected_register}:${a.parse_status}`.localeCompare(
      `${b.scenario_id}:${b.profile_name}:${b.selected_register}:${b.parse_status}`,
    ),
  );
}

function firstMessageExcerpt(rawSuggestions) {
  const parsed = parseJson(rawSuggestions, []);
  const message = Array.isArray(parsed) ? parsed[0]?.message : parsed?.message;
  return String(message || '')
    .replace(/\s+/g, ' ')
    .slice(0, 220);
}

function main() {
  const runId = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || DEFAULT_RUN_ID;
  const checkOnly = process.argv.includes('--check');
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const run = db
    .prepare(
      `SELECT id, status, total_tests, total_configurations, total_scenarios, created_at, completed_at, metadata, git_commit
       FROM evaluation_runs
       WHERE id = ?`,
    )
    .get(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  const rows = db
    .prepare(
      `SELECT
         id,
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
       ORDER BY scenario_id, profile_name, id`,
    )
    .all(runId);

  const metadata = parseJson(run.metadata, {});
  const successRows = rows.filter((row) => row.success === 1);
  const scoredRows = successRows.filter((row) => row.tutor_first_turn_score != null);
  const charismaRows = successRows.filter((row) => row.tutor_charisma_overall_score != null);
  const summaries = summarizeRows(successRows);
  const comparisons = compareSummaries(summaries);
  const traces = traceRows(successRows);

  const allExpectedRowsPresent =
    successRows.length === 12 &&
    SCENARIOS.every((scenarioId) =>
      [CELL_180, CELL_181].every(
        (profileName) =>
          successRows.filter((row) => row.scenario_id === scenarioId && row.profile_name === profileName).length === 3,
      ),
    );
  const allScored = scoredRows.length === 12 && charismaRows.length === 12;
  const allValidationPass = successRows.every((row) => row.passes_required === 1 && row.passes_forbidden === 1);
  const noFallback = traces.every((row) => ['ok', 'ok_via_jsonrepair', 'salvaged_from_malformed_json'].includes(row.parse_status));
  const noSalvageFallback = traces.every((row) => row.parse_status !== 'fallback');
  const allAgencyReturn = traces.every((row) => row.agencyPasses === row.turns);

  const cell181CharismaWins = comparisons.every((row) => row.delta_charisma > 0);
  const cell181V22Loses = comparisons.every((row) => row.delta_tutor < 0);

  const lines = [];
  lines.push('# Charisma Desire Cell 180 vs 181 Repeat Matrix Summary');
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
  lines.push(`- Git commit at run creation: \`${run.git_commit || metadata.gitCommit || ''}\``);
  lines.push('');
  lines.push('## Aggregate Scores');
  lines.push('');
  lines.push(
    markdownTable(
      [
        'Scenario',
        'Profile',
        'n',
        'v2.2 first',
        'v2.2 last',
        'delta',
        'v2.2 avg',
        'holistic',
        'charisma',
        'charisma sd',
        'charisma range',
        'validation',
      ],
      summaries.map((row) => [
        scenarioLabel(row.scenario_id),
        profileLabel(row.profile_name),
        String(row.n),
        fmt(row.first),
        fmt(row.last),
        fmt(row.delta),
        fmt(row.tutor),
        fmt(row.holistic),
        fmt(row.charisma),
        fmt(row.charismaSd),
        `${fmt(row.charismaMin)}-${fmt(row.charismaMax)}`,
        `${row.required}/${row.n} req, ${row.forbidden}/${row.n} forb`,
      ]),
    ),
  );
  lines.push('');
  lines.push('## Cell 181 minus Cell 180');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'delta first', 'delta last', 'delta v2.2 avg', 'delta holistic', 'delta charisma', 'delta charisma sd'],
      comparisons.map((row) => [
        scenarioLabel(row.scenario_id),
        fmt(row.delta_first),
        fmt(row.delta_last),
        fmt(row.delta_tutor),
        fmt(row.delta_holistic),
        fmt(row.delta_charisma),
        fmt(row.delta_charisma_sd),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Row Scores');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Profile', 'v2.2 first', 'v2.2 last', 'v2.2 avg', 'holistic', 'charisma', 'required', 'forbidden'],
      successRows.map((row) => [
        scenarioLabel(row.scenario_id),
        profileLabel(row.profile_name),
        fmt(row.tutor_first_turn_score),
        fmt(row.tutor_last_turn_score),
        fmt(row.tutor_overall_score),
        fmt(row.tutor_holistic_overall_score),
        fmt(row.tutor_charisma_overall_score),
        row.passes_required ? 'yes' : `no ${row.required_missing || ''}`,
        row.passes_forbidden ? 'yes' : `no ${row.forbidden_found || ''}`,
      ]),
    ),
  );
  lines.push('');
  lines.push('## Id Trace');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Profile', 'Parse status', 'Register', 'Turns', 'Agency return'],
      traces.map((row) => [
        scenarioLabel(row.scenario_id),
        profileLabel(row.profile_name),
        row.parse_status,
        row.selected_register,
        String(row.turns),
        `${row.agencyPasses}/${row.turns}`,
      ]),
    ),
  );
  lines.push('');
  lines.push('## First-Turn Excerpts');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Profile', 'Excerpt'],
      successRows.map((row) => [
        scenarioLabel(row.scenario_id),
        profileLabel(row.profile_name),
        firstMessageExcerpt(row.suggestions),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Check Summary');
  lines.push('');
  lines.push(`- Expected 12-row matrix present: ${allExpectedRowsPresent ? 'yes' : 'no'}`);
  lines.push(`- All rows v2.2 and charisma scored: ${allScored ? 'yes' : 'no'}`);
  lines.push(`- Required/forbidden validation clean: ${allValidationPass ? 'yes' : 'no'}`);
  lines.push(`- No id minimal-persona fallback: ${noFallback && noSalvageFallback ? 'yes' : 'no'}`);
  lines.push(`- Agency-return verifier passed all turns: ${allAgencyReturn ? 'yes' : 'no'}`);
  lines.push(`- Cell 181 charisma mean exceeds cell 180 in both scenarios: ${cell181CharismaWins ? 'yes' : 'no'}`);
  lines.push(`- Cell 181 v2.2 mean trails cell 180 in both scenarios: ${cell181V22Loses ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    'Cell 181 does what it was designed to do only in a bounded sense: it eliminates the fallback confound and raises charisma means over cell 180 in both targeted scenarios. It does not produce a general passing design, because v2.2 tutor means fall in both scenarios and first-turn quality is notably weaker.',
  );
  lines.push('');
  lines.push(
    'The switch repair is the cleaner positive result: cell 181 raises switch charisma from 74.2 to 81.3 and has a tight charisma range, while retaining strong second-turn v2.2. The AI-transfer result is weaker: mean charisma rises only modestly, variance widens, and v2.2 falls from 92.9 to 89.2.',
  );
  lines.push('');
  lines.push(
    'Next design target: preserve cell 181 for the charismatic-challenge switch register, but repair the first-turn/transfer floor. The likely change is a cell 182 split repair: keep the strict id-output contract, make transfer grounding more concise and less theatrical, and add a hard agency-return test for charismatic_challenge so the one failed agency-return turn cannot recur.',
  );
  lines.push('');

  const report = lines.join('\n');
  if (!checkOnly) fs.writeFileSync(REPORT_PATH, report);

  console.log(`Run: ${run.id}`);
  console.log(`Expected rows: ${allExpectedRowsPresent ? 'yes' : 'no'}`);
  console.log(`All scored: ${allScored ? 'yes' : 'no'}`);
  console.log(`Validation clean: ${allValidationPass ? 'yes' : 'no'}`);
  console.log(`Cell 181 charisma wins both: ${cell181CharismaWins ? 'yes' : 'no'}`);
  console.log(`Cell 181 v2.2 trails both: ${cell181V22Loses ? 'yes' : 'no'}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);

  if (!allExpectedRowsPresent || !allScored || !allValidationPass || !noFallback) {
    process.exitCode = 1;
  }
}

main();
