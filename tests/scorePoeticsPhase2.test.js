import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  BLIND_SCORING_PROTOCOL,
  applyPhase2Gates,
  buildPhase2Prompt,
  hasPeripeteiaMechanismShift,
  tutorTextAfterPivot,
} from '../scripts/score-poetics-phase2.js';

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
    actional_breakthrough_learner_turn: 2,
    actional_breakthrough: {
      score: 4,
      evidence: 'better is loose means not tied down',
      justification: 'The learner applies the replacement criterion rather than merely claiming insight.',
    },
    reversal_trigger_learner_turn: 2,
    tutor_strategy_reversal: {
      score: 4,
      evidence:
        'The old list has done its job; it cannot settle whether loose still has gravity. Use that not tied down frame: test which force still acts.',
      justification:
        'The tutor names the old route as insufficient and changes the public test after learner pressure.',
    },
    adaptive_mechanism_quality: {
      score: 4,
      evidence:
        'The old list has done its job; it cannot settle whether loose still has gravity. Use that not tied down frame: test which force still acts.',
      justification: 'The new device is fitted to the pressure and gives the learner an actionable criterion.',
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
    {
      role: 'TUTOR',
      text: 'The old list has done its job; it cannot settle whether loose still has gravity. Use that not tied down frame: test which force still acts.',
    },
  ];

  it('scores tutor uptake and adaptive mechanism from a post-pivot tutor quote', () => {
    const wholeText = turns.map((turn) => turn.text).join('\n');
    const gated = applyPhase2Gates(baseParsed(), turns, wholeText);
    assert.equal(gated.tutorContingentAdaptation100, 75);
    assert.equal(gated.tutorStrategicReversal100, 75);
    assert.equal(gated.adaptiveMechanismQuality100, 75);
    assert.equal(gated.roleSymmetricScores.learner_self_reframe.score100, 75);
    assert.equal(gated.roleSymmetricScores.learner_actional_breakthrough.score100, 75);
    assert.equal(gated.roleSymmetricScores.tutor_contingent_adaptation.score100, 75);
    assert.equal(gated.roleSymmetricScores.tutor_strategy_reversal.score100, 75);
    assert.equal(gated.roleSymmetricScores.tutor_adaptive_mechanism.score100, 75);
    assert.equal(gated.roleSymmetricScores.tutor_adaptive_mechanism_quality.score100, 75);
    assert.equal(
      tutorTextAfterPivot(turns, 2),
      'The old list has done its job; it cannot settle whether loose still has gravity. Use that not tied down frame: test which force still acts.',
    );
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

  it('clamps ordinary same-route narrowing as insufficient for peripeteia adaptation', () => {
    const wholeText = turns.map((turn) => turn.text).join('\n');
    const gated = applyPhase2Gates(
      baseParsed({
        tutor_strategy_reversal: {
          score: 5,
          evidence: 'Use that not tied down frame: test which force still acts.',
          justification: 'The tutor narrows the current test after learner pressure.',
        },
      }),
      turns,
      wholeText,
    );
    assert.equal(gated.tutorStrategicReversal100, 50);
    assert.ok(gated.flags.some((flag) => flag.startsWith('tutor_strategy_reversal_mechanism_clamp:5->3')));
  });

  it('clamps adaptive mechanism quality unless a real public mechanism shift passes', () => {
    const wholeText = turns.map((turn) => turn.text).join('\n');
    const gated = applyPhase2Gates(
      baseParsed({
        tutor_strategy_reversal: {
          score: 5,
          evidence: 'Use that not tied down frame: test which force still acts.',
          justification: 'The tutor narrows the current test after learner pressure.',
        },
        adaptive_mechanism_quality: {
          score: 5,
          evidence: 'Use that not tied down frame: test which force still acts.',
          justification: 'The mechanism is useful because it keeps the same test narrow.',
        },
      }),
      turns,
      wholeText,
    );
    assert.equal(gated.tutorStrategicReversal100, 50);
    assert.equal(gated.adaptiveMechanismQuality100, 50);
    assert.ok(gated.flags.some((flag) => flag.startsWith('adaptive_mechanism_quality_mechanism_clamp:5->3')));
  });

  it('requires both stock-taking contrast and a public device for peripeteia adaptation', () => {
    assert.equal(
      hasPeripeteiaMechanismShift(
        'The pencil has found the pressure points, but underlining now stops settling the verb. Try the print test.',
        'The tutor shifts from underlining to a print-facing caption test.',
      ).passes,
      true,
    );
    assert.equal(
      hasPeripeteiaMechanismShift(
        'Keep the test narrow. Check one thing first: who is being answered?',
        'The tutor narrows the same evidence route.',
      ).passes,
      false,
    );
  });

  it('keeps actional breakthrough separate from learner self-reframe', () => {
    const wholeText = turns.map((turn) => turn.text).join('\n');
    const gated = applyPhase2Gates(
      baseParsed({
        pivot_learner_turn: null,
        recontextualization: {
          score: 1,
          recohered_earlier: '',
          justification: 'No recognitive self-reframe is present.',
        },
        actional_breakthrough_learner_turn: 2,
        actional_breakthrough: {
          score: 5,
          evidence: 'better is loose means not tied down',
          justification: 'The learner performs the replacement criterion.',
        },
      }),
      turns,
      wholeText,
    );
    assert.equal(gated.recon100, 0);
    assert.equal(gated.actionalBreakthrough100, 100);
    assert.equal(gated.roleSymmetricScores.learner_actional_breakthrough.score100, 100);
  });

  it('clamps actional breakthrough when the evidence is not in the named learner turn', () => {
    const wholeText = turns.map((turn) => turn.text).join('\n');
    const gated = applyPhase2Gates(
      baseParsed({
        actional_breakthrough_learner_turn: 1,
        actional_breakthrough: {
          score: 5,
          evidence: 'better is loose means not tied down',
          justification: 'This quotes the wrong learner turn.',
        },
      }),
      turns,
      wholeText,
    );
    assert.equal(gated.actionalBreakthrough100, 50);
    assert.ok(gated.flags.includes('actional_breakthrough_evidence_clamp:5->3'));
  });

  it('keeps scoring prompts blind to generator identity', () => {
    const prompt = buildPhase2Prompt(turns);
    assert.match(prompt, /anonymous transcript/);
    assert.match(prompt, /generator, model provider, run ID, condition label, file path, and score/);
    assert.doesNotMatch(prompt, /\bcodex\b/i);
    assert.doesNotMatch(prompt, /\bclaude\b/i);
    assert.match(prompt, /ordinary scaffolding/);
    assert.match(prompt, /stock-taking contrast/);
    assert.match(prompt, /ACTIONAL BREAKTHROUGH/);
    assert.match(prompt, /ADAPTIVE MECHANISM QUALITY/);
    assert.deepEqual(BLIND_SCORING_PROTOCOL.hiddenFromCritic, [
      'generator',
      'model_provider',
      'run_id',
      'condition_label',
      'file_path',
      'score_history',
    ]);
  });
});
