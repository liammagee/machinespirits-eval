import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildTutorStubFirstDraftContract } from '../services/tutorStubFirstDraftContract.js';
import {
  getEngagementStanceDefinitions,
  getJointPerformanceStanceContract,
} from '../services/engagementRegisterRegistry.js';
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
import { auditTutorStubFrozenCandidate } from '../services/tutorStubFrozenReplay.js';
import {
  auditTutorStubResponseConfiguration,
  tutorStubResponseConfigurationPrompt,
} from '../services/tutorStubResponseConfiguration.js';

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

function advocateConfiguration(overrides = {}) {
  return configuration({
    engagement_stance: 'precise',
    scene_immersion: 'minimal',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate for the live case',
    actorial_performance: {
      id: 'unadorned_report',
      label: 'unadorned report',
      contract: 'State the live public case directly and accountably.',
    },
    ...overrides,
  });
}

function firstDraftContract({
  learnerText = 'What should I write next about the lead-sweat?',
  responseConfiguration = configuration(),
  responseCompositionFrame = null,
  dramaticReleaseFrame = null,
  dialogueClosureFrame = null,
  questionSupport = null,
  sourceAccessibilityPolicy = 'direct_only',
} = {}) {
  return buildTutorStubFirstDraftContract({
    learnerText,
    responseConfiguration,
    responseCompositionFrame:
      responseCompositionFrame || {
        learner_move: { summary: 'The learner asks how to record the lead-sweat clue.' },
        scene_action_budget: { saturated: false },
      },
    dramaticReleaseFrame: dramaticReleaseFrame || { active: false, entries: [] },
    dialogueClosureFrame,
    questionSupport,
    sourceAccessibilityPolicy,
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

function wordCount(value) {
  return String(value || '')
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;
}

test('v2 prompt keeps a writable-entry shared scene declarative after direct uptake', () => {
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
  assert.match(prompt, /PERFORMANCE RESPONSE CONTRACT — Invite shared attention declaratively/u);
  assert.match(prompt, /Ask no question here/iu);
  assert.match(prompt, /HANDOFF ACTION — State the current public limit/iu);
  assert.ok(wordCount(prompt) <= 350, `expected at most 350 V2 prompt words, received ${wordCount(prompt)}`);
  assert.equal(plan.slots.performance.compatibility_instruction, null);
  assert.doesNotMatch(prompt, /PERFORMANCE COMPATIBILITY —/u);
  assert.doesNotMatch(plan.slots.handoff.instruction, /low-pressure|preserve learner choice/iu);
  assert.doesNotMatch(prompt, /"part"\s*:|"tactic"\s*:/u);
});

test('shared-scene progression delegates the only allowed question to handoff and preserves legacy audit behavior', () => {
  const contract = firstDraftContract({
    learnerText: 'What does the blue seal establish about the packet?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks what the blue seal establishes.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
      scene_action_budget: { saturated: false },
    },
  });
  assert.equal(contract.progression.handoff_contract.question_allowed, true);
  assert.equal(contract.progression.handoff_contract.question_owner, 'handoff');
  const plan = buildTutorStubJointPerformanceHostPlan(contract);
  assert.equal(plan.slots.performance.response_contract.type, 'declarative_shared_attention');

  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(
      validRaw({
        uptake: 'Your question keeps the blue seal tied to the packet.',
        performance: {
          entry: 'Together, we hold the blue seal beside the packet.',
          response: 'We keep its narrow reading between us.',
        },
        handoff: 'What does the blue seal establish about the packet?',
      }),
    ),
  });
  const delegated = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: configuration(),
    progressionContract: contract.progression,
  });
  assert.equal(delegated.responseObligation.ok, true, JSON.stringify(delegated.responseObligation));

  const legacy = auditTutorStubJointPerformanceOwnership({
    composition: composeTutorStubJointPerformanceFirstDraft({
      structured: parseTutorStubJointPerformanceFirstDraft(validRaw()),
    }),
    candidate: composeTutorStubJointPerformanceFirstDraft({
      structured: parseTutorStubJointPerformanceFirstDraft(validRaw()),
    }).text,
    configuration: configuration(),
  });
  assert.equal(legacy.responseObligation.ok, true, JSON.stringify(legacy.responseObligation));
  assert.equal(legacy.responseObligation.requirements.some((row) => row.id === 'terminal_direct_question'), true);
});

test('v2 prompt drafts below the hard slot limit while the parser retains the exact hard boundary', () => {
  const contract = firstDraftContract();
  contract.language.host_sentence_word_target = 17;
  const prompt = tutorStubJointPerformanceFirstDraftPrompt(contract);
  const seventeenWordEntry =
    'Together we hold the marked shilling beside the touchstone while the balance waits on the assay bench.';
  const eighteenWordEntry =
    'Together we hold the marked shilling beside the touchstone while the balance waits on the assay bench nearby.';

  assert.match(prompt, /Draft each sentence at most 14 words, leaving room below the hard 17-word limit/iu);
  assert.match(prompt, /Count every sentence’s words before emitting JSON/iu);
  assert.doesNotThrow(() =>
    parseTutorStubJointPerformanceFirstDraft(
      validRaw({ performance: { entry: seventeenWordEntry } }),
      { maxWordsPerSlot: 17 },
    ),
  );
  assert.throws(
    () =>
      parseTutorStubJointPerformanceFirstDraft(
        validRaw({ performance: { entry: eighteenWordEntry } }),
        { maxWordsPerSlot: 17 },
      ),
    /slot_exceeds_word_target:performance\.entry:18>17/u,
  );
});

test('v2 compiles declared advocate delegation into a bounded performance and action-only handoff', () => {
  const selectedConfiguration = advocateConfiguration();
  const contract = firstDraftContract({ responseConfiguration: selectedConfiguration });
  const plan = buildTutorStubJointPerformanceHostPlan(contract);
  const prompt = tutorStubJointPerformanceFirstDraftPrompt(contract);

  assert.ok(
    contract.compatibility.decisions.includes(
      'advocate_case_delegates_concrete_test_to_final_handoff',
    ),
  );
  assert.equal(contract.compatibility.composite_axis_ownership.mode, 'delegated_complement');
  assert.match(plan.slots.performance.entry_instruction, /state a concrete public proposition/iu);
  assert.match(plan.slots.performance.entry_instruction, /not merely whether the case is strong, weak, or limited/iu);
  assert.match(plan.slots.performance.entry_instruction, /same PERFORMANCE ENTRY/iu);
  assert.match(plan.slots.performance.entry_instruction, /such as but, cannot, not yet, only, or does not establish/iu);
  assert.match(plan.slots.performance.entry_instruction, /Do not defer the limit to PERFORMANCE RESPONSE/iu);
  assert.doesNotMatch(plan.slots.performance.entry_instruction, /leave the test for HANDOFF/iu);
  assert.match(plan.slots.performance.compatibility_instruction, /Keep PERFORMANCE declarative/iu);
  assert.match(plan.slots.handoff.instruction, /Begin HANDOFF with “Next,” or “Now,”/iu);
  assert.match(plan.slots.handoff.instruction, /test, check, compare, or trace/iu);
  assert.match(plan.slots.handoff.instruction, /Reuse a public object named in PERFORMANCE/iu);
  assert.match(plan.slots.handoff.instruction, /case, claim, or accusation “breaks” is not a next operation/iu);
  assert.doesNotMatch(plan.slots.handoff.instruction, /test, resist, or break/iu);
  assert.deepEqual(plan.delegated_axis_prerequisites.actorial_part, ['handoff']);
  assert.match(prompt, /PERFORMANCE COMPATIBILITY —/u);

  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(
      JSON.stringify({
        uptake: 'That limit keeps the accusation open.',
        performance: {
          entry: 'My case is that the ledger supports Crane, but does not settle the quote.',
          response: 'My case breaks if the record cannot tie Crane to that quote.',
        },
        handoff: 'Next, check the ledger against the call log.',
      }),
      { maxWordsPerSlot: 18 },
    ),
  });
  const audit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: selectedConfiguration,
    world: {
      title: 'The Recalled Edition',
      setting: 'A ledger and call log lie open on the archive desk.',
      question: 'Who inserted the false quote?',
      premiseById: new Map(),
    },
  });

  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.equal(audit.axes.actorial_part.visible, true);
  assert.equal(audit.axes.actorial_performance.visible, true);
  assert.equal(audit.axes.engagement_stance.visible, true);
  assert.equal(audit.axes.action_family.owner, 'handoff');
  assert.equal(audit.axes.action_family.visible, true);
  assert.equal(audit.compositePartOwnership.ok, true);
  assert.deepEqual(
    audit.compositePartOwnership.requirements.map((row) => [row.id, row.owner, row.ok]),
    [
      ['performance_initiation', 'performance', true],
      ['performance_action_absent', 'performance', true],
      ['handoff_relevant_delegated_complement', 'handoff', true],
      ['handoff_selected_action', 'handoff', true],
    ],
  );
});

test('V32 speaking contract rejects the saved V31 static-break shape and preserves a compliant owner-local counterfactual', () => {
  const selectedConfiguration = advocateConfiguration({ engagement_stance: 'charismatic' });
  const contract = firstDraftContract({
    learnerText: 'What should I put in the minutes about the chargers being dark during the stocktake?',
    responseConfiguration: selectedConfiguration,
    responseCompositionFrame: {
      learner_move: { summary: 'Asks for wording about the stocktake evidence.' },
      scene_action_budget: { saturated: true },
    },
  });
  assert.equal(contract.progression.handoff_contract.question_allowed, false);
  const plan = buildTutorStubJointPerformanceHostPlan(contract);
  const world = {
    title: 'The Thursday Brownouts of Tallow Street',
    setting: 'The meeting minutes, stocktake note, and pen chart lie on the hall table.',
    question: 'What browns out Tallow Street every Thursday evening?',
    premiseById: new Map(),
  };
  const auditSlots = (slots) => {
    const composition = composeTutorStubJointPerformanceFirstDraft({
      structured: parseTutorStubJointPerformanceFirstDraft(JSON.stringify(slots), {
        maxWordsPerSlot: 18,
      }),
    });
    return auditTutorStubJointPerformanceOwnership({
      composition,
      candidate: composition.text,
      configuration: selectedConfiguration,
      world,
      progressionContract: contract.progression,
      firstDraftContract: contract,
      jointPerformanceHostPlan: plan,
    });
  };

  const v31Failure = auditSlots({
    uptake: 'Write: "The dark chargers did not cause that evening’s brownout."',
    performance: {
      entry: 'My case is weakened: the chargers were dark when the brownout arrived.',
      response: 'The stocktake supports that, but it does not establish the actual source.',
    },
    handoff: 'The depot motion breaks against the dark chargers and the 18:40 brownout.',
  });
  assert.equal(v31Failure.ok, false);
  assert.equal(
    v31Failure.compositePartOwnership.requirements.find((row) => row.id === 'performance_initiation')?.ok,
    false,
  );
  assert.equal(
    v31Failure.compositePartOwnership.requirements.find(
      (row) => row.id === 'handoff_relevant_delegated_complement',
    )?.ok,
    false,
  );
  assert.equal(
    v31Failure.compositePartOwnership.requirements.find((row) => row.id === 'handoff_selected_action')?.ok,
    false,
  );

  const compliant = auditSlots({
    uptake: 'Write: "Dark chargers cannot explain the 18:40 brownout; its source remains elsewhere."',
    performance: {
      entry: 'My case is that dark chargers cannot explain a brownout that still happened.',
      response: 'The stocktake supports that, but it does not establish which supply failed.',
    },
    handoff: 'Next, trace the 18:40 brownout through Tallow Street’s remaining supply.',
  });
  assert.equal(compliant.ok, true, JSON.stringify(compliant.issues));
  assert.equal(compliant.axes.actorial_part.visible, true);
  assert.equal(compliant.axes.action_family.visible, true);
  assert.equal(compliant.compositePartOwnership.requirements.every((row) => row.ok), true);
});

test('V32 declarative operation wording stays out of closure, direct repair, settled completion, and non-advocate paths', () => {
  const advocate = advocateConfiguration({ engagement_stance: 'charismatic' });
  const closure = firstDraftContract({
    responseConfiguration: advocate,
    dialogueClosureFrame: { mandatory: true, allowCheckIn: false, phase: 'terminal' },
  });
  const directRepair = firstDraftContract({
    responseConfiguration: advocate,
    questionSupport: { responsiveRepairRequired: true },
  });
  const settled = firstDraftContract({
    responseConfiguration: advocate,
    responseCompositionFrame: {
      learner_move: { summary: 'The learner accepts the timing result.' },
      conversational_completion: {
        resolved: true,
        sourceTutorQuestion: 'What does the timing rule out?',
        acceptedMeaning: 'The chargers cannot cause the first dip.',
      },
      scene_action_budget: { saturated: false },
    },
  });
  const nonAdvocate = firstDraftContract({
    responseConfiguration: configuration({ actorial_part: 'examiner' }),
  });
  const nonStage = firstDraftContract({
    responseConfiguration: advocateConfiguration({ action_family: 'clarify_distinction' }),
  });

  assert.equal(closure.progression.handoff_contract.mode, 'closure');
  assert.equal(directRepair.progression.handoff_contract.mode, 'direct_answer');
  assert.equal(settled.progression.handoff_contract.mode, 'declarative_missing_support');
  assert.ok(settled.progression.handoff_contract.prohibited_settled_surfaces.length > 0);
  for (const contract of [closure, directRepair, settled, nonAdvocate, nonStage]) {
    const instruction = buildTutorStubJointPerformanceHostPlan(contract).slots.handoff.instruction;
    assert.doesNotMatch(instruction, /Begin HANDOFF with “Next,” or “Now,”/iu);
  }
  for (const contract of [closure, directRepair, settled]) {
    const instruction = buildTutorStubJointPerformanceHostPlan(contract).slots.handoff.instruction;
    assert.match(
      instruction,
      /Make HANDOFF the relevant concrete way to test, resist, or break that case/iu,
    );
  }
});

test('typed advocate ownership accepts a generic relational operation and reports exact subrequirements', () => {
  const selectedConfiguration = advocateConfiguration();
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(
      JSON.stringify({
        uptake: 'That keeps the attribution open.',
        performance: {
          entry: 'My case is a possible die-cutter, but not yet a coiner.',
          response: 'The metal keeps that distinction within the public evidence.',
        },
        handoff: 'Set the shilling by the touchstone and ask what its metal can tell us.',
      }),
      { maxWordsPerSlot: 18 },
    ),
  });
  const audit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: selectedConfiguration,
    world: {
      title: 'A public assay',
      setting: 'A metal shilling and touchstone rest on the bench.',
      question: 'What does the public assay establish?',
      premiseById: new Map(),
    },
  });

  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.equal(audit.axes.actorial_part.owner, 'composite');
  assert.equal(audit.axes.actorial_part.initiation_owner, 'performance');
  assert.equal(audit.axes.actorial_part.delegated_complement_owner, 'handoff');
  assert.deepEqual(audit.compositePartOwnership.linkage.shared_content_tokens, ['metal']);
  assert.equal(audit.compositePartOwnership.requirements.every((row) => row.ok), true);
  assert.deepEqual(audit.compositePartOwnership.excluded_span_ids, []);
});

test('typed composite ownership repairs one deterministic part miss without semantic adjudication', () => {
  const selectedConfiguration = advocateConfiguration();
  const world = {
    title: 'A public assay',
    setting: 'A metal shilling and touchstone rest on the bench.',
    question: 'What does the public assay establish?',
    premiseById: new Map(),
  };
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(
      JSON.stringify({
        uptake: 'That keeps the attribution open.',
        performance: {
          entry: 'My case is a possible die-cutter, but not yet a coiner.',
          response: 'The metal keeps that distinction within the public evidence.',
        },
        handoff: 'Set the shilling by the touchstone and ask what its metal can tell us.',
      }),
    ),
  });
  const responseAudit = auditTutorStubResponseConfiguration({
    text: composition.text,
    configuration: selectedConfiguration,
    world,
  });
  assert.equal(responseAudit.axes.actorial_part.part_visible, false);
  assert.equal(responseAudit.axes.actorial_part.performance_visible, true);
  assert.deepEqual(
    responseAudit.actorial_realization.issues.map((issue) => issue.type),
    ['missing_selected_actorial_part'],
  );
  const passingAudit = { ok: true, issues: [] };
  const baseAudit = {
    ok: false,
    safetyFailure: false,
    failureClusters: ['actorialRealizationAudit:missing_selected_actorial_part'],
    hardFailureClusters: ['actorial_realization:missing_selected_actorial_part'],
    advisoryFailureClusters: [],
    reportOnlyFailureClusters: [],
    shadowAdvisoryFailureClusters: [],
    deliveryDecision: {
      ok: false,
      hardIssues: [{ guard: 'actorial_realization', type: 'missing_selected_actorial_part' }],
      advisoryIssues: [],
      reportOnlyIssues: [],
      shadow: { advisoryIssues: [] },
    },
    audits: {
      leakAudit: passingAudit,
      scaffoldAudit: passingAudit,
      questionSupportAudit: passingAudit,
      dramaticReleaseAudit: passingAudit,
      actorialRealizationAudit: responseAudit.actorial_realization,
      responseConfigurationAudit: responseAudit,
      responseCompositionAudit: passingAudit,
      repetitionAudit: passingAudit,
      closureAudit: passingAudit,
      releaseDeliveryAudit: passingAudit,
    },
    performanceAdjudicationEligibility: { eligible: false, reason: 'unsupported_performance_tactic' },
  };
  const combined = applyTutorStubJointPerformanceOwnershipAudit({
    audit: baseAudit,
    composition,
    candidate: composition.text,
    configuration: selectedConfiguration,
    world,
  });

  assert.equal(combined.ok, true, JSON.stringify(combined.failureClusters));
  assert.equal(combined.deterministicCompositePartRecognition.applied, true);
  assert.equal(combined.audits.actorialRealizationAudit.ok, true);
  assert.deepEqual(combined.audits.actorialRealizationAudit.issues, []);
  assert.deepEqual(combined.performanceAdjudicationEligibility, {
    eligible: false,
    reason: 'deterministic_composite_part_ownership_passed',
  });
  assert.equal(combined.performanceAdjudication, undefined);
});

test('typed advocate ownership rejects missing initiation, unrelated handoff, SOURCE rescue, and PERFORMANCE action', () => {
  const selectedConfiguration = advocateConfiguration();
  const world = {
    title: 'A public archive',
    setting: 'A ledger, call log, sample, and balance rest on the archive table.',
    question: 'What does the public record establish?',
    premiseById: new Map(),
  };
  const cases = [
    {
      id: 'handoff_only',
      performance: {
        entry: 'The ledger leaves the attribution unproved.',
        response: 'The ledger remains within its recorded limit.',
      },
      handoff: 'Next, check the ledger against the call log.',
      failed: 'performance_initiation',
    },
    {
      id: 'unrelated_handoff',
      performance: {
        entry: 'My case is bounded by the ledger, not yet by custody.',
        response: 'That ledger supports attribution only within the archive.',
      },
      handoff: 'Next, weigh the sample on the balance.',
      failed: 'handoff_relevant_delegated_complement',
    },
    {
      id: 'performance_action',
      performance: {
        entry: 'My case is bounded by the ledger, not yet by custody.',
        response: 'Next, check the ledger against the call log.',
      },
      handoff: 'Now, compare that ledger with the call log.',
      failed: 'performance_action_absent',
    },
  ];
  for (const row of cases) {
    const composition = composeTutorStubJointPerformanceFirstDraft({
      structured: parseTutorStubJointPerformanceFirstDraft(
        JSON.stringify({
          uptake: 'That leaves the attribution open.',
          performance: row.performance,
          handoff: row.handoff,
        }),
      ),
    });
    const audit = auditTutorStubJointPerformanceOwnership({
      composition,
      candidate: composition.text,
      configuration: selectedConfiguration,
      world,
    });
    assert.equal(audit.ok, false, row.id);
    assert.equal(
      audit.compositePartOwnership.requirements.find((requirement) => requirement.id === row.failed)?.ok,
      false,
      row.id,
    );
  }

  const sourceComposition = composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(
      JSON.stringify({
        uptake: 'That leaves the attribution open.',
        performance: {
          entry: 'The ledger remains bounded by its recorded line.',
          response: 'The ledger leaves custody unproved.',
        },
        handoff: 'Next, check the ledger against the call log.',
      }),
    ),
    dramaticReleaseFrame: {
      active: true,
      entries: [{ mode: 'presented_exhibit', surface: 'My case is bounded by the ledger, not yet by custody.' }],
    },
  });
  const sourceAudit = auditTutorStubJointPerformanceOwnership({
    composition: sourceComposition,
    candidate: sourceComposition.text,
    configuration: selectedConfiguration,
    world,
  });
  assert.equal(sourceAudit.ok, false);
  assert.equal(
    sourceAudit.compositePartOwnership.requirements.find((row) => row.id === 'performance_initiation').ok,
    false,
  );
  assert.deepEqual(sourceAudit.compositePartOwnership.excluded_span_ids, ['source_1']);
});

test('v2 compiles precise and charismatic stance as action-neutral performance contracts', () => {
  const preciseContract = firstDraftContract({
    responseConfiguration: configuration({ engagement_stance: 'precise' }),
  });
  const charismaticContract = firstDraftContract({
    responseConfiguration: configuration({ engagement_stance: 'charismatic' }),
  });
  const precise = buildTutorStubJointPerformanceHostPlan(preciseContract).slots.performance;
  const charismatic = buildTutorStubJointPerformanceHostPlan(charismaticContract).slots.performance;

  assert.equal(precise.stance_instruction_source, 'stance_definition');
  assert.match(precise.stance_instruction, /distinction or warrant cleanly on the current public material/iu);
  assert.match(precise.stance_instruction, /expose what would count against it/iu);
  assert.doesNotMatch(precise.stance_instruction, /ask for one check/iu);
  assert.equal(charismatic.stance_instruction_source, 'stance_definition');
  assert.match(charismatic.stance_instruction, /sharper contrast, consequence, or challenge/iu);
  assert.match(charismatic.stance_instruction, /leaving refusal legible/iu);
  assert.doesNotMatch(charismatic.stance_instruction, /curriculum-grounded move/iu);
  assert.notEqual(precise.stance_instruction, charismatic.stance_instruction);
  for (const performance of [precise, charismatic]) {
    assert.match(performance.stance_instruction, /HANDOFF owns that action/iu);
  }
});

test('every router stance declares a joint-performance contract and other stances fail safe', () => {
  const definitions = getEngagementStanceDefinitions();
  for (const [stance, definition] of Object.entries(definitions)) {
    if (definition.router_selectable !== true) continue;
    assert.ok(definition.joint_performance_contract?.trim(), stance);
    assert.equal(getJointPerformanceStanceContract(stance).source, 'stance_definition', stance);
  }
  const fallback = getJointPerformanceStanceContract('ironic');
  assert.equal(fallback.source, 'safe_fallback');
  assert.match(fallback.contract, /sentence rhythm, contrast/iu);
  assert.match(fallback.contract, /HANDOFF owns that action/iu);
});

test('v2 frozen replacement recompiles the stance and final host plan while recording explicit schemas', () => {
  const responseConfiguration = configuration({ engagement_stance: 'precise' });
  const bundle = {
    firstDraftContract: firstDraftContract({ responseConfiguration }),
    selectedResponseConfiguration: responseConfiguration,
    request: {
      messages: [
        { role: 'assistant', content: 'Public opening.' },
        {
          role: 'user',
          content: [
            'Public learner turn.',
            tutorStubResponseConfigurationPrompt(responseConfiguration),
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
  assert.match(replaced.request.messages.at(-1).content, /expose what would count against it/iu);
  assert.doesNotMatch(replaced.request.messages.at(-1).content, /ask for one check/iu);
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

test('v2 parser canonicalizes only I3 outer transport whitespace and preserves the raw draw', () => {
  const raw = '{"uptake":"Write: “The lead-sweat shows these newly struck shillings are debased, not clipped.”","performance":{"entry":"Together, we hold the shilling against the touchstone’s dark streak.","response":"What does that streak tell you about the coin’s metal? "},"handoff":"Next, compare the shilling’s alloy with crucible leavings."}';
  const parsed = parseTutorStubJointPerformanceFirstDraft(raw);
  const composition = composeTutorStubJointPerformanceFirstDraft({ structured: parsed });

  assert.equal(parsed.raw, raw);
  assert.deepEqual(parsed.transport_normalizations, [
    { slot: 'performance.response', type: 'trim_outer_whitespace', count: 1 },
  ]);
  assert.equal(parsed.slots.performance.response, 'What does that streak tell you about the coin’s metal?');
  assert.equal(
    composition.text,
    'Write: “The lead-sweat shows these newly struck shillings are debased, not clipped.” Together, we hold the shilling against the touchstone’s dark streak. What does that streak tell you about the coin’s metal? Next, compare the shilling’s alloy with crucible leavings.',
  );
});

test('v2 transport canonicalization does not admit blank, multiline, bad-punctuation, or over-limit slots', () => {
  assert.throws(
    () => parseTutorStubJointPerformanceFirstDraft(validRaw({ handoff: '   ' })),
    /slot_is_empty:handoff/u,
  );
  assert.throws(
    () => parseTutorStubJointPerformanceFirstDraft(validRaw({ handoff: 'First line.\nSecond line.' })),
    /slot_is_multiline:handoff/u,
  );
  assert.throws(
    () => parseTutorStubJointPerformanceFirstDraft(validRaw({ handoff: 'Still no terminal punctuation   ' })),
    /slot_needs_terminal_punctuation:handoff/u,
  );
  assert.throws(
    () =>
      parseTutorStubJointPerformanceFirstDraft(
        validRaw({ handoff: 'One two three four five six.' }),
        { maxWordsPerSlot: 5 },
      ),
    /slot_exceeds_word_target:handoff:6>5/u,
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
  assert.match(composition.text, /touchstone\. “I read from the record: The ledger records/u);
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

test('opt-in V29 compensation keeps exact SOURCE host-owned and reserves performance response for audited accessibility', () => {
  const surface =
    "The private-seal register has one entry for the dusk-seal: Elian, night notary of the lower quay, drew it for curfew warrants and returned it chipped at the raven's wing the morning after the coffer left town.";
  const compensation =
    'Elian drew it for curfew warrants and returned it chipped after the coffer left town.';
  const contract = firstDraftContract({
    learnerText: 'That register sentence is hard to follow.',
    dramaticReleaseFrame: {
      active: true,
      entries: [{ mode: 'presented_exhibit', surface }],
    },
    sourceAccessibilityPolicy: 'direct_or_compensated_v1',
  });
  const plan = buildTutorStubJointPerformanceHostPlan(contract);
  const prompt = tutorStubJointPerformanceFirstDraftPrompt(contract);

  assert.equal(contract.evidence.source_accessibility.effective_mode, 'compensated');
  assert.equal(contract.evidence.source_accessibility.owner, 'performance_response');
  assert.deepEqual(plan.axis_ownership.actorial_part, ['performance_entry']);
  assert.deepEqual(plan.axis_ownership.actorial_performance, ['performance_entry']);
  assert.deepEqual(plan.axis_ownership.engagement_stance, ['performance_entry']);
  assert.deepEqual(plan.axis_ownership.source_accessibility, ['performance_response']);
  assert.match(prompt, /PERFORMANCE RESPONSE — \[Tutor-only SOURCE accessibility contract\]/u);
  assert.doesNotMatch(prompt, /JOINT PERFORMANCE —/u);
  assert.ok(wordCount(prompt) <= 350, `expected at most 350 V2 prompt words, received ${wordCount(prompt)}`);

  const structured = parseTutorStubJointPerformanceFirstDraft(
    validRaw({
      uptake: 'That sentence packs several events together, so I will separate its usable thread.',
      performance: {
        entry: 'Together, we pause beside the open book before reading.',
        response: compensation,
      },
      handoff: 'The register now gives us one concrete link to test.',
    }),
  );
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured,
    dramaticReleaseFrame: contract.evidence.active
      ? { active: true, entries: [{ mode: 'presented_exhibit', surface }] }
      : null,
    sourceAccessibility: contract.evidence.source_accessibility,
  });

  assert.equal(composition.sourceAccessibilityAudit.ok, true, JSON.stringify(composition.sourceAccessibilityAudit));
  assert.equal(composition.sourceAccessibilityAudit.visible, true);
  assert.deepEqual(
    composition.spans.map((span) => span.id),
    ['uptake', 'performance_entry', 'source_1', 'performance_response', 'handoff'],
  );
  assert.equal(composition.text.split(surface).length - 1, 1);
  assert.equal(composition.spans[3].text, compensation);
  const ownership = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: configuration(),
    progressionContract: contract.progression,
    sourceAccessibility: contract.evidence.source_accessibility,
  });
  assert.equal(ownership.sourceAccessibilityAudit.ok, true);
  assert.equal(ownership.axes.source_accessibility.owner, 'performance_response');
  assert.equal(ownership.axes.source_accessibility.visible, true);
  assert.equal(ownership.performanceText, composition.spans[1].text);
  assert.deepEqual(ownership.boundaries.performance, ['performance_entry']);

  const invalid = parseTutorStubJointPerformanceFirstDraft(
    validRaw({ performance: { response: 'This means the clue is easier to understand.' } }),
  );
  assert.throws(
    () =>
      composeTutorStubJointPerformanceFirstDraft({
        structured: invalid,
        dramaticReleaseFrame: { active: true, entries: [{ mode: 'presented_exhibit', surface }] },
        sourceAccessibility: contract.evidence.source_accessibility,
      }),
    /source_accessibility_compensation_failed/iu,
  );
});

test('frozen V2 compensated candidate is accepted without V1 owner inference or duplicate-clue rejection', () => {
  const surface =
    "The private-seal register has one entry for the dusk-seal: Elian, night notary of the lower quay, drew it for curfew warrants and returned it chipped at the raven's wing the morning after the coffer left town.";
  const compensation =
    'Elian drew it for curfew warrants and returned it chipped after the coffer left town.';
  const selectedConfiguration = configuration({ scene_immersion: 'grounded' });
  const dramaticReleaseFrame = {
    active: true,
    requiresExhibitHandoff: true,
    entries: [{ mode: 'presented_exhibit', surface }],
  };
  const contract = firstDraftContract({
    learnerText: "I can't follow Elian's register entry about the dusk-seal.",
    responseConfiguration: selectedConfiguration,
    dramaticReleaseFrame,
    sourceAccessibilityPolicy: 'direct_or_compensated_v1',
  });
  const structured = parseTutorStubJointPerformanceFirstDraft(
    validRaw({
      uptake: 'You are right that the dusk-seal sentence is hard to follow, so we will separate it.',
      performance: {
        entry: 'Together, we open the book between us and make room for your reading.',
        response: compensation,
      },
      handoff: 'What careful public test should we use next about the dusk-seal, register, and Elian?',
    }),
  );
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured,
    dramaticReleaseFrame,
    sourceAccessibility: contract.evidence.source_accessibility,
  });
  const world = {
    title: 'The Raven Seal',
    setting: 'The private-seal register lies open on the quay desk.',
    question: 'Who used the dusk-seal?',
    premiseById: new Map(),
    premises: [],
    releaseSchedule: [],
    rules: [],
    background: [],
  };
  const frozenBundle = {
    guards: { dramaticRelease: true },
    learnerText: "I can't follow Elian's register entry about the dusk-seal.",
    firstDraftContract: contract,
    selectedResponseConfiguration: selectedConfiguration,
    frames: {
      dramaticRelease: dramaticReleaseFrame,
      responseComposition: null,
      generousInference: null,
      questionSupport: null,
      dialogueClosure: null,
    },
    duePremiseIds: [],
    publicPremiseIds: [],
    priorTurns: [],
    priorTutorTexts: [],
    turn: 5,
  };
  const baseAudit = auditTutorStubFrozenCandidate({
    bundle: frozenBundle,
    world,
    text: composition.text,
    jointPerformanceComposition: composition,
  });

  assert.equal(baseAudit.ok, true, JSON.stringify(baseAudit.failureClusters));
  assert.equal(baseAudit.audits.liveTurnProgressionAudit.active, false);
  assert.equal(
    baseAudit.audits.liveTurnProgressionAudit.reason,
    'typed_joint_performance_audit_owns_progression',
  );
  assert.equal(baseAudit.audits.liveSourceActionAlignmentAudit.active, false);
  assert.equal(
    baseAudit.audits.liveSourceActionAlignmentAudit.reason,
    'typed_joint_performance_audit_owns_source_and_compensation',
  );
  assert.equal(baseAudit.audits.dramaticReleaseAudit.clueDeliveryMultiplicity.ok, true);
  assert.deepEqual(
    baseAudit.audits.dramaticReleaseAudit.clueDeliveryMultiplicity.exemptedPassingCompensations,
    [compensation],
  );
  const schemaOnlyAudit = auditTutorStubFrozenCandidate({
    bundle: frozenBundle,
    world,
    text: composition.text,
    jointPerformanceComposition: {
      schema: TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
    },
  });
  assert.equal(schemaOnlyAudit.audits.liveTurnProgressionAudit.active, true);
  assert.equal(schemaOnlyAudit.audits.liveSourceActionAlignmentAudit.active, true);

  const finalAudit = applyTutorStubJointPerformanceOwnershipAudit({
    audit: baseAudit,
    composition,
    candidate: composition.text,
    configuration: selectedConfiguration,
    world,
    progressionContract: contract.progression,
    sourceAccessibility: contract.evidence.source_accessibility,
  });
  assert.equal(
    finalAudit.ok,
    true,
    JSON.stringify({
      hardFailureClusters: finalAudit.hardFailureClusters,
      progression: finalAudit.audits.turnProgressionAudit,
    }),
  );
  assert.equal(finalAudit.audits.sourceAccessibilityAudit.ok, true);
  assert.equal(finalAudit.audits.turnProgressionAudit.ok, true);
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
      entries: [
        {
          mode: 'enacted_role',
          role: 'leat-keeper reading the charcoal book',
          action_referents: [{ label: 'leat-keeper’s book' }],
          surface: contrary,
        },
      ],
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

test('I4 judgment-falters recognition is gated by the complete public counterpressure contract', () => {
  const target =
    "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand.";
  const contrary =
    "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out.";
  const responseConfiguration = configuration({
    engagement_stance: 'charismatic',
    action_family: 'stage_next_step',
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
    setting: 'The leat-keeper’s book lies beside the Marrick shillings and Verrell’s mint-yard record.',
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
      public_objects: ['leat-keeper’s book', 'shillings'],
    },
    publicTurn: {
      visibility: 'public',
      learner_move: 'Who cast the blanks?',
      pressure_target: target,
      contrary_evidence: [contrary],
      public_evidence: [{ surface: target }],
      due_evidence: [{ surface: contrary }],
    },
  });
  const exactResponse =
    'Verrell’s ready judgment falters: the weir record points away from his mint-yard crucible.';
  const exactHandoff = 'What does this record support about the hand that cast these blanks?';
  const auditFor = ({ response = exactResponse, handoff = exactHandoff, includeSource = true } = {}) => {
    const structured = parseTutorStubJointPerformanceFirstDraft(
      validRaw({
        uptake: 'Write: “The caster of the weir-forge blanks is not yet named.”',
        performance: {
          entry: 'I open the leat-keeper’s book, leaving the caster’s name unproved.',
          response,
        },
        handoff,
      }),
    );
    const composition = composeTutorStubJointPerformanceFirstDraft({
      structured,
      dramaticReleaseFrame: includeSource
        ? {
            active: true,
            entries: [
              {
                mode: 'enacted_role',
                role: 'leat-keeper reading the charcoal book',
                action_referents: [{ label: 'leat-keeper’s book' }],
                surface: contrary,
              },
            ],
          }
        : { active: false, entries: [] },
    });
    return auditTutorStubJointPerformanceOwnership({
      composition,
      candidate: composition.text,
      configuration: responseConfiguration,
      world,
      performanceObligationContract,
    });
  };

  const exact = auditFor();
  assert.equal(performanceObligationContract.complete, true);
  assert.equal(exact.axes.actorial_performance.visible, true, JSON.stringify(exact.issues));
  assert.equal(exact.axes.engagement_stance.visible, true, JSON.stringify(exact.issues));
  assert.equal(exact.ok, true, JSON.stringify(exact.issues));
  assert.equal(exact.spanAudits.performance.publicJudgmentFalterRecognition.recognized, true);
  const overlaps = exact.spanAudits.performance.publicJudgmentFalterRecognition.anchor_overlap_count;
  assert.ok(overlaps.pressure_target >= 2);
  assert.ok(overlaps.contrary_evidence > 0);
  assert.ok(overlaps.learner_handoff > 0);
  assert.deepEqual(exact.spanAudits.performance.publicJudgmentFalterRecognition.excluded_source_span_ids, [
    'source_1',
  ]);

  const britishSpelling = auditFor({
    response: 'Verrell’s ready judgement falters: the weir record points away from his mint-yard crucible.',
  });
  assert.equal(britishSpelling.axes.actorial_performance.visible, true, JSON.stringify(britishSpelling.issues));
  assert.equal(britishSpelling.axes.engagement_stance.visible, true, JSON.stringify(britishSpelling.issues));

  const negatives = [
    ['missing exact SOURCE', auditFor({ includeSource: false })],
    ['missing learner-handoff anchor', auditFor({ handoff: 'What should we inspect next?' })],
    [
      'unrelated judgment',
      auditFor({
        response: 'Mira’s ready judgment falters: the chapel record points away from her garden gate.',
      }),
    ],
  ];
  for (const [label, audit] of negatives) {
    assert.equal(audit.axes.actorial_performance.visible, false, label);
    assert.equal(audit.axes.engagement_stance.visible, false, label);
    assert.equal(audit.ok, false, label);
    assert.equal(audit.spanAudits.performance.publicJudgmentFalterRecognition.recognized, false, label);
  }
});

test('I7 exact I6 judgment-meets-evidence event is typed, joint-owned, and contract-gated', () => {
  const target =
    "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day. Whatever metal is cast in Marrick, the town says, is cast by Verrell's hand.";
  const contrary =
    "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder's widow, who stayed on in the forge cottage when the fires went out.";
  const responseConfiguration = configuration({
    engagement_stance: 'charismatic',
    action_family: 'stage_next_step',
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
    setting: 'The leat-keeper’s book lies beside the Marrick shillings and Verrell’s mint-yard record.',
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
      public_objects: ['leat-keeper’s book', 'shillings'],
    },
    publicTurn: {
      visibility: 'public',
      learner_move: 'Who cast the blanks?',
      pressure_target: target,
      contrary_evidence: [contrary],
      public_evidence: [{ surface: target }],
      due_evidence: [{ surface: contrary }],
    },
  });
  const exactRaw =
    '{"uptake":"Write: “We have not yet learned whose hand cast blanks at the weir-forge.”","performance":{"entry":"I open the leat-keeper’s book and leave the caster’s line unfilled.","response":"Verrell’s ready claim fails against Edony’s solitary forge record."},"handoff":"What does this record now support about the hand that cast these blanks?"}';
  const exactSlots = JSON.parse(exactRaw);
  const auditFor = ({
    raw = exactRaw,
    includeSource = true,
    contract = performanceObligationContract,
    reconcileLegacy = false,
  } = {}) => {
    const structured = parseTutorStubJointPerformanceFirstDraft(raw);
    const composition = composeTutorStubJointPerformanceFirstDraft({
      structured,
      dramaticReleaseFrame: includeSource
        ? {
            active: true,
            entries: [
              {
                mode: 'enacted_role',
                role: 'leat-keeper reading the charcoal book',
                action_referents: [{ label: 'leat-keeper’s book' }],
                surface: contrary,
              },
            ],
          }
        : { active: false, entries: [] },
    });
    const ownershipAudit = auditTutorStubJointPerformanceOwnership({
      composition,
      candidate: composition.text,
      configuration: responseConfiguration,
      world,
      performanceObligationContract: contract,
    });
    if (!reconcileLegacy) return ownershipAudit;
    return applyTutorStubJointPerformanceOwnershipAudit({
      audit: {
        ok: true,
        safetyFailure: false,
        failureClusters: ['actorialRealizationAudit:missing_selected_performance_tactic'],
        hardFailureClusters: [],
        advisoryFailureClusters: ['actorial_realization:missing_selected_performance_tactic'],
        reportOnlyFailureClusters: [],
        shadowAdvisoryFailureClusters: [],
        deliveryDecision: { ok: true, hardIssues: [], advisoryIssues: [] },
        audits: {
          actorialRealizationAudit: {
            schema: 'machinespirits.tutor-stub.actorial-realization-audit.v1',
            ok: false,
            issues: [
              {
                type: 'missing_selected_performance_tactic',
                reason: 'legacy whole-response audit did not see the owned tactic across SOURCE',
              },
            ],
          },
        },
        performanceAdjudicationEligibility: { eligible: true, reason: 'unsupported_performance_tactic' },
      },
      composition,
      candidate: composition.text,
      configuration: responseConfiguration,
      world,
      performanceObligationContract: contract,
    });
  };
  const rawWith = (overrides = {}) =>
    JSON.stringify({
      ...exactSlots,
      ...overrides,
      performance: { ...exactSlots.performance, ...(overrides.performance || {}) },
    });

  const exact = auditFor();
  const recognition = exact.spanAudits.performance.publicJudgmentMeetsContraryEvidenceRecognition;
  assert.equal(performanceObligationContract.complete, true);
  assert.equal(exact.axes.actorial_performance.visible, true, JSON.stringify(exact.issues));
  assert.equal(exact.axes.engagement_stance.visible, true, JSON.stringify(exact.issues));
  assert.equal(exact.ok, true, JSON.stringify(exact.issues));
  assert.equal(recognition.construction, 'declared_public_judgment_meets_contrary_evidence');
  assert.equal(recognition.recognized, true);
  assert.equal(recognition.same_owned_sentence, exactSlots.performance.response);
  assert.ok(recognition.anchor_overlap_count.pressure_target >= 2);
  assert.ok(recognition.anchor_overlap_count.contrary_evidence >= 2);
  assert.ok(recognition.anchor_overlap_count.learner_handoff >= 1);
  assert.deepEqual(recognition.excluded_source_span_ids, ['source_1']);
  assert.equal(exact.spanAudits.performance.publicJudgmentFalterRecognition.recognized, false);

  const reconciled = auditFor({ reconcileLegacy: true });
  assert.equal(reconciled.ok, true, JSON.stringify(reconciled.failureClusters));
  assert.equal(reconciled.audits.actorialRealizationAudit.ok, true);
  assert.deepEqual(reconciled.audits.actorialRealizationAudit.issues, []);
  assert.equal(reconciled.deterministicJointPerformanceRecognition.applied, true);
  assert.equal(
    reconciled.deterministicJointPerformanceRecognition.legacyWholeResponseActorialRealizationAudit.ok,
    false,
  );
  assert.deepEqual(reconciled.performanceAdjudicationEligibility, {
    eligible: false,
    reason: 'deterministic_joint_performance_ownership_passed',
  });

  const wrongTacticContract = structuredClone(performanceObligationContract);
  wrongTacticContract.selection.actorial_performance.id = 'measured_testimony';
  const negatives = [
    [
      'pressure target',
      auditFor({
        raw: rawWith({
          performance: { response: 'This claim fails against Edony’s solitary forge record.' },
        }),
      }),
      'pressure_target_overlap_at_least_two',
    ],
    [
      'contrary evidence',
      auditFor({
        raw: rawWith({
          performance: { response: 'Verrell’s ready claim fails against this new account.' },
        }),
      }),
      'contrary_evidence_overlap_at_least_two',
    ],
    ['host SOURCE', auditFor({ includeSource: false }), 'exact_contrary_source_present'],
    [
      'learner handoff',
      auditFor({ raw: rawWith({ handoff: 'What should we consider next?' }) }),
      null,
    ],
    ['selected tactic', auditFor({ contract: wrongTacticContract }), 'selected_tactic_matches'],
    [
      'selected part',
      auditFor({
        raw: rawWith({
          performance: { entry: 'I wait beside the book while the rain falls.' },
        }),
      }),
      'selected_part_visible',
    ],
  ];
  for (const [label, audit, failedPrerequisite] of negatives) {
    const result = audit.spanAudits.performance.publicJudgmentMeetsContraryEvidenceRecognition;
    assert.equal(result.recognized, false, label);
    if (failedPrerequisite) assert.equal(result.prerequisites[failedPrerequisite], false, label);
    if (label === 'learner handoff') assert.equal(result.anchor_overlap_count.learner_handoff, 0, label);
    assert.equal(audit.axes.actorial_performance.visible, false, label);
    assert.equal(audit.axes.engagement_stance.visible, false, label);
  }

  const failedAxisCannotRescue = auditFor({
    raw: rawWith({
      performance: { response: 'This claim fails against Edony’s solitary forge record.' },
    }),
    reconcileLegacy: true,
  });
  assert.equal(failedAxisCannotRescue.audits.jointPerformanceAudit.ok, false);
  assert.equal(failedAxisCannotRescue.audits.actorialRealizationAudit.ok, false);
  assert.equal(failedAxisCannotRescue.deterministicJointPerformanceRecognition.applied, false);
  assert.match(
    failedAxisCannotRescue.hardFailureClusters.join('\n'),
    /jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance/iu,
  );
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

test('turn progression failure is a separate hard delivery gate after joint ownership passes', () => {
  const selectedConfiguration = advocateConfiguration();
  const contract = firstDraftContract({ responseConfiguration: selectedConfiguration });
  assert.equal(contract.progression.handoff_contract.question_allowed, false);
  const composition = composeTutorStubJointPerformanceFirstDraft({
    structured: parseTutorStubJointPerformanceFirstDraft(
      validRaw({
        performance: {
          entry: 'My case is a possible die-cutter, but not yet a coiner.',
          response: 'The metal keeps that distinction within the public evidence.',
        },
        handoff: 'What can test this metal case?',
      }),
    ),
  });
  const joint = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate: composition.text,
    configuration: selectedConfiguration,
    progressionContract: contract.progression,
  });
  assert.equal(joint.ok, true, JSON.stringify(joint.issues));

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
    configuration: selectedConfiguration,
    progressionContract: contract.progression,
  });

  assert.equal(combined.audits.jointPerformanceAudit.ok, true);
  assert.equal(combined.audits.turnProgressionAudit.ok, false);
  assert.equal(combined.ok, false);
  assert.equal(combined.deliveryDecision.ok, false);
  assert.match(
    combined.hardFailureClusters.join('\n'),
    /turnProgressionAudit:question_forbidden_by_handoff_contract/iu,
  );
  assert.equal(combined.performanceAdjudicationEligibility.reason, 'turn_progression_failed');
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
  assert.match(tutorStubResponseConfigurationPrompt(configuration({ engagement_stance: 'precise' })), /ask for one check/iu);
  assert.throws(() => parseTutorStubJointPerformanceFirstDraft(v1Raw), /keys_must_be_exact_and_ordered/u);
  assert.throws(() => parseTutorStubStructuredFirstDraft(validRaw()), /keys_must_be_exact_and_ordered/u);
});

test('CLI exposes the explicit v2 flag and rejects simultaneous v1/v2 generation modes', () => {
  const help = spawnSync(process.execPath, [REPLAY_SCRIPT, '--help'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--joint-performance-generation/u);
  assert.match(help.stdout, /--source-accessibility-policy direct_or_compensated_v1/u);

  const conflicting = spawnSync(
    process.execPath,
    [REPLAY_SCRIPT, '--structured-generation', '--joint-performance-generation'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(conflicting.status, 0);
  assert.match(conflicting.stderr, /mutually exclusive/u);

  const compensationWithoutV2 = spawnSync(
    process.execPath,
    [REPLAY_SCRIPT, '--source-accessibility-policy', 'direct_or_compensated_v1'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(compensationWithoutV2.status, 0);
  assert.match(compensationWithoutV2.stderr, /requires --joint-performance-generation/u);
});
