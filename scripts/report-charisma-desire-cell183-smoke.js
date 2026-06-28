#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_RUN_ID = 'eval-2026-06-27-49aeaa2c';
const CELL_181_REPEAT_RUN_ID = 'eval-2026-06-27-e3fb5eb2';
const CELL_182_RUN_ID = 'eval-2026-06-27-a07768fe';
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-cell183-smoke-summary.md');

const CELL_180 = 'cell_180_id_director_charisma_engagement_router_verified';
const CELL_181 = 'cell_181_id_director_charisma_engagement_router_contract_repair_verified';
const CELL_182 = 'cell_182_id_director_charisma_engagement_router_split_repair_verified';
const CELL_183 = 'cell_183_id_director_charisma_engagement_router_transfer_stake_repair_verified';
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
  if (profileName === CELL_180) return 'cell 180 repeat mean';
  if (profileName === CELL_181) return 'cell 181 repeat mean';
  if (profileName === CELL_182) return 'cell 182 smoke';
  if (profileName === CELL_183) return 'cell 183 smoke';
  return profileName || '';
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

function firstMessageExcerpt(rawSuggestions) {
  const parsed = parseJson(rawSuggestions, []);
  const message = Array.isArray(parsed) ? parsed[0]?.message : parsed?.message;
  return String(message || '')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

function cleanCell(value, maxLength = 220) {
  return String(value || '')
    .replace(/\|/g, '/')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '-')
    .slice(0, maxLength);
}

function getRows(db, runId, profiles) {
  const placeholders = profiles.map(() => '?').join(',');
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
         AND profile_name IN (${placeholders})
       ORDER BY scenario_id, profile_name, id`,
    )
    .all(runId, ...profiles);
}

function summarize(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.scenario_id}\t${row.profile_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const [scenario_id, profile_name] = key.split('\t');
      return {
        scenario_id,
        profile_name,
        n: group.length,
        first: mean(group.map((row) => row.tutor_first_turn_score)),
        last: mean(group.map((row) => row.tutor_last_turn_score)),
        tutor: mean(group.map((row) => row.tutor_overall_score)),
        holistic: mean(group.map((row) => row.tutor_holistic_overall_score)),
        charisma: mean(group.map((row) => row.tutor_charisma_overall_score)),
        required: group.filter((row) => row.passes_required === 1).length,
        forbidden: group.filter((row) => row.passes_forbidden === 1).length,
      };
    })
    .sort((a, b) => `${a.scenario_id}:${a.profile_name}`.localeCompare(`${b.scenario_id}:${b.profile_name}`));
}

function traceRows(rows) {
  const trace = [];
  for (const row of rows) {
    for (const turn of parseJson(row.id_construction_trace, [])) {
      trace.push({
        scenario_id: row.scenario_id,
        turn: Number(turn.turn),
        parse_status: turn.construction?.parse_status || '',
        selected_register: turn.engagementState?.selected_register || turn.engagementState?.selected_mode || '',
        learner_signal: turn.engagementState?.learner_signal || '',
        agency_return_passes: turn.agencyReturnVerification?.passes === true,
        agency_reason: turn.agencyReturnVerification?.reason || '',
      });
    }
  }
  return trace.sort((a, b) => `${a.scenario_id}:${a.turn}`.localeCompare(`${b.scenario_id}:${b.turn}`));
}

function compareTargetTo(referenceSummaries, targetSummaries, referenceProfiles) {
  const comparisons = [];
  for (const target of targetSummaries) {
    for (const refProfile of referenceProfiles) {
      const ref = referenceSummaries.find(
        (row) => row.scenario_id === target.scenario_id && row.profile_name === refProfile,
      );
      if (!ref) continue;
      comparisons.push({
        scenario_id: target.scenario_id,
        ref_profile: refProfile,
        ref_tutor: ref.tutor,
        target_tutor: target.tutor,
        delta_tutor: target.tutor - ref.tutor,
        ref_charisma: ref.charisma,
        target_charisma: target.charisma,
        delta_charisma: target.charisma - ref.charisma,
      });
    }
  }
  return comparisons;
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

  const targetRows = getRows(db, runId, [CELL_183]).filter((row) => row.success === 1);
  const repeatRows = getRows(db, CELL_181_REPEAT_RUN_ID, [CELL_180, CELL_181]).filter((row) => row.success === 1);
  const cell182Rows = getRows(db, CELL_182_RUN_ID, [CELL_182]).filter((row) => row.success === 1);
  const targetSummary = summarize(targetRows);
  const repeatSummary = summarize(repeatRows);
  const cell182Summary = summarize(cell182Rows);
  const traces = traceRows(targetRows);
  const metadata = parseJson(run.metadata, {});

  const allRowsPresent =
    targetRows.length === 2 && SCENARIOS.every((scenarioId) => targetRows.some((row) => row.scenario_id === scenarioId));
  const allScored =
    targetRows.length === 2 &&
    targetRows.every((row) => row.tutor_first_turn_score != null && row.tutor_charisma_overall_score != null);
  const validationClean = targetRows.every((row) => row.passes_required === 1 && row.passes_forbidden === 1);
  const noFallback = traces.every((row) => ['ok', 'ok_via_jsonrepair', 'salvaged_from_malformed_json'].includes(row.parse_status));
  const agencyReturnClean = traces.every((row) => row.agency_return_passes);

  const repeatComparisons = compareTargetTo(repeatSummary, targetSummary, [CELL_180, CELL_181]);
  const cell182Comparisons = compareTargetTo(cell182Summary, targetSummary, [CELL_182]);
  const transferTarget = targetSummary.find((row) => row.scenario_id === 'charisma_desire_ai_syllabus_transfer');
  const transferCell182 = cell182Summary.find((row) => row.scenario_id === 'charisma_desire_ai_syllabus_transfer');
  const transferCharismaRecovered =
    transferTarget?.charisma != null && transferCell182?.charisma != null && transferTarget.charisma > transferCell182.charisma;

  const lines = [];
  lines.push('# Charisma Desire Cell 183 Smoke Summary');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push(`- Run: \`${run.id}\``);
  lines.push(`- Status: \`${run.status}\``);
  lines.push(`- Planned rows: ${run.total_tests}`);
  lines.push(`- Successful generated rows: ${targetRows.length}`);
  lines.push(`- v2.2 scored rows: ${targetRows.filter((row) => row.tutor_first_turn_score != null).length}`);
  lines.push(`- Charisma scored rows: ${targetRows.filter((row) => row.tutor_charisma_overall_score != null).length}`);
  lines.push(`- Ego model override: \`${metadata.egoModelOverride || ''}\``);
  lines.push(`- Id model override: \`${metadata.superegoModelOverride || ''}\``);
  lines.push(`- Scenario file: \`${metadata.scenariosFile || ''}\``);
  lines.push(`- Git commit at run creation: \`${run.git_commit || metadata.gitCommit || ''}\``);
  lines.push('');
  lines.push('## Row Scores');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'v2.2 first', 'v2.2 last', 'v2.2 avg', 'holistic', 'charisma', 'required', 'forbidden'],
      targetRows.map((row) => [
        scenarioLabel(row.scenario_id),
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
  lines.push('## Against Cell 182 Smoke');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'cell 182 v2.2', 'cell 183 v2.2', 'delta v2.2', 'cell 182 charisma', 'cell 183 charisma', 'delta charisma'],
      cell182Comparisons.map((row) => [
        scenarioLabel(row.scenario_id),
        fmt(row.ref_tutor),
        fmt(row.target_tutor),
        fmt(row.delta_tutor),
        fmt(row.ref_charisma),
        fmt(row.target_charisma),
        fmt(row.delta_charisma),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Against Repeat-Matrix Means');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Reference', 'ref v2.2', 'cell 183 v2.2', 'delta v2.2', 'ref charisma', 'cell 183 charisma', 'delta charisma'],
      repeatComparisons.map((row) => [
        scenarioLabel(row.scenario_id),
        profileLabel(row.ref_profile),
        fmt(row.ref_tutor),
        fmt(row.target_tutor),
        fmt(row.delta_tutor),
        fmt(row.ref_charisma),
        fmt(row.target_charisma),
        fmt(row.delta_charisma),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Id Trace');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Turn', 'Parse status', 'Register', 'Learner signal', 'Agency return', 'Verifier reason'],
      traces.map((row) => [
        scenarioLabel(row.scenario_id),
        String(row.turn),
        row.parse_status,
        row.selected_register,
        row.learner_signal,
        row.agency_return_passes ? 'yes' : 'no',
        cleanCell(row.agency_reason),
      ]),
    ),
  );
  lines.push('');
  lines.push('## First-Turn Excerpts');
  lines.push('');
  lines.push(
    markdownTable(
      ['Scenario', 'Excerpt'],
      targetRows.map((row) => [scenarioLabel(row.scenario_id), firstMessageExcerpt(row.suggestions)]),
    ),
  );
  lines.push('');
  lines.push('## Check Summary');
  lines.push('');
  lines.push(`- Expected 2-row smoke present: ${allRowsPresent ? 'yes' : 'no'}`);
  lines.push(`- Both rows v2.2 and charisma scored: ${allScored ? 'yes' : 'no'}`);
  lines.push(`- Required/forbidden validation clean: ${validationClean ? 'yes' : 'no'}`);
  lines.push(`- No id minimal-persona fallback: ${noFallback ? 'yes' : 'no'}`);
  lines.push(`- Agency-return verifier passed all turns: ${agencyReturnClean ? 'yes' : 'no'}`);
  lines.push(`- Transfer charisma improved over cell 182: ${transferCharismaRecovered ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    'Cell 183 is a failed design smoke. Generation, scoring, required/forbidden validation, and id parsing all succeeded, but the named-stake repair did not restore the AI-transfer charisma signal and one switch challenge turn failed the agency-return verifier.',
  );
  lines.push('');
  lines.push(
    "Relative to cell 182, AI-transfer fell from v2.2 95.6 to 90.0 and charisma fell from 55.0 to 51.2. The instruction-to-engagement switch stayed numerically adequate, with v2.2 90.0 and charisma 75.0, but that is lower than the cell 182 switch charisma of 87.5 and the trace flags a premature-certainty agency failure from the word 'exactly.' The next target should not add more stake language to transfer grounding; it should recover charisma through clearer register discipline, content-level compression, or a different transfer-specific authority cue while preserving cell 182's agency-return close.",
  );
  lines.push('');

  const report = lines.join('\n');
  if (!checkOnly) fs.writeFileSync(REPORT_PATH, report);

  console.log(`Run: ${run.id}`);
  console.log(`Expected rows: ${allRowsPresent ? 'yes' : 'no'}`);
  console.log(`All scored: ${allScored ? 'yes' : 'no'}`);
  console.log(`Validation clean: ${validationClean ? 'yes' : 'no'}`);
  console.log(`No fallback: ${noFallback ? 'yes' : 'no'}`);
  console.log(`Agency return clean: ${agencyReturnClean ? 'yes' : 'no'}`);
  console.log(`Transfer charisma improved over cell 182: ${transferCharismaRecovered ? 'yes' : 'no'}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);

  if (!allRowsPresent || !allScored || !validationClean || !noFallback || !agencyReturnClean) {
    process.exitCode = 1;
  }
}

main();
