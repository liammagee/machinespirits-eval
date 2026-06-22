import assert from 'node:assert/strict';
import test from 'node:test';
import {
  A21_ACTION_EXECUTION_SCHEMA,
  A21_ACTION_SET_SCHEMA,
  defaultHethelActionSet,
  executeA21Action,
  getA21Action,
  validateA21ActionSet,
} from '../services/dramaticDerivation/index.js';

test('A21 Hethel action set freezes exactly four candidate actions and no winner', () => {
  const actionSet = defaultHethelActionSet();

  assert.equal(actionSet.schema, A21_ACTION_SET_SCHEMA);
  assert.equal(actionSet.winnerActionId, null);
  assert.deepEqual(
    actionSet.actions.map((action) => action.actionId),
    ['A_DIAG_CONFLICT', 'B_RELEASE_P_POINT', 'C_RESTAGE_P_POINT', 'D_CONSOLIDATE_THEN_RELEASE'],
  );
  validateA21ActionSet(actionSet);
});

test('A21 action execution logs action probability and does not mutate the action', () => {
  const actionSet = defaultHethelActionSet();
  const action = getA21Action(actionSet, 'B_RELEASE_P_POINT');
  const before = JSON.stringify(action);
  const executed = executeA21Action(action, { assignmentProbability: 0.25, trialId: 'trial-1', turn: 11 });

  assert.equal(executed.schema, A21_ACTION_EXECUTION_SCHEMA);
  assert.equal(executed.actionId, 'B_RELEASE_P_POINT');
  assert.deepEqual(executed.releaseInfo.releaseNow, ['p_point']);
  assert.equal(executed.actionLog.assignmentProbability, 0.25);
  assert.equal(executed.releaseInfo.turn, 11);
  assert.equal(JSON.stringify(action), before);
});

test('A21 action-set validation rejects encoded winners and broad action drift', () => {
  const withWinner = defaultHethelActionSet();
  withWinner.winnerActionId = 'B_RELEASE_P_POINT';
  assert.throws(() => validateA21ActionSet(withWinner), /must not encode a winner/u);

  const withExtra = defaultHethelActionSet();
  withExtra.actions.push({
    actionId: 'E_NEW_TAXONOMY',
    moveFamily: 'invent_new_taxonomy',
    description: 'Bad expansion.',
    tutorInstruction: 'Do a fifth thing.',
    releaseDirectives: { releaseNow: [], hold: [], noLeak: [] },
    opportunityCost: { consumesTurn: true, delaysRelease: [], mayIncreaseFrustration: false, mayLeak: false },
  });
  assert.throws(() => validateA21ActionSet(withExtra), /expected exactly 4/u);
});
