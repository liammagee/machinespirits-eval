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

test('minimal hint fails when learner says the prerequisite idea is still missing', () => {
  const result = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'minimal_hint',
      success_signal: {
        required_evidence: ['learner-authored next step'],
        forbidden_evidence: ['tutor-completed step'],
      },
    },
    learnerTurn:
      'The small hint is still not enough; I need the prerequisite idea before I can apply it to a similar problem.',
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

test('no-intervention closes on learner-owned next step', () => {
  const result = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'observe_no_intervention',
      success_signal: {
        required_evidence: ['learner-authored next step', 'learner-authored choice'],
        forbidden_evidence: ['mere agreement', 'empty release'],
      },
    },
    learnerTurn:
      'Next I would test a new case because the claim depends on whether mutual standing survives disagreement.',
    turnIndex: 3,
  });

  assert.equal(result.outcome, 'success');
  assert.equal(result.evidence[0].categories['learner-authored next step'], true);
});

test('explanation closes only with transfer/application evidence', () => {
  const result = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'explain_principle',
      success_signal: {
        required_evidence: ['learner-authored application'],
        forbidden_evidence: ['mere agreement'],
      },
    },
    learnerTurn:
      'In a new case, I can transfer the same idea because recognition depends on reciprocal standing, not just agreement.',
    turnIndex: 3,
  });

  assert.equal(result.outcome, 'success');
  assert.equal(result.evidence[0].categories['learner-authored transfer'], true);
});

test('semantic observer recognizes natural evidence and task-reorientation language', () => {
  const result = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'request_evidence',
      success_signal: {
        required_evidence: ['learner-authored rationale', 'learner-owned relevance test', 'task reorientation'],
        forbidden_evidence: ['mere agreement'],
      },
    },
    learnerTurn:
      'I think this step would help decide whether the approach is valid for the actual problem. The evidence would be the assumptions we already checked.',
    turnIndex: 1,
    config: { semanticOutcomeObserver: true },
  });

  assert.equal(result.outcome, 'success');
  assert.equal(result.evidence[0].categories['learner-authored rationale'], true);
  assert.equal(result.evidence[0].categories['task reorientation'], true);
});

test('typed evidence contract closes on proof core plus one resistance-core signal', () => {
  const result = observeInterventionOutcome({
    pendingIntervention: {
      action_type: 'request_evidence',
      success_signal: {
        required_evidence: ['learner-authored rationale'],
        forbidden_evidence: ['mere agreement'],
        evidence_contract: {
          version: 'adaptation-evidence-contract.v1',
          mode: 'proof_core_plus_resistance_core',
          core_evidence: ['learner-authored rationale'],
          any_of_groups: [
            {
              id: 'resistance_core',
              min: 1,
              labels: ['learner-owned relevance test', 'task reorientation'],
            },
          ],
          supporting_evidence: ['learner-owned relevance test', 'task reorientation'],
        },
      },
    },
    learnerTurn:
      'The evidence would be that this step matters for the actual task: it decides whether the method is valid for the case.',
    turnIndex: 1,
    config: { semanticOutcomeObserver: true },
  });

  assert.equal(result.outcome, 'success');
  assert.equal(result.required_evidence_satisfied, true);
  assert.equal(result.evidence_contract.satisfied, true);
  assert.equal(result.evidence_contract.groups[0].satisfied, true);
});

test('semantic observer keeps shallow negative controls strict', () => {
  const pendingIntervention = {
    action_type: 'request_evidence',
    success_signal: {
      required_evidence: ['learner-authored rationale'],
      forbidden_evidence: ['mere agreement'],
    },
  };
  for (const learnerTurn of [
    'Okay.',
    'Master, servant, recognition, formula.',
    'As you said, your reason explains it.',
    'Can you explain more?',
    'Because it just works and that proves this is the right move.',
  ]) {
    const result = observeInterventionOutcome({
      pendingIntervention,
      learnerTurn,
      turnIndex: 1,
      config: { semanticOutcomeObserver: true },
    });
    assert.notEqual(result.outcome, 'success', learnerTurn);
  }
});
