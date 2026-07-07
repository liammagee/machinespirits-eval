export const A21_ACTION_VALUE_ANALYSIS_SCHEMA = 'dramatic-derivation.a21.action-value-analysis.v0';

function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + numeric(value), 0) / values.length : 0;
}

function addComponentTotals(target, components = {}) {
  for (const [key, value] of Object.entries(components)) {
    target[key] = numeric(target[key]) + numeric(value);
  }
}

function groupByAction(trials) {
  const groups = new Map();
  for (const trial of trials) {
    const actionId = trial?.action?.actionId || trial?.actionId || trial?.reward?.actionId;
    if (!actionId) continue;
    if (!groups.has(actionId)) groups.set(actionId, []);
    groups.get(actionId).push(trial);
  }
  return groups;
}

function summarizeAction(actionId, rows) {
  const componentTotals = {};
  const rewards = [];
  const dDeltas = [];
  let targetOwned = 0;
  let learnerUsesReleasedEvidence = 0;
  let releaseOnSchedule = 0;
  let delayedRelease = 0;
  let earlyRelease = 0;
  let generatorCompliant = 0;
  let nonLeakPassed = 0;
  let aporia = 0;
  let disengagement = 0;
  const failureLabels = {};
  for (const row of rows) {
    const outcome = row.transitionOutcome || row;
    const observed = outcome.observed || {};
    const reward = row.reward || {};
    rewards.push(numeric(reward.total));
    dDeltas.push(numeric(observed.DDelta));
    if (observed.targetDependencyOwnedAfter) targetOwned += 1;
    if (observed.learnerUsesReleasedEvidence) learnerUsesReleasedEvidence += 1;
    if (observed.releaseOnSchedule) releaseOnSchedule += 1;
    if (observed.delayedRelease) delayedRelease += 1;
    if (observed.earlyRelease) earlyRelease += 1;
    if (observed.generatorCompliant) generatorCompliant += 1;
    if (observed.nonLeakPassed) nonLeakPassed += 1;
    if (observed.engagementAfter === 'aporia') aporia += 1;
    if (observed.engagementAfter === 'disengaged') disengagement += 1;
    const label = outcome.failureLabel || 'none';
    failureLabels[label] = (failureLabels[label] || 0) + 1;
    addComponentTotals(componentTotals, reward.components || {});
  }
  const n = rows.length;
  const componentMeans = {};
  for (const [key, value] of Object.entries(componentTotals)) {
    componentMeans[key] = n ? value / n : 0;
  }
  return {
    actionId,
    moveFamily: rows[0]?.action?.moveFamily || null,
    n,
    meanReward: mean(rewards),
    rewardTotal: rewards.reduce((sum, value) => sum + value, 0),
    meanDDelta: mean(dDeltas),
    targetDependencyOwnedRate: n ? targetOwned / n : 0,
    learnerUsesReleasedEvidenceRate: n ? learnerUsesReleasedEvidence / n : 0,
    releaseOnScheduleRate: n ? releaseOnSchedule / n : 0,
    delayedReleaseRate: n ? delayedRelease / n : 0,
    earlyReleaseRate: n ? earlyRelease / n : 0,
    generatorComplianceRate: n ? generatorCompliant / n : 0,
    nonLeakPassRate: n ? nonLeakPassed / n : 0,
    aporiaRate: n ? aporia / n : 0,
    disengagementRate: n ? disengagement / n : 0,
    failureLabels,
    componentTotals,
    componentMeans,
  };
}

function topActions(actionSummaries) {
  const sorted = [...actionSummaries].sort(
    (a, b) => b.meanReward - a.meanReward || a.actionId.localeCompare(b.actionId),
  );
  const best = sorted[0]?.meanReward ?? null;
  return {
    bestMeanReward: best,
    sorted,
    topActionIds: sorted.filter((row) => row.meanReward === best).map((row) => row.actionId),
  };
}

function decisionCategory({ summaries, fixture }) {
  const { topActionIds, sorted } = topActions(summaries);
  if (!summaries.length || sorted.every((row) => row.meanReward <= 0)) return 'all_actions_fail';
  const hiddenFamily = fixture?.observedAtTrigger?.hiddenAction?.actionFamily || null;
  const hiddenActions = summaries.filter((row) => row.moveFamily === hiddenFamily).map((row) => row.actionId);
  const releaseTop = topActionIds.includes('B_RELEASE_P_POINT');
  const diagnostic = summaries.find((row) => row.actionId === 'A_DIAG_CONFLICT');
  const release = summaries.find((row) => row.actionId === 'B_RELEASE_P_POINT');
  const repairTop = topActionIds.includes('C_RESTAGE_P_POINT');
  if (releaseTop && diagnostic && release && release.meanReward > diagnostic.meanReward)
    return 'release_beats_diagnostic';
  if (
    repairTop &&
    release &&
    summaries.find((row) => row.actionId === 'C_RESTAGE_P_POINT')?.meanReward > release.meanReward
  ) {
    return 'repair_beats_release';
  }
  if (hiddenActions.some((actionId) => topActionIds.includes(actionId))) return 'hidden_action_best';
  return 'simulator_artifact';
}

export function analyzeA21Trials({ trials, fixture = null, command = null } = {}) {
  const rows = Array.isArray(trials) ? trials : [];
  const actionSummaries = [...groupByAction(rows).entries()].map(([actionId, group]) =>
    summarizeAction(actionId, group),
  );
  const ranking = topActions(actionSummaries);
  return {
    schema: A21_ACTION_VALUE_ANALYSIS_SCHEMA,
    generatedAt: new Date().toISOString(),
    fixtureId: fixture?.fixtureId || rows[0]?.fixtureId || null,
    fixtureHash: fixture?.fixtureHash || rows[0]?.fixtureHash || null,
    command,
    trialCount: rows.length,
    actionCount: actionSummaries.length,
    assignmentProbability: rows[0]?.assignmentProbability ?? null,
    actionSummaries: ranking.sorted,
    decisionCategory: decisionCategory({ summaries: actionSummaries, fixture }),
    bestMeanReward: ranking.bestMeanReward,
    topActionIds: ranking.topActionIds,
    observedContrasts: fixture?.observedAtTrigger || null,
    rewardWeights: rows[0]?.reward?.weights || null,
  };
}
