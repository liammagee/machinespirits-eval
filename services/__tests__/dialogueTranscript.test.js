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

  it('renders tutor superego feedback from feedback field (not just detail/contextSummary)', () => {
    // Real superego trace entries store review text in `feedback`, not `detail` or `contextSummary`
    const traceWithFeedback = [
      { agent: 'user', action: 'context_input', turnIndex: 0, detail: '', contextSummary: '' },
      { agent: 'ego', action: 'generate', turnIndex: 0, detail: 'Here is my response.', contextSummary: '' },
      { agent: 'superego', action: 'review', turnIndex: 0, feedback: 'Push harder on the paradox of recognition.' },
      { agent: 'ego', action: 'revise', turnIndex: 0, detail: 'Revised response with more depth.', contextSummary: '' },
    ];
    const turns = [{ turnIndex: 0, turnId: 'turn_0', suggestions: [{ message: 'Revised response with more depth.' }] }];
    const transcript = buildDialogueFullTranscript(turns, traceWithFeedback, null);
    assert.ok(transcript.includes('Push harder on the paradox'),
      'Should render superego feedback from the feedback field');
    assert.ok(transcript.includes('[Tutor Superego]'),
      'Should have Tutor Superego label');
  });

  it('does not render empty superego when feedback/detail/contextSummary all absent', () => {
    // Superego entry with no text fields at all should still render (empty is valid, but not garbled)
    const trace = [
      { agent: 'user', action: 'context_input', turnIndex: 0 },
      { agent: 'ego', action: 'generate', turnIndex: 0 },
      { agent: 'superego', action: 'review', turnIndex: 0, approved: true },
      { agent: 'ego', action: 'revise', turnIndex: 0 },
    ];
    const turns = [{ turnIndex: 0, turnId: 'turn_0', suggestions: [{ message: 'Response.' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    assert.ok(transcript.includes('[Tutor Superego]'),
      'Should still emit the label for superego');
  });

  it('renders ego text from turnResults when detail/contextSummary are empty', () => {
    // Real ego/generate entries have empty detail and contextSummary;
    // text must come from turnResults delivered messages
    const trace = [
      { agent: 'user', action: 'context_input', turnIndex: 0 },
      { agent: 'ego', action: 'generate', turnIndex: 0 },
    ];
    const turns = [{ turnIndex: 0, turnId: 'turn_0', suggestions: [{ message: 'Welcome to Hegel.' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    assert.ok(transcript.includes('Welcome to Hegel'),
      'Should fall back to turnResults when ego detail/contextSummary are empty');
  });

  it('renders all tutor agent types with correct labels', () => {
    const trace = [
      { agent: 'user', action: 'context_input', turnIndex: 0 },
      { agent: 'ego', action: 'generate', turnIndex: 0, detail: 'Initial response.' },
      { agent: 'superego', action: 'review', turnIndex: 0, feedback: 'Consider the dialectic.' },
      { agent: 'ego', action: 'revise', turnIndex: 0, detail: 'Revised response.' },
      { agent: 'ego_self_reflection', action: 'rewrite', turnIndex: 0, detail: 'I reflected on my approach.' },
      { agent: 'superego_self_reflection', action: 'rewrite', turnIndex: 0, detail: 'My critiquing was too soft.' },
      { agent: 'ego_intersubjective', action: 'respond_to_critic', turnIndex: 0, detail: 'I agree with the self-reflection.' },
      { agent: 'ego_strategy', action: 'plan', turnIndex: 0, detail: 'Strategy: push on paradox.' },
      { agent: 'tutor_other_ego', action: 'profile_learner', turnIndex: 0, detail: 'Learner is a strong critic.' },
      { agent: 'behavioral_overrides', action: 'parse', turnIndex: 0, contextSummary: 'Threshold=0.6' },
      { agent: 'superego_disposition', action: 'rewrite', turnIndex: 0, detail: 'Disposition evolved toward advocacy.' },
    ];
    const turns = [{ turnIndex: 0, turnId: 'turn_0', suggestions: [{ message: 'Revised response.' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);

    assert.ok(transcript.includes('[Tutor Ego] Initial response'), 'ego generate');
    assert.ok(transcript.includes('[Tutor Superego] Consider the dialectic'), 'superego review');
    assert.ok(transcript.includes('[Tutor Ego] (revised) Revised response'), 'ego revise');
    assert.ok(transcript.includes('[Tutor Self-Reflection] I reflected'), 'ego self-reflection');
    assert.ok(transcript.includes('[Tutor Superego Reflection] My critiquing'), 'superego self-reflection');
    assert.ok(transcript.includes('[Tutor Intersubjective] I agree'), 'ego intersubjective');
    assert.ok(transcript.includes('[Tutor Strategy] Strategy: push'), 'ego strategy');
    assert.ok(transcript.includes('[Tutor Other-Ego] Learner is a strong'), 'tutor other-ego');
    assert.ok(transcript.includes('[Behavioral Overrides] Threshold=0.6'), 'behavioral overrides');
    assert.ok(transcript.includes('[Tutor Superego Disposition] Disposition evolved'), 'superego disposition');
  });

  it('renders learner_other_ego with correct label', () => {
    const trace = [
      { agent: 'user', action: 'context_input', turnIndex: 0 },
      { agent: 'ego', action: 'generate', turnIndex: 0 },
      { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 1, detail: 'My initial thought.' },
      { agent: 'learner_other_ego', action: 'profile_tutor', turnIndex: 1, detail: 'Tutor seems Socratic.' },
      { agent: 'learner_superego', action: 'deliberation', turnIndex: 1, detail: 'Dig deeper.' },
      { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 1, detail: 'Revised thought.' },
      { agent: 'learner_synthesis', action: 'response', turnIndex: 1, detail: 'Final message.' },
      { agent: 'user', action: 'turn_action', turnIndex: 1, detail: 'Learner: asked_followup', contextSummary: 'Final message.' },
      { agent: 'ego', action: 'generate', turnIndex: 1 },
    ];
    const turns = [
      { turnIndex: 0, turnId: 'turn_0', suggestions: [{ message: 'Welcome.' }] },
      { turnIndex: 1, turnId: 'turn_1', suggestions: [{ message: 'Good point.' }] },
    ];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    assert.ok(transcript.includes('[Learner Other-Ego] Tutor seems Socratic'),
      'Should render learner other-ego profile');
  });

  it('prefers contextSummary over detail for behavioral_overrides', () => {
    const trace = [
      { agent: 'user', action: 'context_input', turnIndex: 0 },
      { agent: 'behavioral_overrides', action: 'parse', turnIndex: 0,
        contextSummary: 'Quantitative behavioral params: threshold=0.6',
        detail: '{"rejection_threshold":0.6}' },
      { agent: 'ego', action: 'generate', turnIndex: 0 },
    ];
    const turns = [{ turnIndex: 0, turnId: 'turn_0', suggestions: [{ message: 'Hello.' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    assert.ok(transcript.includes('Quantitative behavioral params'),
      'Should use contextSummary (human-readable) not detail (raw JSON)');
  });

  // ── Regression tests: tutor-core trace entries (no turnIndex, suggestions field) ──

  it('uses suggestions[].message for ego entries instead of deliveredByTurn', () => {
    // Tutor-core ego/generate entries carry draft text in suggestions[],
    // NOT in detail/contextSummary. The draft may differ from the final delivered message.
    const trace = [
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Initial draft about Popper.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: true,
        feedback: 'Good approach.' },
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Turn 1 complete' },
    ];
    const turns = [{ turnIndex: 0, suggestions: [{ message: 'Final delivered message (different).' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    assert.ok(transcript.includes('Initial draft about Popper'),
      'Should show the ego draft from suggestions[], not the final delivered message');
    assert.ok(!transcript.includes('Final delivered message'),
      'Should NOT show deliveredByTurn text when suggestions[] is available');
  });

  it('shows ego revision between two superego reviews (no consecutive superego lines)', () => {
    // When superego rejects and ego revises, the revision must appear between
    // the two superego reviews — not be deduped away.
    const trace = [
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'You spent 30 minutes on this.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: false,
        feedback: '30 minutes is not evidenced. Use 120 events instead.' },
      { agent: 'ego', action: 'revise', round: 1,
        suggestions: [{ message: 'Over 120 events across 7 sessions, you circled this tension.' }] },
      { agent: 'superego', action: 'review', round: 2, approved: true,
        feedback: 'Excellent revision. Data specificity maintained.' },
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Turn 1 complete' },
    ];
    const turns = [{ turnIndex: 0, suggestions: [{ message: 'Over 120 events across 7 sessions, you circled this tension.' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);

    // Verify correct sequence: ego draft → superego reject → ego revised → superego approve
    assert.ok(transcript.includes('[Tutor Ego] You spent 30 minutes'),
      'Should show initial ego draft');
    assert.ok(transcript.includes('[Tutor Superego] 30 minutes is not evidenced'),
      'Should show first superego review (rejection)');
    assert.ok(transcript.includes('[Tutor Ego] (revised) Over 120 events'),
      'Should show ego revision between the two superego reviews');
    assert.ok(transcript.includes('[Tutor Superego] Excellent revision'),
      'Should show second superego review (approval)');

    // Verify no consecutive superego lines (the original bug)
    const transcriptLines = transcript.split('\n').filter(l => l.trim());
    for (let i = 0; i < transcriptLines.length - 1; i++) {
      if (transcriptLines[i].startsWith('[Tutor Superego]') &&
          transcriptLines[i + 1].startsWith('[Tutor Superego]')) {
        assert.fail('Found consecutive [Tutor Superego] lines — ego revision is missing between them');
      }
    }
  });

  it('infers turnIndex for tutor-core entries that lack it', () => {
    // Real tutor-core entries use `round` instead of `turnIndex`.
    // The function must infer turn from the subsequent final_output entry.
    const trace = [
      // Turn 0 tutor deliberation (no turnIndex on tutor-core entries)
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Welcome to Hegel.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: true,
        feedback: 'Good opening.' },
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Turn 1 complete' },
      // Turn 1 learner + tutor
      { agent: 'user', action: 'turn_action', turnIndex: 1,
        detail: 'Learner: asked_followup', contextSummary: 'What about Popper?' },
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Popper raises a fair critique.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: true,
        feedback: 'Addresses the question.' },
      { agent: 'user', action: 'final_output', turnIndex: 1, detail: 'Turn 2 complete' },
    ];
    const turns = [
      { turnIndex: 0, suggestions: [{ message: 'Welcome to Hegel.' }] },
      { turnIndex: 1, suggestions: [{ message: 'Popper raises a fair critique.' }] },
    ];
    const transcript = buildDialogueFullTranscript(turns, trace, null);

    // Turn 0 should have the tutor ego and superego
    assert.ok(transcript.includes('--- Turn 0 ---'),
      'Should have Turn 0 header');
    assert.ok(transcript.includes('[Tutor Ego] Welcome to Hegel'),
      'Turn 0 ego should appear under Turn 0');
    assert.ok(transcript.includes('[Tutor Superego] Good opening'),
      'Turn 0 superego should appear under Turn 0');

    // Turn 1 should have the learner message and tutor response
    assert.ok(transcript.includes('--- Turn 1 ---'),
      'Should have Turn 1 header');

    // Verify Turn 0 content appears before Turn 1 content
    const turn0Pos = transcript.indexOf('Welcome to Hegel');
    const turn1Pos = transcript.indexOf('Popper raises a fair critique');
    assert.ok(turn0Pos < turn1Pos,
      'Turn 0 content should appear before Turn 1 content');
  });

  it('handles Turn 0 tutor-core entries before any final_output (no empty ego text)', () => {
    // Before the fix, Turn 0 tutor-core entries had currentTurnIdx=-1,
    // causing deliveredByTurn[-1]=undefined and empty [Tutor Ego] output
    const trace = [
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Your dialectic analogy breaks down.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: true,
        feedback: 'Directly addresses the misconception.' },
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Turn 1 complete' },
    ];
    const turns = [{ turnIndex: 0, suggestions: [{ message: 'Your dialectic analogy breaks down.' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);

    assert.ok(transcript.includes('[Tutor Ego] Your dialectic analogy'),
      'Turn 0 ego should have content from suggestions[], not be empty');
    assert.ok(transcript.includes('[Tutor Superego] Directly addresses'),
      'Turn 0 superego should have feedback content');
    // Should not have empty labels
    assert.ok(!transcript.includes('[Tutor Ego] \n'),
      'Should not have empty [Tutor Ego] line');
  });

  it('still falls back to deliveredByTurn when suggestions[] is absent', () => {
    // Backward compatibility: if trace entries have detail (eval-runner style)
    // or neither detail nor suggestions, deliveredByTurn is the fallback
    const trace = [
      { agent: 'user', action: 'context_input', turnIndex: 0 },
      { agent: 'ego', action: 'generate', turnIndex: 0 },
    ];
    const turns = [{ turnIndex: 0, suggestions: [{ message: 'Fallback delivered text.' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    assert.ok(transcript.includes('Fallback delivered text'),
      'Should fall back to deliveredByTurn when no suggestions on trace entry');
  });

  it('prefers entry.suggestions over entry.detail for ego entries', () => {
    // If both suggestions[] and detail exist, suggestions takes priority
    // (detail on ego entries is typically empty, but test the precedence)
    const trace = [
      { agent: 'user', action: 'context_input', turnIndex: 0 },
      { agent: 'ego', action: 'generate', turnIndex: 0,
        detail: 'detail text',
        suggestions: [{ message: 'suggestions text' }] },
      { agent: 'user', action: 'final_output', turnIndex: 0 },
    ];
    const turns = [{ turnIndex: 0, suggestions: [{ message: 'delivered text' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    assert.ok(transcript.includes('suggestions text'),
      'Should prefer suggestions[].message over detail');
    assert.ok(!transcript.includes('detail text'),
      'Should not use detail when suggestions[] is available');
  });

  it('handles multi-turn with tutor-core entries and ego_superego learner', () => {
    // Full realistic trace: tutor-core entries (no turnIndex) interleaved with
    // eval-runner entries (turnIndex), ego_superego learner architecture
    const trace = [
      // Turn 0: tutor deliberation
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Consider the master-servant dialectic.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: true,
        feedback: 'Appropriate level.' },
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Turn 1 complete' },
      { agent: 'ego_self_reflection', action: 'rewrite', turnIndex: 0,
        detail: 'I should push harder on the paradox.' },
      // Turn 1: learner deliberation + tutor response
      { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 1,
        detail: 'I think this is about power.' },
      { agent: 'learner_superego', action: 'deliberation', turnIndex: 1,
        detail: 'Too simplistic, dig into asymmetry.' },
      { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 1,
        detail: 'The real question is asymmetric recognition.' },
      { agent: 'learner_synthesis', action: 'response', turnIndex: 1,
        detail: 'The real question is asymmetric recognition.' },
      { agent: 'user', action: 'turn_action', turnIndex: 1,
        detail: 'Learner: asked_followup',
        contextSummary: 'The real question is asymmetric recognition.' },
      // Turn 1: tutor deliberation (no turnIndex on tutor-core entries)
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Draft: you are right about asymmetry.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: false,
        feedback: 'Too agreeable. Challenge the learner.' },
      { agent: 'ego', action: 'revise', round: 1,
        suggestions: [{ message: 'Asymmetry is key, but what happens when the master wins?' }] },
      { agent: 'superego', action: 'review', round: 2, approved: true,
        feedback: 'Good dialectical challenge.' },
      { agent: 'user', action: 'final_output', turnIndex: 1, detail: 'Turn 2 complete' },
    ];
    const turns = [
      { turnIndex: 0, suggestions: [{ message: 'Consider the master-servant dialectic.' }] },
      { turnIndex: 1, suggestions: [{ message: 'Asymmetry is key, but what happens when the master wins?' }] },
    ];
    const transcript = buildDialogueFullTranscript(turns, trace, null);

    // Turn 0: tutor ego + superego + self-reflection
    assert.ok(transcript.includes('[Tutor Ego] Consider the master-servant'),
      'Turn 0 ego from suggestions[]');
    assert.ok(transcript.includes('[Tutor Superego] Appropriate level'),
      'Turn 0 superego feedback');
    assert.ok(transcript.includes('[Tutor Self-Reflection] I should push harder'),
      'Turn 0 self-reflection');

    // Turn 1: learner deliberation + tutor two-round deliberation
    assert.ok(transcript.includes('[Learner Ego] I think this is about power'),
      'Learner ego initial');
    assert.ok(transcript.includes('[Learner Superego] Too simplistic'),
      'Learner superego');
    assert.ok(transcript.includes('[Tutor Ego] Draft: you are right'),
      'Turn 1 ego draft from suggestions[]');
    assert.ok(transcript.includes('[Tutor Superego] Too agreeable'),
      'Turn 1 first superego review');
    assert.ok(transcript.includes('[Tutor Ego] (revised) Asymmetry is key'),
      'Turn 1 ego revision from suggestions[]');
    assert.ok(transcript.includes('[Tutor Superego] Good dialectical challenge'),
      'Turn 1 second superego review');

    // Verify no consecutive superego lines
    const transcriptLines = transcript.split('\n').filter(l => l.trim());
    for (let i = 0; i < transcriptLines.length - 1; i++) {
      if (transcriptLines[i].startsWith('[Tutor Superego]') &&
          transcriptLines[i + 1].startsWith('[Tutor Superego]')) {
        assert.fail(`Consecutive [Tutor Superego] at lines ${i} and ${i+1}: "${transcriptLines[i]}" / "${transcriptLines[i+1]}"`);
      }
    }
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
