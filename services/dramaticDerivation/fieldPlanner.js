import {
  auditConductTutorView,
  conductMoveSpec,
  CONDUCT_MOVE_FAMILIES,
  CONDUCT_POLICY_SCHEMA,
  selectConductMove,
} from './conductPolicy.js';
import { auditDidacticModePublicInput, deriveDidacticOpportunityBudget, DIDACTIC_MODE_SCHEMA } from './didacticMode.js';

export const FIELD_PLANNER_SCHEMA = 'machinespirits.derivation.field-planner.v1';
export const FIELD_PLANNER_PROJECTION_SCHEMA = 'machinespirits.derivation.field-planner.projection.v1';

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

const BASE_MOVE_PRIORS = Object.freeze({
  repair_dependency: 0.05,
  ask_diagnostic: 0.12,
  ask_scope_test: 0.08,
  consolidate_subproof: 0.28,
  release_next_evidence: 0.1,
  block_assertion: 0,
  invite_final_assertion: 0.02,
  repair_recognition_rupture: 0.05,
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

function compactDelta(delta = {}) {
  return Object.fromEntries(
    Object.entries(delta)
      .filter(([, value]) => Number(value) !== 0)
      .map(([key, value]) => [key, round3(value)]),
  );
}

function roundBreakdown(parts = {}) {
  return Object.fromEntries(Object.entries(parts).map(([key, value]) => [key, round3(value)]));
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
  const attractors =
    final.learner?.attractorCounts || finalLearnerSnapshot(learnerField)?.summary?.attractorCounts || {};
  return {
    learner: compactDimensions(learner),
    tutor: compactDimensions(tutor),
    discourse: compactDimensions(discourse),
    joint: compactDimensions(joint),
    attractors: { ...attractors },
    jointAttractor: final.joint?.attractor || null,
    scriptStage: final.script?.stage || null,
    scriptPreferredMoves: final.script?.preferredMoves || [],
    scriptAntiPatterns: final.script?.antiPatterns || [],
    scriptExpectedFieldMovement: final.script?.expectedFieldMovement || {},
    learnerMeanSpeed: round3(final.learner?.meanSpeed || finalLearnerSnapshot(learnerField)?.summary?.meanSpeed || 0),
  };
}

function plannerContext({
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
  return {
    learner,
    joint,
    attractors,
    grounding,
    risk,
    momentum,
    tension,
    coupling,
    currentReleaseDue,
    releaseTarget,
    heldGapTarget,
    proofDebtActive: Boolean(proofDebt?.active || conductEntitlement?.proofDebt?.active),
    proofDebtTarget,
    canAssertFinal: Boolean(canAssertFinal),
  };
}

function targetForMove(moveFamily, context) {
  if (moveFamily === 'release_next_evidence') return context.releaseTarget || context.heldGapTarget;
  if (moveFamily === 'repair_dependency') return context.proofDebtTarget || context.heldGapTarget;
  if (moveFamily === 'invite_final_assertion' || moveFamily === 'block_assertion') return null;
  return context.heldGapTarget || context.releaseTarget || null;
}

function projectedMovementForMove(moveFamily, context) {
  const highRisk = context.risk >= 0.58;
  const projection = {
    repair_dependency: {
      learner: { mastery: 0.05, evidenceGrounding: 0.12, uncertainty: -0.04 },
      tutor: { diagnosticConfidence: 0.08, pedagogicalUncertainty: -0.12, strategyMomentum: 0.04 },
      discourse: { explanatoryStructure: 0.08, commitmentStrength: 0.05, openQuestions: -0.04 },
      joint: { pedagogicalAlignment: 0.1, trajectoryRisk: -0.14, scriptProgress: 0.04 },
    },
    ask_diagnostic: {
      learner: { engagement: 0.04, productiveConfusion: 0.04, uncertainty: highRisk ? -0.02 : 0.03 },
      tutor: { activeHypotheses: 0.1, diagnosticConfidence: 0.05, pedagogicalUncertainty: -0.04 },
      discourse: { openQuestions: 0.06, dialogueActDensity: 0.05, explanatoryStructure: 0.03 },
      joint: { couplingStrength: 0.03, trajectoryRisk: highRisk ? -0.07 : -0.02 },
    },
    ask_scope_test: {
      learner: { misconceptionRisk: -0.14, productiveConfusion: 0.05, evidenceGrounding: 0.04 },
      tutor: { diagnosticConfidence: 0.06, pedagogicalUncertainty: -0.08 },
      discourse: { openQuestions: -0.04, explanatoryStructure: 0.06, commitmentStrength: 0.04 },
      joint: { pedagogicalAlignment: 0.08, productiveTension: 0.04, trajectoryRisk: -0.15 },
    },
    consolidate_subproof: {
      learner: { mastery: 0.08, evidenceGrounding: 0.09, uncertainty: -0.04 },
      tutor: { diagnosticConfidence: 0.05, instructionalMomentum: 0.04 },
      discourse: { sharedVocabulary: 0.04, explanatoryStructure: 0.07, commitmentStrength: 0.06 },
      joint: { couplingStrength: 0.04, pedagogicalAlignment: 0.06, trajectoryRisk: -0.08 },
    },
    release_next_evidence: {
      learner: { engagement: 0.04, uncertainty: highRisk ? 0.06 : 0.02 },
      tutor: { instructionalMomentum: 0.1, strategyMomentum: 0.07 },
      discourse: { conceptIntroduction: 0.14, openQuestions: 0.05, interactionRhythm: 0.06 },
      joint: { interactionMomentum: 0.12, scriptProgress: 0.1, trajectoryRisk: highRisk ? 0.05 : -0.03 },
    },
    block_assertion: {
      learner: { misconceptionRisk: -0.08, engagement: -0.03, uncertainty: 0.03 },
      tutor: { diagnosticConfidence: 0.04, rapport: -0.04 },
      discourse: { commitmentStrength: -0.02, openQuestions: 0.03 },
      joint: { pedagogicalAlignment: 0.04, couplingStrength: -0.03, trajectoryRisk: -0.08 },
    },
    invite_final_assertion: {
      learner: { mastery: 0.06, evidenceGrounding: 0.05, uncertainty: -0.08 },
      tutor: { diagnosticConfidence: 0.08, instructionalMomentum: 0.02 },
      discourse: { commitmentStrength: 0.13, openQuestions: -0.08 },
      joint: { scriptProgress: 0.16, trajectoryRisk: context.canAssertFinal ? -0.1 : 0.16 },
    },
    repair_recognition_rupture: {
      learner: { engagement: 0.08, uncertainty: -0.02 },
      tutor: { rapport: 0.14, pedagogicalUncertainty: -0.04 },
      discourse: { emotionalTone: 0.12, interactionRhythm: 0.05 },
      joint: { couplingStrength: 0.13, interactionMomentum: 0.03, trajectoryRisk: -0.05 },
    },
  }[moveFamily];
  return {
    learner: compactDelta(projection?.learner),
    tutor: compactDelta(projection?.tutor),
    discourse: compactDelta(projection?.discourse),
    joint: compactDelta(projection?.joint),
  };
}

function scriptFit(moveFamily, didacticMode, metrics) {
  const preferred = new Set(metrics.scriptPreferredMoves || []);
  const antiPatterns = new Set(metrics.scriptAntiPatterns || []);
  let fit = 0;
  if (preferred.has(moveFamily) || preferred.has(didacticMode)) fit += 0.16;
  if (antiPatterns.has(moveFamily) || antiPatterns.has(didacticMode)) fit -= 0.36;
  return fit;
}

function scoreCandidate(moveFamily, didacticMode, context, metrics, expectedMovement) {
  const misconception = (context.attractors.misconception_attractor || 0) > 0;
  const riskReduction = -Number(expectedMovement.joint?.trajectoryRisk || 0);
  const parts = {
    prior: BASE_MOVE_PRIORS[moveFamily] ?? 0,
    scriptFit: scriptFit(moveFamily, didacticMode, metrics),
    riskReduction: riskReduction > 0 ? Math.min(0.22, riskReduction) : Math.max(-0.18, riskReduction),
    proofFit: 0,
    closureFit: 0,
    releaseFit: 0,
    misconceptionFit: 0,
    momentumFit: 0,
    recognitionFit: 0,
  };

  if (context.proofDebtActive) parts.proofFit = moveFamily === 'repair_dependency' ? 1.2 : -0.55;
  if (context.canAssertFinal) {
    const closureReady = context.grounding >= 0.5 && context.risk < 0.62;
    parts.closureFit = moveFamily === 'invite_final_assertion' ? (closureReady ? 1 : 0.18) : -0.04;
  } else if (moveFamily === 'invite_final_assertion') {
    parts.closureFit = -0.85;
  }

  if (context.currentReleaseDue && context.releaseTarget) {
    parts.releaseFit = moveFamily === 'release_next_evidence' ? 0.82 : -0.03;
  } else if (moveFamily === 'release_next_evidence') {
    parts.releaseFit = context.risk < 0.3 ? -0.08 : -0.28;
  }

  if (misconception) parts.misconceptionFit = moveFamily === 'ask_scope_test' ? 0.95 : -0.08;
  else if (context.risk >= 0.62 && moveFamily === 'ask_diagnostic') parts.misconceptionFit = 0.45;

  if (context.momentum < 0.2 && context.risk >= 0.5) {
    parts.momentumFit = moveFamily === 'ask_diagnostic' ? 0.54 : moveFamily === 'release_next_evidence' ? -0.2 : 0;
  }

  if (context.tension >= 0.42 && context.coupling >= 0.35 && moveFamily === 'consolidate_subproof') {
    parts.momentumFit += 0.32;
  }

  if (context.coupling < 0.25 && moveFamily === 'repair_recognition_rupture') {
    parts.recognitionFit = 0.42;
  }

  if (moveFamily === 'block_assertion') parts.closureFit -= 0.25;

  const score = Object.values(parts).reduce((sum, value) => sum + Number(value || 0), 0);
  return { score: round3(score), scoreBreakdown: roundBreakdown(parts) };
}

function rationaleForCandidate(moveFamily, context, metrics) {
  if (moveFamily === 'repair_dependency') return 'repair a proof-critical dependency before advancing';
  if (moveFamily === 'invite_final_assertion') return 'invite closure only when the public board can support it';
  if (moveFamily === 'release_next_evidence') return 'advance the evidence schedule when risk is stable enough';
  if (moveFamily === 'ask_scope_test') return 'test the boundary of a risky or over-broad route';
  if (moveFamily === 'ask_diagnostic') return 'diagnose the learner route before adding proof load';
  if (moveFamily === 'repair_recognition_rupture') return 'restore coupling before resuming proof pressure';
  if (moveFamily === 'block_assertion') return 'block unsupported closure and return to public support';
  return `hold the ${metrics.scriptStage || 'current'} stage on owned support`;
}

function signalForCandidate(moveFamily, context) {
  if (moveFamily === 'invite_final_assertion') return 'ready_self_work';
  if (moveFamily === 'release_next_evidence') return 'purpose_gap';
  if (moveFamily === 'ask_scope_test') return 'misapplied';
  if (moveFamily === 'repair_dependency' || moveFamily === 'ask_diagnostic') return 'stalled';
  if (moveFamily === 'repair_recognition_rupture') return 'overloaded';
  return context.grounding >= 0.45 ? 'echo_only' : 'stalled';
}

function reasonCodeForCandidate(moveFamily, context) {
  if (moveFamily === 'repair_dependency') return 'field_repair_dependency';
  if (moveFamily === 'invite_final_assertion') return 'field_final_assertion_available';
  if (moveFamily === 'release_next_evidence') return 'field_release_due';
  if (moveFamily === 'ask_scope_test') return 'field_destabilize_misconception';
  if (moveFamily === 'ask_diagnostic') {
    return context.momentum < 0.2 && context.risk >= 0.5
      ? 'field_low_momentum_diagnostic'
      : 'field_route_diagnostic';
  }
  if (moveFamily === 'repair_recognition_rupture') return 'field_repair_recognition_rupture';
  if (moveFamily === 'block_assertion') return 'field_block_unsupported_assertion';
  if (context.tension >= 0.42 && context.coupling >= 0.35) return 'field_productive_tension';
  return 'field_default_consolidate';
}

function candidateProjection({ moveFamily, turn, metrics, context }) {
  const didacticMode = DIDACTIC_BY_MOVE[moveFamily] || 'purpose_bridge';
  const expectedMovement = projectedMovementForMove(moveFamily, context);
  const { score, scoreBreakdown } = scoreCandidate(moveFamily, didacticMode, context, metrics, expectedMovement);
  const spec = conductMoveSpec(moveFamily);
  return {
    moveFamily,
    didacticMode,
    reasonCode: reasonCodeForCandidate(moveFamily, context),
    signal: signalForCandidate(moveFamily, context),
    targetPremise: targetForMove(moveFamily, context),
    rationale: rationaleForCandidate(moveFamily, context, metrics),
    score,
    scoreBreakdown,
    expectedMovement,
    expectedLocalUptake: spec.expectedUptake,
    scriptFit: {
      stage: metrics.scriptStage || null,
      preferred:
        (metrics.scriptPreferredMoves || []).includes(moveFamily) ||
        (metrics.scriptPreferredMoves || []).includes(didacticMode),
      antiPattern:
        (metrics.scriptAntiPatterns || []).includes(moveFamily) ||
        (metrics.scriptAntiPatterns || []).includes(didacticMode),
    },
    evidence: [
      `candidate ${moveFamily}`,
      `score ${round3(score)}`,
      `trajectory risk ${round3(context.risk)}`,
      `script stage ${metrics.scriptStage || 'unknown'}`,
      ...(context.proofDebtActive ? ['proof-debt signal is active'] : []),
      ...(context.currentReleaseDue && context.releaseTarget ? [`scheduled release ${context.releaseTarget} is due`] : []),
    ],
    sourceTriggerId: `t${turn}:field-planner:candidate:${moveFamily}`,
  };
}

export function projectFieldPlannerCandidates({
  turn,
  metrics,
  learnerField,
  nextScheduledRelease,
  canAssertFinal,
  proofDebt,
  conductEntitlement,
} = {}) {
  const context = plannerContext({
    turn,
    metrics,
    learnerField,
    nextScheduledRelease,
    canAssertFinal,
    proofDebt,
    conductEntitlement,
  });
  const candidates = CONDUCT_MOVE_FAMILIES.map((moveFamily) =>
    candidateProjection({ moveFamily, turn, metrics, context }),
  ).sort((a, b) => b.score - a.score || String(a.moveFamily).localeCompare(String(b.moveFamily)));
  const releaseDueCandidate =
    context.currentReleaseDue && context.releaseTarget
      ? candidates.find((candidate) => candidate.moveFamily === 'release_next_evidence')
      : null;
  return {
    schema: FIELD_PLANNER_PROJECTION_SCHEMA,
    turn,
    context: {
      grounding: round3(context.grounding),
      risk: round3(context.risk),
      momentum: round3(context.momentum),
      tension: round3(context.tension),
      coupling: round3(context.coupling),
      proofDebtActive: context.proofDebtActive,
      canAssertFinal: context.canAssertFinal,
      currentReleaseDue: context.currentReleaseDue,
      releaseTarget: context.releaseTarget,
      heldGapTarget: context.heldGapTarget,
      ...(releaseDueCandidate ? { selectionOverride: 'due_release_dominates_field_score' } : {}),
    },
    candidates,
    selected: releaseDueCandidate || candidates[0] || null,
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
  const projection = projectFieldPlannerCandidates({
    turn,
    metrics,
    learnerField,
    nextScheduledRelease,
    canAssertFinal,
    proofDebt,
    conductEntitlement,
  });
  return {
    choice: projection.selected,
    projection,
  };
}

function promptLinesForPlan(plan) {
  const alternatives = (plan.candidateMoves || [])
    .filter((candidate) => candidate.moveFamily !== plan.selectedMoveFamily)
    .slice(0, 2)
    .map((candidate) => `${candidate.moveFamily} ${candidate.score}`)
    .join(', ');
  return [
    `- script stage: ${plan.scriptStage || 'unknown'}; joint attractor: ${plan.jointAttractor || 'unknown'}`,
    `- conduct family: ${plan.selectedMoveFamily}; reason: ${plan.reasonCode}`,
    `- didactic mode: ${plan.didacticMode.recommendedMode}; signal: ${plan.didacticMode.learningSignal}`,
    `- candidate projection: ${(plan.candidateMoves || []).length} move families considered${alternatives ? `; next alternatives ${alternatives}` : ''}`,
    ...(plan.targetPremise
      ? [`- target public object: ${plan.targetPremise}${plan.targetSurface ? ` (${plan.targetSurface})` : ''}`]
      : []),
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
  const { choice, projection } = chooseMove({
    turn,
    metrics,
    learnerField,
    nextScheduledRelease,
    canAssertFinal,
    proofDebt,
    conductEntitlement,
  });
  const mode = choice.didacticMode || DIDACTIC_BY_MOVE[choice.moveFamily] || 'purpose_bridge';
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
    projection: {
      schema: projection.schema,
      context: projection.context,
      selected: {
        moveFamily: choice.moveFamily,
        score: choice.score,
        scoreBreakdown: choice.scoreBreakdown,
        expectedMovement: choice.expectedMovement,
      },
    },
    candidateMoves: projection.candidates.map((candidate) => ({
      moveFamily: candidate.moveFamily,
      didacticMode: candidate.didacticMode,
      reasonCode: candidate.reasonCode,
      targetPremise: candidate.targetPremise || null,
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown,
      expectedMovement: candidate.expectedMovement,
      scriptFit: candidate.scriptFit,
      expectedLocalUptake: candidate.expectedLocalUptake,
    })),
    expectedMovement: choice.expectedMovement,
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
      projectedFieldDeltas: choice.expectedMovement,
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
  const expected = row.expectedMovement || row.projection?.selected?.expectedMovement || null;
  const observedMovement = {
    proofDistance: round3(distanceDelta),
    groundedPremises: groundedDelta,
    adoptedFacts: adoptedCount,
    derivedFacts: derivedCount,
    assertedFinal: asserted,
    forcedByPublicBoard: outcome.forced === true,
  };
  return {
    ...outcome,
    distanceDelta: round3(distanceDelta),
    groundedDelta,
    expectedMovement: expected,
    observedMovement,
    projectionAlignment:
      row.selectedMoveFamily === 'invite_final_assertion' && asserted
        ? 'matched'
        : improved
          ? 'directionally_matched'
          : 'not_observed_yet',
    efficacy:
      row.selectedMoveFamily === 'invite_final_assertion' && asserted
        ? 'closure_realized'
        : improved
          ? 'movement_observed'
          : 'no_immediate_movement',
  };
}
