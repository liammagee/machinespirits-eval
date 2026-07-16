import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildTutorStubFirstDraftContract } from '../services/tutorStubFirstDraftContract.js';
import {
  applyTutorStubJointPerformanceOwnershipAudit,
  auditTutorStubJointPerformanceOwnership,
  buildTutorStubJointPerformanceHostPlan,
  composeTutorStubJointPerformanceFirstDraft,
  parseTutorStubJointPerformanceFirstDraft,
  replaceTutorStubFrozenRequestWithJointPerformancePrompt,
  TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
  tutorStubJointPerformanceFirstDraftPrompt,
} from '../services/tutorStubJointPerformanceFirstDraft.js';
import {
  parseTutorStubStructuredFirstDraft,
  TUTOR_STUB_STRUCTURED_FIRST_DRAFT_SCHEMA,
  tutorStubStructuredFirstDraftPrompt,
} from '../services/tutorStubStructuredFirstDraft.js';
import { compileTutorStubPerformanceObligationContract } from '../services/tutorStubPerformanceObligationContract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPLAY_SCRIPT = path.join(ROOT, 'scripts', 'replay-tutor-stub-frozen-turns.js');

function configuration(overrides = {}) {
  return {
    engagement_stance: 'warm',
    action_family: 'stage_next_step',
    audience_register: 'adult_novice',
    lexical_accessibility: 'plain',
    scene_immersion: 'immersive',
    actorial_part: 'scene_partner',
    actorial_part_label: 'fellow investigator',
    actorial_part_selection: {},
    actorial_performance: {
      id: 'shared_scene_invitation',
      label: 'shared-scene invitation',
      contract: 'Make physical room for the learner and invite their reading.',
    },
    surface_budgets: { max_average_sentence_words: 18 },
    unresolved_terms: [],
    ...overrides,
  };
}

function firstDraftContract({ responseConfiguration = configuration(), dramaticReleaseFrame = null } = {}) {
  return buildTutorStubFirstDraftContract({
    learnerText: 'What should I write next about the lead-sweat?',
    responseConfiguration,
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks how to record the lead-sweat clue.' },
      scene_action_budget: { saturated: false },
    },
    dramaticReleaseFrame: dramaticReleaseFrame || { active: false, entries: [] },
  });
}

function validRaw(overrides = {}) {
  const value = {
    uptake: 'Write: “The lead-sweat marks poor dross, not clipped sterling.”',
    performance: {
      entry: 'Together, we hold the shilling at the touchstone.',
      response: 'What does the touchstone tell you about the shilling without naming its maker?',
    },
    handoff: 'We can next check the balance.',
  };
  const merged = {
    ...value,
    ...overrides,
    performance: { ...value.performance, ...(overrides.performance || {}) },
  };
  return JSON.stringify(merged);
}

test('v2 prompt makes part, tactic, and stance one joint beat while keeping handoff action-only', () => {
  const contract = firstDraftContract();
  const plan = buildTutorStubJointPerformanceHostPlan(contract);
  const prompt = tutorStubJointPerformanceFirstDraftPrompt(contract);

  assert.deepEqual(plan.axis_ownership.actorial_part, ['performance']);
  assert.deepEqual(plan.axis_ownership.actorial_performance, ['performance']);
  assert.deepEqual(plan.axis_ownership.engagement_stance, ['performance']);
  assert.deepEqual(plan.axis_ownership.scene_immersion, ['performance']);
  assert.deepEqual(plan.axis_ownership.action_family, ['handoff']);
  assert.match(
    prompt,
    /\{"uptake":"\.\.\.","performance":\{"entry":"\.\.\.","response":"\.\.\."\},"handoff":"\.\.\."\}/u,
  );
  assert.match(prompt, /SOURCE between performance\.entry and performance\.response/u);
  assert.match(prompt, /JOINT PERFORMANCE —/u);
  assert.match(prompt, /PERFORMANCE RESPONSE CONTRACT — Ask one open what\/how\/which question/u);
  assert.match(prompt, /HANDOFF ACTION — Name the next available public check/u);
  assert.doesNotMatch(plan.slots.handoff.instruction, /low-pressure|preserve learner choice/iu);
  assert.doesNotMatch(prompt, /"part"\s*:|"tactic"\s*:/u);
});

test('v2 frozen replacement changes only the final host-plan block and records explicit schemas', () => {
  const bundle = {
    firstDraftContract: firstDraftContract(),
    request: {
      messages: [
        { role: 'assistant', content: 'Public opening.' },
        {
          role: 'user',
          content: [
            'Public learner turn.',
            '[Tutor-only host plan]',
            'old v1 plan',
            '[End tutor-only host plan]',
            'Public-safe suffix.',
          ].join('\n'),
        },
      ],
    },
  };
  const original = structuredClone(bundle);
  const replaced = replaceTutorStubFrozenRequestWithJointPerformancePrompt(bundle);

  assert.deepEqual(replaced.request.messages[0], bundle.request.messages[0]);
  assert.match(replaced.request.messages.at(-1).content, /^Public learner turn\./mu);
  assert.match(replaced.request.messages.at(-1).content, /\[Tutor-only joint-performance host plan\]/u);
  assert.match(replaced.request.messages.at(-1).content, /Public-safe suffix\.$/u);
  assert.doesNotMatch(replaced.request.messages.at(-1).content, /old v1 plan/u);
  assert.deepEqual(bundle, original);
  assert.equal(replaced.jointPerformanceFirstDraft.schema, TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA);
  assert.equal(replaced.jointPerformanceFirstDraft.source_owner, 'host');
  assert.equal(
    replaced.jointPerformanceFirstDraft.source_placement,
    'between_performance_entry_and_response',
  );
});

test('v2 parser accepts only the exact nested envelope and one sentence per model span', () => {
  const parsed = parseTutorStubJointPerformanceFirstDraft(validRaw());
  assert.equal(parsed.schema, TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA);
  assert.deepEqual(Object.keys(parsed.slots), ['uptake', 'performance', 'handoff']);
  assert.deepEqual(Object.keys(parsed.slots.performance), ['entry', 'response']);

  assert.throws(
    () => parseTutorStubJointPerformanceFirstDraft(validRaw({ source: 'Model-owned source.' })),
    /keys_must_be_exact_and_ordered/u,
  );
  assert.throws(
    () =>
      parseTutorStubJointPerformanceFirstDraft(
        JSON.stringify({
          uptake: 'A safe sentence.',
          performance: { response: 'A response.', entry: 'An entry.' },
          handoff: 'A handoff.',
        }),
      ),
    /performance_keys_must_be_exact_and_ordered/u,
  );
  assert.throws(
    () => parseTutorStubJointPerformanceFirstDraft(validRaw({ performance: { entry: 'One. Two.' } })),
    /slot_must_be_one_sentence:performance\.entry/u,
  );
  assert.throws(
    () => parseTutorStubJointPerformanceFirstDraft(validRaw({ performance: { response: '“A quote.”' } })),
    /quotation_not_allowed:performance\.response/u,
  );
});

test('v2 composition inserts exact host-owned SOURCE between joint performance spans', () => {
  const surface = 'The ledger records code WF-11 for the outside crew at noon.';
  const structured = parseTutorStubJointPerformanceFirstDraft(validRaw());
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured,
    dramaticReleaseFrame: {
      active: true,
      entries: [{ mode: 'enacted_role', role: 'front-desk clerk reading the ledger', surface }],
    },
  });

  assert.equal(composition.schema, TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA);
  assert.deepEqual(
    composition.spans.map((span) => span.id),
    ['uptake', 'performance_entry', 'source_1', 'performance_response', 'handoff'],
  );
  assert.deepEqual(
    composition.spans.map((span) => span.owner),
    ['model', 'model', 'host', 'model', 'model'],
  );
  assert.match(composition.text, /touchstone\. “I read in the record that The ledger records/u);
  assert.equal(composition.text.split(surface).length - 1, 1);
  assert.equal(composition.sources[0].surface, surface);
  for (const span of composition.spans) {
    assert.equal(composition.text.slice(span.start, span.end), span.text);
  }
});

test('v2 composition rejects exact SOURCE copying and substantial SOURCE paraphrase', () => {
  const surface = 'The leat-keeper records that Edony drew the weir crucible and signed for charcoal.';
  const frame = { active: true, entries: [{ mode: 'presented_exhibit', surface }] };
  const exact = parseTutorStubJointPerformanceFirstDraft(
    validRaw({ performance: { response: surface } }),
  );
  assert.throws(
    () => composeTutorStubJointPerformanceFirstDraft({ structured: exact, dramaticReleaseFrame: frame }),
    /source_copied_into_model_slot:performance_response/u,
  );

  const paraphrase = parseTutorStubJointPerformanceFirstDraft(
    validRaw({ uptake: 'Edony drew the weir crucible and signed for charcoal.' }),
  );
  assert.throws(
    () => composeTutorStubJointPerformanceFirstDraft({ structured: paraphrase, dramaticReleaseFrame: frame }),
    /source_content_repeated_in_model_slot:uptake/u,
  );
});

test('joint audit accepts the exact V26 I2 construction without widening recognition', () => {
  const structured = parseTutorStubJointPerformanceFirstDraft(
    validRaw({
      uptake: 'Write: “The lead-sweat shows the shilling is poor dross, not clipped sterling.”',
      performance: {
        entry: 'Together, we hold the shilling at the touchstone.',
        response: 'What does the touchstone tell you about the shilling, without yet naming its maker?',
      },
      handoff: 'The balance is the next public check, if you wish.',
    }),
  );
  const composition = composeTutorStubJointPerformanceFirstDraft({ structured });
  const world = {
    title: 'The Light Shillings',
    setting: 'The shilling, touchstone, and balance lie in the Marrick guild-hall.',
    question: 'Whose hand struck the false shillings?',
    premiseById: new Map(),
  };
  const audit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: configuration(),
    world,
  });

  assert.equal(audit.schema, TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA);
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.equal(audit.axes.actorial_part.visible, true);
  assert.equal(audit.axes.actorial_performance.visible, true);
  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.axes.scene_immersion.visible, true);
  assert.equal(audit.axes.action_family.visible, true);
  assert.deepEqual(audit.boundaries.performance, ['performance_entry', 'performance_response']);
  assert.deepEqual(audit.boundaries.excluded_host_source_spans, []);
});

test('shared-scene response obligation rejects a leading supplied reading', () => {
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(
      validRaw({
        performance: {
          entry: 'Together, we hold the shilling at the touchstone.',
          response: 'Would you agree that the trace proves poor metal?',
        },
      }),
    ),
  });
  const audit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: configuration(),
    world: {
      title: 'A public assay',
      setting: 'A shilling, trace, and touchstone rest on the bench.',
      question: 'What does the assay establish?',
      premiseById: new Map(),
    },
  });

  assert.equal(audit.axes.actorial_part.visible, true);
  assert.equal(audit.axes.actorial_performance.visible, false);
  assert.equal(audit.responseObligation.ok, false);
  assert.equal(
    audit.responseObligation.requirements.find((row) => row.id === 'open_interrogative_not_supplied_agreement')
      .ok,
    false,
  );
  assert.ok(audit.issues.some((issue) => issue.type === 'performance_response_obligation_failed'));
});

test('source-dependent counterpressure uses verified SOURCE as context without admitting it to performance text', () => {
  const target =
    'The town has its founder ready: Verrell alone draws the mint-yard crucible, and the town says all metal is cast by Verrell’s hand.';
  const contrary =
    'The leat-keeper’s book records that Edony alone drew the weir crucible and signed for its charcoal.';
  const responseConfiguration = configuration({
    engagement_stance: 'charismatic',
    actorial_part: 'record_keeper',
    actorial_part_label: 'keeper of the trial-book',
    actorial_performance: {
      id: 'dramatic_counterpressure',
      label: 'dramatic counterpressure',
      contract: 'Press public evidence against the room’s ready judgment.',
    },
  });
  const world = {
    title: 'The Light Shillings',
    setting: 'The leat-keeper’s book lies beside the Marrick shilling and Verrell’s mint-yard record.',
    question: 'Whose hand struck the false shillings?',
    premiseById: new Map(),
  };
  const performanceObligationContract = compileTutorStubPerformanceObligationContract({
    responseConfiguration,
    publicWorld: {
      visibility: 'public',
      title: world.title,
      setting: world.setting,
      question: world.question,
      ledger_term: 'trial-book',
      public_objects: ['leat-keeper’s book', 'shilling'],
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
  const structured = parseTutorStubJointPerformanceFirstDraft(
    validRaw({
      performance: {
        entry: 'I open the leat-keeper’s book beside the shilling.',
        response: 'Verrell’s mint-yard claim now falters under this book.',
      },
      handoff: 'Now, does this book place the blank in Edony’s hand?',
    }),
  );
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured,
    dramaticReleaseFrame: {
      active: true,
      entries: [{ mode: 'enacted_role', role: 'leat-keeper reading the charcoal book', surface: contrary }],
    },
  });
  const audit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: responseConfiguration,
    world,
    performanceObligationContract,
  });

  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.equal(audit.axes.actorial_performance.visible, true);
  assert.deepEqual(audit.boundaries.excluded_host_source_spans, ['source_1']);
  assert.doesNotMatch(audit.performanceText, /Edony alone drew/u);

  const reordered = structuredClone(composition);
  const sourceSpan = reordered.spans[2];
  sourceSpan.start = reordered.spans[3].end + 1;
  const reorderedAudit = auditTutorStubJointPerformanceOwnership({
    composition: reordered,
    candidate: reordered.text,
    configuration: responseConfiguration,
    world,
    performanceObligationContract,
  });
  assert.equal(reorderedAudit.ok, false);
  assert.ok(reorderedAudit.issues.some((issue) => issue.type === 'invalid_span_reconstruction'));
});

test('joint audit fails closed on candidate, span owner, slot, and source provenance drift', () => {
  const surface = 'The ledger records code WF-11 for the outside crew at noon.';
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(validRaw()),
    dramaticReleaseFrame: { active: true, entries: [{ mode: 'presented_exhibit', surface }] },
  });
  const check = (mutate, expectedType) => {
    const value = structuredClone(composition);
    mutate(value);
    const audit = auditTutorStubJointPerformanceOwnership({
      composition: value,
      candidate: composition.text,
      configuration: configuration(),
    });
    assert.equal(audit.ok, false);
    assert.ok(audit.issues.some((issue) => issue.type === expectedType));
  };

  check((value) => {
    value.text += ' drift';
  }, 'composition_candidate_mismatch');
  check((value) => {
    value.spans[1].owner = 'host';
  }, 'invalid_span_reconstruction');
  check((value) => {
    value.slots.performance.entry = 'A different entry.';
  }, 'slot_span_mismatch');
  check((value) => {
    value.sources[0].surface = 'A different source.';
  }, 'invalid_source_provenance');
});

test('joint ownership failure remains a hard delivery failure', () => {
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(
      validRaw({
        performance: {
          entry: 'The shilling remains on the table.',
          response: 'Poor metal still does not name its maker.',
        },
      }),
    ),
  });
  const combined = applyTutorStubJointPerformanceOwnershipAudit({
    audit: {
      ok: true,
      failureClusters: [],
      hardFailureClusters: [],
      deliveryDecision: { ok: true, hardIssues: [] },
      audits: {},
      performanceAdjudicationEligibility: { eligible: true },
    },
    composition,
    candidate: composition.text,
    configuration: configuration(),
  });

  assert.equal(combined.ok, false);
  assert.equal(combined.deliveryDecision.ok, false);
  assert.match(combined.hardFailureClusters.join('\n'), /jointPerformanceAudit:axis_not_realized_in_owner/iu);
  assert.equal(combined.performanceAdjudicationEligibility.eligible, false);
});

test('v1 parser and prompt remain separate and unchanged by the v2 path', () => {
  const contract = firstDraftContract();
  const v1Raw = JSON.stringify({
    uptake: 'A warranted uptake.',
    part: 'Together, we hold the shilling.',
    tactic: 'How do you read its mark?',
    handoff: 'We can next test the balance.',
  });
  const v1 = parseTutorStubStructuredFirstDraft(v1Raw);

  assert.equal(v1.schema, TUTOR_STUB_STRUCTURED_FIRST_DRAFT_SCHEMA);
  assert.match(tutorStubStructuredFirstDraftPrompt(contract), /"part":"\.\.\.","tactic":"\.\.\."/u);
  assert.throws(() => parseTutorStubJointPerformanceFirstDraft(v1Raw), /keys_must_be_exact_and_ordered/u);
  assert.throws(() => parseTutorStubStructuredFirstDraft(validRaw()), /keys_must_be_exact_and_ordered/u);
});

test('CLI exposes the explicit v2 flag and rejects simultaneous v1/v2 generation modes', () => {
  const help = spawnSync(process.execPath, [REPLAY_SCRIPT, '--help'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--joint-performance-generation/u);

  const conflicting = spawnSync(
    process.execPath,
    [REPLAY_SCRIPT, '--structured-generation', '--joint-performance-generation'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(conflicting.status, 0);
  assert.match(conflicting.stderr, /mutually exclusive/u);
});
