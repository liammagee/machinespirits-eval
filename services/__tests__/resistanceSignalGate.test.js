import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildResistanceSignalRetryContext,
  classifyResistanceSignal,
  evaluateResistanceSignalTarget,
  resistanceSignalGateMaxAttempts,
} from '../resistanceSignalGate.js';

test('matches controlled resistance signals', () => {
  assert.equal(classifyResistanceSignal('This is boring. I can follow it, but it feels dead.'), 'boredom');
  assert.equal(classifyResistanceSignal("I'm frustrated because the sequence still feels inert."), 'frustration');
  assert.equal(classifyResistanceSignal("What is the point? I don't see why this matters."), 'irrelevance');
  assert.equal(classifyResistanceSignal('So I just repeat master, servant, recognition, formula?'), 'rote_parroting');
});

test('requires a real question flood for question_flood target', () => {
  const weak = evaluateResistanceSignalTarget({
    targetSignal: 'question_flood',
    message: 'Why does this step matter? The weak part is the transition into risk.',
  });
  assert.equal(weak.matched, false);
  assert.equal(weak.observedSignal, '');

  const strong = evaluateResistanceSignalTarget({
    targetSignal: 'question_flood',
    message: 'Why Hegel? Why this order? What am I supposed to do with this?',
  });
  assert.equal(strong.matched, true);
  assert.equal(strong.observedSignal, 'question_flood');
  assert.equal(strong.questionCount, 3);
});

test('classifies interrogative relevance challenges as irrelevance, not question flood', () => {
  const message =
    "Why does this matter for charisma? I still don't see what this chart is supposed to explain about real wanting or recognition. Can you show me the concrete situation first?";

  assert.equal(classifyResistanceSignal(message), 'irrelevance');

  const gate = evaluateResistanceSignalTarget({
    targetSignal: 'irrelevance',
    message,
  });
  assert.equal(gate.matched, true);
  assert.equal(gate.observedSignal, 'irrelevance');
  assert.equal(gate.questionCount, 2);
});

test('preferred target disambiguates overlapping resistance language', () => {
  const gate = evaluateResistanceSignalTarget({
    targetSignal: 'frustration',
    message: "I'm frustrated. I can repeat the formula, but it still feels inert.",
  });
  assert.equal(gate.matched, true);
  assert.equal(gate.observedSignal, 'frustration');
});

test('builds a learner-only retry prompt without scripting the exact answer', () => {
  const context = buildResistanceSignalRetryContext({
    targetSignal: 'question_flood',
    previousMessage: 'The weakest step is why conflict must be extreme.',
    attempt: 2,
  });
  assert.match(context, /Resistance Signal Gate Retry/);
  assert.match(context, /at least three pointed questions/);
  assert.match(context, /Do not copy the scripted YAML example/);
  assert.match(context, /Previous reply to avoid repeating/);
});

test('caps configured gate attempts', () => {
  assert.equal(resistanceSignalGateMaxAttempts({}), 3);
  assert.equal(resistanceSignalGateMaxAttempts({ resistance_signal_gate_max_attempts: 0 }), 1);
  assert.equal(resistanceSignalGateMaxAttempts({ resistance_signal_gate_max_attempts: 99 }), 5);
});
