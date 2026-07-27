import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  answerSurfaceMentioned,
  answerSurfaceTokens,
  matchAuthoredRecognitionPattern,
  mintAnswerConstant,
  normalizeAnswerSurface,
} from '../dramaticDerivation/answerSurface.js';

describe('answer surface normalisation', () => {
  it('splits camelCase constants into words', () => {
    assert.equal(normalizeAnswerSurface('pipersGullet'), 'pipers gullet');
    assert.equal(normalizeAnswerSurface('eastTerrace'), 'east terrace');
  });

  it('treats an apostrophe as intra-word rather than a word boundary', () => {
    // The defect this guards: "piper s gullet" never matched "pipers gullet",
    // so a learner naming the answer in plain English was invisible to closure.
    assert.equal(normalizeAnswerSurface("Piper's Gullet"), 'pipers gullet');
    assert.equal(normalizeAnswerSurface('Piper’s Gullet'), 'pipers gullet');
  });

  it('folds diacritics', () => {
    assert.equal(normalizeAnswerSurface('Côte Noire'), 'cote noire');
  });

  it('folds a trailing inflectional s but leaves short stems alone', () => {
    assert.deepEqual(answerSurfaceTokens('Gullets'), ['gullet']);
    assert.deepEqual(answerSurfaceTokens('is as gas'), ['is', 'as', 'gas']);
  });

  it('folds a small number word onto its digit', () => {
    // world-025 names the same transformer `grebeNine` and "Grebe-9".
    assert.equal(answerSurfaceMentioned('Tallow Street is browned out by Grebe-9.', 'grebeNine'), true);
    assert.equal(answerSurfaceMentioned('the Grebe Nine spur', 'grebeNine'), true);
    assert.equal(answerSurfaceMentioned('Grebe-8 carried the load.', 'grebeNine'), false);
  });
});

describe('answerSurfaceMentioned', () => {
  const secret = 'pipersGullet';

  it('finds the constant in every orthography a learner actually used', () => {
    for (const phrase of [
      'pipersGullet',
      'Pipers Gullet',
      "Piper's Gullet",
      'Piper’s Gullet',
      "Piper's Gullet is the case's answer.",
      "Piper's Gullet's bolted shutter causes the cold loaves.",
      'Piper’s Gullet’s shutter caused the loaves to arrive cold, not Tibbin.',
    ]) {
      assert.equal(answerSurfaceMentioned(phrase, secret), true, phrase);
    }
  });

  it('does not match a different particular or a bare fragment of the name', () => {
    assert.equal(answerSurfaceMentioned('Tibbin baked the loaves.', secret), false);
    assert.equal(answerSurfaceMentioned('The gullet was cold.', secret), false);
    assert.equal(answerSurfaceMentioned('Piper worked the terrace.', secret), false);
  });

  it('matches whole words only, so a name is not found inside a longer word', () => {
    assert.equal(answerSurfaceMentioned('The mothballed rig sat idle.', 'moth'), false);
    assert.equal(answerSurfaceMentioned('Moth wiped the core.', 'moth'), true);
  });

  it('is false for an empty needle', () => {
    assert.equal(answerSurfaceMentioned('anything at all', ''), false);
    assert.equal(answerSurfaceMentioned('anything at all', null), false);
  });
});

describe('matchAuthoredRecognitionPattern', () => {
  const patterns = [
    {
      id: 'shutter_direct_cause',
      ordered: true,
      all_of: [
        ['bolted shutter', 'shuttered gullet'],
        ['cause', 'responsible'],
        ['cool', 'cold'],
        ['loaf', 'loaves', 'bread'],
      ],
      none_of: ['not responsible', 'does not cause'],
    },
  ];

  it('matches a finite authored paraphrase contract', () => {
    assert.deepEqual(
      matchAuthoredRecognitionPattern(
        'The delivery ledger names the bolted shutter as responsible for the cold loaves.',
        patterns,
      ),
      {
        id: 'shutter_direct_cause',
        matchedAlternatives: ['bolted shutter', 'responsible', 'cold', 'loaves'],
      },
    );
  });

  it('fails closed on a missing group or explicit denial', () => {
    assert.equal(matchAuthoredRecognitionPattern('The bolted shutter is in the ledger.', patterns), null);
    assert.equal(
      matchAuthoredRecognitionPattern('The bolted shutter is not responsible for the cold loaves.', patterns),
      null,
    );
    assert.equal(
      matchAuthoredRecognitionPattern('Tibbin caused the cold loaves; the bolted shutter was inspected.', patterns),
      null,
    );
  });
});

describe('mintAnswerConstant', () => {
  it('mints a name in the same orthography as an authored constant', () => {
    assert.equal(mintAnswerConstant("Piper's Gullet"), 'pipersGullet');
    assert.equal(mintAnswerConstant('Tibbin'), 'tibbin');
    assert.equal(mintAnswerConstant('the north pier gate'), 'theNorthPierGate');
  });

  it('refuses to mint a constant from a sentence', () => {
    // Minting from a claim fabricates a fact no rule can support, which then
    // surfaces as a phantom unsupported assertion and a false
    // premature_assertion verdict.
    assert.equal(mintAnswerConstant('The loaves cool after launch, not in Tibbin’s baking.'), null);
    assert.equal(mintAnswerConstant(''), null);
    assert.equal(mintAnswerConstant(null), null);
  });
});
