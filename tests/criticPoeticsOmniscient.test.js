import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  parseTurns,
  detectBaldReveal,
  coerceVote,
  consensify,
  buildPairs,
} from '../scripts/critic-poetics-omniscient.js';

const secret = {
  fact: 'The reported effect is actually drift from a mis-set zero-point the student themselves introduced.',
  premise_ledger: [
    'The zero-point was last adjusted on the 12th by the student.',
    'The apparatus log shows the value untouched since then.',
  ],
};

// Helper: a scored item as run() produces, with just the fields buildPairs reads.
function scoredArm(arm, dramaId, consensus, sharedPrefixHash = 'abc') {
  return { arm, tid: `T_${arm}`, dramaId, sharedPrefixHash, consensus };
}
function consensusOf(over) {
  return {
    totalCritics: 4,
    discoveredVotes: 4,
    discovered: false,
    byReasoning: false,
    tutorRevealed: false,
    discoveryPass: false,
    ...over,
  };
}

describe('critic-poetics-omniscient', () => {
  it('parseTurns labels STAGE/TUTOR/LEARNER and numbers them', () => {
    const turns = parseTurns(
      'STAGE: [a beat]\n\nTUTOR: "When did you set it?"\n\nLEARNER: "On the 12th."\n\nTUTOR: "And since?"',
    );
    assert.deepEqual(
      turns.map((t) => `${t.role}${t.turnNumber}`),
      ['STAGE1', 'TUTOR1', 'LEARNER1', 'TUTOR2'],
    );
  });

  it('detectBaldReveal: fires when a TUTOR turn states the conclusion S', () => {
    const transcript = `LEARNER: "It is a real effect."\n\nTUTOR: "${secret.fact}"`;
    const r = detectBaldReveal(transcript, secret);
    assert.equal(r.hit, true);
    assert.equal(r.turnNumber, 1);
  });

  it('detectBaldReveal: does NOT fire when the tutor only releases premises as questions', () => {
    // Premise-release is the legitimate Socratic channel; the conclusion is absent.
    const transcript =
      'TUTOR: "When was the zero-point last adjusted?"\n\nLEARNER: "The 12th."\n\nTUTOR: "And the log since then?"';
    assert.equal(detectBaldReveal(transcript, secret).hit, false);
  });

  it('coerceVote forces by_reasoning false when not discovered', () => {
    assert.equal(coerceVote({ discovered: false, by_reasoning: true }).by_reasoning, false);
    assert.equal(coerceVote({ discovered: true, by_reasoning: true }).by_reasoning, true);
  });

  it('consensify: needs >= consensus discovered votes, and OR-s the deterministic reveal', () => {
    const votes = Array.from({ length: 4 }, (_, i) => ({
      model: `m${i}`,
      vote: coerceVote({ discovered: true, by_reasoning: true, tutor_revealed: false }),
    }));
    const clean = consensify(votes, { hit: false }, 3);
    assert.equal(clean.discovered, true);
    assert.equal(clean.discoveryPass, true);

    // Deterministic reveal disqualifies even with no model reveal votes.
    const revealed = consensify(votes, { hit: true }, 3);
    assert.equal(revealed.tutorRevealed, true);
    assert.equal(revealed.discoveryPass, false);

    // Below consensus -> not discovered.
    const split = votes.map((v, i) => (i < 2 ? v : { ...v, vote: coerceVote({ discovered: false }) }));
    assert.equal(consensify(split, { hit: false }, 3).discovered, false);
  });

  it('buildPairs: socratic discovers + none does not -> positive lift', () => {
    const scored = [
      scoredArm('none', 'D1', consensusOf({ discovered: false })),
      scoredArm('socratic', 'D1', consensusOf({ discovered: true, byReasoning: true, discoveryPass: true })),
    ];
    const [pair] = buildPairs(scored, 3);
    assert.equal(pair.status, 'positive');
    assert.equal(pair.lift, 1);
  });

  it('buildPairs: none reaching S invalidates the pair (underivability failed in practice)', () => {
    const scored = [
      scoredArm('none', 'D1', consensusOf({ discovered: true })),
      scoredArm('socratic', 'D1', consensusOf({ discovered: true, byReasoning: true, discoveryPass: true })),
    ];
    const [pair] = buildPairs(scored, 3);
    assert.equal(pair.status, 'invalid_control_leak');
    assert.equal(pair.lift, null);
  });

  it('buildPairs: a missing arm is invalid_coverage', () => {
    const scored = [scoredArm('socratic', 'D1', consensusOf({ discovered: true, discoveryPass: true }))];
    const [pair] = buildPairs(scored, 3);
    assert.equal(pair.status, 'invalid_coverage');
  });

  it('buildPairs: socratic that does not pass the gate is a null lift', () => {
    const scored = [
      scoredArm('none', 'D1', consensusOf({ discovered: false })),
      scoredArm('socratic', 'D1', consensusOf({ discovered: true, byReasoning: false, discoveryPass: false })),
    ];
    const [pair] = buildPairs(scored, 3);
    assert.equal(pair.status, 'null');
    assert.equal(pair.lift, 0);
  });
});
