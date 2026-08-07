// What the repair pass is told when a draft is stopped.
//
// The guard-validity judged pass found a repair that could not succeed. On the
// 44 Phase B turns where source alignment was the only objector, a repair
// attempt ran on all 44 and was told the complaint by name on 42 — and the
// fallback template still shipped every time. The reason is in the finding: it
// named the passage `source_1` and never carried the words. The tutor was being
// asked to quote something it could not see.
//
// These tests pin the words into the prompt. No model is called.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubRecoveryAccountingRuntime } from '../services/tutorStubRecoveryAccountingRuntime.js';
import { auditTutorStubLiveSourceActionAlignmentV1 } from '../services/tutorStubLiveFirstDraftAudit.js';
import { tutorStubGuardIssueRows, decideTutorStubGuardDelivery } from '../services/tutorStubGuardDisposition.js';

const PASSAGE =
  'The building notice records a mains-pressure test at 08:15. The kitchen mark appeared at 08:18, while the test was still holding the supply above its normal pressure.';

// tutorResponseRecoveryPrompt reaches none of the injected helpers, so the
// runtime can be built with stubs to test the prompt on its own.
const { tutorResponseRecoveryPrompt } = createTutorStubRecoveryAccountingRuntime({
  TUTOR_GUARD_ACCOUNTING_SCHEMA: 'test',
  appendTraceEvent: () => {},
  jsonClone: (value) => value,
  projectTutorStubGuardAttemptEnvelope: (value) => value,
  tutorStubGuardIssueRows,
});

// `surface` is the authored public wording and `text` is what must appear
// verbatim; the renderer rejects a source without a surface.
const contract = { evidence: { sources: [{ id: 'source_1', surface: PASSAGE, text: PASSAGE }] } };

/** Run the real audit over a draft, then take the findings the live policy treats as blocking. */
function blockingFindings(draftText) {
  const audit = auditTutorStubLiveSourceActionAlignmentV1({ text: draftText, firstDraftContract: contract });
  const rows = tutorStubGuardIssueRows({ liveSourceActionAlignmentAudit: audit });
  const decision = decideTutorStubGuardDelivery(rows, { boundaryPolicy: 'shadow_advisory' });
  return { audit, hardIssues: decision.hardIssues };
}

test('a draft that never said the source is handed the words, not just the label', () => {
  const draft = 'That is the right limit on what the split test shows. What does the timing support?';
  const { audit, hardIssues } = blockingFindings(draft);

  assert.equal(audit.ok, false);
  assert.deepEqual(
    hardIssues.map((issue) => issue.type),
    ['due_source_exact_occurrence_count'],
  );
  // The finding carries the passage itself. Without this the prompt below has
  // nothing to quote and the repair is asked for the impossible.
  assert.equal(hardIssues[0].expected_text, PASSAGE);

  const prompt = tutorResponseRecoveryPrompt({
    hardIssues,
    liveSourceActionAlignmentAudit: audit,
    minimalRecoveryPrompt: 'contract',
  });
  assert.ok(prompt.includes(PASSAGE), 'the repair prompt must contain the passage the draft has to say');
  assert.match(prompt, /must contain this passage once, word for word/u);
});

test('a draft that said the source once is not told to quote it again', () => {
  const draft = `I open the repair notebook. “${PASSAGE}” What does that timing support?`;
  const { audit, hardIssues } = blockingFindings(draft);

  assert.equal(audit.source_occurrences[0].observed_count, 1);
  assert.ok(
    !hardIssues.some((issue) => issue.type === 'due_source_exact_occurrence_count'),
    'the source is present, so the occurrence check has nothing to say',
  );

  const prompt = tutorResponseRecoveryPrompt({
    hardIssues,
    liveSourceActionAlignmentAudit: audit,
    minimalRecoveryPrompt: 'contract',
  });
  assert.doesNotMatch(prompt, /word for word/u);
});

test('an old trace whose finding predates the passage field gets no empty instruction', () => {
  const hardIssues = [
    {
      guard: 'live_source_action_alignment_v1',
      type: 'due_source_exact_occurrence_count',
      source: 'source_1',
      reason: 'the live response must contain the exact host-rendered source once',
    },
  ];
  const prompt = tutorResponseRecoveryPrompt({
    hardIssues,
    liveSourceActionAlignmentAudit: { issues: hardIssues },
    minimalRecoveryPrompt: 'contract',
  });
  assert.doesNotMatch(prompt, /word for word/u, 'better to say nothing than to ask for a quote of nothing');
  // The older carrier instruction still applies, so the repair is not left mute.
  assert.match(prompt, /public carrier in the host entrance/u);
});
