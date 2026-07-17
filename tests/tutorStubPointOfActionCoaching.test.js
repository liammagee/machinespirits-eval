import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TUTOR_STUB_POINT_OF_ACTION_ARMS,
  applyTutorStubPointOfActionConstraint,
  auditTutorStubPointOfActionCompliance,
  buildTutorStubPointOfActionTurn,
  tutorStubPointOfActionPlaceboAudit,
} from '../services/tutorStubPointOfActionCoaching.js';

const BASE = {
  arm: 'side_coach',
  turn: 8,
  stagnation: 0.2,
  proposedActionFamily: 'clarify_distinction',
  previousActionFamilies: ['stage_next_step', 'clarify_distinction', 'stage_next_step', 'clarify_distinction'],
  evidenceUse: 'cites_public_evidence',
  unresolvedTerms: [],
  nearClosure: false,
  closeInquiry: false,
  duePremises: [],
};

test('frozen Step 4 arm registry and placebo texts are exact and target-free', () => {
  assert.deepEqual(TUTOR_STUB_POINT_OF_ACTION_ARMS, [
    'standing_book',
    'triggered_placebo',
    'side_coach',
    'compiled_constraint',
  ]);
  const audit = tutorStubPointOfActionPlaceboAudit();
  for (const row of Object.values(audit)) {
    assert.equal(row.token_count_matched, true);
    assert.equal(row.target_free, true);
    assert.notEqual(row.target_sha256, row.placebo_sha256);
  }
});

test('warrant skip fires only for the frozen evidence-use labels', () => {
  for (const evidenceUse of ['omits_warrant', 'overleaps_evidence']) {
    const turn = buildTutorStubPointOfActionTurn({ ...BASE, evidenceUse });
    assert.equal(turn.assigned_trigger, 'warrant_skip');
    assert.equal(turn.assignment_priority, 2);
  }
  assert.equal(buildTutorStubPointOfActionTurn(BASE).assigned_trigger, null);
});

test('stagnant repeat has priority on a co-fire and compiles the release branch', () => {
  const turn = buildTutorStubPointOfActionTurn({
    ...BASE,
    arm: 'compiled_constraint',
    stagnation: 0.6,
    proposedActionFamily: 'clarify_distinction',
    previousActionFamilies: Array(4).fill('clarify_distinction'),
    evidenceUse: 'omits_warrant',
    duePremises: ['p_due'],
  });
  assert.equal(turn.assigned_trigger, 'stagnant_repeat');
  assert.equal(turn.cofire, true);
  assert.equal(turn.assignment_priority, 1);
  assert.equal(turn.compiled_constraint.action_family, 'stage_next_step');
  assert.equal(turn.compiled_constraint.force_due_release, true);
});

test('near closure, close inquiry, glossary pressure, and the turn window suppress as frozen', () => {
  const repeated = {
    ...BASE,
    stagnation: 0.9,
    previousActionFamilies: Array(4).fill('clarify_distinction'),
  };
  assert.equal(buildTutorStubPointOfActionTurn({ ...repeated, turn: 2 }).assigned_trigger, null);
  assert.equal(buildTutorStubPointOfActionTurn({ ...repeated, turn: 25 }).assigned_trigger, null);
  assert.equal(buildTutorStubPointOfActionTurn({ ...repeated, nearClosure: true }).assigned_trigger, null);
  assert.equal(buildTutorStubPointOfActionTurn({ ...repeated, closeInquiry: true }).assigned_trigger, null);
  assert.equal(buildTutorStubPointOfActionTurn({ ...repeated, unresolvedTerms: ['cupel'] }).assigned_trigger, null);
});

test('compiled constraint overrides only the typed action/release seam', () => {
  const turn = buildTutorStubPointOfActionTurn({
    ...BASE,
    arm: 'compiled_constraint',
    evidenceUse: 'omits_warrant',
    duePremises: ['p_due'],
  });
  const selection = applyTutorStubPointOfActionConstraint(
    {
      policy: 'bland',
      action_family: 'clarify_distinction',
      response_configuration: { action_family: 'clarify_distinction', engagement_stance: 'plain' },
    },
    turn,
  );
  assert.equal(selection.policy, 'bland');
  assert.equal(selection.action_family, 'answer_accountably');
  assert.equal(selection.response_configuration.action_family, 'answer_accountably');
  assert.equal(turn.compiled_constraint.suppress_new_premise, true);
});

test('compliance audit covers release, no-release, and focused-warrant cases', () => {
  const stagnant = buildTutorStubPointOfActionTurn({
    ...BASE,
    stagnation: 0.8,
    previousActionFamilies: Array(4).fill('clarify_distinction'),
  });
  assert.equal(
    auditTutorStubPointOfActionCompliance({ turn: stagnant, tutorText: 'A new clue enters.', releasedPremiseCount: 1 })
      .compliant,
    true,
  );
  assert.equal(
    auditTutorStubPointOfActionCompliance({
      turn: stagnant,
      tutorText: 'Return to the cupel.',
      realizedActionFamily: 'reanchor_public_evidence',
    }).compliant,
    true,
  );

  const warrant = buildTutorStubPointOfActionTurn({ ...BASE, evidenceUse: 'overleaps_evidence' });
  assert.equal(
    auditTutorStubPointOfActionCompliance({
      turn: warrant,
      tutorText: 'Which public evidence item connects your claim to the rule?',
      releasedPremiseCount: 0,
      guardsPassed: true,
    }).compliant,
    true,
  );
  assert.equal(
    auditTutorStubPointOfActionCompliance({
      turn: warrant,
      tutorText: 'Which clue supports it? What rule applies?',
      releasedPremiseCount: 0,
      guardsPassed: true,
    }).compliant,
    false,
  );
});
