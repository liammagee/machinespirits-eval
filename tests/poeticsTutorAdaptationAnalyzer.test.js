import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { analyzePeripeteia, branchValidityForTrace, strategyFor } from '../scripts/analyze-poetics-tutor-adaptation.js';

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

  it('does not collapse criterion gates and surface keys into generic application tasks', () => {
    assert.equal(
      strategyFor(
        'Use one test now: only a label that can complete one bar = ___ ___ beats enters the time signature. Sort top number, bottom number, and speed card into the two zones.',
      ),
      'criterion_gate',
    );
    assert.equal(
      strategyFor(
        'Use this surface key instead: one slot runs along the tabletop strip, one slot stands off it at the square. Put friction and normal into those two slots by the arrow direction.',
      ),
      'surface_orientation_key',
    );
    assert.equal(
      strategyFor('Bring the corner onto the table contact. Table on cart names which card?'),
      'contact_mark_mapping',
    );
    assert.equal(
      strategyFor(
        'This strip stays down until the sentence passes one test: other object on cart. Put track in the slot. Say: track on cart. Then lift the strip and choose the direction.',
      ),
      'interaction_sentence_gate',
    );
    assert.equal(
      strategyFor(
        'With the numbers covered, sort the marks for a rehearsal reader: LABEL on the two number-lines, BAR-PROOF on the mark that tells where this bar ends.',
      ),
      'proof_classification_gate',
    );
    assert.equal(
      strategyFor(
        'Before this sheet moves down the row, sort four pieces under BAR STRUCTURE or PERFORMANCE DIRECTION.',
      ),
      'function_classification_gate',
    );
    assert.equal(
      strategyFor(
        'Sort the four cards on this form: COPY FROM TILE or CALCULATION, then read the copy column for release.',
      ),
      'function_classification_gate',
    );
    assert.equal(
      strategyFor(
        'Use the element tile gate: cover the bottom decimal, mark atomic number as proton count, then uncover the decimal and label atomic mass.',
      ),
      'element_tile_gate',
    );
    assert.equal(
      strategyFor(
        'With the word card covered, use the three index tags to match the covered tile before reading the name.',
      ),
      'element_tile_gate',
    );
    assert.equal(
      strategyFor(
        'The tray line made a false row. Now it is only a parking place: one card comes off at a time, touches one printed part, and moves to the copy side only after it passes alone.',
      ),
      'sequential_copy_gate',
    );
  });

  it('counts an element-tile evidence gate as a public route change after pressure', () => {
    const turns = [
      {
        phase: 'learner',
        turnNumber: 1,
        text: 'The top whole number and bottom decimal are both numbers on the tile.',
      },
      {
        phase: 'tutor',
        turnNumber: 2,
        text: 'Keep labeling the tile parts: top number, symbol, name, bottom decimal.',
      },
      {
        phase: 'learner',
        turnNumber: 2,
        text:
          'But if the top number is 6, I keep wanting to use it as the mass too. The tile has two number spots and that is what is tripping me.',
      },
      {
        phase: 'tutor',
        turnNumber: 3,
        text:
          'The part labels no longer settle the two-number problem. Use this element tile gate: cover the bottom decimal and mark top whole number as atomic number/proton count. Then uncover the decimal and mark only that bottom number as atomic mass.',
      },
    ];
    const traceTurns = [
      ...turns,
      {
        phase: 'tutor',
        turnNumber: 3,
        learnerReversalEventUsed: {
          turnNumber: 2,
          triggerType: 'resistance',
          confidence: 0.9,
        },
        internalDeliberation: [
          { role: 'superego', content: 'MECHANISM_ROUTE: tile label repetition -> element-tile evidence gate' },
          { role: 'ego', content: 'ADAPTIVE_MECHANISM: tile labels -> element-tile evidence gate' },
        ],
      },
    ];

    const result = analyzePeripeteia(turns, traceTurns, { tutorAdaptationPolicy: 'peripeteia' });

    assert.equal(result.tutor_adaptive_mechanism, true);
    assert.ok(result.novel_mechanism_hits.includes('element_tile_gate'));
  });

  it('counts a sequential element-card copy gate as a public route change after pressure', () => {
    const turns = [
      {
        phase: 'learner',
        turnNumber: 1,
        text: 'Top 6, C, carbon, then 12.01 is clear, but the tray makes the loose cards look like another row.',
      },
      {
        phase: 'tutor',
        turnNumber: 2,
        text: 'Keep the gap visible, read the four parts once, then copy: top 6 atomic number, C symbol, carbon name, bottom 12.01 atomic mass.',
      },
      {
        phase: 'learner',
        turnNumber: 2,
        text: 'The tray turned across the bottom makes the loose cards look like another row.',
      },
      {
        phase: 'tutor',
        turnNumber: 3,
        text:
          'The tray line stopped settling this; it made a false row. Now it is only a parking place. One card comes off the tray at a time: place it on one printed part, name that match, then move it to the copy side. No card copies until it passes alone.',
      },
      {
        phase: 'learner',
        turnNumber: 3,
        text:
          'Parking place only; this card has to pass alone. Atomic number points to the top 6 only, so it can move to the copy side.',
      },
    ];
    const traceTurns = [
      ...turns,
      {
        phase: 'tutor',
        turnNumber: 3,
        learnerReversalEventUsed: {
          turnNumber: 2,
          triggerType: 'misfit',
          confidence: 0.9,
        },
        internalDeliberation: [
          {
            role: 'superego',
            content: 'MECHANISM_ROUTE: visual tray-line audit -> sequential copy gate / one-card release test',
          },
          {
            role: 'ego',
            content:
              'ADAPTIVE_MECHANISM: visual tray-line audit -> sequential copy gate / one-card release test',
          },
        ],
      },
    ];

    const result = analyzePeripeteia(turns, traceTurns, { tutorAdaptationPolicy: 'peripeteia' });

    assert.equal(result.tutor_adaptive_mechanism, true);
    assert.ok(result.novel_mechanism_hits.includes('sequential_copy_gate'));
    assert.ok(result.tutor_peripeteia_score >= 75);
  });

  it('counts function-classification gates as public route changes after pressure', () => {
    const turns = [
      {
        phase: 'learner',
        turnNumber: 1,
        text: 'The tempo card is still pulling at the box as if speed has to be entered somewhere.',
      },
      {
        phase: 'tutor',
        turnNumber: 2,
        text: 'Use the key to fill top number and bottom number on the worksheet.',
      },
      {
        phase: 'learner',
        turnNumber: 2,
        text: 'The key fixed the bottom number, but the face-up tempo card still looks like it wants a box.',
      },
      {
        phase: 'tutor',
        turnNumber: 3,
        text:
          'The key has fixed the bottom number, but the face-up tempo card is still asking for a box. Sort four pieces under BAR STRUCTURE or PERFORMANCE DIRECTION. Only BAR STRUCTURE may touch the boxes or bar line.',
      },
    ];
    const traceTurns = [
      ...turns,
      {
        phase: 'tutor',
        turnNumber: 3,
        learnerReversalEventUsed: {
          turnNumber: 2,
          triggerType: 'resistance',
          confidence: 0.9,
        },
        internalDeliberation: [
          { role: 'superego', content: 'MECHANISM_ROUTE: key lookup -> function-classification gate' },
          { role: 'ego', content: 'ADAPTIVE_MECHANISM: key lookup -> function-classification gate' },
        ],
      },
    ];

    const result = analyzePeripeteia(turns, traceTurns, { tutorAdaptationPolicy: 'peripeteia' });

    assert.equal(result.tutor_adaptive_mechanism, true);
    assert.ok(result.novel_mechanism_hits.includes('function_classification_gate'));
  });

  it('counts a sentence-gate sorting device as a public route change after pressure', () => {
    const turns = [
      {
        phase: 'learner',
        turnNumber: 1,
        text: 'The written line fills the boxes: one bar equals three quarter-note beats.',
      },
      {
        phase: 'tutor',
        turnNumber: 2,
        text:
          'Use that line as the check. Top number: arrow to the three slots in one bar. Bottom number: arrow to one quarter-note beat unit. The blank card stays outside.',
      },
      {
        phase: 'learner',
        turnNumber: 2,
        text:
          'The arrows fit the 3 and the 4, but this speed card is still sitting there like an unfinished label. Where does the speed label go if it stays outside the time signature?',
      },
      {
        phase: 'tutor',
        turnNumber: 3,
        text:
          'The arrows settled the two boxes; they did not decide the loose speed card. Use one test now: only a label that can complete one bar = ___ ___ beats enters the time signature. Sort top number, bottom number, and speed card into the two zones.',
      },
    ];
    const traceTurns = [
      ...turns,
      {
        phase: 'tutor',
        turnNumber: 3,
        learnerReversalEventUsed: {
          turnNumber: 2,
          triggerType: 'resistance',
          confidence: 0.9,
        },
        internalDeliberation: [
          { role: 'superego', content: 'MECHANISM_ROUTE: arrow/evidence audit -> sentence-gate classification' },
          { role: 'ego', content: 'ADAPTIVE_MECHANISM: time-signature arrow mapping -> sentence-gate sorting' },
        ],
      },
    ];

    const result = analyzePeripeteia(turns, traceTurns, { tutorAdaptationPolicy: 'peripeteia' });

    assert.equal(result.tutor_strategy_before, 'object_mapping');
    assert.equal(result.tutor_strategy_after, 'criterion_gate');
    assert.equal(result.tutor_adaptive_mechanism, true);
    assert.ok(result.novel_mechanism_hits.includes('criterion_gate'));
  });

  it('counts a proof-audience classification gate as a public route change after pressure', () => {
    const turns = [
      {
        phase: 'learner',
        turnNumber: 1,
        text: 'Three quarter-note beats fill the bar. Count is full, not faster.',
      },
      {
        phase: 'tutor',
        turnNumber: 2,
        text:
          'Draw one short line: 3 to the three tiles, 4 to the quarter-note card. Which mark proves the count is full?',
      },
      {
        phase: 'learner',
        turnNumber: 2,
        text:
          'The short line helps, but I would not call it the proof mark yet. The bar line after the third beat proves the count is full.',
      },
      {
        phase: 'tutor',
        turnNumber: 3,
        text:
          'The short lines no longer settle proof; they label what the numbers mean. With the numbers covered, sort the marks for a rehearsal reader: LABEL on the two number-lines, BAR-PROOF on the mark that tells where this bar ends.',
      },
    ];
    const traceTurns = [
      ...turns,
      {
        phase: 'tutor',
        turnNumber: 3,
        learnerReversalEventUsed: {
          turnNumber: 2,
          triggerType: 'resistance',
          confidence: 0.9,
        },
        internalDeliberation: [
          {
            role: 'superego',
            content:
              'MECHANISM_ROUTE: same worked example / evidence check -> covered-number proof-audience classification',
          },
          {
            role: 'ego',
            content:
              'ADAPTIVE_MECHANISM: same worked example / evidence check -> covered-number proof-audience classification',
          },
        ],
      },
    ];

    const result = analyzePeripeteia(turns, traceTurns, { tutorAdaptationPolicy: 'peripeteia' });

    assert.equal(result.tutor_adaptive_mechanism, true);
    assert.ok(result.novel_mechanism_hits.includes('proof_classification_gate'));
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
    assert.equal(valid.learner_reversal_event_source, 'branch_local');
    assert.equal(valid.learner_reversal_event_branch_local, true);
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

  it('treats unresolved prefix pseudo-catharsis consumed by a branch tutor as carried pressure', () => {
    const turns = [
      { phase: 'learner', turnNumber: 1, text: 'Oh, I get it, but the label still flattens the risk.' },
      { phase: 'tutor', turnNumber: 2, text: 'Polish the label.' },
      { phase: 'learner', turnNumber: 2, text: 'The hinge is doing more than the quote alone.' },
      { phase: 'tutor', turnNumber: 3, text: 'Use a release card before the label goes up.' },
    ];
    const trace = {
      turns: [
        ...turns,
        {
          phase: 'tutor',
          turnNumber: 3,
          learnerReversalEventUsed: { turnNumber: 1, triggerType: 'pseudo_catharsis', confidence: 0.77 },
          learnerReversalEventCandidatesUsed: [
            { turnNumber: 1, triggerType: 'pseudo_catharsis', confidence: 0.77 },
            { turnNumber: 2, triggerType: 'resistance', confidence: 0.7 },
          ],
          internalDeliberation: [{ role: 'ego', content: 'ADAPTIVE_MECHANISM: label polish -> release card' }],
        },
      ],
    };

    const valid = branchValidityForTrace(trace, turns, {
      tutorAdaptationPolicy: 'peripeteia',
      minPressureTurnNumber: 2,
    });

    assert.equal(valid.valid, true);
    assert.equal(valid.learner_reversal_event_used, true);
    assert.equal(valid.learner_reversal_event_trigger_type, 'pseudo_catharsis');
    assert.equal(valid.learner_reversal_event_source, 'carried_prefix');
    assert.equal(valid.learner_reversal_event_branch_local, false);
    assert.equal(valid.learner_reversal_candidate_trigger_types, 'pseudo_catharsis, resistance');
  });
});
