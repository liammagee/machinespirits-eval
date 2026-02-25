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

  it('shows initial learner message at Turn 1', () => {
    const transcript = buildDialoguePublicTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('thesis plus antithesis equals synthesis'),
      'Should include initial learner message from learnerContext at Turn 1');
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

  it('shows initial learner message at Turn 1', () => {
    const transcript = buildDialogueFullTranscript(TURNS, UNIFIED_TRACE, LEARNER_CONTEXT);
    assert.ok(transcript.includes('thesis plus antithesis equals synthesis'),
      'Should include initial learner message at Turn 1');
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
    assert.ok(transcript.includes('[Tutor Ego] Initial draft about Popper'),
      'Ego label should show draft from suggestions[], not delivered message');
    // The delivered message appears separately under [Tutor → Learner]
    assert.ok(transcript.includes('[Tutor → Learner] Final delivered message'),
      'Delivered message should appear under [Tutor → Learner] label');
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

    // Turn 1 (display) should have the tutor ego and superego
    assert.ok(transcript.includes('--- Turn 1 ---'),
      'Should have Turn 1 header');
    assert.ok(transcript.includes('[Tutor Ego] Welcome to Hegel'),
      'Turn 1 ego should appear under Turn 1');
    assert.ok(transcript.includes('[Tutor Superego] Good opening'),
      'Turn 1 superego should appear under Turn 1');

    // Turn 2 (display) should have the learner message and tutor response
    assert.ok(transcript.includes('--- Turn 2 ---'),
      'Should have Turn 2 header');

    // Verify Turn 1 content appears before Turn 2 content
    const turn1Pos = transcript.indexOf('Welcome to Hegel');
    const turn2Pos = transcript.indexOf('Popper raises a fair critique');
    assert.ok(turn1Pos < turn2Pos,
      'Turn 1 content should appear before Turn 2 content');
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

  it('emits [Tutor → Learner] after superego approval on final_output', () => {
    // Multi-agent tutor: after ego draft → superego approve → final_output,
    // the delivered message should appear to close the deliberation section
    const trace = [
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Draft response about Hegel.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: true,
        feedback: 'Good approach to the dialectic.' },
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Turn 1 complete' },
    ];
    const turns = [{ turnIndex: 0, suggestions: [{ message: 'Draft response about Hegel.' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    // After superego approval, the delivered message should be visible
    assert.ok(transcript.includes('[Tutor → Learner]'),
      'Should emit [Tutor → Learner] label for delivered message');
    const lines = transcript.split('\n').filter(l => l.trim());
    const superegoIdx = lines.findIndex(l => l.includes('Good approach to the dialectic'));
    const deliveryIdx = lines.findIndex(l => l.includes('[Tutor → Learner]'));
    assert.ok(deliveryIdx > superegoIdx,
      'Delivered message should appear after superego approval');
  });

  it('does not emit [Tutor → Learner] for single-agent tutor (no final_output)', () => {
    // Single-agent tutor has no superego or final_output — ego IS the delivery
    const trace = [
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Direct response to learner.' }] },
      { agent: 'user', action: 'turn_action', turnIndex: 1,
        detail: 'Learner: asked_followup', contextSummary: 'What about Popper?' },
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Popper raises a valid point.' }] },
    ];
    const turns = [
      { turnIndex: 0, suggestions: [{ message: 'Direct response to learner.' }] },
      { turnIndex: 1, suggestions: [{ message: 'Popper raises a valid point.' }] },
    ];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    assert.ok(!transcript.includes('[Tutor → Learner]'),
      'Single-agent tutor should not have [Tutor → Learner] — ego IS the delivery');
    assert.ok(transcript.includes('[Tutor Ego] Direct response'),
      'Should still show the ego message');
    // Verify proper turn structure
    assert.ok(transcript.includes('--- Turn 1 ---'),
      'Single-agent should start at Turn 1');
    assert.ok(transcript.includes('--- Turn 2 ---'),
      'Single-agent should have Turn 2');
  });

  it('infers turnIndex from turn_action for single-agent cells (no final_output)', () => {
    // Single-agent cells have NO final_output entries.
    // Turn inference must use turn_action: preceding tutor entries belong to turnIndex-1.
    const trace = [
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Welcome to the course.' }] },
      // turn_action at turnIndex=1 means the preceding ego is Turn 0
      { agent: 'user', action: 'turn_action', turnIndex: 1,
        detail: 'Learner: asked_followup', contextSummary: 'Tell me about Hegel.' },
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Hegel is a key figure.' }] },
      { agent: 'user', action: 'turn_action', turnIndex: 2,
        detail: 'Learner: asked_followup', contextSummary: 'What about Popper?' },
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Popper critiques unfalsifiability.' }] },
    ];
    const turns = [
      { turnIndex: 0, suggestions: [{ message: 'Welcome to the course.' }] },
      { turnIndex: 1, suggestions: [{ message: 'Hegel is a key figure.' }] },
      { turnIndex: 2, suggestions: [{ message: 'Popper critiques unfalsifiability.' }] },
    ];
    const transcript = buildDialogueFullTranscript(turns, trace, null);

    // Verify sequential turns starting at Turn 1
    const turnNumbers = [...transcript.matchAll(/--- Turn (\d+) ---/g)]
      .map(m => parseInt(m[1], 10));
    assert.deepStrictEqual(turnNumbers, [1, 2, 3],
      'Should have Turn 1, 2, 3 (not starting at Turn 2)');

    // Verify content under correct turns
    const turn1Pos = transcript.indexOf('--- Turn 1 ---');
    const turn2Pos = transcript.indexOf('--- Turn 2 ---');
    const turn3Pos = transcript.indexOf('--- Turn 3 ---');
    const welcomePos = transcript.indexOf('Welcome to the course');
    const hegelPos = transcript.indexOf('Hegel is a key figure');
    const popperPos = transcript.indexOf('Popper critiques unfalsifiability');

    assert.ok(welcomePos > turn1Pos && welcomePos < turn2Pos,
      'Welcome should be under Turn 1');
    assert.ok(hegelPos > turn2Pos && hegelPos < turn3Pos,
      'Hegel should be under Turn 2');
    assert.ok(popperPos > turn3Pos,
      'Popper should be under Turn 3');
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

// ── Transcript conformity ─────────────────────────────────────────────────

describe('transcript conformity', () => {
  const MODES = [
    { name: 'public', build: buildDialoguePublicTranscript },
    { name: 'full', build: buildDialogueFullTranscript },
  ];
  const ARCHITECTURES = [
    { name: 'unified', turns: TURNS, trace: UNIFIED_TRACE },
    { name: 'ego_superego', turns: TURNS_EGO_SUPEREGO, trace: EGO_SUPEREGO_TRACE },
  ];

  for (const mode of MODES) {
    for (const arch of ARCHITECTURES) {
      const label = `${mode.name}/${arch.name}`;
      const transcript = mode.build(arch.turns, arch.trace, LEARNER_CONTEXT);

      it(`[${label}] never contains Turn 0`, () => {
        assert.equal(transcript.includes('--- Turn 0 ---'), false,
          `${label}: must not contain --- Turn 0 ---`);
      });

      it(`[${label}] starts at Turn 1`, () => {
        const firstTurnMatch = transcript.match(/--- Turn (\d+) ---/);
        assert.ok(firstTurnMatch, `${label}: should have at least one turn header`);
        assert.equal(firstTurnMatch[1], '1',
          `${label}: first turn header should be Turn 1, got Turn ${firstTurnMatch?.[1]}`);
      });

      it(`[${label}] has sequential turn numbers`, () => {
        const turnNumbers = [...transcript.matchAll(/--- Turn (\d+) ---/g)]
          .map(m => parseInt(m[1], 10));
        assert.ok(turnNumbers.length > 0, `${label}: should have turn headers`);
        for (let j = 1; j < turnNumbers.length; j++) {
          assert.equal(turnNumbers[j], turnNumbers[j - 1] + 1,
            `${label}: turns not sequential at position ${j}: ${turnNumbers[j - 1]} → ${turnNumbers[j]}`);
        }
      });

      it(`[${label}] has no empty agent labels`, () => {
        const emptyLabelPattern = /\[(Tutor|Learner)[^\]]*\]\s*$/m;
        const match = transcript.match(emptyLabelPattern);
        assert.equal(match, null,
          `${label}: found empty agent label: "${match?.[0]}"`);
      });

      it(`[${label}] never contains [Learner Action]`, () => {
        assert.equal(transcript.includes('[Learner Action]'), false,
          `${label}: must not contain [Learner Action]`);
      });

      it(`[${label}] every turn has learner + tutor content`, () => {
        const sections = transcript.split(/--- Turn \d+ ---/).filter(s => s.trim());
        for (let j = 0; j < sections.length; j++) {
          const section = sections[j];
          assert.ok(/\[Learner/.test(section),
            `${label}: Turn ${j + 1} missing [Learner...] line`);
          assert.ok(/\[Tutor/.test(section),
            `${label}: Turn ${j + 1} missing [Tutor...] line`);
        }
      });

      it(`[${label}] has no raw action labels`, () => {
        const rawActions = ['asked_followup', 'asked_question', 'expressed_confusion',
          'provided_answer', 'changed_topic', 'requested_hint'];
        for (const action of rawActions) {
          assert.equal(transcript.includes(action), false,
            `${label}: must not contain raw action label "${action}"`);
        }
      });

      it(`[${label}] learner content precedes tutor content in each turn`, () => {
        // Structural invariant: within each turn section, ALL [Learner...] lines
        // must appear before ALL [Tutor...] lines. This reflects the dialogue flow:
        //   Learner speaks → Tutor deliberates → Tutor delivers
        const sections = transcript.split(/--- Turn \d+ ---/).filter(s => s.trim());
        for (let j = 0; j < sections.length; j++) {
          const sectionLines = sections[j].split('\n').filter(l => l.trim());
          let lastLearnerIdx = -1;
          let firstTutorIdx = -1;
          for (let k = 0; k < sectionLines.length; k++) {
            if (sectionLines[k].startsWith('[Learner')) {
              lastLearnerIdx = k;
            }
            if (sectionLines[k].startsWith('[Tutor') && firstTutorIdx === -1) {
              firstTutorIdx = k;
            }
          }
          if (lastLearnerIdx >= 0 && firstTutorIdx >= 0) {
            assert.ok(lastLearnerIdx < firstTutorIdx,
              `${label}: Turn ${j + 1} has [Learner...] at line ${lastLearnerIdx} after [Tutor...] at line ${firstTutorIdx}`);
          }
        }
      });
    }
  }

  // ── Full deliberation chain ordering (multi-agent tutor + learner) ──────

  it('[full/ego_superego] follows LE → LS → LE → TE → TS → TE chain in multi-agent turns', () => {
    // Build a trace with complete deliberation chains for both sides
    const trace = [
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Opening about the dialectic.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: true,
        feedback: 'Good opening.' },
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Turn 1 complete' },
      // Turn 1: full learner chain + full tutor chain
      { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 1,
        detail: 'Initial learner thought.' },
      { agent: 'learner_superego', action: 'deliberation', turnIndex: 1,
        detail: 'Learner superego critique.' },
      { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 1,
        detail: 'Revised learner thought.' },
      { agent: 'learner_synthesis', action: 'response', turnIndex: 1,
        detail: 'Revised learner thought.' },  // Same as revision → deduped
      { agent: 'user', action: 'turn_action', turnIndex: 1,
        contextSummary: 'Revised learner thought.', detail: 'Learner: asked_followup' },
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Tutor draft response.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: false,
        feedback: 'Push deeper.' },
      { agent: 'ego', action: 'revise', round: 1,
        suggestions: [{ message: 'Tutor revised response.' }] },
      { agent: 'superego', action: 'review', round: 2, approved: true,
        feedback: 'Good revision.' },
      { agent: 'user', action: 'final_output', turnIndex: 1, detail: 'Turn 2 complete' },
    ];
    const turns = [
      { turnIndex: 0, suggestions: [{ message: 'Opening about the dialectic.' }] },
      { turnIndex: 1, suggestions: [{ message: 'Tutor revised response.' }] },
    ];
    const transcript = buildDialogueFullTranscript(turns, trace, 'User: "Starting question"');

    // Extract Turn 2 section (internal turn 1) which has the full deliberation chain
    const turn2Section = transcript.split('--- Turn 2 ---')[1]?.split('--- Turn 3 ---')[0] || '';
    const agentLines = turn2Section.split('\n')
      .filter(l => l.trim())
      .filter(l => /^\[(Learner|Tutor)/.test(l));

    // Expected order: LE, LS, LE(revised), TE, TS, TE(revised), TS, [Tutor → Learner]
    const expectedPrefixes = [
      '[Learner Ego]',
      '[Learner Superego]',
      '[Learner Ego] (revised)',
      '[Tutor Ego]',
      '[Tutor Superego]',
      '[Tutor Ego] (revised)',
      '[Tutor Superego]',
      '[Tutor → Learner]',
    ];

    assert.equal(agentLines.length, expectedPrefixes.length,
      `Expected ${expectedPrefixes.length} agent lines, got ${agentLines.length}:\n${agentLines.join('\n')}`);

    for (let k = 0; k < expectedPrefixes.length; k++) {
      assert.ok(agentLines[k].startsWith(expectedPrefixes[k]),
        `Line ${k}: expected "${expectedPrefixes[k]}...", got "${agentLines[k].slice(0, 40)}..."`);
    }
  });

  it('[full/unified] follows [Learner] → [Tutor Ego] chain in single-agent turns', () => {
    // Single-agent tutor + unified learner: simplest ordering
    const trace = [
      { agent: 'user', action: 'context_input', turnIndex: 0 },
      { agent: 'ego', action: 'generate', turnIndex: 0 },
      { agent: 'user', action: 'turn_action', turnIndex: 1,
        detail: 'Learner: asked_followup', contextSummary: 'What about Popper?' },
      { agent: 'ego', action: 'generate', turnIndex: 1 },
    ];
    const turns = [
      { turnIndex: 0, suggestions: [{ message: 'Welcome.' }] },
      { turnIndex: 1, suggestions: [{ message: 'Good question.' }] },
    ];
    const transcript = buildDialogueFullTranscript(turns, trace, 'User: "Opening question"');

    // Turn 2 section
    const turn2Section = transcript.split('--- Turn 2 ---')[1] || '';
    const agentLines = turn2Section.split('\n')
      .filter(l => l.trim())
      .filter(l => /^\[(Learner|Tutor)/.test(l));

    const expectedPrefixes = ['[Learner]', '[Tutor Ego]'];
    assert.equal(agentLines.length, expectedPrefixes.length,
      `Expected ${expectedPrefixes.length} agent lines, got ${agentLines.length}:\n${agentLines.join('\n')}`);
    for (let k = 0; k < expectedPrefixes.length; k++) {
      assert.ok(agentLines[k].startsWith(expectedPrefixes[k]),
        `Line ${k}: expected "${expectedPrefixes[k]}...", got "${agentLines[k].slice(0, 40)}..."`);
    }
  });
});
