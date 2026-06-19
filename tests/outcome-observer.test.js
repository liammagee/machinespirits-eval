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

test('generic explain-more reply is a failed diagnostic rather than inconclusive', () => {
  const result = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'diagnose_with_discriminating_question',
      success_signal: {
        required_evidence: ['state-disambiguating response'],
        forbidden_evidence: ['mere agreement'],
      },
    },
    learnerTurn: 'Hmm, can you explain more?',
    turnIndex: 1,
  });

  assert.equal(result.outcome, 'failure');
  assert.equal(result.evidence[0].categories['undifferentiated help request'], true);
});

test('minimal hint fails when learner reveals a deeper prerequisite gap', () => {
  const result = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'minimal_hint',
      success_signal: {
        required_evidence: ['learner-authored next step'],
        forbidden_evidence: ['tutor-completed step'],
      },
    },
    learnerTurn:
      'I do not know the basic concept yet; I need the underlying idea of recognition before I can test whether the argument works.',
    turnIndex: 2,
  });

  assert.equal(result.outcome, 'failure');
  assert.equal(result.evidence[0].categories['evidence of deeper gap'], true);
});

test('contrast action succeeds when learner asks a targeted boundary question', () => {
  const result = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'contrast_models',
      success_signal: {
        required_evidence: ['model comparison'],
        forbidden_evidence: ['mere agreement'],
      },
    },
    learnerTurn: 'But that only works if we assume X — what about the case where not-X?',
    turnIndex: 1,
  });

  assert.equal(result.outcome, 'success');
  assert.equal(result.evidence[0].categories['targeted question'], true);
});
