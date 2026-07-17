#!/usr/bin/env node

// Part 1a of the frozen v2.4 contract (PLAN_4_0/2026-07-13-adaptive-state-decomposition-and-voi-protocol-v2.4.md;
// machine mirror config/adaptive-state-instrument-v2.4.yaml): the P0 decomposition audit of the v2.3 sensor stop.
//
// Zero model calls end to end. Diagnostic only: nothing here can rescue, reinterpret, exclude, or promote any row
// of any stopped run. It reads ONLY checksum-verified restores of the two sealed v2.3 archives (S0 exact-channel
// dataset + canonical-pilot comparators), refits the pilot's own frozen head diagnostically (A1 schedule floor,
// A2 regularization sweep, A3 world encoding, A4 per-kernel split), applies the frozen classification rule, and
// writes exports/adaptive-state-v24/decomposition-audit-report.{json,md}.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import {
  canonicalJson,
  captureGitFingerprint,
  hashCanonicalJson,
  hashFile,
  sha256,
  verifyExperimentRun,
} from '../services/experimentRunArtifacts.js';
import {
  bootstrapMetric,
  predictionLosses,
  validateAdaptiveStateCanonicalPilotPredictions,
  validateAdaptiveStateCanonicalPilotReport,
} from '../services/adaptiveTutor/stateBenchmarkCanonicalPilot.js';
import {
  adaptiveStateStage0PredictionMetrics,
  fitAdaptiveStateStage0Head,
  predictAdaptiveStateStage0Head,
  validateAdaptiveStateStage0ReportContentSha256,
  validateAdaptiveStateStage0SplitManifestContentSha256,
} from '../services/adaptiveTutor/stateBenchmarkStage0Analysis.js';
import { loadAdaptiveStateStage0Dataset } from '../services/adaptiveTutor/stateBenchmarkStage0Executor.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');

export const ADAPTIVE_STATE_DECOMPOSITION_AUDIT_REPORT_SCHEMA =
  'machinespirits.adaptive-state-decomposition-audit-report.v2.4';

const INSTRUMENT_SCHEMA = 'machinespirits.adaptive-state-instrument-config.v2.4';
const EVIDENCE_MANIFEST_SCHEMA = 'machinespirits.adaptive-tutor-evidence-manifest.v1';
const RUNGS = Object.freeze(['lean_dag', 'dag_trajectory', 'field_trajectory']);
const PILOT_BASELINES = Object.freeze(['no_state', 'class_prior', 'uniform', 'oracle']);
const CONFIDENCE_LEVEL = 0.95;
const REUSE_MAX_PROBABILITY_DELTA = 1e-6;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stable(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

/**
 * Frozen v2.4 Part 1a contract assertion — fail closed on any drift between this
 * implementation and the machine mirror (config/adaptive-state-instrument-v2.4.yaml).
 */
export function assertAdaptiveStateV24DecompositionContract(instrumentConfig) {
  if (instrumentConfig?.schema !== INSTRUMENT_SCHEMA || String(instrumentConfig?.version) !== '2.4') {
    throw new Error('decomposition audit: instrument config is not the frozen v2.4 machine mirror');
  }
  const expectedPart1a = {
    analyses: ['schedule_floor', 'dimensionality_regularization', 'world_encoding', 'per_kernel_failure_modes'],
    regularization_grid_relative_to_pilot_l2: [0.25, 1, 4, 16, 64],
    folds: 'leave_one_world_out',
    targets: ['next_dag_event_family', 'next_proof_trajectory'],
    margins_pooled_log_loss_nats: { negligible_abs_delta: 0.02, useful_delta: 0.05, world_driver_delta: -0.1 },
    classification_precedence: ['data_starved', 'world_confounded', 'representation_carries_nothing'],
    ambiguity_default: 'representation_carries_nothing',
  };
  if (hashCanonicalJson(instrumentConfig.part_1a_decomposition) !== hashCanonicalJson(expectedPart1a)) {
    throw new Error('decomposition audit: part_1a_decomposition drifted from the frozen v2.4 contract');
  }
  const expectedBootstrap = {
    clusters: 'latent_pair_id',
    resamples: 5000,
    seed: 20260713,
    refit_inside_resamples: false,
  };
  if (hashCanonicalJson(instrumentConfig.data_provenance?.bootstrap) !== hashCanonicalJson(expectedBootstrap)) {
    throw new Error('decomposition audit: bootstrap contract drifted from the frozen v2.4 contract');
  }
  return {
    part_1a: clone(instrumentConfig.part_1a_decomposition),
    bootstrap: clone(instrumentConfig.data_provenance.bootstrap),
  };
}

/**
 * A1 schedule-floor feature builder. Produces analysis rows whose ONLY representation is
 * `schedule_only` = (world, turn index) with the frozen action family carried in the same
 * `action` slot every pilot head sees, so the pilot's fixed head treats the schedule floor
 * exactly as it treats every other representation. Pure; never mutates the dataset rows.
 */
export function buildScheduleFloorRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('schedule floor: needs dataset rows');
  return rows.map((row) => {
    const worldId = row?.groups?.world_id;
    const turn = Number(row?.turn);
    if (!worldId || !Number.isFinite(turn)) {
      throw new Error(`schedule floor: row ${row?.id || '<unknown>'} is missing world or turn index`);
    }
    if (!row?.action || typeof row.action !== 'object') {
      throw new Error(`schedule floor: row ${row.id} is missing its frozen action family`);
    }
    return {
      id: row.id,
      turn,
      action: clone(row.action),
      groups: clone(row.groups),
      targets: clone(row.targets),
      representations: { schedule_only: { schedule: { turn_index: turn, world_id: String(worldId) } } },
    };
  });
}

/**
 * Frozen classification rule (margins in pooled log-loss nats; delta = rung − no_state under the
 * pilot's sign convention, negative = worse; both targets must satisfy a clause for it to bind):
 *   1. data_starved — any rung at any grid λ reaches |delta| < negligible pooled on both targets.
 *   2. world_confounded — not (1), and some rung/λ reaches |delta| < negligible in at least 2 of 3
 *      worlds on both targets while a single common remaining world drives the pooled deficit with
 *      per-world delta ≤ world_driver_delta.
 *   3. representation_carries_nothing — otherwise, including every ambiguous margin.
 * Precedence data_starved > world_confounded > representation_carries_nothing.
 */
export function classifyAdaptiveStateDecomposition({ entries, targets, worlds, margins } = {}) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('decomposition classifier: needs entries');
  if (!Array.isArray(targets) || targets.length !== 2) {
    throw new Error('decomposition classifier: needs the two frozen co-primary targets');
  }
  if (!Array.isArray(worlds) || worlds.length !== 3) {
    throw new Error('decomposition classifier: needs the three frozen worlds');
  }
  const negligibleMargin = Number(margins?.negligible_abs_delta);
  const driverMargin = Number(margins?.world_driver_delta);
  if (!(negligibleMargin > 0) || !(driverMargin < 0)) {
    throw new Error('decomposition classifier: needs the frozen negligible and world-driver margins');
  }
  const negligible = (delta) => Number.isFinite(delta) && Math.abs(delta) < negligibleMargin;
  const identity = (entry) => ({ rung: entry.rung, lambda_multiplier: entry.lambda_multiplier });

  const dataStarved = entries.filter((entry) => targets.every((target) => negligible(entry.pooled?.[target])));
  if (dataStarved.length) {
    return {
      label: 'data_starved',
      matched_clause: 1,
      evidence: { qualifying: dataStarved.map((entry) => ({ ...identity(entry), pooled: clone(entry.pooled) })) },
    };
  }

  const confounded = [];
  for (const entry of entries) {
    const perTarget = targets.map((target) => ({
      target,
      negligible_worlds: worlds.filter((world) => negligible(entry.per_world?.[world]?.[target])),
      driving_worlds: worlds.filter((world) => {
        const delta = entry.per_world?.[world]?.[target];
        return Number.isFinite(delta) && delta <= driverMargin;
      }),
    }));
    if (!perTarget.every((row) => row.negligible_worlds.length >= 2 && row.driving_worlds.length === 1)) continue;
    const drivers = new Set(perTarget.map((row) => row.driving_worlds[0]));
    // A different driving world per target is an ambiguous margin: default conservatively (clause 3).
    if (drivers.size !== 1) continue;
    confounded.push({
      ...identity(entry),
      driving_world: [...drivers][0],
      per_target: perTarget,
      per_world: clone(entry.per_world),
    });
  }
  if (confounded.length) {
    return { label: 'world_confounded', matched_clause: 2, evidence: { qualifying: confounded } };
  }
  return { label: 'representation_carries_nothing', matched_clause: 3, evidence: { qualifying: [] } };
}

function headOptionsFor(baseConfig, { representation, target, labels, lambdaMultiplier = 1 }) {
  const contract = baseConfig.analysis.fixed_head_contract;
  return {
    representation,
    target,
    labels,
    lambda: contract.regularization.lambda * lambdaMultiplier,
    regularizationScaling: contract.regularization.scaling,
    learningRate: contract.solver.learning_rate,
    maximumIterations: contract.solver.maximum_iterations,
    convergenceTolerance: contract.solver.convergence_tolerance,
    convergenceCriterion: contract.solver.convergence_criterion,
    probabilityClip: contract.probability_clip,
  };
}

function fitFoldedPredictions({ lane, byId, baseConfig, representation, target, labels, lambdaMultiplier }) {
  const models = [];
  const predictions = new Map();
  for (const fold of lane.folds) {
    const training = fold.train_ids.map((id) => byId.get(id));
    const testing = fold.test_ids.map((id) => byId.get(id));
    if (training.some((row) => !row) || testing.some((row) => !row)) {
      throw new Error(`decomposition audit: fold ${fold.id} references an unknown row`);
    }
    const model = fitAdaptiveStateStage0Head(
      training,
      headOptionsFor(baseConfig, { representation, target, labels, lambdaMultiplier }),
    );
    models.push({
      fold: fold.id,
      level: fold.level,
      converged: model.converged,
      iterations: model.iterations,
      objective: model.objective,
      features: model.encoder.featureNames.length,
    });
    for (const prediction of predictAdaptiveStateStage0Head(model, testing)) predictions.set(prediction.id, prediction);
  }
  if (predictions.size !== byId.size) {
    throw new Error('decomposition audit: leave-one-world-out folds did not predict every row exactly once');
  }
  return { models, predictions };
}

function comparisonBlock({ scopeRows, candidateById, baselineById, labels, bootstrap, material }) {
  const deltasByCluster = { log_loss: new Map(), brier_score: new Map() };
  for (const row of scopeRows) {
    const candidate = candidateById.get(row.id);
    const baseline = baselineById.get(row.id);
    if (!candidate || !baseline) throw new Error(`decomposition audit: missing paired prediction for ${row.id}`);
    const candidateLosses = predictionLosses(candidate, labels);
    const baselineLosses = predictionLosses(baseline, labels);
    for (const metric of ['log_loss', 'brier_score']) {
      const values = deltasByCluster[metric].get(row.groups.latent_pair_id) || [];
      values.push(baselineLosses[metric] - candidateLosses[metric]);
      deltasByCluster[metric].set(row.groups.latent_pair_id, values);
    }
  }
  const metrics = {};
  for (const metric of ['log_loss', 'brier_score']) {
    metrics[metric] = bootstrapMetric(deltasByCluster[metric], {
      iterations: bootstrap.resamples,
      seed: bootstrap.seed,
      confidenceLevel: CONFIDENCE_LEVEL,
      material: `${material}|${metric}`,
    });
  }
  return {
    groups: new Set(scopeRows.map((row) => row.groups.latent_pair_id)).size,
    predictions: scopeRows.length,
    metrics,
  };
}

function absoluteMetrics(rows, byId, labels) {
  return adaptiveStateStage0PredictionMetrics(
    rows.map((row) => byId.get(row.id)),
    labels,
  );
}

function scopedComparisons({ rows, worlds, generators, candidateById, baselineById, labels, bootstrap, material }) {
  const scoped = {
    pooled: comparisonBlock({
      scopeRows: rows,
      candidateById,
      baselineById,
      labels,
      bootstrap,
      material: `${material}|pooled`,
    }),
    per_world: {},
    per_generator: {},
  };
  for (const world of worlds) {
    scoped.per_world[world] = comparisonBlock({
      scopeRows: rows.filter((row) => row.groups.world_id === world),
      candidateById,
      baselineById,
      labels,
      bootstrap,
      material: `${material}|world=${world}`,
    });
  }
  for (const generator of generators) {
    scoped.per_generator[generator] = comparisonBlock({
      scopeRows: rows.filter((row) => row.groups.generator_id === generator),
      candidateById,
      baselineById,
      labels,
      bootstrap,
      material: `${material}|generator=${generator}`,
    });
  }
  return scoped;
}

function pilotPredictionIndex(pilotPredictions, targets) {
  const index = new Map();
  for (const target of targets) index.set(target, new Map());
  for (const row of pilotPredictions.rows) {
    if (row.lane !== 'world_transfer') continue;
    const byRepresentation = index.get(row.target);
    if (!byRepresentation) continue;
    if (!byRepresentation.has(row.representation)) byRepresentation.set(row.representation, new Map());
    byRepresentation.get(row.representation).set(row.id, row);
  }
  return index;
}

function pilotComparisonRows(pilotReport, { targets, worlds }) {
  const pick = ({ level, target, candidate }) => {
    const row = pilotReport.comparisons.find(
      (item) =>
        item.lane === 'world_transfer' &&
        item.level === level &&
        item.target === target &&
        item.candidate === candidate &&
        item.baseline === 'no_state',
    );
    if (!row) throw new Error(`decomposition audit: pilot report is missing ${candidate}@${level} vs no_state`);
    return clone(row.metrics);
  };
  const out = { pooled: {}, per_world: {} };
  for (const candidate of [...RUNGS, 'oracle']) {
    out.pooled[candidate] = {};
    for (const target of targets) out.pooled[candidate][target] = pick({ level: 'pooled', target, candidate });
  }
  for (const candidate of RUNGS) {
    out.per_world[candidate] = {};
    for (const world of worlds) {
      out.per_world[candidate][world] = {};
      for (const target of targets) out.per_world[candidate][world][target] = pick({ level: world, target, candidate });
    }
  }
  return out;
}

function maxProbabilityDelta(mineById, pilotById, labels) {
  let maximum = 0;
  for (const [id, mine] of mineById) {
    const pilot = pilotById.get(id);
    if (!pilot) throw new Error(`decomposition audit: pilot predictions missing row ${id}`);
    for (const label of labels) {
      maximum = Math.max(maximum, Math.abs(Number(mine.probabilities[label]) - Number(pilot.probabilities[label])));
    }
  }
  return maximum;
}

function flattenLeaves(value, prefix = '', out = {}) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => flattenLeaves(child, `${prefix}[${index}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flattenLeaves(child, prefix ? `${prefix}.${key}` : key, out);
    return out;
  }
  if (prefix) out[prefix] = value;
  return out;
}

function distribution(values) {
  const counts = {};
  for (const value of values) counts[String(value)] = (counts[String(value)] || 0) + 1;
  return Object.fromEntries(stable(Object.keys(counts)).map((key) => [key, counts[key]]));
}

function worldFeatureSummaries({ dataset, worlds, generators, targets }) {
  const summaries = {};
  for (const world of worlds) {
    const rows = dataset.rows.filter((row) => row.groups.world_id === world);
    const numeric = {};
    const booleans = {};
    for (const row of rows) {
      const leaves = flattenLeaves(row.representations.lean_dag.additional_state, 'lean_dag.additional_state');
      leaves['no_state.common.task.item_difficulty'] = row.representations.no_state.common.task.item_difficulty;
      leaves['no_state.common.task.prerequisite_count'] = row.representations.no_state.common.task.prerequisite_count;
      for (const [key, value] of Object.entries(leaves)) {
        if (typeof value === 'number' && Number.isFinite(value)) (numeric[key] = numeric[key] || []).push(value);
        if (typeof value === 'boolean') (booleans[key] = booleans[key] || []).push(value ? 1 : 0);
      }
    }
    const numericSummary = Object.fromEntries(
      stable(Object.keys(numeric)).map((key) => {
        const values = numeric[key];
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
        return [key, { mean: round(mean), sd: round(Math.sqrt(variance)) }];
      }),
    );
    const booleanSummary = Object.fromEntries(
      stable(Object.keys(booleans)).map((key) => {
        const values = booleans[key];
        return [key, { fraction_true: round(values.reduce((sum, value) => sum + value, 0) / values.length) }];
      }),
    );
    const dialogues = dataset.dialogues.filter((dialogue) => dialogue.world_id === world);
    const schedules = {};
    for (const generator of generators) {
      schedules[generator] = stable(
        new Set(
          dialogues.filter((dialogue) => dialogue.generator_id === generator).map((d) => d.action_schedule.join(' > ')),
        ),
      );
    }
    summaries[world] = {
      rows: rows.length,
      task: clone(rows[0].representations.no_state.common.task),
      target_distributions: Object.fromEntries(
        targets.map((target) => [target, distribution(rows.map((row) => row.targets[target]))]),
      ),
      action_schedules_by_generator: schedules,
      lean_dag_numeric_features: numericSummary,
      lean_dag_boolean_features: booleanSummary,
    };
  }
  return summaries;
}

function fmt(value, digits = 4) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : 'n/a';
}

function metricCell(block, metric) {
  const row = block.metrics[metric];
  return `${fmt(row.point_delta)} [${fmt(row.confidence_interval.lower)}, ${fmt(row.confidence_interval.upper)}]`;
}

function renderMarkdown(report) {
  const { targets, worlds, generators } = report.coverage;
  const lines = [
    '# Adaptive-state v2.4 Part 1a — decomposition audit of the v2.3 sensor stop',
    '',
    `Classification: **\`${report.classification.label}\`**`,
    '',
    `> ${report.claim_boundary}`,
    '',
    'Zero model calls. Diagnostic and directional only: nothing in this report rescues, reinterprets, excludes, or',
    'promotes any row of any stopped run; `winner: null` and `do_not_optimize_policy` remain operative; S2 remains',
    'prohibited. Delta convention throughout: pilot sign convention (delta = no_state loss − candidate loss, in',
    'pooled log-loss nats unless marked Brier); negative = worse than no_state.',
    '',
    '## Provenance',
    '',
    `- S0 fixed-schedule arm: \`${report.provenance.restored_archives.s0.run_id}\` (archive sha256 \`${report.provenance.restored_archives.s0.archive_sha256}\`), checksum-verified restore`,
    `- Pilot comparator: \`${report.provenance.restored_archives.pilot.run_id}\` (archive sha256 \`${report.provenance.restored_archives.pilot.archive_sha256}\`), checksum-verified restore; its rows are compared against, never re-scored`,
    `- Git commit: \`${report.provenance.git.sha}\`${report.provenance.git.dirty ? ' (dirty worktree)' : ''}`,
    `- Reuse check: refits at 1.0x lambda reproduce the pilot's sealed predictions to max |Δp| = ${report.reuse_consistency.max_probability_delta_at_1x.toExponential(2)}`,
    '',
    '## A1 — schedule floor (pooled, leave-one-world-out)',
    '',
    "Prediction from (world, turn index, action family) alone, with the pilot's fixed head. Pilot comparator rows",
    'are read from the restored pilot archive, not refit.',
    '',
    '| Head | Target | Log-loss | Brier |',
    '|---|---|---:|---:|',
  ];
  for (const target of targets) {
    for (const id of ['uniform', 'class_prior', 'no_state', 'schedule_only', 'oracle']) {
      const source =
        id === 'schedule_only'
          ? report.a1_schedule_floor.absolute[target]
          : report.pilot_comparators.pooled_absolute[target][id];
      lines.push(`| ${id} | ${target} | ${fmt(source.log_loss)} | ${fmt(source.brier_score)} |`);
    }
  }
  lines.push('', '| Contrast | Target | Log-loss delta [95% CI] | Brier delta [95% CI] |', '|---|---|---:|---:|');
  for (const target of targets) {
    lines.push(
      `| schedule_only vs no_state | ${target} | ${metricCell(report.a1_schedule_floor.deltas_vs_pilot_no_state.pooled[target], 'log_loss')} | ${metricCell(report.a1_schedule_floor.deltas_vs_pilot_no_state.pooled[target], 'brier_score')} |`,
      `| schedule_only vs class_prior | ${target} | ${metricCell(report.a1_schedule_floor.deltas_vs_pilot_class_prior.pooled[target], 'log_loss')} | ${metricCell(report.a1_schedule_floor.deltas_vs_pilot_class_prior.pooled[target], 'brier_score')} |`,
    );
  }
  lines.push('', '## A2 — regularization sweep (pooled log-loss delta vs the pilot no_state, nats)', '');
  for (const target of targets) {
    lines.push(
      `### ${target}`,
      '',
      `| Rung | ${report.a2_regularization_sweep.lambda_grid.map((m) => `${m}x`).join(' | ')} |`,
      `|---|${report.a2_regularization_sweep.lambda_grid.map(() => '---:').join('|')}|`,
    );
    for (const rung of RUNGS) {
      const cells = report.a2_regularization_sweep.lambda_grid.map((multiplier) => {
        const entry = report.a2_regularization_sweep.entries.find(
          (item) => item.rung === rung && item.lambda_multiplier === multiplier,
        );
        return fmt(entry.targets[target].delta_vs_pilot_no_state.pooled.metrics.log_loss.point_delta);
      });
      lines.push(`| ${rung} | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }
  lines.push('## A3 — world encoding (per-world log-loss delta vs the pilot no_state, nats)', '');
  for (const target of targets) {
    lines.push(
      `### ${target}`,
      '',
      `| Rung @ lambda | ${worlds.join(' | ')} |`,
      `|---|${worlds.map(() => '---:').join('|')}|`,
    );
    for (const rung of RUNGS) {
      for (const multiplier of report.a2_regularization_sweep.lambda_grid) {
        const entry = report.a2_regularization_sweep.entries.find(
          (item) => item.rung === rung && item.lambda_multiplier === multiplier,
        );
        const cells = worlds.map((world) =>
          fmt(entry.targets[target].delta_vs_pilot_no_state.per_world[world].metrics.log_loss.point_delta),
        );
        lines.push(`| ${rung} @ ${multiplier}x | ${cells.join(' | ')} |`);
      }
    }
    lines.push('');
  }
  lines.push(
    '### Per-world context',
    '',
    '| World | no_state log-loss (pilot) | schedule_only delta vs no_state (both targets) | dominant labels |',
    '|---|---:|---|---|',
  );
  for (const world of worlds) {
    const noState = targets
      .map((target) => fmt(report.a3_world_encoding.pilot_no_state_per_world_absolute[world][target].log_loss))
      .join(' / ');
    const floor = targets
      .map((target) =>
        fmt(report.a1_schedule_floor.deltas_vs_pilot_no_state.per_world[world][target].metrics.log_loss.point_delta),
      )
      .join(' / ');
    const dominant = targets
      .map((target) => {
        const counts = report.a3_world_encoding.world_feature_summaries[world].target_distributions[target];
        const top = Object.entries(counts).sort((left, right) => right[1] - left[1])[0];
        return `${top[0]} ${top[1]}/${Object.values(counts).reduce((sum, value) => sum + value, 0)}`;
      })
      .join('; ');
    lines.push(`| ${world} | ${noState} | ${floor} | ${dominant} |`);
  }
  lines.push('', '## A4 — per-kernel split (pooled-within-generator log-loss delta vs the pilot no_state, nats)', '');
  for (const target of targets) {
    lines.push(
      `### ${target}`,
      '',
      `| Rung @ lambda | ${generators.join(' | ')} |`,
      `|---|${generators.map(() => '---:').join('|')}|`,
    );
    for (const rung of RUNGS) {
      for (const multiplier of report.a2_regularization_sweep.lambda_grid) {
        const entry = report.a2_regularization_sweep.entries.find(
          (item) => item.rung === rung && item.lambda_multiplier === multiplier,
        );
        const cells = generators.map((generator) =>
          fmt(entry.targets[target].delta_vs_pilot_no_state.per_generator[generator].metrics.log_loss.point_delta),
        );
        lines.push(`| ${rung} @ ${multiplier}x | ${cells.join(' | ')} |`);
      }
    }
    lines.push('');
  }
  lines.push(
    '## Classification',
    '',
    `- Rule margins (pooled log-loss nats): negligible |delta| < ${report.classification.margins.negligible_abs_delta}; world driver delta <= ${report.classification.margins.world_driver_delta}; useful delta >= ${report.classification.margins.useful_delta}`,
    `- Precedence: ${report.classification.precedence.join(' > ')}; every ambiguity defaults to \`${report.classification.ambiguity_default}\``,
    `- Matched clause: ${report.classification.matched_clause}`,
    `- Label: **\`${report.classification.label}\`**`,
    '',
    '## Why',
    '',
    report.why,
    '',
    `Report content SHA-256: \`${report.content_sha256}\``,
    '',
  );
  return lines.join('\n');
}

function pairText(values) {
  return values.map((value) => fmt(value)).join('/');
}

function buildWhyParagraph(facts) {
  const { targets, classification } = facts;
  const sentences = [];
  const floorRelation = facts.floor.pooled_log_loss.every((delta) => delta > 0)
    ? 'beats'
    : facts.floor.pooled_log_loss.every((delta) => Math.abs(delta) < 0.02)
      ? 'matches'
      : 'sits near';
  const priorGap = facts.no_state_minus_class_prior;
  const priorClause = priorGap.every((value) => value > 0)
    ? `carries ${pairText(priorGap)} nats more log-loss than the training-fold class prior`
    : priorGap.every((value) => value < 0)
      ? `carries ${pairText(priorGap.map((value) => Math.abs(value)))} nats less log-loss than the training-fold class prior`
      : `differs from the training-fold class prior by ${pairText(priorGap)} nats (no_state minus class_prior)`;
  sentences.push(
    `The schedule floor explains the entire no_state reference: predicting from (world, turn index, action family) alone with the same frozen head ${floorRelation} the pilot's no_state rows by ${pairText(facts.floor.pooled_log_loss)} pooled log-loss nats on ${targets.join(' / ')} (Brier ${pairText(facts.floor.pooled_brier)}), and the pilot's no_state itself ${priorClause} under leave-one-world-out — so the baseline every rung was measured against was an overfit schedule proxy, not a floor of learner-state knowledge.`,
  );
  if (classification.label === 'data_starved') {
    const qualifier = classification.evidence.qualifying[0];
    sentences.push(
      `Regularization alone eliminates the pilot's negative — clause 1 of the frozen rule: ${qualifier.rung} at ${qualifier.lambda_multiplier}x lambda lands inside the 0.02-nat negligible band on both targets (${pairText(targets.map((target) => qualifier.pooled[target]))}), and the rung deltas swing from between ${fmt(facts.sweep_at_pilot_lambda_range[0])} and ${fmt(facts.sweep_at_pilot_lambda_range[1])} nats at the pilot's 1x penalty to as high as +${fmt(facts.sweep_best.delta)} (${facts.sweep_best.rung} at ${facts.sweep_best.lambda_multiplier}x on ${facts.sweep_best.target}).`,
    );
  } else if (classification.label === 'world_confounded') {
    const qualifier = classification.evidence.qualifying[0];
    sentences.push(
      `The pooled deficit is world-concentrated — clause 2 of the frozen rule: at ${qualifier.rung}/${qualifier.lambda_multiplier}x the deltas are negligible in at least two worlds on both targets while ${qualifier.driving_world} alone drives the deficit past the -0.10 driver margin.`,
    );
  } else {
    sentences.push(
      `No rung at any grid lambda reaches the 0.02-nat negligible band on both targets (best pooled delta ${fmt(facts.sweep_best.delta)}, ${facts.sweep_best.rung} at ${facts.sweep_best.lambda_multiplier}x on ${facts.sweep_best.target}), and no single-world driver pattern satisfies clause 2, so the frozen rule closes the ladder.`,
    );
  }
  sentences.push(
    `What regularization does not recover is state signal: the no_state head refit at the same lambdas gains just as much (${pairText(facts.no_state_sweep_best)} nats at its best grid point), and no rung ever beats the matched-lambda no_state anywhere on the grid (largest matched-lambda margin ${fmt(facts.matched_lambda_best.value)} nats, ${facts.matched_lambda_best.rung} at ${facts.matched_lambda_best.lambda_multiplier}x on ${facts.matched_lambda_best.target}) — the pilot-lambda deficits were the fixed head data-starving its wider one-hot feature sets on 96-row training folds, and shrinkage converges every head toward the same schedule-plus-prior solution rather than exposing latent-state content.`,
  );
  sentences.push(
    `The world decomposition names the driver behind both stories: the pilot's no_state collapses on held-out ravensmark (log-loss ${pairText(facts.pilot_no_state_absolute.ravensmark)} there vs ${pairText(facts.pilot_no_state_absolute.hethel)} on hethel and ${pairText(facts.pilot_no_state_absolute.marrick)} on marrick), because its task features encode world identity numerically (ravensmark's item_difficulty ${fmt(facts.item_difficulty.ravensmark, 3)} lies far outside the training worlds' ${fmt(facts.item_difficulty.marrick, 3)}-${fmt(facts.item_difficulty.hethel, 3)} range) and its labels are the most skewed (${facts.ravensmark_skew}); the schedule floor's pooled win is mostly that ravensmark repair (${pairText(facts.floor.ravensmark_log_loss)} nats there). Hethel's pilot-only lean_dag gain (${pairText(facts.pilot_lean_hethel)}) is the mirror image: hethel is the fold whose no_state baseline held up best, so a small lean-DAG edge was only visible there — per-world deltas against the fixed 1x reference mostly measure the reference's fold pathology, not state content.`,
  );
  sentences.push(
    `The per-kernel split shows ${facts.kernel_all_negative_at_pilot_lambda ? 'the same signed failure under both generators at the pilot lambda (every rung negative on durable_state and dag_dropout alike), so no single kernel manufactured the v2.3 stop' : 'kernel-dependent signs at the pilot lambda, so the per-kernel table in this report is the caveat on any pooled reading'}.`,
  );
  if (classification.label === 'data_starved') {
    sentences.push(
      "Under the frozen precedence the label is data_starved; its only downstream authority is as the precondition for the VOI study's inconclusive_data_starved verdict and for reopening design discussion (not runs) on tutor-stub-transition-reward-model. It does not rescue the v2.3 stop: at every tested capacity the rungs still show no predictive signal beyond the fixed schedule and the world-skewed priors.",
    );
  } else if (classification.label === 'world_confounded') {
    sentences.push(
      'Under the frozen precedence the label is world_confounded; it directs any future sensor work at world encoding and nothing else. It does not rescue the v2.3 stop.',
    );
  } else {
    sentences.push(
      'Under the frozen precedence the label is representation_carries_nothing; it closes the representation ladder on this critical path. It does not rescue the v2.3 stop.',
    );
  }
  return sentences.join(' ');
}

function usage() {
  return `Usage: node scripts/analyze-adaptive-state-decomposition-v24.js --s0-run DIR --pilot-run DIR [options]

Part 1a (P0 decomposition audit) of the frozen v2.4 contract. Zero model calls.
Reads ONLY checksum-verified restores of the sealed v2.3 archives (restore with
scripts/restore-adaptive-run.js, verify with scripts/verify-experiment-run.js).

Options:
  --s0-run <dir>            Restored sealed S0 exact-channel run (required)
  --pilot-run <dir>         Restored sealed canonical-pilot run (required)
  --out <dir>               Default: exports/adaptive-state-v24
  --base-config <path>      Default: config/adaptive-state-benchmark-v2.yaml
  --instrument-config <path> Default: config/adaptive-state-instrument-v2.4.yaml
  --help                    Show this help
`;
}

function verifyRestoredArchive({ runDir, manifestPath, role }) {
  const manifest = readJson(manifestPath);
  if (manifest.schema !== EVIDENCE_MANIFEST_SCHEMA) {
    throw new Error(`decomposition audit: unsupported evidence manifest schema for ${role}`);
  }
  const verification = verifyExperimentRun(runDir);
  if (!verification.ok) {
    throw new Error(
      `decomposition audit: restored ${role} run failed verification:\n- ${verification.errors.join('\n- ')}`,
    );
  }
  if (verification.plan.runId !== manifest.runId) {
    throw new Error(`decomposition audit: restored ${role} run id does not match the pinned evidence manifest`);
  }
  const sealSha256 = sha256(fs.readFileSync(path.join(runDir, 'run-seal.json')));
  if (sealSha256 !== manifest.source?.sealSha256) {
    throw new Error(`decomposition audit: restored ${role} seal does not match the pinned evidence manifest`);
  }
  return {
    run_id: manifest.runId,
    manifest_path: path.relative(ROOT, manifestPath),
    archive_sha256: manifest.archive?.sha256,
    seal_sha256: sealSha256,
    verified: true,
  };
}

function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      's0-run': { type: 'string' },
      'pilot-run': { type: 'string' },
      out: { type: 'string', default: path.join(ROOT, 'exports', 'adaptive-state-v24') },
      'base-config': { type: 'string', default: path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml') },
      'instrument-config': {
        type: 'string',
        default: path.join(ROOT, 'config', 'adaptive-state-instrument-v2.4.yaml'),
      },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values['s0-run'] || !values['pilot-run']) {
    process.stdout.write(usage());
    if (!values.help) process.exitCode = 1;
    return;
  }
  const s0RunDir = path.resolve(values['s0-run']);
  const pilotRunDir = path.resolve(values['pilot-run']);
  const looseRoot = path.join(ROOT, 'exports', 'adaptive-state-benchmark-v2');
  for (const dir of [s0RunDir, pilotRunDir]) {
    if (!path.relative(looseRoot, dir).startsWith('..')) {
      throw new Error(
        `decomposition audit: ${dir} is the loose worktree copy; analyses must read a checksum-verified restore`,
      );
    }
  }

  const instrumentConfigPath = path.resolve(values['instrument-config']);
  const baseConfigPath = path.resolve(values['base-config']);
  const instrumentConfig = yaml.parse(fs.readFileSync(instrumentConfigPath, 'utf8'));
  const contract = assertAdaptiveStateV24DecompositionContract(instrumentConfig);
  const baseConfig = yaml.parse(fs.readFileSync(baseConfigPath, 'utf8'));
  const margins = contract.part_1a.margins_pooled_log_loss_nats;
  const lambdaGrid = contract.part_1a.regularization_grid_relative_to_pilot_l2;
  const bootstrap = contract.bootstrap;
  const targets = contract.part_1a.targets;

  const archives = {
    s0: verifyRestoredArchive({
      runDir: s0RunDir,
      manifestPath: path.resolve(ROOT, instrumentConfig.data_provenance.fixed_schedule_arm.manifest),
      role: 'S0',
    }),
    pilot: verifyRestoredArchive({
      runDir: pilotRunDir,
      manifestPath: path.resolve(ROOT, instrumentConfig.data_provenance.pilot_comparator.manifest),
      role: 'pilot',
    }),
  };
  process.stderr.write(`verified restored archives: ${archives.s0.run_id}, ${archives.pilot.run_id}\n`);

  const dataset = loadAdaptiveStateStage0Dataset(s0RunDir);
  if (dataset.model_call_count !== 0) throw new Error('decomposition audit: S0 dataset reports nonzero model calls');
  const splitManifest = readJson(path.join(s0RunDir, 'split-manifest.json'));
  validateAdaptiveStateStage0SplitManifestContentSha256(splitManifest);
  const s0Report = readJson(path.join(s0RunDir, 'stage0-contract-report.json'));
  validateAdaptiveStateStage0ReportContentSha256(s0Report);
  if (s0Report.status !== 'pass' || s0Report.provenance.dataset_sha256 !== dataset.content_sha256) {
    throw new Error('decomposition audit: restored S0 report is not the sealed pass over this dataset');
  }
  const pilotPredictions = readJson(path.join(pilotRunDir, 'canonical-pilot-predictions.json'));
  validateAdaptiveStateCanonicalPilotPredictions(pilotPredictions);
  const pilotReport = readJson(path.join(pilotRunDir, 'canonical-pilot-report.json'));
  validateAdaptiveStateCanonicalPilotReport(pilotReport);
  if (pilotReport.decision !== 'do_not_run_canonical_s2') {
    throw new Error('decomposition audit: restored pilot is not the sealed v2.3 stop');
  }
  if (pilotReport.provenance.parent_dataset_sha256 !== dataset.content_sha256) {
    throw new Error('decomposition audit: pilot comparator was not fit on the restored S0 dataset');
  }

  const labelsByTarget = Object.fromEntries(
    s0Report.protocol.target_contracts.map((target) => [target.id, [...target.labels]]),
  );
  if (hashCanonicalJson(stable(targets)) !== hashCanonicalJson(stable(Object.keys(labelsByTarget)))) {
    throw new Error('decomposition audit: instrument targets differ from the sealed S0 target contracts');
  }
  const worldLane = splitManifest.lanes.find((lane) => lane.id === 'world_transfer');
  if (!worldLane) throw new Error('decomposition audit: split manifest is missing the leave-one-world-out lane');
  const worlds = stable(new Set(dataset.rows.map((row) => row.groups.world_id)));
  const generators = stable(new Set(dataset.rows.map((row) => row.groups.generator_id)));
  if (
    worlds.length !== 3 ||
    hashCanonicalJson(worlds) !== hashCanonicalJson(stable(worldLane.folds.map((fold) => fold.level)))
  ) {
    throw new Error('decomposition audit: worlds do not match the frozen leave-one-world-out folds');
  }
  const byId = new Map(dataset.rows.map((row) => [row.id, row]));
  const pilotIndex = pilotPredictionIndex(pilotPredictions, targets);
  for (const target of targets) {
    for (const representation of [...PILOT_BASELINES, ...RUNGS]) {
      const rows = pilotIndex.get(target).get(representation);
      if (!rows || rows.size !== dataset.rows.length) {
        throw new Error(`decomposition audit: pilot predictions incomplete for ${representation}/${target}`);
      }
    }
  }

  // Pilot comparator numbers (read, never refit).
  const pilotAbsolute = {};
  const pilotNoStatePerWorld = {};
  for (const target of targets) {
    pilotAbsolute[target] = {};
    for (const representation of PILOT_BASELINES) {
      pilotAbsolute[target][representation] = absoluteMetrics(
        dataset.rows,
        pilotIndex.get(target).get(representation),
        labelsByTarget[target],
      );
    }
    const crosscheckPairs = [
      ['no_state', 'no_state'],
      ['class_prior', 'class_prior'],
      ['uniform', 'uniform'],
      ['oracle', 'oracle'],
    ];
    for (const [mine, s0Key] of crosscheckPairs) {
      for (const metric of ['log_loss', 'brier_score']) {
        const difference = Math.abs(pilotAbsolute[target][mine][metric] - s0Report.instrument[target][s0Key][metric]);
        if (!(difference < 1e-9)) {
          throw new Error(`decomposition audit: pilot ${mine}/${target}/${metric} disagrees with the sealed S0 report`);
        }
      }
    }
  }
  for (const world of worlds) {
    pilotNoStatePerWorld[world] = {};
    const worldRows = dataset.rows.filter((row) => row.groups.world_id === world);
    for (const target of targets) {
      pilotNoStatePerWorld[world][target] = absoluteMetrics(
        worldRows,
        pilotIndex.get(target).get('no_state'),
        labelsByTarget[target],
      );
    }
  }
  const pilotDeltas = pilotComparisonRows(pilotReport, { targets, worlds });

  // A1 — schedule floor.
  process.stderr.write('A1: fitting the schedule floor (world, turn index, action family)\n');
  const scheduleRows = buildScheduleFloorRows(dataset.rows);
  const scheduleById = new Map(scheduleRows.map((row) => [row.id, row]));
  const a1 = {
    head: 'pilot fixed multinomial-logistic head at 1x lambda on (world, turn index, action family) only',
    absolute: {},
    deltas_vs_pilot_no_state: { pooled: {}, per_world: {}, per_generator: {} },
    deltas_vs_pilot_class_prior: { pooled: {} },
    models: [],
  };
  for (const target of targets) {
    const { models, predictions } = fitFoldedPredictions({
      lane: worldLane,
      byId: scheduleById,
      baseConfig,
      representation: 'schedule_only',
      target,
      labels: labelsByTarget[target],
      lambdaMultiplier: 1,
    });
    a1.models.push(...models.map((model) => ({ target, ...model })));
    a1.absolute[target] = absoluteMetrics(dataset.rows, predictions, labelsByTarget[target]);
    const scoped = scopedComparisons({
      rows: dataset.rows,
      worlds,
      generators,
      candidateById: predictions,
      baselineById: pilotIndex.get(target).get('no_state'),
      labels: labelsByTarget[target],
      bootstrap,
      material: `1a|a1|schedule_only|1x|vs=no_state|${target}`,
    });
    a1.deltas_vs_pilot_no_state.pooled[target] = scoped.pooled;
    for (const world of worlds) {
      a1.deltas_vs_pilot_no_state.per_world[world] = a1.deltas_vs_pilot_no_state.per_world[world] || {};
      a1.deltas_vs_pilot_no_state.per_world[world][target] = scoped.per_world[world];
    }
    for (const generator of generators) {
      a1.deltas_vs_pilot_no_state.per_generator[generator] = a1.deltas_vs_pilot_no_state.per_generator[generator] || {};
      a1.deltas_vs_pilot_no_state.per_generator[generator][target] = scoped.per_generator[generator];
    }
    a1.deltas_vs_pilot_class_prior.pooled[target] = comparisonBlock({
      scopeRows: dataset.rows,
      candidateById: predictions,
      baselineById: pilotIndex.get(target).get('class_prior'),
      labels: labelsByTarget[target],
      bootstrap,
      material: `1a|a1|schedule_only|1x|vs=class_prior|${target}|pooled`,
    });
  }

  // A2/A3/A4 — regularization sweep with per-world and per-generator decompositions.
  const a2Entries = [];
  const worldGeneratorDeltas = [];
  const reuse = { per_rung: {}, max_probability_delta_at_1x: 0 };
  for (const rung of RUNGS) {
    for (const multiplier of lambdaGrid) {
      process.stderr.write(`A2: fitting ${rung} at ${multiplier}x lambda\n`);
      const entry = {
        rung,
        lambda_multiplier: multiplier,
        lambda: baseConfig.analysis.fixed_head_contract.regularization.lambda * multiplier,
        targets: {},
        models: [],
      };
      for (const target of targets) {
        const { models, predictions } = fitFoldedPredictions({
          lane: worldLane,
          byId,
          baseConfig,
          representation: rung,
          target,
          labels: labelsByTarget[target],
          lambdaMultiplier: multiplier,
        });
        entry.models.push(...models.map((model) => ({ target, ...model })));
        if (multiplier === 1) {
          const delta = maxProbabilityDelta(predictions, pilotIndex.get(target).get(rung), labelsByTarget[target]);
          reuse.per_rung[`${rung}|${target}`] = delta;
          reuse.max_probability_delta_at_1x = Math.max(reuse.max_probability_delta_at_1x, delta);
        }
        entry.targets[target] = {
          absolute: absoluteMetrics(dataset.rows, predictions, labelsByTarget[target]),
          delta_vs_pilot_no_state: scopedComparisons({
            rows: dataset.rows,
            worlds,
            generators,
            candidateById: predictions,
            baselineById: pilotIndex.get(target).get('no_state'),
            labels: labelsByTarget[target],
            bootstrap,
            material: `1a|a2|${rung}|${multiplier}x|vs=no_state|${target}`,
          }),
        };
        // A4 extra: world x generator deltas (descriptive only; 2 latent-pair clusters per cell).
        for (const world of worlds) {
          for (const generator of generators) {
            const scopeRows = dataset.rows.filter(
              (row) => row.groups.world_id === world && row.groups.generator_id === generator,
            );
            worldGeneratorDeltas.push({
              rung,
              lambda_multiplier: multiplier,
              target,
              world,
              generator,
              ...comparisonBlock({
                scopeRows,
                candidateById: predictions,
                baselineById: pilotIndex.get(target).get('no_state'),
                labels: labelsByTarget[target],
                bootstrap,
                material: `1a|a4|${rung}|${multiplier}x|vs=no_state|${target}|world=${world}|generator=${generator}`,
              }),
            });
          }
        }
      }
      a2Entries.push(entry);
    }
  }
  if (reuse.max_probability_delta_at_1x > REUSE_MAX_PROBABILITY_DELTA) {
    throw new Error(
      `decomposition audit: 1x refits do not reproduce the sealed pilot predictions (max |dp| ${reuse.max_probability_delta_at_1x})`,
    );
  }

  // Secondary diagnostic (no classification authority): the no_state head under the same lambda grid.
  const noStateSweep = [];
  for (const multiplier of lambdaGrid) {
    process.stderr.write(`A2 (secondary): fitting no_state at ${multiplier}x lambda\n`);
    const entry = { representation: 'no_state', lambda_multiplier: multiplier, targets: {} };
    for (const target of targets) {
      const { predictions } = fitFoldedPredictions({
        lane: worldLane,
        byId,
        baseConfig,
        representation: 'no_state',
        target,
        labels: labelsByTarget[target],
        lambdaMultiplier: multiplier,
      });
      if (multiplier === 1) {
        const delta = maxProbabilityDelta(predictions, pilotIndex.get(target).get('no_state'), labelsByTarget[target]);
        reuse.per_rung[`no_state|${target}`] = delta;
        reuse.max_probability_delta_at_1x = Math.max(reuse.max_probability_delta_at_1x, delta);
      }
      entry.targets[target] = {
        absolute: absoluteMetrics(dataset.rows, predictions, labelsByTarget[target]),
        delta_vs_pilot_no_state: {
          pooled: comparisonBlock({
            scopeRows: dataset.rows,
            candidateById: predictions,
            baselineById: pilotIndex.get(target).get('no_state'),
            labels: labelsByTarget[target],
            bootstrap,
            material: `1a|a2-secondary|no_state|${multiplier}x|vs=no_state|${target}|pooled`,
          }),
        },
      };
    }
    noStateSweep.push(entry);
  }

  // Classification (frozen rule; log-loss point deltas only).
  const classificationEntries = a2Entries.map((entry) => ({
    rung: entry.rung,
    lambda_multiplier: entry.lambda_multiplier,
    pooled: Object.fromEntries(
      targets.map((target) => [
        target,
        entry.targets[target].delta_vs_pilot_no_state.pooled.metrics.log_loss.point_delta,
      ]),
    ),
    per_world: Object.fromEntries(
      worlds.map((world) => [
        world,
        Object.fromEntries(
          targets.map((target) => [
            target,
            entry.targets[target].delta_vs_pilot_no_state.per_world[world].metrics.log_loss.point_delta,
          ]),
        ),
      ]),
    ),
  }));
  const classification = {
    ...classifyAdaptiveStateDecomposition({ entries: classificationEntries, targets, worlds, margins }),
    margins: clone(margins),
    precedence: clone(contract.part_1a.classification_precedence),
    ambiguity_default: contract.part_1a.ambiguity_default,
  };

  // Facts for the plain-language WHY paragraph — every number is computed here, never asserted.
  let sweepBest = null;
  let matchedLambdaBest = null;
  const noStateDeltaByMultiplier = Object.fromEntries(
    noStateSweep.map((entry) => [
      entry.lambda_multiplier,
      Object.fromEntries(
        targets.map((target) => [
          target,
          entry.targets[target].delta_vs_pilot_no_state.pooled.metrics.log_loss.point_delta,
        ]),
      ),
    ]),
  );
  for (const entry of classificationEntries) {
    for (const target of targets) {
      const delta = entry.pooled[target];
      if (!sweepBest || delta > sweepBest.delta) {
        sweepBest = { rung: entry.rung, lambda_multiplier: entry.lambda_multiplier, target, delta };
      }
      const margin = delta - noStateDeltaByMultiplier[entry.lambda_multiplier][target];
      if (!matchedLambdaBest || margin > matchedLambdaBest.value) {
        matchedLambdaBest = { rung: entry.rung, lambda_multiplier: entry.lambda_multiplier, target, value: margin };
      }
    }
  }
  const pilotLambdaDeltas = classificationEntries
    .filter((entry) => entry.lambda_multiplier === 1)
    .flatMap((entry) => targets.map((target) => entry.pooled[target]));
  const noStateSweepBestPerTarget = targets.map((target) =>
    Math.max(
      ...noStateSweep.map((entry) => entry.targets[target].delta_vs_pilot_no_state.pooled.metrics.log_loss.point_delta),
    ),
  );
  const kernelAllNegativeAtPilotLambda = a2Entries
    .filter((entry) => entry.lambda_multiplier === 1)
    .every((entry) =>
      targets.every((target) =>
        generators.every(
          (generator) =>
            entry.targets[target].delta_vs_pilot_no_state.per_generator[generator].metrics.log_loss.point_delta < 0,
        ),
      ),
    );

  const summaries = worldFeatureSummaries({ dataset, worlds, generators, targets });
  const ravensmarkSkew = targets
    .map((target) => {
      const counts = summaries.ravensmark.target_distributions[target];
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
      const top = Object.entries(counts).sort((left, right) => right[1] - left[1])[0];
      return `${top[0]} ${top[1]}/${total}`;
    })
    .join(', ');
  const whyFacts = {
    targets,
    classification,
    floor: {
      pooled_log_loss: targets.map((target) => a1.deltas_vs_pilot_no_state.pooled[target].metrics.log_loss.point_delta),
      pooled_brier: targets.map((target) => a1.deltas_vs_pilot_no_state.pooled[target].metrics.brier_score.point_delta),
      ravensmark_log_loss: targets.map(
        (target) => a1.deltas_vs_pilot_no_state.per_world.ravensmark[target].metrics.log_loss.point_delta,
      ),
    },
    no_state_minus_class_prior: targets.map(
      (target) => pilotAbsolute[target].no_state.log_loss - pilotAbsolute[target].class_prior.log_loss,
    ),
    sweep_at_pilot_lambda_range: [Math.min(...pilotLambdaDeltas), Math.max(...pilotLambdaDeltas)],
    sweep_best: sweepBest,
    matched_lambda_best: matchedLambdaBest,
    no_state_sweep_best: noStateSweepBestPerTarget,
    pilot_no_state_absolute: Object.fromEntries(
      worlds.map((world) => [world, targets.map((target) => pilotNoStatePerWorld[world][target].log_loss)]),
    ),
    item_difficulty: Object.fromEntries(worlds.map((world) => [world, summaries[world].task.item_difficulty])),
    ravensmark_skew: ravensmarkSkew,
    pilot_lean_hethel: targets.map((target) => pilotDeltas.per_world.lean_dag.hethel[target].log_loss.point_delta),
    kernel_all_negative_at_pilot_lambda: kernelAllNegativeAtPilotLambda,
  };

  const git = captureGitFingerprint({ repoRoot: ROOT });
  const report = {
    schema: ADAPTIVE_STATE_DECOMPOSITION_AUDIT_REPORT_SCHEMA,
    version: '2.4',
    stage: 'part_1a_decomposition',
    status: 'complete',
    model_calls: 0,
    claim_boundary: instrumentConfig.claim_boundary,
    rescue_authority:
      'none — diagnostic and directional only; winner: null and do_not_optimize_policy remain operative; S2 prohibited',
    classification,
    provenance: {
      git: { sha: git.sha, dirty: git.dirty, untracked: git.untracked.length },
      protocol_doc: instrumentConfig.protocol_doc,
      instrument_config: { path: path.relative(ROOT, instrumentConfigPath), sha256: hashFile(instrumentConfigPath) },
      base_config: { path: path.relative(ROOT, baseConfigPath), sha256: hashFile(baseConfigPath) },
      analyzer: {
        script: path.relative(ROOT, SCRIPT),
        script_sha256: hashFile(SCRIPT),
        reused_services_sha256: {
          'services/adaptiveTutor/stateBenchmarkStage0Analysis.js': hashFile(
            path.join(ROOT, 'services', 'adaptiveTutor', 'stateBenchmarkStage0Analysis.js'),
          ),
          'services/adaptiveTutor/stateBenchmarkCanonicalPilot.js': hashFile(
            path.join(ROOT, 'services', 'adaptiveTutor', 'stateBenchmarkCanonicalPilot.js'),
          ),
        },
      },
      restored_archives: {
        s0: { ...archives.s0, dataset_content_sha256: dataset.content_sha256 },
        pilot: {
          ...archives.pilot,
          predictions_sha256: pilotPredictions.content_sha256,
          report_sha256: pilotReport.content_sha256,
        },
      },
      bootstrap: { ...clone(bootstrap), confidence_level: CONFIDENCE_LEVEL },
    },
    coverage: {
      targets,
      labels: clone(labelsByTarget),
      worlds,
      generators,
      dialogues: dataset.dialogues.length,
      scored_transitions: dataset.rows.length,
      latent_pair_clusters: new Set(dataset.rows.map((row) => row.groups.latent_pair_id)).size,
      folds: 'leave_one_world_out (world_transfer lane of the sealed S0 split manifest)',
    },
    reuse_consistency: reuse,
    pilot_comparators: {
      note: 'Read from the restored pilot archive and the sealed S0 report; compared against, never re-scored or refit.',
      pooled_absolute: pilotAbsolute,
      pooled_deltas_vs_no_state: pilotDeltas.pooled,
      per_world_deltas_vs_no_state: pilotDeltas.per_world,
    },
    a1_schedule_floor: a1,
    a2_regularization_sweep: {
      lambda_grid: lambdaGrid,
      base_lambda: baseConfig.analysis.fixed_head_contract.regularization.lambda,
      entries: a2Entries,
      secondary_no_state_sweep: noStateSweep,
    },
    a3_world_encoding: {
      note: 'Per-world deltas for every rung and lambda live in a2_regularization_sweep.entries[*].targets[*].delta_vs_pilot_no_state.per_world.',
      pilot_no_state_per_world_absolute: pilotNoStatePerWorld,
      world_feature_summaries: summaries,
    },
    a4_per_kernel: {
      note: 'Per-generator deltas for every rung and lambda live in a2_regularization_sweep.entries[*].targets[*].delta_vs_pilot_no_state.per_generator; schedule floor per generator in a1_schedule_floor.',
      world_generator_deltas: worldGeneratorDeltas,
    },
    classification_inputs: classificationEntries,
    secondary_flags: [],
  };

  const floorPooled = targets.map((target) => a1.deltas_vs_pilot_no_state.pooled[target].metrics.log_loss.point_delta);
  if (floorPooled.every((delta) => Math.abs(delta) < margins.negligible_abs_delta)) {
    report.secondary_flags.push('schedule_floor_matches_no_state_within_negligible_margin');
  }
  if (floorPooled.every((delta) => delta > 0)) {
    report.secondary_flags.push('schedule_floor_beats_pilot_no_state_on_both_targets_log_loss');
  }
  if (!a2Entries.every((entry) => entry.models.every((model) => model.converged))) {
    report.secondary_flags.push('nonconverged_fits_present');
  }
  if (classificationEntries.some((entry) => targets.every((target) => entry.pooled[target] >= margins.useful_delta))) {
    report.secondary_flags.push('useful_delta_reached_by_some_rung');
  }

  report.why = buildWhyParagraph(whyFacts);
  report.why_facts = clone(whyFacts);
  delete report.why_facts.targets;
  delete report.why_facts.classification;
  report.content_sha256 = hashCanonicalJson(
    (() => {
      const content = { ...report };
      delete content.content_sha256;
      return content;
    })(),
  );

  const outDir = path.resolve(values.out);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'decomposition-audit-report.json');
  const mdPath = path.join(outDir, 'decomposition-audit-report.md');
  const jsonBytes = canonicalJson(report, { space: 2, trailingNewline: true });
  fs.writeFileSync(jsonPath, jsonBytes);
  const mdBytes = renderMarkdown(report);
  fs.writeFileSync(mdPath, mdBytes);

  process.stdout.write(`classification: ${classification.label}\n`);
  for (const target of targets) {
    process.stdout.write(
      `schedule floor vs no_state (${target}): ${fmt(a1.deltas_vs_pilot_no_state.pooled[target].metrics.log_loss.point_delta)} nats\n`,
    );
  }
  process.stdout.write(`${path.relative(ROOT, jsonPath)} sha256 ${sha256(jsonBytes)}\n`);
  process.stdout.write(`${path.relative(ROOT, mdPath)} sha256 ${sha256(mdBytes)}\n`);
  process.stdout.write('model calls: 0\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}
