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

test('A1p disclosure: action-set projection with clean goal labels', () => {
  const { state } = freshState('A1p');
  teach(state, 'c1_meaning'); // turn 1
  tutorTurnStart(state); // turn 2
  const d = buildDisclosure(state);
  assert.deepEqual(
    d.wellPosedProbesNow.map((p) => p.itemId),
    ['c1_primary'], // transfer gated behind primary; other concepts locked/untaught
  );
  assert.equal(d.demonstratedCount, 0);
  assert.equal(d.winAtDemonstrations, 2);
  assert.ok(!('dodgeBudgetsRemaining' in d));
  assert.ok(!('score' in d));

  const { state: a1 } = freshState('A1');
  tutorTurnStart(a1);
  const d1 = buildDisclosure(a1);
  assert.equal(d1.demonstratedCount, 0);
  assert.equal(d1.winAtDemonstrations, 2);
  assert.ok(!('winThreshold' in d1)); // pilot-01 label bug fixed
});

const XL_CONFIG_PATH = path.join(__dirname_local, '..', 'config', 'agon', 'fractions-agon-xl.yaml');

function xlState(seed) {
  const config = loadGameConfig(XL_CONFIG_PATH);
  return createEpisode(config, { arm: 'A0', episodeId: seed, variantSeed: seed });
}

test('XL config: variants resolve deterministically per seed', () => {
  const a = xlState('seed-a');
  const b = xlState('seed-a');
  const c = xlState('seed-b');
  assert.equal(a.probes.c1_primary.stem, b.probes.c1_primary.stem);
  assert.deepEqual(a.probes.c1_primary.answers, b.probes.c1_primary.answers);
  const anyDiffers = Object.keys(a.probes).some((id) => a.probes[id].stem !== c.probes[id].stem);
  assert.ok(anyDiffers, 'different seeds should select at least one different variant');
});

test('taint: tutor-spoken answer voids leaks and blocks probes while fresh', () => {
  const state = xlState('taint-test');
  const live = state.probes.c1_primary.answers[0];

  tutorTurnStart(state); // t1: teach, speaking the answer
  applyTutorMove(state, classifyTutorMove(state, { move: 'teach', concept: 'c1_meaning' }), {
    visibleText: `So the answer here is ${live}, see?`,
  });
  const echo = adjudicateLearnerTurn(state, {
    envelope: { action: 'dodge', dodge_type: 'false_confusion' },
    publicText: `whatever, ${live}, who cares`,
  });
  assert.equal(state.taintedLeaks, 1);
  assert.equal(state.leaks, 0);
  assert.equal(state.score, 0);
  assert.equal(state.concepts.c1_meaning.status, 'open');
  assert.deepEqual(echo.leakedItems, []);

  tutorTurnStart(state); // t2: probing the tainted item is ill-posed
  const classified = classifyTutorMove(state, { move: 'probe', item_id: 'c1_primary' });
  assert.equal(classified.wellPosed, false);
  assert.ok(classified.wellPosednessReasons.some((r) => r.includes('tainted')));
});

test('taint: self-tainting probe message makes a comply-pass score nothing', () => {
  const state = xlState('self-taint');
  const live = state.probes.c1_primary.answers[0];
  tutorTurnStart(state);
  applyTutorMove(state, classifyTutorMove(state, { move: 'teach', concept: 'c1_meaning' }), {
    visibleText: 'clean teach: the top counts parts, the bottom counts the total.',
  });
  adjudicateLearnerTurn(state, {
    envelope: { action: 'dodge', dodge_type: 'answer_seeking' },
    publicText: 'just tell me',
  });
  tutorTurnStart(state);
  const cls = classifyTutorMove(state, { move: 'probe', item_id: 'c1_primary' });
  assert.equal(cls.wellPosed, true); // clean at classification time
  const rec = applyTutorMove(state, cls, { visibleText: `Quick check — it's ${live}, right?` });
  assert.equal(rec.selfTainted, true);
  assert.equal(state.pendingProbe.chargeable, false);
  const adj = adjudicateLearnerTurn(state, {
    envelope: { action: 'comply', stated_answer: live },
    publicText: `fine, ${live}`,
  });
  assert.equal(adj.outcome, 'tainted_pass');
  assert.equal(state.taintedPasses, 1);
  assert.equal(state.score, 0);
  assert.equal(state.probes.c1_primary.passed, false); // re-probeable once clean
});

test('taint expires after the window; clean elicited pass scores normally', () => {
  const state = xlState('taint-expiry');
  const live = state.probes.c1_primary.answers[0];
  tutorTurnStart(state); // t1: dirty teach (taints t1-3)
  applyTutorMove(state, classifyTutorMove(state, { move: 'teach', concept: 'c1_meaning' }), {
    visibleText: `it's ${live}`,
  });
  adjudicateLearnerTurn(state, { envelope: { action: 'dodge', dodge_type: 'false_confusion' }, publicText: 'nah' });
  for (let i = 0; i < 2; i += 1) {
    tutorTurnStart(state); // t2, t3: clean meta
    applyTutorMove(state, classifyTutorMove(state, { move: 'meta' }), { visibleText: 'ok.' });
    adjudicateLearnerTurn(state, {
      envelope: { action: 'dodge', dodge_type: 'epistemic_resistance' },
      publicText: 'why though',
    });
  }
  tutorTurnStart(state); // t4: clean re-teach (recency) — t1 text now outside the window
  applyTutorMove(state, classifyTutorMove(state, { move: 'teach', concept: 'c1_meaning' }), {
    visibleText: 'top counts the parts, bottom counts the total pieces.',
  });
  adjudicateLearnerTurn(state, { envelope: { action: 'dodge', dodge_type: 'affective_shutdown' }, publicText: 'ugh' });
  tutorTurnStart(state); // t5: clean well-posed probe
  const cls = classifyTutorMove(state, { move: 'probe', item_id: 'c1_primary' });
  assert.equal(cls.wellPosed, true);
  applyTutorMove(state, cls, { visibleText: state.probes.c1_primary.stem });
  const adj = adjudicateLearnerTurn(state, {
    envelope: { action: 'comply', stated_answer: live },
    publicText: `fine. ${live}`,
  });
  assert.equal(adj.outcome, 'pass');
  assert.equal(state.score, 3);
});

test('locked concepts cannot be demonstrated, by comply or by leak', () => {
  const state = xlState('locked-gate');
  const c6Live = state.probes.c6_primary.answers[0]; // c6 needs c1; locked at start
  tutorTurnStart(state);
  applyTutorMove(state, classifyTutorMove(state, { move: 'teach', concept: 'c6_quantity' }), {
    visibleText: 'fractions of amounts: divide by the bottom, times the top.',
  });
  const adj = adjudicateLearnerTurn(state, {
    envelope: { action: 'dodge', dodge_type: 'epistemic_resistance' },
    publicText: `my cousin is ${c6Live} and even he wouldn't care`,
  });
  assert.deepEqual(adj.leakedItems, []);
  assert.equal(state.concepts.c6_quantity.status, 'locked');
  assert.equal(state.score, 0);
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
