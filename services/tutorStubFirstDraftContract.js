import {
  getActorialPartDefinitions,
  getAudienceRegisterDefinitions,
  getEngagementStanceDefinition,
  getLexicalAccessibilityDefinitions,
  getSceneImmersionDefinitions,
} from './engagementRegisterRegistry.js';

export const TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA =
  'machinespirits.tutor-stub.first-draft-turn-contract.v1';

const ACTION_CUES = Object.freeze({
  clarify_term:
    'Define the unresolved word in ordinary language with one concrete scene referent. Do not turn the definition into a proof test.',
  clarify_distinction:
    'State one concrete distinction, show what each side would look like in this scene, and test only that distinction.',
  stage_next_step:
    'Put the next available public evidence into the scene before asking the learner to interpret it.',
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
  baseline_plain_response:
    'Give one direct public response and one compact next move without decorative explanation.',
});

const PART_CUES = Object.freeze({
  scene_partner:
    'In the unquoted host voice, make concrete room beside the named public evidence and return the next observation to the learner.',
  examiner:
    'In the unquoted host voice, visibly inspect, compare, test, weigh, or point to a named public exhibit.',
  record_keeper:
    'In the unquoted host voice, open, read, mark, enter, or close a named public record and distinguish what is entered from what remains unproved.',
  authored_source:
    'Enter the assigned public source directly and voice only the supplied evidence before returning the inquiry to the learner.',
  advocate:
    'In the unquoted host voice, make the strongest presently licensed case in first person and give the learner a concrete way to test or break it.',
  skeptic:
    'In the unquoted host voice, challenge one unsafe leap or weak link and give the learner a fair public route to answer it.',
  foreperson:
    'In the unquoted host voice, gather the public supports, state the licensed finding, and close the record without opening another branch.',
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
    'Press the named public object against the room’s easy verdict, show where that verdict breaks, and hand the exact test to the learner.',
  exposed_mismatch:
    'Let the named public object expose the mismatch through the action itself rather than explaining the irony.',
  dry_counterexample:
    'Use the named public object as a dry counterexample, then leave one concrete repair path.',
  adversarial_pressure:
    'Put direct pressure on the claim rather than the learner and name the public test that could answer it.',
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

function sourceReportingLead(entry) {
  const role = oneLine(entry?.role).toLowerCase();
  if (/\b(?:watch|watchman|witness)\b/u.test(role)) return 'I saw or I can attest that';
  if (/\b(?:book|clerk|inventory|keeper|ledger|log|reading|record)\b/u.test(role)) {
    return 'I read in the record that';
  }
  if (/\b(?:identifying|knows?|recognis(?:e|ing)|recogniz(?:e|ing))\b/u.test(role)) return 'I know or I can identify that';
  return 'I can attest that';
}

function releaseCue(entry) {
  const surface = oneLine(entry?.surface);
  if (!surface) return null;
  if (entry.mode === 'enacted_role') {
    return [
      `Source to inhabit silently: ${oneLine(entry.role) || 'the public source'}.`,
      'The source name is casting information, not dialogue or narration: never print it outside the quotation.',
      `After the host responds or acts, start a new sentence whose opening quotation mark is followed immediately by this kind of reporting lead: ${sourceReportingLead(entry)}.`,
      'First person belongs only to the source’s act of seeing, reading, knowing, or attesting. Preserve every named actor, owner, family relation, and possession in the evidence exactly: never turn what Verrell, Edony, a founder, or another named person did or owned into what “I” did or owned.',
      'Transform only the reporting frame into direct source voice; do not write “the clerk reads”, “the officer says”, “the witness opens”, “as the assayer speaks”, or an equivalent role entrance.',
      `Public evidentiary content to voice once: ${surface}`,
    ].join(' ');
  }
  return `Directly open, read, show, test, or place this public exhibit in the shared scene: ${surface}`;
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
  return decisions;
}

function enactmentInstruction({ partExecution, tactic, tacticExecution, closureRequired = false } = {}) {
  if (closureRequired && tactic === 'shared_scene_invitation') {
    return `${partExecution} Credit the learner inside the joint finding with “together,” then close the record; do not invite another reading or ask a question.`;
  }
  return `${partExecution} ${tacticExecution || TACTIC_EXECUTION_CUES.unadorned_report}`;
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
  questionSupport = null,
  dialogueClosureFrame = null,
} = {}) {
  const configuration = responseConfiguration || {};
  const stance = configuration.engagement_stance || 'precise';
  const actionFamily = configuration.action_family || 'clarify_distinction';
  const part = configuration.actorial_part || 'scene_partner';
  const audience = configuration.audience_register || 'domain_apprentice';
  const lexical = configuration.lexical_accessibility || 'standard';
  const scene = configuration.scene_immersion || 'grounded';
  const learnerMove = learnerMoveSurface({ learnerText, responseCompositionFrame });
  const learnerAdvance = responseCompositionFrame?.learner_dag?.learner_advance || null;
  const acceleratedLearnerInstruction = learnerAdvance?.accelerated
    ? `Credit all ${Number(learnerAdvance.supported_move_count || 0)} warranted moves the learner just made; do not ask for any of them again. Test or extend only the next unresolved edge.`
    : null;
  const releaseCues = (dramaticReleaseFrame?.entries || []).map(releaseCue).filter(Boolean);
  const saturated = responseCompositionFrame?.scene_action_budget?.saturated === true;
  const requiresExhibit = dramaticReleaseFrame?.requiresExhibitHandoff === true;
  const tactic = configuration.actorial_performance?.id || null;
  const partExecution =
    PART_CUES[part] ||
    'In the unquoted host voice, make the selected part concrete through one public action or judgment.';
  const tacticExecution = TACTIC_EXECUTION_CUES[tactic] || TACTIC_EXECUTION_CUES.unadorned_report;

  return {
    schema: TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA,
    learner_move: learnerMove,
    opening: {
      instruction:
        'Respond to the learner’s actual contribution in the first sentence by answering, crediting, qualifying, correcting, or receiving it. Paraphrase its concrete claim or concern rather than echoing the learner’s substantive wording; do not begin with generic praise.',
      responsive_repair_required: questionSupport?.responsiveRepairRequired === true,
    },
    development: {
      action_family: actionFamily,
      instruction: [acceleratedLearnerInstruction, ACTION_CUES[actionFamily] || ACTION_CUES.clarify_distinction]
        .filter(Boolean)
        .join(' '),
      learner_acceleration_instruction: acceleratedLearnerInstruction,
      support_level: Number.isFinite(Number(configuration.support_level))
        ? Number(configuration.support_level)
        : null,
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
      tactic_execution: tacticExecution,
      enactment_instruction: enactmentInstruction({
        part,
        partExecution,
        tactic,
        tacticExecution,
        closureRequired: dialogueClosureFrame?.mandatory === true,
      }),
      prop_instruction:
        saturated && !requiresExhibit
          ? 'Use already-named public evidence and introduce no new prop. Still perform the host-and-tactic beat once through direct judgment, address, rhythm, or a small action on that existing evidence.'
          : 'Enter through concrete first-person action or direct speech; never announce or label the part.',
    },
    evidence: {
      active: releaseCues.length > 0,
      cues: releaseCues,
      exact_public_only: true,
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
      max_average_sentence_words: Number(configuration.surface_budgets?.max_average_sentence_words || 24),
    },
    compatibility: {
      decisions: compatibilityDecisions({
        responseConfiguration: configuration,
        responseCompositionFrame,
        dramaticReleaseFrame,
        questionSupport,
        dialogueClosureFrame,
      }),
    },
  };
}

export function tutorStubFirstDraftContractPrompt(contract = null) {
  if (!contract) return '';
  const releaseRows = contract.evidence?.cues || [];
  return [
    '[Tutor-only first-draft performance contract]',
    'Write one compact paragraph in one continuous voice. Perform these instructions in order:',
    contract.learner_move
      ? `OPEN — The first sentence must explicitly carry forward this learner move in concrete words, even if it also contains a scene action: ${contract.learner_move} ${contract.opening.instruction}`
      : `OPEN — ${contract.opening.instruction}`,
    `ACT + ENACT — ${contract.development.instruction} Perform that development as ${contract.performance.actorial_part_label} without printing that label: ${contract.performance.enactment_instruction} The action and character obligation are one beat, not two optional tasks.`,
    contract.development.support_instruction
      ? `SUPPORT — ${contract.development.support_instruction}`
      : null,
    `ENTRY — ${contract.performance.prop_instruction}`,
    releaseRows.length ? 'PUBLIC EVIDENCE DUE NOW — perform every line below once and add no fact beyond it:' : null,
    ...releaseRows.map((row) => `- ${row}`),
    `END — ${contract.ending.instruction}`,
    contract.ending.clarification_invitation_required
      ? 'Because the learner signalled difficulty, explicitly say they may ask which clue, connection, or term needs explaining.'
      : null,
    `VOICE — ${contract.performance.stance_instruction}`,
    `LANGUAGE — ${contract.language.audience_instruction} ${contract.language.lexical_instruction}`,
    `SCENE — ${contract.language.scene_instruction}`,
    `Keep average sentences at or below ${contract.language.max_average_sentence_words} words.`,
    'Do not mention roles, role-play, teaching strategy, configuration, analysis, proof machinery, hidden evidence, or future evidence. Do not split uptake and development into separate voices, headings, paragraphs, or asides.',
    '[End tutor-only first-draft performance contract]',
  ]
    .filter(Boolean)
    .join('\n');
}
