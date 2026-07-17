import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  assertAdaptiveStateV24VoiContract,
  evaluateAdaptiveStateVoiVerdict,
} from '../scripts/run-adaptive-state-voi-v24.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARGINS = Object.freeze({
  log_loss_nats: 0.05,
  brier: 0.02,
  action_information_floor_bits: 0.1,
  action_information_world_floor: 2,
  entropy_reduction_floor_bits_at_horizon: 0.1,
});
const VERDICTS = Object.freeze([
  'graduate_active_sensing_to_paid',
  'close_sensor_program_on_substrate',
  'inconclusive_data_starved',
]);

function contrast(logDelta, brierDelta, halfWidth = 0.01) {
  return {
    log_loss: {
      point_delta: logDelta,
      confidence_interval: { lower: logDelta - halfWidth, upper: logDelta + halfWidth },
    },
    brier_score: {
      point_delta: brierDelta,
      confidence_interval: { lower: brierDelta - halfWidth, upper: brierDelta + halfWidth },
    },
  };
}

function armB3(logDelta, brierDelta, halfWidth = 0.01) {
  return {
    next_dag_event_family: contrast(logDelta, brierDelta, halfWidth),
    next_proof_trajectory: contrast(logDelta, brierDelta, halfWidth),
  };
}

const B1_FLOOR_PASS = Object.freeze({
  durable_state: {
    marrick: { minimal_hint: 0.95 },
    hethel: { minimal_hint: 0.4, request_evidence: 0.05 },
    ravensmark: { minimal_hint: 0.02 },
  },
  dag_dropout: {
    marrick: { request_evidence: 0.6 },
    hethel: { request_evidence: 0.3 },
    ravensmark: {},
  },
});

const B1_FLOOR_FAIL = Object.freeze({
  durable_state: { marrick: { minimal_hint: 0.95 }, hethel: {}, ravensmark: {} },
  dag_dropout: { marrick: { request_evidence: 0.6 }, hethel: { request_evidence: 0.3 }, ravensmark: {} },
});

function verdict(overrides = {}) {
  return evaluateAdaptiveStateVoiVerdict({
    part1aLabel: 'data_starved',
    margins: MARGINS,
    b3: { fixed: armB3(0.01, 0.001), voi: armB3(0.3, 0.1) },
    b1MaxGainBits: B1_FLOOR_PASS,
    entropyVoi: { mean_prior_bits_at_horizon: 3.2, mean_posterior_bits_at_horizon: 0, mean_reduction_bits: 3.2 },
    oraclePasses: { fixed: true, voi: true },
    ...overrides,
  });
}

test('v2.4 frozen 1b instrument contract is accepted exactly and fails closed on drift', () => {
  const config = yaml.parse(fs.readFileSync(path.join(ROOT, 'config', 'adaptive-state-instrument-v2.4.yaml'), 'utf8'));
  const contractBlock = assertAdaptiveStateV24VoiContract(config);
  assert.equal(contractBlock.part_1b.voi_arm.label, 'adaptive-state-v24-voi-schedule');
  assert.equal(contractBlock.part_1b.voi_arm.dialogues, 24);
  assert.deepEqual(contractBlock.part_1b.margins, MARGINS);
  assert.equal(contractBlock.bootstrap.seed, 20260713);
  assert.equal(contractBlock.label_prefix, 'adaptive-state-v24-');

  const driftedMargin = JSON.parse(JSON.stringify(config));
  driftedMargin.part_1b_voi.margins.log_loss_nats = 0.01;
  assert.throws(() => assertAdaptiveStateV24VoiContract(driftedMargin), /part_1b_voi drifted/u);
  const driftedBootstrap = JSON.parse(JSON.stringify(config));
  driftedBootstrap.data_provenance.bootstrap.seed = 20260712;
  assert.throws(() => assertAdaptiveStateV24VoiContract(driftedBootstrap), /bootstrap contract drifted/u);
  const driftedPrefix = JSON.parse(JSON.stringify(config));
  driftedPrefix.data_provenance.new_run_label_prefix = 'adaptive-state-v25-';
  assert.throws(() => assertAdaptiveStateV24VoiContract(driftedPrefix), /label prefix drifted/u);
});

test('verdict: graduate fires when the VOI arm passes the margins, the fixed arm does not, and the B1 floor holds', () => {
  const result = verdict();
  assert.equal(result.token, 'graduate_active_sensing_to_paid');
  assert.equal(result.matched_clause, 'graduate');
  assert.equal(result.clauses.graduate.scheduling_flips_capacity_verdict, true);
  assert.equal(result.clauses.graduate.action_information_floor.passed, true);
  assert.deepEqual(result.clauses.graduate.action_information_floor.per_kernel.durable_state.qualifying_actions, {
    minimal_hint: ['hethel', 'marrick'],
  });
});

test('verdict: graduate requires the action-information floor for EVERY kernel', () => {
  const result = verdict({ b1MaxGainBits: B1_FLOOR_FAIL });
  assert.notEqual(result.token, 'graduate_active_sensing_to_paid');
  assert.equal(result.clauses.graduate.action_information_floor.per_kernel.durable_state.passed, false);
  assert.equal(result.clauses.graduate.action_information_floor.per_kernel.dag_dropout.passed, true);
});

test('verdict: close fires on the entropy clause when the channel reduces latent entropy below the floor', () => {
  const result = verdict({
    b3: { fixed: armB3(0.2, 0.05), voi: armB3(0.2, 0.05) },
    entropyVoi: { mean_prior_bits_at_horizon: 2.4, mean_posterior_bits_at_horizon: 2.38, mean_reduction_bits: 0.02 },
  });
  assert.equal(result.token, 'close_sensor_program_on_substrate');
  assert.equal(result.matched_clause, 'close_entropy_floor');
  assert.equal(result.clauses.close.entropy.passed, true);
});

test('verdict: close fires when B3 fails the margins on both targets on both arms while the oracle passes', () => {
  const result = verdict({
    b3: { fixed: armB3(-0.2, -0.05), voi: armB3(0.01, 0.005) },
  });
  assert.equal(result.token, 'close_sensor_program_on_substrate');
  assert.equal(result.matched_clause, 'close_b3_failure_both_arms');
  assert.equal(result.clauses.close.b3_failure.passed, true);
});

test('verdict: inconclusive fires only with the 1a data_starved label AND B3 CIs spanning both cut lines', () => {
  const spanning = { fixed: armB3(0.04, 0.015, 0.05), voi: armB3(0.04, 0.015, 0.05) };
  const result = verdict({
    b3: spanning,
    oraclePasses: { fixed: false, voi: true }, // blocks the close b3 clause: oracle not passing on both arms
  });
  assert.equal(result.token, 'inconclusive_data_starved');
  assert.equal(result.matched_clause, 'inconclusive');
  assert.equal(result.clauses.inconclusive.all_b3_contrast_cis_span_cut_lines, true);

  const wrongLabel = verdict({
    b3: spanning,
    oraclePasses: { fixed: false, voi: true },
    part1aLabel: 'representation_carries_nothing',
  });
  assert.notEqual(wrongLabel.token, 'inconclusive_data_starved');
  assert.equal(wrongLabel.matched_clause, 'none_matched_conservative_default');
});

test('verdict: the unnamed both-arms-pass configuration defaults conservatively to close, never graduate', () => {
  const result = verdict({ b3: { fixed: armB3(0.8, 0.2), voi: armB3(0.6, 0.15) } });
  assert.equal(result.token, 'close_sensor_program_on_substrate');
  assert.equal(result.matched_clause, 'none_matched_conservative_default');
  assert.equal(result.clauses.graduate.passed, false);
  assert.equal(result.clauses.graduate.voi_arm_passes_margins, true);
  assert.equal(result.clauses.graduate.fixed_arm_passes_margins, true);
  assert.equal(result.clauses.close.passed, false);
  assert.equal(result.clauses.inconclusive.passed, false);
  assert.ok(result.notes.length >= 1);
});

test('verdict: emits exactly one token from the frozen list and validates its inputs', () => {
  for (const fixture of [
    verdict(),
    verdict({ b3: { fixed: armB3(0.8, 0.2), voi: armB3(0.6, 0.15) } }),
    verdict({ b3: { fixed: armB3(-0.2, -0.05), voi: armB3(0.01, 0.005) } }),
  ]) {
    assert.ok(VERDICTS.includes(fixture.token));
  }
  assert.throws(
    () => evaluateAdaptiveStateVoiVerdict({ part1aLabel: 'data_starved', margins: MARGINS }),
    /missing B3/u,
  );
  assert.throws(
    () =>
      evaluateAdaptiveStateVoiVerdict({
        part1aLabel: 'data_starved',
        margins: { log_loss_nats: 0, brier: 0 },
        b3: { fixed: armB3(0.1, 0.05), voi: armB3(0.1, 0.05) },
        b1MaxGainBits: B1_FLOOR_PASS,
        entropyVoi: { mean_prior_bits_at_horizon: 1, mean_posterior_bits_at_horizon: 0, mean_reduction_bits: 1 },
        oraclePasses: { fixed: true, voi: true },
      }),
    /frozen margins/u,
  );
  assert.throws(
    () =>
      verdict({
        entropyVoi: { mean_prior_bits_at_horizon: 1, mean_posterior_bits_at_horizon: 0, mean_reduction_bits: NaN },
      }),
    /entropy reduction/u,
  );
});
