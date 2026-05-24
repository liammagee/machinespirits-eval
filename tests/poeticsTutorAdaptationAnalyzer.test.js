import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { analyzePeripeteia } from '../scripts/analyze-poetics-tutor-adaptation.js';

describe('poetics tutor adaptation analyzer', () => {
  it('detects peripeteia-triggered tutor adaptive mechanism without requiring learner self-reframe', () => {
    const turns = [
      { phase: 'learner', turnNumber: 0, text: 'I think loose means no gravity.' },
      { phase: 'tutor', turnNumber: 1, text: 'Check the list and write the force name.' },
      { phase: 'learner', turnNumber: 1, text: "But that still doesn't make sense; loose should mean it floats away." },
      { phase: 'tutor', turnNumber: 2, text: 'Let us back up and try a different route: draw the string first, then test which force stays.' },
      {
        phase: 'learner',
        turnNumber: 2,
        text: 'The old frame treated loose as no force. Better frame: the string is gone, but gravity still stays.',
      },
    ];

    const result = analyzePeripeteia(turns);
    assert.equal(result.learner_reversal_pressure, true);
    assert.equal(result.trigger_type, 'breakdown');
    assert.equal(result.tutor_strategy_reversal, true);
    assert.equal(result.tutor_adaptive_mechanism, true);
    assert.equal(result.learner_outcome_after_reversal, 'recognition');
    assert.ok(result.tutor_peripeteia_score > 50);
  });
});
