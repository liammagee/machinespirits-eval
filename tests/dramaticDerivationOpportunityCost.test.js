import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPPORTUNITY_COST_SCHEMA,
  auditOpportunityCost,
  deriveOpportunityCostBudget,
  nextOpportunityCostBudget,
} from '../services/dramaticDerivation/index.js';

test('opportunity cost defaults block proof-neutral tutor turns when release is pending', () => {
  const budget = deriveOpportunityCostBudget({
    scope: 'turn',
    proofCriticalReleasePending: true,
  });

  assert.equal(budget.schema, OPPORTUNITY_COST_SCHEMA);
  assert.equal(budget.maxProofNeutralTutorTurns, 0);
  assert.equal(budget.maxProofNeutralLearnerTurns, 1);
  assert.equal(budget.decayHeadroomRisk, 'high');
  const audit = auditOpportunityCost(budget, { actor: 'tutor', conduct: 'teach_back' });
  assert.equal(audit.ok, false);
  assert.equal(audit.blocked, true);
  assert.match(audit.reason, /release_pending/u);
});

test('minimal presence paired with a binding proof action does not spend tutor budget', () => {
  const budget = deriveOpportunityCostBudget({ proofCriticalReleasePending: true });
  const audit = auditOpportunityCost(budget, {
    actor: 'tutor',
    conduct: 'minimal_presence',
    pairedWithBindingProofAction: true,
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.proofNeutral, false);
});

test('proof-neutral counters increment and reset on proof action', () => {
  const budget = deriveOpportunityCostBudget({ repairPending: true, currentProofNeutralTutorTurns: 0 });
  const spent = nextOpportunityCostBudget(budget, { actor: 'tutor', conduct: 'slow_recap' });
  assert.equal(spent.currentProofNeutralTutorTurns, 1);
  assert.equal(auditOpportunityCost(spent, { actor: 'tutor', conduct: 'teach_back' }).ok, false);

  const reset = nextOpportunityCostBudget(spent, { proofActionTaken: true });
  assert.equal(reset.currentProofNeutralTutorTurns, 0);
  assert.equal(reset.currentProofNeutralLearnerTurns, 0);
});
