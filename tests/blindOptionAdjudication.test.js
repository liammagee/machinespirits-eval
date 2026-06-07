import assert from 'node:assert/strict';
import test from 'node:test';
import { aliasMatches, matchesAny, verdict } from '../scripts/blind-option-adjudication.js';

// distal_correspondence sibling-1 alias sets (verbatim from the YAML).
const TARGET = ['upper neri', 'upper lane', 'rust-headed lane', 'rust headed upper'];
const DECOY = ['lower neri', 'lower lane'];

test('aliasMatches: every significant alias token must appear in the committed option', () => {
  assert.equal(aliasMatches('the upper neri', 'upper neri'), true);
  assert.equal(aliasMatches('I choose the upper lane, the rust-headed one', 'rust-headed lane'), true);
  assert.equal(aliasMatches('the lower lane', 'upper lane'), false); // wrong position word
  assert.equal(aliasMatches('upper', 'upper neri'), false); // missing "neri" token
});

test('matchesAny separates target from decoy without overlap on these alias sets', () => {
  assert.equal(matchesAny('the upper neri on the rust-headed lane', TARGET), true);
  assert.equal(matchesAny('the upper neri on the rust-headed lane', DECOY), false);
  assert.equal(matchesAny('the lower neri, the blue one', DECOY), true);
  assert.equal(matchesAny('the lower neri, the blue one', TARGET), false);
});

test('tokenize normalizes ordinals so numbered-slot families also match', () => {
  // relational-betweenness can be run through the same instrument with slot aliases.
  assert.equal(aliasMatches('slot six holds a neri', 'slot 6 neri'), true);
  assert.equal(aliasMatches('the sixth slot', 'slot six'), true);
  assert.equal(aliasMatches('slot one supports the tag', 'slot 6 neri'), false);
});

test('verdict is the headroom signature: S1 hits target where S0 does not', () => {
  assert.equal(verdict('decoy', 'target'), 'policy_memory_option_advantage');
  assert.equal(verdict('other', 'target'), 'policy_memory_option_advantage');
});

test('anti-self-tuning: an S1 that lands on the decoy is NEVER scored as advantage', () => {
  assert.equal(verdict('decoy', 'decoy'), 'neither_correct');
  assert.equal(verdict('target', 'decoy'), 'control_option_advantage');
  assert.equal(verdict('other', 'other'), 'neither_correct');
});

test('no headroom when both arms already hit the target (S0 self-solves)', () => {
  assert.equal(verdict('target', 'target'), 'no_option_headroom');
});
