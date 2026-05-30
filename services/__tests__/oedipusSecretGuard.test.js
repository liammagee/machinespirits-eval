import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildSecretContext, assertSecretAbsent } from '../learnerTutorInteractionEngine.js';

// Oedipus / guided-discovery information-asymmetry guard. A per-scenario `secret`
// (withheld fact S + premise ledger) is visible to the director/tutor and must
// never reach the learner's SYSTEM PROMPT. These cover the runtime belt-and-
// suspenders net that backstops the structural isolation in buildDirectorContext.
const secret = {
  fact: 'The shepherd who saved the infant is the same messenger now at the gate.',
  premise_ledger: [
    'The infant was given to a Corinthian herdsman on Mount Cithaeron.',
    'The herdsman and the palace messenger are one person.',
  ],
};

describe('Oedipus secret guard', () => {
  describe('assertSecretAbsent', () => {
    it('is inert when no secret is set (existing scenarios unaffected)', () => {
      assert.doesNotThrow(() => assertSecretAbsent(null, 'any learner prompt'));
      assert.doesNotThrow(() => assertSecretAbsent({}, 'any learner prompt'));
      assert.doesNotThrow(() => assertSecretAbsent(undefined, 'any learner prompt'));
    });

    it('passes when the learner system prompt does not contain the secret', () => {
      const learnerPrompt = 'You are a returning student. Place the labels on the diagram. The tutor will guide you.';
      assert.doesNotThrow(() => assertSecretAbsent(secret, learnerPrompt, 'test'));
    });

    it('throws when the secret fact leaks verbatim', () => {
      const leaked = `Scene constraints. ${secret.fact} Now produce your reaction.`;
      assert.throws(() => assertSecretAbsent(secret, leaked, 'test'), /SECRET LEAK.*verbatim/);
    });

    it('throws when a premise leaks verbatim', () => {
      const leaked = `Background you somehow received: ${secret.premise_ledger[0]}`;
      assert.throws(() => assertSecretAbsent(secret, leaked, 'test'), /SECRET LEAK/);
    });

    it('throws on a paraphrase reusing most distinctive premise tokens', () => {
      const para = 'A Corinthian herdsman once received the infant, up on Cithaeron.';
      assert.throws(() => assertSecretAbsent(secret, para, 'test'), /SECRET LEAK/);
    });

    it('does NOT throw on incidental overlap of a couple of common words', () => {
      const benign = 'The student saved their work and a messenger arrived at the door.';
      assert.doesNotThrow(() => assertSecretAbsent(secret, benign, 'test'));
    });
  });

  describe('buildSecretContext', () => {
    it('returns empty string when no secret (inert)', () => {
      assert.equal(buildSecretContext(null), '');
      assert.equal(buildSecretContext({}), '');
      assert.equal(buildSecretContext({ premise_ledger: ['x'] }), ''); // no fact → inert
    });

    it('always exposes S + premises to the tutor, and switches instruction by arm', () => {
      for (const policy of ['socratic_discovery', 'reveal_secret', 'none']) {
        const ctx = buildSecretContext(secret, policy);
        assert.match(ctx, /DRAMATIC IRONY/);
        assert.ok(ctx.includes(secret.fact));
        assert.ok(ctx.includes(secret.premise_ledger[0]));
        assert.ok(ctx.includes(secret.premise_ledger[1]));
      }
      assert.match(buildSecretContext(secret, 'socratic_discovery'), /Never state S outright/);
      assert.match(buildSecretContext(secret, 'reveal_secret'), /state S to the learner plainly/);
      assert.match(buildSecretContext(secret, 'none'), /must NOT lead the learner toward it/);
    });
  });
});
