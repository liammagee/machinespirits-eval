import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  STATE_MOVE_SPEC_SCHEMA,
  assertPublicArtifactsBlind,
  buildStateMoveReviewArtifacts,
  compareStateMoveSubmissions,
  sha256,
  validateStateMoveSubmission,
} from '../services/adaptiveCausalityStateMoveReview.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.spec.json');
const PACKET_PATH = path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.packet.json');
const CODEBOOK_PATH = path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.codebook.md');
const CODER_A_PATH = path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.coder-a.json');
const CODER_B_PATH = path.join(ROOT, 'config/adaptive-causality-validation/state-move-v1.coder-b.json');
const KEY_PATH = path.join(ROOT, 'tests/fixtures/adaptive-state-move-v1.machine-key.json');

function loadFrozen() {
  const packetBytes = fs.readFileSync(PACKET_PATH);
  return {
    spec: JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8')),
    packet: JSON.parse(packetBytes.toString('utf8')),
    packetSha256: sha256(packetBytes),
    codebook: fs.readFileSync(CODEBOOK_PATH, 'utf8'),
    coderA: JSON.parse(fs.readFileSync(CODER_A_PATH, 'utf8')),
    coderB: JSON.parse(fs.readFileSync(CODER_B_PATH, 'utf8')),
    machineKey: JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')),
  };
}

function completedSubmission(template, machineKey, coderId = template.coder_id) {
  const submission = structuredClone(template);
  submission.coder_id = coderId;
  submission.independence_attestation = {
    worked_without_other_coder: true,
    did_not_access_machine_key: true,
  };
  const machineByCase = new Map(machineKey.cases.map((entry) => [entry.case_id, entry]));
  for (const row of submission.cases) {
    const machine = machineByCase.get(row.case_id);
    row.state.label = machine.expected_state;
    row.state.evidence = 'short learner evidence';
    row.move.labels = machine.automated.ruled_gold_realization
      ? [machine.gold_move]
      : machine.assigned_move === machine.gold_move
        ? ['none_observable']
        : [machine.assigned_move];
    row.move.evidence = 'short tutor evidence';
  }
  return submission;
}

function syntheticFixture() {
  const rows = [
    ...['world_one', 'world_two'].flatMap((world, worldIndex) => [
      {
        world,
        arm: 'right',
        k: worldIndex,
        turn: 1,
        state: 'source_state',
        forced: 'source_gold',
        learner: `learner ${world} matched`,
        reply: `reply ${world} matched`,
        ruled: true,
      },
      {
        world,
        arm: 'wrong',
        k: worldIndex,
        turn: 1,
        state: 'source_state',
        forced: 'source_wrong',
        learner: `learner ${world} mismatched`,
        reply: `reply ${world} mismatched`,
        ruled: false,
      },
    ]),
    {
      world: 'world_one',
      arm: 'router',
      k: 9,
      turn: 1,
      state: 'source_state',
      forced: null,
      learner: 'natural router learner',
      reply: 'natural router reply',
      ruled: true,
    },
  ];
  const bytes = Buffer.from(`${JSON.stringify(rows, null, 2)}\n`);
  const spec = {
    schema: STATE_MOVE_SPEC_SCHEMA,
    packet_id: 'synthetic-packet',
    codebook_id: 'synthetic-codebook',
    seed: 'synthetic-seed',
    worlds: ['world_one', 'world_two'],
    per_stratum: 1,
    sources: [
      {
        source_id: 'synthetic',
        file: 'synthetic.json',
        sha256: sha256(bytes),
        arm_field: 'arm',
        forced_move_field: 'forced',
        state_field: 'state',
        provenance: { workplan_item: 'synthetic' },
      },
    ],
    states: [
      {
        code: 'visible_state',
        label: 'Visible state',
        source_id: 'synthetic',
        source_value: 'source_state',
        gold_move: 'gold_move',
        definition: 'A visible state.',
        include: ['Include it.'],
        exclude: ['Exclude something else.'],
      },
    ],
    moves: [
      {
        code: 'gold_move',
        label: 'Gold move',
        source_values: ['source_gold'],
        definition: 'The gold move.',
        include: ['Include it.'],
        exclude: ['Exclude something else.'],
      },
      {
        code: 'wrong_move',
        label: 'Wrong move',
        source_values: ['source_wrong'],
        definition: 'The comparison move.',
        include: ['Include it.'],
        exclude: ['Exclude something else.'],
      },
    ],
  };
  return {
    spec,
    sourceDocuments: [{ source_id: 'synthetic', bytes, rows }],
  };
}

test('builder verifies sealed bytes and draws one frozen case per state/world/assignment stratum', () => {
  const fixture = syntheticFixture();
  const { packet, machineKey } = buildStateMoveReviewArtifacts(fixture);
  assert.equal(packet.cases.length, 4);
  assert.equal(machineKey.cases.length, 4);
  assert.deepEqual(machineKey.cases.map((entry) => entry.assignment_relation).sort(), [
    'matched',
    'matched',
    'mismatched',
    'mismatched',
  ]);
  assert.ok(machineKey.cases.every((entry) => entry.source_locator.arm !== 'router'));

  const tampered = structuredClone(fixture.sourceDocuments[0].rows);
  tampered[0].reply = 'changed after sealing';
  const tamperedBytes = Buffer.from(`${JSON.stringify(tampered, null, 2)}\n`);
  assert.throws(
    () =>
      buildStateMoveReviewArtifacts({
        spec: fixture.spec,
        sourceDocuments: [{ source_id: 'synthetic', bytes: tamperedBytes, rows: tampered }],
      }),
    /sealed source hash mismatch/u,
  );
});

test('frozen packet is 24-case, crossed, public-only material with a separate private key', () => {
  const { packet, codebook, coderA, coderB, machineKey } = loadFrozen();
  assert.equal(packet.cases.length, 24);
  assert.ok(
    packet.cases.every(
      (entry) => assert.deepEqual(Object.keys(entry), ['case_id', 'learner_turn', 'tutor_reply']) === undefined,
    ),
  );
  assertPublicArtifactsBlind({ packet, codebook, submissions: [coderA, coderB] });

  const strata = new Set(
    machineKey.cases.map((entry) =>
      [entry.expected_state, entry.source_locator.world, entry.assignment_relation].join('/'),
    ),
  );
  assert.equal(strata.size, 24);
  assert.equal(new Set(machineKey.cases.map((entry) => entry.expected_state)).size, 6);
  assert.equal(new Set(machineKey.cases.map((entry) => entry.source_locator.world)).size, 2);
  assert.equal(machineKey.cases.filter((entry) => entry.automated.ruled_gold_realization).length, 15);
  assert.equal(machineKey.cases.filter((entry) => !entry.automated.ruled_gold_realization).length, 9);
});

test('two coder templates bind the same packet but use independent deterministic case orders', () => {
  const { packet, packetSha256, coderA, coderB } = loadFrozen();
  assert.equal(coderA.packet_sha256, packetSha256);
  assert.equal(coderB.packet_sha256, packetSha256);
  assert.equal(coderA.coder_id, 'coder_a');
  assert.equal(coderB.coder_id, 'coder_b');
  assert.notDeepEqual(
    coderA.cases.map((entry) => entry.case_id),
    coderB.cases.map((entry) => entry.case_id),
  );
  assert.deepEqual(
    coderA.cases.map((entry) => entry.case_id).sort(),
    packet.cases.map((entry) => entry.case_id).sort(),
  );
  assert.deepEqual(
    coderB.cases.map((entry) => entry.case_id).sort(),
    packet.cases.map((entry) => entry.case_id).sort(),
  );
});

test('complete independent rulings report construct agreement and move fidelity overall and by arm', () => {
  const frozen = loadFrozen();
  const reviewerA = completedSubmission(frozen.coderA, frozen.machineKey);
  const reviewerB = completedSubmission(frozen.coderB, frozen.machineKey);
  assert.equal(
    validateStateMoveSubmission({
      packet: frozen.packet,
      packetSha256: frozen.packetSha256,
      spec: frozen.spec,
      submission: reviewerA,
    }),
    reviewerA,
  );

  const report = compareStateMoveSubmissions({
    packet: frozen.packet,
    packetSha256: frozen.packetSha256,
    spec: frozen.spec,
    machineKey: frozen.machineKey,
    submissions: [reviewerA, reviewerB],
  });
  assert.equal(report.summary.total_cases, 24);
  assert.equal(report.summary.fully_determinate_cases, 24);
  assert.equal(report.summary.state.matches, 24);
  assert.equal(report.summary.move_realization.automated_ruling_agreements, 24);
  assert.deepEqual(Object.keys(report.by_assignment_relation), ['matched', 'mismatched']);
  assert.ok(Object.keys(report.by_arm).length >= 4);
  assert.ok(report.construct_confusion.state_expected_vs_human.length > 0);
});

test('coder disagreement and explicit uncertainty remain indeterminate, never negative machine mismatches', () => {
  const frozen = loadFrozen();
  const reviewerA = completedSubmission(frozen.coderA, frozen.machineKey);
  const reviewerB = completedSubmission(frozen.coderB, frozen.machineKey);
  const firstCase = frozen.packet.cases[0].case_id;
  const secondCase = frozen.packet.cases[1].case_id;
  const firstB = reviewerB.cases.find((entry) => entry.case_id === firstCase);
  firstB.state.label = firstB.state.label === 'deadline_demand' ? 'lost_thread' : 'deadline_demand';
  const secondB = reviewerB.cases.find((entry) => entry.case_id === secondCase);
  secondB.move.disposition = 'indeterminate';
  secondB.move.labels = [];
  secondB.move.evidence = '';
  secondB.move.notes = 'The reply visibly combines two moves and I cannot separate them confidently.';

  const report = compareStateMoveSubmissions({
    packet: frozen.packet,
    packetSha256: frozen.packetSha256,
    spec: frozen.spec,
    machineKey: frozen.machineKey,
    submissions: [reviewerA, reviewerB],
  });
  const disputedState = report.cases.find((entry) => entry.case_id === firstCase).state;
  const uncertainMove = report.cases.find((entry) => entry.case_id === secondCase).move;
  assert.equal(disputedState.status, 'indeterminate');
  assert.deepEqual(disputedState.reasons, ['coder_disagreement']);
  assert.equal('matches_machine_state' in disputedState, false);
  assert.equal(uncertainMove.status, 'indeterminate');
  assert.ok(uncertainMove.reasons.includes('coder_uncertainty'));
  assert.equal('agrees_with_automated_gold_ruling' in uncertainMove, false);
  assert.equal(report.summary.cases_with_any_indeterminate_dimension, 2);
});

test('comparison fails closed on incomplete independence and packet drift', () => {
  const frozen = loadFrozen();
  const reviewerA = completedSubmission(frozen.coderA, frozen.machineKey);
  reviewerA.independence_attestation.did_not_access_machine_key = false;
  assert.throws(
    () =>
      validateStateMoveSubmission({
        packet: frozen.packet,
        packetSha256: frozen.packetSha256,
        spec: frozen.spec,
        submission: reviewerA,
      }),
    /must attest independent work/u,
  );

  const reviewerB = completedSubmission(frozen.coderB, frozen.machineKey);
  reviewerB.packet_sha256 = '0'.repeat(64);
  assert.throws(
    () =>
      validateStateMoveSubmission({
        packet: frozen.packet,
        packetSha256: frozen.packetSha256,
        spec: frozen.spec,
        submission: reviewerB,
      }),
    /packet_sha256 does not match/u,
  );
});

test('public-artifact guard rejects structural and value-level private leakage', () => {
  const { packet, codebook, coderA, coderB } = loadFrozen();
  const structuralLeak = structuredClone(packet);
  structuralLeak.cases[0].arm = 'hidden';
  assert.throws(
    () => assertPublicArtifactsBlind({ packet: structuralLeak, codebook, submissions: [coderA, coderB] }),
    /leaked private key arm/u,
  );
  const valueLeak = structuredClone(packet);
  valueLeak.cases[0].learner_turn += ' world_030_rowan_flat';
  assert.throws(
    () => assertPublicArtifactsBlind({ packet: valueLeak, codebook, submissions: [coderA, coderB] }),
    /leaked private source token/u,
  );
});
