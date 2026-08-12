import assert from 'node:assert/strict';
import test from 'node:test';

import { compileTutorStubTurnProgressionContract } from '../services/tutorStubTurnProgressionContract.js';
import { verifyFallbackPassClosureContract } from '../scripts/verify-adaptive-warrant-fallback-pass-closure.js';

function firstDraftContractFor(target) {
  return {
    progression: compileTutorStubTurnProgressionContract({
      learnerText: target.source_surface,
      responseCompositionFrame: {
        learner_move: { summary: target.source_surface },
        conversational_completion: { resolved: false },
      },
      dramaticReleaseFrame: { active: false, entries: [] },
      actionFamily: 'answer_accountably',
      publicObligationDirective: {
        obligation_id: `closure-${target.signature}`,
        target,
        acceptable_outcomes: ['bounded_public_answer', 'named_unavailability_with_concrete_next_step'],
      },
    }),
  };
}

test('fallback-pass closure covers generic, typed-value, and named obligation targets end to end', () => {
  const targets = [
    {
      kind: 'public_exhibit_result',
      signature: 'public_exhibit_result:generic_evidence_request',
      public_terms: ['evidence'],
      subject_terms: [],
      required_components: [
        { id: 'requested_other', terms: ['other'], value_type: 'other' },
        { id: 'requested_record_text', terms: ['record_text'], value_type: 'record_text' },
      ],
      source_surface: 'generic evidence request',
    },
    {
      kind: 'record_entry',
      signature: 'record_entry:badge|log',
      public_terms: ['badge', 'log', 'record'],
      subject_terms: ['badge'],
      required_components: [],
      source_surface: 'badge log record entry',
    },
  ];

  for (const target of targets) {
    const result = verifyFallbackPassClosureContract({
      firstDraftContract: firstDraftContractFor(target),
      learnerText: target.source_surface,
    });
    assert.equal(result.compiledComplete, true, target.signature);
    assert.equal(result.noQuestion, true, target.signature);
    assert.equal(result.duplicateCount, 1, target.signature);
    assert.equal(result.progressionOk, true, JSON.stringify(result.progressionIssues));
    assert.equal(result.deliveryStatus, 'deferred', target.signature);
    assert.equal(result.repetitionOk, true, JSON.stringify(result.repetitionIssues));
    assert.equal(result.finalResponseCheckOk, true, JSON.stringify(result.hardIssues));
  }
});
