import {
  cloneDurableLearnerState,
  improveConfidence,
  validateDurableLearnerState,
  worsenEngagement,
} from './learnerState.js';

export const A21_LEARNER_SIMULATOR_SCHEMA = 'dramatic-derivation.a21.learner-simulator.v0';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function releasedPremises(action, releaseInfo = {}) {
  return new Set([
    ...(action?.releaseDirectives?.releaseNow || []).filter(Boolean),
    ...(releaseInfo?.releaseNow || []).filter(Boolean),
  ]);
}

function heldPremises(action, releaseInfo = {}) {
  return new Set([
    ...(action?.releaseDirectives?.hold || []).filter(Boolean),
    ...(releaseInfo?.hold || []).filter(Boolean),
  ]);
}

function targetDependency(action, releaseInfo = {}) {
  const released = [...releasedPremises(action, releaseInfo)];
  if (released.includes('p_point')) return 'p_point';
  const held = [...heldPremises(action, releaseInfo)];
  if (held.includes('p_point')) return 'p_point';
  if (/P_POINT/u.test(action?.actionId || '')) return 'p_point';
  return action?.targetPremise || action?.targetDependency || null;
}

function predecessorDependency(target) {
  if (target === 'p_point') return 'p_surface';
  return null;
}

function containsPermittedPublicRestatement(tutorText, target) {
  if (!target) return false;
  const text = String(tutorText || '').toLowerCase();
  if (target === 'p_point') {
    return /already public point|newly staged public piece|put it in their own words|restage/u.test(text);
  }
  return text.includes(String(target).toLowerCase());
}

function markNoProgress(next) {
  next.proofProgress.lastDDelta = 0;
  next.proofProgress.turnsSinceDDecrease += 1;
}

function decreaseD(next, amount = 1) {
  const before = next.proofProgress.D;
  next.proofProgress.D = Math.max(0, before - amount);
  next.proofProgress.lastDDelta = next.proofProgress.D - before;
  next.proofProgress.turnsSinceDDecrease =
    next.proofProgress.lastDDelta < 0 ? 0 : next.proofProgress.turnsSinceDDecrease + 1;
}

function markReleaseSchedule(next, premise, releaseInfo = {}) {
  if (releaseInfo.releaseDeviation === 'early') {
    next.proofProgress.earlyReleases.push(premise);
  } else if (releaseInfo.releaseDeviation === 'delayed') {
    next.proofProgress.delayedReleases.push(premise);
  } else {
    next.proofProgress.releasesOnSchedule.push(premise);
  }
}

function applyDiagnostic(next, action, releaseInfo) {
  const released = releasedPremises(action, releaseInfo);
  const priorCount = next.diagnosticHistory.count;
  next.diagnosticHistory.count += 1;
  next.diagnosticHistory.lastDiagnosticTurn = releaseInfo.turn ?? null;
  if (released.size === 0 && priorCount > 0) {
    next.diagnosticHistory.repeatedWithoutNewEvidence += 1;
    next.frustration = 'high';
    next.engagement =
      next.diagnosticHistory.repeatedWithoutNewEvidence >= 2 || next.diagnosticHistory.count >= 3
        ? 'aporia'
        : worsenEngagement(next.engagement);
  }
  markNoProgress(next);
}

function applyRelease(next, action, releaseInfo) {
  const released = releasedPremises(action, releaseInfo);
  if (!released.size) {
    markNoProgress(next);
    return;
  }
  for (const premise of released) {
    next.evidenceSeen[premise] = true;
    markReleaseSchedule(next, premise, releaseInfo);
  }
  if (released.has('p_point')) {
    next.transitionFlags.learnerCanUsePPoint = true;
    next.dependencyEchoedOnly.p_point = true;
    decreaseD(next, 1);
  } else {
    markNoProgress(next);
  }
}

function applyRepair(next, action, tutorText, releaseInfo) {
  const target = targetDependency(action, releaseInfo);
  if (!target) {
    markNoProgress(next);
    return;
  }
  const released = releasedPremises(action, releaseInfo);
  const permitted =
    next.evidenceSeen[target] === true || released.has(target) || containsPermittedPublicRestatement(tutorText, target);
  if (!permitted) {
    markNoProgress(next);
    return;
  }
  next.dependencyOwned[target] = true;
  next.dependencyEchoedOnly[target] = false;
  next.transitionFlags.targetDependencyRepaired = true;
  if (target === 'p_point') next.transitionFlags.learnerCanUsePPoint = true;
  if (next.misconception === 'mirror_dead_predicate') next.misconception = 'missing_dependency';
  next.confidence = improveConfidence(next.confidence);
  decreaseD(next, 1);
}

function applyConsolidation(next, action, releaseInfo) {
  const target = targetDependency(action, releaseInfo);
  const predecessor = predecessorDependency(target);
  if (predecessor && next.dependencyOwned[predecessor] === true) {
    next.confidence = improveConfidence(next.confidence);
    if (next.evidenceSeen[target] && next.dependencyEchoedOnly[target]) {
      next.dependencyOwned[target] = true;
      next.dependencyEchoedOnly[target] = false;
      next.transitionFlags.targetDependencyRepaired = true;
      decreaseD(next, 1);
      return;
    }
  }
  markNoProgress(next);
}

function applyFinalAssertion(next) {
  if (next.proofProgress.D === 0 && next.dependencyOwned.p_point === true) {
    next.transitionFlags.learnerReadyForFinalAssertion = true;
    next.confidence = 'high';
  }
  markNoProgress(next);
}

function transitionFlags(before, after) {
  return {
    targetDependencyRepaired:
      before.transitionFlags.targetDependencyRepaired !== true &&
      after.transitionFlags.targetDependencyRepaired === true,
    evidenceGained: Object.keys(after.evidenceSeen).filter(
      (key) => after.evidenceSeen[key] && !before.evidenceSeen[key],
    ),
    dependencyOwned: Object.keys(after.dependencyOwned).filter(
      (key) => after.dependencyOwned[key] && !before.dependencyOwned[key],
    ),
    engagementChanged: before.engagement !== after.engagement,
    dDelta: after.proofProgress.D - before.proofProgress.D,
  };
}

export function applyTutorActionToLearnerState(state, action, tutorText = '', releaseInfo = {}) {
  const before = cloneDurableLearnerState(state);
  const next = cloneDurableLearnerState(state);
  switch (action?.moveFamily) {
    case 'ask_diagnostic':
      applyDiagnostic(next, action, releaseInfo);
      break;
    case 'release_next_evidence':
      applyRelease(next, action, releaseInfo);
      break;
    case 'repair_dependency':
      applyRepair(next, action, tutorText, releaseInfo);
      break;
    case 'consolidate_subproof':
      applyConsolidation(next, action, releaseInfo);
      break;
    case 'invite_final_assertion':
      applyFinalAssertion(next);
      break;
    case 'block_assertion':
      next.engagement = worsenEngagement(next.engagement);
      markNoProgress(next);
      break;
    default:
      throw new Error(`a21.learnerSimulator: unsupported move family ${JSON.stringify(action?.moveFamily)}`);
  }
  const after = validateDurableLearnerState(next);
  return {
    schema: A21_LEARNER_SIMULATOR_SCHEMA,
    learnerStateBefore: before,
    learnerStateAfter: clone(after),
    transition: transitionFlags(before, after),
  };
}
