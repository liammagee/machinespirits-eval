#!/usr/bin/env node
/**
 * Report poetics sidecar results from poetics_runs/items/scores/labels.
 *
 * The sidecar is intentionally separate from evaluation_results. This report
 * treats generated scripts as calibration artifacts: target-arm separation,
 * control stability, critic disagreement, and optional labels-as-perspective.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore } from '../services/poeticsStore.js';
import { POETICS_CONSENSUS_RULE, classifyPoeticsConsensus } from './lib/poeticsConsensus.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const TUTOR_ADAPTATION_ANALYZER_VERSION = 'tutor-adaptation-v4';

function parseArgs(argv) {
  const args = {
    dbPath: null,
    runId: null,
    out: path.join(ROOT, 'exports', 'poetics-sidecar-report.md'),
    csv: path.join(ROOT, 'exports', 'poetics-sidecar-report.csv'),
    json: null,
    noMarkdown: false,
    noCsv: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--csv') args.csv = path.resolve(argv[++i]);
    else if (token === '--json') args.json = path.resolve(argv[++i]);
    else if (token === '--no-markdown') args.noMarkdown = true;
    else if (token === '--no-csv') args.noCsv = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/report-poetics-sidecar.js [--run-id ID] [--db FILE]
      [--out report.md] [--csv report.csv] [--json report.json]
      [--no-markdown] [--no-csv]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  return args;
}

function decodeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function countBy(rows, keyFn) {
  const out = {};
  for (const row of rows) {
    const key = keyFn(row) || 'unknown';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function pct(n, d) {
  if (!d) return 'n/a';
  return `${Math.round((1000 * n) / d) / 10}%`;
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function loadRows(db, runId = null) {
  const where = runId ? 'WHERE r.id = ?' : '';
  const params = runId ? [runId] : [];
  return db
    .prepare(
      `
      SELECT
        r.id AS run_id,
        r.source_root,
        i.id AS item_id,
        i.unit_id,
        i.repeat,
        i.arm,
        i.tid,
        i.drama_id,
        i.discipline,
        i.condition_name,
        i.intended_lean,
        i.control_family,
        i.control_role,
        i.sample_path,
        i.full_transcript_path,
        i.metadata AS item_metadata,
        s.critic_model,
        s.score_file,
        s.form_class,
        s.recontextualization,
        s.stated_insight,
        s.rupture,
        s.global_coherence,
        s.pivot_learner_turn,
        s.recohered_earlier,
        s.stated_insight_evidence,
        s.flags,
        s.metadata AS score_metadata,
        a.learner_self_reframe,
        a.tutor_contingent_adaptation,
        a.tutor_adaptation_score,
        a.uptake_delta,
        a.tutor_strategy_before,
        a.tutor_strategy_after,
        a.shared_salient_terms,
        a.evidence AS tutor_adaptation_evidence,
        a.metadata AS tutor_adaptation_metadata,
        (
          SELECT COUNT(*)
          FROM poetics_labels l
          WHERE l.item_id = i.id
        ) AS label_count
      FROM poetics_runs r
      JOIN poetics_items i ON i.run_id = r.id
      LEFT JOIN poetics_scores s ON s.item_id = i.id
      LEFT JOIN poetics_tutor_adaptations a
        ON a.item_id = i.id AND a.analyzer_version = '${TUTOR_ADAPTATION_ANALYZER_VERSION}'
      ${where}
      ORDER BY r.id, i.repeat, i.unit_id, i.arm, i.tid, s.critic_model
    `,
    )
    .all(...params)
    .map((row) => ({
      ...row,
      flags: decodeJson(row.flags, []),
      score_metadata: decodeJson(row.score_metadata, {}),
      item_metadata: decodeJson(row.item_metadata, {}),
      shared_salient_terms: decodeJson(row.shared_salient_terms, []),
      tutor_adaptation_metadata: decodeJson(row.tutor_adaptation_metadata, {}),
    }));
}

function summarizeRun(runId, rows) {
  const itemMap = new Map();
  const scoreRows = rows.filter((row) => row.critic_model);
  for (const row of rows) {
    if (!itemMap.has(row.item_id)) itemMap.set(row.item_id, row);
  }
  const items = [...itemMap.values()];
  const targetScores = scoreRows.filter((row) => isTargetItem(row));
  const controlScores = scoreRows.filter((row) => row.control_role);
  const labelCount = items.reduce((sum, row) => sum + (row.label_count || 0), 0);
  const targetAdaptation = {};

  for (const row of items.filter((item) => isTargetItem(item))) {
    const arm = row.arm || 'default';
    targetAdaptation[arm] ||= {
      total: 0,
      learnerSelfReframes: 0,
      tutorAdaptations: 0,
      scoreSum: 0,
      uptakeDeltaSum: 0,
      reversalPressure: 0,
      instrumentedPressure: 0,
      privateRoutes: 0,
      tutorMechanisms: 0,
      peripeteiaScoreSum: 0,
      peripeteiaScored: 0,
      scored: 0,
      missing: 0,
      branchValid: 0,
      branchValidityScored: 0,
      requiredReversalEvents: 0,
      usedReversalEvents: 0,
      requiredReframeEvents: 0,
      usedReframeEvents: 0,
    };
    const bucket = targetAdaptation[arm];
    bucket.total += 1;
    if (row.learner_self_reframe == null) {
      bucket.missing += 1;
      continue;
    }
    bucket.scored += 1;
    if (row.learner_self_reframe) bucket.learnerSelfReframes += 1;
    if (row.tutor_contingent_adaptation) bucket.tutorAdaptations += 1;
    bucket.scoreSum += row.tutor_adaptation_score || 0;
    bucket.uptakeDeltaSum += row.uptake_delta || 0;
    const peripeteia = row.tutor_adaptation_metadata?.peripeteia || null;
    if (peripeteia) {
      bucket.peripeteiaScored += 1;
      if (peripeteia.learner_reversal_pressure) bucket.reversalPressure += 1;
      if (peripeteia.instrumented_pressure) bucket.instrumentedPressure += 1;
      if (peripeteia.private_mechanism_declared) bucket.privateRoutes += 1;
      if (peripeteia.tutor_adaptive_mechanism || peripeteia.tutor_strategy_reversal) bucket.tutorMechanisms += 1;
      bucket.peripeteiaScoreSum += peripeteia.tutor_peripeteia_score || 0;
    }
    const branchValidity = row.tutor_adaptation_metadata?.branch_validity || null;
    if (branchValidity) {
      bucket.branchValidityScored += 1;
      if (branchValidity.valid) bucket.branchValid += 1;
      if (branchValidity.requires_learner_reversal_event) bucket.requiredReversalEvents += 1;
      if (branchValidity.learner_reversal_event_used) bucket.usedReversalEvents += 1;
      if (branchValidity.requires_learner_reframe_event) bucket.requiredReframeEvents += 1;
      if (branchValidity.learner_reframe_event_used) bucket.usedReframeEvents += 1;
    }
  }

  const targetByCriticArm = {};
  for (const row of targetScores) {
    const critic = row.critic_model;
    const arm = row.arm || 'default';
    targetByCriticArm[critic] ||= {};
    targetByCriticArm[critic][arm] ||= {
      recognition: 0,
      trap: 0,
      flat: 0,
      other: 0,
      actional: 0,
      adaptiveQuality: 0,
      total: 0,
    };
    const bucket = ['recognition', 'trap', 'flat'].includes(row.form_class) ? row.form_class : 'other';
    targetByCriticArm[critic][arm][bucket] += 1;
    if (Number(row.score_metadata?.actional_breakthrough || 0) >= 75) targetByCriticArm[critic][arm].actional += 1;
    const adaptiveQuality =
      row.score_metadata?.adaptive_mechanism_quality ??
      row.score_metadata?.role_symmetric_scores?.tutor_adaptive_mechanism_quality?.score100;
    if (Number(adaptiveQuality || 0) >= 75) targetByCriticArm[critic][arm].adaptiveQuality += 1;
    targetByCriticArm[critic][arm].total += 1;
  }

  const controls = {};
  for (const row of controlScores) {
    const key = [row.repeat || 'n/a', row.control_family || row.control_role || 'control'].join(':');
    controls[key] ||= {
      repeat: row.repeat,
      controlFamily: row.control_family,
      controlRole: row.control_role,
      byCritic: {},
    };
    controls[key].byCritic[row.critic_model] = row.form_class || 'missing';
  }

  const scoresByItem = new Map();
  for (const row of scoreRows) {
    if (!scoresByItem.has(row.item_id)) scoresByItem.set(row.item_id, []);
    scoresByItem.get(row.item_id).push(row);
  }
  const disagreements = [];
  const consensusByItem = [];
  for (const item of items) {
    const itemId = item.item_id;
    const itemScores = scoresByItem.get(itemId) || [];
    const consensus = classifyPoeticsConsensus(itemScores);
    consensusByItem.push({
      itemId,
      runId,
      repeat: item.repeat,
      unitId: item.unit_id,
      arm: item.arm,
      tid: item.tid,
      dramaId: item.drama_id,
      controlRole: item.control_role,
      ...consensus,
    });
    if (!itemScores.length) continue;
    const forms = countBy(itemScores, (row) => row.form_class);
    if (Object.keys(forms).length <= 1) continue;
    disagreements.push({
      itemId,
      runId,
      repeat: item.repeat,
      unitId: item.unit_id,
      arm: item.arm,
      tid: item.tid,
      dramaId: item.drama_id,
      controlRole: item.control_role,
      forms,
      scores: itemScores.map((row) => ({
        critic: row.critic_model,
        form: row.form_class,
        recontextualization: row.recontextualization,
        statedInsight: row.stated_insight,
        actionalBreakthrough: row.score_metadata?.actional_breakthrough ?? null,
      })),
    });
  }

  const baselineRiskByDrama = summarizeBaselineRisk(items, scoreRows);

  return {
    runId,
    sourceRoot: rows[0]?.source_root || null,
    itemCount: items.length,
    scoreCount: scoreRows.length,
    labelCount,
    arms: countBy(items, (row) => row.arm),
    controls: Object.values(controls),
    targetByCriticArm,
    targetAdaptation,
    baselineRiskByDrama,
    disagreements,
    consensusByItem,
    consensusRule: POETICS_CONSENSUS_RULE,
  };
}

function scenarioTaxonomy(item = {}) {
  const keyItem = item.item_metadata?.keyItem || {};
  return {
    evaluationRole: keyItem.evaluation_role || null,
    baselineControlClass: keyItem.baseline_control_class || null,
    organicReversalRisk: keyItem.organic_reversal_risk || null,
    note: keyItem.baseline_control_note || null,
  };
}

function isTargetItem(item = {}) {
  return String(item.unit_id || '').startsWith('target-') || item.item_metadata?.unit?.kind === 'target';
}

function baselineRiskLevel({ declaredRisk, negativeRate, prefixRate }) {
  if (declaredRisk === 'high') return 'high';
  if ((prefixRate ?? 0) >= 0.5 || (negativeRate ?? 0) >= 0.5) return 'high';
  if (declaredRisk === 'medium') return 'medium';
  if ((prefixRate ?? 0) > 0 || (negativeRate ?? 0) > 0) return 'medium';
  if (declaredRisk === 'low') return 'low';
  return 'unknown';
}

function summarizeBaselineRisk(items, scoreRows) {
  const targetItems = items.filter((item) => isTargetItem(item));
  const itemById = new Map(targetItems.map((item) => [item.item_id, item]));
  const byDrama = {};
  for (const item of targetItems) {
    const dramaId = item.drama_id || 'unknown';
    byDrama[dramaId] ||= {
      dramaId,
      tids: new Set(),
      arms: new Set(),
      evaluationRole: null,
      baselineControlClass: null,
      declaredRisk: null,
      note: null,
      negativeRows: 0,
      negativeRecognition: 0,
      prefixRows: 0,
      prefixRecognition: 0,
    };
    const bucket = byDrama[dramaId];
    bucket.tids.add(item.tid);
    bucket.arms.add(item.arm || 'default');
    const taxonomy = scenarioTaxonomy(item);
    bucket.evaluationRole ||= taxonomy.evaluationRole;
    bucket.baselineControlClass ||= taxonomy.baselineControlClass;
    bucket.declaredRisk ||= taxonomy.organicReversalRisk;
    bucket.note ||= taxonomy.note;
  }
  for (const row of scoreRows) {
    const item = itemById.get(row.item_id);
    if (!item) continue;
    const arm = item.arm || 'default';
    const dramaId = item.drama_id || 'unknown';
    const bucket = byDrama[dramaId];
    if (!bucket) continue;
    if (['routine', 'none'].includes(arm)) {
      bucket.negativeRows += 1;
      if (row.form_class === 'recognition') bucket.negativeRecognition += 1;
    }
    if (arm === 'prefix-baseline') {
      bucket.prefixRows += 1;
      if (row.form_class === 'recognition') bucket.prefixRecognition += 1;
    }
  }
  return Object.values(byDrama)
    .map((bucket) => {
      const negativeRate = bucket.negativeRows ? bucket.negativeRecognition / bucket.negativeRows : null;
      const prefixRate = bucket.prefixRows ? bucket.prefixRecognition / bucket.prefixRows : null;
      return {
        ...bucket,
        tids: [...bucket.tids].sort(),
        arms: [...bucket.arms].sort(),
        negativeRate,
        prefixRate,
        riskLevel: baselineRiskLevel({
          declaredRisk: bucket.declaredRisk,
          negativeRate,
          prefixRate,
        }),
      };
    })
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, unknown: 2, low: 3 };
      return (rank[a.riskLevel] ?? 9) - (rank[b.riskLevel] ?? 9) || a.dramaId.localeCompare(b.dramaId);
    });
}

function buildPoeticsReport(db, { runId = null } = {}) {
  const rows = loadRows(db, runId);
  const runIds = [...new Set(rows.map((row) => row.run_id))].sort();
  return {
    generatedAt: new Date().toISOString(),
    runFilter: runId,
    runs: runIds.map((id) =>
      summarizeRun(
        id,
        rows.filter((row) => row.run_id === id),
      ),
    ),
    rows,
  };
}

function renderTargetSection(run) {
  const critics = Object.keys(run.targetByCriticArm).sort();
  if (!critics.length) return 'No target-arm scores found.';
  const lines = [
    '| Critic | Arm | Recognitive self-reframe | Actional breakthrough | Adaptive mechanism quality | Trap | Flat | Other |',
    '|---|---|---:|---:|---:|---:|---:|---:|',
  ];
  for (const critic of critics) {
    for (const arm of Object.keys(run.targetByCriticArm[critic]).sort()) {
      const c = run.targetByCriticArm[critic][arm];
      lines.push(
        `| ${critic} | ${arm} | ${c.recognition}/${c.total} (${pct(c.recognition, c.total)}) | ${c.actional}/${c.total} (${pct(c.actional, c.total)}) | ${c.adaptiveQuality}/${c.total} (${pct(c.adaptiveQuality, c.total)}) | ${c.trap} | ${c.flat} | ${c.other} |`,
      );
    }
  }
  return lines.join('\n');
}

function renderBaselineRiskSection(run) {
  const rows = run.baselineRiskByDrama || [];
  if (!rows.length) return 'No target scenarios found.';
  const lines = [
    '| Drama | TIDs | Role | Declared risk | Observed risk | Prefix recognition | Routine/none recognition | Arms | Note |',
    '|---|---|---|---|---|---:|---:|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.dramaId} | ${row.tids.join(' ')} | ${row.evaluationRole || ''} | ${row.declaredRisk || ''} | ${row.riskLevel} | ${row.prefixRecognition}/${row.prefixRows} | ${row.negativeRecognition}/${row.negativeRows} | ${row.arms.join(' ')} | ${row.note || ''} |`,
    );
  }
  return lines.join('\n');
}

function renderConsensusSection(run) {
  const rows = run.consensusByItem || [];
  if (!rows.length) return 'No critic consensus rows found.';
  const byStatus = {};
  const byArmStatus = {};
  for (const row of rows) {
    byStatus[row.claimStatus] = (byStatus[row.claimStatus] || 0) + 1;
    const arm = row.arm || 'default';
    byArmStatus[arm] ||= {};
    byArmStatus[arm][row.claimStatus] = (byArmStatus[arm][row.claimStatus] || 0) + 1;
  }
  const lines = [
    `Rule: ${run.consensusRule.description}`,
    '',
    '| Arm | Claimable | Boundary | Negative | Insufficient |',
    '|---|---:|---:|---:|---:|',
  ];
  for (const arm of Object.keys(byArmStatus).sort()) {
    const bucket = byArmStatus[arm];
    lines.push(
      `| ${arm} | ${bucket.claimable || 0} | ${bucket.boundary || 0} | ${bucket.negative || 0} | ${bucket.insufficient || 0} |`,
    );
  }
  lines.push(
    '',
    `Overall: ${
      Object.entries(byStatus)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ') || 'n/a'
    }`,
  );
  return lines.join('\n');
}

function renderControlSection(run) {
  if (!run.controls.length) return 'No controls found.';
  const critics = [...new Set(run.controls.flatMap((row) => Object.keys(row.byCritic)))].sort();
  const lines = [
    `| Repeat | Control | Role | ${critics.join(' | ')} |`,
    `|---|---|---|${critics.map(() => '---').join('|')}|`,
  ];
  for (const row of run.controls.sort((a, b) =>
    `${a.repeat}:${a.controlFamily}`.localeCompare(`${b.repeat}:${b.controlFamily}`),
  )) {
    lines.push(
      `| ${row.repeat || ''} | ${row.controlFamily || ''} | ${row.controlRole || ''} | ${critics
        .map((critic) => row.byCritic[critic] || 'missing')
        .join(' | ')} |`,
    );
  }
  return lines.join('\n');
}

function renderTutorAdaptationSection(run) {
  const arms = Object.keys(run.targetAdaptation || {}).sort();
  if (!arms.length) return 'No target-arm tutor adaptation rows found.';
  const lines = [
    'Primary claim: peripeteia tutor adaptation asks whether learner pressure makes the tutor ego/superego loop invent a visible new learning mechanism. Secondary claim: recognition-contingent uptake asks whether a later tutor turn takes up a learner self-reframe.',
    '',
    '| Arm | Items | Branch valid | Reversal event used | Reframe event used | Learner pressure | Instrumented pressure | Private route | Peripeteia tutor adaptation | Mean peripeteia score | Learner self-reframes | Recognition-contingent uptake | Mean uptake score | Mean uptake delta |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const arm of arms) {
    const row = run.targetAdaptation[arm];
    const denom = row.scored || 0;
    const peripeteiaDenom = row.peripeteiaScored || 0;
    const meanPeripeteia = peripeteiaDenom ? Math.round((10 * row.peripeteiaScoreSum) / peripeteiaDenom) / 10 : 'n/a';
    const meanScore = denom ? Math.round((10 * row.scoreSum) / denom) / 10 : 'n/a';
    const meanDelta = denom ? Math.round((1000 * row.uptakeDeltaSum) / denom) / 1000 : 'n/a';
    lines.push(
      `| ${arm} | ${row.total}${row.missing ? ` (${row.missing} missing)` : ''} | ${row.branchValid}/${row.branchValidityScored} | ${row.usedReversalEvents}/${row.requiredReversalEvents} | ${row.usedReframeEvents}/${row.requiredReframeEvents} | ${row.reversalPressure}/${peripeteiaDenom} | ${row.instrumentedPressure}/${peripeteiaDenom} | ${row.privateRoutes}/${peripeteiaDenom} | ${row.tutorMechanisms}/${peripeteiaDenom} | ${meanPeripeteia} | ${row.learnerSelfReframes}/${denom} | ${row.tutorAdaptations}/${denom} | ${meanScore} | ${meanDelta} |`,
    );
  }
  return lines.join('\n');
}

function renderDisagreementSection(run) {
  if (!run.disagreements.length) return 'No critic disagreements found.';
  const lines = ['| Item | Drama | Unit | Forms | Scores |', '|---|---|---|---|---|'];
  for (const row of run.disagreements) {
    const scores = row.scores.map((s) => `${s.critic}: ${s.form}`).join('<br>');
    const forms = Object.entries(row.forms)
      .map(([form, n]) => `${form}=${n}`)
      .join(', ');
    lines.push(`| ${row.tid} | ${row.dramaId || ''} | ${row.unitId} ${row.arm || ''} | ${forms} | ${scores} |`);
  }
  return lines.join('\n');
}

function renderMarkdown(report) {
  const lines = [`# Poetics Sidecar Report`, '', `Generated: ${report.generatedAt}`, ''];
  for (const run of report.runs) {
    lines.push(
      `## ${run.runId}`,
      '',
      `Source root: \`${run.sourceRoot}\``,
      '',
      `Items: ${run.itemCount} · scores: ${run.scoreCount} · labels: ${run.labelCount}`,
      '',
      '### Target Separation',
      '',
      renderTargetSection(run),
      '',
      '### Consensus Adjudication',
      '',
      renderConsensusSection(run),
      '',
      '### Tutor Adaptation',
      '',
      renderTutorAdaptationSection(run),
      '',
      '### Baseline Risk',
      '',
      renderBaselineRiskSection(run),
      '',
      '### Controls',
      '',
      renderControlSection(run),
      '',
      '### Critic Disagreements',
      '',
      renderDisagreementSection(run),
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderCsv(report) {
  const header = [
    'run_id',
    'item_id',
    'unit_id',
    'repeat',
    'arm',
    'tid',
    'drama_id',
    'control_role',
    'evaluation_role',
    'baseline_control_class',
    'organic_reversal_risk',
    'critic_model',
    'form_class',
    'learning_signal_class',
    'consensus_class',
    'claim_status',
    'recognition_votes',
    'critic_votes',
    'critic_disagreement',
    'recontextualization',
    'actional_breakthrough',
    'adaptive_mechanism_quality',
    'stated_insight',
    'pivot_learner_turn',
    'learner_self_reframe',
    'tutor_contingent_adaptation',
    'tutor_adaptation_score',
    'uptake_delta',
    'learner_reversal_pressure',
    'branch_valid',
    'requires_learner_reversal_event',
    'learner_reversal_event_used',
    'requires_learner_reframe_event',
    'learner_reframe_event_used',
    'instrumented_pressure',
    'private_mechanism_declared',
    'tutor_adaptive_mechanism',
    'tutor_peripeteia_score',
    'peripeteia_trigger',
    'learner_outcome_after_reversal',
    'tutor_strategy_before',
    'tutor_strategy_after',
    'shared_salient_terms',
    'sample_path',
  ];
  const lines = [header.join(',')];
  const consensusByItem = new Map();
  for (const run of report.runs) {
    for (const row of run.consensusByItem || []) consensusByItem.set(row.itemId, row);
  }
  for (const row of report.rows) {
    const peripeteia = row.tutor_adaptation_metadata?.peripeteia || {};
    const branchValidity = row.tutor_adaptation_metadata?.branch_validity || {};
    const taxonomy = scenarioTaxonomy(row);
    const consensus = consensusByItem.get(row.item_id) || null;
    lines.push(
      [
        row.run_id,
        row.item_id,
        row.unit_id,
        row.repeat,
        row.arm,
        row.tid,
        row.drama_id,
        row.control_role,
        taxonomy.evaluationRole,
        taxonomy.baselineControlClass,
        taxonomy.organicReversalRisk,
        row.critic_model,
        row.form_class,
        row.score_metadata?.learning_signal_class,
        consensus?.consensusClass,
        consensus?.claimStatus,
        consensus?.recognitionVotes,
        consensus?.totalCritics,
        consensus?.disagreement,
        row.recontextualization,
        row.score_metadata?.actional_breakthrough,
        row.score_metadata?.adaptive_mechanism_quality ??
          row.score_metadata?.role_symmetric_scores?.tutor_adaptive_mechanism_quality?.score100,
        row.stated_insight,
        row.pivot_learner_turn,
        row.learner_self_reframe,
        row.tutor_contingent_adaptation,
        row.tutor_adaptation_score,
        row.uptake_delta,
        peripeteia.learner_reversal_pressure,
        branchValidity.valid,
        branchValidity.requires_learner_reversal_event,
        branchValidity.learner_reversal_event_used,
        branchValidity.requires_learner_reframe_event,
        branchValidity.learner_reframe_event_used,
        peripeteia.instrumented_pressure,
        peripeteia.private_mechanism_declared,
        peripeteia.tutor_adaptive_mechanism || peripeteia.tutor_strategy_reversal,
        peripeteia.tutor_peripeteia_score,
        peripeteia.trigger_type,
        peripeteia.learner_outcome_after_reversal,
        row.tutor_strategy_before,
        row.tutor_strategy_after,
        (row.shared_salient_terms || []).join(' '),
        row.sample_path,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openPoeticsStore(args.dbPath || undefined);
  try {
    const report = buildPoeticsReport(db, { runId: args.runId });
    if (!args.noMarkdown) writeFile(args.out, renderMarkdown(report));
    if (!args.noCsv) writeFile(args.csv, renderCsv(report));
    if (args.json) writeFile(args.json, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `poetics report: ${report.runs.length} run(s), ${report.rows.length} score/label row(s)` +
        `${args.noMarkdown ? '' : `\nmarkdown: ${path.relative(ROOT, args.out)}`}` +
        `${args.noCsv ? '' : `\ncsv: ${path.relative(ROOT, args.csv)}`}`,
    );
  } finally {
    db.close();
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export { buildPoeticsReport, loadRows, renderCsv, renderMarkdown };
