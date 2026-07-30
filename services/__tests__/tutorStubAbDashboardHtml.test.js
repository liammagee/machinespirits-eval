import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTutorStubAbDashboardModel,
  normalizeTutorStubAbPairwiseRow,
  renderTutorStubAbDashboardHtml,
} from '../tutorStubAbDashboardHtml.js';

function fixtureReport() {
  return {
    plan: {
      arms: [
        { id: 'baseline', label: 'Bare tutor' },
        { id: 'contract_only', label: 'Contract only' },
      ],
      scenarios: [
        {
          id: 'nocturne_full',
          label: 'Nocturne',
          criterion: 'date the nocturne',
          turns: [{ caseId: 'rec:t009', turn: 9, learnerText: 'What should I write next?' }],
        },
      ],
    },
    summary: { baselineArmId: 'baseline' },
    results: [
      {
        scenarioId: 'nocturne_full',
        caseId: 'rec:t009',
        turn: 9,
        armId: 'baseline',
        modelId: 'codex_medium',
        status: 'fail',
        candidate: 'Look at the stock book & tell me.',
        failureClusters: ['a', 'b'],
        hardFailureClusters: ['a'],
      },
      {
        scenarioId: 'nocturne_full',
        caseId: 'rec:t009',
        turn: 9,
        armId: 'contract_only',
        modelId: 'codex_medium',
        status: 'pass',
        candidate: 'Write: the entry sits between thaw and frost.',
        failureClusters: [],
        hardFailureClusters: [],
      },
    ],
  };
}

function fixturePrBenchmark(runDir) {
  return {
    rows: [
      {
        runDir,
        caseId: 'rec:t009',
        armId: 'contract_only',
        modelId: 'codex_medium',
        success: true,
        brokenRules: 2,
        hardAxisVerdict: 'pass',
        axes: { overall_delivery: { label: 'pass' }, handoff: { label: 'fail' } },
      },
    ],
  };
}

test('pairwise normalizer accepts both file generations', () => {
  const oldRow = normalizeTutorStubAbPairwiseRow({
    id: 'nocturne_full:t9#7',
    slot: 'nocturne_full:t9',
    bareLabel: 'A',
    winner: 'baseline',
    bareChars: 257,
    contractChars: 311,
  });
  assert.deepEqual(oldRow.versions, ['baseline', 'contract_only']);
  assert.equal(oldRow.turn, 9);
  assert.equal(oldRow.chars.baseline, 257);

  const newRow = normalizeTutorStubAbPairwiseRow({
    slot: 'greyfen_short:t10',
    versions: ['generic_plan_only', 'contract_only'],
    winner: 'refused',
    chars: { generic_plan_only: 246, contract_only: 331 },
    runs: { generic_plan_only: 'plan-control-1', contract_only: 'plan-control-1' },
    showDue: true,
  });
  assert.equal(newRow.scenarioId, 'greyfen_short');
  assert.equal(newRow.showDue, true);
  assert.deepEqual(newRow.versions, ['generic_plan_only', 'contract_only']);
});

test('the merge attaches each channel only where run, case, version and model all match', () => {
  const runDir = 'exports/tutor-stub-ab/len-nocturne_full-r3';
  const model = buildTutorStubAbDashboardModel({
    reports: [{ dir: runDir, report: fixtureReport() }],
    prBenchmark: fixturePrBenchmark(runDir),
    pairwiseFiles: [
      {
        file: 'exports/tutor-stub-ab/pairwise-judging-baseline-vs-contract_only.jsonl',
        rows: [
          { slot: 'nocturne_full:t9', bareLabel: 'A', winner: 'baseline' },
          { slot: 'nocturne_full:t9', bareLabel: 'B', winner: 'refused' },
        ],
      },
    ],
  });

  const cards = model.scenarios[0].turns[0].groups[0].cards;
  const bare = cards.find((card) => card.armId === 'baseline');
  const contract = cards.find((card) => card.armId === 'contract_only');
  assert.equal(bare.pr, null, 'no PR row for the bare reply, so no PR verdict on its card');
  assert.equal(contract.pr.brokenRules, 2);
  assert.deepEqual(contract.pr.axes, { overall_delivery: 'pass', handoff: 'fail' });

  const contractLane = model.matrix.find((lane) => lane.armId === 'contract_only');
  assert.equal(contractLane.det.hardPerTurn, 0);
  assert.equal(contractLane.pr.deliveryPass, 1);
  assert.equal(contractLane.blind.losses, 1, 'one decided pairwise loss; the refusal counts for nobody');
  assert.equal(model.pairwise[0].tally.refused, 1);
});

test('the rendered page keeps channels separate and escapes reply text', () => {
  const runDir = 'exports/tutor-stub-ab/len-nocturne_full-r3';
  const model = buildTutorStubAbDashboardModel({
    reports: [{ dir: runDir, report: fixtureReport() }],
    prBenchmark: fixturePrBenchmark(runDir),
    pairwiseFiles: [],
  });
  const html = renderTutorStubAbDashboardHtml(model, { generatedAt: '2026-07-29T00:00:00Z' });

  assert.match(html, /stock book &amp; tell me/u, 'candidate text is escaped');
  assert.match(html, /PR bench: not read/u, 'a reply no judge read says so instead of borrowing a verdict');
  assert.match(html, /No number on this page combines two channels/u);
  assert.match(html, /Blind W–L/u);
  assert.doesNotMatch(html, /undefined|NaN/u);
});
