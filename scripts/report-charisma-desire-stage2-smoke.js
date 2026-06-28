#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_RUN_ID = 'eval-2026-06-25-dea673e5';
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-stage2-smoke-summary.md');

const BASELINE_PROFILE = 'cell_169_id_director_charisma_accountable_bid_clean_floor_verified';
const TARGET_PROFILE = 'cell_170_id_director_charisma_accountable_bid_transfer_plain_floor_verified';
const SCENARIOS = ['charisma_desire_ai_syllabus_transfer', 'charisma_desire_plain_language_stress'];
const HISTORICAL_PROFILE_RENAMES = new Map([
  ['cell_174_id_director_charisma_accountable_bid_transfer_plain_floor_verified',
   'cell_170_id_director_charisma_accountable_bid_transfer_plain_floor_verified'],
  ['cell_175_id_director_charisma_accountable_bid_transfer_plain_presence_floor_verified',
   'cell_171_id_director_charisma_accountable_bid_transfer_plain_presence_floor_verified'],
  ['cell_176_id_director_charisma_accountable_bid_transfer_plain_split_floor_verified',
   'cell_172_id_director_charisma_accountable_bid_transfer_plain_split_floor_verified'],
  ['cell_177_id_director_charisma_accountable_bid_transfer_plain_split_check_floor_verified',
   'cell_173_id_director_charisma_accountable_bid_transfer_plain_split_check_floor_verified'],
  ['cell_178_id_director_charisma_accountable_bid_transfer_plain_split_check_anchor_floor_verified',
   'cell_174_id_director_charisma_accountable_bid_transfer_plain_split_check_anchor_floor_verified'],
  ['cell_179_id_director_charisma_accountable_bid_transfer_plain_split_check_anchor_live_floor_verified',
   'cell_175_id_director_charisma_accountable_bid_transfer_plain_split_check_anchor_live_floor_verified'],
  ['cell_180_id_director_charisma_accountable_bid_transfer_plain_split_check_anchor_live_persist_floor_verified',
   'cell_176_id_director_charisma_accountable_bid_transfer_plain_split_check_anchor_live_persist_floor_verified'],
]);

function canonicalizeRow(row) {
  const profile_name = HISTORICAL_PROFILE_RENAMES.get(row.profile_name) || row.profile_name;
  return profile_name === row.profile_name ? row : { ...row, profile_name };
}

function profileLabel(profileName) {
  const match = /^cell_(\d+)/.exec(profileName || '');
  return match ? `cell ${match[1]}` : profileName;
}

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

function firstMessageExcerpt(rawSuggestions) {
  try {
    const parsed = JSON.parse(rawSuggestions || '[]');
    const message = Array.isArray(parsed) ? parsed[0]?.message : parsed?.message;
    return String(message || '')
      .replace(/\s+/g, ' ')
      .slice(0, 220);
  } catch {
    return '';
  }
}

function getRows(db, runId) {
  return db
    .prepare(
      `SELECT
         id,
         scenario_id,
         profile_name,
         suggestions,
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
}

function compareByScenario(rows) {
  return SCENARIOS.map((scenarioId) => {
    const baseline = rows.find((row) => row.scenario_id === scenarioId && row.profile_name === BASELINE_PROFILE);
    const target = rows.find((row) => row.scenario_id === scenarioId && row.profile_name === TARGET_PROFILE);
    return {
      scenarioId,
      baseline,
      target,
      deltaV22: target && baseline ? target.tutor_overall_score - baseline.tutor_overall_score : null,
      deltaCharisma:
        target && baseline ? target.tutor_charisma_overall_score - baseline.tutor_charisma_overall_score : null,
      deltaFirst: target && baseline ? target.tutor_first_turn_score - baseline.tutor_first_turn_score : null,
    };
  });
}

function main() {
  const runId = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || DEFAULT_RUN_ID;
  const checkOnly = process.argv.includes('--check');
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  const run = db
    .prepare(
      `SELECT id, status, total_tests, total_configurations, total_scenarios, created_at, completed_at, metadata
       FROM evaluation_runs
       WHERE id = ?`,
    )
    .get(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  const rows = getRows(db, runId).map(canonicalizeRow);
  const successRows = rows.filter((row) => row.success === 1);
  const scoredRows = successRows.filter((row) => row.tutor_first_turn_score != null);
  const charismaRows = successRows.filter((row) => row.tutor_charisma_overall_score != null);
  const comparisons = compareByScenario(successRows);
  const metadata = JSON.parse(run.metadata || '{}');

  const allExpectedRowsPresent =
    successRows.length === 4 &&
    SCENARIOS.every((scenarioId) =>
      [BASELINE_PROFILE, TARGET_PROFILE].every((profileName) =>
        successRows.some((row) => row.scenario_id === scenarioId && row.profile_name === profileName),
      ),
    );
  const allScored = scoredRows.length === 4 && charismaRows.length === 4;
  const allValidationPass = successRows.every((row) => row.passes_required === 1 && row.passes_forbidden === 1);
  const targetV22Wins = comparisons.every((cmp) => cmp.deltaV22 != null && cmp.deltaV22 > 0);
  const targetCharismaWins = comparisons.every((cmp) => cmp.deltaCharisma != null && cmp.deltaCharisma > 0);

  const lines = [];
  lines.push('# Charisma Desire Stage 2 Smoke Summary');
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
        'Profile',
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
        profileLabel(row.profile_name),
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
  lines.push('## Cell 170 vs Cell 169');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'delta v2.2 first', 'delta v2.2 overall', 'delta charisma', 'Interpretation'],
      comparisons.map((cmp) => [
        scenarioLabel(cmp.scenarioId),
        fmt(cmp.deltaFirst),
        fmt(cmp.deltaV22),
        fmt(cmp.deltaCharisma),
        cmp.deltaV22 > 0 && cmp.deltaCharisma < 0 ? 'transfer validity up, charisma down' : 'mixed',
      ]),
    ),
  );
  lines.push('');
  lines.push('## First-Turn Excerpts');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Profile', 'Excerpt'],
      successRows.map((row) => [scenarioLabel(row.scenario_id), profileLabel(row.profile_name), firstMessageExcerpt(row.suggestions)]),
    ),
  );
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    'Cell 170 is a clean Stage 2 transfer-validity improvement over cell 169, not a general passing design. It raises v2.2 tutor overall on both targeted weak scenarios and sharply improves the AI-syllabus transfer first turn, using the learner-named campus FAQ material as the authority test.',
  );
  lines.push('');
  lines.push(
    'The tradeoff is clear: the Claude charisma judge scores cell 170 lower than cell 169 on both scenarios. The new guard makes the tutor more accountable and domain-bound, but it also flattens charismatic force, especially in the plain-language stress case.',
  );
  lines.push('');
  lines.push(
    'Next design target: preserve the transfer/plain-language guard while restoring low-register charismatic presence. The likely design knob is not more recognition theory; it is a concise, concrete authority move with stakes, compression, and rhythm inside the learner-named material.',
  );
  lines.push('');
  lines.push('## Check Summary');
  lines.push('');
  lines.push(`- Expected rows present: ${allExpectedRowsPresent ? 'yes' : 'no'}`);
  lines.push(`- All rows v2.2 and charisma scored: ${allScored ? 'yes' : 'no'}`);
  lines.push(`- Required/forbidden validation clean: ${allValidationPass ? 'yes' : 'no'}`);
  lines.push(`- Cell 170 beats cell 169 on v2.2 overall in both scenarios: ${targetV22Wins ? 'yes' : 'no'}`);
  lines.push(`- Cell 170 beats cell 169 on charisma in both scenarios: ${targetCharismaWins ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Reproduction');
  lines.push('');
  lines.push('```bash');
  lines.push(`node scripts/report-charisma-desire-stage2-smoke.js ${runId}`);
  lines.push('```');
  lines.push('');

  const report = `${lines.join('\n').trimEnd()}\n`;
  if (!checkOnly) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, report);
    console.log(`Wrote ${path.relative(ROOT, REPORT_PATH)}`);
  }

  console.log(
    `Stage 2 ${runId}: ${successRows.length} successes, ${scoredRows.length} v2.2 scored, ${charismaRows.length} charisma scored.`,
  );
  if (!allExpectedRowsPresent || !allScored || !allValidationPass || !targetV22Wins) process.exitCode = 1;
}

main();
