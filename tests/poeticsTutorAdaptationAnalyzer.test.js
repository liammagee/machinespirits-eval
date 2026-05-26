import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { analyzePeripeteia, branchValidityForTrace } from '../scripts/analyze-poetics-tutor-adaptation.js';

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
    assert.ok(result.novel_mechanism_hits.length >= 1);
    assert.equal(result.learner_outcome_after_reversal, 'recognition');
    assert.ok(result.tutor_peripeteia_score > 50);
  });

  it('does not count same-route routine continuation as tutor peripeteia', () => {
    const turns = [
      { phase: 'learner', turnNumber: 0, text: 'I think loose means no gravity.' },
      { phase: 'tutor', turnNumber: 1, text: 'Check the list and write the force name.' },
      { phase: 'learner', turnNumber: 1, text: "But that still doesn't make sense; loose should mean it floats away." },
      {
        phase: 'tutor',
        turnNumber: 2,
        text: 'Keep using the same list. Write the force name, then answer the next worksheet item.',
      },
      { phase: 'learner', turnNumber: 2, text: 'I still do not see why the list settles it.' },
    ];

    const result = analyzePeripeteia(turns);
    assert.equal(result.learner_reversal_pressure, true);
    assert.equal(result.tutor_strategy_reversal, false);
    assert.equal(result.tutor_adaptive_mechanism, false);
    assert.ok(result.tutor_peripeteia_score < 50);
  });

  it('uses instrumented tutor inner-dialogue route changes as peripeteia evidence only when public mechanism is visible', () => {
    const turns = [
      { phase: 'learner', turnNumber: 0, text: 'The price graph makes this look automatic.' },
      { phase: 'tutor', turnNumber: 1, text: 'Use the graph and label the supply shift.' },
      {
        phase: 'learner',
        turnNumber: 1,
        text: 'But the graph still lets the seller hide behind the storm. What would make that excuse fail?',
      },
      {
        phase: 'tutor',
        turnNumber: 2,
        text:
          'The graph is too soft as the test. Switch to an audit standard: record replacement cost, missing units, rationing attempts, and held-back stock before the price claim can stand.',
      },
    ];
    const traceTurns = [
      ...turns,
      {
        phase: 'tutor',
        turnNumber: 2,
        learnerReversalEventUsed: {
          turnNumber: 1,
          triggerType: 'resistance',
          confidence: 0.55,
        },
        internalDeliberation: [
          { role: 'superego', content: 'MECHANISM_ROUTE: graph label -> audit standard' },
          { role: 'ego', content: 'PRIVATE_DECISION: revise. ADAPTIVE_MECHANISM: graph label -> audit standard' },
        ],
      },
    ];

    const result = analyzePeripeteia(turns, traceTurns, { tutorAdaptationPolicy: 'peripeteia' });
    assert.equal(result.instrumented_pressure, true);
    assert.equal(result.private_mechanism_declared, true);
    assert.equal(result.private_mechanism_route, 'graph label -> audit standard');
    assert.equal(result.tutor_adaptive_mechanism, true);
  });

  it('counts operational release-gate moves as public peripeteia mechanisms', () => {
    const turns = [
      {
        phase: 'learner',
        turnNumber: 0,
        text: 'The checklist is complete, so I think the ramp can be signed off.',
      },
      {
        phase: 'tutor',
        turnNumber: 1,
        text: 'Use the ramp test and write the failure mode before the sheet is signed.',
      },
      {
        phase: 'learner',
        turnNumber: 1,
        text:
          'But the volunteer is waiting at the door and I am still not sure whether to hold the sheet or let the trial start.',
      },
      {
        phase: 'tutor',
        turnNumber: 2,
        text:
          'The weak point has moved. The ramp test matters, but the release instruction has to hold when the room gets busy. Write three lines where the signature would go: held item, person notified, and reopen condition. If the volunteer cannot wait, the trial is canceled, not improvised.',
      },
    ];
    const traceTurns = [
      ...turns,
      {
        phase: 'tutor',
        turnNumber: 2,
        learnerReversalEventUsed: {
          turnNumber: 1,
          triggerType: 'breakdown',
          confidence: 0.9,
        },
        internalDeliberation: [
          {
            role: 'superego',
            content: 'MECHANISM_ROUTE: ramp-test evidence -> release-gate protocol under institutional pressure',
          },
          {
            role: 'ego',
            content:
              'PRIVATE_DECISION: revise. ADAPTIVE_MECHANISM: ramp-test evidence -> release-gate protocol under institutional pressure',
          },
        ],
      },
    ];

    const result = analyzePeripeteia(turns, traceTurns, { tutorAdaptationPolicy: 'peripeteia' });
    assert.equal(result.instrumented_pressure, true);
    assert.equal(result.private_mechanism_declared, true);
    assert.equal(result.tutor_adaptive_mechanism, true);
    assert.ok(result.novel_mechanism_hits.includes('authorization_gate'));
  });

  it('scopes paired-continuation peripeteia pressure to the branch, not the shared prefix', () => {
    const turns = [
      {
        phase: 'learner',
        turnNumber: 0,
        text: 'But the header still feels like the answer, and I keep grabbing the top word.',
      },
      { phase: 'tutor', turnNumber: 1, text: 'Use the same header-row checklist.' },
      { phase: 'learner', turnNumber: 1, text: 'I might still grab the top word, but I can try the next column.' },
      { phase: 'tutor', turnNumber: 2, text: 'Keep using header first, then the row value.' },
      { phase: 'learner', turnNumber: 2, text: 'Header first. If the cell says 72, the value is 72.' },
      { phase: 'tutor', turnNumber: 3, text: 'Good. Keep the same checklist for the third column.' },
    ];

    const unscoped = analyzePeripeteia(turns);
    assert.equal(unscoped.learner_reversal_pressure, true);
    assert.equal(unscoped.pressure_turn_number, 0);

    const scoped = analyzePeripeteia(turns, [], {
      tutorAdaptationPolicy: 'peripeteia',
      minPressureTurnNumber: 2,
      pairedPrefixThrough: 'tutor_turn_2',
    });
    assert.equal(scoped.learner_reversal_pressure, false);
    assert.equal(scoped.pressure_turn_number, null);
    assert.equal(scoped.paired_prefix_through, 'tutor_turn_2');
  });

  it('reports branch validity from required private event use', () => {
    const turns = [
      { phase: 'learner', turnNumber: 1, text: 'I thought the chart settled it.' },
      { phase: 'tutor', turnNumber: 2, text: 'Use the chart.' },
      { phase: 'learner', turnNumber: 2, text: 'But the chart still feels like proof by itself.' },
      { phase: 'tutor', turnNumber: 3, text: 'Switch to an audit rule.' },
    ];
    const trace = {
      turns: [
        ...turns,
        {
          phase: 'tutor',
          turnNumber: 3,
          learnerReversalEventUsed: { turnNumber: 2, triggerType: 'resistance', confidence: 0.8 },
          learnerReversalEventCandidatesUsed: [
            { turnNumber: 1, triggerType: 'pseudo_catharsis', confidence: 0.7 },
            { turnNumber: 2, triggerType: 'resistance', confidence: 0.8 },
          ],
          learnerReframeEventUsed: { turnNumber: 2, revisedFrame: 'chart as evidence only', confidence: 1 },
          internalDeliberation: [{ role: 'ego', content: 'ADAPTIVE_MECHANISM: chart reading -> audit rule' }],
        },
      ],
    };

    const valid = branchValidityForTrace(trace, turns, {
      tutorAdaptationPolicy: 'uptake+peripeteia',
      minPressureTurnNumber: 2,
    });
    assert.equal(valid.requires_learner_reversal_event, true);
    assert.equal(valid.learner_reversal_event_used, true);
    assert.equal(valid.learner_reversal_event_trigger_type, 'resistance');
    assert.equal(valid.learner_reversal_candidate_trigger_types, 'pseudo_catharsis, resistance');
    assert.equal(valid.requires_learner_reframe_event, true);
    assert.equal(valid.learner_reframe_event_used, true);
    assert.equal(valid.valid, true);

    const invalid = branchValidityForTrace({ turns }, turns, {
      tutorAdaptationPolicy: 'peripeteia',
      minPressureTurnNumber: 2,
    });
    assert.equal(invalid.requires_learner_reversal_event, true);
    assert.equal(invalid.learner_reversal_event_used, false);
    assert.equal(invalid.valid, false);
  });
});
