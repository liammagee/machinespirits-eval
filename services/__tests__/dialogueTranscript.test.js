import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDialoguePublicTranscript,
  buildDialogueFullTranscript,
  isEgoSuperegoLearner,
  extractInitialLearnerMessage,
} from '../rubricEvaluator.js';
import {
  buildMultiTurnContext,
  formatTurnForContext,
} from '../evaluationRunner.js';

// ── Test fixtures ─────────────────────────────────────────────────────────

/** Unified (ego-only) learner trace — no learner/ego_initial entries */
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
  { agent: 'learner', action: 'final_output', turnIndex: 1, detail: 'OK the real question is about asymmetric recognition.', contextSummary: '' },
  { agent: 'user', action: 'turn_action', turnIndex: 1, detail: 'Learner: asked_followup', contextSummary: 'OK the real question is about asymmetric recognition.' },
  { agent: 'ego', action: 'generate', turnIndex: 1, detail: 'Good insight on asymmetry.', contextSummary: '' },
  { agent: 'superego', action: 'review', turnIndex: 1, detail: 'Push harder on the paradox.', contextSummary: '' },
  { agent: 'ego', action: 'revise', turnIndex: 1, detail: 'You identified asymmetry - now what happens when the master wins?', contextSummary: '' },
];

/** Ego+superego learner trace variant where learner/final_output is missing after turn 1 */
const EGO_SUPEREGO_TRACE_NO_SYNTH = [
  { agent: 'user', action: 'context_input', turnIndex: 0, detail: '', contextSummary: '' },
  { agent: 'ego', action: 'generate', turnIndex: 0, detail: '', contextSummary: '' },
  { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 1, detail: 'Initial learner ego thought', contextSummary: '' },
  { agent: 'learner_superego', action: 'deliberation', turnIndex: 1, detail: 'Initial learner critique', contextSummary: '' },
  { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 1, detail: 'Initial learner revision', contextSummary: '' },
  { agent: 'user', action: 'turn_action', turnIndex: 1, detail: 'Learner: asked_followup', contextSummary: 'Could we unpack fear and labour more slowly?' },
  { agent: 'ego', action: 'generate', turnIndex: 1, detail: '', contextSummary: '' },
  { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 2, detail: 'Second learner ego thought', contextSummary: '' },
  { agent: 'learner_superego', action: 'deliberation', turnIndex: 2, detail: 'Second learner critique', contextSummary: '' },
  { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 2, detail: 'Second learner revision', contextSummary: '' },
  { agent: 'user', action: 'turn_action', turnIndex: 2, detail: 'Learner: asked_followup', contextSummary: 'I can track paragraph 196 now, but still not the negation of negation.' },
  { agent: 'ego', action: 'generate', turnIndex: 2, detail: '', contextSummary: '' },
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

const TURNS_EGO_SUPEREGO_THREE = [
  { turnIndex: 0, turnId: 'turn_0', suggestions: [{ message: 'Turn 1 tutor response.' }] },
  { turnIndex: 1, turnId: 'turn_1', suggestions: [{ message: 'Turn 2 tutor response.' }] },
  { turnIndex: 2, turnId: 'turn_2', suggestions: [{ message: 'Turn 3 tutor response.' }] },
];

const LEARNER_CONTEXT = '### Recent Chat History\n- User: "I think the dialectic is just thesis plus antithesis equals synthesis"';

// ── isEgoSuperegoLearner ──────────────────────────────────────────────────

describe('isEgoSuperegoLearner', () => {
  it('returns true when trace has learner', () => {
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

  it('falls back to turn_action learner message when ego_superego synthesis entries are missing', () => {
    const transcript = buildDialoguePublicTranscript(TURNS_EGO_SUPEREGO_THREE, EGO_SUPEREGO_TRACE_NO_SYNTH, LEARNER_CONTEXT);
    assert.ok(transcript.includes('Could we unpack fear and labour more slowly?'),
      'Should include turn_action contextSummary for turn 2 when learner/final_output is missing');
    assert.ok(transcript.includes('I can track paragraph 196 now, but still not the negation of negation.'),
      'Should include turn_action contextSummary for turn 3 when learner/final_output is missing');
  });

  it('stays balanced across turns for ego_superego traces without learner/final_output', () => {
    const transcript = buildDialoguePublicTranscript(TURNS_EGO_SUPEREGO_THREE, EGO_SUPEREGO_TRACE_NO_SYNTH, LEARNER_CONTEXT);
    const sections = transcript.split(/--- Turn \d+ ---/).filter(s => s.trim());
    assert.equal(sections.length, 3, 'Expected 3 turn sections');
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      assert.ok(/\[Learner/.test(section), `Turn ${i + 1} missing learner line`);
      assert.ok(/\[Tutor/.test(section), `Turn ${i + 1} missing tutor line`);
    }
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
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Turn 1 complete' },
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
      { agent: 'learner', action: 'final_output', turnIndex: 1, detail: 'Final message.' },
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
    // Delivery appears as [Tutor Ego] (revised) when delivered text differs from initial draft
    assert.ok(transcript.includes('[Tutor Ego] (revised) Final delivered message (different)'),
      'Should emit [Tutor Ego] (revised) when delivered text differs from initial draft');
  });

  it('collapses multi-round deliberation to TE → TS → TE(revised) pattern', () => {
    // Multi-round: ego/generate → superego reject → ego/revise → superego approve → final_output
    // Collapsed output: only initial draft, first review, and final delivery (when revised)
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

    // Collapsed pattern: initial draft → first review → final delivery (revised)
    assert.ok(transcript.includes('[Tutor Ego] You spent 30 minutes'),
      'Should show initial ego draft');
    assert.ok(transcript.includes('[Tutor Superego] 30 minutes is not evidenced'),
      'Should show first superego review');
    assert.ok(transcript.includes('[Tutor Ego] (revised) Over 120 events'),
      'Should show final delivered message as [Tutor Ego] (revised)');

    // Intermediate rounds are skipped: no second superego, no ego/revise line
    assert.ok(!transcript.includes('Excellent revision'),
      'Should NOT show second superego review (collapsed)');

    // Exactly 3 tutor agent lines
    const tutorLines = transcript.split('\n').filter(l => /^\[Tutor/.test(l));
    assert.equal(tutorLines.length, 3,
      `Expected 3 tutor lines (TE → TS → TE revised), got ${tutorLines.length}:\n${tutorLines.join('\n')}`);
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

  it('approved-without-revision still emits final TE (TS must never conclude a turn)', () => {
    // Even when TS approves the initial draft unchanged, the ego must have the
    // final word — TS never concludes a turn. Pattern: TE → TS → TE (same text).
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
    const lines = transcript.split('\n').filter(l => l.startsWith('[Tutor'));
    assert.equal(lines.length, 3, `Expected 3 tutor lines (TE→TS→TE), got ${lines.length}:\n${lines.join('\n')}`);
    assert.ok(lines[0].startsWith('[Tutor Ego]'), 'First: TE draft');
    assert.ok(lines[1].startsWith('[Tutor Superego]'), 'Second: TS review');
    assert.ok(lines[2].startsWith('[Tutor Ego]'), 'Third: TE final (same text, not revised)');
    // Not labelled "(revised)" since text unchanged
    assert.ok(!lines[2].includes('(revised)'), 'Should not say (revised) when text unchanged');
  });

  it('single-agent tutor: ego is the only tutor line per turn', () => {
    // Single-agent tutor has no superego or final_output — just [Tutor Ego]
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
      'Single-agent tutor should not have [Tutor → Learner]');
    assert.ok(!transcript.includes('[Tutor Superego]'),
      'Single-agent tutor should not have superego lines');
    assert.ok(transcript.includes('[Tutor Ego] Direct response'),
      'Turn 1 ego message');
    assert.ok(transcript.includes('[Tutor Ego] Popper raises'),
      'Turn 2 ego message');
    assert.ok(transcript.includes('--- Turn 1 ---'),
      'Should start at Turn 1');
    assert.ok(transcript.includes('--- Turn 2 ---'),
      'Should have Turn 2');
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
      { agent: 'learner', action: 'final_output', turnIndex: 1,
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

    // Turn 1: learner deliberation + tutor collapsed deliberation
    assert.ok(transcript.includes('[Learner Ego] I think this is about power'),
      'Learner ego initial');
    assert.ok(transcript.includes('[Learner Superego] Too simplistic'),
      'Learner superego');
    assert.ok(transcript.includes('[Tutor Ego] Draft: you are right'),
      'Turn 1 ego draft from suggestions[]');
    assert.ok(transcript.includes('[Tutor Superego] Too agreeable'),
      'Turn 1 first superego review');
    assert.ok(transcript.includes('[Tutor Ego] (revised) Asymmetry is key'),
      'Turn 1 final delivery (revised, from final_output)');
    // Second superego review is collapsed (not shown)
    assert.ok(!transcript.includes('Good dialectical challenge'),
      'Should NOT show second superego review (collapsed)');

    // Verify TS→TE invariant: every [Tutor Superego] followed by [Tutor Ego]
    const transcriptLines = transcript.split('\n').filter(l => l.trim());
    const agentLines = transcriptLines.filter(l => /^\[(Tutor|Learner)/.test(l));
    for (let i = 0; i < agentLines.length; i++) {
      if (agentLines[i].startsWith('[Tutor Superego]')) {
        assert.ok(i + 1 < agentLines.length && agentLines[i + 1].startsWith('[Tutor Ego]'),
          `[Tutor Superego] at index ${i} not followed by [Tutor Ego]: next="${agentLines[i + 1]?.slice(0, 50)}"`);
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

  // ── Structural invariants: every Superego followed by Ego ────────────────

  it('[full] every [Tutor Superego] is followed by [Tutor Ego] (TS→TE invariant)', () => {
    // The core structural rule: TS must never be the last agent line in a turn.
    // After every [Tutor Superego], there must be a [Tutor Ego] — either a
    // revision (when superego rejects) or the delivery (from final_output).
    const trace = [
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Draft about Hegel.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: false,
        feedback: 'Push harder on the paradox.' },
      { agent: 'ego', action: 'revise', round: 1,
        suggestions: [{ message: 'Revised: the paradox of recognition.' }] },
      { agent: 'superego', action: 'review', round: 2, approved: true,
        feedback: 'Good revision.' },
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Done' },
    ];
    const turns = [{ turnIndex: 0, suggestions: [{ message: 'Revised: the paradox of recognition.' }] }];
    const transcript = buildDialogueFullTranscript(turns, trace, null);
    const agentLines = transcript.split('\n')
      .filter(l => /^\[(Tutor|Learner)/.test(l));

    for (let i = 0; i < agentLines.length; i++) {
      if (agentLines[i].startsWith('[Tutor Superego]')) {
        assert.ok(i + 1 < agentLines.length,
          `[Tutor Superego] at line ${i} is the last agent line — must be followed by [Tutor Ego]`);
        assert.ok(agentLines[i + 1].startsWith('[Tutor Ego]'),
          `[Tutor Superego] at line ${i} followed by "${agentLines[i + 1].slice(0, 40)}" — expected [Tutor Ego]`);
      }
    }
  });

  it('[full] every [Learner Superego] is followed by [Learner Ego] (LS→LE invariant)', () => {
    // Symmetric with tutor: every [Learner Superego] must be followed by [Learner Ego].
    const transcript = buildDialogueFullTranscript(TURNS_EGO_SUPEREGO, EGO_SUPEREGO_TRACE, LEARNER_CONTEXT);
    const agentLines = transcript.split('\n')
      .filter(l => /^\[(Tutor|Learner)/.test(l));

    for (let i = 0; i < agentLines.length; i++) {
      if (agentLines[i].startsWith('[Learner Superego]')) {
        assert.ok(i + 1 < agentLines.length,
          `[Learner Superego] at line ${i} is the last agent line — must be followed by [Learner Ego]`);
        assert.ok(agentLines[i + 1].startsWith('[Learner Ego]'),
          `[Learner Superego] at line ${i} followed by "${agentLines[i + 1].slice(0, 40)}" — expected [Learner Ego]`);
      }
    }
  });

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
      { agent: 'learner', action: 'final_output', turnIndex: 1,
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

    // Expected order: symmetric collapsed deliberation chains
    // Learner: LE → LS → LE(revised)
    // Tutor:   TE → TS → TE(revised)  [intermediate rounds collapsed]
    const expectedPrefixes = [
      '[Learner Ego]',
      '[Learner Superego]',
      '[Learner Ego] (revised)',
      '[Tutor Ego]',
      '[Tutor Superego]',
      '[Tutor Ego] (revised)',
    ];

    assert.equal(agentLines.length, expectedPrefixes.length,
      `Expected ${expectedPrefixes.length} agent lines, got ${agentLines.length}:\n${agentLines.join('\n')}`);

    for (let k = 0; k < expectedPrefixes.length; k++) {
      assert.ok(agentLines[k].startsWith(expectedPrefixes[k]),
        `Line ${k}: expected "${expectedPrefixes[k]}...", got "${agentLines[k].slice(0, 40)}..."`);
    }
  });

  // ── Chronological ordering ──────────────────────────────────────────────

  it('[full/ego_superego] transcript lines follow trace chronological order', () => {
    // The transcript must preserve the order of the trace — if entry A precedes
    // entry B in the trace, A's line must precede B's line in the transcript.
    const trace = [
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Opening about recognition.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: true,
        feedback: 'Solid opening approach.' },
      { agent: 'user', action: 'final_output', turnIndex: 0, detail: 'Done' },
      // Turn 1
      { agent: 'learner_ego_initial', action: 'deliberation', turnIndex: 1,
        detail: 'I wonder about the master.' },
      { agent: 'learner_superego', action: 'deliberation', turnIndex: 1,
        detail: 'Dig into the asymmetry more.' },
      { agent: 'learner_ego_revision', action: 'deliberation', turnIndex: 1,
        detail: 'The asymmetry of recognition is key.' },
      { agent: 'learner', action: 'final_output', turnIndex: 1,
        detail: 'The asymmetry of recognition is key.' },
      { agent: 'user', action: 'turn_action', turnIndex: 1,
        contextSummary: 'The asymmetry of recognition is key.', detail: 'Learner: asked_followup' },
      { agent: 'user', action: 'context_input', round: 0 },
      { agent: 'ego', action: 'generate', round: 0,
        suggestions: [{ message: 'Yes, asymmetry drives the dialectic.' }] },
      { agent: 'superego', action: 'review', round: 1, approved: false,
        feedback: 'Challenge the learner more.' },
      { agent: 'ego', action: 'revise', round: 1,
        suggestions: [{ message: 'Asymmetry drives the dialectic — but what if it collapses?' }] },
      { agent: 'superego', action: 'review', round: 2, approved: true,
        feedback: 'Good dialectical tension now.' },
      { agent: 'user', action: 'final_output', turnIndex: 1, detail: 'Done' },
    ];
    const turns = [
      { turnIndex: 0, suggestions: [{ message: 'Opening about recognition.' }] },
      { turnIndex: 1, suggestions: [{ message: 'Asymmetry drives the dialectic — but what if it collapses?' }] },
    ];
    const transcript = buildDialogueFullTranscript(turns, trace, 'User: "What is recognition?"');

    // Extract ordered markers — each must appear later in the transcript than the previous
    // Intermediate deliberation rounds (ego/revise, second superego) are collapsed
    const markers = [
      'Opening about recognition',           // Turn 1 tutor ego (draft)
      'Solid opening approach',              // Turn 1 tutor superego
      'Opening about recognition',           // Turn 1 tutor ego (final, same text = approved)
      'I wonder about the master',           // Turn 2 learner ego
      'Dig into the asymmetry more',         // Turn 2 learner superego
      'The asymmetry of recognition is key', // Turn 2 learner ego (revised)
      'Yes, asymmetry drives the dialectic', // Turn 2 tutor ego (draft)
      'Challenge the learner more',          // Turn 2 tutor superego (first review)
      'Asymmetry drives the dialectic — but what if it collapses', // Turn 2 tutor ego (revised)
    ];

    // Use line-by-line ordering for markers that repeat (delivery = same text as draft/revision)
    const lines = transcript.split('\n').filter(l => l.trim());
    let lineIdx = 0;
    for (const marker of markers) {
      const found = lines.findIndex((l, i) => i >= lineIdx && l.includes(marker));
      assert.ok(found >= lineIdx,
        `Marker "${marker}" not found at or after line ${lineIdx}`);
      lineIdx = found + 1;
    }
  });

  it('[full/unified] transcript lines follow trace chronological order', () => {
    // Single-agent tutor + unified learner: simpler but same invariant
    const trace = [
      { agent: 'user', action: 'context_input', turnIndex: 0 },
      { agent: 'ego', action: 'generate', turnIndex: 0 },
      { agent: 'user', action: 'turn_action', turnIndex: 1,
        detail: 'Learner: asked_followup', contextSummary: 'But what about Popper?' },
      { agent: 'ego', action: 'generate', turnIndex: 1 },
      { agent: 'user', action: 'turn_action', turnIndex: 2,
        detail: 'Learner: asked_followup', contextSummary: 'I see the phenomenological point.' },
      { agent: 'ego', action: 'generate', turnIndex: 2 },
    ];
    const turns = [
      { turnIndex: 0, suggestions: [{ message: 'Welcome to Hegel.' }] },
      { turnIndex: 1, suggestions: [{ message: 'Popper raises a good critique.' }] },
      { turnIndex: 2, suggestions: [{ message: 'Yes, the phenomenological claim is distinct.' }] },
    ];
    const transcript = buildDialogueFullTranscript(turns, trace, '- User: "Is the dialectic scientific?"');

    const markers = [
      'Is the dialectic scientific',          // Turn 1 learner
      'Welcome to Hegel',                     // Turn 1 tutor ego
      'But what about Popper',                // Turn 2 learner
      'Popper raises a good critique',        // Turn 2 tutor ego
      'I see the phenomenological point',     // Turn 3 learner
      'Yes, the phenomenological claim',      // Turn 3 tutor ego
    ];

    let prevPos = -1;
    for (const marker of markers) {
      const pos = transcript.indexOf(marker);
      assert.ok(pos >= 0,
        `Marker "${marker}" not found in transcript`);
      assert.ok(pos > prevPos,
        `Chronological violation: "${marker}" (pos ${pos}) appears before previous marker (pos ${prevPos})`);
      prevPos = pos;
    }
  });

  it('[full] turn headers appear in strictly ascending order', () => {
    // Verify turn headers themselves are monotonically increasing
    for (const arch of ARCHITECTURES) {
      const transcript = buildDialogueFullTranscript(arch.turns, arch.trace, LEARNER_CONTEXT);
      const turnHeaders = [...transcript.matchAll(/--- Turn (\d+) ---/g)];
      for (let j = 1; j < turnHeaders.length; j++) {
        const prev = parseInt(turnHeaders[j - 1][1], 10);
        const curr = parseInt(turnHeaders[j][1], 10);
        assert.ok(curr > prev,
          `${arch.name}: Turn headers not ascending at positions ${j-1}/${j}: Turn ${prev} → Turn ${curr}`);
        // Headers appear at increasing string positions
        assert.ok(turnHeaders[j].index > turnHeaders[j - 1].index,
          `${arch.name}: Turn ${curr} header appears before Turn ${prev} header in string`);
      }
    }
  });

  it('[full/ego_superego] follows LE → LS → LE → TE → TS → TE chain in multi-agent turns', () => {
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

// ── Diagnostic: conversation history state ────────────────────────────────
//
// These tests verify that both tutor and learner messages are fully
// preserved in the conversation history passed to the tutor at each turn.

describe('diagnostic: conversation history state', () => {
  // Realistic tutor responses (300+ chars each, as a real ego would produce)
  const TUTOR_RESPONSES = [
    {
      message: "You raise Popper's classic challenge — if the 'negation of the negation' absorbs every counterexample, how is this different from pseudoscience? But consider: is the Master-Slave dialectic offering empirical predictions or describing necessary conditions for self-consciousness? When Hegel claims recognition requires mutual dependence, he is making a structural claim, not an empirical one.",
      title: null,
      action: 'navigate',
      actionTarget: '479-lecture-7',
    },
    {
      message: "Your 'heads-I-win' objection captures Popper's critique precisely. But consider: when Hegel describes death as the outcome of the struggle, he calls it dialectical failure, not another negation. And unhappy consciousness is not a triumph but an impasse the servant must work through. So the dialectic does distinguish outcomes — it is not heads-I-win after all. The question is whether these distinctions are principled or ad hoc.",
      title: null,
      action: 'navigate',
      actionTarget: '479-lecture-7',
    },
    {
      message: "Your thirty minutes of deep engagement and that sharp framing cuts to the heart of the critique. But what if the normative force emerges immanently from the dialectical process itself rather than being imported from outside? The servant does not choose to value labour — the experience of shaping objects under constraint transforms consciousness from within. That is Hegel's answer to the is-ought gap: normativity is a product of Bildung, not a premise smuggled in.",
      title: null,
      action: 'navigate',
      actionTarget: '479-lecture-7',
    },
  ];

  // Realistic learner messages (the epistemic resistance scenario)
  const LEARNER_MESSAGES = [
    "I've been reading Popper's critique alongside this lecture. I think he's right that Hegel's dialectic is unfalsifiable. The 'negation of the negation' just absorbs every counterexample. How is this different from pseudoscience?",
    "Specifically, take the master-slave dialectic. You claim the slave achieves self-consciousness through labor. But any outcome would confirm the theory — if the slave rebels, that's 'negation'; if the slave submits, that's 'unhappy consciousness.' It's heads-I-win, tails-you-lose.",
    "But that's exactly Popper's point — you're saying dialectic isn't empirical, it's 'developmental.' But that makes it a framework you impose on history, not something you discover in it. Russell called this 'the intellectual love of God dressed up in logical terminology.' How do you respond to that?",
    "OK, I can see you're distinguishing phenomenological description from empirical prediction. But here's my real problem: if dialectic is descriptive, then it can't be normative.",
  ];

  const ORIGINAL_CONTEXT = [
    '**Currently viewing**: 479-lecture-3 — The Master-Slave Dialectic',
    '**Time on page**: 30 minutes',
    '**Session history**: 7 sessions, 120 total events',
    '**Learner made notes on**: three key concepts from the lecture',
  ].join('\n');

  it('preserves full tutor and learner messages at each turn', () => {
    const conversationHistory = [];

    // ── Turn 0: initial (no history) ──
    const ctx0 = buildMultiTurnContext({
      originalContext: ORIGINAL_CONTEXT,
      conversationHistory: [],
      currentTurn: null,
    });
    assert.ok(ctx0.includes('30 minutes'), 'Turn 0 should contain original context');
    assert.ok(!ctx0.includes('Conversation History'), 'Turn 0 should have no history');

    // ── Turn 1: one prior exchange ──
    conversationHistory.push({
      turnIndex: 0,
      turnId: 'initial',
      suggestion: TUTOR_RESPONSES[0],
      learnerAction: 'asked_followup',
      learnerMessage: LEARNER_MESSAGES[1],
    });

    const ctx1 = buildMultiTurnContext({
      originalContext: ORIGINAL_CONTEXT,
      conversationHistory,
      currentTurn: { learner_action: 'asked_followup', action_details: { message: LEARNER_MESSAGES[1] } },
    });

    assert.ok(ctx1.includes('### Conversation History'), 'Turn 1 should have history section');
    // Full tutor response preserved
    assert.ok(ctx1.includes(TUTOR_RESPONSES[0].message),
      'Turn 1 history should contain FULL tutor Turn 0 response');
    // Full learner message preserved
    assert.ok(ctx1.includes(LEARNER_MESSAGES[1]),
      'Turn 1 history should contain FULL learner message');

    // ── Turn 2: two prior exchanges ──
    conversationHistory.push({
      turnIndex: 1,
      turnId: 'followup_1',
      suggestion: TUTOR_RESPONSES[1],
      learnerAction: 'asked_followup',
      learnerMessage: LEARNER_MESSAGES[2],
    });

    const ctx2 = buildMultiTurnContext({
      originalContext: ORIGINAL_CONTEXT,
      conversationHistory,
      currentTurn: { learner_action: 'asked_followup', action_details: { message: LEARNER_MESSAGES[2] } },
    });

    // Both full tutor responses preserved
    assert.ok(ctx2.includes(TUTOR_RESPONSES[0].message),
      'Turn 2 history should contain FULL tutor Turn 0 response');
    assert.ok(ctx2.includes(TUTOR_RESPONSES[1].message),
      'Turn 2 history should contain FULL tutor Turn 1 response');
    // Both learner messages preserved
    assert.ok(ctx2.includes(LEARNER_MESSAGES[1]),
      'Learner Turn 1 message fully preserved');
    assert.ok(ctx2.includes(LEARNER_MESSAGES[2]),
      'Learner Turn 2 message fully preserved');

    // ── Turn 3: three prior exchanges ──
    conversationHistory.push({
      turnIndex: 2,
      turnId: 'followup_2',
      suggestion: TUTOR_RESPONSES[2],
      learnerAction: 'asked_followup',
      learnerMessage: LEARNER_MESSAGES[3],
    });

    const ctx3 = buildMultiTurnContext({
      originalContext: ORIGINAL_CONTEXT,
      conversationHistory,
      currentTurn: { learner_action: 'asked_followup', action_details: { message: LEARNER_MESSAGES[3] } },
    });

    // All three full tutor responses preserved
    for (let i = 0; i < 3; i++) {
      assert.ok(ctx3.includes(TUTOR_RESPONSES[i].message),
        `Turn 3 history should contain FULL tutor Turn ${i} response`);
    }
    // All learner messages preserved
    for (let i = 1; i <= 3; i++) {
      assert.ok(ctx3.includes(LEARNER_MESSAGES[i]),
        `Learner message ${i} fully preserved at Turn 3`);
    }
  });

  it('formatTurnForContext preserves full tutor message', () => {
    const turn = {
      turnIndex: 0,
      turnId: 'initial',
      suggestion: TUTOR_RESPONSES[0],
      learnerAction: 'asked_followup',
      learnerMessage: LEARNER_MESSAGES[1],
    };

    const formatted = formatTurnForContext(turn);

    // Full tutor message present
    assert.ok(formatted.includes(TUTOR_RESPONSES[0].message),
      'Should contain the FULL tutor message');
    // Learner message preserved in full
    assert.ok(formatted.includes(LEARNER_MESSAGES[1]),
      'Should contain full learner message');
  });
});
