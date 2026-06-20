import { actionPermittedByWorldSpec, getActionDefinition, normalizeWorldAdaptationSpec } from './actionPolicy.js';

export const PROOF_RELEASE_OWNERSHIP_GATE_VERSION = 'proof-release-ownership-gate.v1.0';

export const VIOLATION_CODES = Object.freeze({
  OWNERSHIP_WITH_TUTOR_SUPPLIED_PROOF: 'OWNERSHIP_WITH_TUTOR_SUPPLIED_PROOF',
  RELEASE_WITHOUT_MEANINGFUL_OPPORTUNITY: 'RELEASE_WITHOUT_MEANINGFUL_OPPORTUNITY',
  RELEASE_WITHOUT_READINESS_OR_DIAGNOSTIC_BOUND: 'RELEASE_WITHOUT_READINESS_OR_DIAGNOSTIC_BOUND',
  PREMATURE_CORRECTNESS_VALIDATION: 'PREMATURE_CORRECTNESS_VALIDATION',
  DECISIVE_STEP_EMBEDDED_IN_QUESTION: 'DECISIVE_STEP_EMBEDDED_IN_QUESTION',
  FAILED_ACTION_REPEATED_WITHOUT_NEW_RATIONALE: 'FAILED_ACTION_REPEATED_WITHOUT_NEW_RATIONALE',
  ACTION_PRECONDITION_UNMET: 'ACTION_PRECONDITION_UNMET',
  ACTION_TARGET_MISMATCH: 'ACTION_TARGET_MISMATCH',
  CONTROL_COST_EXCEEDS_MINIMUM_SUFFICIENT_ACTION: 'CONTROL_COST_EXCEEDS_MINIMUM_SUFFICIENT_ACTION',
  MISSING_OBSERVABLE_SUCCESS_SIGNAL: 'MISSING_OBSERVABLE_SUCCESS_SIGNAL',
  STATE_HYPOTHESIS_UNGROUNDED: 'STATE_HYPOTHESIS_UNGROUNDED',
  HIGH_CONFIDENCE_WITH_HIGH_UNCERTAINTY: 'HIGH_CONFIDENCE_WITH_HIGH_UNCERTAINTY',
  REALIZATION_ACTION_MISMATCH: 'REALIZATION_ACTION_MISMATCH',
  WORLD_ACTION_DISALLOWED: 'WORLD_ACTION_DISALLOWED',
});

const DEFAULT_GATE_CONFIG = Object.freeze({
  utilityTieEpsilon: 0.05,
  readinessThreshold: 0.55,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dominantHypothesis(stateBelief) {
  return stateBelief?.hypotheses?.[0]?.id || 'unknown';
}

function latestFailures(interventionLedger = [], actionType, hypothesisId) {
  return interventionLedger
    .filter((record) => record?.status === 'closed' && record.outcome === 'failure')
    .filter((record) => record.action_type === actionType)
    .filter((record) => (record.hypothesis_ids || []).includes(hypothesisId))
    .slice(-3);
}

function latestNonSuccesses(interventionLedger = [], actionType, hypothesisId) {
  return interventionLedger
    .filter((record) => record?.status === 'closed' && ['failure', 'inconclusive'].includes(record.outcome))
    .filter((record) => record.action_type === actionType)
    .filter((record) => (record.hypothesis_ids || []).includes(hypothesisId))
    .slice(-3);
}

function violation(code, message, details = {}) {
  return { code, message, details };
}

function repair(replaceActionWith, reason) {
  return { replace_action_with: replaceActionWith, reason };
}

function hasObservableSuccessSignal(action) {
  return (action?.success_signal?.required_evidence || []).length > 0;
}

function isOwnershipTargeting(action) {
  return (action?.target_axes || []).includes('ownership') || Number(action?.expected_transition?.ownership || 0) > 0.1;
}

function isReleaseTargeting(action) {
  return (action?.target_axes || []).includes('release') || Number(action?.expected_transition?.release || 0) > 0.1;
}

function isHighControlProofSupply(action) {
  return (
    ['explain_principle', 'model_worked_example'].includes(action?.action_type) ||
    Number(action?.control_cost || 0) >= 0.6
  );
}

function isEscalationAfterFailedHint({ stateBelief, action, interventionLedger = [] }) {
  const dominant = dominantHypothesis(stateBelief);
  const confidence = Number(stateBelief?.hypotheses?.[0]?.probability || 0);
  if (dominant !== 'missing_prerequisite' || confidence < 0.55) return false;
  if (!['explain_principle', 'model_worked_example'].includes(action?.action_type)) return false;
  return latestNonSuccesses(interventionLedger, 'minimal_hint', dominant).length > 0;
}

const ACTIONABLE_UNDER_UNCERTAINTY = new Set([
  'productive_progress',
  'answer_seeking',
  'working_memory_overload',
  'notation_overload',
  'boundary_case',
  'substantive_objection',
  'metaphor_overextension',
  'affective_shutdown',
  'tutor_misread',
  'sophistication_upgrade',
  'false_mastery',
]);

function actionCompatibleWithDominant(action, dominant) {
  if (!action?.action_type || !dominant) return false;
  try {
    const def = getActionDefinition(action.action_type);
    return (def.compatible_hypotheses || []).includes(dominant);
  } catch {
    return false;
  }
}

function actionableUncertaintyCanProceed(stateBelief, action) {
  const dominant = dominantHypothesis(stateBelief);
  return ACTIONABLE_UNDER_UNCERTAINTY.has(dominant) && actionCompatibleWithDominant(action, dominant);
}

function lowerControlNearTie(selectedAction, candidateActions = [], epsilon) {
  const selected = candidateActions.find((c) => c.action_type === selectedAction.action_type);
  if (!selected) return null;
  return candidateActions
    .filter((c) => c.action_type !== selectedAction.action_type)
    .filter((c) => selected.utility - c.utility <= epsilon)
    .filter((c) => c.control_cost + 0.001 < selected.control_cost)
    .sort((a, b) => a.control_cost - b.control_cost || b.information_gain - a.information_gain)[0];
}

function worldPolicyActionList(spec, key) {
  return (spec?.action_policy?.[key] || []).filter((actionType) => {
    try {
      getActionDefinition(actionType);
      return true;
    } catch {
      return false;
    }
  });
}

function worldRepairAction(spec) {
  for (const actionType of [
    ...worldPolicyActionList(spec, 'preferred_action_families'),
    ...worldPolicyActionList(spec, 'allowed_action_families'),
    'diagnose_with_discriminating_question',
    'request_evidence',
  ]) {
    if (actionPermittedByWorldSpec(actionType, spec)) return actionType;
  }
  return 'diagnose_with_discriminating_question';
}

export function validateProofReleaseOwnershipGate({
  stateBelief,
  selectedAction,
  candidateActions = [],
  interventionLedger = [],
  tutorText = '',
  config = {},
} = {}) {
  const merged = { ...DEFAULT_GATE_CONFIG, ...config };
  const worldSpec = normalizeWorldAdaptationSpec(merged);
  const violations = [];
  const repairs = [];
  const action = selectedAction ? clone(selectedAction) : null;
  if (!action) {
    return {
      version: PROOF_RELEASE_OWNERSHIP_GATE_VERSION,
      allowed: false,
      violations: [violation(VIOLATION_CODES.ACTION_PRECONDITION_UNMET, 'No selected action was supplied.')],
      repairs: [repair('diagnose_with_discriminating_question', 'Select a low-control diagnostic action first.')],
    };
  }

  if (worldSpec && !actionPermittedByWorldSpec(action.action_type, worldSpec)) {
    violations.push(
      violation(
        VIOLATION_CODES.WORLD_ACTION_DISALLOWED,
        `${action.action_type} is disallowed by locked world adaptation spec ${worldSpec.id || 'unknown'}.`,
        {
          action_type: action.action_type,
          world_adaptation_spec_id: worldSpec.id || null,
          world_adaptation_spec_hash: worldSpec.spec_hash || null,
        },
      ),
    );
    repairs.push(
      repair(worldRepairAction(worldSpec), 'Use an action family permitted by the locked world adaptation spec.'),
    );
  }

  const axes = stateBelief?.axes || {};
  const dominant = dominantHypothesis(stateBelief);
  const escalationAfterFailedHint = isEscalationAfterFailedHint({ stateBelief, action, interventionLedger });

  for (const h of stateBelief?.hypotheses || []) {
    if (h.probability >= 0.7 && (!Array.isArray(h.evidence) || h.evidence.length === 0)) {
      violations.push(
        violation(VIOLATION_CODES.STATE_HYPOTHESIS_UNGROUNDED, `High-confidence hypothesis ${h.id} lacks evidence.`, {
          hypothesis_id: h.id,
        }),
      );
      repairs.push(
        repair('diagnose_with_discriminating_question', 'Gather evidence before treating the state as known.'),
      );
    }
  }

  if (
    stateBelief?.uncertainty?.needs_discrimination &&
    stateBelief?.hypotheses?.[0]?.probability >= 0.65 &&
    !actionableUncertaintyCanProceed(stateBelief, action)
  ) {
    violations.push(
      violation(
        VIOLATION_CODES.HIGH_CONFIDENCE_WITH_HIGH_UNCERTAINTY,
        'The state is marked uncertain while also over-committing to one hypothesis.',
      ),
    );
    repairs.push(repair('diagnose_with_discriminating_question', 'Resolve uncertainty before escalating support.'));
  }

  if (!hasObservableSuccessSignal(action)) {
    violations.push(
      violation(
        VIOLATION_CODES.MISSING_OBSERVABLE_SUCCESS_SIGNAL,
        `${action.action_type} lacks an observable learner-state success signal.`,
      ),
    );
    repairs.push(
      repair('diagnose_with_discriminating_question', 'Use an action with an observable success criterion.'),
    );
  }

  if (
    !escalationAfterFailedHint &&
    (isOwnershipTargeting(action) || Number(axes.ownership || 0) < 0.45) &&
    isHighControlProofSupply(action)
  ) {
    violations.push(
      violation(
        VIOLATION_CODES.OWNERSHIP_WITH_TUTOR_SUPPLIED_PROOF,
        'The proposed action supplies high-control proof while ownership remains unresolved.',
        { action_type: action.action_type, ownership_axis: axes.ownership ?? null },
      ),
    );
    repairs.push(repair('request_evidence', 'Elicit learner-authored proof before supplying the decisive rationale.'));
  }

  if (isReleaseTargeting(action) && action.action_type !== 'diagnose_with_discriminating_question') {
    const hasOpportunity =
      /choice|strategy|prediction|evidence|next step|next move|task-aligned|task goal|justify|own words/iu.test(
        `${action.description || ''} ${action.rationale || ''} ${tutorText || ''}`,
      );
    const actionCarriesReleaseOpportunity =
      action.action_type === 'withhold_answer' || action.action_type === 'observe_no_intervention';
    if (!hasOpportunity && !actionCarriesReleaseOpportunity) {
      violations.push(
        violation(
          VIOLATION_CODES.RELEASE_WITHOUT_MEANINGFUL_OPPORTUNITY,
          'Release-targeting action does not define a consequential learner opportunity.',
        ),
      );
      repairs.push(repair('ask_strategy_choice', 'Turn release into a bounded strategy choice.'));
    }
    if (Number(axes.proof || 0) < merged.readinessThreshold && action.action_type === 'summarize_and_release') {
      violations.push(
        violation(
          VIOLATION_CODES.RELEASE_WITHOUT_READINESS_OR_DIAGNOSTIC_BOUND,
          'Full release is blocked because proof evidence remains below readiness threshold.',
          { proof_axis: axes.proof ?? null, threshold: merged.readinessThreshold },
        ),
      );
      repairs.push(repair('request_evidence', 'Ask for learner-authored evidence before releasing control.'));
    }
  }

  if (/\b(the answer is|therefore the correct answer|so the solution is)\b/iu.test(tutorText || '')) {
    violations.push(
      violation(
        VIOLATION_CODES.PREMATURE_CORRECTNESS_VALIDATION,
        'Tutor text appears to validate or reveal correctness before learner commitment.',
      ),
    );
    repairs.push(repair('request_evidence', 'Ask for evidence before validation.'));
  }

  if (/\b(isn'?t it because|which means you should|so you can see that)\b/iu.test(tutorText || '')) {
    violations.push(
      violation(
        VIOLATION_CODES.DECISIVE_STEP_EMBEDDED_IN_QUESTION,
        'The question embeds the decisive step rather than asking for learner-authored reasoning.',
      ),
    );
    repairs.push(repair('challenge_without_telling', 'Surface the tension without embedding the repair.'));
  }

  const repeatFailures = latestFailures(interventionLedger, action.action_type, dominant);
  const renewedAffectiveShutdown =
    dominant === 'affective_shutdown' &&
    action.action_type === 'acknowledge_and_redirect' &&
    /\b(can'?t do this|wasting your time|i just\.\.\.|shut(?:ting)? down|overwhelmed)\b/iu.test(
      stateBelief?.learner_project?.current_plan || '',
    );
  if (
    repeatFailures.length > 0 &&
    action.action_type !== 'diagnose_with_discriminating_question' &&
    !renewedAffectiveShutdown
  ) {
    violations.push(
      violation(
        VIOLATION_CODES.FAILED_ACTION_REPEATED_WITHOUT_NEW_RATIONALE,
        `${action.action_type} already failed under dominant hypothesis ${dominant}.`,
        { failures: repeatFailures.map((r) => r.contract_id) },
      ),
    );
    repairs.push(
      repair(
        'diagnose_with_discriminating_question',
        'Change conditions or gather discriminating evidence before repeating.',
      ),
    );
  }

  const nearTie = lowerControlNearTie(action, candidateActions, merged.utilityTieEpsilon);
  if (nearTie && isHighControlProofSupply(action) && !escalationAfterFailedHint) {
    violations.push(
      violation(
        VIOLATION_CODES.CONTROL_COST_EXCEEDS_MINIMUM_SUFFICIENT_ACTION,
        `${action.action_type} has a lower-control near-tied alternative: ${nearTie.action_type}.`,
        { selected_control_cost: action.control_cost, alternative_control_cost: nearTie.control_cost },
      ),
    );
    repairs.push(
      repair(nearTie.action_type, 'Minimum-sufficient-intervention tie-breaker prefers the lower-control action.'),
    );
  }

  // ACTION_TARGET_MISMATCH is deliberately conservative: only fire when no
  // selected target axis has a positive expected transition and the action is
  // not diagnostic. This avoids penalizing diagnostic uncertainty-gathering.
  const positiveTarget = (action.target_axes || []).some((axis) => Number(action.expected_transition?.[axis] || 0) > 0);
  if (!positiveTarget && action.action_type !== 'diagnose_with_discriminating_question') {
    violations.push(
      violation(
        VIOLATION_CODES.ACTION_TARGET_MISMATCH,
        'Action target axes are not supported by expected transition gains.',
      ),
    );
    repairs.push(
      repair(
        'diagnose_with_discriminating_question',
        'Select an action whose target axes match its predicted transition.',
      ),
    );
  }

  // Locked-world-spec invariant guard. Most checks above push a hardcoded repair target
  // (diagnose_with_discriminating_question / request_evidence / ask_strategy_choice, or a
  // near-tie alternative) that is never filtered against the world spec. Because
  // repairActionFromGate takes repairs[0] and the validate node applies it with only one
  // re-validation pass, an unfiltered repair can finalize a world-DISALLOWED action and
  // break the guarantee this gate exists to enforce. Substitute the spec-permitted
  // fallback for any disallowed repair so no repair path can leak a forbidden move.
  if (worldSpec) {
    for (const r of repairs) {
      if (r.replace_action_with && !actionPermittedByWorldSpec(r.replace_action_with, worldSpec)) {
        r.replace_action_with = worldRepairAction(worldSpec);
      }
    }
  }

  return {
    version: PROOF_RELEASE_OWNERSHIP_GATE_VERSION,
    allowed: violations.length === 0,
    violations,
    repairs: repairs.slice(0, 3),
  };
}

export function repairActionFromGate(selectedAction, gateResult) {
  const replacement = gateResult?.repairs?.find((r) => r.replace_action_with)?.replace_action_with;
  if (!replacement) return selectedAction;
  const def = getActionDefinition(replacement);
  return {
    version: '1.0',
    id: `${selectedAction?.id || 'action'}-repaired`,
    action_type: def.action_type,
    target_axes: [...def.target_axes],
    rationale: `Gate repair: ${gateResult.repairs.find((r) => r.replace_action_with === replacement)?.reason || 'replace blocked action'}`,
    preconditions: [],
    expected_transition: { ...def.expected_transition },
    success_signal: JSON.parse(JSON.stringify(def.success_signal)),
    control_cost: def.default_control_cost,
    information_gain: def.default_information_gain,
    forbidden_moves: [...def.forbidden_moves],
    registry_version: selectedAction?.registry_version,
  };
}
