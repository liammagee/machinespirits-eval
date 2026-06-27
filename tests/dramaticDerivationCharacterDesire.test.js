import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import { buildSubjectState } from '../services/dramaticDerivation/beliefDesire.js';
import { compileLearnerDesire, renderMotivationLines } from '../services/dramaticDerivation/characterDesire.js';

const marrick = loadWorld(fileURLToPath(new URL('../config/drama-derivation/world-005-marrick.yaml', import.meta.url)));

test('world carries the authored motivation block (validateWorld passes it through)', () => {
  assert.ok(marrick.motivation, 'world.motivation should be present');
  assert.equal(marrick.motivation.learner.first_order.opens_on, 'verrell');
});

test('compileLearnerDesire: the learner first-order desire opens MIRROR-bound, with second-order recognition', () => {
  const cd = compileLearnerDesire(marrick);
  const first = cd.nodes.find((n) => n.id === 'des:L:first');
  assert.equal(first.statement.order, 0);
  assert.equal(first.statement.content.rel, 'grounded_L');
  // opens on the town's verdict (the mirror), not the truth — the de re filler (§9)
  assert.equal(first.slot.binding, 'verrell');

  const rec = cd.nodes.find((n) => n.id === 'des:L:recognition');
  assert.equal(rec.statement.order, 1);
  assert.equal(rec.statement.content.kind, 'recognition');
  assert.equal(rec.recogniserFigure, 'warden');
  assert.equal(rec.statement.content.authority.mode, 'rational_legal'); // the assay's authority (Weber)

  // dispositions captured from the prose
  assert.deepEqual(cd.dynamics, { mirrorPull: 'high', overreach: 'high', arc: 'softens' });
});

test('buildSubjectState consumes the compiled motivation — the seeded learner desire opens mirror-bound', () => {
  const cd = compileLearnerDesire(marrick);
  const s = buildSubjectState(marrick, { learnerHeld: [], learnerDesireNodes: cd.nodes });
  const first = s.L.desire.nodes.find((n) => n.id === 'des:L:first');
  assert.equal(first.slot.binding, 'verrell');
  assert.equal(s.L.desire.nodes.length, 2);
  // and without the injection, it falls back to the generic proof-pattern seed (open slot)
  const generic = buildSubjectState(marrick, { learnerHeld: [] });
  assert.equal(generic.L.desire.nodes.find((n) => n.id === 'des:L:first').slot.binding, null);
});

test('renderMotivationLines: the prompt rendering round-trips the learner_voice with nothing left over', () => {
  const text = renderMotivationLines(marrick, 'learner').join(' ').toLowerCase();
  assert.match(text, /verrell/); // first-order opens on the mirror (the town's verdict)
  assert.match(text, /warden/); // the recogniser
  assert.match(text, /find you right/); // the standing sought (second-order)
  assert.match(text, /before the evidence forces it/); // overreach disposition
  assert.match(text, /learning to let the evidence/); // arc: softens
});
