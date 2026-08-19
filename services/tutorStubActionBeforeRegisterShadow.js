import { createResistantAxisMoveShadow } from './pedagogicalMove/resistantProfileWarrantShadow.js';
import { tutorStubComprehensionFeatures } from './tutorStubComprehensionState.js';
import { resolveTutorStubDiscoursePlane } from './tutorStubDiscoursePlane.js';
import { detectTutorStubEdgeTimingSignal } from './tutorStubEdgeTimingPolicy.js';
import { projectTutorStubActionFamilyToPedagogicalMove } from './tutorStubPedagogicalMoveProjection.js';
import { tutorStubReleasePacingSnapshot } from './tutorStubReleasePacing.js';
import { selectTutorStubActionFamily } from './tutorStubResponseConfiguration.js';

export const TUTOR_STUB_ACTION_BEFORE_REGISTER_SHADOW_SCHEMA =
  'machinespirits.tutor-stub.action-before-register-shadow.v1';

const EDGED_REGISTERS = new Set(['ironic', 'sarcastic']);
const COMPREHENSION_SAFE_REGISTERS = new Set(['plain', 'warm', 'precise']);
const PROTECTED_AFFECT_SAFE_REGISTERS = new Set(['witnessing', 'warm', 'plain']);

function turnNumber(state, tutorLearnerDag) {
  if (tutorLearnerDag?.model?.turn != null) return tutorLearnerDag.model.turn;
  return Array.isArray(state?.turns) ? state.turns.length + 1 : null;
}

function selectedActionFamily(selection) {
  return selection?.response_configuration?.action_family || selection?.action_family || null;
}

function selectedRegister(selection) {
  return (
    selection?.response_configuration?.engagement_stance ||
    selection?.engagement_stance ||
    selection?.selected_register ||
    null
  );
}

function replaceRegisterSelection(state, prior, next) {
  if (!state?.register?.enabled || !next) return next;
  const history = state.register.history || [];
  if (history.at(-1) === prior || history.at(-1)?.turn === next.turn) history[history.length - 1] = next;
  state.register.current = next;
  return next;
}

function explicitNegativeRegisterOptIn(selection) {
  const activated = selection?.activated_policy || selection?.primary_policy || selection?.policy || null;
  const policyComposition = selection?.policy_composition || {};
  const edgeTiming = selection?.edge_timing || {};
  return Boolean(
    ['negative', 'random', 'random_performance', 'explicit_register_directive'].includes(activated) ||
    selection?.primary_policy === 'negative' ||
    selection?.primary_policy === 'random' ||
    policyComposition.activated_overlay === 'edge_timing' ||
    selection?.overlay_policies?.includes?.('edge_timing') ||
    edgeTiming.edge_eligible === true,
  );
}

function publicUptakeVisible({ learnerText = '', classification = null, tutorLearnerDag = null } = {}) {
  const learnerAdvance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
  const classified = [
    classification?.turn?.evidence_use,
    classification?.turn?.epistemic_stance,
    classification?.turn?.summary,
  ]
    .filter(Boolean)
    .join(' ');
  return Boolean(
    learnerAdvance?.supportedMoveCount > 0 ||
    /\b(?:now i see|i see why|that makes sense|the deciding feature|the key (?:feature|point|hinge)|i(?:'ll| will) hold|my (?:claim|sentence|test) is|provisionally|this is less dead)\b/iu.test(
      learnerText,
    ) ||
    /links?_evidence|grounds?_claim|supported_inference|grounded|self_directed|accelerating/iu.test(classified),
  );
}

function assessRegisterCompatibility({ shadow, selection, edgeSignal, uptakeVisible = false }) {
  const register = selectedRegister(selection);
  const moveType = shadow?.shadow_move_candidate?.move_type || null;
  const resistanceKind = shadow?.resistance_axis_shadow?.resistance_kind || null;
  const negativeOptIn = explicitNegativeRegisterOptIn(selection);
  let compatible = Boolean(register && moveType);
  let reason = compatible ? 'positive_register_default' : 'missing_move_or_register';

  if (register === 'face_threat') {
    compatible = false;
    reason = 'face_threat_is_never_move_compatible';
  } else if (edgeSignal?.comprehensionRepair) {
    compatible = COMPREHENSION_SAFE_REGISTERS.has(register);
    reason = compatible ? 'comprehension_repair_safe_register' : 'comprehension_repair_suppresses_register';
  } else if (edgeSignal?.protectedAffect) {
    compatible = PROTECTED_AFFECT_SAFE_REGISTERS.has(register);
    reason = compatible ? 'protected_affect_safe_register' : 'protected_affect_suppresses_register';
  } else if (uptakeVisible || edgeSignal?.phase === 'uptake') {
    compatible = !EDGED_REGISTERS.has(register) && register !== 'face_threat';
    reason = compatible ? 'uptake_closed_edge' : 'uptake_suppresses_edged_register';
  } else if (EDGED_REGISTERS.has(register)) {
    if (!negativeOptIn) {
      compatible = false;
      reason = 'edged_register_requires_explicit_opt_in';
    } else if (resistanceKind === 'bored' && moveType === 'ask_discriminating_question') {
      compatible = register === 'sarcastic';
      reason = compatible ? 'experimental_bored_sarcasm_pair' : 'edged_register_mismatched_to_bored_move';
    } else if (resistanceKind === 'frame_defiant' && moveType === 'test_bounded_distinction') {
      compatible = register === 'ironic';
      reason = compatible ? 'experimental_frame_irony_pair' : 'edged_register_mismatched_to_frame_move';
    } else {
      compatible = false;
      reason = 'edged_register_has_no_licensed_resistance_move';
    }
  }

  return {
    selected_register: register,
    compatible,
    status: compatible ? 'compatible' : 'incompatible',
    reason,
    negative_register: EDGED_REGISTERS.has(register),
    negative_register_opt_in: negativeOptIn,
    protected_conditions: {
      comprehension_repair: edgeSignal?.comprehensionRepair === true,
      protected_affect: edgeSignal?.protectedAffect === true,
    },
    interpretation: 'design_compatibility_only_not_an_outcome_claim',
  };
}

export function beginTutorStubActionBeforeRegisterShadow({
  state,
  classification = null,
  tutorLearnerDag = null,
  learnerText = '',
} = {}) {
  const turn = turnNumber(state, tutorLearnerDag);
  const comprehension = tutorStubComprehensionFeatures(state?.comprehension, { turn });
  const releasePacing = tutorStubReleasePacingSnapshot(state?.releasePacing, state?.world);
  const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText, classification });
  const legacyActionPreview = selectTutorStubActionFamily({
    classification,
    tutorLearnerDag,
    comprehension,
    releasePacing,
    discoursePlane,
    world: state?.world,
  });
  const legacyProjectedMove = projectTutorStubActionFamilyToPedagogicalMove({
    actionFamily: legacyActionPreview.actionFamily,
  });
  const resistanceAxisShadow = createResistantAxisMoveShadow({ learnerText, classification });
  const resistanceMove = resistanceAxisShadow.projected_move;

  return {
    schema: TUTOR_STUB_ACTION_BEFORE_REGISTER_SHADOW_SCHEMA,
    phase: 'pre_register',
    authority: 'legacy_response_configuration',
    runtime_selection_authorized: false,
    consumer_switch_authorized: false,
    changes_public_output: false,
    turn,
    ordering: {
      public_observation: 1,
      warrant: 2,
      typed_pedagogical_move: 3,
      register_selection: 4,
      public_realization: 5,
      register_selection_completed: false,
      public_realization_observed: false,
    },
    public_observation: resistanceAxisShadow.observation,
    resistance_axis_shadow: resistanceAxisShadow,
    warrant: resistanceMove
      ? resistanceAxisShadow.warrant
      : {
          status: 'legacy_selector_preview',
          basis: {
            action_family: legacyActionPreview.actionFamily,
            reason: legacyActionPreview.reason,
          },
        },
    shadow_move_source: resistanceMove ? 'held_out_resistance_axis_warrant' : 'legacy_action_family_projection',
    shadow_move_candidate: resistanceMove || legacyProjectedMove,
    legacy_action_preview: legacyActionPreview,
    legacy_projected_move: legacyProjectedMove,
    finalization: null,
    realization: null,
  };
}

/** Execute the shadow decision before calling the existing register normalizer. */
export function normalizeTutorStubResponseConfigurationWithActionBeforeRegisterShadow(
  normalizeSelection,
  rawSelection,
  context,
) {
  const shadow = beginTutorStubActionBeforeRegisterShadow(context);
  const selection = normalizeSelection(rawSelection, context);
  if (!selection) return selection;
  const next = {
    ...selection,
    action_before_register_shadow: shadow,
  };
  return replaceRegisterSelection(context?.state, selection, next);
}

export function finalizeTutorStubActionBeforeRegisterShadow({
  state,
  selection,
  learnerText = '',
  classification = null,
  tutorLearnerDag = null,
} = {}) {
  const shadow = selection?.action_before_register_shadow;
  if (!shadow) return selection;
  const legacyActionFamily = selectedActionFamily(selection);
  const edgeSignal = detectTutorStubEdgeTimingSignal({ learnerText, classification, tutorLearnerDag });
  const uptakeVisible = publicUptakeVisible({ learnerText, classification, tutorLearnerDag });
  const finalization = {
    legacy_action_family: legacyActionFamily,
    legacy_action_changed_after_pre_register: legacyActionFamily !== shadow.legacy_action_preview?.actionFamily,
    register_compatibility: assessRegisterCompatibility({ shadow, selection, edgeSignal, uptakeVisible }),
  };
  const next = {
    ...selection,
    action_before_register_shadow: {
      ...shadow,
      phase: 'register_selected',
      ordering: {
        ...shadow.ordering,
        register_selection_completed: true,
      },
      finalization,
    },
  };
  return replaceRegisterSelection(state, selection, next);
}

export function completeTutorStubActionBeforeRegisterShadow({
  state,
  selection,
  deliveredConfiguration = null,
  responseConfigurationAudit = null,
} = {}) {
  const shadow = selection?.action_before_register_shadow;
  if (!shadow) return selection;
  const deliveredActionFamily = deliveredConfiguration?.action_family || selectedActionFamily(selection);
  const deliveredRegister = deliveredConfiguration?.engagement_stance || selectedRegister(selection);
  const realizedLegacyAction = responseConfigurationAudit?.axes?.action_family?.visible === true;
  const realizedRegister = responseConfigurationAudit?.axes?.engagement_stance?.visible === true;
  const shadowCandidateMatchesDeliveredLegacy =
    shadow.shadow_move_candidate?.compatibility?.action_family != null &&
    shadow.shadow_move_candidate.compatibility.action_family === deliveredActionFamily;
  const realization = {
    delivered_action_family: deliveredActionFamily,
    delivered_register: deliveredRegister,
    legacy_action_visible: realizedLegacyAction,
    register_visible: realizedRegister,
    legacy_pair_visible: realizedLegacyAction && realizedRegister,
    shadow_candidate_matches_delivered_legacy: shadowCandidateMatchesDeliveredLegacy,
    shadow_candidate_delivery_status: shadowCandidateMatchesDeliveredLegacy
      ? realizedLegacyAction
        ? 'legacy_projection_visible'
        : 'legacy_projection_not_visible'
      : 'shadow_only_not_delivered',
    outcome_claim_authorized: false,
  };
  const next = {
    ...selection,
    action_before_register_shadow: {
      ...shadow,
      phase: 'public_realization_observed',
      ordering: {
        ...shadow.ordering,
        public_realization_observed: true,
      },
      realization,
    },
  };
  return replaceRegisterSelection(state, selection, next);
}
