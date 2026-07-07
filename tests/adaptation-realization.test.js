import assert from 'node:assert/strict';
import test from 'node:test';
import {
  realizeStagedFollowup,
  realizeTutorUtterance,
  verifyRealization,
} from '../services/adaptiveTutor/realizationVerifier.js';

test('observe no-intervention realizes as closure rather than a generic prompt', () => {
  const selectedAction = { action_type: 'observe_no_intervention' };
  const realized = realizeTutorUtterance({
    selectedAction,
    stateBelief: { hypotheses: [{ id: 'productive_progress', probability: 0.78 }] },
    interventionLedger: [],
    config: {},
  });
  const checks = verifyRealization({ tutorText: realized.text, selectedAction });

  assert.match(realized.text, /won't add another hint/u);
  assert.doesNotMatch(realized.text, /next task-relevant move/u);
  assert.equal(checks.allowed, true);
});

test('contextual observe no-intervention stays out after repeated learner-owned progress', () => {
  const selectedAction = { action_type: 'observe_no_intervention' };
  const realized = realizeTutorUtterance({
    selectedAction,
    stateBelief: { hypotheses: [{ id: 'productive_progress', probability: 0.78 }] },
    interventionLedger: [
      {
        status: 'closed',
        action_type: 'observe_no_intervention',
        outcome: 'success',
        hypothesis_ids: ['productive_progress'],
      },
    ],
    config: { realizationContext: true },
  });
  const checks = verifyRealization({ tutorText: realized.text, selectedAction });

  assert.match(realized.text, /stay out for this step/u);
  assert.equal(checks.allowed, true);
});

test('contextual realization refines repeated diagnostic under false mastery', () => {
  const selectedAction = { action_type: 'diagnose_with_discriminating_question' };
  const stateBelief = {
    hypotheses: [{ id: 'false_mastery', probability: 0.72 }],
  };
  const interventionLedger = [
    {
      status: 'closed',
      action_type: 'diagnose_with_discriminating_question',
      outcome: 'success',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];

  const realized = realizeTutorUtterance({
    selectedAction,
    stateBelief,
    interventionLedger,
    config: { realizationContext: true },
  });
  const checks = verifyRealization({ tutorText: realized.text, selectedAction });

  assert.match(realized.text, /test the 'makes sense' claim/u);
  assert.equal(checks.allowed, true);
});

test('contextual realization leaves first diagnostic in static form', () => {
  const selectedAction = { action_type: 'diagnose_with_discriminating_question' };
  const realized = realizeTutorUtterance({
    selectedAction,
    stateBelief: { hypotheses: [{ id: 'missing_prerequisite', probability: 0.72 }] },
    interventionLedger: [],
    config: { realizationContext: true },
  });

  assert.match(realized.text, /separate two possibilities/u);
  assert.doesNotMatch(realized.text, /already separated/u);
});

test('static realization remains unchanged when contextual mode is disabled', () => {
  const selectedAction = { action_type: 'diagnose_with_discriminating_question' };
  const realized = realizeTutorUtterance({
    selectedAction,
    stateBelief: { hypotheses: [{ id: 'false_mastery', probability: 0.72 }] },
    interventionLedger: [{ status: 'closed', action_type: 'diagnose_with_discriminating_question' }],
    config: {},
  });

  assert.match(realized.text, /separate two possibilities/u);
});

test('request_evidence realization is shaped by learner resistance signal', () => {
  const selectedAction = {
    action_type: 'request_evidence',
    adaptation_policy_layer: {
      learner_resistance: { observed_signal: 'question_flood' },
    },
  };
  const realized = realizeTutorUtterance({ selectedAction });
  const checks = verifyRealization({ tutorText: realized.text, selectedAction });

  assert.match(realized.text, /Collapse the flood to one main question/u);
  assert.match(realized.text, /evidence/u);
  assert.equal(checks.allowed, true);
});

test('character-DAG drama realization sharpens rote prediction prompts without hidden labels', () => {
  const selectedAction = { action_type: 'request_evidence' };
  const realized = realizeTutorUtterance({
    selectedAction,
    config: {
      characterDagDramaRealization: {
        enabled: true,
        resistance_signal: 'rote_parroting',
      },
    },
  });
  const checks = verifyRealization({ tutorText: realized.text, selectedAction });

  assert.match(realized.text, /Make a prediction in your own words/u);
  assert.match(realized.text, /case changes/u);
  assert.match(realized.text, /evidence justifies/u);
  assert.doesNotMatch(realized.text, /learner-authored|evidence label|rubric/u);
  assert.equal(checks.allowed, true);
});

test('character-DAG drama realization asks transfer scenes for boundary checks', () => {
  const selectedAction = { action_type: 'request_evidence' };
  const realized = realizeTutorUtterance({
    selectedAction,
    config: {
      characterDagDramaRealization: {
        enabled: true,
        transfer: true,
        resistance_signal: 'irrelevance',
      },
    },
  });
  const checks = verifyRealization({ tutorText: realized.text, selectedAction });

  assert.match(realized.text, /what carries over/u);
  assert.match(realized.text, /condition might fail/u);
  assert.match(realized.text, /old move is valid/u);
  assert.doesNotMatch(realized.text, /task reorientation|learner-authored|evidence label|rubric/u);
  assert.equal(checks.allowed, true);
});

test('staged follow-up targets missing combined evidence labels', () => {
  const realized = realizeStagedFollowup({
    pendingIntervention: {
      action_type: 'request_evidence',
      staged_closure: {
        missing_required_evidence: ['learner-authored prediction', 'non-formulaic learner rationale'],
      },
    },
  });

  assert.match(realized.text, /make a prediction/u);
  assert.match(realized.text, /without just repeating the formula words/u);
});

test('staged follow-up uses typed missing evidence axis when present', () => {
  const realized = realizeStagedFollowup({
    config: { typedStagedFollowup: true },
    pendingIntervention: {
      action_type: 'request_evidence',
      staged_closure: {
        missing_required_evidence: ['learner-owned relevance test', 'task reorientation'],
        missing_evidence_axes: ['relevance'],
      },
    },
  });

  assert.match(realized.text, /relevance part/u);
  assert.match(realized.text, /actual task/u);
});

test('staged follow-up leaves typed axis disabled by default', () => {
  const realized = realizeStagedFollowup({
    pendingIntervention: {
      action_type: 'request_evidence',
      staged_closure: {
        missing_required_evidence: ['learner-owned relevance test'],
        missing_evidence_axes: ['relevance'],
      },
    },
  });

  assert.match(realized.text, /state how this step would matter for the task/u);
  assert.doesNotMatch(realized.text, /relevance part/u);
});
