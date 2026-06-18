import assert from 'node:assert/strict';
import test from 'node:test';
import { realizeTutorUtterance, verifyRealization } from '../services/adaptiveTutor/realizationVerifier.js';

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
