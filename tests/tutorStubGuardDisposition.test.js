import assert from 'node:assert/strict';
import test from 'node:test';
import { decideTutorStubGuardDelivery } from '../services/tutorStubGuardDisposition.js';

const progressionIssue = {
  guard: 'live_turn_progression_v1',
  type: 'handoff_loses_turn_focus',
};
const leakIssue = { guard: 'leak', type: 'private_evidence_in_public_speech' };
const unknownGuardIssue = { guard: 'never_seen_guard', type: 'anything' };

test('conversational-integrity findings are hard on ordinary attempts', () => {
  const decision = decideTutorStubGuardDelivery([progressionIssue]);
  assert.equal(decision.ok, false);
  assert.equal(decision.hardIssues.length, 1);
});

test('terminal fallback delivers conversational-integrity findings as advisories', () => {
  const decision = decideTutorStubGuardDelivery([progressionIssue], { terminalFallback: true });
  assert.equal(decision.ok, true);
  assert.equal(decision.advisoryIssues.length, 1);
  assert.equal(decision.terminalFallback, true);
  const row = decision.dispositions[0];
  assert.equal(row.legacyOverride, 'terminal_fallback_conversational_advisory');
  assert.equal(row.category, 'conversational_integrity');
});

test('evidence boundaries stay hard on the terminal fallback', () => {
  const decision = decideTutorStubGuardDelivery([leakIssue], { terminalFallback: true });
  assert.equal(decision.ok, false);
  assert.equal(decision.hardIssues.length, 1);
});

test('unknown guards fail closed even on the terminal fallback', () => {
  const decision = decideTutorStubGuardDelivery([unknownGuardIssue], { terminalFallback: true });
  assert.equal(decision.ok, false);
});

test('novel types under a wildcarded conversational guard inherit its category and downgrade', () => {
  const decision = decideTutorStubGuardDelivery([{ guard: 'live_turn_progression_v1', type: 'future_finding' }], {
    terminalFallback: true,
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.advisoryIssues.length, 1);
});

test('mixed findings: fallback delivery blocked by the evidence issue alone', () => {
  const decision = decideTutorStubGuardDelivery([progressionIssue, leakIssue], { terminalFallback: true });
  assert.equal(decision.ok, false);
  assert.equal(decision.hardIssues.length, 1);
  assert.equal(decision.hardIssues[0].guard, 'leak');
  assert.equal(decision.advisoryIssues.length, 1);
  assert.equal(decision.advisoryIssues[0].guard, 'live_turn_progression_v1');
});
