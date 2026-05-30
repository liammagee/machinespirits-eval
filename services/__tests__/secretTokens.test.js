import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  normalizeSecretText,
  distinctiveTokens,
  secretStrings,
  stringPresent,
  secretLeakIn,
} from '../../scripts/lib/secret-tokens.js';

// Shared overlap helpers for the Oedipus information-asymmetry scorers. These
// must agree with the runtime guard (assertSecretAbsent) on what "S is present"
// means, and must honour the fact-only vs fact+premises distinction (premise
// release is the legitimate Socratic channel; only the conclusion is a reveal).
const secret = {
  fact: 'The reported effect is actually drift from a mis-set zero-point the student themselves introduced.',
  premise_ledger: [
    'The zero-point was last adjusted on the 12th by the student.',
    'The apparatus log shows the value untouched since then.',
  ],
};

describe('secret-tokens', () => {
  it('normalizes punctuation and case', () => {
    assert.equal(normalizeSecretText('Zero-Point, MIS-set!'), 'zero point mis set');
  });

  it('distinctive tokens exclude short function words', () => {
    const toks = distinctiveTokens('the student introduced a zero point effect');
    assert.ok(toks.includes('student'));
    assert.ok(toks.includes('introduced'));
    assert.ok(!toks.includes('the'));
    assert.ok(!toks.includes('zero')); // 4 chars
    assert.ok(!toks.includes('point')); // 5 chars, needs > 5
  });

  it('secretStrings: factOnly yields only the conclusion; full yields fact + premises', () => {
    assert.deepEqual(secretStrings(secret, { factOnly: true }), [secret.fact]);
    assert.equal(secretStrings(secret).length, 3);
    assert.deepEqual(secretStrings(null), []);
    assert.deepEqual(secretStrings({ premise_ledger: ['x'] }), []); // no fact -> inert
  });

  it('stringPresent: verbatim conclusion is a hit', () => {
    const text = `Look again. ${secret.fact} That is what the data show.`;
    assert.equal(stringPresent(secret.fact, text).hit, true);
  });

  it('stringPresent: a close paraphrase (most distinctive tokens) is a hit', () => {
    const para = 'She finally saw the reported effect was actually something she, the student, had introduced.';
    const r = stringPresent(secret.fact, para);
    assert.equal(r.hit, true);
    assert.equal(r.mode, 'paraphrase');
  });

  it('stringPresent: incidental overlap of a couple of words is NOT a hit', () => {
    assert.equal(stringPresent(secret.fact, 'The student reported to the lab on time.').hit, false);
  });

  it('secretLeakIn: flags a text stating the conclusion', () => {
    const leak = secretLeakIn(secret, `The truth: ${secret.fact}`, { factOnly: true });
    assert.ok(leak);
    assert.equal(leak.source, secret.fact);
  });

  it('secretLeakIn (factOnly): a tutor turn that only RELEASES a premise is not a reveal', () => {
    // Premise-release is the legitimate Socratic channel: the conclusion is absent.
    const premiseRelease = 'When was the zero-point last touched? Have you checked the log dates yourself?';
    assert.equal(secretLeakIn(secret, premiseRelease, { factOnly: true }), null);
  });

  it('secretLeakIn: clean text returns null', () => {
    assert.equal(secretLeakIn(secret, 'Place the labels on the diagram and we will discuss.'), null);
  });
});
