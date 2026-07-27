import { getEngagementStanceDefinition } from './engagementRegisterRegistry.js';
import {
  selectTutorStubActorialPerformance,
  tutorStubResponseConfigurationPrompt,
} from './tutorStubResponseConfiguration.js';
import { normalizeTutorStubResponseConfiguration } from './tutorStubRegisterPragmatics.js';

function expectedMoveLabel(selection) {
  const effectivePolicy = selection.activated_policy || selection.primary_policy || selection.policy;
  if (effectivePolicy === 'state') return 'Expected learner-state move';
  if (effectivePolicy === 'trajectory') return 'Expected learner-trajectory move';
  if (
    effectivePolicy === 'dynamical_system' ||
    effectivePolicy === 'empirical_dynamical_system' ||
    effectivePolicy === 'continuous_dynamical_system' ||
    effectivePolicy === 'continuous_empirical_dynamical_system'
  ) {
    return 'Expected learner-dynamical move';
  }
  return 'Expected learner-field move';
}

function continuousRegisterVector(selection) {
  if (selection.continuous_register_policy?.dominant_blend) {
    return selection.continuous_register_policy.dominant_blend;
  }
  if (!selection.register_vector) return '';
  return Object.entries(selection.register_vector)
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
    .map(([register, weight]) => `${register} ${Math.round(Number(weight || 0) * 100)}%`)
    .join(', ');
}

function responsePolicyGuardrails(selection, definition) {
  return [
    ...(Array.isArray(definition.forbidden_phrases) && definition.forbidden_phrases.length
      ? [`Forbidden phrase families: ${definition.forbidden_phrases.join(', ')}`]
      : []),
    definition.recognition_guardrail ? `Recognition guardrail: ${definition.recognition_guardrail}` : null,
    selection.simulated_only
      ? 'This is a simulated-only register; do not use it unless the operator explicitly enabled it.'
      : null,
  ].filter(Boolean);
}

function normalizedResponseConfiguration(selection, engagementStance, world) {
  return normalizeTutorStubResponseConfiguration(
    selection.response_configuration || {
      engagement_stance: engagementStance,
      action_family: selection.action_family,
      addressee_profile: selection.addressee_profile || selection.audience_register,
      audience_register: selection.audience_register,
      lexical_accessibility: selection.lexical_accessibility,
      scene_immersion: selection.scene_immersion,
      actorial_part: selection.actorial_part,
      actorial_part_label: selection.actorial_part_label,
      actorial_part_selection: selection.actorial_part_selection,
      actorial_performance:
        selection.actorial_performance ||
        selectTutorStubActorialPerformance({
          engagementStance,
          actorialPart: selection.actorial_part,
        }),
      unresolved_terms: selection.unresolved_terms || [],
    },
    { world },
  );
}

function typedPedagogicalActionContext(selection) {
  const typedAction = selection.typed_action_decision?.chosen_action || null;
  if (!typedAction) return null;
  return [
    '[Tutor-only typed pedagogical action]',
    `Action type: ${typedAction.action_type}`,
    `Move family: ${typedAction.move_family}`,
    `Support level: ${typedAction.support_level} of 3`,
    `Task: ${typedAction.task_id}`,
    `Knowledge component: ${typedAction.knowledge_component}`,
    `Prerequisite path: ${typedAction.prerequisite_path.join(' -> ') || 'none specified'}`,
    `Item difficulty: ${typedAction.item_difficulty}`,
    `Expected learner evidence: ${typedAction.expected_evidence.success.join(', ') || 'none specified'}`,
    `Forbidden learner evidence: ${typedAction.expected_evidence.failure.join(', ') || 'none specified'}`,
    `Responsibility owner: ${typedAction.responsibility_owner}`,
    'The move family, support level, engagement stance, and task are independent controls. Realize each exactly as selected; do not infer one from another.',
    '[End tutor-only typed pedagogical action]',
  ].join('\n');
}

export function projectTutorStubResponsePolicyContext(
  selection,
  {
    multipleChoice = false,
    humanDiscourseFrame = null,
    dialogueClosureFrame = null,
    world = null,
    ledgerTerm = 'evidence record',
  } = {},
) {
  if (!selection) return '';
  const generousInference = humanDiscourseFrame?.generousInference || null;
  const engagementStance = selection.engagement_stance || selection.selected_register;
  const definition = getEngagementStanceDefinition(engagementStance) || {};
  const vectorSummary = continuousRegisterVector(selection);
  const continuousStyleInstruction = String(selection.continuous_register_policy?.style_instruction || '').trim();
  const guardrails = responsePolicyGuardrails(selection, definition);
  const responseConfiguration = normalizedResponseConfiguration(selection, engagementStance, world);
  const resolvedLedgerTerm = String(ledgerTerm || 'evidence record');
  return [
    tutorStubResponseConfigurationPrompt(responseConfiguration),
    typedPedagogicalActionContext(selection),
    '[Tutor-only response-policy evidence]',
    `Selected engagement stance: ${engagementStance}`,
    selection.policy_composition ? `Policy stack: ${selection.policy_composition.policy_stack}` : null,
    selection.policy_composition
      ? `Policy decision: ${selection.policy_composition.activated_overlay || 'primary policy retained'}; overlay threshold ${
          selection.policy_composition.overlay_threshold
        }.`
      : null,
    selection.legacy_selected_register ? `Legacy register alias: ${selection.legacy_selected_register}` : null,
    `Valence: ${selection.valence || 'unknown'}`,
    `Logical request type: ${selection.request_type || selection.learner_signal || 'unknown'}`,
    `Action family: ${selection.action_family || 'none'}`,
    `Reviewer signal: ${selection.reviewer_signal || 'unknown'}`,
    `Reason: ${selection.register_reason || 'No reason supplied.'}`,
    Number.isFinite(Number(selection.temperature))
      ? `Adaptive-performance temperature: ${selection.temperature} (applies to the engagement-stance and actorial-part distributions; lower means sharper and higher means broader).`
      : null,
    vectorSummary ? `Continuous register vector: ${vectorSummary}` : null,
    continuousStyleInstruction || null,
    `Expected learner-DAG move: ${selection.expected_dag_move || 'No expected move supplied.'}`,
    `${expectedMoveLabel(selection)}: ${selection.expected_field_move || 'No expected state/field move supplied.'}`,
    guardrails.length ? 'Guardrails:' : null,
    ...guardrails,
    'Write the next tutor message so the engagement stance, independent action family, actorial part, audience register, lexical accessibility, and scene immersion are all visible without naming the configuration, classifier, or learner-DAG machinery.',
    multipleChoice
      ? `Keep the turn compact. In story mode, if you use multiple choice, offer 2-4 short public evidence options and invite the learner to choose or write their own ${resolvedLedgerTerm} line.`
      : "Keep the turn compact. In story mode, give one live issue and one light prompt for the learner's next thought; do not require a full warranted claim unless the learner is making an unsafe or case-closing leap.",
    generousInference?.applied
      ? `Human-scaffold override: the learner has already answered the immediately preceding local question by unambiguous context. This overrides any expected DAG/state/field move that would ask for a restatement, name, premise, warrant, or ${resolvedLedgerTerm} version of the same answer. Acknowledge it and advance to a genuinely new pressure.`
      : null,
    dialogueClosureFrame?.mandatory
      ? 'Dialogue-closure override: the proof is complete for this dialogue. Closure now overrides every expected DAG/state/field move. Do not solicit another proof step.'
      : dialogueClosureFrame?.available
        ? 'Dialogue-closure override: the authored public proof is complete. If this response states the final verdict, it must close the inquiry rather than reopening another proof step.'
        : null,
    '[End tutor-only response-policy evidence]',
  ]
    .filter(Boolean)
    .join('\n');
}
