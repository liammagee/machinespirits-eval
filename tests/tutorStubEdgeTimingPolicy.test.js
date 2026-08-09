import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_EDGE_TIMING_SCHEMA,
  buildTutorStubEdgeTimingSelection,
  detectTutorStubEdgeTimingSignal,
  finalizeTutorStubEdgeTimingDecision,
} from '../services/tutorStubEdgeTimingPolicy.js';
import { evaluateTutorStubRegisterPolicyOverlay } from '../services/tutorStubRegisterPolicyComposition.js';

const FULL_MENU = ['plain', 'precise', 'brisk', 'warm', 'witnessing', 'charismatic', 'ironic', 'sarcastic'];

function state(previous = 'brisk', palette = FULL_MENU) {
  return {
    register: {
      palette,
      history: previous ? [{ selected_register: previous }] : [],
    },
  };
}

test('Stage 1 public resistance examples project to the frozen edge-timing map', () => {
  const cases = [
    {
      learnerText: 'This still feels dead and formulaic, but I will try. Give me a concrete case.',
      signal: 'boredom',
      selected: 'sarcastic',
      edge: true,
    },
    {
      learnerText: 'This still feels like parroting the sequence, but I will make the table matter.',
      signal: 'rote_parroting',
      selected: 'sarcastic',
      edge: true,
    },
    {
      learnerText: "What's the point of the scaffold before I see why it matters in a real case?",
      signal: 'irrelevance',
      selected: 'ironic',
      edge: true,
    },
    {
      learnerText: 'Why this step? Why the risk? What makes work educate? What am I missing?',
      signal: 'question_flood',
      selected: 'ironic',
      edge: true,
    },
    {
      learnerText: 'I am frustrated because the explanation jumps from work to education.',
      signal: 'frustration',
      selected: 'charismatic',
      edge: false,
    },
  ];

  for (const fixture of cases) {
    const selection = buildTutorStubEdgeTimingSelection({
      state: state(),
      learnerText: fixture.learnerText,
      primaryRegister: 'warm',
    });
    assert.equal(selection.edge_timing.schema, TUTOR_STUB_EDGE_TIMING_SCHEMA);
    assert.equal(selection.edge_timing.phase, 'resistance');
    assert.equal(selection.edge_timing.resistance_signal, fixture.signal);
    assert.equal(selection.selected_register, fixture.selected);
    assert.equal(selection.edge_timing.edge_eligible, fixture.edge);
    assert.deepEqual(selection.edge_timing.router_register_menu, FULL_MENU);
  }
});

test('mixed improvement wording remains resistance when the learner still names the boredom signal', () => {
  const signal = detectTutorStubEdgeTimingSignal({
    learnerText: 'This feels less dead now, but I still want a sharper concrete test before I can say I understand it.',
  });
  assert.equal(signal.phase, 'resistance');
  assert.equal(signal.resistanceSignal, 'boredom');
});

test('content-bearing uptake closes the edge and returns to a non-edged stance', () => {
  const selection = buildTutorStubEdgeTimingSelection({
    state: state('ironic'),
    learnerText: 'Okay, now I see why it matters: praise only counts if the other person remains independent.',
    primaryRegister: 'sarcastic',
  });
  assert.equal(selection.edge_timing.phase, 'uptake');
  assert.equal(selection.edge_timing.edge_eligible, false);
  assert.equal(selection.edge_timing.edge_suppressed_reason, 'uptake_closes_edge');
  assert.equal(selection.selected_register, 'precise');
  assert.equal(selection.edge_timing.previous_register, 'ironic');
});

test('comprehension and exposed affect fail closed to non-edged stances', () => {
  const comprehension = buildTutorStubEdgeTimingSelection({
    state: state(),
    learnerText: 'This feels dead. Can you say it in plain language?',
    classification: { turn: { request_type: 'plain_language_request' } },
    primaryRegister: 'sarcastic',
  });
  assert.equal(comprehension.selected_register, 'plain');
  assert.equal(comprehension.edge_timing.edge_suppressed_reason, 'comprehension_repair');

  const exposed = buildTutorStubEdgeTimingSelection({
    state: state(),
    learnerText: 'I am ashamed and frustrated that I cannot see the step.',
    primaryRegister: 'ironic',
  });
  assert.equal(exposed.selected_register, 'witnessing');
  assert.equal(exposed.edge_timing.edge_suppressed_reason, 'protected_affect');
});

test('an active safe menu records the missing edge and uses the non-edged fallback', () => {
  const selection = buildTutorStubEdgeTimingSelection({
    state: state('plain', ['plain', 'precise', 'warm', 'charismatic']),
    learnerText: 'This still feels dead and formulaic.',
    primaryRegister: 'plain',
  });
  assert.equal(selection.selected_register, 'charismatic');
  assert.equal(selection.edge_timing.edge_eligible, false);
  assert.equal(selection.edge_timing.edge_suppressed_reason, 'edged_register_not_in_active_menu');
  assert.deepEqual(selection.edge_timing.admitted_edged_registers, []);
});

test('overlay evaluation uses the frozen decision strength and remains inactive on other turns', () => {
  const resistance = buildTutorStubEdgeTimingSelection({
    state: state(),
    learnerText: 'This is rote parroting.',
    primaryRegister: 'warm',
  });
  const active = evaluateTutorStubRegisterPolicyOverlay({
    overlay: 'edge_timing',
    candidate: resistance,
    primaryRegister: 'warm',
    threshold: 0.7,
  });
  assert.equal(active.signal_strength, 1);
  assert.equal(active.eligible, true);
  assert.equal(active.details.phase, 'resistance');

  const other = buildTutorStubEdgeTimingSelection({
    state: state(),
    learnerText: 'Can we continue with the next exhibit?',
    primaryRegister: 'warm',
  });
  const inactive = evaluateTutorStubRegisterPolicyOverlay({
    overlay: 'edge_timing',
    candidate: other,
    primaryRegister: 'warm',
    threshold: 0.7,
  });
  assert.equal(inactive.signal_strength, 0);
  assert.equal(inactive.eligible, false);
});

test('the final trace distinguishes a timing choice from a later hard-guard override', () => {
  const timing = buildTutorStubEdgeTimingSelection({
    state: state(),
    learnerText: 'This still feels dead and formulaic.',
    primaryRegister: 'warm',
  }).edge_timing;
  const finalized = finalizeTutorStubEdgeTimingDecision(
    { ...timing, activated: true },
    { finalRegister: 'plain', finalSource: 'instructional_meta_repair' },
  );
  assert.equal(finalized.selected_register, 'sarcastic');
  assert.equal(finalized.final_selected_register, 'plain');
  assert.equal(finalized.applied, false);
  assert.deepEqual(finalized.post_timing_override, {
    source: 'instructional_meta_repair',
    selected_register: 'plain',
  });

  const compositionLoser = finalizeTutorStubEdgeTimingDecision(
    { ...timing, activated: false, composition_winner: 'state' },
    { finalRegister: 'warm', finalSource: 'register_policy_overlay_state' },
  );
  assert.equal(compositionLoser.applied, false);
  assert.equal(compositionLoser.final_selected_register, 'warm');
  assert.equal(compositionLoser.post_timing_override, null);
});
