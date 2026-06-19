import assert from 'node:assert/strict';
import test from 'node:test';
import { detectOutcomeEvidence, observeInterventionOutcome } from '../services/adaptiveTutor/outcomeObserver.js';

test('affective shutdown counts as learner-state evidence, not empty release', () => {
  const text = "I just... I can't do this. I don't get any of this and I'm wasting your time.";
  const evidence = detectOutcomeEvidence(text);

  assert.equal(evidence.categories['state-disambiguating response'], true);
  assert.equal(evidence.categories['empty release'], false);
});

test('diagnostic question closes successfully when learner surfaces affective state', () => {
  const result = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'diagnose_with_discriminating_question',
      success_signal: {
        required_evidence: ['state-disambiguating response'],
        forbidden_evidence: ['mere agreement'],
      },
    },
    learnerTurn: "I just... I can't do this. I don't get any of this and I'm wasting your time.",
    turnIndex: 2,
  });

  assert.equal(result.outcome, 'success');
  assert.equal(result.required_evidence_satisfied, true);
  assert.equal(result.evidence[0].categories['state-disambiguating response'], true);
});
