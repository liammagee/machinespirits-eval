import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  evaluateAdaptiveStateCanonicalPilotScreen,
  validateAdaptiveStateCanonicalPilotContract,
} from '../services/adaptiveTutor/stateBenchmarkCanonicalPilot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = yaml.parse(fs.readFileSync(path.join(ROOT, 'config', 'adaptive-state-instrument-v2.3.yaml'), 'utf8'));
const TARGETS = ['next_dag_event_family', 'next_proof_trajectory'];
const CANDIDATES = ['lean_dag', 'dag_trajectory', 'field_trajectory'];
const BASELINES = ['no_state', 'class_prior', 'uniform'];
const LEVELS = {
  world_transfer: ['world_a', 'world_b', 'world_c'],
  generator_transfer: ['generator_a', 'generator_b'],
  realizer_transfer: ['realizer_a', 'realizer_b'],
};

function metrics(point = 0.1, probability = 0.95) {
  return {
    log_loss: {
      point_delta: point,
      confidence_interval: { lower: point / 2, upper: point * 1.5 },
      probability_of_improvement: probability,
    },
    brier_score: {
      point_delta: point,
      confidence_interval: { lower: point / 2, upper: point * 1.5 },
      probability_of_improvement: probability,
    },
  };
}

function comparison(lane, level, target, candidate, baseline, point = 0.1) {
  return { lane, level, target, candidate, baseline, metrics: metrics(point) };
}

function passingComparisons() {
  const rows = [];
  for (const target of TARGETS) {
    for (const candidate of CANDIDATES) {
      for (const baseline of BASELINES) {
        rows.push(comparison('world_transfer', 'pooled', target, candidate, baseline, 0.2));
      }
      for (const [lane, levels] of Object.entries(LEVELS)) {
        for (const level of levels) {
          rows.push(comparison(lane, level, target, candidate, 'no_state', 0.1));
        }
      }
    }
    for (const baseline of BASELINES) {
      rows.push(comparison('world_transfer', 'pooled', target, 'oracle', baseline, 0.5));
    }
    rows.push(comparison('world_transfer', 'pooled', target, 'dag_trajectory', 'lean_dag', 0.1));
    rows.push(comparison('world_transfer', 'pooled', target, 'field_trajectory', 'dag_trajectory', 0.1));
    rows.push(comparison('world_transfer', 'pooled', target, 'dag_trajectory', 'dag_stale', 0.1));
    rows.push(comparison('world_transfer', 'pooled', target, 'field_trajectory', 'field_stale', 0.1));
  }
  return rows;
}

function calibration() {
  return TARGETS.flatMap((target) =>
    ['oracle', ...CANDIDATES].map((representation) => ({
      target,
      representation,
      ece: representation === 'oracle' ? 0.01 : 0.1,
    })),
  );
}

test('v2.3 canonical pilot contract is prospectively exact and fail-closed on drift', () => {
  const contract = validateAdaptiveStateCanonicalPilotContract(CONFIG);
  assert.equal(contract.decision_scope, 'directional_screen_only');
  assert.equal(contract.may_name_validated_winner, false);
  assert.equal(contract.may_open_policy_optimization, false);
  assert.equal(contract.may_automatically_launch_confirmation, false);
  const drifted = structuredClone(CONFIG);
  drifted.stage_contract.s1_canonical_sensor_pilot.decision_contract.paired_cluster_bootstrap.iterations = 4999;
  assert.throws(() => validateAdaptiveStateCanonicalPilotContract(drifted), /decision contract drifted/u);
});

test('passing directional screen can nominate only an S2 candidate', () => {
  const screen = evaluateAdaptiveStateCanonicalPilotScreen({
    auditPassed: true,
    modelsConverged: true,
    comparisons: passingComparisons(),
    calibration: calibration(),
    pilotConfig: CONFIG,
  });
  assert.equal(screen.status, 'pass');
  assert.equal(screen.decision, 'authorize_v2_3_canonical_s2_implementation');
  assert.equal(screen.confirmation_candidate, 'field_trajectory');
  assert.equal(screen.validated_winner, null);
  assert.equal(screen.policy_optimization_authorized, false);
});

test('instrument failure stops the pilot without a candidate', () => {
  const comparisons = passingComparisons();
  comparisons.find(
    (row) => row.candidate === 'oracle' && row.baseline === 'no_state' && row.target === 'next_dag_event_family',
  ).metrics.log_loss.point_delta = -0.01;
  const screen = evaluateAdaptiveStateCanonicalPilotScreen({
    auditPassed: true,
    modelsConverged: true,
    comparisons,
    calibration: calibration(),
    pilotConfig: CONFIG,
  });
  assert.equal(screen.status, 'stop');
  assert.equal(screen.decision, 'do_not_run_canonical_s2');
  assert.equal(screen.confirmation_candidate, null);
  assert.equal(screen.policy_optimization_authorized, false);
});
