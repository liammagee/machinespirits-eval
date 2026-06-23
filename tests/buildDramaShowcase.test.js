import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseTranscript, buildExcerpt, mergePools } from '../scripts/build-drama-showcase.js';

const SAMPLE = `STAGE: A technical review room. A model audit lies on the table.

LEARNER: "The accuracy is 92%. I think we're ready for sign-off."

TUTOR: "I see 92% overall. What does the breakdown show—majority versus minority?"

LEARNER: "Majority 85%, minority 15%. But 92% is still strong."`;

test('parseTranscript splits STAGE from ordered role turns and strips speech quotes', () => {
  const { stage, turns } = parseTranscript(SAMPLE);
  assert.match(stage, /technical review room/i);
  assert.equal(turns.length, 3);
  assert.deepEqual(
    turns.map((t) => t.role),
    ['LEARNER', 'TUTOR', 'LEARNER'],
  );
  // surrounding double-quotes removed
  assert.ok(!turns[0].text.startsWith('"'));
  assert.match(turns[0].text, /ready for sign-off/);
});

test('parseTranscript tolerates lightly-marked markdown and unclassifiable lines', () => {
  const md = `**TUTOR:** Look again at the table.\n\nA stray continuation line.\n\n> LEARNER: I see it now.`;
  const { turns } = parseTranscript(md);
  assert.equal(turns.length, 2);
  assert.equal(turns[0].role, 'TUTOR');
  // the orphan paragraph is appended to the previous turn, never dropped
  assert.match(turns[0].text, /stray continuation/);
  assert.equal(turns[1].role, 'LEARNER');
});

test('buildExcerpt includes STAGE plus the requested number of turns, clipped', () => {
  const parsed = parseTranscript(SAMPLE);
  const ex = buildExcerpt(parsed, { turnsWanted: 2, perTurn: 30, stageMax: 40 });
  const lines = ex.split('\n');
  assert.equal(lines.length, 3); // STAGE + 2 turns
  assert.ok(lines[0].startsWith('STAGE: '));
  assert.ok(lines[1].startsWith('LEARNER: '));
  assert.ok(lines[2].startsWith('TUTOR: '));
  assert.ok(lines[1].length <= 'LEARNER: '.length + 30); // clipped
});

test('mergePools dedupes stably across ingest (itemId appearing must not duplicate)', () => {
  const prior = [
    // same drama, snapshotted BEFORE its run was ingested (no itemId yet)
    { runDir: 'exports/r', tid: 'T01', itemId: null, excerpt: 'OLD', composite: 0 },
    // a different drama whose source text is already gone — must be preserved
    { runDir: 'exports/r9', tid: 'T07', itemId: null, excerpt: 'keep-me', composite: 10 },
  ];
  // re-derived AFTER ingest: same runDir+tid, now carrying an itemId
  const fresh = [{ runDir: 'exports/r', tid: 'T01', itemId: 'r:u:default:T01', excerpt: 'NEW', composite: 80 }];
  const merged = mergePools(prior, fresh);
  assert.equal(merged.length, 2); // T01 collapses despite gaining an itemId; r9 survives
  const t01 = merged.find((e) => e.tid === 'T01');
  assert.equal(t01.excerpt, 'NEW'); // fresh re-derivation wins
  assert.equal(t01.itemId, 'r:u:default:T01'); // and it is the ingested copy
  assert.ok(merged.some((e) => e.excerpt === 'keep-me')); // durable snapshot survives
});
