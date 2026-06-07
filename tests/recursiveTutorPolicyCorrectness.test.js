import assert from 'node:assert/strict';
import test from 'node:test';
import { relaxedAliasHits, relaxedMarkerHits } from '../scripts/run-recursive-tutor-policy-ablation.js';

// A18.36 relaxed (order-insensitive) policy-correctness matching.
//
// Context: the strict contiguous-substring matcher (`phraseHits`) produced the
// `lexical_correctness_false_negative` instrument-failure class on the A18.35
// relational_betweenness family — a genuinely-correct S1 ("slot six HAS A neri",
// "ralo AT slot seven") was scored `missing_registered_target` because the
// registered alias was "slot six neri" / "ralo in slot seven". These tests pin
// the relaxed matcher's two non-negotiable properties:
//   1. It certifies the SAME semantic content in different word order (fixes the
//      false negative).
//   2. It PRESERVES discriminating power — the wrong-slot S0 arms, the bead
//      positive control, and an adversarial cross-clause mention must NOT flip a
//      correct-target match. This preservation is the anti-closed-loop proof:
//      the matcher was not merely loosened until the desired arm passed.

// Real continuations, copied verbatim from the A18.35 relational_betweenness
// ablation artifacts (preserved at
// exports/.../a18.6-policy-ablation.sib{1,2}-*).
const SIB1_S0 = `TUTOR: "One of those features belongs to the tag itself. Which one?"
LEARNER: "The tag has a blue wash. The neri in slot one shares that—closeness and lane just describe positions, not the tag. Slot one, then."
TUTOR: "The tag's own property picks its support; the rest was scene furniture."`;

const SIB1_S1 = `TUTOR: "You listed the stud as though it were another cue. Suppose instead it marks one end of a section, and the tag marks the other. What lies inside that section?"
LEARNER: "Between slot four and slot seven—that's slots five and six. Only slot six has a neri, the plain tan one. So the stud wasn't voting; it was bracketing where the carrier has to sit."
TUTOR: "Right. The surface cues competed; the tag-and-stud span settles it."`;

const SIB2_S0 = `LEARNER: "That still feels like a scorecard. Gold points at slot one, closeness points at slot four, the clean lane points at slot three, and the stud sits at slot eight."
TUTOR: "Your scorecard gives three ralos one point each. The tag sits at five and must travel. Can a point in gold or closeness push the tag down a blocked lane?"
LEARNER: "No—if the lane is blocked, points won't shove the tag through. The clear lane isn't just a point; it's what lets the tag actually arrive. Slot three."
TUTOR: "So the question was never which ralo scores highest—it was which one the tag can reach."`;

const SIB2_S1 = `LEARNER: "That still feels like a scorecard. Gold points at slot one, closeness points at slot four, the clean lane points at slot three, and the stud sits at slot eight."
TUTOR: "The stud doesn't cast a vote—so perhaps it isn't a cue at all. Suppose the stud and the final tag mark two ends of a section. What lies inside that section, between slot five and slot eight?"
LEARNER: "Slots six and seven. Only the buff ralo at slot seven sits inside that span—so the buff ralo carries the tag, not because it won on colour or closeness, but because it's the only one bracketed by the tag and the stud."
TUTOR: "Right. The stud was never a point to weigh; it was the far bracket."`;

const SIB1_TARGET = ['slot six neri', 'slot-six neri', 'neri in slot six', 'sixth-slot neri'];
const SIB1_INCORRECT = ['slot one neri', 'slot two neri', 'slot three neri', 'first-slot neri', 'third-slot neri'];
const SIB2_TARGET = ['slot seven ralo', 'slot-seven ralo', 'ralo in slot seven', 'seventh-slot ralo'];
const SPAN_MARKERS = [
  'anchor span',
  'anchor bracket',
  'flanked by the tag and the stud',
  'span flanked by the tag and the stud',
  'bracketed by the tag and the stud',
  'token the tag and the stud flank',
];

// ---- Property 1: relaxed FIXES the false negatives (S1 correct target) ------

test('relaxed target match certifies "slot six has a neri" against registered "neri in slot six"', () => {
  const hits = relaxedAliasHits(SIB1_S1, SIB1_TARGET);
  assert.ok(hits.length > 0, `expected sib1 S1 to relaxed-match the slot-six target, got ${JSON.stringify(hits)}`);
});

test('relaxed target match certifies "ralo at slot seven" against registered "ralo in slot seven"', () => {
  const hits = relaxedAliasHits(SIB2_S1, SIB2_TARGET);
  assert.ok(hits.length > 0, `expected sib2 S1 to relaxed-match the slot-seven target, got ${JSON.stringify(hits)}`);
});

test('relaxed marker match certifies "the tag-and-stud span settles it" via span concept', () => {
  const hits = relaxedMarkerHits(SIB1_S1, SPAN_MARKERS);
  assert.ok(hits.length > 0, `expected sib1 S1 to relaxed-match the span marker, got ${JSON.stringify(hits)}`);
});

test('relaxed marker match certifies sib2 S1 span relation', () => {
  const hits = relaxedMarkerHits(SIB2_S1, SPAN_MARKERS);
  assert.ok(hits.length > 0, `expected sib2 S1 to relaxed-match the span marker, got ${JSON.stringify(hits)}`);
});

// ---- Property 2: relaxed PRESERVES discriminating power (anti-closed-loop) ---

test('relaxed target does NOT match the wrong-slot S0 arm (sib1 picks slot one, not six)', () => {
  assert.deepEqual(relaxedAliasHits(SIB1_S0, SIB1_TARGET), [], 'sib1 S0 must not match the slot-six target');
});

test('relaxed target does NOT match the wrong-slot S0 arm (sib2 picks slot three, not seven)', () => {
  assert.deepEqual(relaxedAliasHits(SIB2_S0, SIB2_TARGET), [], 'sib2 S0 must not match the slot-seven target');
});

test('relaxed correctly flags the wrong target the S0 arm DID pick (sib1 -> slot one)', () => {
  const hits = relaxedAliasHits(SIB1_S0, SIB1_INCORRECT);
  assert.ok(
    hits.includes('slot one neri'),
    `expected sib1 S0 to relaxed-match incorrect "slot one neri", got ${JSON.stringify(hits)}`,
  );
});

test('relaxed does NOT certify sib2 S0 — it names "Slot three." without the type word', () => {
  // sib2 S0 says "Slot three." with no "ralo" attached, so the type-bearing
  // incorrect alias "slot three ralo" correctly does NOT match (the verdict is
  // missing_registered_target, not wrong_target). The discriminating property is
  // that S0 does not match the CORRECT target — and it does not. A looser matcher
  // that fired on the bare ordinal would risk distractor false-positives; staying
  // conservative here is the right trade.
  assert.deepEqual(relaxedAliasHits(SIB2_S0, SIB2_TARGET), [], 'sib2 S0 must not match the slot-seven target');
  assert.deepEqual(
    relaxedAliasHits(SIB2_S0, ['slot three ralo']),
    [],
    'type word absent next to "slot three", so the wrong-target alias correctly does not match',
  );
});

test('relaxed span-marker does NOT match the colour/lane S0 arms (no span language)', () => {
  assert.deepEqual(relaxedMarkerHits(SIB1_S0, SPAN_MARKERS), [], 'sib1 S0 (colour) must not match span marker');
  assert.deepEqual(relaxedMarkerHits(SIB2_S0, SPAN_MARKERS), [], 'sib2 S0 (lane/reach) must not match span marker');
});

// ---- Property 2 (cont.): adversarial cross-clause mention must not match -----

test('relaxed target rejects a cross-clause mention (names six but selects two)', () => {
  // "slot six" appears, but only as a distant mention; the selected referent is
  // the neri at slot two.
  const text = 'TUTOR: "Slot six is empty there, ignore it." LEARNER: "The neri at slot two is the one."';
  assert.deepEqual(
    relaxedAliasHits(text, ['slot six neri']),
    [],
    'a mention of slot six far from "neri" must not count as selecting it',
  );
  // ...and it DOES match the actually-selected slot two (neri within the anchor window).
  assert.ok(relaxedAliasHits(text, ['slot two neri', 'neri in slot two']).length > 0);
});

// ---- Property 2 (cont.): bead positive control — relaxed agrees with strict --

test('relaxed matches the bead positive-control phrasings without over-matching', () => {
  const beadS1 =
    'TUTOR: "Use the bead strip and take the one bead-step before the badge." LEARNER: "The middle naro is before it."';
  assert.ok(relaxedAliasHits(beadS1, ['middle naro']).includes('middle naro'));
  assert.ok(relaxedMarkerHits(beadS1, ['one bead-step before', 'bead strip']).length >= 2);
  // The bead S0 picks the right naro; the middle-naro target must not match it.
  const beadS0 = 'TUTOR: "Use exact repeated marks." LEARNER: "The right naro matches the badge."';
  assert.deepEqual(relaxedAliasHits(beadS0, ['middle naro']), []);
  assert.ok(relaxedAliasHits(beadS0, ['right naro']).includes('right naro'));
});
