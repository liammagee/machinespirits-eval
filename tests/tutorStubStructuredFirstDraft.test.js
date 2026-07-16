import assert from 'node:assert/strict';
import test from 'node:test';

import { auditTutorStubDramaticReleaseResponse } from '../services/tutorStubDramaticRelease.js';
import { compileTutorStubPerformanceObligationContract } from '../services/tutorStubPerformanceObligationContract.js';
import { auditTutorStubResponseConfiguration } from '../services/tutorStubResponseConfiguration.js';
import {
  applyTutorStubStructuredSlotOwnershipAudit,
  auditTutorStubStructuredSlotOwnership,
  composeTutorStubStructuredFirstDraft,
  parseTutorStubStructuredFirstDraft,
  replaceTutorStubFrozenRequestWithStructuredPrompt,
  TUTOR_STUB_STRUCTURED_COMPOSITION_SCHEMA,
  TUTOR_STUB_STRUCTURED_FIRST_DRAFT_SCHEMA,
  tutorStubStructuredFirstDraftPrompt,
} from '../services/tutorStubStructuredFirstDraft.js';

function contract() {
  return {
    language: {
      audience_register: 'adult_novice',
      lexical_accessibility: 'plain',
      host_sentence_word_target: 18,
    },
    host_plan: {
      host_sentence_count: 4,
      slots: [
        {
          id: 'uptake',
          kind: 'host',
          required: true,
          instruction: 'Credit the learner’s limit without generic praise.',
        },
        {
          id: 'part',
          kind: 'host',
          required: true,
          instruction: 'Open the named public ledger without naming the role.',
        },
        {
          id: 'source',
          kind: 'source',
          required: true,
          exact: true,
          cues: ['private source cue omitted from the structured prompt'],
        },
        {
          id: 'tactic',
          kind: 'host',
          required: true,
          instruction: 'State the concrete limit after the source closes.',
          semantic_instruction: 'TARGET — contrast custody with identification.',
        },
        {
          id: 'handoff',
          kind: 'host',
          required: true,
          instruction: 'Ask what this named clue changes.',
        },
      ],
    },
  };
}

function validRaw(overrides = {}) {
  return JSON.stringify({
    uptake: 'Your caution keeps the claim within the record.',
    part: 'I open the visitor ledger beside you.',
    tactic: 'The entry proves issuance only, not entry into the kitchen.',
    handoff: 'What does the visitor code change about your reading?',
    ...overrides,
  });
}

function responseConfiguration() {
  return {
    engagement_stance: 'precise',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'minimal',
    actorial_part: 'record_keeper',
    actorial_part_label: 'record keeper',
    actorial_part_selection: {},
    actorial_performance: { id: 'evidentiary_boundary', label: 'evidentiary boundary' },
    unresolved_terms: [],
  };
}

function counterpressureFixture() {
  const world = {
    title: 'The Light Shillings',
    setting: 'The leat-keeper’s book lies beside the Marrick shilling and Verrell’s mint-yard record.',
    question: 'Whose hand struck the false shillings?',
    premiseById: new Map(),
  };
  const target =
    'The town has its founder ready: Verrell alone draws the mint-yard crucible, and the town says all metal is cast by Verrell’s hand.';
  const contrary =
    'The leat-keeper’s book records that Edony alone drew the weir crucible and signed for its charcoal.';
  const configuration = {
    engagement_stance: 'charismatic',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'immersive',
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_part_selection: { authored_role: 'leat-keeper reading the charcoal book' },
    actorial_performance: { id: 'dramatic_counterpressure', label: 'dramatic counterpressure' },
    unresolved_terms: [],
  };
  const dramaticReleaseFrame = {
    active: true,
    requiresEnactment: true,
    requiresExhibitHandoff: false,
    entries: [
      {
        premise: 'p_caster',
        mode: 'enacted_role',
        role: 'leat-keeper reading the charcoal book',
        surface: contrary,
      },
    ],
  };
  const performanceObligationContract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: configuration,
    publicWorld: {
      visibility: 'public',
      title: world.title,
      setting: world.setting,
      question: world.question,
      ledger_term: 'trial-book',
      public_objects: ['charcoal book', 'shilling'],
    },
    publicTurn: {
      visibility: 'public',
      learner_move: 'What should I write next?',
      pressure_target: target,
      contrary_evidence: [contrary],
      public_evidence: [{ surface: target }],
      due_evidence: [{ surface: contrary }],
    },
  });
  const structured = (overrides = {}) =>
    parseTutorStubStructuredFirstDraft(
      validRaw({
        part: 'I open the charcoal book beside the shilling.',
        tactic: 'Verrell’s mint-yard claim now falters under this book.',
        handoff: 'Now, does this book place the blank in Edony’s hand?',
        ...overrides,
      }),
    );
  return { world, configuration, dramaticReleaseFrame, performanceObligationContract, structured };
}

test('structured prompt gives the model four host fields and withholds SOURCE composition', () => {
  const prompt = tutorStubStructuredFirstDraftPrompt(contract());

  assert.match(prompt, /\{"uptake":"\.\.\.","part":"\.\.\.","tactic":"\.\.\.","handoff":"\.\.\."\}/u);
  assert.match(prompt, /Use exactly those four keys in that order/u);
  assert.match(prompt, /The host inserts SOURCE after part/u);
  assert.doesNotMatch(prompt, /private source cue omitted/u);
  assert.doesNotMatch(prompt, /"source"\s*:/u);
});

test('frozen request replacement changes only the host plan in the final user message', () => {
  const bundle = {
    firstDraftContract: contract(),
    request: {
      messages: [
        { role: 'user', content: 'public opening' },
        { role: 'assistant', content: 'public tutor reply' },
        {
          role: 'user',
          content: [
            'public learner reply',
            '[Tutor-only host plan]',
            'old prose instructions',
            '[End tutor-only host plan]',
            'public-safe suffix',
          ].join('\n'),
        },
      ],
    },
  };

  const replaced = replaceTutorStubFrozenRequestWithStructuredPrompt(bundle);

  assert.deepEqual(replaced.request.messages.slice(0, 2), bundle.request.messages.slice(0, 2));
  assert.match(replaced.request.messages.at(-1).content, /^public learner reply/mu);
  assert.match(replaced.request.messages.at(-1).content, /\[Tutor-only structured host plan\]/u);
  assert.match(replaced.request.messages.at(-1).content, /public-safe suffix$/u);
  assert.doesNotMatch(replaced.request.messages.at(-1).content, /old prose instructions/u);
  assert.match(bundle.request.messages.at(-1).content, /old prose instructions/u);
  assert.equal(replaced.structuredFirstDraft.source_owner, 'host');
});

test('structured parser accepts the exact envelope and rejects malformed keys', () => {
  const parsed = parseTutorStubStructuredFirstDraft(validRaw());

  assert.equal(parsed.schema, TUTOR_STUB_STRUCTURED_FIRST_DRAFT_SCHEMA);
  assert.deepEqual(Object.keys(parsed.slots), ['uptake', 'part', 'tactic', 'handoff']);
  assert.throws(
    () =>
      parseTutorStubStructuredFirstDraft(
        JSON.stringify({
          part: 'I open the ledger.',
          uptake: 'That limit is sound.',
          tactic: 'The entry proves issuance only.',
          handoff: 'What does it change?',
        }),
      ),
    /keys_must_be_exact_and_ordered/u,
  );
  assert.throws(
    () => parseTutorStubStructuredFirstDraft(validRaw({ source: 'A model-owned source is forbidden.' })),
    /keys_must_be_exact_and_ordered/u,
  );
  assert.throws(() => parseTutorStubStructuredFirstDraft('```json\n{}\n```'), /invalid_json/u);
});

test('structured parser fails closed on malformed host sentences', () => {
  assert.throws(
    () => parseTutorStubStructuredFirstDraft(validRaw({ part: 'I open the ledger. I point to the entry.' })),
    /slot_must_be_one_sentence:part/u,
  );
  assert.throws(
    () => parseTutorStubStructuredFirstDraft(validRaw({ tactic: 'TACTIC — The entry proves issuance only.' })),
    /slot_contains_label:tactic/u,
  );
  assert.throws(
    () => parseTutorStubStructuredFirstDraft(validRaw({ handoff: 'I ask, “What changes?”' })),
    /quotation_not_allowed:handoff/u,
  );
  assert.throws(
    () => parseTutorStubStructuredFirstDraft(validRaw({ uptake: 'This sentence has no terminator' })),
    /slot_needs_terminal_punctuation:uptake/u,
  );
  assert.throws(
    () => parseTutorStubStructuredFirstDraft(validRaw({ part: 'I open the ledger.\n' })),
    /slot_has_outer_whitespace:part|slot_is_multiline:part/u,
  );
  assert.throws(
    () =>
      parseTutorStubStructuredFirstDraft(validRaw(), {
        maxWordsPerSlot: 6,
      }),
    /slot_exceeds_word_target:uptake/u,
  );
});

test('deterministic composition inserts an enacted source between PART and TACTIC exactly once', () => {
  const structured = parseTutorStubStructuredFirstDraft(validRaw());
  const surface = 'Visitor code WF-11 was issued to the outside crew at noon.';
  const frame = {
    active: true,
    requiresEnactment: true,
    requiresExhibitHandoff: false,
    entries: [
      {
        premise: 'p_noon',
        mode: 'enacted_role',
        role: 'front-desk clerk reading the visitor ledger',
        surface,
      },
    ],
  };

  const composition = composeTutorStubStructuredFirstDraft({ structured, dramaticReleaseFrame: frame });

  assert.equal(composition.schema, TUTOR_STUB_STRUCTURED_COMPOSITION_SCHEMA);
  assert.deepEqual(
    composition.spans.map((span) => span.id),
    ['uptake', 'part', 'source_1', 'tactic', 'handoff'],
  );
  assert.match(composition.text, /I open the visitor ledger beside you\. “I read from the record: Visitor code/u);
  assert.doesNotMatch(composition.text, /front-desk clerk/u);
  assert.equal(composition.text.split(surface).length - 1, 1);
  for (const span of composition.spans) {
    assert.equal(composition.text.slice(span.start, span.end), span.text);
  }
  assert.equal(auditTutorStubDramaticReleaseResponse({ text: composition.text, frame }).ok, true);
});

test('deterministic composition injects a presented exhibit without quotation or source rewriting', () => {
  const structured = parseTutorStubStructuredFirstDraft(
    validRaw({ part: 'I place the lost-property ledger between us.' }),
  );
  const surface = 'The ledger logs Priya’s labelled lunchbox at 12:14.';
  const composition = composeTutorStubStructuredFirstDraft({
    structured,
    dramaticReleaseFrame: {
      active: true,
      requiresEnactment: false,
      requiresExhibitHandoff: true,
      entries: [{ premise: 'p_ledger', mode: 'presented_exhibit', role: 'ledger', surface }],
    },
  });

  assert.match(composition.text, new RegExp(`between us\\. ${surface.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`));
  assert.doesNotMatch(composition.spans.find((span) => span.kind === 'source').text, /^[“"]/u);
  assert.equal(composition.text.split(surface).length - 1, 1);
});

test('deterministic composition rejects source copying and malformed source surfaces', () => {
  const surface = 'The ledger logs the lunchbox at 12:14.';
  const frame = {
    active: true,
    entries: [{ mode: 'presented_exhibit', surface }],
  };
  const copied = parseTutorStubStructuredFirstDraft(validRaw({ tactic: surface }));

  assert.throws(
    () => composeTutorStubStructuredFirstDraft({ structured: copied, dramaticReleaseFrame: frame }),
    /source_copied_into_host_slot:tactic/u,
  );
  assert.throws(
    () =>
      composeTutorStubStructuredFirstDraft({
        structured: parseTutorStubStructuredFirstDraft(validRaw()),
        dramaticReleaseFrame: { active: true, entries: [{ surface: 'line one\nline two' }] },
      }),
    /multiline_surface/u,
  );
});

test('deterministic composition rejects substantial SOURCE fingerprints but permits isolated scene words', () => {
  const surface =
    'The leat-keeper’s book records that Edony alone drew the weir crucible and signed for its charcoal.';
  const frame = {
    active: true,
    entries: [{ mode: 'enacted_role', role: 'leat-keeper reading the charcoal book', surface }],
  };
  const paraphrasedSource = parseTutorStubStructuredFirstDraft(
    validRaw({ uptake: 'Edony drew the weir crucible and signed for its charcoal.' }),
  );

  assert.throws(
    () => composeTutorStubStructuredFirstDraft({ structured: paraphrasedSource, dramaticReleaseFrame: frame }),
    /source_content_repeated_in_host_slot:uptake/u,
  );

  const isolatedSceneAnchor = parseTutorStubStructuredFirstDraft(
    validRaw({ part: 'I open the charcoal book beside you.' }),
  );
  assert.doesNotThrow(() =>
    composeTutorStubStructuredFirstDraft({ structured: isolatedSceneAnchor, dramaticReleaseFrame: frame }),
  );
});

test('structured slot audit verifies part, tactic, action, and stance only in their owning spans', () => {
  const structured = parseTutorStubStructuredFirstDraft(
    validRaw({
      handoff: 'What does the code establish, but not yet prove?',
    }),
  );
  const composition = composeTutorStubStructuredFirstDraft({ structured });
  const audit = auditTutorStubStructuredSlotOwnership({
    composition,
    configuration: responseConfiguration(),
  });

  assert.equal(audit.ok, true);
  assert.deepEqual(
    Object.fromEntries(Object.entries(audit.axes).map(([axis, row]) => [axis, row.owner])),
    {
      actorial_part: 'part',
      actorial_performance: 'tactic',
      action_family: 'handoff',
      engagement_stance: 'handoff',
    },
  );
});

test('structured slot audit rejects axis substitution that a whole-response audit can mask', () => {
  const structured = parseTutorStubStructuredFirstDraft(
    validRaw({
      part: 'The public record remains before us.',
      tactic: 'I open the visitor ledger and mark its limit only.',
      handoff: 'What does the code establish, but not yet prove?',
    }),
  );
  const composition = composeTutorStubStructuredFirstDraft({ structured });
  const configuration = responseConfiguration();
  const whole = auditTutorStubResponseConfiguration({ text: composition.text, configuration });
  const slots = auditTutorStubStructuredSlotOwnership({ composition, configuration });
  const combined = applyTutorStubStructuredSlotOwnershipAudit({
    audit: {
      ok: true,
      failureClusters: [],
      hardFailureClusters: [],
      audits: {},
      deliveryDecision: { ok: true, hardIssues: [] },
      performanceAdjudicationEligibility: { eligible: true },
    },
    composition,
    configuration,
  });

  assert.equal(whole.axes.actorial_part.part_visible, true);
  assert.equal(slots.axes.actorial_part.visible, false);
  assert.equal(slots.ok, false);
  assert.equal(combined.ok, false);
  assert.match(combined.hardFailureClusters.join('\n'), /axis_not_realized_in_owner:actorial_part/u);
  assert.equal(combined.performanceAdjudicationEligibility.eligible, false);
});

test('structured slot audit binds saved spans exactly to the whole-response candidate', () => {
  const structured = parseTutorStubStructuredFirstDraft(
    validRaw({ handoff: 'What does the code establish, but not yet prove?' }),
  );
  const composition = composeTutorStubStructuredFirstDraft({ structured });
  const configuration = responseConfiguration();
  const faithful = auditTutorStubStructuredSlotOwnership({
    composition,
    candidate: composition.text,
    configuration,
  });
  assert.equal(faithful.ok, true);

  const mismatchedCandidate = auditTutorStubStructuredSlotOwnership({
    composition,
    candidate: `${composition.text} Different saved candidate.`,
    configuration,
  });
  assert.equal(mismatchedCandidate.ok, false);
  assert.ok(mismatchedCandidate.issues.some((issue) => issue.type === 'composition_candidate_mismatch'));

  const corruptedSpan = structuredClone(composition);
  corruptedSpan.spans[1].start += 1;
  const corruptedSpanAudit = auditTutorStubStructuredSlotOwnership({
    composition: corruptedSpan,
    candidate: corruptedSpan.text,
    configuration,
  });
  assert.equal(corruptedSpanAudit.ok, false);
  assert.ok(corruptedSpanAudit.issues.some((issue) => issue.type === 'invalid_span_reconstruction'));

  const corruptedSlot = structuredClone(composition);
  corruptedSlot.slots.part = 'A different saved part.';
  const corruptedSlotAudit = auditTutorStubStructuredSlotOwnership({
    composition: corruptedSlot,
    candidate: corruptedSlot.text,
    configuration,
  });
  assert.equal(corruptedSlotAudit.ok, false);
  assert.ok(corruptedSlotAudit.issues.some((issue) => issue.type === 'slot_span_mismatch'));
});

test('structured falter recognition uses verified PART and SOURCE prerequisites without cue bleed', () => {
  const fixture = counterpressureFixture();
  const composition = composeTutorStubStructuredFirstDraft({
    structured: fixture.structured(),
    dramaticReleaseFrame: fixture.dramaticReleaseFrame,
  });
  const audit = auditTutorStubStructuredSlotOwnership({
    composition,
    configuration: fixture.configuration,
    world: fixture.world,
    performanceObligationContract: fixture.performanceObligationContract,
  });

  assert.equal(audit.axes.actorial_part.visible, true);
  assert.equal(audit.axes.actorial_performance.visible, true);
  assert.equal(audit.axes.action_family.visible, true);
  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.ok, true);

  const cueOnlyInHandoff = composeTutorStubStructuredFirstDraft({
    structured: fixture.structured({
      tactic: 'The book remains open before us.',
      handoff: 'Now, does this book show why Verrell’s mint-yard claim falters?',
    }),
    dramaticReleaseFrame: fixture.dramaticReleaseFrame,
  });
  const cueBleedAudit = auditTutorStubStructuredSlotOwnership({
    composition: cueOnlyInHandoff,
    configuration: fixture.configuration,
    world: fixture.world,
    performanceObligationContract: fixture.performanceObligationContract,
  });
  assert.equal(cueBleedAudit.axes.actorial_performance.visible, false);
  assert.ok(
    cueBleedAudit.issues.some(
      (issue) => issue.axis === 'actorial_performance' && issue.owner === 'tactic',
    ),
  );

  const missingPartAction = composeTutorStubStructuredFirstDraft({
    structured: fixture.structured({ part: 'The room waits beside the shilling.' }),
    dramaticReleaseFrame: fixture.dramaticReleaseFrame,
  });
  const missingPartAudit = auditTutorStubStructuredSlotOwnership({
    composition: missingPartAction,
    configuration: fixture.configuration,
    world: fixture.world,
    performanceObligationContract: fixture.performanceObligationContract,
  });
  assert.equal(missingPartAudit.axes.actorial_part.visible, false);
  assert.equal(missingPartAudit.axes.actorial_performance.visible, false);

  const missingSource = composeTutorStubStructuredFirstDraft({ structured: fixture.structured() });
  const missingSourceAudit = auditTutorStubStructuredSlotOwnership({
    composition: missingSource,
    configuration: fixture.configuration,
    world: fixture.world,
    performanceObligationContract: fixture.performanceObligationContract,
  });
  assert.equal(missingSourceAudit.axes.actorial_performance.visible, false);
});
