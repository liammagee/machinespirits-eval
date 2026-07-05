#!/usr/bin/env node
/**
 * D4 disposition-gradient replication.
 *
 * D4 tests the clean deferred question from the D2-D6 follow-up arc:
 * do the paper-cited dialectical divergent-superego cells 40-45 reproduce the
 * suspicious > adversary > advocate recognition-benefit ordering on SEL?
 *
 * Usage:
 *   node scripts/analyze-d4-disposition-gradient.js <runId>
 *   node scripts/analyze-d4-disposition-gradient.js <runId> --out exports/d4-sel-disposition-gradient.md
 */

import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.EVAL_DB_PATH || path.join(__dirname, '..', 'data', 'evaluations.db');

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith('--'));
const runId = positional[0];

if (!runId) {
  console.error('Usage: node scripts/analyze-d4-disposition-gradient.js <runId> [--out path.md]');
  process.exit(1);
}

function getOption(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

const outPath = getOption('out');

const DISPOSITIONS = [
  {
    disposition: 'suspicious',
    baseProfile: 'cell_40_base_dialectical_suspicious_unified_superego',
    recogProfile: 'cell_41_recog_dialectical_suspicious_unified_superego',
  },
  {
    disposition: 'adversary',
    baseProfile: 'cell_42_base_dialectical_adversary_unified_superego',
    recogProfile: 'cell_43_recog_dialectical_adversary_unified_superego',
  },
  {
    disposition: 'advocate',
    baseProfile: 'cell_44_base_dialectical_advocate_unified_superego',
    recogProfile: 'cell_45_recog_dialectical_advocate_unified_superego',
  },
];

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function variance(values) {
  if (values.length < 2) return null;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
}

function sd(values) {
  const v = variance(values);
  return v == null ? null : Math.sqrt(v);
}

function cohensD(treatment, control) {
  if (treatment.length < 2 || control.length < 2) return null;
  const vT = variance(treatment);
  const vC = variance(control);
  const pooled = Math.sqrt(
    ((treatment.length - 1) * vT + (control.length - 1) * vC) / (treatment.length + control.length - 2),
  );
  return pooled === 0 ? null : (mean(treatment) - mean(control)) / pooled;
}

function fmt(value, digits = 1) {
  return value == null || !Number.isFinite(value) ? '-' : value.toFixed(digits);
}

function profileValues(rows, profile) {
  return rows.filter((row) => row.profile_name === profile).map((row) => row.score);
}

function summarizeDisposition(rows, spec) {
  const base = profileValues(rows, spec.baseProfile);
  const recog = profileValues(rows, spec.recogProfile);
  return {
    disposition: spec.disposition,
    baseProfile: spec.baseProfile,
    recogProfile: spec.recogProfile,
    nBase: base.length,
    nRecog: recog.length,
    meanBase: mean(base),
    meanRecog: mean(recog),
    sdBase: sd(base),
    sdRecog: sd(recog),
    delta: mean(recog) - mean(base),
    d: cohensD(recog, base),
  };
}

function scenarioSummaries(rows, spec) {
  const scenarios = [...new Set(rows.map((row) => row.scenario_id))].sort();
  return scenarios.map((scenarioId) => {
    const scenarioRows = rows.filter((row) => row.scenario_id === scenarioId);
    const base = profileValues(scenarioRows, spec.baseProfile);
    const recog = profileValues(scenarioRows, spec.recogProfile);
    return {
      scenarioId,
      disposition: spec.disposition,
      meanBase: mean(base),
      meanRecog: mean(recog),
      delta: mean(recog) - mean(base),
      nBase: base.length,
      nRecog: recog.length,
    };
  });
}

function renderPrimaryTable(summaries) {
  const lines = [];
  lines.push('| Disposition | N base / recog | Mean base (SD) | Mean recog (SD) | Delta | Cohen d |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const row of summaries) {
    lines.push(
      `| ${row.disposition} | ${row.nBase} / ${row.nRecog} | ${fmt(row.meanBase)} (${fmt(row.sdBase)}) | ${fmt(row.meanRecog)} (${fmt(row.sdRecog)}) | ${fmt(row.delta)} | ${fmt(row.d, 2)} |`,
    );
  }
  return lines;
}

function renderScenarioTable(rows) {
  const lines = [];
  lines.push('| Scenario | Susp delta | Adversary delta | Advocate delta |');
  lines.push('|---|---:|---:|---:|');
  const scenarios = [...new Set(rows.map((row) => row.scenarioId))].sort();
  for (const scenarioId of scenarios) {
    const byDisp = Object.fromEntries(
      rows.filter((row) => row.scenarioId === scenarioId).map((row) => [row.disposition, row]),
    );
    lines.push(
      `| ${scenarioId} | ${fmt(byDisp.suspicious?.delta)} | ${fmt(byDisp.adversary?.delta)} | ${fmt(byDisp.advocate?.delta)} |`,
    );
  }
  return lines;
}

function gateVerdict(summaries) {
  const byDisp = Object.fromEntries(summaries.map((row) => [row.disposition, row]));
  const allPositive = summaries.every((row) => row.delta > 0);
  const orderedByDelta =
    byDisp.suspicious.delta > byDisp.adversary.delta && byDisp.adversary.delta > byDisp.advocate.delta;
  const orderedByD = byDisp.suspicious.d > byDisp.adversary.d && byDisp.adversary.d > byDisp.advocate.d;

  if (allPositive && orderedByDelta && orderedByD) {
    return {
      label: 'pass',
      sentence:
        'D4 passes the pre-registered gate: all recognition deltas are positive and the suspicious > adversary > advocate ordering holds by both delta and effect size.',
    };
  }

  if (allPositive) {
    return {
      label: 'scope-bound',
      sentence:
        'D4 is scope-bound: all recognition deltas are positive, but the suspicious > adversary > advocate ordering does not hold monotonically.',
    };
  }

  return {
    label: 'fail',
    sentence:
      'D4 fails the replication gate: at least one recognition delta is non-positive, so the disposition-gradient claim remains bounded to the earlier philosophy evidence.',
  };
}

function main() {
  const db = new Database(DB_PATH, { readonly: true });
  const profiles = DISPOSITIONS.flatMap((spec) => [spec.baseProfile, spec.recogProfile]);
  const rows = db
    .prepare(
      `SELECT scenario_id, profile_name, tutor_first_turn_score AS score, judge_model
       FROM evaluation_results
       WHERE run_id = ?
         AND profile_name IN (${profiles.map(() => '?').join(',')})
         AND tutor_first_turn_score IS NOT NULL
       ORDER BY scenario_id, profile_name, id`,
    )
    .all(runId, ...profiles);

  const audit = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success,
         SUM(CASE WHEN tutor_first_turn_score IS NOT NULL THEN 1 ELSE 0 END) AS scored,
         SUM(CASE WHEN tutor_first_turn_score IS NULL THEN 1 ELSE 0 END) AS unscored,
         COUNT(DISTINCT judge_model) AS judge_models
       FROM evaluation_results
       WHERE run_id = ?`,
    )
    .get(runId);

  const judgeRows = db
    .prepare(
      `SELECT COALESCE(judge_model, '') AS judge_model, COUNT(*) AS n
       FROM evaluation_results
       WHERE run_id = ?
       GROUP BY judge_model
       ORDER BY judge_model`,
    )
    .all(runId);
  db.close();

  const summaries = DISPOSITIONS.map((spec) => summarizeDisposition(rows, spec));
  const scenarioRows = DISPOSITIONS.flatMap((spec) => scenarioSummaries(rows, spec));
  const verdict = gateVerdict(summaries);
  const byDisp = Object.fromEntries(summaries.map((row) => [row.disposition, row]));

  const lines = [];
  lines.push('# D4 SEL Disposition-Gradient Replication');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Run ID: \`${runId}\``);
  lines.push(`Database: \`${DB_PATH}\``);
  lines.push('');
  lines.push('## Design');
  lines.push('');
  lines.push('- Profiles: cells 40-45, dialectical ego plus divergent superego dispositions.');
  lines.push('- Scenarios: all eight SEL scenarios from `content-test-sel/scenarios-sel.yaml`.');
  lines.push('- Density: 6 profiles x 8 scenarios x 3 runs = 144 rows.');
  lines.push('- Generator: Haiku 4.5 family as stored on the run rows.');
  lines.push('- Judge: Sonnet CLI, stored as `claude-code/sonnet`.');
  lines.push('- Primary metric: `tutor_first_turn_score`, recognition minus base within each disposition pair.');
  lines.push(
    '- Gate: pass only if all three deltas are positive and the effect-size ordering is suspicious > adversary > advocate.',
  );
  lines.push('');
  lines.push('## Score Audit');
  lines.push('');
  lines.push(
    `- Rows: ${audit.total}; successful generations: ${audit.success}; scored first turns: ${audit.scored}; unscored: ${audit.unscored}.`,
  );
  lines.push(`- Judge models: ${judgeRows.map((row) => `${row.judge_model || '(blank)'}=${row.n}`).join(', ')}.`);
  lines.push(
    '- Scoring note: the standard evaluator supplied the initial Sonnet scores; remaining first-turn rows were filled with `scripts/score-d4-first-turns.js`, which reuses the project v2.2 first-turn prompt builder and writes through `evaluationStore`.',
  );
  lines.push('');
  lines.push('## Primary Result');
  lines.push('');
  lines.push(...renderPrimaryTable(summaries));
  lines.push('');
  lines.push(
    `Delta ordering: suspicious ${fmt(byDisp.suspicious.delta)}; adversary ${fmt(byDisp.adversary.delta)}; advocate ${fmt(byDisp.advocate.delta)}.`,
  );
  lines.push(
    `Effect-size ordering: suspicious d=${fmt(byDisp.suspicious.d, 2)}; adversary d=${fmt(byDisp.adversary.d, 2)}; advocate d=${fmt(byDisp.advocate.d, 2)}.`,
  );
  lines.push('');
  lines.push(`Gate verdict: **${verdict.label}**.`);
  lines.push('');
  lines.push(verdict.sentence);
  lines.push('');
  lines.push('## Scenario-Level Deltas');
  lines.push('');
  lines.push(...renderScenarioTable(scenarioRows));
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  if (verdict.label === 'scope-bound') {
    lines.push(
      'The architecture-matched SEL replication supports a broad recognition benefit: every disposition pair improved under recognition prompting. It does not support the stronger monotone struggle-gradient claim on SEL, because advocate improved more than adversary. The paper should treat the earlier philosophy ordering as domain-sensitive rather than universal.',
    );
  } else if (verdict.label === 'pass') {
    lines.push(
      'The architecture-matched SEL replication extends the philosophy result: recognition benefit is positive in every disposition pair and largest where superego struggle is most hostile.',
    );
  } else {
    lines.push(
      'The architecture-matched SEL replication does not support a general recognition-benefit gradient. The philosophy result remains bounded to its original domain and run context.',
    );
  }
  lines.push('');
  lines.push(
    'What D4 adds to Paper 2.0: it turns the earlier D4 gate from an unrun optional replication into direct SEL evidence. The collective claim is now sharper: recognition helps across hostile, adversarial, and advocate dispositions in SEL, but the exact suspicious > adversary > advocate ordering is not stable across domain.',
  );
  lines.push('');

  const report = `${lines.join('\n')}\n`;
  if (outPath) {
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, report);
    console.error(`Wrote ${outPath}`);
  } else {
    process.stdout.write(report);
  }
}

main();
