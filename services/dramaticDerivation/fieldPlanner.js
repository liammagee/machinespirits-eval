import {
  auditConductTutorView,
  conductMoveSpec,
  CONDUCT_POLICY_SCHEMA,
  selectConductMove,
} from './conductPolicy.js';
import {
  auditDidacticModePublicInput,
  deriveDidacticOpportunityBudget,
  DIDACTIC_MODE_SCHEMA,
} from './didacticMode.js';

export const FIELD_PLANNER_SCHEMA = 'machinespirits.derivation.field-planner.v1';

const DIDACTIC_BY_MOVE = Object.freeze({
  repair_dependency: 'slow_recap',
  ask_diagnostic: 'purpose_bridge',
  ask_scope_test: 'contrast_case',
  consolidate_subproof: 'teach_back',
  release_next_evidence: 'purpose_bridge',
  block_assertion: 'contrast_case',
  invite_final_assertion: 'minimal_presence',
  repair_recognition_rupture: 'minimal_presence',
});

function clamp01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.min(1, Math.max(0, Number(value)));
}

function round3(value) {
  return Number((Number(value) || 0).toFixed(3));
}

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function last(values = []) {
  return Array.isArray(values) && values.length ? values[values.length - 1] : null;
}

function premiseSurface(world, premiseId) {
  if (!premiseId) return null;
  return world?.premiseById?.get?.(premiseId)?.surface || null;
}

function compactDimensions(dimensions = {}) {
  return Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, round3(value)]));
}

function finalLearnerSnapshot(learnerField = {}) {
  return last(learnerField.turns) || null;
}

function leastHeldReleasedPremise(learnerField = {}) {
  const snapshot = finalLearnerSnapshot(learnerField);
  const candidates = (snapshot?.nodes || [])
    .filter((node) => node.released && !node.held && node.premiseId)
    .sort((a, b) => {
      const aRelease = Number.isFinite(Number(a.releaseTurn)) ? Number(a.releaseTurn) : Infinity;
      const bRelease = Number.isFinite(Number(b.releaseTurn)) ? Number(b.releaseTurn) : Infinity;
      if (aRelease !== bRelease) return aRelease - bRelease;
      return String(a.premiseId).localeCompare(String(b.premiseId));
    });
  return candidates[0]?.premiseId || null;
}

function conductDecisionForPlan({ moveFamily, reasonCode, rationale, targetPremise, turn, surface }) {
  const spec = conductMoveSpec(moveFamily);
  const tutorView = {
    moveFamily,
    reasonCode,
    ...(targetPremise ? { targetPremise } : {}),
    publicReason: rationale,
    ...(surface && spec.permittedTutorFields.includes('surface') ? { surface } : {}),
  };
  const nonLeakAudit = auditConductTutorView(tutorView);
  return {
    schema: CONDUCT_POLICY_SCHEMA,
    selectedMoveFamily: moveFamily,
    reasonCode,
    rationale,
    targetPremise: targetPremise || null,
    preconditions: spec.preconditions,
    blockedActions: spec.blockedActions,
    permittedTutorFields: spec.permittedTutorFields,
    expectedLocalUptake: spec.expectedUptake,
    tutorView,
    nonLeakAudit,
    sourceTriggerId: `t${turn}:field-planner:${reasonCode}`,
    source: FIELD_PLANNER_SCHEMA,
  };
}

function selectedConductFromTrigger(trigger) {
  try {
    return selectConductMove(trigger);
  } catch {
    return null;
  }
}

function buildDidacticState({ mode, signal, currentObject, evidence }) {
  const opportunityCost = deriveDidacticOpportunityBudget(mode);
  const input = {
    currentObject,
    learningSignal: signal,
    fieldPlanner: true,
    evidence,
  };
  const inputAudit = auditDidacticModePublicInput(input);
  const state = {
    schema: DIDACTIC_MODE_SCHEMA,
    publicOnly: true,
    authority: 'field_planner_advisory',
    mayOverrideProofControl: false,
    currentObject: currentObject || null,
    learningSignal: signal,
    recommendedMode: mode,
    scope: 'turn',
    evidence: (evidence || []).filter(Boolean).slice(0, 4),
    exitCondition: opportunityCost.exitCondition,
    opportunityCost,
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditDidacticModePublicInput(state),
  };
}

function fieldMetrics(interactionField = {}, learnerField = {}) {
  const final = interactionField.final || {};
  const learner = final.learner?.dimensions || finalLearnerSnapshot(learnerField)?.summary?.dimensions || {};
  const joint = final.joint?.dimensions || {};
  const tutor = final.tutor?.dimensions || {};
  const discourse = final.discourse?.dimensions || {};
  const attractors = final.learner?.attractorCounts || finalLearnerSnapshot(learnerField)?.summary?.attractorCounts || {};
  return {
    learner: compactDimensions(learner),
    tutor: compactDimensions(tutor),
    discourse: compactDimensions(discourse),
    joint: compactDimensions(joint),
    attractors: { ...attractors },
    jointAttractor: final.joint?.attractor || null,
    scriptStage: final.script?.stage || null,
    learnerMeanSpeed: round3(final.learner?.meanSpeed || finalLearnerSnapshot(learnerField)?.summary?.meanSpeed || 0),
  };
}

function chooseMove({
  turn,
  metrics,
  learnerField,
  nextScheduledRelease,
  canAssertFinal,
  proofDebt,
  conductEntitlement,
}) {
  const learner = metrics.learner;
  const joint = metrics.joint;
  const attractors = metrics.attractors || {};
  const grounding = average([learner.mastery, learner.evidenceGrounding]);
  const risk = clamp01(joint.trajectoryRisk || 0);
  const momentum = clamp01(joint.interactionMomentum || 0);
  const tension = clamp01(joint.productiveTension || 0);
  const coupling = clamp01(joint.couplingStrength || 0);
  const currentReleaseDue =
    nextScheduledRelease && Number.isFinite(Number(nextScheduledRelease.turn))
      ? Number(nextScheduledRelease.turn) <= Number(turn)
      : false;
  const releaseTarget = nextScheduledRelease?.premise || null;
  const heldGapTarget = leastHeldReleasedPremise(learnerField);
  const proofDebtTarget =
    proofDebt?.debts?.[0]?.premiseId ||
    proofDebt?.debts?.[0]?.target ||
    conductEntitlement?.proofDebt?.targetPremise ||
    null;

  if (proofDebt?.active || conductEntitlement?.proofDebt?.active) {
    return {
      moveFamily: 'repair_dependency',
      reasonCode: 'field_repair_dependency',
      signal: 'stalled',
      targetPremise: proofDebtTarget || heldGapTarget,
      rationale: 'the live field shows a proof-critical dependency needs repair before advancing',
      evidence: ['proof-debt signal is active', `trajectory risk ${round3(risk)}`],
    };
  }

  if (canAssertFinal && grounding >= 0.5 && risk < 0.62) {
    return {
      moveFamily: 'invite_final_assertion',
      reasonCode: 'field_final_assertion_available',
      signal: 'ready_self_work',
      targetPremise: null,
      rationale: 'the public board can support closure and the learner field is sufficiently grounded',
      evidence: [`learner grounding ${round3(grounding)}`, `trajectory risk ${round3(risk)}`],
    };
  }

  if ((attractors.misconception_attractor || 0) > 0 || (risk >= 0.62 && (joint.pedagogicalAlignment || 0) < 0.5)) {
    return {
      moveFamily: (attractors.misconception_attractor || 0) > 0 ? 'ask_scope_test' : 'ask_diagnostic',
      reasonCode: 'field_destabilize_misconception',
      signal: 'misapplied',
      targetPremise: heldGapTarget,
      rationale: 'the learner field is pulled toward a high-risk or unsupported attractor',
      evidence: [
        `misconception attractors ${attractors.misconception_attractor || 0}`,
        `trajectory risk ${round3(risk)}`,
      ],
    };
  }

  if (momentum < 0.2 && risk >= 0.5) {
    return {
      moveFamily: 'ask_diagnostic',
      reasonCode: 'field_low_momentum_diagnostic',
      signal: 'stalled',
      targetPremise: heldGapTarget || releaseTarget,
      rationale: 'field momentum is low while risk remains high, so the tutor should diagnose before advancing',
      evidence: [`interaction momentum ${round3(momentum)}`, `trajectory risk ${round3(risk)}`],
    };
  }

  if (currentReleaseDue && releaseTarget && risk < 0.58) {
    return {
      moveFamily: 'release_next_evidence',
      reasonCode: 'field_release_due',
      signal: 'purpose_gap',
      targetPremise: releaseTarget,
      rationale: 'the next scheduled exhibit is due and the coupled field is stable enough to advance',
      evidence: [`scheduled release ${releaseTarget} is due`, `trajectory risk ${round3(risk)}`],
    };
  }

  if (tension >= 0.42 && coupling >= 0.35) {
    return {
      moveFamily: 'consolidate_subproof',
      reasonCode: 'field_productive_tension',
      signal: 'echo_only',
      targetPremise: heldGapTarget,
      rationale: 'the learner is productively unsettled; consolidate the local subproof before adding load',
      evidence: [`productive tension ${round3(tension)}`, `coupling strength ${round3(coupling)}`],
    };
  }

  return {
    moveFamily: 'consolidate_subproof',
    reasonCode: 'field_default_consolidate',
    signal: grounding >= 0.45 ? 'echo_only' : 'stalled',
    targetPremise: heldGapTarget || releaseTarget,
    rationale: 'no release or final assertion is clearly licensed by the field, so hold attention on current support',
    evidence: [`learner grounding ${round3(grounding)}`, `script stage ${metrics.scriptStage || 'unknown'}`],
  };
}

function promptLinesForPlan(plan) {
  return [
    `- script stage: ${plan.scriptStage || 'unknown'}; joint attractor: ${plan.jointAttractor || 'unknown'}`,
    `- conduct family: ${plan.selectedMoveFamily}; reason: ${plan.reasonCode}`,
    `- didactic mode: ${plan.didacticMode.recommendedMode}; signal: ${plan.didacticMode.learningSignal}`,
    ...(plan.targetPremise ? [`- target public object: ${plan.targetPremise}${plan.targetSurface ? ` (${plan.targetSurface})` : ''}`] : []),
    `- rationale: ${plan.rationale}`,
  ];
}

export function selectFieldPlannerMove({
  world,
  turn,
  interactionField,
  learnerField,
  nextScheduledRelease = null,
  canAssertFinal = false,
  proofDebt = null,
  conductEntitlement = null,
} = {}) {
  const metrics = fieldMetrics(interactionField, learnerField);
  const choice = chooseMove({
    turn,
    metrics,
    learnerField,
    nextScheduledRelease,
    canAssertFinal,
    proofDebt,
    conductEntitlement,
  });
  const mode = DIDACTIC_BY_MOVE[choice.moveFamily] || 'purpose_bridge';
  const targetSurface = premiseSurface(world, choice.targetPremise);
  const didacticMode = buildDidacticState({
    mode,
    signal: choice.signal,
    currentObject: targetSurface || choice.targetPremise || 'the current public proof object',
    evidence: choice.evidence,
  });
  const triggerCompatible = ['release_next_evidence', 'invite_final_assertion', 'repair_dependency'].includes(
    choice.moveFamily,
  );
  const conductDecision =
    (triggerCompatible
      ? selectedConductFromTrigger({
          id: `t${turn}:field-planner:${choice.reasonCode}`,
          turn,
          triggerType:
            choice.moveFamily === 'release_next_evidence'
              ? 'a21_release_after_diagnostic_budget'
              : choice.moveFamily === 'invite_final_assertion'
                ? 'final_assertion_available_but_delayed'
                : 'dependency_repair_needed',
          canAssertFinal: choice.moveFamily === 'invite_final_assertion' ? true : false,
          targetPremise: choice.targetPremise,
          releaseCandidate: choice.moveFamily === 'release_next_evidence' ? choice.targetPremise : null,
          needsDependencyRepair: choice.moveFamily === 'repair_dependency',
          evidence: {
            releaseCandidate: choice.moveFamily === 'release_next_evidence' ? choice.targetPremise : null,
          },
        })
      : null) ||
    conductDecisionForPlan({
      moveFamily: choice.moveFamily,
      reasonCode: choice.reasonCode,
      rationale: choice.rationale,
      targetPremise: choice.targetPremise,
      turn,
      surface: targetSurface,
    });
  const plan = {
    schema: FIELD_PLANNER_SCHEMA,
    active: true,
    turn,
    authority: 'pre_tutor_runtime_policy',
    source: 'coupled_pedagogical_interaction_field',
    selectedMoveFamily: choice.moveFamily,
    reasonCode: choice.reasonCode,
    rationale: choice.rationale,
    targetPremise: choice.targetPremise || null,
    targetSurface,
    scriptStage: metrics.scriptStage,
    jointAttractor: metrics.jointAttractor,
    metrics,
    didacticMode,
    conductDecision: {
      ...conductDecision,
      source: FIELD_PLANNER_SCHEMA,
    },
    efficacyProbe: {
      expectedMovement:
        choice.moveFamily === 'release_next_evidence'
          ? 'learner adopts or grounds the released exhibit'
          : choice.moveFamily === 'invite_final_assertion'
            ? 'learner asserts from public support'
            : 'learner field reduces risk, restores grounding, or clarifies the current object',
      compareAfter: 'post_learner_turn',
    },
  };
  return {
    ...plan,
    promptLines: promptLinesForPlan(plan),
  };
}

export function summarizeFieldPlannerOutcome(row = {}, outcome = {}) {
  const distanceDelta = Number(outcome.distanceBefore ?? 0) - Number(outcome.distanceAfter ?? 0);
  const groundedDelta = Number(outcome.groundedAfter ?? 0) - Number(outcome.groundedBefore ?? 0);
  const adoptedCount = Number(outcome.adoptedCount || 0);
  const derivedCount = Number(outcome.derivedCount || 0);
  const asserted = outcome.asserted === true;
  const improved = distanceDelta > 0 || groundedDelta > 0 || adoptedCount > 0 || derivedCount > 0 || asserted;
  return {
    ...outcome,
    distanceDelta: round3(distanceDelta),
    groundedDelta,
    efficacy:
      row.selectedMoveFamily === 'invite_final_assertion' && asserted
        ? 'closure_realized'
        : improved
          ? 'movement_observed'
          : 'no_immediate_movement',
  };
}
