import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  A21_TRANSITION_OUTCOME_SCHEMA,
  applyTutorActionToLearnerState,
  auditTransition,
  defaultHethelActionSet,
  executeA21Action,
  getA21Action,
  initialHethelLearnerState,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(
  readFileSync(path.join(ROOT, 'exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json'), 'utf8'),
);
const actionSet = defaultHethelActionSet();

function runAudited(actionId, extra = {}) {
  const action = getA21Action(actionSet, actionId);
  const execution = executeA21Action(action, {
    assignmentProbability: 0.25,
    trialId: actionId,
    turn: fixture.trigger.turn,
  });
  const releaseInfo = { ...execution.releaseInfo, ...(extra.releaseInfo || {}) };
  const before = initialHethelLearnerState(fixture);
  const simulation = applyTutorActionToLearnerState(
    before,
    action,
    extra.tutorText ?? execution.tutorText,
    releaseInfo,
  );
  return auditTransition({
    trialId: actionId,
    fixture,
    action,
    actionExecution: { ...execution, releaseInfo },
    learnerStateBefore: simulation.learnerStateBefore,
    learnerStateAfter: simulation.learnerStateAfter,
    tutorText: extra.tutorText ?? execution.tutorText,
    learnerText: extra.learnerText ?? 'I see the next public point.',
  });
}

test('A21 transition audit marks due p_point release as on-schedule progress', () => {
  const outcome = runAudited('B_RELEASE_P_POINT', { releaseInfo: { releaseDeviation: 'on_schedule' } });

  assert.equal(outcome.schema, A21_TRANSITION_OUTCOME_SCHEMA);
  assert.equal(outcome.actionId, 'B_RELEASE_P_POINT');
  assert.equal(outcome.observed.DBefore, 5);
  assert.equal(outcome.observed.DAfter, 4);
  assert.equal(outcome.observed.DDelta, -1);
  assert.equal(outcome.observed.releaseOnSchedule, true);
  assert.equal(outcome.observed.learnerUsesReleasedEvidence, true);
  assert.deepEqual(outcome.observed.releaseDeviations, []);
  assert.equal(outcome.failureLabel, 'none');
});

test('A21 transition audit treats repeated diagnostic at a due release as aporia/release starvation evidence', () => {
  const outcome = runAudited('A_DIAG_CONFLICT');

  assert.equal(outcome.observed.DDelta, 0);
  assert.equal(outcome.observed.delayedRelease, true);
  assert.deepEqual(outcome.observed.releaseDeviations, ['delayed:p_point']);
  assert.equal(outcome.observed.diagnosticRepeatedWithoutNewEvidenceDelta, 1);
  assert.equal(outcome.observed.engagementAfter, 'aporia');
  assert.equal(outcome.failureLabel, 'aporia');
});

test('A21 transition audit detects non-leak failure in tutor-facing text', () => {
  const outcome = runAudited('B_RELEASE_P_POINT', {
    tutorText: 'Use this because D=5 in the hidden board state.',
  });

  assert.equal(outcome.observed.nonLeakPassed, false);
  assert.equal(outcome.failureLabel, 'leak');
});
