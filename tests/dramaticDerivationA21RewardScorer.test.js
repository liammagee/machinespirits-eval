import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  A21_REWARD_BREAKDOWN_SCHEMA,
  applyTutorActionToLearnerState,
  auditTransition,
  defaultHethelActionSet,
  executeA21Action,
  getA21Action,
  initialHethelLearnerState,
  scoreReward,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(
  readFileSync(path.join(ROOT, 'exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json'), 'utf8'),
);
const actionSet = defaultHethelActionSet();

function outcomeFor(actionId, extra = {}) {
  const action = getA21Action(actionSet, actionId);
  const execution = executeA21Action(action, { assignmentProbability: 0.25, trialId: actionId, turn: fixture.trigger.turn });
  const releaseInfo = { ...execution.releaseInfo, ...(extra.releaseInfo || {}) };
  const before = initialHethelLearnerState(fixture);
  const simulation = applyTutorActionToLearnerState(before, action, extra.tutorText ?? execution.tutorText, releaseInfo);
  return auditTransition({
    trialId: actionId,
    fixture,
    action,
    actionExecution: { ...execution, releaseInfo },
    learnerStateBefore: simulation.learnerStateBefore,
    learnerStateAfter: simulation.learnerStateAfter,
    tutorText: extra.tutorText ?? execution.tutorText,
    learnerText: 'I follow.',
  });
}

function sumComponents(components) {
  return Object.values(components).reduce((sum, value) => sum + value, 0);
}

test('A21 reward scorer gives release progress positive value and sums components exactly', () => {
  const reward = scoreReward(outcomeFor('B_RELEASE_P_POINT', { releaseInfo: { releaseDeviation: 'on_schedule' } }));

  assert.equal(reward.schema, A21_REWARD_BREAKDOWN_SCHEMA);
  assert.equal(reward.components.DDecrease, 2);
  assert.equal(reward.components.learnerUsesReleasedEvidence, 2);
  assert.equal(reward.components.releaseOnSchedule, 1);
  assert.equal(reward.total, sumComponents(reward.components));
  assert.equal(reward.total, 9);
});

test('A21 reward scorer penalizes diagnostic repetition, delayed release, and aporia', () => {
  const reward = scoreReward(outcomeFor('A_DIAG_CONFLICT'));

  assert.equal(reward.components.diagnosticRepetitionPenalty, -2);
  assert.equal(reward.components.delayedReleasePenalty, -2);
  assert.equal(reward.components.aporiaPenalty, -4);
  assert.equal(reward.total, sumComponents(reward.components));
  assert.ok(reward.total < 0);
});

test('A21 reward scorer rewards target dependency ownership without hiding opportunity cost', () => {
  const reward = scoreReward(outcomeFor('C_RESTAGE_P_POINT'));

  assert.equal(reward.components.targetDependencyOwned, 3);
  assert.equal(reward.components.delayedReleasePenalty, -2);
  assert.equal(reward.total, sumComponents(reward.components));
});
