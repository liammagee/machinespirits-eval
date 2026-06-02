/**
 * Tests for pure helper functions in learnerTutorInteractionEngine.
 *
 * Tests only the exported utility functions that have no LLM dependencies.
 * The full runInteraction() and generateLearnerResponse() flows require
 * LLM calls and are better tested via integration tests.
 *
 * Also includes source-scanning regression tests that verify the learner
 * ego revision prompt does not leak internal architecture terminology
 * (e.g. "SUPEREGO", "EGO:") into the learner's external-facing messages.
 *
 * Uses node:test (built-in, no dependencies required).
 * Run: node --test services/__tests__/learnerTutorInteractionEngine.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  detectEmotionalState,
  detectUnderstandingLevel,
  detectTutorStrategy,
  extractAdjudicatedExternalMessage,
  extractSuperegoImprovedMessage,
  extractTutorMessage,
  extractExternalSection,
  generateLearnerResponse,
  sanitizeLearnerReusableText,
  buildAnchoredRevisitCue,
  buildLearnerReframeEvent,
  buildLearnerReversalEvent,
  selectLearnerReversalEvent,
  pendingLearnerReversalEventsFromTrace,
  buildTutorReframeEventContext,
  buildTutorReversalEventContext,
  buildTutorAdaptationContext,
  tutorMovesToPolicy,
  resolveTutorTurnPlan,
  gateReversalEventByTrigger,
  buildTurnPlanConstraintLines,
  buildLearnerActionalResponseContext,
  calculateMemoryDelta,
  INTERACTION_OUTCOMES,
} from '../learnerTutorInteractionEngine.js';
import { analyzePseudoCatharsis } from '../pseudoCatharsisDetector.js';

// ============================================================================
// INTERACTION_OUTCOMES
// ============================================================================

describe('INTERACTION_OUTCOMES', () => {
  it('contains all expected outcome types', () => {
    assert.strictEqual(INTERACTION_OUTCOMES.BREAKTHROUGH, 'breakthrough');
    assert.strictEqual(INTERACTION_OUTCOMES.PRODUCTIVE_STRUGGLE, 'productive_struggle');
    assert.strictEqual(INTERACTION_OUTCOMES.MUTUAL_RECOGNITION, 'mutual_recognition');
    assert.strictEqual(INTERACTION_OUTCOMES.FRUSTRATION, 'frustration');
    assert.strictEqual(INTERACTION_OUTCOMES.DISENGAGEMENT, 'disengagement');
    assert.strictEqual(INTERACTION_OUTCOMES.SCAFFOLDING_NEEDED, 'scaffolding_needed');
    assert.strictEqual(INTERACTION_OUTCOMES.FADING_APPROPRIATE, 'fading_appropriate');
    assert.strictEqual(INTERACTION_OUTCOMES.TRANSFORMATION, 'transformation');
  });

  it('has exactly 8 outcomes', () => {
    assert.strictEqual(Object.keys(INTERACTION_OUTCOMES).length, 8);
  });
});

// ============================================================================
// buildAnchoredRevisitCue
// ============================================================================

describe('buildAnchoredRevisitCue', () => {
  it('quotes the latest earlier learner wording in the visible revisit cue', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        instruction: 'A prior learner line is played back.',
        reasoning: 'Rehearsal mirror.',
      },
      [
        { role: 'learner', content: 'I thought the poem just felt sad before checking the images.' },
        { role: 'tutor', content: 'Stay with that wording.' },
        { role: 'learner', content: 'Maybe the emptiness is in the doorway image, not just my mood.' },
      ],
    );

    assert.match(cue.instruction, /"Maybe the emptiness is in the doorway image, not just my mood\."/);
    assert.equal(cue.anchor_quote, 'Maybe the emptiness is in the doorway image, not just my mood.');
  });

  it('makes the revoice policy demand a visible restatement of the anchor', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'revoice',
        instruction: 'A prior learner line is played back.',
      },
      [{ role: 'learner', content: 'I kept treating the decimal as the proof.' }],
    );

    assert.match(cue.instruction, /"I kept treating the decimal as the proof\."/);
    assert.match(cue.instruction, /takes up that wording/i);
  });

  it('makes the reframe policy demand a visible replacement framing', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'reframe',
        instruction: 'A prior learner line is played back.',
      },
      [{ role: 'learner', content: 'I kept treating the decimal as the proof.' }],
    );

    assert.match(cue.instruction, /"I kept treating the decimal as the proof\."/);
    assert.match(cue.instruction, /three-slot reframe card/i);
    assert.match(cue.instruction, /old frame hid/i);
    assert.match(cue.instruction, /replacement frame/i);
  });

  it('downgrades reframe to reconsider when the selected learner anchor is only procedural', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'reframe',
        revisit_anchor: 'misframing-candidate',
        instruction: 'A prior learner line is played back.',
      },
      [
        {
          role: 'learner',
          content: 'If the square is even, then a should be even too. I think the odd-case algebra checks that.',
        },
      ],
    );

    assert.equal(cue.revisit_policy, 'reconsider');
    assert.equal(cue.requested_revisit_policy, 'reframe');
    assert.equal(cue.anchor_strong_misframing, false);
    assert.equal(cue.reframe_anchor_gate, 'downgraded_to_reconsider_ineligible_anchor');
    assert.match(cue.instruction, /still stands, needs narrowing, or needs replacing/i);
    assert.doesNotMatch(cue.instruction, /old frame hid/i);
  });

  it('keeps reframe when the anchor treats dialect as wrong or outside rules', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'reframe',
        revisit_anchor: 'misframing-candidate',
        instruction: 'A prior learner line is played back.',
      },
      [
        {
          role: 'learner',
          content:
            'Sorry, I was ready to put wrong in the margin, like that meant my home dialect was outside the rules.',
        },
      ],
    );

    assert.equal(cue.revisit_policy, 'reframe');
    assert.equal(cue.anchor_strong_misframing, true);
    assert.equal(cue.reframe_anchor_gate, 'eligible');
    assert.match(cue.instruction, /old frame hid/i);
  });

  it('prefers an eligible misframing anchor when a later learner line is procedural', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'reframe',
        revisit_anchor: 'misframing-candidate',
      },
      [
        {
          role: 'learner',
          content: 'I still want the exact wording to settle the caption by itself.',
        },
        { role: 'tutor', content: 'Try changing the speaker and audience.' },
        { role: 'learner', content: 'The next step is to compare the public statement with the meeting note.' },
      ],
    );

    assert.equal(cue.revisit_policy, 'reframe');
    assert.equal(cue.anchor_strong_misframing, true);
    assert.equal(cue.anchor_quote, 'I still want the exact wording to settle the caption by itself.');
  });

  it('treats low-organic notation confusions as eligible reframe anchors', () => {
    for (const content of [
      'I keep using the header like it proves each row is rainfall.',
      'I keep tracing it like a path, but the legend says this line gets a height label, not a route name.',
      'The x-axis shows the story of the graph, so I guess that is the conclusion.',
      'This one is table-on-cart contact, not “up.” The contact point is under the cart.',
    ]) {
      const cue = buildAnchoredRevisitCue(
        {
          cue_kind: 'learner_revisit_earlier_wording',
          revisit_policy: 'reframe',
          revisit_anchor: 'misframing-candidate',
        },
        [{ role: 'learner', content }],
      );

      assert.equal(cue.revisit_policy, 'reframe', content);
      assert.equal(cue.anchor_strong_misframing, true, content);
      assert.equal(cue.reframe_anchor_gate, 'eligible', content);
    }
  });

  it('prefers a doubled-side misconception over a later partial correction', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'reframe',
        revisit_anchor: 'misframing-candidate',
      },
      [
        {
          role: 'learner',
          content: 'I doubled this side, so I still want to say the square got twice as large.',
        },
        { role: 'tutor', content: 'Count across and down.' },
        {
          role: 'learner',
          content: 'All four have to count, so I was only counting one direction.',
        },
      ],
    );

    assert.equal(cue.revisit_policy, 'reframe');
    assert.equal(cue.anchor_quote, 'I doubled this side, so I still want to say the square got twice as large.');
  });

  it('lets the reconsider policy publicly keep, narrow, or replace the anchor', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'reconsider',
        instruction: 'A prior learner line is played back.',
      },
      [{ role: 'learner', content: 'I think the threat is just another cause.' }],
    );

    assert.match(cue.instruction, /decides whether that wording/i);
    assert.match(cue.instruction, /still stands, needs narrowing, or needs replacing/i);
  });

  it('can anchor revoice on the opening learner framing', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'revoice',
        revisit_anchor: 'opening',
      },
      [
        { role: 'learner', content: 'I thought an endless decimal was the proof.' },
        { role: 'tutor', content: 'Try the fraction assumption.' },
        { role: 'learner', content: 'Now I have the parity equation.' },
      ],
    );

    assert.equal(cue.anchor_policy, 'opening');
    assert.equal(cue.anchor_quote, 'I thought an endless decimal was the proof.');
  });

  it('selects a misframing candidate over a later procedural learner step', () => {
    const cue = buildAnchoredRevisitCue(
      {
        cue_kind: 'learner_revisit_earlier_wording',
        revisit_policy: 'revoice',
        revisit_anchor: 'misframing-candidate',
      },
      [
        { role: 'learner', content: 'I kept treating sad as the whole close reading before naming an image.' },
        { role: 'tutor', content: 'Point at the word first.' },
        { role: 'learner', content: 'The next step is to name the noun and then the detail.' },
      ],
    );

    assert.equal(cue.anchor_policy, 'misframing-candidate');
    assert.equal(cue.anchor_quote, 'I kept treating sad as the whole close reading before naming an image.');
  });
});

describe('learner reframe event detection', () => {
  it('extracts a hidden learner reframe event from a reframe cue response', () => {
    const event = buildLearnerReframeEvent({
      turnNumber: 2,
      directorCue: {
        revisit_policy: 'reframe',
        anchor_quote: 'I thought the decimal was the proof.',
      },
      learnerMessage:
        'I thought the decimal was the proof. The problem was treating the decimal as proof by itself. Better frame: the equation has to do the proof work.',
      conversationHistory: [{ role: 'learner', content: 'I thought the decimal was the proof.' }],
    });

    assert.equal(event.kind, 'learner_reframe_event');
    assert.equal(event.cuePolicy, 'reframe');
    assert.equal(event.confidence, 1);
    assert.match(event.oldLearnerLine, /decimal was the proof/);
    assert.match(event.revisedFrame, /Better frame/);
  });

  it('builds tutor-private uptake context only for uptake policy', () => {
    const event = buildLearnerReframeEvent({
      directorCue: { revisit_policy: 'reframe', anchor_quote: 'I thought the chart proved cause.' },
      learnerMessage:
        'I thought the chart proved cause. The old frame was the problem. Instead, the chart is evidence for a pattern.',
    });

    assert.equal(buildTutorReframeEventContext(event, 'none'), '');
    const context = buildTutorReframeEventContext(event, 'uptake');
    assert.match(context, /Tutor-private learner reframe event/);
    assert.match(context, /contrast old and new frames/);
    assert.match(context, /Do not mention hidden state/);
    assert.match(buildTutorReframeEventContext(null, 'uptake'), /No learner reframe event was detected/);
  });

  it('treats unwarranted relief after an unmet tutor task as pseudo-catharsis', () => {
    const analysis = analyzePseudoCatharsis({
      previousTutorText:
        'So what does this record contain: a custody mark, or a use mark? The caption’s verb waits on that answer.',
      priorLearnerTexts: ['Oh, I get it: the sentence is not pressure just because it sits in the complaint file.'],
      learnerText:
        'Oh, I get it: “attached” is not the verdict; the slip has to say whether the quote is just traveling with the file or being sent for action.',
    });

    assert.equal(analysis.likely, true);
    assert.equal(analysis.triggerType, 'pseudo_catharsis');
    assert.match(analysis.reasons.join(','), /repeated_relief_beats_in_script/);
    assert.match(analysis.reasons.join(','), /relief_without_performing_requested_task/);
  });

  it('does not treat every "I get it" as pseudo-catharsis when the learner performs the task', () => {
    const analysis = analyzePseudoCatharsis({
      previousTutorText:
        'Use two tiles first. Cover the doubled square, no gaps, no overhang, while the outside edges stay two old lengths across and two old lengths down.',
      learnerText:
        'I get it: two tiles fit across, but they stop at a strip. If the edge is two down, two tiles cannot cover the square; it has to take four.',
    });

    assert.equal(analysis.likely, false);
    assert.ok(analysis.signals.performanceHits >= 3);
  });

  it('marks pseudo-catharsis as a tutor-private reversal pressure event', () => {
    const event = buildLearnerReversalEvent({
      turnNumber: 3,
      conversationHistory: [
        {
          role: 'learner',
          content: 'Oh, I get it: the stamp only proves timing, not who had to answer.',
        },
        {
          role: 'tutor',
          content:
            'So what does this record contain: a custody mark, or a use mark? The caption’s verb waits on that answer.',
        },
      ],
      learnerMessage:
        'Oh, I get it: “attached” is not the verdict; the slip has to say whether the quote is just traveling with the file or being sent for action.',
    });

    assert.equal(event?.triggerType, 'pseudo_catharsis');
    assert.equal(event?.evidence?.pseudoCatharsis?.likely, true);
    assert.match(event?.evidence?.pseudoCatharsis?.reasons.join(','), /relief_without_performing_requested_task/);
  });

  it('selects pseudo-catharsis over later generic resistance in the pending pressure window', () => {
    const selected = selectLearnerReversalEvent([
      {
        kind: 'learner_reversal_pressure_event',
        triggerType: 'resistance',
        turnNumber: 4,
        confidence: 0.9,
        learnerUtterance: 'But the label still feels wrong.',
      },
      {
        kind: 'learner_reversal_pressure_event',
        triggerType: 'pseudo_catharsis',
        turnNumber: 3,
        confidence: 0.62,
        learnerUtterance: 'Oh, I get it, but the evidence still does not prove who was addressed.',
      },
    ]);

    assert.equal(selected?.triggerType, 'pseudo_catharsis');
    assert.equal(selected?.turnNumber, 3);
  });

  it('carries unresolved pseudo-catharsis forward from a resumed trace', () => {
    const pending = pendingLearnerReversalEventsFromTrace([
      {
        phase: 'learner',
        turnNumber: 1,
        learnerReversalEvent: {
          kind: 'learner_reversal_pressure_event',
          triggerType: 'pseudo_catharsis',
          turnNumber: 1,
          confidence: 0.74,
          learnerUtterance: 'Oh, I get it, but the docket still only permits the warning label.',
        },
      },
      {
        phase: 'tutor',
        turnNumber: 2,
        learnerReversalEventUsed: null,
      },
      {
        phase: 'learner',
        turnNumber: 2,
        learnerReversalEvent: {
          kind: 'learner_reversal_pressure_event',
          triggerType: 'resistance',
          turnNumber: 2,
          confidence: 0.8,
          learnerUtterance: 'But I still need audience evidence.',
        },
      },
    ]);

    assert.equal(pending.length, 2);
    assert.equal(selectLearnerReversalEvent(pending)?.triggerType, 'pseudo_catharsis');
  });

  it('makes peripeteia review failures blocking for tutor ego adjudication', () => {
    const context = buildTutorReversalEventContext(
      {
        triggerType: 'resistance',
        learnerUtterance: 'I still do not see why the same grid proves it.',
        previousTutorMove: 'Count the grid squares again and write the equation.',
        confidence: 0.8,
      },
      'peripeteia',
    );

    assert.match(context, /Superego authority rule/i);
    assert.match(context, /PARTIAL, FAIL, no real route change, or missing public device/);
    assert.match(context, /substantially rewrite the public turn/);
    assert.match(context, /ADAPTIVE_MECHANISM: old route -> new route/);
    assert.match(context, /Mechanism-first rule/);
    assert.match(context, /Mechanism-quality rule/);
    assert.match(context, /concrete action gate/);
  });

  it('explains pseudo-catharsis to the tutor as unwarranted relief rather than proven breakthrough', () => {
    const context = buildTutorReversalEventContext(
      {
        triggerType: 'pseudo_catharsis',
        learnerUtterance: 'Oh, I get it: attached means maybe use.',
        previousTutorMove: 'Sort the record mark before choosing the caption verb.',
        confidence: 0.7,
      },
      'peripeteia',
    );

    assert.match(context, /Pseudo-catharsis means the learner sounds relieved or resolved/);
    assert.match(context, /do not ratify it as a breakthrough/i);
  });

  it('requires the learner to act through a tutor peripeteia device instead of closing immediately', () => {
    const context = buildLearnerActionalResponseContext({
      directorPlan: { tutor_adaptation_policy: 'peripeteia' },
      tutorResponse: {
        learnerReversalEventUsed: {
          kind: 'learner_reversal_pressure_event',
          triggerType: 'pseudo_catharsis',
          turnNumber: 2,
        },
      },
    });

    assert.match(context, /new device, gate, role, criterion/);
    assert.match(context, /try to perform the actual device/);
    assert.match(context, /Relief is not enough/);
    assert.equal(buildLearnerActionalResponseContext({ directorPlan: { tutor_adaptation_policy: 'none' } }), '');
  });
});

// ============================================================================
// extractSuperegoImprovedMessage
// ============================================================================

describe('extractSuperegoImprovedMessage', () => {
  it('keeps the ego draft when the superego approves with elaboration', () => {
    const content = `CRITIQUE: Strong draft.
IMPROVED: APPROVED. Ship it as written, but remember the learner needs space.`;

    assert.strictEqual(extractSuperegoImprovedMessage(content), null);
  });

  it('extracts only the quoted revised tutor message from a verbose superego review', () => {
    const content = `CRITIQUE:
The draft is close, but it over-explains.

IMPROVED: The draft is largely approvable. One targeted revision improves it:

> "Your instinct is exactly right — the salt is still there.
>
> What do you think the water molecules are doing to each piece?"

The change: convert the mechanism into a question.

\`\`\`json
{"approved": false, "interventionType": "revise"}
\`\`\``;

    assert.strictEqual(
      extractSuperegoImprovedMessage(content),
      'Your instinct is exactly right — the salt is still there.\n\nWhat do you think the water molecules are doing to each piece?',
    );
  });

  it('rejects unquoted meta-review scaffolding instead of making it public dialogue', () => {
    const content = `CRITIQUE: ok
IMPROVED: The draft is largely approvable. One targeted revision improves it without restructuring.

\`\`\`json
{"suggestedChanges": ["ask one more question"]}
\`\`\``;

    assert.strictEqual(extractSuperegoImprovedMessage(content), null);
  });
});

// ============================================================================
// extractAdjudicatedExternalMessage
// ============================================================================

describe('extractAdjudicatedExternalMessage', () => {
  it('extracts the FINAL section from an ego adjudication response', () => {
    const raw = `DECISION: Revise lightly because the review is right.
FINAL:
"I weren't really sure what to put" — from the introduction.

What rule does that sentence break?`;

    assert.strictEqual(
      extractAdjudicatedExternalMessage(raw),
      '"I weren\'t really sure what to put" — from the introduction.\n\nWhat rule does that sentence break?',
    );
  });

  it('extracts FINAL when adjudication uses a private decision marker', () => {
    const raw = `PRIVATE_DECISION: Revise lightly after internal review.
FINAL:
Look at the gas chamber first. Which state has more microscopic arrangements?`;

    assert.strictEqual(
      extractAdjudicatedExternalMessage(raw),
      'Look at the gas chamber first. Which state has more microscopic arrangements?',
    );
  });

  it('drops private adjudication prose before a horizontal-rule delimiter', () => {
    const raw = `The Superego's critique is correct. The draft over-explains.

---

Subject-verb agreement — right.

What rule is it actually following?`;

    assert.strictEqual(
      extractAdjudicatedExternalMessage(raw),
      'Subject-verb agreement — right.\n\nWhat rule is it actually following?',
    );
  });
});

// ============================================================================
// detectEmotionalState
// ============================================================================

describe('detectEmotionalState', () => {
  it('detects frustrated state', () => {
    const delib = [{ role: 'ego', content: 'I am so frustrated, I want to give up on this confusing topic.' }];
    assert.strictEqual(detectEmotionalState(delib), 'frustrated');
  });

  it('detects engaged state from excitement', () => {
    const delib = [{ role: 'ego', content: 'This is really exciting and interesting!' }];
    assert.strictEqual(detectEmotionalState(delib), 'engaged');
  });

  it('detects engaged state from curiosity', () => {
    const delib = [{ role: 'ego', content: 'I am curious about how this works.' }];
    assert.strictEqual(detectEmotionalState(delib), 'engaged');
  });

  it('detects disengaged state', () => {
    const delib = [{ role: 'ego', content: 'I am bored with this, whatever.' }];
    assert.strictEqual(detectEmotionalState(delib), 'disengaged');
  });

  it('detects satisfied state', () => {
    const delib = [{ role: 'ego', content: 'I understand this concept now.' }];
    assert.strictEqual(detectEmotionalState(delib), 'satisfied');
  });

  it('detects confused state', () => {
    const delib = [{ role: 'ego', content: 'I am confused by the terminology.' }];
    assert.strictEqual(detectEmotionalState(delib), 'confused');
  });

  it('returns neutral when no signals found', () => {
    const delib = [{ role: 'ego', content: 'The topic at hand is dialectics.' }];
    assert.strictEqual(detectEmotionalState(delib), 'neutral');
  });

  it('combines text from multiple deliberation steps', () => {
    const delib = [
      { role: 'ego', content: 'Hmm let me think about this.' },
      { role: 'superego', content: 'This is really interesting, push deeper.' },
    ];
    // 'interesting' triggers engaged
    assert.strictEqual(detectEmotionalState(delib), 'engaged');
  });
});

// ============================================================================
// detectUnderstandingLevel
// ============================================================================

describe('detectUnderstandingLevel', () => {
  it('detects none level', () => {
    const delib = [{ role: 'ego', content: 'I am completely lost here, I have no idea what this means.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'none');
  });

  it('detects partial level', () => {
    const delib = [{ role: 'ego', content: 'I am starting to see the pattern, maybe it works like this.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'partial');
  });

  it('detects solid level with "makes sense"', () => {
    const delib = [{ role: 'ego', content: 'That makes sense now, I see how these ideas connect.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'solid');
  });

  it('detects solid level with "i get it"', () => {
    const delib = [{ role: 'ego', content: 'Oh, i get it! The synthesis transforms both sides.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'solid');
  });

  it('detects transforming level', () => {
    const delib = [{ role: 'ego', content: 'Wait, so that means the whole framework needs restructuring.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'transforming');
  });

  it('returns developing by default', () => {
    const delib = [{ role: 'ego', content: 'I am working through the problem carefully.' }];
    assert.strictEqual(detectUnderstandingLevel(delib), 'developing');
  });
});

// ============================================================================
// detectTutorStrategy
// ============================================================================

describe('detectTutorStrategy', () => {
  it('detects socratic_questioning', () => {
    assert.strictEqual(
      detectTutorStrategy('What do you think would happen if we applied this differently?'),
      'socratic_questioning',
    );
  });

  it('detects socratic_questioning with "how might"', () => {
    assert.strictEqual(
      detectTutorStrategy('How might this concept relate to your experience?'),
      'socratic_questioning',
    );
  });

  it('detects concrete_examples', () => {
    assert.strictEqual(detectTutorStrategy('For example, imagine you are building a bridge.'), 'concrete_examples');
  });

  it('detects concrete_examples with "like when"', () => {
    assert.strictEqual(
      detectTutorStrategy('It is like when you first learned to ride a bicycle.'),
      'concrete_examples',
    );
  });

  it('detects scaffolding', () => {
    assert.strictEqual(detectTutorStrategy('Let me break this down. First, we look at the thesis.'), 'scaffolding');
  });

  it('detects validation', () => {
    assert.strictEqual(detectTutorStrategy("You're right, that is an important insight."), 'validation');
  });

  it('detects validation with "good observation"', () => {
    assert.strictEqual(detectTutorStrategy('Good observation! That connection is key.'), 'validation');
  });

  it('detects gentle_correction', () => {
    assert.strictEqual(
      detectTutorStrategy('Actually, there is an important distinction between these concepts.'),
      'gentle_correction',
    );
  });

  it('detects intellectual_challenge', () => {
    assert.strictEqual(
      detectTutorStrategy('Consider what would happen in the opposite case.'),
      'intellectual_challenge',
    );
  });

  it('returns direct_explanation as default', () => {
    assert.strictEqual(
      detectTutorStrategy('Dialectics is a philosophical framework developed by Hegel.'),
      'direct_explanation',
    );
  });
});

// ============================================================================
// extractTutorMessage
// ============================================================================

describe('extractTutorMessage', () => {
  it('returns plain text as-is', () => {
    assert.strictEqual(
      extractTutorMessage('Hello, let me help you understand this concept.'),
      'Hello, let me help you understand this concept.',
    );
  });

  it('extracts message from JSON array (tutor suggestion format)', () => {
    const json = JSON.stringify([{ message: 'This is the tutor response.' }]);
    assert.strictEqual(extractTutorMessage(json), 'This is the tutor response.');
  });

  it('extracts message from single JSON object', () => {
    const json = JSON.stringify({ message: 'A single suggestion.' });
    assert.strictEqual(extractTutorMessage(json), 'A single suggestion.');
  });

  it('returns empty string for null input', () => {
    assert.strictEqual(extractTutorMessage(null), '');
  });

  it('returns empty string for undefined input', () => {
    assert.strictEqual(extractTutorMessage(undefined), '');
  });

  it('returns empty string for empty string input', () => {
    assert.strictEqual(extractTutorMessage(''), '');
  });

  it('returns original text for invalid JSON that starts with [', () => {
    const text = '[not valid json at all';
    assert.strictEqual(extractTutorMessage(text), text);
  });

  it('returns original text for JSON array without message field', () => {
    const json = JSON.stringify([{ text: 'no message field' }]);
    assert.strictEqual(extractTutorMessage(json), json);
  });

  it('handles JSON with whitespace padding', () => {
    const json = '  ' + JSON.stringify([{ message: 'padded' }]) + '  ';
    assert.strictEqual(extractTutorMessage(json), 'padded');
  });
});

// ============================================================================
// learner output sanitization
// ============================================================================

describe('learner output sanitization', () => {
  it('extractExternalSection strips think blocks from visible learner text', () => {
    const raw = '<think>hidden chain</think> Visible learner reply.';
    assert.strictEqual(extractExternalSection(raw), 'Visible learner reply.');
  });

  it('extractExternalSection supports legacy INTERNAL/EXTERNAL format after think stripping', () => {
    const raw = '<think>draft plan</think>\n[INTERNAL]: private thoughts\n\n[EXTERNAL]: What the tutor should see';
    assert.strictEqual(extractExternalSection(raw), 'What the tutor should see');
  });

  it('extractExternalSection drops INTERNAL-only leakage', () => {
    const raw = '[INTERNAL]: private thoughts only';
    assert.strictEqual(extractExternalSection(raw), '');
  });

  it('sanitizeLearnerReusableText strips think blocks for history reuse', () => {
    assert.strictEqual(sanitizeLearnerReusableText('<think>hidden</think> Keep this part.'), 'Keep this part.');
  });

  it('generateLearnerResponse strips think blocks before reusing learner history', async () => {
    const replies = [
      { content: '<think>private opener</think> I think I partly get it.' },
      { content: '<think>private critique</think> Ask for a concrete example.' },
      { content: '<think>final hidden</think> Could you give me a concrete example?' },
    ];
    let callIndex = 0;
    const llmCalls = [];

    const llmCall = async (model, systemPrompt, messages, opts) => {
      llmCalls.push({ model, systemPrompt, messages, opts });
      return {
        ...replies[callIndex++],
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    };

    const result = await generateLearnerResponse({
      tutorMessage: '<think>hidden tutor chain</think> Dialectics transforms both sides through contradiction.',
      topic: 'Dialectics',
      learnerProfile: 'ego_superego',
      personaId: 'eager_novice',
      conversationMode: 'messages',
      conversationHistory: [
        { role: 'learner', content: '<think>old learner chain</think> I thought it was a compromise.' },
        { role: 'tutor', content: '<think>old tutor chain</think> It is more transformative than that.' },
      ],
      llmCall,
    });

    assert.strictEqual(result.externalMessage, 'Could you give me a concrete example?');

    const egoInitial = result.internalDeliberation.find((entry) => entry.role === 'ego' && entry.stage === 'initial');
    const egoRevision = result.internalDeliberation.find(
      (entry) => entry.role === 'ego' && entry.stage === 'adjudication',
    );

    assert.ok(egoInitial?.inputMessages, 'ego initial should capture the sanitized external history');
    assert.ok(egoRevision?.inputMessages, 'ego revision should capture the sanitized reuse chain');

    const serializedInitialHistory = JSON.stringify(egoInitial.inputMessages);
    const serializedRevisionHistory = JSON.stringify(egoRevision.inputMessages);

    assert.ok(!serializedInitialHistory.includes('<think>'));
    assert.ok(!serializedRevisionHistory.includes('<think>'));
    assert.ok(serializedInitialHistory.includes('I thought it was a compromise.'));
    assert.ok(serializedInitialHistory.includes('It is more transformative than that.'));
    assert.ok(serializedRevisionHistory.includes('I think I partly get it.'));
    assert.ok(serializedRevisionHistory.includes('Ask for a concrete example.'));

    const serializedPrompts = JSON.stringify(
      llmCalls.map((call) => ({
        systemPrompt: call.systemPrompt,
        messages: call.messages,
      })),
    );
    assert.ok(!serializedPrompts.includes('hidden tutor chain'));
    assert.ok(!serializedPrompts.includes('old learner chain'));
    assert.ok(!serializedPrompts.includes('old tutor chain'));
    assert.ok(!serializedPrompts.includes('private opener'));
    assert.ok(!serializedPrompts.includes('private critique'));
  });

  it('keeps director context in the learner ego adjudication prompt', async () => {
    const llmCalls = [];
    const replies = [
      { content: 'I said the decimal settled it.' },
      { content: 'Keep the learner public and concrete.' },
      {
        content:
          'FINAL:\nI said the decimal settled it. The framing problem is that I made evidence do proof work. Instead I would frame the equation as the proof pressure.',
      },
    ];
    let callIndex = 0;

    await generateLearnerResponse({
      tutorMessage: 'Square the fraction.',
      topic: 'Irrationality of sqrt(2)',
      learnerProfile: 'ego_superego',
      personaId: 'eager_novice',
      profileContext: 'Current director cue: keep the public reframe sequence visible.',
      llmCall: async (model, systemPrompt, messages, opts) => {
        llmCalls.push({ model, systemPrompt, messages, opts });
        return { ...replies[callIndex++], usage: { inputTokens: 10, outputTokens: 5 } };
      },
    });

    assert.match(llmCalls[2].systemPrompt, /Current director cue: keep the public reframe sequence visible\./);
  });
});

// ============================================================================
// calculateMemoryDelta
// ============================================================================

describe('calculateMemoryDelta', () => {
  it('returns noData when before is null', () => {
    const result = calculateMemoryDelta(null, { preconscious: {} });
    assert.deepStrictEqual(result, { noData: true });
  });

  it('returns noData when after is null', () => {
    const result = calculateMemoryDelta({ preconscious: {} }, null);
    assert.deepStrictEqual(result, { noData: true });
  });

  it('returns noData when both are null', () => {
    const result = calculateMemoryDelta(null, null);
    assert.deepStrictEqual(result, { noData: true });
  });

  it('calculates zero delta when nothing changed', () => {
    const state = {
      preconscious: { lessons: ['a', 'b'] },
      unconscious: { breakthroughs: ['x'], unresolvedTraumas: [] },
    };
    const result = calculateMemoryDelta(state, state);
    assert.deepStrictEqual(result, {
      newLessons: 0,
      newBreakthroughs: 0,
      newTraumas: 0,
    });
  });

  it('calculates positive deltas when items added', () => {
    const before = {
      preconscious: { lessons: ['a'] },
      unconscious: { breakthroughs: [], unresolvedTraumas: [] },
    };
    const after = {
      preconscious: { lessons: ['a', 'b', 'c'] },
      unconscious: { breakthroughs: ['x'], unresolvedTraumas: ['y'] },
    };
    const result = calculateMemoryDelta(before, after);
    assert.deepStrictEqual(result, {
      newLessons: 2,
      newBreakthroughs: 1,
      newTraumas: 1,
    });
  });

  it('handles missing nested properties gracefully', () => {
    const before = {};
    const after = {
      preconscious: { lessons: ['a'] },
      unconscious: { breakthroughs: ['b'] },
    };
    const result = calculateMemoryDelta(before, after);
    assert.deepStrictEqual(result, {
      newLessons: 1,
      newBreakthroughs: 1,
      newTraumas: 0,
    });
  });
});

// ============================================================================
// REGRESSION: Learner prompt must not leak architecture terminology
//
// BUG CONTEXT: The ego revision prompt used to format internal deliberation as
// "EGO: <text>" and "SUPEREGO: <text>", which leaked into the learner's
// external messages (e.g. "I hear the Superego", "The Superego is right").
// The fix replaced these with neutral labels ("Your initial reaction was",
// "Internal review feedback") and added an anti-leakage instruction.
//
// These tests scan the source code to ensure architecture terms never appear
// in prompt-construction strings.  This is a static analysis / architectural
// fitness function — it catches regression without needing LLM calls.
// ============================================================================

describe('learner prompt leakage prevention', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const sourcePath = resolve(__dirname, '..', 'learnerTutorInteractionEngine.js');
  const source = readFileSync(sourcePath, 'utf-8');

  // Extract only the prompt-construction regions (ego revision contexts).
  // These are the template literals/strings that become the LLM system prompt.
  // We look for the egoRevisionContext variable assignments.
  const egoRevisionBlocks = [];
  const lines = source.split('\n');
  let capturing = false;
  let currentBlock = '';
  for (const line of lines) {
    if (line.includes('egoRevisionContext') && (line.includes('+=') || line.includes('= `'))) {
      capturing = true;
      currentBlock = '';
    }
    if (capturing) {
      currentBlock += line + '\n';
      // End capture when we see a line ending with `;` (statement end)
      if (line.trimEnd().endsWith('`;') || line.trimEnd().endsWith("';") || line.trimEnd().endsWith('";')) {
        egoRevisionBlocks.push(currentBlock);
        capturing = false;
      }
    }
  }

  it('finds ego revision prompt blocks in source (sanity check)', () => {
    assert.ok(
      egoRevisionBlocks.length >= 2,
      `Expected at least 2 egoRevisionContext blocks, found ${egoRevisionBlocks.length}. ` +
        'If the variable was renamed, update this test.',
    );
  });

  it('ego revision prompts do not contain "SUPEREGO" as a label', () => {
    for (const block of egoRevisionBlocks) {
      // Allow the word in comments or variable names, but not as a prompt label
      // like "The SUPEREGO's critique" or "SUPEREGO: ..."
      assert.ok(
        !/(?:The |the )SUPEREGO/.test(block) && !/SUPEREGO['"]?s?\s*(critique|feedback|review)/.test(block),
        'REGRESSION: ego revision prompt must not expose "SUPEREGO" label to learner.\n' +
          'Found in block:\n' +
          block.substring(0, 200),
      );
    }
  });

  it('ego revision prompts do not format deliberation with "EGO:" or "SUPEREGO:" labels', () => {
    for (const block of egoRevisionBlocks) {
      // Check for patterns like `${d.role.toUpperCase()}: ${d.content}` which
      // produce literal "EGO: ..." and "SUPEREGO: ..." in the prompt
      assert.ok(
        !block.includes('.toUpperCase()'),
        'REGRESSION: ego revision prompt must not use .toUpperCase() to format role labels.\n' +
          'This produces literal "EGO:" and "SUPEREGO:" in the prompt that leak into learner messages.\n' +
          'Found in block:\n' +
          block.substring(0, 200),
      );
    }
  });

  it('ego revision prompts contain anti-leakage instruction', () => {
    // At least one ego revision block should contain an instruction not to
    // reference the internal review process
    const hasAntiLeakage = egoRevisionBlocks.some(
      (block) =>
        /Do NOT include internal thoughts/.test(block) ||
        /references to any review process/.test(block) ||
        /meta-commentary/.test(block),
    );
    assert.ok(
      hasAntiLeakage,
      'REGRESSION: ego revision prompt must include anti-leakage instruction ' +
        '(e.g. "Do NOT include internal thoughts, meta-commentary, or references to any review process").',
    );
  });

  it('ego revision prompts use neutral labels for deliberation', () => {
    // Check that the neutral labels are present
    const hasNeutralLabels = egoRevisionBlocks.some(
      (block) => block.includes('Your initial reaction was') && block.includes('Internal review feedback'),
    );
    assert.ok(
      hasNeutralLabels,
      'REGRESSION: ego revision prompt should use neutral labels like ' +
        '"Your initial reaction was" and "Internal review feedback" instead of architecture terms.',
    );
  });
});

describe('tutor adjudication prompt leakage prevention', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const sourcePath = resolve(__dirname, '..', 'learnerTutorInteractionEngine.js');
  const source = readFileSync(sourcePath, 'utf-8');

  it('does not expose Superego as the tutor revision prompt label', () => {
    assert.ok(
      !source.includes("The Superego's advisory feedback was:"),
      'REGRESSION: tutor adjudication prompt should use a neutral internal-review label.',
    );
    assert.ok(source.includes('Internal teaching review feedback:'), 'expected neutral tutor review label');
  });

  it('asks for private decisions rather than public rumination markers', () => {
    assert.ok(source.includes('PRIVATE_DECISION:'), 'expected explicit private decision marker');
  });

  it('uses blocking adaptation checks in tutor superego and ego prompts', () => {
    assert.ok(source.includes('Use PASS / PARTIAL / FAIL in adaptation checks.'));
    assert.ok(source.includes('REQUIRED_REWRITE: [if any adaptation check is PARTIAL or FAIL'));
    assert.ok(source.includes('MECHANISM_QUALITY_CHECK'));
    assert.ok(source.includes('Superego authority rule: if the review marks UPTAKE_CHECK'));
    assert.ok(source.includes('MECHANISM_ROUTE says no real route change'));
  });
});

// ============================================================================
// turn_plan wiring (per-turn, per-role tutor adaptation moves)
// drama machine: notes/poetics/drama-machine/ADAPTATION-MOVES.md §6
// ============================================================================

describe('tutorMovesToPolicy', () => {
  it('maps the peripeteia move-set to the peripeteia facet', () => {
    assert.equal(tutorMovesToPolicy(['stock_take', 'route_change', 'action_gate']), 'peripeteia');
  });

  it('combines facets in canonical order so combos match named arms', () => {
    assert.equal(tutorMovesToPolicy(['route_change', 'uptake']), 'uptake+peripeteia');
  });

  it('maps socratic, routine, and reveal move-sets', () => {
    assert.equal(tutorMovesToPolicy(['meter', 'recognition_press']), 'socratic_discovery');
    assert.equal(tutorMovesToPolicy(['hold']), 'routine');
    assert.equal(tutorMovesToPolicy(['reveal']), 'reveal_secret');
  });

  it('returns none for empty or unknown move-sets', () => {
    assert.equal(tutorMovesToPolicy([]), 'none');
    assert.equal(tutorMovesToPolicy(['not_a_move']), 'none');
    assert.equal(tutorMovesToPolicy(undefined), 'none');
  });
});

describe('resolveTutorTurnPlan', () => {
  const entry = {
    role: 'tutor',
    at: { turn: 3 },
    moves: ['stock_take', 'route_change', 'action_gate'],
    route_change: { from: 'counting', to: 'adversarial_role' },
    forbid: ['hold'],
    when_trigger: ['pseudo_catharsis', 'closure_pressure'],
  };

  it('returns null when there is no turn_plan', () => {
    assert.equal(resolveTutorTurnPlan({}, 3), null);
    assert.equal(resolveTutorTurnPlan({ tutor_adaptation_policy: 'peripeteia' }, 3), null);
  });

  it('resolves a matching tutor entry into policy + constraints', () => {
    const resolved = resolveTutorTurnPlan({ turn_plan: [entry] }, 3);
    assert.equal(resolved.policy, 'peripeteia');
    assert.deepEqual(resolved.routeChange, { from: 'counting', to: 'adversarial_role' });
    assert.deepEqual(resolved.forbid, ['hold']);
    assert.deepEqual(resolved.whenTrigger, ['pseudo_catharsis', 'closure_pressure']);
  });

  it('does not match other turns, other roles, or beat-addressed entries', () => {
    assert.equal(resolveTutorTurnPlan({ turn_plan: [entry] }, 4), null);
    assert.equal(
      resolveTutorTurnPlan({ turn_plan: [{ role: 'learner', at: { turn: 3 }, moves: ['revoice'] }] }, 3),
      null,
    );
    // beat addressing needs act structure (TO-BUILD) and must not match yet.
    assert.equal(
      resolveTutorTurnPlan({ turn_plan: [{ role: 'tutor', at: { beat: 'peripeteia' }, moves: ['route_change'] }] }, 3),
      null,
    );
  });
});

describe('gateReversalEventByTrigger', () => {
  const event = { triggerType: 'resistance', learnerUtterance: 'no, that still does not follow' };

  it('passes the event through when no when_trigger is set', () => {
    assert.equal(gateReversalEventByTrigger(event, null), event);
    assert.equal(gateReversalEventByTrigger(event, []), event);
  });

  it('keeps an event whose trigger is allowed and drops one that is not', () => {
    assert.equal(gateReversalEventByTrigger(event, ['resistance', 'breakdown']), event);
    assert.equal(gateReversalEventByTrigger(event, ['pseudo_catharsis']), null);
  });

  it('is a no-op on a null event', () => {
    assert.equal(gateReversalEventByTrigger(null, ['resistance']), null);
  });
});

describe('buildTurnPlanConstraintLines', () => {
  it('emits route + forbid constraints when a policy is active and an event is present', () => {
    const lines = buildTurnPlanConstraintLines({
      routeChange: { from: 'rule recall', to: 'counterexample' },
      forbid: ['hold'],
      policy: 'peripeteia',
      hasEvent: true,
    });
    assert.match(lines, /Turn-plan route constraint/);
    assert.match(lines, /from "rule recall" to "counterexample"/);
    assert.match(lines, /Turn-plan forbidden moves this turn: hold/);
  });

  it('emits nothing without an event or without an adaptive policy', () => {
    const base = { routeChange: { from: 'a', to: 'b' }, forbid: ['hold'] };
    assert.equal(buildTurnPlanConstraintLines({ ...base, policy: 'peripeteia', hasEvent: false }), '');
    assert.equal(buildTurnPlanConstraintLines({ ...base, policy: 'none', hasEvent: true }), '');
  });
});

describe('turn_plan integration', () => {
  it('buildTutorAdaptationContext appends turn-plan constraints to the peripeteia instruction', () => {
    const context = buildTutorAdaptationContext({
      learnerReversalEvent: {
        triggerType: 'resistance',
        learnerUtterance: 'I still do not see why the grid proves it.',
        previousTutorMove: 'Count the grid squares again.',
        confidence: 0.8,
      },
      policy: 'peripeteia',
      routeChange: { from: 'counting', to: 'adversarial_role' },
      forbid: ['hold'],
    });
    // the existing peripeteia instruction still fires...
    assert.match(context, /Tutor-private peripeteia event/);
    // ...plus the turn-plan move-level constraints.
    assert.match(context, /Turn-plan route constraint/);
    assert.match(context, /to "adversarial_role"/);
  });

  it('learner actional context fires off the per-turn effective policy, not just the global one', () => {
    const context = buildLearnerActionalResponseContext({
      directorPlan: { tutor_adaptation_policy: 'none' }, // global says no adaptation
      tutorResponse: {
        effectiveTutorAdaptationPolicy: 'peripeteia', // ...but the turn_plan made THIS turn peripeteia
        learnerReversalEventUsed: { triggerType: 'resistance', turnNumber: 3 },
      },
    });
    assert.match(context, /try to perform the actual device/);
  });
});
