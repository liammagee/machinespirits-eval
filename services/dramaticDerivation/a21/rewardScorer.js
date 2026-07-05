export const A21_REWARD_BREAKDOWN_SCHEMA = 'dramatic-derivation.a21.reward-breakdown.v0';

export const DEFAULT_A21_REWARD_WEIGHTS = Object.freeze({
  DDecrease: 2,
  targetDependencyOwned: 3,
  learnerUsesReleasedEvidence: 2,
  engagementMaintained: 1,
  noLeak: 2,
  generatorCompliance: 1,
  releaseOnSchedule: 1,
  diagnosticRepetitionPenalty: -2,
  delayedReleasePenalty: -2,
  earlyReleasePenalty: -1,
  aporiaPenalty: -4,
  disengagementPenalty: -6,
  overScaffoldingPenalty: -2,
});

function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function countReleaseDeviations(outcome, prefix) {
  return (outcome?.observed?.releaseDeviations || []).filter((label) => String(label).startsWith(prefix)).length;
}

function sumComponents(components) {
  return Object.values(components).reduce((sum, value) => sum + numeric(value), 0);
}

export function scoreReward(outcome, weights = DEFAULT_A21_REWARD_WEIGHTS) {
  const observed = outcome?.observed || {};
  const dDelta = numeric(observed.DDelta);
  const diagnosticRepeatDelta = numeric(observed.diagnosticRepeatedWithoutNewEvidenceDelta);
  const delayedCount = observed.delayedRelease ? Math.max(1, countReleaseDeviations(outcome, 'delayed:')) : 0;
  const earlyCount = observed.earlyRelease ? Math.max(1, countReleaseDeviations(outcome, 'early:')) : 0;
  const components = {
    DDecrease: dDelta < 0 ? weights.DDecrease * Math.abs(dDelta) : 0,
    targetDependencyOwned:
      observed.targetDependencyOwnedBefore === false && observed.targetDependencyOwnedAfter === true
        ? weights.targetDependencyOwned
        : 0,
    learnerUsesReleasedEvidence: observed.learnerUsesReleasedEvidence ? weights.learnerUsesReleasedEvidence : 0,
    engagementMaintained: ['engaged', 'strained'].includes(observed.engagementAfter) ? weights.engagementMaintained : 0,
    noLeak: observed.nonLeakPassed ? weights.noLeak : 0,
    generatorCompliance: observed.generatorCompliant ? weights.generatorCompliance : 0,
    releaseOnSchedule: observed.releaseOnSchedule ? weights.releaseOnSchedule : 0,
    diagnosticRepetitionPenalty:
      diagnosticRepeatDelta > 0 ? weights.diagnosticRepetitionPenalty * diagnosticRepeatDelta : 0,
    delayedReleasePenalty: delayedCount > 0 ? weights.delayedReleasePenalty * delayedCount : 0,
    earlyReleasePenalty: earlyCount > 0 ? weights.earlyReleasePenalty * earlyCount : 0,
    aporiaPenalty: observed.engagementAfter === 'aporia' ? weights.aporiaPenalty : 0,
    disengagementPenalty: observed.engagementAfter === 'disengaged' ? weights.disengagementPenalty : 0,
    overScaffoldingPenalty: outcome?.failureLabel === 'over_scaffolding' ? weights.overScaffoldingPenalty : 0,
  };
  return {
    schema: A21_REWARD_BREAKDOWN_SCHEMA,
    trialId: outcome?.trialId || null,
    actionId: outcome?.actionId || null,
    total: sumComponents(components),
    components,
    weights: { ...weights },
  };
}
