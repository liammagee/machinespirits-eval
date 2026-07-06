import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { buildLemmaDag } from '../services/dramaticDerivation/lemmaLayer.js';
import {
  buildChainMap,
  buildRegionLexicons,
  classifyMessage,
} from '../services/dramaticDerivation/messageClassifier.js';
import {
  decideRegister,
  normalizeRegisterRouterConfig,
  REGISTER_BLOCKS,
} from '../services/dramaticDerivation/registerRouter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
const dag = buildLemmaDag(world);
const chainOf = buildChainMap(dag);
const lexicons = buildRegionLexicons(world, dag);
const nonGoal = dag.nodes.filter((n) => !n.isGoal);

test('rule: confront requires mirror label AND derivable partner', () => {
  const chains = new Set([chainOf.get(nonGoal[0].key)]);
  assert.equal(
    decideRegister({ label: 'mirror', partnerDerivable: true, regressedChains: chains, chainOf }),
    'confront',
  );
  assert.equal(
    decideRegister({ label: 'mirror', partnerDerivable: false, regressedChains: chains, chainOf }),
    'didactic',
  );
});

test('rule: repair requires a chain label whose chain regressed', () => {
  const node = nonGoal[0];
  const itsChain = chainOf.get(node.key);
  assert.equal(
    decideRegister({ label: node.key, partnerDerivable: false, regressedChains: new Set([itsChain]), chainOf }),
    'repair',
  );
  assert.equal(
    decideRegister({ label: node.key, partnerDerivable: false, regressedChains: new Set(['other']), chainOf }),
    'didactic',
  );
  assert.equal(
    decideRegister({ label: 'neither', partnerDerivable: true, regressedChains: new Set([itsChain]), chainOf }),
    'didactic',
  );
});

test('rule: confront outranks repair when both hold', () => {
  const chains = new Set(nonGoal.map((n) => chainOf.get(n.key)));
  assert.equal(
    decideRegister({ label: 'mirror', partnerDerivable: true, regressedChains: chains, chainOf }),
    'confront',
  );
});

test('chain map: marrick has two chains under the goal', () => {
  const roots = new Set(nonGoal.map((n) => chainOf.get(n.key)));
  assert.equal(roots.size, 2);
  assert.equal(chainOf.get(dag.nodes.find((n) => n.isGoal).key), 'goal');
});

test('classifier: goal excluded, mirror residual, neither on phatic', () => {
  assert.equal(classifyMessage('I see. That part is clear.', lexicons, 'verrell').label, 'neither');
  assert.equal(
    classifyMessage('Then it was Verrell all along, as the town says.', lexicons, 'verrell').label,
    'mirror',
  );
  // chain vocabulary beats bare mirror mention (lemma-first)
  const dieLine = classifyMessage(
    'The notch in the serif — the die was cut with the worn burin, whatever Verrell claims.',
    lexicons,
    'verrell',
  );
  assert.notEqual(dieLine.label, 'mirror');
  assert.notEqual(dieLine.label, 'neither');
});

test('config: knobs normalize; blocks content-free', () => {
  assert.equal(normalizeRegisterRouterConfig(null), null);
  assert.deepEqual(normalizeRegisterRouterConfig(true), { mockLabel: null, mockDagState: false });
  assert.equal(normalizeRegisterRouterConfig({ mockLabel: 'mirror', mockDagState: true }).mockLabel, 'mirror');
  // stance blocks must name no entity, premise, or conclusion
  const concealed = ['verrell', 'edony', 'weirCrucible', 'wornBurin', 'notchedSerif', 'drossSilver', 'struckBy'];
  for (const block of [REGISTER_BLOCKS.repair, REGISTER_BLOCKS.confront]) {
    for (const tok of concealed) assert.ok(!block.toLowerCase().includes(tok.toLowerCase()), `${tok} leaked`);
  }
});
