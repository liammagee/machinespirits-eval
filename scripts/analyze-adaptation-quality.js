#!/usr/bin/env node
/**
 * Combine Plan 2.0 strategy-shift correctness with normal tutoring-quality
 * rubrics. This is the follow-up gate after the binary adaptation proof:
 * a policy only wins if it keeps the adaptation move and improves judged
 * tutor/learner/dialogue quality.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { scoredTutorTurnAfterTrigger } from './lib/trapTurnConvention.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DB_PATH = path.join(REPO_ROOT, 'data', 'evaluations.db');
const DEFAULT_LOGS_DIR = path.join(REPO_ROOT, 'logs', 'tutor-dialogues');

const QUALITY_FIELDS = Object.freeze([
  'tutorLastTurnScore',
  'tutorHolisticOverallScore',
  'dialogueQualityScore',
  'learnerOverallScore',
]);

const DIMENSIONS_OF_INTEREST = Object.freeze([
  'perception_quality',
  'elicitation_quality',
  'adaptive_responsiveness',
  'recognition_quality',
  'productive_difficulty',
  'epistemic_integrity',
  'content_accuracy',
]);

function parseArgs(argv = process.argv.slice(2)) {
  const value = (name, fallback = null) => {
    const idx = argv.indexOf(`--${name}`);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const flag = (name) => argv.includes(`--${name}`);
  const runIdArg = value('run-id') || value('runs') || value('run');
  return {
    runIds: runIdArg
      ? runIdArg
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    profile: value('profile'),
    judgeModel: value('judge-model'),
    baseline: value('baseline', 'cell_135_plan2_closed_loop'),
    minShiftRate: Number(value('min-shift-rate', '0.875')),
    minQualityDelta: Number(value('min-quality-delta', '0')),
    out: value('out'),
    markdown: value('markdown') || value('md'),
    dbPath: value('db', process.env.EVAL_DB_PATH || DEFAULT_DB_PATH),
    logsDir: value('logs-dir', path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues')),
    json: flag('json'),
  };
}

function mean(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowFromDb(row) {
  return {
    id: row.id,
    runId: row.run_id,
    scenarioId: row.scenario_id,
    scenarioType: row.scenario_type,
    profileName: row.profile_name,
    dialogueId: row.dialogue_id,
    judgeModel: row.judge_model,
    success: row.success === 1 || row.success === true,
    tutorFirstTurnScore: numberOrNull(row.tutor_first_turn_score),
    tutorLastTurnScore: numberOrNull(row.tutor_last_turn_score),
    tutorDevelopmentScore: numberOrNull(row.tutor_development_score),
    tutorOverallScore: numberOrNull(row.tutor_overall_score),
    tutorHolisticOverallScore: numberOrNull(row.tutor_holistic_overall_score),
    learnerOverallScore: numberOrNull(row.learner_overall_score),
    dialogueQualityScore: numberOrNull(row.dialogue_quality_score),
    dialogueQualityInternalScore: numberOrNull(row.dialogue_quality_internal_score),
    tutorScores: parseJson(row.tutor_scores, null),
    rawResponse: parseJson(row.raw_response, null),
  };
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function filterRowsByJudgeModel(rows, judgeModel = null) {
  if (!judgeModel) return rows;
  return rows.filter((row) => row.judgeModel === judgeModel);
}

function loadRows({ dbPath, runIds, profile = null, judgeModel = null }) {
  if (!runIds?.length) throw new Error('analyze-adaptation-quality requires --run-id <id>[,<id2>...]');
  const db = new Database(dbPath, { readonly: true });
  const placeholders = runIds.map(() => '?').join(',');
  let sql = `
    SELECT id, run_id, scenario_id, scenario_type, profile_name, dialogue_id,
           judge_model, success, raw_response, tutor_scores,
           tutor_first_turn_score, tutor_last_turn_score, tutor_development_score,
           tutor_overall_score, tutor_holistic_overall_score,
           learner_overall_score, dialogue_quality_score, dialogue_quality_internal_score
    FROM evaluation_results
    WHERE run_id IN (${placeholders})
  `;
  const params = [...runIds];
  if (profile) {
    sql += ' AND profile_name = ?';
    params.push(profile);
  }
  if (judgeModel) {
    sql += ' AND judge_model = ?';
    params.push(judgeModel);
  }
  sql += ' ORDER BY profile_name, scenario_id, id';
  const rows = db.prepare(sql).all(...params).map(rowFromDb);
  db.close();
  return rows;
}

function loadTrace(logsDir, dialogueId) {
  if (!dialogueId) return null;
  const p = path.join(logsDir, `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  return parseJson(fs.readFileSync(p, 'utf8'), null);
}

function expectedAcceptedSet(expectedShift) {
  if (expectedShift == null) return [];
  return Array.isArray(expectedShift) ? expectedShift : [expectedShift];
}

export function strictShiftFromTrace(trace) {
  const triggerTurn = trace?.scenario?.hidden?.triggerTurn ?? trace?.scenario?.hidden?.trigger_turn;
  const expectedShift = trace?.scenario?.expectedStrategyShift ?? null;
  const accepted = expectedAcceptedSet(expectedShift);
  if (!Number.isFinite(triggerTurn) || accepted.length === 0) {
    return {
      evaluable: false,
      matched: null,
      expectedShift,
      actualShiftAction: null,
      triggerTurn: Number.isFinite(triggerTurn) ? triggerTurn : null,
    };
  }
  const shiftTurn = scoredTutorTurnAfterTrigger(triggerTurn);
  const perTurn = Array.isArray(trace?.original?.perTurn) ? trace.original.perTurn : [];
  const turn = perTurn.find((t) => t.turn === shiftTurn);
  const actualShiftAction = turn?.tutorInternal?.policyAction || null;
  return {
    evaluable: actualShiftAction != null,
    matched: actualShiftAction == null ? null : accepted.includes(actualShiftAction),
    expectedShift,
    actualShiftAction,
    triggerTurn,
    shiftTurn,
  };
}

function dimensionMeans(tutorScores) {
  if (!tutorScores || typeof tutorScores !== 'object') return {};
  const sums = {};
  const counts = {};
  for (const turn of Object.values(tutorScores)) {
    const scores = turn?.scores || turn;
    if (!scores || typeof scores !== 'object') continue;
    for (const dim of DIMENSIONS_OF_INTEREST) {
      const detail = scores[dim];
      const value = typeof detail === 'number' ? detail : detail?.score;
      if (Number.isFinite(Number(value))) {
        sums[dim] = (sums[dim] || 0) + Number(value);
        counts[dim] = (counts[dim] || 0) + 1;
      }
    }
  }
  return Object.fromEntries(Object.keys(sums).map((dim) => [dim, sums[dim] / counts[dim]]));
}

export function enrichRowsWithQuality(rows, { logsDir = DEFAULT_LOGS_DIR } = {}) {
  return rows.map((row) => {
    const trace = loadTrace(logsDir, row.dialogueId);
    const shift = strictShiftFromTrace(trace);
    const qualityValues = QUALITY_FIELDS.map((field) => row[field]);
    const qualityFieldCount = qualityValues.filter((value) => Number.isFinite(value)).length;
    const qualityComposite = qualityFieldCount === QUALITY_FIELDS.length ? mean(qualityValues) : null;
    return {
      ...row,
      traceMissing: !trace,
      strictShiftMatched: shift.matched,
      strictShiftEvaluable: shift.evaluable,
      expectedShift: shift.expectedShift,
      actualShiftAction: shift.actualShiftAction,
      qualityFieldCount,
      qualityComposite,
      dimensions: dimensionMeans(row.tutorScores),
    };
  });
}

function aggregateProfile(rows) {
  const strictEvaluable = rows.filter((r) => r.strictShiftEvaluable);
  const strictMatched = strictEvaluable.filter((r) => r.strictShiftMatched === true).length;
  const dimensionMeansByName = {};
  for (const dim of DIMENSIONS_OF_INTEREST) {
    const value = mean(rows.map((r) => r.dimensions?.[dim]).filter((v) => Number.isFinite(v)));
    if (value != null) dimensionMeansByName[dim] = value;
  }
  return {
    profileName: rows[0]?.profileName || 'unknown',
    runIds: [...new Set(rows.map((r) => r.runId))],
    n: rows.length,
    completeQualityN: rows.filter((r) => r.qualityComposite != null).length,
    traceMissing: rows.filter((r) => r.traceMissing).length,
    strictShiftRate: strictEvaluable.length ? strictMatched / strictEvaluable.length : null,
    strictShiftMatched: strictMatched,
    strictShiftEvaluable: strictEvaluable.length,
    tutorFirstTurnMean: mean(rows.map((r) => r.tutorFirstTurnScore)),
    tutorLastTurnMean: mean(rows.map((r) => r.tutorLastTurnScore)),
    tutorDevelopmentMean: mean(rows.map((r) => r.tutorDevelopmentScore)),
    tutorHolisticMean: mean(rows.map((r) => r.tutorHolisticOverallScore)),
    learnerMean: mean(rows.map((r) => r.learnerOverallScore)),
    dialogueQualityMean: mean(rows.map((r) => r.dialogueQualityScore)),
    qualityCompositeMean: mean(rows.map((r) => r.qualityComposite)),
    dimensions: dimensionMeansByName,
  };
}

export function aggregateQualityRows(rows, { baseline = 'cell_135_plan2_closed_loop', minShiftRate = 0.875, minQualityDelta = 0 } = {}) {
  const grouped = new Map();
  for (const row of rows) {
    const key = row.profileName || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const profiles = [...grouped.values()].map(aggregateProfile);
  const baselineRow = profiles.find((p) => p.profileName === baseline) || null;
  const baselineQuality = baselineRow?.qualityCompositeMean ?? null;

  for (const profile of profiles) {
    profile.qualityDeltaVsBaseline =
      baselineQuality == null || profile.qualityCompositeMean == null
        ? null
        : profile.qualityCompositeMean - baselineQuality;
    profile.passesShiftGate = (profile.strictShiftRate ?? -1) >= minShiftRate;
    profile.passesQualityGate =
      profile.profileName === baseline ||
      profile.qualityDeltaVsBaseline == null ||
      profile.qualityDeltaVsBaseline >= minQualityDelta;
    profile.gatedDecisionScore =
      profile.qualityCompositeMean == null
        ? null
        : profile.qualityCompositeMean * Math.max(0, profile.strictShiftRate ?? 0);
  }

  const ranked = [...profiles].sort((a, b) => {
    const aGate = a.passesShiftGate ? 1 : 0;
    const bGate = b.passesShiftGate ? 1 : 0;
    if (aGate !== bGate) return bGate - aGate;
    return (
      (b.qualityCompositeMean ?? -Infinity) - (a.qualityCompositeMean ?? -Infinity) ||
      (b.strictShiftRate ?? -Infinity) - (a.strictShiftRate ?? -Infinity)
    );
  });

  const winner = ranked.find((p) => p.passesShiftGate && p.qualityCompositeMean != null) || ranked[0] || null;
  return { profiles, ranked, baseline: baselineRow, winner };
}

function fmt(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function fmtPct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '--';
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Plan 2.0 Adaptation Quality Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Run IDs: ${report.runIds.join(', ')}`);
  if (report.options.judgeModel) lines.push(`Judge model: ${report.options.judgeModel}`);
  lines.push(`Baseline: ${report.options.baseline}`);
  lines.push(`Shift gate: ${(report.options.minShiftRate * 100).toFixed(1)}% strict shift`);
  lines.push('');
  if (report.winner) {
    lines.push(
      `Winner by gated quality: ${report.winner.profileName} (quality ${fmt(report.winner.qualityCompositeMean)}, strict shift ${fmtPct(report.winner.strictShiftRate)}).`,
    );
    lines.push('');
  }
  lines.push('| Profile | N | Quality N | Strict shift | Quality | Delta vs baseline | Tutor last | Tutor holistic | Learner | Dialogue | Dev |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.ranked) {
    lines.push(
      `| ${row.profileName} | ${row.n} | ${row.completeQualityN} | ${fmtPct(row.strictShiftRate)} (${row.strictShiftMatched}/${row.strictShiftEvaluable}) | ${fmt(row.qualityCompositeMean)} | ${fmt(row.qualityDeltaVsBaseline)} | ${fmt(row.tutorLastTurnMean)} | ${fmt(row.tutorHolisticMean)} | ${fmt(row.learnerMean)} | ${fmt(row.dialogueQualityMean)} | ${fmt(row.tutorDevelopmentMean)} |`,
    );
  }
  lines.push('');
  lines.push('## Dimension Means');
  lines.push('');
  lines.push('| Profile | perception | elicitation | adaptive_resp | recognition | productive_diff | epistemic | accuracy |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of report.ranked) {
    lines.push(
      `| ${row.profileName} | ${fmt(row.dimensions.perception_quality, 2)} | ${fmt(row.dimensions.elicitation_quality, 2)} | ${fmt(row.dimensions.adaptive_responsiveness, 2)} | ${fmt(row.dimensions.recognition_quality, 2)} | ${fmt(row.dimensions.productive_difficulty, 2)} | ${fmt(row.dimensions.epistemic_integrity, 2)} | ${fmt(row.dimensions.content_accuracy, 2)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log(`\nPlan 2.0 adaptation quality report`);
  console.log(`  runIds=${report.runIds.join(',')}`);
  if (report.options.judgeModel) console.log(`  judgeModel=${report.options.judgeModel}`);
  console.log(`  baseline=${report.options.baseline}`);
  console.log(`  shift gate=${fmtPct(report.options.minShiftRate)}`);
  console.log('');
  console.log('  profile                                      n  qn  shift       quality  delta   last  holistic  learner  dialogue');
  for (const row of report.ranked) {
    console.log(
      `  ${row.profileName.padEnd(44)} ${String(row.n).padStart(2)}  ${String(row.completeQualityN).padStart(2)}  ${fmtPct(row.strictShiftRate).padStart(8)}  ${fmt(row.qualityCompositeMean).padStart(7)}  ${fmt(row.qualityDeltaVsBaseline).padStart(6)}  ${fmt(row.tutorLastTurnMean).padStart(5)}  ${fmt(row.tutorHolisticMean).padStart(8)}  ${fmt(row.learnerMean).padStart(7)}  ${fmt(row.dialogueQualityMean).padStart(8)}`,
    );
  }
  if (report.winner) {
    console.log(`\n  winner=${report.winner.profileName}`);
  }
}

export function buildReport(rows, options = {}) {
  const enriched = enrichRowsWithQuality(rows, options);
  const aggregate = aggregateQualityRows(enriched, options);
  return {
    generatedAt: new Date().toISOString(),
    runIds: [...new Set(rows.map((r) => r.runId))],
    options: {
      baseline: options.baseline || 'cell_135_plan2_closed_loop',
      judgeModel: options.judgeModel || null,
      minShiftRate: options.minShiftRate ?? 0.875,
      minQualityDelta: options.minQualityDelta ?? 0,
    },
    rows: enriched,
    profiles: aggregate.profiles,
    ranked: aggregate.ranked,
    baseline: aggregate.baseline,
    winner: aggregate.winner,
  };
}

async function main() {
  const options = parseArgs();
  const rows = loadRows(options);
  if (rows.length === 0) throw new Error(`No rows found for runId(s): ${options.runIds.join(',')}`);
  const report = buildReport(rows, options);
  printSummary(report);

  if (options.out) {
    const abs = path.isAbsolute(options.out) ? options.out : path.join(REPO_ROOT, options.out);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${abs}`);
  }
  if (options.markdown) {
    const abs = path.isAbsolute(options.markdown) ? options.markdown : path.join(REPO_ROOT, options.markdown);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, renderMarkdown(report));
    console.log(`Wrote ${abs}`);
  }
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
