import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  ADAPTATION_ACTIONS,
  estimateLearnerStateBelief,
  selectPedagogicalAction,
} from '../services/adaptiveTutor/actionPolicy.js';
import { buildTutorStubTypedActionDecision } from '../services/adaptiveTutor/tutorStubActionAdapter.js';
import {
  extractActionOutcomeMemoryEvidence,
  replayActionOutcomeMemoryDecisions,
} from '../services/adaptiveTutor/actionOutcomeMemoryReadiness.js';
import {
  buildActionOutcomeMemoryReadiness,
  renderActionOutcomeMemoryReadiness,
} from '../scripts/action-outcome-memory-readiness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AS_OF = '2026-08-12T00:00:00.000Z';
const CONDITIONS = [
  { id: 'high-stagnation', stagnationAtLeast: 0.8, fieldVelocityAtMost: 0.3, dagVelocityAtMost: 0.3 },
  { id: 'low-velocity', stagnationAtLeast: 0.4, fieldVelocityAtMost: 0.01, dagVelocityAtMost: 0.01 },
];

function traceFixture({
  runId = 'source-a',
  worldId = 'world-a',
  date = '2026-08-04T00:00:00.000Z',
  outcome = 'failure',
} = {}) {
  const base = Date.parse(date);
  const stamp = (seconds) => new Date(base + seconds * 1000).toISOString();
  const contractId = `${runId}-typed-action-t2`;
  const selectionInput = {
    stateBelief: estimateLearnerStateBelief({
      dialogue: [{ role: 'learner', content: "I don't get why that works." }],
      turnIndex: 2,
    }),
    interventionLedger: [
      {
        contract_id: `${runId}-previous`,
        turn_index: 1,
        closed_turn_index: 2,
        status: 'closed',
        outcome: 'inconclusive',
        action_type: 'diagnose_with_discriminating_question',
        hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
      },
    ],
    mode: 'closed_loop',
    config: { maxActionCandidates: ADAPTATION_ACTIONS.length },
  };
  const selection = selectPedagogicalAction(selectionInput);
  const decision = buildTutorStubTypedActionDecision({
    selection,
    stateBelief: selectionInput.stateBelief,
    task: { taskId: 'task-a', knowledgeComponent: 'public-evidence', prerequisitePath: [], itemDifficulty: 0.5 },
    register: 'precise',
    supportLevel: 1,
    selectionProbability: 1,
  });
  decision.contract_id = contractId;
  decision.decision_provenance = {
    timing: 'after_current_public_learner_observation_before_tutor_output',
    support_axis_source: 'explicit_typed_action_config',
    selection_input: selectionInput,
    memory_observation: { observed: true, quantities: { stagnation: 0.9, fieldVelocity: 0.1, dagVelocity: 0.1 } },
  };
  const tutorText = 'PRIVATE_TUTOR_TEXT: Start with the public date and compare the two marks.';
  const learnerText = 'PRIVATE_LEARNER_TEXT: I still need you to tell me the answer.';
  const closed = {
    contract_id: contractId,
    turn_index: 2,
    closed_turn_index: 3,
    status: 'closed',
    action_type: decision.chosen_action.action_type,
    outcome,
  };
  const envelope = {
    contract_id: contractId,
    decision_turn: 2,
    observation_turn: 3,
    public_learner_observation: learnerText,
    outcome,
    closed_record: closed,
  };
  const metadata = {
    world: { id: worldId },
    modelRef: 'fixture.tutor',
    resolved: { provider: 'fixture', model: 'tutor' },
    typedPedagogicalActions: { enabled: true },
    autoLearner: { enabled: true, modelRef: 'fixture.learner' },
  };
  const events = [
    { type: 'run_start', metadata },
    { type: 'tutor_typed_action_decision', turn: 2, phase: 'before_tutor_output', decision },
    {
      type: 'turn_complete',
      turn: 2,
      turnRecord: {
        turn: 2,
        typedActionDecision: decision,
        tutor: tutorText,
        learner: 'Initial learner observation.',
        deliveredResponseConfiguration: decision.response_configuration_patch,
        responseConfigurationAudit: {
          axes: { action_family: { selected: decision.chosen_action.move_family, visible: true } },
        },
      },
    },
    { type: 'tutor_typed_action_outcome_closed', turn: 3, decisionTurn: 2, outcome: envelope },
    {
      type: 'turn_complete',
      turn: 3,
      turnRecord: { turn: 3, learner: learnerText, tutor: 'A later response.', typedActionPriorOutcome: envelope },
    },
  ].map((event, index) => ({ ts: stamp(index), runId, seq: index + 1, ...event }));
  const review = {
    runId,
    contractId,
    method: 'human',
    reviewer: 'human:fixture-coder',
    source: 'synthetic-test-review',
    recordedAt: stamp(60),
    deliveredActionType: decision.chosen_action.action_type,
    outcome,
    tutorText,
    learnerText,
  };
  return { events: structuredClone(events), review, metadata, decision, runId, contractId };
}

function extract(fixture, overrides = {}) {
  return extractActionOutcomeMemoryEvidence({
    events: fixture.events,
    source: 'fixture.jsonl',
    contextKey: 'fixture-context',
    asOf: AS_OF,
    conditions: CONDITIONS,
    reviews: [fixture.review],
    ...overrides,
  });
}

function policy(overrides = {}) {
  return {
    enabled: true,
    scope: 'held_out_world',
    minObservations: 2,
    minDialogues: 2,
    minWorlds: 1,
    successFloor: 0.5,
    penalty: 2,
    maxAgeMs: 30 * 86400000,
    ...overrides,
  };
}

function replay(
  records,
  evaluation = traceFixture({ runId: 'evaluation', worldId: 'world-held-out', date: '2026-08-10T00:00:00.000Z' }),
  overrides = {},
) {
  return replayActionOutcomeMemoryDecisions({
    evaluationSources: [
      {
        source: 'evaluation.jsonl',
        contextKey: 'fixture-context',
        events: evaluation.events,
        metadata: evaluation.metadata,
      },
    ],
    records,
    conditions: CONDITIONS,
    policy: policy(),
    asOf: AS_OF,
    staleAsOf: '2026-08-01T00:00:00.000Z',
    conditionPermutation: { 'high-stagnation': 'low-velocity', 'low-velocity': 'high-stagnation' },
    ...overrides,
  });
}

function sourceRecords() {
  const records = ['a', 'b'].flatMap((id) => extract(traceFixture({ runId: id })).records);
  records.push(
    ...records.map((record) => ({
      ...record,
      id: `${record.id}-other-condition`,
      dialogueId: `${record.dialogueId}-other-condition`,
      contractId: `${record.contractId}-other-condition`,
      conditionId: 'low-velocity',
      outcome: 'success',
    })),
  );
  return records;
}

test('extracts only a complete delivered next-turn join and preserves source provenance', () => {
  const result = extract(traceFixture());
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].outcome, 'failure');
  assert.equal(result.records[0].conditionId, 'high-stagnation');
  assert.equal(result.rows[0].measurementStatus, 'human_confirmed');
  assert.deepEqual(result.rows[0].sourceSequence, { decision: 2, outcome: 4 });
});

test('auxiliary-only outcomes and human/auxiliary disagreements stay indeterminate', () => {
  const fixture = traceFixture();
  const missing = extract(fixture, { reviews: [] });
  assert.equal(missing.records[0].outcome, 'measurement_indeterminate');
  assert.equal(missing.rows[0].recordedOutcome, 'failure');
  const disagreement = extract(fixture, { reviews: [{ ...fixture.review, outcome: 'success' }] });
  assert.equal(disagreement.records[0].outcome, 'measurement_indeterminate');
  assert.equal(disagreement.rows[0].measurementStatus, 'auxiliary_human_disagreement');
  fixture.events[2].turnRecord.responseConfigurationAudit.axes.action_family.visible = false;
  assert.equal(extract(fixture).rows[0].measurementStatus, 'auxiliary_human_disagreement');
});

test('review text, delivery, timing, and unique reviewer records cannot silently reassign outcomes', () => {
  const fixture = traceFixture();
  for (const changes of [
    { tutorText: 'different' },
    { learnerText: 'different' },
    { deliveredActionType: 'explain_principle' },
  ]) {
    const result = extract(fixture, { reviews: [{ ...fixture.review, ...changes }] });
    assert.equal(result.records[0].outcome, 'measurement_indeterminate');
    assert.equal(result.rows[0].measurementStatus, 'review_join_mismatch');
  }
  const early = extract(fixture, { reviews: [{ ...fixture.review, recordedAt: fixture.events[0].ts }] });
  assert.equal(early.rows[0].measurementStatus, 'review_before_observation');
  const future = extract(fixture, { reviews: [{ ...fixture.review, recordedAt: '2026-08-13T00:00:00.000Z' }] });
  assert.equal(future.rows[0].measurementStatus, 'auxiliary_only');
  assert.throws(() => extract(fixture, { reviews: [fixture.review, fixture.review] }), /duplicate readiness review/);
});

test('rejects missing, duplicate, misordered, displaced, and incompatible joins', () => {
  const alterations = [
    (fixture) => {
      fixture.events.splice(3, 1);
    },
    (fixture) => {
      fixture.events[3].outcome.observation_turn = 8;
    },
    (fixture) => {
      fixture.events[4].turnRecord.learner = 'different next observation';
    },
    (fixture) => {
      fixture.events[2].turnRecord.deliveredResponseConfiguration.support_level = 3;
    },
    (fixture) => {
      fixture.events[2].turnRecord.typedActionDecision.delivery = { delivered: false };
    },
    (fixture) => {
      fixture.events[3].ts = '2026-07-01T00:00:00.000Z';
    },
    (fixture) => {
      fixture.events[1].seq = 1;
    },
    (fixture) => {
      fixture.events[3].runId = 'another-run';
    },
    (fixture) => {
      fixture.events[3].outcome.outcome = 'success';
    },
    (fixture) => {
      fixture.events[1].decision.chosen_action.move_family = 'wrong-family';
    },
  ];
  for (const alter of alterations) {
    const fixture = traceFixture();
    alter(fixture);
    assert.equal(extract(fixture).records.length, 0);
  }
});

test('missing historical detector inputs and overlapping conditions are reported, not reconstructed', () => {
  const fixture = traceFixture();
  delete fixture.events[1].decision.decision_provenance.memory_observation;
  const missing = extract(fixture);
  assert.equal(missing.records.length, 0);
  assert.equal(missing.exclusionCounts.memory_condition_not_observed, 1);
  const overlap = extract(traceFixture(), { conditions: [CONDITIONS[0], { ...CONDITIONS[0], id: 'overlap' }] });
  assert.equal(overlap.exclusionCounts.overlapping_declared_conditions, 1);
});

test('choice replay changes the current arm while stale and scrambled controls preserve the baseline', () => {
  const result = replay(sourceRecords());
  assert.equal(result.summary.replayed, 1);
  const row = result.cases[0];
  assert.equal(row.baselineActionType, 'minimal_hint');
  assert.notEqual(row.arms.current.selectedActionType, row.baselineActionType);
  assert.equal(row.arms.stale.selectedActionType, row.baselineActionType);
  assert.equal(row.arms.scrambled.selectedActionType, row.baselineActionType);
  assert.equal(row.arms.current.changed, true);
});

test('replay excludes all held-out worlds and the current dialogue, not just the current world', () => {
  const evaluation = traceFixture({ runId: 'evaluation', worldId: 'world-held-out', date: '2026-08-10T00:00:00.000Z' });
  const other = traceFixture({ runId: 'other-evaluation', worldId: 'world-a', date: '2026-08-10T00:00:00.000Z' });
  const result = replay(sourceRecords(), evaluation, {
    evaluationSources: [evaluation, other].map((fixture) => ({
      source: fixture.runId,
      contextKey: 'fixture-context',
      events: fixture.events,
      metadata: fixture.metadata,
    })),
  });
  assert.equal(result.summary.currentChanged, 0);
  assert.deepEqual(result.evaluationWorlds, ['world-a', 'world-held-out']);
  const ownDialogue = sourceRecords().map((record) => ({ ...record, dialogueId: 'evaluation' }));
  assert.equal(replay(ownDialogue, evaluation).summary.currentChanged, 0);
});

test('exact-world mode allows other dialogues from the same world but never future evidence', () => {
  const evaluation = traceFixture({ runId: 'evaluation', date: '2026-08-10T00:00:00.000Z' });
  assert.equal(
    replay(sourceRecords(), evaluation, { policy: policy({ scope: 'exact_world' }) }).summary.currentChanged,
    1,
  );
  const future = sourceRecords().map((record) => ({ ...record, recordedAt: '2026-08-11T00:00:00.000Z' }));
  assert.equal(replay(future, evaluation, { policy: policy({ scope: 'exact_world' }) }).summary.currentChanged, 0);
});

test('current indeterminacy stops demotion and invalid scramble support is visible', () => {
  const unknown = sourceRecords();
  unknown[0].outcome = 'measurement_indeterminate';
  const result = replay(unknown);
  assert.equal(result.cases[0].arms.current.reason, 'measurement_indeterminate');
  const partialConditions = sourceRecords().filter((record) => record.conditionId === 'high-stagnation');
  const missingControl = replay(partialConditions);
  assert.equal(missingControl.summary.scrambledNotEvaluable, 1);
  assert.equal(missingControl.cases[0].arms.scrambled.changed, null);
});

test('replay refuses changed baseline, hidden support changes, invalid ledger timing, and late stale cutoffs', () => {
  const changes = [
    [
      (fixture) => {
        delete fixture.events[1].decision.decision_provenance.selection_input;
      },
      'missing_selector_replay_input',
    ],
    [
      (fixture) => {
        fixture.events[1].decision.chosen_action.action_type = 'explain_principle';
      },
      'baseline_replay_mismatch',
    ],
    [
      (fixture) => {
        fixture.events[1].decision.full_candidate_set[0].utility += 1;
      },
      'baseline_replay_mismatch',
    ],
    [
      (fixture) => {
        fixture.events[1].decision.decision_provenance.support_axis_source = 'action_default';
      },
      'support_not_fixed',
    ],
    [
      (fixture) => {
        fixture.events[1].decision.decision_provenance.selection_input.interventionLedger[0].closed_turn_index = 8;
      },
      'selector_input_contains_unresolved_or_future_intervention',
    ],
    [
      (fixture) => {
        delete fixture.events[1].decision.decision_provenance.selection_input.interventionLedger[0].closed_turn_index;
      },
      'selector_input_contains_unresolved_or_future_intervention',
    ],
  ];
  for (const [change, reason] of changes) {
    const fixture = traceFixture({ runId: 'evaluation', worldId: 'world-held-out', date: '2026-08-10T00:00:00.000Z' });
    change(fixture);
    const result = replay(sourceRecords(), fixture);
    assert.equal(result.exclusionCounts[reason], 1);
  }
  assert.equal(
    replay(sourceRecords(), undefined, { staleAsOf: '2026-08-11T00:00:00.000Z' }).exclusionCounts
      .stale_cutoff_after_decision,
    1,
  );
});

test('configuration errors fail even when there are no replayable cases', () => {
  assert.throws(() => replay([], undefined, { policy: { enabled: true } }), /positive minObservations/);
  assert.throws(
    () =>
      replay([], undefined, {
        conditionPermutation: { 'high-stagnation': 'high-stagnation', 'low-velocity': 'high-stagnation' },
      }),
    /bijection/,
  );
});

function tempDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'action-memory-readiness-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeTrace(directory, name, fixture) {
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, fixture.events.map((event) => JSON.stringify(event)).join('\n') + '\n');
  return filePath;
}

test('full report preserves the all-missing outcome and does not require fabricated thresholds', async (t) => {
  const directory = tempDirectory(t);
  const fixture = traceFixture();
  fixture.events = fixture.events.filter((event) => !event.type.startsWith('tutor_typed_action'));
  const trace = writeTrace(directory, 'legacy.jsonl', fixture);
  const result = await buildActionOutcomeMemoryReadiness({
    asOf: AS_OF,
    sources: [{ path: trace, role: 'memory', contextKey: 'legacy-audit-only' }],
  });
  assert.equal(result.report.summary.typedDecisions, 0);
  assert.equal(result.memory.records.length, 0);
  assert.match(renderActionOutcomeMemoryReadiness(result.report), /No typed-action decisions/);
  assert.equal(result.report.modelCalls, 0);
});

test('malformed tails quarantine the source instead of accepting its valid prefix', async (t) => {
  const directory = tempDirectory(t);
  const trace = writeTrace(directory, 'broken.jsonl', traceFixture());
  fs.appendFileSync(trace, '{"type":"tutor_typed_action_decision_displaced"');
  const result = await buildActionOutcomeMemoryReadiness({
    asOf: AS_OF,
    conditions: CONDITIONS,
    sources: [{ path: trace, role: 'memory', contextKey: 'fixture-context' }],
  });
  assert.equal(result.report.summary.quarantinedSources, 1);
  assert.equal(result.memory.records.length, 0);
  assert.equal(result.report.exclusionCounts.malformed_jsonl, 1);
});

test('duplicate source copies do not inflate support and conflicting copies quarantine both', async (t) => {
  const directory = tempDirectory(t);
  const fixture = traceFixture();
  writeTrace(directory, 'a.jsonl', fixture);
  const second = writeTrace(directory, 'b.jsonl', fixture);
  const input = {
    asOf: AS_OF,
    conditions: CONDITIONS,
    sources: [{ path: directory, role: 'memory', contextKey: 'fixture-context' }],
  };
  const duplicates = await buildActionOutcomeMemoryReadiness(input);
  assert.equal(duplicates.report.exclusionCounts.duplicate_source_copy, 1);
  assert.equal(duplicates.memory.records.length, 1);
  fs.appendFileSync(second, '\n');
  const conflict = await buildActionOutcomeMemoryReadiness(input);
  assert.equal(conflict.report.exclusionCounts.conflicting_run_copies, 2);
  assert.equal(conflict.memory.records.length, 0);
});

test('CLI writes a create-once private report without copying public texts', async (t) => {
  const directory = tempDirectory(t);
  const trace = writeTrace(directory, 'source.jsonl', traceFixture());
  const inputPath = path.join(directory, 'input.json');
  const output = path.join(directory, 'report');
  fs.writeFileSync(
    inputPath,
    JSON.stringify({
      asOf: AS_OF,
      conditions: CONDITIONS,
      sources: [{ path: trace, role: 'memory', contextKey: 'fixture-context' }],
    }),
  );
  const run = () =>
    spawnSync(process.execPath, ['scripts/action-outcome-memory-readiness.js', '--input', inputPath, '--out', output], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const reportText = fs.readFileSync(path.join(output, 'readiness.json'), 'utf8');
  assert.doesNotMatch(reportText, /PRIVATE_TUTOR_TEXT|PRIVATE_LEARNER_TEXT/);
  const second = run();
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /refusing to overwrite/);
});
