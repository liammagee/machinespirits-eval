import assert from 'node:assert/strict';
import test from 'node:test';

import { correctTutorStubResistanceRecoveryOffsetsV3 } from '../scripts/analyze-tutor-stub-resistance-recovery-offset-cleaning.js';

function record(span) {
  return {
    schema: 'record',
    case_id: 'case',
    provenance: { judge_id: 'judge' },
    judgment: {
      bounded_test_merits_engagement: 'yes',
      grounded_precise_jurisdictional_condition: 'no',
      delivered_clarify_distinction: 'no',
      delivered_register: 'plain',
      final_recovery: 'yes',
      evidence_spans: [span],
      confidence: 'high',
      indeterminacy_reason: 'none',
    },
  };
}

test('offset cleaning derives numeric positions from a unique exact quote and changes nothing else', () => {
  const original = record({
    field: 'bounded_test_merits_engagement',
    source_id: 'current_learner',
    start_utf16: 0,
    end_utf16: 3,
    text: 'bounded answer',
  });
  const before = structuredClone(original);
  const result = correctTutorStubResistanceRecoveryOffsetsV3({
    record: original,
    publicPacket: { current_learner: 'I give a bounded answer here.' },
  });

  assert.deepEqual(original, before, 'raw record must remain unchanged');
  assert.deepEqual(result.issues, []);
  assert.equal(result.corrections.length, 1);
  assert.equal(result.corrections[0].changed, true);
  assert.equal(result.record.judgment.evidence_spans[0].start_utf16, 9);
  assert.equal(result.record.judgment.evidence_spans[0].end_utf16, 23);
  const correctedWithoutOffsets = structuredClone(result.record);
  const originalWithoutOffsets = structuredClone(original);
  for (const value of [correctedWithoutOffsets, originalWithoutOffsets]) {
    delete value.judgment.evidence_spans[0].start_utf16;
    delete value.judgment.evidence_spans[0].end_utf16;
  }
  assert.deepEqual(correctedWithoutOffsets, originalWithoutOffsets);
});

test('offset cleaning fails closed when the quote is absent or repeated', () => {
  const absent = correctTutorStubResistanceRecoveryOffsetsV3({
    record: record({
      field: 'bounded_test_merits_engagement',
      source_id: 'current_learner',
      start_utf16: 1,
      end_utf16: 2,
      text: 'missing',
    }),
    publicPacket: { current_learner: 'bounded answer' },
  });
  assert.equal(absent.corrections.length, 0);
  assert.equal(absent.issues.length, 1);

  const repeated = correctTutorStubResistanceRecoveryOffsetsV3({
    record: record({
      field: 'bounded_test_merits_engagement',
      source_id: 'current_learner',
      start_utf16: 1,
      end_utf16: 2,
      text: 'same',
    }),
    publicPacket: { current_learner: 'same then same' },
  });
  assert.equal(repeated.corrections.length, 0);
  assert.equal(repeated.issues.length, 1);
});
