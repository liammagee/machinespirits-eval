import assert from 'node:assert/strict';
import test from 'node:test';

import { projectTutorStubGuardedSpans } from '../services/tutorStubGuardSpanProjection.js';

test('guard span projection preserves literal matches, de-duplication, and ordering', () => {
  const text = 'Alpha clue. Beta clue. Alpha clue.';
  const issues = [
    { guard: 'z_guard', type: 'unsafe', reason: 'reason', matches: ['Alpha clue', 'Alpha clue'] },
    { guard: 'a_guard', type: 'unsafe', matches: ['Beta clue'] },
  ];

  assert.deepEqual(projectTutorStubGuardedSpans(text, issues), [
    {
      guard: 'z_guard',
      issueType: 'unsafe',
      reason: 'reason',
      start: 0,
      end: 10,
      text: 'Alpha clue',
      offsetEncoding: 'utf16_code_units',
      basis: 'literal_audit_match',
    },
    {
      guard: 'a_guard',
      issueType: 'unsafe',
      reason: null,
      start: 12,
      end: 21,
      text: 'Beta clue',
      offsetEncoding: 'utf16_code_units',
      basis: 'literal_audit_match',
    },
    {
      guard: 'z_guard',
      issueType: 'unsafe',
      reason: 'reason',
      start: 23,
      end: 33,
      text: 'Alpha clue',
      offsetEncoding: 'utf16_code_units',
      basis: 'literal_audit_match',
    },
  ]);
});

test('guard span projection preserves closure, insertion, and whole-candidate fallbacks', () => {
  const question = projectTutorStubGuardedSpans('Settled. What next?', [
    { guard: 'dialogue_closure', type: 'closure_response_opens_another_turn' },
  ]);
  assert.equal(question[0].basis, 'question_audit_match');
  assert.equal(question[0].text, 'What next?');

  const insertion = projectTutorStubGuardedSpans('Settled.', [
    { guard: 'dialogue_closure', type: 'missing_explicit_dialogue_close' },
  ]);
  assert.deepEqual(insertion[0], {
    guard: 'dialogue_closure',
    issueType: 'missing_explicit_dialogue_close',
    reason: null,
    start: 8,
    end: 8,
    text: '',
    offsetEncoding: 'utf16_code_units',
    basis: 'required_insertion_at_end',
  });

  const whole = projectTutorStubGuardedSpans('Candidate', [{ guard: 'leak', type: 'unknown_surface' }]);
  assert.equal(whole[0].basis, 'whole_candidate_audit_scope');
  assert.equal(whole[0].text, 'Candidate');
  assert.deepEqual(projectTutorStubGuardedSpans('Candidate', []), []);
});
