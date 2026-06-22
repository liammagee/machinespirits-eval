import { validateDurableLearnerState } from './learnerState.js';

export const A21_TRANSITION_OUTCOME_SCHEMA = 'dramatic-derivation.a21.transition-outcome.v0';

const TUTOR_TEXT_FORBIDDEN = Object.freeze([
  /\bD\s*[=:]\s*\d+/iu,
  /\bD arithmetic\b/iu,
  /\braw proof path\b/iu,
  /\bhidden board(?: state)?\b/iu,
  /\braw board\b/iu,
  /\bcorruption ledger\b/iu,
  /\bsecret solution\b/iu,
  /\bproofPath\b/u,
  /\brawBoard\b/u,
  /\bhiddenBoard\b/u,
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function targetDependency(fixture, action, releaseInfo = {}) {
  if (fixture?.releaseContext?.targetPremise) return fixture.releaseContext.targetPremise;
  const released = new Set([...asArray(action?.releaseDirectives?.releaseNow), ...asArray(releaseInfo?.releaseNow)]);
  if (released.has('p_point')) return 'p_point';
  const held = new Set([...asArray(action?.releaseDirectives?.hold), ...asArray(releaseInfo?.hold)]);
  if (held.has('p_point')) return 'p_point';
  return action?.targetPremise || action?.targetDependency || null;
}

function currentSafeTurns(fixture, target) {
  const observed = fixture?.releaseContext?.hiddenObserved || fixture?.releaseContext?.failedObserved || {};
  if (observed.targetPremise && observed.targetPremise !== target) return [];
  return asArray(observed.safeTurns).map(Number).filter(Number.isFinite);
}

function currentReleaseScheduled(fixture, target, turn) {
  if (!target || !Number.isFinite(Number(turn))) return false;
  const hiddenObserved = fixture?.releaseContext?.hiddenObserved || {};
  const failedObserved = fixture?.releaseContext?.failedObserved || {};
  const scheduled = [hiddenObserved, failedObserved].some(
    (row) => row?.targetPremise === target && Number(row?.scheduledTurn) === Number(turn),
  );
  return scheduled || currentSafeTurns(fixture, target).includes(Number(turn));
}

function releaseFlags({ fixture, action, releaseInfo, target, turn }) {
  const released = new Set([...asArray(action?.releaseDirectives?.releaseNow), ...asArray(releaseInfo?.releaseNow)]);
  const held = new Set([...asArray(action?.releaseDirectives?.hold), ...asArray(releaseInfo?.hold)]);
  const targetReleased = target ? released.has(target) : released.size > 0;
  const targetHeld = target ? held.has(target) : false;
  const scheduledNow = currentReleaseScheduled(fixture, target, turn);
  const releaseOnSchedule = targetReleased && scheduledNow;
  const earlyRelease = targetReleased && !scheduledNow;
  const delayedRelease = targetHeld && scheduledNow && !targetReleased;
  const releaseDeviations = [];
  if (earlyRelease) releaseDeviations.push(`early:${target}`);
  if (delayedRelease) releaseDeviations.push(`delayed:${target}`);
  return { releaseOnSchedule, earlyRelease, delayedRelease, releaseDeviations, targetReleased, targetHeld };
}

function nonLeakPassed(tutorText) {
  const text = String(tutorText || '');
  return !TUTOR_TEXT_FORBIDDEN.some((pattern) => pattern.test(text));
}

function generatorCompliant({ before, action, releaseInfo, target, tutorText }) {
  const released = new Set([...asArray(action?.releaseDirectives?.releaseNow), ...asArray(releaseInfo?.releaseNow)]);
  const held = new Set([...asArray(action?.releaseDirectives?.hold), ...asArray(releaseInfo?.hold)]);
  switch (action?.moveFamily) {
    case 'ask_diagnostic':
      return released.size === 0;
    case 'release_next_evidence':
      return Boolean(target && released.has(target) && !held.has(target));
    case 'repair_dependency':
      return Boolean(
        target &&
          held.has(target) &&
          released.size === 0 &&
          (before?.evidenceSeen?.[target] === true || /restage|public point|own words/iu.test(String(tutorText || ''))),
      );
    case 'consolidate_subproof':
      return released.size === 0;
    case 'invite_final_assertion':
    case 'block_assertion':
      return true;
    default:
      return false;
  }
}

function diagnosticRepeatDelta(before, after) {
  return Math.max(
    0,
    Number(after?.diagnosticHistory?.repeatedWithoutNewEvidence || 0) -
      Number(before?.diagnosticHistory?.repeatedWithoutNewEvidence || 0),
  );
}

function classifyFailure(observed) {
  if (!observed.nonLeakPassed) return 'leak';
  if (!observed.generatorCompliant) return 'generator_compliance_failure';
  if (observed.engagementAfter === 'disengaged') return 'disengagement';
  if (observed.engagementAfter === 'aporia') return 'aporia';
  if (observed.delayedRelease && observed.DDelta >= 0) return 'release_starvation';
  if (observed.diagnosticRepeatedWithoutNewEvidenceDelta > 0 && observed.DDelta >= 0) return 'over_scaffolding';
  if (
    observed.DDelta === 0 &&
    !observed.targetDependencyOwnedAfter &&
    !observed.targetReleased &&
    !observed.learnerUsesReleasedEvidence
  ) {
    return 'learner_state_noop';
  }
  return 'none';
}

function normalizeArgs(args) {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && args[0].learnerStateBefore) {
    return args[0];
  }
  const [learnerStateBefore, action, tutorText, learnerText, learnerStateAfter, options = {}] = args;
  return {
    learnerStateBefore,
    action,
    tutorText,
    learnerText,
    learnerStateAfter,
    ...options,
  };
}

export function auditTransition(...args) {
  const input = normalizeArgs(args);
  const before = validateDurableLearnerState(clone(input.learnerStateBefore));
  const after = validateDurableLearnerState(clone(input.learnerStateAfter));
  const action = clone(input.action);
  const actionExecution = input.actionExecution || {};
  const releaseInfo = input.releaseInfo || actionExecution.releaseInfo || {};
  const tutorText = input.tutorText ?? actionExecution.tutorText ?? '';
  const learnerText = input.learnerText ?? '';
  const target = targetDependency(input.fixture, action, releaseInfo);
  const turn = Number(releaseInfo.turn ?? input.turn ?? input.fixture?.trigger?.turn ?? null);
  const dBefore = Number(before.proofProgress.D);
  const dAfter = Number(after.proofProgress.D);
  const release = releaseFlags({ fixture: input.fixture, action, releaseInfo, target, turn });
  const noLeak = nonLeakPassed(tutorText);
  const generatorOk = generatorCompliant({ before, action, releaseInfo, target, tutorText });
  const learnerUsesReleasedEvidence =
    release.targetReleased === true &&
    target === 'p_point' &&
    after.evidenceSeen?.p_point === true &&
    after.transitionFlags?.learnerCanUsePPoint === true;
  const observed = {
    DBefore: dBefore,
    DAfter: dAfter,
    DDelta: dAfter - dBefore,
    targetDependency: target,
    targetDependencyOwnedBefore: target ? before.dependencyOwned?.[target] === true : false,
    targetDependencyOwnedAfter: target ? after.dependencyOwned?.[target] === true : false,
    targetDependencyEchoedOnlyAfter: target ? after.dependencyEchoedOnly?.[target] === true : false,
    engagementAfter: after.engagement,
    releaseDeviations: release.releaseDeviations,
    nonLeakPassed: noLeak,
    generatorCompliant: generatorOk,
    learnerUsesReleasedEvidence,
    releaseOnSchedule: release.releaseOnSchedule,
    delayedRelease: release.delayedRelease,
    earlyRelease: release.earlyRelease,
    targetReleased: release.targetReleased,
    diagnosticRepeatedWithoutNewEvidenceDelta: diagnosticRepeatDelta(before, after),
  };
  return {
    schema: A21_TRANSITION_OUTCOME_SCHEMA,
    trialId: input.trialId || actionExecution.trialId || null,
    fixtureId: input.fixture?.fixtureId || input.fixtureId || null,
    actionId: action.actionId,
    seed: input.seed ?? null,
    learnerStateBefore: before,
    learnerStateAfter: after,
    tutorText,
    learnerText,
    observed,
    failureLabel: classifyFailure(observed),
  };
}
