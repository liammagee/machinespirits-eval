import assert from 'node:assert/strict';
import test from 'node:test';

import { compileTutorStubTurnProgressionContract } from '../services/tutorStubTurnProgressionContract.js';
import {
  syntheticFallbackClosureTargets,
  verifyFallbackPassClosureContract,
} from '../scripts/verify-adaptive-warrant-fallback-pass-closure.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS,
  ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES,
} from '../services/adaptiveWarrantSemanticEvents.js';

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

test('fallback-pass closure v2 generates every ledger kind, label shape, and requested value type', () => {
  const targets = syntheticFallbackClosureTargets();
  const kinds = [...new Set(targets.map((row) => row.target.kind))].sort();
  const shapes = [...new Set(targets.flatMap((row) => row.labelShapes))].sort();
  const valueTypes = shapes
    .filter((shape) => shape.startsWith('requested_value_type:'))
    .map((shape) => shape.slice('requested_value_type:'.length))
    .sort();

  assert.deepEqual(kinds, [...ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS].sort());
  assert.deepEqual(valueTypes, [...ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES].sort());
  for (const shape of ['composite_terms', 'hyphenated_compound', 'writable_entry', 'generic_sentinel']) {
    assert.ok(shapes.includes(shape), shape);
  }

  for (const { id, target } of targets) {
    const result = verifyFallbackPassClosureContract({
      publicObligationDirective: {
        obligation_id: `synthetic-closure-${id}`,
        target,
        acceptable_outcomes: ['bounded_public_answer', 'named_unavailability_with_concrete_next_step'],
      },
      learnerText: target.source_surface,
    });
    assert.equal(result.compiledComplete, true, id);
    assert.equal(result.resolutionOk, true, `${id}: ${JSON.stringify(result.progressionIssues)}`);
    assert.equal(result.repetitionOk, true, `${id}: ${JSON.stringify(result.repetitionIssues)}`);
    assert.equal(result.finalResponseCheckOk, true, `${id}: ${JSON.stringify(result.hardIssues)}`);
  }

  const writable = targets.find((row) => row.id === 'writable-entry');
  const writableResult = verifyFallbackPassClosureContract({
    publicObligationDirective: {
      obligation_id: 'synthetic-closure-writable-entry',
      target: writable.target,
      acceptable_outcomes: ['bounded_public_answer', 'named_unavailability_with_concrete_next_step'],
    },
    learnerText: writable.target.source_surface,
  });
  assert.match(writableResult.fallbackText, /^The log entry is not public yet/iu);
  assert.doesNotMatch(writableResult.fallbackText, /first-log-entry-log entry/iu);
});
