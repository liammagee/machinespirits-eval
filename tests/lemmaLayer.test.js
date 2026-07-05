/**
 * Lemma-layer pure-module guarantees (LEMMA-LAYER-PREREGISTRATION.md),
 * pinned against world-005-marrick's hand-known structure: two independent
 * depth-2 sub-chains (alpha: blankFrom -> castBlankFor; beta: dieCutWith ->
 * cutDieFor) meeting at one AND-join (struckBy). Engine-integration
 * guarantees live in scripts/derivation-lemma-gates.js.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  normalizeLemmaConfig,
  buildLemmaDag,
  computeLemmaState,
  supportRemaining,
  classifyRelease,
  renderTutorLemmaLines,
  renderLearnerLemmaLines,
} from '../services/dramaticDerivation/lemmaLayer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
const dag = buildLemmaDag(world);
const factOf = (id) => world.premises.find((p) => p.id === id).fact;
const board = (...ids) => [...world.background, ...ids.map(factOf)];
const nodeByPred = (pred) => dag.nodes.find((n) => n.fact[0] === pred);

test('config: bind implies display; off-shapes normalize to null', () => {
  assert.equal(normalizeLemmaConfig(null), null);
  assert.equal(normalizeLemmaConfig({ display: false }), null);
  assert.deepEqual(normalizeLemmaConfig({ display: true }), {
    display: true,
    bind: false,
    mockUntagged: false,
    mockBadChoice: false,
    mockRefusal: false,
  });
  assert.deepEqual(normalizeLemmaConfig('{"bind":true}'), {
    display: true,
    bind: true,
    mockUntagged: false,
    mockBadChoice: false,
    mockRefusal: false,
  });
});

test('marrick lemma DAG: 4 intermediates + goal, the authored AND-join', () => {
  assert.equal(dag.nodes.length, 5);
  const goal = dag.nodes.find((n) => n.isGoal);
  assert.equal(goal.fact[0], 'struckBy');
  assert.equal(goal.parents.length, 2); // castBlankFor + cutDieFor
  assert.deepEqual(nodeByPred('blankFrom').support, ['p_alloy', 'p_crucible']);
  assert.deepEqual(nodeByPred('castBlankFor').support, ['p_alloy', 'p_caster', 'p_crucible']);
  assert.equal(dag.proofPremiseIds.size, 6); // p_* only
  assert.ok(!dag.proofPremiseIds.has('m_caster'), 'mirror fuel feeds no lemma');
});

test('clearance is criterial and regresses when the board shrinks', () => {
  const empty = computeLemmaState(dag, board(), world.rules);
  assert.equal(empty.groundedKeys.size, 0);
  assert.deepEqual(
    empty.frontier.map((k) => dag.byKey.get(k).fact[0]).sort(),
    ['blankFrom', 'dieCutWith'],
    'frontier opens on both chain roots (width 2)',
  );
  const alpha = computeLemmaState(dag, board('p_alloy', 'p_crucible', 'p_caster'), world.rules);
  assert.ok(alpha.groundedKeys.has(nodeByPred('castBlankFor').key), 'alpha chain grounds');
  assert.deepEqual(
    alpha.frontier.map((k) => dag.byKey.get(k).fact[0]),
    ['dieCutWith'],
    'frontier advances to the untouched chain',
  );
  const all = computeLemmaState(dag, board(...dag.nodes.find((n) => n.isGoal).support), world.rules);
  assert.ok(all.goalGrounded, 'full path grounds the goal');
  // regression: drop one alpha premise from the full board (decay analogue)
  const regressed = computeLemmaState(dag, board('p_alloy', 'p_caster', 'p_flaw', 'p_graver', 'p_holder'), world.rules);
  assert.ok(!regressed.groundedKeys.has(nodeByPred('blankFrom').key), 'lemma un-grounds without its support');
  assert.ok(!regressed.goalGrounded);
});

test('release classification: exempt colour, in-support, out-of-support', () => {
  const blankFrom = nodeByPred('blankFrom').key;
  assert.equal(classifyRelease(dag, blankFrom, 'm_caster'), 'exempt');
  assert.equal(classifyRelease(dag, blankFrom, 'p_crucible'), 'in_support');
  assert.equal(classifyRelease(dag, blankFrom, 'p_flaw'), 'out_of_support');
  assert.equal(classifyRelease(dag, null, 'p_flaw'), 'out_of_support', 'no active lemma binds proof exhibits');
  assert.deepEqual(supportRemaining(dag, blankFrom, new Set(['p_alloy'])), ['p_crucible']);
});

test('learner mirror conceals every ungrounded token; tutor map names all', () => {
  const empty = computeLemmaState(dag, board(), world.rules);
  const mirror = renderLearnerLemmaLines(dag, empty).join('\n');
  for (const token of ['weirCrucible', 'wornBurin', 'edony', 'blankFrom', 'dieCutWith']) {
    assert.ok(!mirror.includes(token), `learner mirror must not leak ${token}`);
  }
  assert.ok(mirror.includes('4 intermediate links remain'), mirror);
  const alpha = computeLemmaState(dag, board('p_alloy', 'p_crucible', 'p_caster'), world.rules);
  const alphaMirror = renderLearnerLemmaLines(dag, alpha).join('\n');
  assert.ok(alphaMirror.includes('blankFrom'), 'grounded lemmas appear by name');
  assert.ok(!alphaMirror.includes('wornBurin'), 'the other chain stays concealed');
  const tutorMap = renderTutorLemmaLines(dag, empty, nodeByPred('blankFrom').key, { bind: true }).join('\n');
  assert.ok(tutorMap.includes('<< ACTIVE'));
  assert.ok(tutorMap.includes('lemma_departure'));
});
