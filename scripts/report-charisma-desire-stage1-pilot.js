#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_RUN_ID = 'eval-2026-06-25-dbae041a';
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-stage1-pilot-summary.md');

const TARGET_PROFILE = 'cell_169_id_director_charisma_accountable_bid_clean_floor_verified';
const PRIMARY_SCENARIOS = ['charisma_desire_authority_withheld', 'charisma_desire_status_challenge'];
const ROBUSTNESS_SCENARIOS = [
  'charisma_desire_conceptual_control',
  'charisma_desire_vulnerability_shift',
  'charisma_desire_ai_syllabus_transfer',
  'charisma_desire_plain_language_stress',
];

function profileLabel(profileName) {
  const match = /^cell_(\d+)/.exec(profileName || '');
  return match ? `cell ${match[1]}` : profileName;
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

function scenarioKind(scenarioId) {
  if (PRIMARY_SCENARIOS.includes(scenarioId)) return 'primary';
  if (ROBUSTNESS_SCENARIOS.includes(scenarioId)) return 'robustness';
  return 'other';
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

  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS rows,
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successful_rows,
         SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed_rows,
         SUM(CASE WHEN success = 1 AND tutor_first_turn_score IS NOT NULL THEN 1 ELSE 0 END) AS v22_scored_rows,
         SUM(CASE WHEN success = 1 AND tutor_charisma_overall_score IS NOT NULL THEN 1 ELSE 0 END) AS charisma_scored_rows
       FROM evaluation_results
       WHERE run_id = ?`,
    )
    .get(runId);

  const grouped = db
    .prepare(
      `SELECT
         scenario_id,
         profile_name,
         COUNT(*) AS n,
         ROUND(AVG(tutor_first_turn_score), 1) AS v22_first,
         ROUND(AVG(tutor_last_turn_score), 1) AS v22_last,
         ROUND(AVG(tutor_overall_score), 1) AS v22_overall,
         ROUND(AVG(tutor_charisma_overall_score), 1) AS charisma,
         SUM(CASE WHEN passes_required = 1 THEN 1 ELSE 0 END) AS required_ok,
         SUM(CASE WHEN passes_forbidden = 1 THEN 1 ELSE 0 END) AS forbidden_ok
       FROM evaluation_results
       WHERE run_id = ? AND success = 1
       GROUP BY scenario_id, profile_name
       ORDER BY scenario_id, profile_name`,
    )
    .all(runId);

  const primaryByProfile = db
    .prepare(
      `SELECT
         profile_name,
         COUNT(*) AS n,
         ROUND(AVG(tutor_first_turn_score), 1) AS v22_first,
         ROUND(AVG(tutor_last_turn_score), 1) AS v22_last,
         ROUND(AVG(tutor_overall_score), 1) AS v22_overall,
         ROUND(AVG(tutor_charisma_overall_score), 1) AS charisma,
         SUM(CASE WHEN passes_required = 1 THEN 1 ELSE 0 END) AS required_ok,
         SUM(CASE WHEN passes_forbidden = 1 THEN 1 ELSE 0 END) AS forbidden_ok
       FROM evaluation_results
       WHERE run_id = ?
         AND success = 1
         AND scenario_id IN (${PRIMARY_SCENARIOS.map(() => '?').join(',')})
       GROUP BY profile_name
       ORDER BY profile_name`,
    )
    .all(runId, ...PRIMARY_SCENARIOS);

  const failedRows = db
    .prepare(
      `SELECT id, scenario_id, profile_name, error_message
       FROM evaluation_results
       WHERE run_id = ? AND success = 0
       ORDER BY id`,
    )
    .all(runId);

  const targetPrimary = grouped.filter(
    (row) => row.profile_name === TARGET_PROFILE && PRIMARY_SCENARIOS.includes(row.scenario_id),
  );
  const targetRobustness = grouped.filter(
    (row) => row.profile_name === TARGET_PROFILE && ROBUSTNESS_SCENARIOS.includes(row.scenario_id),
  );
  const targetPrimaryValidationClean = targetPrimary.every((row) => row.required_ok === row.n && row.forbidden_ok === row.n);
  const targetWeakRobustness = targetRobustness.filter((row) => Number(row.v22_first) < 80 || Number(row.charisma) < 70);

  const metadata = JSON.parse(run.metadata || '{}');
  const lines = [];
  lines.push('# Charisma Desire Stage 1 Pilot Summary');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push(`- Run: \`${run.id}\``);
  lines.push(`- Status: \`${run.status}\``);
  lines.push(`- Planned rows: ${run.total_tests}`);
  lines.push(`- Successful generated rows: ${totals.successful_rows}`);
  lines.push(`- Retained infra-failure rows: ${totals.failed_rows}`);
  lines.push(`- v2.2 scored successful rows: ${totals.v22_scored_rows}`);
  lines.push(`- Charisma scored successful rows: ${totals.charisma_scored_rows}`);
  lines.push(`- Ego model override: \`${metadata.egoModelOverride || ''}\``);
  lines.push(`- Id model override: \`${metadata.superegoModelOverride || ''}\``);
  lines.push(`- Scenario file: \`${metadata.scenariosFile || ''}\``);
  lines.push(`- Git commit at run creation: \`${metadata.gitCommit || ''}\``);
  lines.push('');
  lines.push('## Primary Decision Scenarios');
  lines.push('');
  lines.push(
    markdownTable(
      ['Profile', 'n', 'v2.2 first', 'v2.2 last', 'v2.2 overall', 'charisma', 'required', 'forbidden'],
      primaryByProfile.map((row) => [
        profileLabel(row.profile_name),
        row.n,
        fmt(row.v22_first),
        fmt(row.v22_last),
        fmt(row.v22_overall),
        fmt(row.charisma),
        `${row.required_ok}/${row.n}`,
        `${row.forbidden_ok}/${row.n}`,
      ]),
    ),
  );
  lines.push('');
  lines.push('## Scenario x Profile Detail');
  lines.push('');
  lines.push(
    markdownTable(
      ['Kind', 'Scenario', 'Profile', 'n', 'v2.2 first', 'v2.2 last', 'v2.2 overall', 'charisma', 'required', 'forbidden'],
      grouped.map((row) => [
        scenarioKind(row.scenario_id),
        row.scenario_id.replace('charisma_desire_', ''),
        profileLabel(row.profile_name),
        row.n,
        fmt(row.v22_first),
        fmt(row.v22_last),
        fmt(row.v22_overall),
        fmt(row.charisma),
        `${row.required_ok}/${row.n}`,
        `${row.forbidden_ok}/${row.n}`,
      ]),
    ),
  );
  lines.push('');
  lines.push('## Infra Failures');
  lines.push('');
  if (failedRows.length === 0) {
    lines.push('No retained failed rows.');
  } else {
    lines.push(
      markdownTable(
        ['Row', 'Scenario', 'Profile', 'Error'],
        failedRows.map((row) => [row.id, row.scenario_id, profileLabel(row.profile_name), row.error_message || '']),
      ),
    );
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    `Cell 169 is clean on the primary validation gate: ${targetPrimaryValidationClean ? 'yes' : 'no'} (${targetPrimary
      .map((row) => `${row.scenario_id.replace('charisma_desire_', '')} ${row.required_ok}/${row.n} required, ${row.forbidden_ok}/${row.n} forbidden`)
      .join('; ')}).`,
  );
  lines.push('');
  lines.push(
    'Cell 169 remains competitive in the primary authority-refusal scenarios, especially on the charisma judge, but it does not justify a general charismatic-tutoring claim. It supports the narrower claim that accountable-bid charisma generalizes across the two tested simulated authority-refusal scenarios under this model stack.',
  );
  lines.push('');
  if (targetWeakRobustness.length > 0) {
    lines.push('Weak target robustness rows:');
    lines.push('');
    for (const row of targetWeakRobustness) {
      lines.push(
        `- \`${row.scenario_id}\`: v2.2 first ${fmt(row.v22_first)}, charisma ${fmt(row.charisma)}, v2.2 overall ${fmt(row.v22_overall)}.`,
      );
    }
    lines.push('');
  }
  lines.push(
    'The next design target is a transfer/plain-language floor: preserve the accountable-bid authority stance while staying inside the learner-requested domain and register. The generated AI-syllabus transfer case is the clearest failure mode; plain-language stress is the secondary failure mode.',
  );
  lines.push('');
  lines.push('## Reproduction');
  lines.push('');
  lines.push('```bash');
  lines.push(`node scripts/report-charisma-desire-stage1-pilot.js ${runId}`);
  lines.push('```');
  lines.push('');

  const report = `${lines.join('\n').trimEnd()}\n`;
  if (!checkOnly) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, report);
    console.log(`Wrote ${path.relative(ROOT, REPORT_PATH)}`);
  }
  console.log(
    `Stage 1 ${runId}: ${totals.successful_rows} successes, ${totals.v22_scored_rows} v2.2 scored, ${totals.charisma_scored_rows} charisma scored.`,
  );
  if (!targetPrimaryValidationClean) process.exitCode = 1;
}

main();
