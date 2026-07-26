import assert from 'node:assert/strict';
import test from 'node:test';
import { decideTutorStubGuardDelivery } from '../services/tutorStubGuardDisposition.js';

const progressionIssue = {
  guard: 'live_turn_progression_v1',
  type: 'handoff_loses_turn_focus',
};
const actorialIssue = {
  guard: 'actorial_realization',
  type: 'missing_selected_performance_tactic',
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

test('terminal fallback delivers optional actorial-realization findings as advisories', () => {
  const decision = decideTutorStubGuardDelivery([actorialIssue], { terminalFallback: true });
  assert.equal(decision.ok, true);
  assert.deepEqual(decision.hardIssues, []);
  assert.deepEqual(decision.advisoryIssues, [actorialIssue]);
  assert.equal(decision.dispositions[0].legacyOverride, 'terminal_fallback_actorial_advisory');
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

test('terminal fallback delivers dramatic-form findings as advisories', () => {
  // Two free-running showcase dialogues died here: every candidate rejected,
  // the deterministic fallback included, so the tutor reached a turn with
  // nothing it was permitted to say and the process exited mid-dialogue. The
  // fallback is fixed harness text around per-world clue prose — whether the
  // clue arrives with a visible entrance or exhibit action is decided by the
  // authored clue, not by anything the last resort can add.
  for (const type of [
    'opaque_clue_release',
    'missing_exhibit_action',
    'missing_in_scene_enactment',
    'meta_dramatic_announcement',
    'role_label_stage_direction',
    'missing_return_to_inquiry',
  ]) {
    const decision = decideTutorStubGuardDelivery([{ guard: 'dramatic_release', type }], { terminalFallback: true });
    assert.equal(decision.ok, true, type);
    assert.deepEqual(decision.hardIssues, [], type);
    assert.equal(decision.dispositions[0].legacyOverride, 'terminal_fallback_dramatic_form_advisory', type);
  }
});

test('dramatic-form findings stay hard on ordinary attempts', () => {
  // The accommodation is for the last resort only. An ordinary draft that
  // states a clue opaquely still gets sent back to be regenerated.
  const decision = decideTutorStubGuardDelivery([{ guard: 'dramatic_release', type: 'opaque_clue_release' }]);
  assert.equal(decision.ok, false);
  assert.equal(decision.hardIssues.length, 1);
});

test('clue-transaction and source-perspective findings stay hard on the terminal fallback', () => {
  // These live under the same guard as the form findings above but are about
  // public state, not dramatic treatment: delivering a released clue twice, or
  // letting the speaker inherit another actor's deed. Requiring the shadow
  // column to already read advisory is what keeps them fatal.
  for (const type of ['duplicate_clue_delivery', 'source_perspective_drift']) {
    const decision = decideTutorStubGuardDelivery([{ guard: 'dramatic_release', type }], { terminalFallback: true });
    assert.equal(decision.ok, false, type);
    assert.equal(decision.hardIssues.length, 1, type);
    assert.equal(decision.dispositions[0].legacyOverride, null, type);
  }
});

test('due-source alignment stays hard on the terminal fallback', () => {
  // Same `dramatic_realization` category as the downgraded form findings, but
  // hard in both columns: it checks that each exact due source appears with its
  // carrier, which is content delivery rather than treatment.
  const decision = decideTutorStubGuardDelivery(
    [{ guard: 'live_source_action_alignment_v1', type: 'missing_pre_source_carrier' }],
    { terminalFallback: true },
  );
  assert.equal(decision.ok, false);
  assert.equal(decision.hardIssues.length, 1);
});

test('mixed findings: fallback delivery blocked by the evidence issue alone', () => {
  const decision = decideTutorStubGuardDelivery([progressionIssue, actorialIssue, leakIssue], {
    terminalFallback: true,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.hardIssues.length, 1);
  assert.equal(decision.hardIssues[0].guard, 'leak');
  assert.deepEqual(
    decision.advisoryIssues.map((issue) => issue.guard),
    ['live_turn_progression_v1', 'actorial_realization'],
  );
});
