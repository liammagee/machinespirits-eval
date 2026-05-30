import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildSecretContext, assertSecretAbsent, buildLearnerPrompt } from '../learnerTutorInteractionEngine.js';

// Oedipus / guided-discovery information-asymmetry guard. A per-scenario `secret`
// (withheld fact S + premise ledger) is visible to the director/tutor and must
// never reach the learner's SYSTEM PROMPT. These cover the runtime belt-and-
// suspenders net that backstops the structural isolation in buildDirectorContext.
const secret = {
  fact: 'The messenger waiting at the gate is the very shepherd who rescued the abandoned infant on the mountain.',
  premise_ledger: [
    'The infant was given to a Corinthian herdsman on Mount Cithaeron.',
    'The palace messenger and that herdsman are one and the same person.',
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

    it('throws on a paraphrase of the FACT (the conclusion must never reach the learner)', () => {
      const para =
        "The gate's messenger turns out to be the shepherd who long ago rescued that abandoned infant from the mountain.";
      assert.throws(() => assertSecretAbsent(secret, para, 'test'), /SECRET LEAK/);
    });

    it('does NOT throw on a PREMISE paraphrase (domain evidence; only verbatim premises leak)', () => {
      // Premises are the tutor's to meter; their distinctive tokens legitimately
      // recur in the K_L scene, so a premise paraphrase is not a conclusion leak.
      const para = 'A Corinthian herdsman once received the infant, up on Cithaeron.';
      assert.doesNotThrow(() => assertSecretAbsent(secret, para, 'test'));
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

  // Regression: buildLearnerPrompt scopes the guard to ARCHITECTURAL context. On
  // response turns the additionalContext embeds the running dialogue, where the
  // tutor's legitimately-spoken premise clues (the Socratic channel) must NOT trip
  // a generation-time crash. The static role + persona are always guarded; turn-0
  // scene context is guarded; the dialogue is not.
  describe('buildLearnerPrompt guard scoping', () => {
    const cleanRole = { prompt: 'You are a focused, confident learner. Respond to your tutor.' };
    const persona = { prompt_modifier: 'You speak plainly.' };

    it('throws when S is routed into the static learner role, even with guardContext=false', () => {
      const leakyRole = { prompt: `You are a learner. ${secret.fact}` };
      assert.throws(
        () => buildLearnerPrompt(leakyRole, persona, 'Recent conversation: ...', secret, { guardContext: false }),
        /SECRET LEAK/,
      );
    });

    it('guards architectural additionalContext on turn 0 (guardContext defaults true)', () => {
      assert.throws(() => buildLearnerPrompt(cleanRole, persona, `Scene. ${secret.fact}`, secret), /SECRET LEAK/);
    });

    it('does NOT trip on a tutor-spoken premise clue echoed in the response-turn dialogue', () => {
      const dialogue = `Recent conversation:\nTUTOR: "${secret.premise_ledger[0]}"\n\nThe tutor just said:\n"And what follows?"`;
      assert.doesNotThrow(() => buildLearnerPrompt(cleanRole, persona, dialogue, secret, { guardContext: false }));
    });

    it('is inert with no secret regardless of scope', () => {
      assert.doesNotThrow(() =>
        buildLearnerPrompt(cleanRole, persona, 'anything at all', null, { guardContext: false }),
      );
      assert.doesNotThrow(() => buildLearnerPrompt(cleanRole, persona, 'anything at all', null));
    });
  });
});
