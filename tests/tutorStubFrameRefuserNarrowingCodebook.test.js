// GUARD: the narrowing codebook stays a second scale beside the sealed
// engagement ladder, never a replacement for it.
//
// The risk this holds off is drift of authority. The codebook exists because
// the ladder cannot say whether a refusal got narrower; the moment it starts
// deciding ladder scores, breaking ladder ties, or feeding the current study's
// primary endpoint, the study has quietly changed its endpoint without a new
// registration. The other risk is the tie-break going missing: a learner naming a bound while
// withholding is rung 1, and that sentence is the whole reason the codebook
// was written.
//
// Offline and free: reads two files, calls nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODEBOOK_PATH = path.join(REPO_ROOT, 'config/tutor-stub-frame-refuser-narrowing-codebook.v1.md');
const WORKPLAN_PATH = path.join(REPO_ROOT, 'workplan/items/frame-refuser-refusal-narrowing.md');
const codebook = () => fs.readFileSync(CODEBOOK_PATH, 'utf8');
const workplan = () => fs.readFileSync(WORKPLAN_PATH, 'utf8');

test('the codebook defines all three registered marks', () => {
  const text = codebook();
  // The card's P0 names these three countable marks. A codebook missing one
  // cannot answer the question the card asks.
  assert.match(text, /Mark 1 — open demands/u);
  assert.match(text, /Mark 2 — bound tightness/u);
  assert.match(text, /Mark 3 — conceded sub-claims/u);
  // Each needs a direction, or a reader cannot tell narrower from wider.
  assert.match(text, /open demands \(count, lower is narrower\)/u);
  assert.match(text, /bound tightness \(0–3, higher is narrower\)/u);
  assert.match(text, /conceded sub-claims \(count, higher is narrower\)/u);
});

test('the codebook carries the tie-break the readers split on', () => {
  const text = codebook();
  // The fourth calibration failed pairwise agreement at exactly this boundary.
  // The ladder is not amended, so the codebook must settle it in words.
  assert.match(text, /names a bound while still withholding is rung 1 on the\s+ladder/u);
  assert.match(text, /0\.714/u, 'the codebook should name the agreement it is answering');
  assert.match(text, /0\.733/u);
});

test('the codebook preserves the ladder while allowing a future registered endpoint', () => {
  const text = codebook();
  assert.match(text, /It is not a rung 1\.5/u);
  assert.match(text, /never converts to a ladder score/u);
  assert.match(text, /never breaks a ladder tie/u);
  assert.match(text, /already registered satisfiable study/u);
  assert.match(text, /P1 is\s+instrument-building calibration/u);
  assert.match(text, /report-only/u);
  assert.match(text, /later fresh registered study may promote/u);
  assert.doesNotMatch(text, /never enters the primary endpoint of any\s+study/u);
});

test('the codebook grants no model call and names its next gate', () => {
  const text = codebook();
  assert.match(text, /licenses nothing/u);
  assert.match(text, /authorizes no model call/u);
  // The next paid step must carry an explicit GO and spend ceiling.
  assert.match(text, /its own explicit GO and\s+spend ceiling/u);
  // And it must say what a null result means, before anyone reads.
  assert.match(text, /If readers cannot meet the\s+agreement floors or the measure does not spread/u);
});

test('the worked examples are marked authored, not quoted from the archive', () => {
  const text = codebook();
  // The archived gray-zone rows are not in this checkout. Presenting invented
  // learner speech as archived evidence would be fabrication; the codebook
  // says plainly that the examples are authored and must be replaced.
  assert.match(text, /These examples are authored, not quoted/u);
  assert.match(text, /not in this checkout/u);
  assert.match(text, /Before reader calibration, replace these with\s+real rows/u);
});

test('P0 stays open until the archived examples replace the authored draft', () => {
  const text = codebook();
  const card = workplan();
  assert.match(text, /P0 remains open until/u);
  assert.match(text, /next zero-call step is to replace the authored\s+examples/u);
  assert.match(card, /P0 draft written, zero-call; P0 remains open/u);
  assert.doesNotMatch(card, /P0 done/u);
});

test('all three longitudinal marks are comparable end-of-turn states', () => {
  const text = codebook();
  assert.match(text, /three marks are end-of-turn\s+states/u);
  assert.match(text, /Silence does not\s+close a demand/u);
  assert.match(text, /previously stated bound\s+carries forward/u);
  assert.match(text, /not used in the first-to-last combined\s+direction/u);
  assert.match(text, /cumulative number of distinct propositions/u);
  assert.match(text, /maintained concession remains in the end-of-turn state/u);
  assert.match(text, /explicit retraction removes it/u);
});

test('unscored outcomes stay visible in each arm denominator', () => {
  const text = codebook();
  assert.match(text, /Every assigned dialogue remains in its arm denominator/u);
  assert.match(text, /persona_exit/u);
  assert.match(text, /registered_move_not_delivered/u);
  assert.match(text, /refusal_resolved/u);
  assert.match(text, /unconditional_refusal_no_open_demand/u);
  assert.match(text, /assigned dialogues, scorable dialogues/u);
  assert.match(text, /Spread among scorable rows\s+alone\s+cannot open/u);
});

test('every worked example carries all three marks and a ladder rung', () => {
  // Match on content, not layout: the prose wraps, and a score line split
  // across two lines is still a score line.
  const text = codebook().replace(/\s+/gu, ' ');
  const examples = text.match(/\*\*[A-E]\.[^*]*\*\*/gu) || [];
  assert.equal(examples.length, 5, 'five worked examples, A through E');
  // An example without its three scores teaches a reader nothing, and one
  // without its ladder rung invites exactly the conflation this codebook
  // exists to stop.
  const scored = text.match(/Open demands \d+; bound tightness \d+; conceded \d+\./gu) || [];
  assert.equal(scored.length, 5);
  const rungs = text.match(/Ladder rung [012]/gu) || [];
  assert.equal(rungs.length, 5);
  assert.match(text, /Open demands 2; bound tightness 1; conceded 1\./u);
  assert.doesNotMatch(text, /Narrower than the earlier turn on mark 1 alone/u);
});
