import { executeA21Action, loadActionSet, validateA21ActionSet } from './actionSet.js';
import { initialHethelLearnerState } from './learnerState.js';
import { applyTutorActionToLearnerState } from './learnerSimulator.js';
import { auditTransition } from './transitionAudit.js';
import { scoreReward } from './rewardScorer.js';

export const A21_TRIAL_RUN_SCHEMA = 'dramatic-derivation.a21.trial-run.v0';
export const A21_TRIAL_ROW_SCHEMA = 'dramatic-derivation.a21.trial-row.v0';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableActionOrder(actions, seed) {
  const ordered = [...actions].sort((a, b) => String(a.actionId).localeCompare(String(b.actionId)));
  if (!Number.isFinite(Number(seed))) return ordered;
  const shift = ordered.length ? Math.abs(Number(seed)) % ordered.length : 0;
  return [...ordered.slice(shift), ...ordered.slice(0, shift)];
}

function releaseDeviationForFixture(fixture, action, releaseInfo) {
  const target = fixture?.releaseContext?.targetPremise || 'p_point';
  const safeTurns = (fixture?.releaseContext?.hiddenObserved?.safeTurns || []).map(Number);
  const turn = Number(releaseInfo?.turn ?? fixture?.trigger?.turn);
  const released = new Set([...(action?.releaseDirectives?.releaseNow || []), ...(releaseInfo?.releaseNow || [])]);
  if (!released.has(target)) return null;
  return safeTurns.includes(turn) ? 'on_schedule' : 'early';
}

export function renderDeterministicLearnerText({ action, learnerStateBefore, learnerStateAfter, transitionOutcome }) {
  const observed = transitionOutcome?.observed || {};
  if (learnerStateAfter.engagement === 'aporia') {
    return 'No, I am losing the thread. I have answered that record already, and no new piece has appeared.';
  }
  if (learnerStateAfter.engagement === 'disengaged') {
    return 'I cannot continue from this. The question keeps moving without a new support.';
  }
  if (observed.targetDependencyOwnedBefore === false && observed.targetDependencyOwnedAfter === true) {
    return 'I can put that point in my own words now, and I see how it bears on the next step.';
  }
  if (observed.learnerUsesReleasedEvidence) {
    return 'Yes. With that newly staged point, I can work from it instead of repeating the bond alone.';
  }
  if (action.moveFamily === 'ask_diagnostic') {
    return 'I have already said where the record stops: it names the builder and the bond, not the hand that felled the span.';
  }
  if (learnerStateAfter.proofProgress.D === learnerStateBefore.proofProgress.D) {
    return 'I follow the pause, but I do not yet have a new public support to move with.';
  }
  return 'I see the next step more clearly now.';
}

function runOneTrial({ fixture, actionSet, action, actionIndex, replicate, mode, seed }) {
  if (mode !== 'deterministic') {
    throw new Error(`a21.trialRunner: unsupported mode ${JSON.stringify(mode)}`);
  }
  const turn = Number(fixture?.trigger?.turn || 0);
  const trialId = `${fixture.fixtureId || 'fixture'}:${action.actionId}:r${replicate + 1}`;
  const assignmentProbability = actionSet.actions.length ? 1 / actionSet.actions.length : null;
  const actionExecution = executeA21Action(action, { assignmentProbability, trialId, turn });
  const releaseDeviation = releaseDeviationForFixture(fixture, action, actionExecution.releaseInfo);
  const releaseInfo = {
    ...actionExecution.releaseInfo,
    ...(releaseDeviation ? { releaseDeviation } : {}),
  };
  const learnerStateBefore = initialHethelLearnerState(fixture);
  const simulation = applyTutorActionToLearnerState(learnerStateBefore, action, actionExecution.tutorText, releaseInfo);
  const previewOutcome = auditTransition({
    trialId,
    fixture,
    action,
    actionExecution: { ...actionExecution, releaseInfo },
    learnerStateBefore: simulation.learnerStateBefore,
    learnerStateAfter: simulation.learnerStateAfter,
    tutorText: actionExecution.tutorText,
    learnerText: '',
    seed,
  });
  const learnerText = renderDeterministicLearnerText({
    action,
    learnerStateBefore: simulation.learnerStateBefore,
    learnerStateAfter: simulation.learnerStateAfter,
    transitionOutcome: previewOutcome,
  });
  const transitionOutcome = auditTransition({
    trialId,
    fixture,
    action,
    actionExecution: { ...actionExecution, releaseInfo },
    learnerStateBefore: simulation.learnerStateBefore,
    learnerStateAfter: simulation.learnerStateAfter,
    tutorText: actionExecution.tutorText,
    learnerText,
    seed,
  });
  const reward = scoreReward(transitionOutcome);
  return {
    schema: A21_TRIAL_ROW_SCHEMA,
    trialId,
    fixtureId: fixture.fixtureId,
    fixtureHash: fixture.fixtureHash || null,
    mode,
    seed,
    replicate: replicate + 1,
    actionOrderIndex: actionIndex,
    assignmentProbability,
    action: clone(action),
    actionExecution: { ...actionExecution, releaseInfo },
    simulation,
    transitionOutcome,
    reward,
  };
}

export function runA21Microbench({
  fixture,
  actionSet = loadActionSet(fixture?.fixtureId),
  mode = 'deterministic',
  k = 1,
  seed = 20260616,
} = {}) {
  if (!fixture || typeof fixture !== 'object') throw new Error('a21.trialRunner: fixture is required');
  const loadedActionSet = validateA21ActionSet(clone(actionSet));
  const replicates = Math.max(1, Number(k) || 1);
  const orderedActions = stableActionOrder(loadedActionSet.actions, seed);
  const trials = [];
  for (let replicate = 0; replicate < replicates; replicate += 1) {
    for (let actionIndex = 0; actionIndex < orderedActions.length; actionIndex += 1) {
      trials.push(
        runOneTrial({
          fixture,
          actionSet: loadedActionSet,
          action: orderedActions[actionIndex],
          actionIndex,
          replicate,
          mode,
          seed,
        }),
      );
    }
  }
  return {
    schema: A21_TRIAL_RUN_SCHEMA,
    fixtureId: fixture.fixtureId,
    fixtureHash: fixture.fixtureHash || null,
    mode,
    seed,
    k: replicates,
    actionCount: loadedActionSet.actions.length,
    assignmentProbability: loadedActionSet.actions.length ? 1 / loadedActionSet.actions.length : null,
    trials,
  };
}
