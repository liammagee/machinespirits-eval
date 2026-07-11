import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  ADAPTIVE_STATE_KERNEL_FORECAST_SCHEMA,
  ADAPTIVE_STATE_KERNEL_TRANSITION_SCHEMA,
  DROPOUT_READOPTION_STATE_SCHEMA,
  DURABLE_OWNERSHIP_STATE_SCHEMA,
  adaptiveStateLearnerKernel,
  createAdaptiveStateKernelSession,
  deterministicAdaptiveStateRealizer,
  dropoutReadoptionKernel,
  durableOwnershipKernel,
  hashKernelSourceFiles,
  loadAdaptiveStateWorldAdapters,
  runAdaptiveStateKernelDialogue,
} from '../services/adaptiveTutor/learnerKernels/index.js';
import { adaptiveStateValidityV2Contract } from '../services/adaptiveTutor/stateValidityMetricsV2.js';

const ROOT = path.resolve('.');
const CONFIG_PATH = path.join(ROOT, 'config/adaptive-state-benchmark-v2.yaml');

function config() {
  return yaml.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function probabilityTotal(distribution) {
  return Object.values(distribution).reduce((sum, value) => sum + Number(value), 0);
}

test('v2 contract uses one canonical action_type namespace and an explicit t0 bootstrap', () => {
  const value = config();
  const contract = adaptiveStateValidityV2Contract(value);
  assert.deepEqual(contract.actionSchedule, [
    'diagnose_with_discriminating_question',
    'minimal_hint',
    'request_evidence',
    'request_evidence',
    'minimal_hint',
    'diagnose_with_discriminating_question',
  ]);
  assert.deepEqual(contract.dialogue, {
    bootstrap_public_observations: 1,
    learner_turns: 7,
    scored_transitions: 6,
    one_realizer_call_per_turn: true,
    future_state_hidden_from_realizer: true,
  });
  assert.deepEqual(
    value.critical_path.latent_generators.map((row) => row.source),
    [
      'services/adaptiveTutor/learnerKernels/durableStateKernel.js',
      'services/adaptiveTutor/learnerKernels/dropoutReadoptionKernel.js',
    ],
  );
});

test('canonical loader compiles Marrick, Hethel, and Ravensmark into normalized two-step proof slices', () => {
  const value = config();
  const adapters = loadAdaptiveStateWorldAdapters(value.critical_path.worlds);
  assert.deepEqual(
    adapters.map((adapter) => adapter.id),
    ['marrick', 'hethel', 'ravensmark'],
  );
  assert.deepEqual(
    adapters.map((adapter) => adapter.geometry),
    ['and_join', 'linear_with_distractor', 'unary_dead_predicate_probe'],
  );
  assert.deepEqual(
    adapters.map((adapter) => adapter.normalization_denominator),
    [2, 2, 2],
  );
  assert.deepEqual(
    adapters.map((adapter) => adapter.challenge_premise_count),
    [2, 2, 2],
  );
  assert.ok(adapters.every((adapter) => /^[0-9a-f]{64}$/u.test(adapter.world_sha256)));

  for (const [index, adapter] of adapters.entries()) {
    const source = path.resolve(ROOT, value.critical_path.worlds[index].source);
    const world = loadWorld(source);
    const session = createAdaptiveStateKernelSession({ adapter, kernel: 'durable_state', seed: 11 });
    const serialized = JSON.stringify(session.initial_public_envelope);
    for (const premise of world.premises) {
      assert.equal(serialized.includes(premise.id), false, `${adapter.id} leaked local id ${premise.id}`);
    }
    assert.equal(serialized.includes(world.secret.surface), false, `${adapter.id} leaked its secret surface`);
  }
});

test('kernel implementation hashes bind every declared dependency source', () => {
  for (const kernel of [durableOwnershipKernel, dropoutReadoptionKernel]) {
    assert.equal(
      hashKernelSourceFiles(kernel.metadata.source_files, { repoRoot: ROOT }),
      kernel.metadata.transition_kernel_sha256,
    );
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-kernel-hash-'));
  try {
    fs.mkdirSync(path.join(root, 'sources'), { recursive: true });
    fs.writeFileSync(path.join(root, 'sources', 'kernel.js'), 'export const kernel = 1;\n');
    fs.writeFileSync(path.join(root, 'sources', 'shared.js'), 'export const shared = 1;\n');
    const files = ['sources/kernel.js', 'sources/shared.js'];
    const before = hashKernelSourceFiles(files, { repoRoot: root });
    fs.writeFileSync(path.join(root, 'sources', 'shared.js'), 'export const shared = 2;\n');
    const after = hashKernelSourceFiles(files, { repoRoot: root });
    assert.notEqual(after, before, 'shared-helper drift must change the transition-kernel hash');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('durable ownership and dropout/readoption are separate action-conditioned transition kernels', () => {
  const adapter = loadAdaptiveStateWorldAdapters(config().critical_path.worlds)[0];
  const durable = durableOwnershipKernel.initialize({ adapter, seed: 17 });
  const dropout = dropoutReadoptionKernel.initialize({ adapter, seed: 17 });
  assert.equal(durable.schema, DURABLE_OWNERSHIP_STATE_SCHEMA);
  assert.equal(dropout.schema, DROPOUT_READOPTION_STATE_SCHEMA);
  assert.notEqual(durableOwnershipKernel.metadata.source, dropoutReadoptionKernel.metadata.source);
  assert.notEqual(
    durableOwnershipKernel.metadata.transition_kernel_sha256,
    dropoutReadoptionKernel.metadata.transition_kernel_sha256,
  );
  assert.equal(adaptiveStateLearnerKernel('durable_state'), durableOwnershipKernel);
  assert.equal(adaptiveStateLearnerKernel('dag_dropout'), dropoutReadoptionKernel);

  for (const [kernel, state] of [
    [durableOwnershipKernel, durable],
    [dropoutReadoptionKernel, dropout],
  ]) {
    const diagnose = kernel.oracleBeforeSample({
      adapter,
      state,
      action: 'diagnose_with_discriminating_question',
      turn: 1,
      seed: 1701,
    });
    const hint = kernel.oracleBeforeSample({
      adapter,
      state,
      action: 'minimal_hint',
      turn: 1,
      seed: 1701,
    });
    assert.equal(diagnose.schema, ADAPTIVE_STATE_KERNEL_FORECAST_SCHEMA);
    assert.equal(probabilityTotal(diagnose.oracle.distributions.next_dag_event_family), 1);
    assert.equal(probabilityTotal(diagnose.oracle.distributions.next_proof_trajectory), 1);
    assert.notDeepEqual(
      hint.oracle.distributions,
      diagnose.oracle.distributions,
      `${kernel.id} must condition on the common action`,
    );
  }
});

test('oracle is captured before a deterministic sample and harness labels cannot be supplied by a realizer', async () => {
  const adapter = loadAdaptiveStateWorldAdapters(config().critical_path.worlds)[1];
  const state = durableOwnershipKernel.initialize({ adapter, seed: 23 });
  const args = {
    adapter,
    state,
    action: 'minimal_hint',
    turn: 1,
    seed: 2301,
  };
  const forecast = durableOwnershipKernel.oracleBeforeSample(args);
  const first = durableOwnershipKernel.transition({ ...args, forecast });
  const second = durableOwnershipKernel.transition({ ...args, forecast });
  assert.equal(first.schema, ADAPTIVE_STATE_KERNEL_TRANSITION_SCHEMA);
  assert.equal(first.selected_branch_id, second.selected_branch_id);
  assert.deepEqual(first.next_state, second.next_state);
  assert.deepEqual(first.oracle_before_sample, forecast.oracle);
  assert.deepEqual(first.audit_sequence, [
    'oracle_captured_before_transition_sampling',
    'seeded_branch_sampled',
    'hidden_state_transition_applied',
    'public_envelope_projected',
    'harness_targets_derived',
  ]);
  assert.ok(['adopt', 'derive', 'retract', 'none'].includes(first.targets.next_dag_event_family));
  assert.ok(['advance', 'regress', 'stall'].includes(first.targets.next_proof_trajectory));
  assert.equal(first.proof_transition.current.turn, 1);
  assert.equal(first.proof_transition.next.turn, 2);

  await assert.rejects(
    () =>
      runAdaptiveStateKernelDialogue({
        adapter,
        kernel: durableOwnershipKernel,
        seed: 23,
        actionSchedule: config().critical_path.action_schedule,
        realize: async () => ({
          learner_text: 'I claim a different event.',
          realized_public_event_ids: ['invented:event'],
        }),
      }),
    /realizer changed the harness-owned public event ids/u,
  );
});

test('both kernels run t0 plus t1..t7 across all worlds without LLM-derived labels or local-id leakage', async () => {
  const value = config();
  const adapters = loadAdaptiveStateWorldAdapters(value.critical_path.worlds);
  const kernels = [durableOwnershipKernel, dropoutReadoptionKernel];
  for (const adapter of adapters) {
    const world = loadWorld(path.resolve(ROOT, value.critical_path.worlds.find((row) => row.id === adapter.id).source));
    for (const kernel of kernels) {
      const first = await runAdaptiveStateKernelDialogue({
        adapter,
        kernel,
        seed: 17,
        actionSchedule: value.critical_path.action_schedule,
        realize: deterministicAdaptiveStateRealizer,
      });
      const replay = await runAdaptiveStateKernelDialogue({
        adapter,
        kernel,
        seed: 17,
        actionSchedule: value.critical_path.action_schedule,
        realize: deterministicAdaptiveStateRealizer,
      });
      assert.deepEqual(first, replay);
      assert.deepEqual(
        first.all_turn_records.map((row) => row.turn),
        [0, 1, 2, 3, 4, 5, 6, 7],
      );
      assert.equal(first.turns.length, 7);
      assert.equal(first.transitions.length, 6);
      assert.equal(first.kernel_provenance.source, kernel.metadata.source);
      assert.equal(first.kernel_provenance.transition_kernel_sha256, kernel.metadata.transition_kernel_sha256);
      const eventLabels = new Set(first.transitions.map((row) => row.targets.next_dag_event_family));
      const proofLabels = new Set(first.transitions.map((row) => row.targets.next_proof_trajectory));
      assert.ok(eventLabels.size >= 2, `${adapter.id}/${kernel.id} event target degenerated`);
      assert.ok(proofLabels.size >= 2, `${adapter.id}/${kernel.id} proof target degenerated`);
      for (const transition of first.transitions) {
        const serialized = JSON.stringify(transition.public_envelope);
        for (const premise of world.premises) {
          assert.equal(serialized.includes(premise.id), false, `${adapter.id}/${kernel.id} leaked ${premise.id}`);
        }
        assert.deepEqual(
          transition.public_envelope.required_realizer_output.realized_public_event_ids,
          transition.public_envelope.current_public_act_envelope.event_ids,
        );
      }
    }
  }
});
