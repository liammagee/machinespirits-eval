// Agon referee unit tests — pure rule engine, no API, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  loadGameConfig,
  createEpisode,
  tutorTurnStart,
  classifyTutorMove,
  applyTutorMove,
  buildLearnerBrief,
  checkLearnerEnvelope,
  adjudicateLearnerTurn,
  buildDisclosure,
  isTerminal,
  summarize,
  normalizeAnswer,
  textContainsAnswer,
} from '../services/agon/referee.js';
import { parseAgentOutput } from '../services/agon/llm.js';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname_local, '..', 'config', 'agon', 'fractions-agon.yaml');

function freshState(arm = 'A1') {
  const config = loadGameConfig(CONFIG_PATH);
  return { config, state: createEpisode(config, { arm, episodeId: `test-${arm}` }) };
}

function teach(state, conceptId) {
  tutorTurnStart(state);
  const classified = classifyTutorMove(state, { move: 'teach', concept: conceptId });
  assert.equal(classified.legal, true);
  applyTutorMove(state, classified);
}

function probe(state, itemId) {
  tutorTurnStart(state);
  const classified = classifyTutorMove(state, { move: 'probe', item_id: itemId });
  assert.equal(classified.legal, true);
  applyTutorMove(state, classified);
  return classified;
}

test('config loads and validates', () => {
  const config = loadGameConfig(CONFIG_PATH);
  assert.equal(config.id, 'fractions_agon_v0');
  assert.equal(config.concepts.length, 4);
  assert.equal(config.dodges.length, 5);
});

test('answer normalization and boundary matching', () => {
  assert.equal(normalizeAnswer('  5 / 8 '), '5/8');
  assert.ok(textContainsAnswer('i think it is 5/8 obviously', '5/8'));
  assert.ok(textContainsAnswer('It’s 5/8.', '5/8'));
  assert.ok(!textContainsAnswer('it is 15/8', '5/8'));
  assert.ok(!textContainsAnswer('maybe 5/82', '5/8'));
  assert.ok(!textContainsAnswer('the ratio 25/80 appears', '5/8'));
});

test('prereq locking: c2 locked until c1 demonstrated; probe on locked concept is ill-posed', () => {
  const { state } = freshState();
  assert.equal(state.concepts.c1_meaning.status, 'open');
  assert.equal(state.concepts.c2_equivalence.status, 'locked');

  teach(state, 'c2_equivalence');
  tutorTurnStart(state);
  const classified = classifyTutorMove(state, { move: 'probe', item_id: 'c2_primary' });
  assert.equal(classified.legal, true);
  assert.equal(classified.wellPosed, false);
  assert.ok(classified.wellPosednessReasons.some((r) => r.includes('prerequisites')));
});

test('teach-recency window: stale teaching makes a probe ill-posed and costs a point', () => {
  const { state } = freshState();
  teach(state, 'c1_meaning'); // turn 1
  // waste the window with meta turns
  for (let i = 0; i < 3; i += 1) {
    tutorTurnStart(state); // turns 2,3,4
    applyTutorMove(state, classifyTutorMove(state, { move: 'meta' }));
  }
  tutorTurnStart(state); // turn 5: taught at 1, window is turns 2-4 => stale
  const classified = classifyTutorMove(state, { move: 'probe', item_id: 'c1_primary' });
  assert.equal(classified.wellPosed, false);
  applyTutorMove(state, classified);
  assert.equal(state.wastedProbes, 1);
  assert.equal(state.score, -1);
  assert.equal(state.pendingProbe.chargeable, false);
});

test('consecutive same-concept probe is ill-posed', () => {
  const { state } = freshState();
  teach(state, 'c1_meaning');
  probe(state, 'c1_primary');
  adjudicateLearnerTurn(state, {
    envelope: { action: 'dodge', dodge_type: 'false_confusion' },
    publicText: 'huh, what does the bottom number even mean',
  });
  tutorTurnStart(state);
  const classified = classifyTutorMove(state, { move: 'probe', item_id: 'c1_primary' });
  assert.equal(classified.wellPosed, false);
  assert.ok(classified.wellPosednessReasons.some((r) => r.includes('consecutive')));
});

test('well-posed dodge charges budget; free dodge does not; exhaustion bounces then forces comply', () => {
  const { state } = freshState();
  teach(state, 'c1_meaning');
  probe(state, 'c1_primary'); // well-posed
  assert.equal(state.pendingProbe.chargeable, true);

  const legality = checkLearnerEnvelope(state, { action: 'dodge', dodge_type: 'false_confusion' });
  assert.equal(legality.ok, true);
  adjudicateLearnerTurn(state, {
    envelope: { action: 'dodge', dodge_type: 'false_confusion' },
    publicText: 'I literally do not get it',
  });
  assert.equal(state.budgets.false_confusion, 0);
  assert.equal(state.concepts.c1_meaning.contested, true);

  // Exhausted type against a chargeable probe bounces with alternatives.
  teach(state, 'c1_meaning');
  probe(state, 'c1_primary');
  const bounce = checkLearnerEnvelope(state, { action: 'dodge', dodge_type: 'false_confusion' });
  assert.equal(bounce.ok, false);
  assert.equal(bounce.directive, 'switch_or_comply');
  assert.ok(bounce.alternatives.includes('polite_false_mastery'));

  // Drain every budget: must_comply.
  for (const dodgeType of Object.keys(state.budgets)) state.budgets[dodgeType] = 0;
  const forced = checkLearnerEnvelope(state, { action: 'dodge', dodge_type: 'affective_shutdown' });
  assert.equal(forced.ok, false);
  assert.equal(forced.directive, 'must_comply');

  // Dodging an UNCHARGEABLE probe with an exhausted type is legal (free).
  state.pendingProbe.chargeable = false;
  const free = checkLearnerEnvelope(state, { action: 'dodge', dodge_type: 'affective_shutdown' });
  assert.equal(free.ok, true);
});

test('comply with keyed answer demonstrates, scores, unlocks dependents', () => {
  const { state } = freshState();
  teach(state, 'c1_meaning');
  probe(state, 'c1_primary');
  const adjudication = adjudicateLearnerTurn(state, {
    envelope: { action: 'comply', dodge_type: null, stated_answer: '5/8' },
    publicText: "fine, it's 5/8",
  });
  assert.equal(adjudication.outcome, 'pass');
  assert.equal(state.concepts.c1_meaning.status, 'demonstrated');
  assert.equal(state.score, 3);
  assert.equal(state.firstDemonstrationTurn, 2);
  assert.equal(state.concepts.c2_equivalence.status, 'open'); // unlocked
  assert.equal(state.concepts.c3_comparison.status, 'locked'); // needs c2
});

test('comply mismatch: wrong answer does not score, marks contested', () => {
  const { state } = freshState();
  teach(state, 'c1_meaning');
  probe(state, 'c1_primary');
  const adjudication = adjudicateLearnerTurn(state, {
    envelope: { action: 'comply', dodge_type: null, stated_answer: '3/8' },
    publicText: 'it is 3/8 i guess',
  });
  assert.equal(adjudication.outcome, 'comply_mismatch');
  assert.equal(state.complyMismatches, 1);
  assert.equal(state.concepts.c1_meaning.status, 'open');
  assert.equal(state.score, 0);
});

test('leak: saying a scannable keyed answer aloud while dodging counts as demonstration', () => {
  const { state } = freshState();
  teach(state, 'c1_meaning');
  probe(state, 'c1_primary'); // c1_primary is leak-scannable ("5/8" not in stem)
  const adjudication = adjudicateLearnerTurn(state, {
    envelope: { action: 'dodge', dodge_type: 'epistemic_resistance' },
    publicText: 'obviously it would be 5/8 but that is not the point, when would anyone use this',
  });
  assert.equal(adjudication.outcome, 'dodged');
  assert.deepEqual(adjudication.leakedItems, ['c1_primary']);
  assert.equal(state.leaks, 1);
  assert.equal(state.concepts.c1_meaning.status, 'demonstrated');
  // budget still charged for the dodge itself
  assert.equal(state.budgets.epistemic_resistance, 0);
});

test('comparison probes are not leak-scannable (answer appears in the stem)', () => {
  const { state } = freshState();
  assert.equal(state.probes.c3_primary.leakScannable, false);
  assert.equal(state.probes.c3_transfer.leakScannable, false);
  assert.equal(state.probes.c2_transfer.leakScannable, false);
  assert.equal(state.probes.c1_primary.leakScannable, true);
  assert.equal(state.probes.c4_primary.leakScannable, true);
});

test('transfer probe ill-posed before primary; scores +1 after', () => {
  const { state } = freshState();
  teach(state, 'c1_meaning');
  tutorTurnStart(state);
  const early = classifyTutorMove(state, { move: 'probe', item_id: 'c1_transfer' });
  assert.equal(early.wellPosed, false);
  applyTutorMove(state, early);
  adjudicateLearnerTurn(state, {
    envelope: { action: 'dodge', dodge_type: 'answer_seeking' },
    publicText: 'just tell me',
  });
  assert.equal(state.budgets.answer_seeking, 1); // free dodge — probe was ill-posed

  teach(state, 'c1_meaning');
  probe(state, 'c1_primary');
  adjudicateLearnerTurn(state, { envelope: { action: 'comply', stated_answer: '5/8' }, publicText: "it's 5/8" });
  teach(state, 'c1_meaning'); // refresh recency for the transfer item
  probe(state, 'c1_transfer');
  const adjudication = adjudicateLearnerTurn(state, {
    envelope: { action: 'comply', stated_answer: '7/24' },
    publicText: '7/24',
  });
  assert.equal(adjudication.outcome, 'pass');
  assert.equal(state.concepts.c1_meaning.status, 'transferred');
  assert.equal(state.score, 3 + 1 - 1); // primary + transfer + one wasted probe
});

test('disclosure: A0 sees turn info only; A1 sees full scoreboard', () => {
  const { state: a0 } = freshState('A0');
  tutorTurnStart(a0);
  const d0 = buildDisclosure(a0);
  assert.deepEqual(Object.keys(d0).sort(), ['turn', 'turnsRemaining']);

  const { state: a1 } = freshState('A1');
  tutorTurnStart(a1);
  const d1 = buildDisclosure(a1);
  assert.ok('dodgeBudgetsRemaining' in d1);
  assert.ok('concepts' in d1);
  assert.equal(d1.score, 0);
});

test('learner brief always carries budgets, pending-probe legality, directive', () => {
  const { state } = freshState('A0'); // arm-independent
  teach(state, 'c1_meaning');
  probe(state, 'c1_primary');
  const brief = buildLearnerBrief(state);
  assert.equal(brief.pendingProbe.wellPosed, true);
  assert.equal(brief.pendingProbe.dodgingWillChargeBudget, true);
  assert.equal(brief.budgets.false_confusion, 1);
  assert.equal(brief.directive, 'normal');
});

test('terminal on max turns and summary shape', () => {
  const { state } = freshState();
  state.rules = { ...state.rules, max_turns: 2 };
  teach(state, 'c1_meaning');
  adjudicateLearnerTurn(state, { envelope: { action: 'dodge', dodge_type: 'false_confusion' }, publicText: 'nope' });
  assert.equal(isTerminal(state), false);
  probe(state, 'c1_primary');
  adjudicateLearnerTurn(state, { envelope: { action: 'comply', stated_answer: '5/8' }, publicText: "it's 5/8" });
  assert.equal(isTerminal(state), true);
  const summary = summarize(state);
  assert.equal(summary.demonstrated, 1);
  assert.equal(summary.turns, 2);
  assert.equal(summary.tutorWin, false); // win bar is 2
  assert.ok(summary.moveEntropy > 0);
});

test('parseAgentOutput: fence form, bare form, garbage', () => {
  const fence = parseAgentOutput('```json\n{"move":"teach","concept":"c1_meaning"}\n```\n---\nHello Jesse.');
  assert.equal(fence.parseMode, 'fence');
  assert.equal(fence.envelope.move, 'teach');
  assert.equal(fence.visible, 'Hello Jesse.');

  const bare = parseAgentOutput('{"action":"dodge","dodge_type":"answer_seeking"}\n---\njust tell me.');
  assert.equal(bare.parseMode, 'bare');
  assert.equal(bare.envelope.action, 'dodge');
  assert.equal(bare.visible, 'just tell me.');

  const nested = parseAgentOutput('```json\n{"verdict":"REVISE","critique":"say \\"no\\" to {rapport}"}\n```');
  assert.equal(nested.envelope.verdict, 'REVISE');

  assert.equal(parseAgentOutput('no json here at all'), null);
});
