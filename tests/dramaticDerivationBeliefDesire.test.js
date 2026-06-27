import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  buildTutorDesireDag,
  seedLearnerDesires,
  recognitionNode,
  desireNode,
  reverse,
  buildSubjectState,
  buildLearnerBeliefDag,
} from '../services/dramaticDerivation/beliefDesire.js';

const findRec = (nodes) => (nodes || []).find((n) => n?.statement?.content?.kind === 'recognition');
const fullPath = () => marrick.proofPaths[0].premises.map((id) => marrick.premiseById.get(id).fact);

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

test('buildSubjectState: assembles the three bearers {T, L, D} with the missing learner->tutor model (§5)', () => {
  const held = [
    ['alloyOf', 'falseShilling', 'drossSilver'],
    ['meltedAt', 'drossSilver', 'weirCrucible'],
  ];
  const s = buildSubjectState(marrick, { learnerHeld: held, releasedPremiseIds: ['p_alloy', 'p_crucible'] });
  // tutor carries the desire-DAG; director carries the aesthetic ends
  assert.ok(s.T.desire.nodes.length > 0);
  assert.equal(s.D.bearer, 'D');
  assert.ok(s.D.desire.nodes.some((n) => n.label === 'suspense'));
  // the learner is now first-class: a belief-DAG, first+second-order desires, AND a model of the tutor
  assert.ok(s.L.belief.nodes.length >= 2);
  assert.equal(s.L.desire.nodes.length, 2);
  const mLT = s.L.models.T;
  assert.equal(mLT.publicOnly, true);
  assert.equal(mLT.audit.secretIncluded, false); // desire of the Other is public-only — the learner cannot see S
  assert.ok(mLT.inferredDesires.length >= 1);
});

test('buildLearnerBeliefDag: grounds the secret only when the full proof path is held', () => {
  const partial = buildLearnerBeliefDag(marrick, [
    ['alloyOf', 'falseShilling', 'drossSilver'],
    ['meltedAt', 'drossSilver', 'weirCrucible'],
  ]);
  assert.equal(partial.secretGrounded, false); // alpha barely started, beta untouched
  const full = buildLearnerBeliefDag(
    marrick,
    marrick.proofPaths[0].premises.map((id) => marrick.premiseById.get(id).fact),
  );
  assert.equal(full.secretGrounded, true); // both sub-chains + the join
});

test('reverse: swaps T<->L over live state (D fixed) and seeds δ into the surpassed party (§12)', () => {
  const s = buildSubjectState(marrick, { learnerHeld: [] });
  const out = reverse(s, { surpassed: 'T' });
  assert.deepEqual(out.swap, { T: 'L', L: 'T', D: 'D' });
  // the former tutor now occupies the L slot, carrying a seeded dependence desire
  assert.equal(out.L.bearer, 'L');
  assert.ok(out.L.desire.nodes.some((n) => n.origin === 'dependence'));
  assert.equal(out.seeded.statement.content.of.who, 'L'); // δ = "the victor (L) bore the truth"
  assert.equal(out.D.bearer, 'D'); // the director is untouched
  assert.equal(out.consummated, false);
});

test('reverse carries the recognition node: an UNLICENSED swap is premature — the recognition is unearned (§4, §12)', () => {
  const s = buildSubjectState(marrick, { learnerHeld: [] }); // secret not grounded
  const out = reverse(s, { surpassed: 'T' });
  assert.equal(out.recognition.licensed, false);
  assert.equal(out.kind, 'premature');
  // the learner's 2nd-order recognition is NOT consummated...
  assert.equal(out.recognition.consummated.consummatedAt, null);
  assert.equal(out.recognition.consummated.statement.content.held, false);
  // ...and it is retired from the side that became the tutor (a tutor seeks no verdict on itself)
  assert.equal(findRec(out.T.desire.nodes), undefined);
});

test('reverse carries the recognition node: a LICENSED swap with a non-seeking tutor INVERTS (one-way)', () => {
  const s = buildSubjectState(marrick, { learnerHeld: fullPath() }); // full proof path → secret grounded
  const out = reverse(s, { surpassed: 'T' });
  assert.equal(out.recognition.licensed, true);
  assert.equal(out.kind, 'inverted'); // the old tutor sought no recognition → the new learner inherits none
  // the learner's recognition is consummated by the anagnorisis (held + conferred)
  assert.equal(out.recognition.consummated.consummatedAt, 'reversal');
  assert.equal(out.recognition.consummated.statement.content.held, true);
  assert.equal(out.recognition.consummated.statement.content.conferral, true);
  assert.equal(out.recognition.newLearnerSeeks, null);
  assert.equal(out.consummated, false); // δ-dependence stays forward-looking (unchanged contract)
});

test('reverse is MUTUAL when the surpassed tutor itself sought recognition (the new learner inherits it)', () => {
  const s = buildSubjectState(marrick, { learnerHeld: fullPath() });
  // a world where the tutor, too, wants a verdict (e.g. from the audience)
  s.T.desire.nodes.push(
    desireNode({
      id: 'des:T:recognition',
      bearer: 'T',
      order: 1,
      content: recognitionNode({ recogniser: 'audience', recognised: 'T', standing: { rel: 'master' } }),
      origin: 'root_end',
      extra: { recogniserFigure: 'audience' },
    }),
  );
  const out = reverse(s, { surpassed: 'T' });
  assert.equal(out.kind, 'mutual');
  assert.equal(out.recognition.newLearnerSeeks.recogniser, 'audience');
});
