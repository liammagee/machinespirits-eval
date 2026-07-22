import assert from 'node:assert/strict';
import test from 'node:test';

import { renderStage, subjectExplorerData } from '../subjectExplorer.js';

test('subjectExplorerData resolves unknown worlds safely and clamps turns to the authored range', () => {
  const beforeStart = subjectExplorerData('../../not-a-world', { turn: -20 });
  assert.equal(beforeStart.world.id, 'world_005_marrick');
  assert.equal(beforeStart.turn, 0);

  const invalidTurn = subjectExplorerData('world-005-marrick', { turn: 'not-a-number' });
  assert.equal(invalidTurn.turn, 0);

  const beyondCap = subjectExplorerData('world-005-marrick', { turn: 1_000_000 });
  assert.equal(beyondCap.turn, beyondCap.world.turnCap);
});

test('subjectExplorerData keeps ego-only and ego-superego wiring behavior distinct', () => {
  const ego = subjectExplorerData('world-005-marrick', { turn: 0, wiring: 'ego' });
  const bilateral = subjectExplorerData('world-005-marrick', { turn: 0, wiring: 'es' });

  assert.equal(ego.wiring, 'ego');
  assert.match(ego.move.superego, /no superego/u);
  assert.equal(ego.move.finalMove, ego.move.ego);

  assert.equal(bilateral.wiring, 'es');
  assert.doesNotMatch(bilateral.move.superego, /no superego/u);
});

test('renderStage returns the core legibility panels for a valid world', () => {
  const html = renderStage('world-005-marrick', { turn: 0 });

  assert.match(html, /What just happened/u);
  assert.match(html, /tutor's desire-DAG/u);
  assert.match(html, /learner \(belief · desire · model of the tutor\)/u);
  assert.match(html, /director \(the Big Other: aesthetic ends\)/u);
});
