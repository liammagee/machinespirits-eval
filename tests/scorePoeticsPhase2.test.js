import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { applyPhase2Gates, tutorTextAfterPivot } from '../scripts/score-poetics-phase2.js';

function baseParsed(overrides = {}) {
  return {
    pivot_learner_turn: 2,
    recontextualization: {
      score: 4,
      recohered_earlier: 'I thought loose means no gravity.',
      justification: 'The later learner re-reads the earlier loose/gravity frame.',
    },
    stated_insight: { score: 2, evidence: '' },
    rupture: {
      score: 4,
      naive_trajectory: 'The learner was treating loose as weightless.',
      evidence: 'My old frame made loose mean weightless; better is loose means not tied down.',
    },
    global_coherence: { score: 4, evidence: 'Use that not tied down frame' },
    reversal_trigger_learner_turn: 2,
    tutor_strategy_reversal: {
      score: 4,
      evidence: 'Use that not tied down frame',
      justification: 'The tutor changes the next task after learner pressure.',
    },
    tutor_contingent_adaptation: {
      score: 4,
      evidence: 'Use that not tied down frame',
      justification: 'The tutor changes the next task around the revised frame.',
    },
    ...overrides,
  };
}

describe('score-poetics-phase2 role-symmetric adaptation axes', () => {
  const turns = [
    { role: 'LEARNER', text: 'I thought loose means no gravity.' },
    { role: 'TUTOR', text: 'Check the list first.' },
    {
      role: 'LEARNER',
      text: 'My old frame made loose mean weightless; better is loose means not tied down.',
    },
    { role: 'TUTOR', text: 'Use that not tied down frame: test which force still acts.' },
  ];

  it('scores tutor uptake and adaptive mechanism from a post-pivot tutor quote', () => {
    const wholeText = turns.map((turn) => turn.text).join('\n');
    const gated = applyPhase2Gates(baseParsed(), turns, wholeText);
    assert.equal(gated.tutorContingentAdaptation100, 75);
    assert.equal(gated.tutorStrategicReversal100, 75);
    assert.equal(gated.roleSymmetricScores.learner_self_reframe.score100, 75);
    assert.equal(gated.roleSymmetricScores.tutor_contingent_adaptation.score100, 75);
    assert.equal(gated.roleSymmetricScores.tutor_strategy_reversal.score100, 75);
    assert.equal(gated.roleSymmetricScores.tutor_adaptive_mechanism.score100, 75);
    assert.equal(tutorTextAfterPivot(turns, 2), 'Use that not tied down frame: test which force still acts.');
  });

  it('clamps tutor adaptation when the evidence is not in a post-pivot tutor turn', () => {
    const wholeText = turns.map((turn) => turn.text).join('\n');
    const gated = applyPhase2Gates(
      baseParsed({
        tutor_contingent_adaptation: {
          score: 5,
          evidence: 'Check the list first.',
          justification: 'This quotes the wrong tutor turn.',
        },
      }),
      turns,
      wholeText,
    );
    assert.equal(gated.tutorContingentAdaptation100, 50);
    assert.ok(gated.flags.includes('tutor_adaptation_evidence_clamp:5->3'));
  });

  it('clamps tutor adaptive mechanism when evidence precedes the reversal trigger', () => {
    const wholeText = turns.map((turn) => turn.text).join('\n');
    const gated = applyPhase2Gates(
      baseParsed({
        reversal_trigger_learner_turn: 2,
        tutor_strategy_reversal: {
          score: 5,
          evidence: 'Check the list first.',
          justification: 'This quotes the tutor before the reversal trigger.',
        },
      }),
      turns,
      wholeText,
    );
    assert.equal(gated.tutorStrategicReversal100, 50);
    assert.ok(gated.flags.includes('tutor_strategy_reversal_evidence_clamp:5->3'));
  });
});
