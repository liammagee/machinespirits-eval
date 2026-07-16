import {
  getActorialPartDefinitions,
  getAudienceRegisterDefinitions,
  getEngagementStanceDefinition,
  getLexicalAccessibilityDefinitions,
  getSceneImmersionDefinitions,
} from './engagementRegisterRegistry.js';
import {
  TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA,
  tutorStubPerformanceObligationContractPrompt,
} from './tutorStubPerformanceObligationContract.js';
import { compileTutorStubCompositePartOwnership } from './tutorStubCompositePartOwnership.js';
import {
  renderTutorStubDueSource,
  tutorStubDueSourceActionInstruction,
  TUTOR_STUB_DUE_SOURCE_RENDER_SCHEMA,
} from './tutorStubDueSourceRenderer.js';
import {
  compileTutorStubTurnProgressionContract,
  tutorStubLearnerRequestsWritableEntry,
  TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
} from './tutorStubTurnProgressionContract.js';
import {
  compileTutorStubSourceAccessibilityContract,
  tutorStubSourceAccessibilityInstruction,
} from './tutorStubSourceAccessibilityContract.js';

export const TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA = 'machinespirits.tutor-stub.first-draft-turn-contract.v1';
export const TUTOR_STUB_HOST_PLAN_SCHEMA = 'machinespirits.tutor-stub.host-plan.v1';

const HOST_SLOT_IDS = Object.freeze(['uptake', 'part', 'tactic', 'handoff']);

const ACTION_CUES = Object.freeze({
  clarify_term:
    'Define the unresolved word in ordinary language with one concrete scene referent. Do not turn the definition into a proof test.',
  clarify_distinction:
    'State one concrete distinction, show what each side would look like in this scene, and test only that distinction.',
  stage_next_step: 'Put the next available public evidence into the scene before asking the learner to interpret it.',
  answer_accountably:
    'Answer the learner directly, state the limit of the answer, and give one public way it could be checked or corrected.',
  compress_sayback:
    'Turn what is already public into one short learner-sayable formulation without reopening a settled step.',
  reanchor_lived_stake:
    'Use one concrete scene consequence to restore orientation, then return immediately to the live public evidence.',
  reanchor_public_evidence:
    'Restage one already-public clue and its limit without testing or shaming the learner’s memory.',
  ground_in_material:
    'Work directly with the named public object, record, case, or material rather than explaining around it.',
  challenge_resistance:
    'Name the present obstacle without attacking the learner, then offer one small public move that restores choice.',
  receive_vulnerability:
    'Receive the learner’s concern without praise or capture, reduce the immediate pressure, and leave the next judgment with them.',
  close_inquiry:
    'State the licensed public finding, name its decisive support briefly, and close the inquiry without another proof demand.',
  baseline_plain_response: 'Give one direct public response and one compact next move without decorative explanation.',
});

const PART_CUES = Object.freeze({
  scene_partner:
    'In the unquoted host voice, say “I make room for you beside [named public object]” with the bracket replaced by a scene object, then return the observation to the learner.',
  examiner: 'In the unquoted host voice, visibly inspect, compare, test, weigh, or point to a named public exhibit.',
  record_keeper:
    'In the unquoted host voice, open, read, mark, enter, or close a named public record and distinguish what is entered from what remains unproved.',
  authored_source:
    'Enter the assigned public source directly and voice only the supplied evidence before returning the inquiry to the learner.',
  advocate:
    'In one short unquoted host sentence beginning “My case is”, state the strongest licensed claim and its concrete limit. Do not append a semicolon-shaped test. Let the selected action supply a separate final handoff.',
  skeptic:
    'In the unquoted host voice, challenge one unsafe leap or weak link and give the learner a fair public route to answer it.',
  foreperson:
    'In the unquoted host voice, gather the public supports, state the licensed finding, and close the record without opening another branch.',
});

const COMPACT_PART_CUES = Object.freeze({
  scene_partner: 'make room beside one named public object and return its reading to the learner',
  examiner: 'inspect, compare, test, weigh, or point to one named public exhibit',
  record_keeper: 'open, read, mark, enter, or close a public record, separating its entry from what remains unproved',
  authored_source: 'enter the public source directly and voice only the supplied evidence',
  advocate: 'begin “My case is”, state the strongest licensed claim and its limit, and leave the test for HANDOFF',
  skeptic: 'challenge one unsafe leap and show one fair public route through it',
  foreperson: 'gather the public supports, state the licensed finding, and close the record',
});

const TACTIC_EXECUTION_CUES = Object.freeze({
  unadorned_report:
    'Use one direct first-person action or spoken line in ordinary words; do not add a theatrical preface.',
  evidentiary_boundary:
    'In that action, state the exact support and its limit with concrete boundary words such as “only,” “not yet,” or “does not establish.”',
  rapid_handoff:
    'Move straight from the named public object or line to the learner, ending with the shortest useful concrete question.',
  shared_scene_invitation:
    'Make room beside a named public object for the learner and invite their reading in the same sentence or the next.',
  measured_testimony:
    'Let the public words stand in the character’s voice and explicitly refuse to force a stronger judgment.',
  dramatic_counterpressure:
    'Make the already-public shortcut or ready judgment identifiable, put contrary public evidence against it through the selected part, and hand the resulting concrete test back to the learner. Perform the collision; do not announce it or rely on a stock verb template.',
  exposed_mismatch:
    'Let the named public object expose the mismatch through the action itself rather than explaining the irony.',
  dry_counterexample: 'Use the named public object as a dry counterexample, then leave one concrete repair path.',
  adversarial_pressure:
    'Put direct pressure on the claim rather than the learner and name the public test that could answer it.',
});

const STANCE_EXECUTION_CUES = Object.freeze({
  charismatic:
    'Make the final handoff a named challenge to one public claim or object. Use a decisive public action compatible with the selected part. When the part already requires a visible action, intensify that same action rather than replacing it with a stance-only verb such as stop or refuse. Do not rely on boundary words such as only or not to carry the stance. If a requested pressure tactic was downgraded, sharpen the delivered boundary without inventing contrary evidence.',
});

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function definitionContract(definitions, key, fallback = '') {
  return oneLine(definitions?.[key]?.contract || fallback);
}

function learnerMoveSurface({ learnerText = '', responseCompositionFrame = null } = {}) {
  return oneLine(responseCompositionFrame?.learner_move?.summary || learnerText);
}

function releaseCue(entry, index = 0) {
  const rendered =
    entry?.schema === TUTOR_STUB_DUE_SOURCE_RENDER_SCHEMA
      ? entry
      : renderTutorStubDueSource(entry, index);
  const surface = oneLine(rendered.surface);
  if (!surface) return null;
  if (rendered.mode === 'enacted_role') {
    return `Copy exactly, marks included: ${rendered.text} Keep SOURCE words inside; inherit no deed or ownership.`;
  }
  return `After PART, open, read, show, test, or place this public exhibit exactly once: ${surface}`;
}

function endingCue({ questionSupport = null, dramaticReleaseFrame = null, dialogueClosureFrame = null } = {}) {
  if (dialogueClosureFrame?.phase === 'final_checkin_response') {
    return 'Answer the final check-in from the public exchange, explicitly close the inquiry, and ask no question.';
  }
  if (dialogueClosureFrame?.mandatory) {
    return dialogueClosureFrame.allowCheckIn
      ? 'Explicitly close the inquiry. At most one optional check-in may follow, and it must not reopen the proof.'
      : 'Explicitly close the inquiry and ask no question.';
  }
  if (dialogueClosureFrame?.available) {
    return 'Continue only if the learner has not settled the public question. If this reply states or confirms the final verdict, explicitly close the inquiry instead of asking another proof question.';
  }
  if (questionSupport?.responsiveRepairRequired) {
    return 'The learner says an earlier question went unanswered. Answer it directly; do not replace that answer with another exercise.';
  }
  if (questionSupport?.tutorInstruction) return oneLine(questionSupport.tutorInstruction);
  if (dramaticReleaseFrame?.active) {
    return 'End with one light question naming the clue and asking what it changes, supports, or rules out.';
  }
  return 'End with at most one light question grounded in a named public person, object, record, or action.';
}

function compatibilityDecisions({
  responseConfiguration = null,
  responseCompositionFrame = null,
  dramaticReleaseFrame = null,
  questionSupport = null,
  dialogueClosureFrame = null,
} = {}) {
  const decisions = [];
  if (dialogueClosureFrame?.mandatory) {
    decisions.push('closure_overrides_generic_continuation');
    if (questionSupport?.tutorInstruction) decisions.push('closure_suppresses_question_support_prompt');
  } else if (questionSupport?.responsiveRepairRequired) {
    decisions.push('direct_answer_precedes_selected_development');
  }
  if (dramaticReleaseFrame?.active) decisions.push('due_public_evidence_replaces_generic_development');
  if (dramaticReleaseFrame?.requiresEnactment) decisions.push('authored_source_is_nested_inside_host_part');
  if (
    responseCompositionFrame?.scene_action_budget?.saturated &&
    dramaticReleaseFrame?.requiresExhibitHandoff !== true
  ) {
    decisions.push('recent_prop_saturation_prefers_spoken_character_work');
  }
  if (
    dialogueClosureFrame?.mandatory &&
    responseConfiguration?.action_family &&
    responseConfiguration.action_family !== 'close_inquiry'
  ) {
    decisions.push('closure_instruction_overrides_nonclosing_action_wording');
  }
  if (
    dialogueClosureFrame?.mandatory &&
    responseConfiguration?.actorial_performance?.id === 'shared_scene_invitation'
  ) {
    decisions.push('closure_recasts_invitation_as_joint_finding');
  }
  if (
    responseConfiguration?.actorial_part === 'advocate' &&
    responseConfiguration?.action_family === 'stage_next_step'
  ) {
    decisions.push('advocate_case_delegates_concrete_test_to_final_handoff');
  }
  return decisions;
}

function enactmentInstruction({ partExecution, tactic, tacticExecution, closureRequired = false } = {}) {
  if (closureRequired && tactic === 'shared_scene_invitation') {
    return `${partExecution} Credit the learner inside the joint finding with “together,” then close the record; do not invite another reading or ask a question.`;
  }
  return `${partExecution} ${tacticExecution || TACTIC_EXECUTION_CUES.unadorned_report}`;
}

function questionOwnedTacticExecution({ tactic, tacticExecution, progression } = {}) {
  const handoff = progression?.handoff_contract || {};
  const delegated = handoff.question_allowed === false || handoff.question_owner === 'handoff';
  if (!delegated) return tacticExecution;
  const boundary = handoff.question_allowed
    ? 'Ask no question here; HANDOFF owns it.'
    : 'Ask no question here.';
  if (tactic === 'rapid_handoff') {
    return `Move straight from the named public object or line to one short declarative observation. ${boundary}`;
  }
  if (tactic === 'shared_scene_invitation') {
    return `Invite shared attention to the named public object declaratively using “you”, “we”, or “together”. ${boundary}`;
  }
  return `${tacticExecution || TACTIC_EXECUTION_CUES.unadorned_report} ${boundary}`;
}

function compactUptakeInstruction(contract) {
  const learnerMove = contract.learner_move ? `Carry forward this move: ${contract.learner_move}` : '';
  const accelerated = contract.development?.learner_acceleration_instruction
    ? 'Credit every warranted move; do not ask for it again.'
    : '';
  let instruction =
    'Answer, credit, qualify, correct, or receive the learner’s concrete move; never use generic praise.';
  if (contract.opening?.writable_entry_requested) {
    instruction = contract.opening?.complementary_to_due_evidence
      ? 'Begin exactly “Write:” with one learner-sayable pre-turn limit; do not preview or paraphrase SOURCE.'
      : 'Begin exactly “Write:” with one learner-sayable sentence licensed by the public record.';
  } else if (contract.opening?.responsive_repair_required) {
    instruction = 'Answer the learner’s unanswered question directly before doing anything else.';
  }
  return [instruction, accelerated, learnerMove].filter(Boolean).join(' ');
}

function compactPartInstruction(contract) {
  const prop = /introduce no new prop/iu.test(contract.performance?.prop_instruction || '')
    ? 'Use an already-named object; add no prop.'
    : 'Name one public scene object.';
  const part = contract.performance?.actorial_part;
  const action =
    part === 'scene_partner'
      ? 'place both speakers at one named public object using “you”, “we”, or “together”; a solitary “I” beside the object does not count; do not ask a question yet'
      : COMPACT_PART_CUES[part] || 'perform one concrete public action or judgment';
  const sourceAction = tutorStubDueSourceActionInstruction(contract.evidence?.sources || []);
  return [
    `As ${contract.performance?.actorial_part_label || 'the selected part'}, without naming the role, ${action}.`,
    prop,
    sourceAction,
  ]
    .filter(Boolean)
    .join(' ');
}

function compactSupportInstruction(level) {
  if (level === 3) return 'Make the public connection explicit.';
  if (level === 2) return 'Give one concrete hint, leaving the judgment open.';
  if (level === 1) return 'Give only a light directional cue.';
  return '';
}

function compactSourceAccessibilityInstruction(contract = null) {
  // Use the canonical renderer as the readiness boundary; the V1 host plan
  // then carries the same contract in a shorter surface so the source itself
  // does not push the speaking prompt beyond its fixed budget.
  if (!tutorStubSourceAccessibilityInstruction(contract)) return '';
  const row = contract.compensation;
  return [
    `Immediately after SOURCE, write one unquoted statement of at most ${row.max_words} words.`,
    `Reuse at least ${row.min_material_source_tokens} material SOURCE words in order and one source-specific anchor.`,
    'Add only a, an, or the; preserve no, not, only, and may; do not copy all SOURCE or ask.',
  ].join(' ');
}

function compactTacticInstruction(contract) {
  const support = compactSupportInstruction(contract.development?.support_level);
  const transition =
    contract.performance?.obligation_contract?.tactic_applicability?.applicable === false
      ? 'Use the delivered boundary tactic, not the requested pressure tactic.'
      : '';
  const tactic = contract.performance?.tactic_execution;
  const sourceBoundary = contract.evidence?.active ? 'After SOURCE closes, make TACTIC a new unquoted sentence.' : '';
  return [sourceBoundary, tactic, support, transition].filter(Boolean).join(' ');
}

function compactStanceInstruction(stance) {
  const cues = {
    brisk: 'Keep it short and forward-moving.',
    charismatic: 'Make it a decisive named challenge.',
    precise: 'Make it distinguish one concrete claim.',
    warm: 'Keep it low-pressure and preserve choice.',
  };
  return cues[stance] || `Make it visibly ${oneLine(stance) || 'precise'}.`;
}

function compactProgressionHandoffInstruction(contract) {
  const progression = contract.progression;
  const handoff = progression?.handoff_contract;
  const focus = progression?.turn_focus_contract;
  const settled = handoff?.prohibited_settled_surfaces?.length
    ? 'Do not reopen the settled point.'
    : '';
  const bridge = focus?.sibling_relation_requires_explicit_bridge
    ? 'Connect SOURCE to the learner’s requested relation.'
    : '';
  let action;
  if (handoff?.question_allowed === false) {
    action = contract.ending?.closure_required || contract.opening?.responsive_repair_required
      ? compactActionInstruction(contract)
      : 'State the current public limit through the selected action; ask no question.';
  } else if (handoff?.question_required === false) {
    action =
      'Carry the selected action to TURN FOCUS. HANDOFF may ask one final question there; otherwise end declaratively.';
  } else if (contract.evidence?.active && contract.development?.action_family === 'stage_next_step') {
    action = 'Ask one HANDOFF question about what SOURCE changes, supports, or rules out.';
  } else {
    action = `${compactActionInstruction(contract)} HANDOFF owns the one final question.`;
  }
  return [action, compactStanceInstruction(contract.performance?.engagement_stance), settled, bridge]
    .filter(Boolean)
    .join(' ');
}

function compactActionInstruction(contract) {
  if (contract.ending?.closure_required) {
    return 'State the licensed public finding and close the inquiry; ask no question.';
  }
  if (contract.opening?.responsive_repair_required) {
    return 'End after the direct answer or one public way to check it; do not substitute another exercise.';
  }
  if (contract.evidence?.active && contract.development?.action_family === 'stage_next_step') {
    return 'Return SOURCE as one concrete question about what it changes, supports, or rules out.';
  }
  const cues = {
    clarify_term: 'Return one concrete use of the clarified term; do not turn it into a proof test.',
    clarify_distinction: 'Ask one concrete test of the distinction just stated.',
    stage_next_step: 'Name the next available public check; never ask for unseen evidence.',
    answer_accountably: 'Name one public way the answer could be checked or corrected.',
    compress_sayback: 'End with the short learner-sayable formulation; do not reopen a settled step.',
    reanchor_lived_stake: 'Return from the scene consequence to the live public evidence.',
    reanchor_public_evidence: 'End on the clue’s current limit, without testing memory.',
    ground_in_material: 'Return the named public object for one concrete judgment.',
    challenge_resistance: 'Offer one small public move that restores choice.',
    receive_vulnerability: 'Reduce pressure and leave the next judgment with the learner.',
    close_inquiry: 'State the licensed public finding and close the inquiry; ask no question.',
    baseline_plain_response: 'End with one compact next move grounded in the public record.',
  };
  return cues[contract.development?.action_family] || cues.clarify_distinction;
}

function buildHostPlan(contract) {
  const semanticTacticInstruction = tutorStubPerformanceObligationContractPrompt(
    contract.performance?.obligation_contract,
  );
  const sourceSlot = contract.evidence?.active
    ? {
        id: 'source',
        kind: 'source',
        required: true,
        exact: true,
        cues: [...(contract.evidence?.cues || [])],
        sources: structuredClone(contract.evidence?.sources || []),
      }
    : null;
  const slots = [
    {
      id: 'uptake',
      kind: 'host',
      required: true,
      sentence_count: 1,
      instruction: compactUptakeInstruction(contract),
    },
    {
      id: 'part',
      kind: 'host',
      required: true,
      sentence_count: 1,
      instruction: compactPartInstruction(contract),
    },
    sourceSlot,
    {
      id: 'tactic',
      kind: 'host',
      required: true,
      sentence_count: 1,
      instruction: compactTacticInstruction(contract),
      semantic_instruction: semanticTacticInstruction,
    },
    {
      id: 'handoff',
      kind: 'host',
      required: true,
      sentence_count: 1,
      closure: contract.ending?.closure_required === true,
      instruction: [
        compactProgressionHandoffInstruction(contract),
        contract.ending?.clarification_invitation_required
          ? 'Also permit a direct question about one clue, connection, or term.'
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    },
  ].filter(Boolean);
  return {
    schema: TUTOR_STUB_HOST_PLAN_SCHEMA,
    ordered_slot_ids: slots.map((slot) => slot.id),
    host_sentence_count: 4,
    slots,
    axis_ownership: {
      audience_register: [...HOST_SLOT_IDS],
      lexical_accessibility: [...HOST_SLOT_IDS],
      scene_immersion: ['part'],
      actorial_part: ['part'],
      actorial_performance: ['tactic'],
      public_evidence: sourceSlot ? ['source'] : [],
      action_family: ['handoff'],
      engagement_stance: ['handoff'],
    },
  };
}

function hostPlanIssues(contract) {
  const plan = contract?.host_plan;
  const issues = [];
  if (plan?.schema !== TUTOR_STUB_HOST_PLAN_SCHEMA) issues.push('invalid_host_plan_schema');
  const expected = contract?.evidence?.active
    ? ['uptake', 'part', 'source', 'tactic', 'handoff']
    : ['uptake', 'part', 'tactic', 'handoff'];
  if (JSON.stringify(plan?.ordered_slot_ids) !== JSON.stringify(expected)) issues.push('invalid_slot_order');
  const slots = Array.isArray(plan?.slots) ? plan.slots : [];
  const slotsById = new Map(slots.map((slot) => [slot?.id, slot]));
  if (slots.filter((slot) => slot?.kind === 'host').length !== 4 || plan?.host_sentence_count !== 4) {
    issues.push('invalid_host_sentence_count');
  }
  for (const slotId of HOST_SLOT_IDS) {
    const slot = slotsById.get(slotId);
    if (!slot || slot.required !== true || slot.kind !== 'host' || !oneLine(slot.instruction)) {
      issues.push(`missing_required_slot:${slotId}`);
    }
  }
  const deliveredAxes = {
    audience_register: contract?.language?.audience_register,
    lexical_accessibility: contract?.language?.lexical_accessibility,
    scene_immersion: contract?.language?.scene_immersion,
    actorial_part: contract?.performance?.actorial_part,
    actorial_performance: contract?.performance?.tactic,
    action_family: contract?.development?.action_family,
    engagement_stance: contract?.performance?.engagement_stance,
  };
  for (const [axis, value] of Object.entries(deliveredAxes)) {
    const owners = plan?.axis_ownership?.[axis];
    if (!oneLine(value) || !Array.isArray(owners) || !owners.length || owners.some((id) => !slotsById.has(id))) {
      issues.push(`unowned_delivered_axis:${axis}`);
    }
  }
  const source = slotsById.get('source');
  if (contract?.evidence?.active && (!source || source.exact !== true || !source.cues?.length)) {
    issues.push('missing_active_source');
  }
  if (!contract?.evidence?.active && source) issues.push('unexpected_source');
  if (contract?.ending?.closure_required && slotsById.get('handoff')?.closure !== true) {
    issues.push('closure_handoff_mismatch');
  }
  const obligation = contract?.performance?.obligation_contract;
  if (
    obligation &&
    (obligation.schema !== TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA || obligation.complete !== true)
  ) {
    issues.push('invalid_performance_obligation_contract');
  }
  if (
    contract?.progression?.schema !== TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA ||
    contract.progression.complete !== true
  ) {
    issues.push('invalid_turn_progression_contract');
  }
  return issues;
}

function assertValidHostPlan(contract) {
  const issues = hostPlanIssues(contract);
  if (issues.length) throw new Error(`Tutor first-draft host plan invalid: ${issues.join(', ')}`);
}

/**
 * Compile the several private planner surfaces into one ordered, public-safe
 * performance contract for the original speaking attempt. Detailed planner
 * state remains in traces and recovery; the speaker gets only the action it
 * must perform and the evidence currently available to perform it with.
 */
export function buildTutorStubFirstDraftContract({
  learnerText = '',
  responseConfiguration = null,
  responseCompositionFrame = null,
  dramaticReleaseFrame = null,
  committedPublicEvidence = [],
  questionSupport = null,
  dialogueClosureFrame = null,
  performanceObligationContract = null,
  sourceAccessibilityPolicy = 'direct_only',
  sourceAccessibilityOwner = 'performance_response',
} = {}) {
  const configuration = responseConfiguration || {};
  const stance = configuration.engagement_stance || 'precise';
  const actionFamily = configuration.action_family || 'clarify_distinction';
  const part = configuration.actorial_part || 'scene_partner';
  const audience = configuration.audience_register || 'domain_apprentice';
  const lexical = configuration.lexical_accessibility || 'standard';
  const scene = configuration.scene_immersion || 'grounded';
  const learnerMove = learnerMoveSurface({ learnerText, responseCompositionFrame });
  const writableEntryRequested = tutorStubLearnerRequestsWritableEntry(learnerText);
  const learnerAdvance = responseCompositionFrame?.learner_dag?.learner_advance || null;
  const acceleratedLearnerInstruction = learnerAdvance?.accelerated
    ? `Credit all ${Number(learnerAdvance.supported_move_count || 0)} warranted moves the learner just made; do not ask for any of them again. Test or extend only the next unresolved edge.`
    : null;
  const renderedSources = (dramaticReleaseFrame?.entries || []).map(renderTutorStubDueSource);
  const releaseCues = renderedSources.map(releaseCue).filter(Boolean);
  const writableEntryBeforeDueEvidence = writableEntryRequested && releaseCues.length > 0;
  const saturated = responseCompositionFrame?.scene_action_budget?.saturated === true;
  const requiresExhibit = dramaticReleaseFrame?.requiresExhibitHandoff === true;
  const tactic = configuration.actorial_performance?.id || 'unadorned_report';
  const sentenceBudget = Math.max(8, Number(configuration.surface_budgets?.max_average_sentence_words || 24));
  const sourceAccessibility = compileTutorStubSourceAccessibilityContract({
    sources: renderedSources,
    configuration: {
      ...configuration,
      source_accessibility_owner: sourceAccessibilityOwner,
    },
    policy: sourceAccessibilityPolicy,
  });
  const directionOnlyWithoutNewEvidence =
    questionSupport?.answerability === 'direction_only_until_evidence_is_public' && releaseCues.length === 0;
  const compiledCompatibilityDecisions = compatibilityDecisions({
    responseConfiguration: configuration,
    responseCompositionFrame,
    dramaticReleaseFrame,
    questionSupport,
    dialogueClosureFrame,
  }).concat(
    directionOnlyWithoutNewEvidence && tactic === 'rapid_handoff'
      ? ['direction_only_recasts_rapid_handoff_as_declarative_boundary']
      : [],
  );
  const compositePartOwnership = compileTutorStubCompositePartOwnership({
    actorialPart: part,
    actorialPartLabel: configuration.actorial_part_label,
    actionFamily,
  });
  const partExecution =
    PART_CUES[part] ||
    'In the unquoted host voice, make the selected part concrete through one public action or judgment.';
  const tacticExecution =
    directionOnlyWithoutNewEvidence && tactic === 'rapid_handoff'
      ? 'Move straight from one already-public object or line to the present evidentiary limit. State the direction of the missing support yourself and end declaratively; do not ask the learner to name unseen evidence.'
      : TACTIC_EXECUTION_CUES[tactic] || TACTIC_EXECUTION_CUES.unadorned_report;
  const stanceExecution = STANCE_EXECUTION_CUES[stance] || null;
  const baseActionInstruction =
    directionOnlyWithoutNewEvidence && actionFamily === 'stage_next_step'
      ? 'No new evidence is available in this reply. Restage one already-public clue and state what it supports. Then name the next public check with a concrete verb such as test, check, compare, or trace. Do not ask the learner to invent unseen evidence.'
      : ACTION_CUES[actionFamily] || ACTION_CUES.clarify_distinction;
  const actionInstruction =
    part === 'advocate' && actionFamily === 'stage_next_step'
      ? `${baseActionInstruction} Put that concrete operation in the final handoff after the separate “My case is” sentence. Do not turn the handoff into a request for the learner to name unspecified evidence.`
      : baseActionInstruction;
  const progression = compileTutorStubTurnProgressionContract({
    learnerText,
    responseCompositionFrame,
    dramaticReleaseFrame,
    dialogueClosureFrame,
    questionSupport,
    actionFamily,
    tactic,
  });
  const ownedTacticExecution = questionOwnedTacticExecution({
    tactic,
    tacticExecution,
    progression,
  });
  if (ownedTacticExecution !== tacticExecution) {
    compiledCompatibilityDecisions.push('question_ownership_recasts_tactic_as_declarative');
  }

  const contract = {
    schema: TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA,
    learner_move: learnerMove,
    opening: {
      instruction: writableEntryBeforeDueEvidence
        ? 'The learner asked what to write while new evidence is due in this reply. Begin exactly with “Write:” and supply one complete learner-sayable sentence about the pre-turn public status or evidentiary limit. It must complement the new evidence: do not state, paraphrase, preview, or summarize any PUBLIC EVIDENCE DUE NOW. Only then enact each due clue once in the development beat.'
        : writableEntryRequested
          ? 'The learner asked what to write. Begin exactly with “Write:” and supply one complete learner-sayable sentence licensed by the current public evidence. This direct entry is the learner uptake; only then perform the selected development beat. Do not substitute a prop action or another question for the requested sentence.'
          : 'Respond to the learner’s actual contribution in the first sentence by answering, crediting, qualifying, correcting, or receiving it. Paraphrase its concrete claim or concern rather than echoing the learner’s substantive wording; do not begin with generic praise.',
      responsive_repair_required: questionSupport?.responsiveRepairRequired === true,
      writable_entry_requested: writableEntryRequested,
      complementary_to_due_evidence: writableEntryBeforeDueEvidence,
    },
    development: {
      action_family: actionFamily,
      instruction: [acceleratedLearnerInstruction, actionInstruction].filter(Boolean).join(' '),
      learner_acceleration_instruction: acceleratedLearnerInstruction,
      support_level: Number.isFinite(Number(configuration.support_level)) ? Number(configuration.support_level) : null,
      support_instruction:
        Number(configuration.support_level) === 3
          ? 'Supply strong concrete support now: make the relevant public evidence or connection explicit before asking for the learner’s next judgment.'
          : Number(configuration.support_level) === 2
            ? 'Supply one concrete hint or partially worked connection, then leave the final judgment to the learner.'
            : Number(configuration.support_level) === 1
              ? 'Give only a light directional cue and preserve the learner’s independent work.'
              : null,
    },
    performance: {
      engagement_stance: stance,
      stance_instruction: oneLine(getEngagementStanceDefinition(stance)?.stance_contract),
      stance_execution: stanceExecution,
      actorial_part: part,
      actorial_part_label: configuration.actorial_part_label || part.replace(/_/gu, ' '),
      part_instruction: definitionContract(
        getActorialPartDefinitions(),
        part,
        'Act directly inside the public scene and return the next observation to the learner.',
      ),
      part_execution: partExecution,
      tactic,
      tactic_label: configuration.actorial_performance?.label || null,
      tactic_instruction: oneLine(configuration.actorial_performance?.contract),
      tactic_execution: ownedTacticExecution,
      enactment_instruction: enactmentInstruction({
        part,
        partExecution,
        tactic,
        tacticExecution: ownedTacticExecution,
        closureRequired: dialogueClosureFrame?.mandatory === true,
      }),
      prop_instruction:
        saturated && !requiresExhibit
          ? 'Use already-named public evidence and introduce no new prop. Still perform the host-and-tactic beat once through direct judgment, address, rhythm, or a small action on that existing evidence.'
          : 'Enter through concrete first-person action or direct speech; never announce or label the part.',
      obligation_contract: performanceObligationContract ? structuredClone(performanceObligationContract) : null,
    },
    evidence: {
      active: releaseCues.length > 0,
      cues: releaseCues,
      sources: structuredClone(renderedSources),
      committed_public_surfaces: [
        ...new Set(
          (Array.isArray(committedPublicEvidence) ? committedPublicEvidence : [])
            .map((entry) => oneLine(typeof entry === 'string' ? entry : entry?.surface))
            .filter(Boolean),
        ),
      ],
      exact_public_only: true,
      source_accessibility: sourceAccessibility,
    },
    ending: {
      instruction: endingCue({ questionSupport, dramaticReleaseFrame, dialogueClosureFrame }),
      clarification_invitation_required: questionSupport?.clarificationInvitationRequired === true,
      closure_required: dialogueClosureFrame?.mandatory === true,
    },
    language: {
      audience_register: audience,
      audience_instruction: definitionContract(getAudienceRegisterDefinitions(), audience),
      lexical_accessibility: lexical,
      lexical_instruction: definitionContract(getLexicalAccessibilityDefinitions(), lexical),
      scene_immersion: scene,
      scene_instruction: definitionContract(getSceneImmersionDefinitions(), scene),
      max_average_sentence_words: sentenceBudget,
      host_sentence_word_target: sentenceBudget,
    },
    compatibility: {
      decisions: compiledCompatibilityDecisions,
      composite_axis_ownership: compositePartOwnership,
    },
    progression,
  };
  contract.host_plan = buildHostPlan(contract);
  assertValidHostPlan(contract);
  return contract;
}

export function tutorStubFirstDraftContractPrompt(contract = null) {
  if (!contract) return '';
  assertValidHostPlan(contract);
  const plan = contract.host_plan;
  const slotsById = new Map(plan.slots.map((slot) => [slot.id, slot]));
  const source = slotsById.get('source');
  const sourceAccessibility = contract.evidence?.source_accessibility || null;
  const liveCompensation =
    sourceAccessibility?.effective_mode === 'compensated' &&
    sourceAccessibility?.owner === 'post_source_sentence';
  const writableUptake = contract.opening?.writable_entry_requested === true;
  const plainNovice =
    ['adult_novice', 'child'].includes(contract.language?.audience_register) &&
    ['plain', 'glossed_plain'].includes(contract.language?.lexical_accessibility);
  if (liveCompensation) {
    return [
      '[Tutor-only host plan]',
      `Four unlabeled host sentences, at most ${contract.language.host_sentence_word_target || contract.language.max_average_sentence_words} words each: UPTAKE > PART > SOURCE > TACTIC > HANDOFF. Keep SOURCE exact and separate.`,
      `VOICE — ${contract.language.audience_register.replace(/_/gu, ' ')}, ${contract.language.lexical_accessibility.replace(/_/gu, ' ')} words, ${contract.language.scene_immersion.replace(/_/gu, ' ')} public objects; one relation each.`,
      `UPTAKE — ${slotsById.get('uptake').instruction}`,
      `PART — ${slotsById.get('part').instruction}`,
      `SOURCE — ${source.cues.join(' ')}`,
      `TACTIC — ${compactSourceAccessibilityInstruction(sourceAccessibility)}`,
      `HANDOFF — ${slotsById.get('handoff').instruction}`,
      'One voice; add no fact; never announce roles, plans, or hidden evidence.',
      '[End tutor-only host plan]',
    ].join('\n');
  }
  return [
    '[Tutor-only host plan]',
    `Write one paragraph: four unlabeled${writableUptake ? ' host sentences (only Write: UPTAKE may quote)' : ', unquoted host sentences'}, each at most ${contract.language.host_sentence_word_target || contract.language.max_average_sentence_words} words. Follow UPTAKE > PART > ${source ? 'SOURCE > ' : ''}TACTIC > HANDOFF. SOURCE is a separate quotation. Never merge slots.`,
    `GLOBAL — Intelligent ${contract.language.audience_register.replace(/_/gu, ' ')}; ${contract.language.lexical_accessibility.replace(/_/gu, ' ')} common words; one relation per host sentence.${plainNovice ? ' Gloss their specialist term in UPTAKE.' : ''} Keep ${contract.language.scene_immersion.replace(/_/gu, ' ')} scene contact with public objects. Add no fact.`,
    `UPTAKE — ${slotsById.get('uptake').instruction}`,
    `PART — ${slotsById.get('part').instruction}`,
    source ? `SOURCE — ${source.cues.join(' ')}` : null,
    `TACTIC — ${slotsById.get('tactic').instruction}`,
    slotsById.get('tactic').semantic_instruction || null,
    `HANDOFF — ${slotsById.get('handoff').instruction}`,
    'Use one voice. Never announce roles, strategy, analysis, proof machinery, or hidden/future evidence. State SOURCE once.',
    '[End tutor-only host plan]',
  ]
    .filter(Boolean)
    .join('\n');
}
