import {
  getActorialPartDefinitions,
  getAudienceRegisterDefinitions,
  getEngagementStanceDefinition,
  getLexicalAccessibilityDefinitions,
  getSceneImmersionDefinitions,
} from './engagementRegisterRegistry.js';
import { tutorStubPerformanceObligationContractPrompt } from './tutorStubPerformanceObligationContract.js';

export const TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA = 'machinespirits.tutor-stub.first-draft-turn-contract.v1';

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
    'In the unquoted host voice, use one compact accountable sentence shaped “My case is [licensed claim]; break it if [concrete public observation].” Replace both brackets with scene facts and do not explain the sentence shape.',
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
    'Make the already-public shortcut or ready judgment identifiable, put contrary public evidence against it through the selected part, and hand the resulting concrete test back to the learner. Perform the collision; do not announce it or rely on a stock verb template.',
  exposed_mismatch:
    'Let the named public object expose the mismatch through the action itself rather than explaining the irony.',
  dry_counterexample: 'Use the named public object as a dry counterexample, then leave one concrete repair path.',
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

function learnerRequestsWritableEntry(value = '') {
  return /\b(?:what|which)\b[^.!?]{0,55}\b(?:should|could|can|do)\s+i\s+(?:enter|record|say|write)\b|\b(?:give|tell|show) me\b[^.!?]{0,55}\b(?:entry|line|sentence|wording|words?)\b|\bhow (?:should|could|can|do) i (?:enter|record|say|write)\b/iu.test(
    oneLine(value),
  );
}

function sourceReportingLead(entry) {
  const role = oneLine(entry?.role).toLowerCase();
  if (/\b(?:watch|watchman|witness)\b/u.test(role)) return 'I saw or I can attest that';
  if (/\b(?:book|clerk|inventory|keeper|ledger|log|reading|record)\b/u.test(role)) {
    return 'I read in the record that';
  }
  if (/\b(?:identifying|knows?|recognis(?:e|ing)|recogniz(?:e|ing))\b/u.test(role))
    return 'I know or I can identify that';
  return 'I can attest that';
}

function releaseCue(entry) {
  const surface = oneLine(entry?.surface);
  if (!surface) return null;
  if (entry.mode === 'enacted_role') {
    return [
      `Source to inhabit silently: ${oneLine(entry.role) || 'the public source'}.`,
      `After one unquoted host action, start a new quotation immediately with a reporting lead like “${sourceReportingLead(entry)}”.`,
      'Never print the source name outside that quotation. First person may report the evidence, but must not inherit any named person’s deed, ownership, or relationship.',
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
  performanceObligationContract = null,
} = {}) {
  const configuration = responseConfiguration || {};
  const stance = configuration.engagement_stance || 'precise';
  const actionFamily = configuration.action_family || 'clarify_distinction';
  const part = configuration.actorial_part || 'scene_partner';
  const audience = configuration.audience_register || 'domain_apprentice';
  const lexical = configuration.lexical_accessibility || 'standard';
  const scene = configuration.scene_immersion || 'grounded';
  const learnerMove = learnerMoveSurface({ learnerText, responseCompositionFrame });
  const writableEntryRequested = learnerRequestsWritableEntry(learnerText);
  const learnerAdvance = responseCompositionFrame?.learner_dag?.learner_advance || null;
  const acceleratedLearnerInstruction = learnerAdvance?.accelerated
    ? `Credit all ${Number(learnerAdvance.supported_move_count || 0)} warranted moves the learner just made; do not ask for any of them again. Test or extend only the next unresolved edge.`
    : null;
  const releaseCues = (dramaticReleaseFrame?.entries || []).map(releaseCue).filter(Boolean);
  const writableEntryBeforeDueEvidence = writableEntryRequested && releaseCues.length > 0;
  const saturated = responseCompositionFrame?.scene_action_budget?.saturated === true;
  const requiresExhibit = dramaticReleaseFrame?.requiresExhibitHandoff === true;
  const tactic = configuration.actorial_performance?.id || null;
  const sentenceBudget = Math.max(8, Number(configuration.surface_budgets?.max_average_sentence_words || 24));
  const directionOnlyWithoutNewEvidence =
    questionSupport?.answerability === 'direction_only_until_evidence_is_public' && releaseCues.length === 0;
  const partExecution =
    PART_CUES[part] ||
    'In the unquoted host voice, make the selected part concrete through one public action or judgment.';
  const tacticExecution =
    directionOnlyWithoutNewEvidence && tactic === 'rapid_handoff'
      ? 'Move straight from one already-public object or line to the present evidentiary limit. State the direction of the missing support yourself and end declaratively; do not ask the learner to name unseen evidence.'
      : TACTIC_EXECUTION_CUES[tactic] || TACTIC_EXECUTION_CUES.unadorned_report;
  const actionInstruction =
    directionOnlyWithoutNewEvidence && actionFamily === 'stage_next_step'
      ? 'No new evidence is available in this reply. Restage one already-public clue and state what it supports. Then name the next public check with a concrete verb such as test, check, compare, or trace. Do not ask the learner to invent unseen evidence.'
      : ACTION_CUES[actionFamily] || ACTION_CUES.clarify_distinction;

  return {
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
      obligation_contract: performanceObligationContract ? structuredClone(performanceObligationContract) : null,
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
      max_average_sentence_words: sentenceBudget,
      host_sentence_word_target: sentenceBudget,
    },
    compatibility: {
      decisions: compatibilityDecisions({
        responseConfiguration: configuration,
        responseCompositionFrame,
        dramaticReleaseFrame,
        questionSupport,
        dialogueClosureFrame,
      }).concat(
        directionOnlyWithoutNewEvidence && tactic === 'rapid_handoff'
          ? ['direction_only_recasts_rapid_handoff_as_declarative_boundary']
          : [],
      ),
    },
  };
}

export function tutorStubFirstDraftContractPrompt(contract = null) {
  if (!contract) return '';
  const releaseRows = contract.evidence?.cues || [];
  const plainNovice =
    ['adult_novice', 'child'].includes(contract.language?.audience_register) &&
    ['plain', 'glossed_plain'].includes(contract.language?.lexical_accessibility);
  const semanticPerformanceInstruction = tutorStubPerformanceObligationContractPrompt(
    contract.performance?.obligation_contract,
  );
  return [
    '[Tutor-only first-draft performance contract]',
    'Write one compact paragraph in one continuous voice. Perform these instructions in order:',
    `FORM — ${contract.language.audience_instruction} ${contract.language.lexical_instruction} Use 3–4 short host sentences whenever OPEN, DEVELOP, and END are active. Sentence 1 carries uptake and any requested “Write:” entry. Sentence 2 performs the scene action and states at most one current-clue meaning. Sentence 3 states one evidentiary limit or one concrete next check. Use sentence 4 only for the learner handoff or clarification permission. Never join these beats with a colon, semicolon, dash, or “but”. Count words before answering and split every host sentence above ${contract.language.host_sentence_word_target || contract.language.max_average_sentence_words} words.${plainNovice ? ' Translate the learner’s named specialist term into common words in the uptake; do not introduce another specialist term without a local gloss.' : ''} An exact supplied clue quotation may retain its wording.`,
    contract.learner_move
      ? `OPEN — The first sentence must explicitly carry forward this learner move in concrete words, even if it also contains a scene action: ${contract.learner_move} ${contract.opening.instruction}`
      : `OPEN — ${contract.opening.instruction}`,
    `DEVELOP — In fresh host sentences after the uptake, ${contract.development.instruction} Perform one mandatory development beat as ${contract.performance.actorial_part_label} without printing that label: ${contract.performance.enactment_instruction} ${contract.performance.prop_instruction} Do not substitute generic prop handling for the selected part or tactic.${semanticPerformanceInstruction ? `\n${semanticPerformanceInstruction}` : ''}`,
    contract.development.support_instruction ? `SUPPORT — ${contract.development.support_instruction}` : null,
    releaseRows.length ? 'PUBLIC EVIDENCE DUE NOW — perform every line below once and add no fact beyond it:' : null,
    releaseRows.length
      ? 'SINGLE DELIVERY — State each due clue exactly once. Do not preview or paraphrase it in the Write entry, opening, or closing summary.'
      : null,
    ...releaseRows.map((row) => `- ${row}`),
    `END — ${contract.ending.instruction}`,
    contract.ending.clarification_invitation_required
      ? 'Because the learner signalled difficulty, explicitly say they may ask which clue, connection, or term needs explaining. Make this a separate direct permission statement; do not hide it inside an option list or another exercise.'
      : null,
    `VOICE — ${contract.performance.stance_instruction}`,
    `SCENE — ${contract.language.scene_instruction}`,
    'Do not mention roles, role-play, teaching strategy, configuration, analysis, proof machinery, hidden evidence, or future evidence. Do not split uptake and development into separate voices, headings, paragraphs, or asides.',
    '[End tutor-only first-draft performance contract]',
  ]
    .filter(Boolean)
    .join('\n');
}
