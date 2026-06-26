import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  buildTutorDesireDag,
  seedLearnerDesires,
  recognitionNode,
  reverse,
} from '../services/dramaticDerivation/beliefDesire.js';

const marrick = loadWorld(fileURLToPath(new URL('../config/drama-derivation/world-005-marrick.yaml', import.meta.url)));

test('buildTutorDesireDag: pacing = practical inference — leaves are exactly the proof-path premises (move #3)', () => {
  const dag = buildTutorDesireDag(marrick);
  assert.equal(dag.derivable, true);
  // the desire-DAG's leaves are precisely the releases the tutor must bring about
  assert.deepEqual(dag.leaves, ['p_alloy', 'p_caster', 'p_crucible', 'p_flaw', 'p_graver', 'p_holder']);
  // it matches the authored proof path (no spare premises)
  assert.deepEqual([...dag.leaves].sort(), [...marrick.proofPaths[0].premises].sort());
  // the root is the tutor's end: Des_T(grounded_L(S))
  const root = dag.nodes.find((n) => n.id === dag.root);
  assert.equal(root.origin, 'root_end');
  assert.equal(root.statement.bearer, 'T');
  assert.equal(root.statement.content.rel, 'grounded_L');
  // every edge is a practical (means–end) edge
  assert.ok(dag.edges.length > 0);
  assert.ok(dag.edges.every((e) => e.kind === 'practical'));
});

test('seedLearnerDesires: first-order is de dicto (the answer-slot); second-order is recognition (order 1)', () => {
  const { firstOrder, secondOrder } = seedLearnerDesires(marrick);
  // first-order: ∃x. Q(x), an open slot not yet bound to any filler
  assert.equal(firstOrder.statement.order, 0);
  assert.ok(firstOrder.slot);
  assert.equal(firstOrder.slot.var, '?x');
  assert.equal(firstOrder.slot.binding, null);
  // second-order: a desire whose content is a recognition attitude
  assert.equal(secondOrder.statement.order, 1);
  assert.equal(secondOrder.statement.content.kind, 'recognition');
  assert.equal(secondOrder.statement.content.recogniser, 'T');
  assert.equal(secondOrder.statement.content.recognised, 'L');
});

test('recognitionNode decomposes into belief + conferral + authority (Weber-weighted)', () => {
  const rec = recognitionNode({ recogniser: 'T', recognised: 'L', standing: { rel: 'derived' } });
  assert.equal(rec.kind, 'recognition');
  assert.equal(rec.conferral, false);
  assert.equal(rec.held, false);
  assert.equal(rec.authority.authorizer, 'D'); // borrowed from the Big Other (§11a)
  assert.equal(rec.authority.mode, 'rational_legal');
  assert.throws(() => recognitionNode({ recogniser: 'T', recognised: 'L', standing: {}, mode: 'bogus' }));
});

test('reverse: swaps T<->L (D fixed) and seeds the dependence proposition on the surpassed party (§12)', () => {
  const out = reverse({ T: 'tutorState', L: 'learnerState', D: 'directorState' }, { surpassed: 'T' });
  // index swap, D untouched
  assert.deepEqual(out.swap, { T: 'L', L: 'T', D: 'D' });
  assert.deepEqual(out.states, { T: 'learnerState', L: 'tutorState', D: 'directorState' });
  // the content-transformation: the surpassed party (former T, now at L) must ground its dependence
  assert.equal(out.seeded.origin, 'dependence');
  assert.equal(out.seeded.statement.bearer, 'L');
  assert.equal(out.seeded.statement.content.of.who, 'L'); // δ = "the victor (L) bore the truth"
  // necessary, not sufficient
  assert.equal(out.consummated, false);
});
