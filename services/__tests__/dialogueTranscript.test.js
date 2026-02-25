import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDialoguePublicTranscript,
  buildDialogueFullTranscript,
  isEgoSuperegoLearner,
  extractInitialLearnerMessage,
} from '../rubricEvaluator.js';

// ── Test fixtures ─────────────────────────────────────────────────────────

/** Unified (ego-only) learner trace — no learner_synthesis/ego_initial entries */
const UNIFIED_TRACE = [
  { agent: 'user', action: 'context_input', turnIndex: 0, detail: '', contextSummary: '' },
  { agent: 'ego', action: 'generate', turnIndex: 0, detail: '', contextSummary: '' },
  { agent: 'user', action: 'turn_action', turnIndex: 1, detail: 'Learner: asked_followup', contextSummary: 'But Popper would say this is unfalsifiable. How do you respond?' },
  { agent: 'ego', action: 'generate', turnIndex: 1, detail: '', contextSummary: '' },
  { agent: 'user', action: 'turn_action', turnIndex: 2, detail: 'Learner: asked_followup', contextSummary: 'I see the distinction between empirical and phenomenological claims.' },
  { agent: 'ego', action: 'generate', turnIndex: 2, detail: '', contextSummary: '' },
];

/** Ego+superego learner trace — has learner deliberation chain */
const EGO_SUPEREGO_TRACE = [
  { agent: 'user', action: 'context_input', turnIndex: 0, detail: '', contextSummary: '' },
  { agent: 'ego', action: 'generate', turnIndex: 0, detail: '', contextSummary: '' },
  { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 1, detail: 'I think this is about recognition...', contextSummary: '' },
  { agent: 'learner_superego', action: 'deliberation', turnIndex: 1, detail: 'The ego is avoiding the harder question about asymmetry.', contextSummary: '' },
  { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 1, detail: 'OK the real question is about asymmetric recognition.', contextSummary: '' },
  { agent: 'learner_synthesis', action: 'response', turnIndex: 1, detail: 'OK the real question is about asymmetric recognition.', contextSummary: '' },
  { agent: 'user', action: 'turn_action', turnIndex: 1, detail: 'Learner: asked_followup', contextSummary: 'OK the real question is about asymmetric recognition.' },
  { agent: 'ego', action: 'generate', turnIndex: 1, detail: 'Good insight on asymmetry.', contextSummary: '' },
  { agent: 'superego', action: 'review', turnIndex: 1, detail: 'Push harder on the paradox.', contextSummary: '' },
  { agent: 'ego', action: 'revise', turnIndex: 1, detail: 'You identified asymmetry - now what happens when the master wins?', contextSummary: '' },
];

const TURNS = [
  { turnIndex: 0, turnId: 'turn_0', suggestions: [{ message: 'Welcome to the dialectic.' }] },
  { turnIndex: 1, turnId: 'turn_1', suggestions: [{ message: 'Good point about Popper.' }] },
  { turnIndex: 2, turnId: 'turn_2', suggestions: [{ message: 'Exactly - phenomenological vs empirical.' }] },
];

const TURNS_EGO_SUPEREGO = [
  { turnIndex: 0, turnId: 'turn_0', suggestions: [{ message: 'Welcome to recognition theory.' }] },
  { turnIndex: 1, turnId: 'turn_1', suggestions: [{ message: 'You identified asymmetry - now what happens when the master wins?' }] },
];

const LEARNER_CONTEXT = '### Recent Chat History\n- User: "I think the dialectic is just thesis plus antithesis equals synthesis"';

// ── isEgoSuperegoLearner ──────────────────────────────────────────────────

describe('isEgoSuperegoLearner', () => {
  it('returns true when trace has learner_synthesis', () => {
    assert.equal(isEgoSuperegoLearner(EGO_SUPEREGO_TRACE), true);
  });

  it('returns true when trace has learner_ego_initial', () => {
    const trace = [{ agent: 'learner_ego_initial', action: 'deliberation' }];
    assert.equal(isEgoSuperegoLearner(trace), true);
  });

  it('returns false for unified learner trace', () => {
    assert.equal(isEgoSuperegoLearner(UNIFIED_TRACE), false);
  });

  it('returns false for null/empty trace', () => {
    assert.equal(isEgoSuperegoLearner(null), false);
    assert.equal(isEgoSuperegoLearner([]), false);
  });
});

// ── buildDialoguePublicTranscript ─────────────────────────────────────────

describe('buildDialoguePublicTranscript', () => {
  it('never contains [Learner Action] for unified learner', () => {
    const transcript = buildDialoguePublicTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.equal(transcript.includes('[Learner Action]'), false,
      'Public transcript must not contain [Learner Action] for unified learners');
  });

  it('labels unified learner messages as [Learner]', () => {
    const transcript = buildDialoguePublicTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('[Learner]'),
      'Public transcript should contain [Learner] labels for unified learners');
  });

  it('uses contextSummary (actual message) for unified learner, not detail (action label)', () => {
    const transcript = buildDialoguePublicTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('Popper would say this is unfalsifiable'),
      'Should use contextSummary content (actual learner message)');
    assert.equal(transcript.includes('asked_followup'), false,
      'Should NOT show action type label from detail field');
  });

  it('labels ego_superego learner messages as [Learner Ego]', () => {
    const transcript = buildDialoguePublicTranscript(TURNS_EGO_SUPEREGO, EGO_SUPEREGO_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('[Learner Ego]'),
      'Public transcript should contain [Learner Ego] for ego_superego learners');
  });

  it('never contains [Learner Action] for ego_superego learner', () => {
    const transcript = buildDialoguePublicTranscript(TURNS_EGO_SUPEREGO, EGO_SUPEREGO_TRACE, LEARNER_CONTEXT);
    assert.equal(transcript.includes('[Learner Action]'), false,
      'Public transcript must not contain [Learner Action] for ego_superego learners');
  });

  it('shows initial learner message at Turn 0', () => {
    const transcript = buildDialoguePublicTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('thesis plus antithesis equals synthesis'),
      'Should include initial learner message from learnerContext at Turn 0');
  });

  it('does not show superego or internal deliberation', () => {
    const transcript = buildDialoguePublicTranscript(TURNS_EGO_SUPEREGO, EGO_SUPEREGO_TRACE, LEARNER_CONTEXT);
    assert.equal(transcript.includes('[Learner Superego]'), false);
    assert.equal(transcript.includes('avoiding the harder question'), false,
      'Should not leak superego critique into public transcript');
  });
});

// ── buildDialogueFullTranscript ───────────────────────────────────────────

describe('buildDialogueFullTranscript', () => {
  it('never contains [Learner Action] for unified learner', () => {
    const transcript = buildDialogueFullTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.equal(transcript.includes('[Learner Action]'), false,
      'Full transcript must not contain [Learner Action] for unified learners');
  });

  it('labels unified learner messages as [Learner]', () => {
    const transcript = buildDialogueFullTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('[Learner]'),
      'Full transcript should contain [Learner] labels for unified learners');
  });

  it('uses contextSummary for unified learner turn_action entries', () => {
    const transcript = buildDialogueFullTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('Popper would say this is unfalsifiable'),
      'Should use contextSummary content for unified learners');
    assert.equal(transcript.includes('asked_followup'), false,
      'Should NOT show action type label from detail field');
  });

  it('never contains [Learner Action] for ego_superego learner', () => {
    const transcript = buildDialogueFullTranscript(TURNS_EGO_SUPEREGO, EGO_SUPEREGO_TRACE, LEARNER_CONTEXT);
    assert.equal(transcript.includes('[Learner Action]'), false,
      'Full transcript must not contain [Learner Action] for ego_superego learners');
  });

  it('shows learner deliberation chain for ego_superego learner', () => {
    const transcript = buildDialogueFullTranscript(TURNS_EGO_SUPEREGO, EGO_SUPEREGO_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('[Learner Ego]'), 'Should show learner ego');
    assert.ok(transcript.includes('[Learner Superego]'), 'Should show learner superego');
    assert.ok(transcript.includes('avoiding the harder question'),
      'Should include superego critique in full transcript');
  });

  it('suppresses turn_action for ego_superego learner (redundant with synthesis)', () => {
    const transcript = buildDialogueFullTranscript(TURNS_EGO_SUPEREGO, EGO_SUPEREGO_TRACE, LEARNER_CONTEXT);
    // The turn_action contextSummary for ego_superego is same as synthesis - should not appear separately
    const learnerLines = transcript.split('\n').filter(l => l.startsWith('[Learner'));
    const actionLines = learnerLines.filter(l => l.includes('asked_followup'));
    assert.equal(actionLines.length, 0,
      'Should not show raw turn_action for ego_superego learner');
  });

  it('deduplicates synthesis identical to revision', () => {
    const transcript = buildDialogueFullTranscript(TURNS_EGO_SUPEREGO, EGO_SUPEREGO_TRACE, LEARNER_CONTEXT);
    const synthesisLines = transcript.split('\n').filter(l => l.includes('(synthesis)'));
    assert.equal(synthesisLines.length, 0,
      'Synthesis identical to revision should be suppressed');
  });

  it('shows initial learner message at Turn 0', () => {
    const transcript = buildDialogueFullTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('thesis plus antithesis equals synthesis'),
      'Should include initial learner message at Turn 0');
  });
});

// ── extractInitialLearnerMessage ──────────────────────────────────────────

describe('extractInitialLearnerMessage', () => {
  it('extracts double-quoted message', () => {
    const ctx = '- User: "I am stuck on the dialectic"';
    assert.equal(extractInitialLearnerMessage(ctx), 'I am stuck on the dialectic');
  });

  it('extracts single-quoted message', () => {
    const ctx = "- User: 'I am stuck on the dialectic'";
    assert.equal(extractInitialLearnerMessage(ctx), 'I am stuck on the dialectic');
  });

  it('handles apostrophes in double-quoted message', () => {
    const ctx = '- User: "I\'ve been stuck on this for an hour"';
    assert.equal(extractInitialLearnerMessage(ctx), "I've been stuck on this for an hour");
  });

  it('returns null for missing context', () => {
    assert.equal(extractInitialLearnerMessage(null), null);
    assert.equal(extractInitialLearnerMessage('no user message here'), null);
  });
});
