#!/usr/bin/env node

/**
 * Read-only sensitivity and reliability report for a versioned measurement suite.
 * Makes no model calls and writes no database state.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import yaml from 'yaml';

import { analyzeRubricInstrument, extractScoreVectors } from '../services/rubricSensitivityAnalyzer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function option(argv, name, fallback = null) {
  const flag = `--${name}`;
  const index = argv.indexOf(flag);
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((value) => value.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : fallback;
}

function expandHome(value) {
  return value?.startsWith('~') ? path.join(os.homedir(), value.slice(1)) : value;
}

function loadYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeJson(value) {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function stableItemKey(row) {
  if (row.dialogue_content_hash) return row.dialogue_content_hash;
  if (row.suggestions == null || row.suggestions === '') return null;
  const source = typeof row.suggestions === 'string' ? row.suggestions : JSON.stringify(row.suggestions);
  return crypto.createHash('sha256').update(source).digest('hex');
}

function selectedColumn(columns, name) {
  return columns.has(name) ? name : `NULL AS ${name}`;
}

export function loadSensitivityRows({ dbPath, runs }) {
  const db = new Database(dbPath, { readonly: true });
  try {
    const columns = new Set(
      db
        .prepare('PRAGMA table_info(evaluation_results)')
        .all()
        .map((column) => column.name),
    );
    const requested = [
      'run_id',
      'scenario_id',
      'profile_name',
      'provider',
      'model',
      'judge_model',
      'learner_judge_model',
      'learner_holistic_judge_model',
      'tutor_holistic_judge_model',
      'dialogue_quality_judge_model',
      'tutor_deliberation_judge_model',
      'learner_deliberation_judge_model',
      'tutor_rubric_version',
      'learner_rubric_version',
      'dialogue_rubric_version',
      'deliberation_rubric_version',
      'dialogue_content_hash',
      'suggestions',
      'tutor_scores',
      'tutor_holistic_scores',
      'learner_scores',
      'learner_holistic_scores',
      'dialogue_quality_scores',
      'dialogue_quality_internal_scores',
      'tutor_deliberation_scores',
      'learner_deliberation_scores',
    ];
    const where = runs.length ? `WHERE run_id IN (${runs.map(() => '?').join(',')})` : '';
    return db
      .prepare(
        `SELECT ${requested.map((name) => selectedColumn(columns, name)).join(', ')} FROM evaluation_results ${where}`,
      )
      .all(...runs);
  } finally {
    db.close();
  }
}

function instrumentSpecs(rubricDir) {
  return [
    {
      id: 'tutor_turn_quality',
      scoreColumn: 'tutor_scores',
      versionColumn: 'tutor_rubric_version',
      judgeColumn: 'judge_model',
      rubric: loadYaml(path.join(rubricDir, 'evaluation-rubric.yaml')),
    },
    {
      id: 'tutor_trajectory',
      scoreColumn: 'tutor_holistic_scores',
      versionColumn: 'tutor_rubric_version',
      judgeColumn: 'tutor_holistic_judge_model',
      rubric: loadYaml(path.join(rubricDir, 'evaluation-rubric-tutor-holistic.yaml')),
    },
    {
      id: 'learner_turn_change',
      scoreColumn: 'learner_scores',
      versionColumn: 'learner_rubric_version',
      judgeColumn: 'learner_judge_model',
      rubric: loadYaml(path.join(rubricDir, 'evaluation-rubric-learner.yaml')),
    },
    {
      id: 'learner_trajectory_change',
      scoreColumn: 'learner_holistic_scores',
      versionColumn: 'learner_rubric_version',
      judgeColumn: 'learner_holistic_judge_model',
      rubric: loadYaml(path.join(rubricDir, 'evaluation-rubric-learner.yaml')),
    },
    {
      id: 'pedagogical_encounter_public',
      scoreColumn: 'dialogue_quality_scores',
      versionColumn: 'dialogue_rubric_version',
      judgeColumn: 'dialogue_quality_judge_model',
      rubric: loadYaml(path.join(rubricDir, 'evaluation-rubric-dialogue.yaml')),
    },
    {
      id: 'tutor_deliberation',
      scoreColumn: 'tutor_deliberation_scores',
      versionColumn: 'deliberation_rubric_version',
      judgeColumn: 'tutor_deliberation_judge_model',
      rubric: loadYaml(path.join(rubricDir, 'evaluation-rubric-deliberation.yaml')),
    },
    {
      id: 'learner_deliberation',
      scoreColumn: 'learner_deliberation_scores',
      versionColumn: 'deliberation_rubric_version',
      judgeColumn: 'learner_deliberation_judge_model',
      rubric: loadYaml(path.join(rubricDir, 'evaluation-rubric-deliberation.yaml')),
    },
  ];
}

export function analyzeSensitivityRows(rows, { rubricDir, version }) {
  const reports = {};
  for (const spec of instrumentSpecs(rubricDir)) {
    const dimensions = Object.keys(spec.rubric.dimensions || {});
    const observations = [];
    for (const row of rows) {
      if (String(row[spec.versionColumn] || '') !== version) continue;
      const payload = safeJson(row[spec.scoreColumn]);
      for (const vector of extractScoreVectors(payload, dimensions)) {
        observations.push({
          ...vector,
          itemKey: stableItemKey(row),
          scenario: row.scenario_id,
          profile: row.profile_name,
          generator: [row.provider, row.model].filter(Boolean).join('/') || row.profile_name,
          judge: row[spec.judgeColumn] || row.judge_model,
        });
      }
    }
    reports[spec.id] = analyzeRubricInstrument(observations, spec.rubric);
  }
  return reports;
}

function renderReport(result) {
  const lines = [
    `# Rubric v${result.version} sensitivity and reliability audit`,
    '',
    `Runs: ${result.runs.join(', ') || '(all v3.0 rows)'}`,
    `Database: ${result.db}`,
    'Enforcement: report only',
    '',
  ];
  for (const [id, report] of Object.entries(result.instruments)) {
    lines.push(`## ${id}`, '');
    lines.push(
      `Complete observations: ${report.observations_complete}/${report.observations_total}; scenarios=${report.coverage.scenarios}, generators=${report.coverage.candidate_generators}, judges=${report.coverage.judges}.`,
      '',
      '| Dimension | N | Mean | SD | Floor | Ceiling |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
    );
    for (const [dimension, stats] of Object.entries(report.dimensions)) {
      const pct = (value) => (value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`);
      const number = (value) => (value == null ? 'n/a' : value.toFixed(2));
      lines.push(
        `| ${dimension} | ${stats.n} | ${number(stats.mean)} | ${number(stats.standard_deviation)} | ${pct(stats.floor_rate)} | ${pct(stats.ceiling_rate)} |`,
      );
    }
    lines.push('');
    if (report.factor_structure) {
      lines.push(
        `Factor check: PC1 ${(report.factor_structure.pc1_share * 100).toFixed(1)}%; mean absolute inter-dimension r=${report.factor_structure.mean_absolute_interdimension_correlation.toFixed(3)}; eigenvalues=${report.factor_structure.eigenvalues.map((value) => value.toFixed(2)).join(', ')}.`,
        '',
      );
    } else {
      lines.push('Factor check: insufficient complete or varying observations.', '');
    }
    lines.push(
      `Same-item cross-judge pairs: ${report.cross_judge.n_pairs}; r=${report.cross_judge.pearson_r == null ? 'n/a' : report.cross_judge.pearson_r.toFixed(3)}; MAE=${report.cross_judge.mean_absolute_error == null ? 'n/a' : report.cross_judge.mean_absolute_error.toFixed(2)} points.`,
      '',
    );
  }
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      `Usage: node scripts/analyze-rubric-sensitivity.js --runs <run1,run2> [--version 3.0] [--db <path>] [--json]\n\nRead-only; no model calls and no database writes.`,
    );
    return 0;
  }
  const version = option(argv, 'version', '3.0');
  const runs = (option(argv, 'runs', option(argv, 'run-id', '')) || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const dbPath = expandHome(option(argv, 'db', process.env.EVAL_DB_PATH || path.join(ROOT, 'data/evaluations.db')));
  const rubricDir = path.join(ROOT, 'config', 'rubrics', `v${version}`);
  if (!fs.existsSync(rubricDir)) throw new Error(`Rubric directory not found: ${rubricDir}`);
  const rows = loadSensitivityRows({ dbPath, runs });
  const result = {
    schema: 'machinespirits.rubric-sensitivity-report.v1',
    version,
    runs,
    db: dbPath.replace(os.homedir(), '~'),
    instruments: analyzeSensitivityRows(rows, { rubricDir, version }),
  };
  console.log(argv.includes('--json') ? JSON.stringify(result, null, 2) : renderReport(result));
  return 0;
}

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Rubric sensitivity audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
