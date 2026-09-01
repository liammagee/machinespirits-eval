import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { estimateLearnerStateBelief, selectPedagogicalAction } from '../services/adaptiveTutor/actionPolicy.js';
import { buildTutorStubTypedActionDecision } from '../services/adaptiveTutor/tutorStubActionAdapter.js';
import {
  actionOutcomeReviewCodebook,
  buildActionOutcomeReviewPacket,
  compareActionOutcomeReviews,
  reviewDataHash,
  reviewJson,
} from '../services/adaptiveTutor/actionOutcomeReviewPacket.js';
import { extractActionOutcomeMemoryEvidence } from '../services/adaptiveTutor/actionOutcomeMemoryReadiness.js';
import {
  compareActionOutcomeReviewFiles,
  prepareActionOutcomeReview,
} from '../scripts/action-outcome-review-packet.js';

const CONDITIONS = [
  { id: 'prospective-condition', stagnationAtLeast: 0.8, fieldVelocityAtMost: 0.3, dagVelocityAtMost: 0.3 },
];

function tempDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'action-outcome-review-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function candidate(id = 'run-a:contract-a') {
  return {
    recordId: id,
    source: '/private/traces/run-a.jsonl',
    runId: id.split(':')[0],
    contractId: id.split(':')[1],
    worldId: 'private-world',
    contextKey: 'compatible-prospective-context',
    conditionId: 'prospective-condition',
    decisionTurn: 2,
    observationTurn: 3,
    observedAt: '2026-08-04T00:00:04.000Z',
    action: {
      action_type: 'minimal_hint',
      description: 'Offer a small scaffold without taking over.',
      success_signal: {
        description: 'Learner uses the hint to produce the next task-relevant move.',
        required_evidence: ['learner-authored next step'],
        forbidden_evidence: ['tutor-completed step'],
      },
    },
    learnerBefore: 'I cannot see how to begin.',
    tutorText: 'Try comparing the two public dates first. What changes?',
    learnerText: 'The second date is later, so that mark cannot support the earlier event.',
    auxiliaryOutcome: 'success',
    auxiliaryDeliveryVisible: true,
  };
}

function built(candidates = [candidate()]) {
  return buildActionOutcomeReviewPacket({
    candidates,
    packetId: 'packet-1',
    coderIds: ['coder-a', 'coder-b'],
  });
}

function complete(submission, { delivery = 'delivered', outcome = 'success' } = {}) {
  const result = structuredClone(submission);
  result.completedAt = '2026-08-05T00:00:00.000Z';
  result.independence = { workedIndependently: true, didNotAccessAuxiliaryLabels: true };
  for (const row of result.cases) {
    row.delivery = delivery;
    row.outcome = outcome;
    row.deliveryEvidence = 'The tutor visibly asks for the requested comparison.';
    row.outcomeEvidence = 'The learner makes the comparison in their own words.';
  }
  return result;
}

test('packet exposes public review material while the private key retains joins and auxiliary labels', () => {
  const artifacts = built();
  assert.equal(artifacts.packet.cases.length, 1);
  assert.equal(artifacts.packet.cases[0].requestedAction.type, 'minimal_hint');
  assert.match(actionOutcomeReviewCodebook(), /not measure learning or transfer/u);
  const publicBytes = JSON.stringify({ packet: artifacts.packet, submissions: artifacts.submissions });
  for (const privateValue of ['run-a', 'contract-a', 'private-world', 'auxiliaryOutcome', '/private/traces']) {
    assert.doesNotMatch(publicBytes, new RegExp(privateValue, 'u'));
  }
  assert.equal(artifacts.machineKey.cases[0].auxiliaryOutcome, 'success');
  assert.equal(artifacts.submissions.length, 2);
  assert.notDeepEqual(
    built([candidate('run-a:contract-a'), candidate('run-b:contract-b')]).submissions[0].cases,
    built([candidate('run-a:contract-a'), candidate('run-b:contract-b')]).submissions[1].cases,
  );
});

test('two matching independent reviews export exact importer records without copying private state', () => {
  const artifacts = built();
  const result = compareActionOutcomeReviews({
    packet: artifacts.packet,
    machineKey: artifacts.machineKey,
    submissions: artifacts.submissions.map((row) => complete(row)),
    recordedAt: '2026-08-06T00:00:00.000Z',
    source: 'action-outcome-review:packet-1',
  });
  assert.equal(result.report.summary.memoryOutcomes.success, 1);
  assert.equal(result.reviews[0].runId, 'run-a');
  assert.equal(result.reviews[0].tutorText, candidate().tutorText);
  assert.equal(result.reviews[0].outcome, 'success');
  assert.doesNotMatch(JSON.stringify(result.reviews[0]), /private-world|contextKey|conditionId/u);
});

test('packet preserves pre-action all/any evidence logic instead of flattening the criterion', () => {
  const row = candidate();
  row.action.success_signal.evidence_contract = {
    mode: 'proof_core_plus_resistance_core',
    core_evidence: ['learner-authored rationale'],
    any_of_groups: [
      { id: 'resistance_core', min: 1, labels: ['learner-owned test case', 'renewed content-bearing work'] },
    ],
  };
  const artifacts = built([row]);
  assert.deepEqual(artifacts.packet.cases[0].expectedEvidence.logic, row.action.success_signal.evidence_contract);
  assert.match(actionOutcomeReviewCodebook(), /do not flatten an any-of group/u);
});

test('coder uncertainty, delivery failure, disagreement, and auxiliary disagreement remain indeterminate', () => {
  for (const mutate of [
    (rows) => {
      rows[1].cases[0].outcome = 'failure';
    },
    (rows) => {
      rows[1].cases[0].delivery = 'indeterminate';
      rows[1].cases[0].outcome = 'measurement_indeterminate';
    },
  ]) {
    const artifacts = built();
    const submissions = artifacts.submissions.map((row) => complete(row));
    mutate(submissions);
    const result = compareActionOutcomeReviews({
      packet: artifacts.packet,
      machineKey: artifacts.machineKey,
      submissions,
      recordedAt: '2026-08-06T00:00:00.000Z',
      source: 'review:packet-1',
    });
    assert.equal(result.reviews[0].outcome, 'measurement_indeterminate');
    assert.equal(result.report.cases[0].memoryOutcome, 'measurement_indeterminate');
  }
  const artifacts = built([{ ...candidate(), auxiliaryOutcome: 'failure' }]);
  const result = compareActionOutcomeReviews({
    packet: artifacts.packet,
    machineKey: artifacts.machineKey,
    submissions: artifacts.submissions.map((row) => complete(row)),
    recordedAt: '2026-08-06T00:00:00.000Z',
    source: 'review:packet-1',
  });
  assert.equal(result.reviews[0].outcome, 'success');
  assert.equal(result.report.cases[0].memoryOutcome, 'measurement_indeterminate');
  assert.deepEqual(result.report.cases[0].reasons, ['auxiliary_human_disagreement']);
});

test('comparison rejects missing independence, incomplete cases, labels, temporal order, and changed packet bytes', () => {
  const scenarios = [
    (artifacts, rows) => {
      rows[0].independence.workedIndependently = false;
    },
    (artifacts, rows) => {
      rows[0].cases = [];
    },
    (artifacts, rows) => {
      rows[0].cases[0].outcome = 'unknown';
    },
    (artifacts, rows) => {
      rows[0].completedAt = '2026-08-03T00:00:00.000Z';
    },
    (artifacts) => {
      artifacts.packet.cases[0].tutorText = 'changed after packet creation';
    },
  ];
  for (const mutate of scenarios) {
    const artifacts = built();
    const submissions = artifacts.submissions.map((row) => complete(row));
    mutate(artifacts, submissions);
    assert.throws(() =>
      compareActionOutcomeReviews({
        packet: artifacts.packet,
        machineKey: artifacts.machineKey,
        submissions,
        recordedAt: '2026-08-06T00:00:00.000Z',
        source: 'review:packet-1',
      }),
    );
  }
});

function trace() {
  const runId = 'prospective-run';
  const contractId = 'prospective-contract';
  const base = Date.parse('2026-08-04T00:00:00.000Z');
  const selectionInput = {
    stateBelief: estimateLearnerStateBelief({
      dialogue: [{ role: 'learner', content: "I don't get it." }],
      turnIndex: 2,
    }),
    interventionLedger: [],
    mode: 'closed_loop',
    config: {},
  };
  const selection = selectPedagogicalAction(selectionInput);
  const decision = buildTutorStubTypedActionDecision({
    selection,
    stateBelief: selectionInput.stateBelief,
    task: { taskId: 'task-a', knowledgeComponent: 'evidence', prerequisitePath: [], itemDifficulty: 0.5 },
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
  const closed = {
    contract_id: contractId,
    turn_index: 2,
    closed_turn_index: 3,
    status: 'closed',
    action_type: decision.chosen_action.action_type,
    outcome: 'success',
  };
  const envelope = {
    contract_id: contractId,
    decision_turn: 2,
    observation_turn: 3,
    public_learner_observation: candidate().learnerText,
    outcome: 'success',
    closed_record: closed,
  };
  return [
    { type: 'run_start', metadata: { world: { id: 'world-a' }, typedPedagogicalActions: { enabled: true } } },
    { type: 'tutor_typed_action_decision', turn: 2, phase: 'before_tutor_output', decision },
    {
      type: 'turn_complete',
      turn: 2,
      turnRecord: {
        turn: 2,
        typedActionDecision: decision,
        learner: candidate().learnerBefore,
        tutor: candidate().tutorText,
        deliveredResponseConfiguration: decision.response_configuration_patch,
        responseConfigurationAudit: {
          axes: { action_family: { selected: decision.chosen_action.move_family, visible: true } },
        },
      },
    },
    { type: 'tutor_typed_action_outcome_closed', turn: 3, outcome: envelope },
    {
      type: 'turn_complete',
      turn: 3,
      turnRecord: {
        turn: 3,
        learner: candidate().learnerText,
        tutor: 'Later tutor reply.',
        typedActionPriorOutcome: envelope,
      },
    },
  ].map((event, index) => ({ ts: new Date(base + index * 1000).toISOString(), runId, seq: index + 1, ...event }));
}

test('prepare and compare commands write create-once private artifacts with zero calls', async (t) => {
  const root = tempDirectory(t);
  const tracePath = path.join(root, 'trace.jsonl');
  fs.writeFileSync(tracePath, `${trace().map(JSON.stringify).join('\n')}\n`);
  const inputPath = path.join(root, 'input.json');
  fs.writeFileSync(
    inputPath,
    reviewJson({
      asOf: '2026-08-12T00:00:00.000Z',
      conditions: CONDITIONS,
      sources: [{ path: 'trace.jsonl', role: 'memory', contextKey: 'prospective-context' }],
    }),
  );
  const packetRoot = path.join(root, 'packet');
  const prepared = await prepareActionOutcomeReview({
    inputPath,
    outputPath: packetRoot,
    packetId: 'packet-cli',
    coderIds: ['coder-a', 'coder-b'],
  });
  assert.equal(prepared.manifest.modelCalls, 0);
  assert.equal(prepared.manifest.eligibleCases, 1);
  assert.throws(() => fs.writeFileSync(path.join(packetRoot, 'packet.json'), '{}', { flag: 'wx' }), /EEXIST/u);
  const packet = JSON.parse(fs.readFileSync(path.join(packetRoot, 'packet.json')));
  assert.equal(prepared.manifest.artifactDataHashes.packet, reviewDataHash(reviewJson(packet)));
  const submissions = ['coder-a', 'coder-b'].map((id) => {
    const filePath = path.join(root, `${id}.complete.json`);
    const template = JSON.parse(fs.readFileSync(path.join(packetRoot, `${id}.submission.json`)));
    fs.writeFileSync(filePath, reviewJson(complete(template)));
    return filePath;
  });
  const outputPath = path.join(root, 'comparison');
  const compared = compareActionOutcomeReviewFiles({
    rootPath: packetRoot,
    submissionPaths: submissions,
    outputPath,
    recordedAt: '2026-08-06T00:00:00.000Z',
  });
  assert.equal(compared.report.modelCalls, 0);
  const reviews = JSON.parse(fs.readFileSync(path.join(outputPath, 'reviews.json')));
  assert.equal(reviews[0].outcome, 'success');
  const extracted = extractActionOutcomeMemoryEvidence({
    events: trace(),
    source: tracePath,
    contextKey: 'prospective-context',
    conditions: CONDITIONS,
    reviews,
    asOf: '2026-08-12T00:00:00.000Z',
  });
  assert.equal(extracted.rows[0].measurementStatus, 'human_confirmed');
  assert.equal(extracted.records[0].outcome, 'success');
  assert.throws(
    () =>
      compareActionOutcomeReviewFiles({
        rootPath: packetRoot,
        submissionPaths: submissions,
        outputPath,
        recordedAt: '2026-08-06T00:00:00.000Z',
      }),
    /refusing to overwrite/u,
  );
  const keyPath = path.join(packetRoot, 'machine-key.json');
  const key = JSON.parse(fs.readFileSync(keyPath));
  key.cases[0].auxiliaryOutcome = 'failure';
  fs.writeFileSync(keyPath, reviewJson(key));
  assert.throws(
    () =>
      compareActionOutcomeReviewFiles({
        rootPath: packetRoot,
        submissionPaths: submissions,
        outputPath: path.join(root, 'comparison-after-drift'),
        recordedAt: '2026-08-06T00:00:00.000Z',
      }),
    /artifact data drift/u,
  );
});

test('packet preparation refuses invented conditions, preexisting reviews, evaluation sources, and empty evidence', async (t) => {
  assert.throws(() => built([]), /no eligible/u);
  const root = tempDirectory(t);
  const inputPath = path.join(root, 'input.json');
  const cases = [
    { asOf: '2026-08-12T00:00:00.000Z', sources: [] },
    { asOf: '2026-08-12T00:00:00.000Z', conditions: CONDITIONS, reviewsFile: 'reviews.json', sources: [] },
    {
      asOf: '2026-08-12T00:00:00.000Z',
      conditions: CONDITIONS,
      sources: [{ path: 'x', role: 'evaluation', contextKey: 'x' }],
    },
  ];
  for (const [index, input] of cases.entries()) {
    fs.writeFileSync(inputPath, reviewJson(input));
    await assert.rejects(() =>
      prepareActionOutcomeReview({
        inputPath,
        outputPath: path.join(root, `out-${index}`),
        packetId: 'packet',
        coderIds: ['coder-a', 'coder-b'],
      }),
    );
  }
});
