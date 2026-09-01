import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateLearnerStateBelief, selectPedagogicalAction } from '../services/adaptiveTutor/actionPolicy.js';
import { replayDeterministicChoice } from '../services/deterministicExperimentSampler.js';
import {
  assignTutorStubTypedAction,
  normalizeTutorStubTypedActionAssignmentMode,
} from '../services/tutorStubTypedActionAssignment.js';

function assignableSelectionInput() {
  const stateBelief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: 'I am not sure; can you tell me which public clue matters?' }],
    turnIndex: 2,
  });
  return {
    stateBelief,
    interventionLedger: [
      {
        action_type: 'diagnose_with_discriminating_question',
        status: 'closed',
        outcome: 'success',
        turn_index: 1,
      },
    ],
    mode: 'closed_loop',
    config: {},
  };
}

function samplingContext(overrides = {}) {
  return {
    runSeed: 31,
    profile: 'diligent',
    policy: 'uniform_family_eligible',
    repeat: 1,
    learnerTurn: 2,
    decisionKind: 'typed_action_assignment',
    jobId: 'collection-preflight',
    ...overrides,
  };
}

test('typed-action assignment mode is explicit and fails closed on unknown values', () => {
  assert.equal(normalizeTutorStubTypedActionAssignmentMode(undefined), 'policy');
  assert.equal(normalizeTutorStubTypedActionAssignmentMode(' uniform_family_eligible '), 'uniform_family_eligible');
  assert.throws(
    () => normalizeTutorStubTypedActionAssignmentMode('top_two'),
    /--typed-action-assignment must be policy or uniform_family_eligible/u,
  );
});

test('policy assignment leaves the ordinary deterministic selection unchanged', () => {
  const selectionInput = assignableSelectionInput();
  const selection = selectPedagogicalAction(selectionInput);
  const result = assignTutorStubTypedAction({ mode: 'policy', selection, selectionInput });

  assert.equal(result.selection, selection);
  assert.equal(result.probability, 1);
  assert.equal(result.audit.disposition, 'policy_selected');
  assert.equal(result.audit.draw, null);
});

test('uniform family assignment is seeded, replayable, and restricted to policy-eligible actions', () => {
  const selectionInput = assignableSelectionInput();
  const selection = selectPedagogicalAction(selectionInput);
  assert.equal(selection.selectionAuthority.assignable, true);

  const first = assignTutorStubTypedAction({
    mode: 'uniform_family_eligible',
    selection,
    selectionInput,
    samplingContext: samplingContext(),
  });
  const repeated = assignTutorStubTypedAction({
    mode: 'uniform_family_eligible',
    selection,
    selectionInput,
    samplingContext: samplingContext(),
  });
  const eligible = selection.candidateActions.map((candidate) => candidate.action_type);

  assert.ok(eligible.includes(first.selection.selectedAction.action_type));
  assert.equal(first.audit.selected_action_type, first.selection.selectedAction.action_type);
  assert.equal(first.audit.baseline_action_type, selection.selectedAction.action_type);
  assert.deepEqual(first.audit.eligible_action_types, eligible);
  assert.equal(first.audit.family_draw.selectedValue, repeated.audit.family_draw.selectedValue);
  assert.equal(first.audit.action_draw.selectedValue, repeated.audit.action_draw.selectedValue);
  assert.equal(replayDeterministicChoice(first.audit.family_draw).matches, true);
  assert.equal(replayDeterministicChoice(first.audit.action_draw).matches, true);
  assert.ok(Math.abs(first.familyProbability - 1 / first.audit.eligible_move_families.length) < Number.EPSILON);
  assert.equal(
    first.probability,
    first.audit.selected_family_probability * first.audit.selected_action_within_family_probability,
  );
  assert.equal(first.selection.selectionAuthority.kind, 'prospective_uniform_family_eligible_assignment');
});

test('uniform family assignment preserves mandatory diagnostic authority without drawing', () => {
  const stateBelief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: 'I am not sure; can you tell me which public clue matters?' }],
    turnIndex: 1,
  });
  const selectionInput = { stateBelief, interventionLedger: [], mode: 'closed_loop', config: {} };
  const selection = selectPedagogicalAction(selectionInput);
  assert.equal(selection.selectionAuthority.kind, 'mandatory_diagnostic');

  const result = assignTutorStubTypedAction({
    mode: 'uniform_family_eligible',
    selection,
    selectionInput,
    samplingContext: samplingContext({ learnerTurn: 1 }),
  });

  assert.equal(result.selection, selection);
  assert.equal(result.probability, 1);
  assert.equal(result.audit.disposition, 'mandatory_policy_authority_preserved');
  assert.equal(result.audit.draw, null);
});
