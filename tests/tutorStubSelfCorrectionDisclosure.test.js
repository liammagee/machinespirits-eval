import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyTutorStubGuardIssue, tutorStubGuardIssueRows } from '../services/tutorStubGuardDisposition.js';
import {
  auditTutorStubSelfCorrectionDisclosure,
  detectTutorStubSelfCorrectionDisclosure,
  tutorStubDisclosableGuardCorrection,
  tutorStubSelfCorrectionDisclosurePrompt,
} from '../services/tutorStubSelfCorrectionDisclosure.js';

const NEAR_MISS = 'Checking possible water sources moves us forward; I open the repair notebook at Sam’s shower.';

function uptakeFailureAudits() {
  return {
    liveTurnProgressionAudit: {
      ok: false,
      issues: [
        {
          type: 'learner_uptake_not_realized',
          reason: 'the uptake does not carry the learner’s own words',
        },
      ],
    },
  };
}

function attemptsWith(...texts) {
  return texts.map((text, index) => ({
    kind: index === 0 ? 'first_draft' : 'plain_recovery_candidate',
    attempt: index,
    candidate: { text },
    guardedSpans: [],
  }));
}

test('the pass fires exactly on findings the terminal fallback would waive', () => {
  const disclosable = tutorStubDisclosableGuardCorrection({
    audits: uptakeFailureAudits(),
    attempts: attemptsWith('A first draft.', NEAR_MISS),
  });
  assert.equal(disclosable.disclosable, true, JSON.stringify(disclosable));
  assert.equal(disclosable.findings.length, 1);
  assert.equal(disclosable.findings[0].type, 'learner_uptake_not_realized');
  assert.equal(disclosable.nearMiss.text, NEAR_MISS);
  assert.equal(disclosable.nearMiss.attempt, 1);
});

test('a finding that stays hard on the fallback does not open the pass', () => {
  const disclosable = tutorStubDisclosableGuardCorrection({
    audits: { leakAudit: { ok: false, leaks: [{ type: 'hidden_solution_disclosed' }] } },
    attempts: attemptsWith('A first draft.', NEAR_MISS),
  });
  assert.equal(disclosable.disclosable, false, JSON.stringify(disclosable));
  assert.equal(disclosable.reason, 'no_conversational_finding_would_be_waived_on_the_fallback');
});

test('a draft that also crossed an evidence boundary is not a disclosure case', () => {
  const disclosable = tutorStubDisclosableGuardCorrection({
    audits: {
      ...uptakeFailureAudits(),
      leakAudit: { ok: false, leaks: [{ type: 'hidden_solution_disclosed' }] },
    },
    attempts: attemptsWith('A first draft.', NEAR_MISS),
  });
  assert.equal(disclosable.disclosable, false, JSON.stringify(disclosable));
  assert.equal(disclosable.reason, 'a hard finding remains that the fallback would not waive');
});

test('a finding that already survived a re-draft does not open the pass', () => {
  // Riverside turn 5 of the 2026-07-28 showcase run: the first draft and the
  // plain recovery both lost the turn focus. The pass ran anyway, produced a
  // third draft that lost it again and dropped the actorial part and the uptake
  // as well, and the turn fell through to the fallback regardless.
  const disclosable = tutorStubDisclosableGuardCorrection({
    audits: uptakeFailureAudits(),
    attempts: [
      { kind: 'first_draft', attempt: 0, candidate: { text: 'A first draft.' }, audits: uptakeFailureAudits() },
      { kind: 'plain_recovery_candidate', attempt: 1, candidate: { text: NEAR_MISS }, audits: uptakeFailureAudits() },
    ],
  });
  assert.equal(disclosable.disclosable, false, JSON.stringify(disclosable));
  assert.equal(disclosable.reason, 'the finding already survived a re-draft');
  assert.deepEqual(disclosable.survivedFindings, ['learner_uptake_not_realized']);
});

test('a finding raised for the first time by the near miss still opens the pass', () => {
  // Campus turn 6: the first draft failed on clue release, the plain recovery
  // fixed that and re-questioned a settled point instead. That check has not
  // been put to the model yet, so the rung is worth its call.
  const disclosable = tutorStubDisclosableGuardCorrection({
    audits: uptakeFailureAudits(),
    attempts: [
      {
        kind: 'first_draft',
        attempt: 0,
        candidate: { text: 'A first draft.' },
        audits: { dramaticReleaseAudit: { ok: false, issues: [{ type: 'opaque_clue_release' }] } },
      },
      { kind: 'plain_recovery_candidate', attempt: 1, candidate: { text: NEAR_MISS }, audits: uptakeFailureAudits() },
    ],
  });
  assert.equal(disclosable.disclosable, true, JSON.stringify(disclosable));
  assert.deepEqual(disclosable.survivedFindings, []);
});

test('there is nothing to disclose without a draft the tutor actually produced', () => {
  const disclosable = tutorStubDisclosableGuardCorrection({
    audits: uptakeFailureAudits(),
    attempts: attemptsWith('', '   '),
  });
  assert.equal(disclosable.disclosable, false);
  assert.equal(disclosable.reason, 'no_prior_attempt_text_to_disclose');
});

test('the brief invites the disclosure without supplying a phrase to copy', () => {
  const prompt = tutorStubSelfCorrectionDisclosurePrompt({
    correction: tutorStubDisclosableGuardCorrection({
      audits: uptakeFailureAudits(),
      attempts: attemptsWith('A first draft.', NEAR_MISS),
    }),
    learnerText: 'check for sources of water',
    turnProgressionContract: { learner_uptake: { learner_surface: 'check for sources of water' } },
  });

  assert.match(prompt, /check for sources of water/u);
  assert.match(prompt, /repair notebook/u);
  assert.match(prompt, /may say so/u);
  assert.match(prompt, /neither is required/u);
  // If the brief contained a marker the detector recognises, the model would be
  // copying wording rather than choosing to correct itself, and the outcome
  // label would be measuring the prompt.
  assert.equal(detectTutorStubSelfCorrectionDisclosure(prompt).disclosed, false);
});

test('the brief is empty when the turn is not disclosable', () => {
  assert.equal(tutorStubSelfCorrectionDisclosurePrompt({ correction: { disclosable: false } }), '');
});

test('a disclosure quoting a line the tutor never drafted is rejected', () => {
  const audit = auditTutorStubSelfCorrectionDisclosure({
    text: 'I was about to say “the shower drain was replaced last spring”, but that is not what you asked. Water sources first: I open the repair notebook.',
    priorAttemptTexts: ['A first draft.', NEAR_MISS],
  });
  assert.equal(audit.ok, false);
  assert.equal(audit.disclosed, true);
  assert.deepEqual(
    audit.issues.map((issue) => issue.type),
    ['fabricated_self_correction_quote'],
  );
});

test('a disclosure quoting a line the tutor did draft is accepted', () => {
  const audit = auditTutorStubSelfCorrectionDisclosure({
    text: 'I was about to say “I open the repair notebook at Sam’s shower”, and that skips your question. Sources of water first — where does this room get its water?',
    priorAttemptTexts: ['A first draft.', NEAR_MISS],
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.equal(audit.disclosed, true);
  assert.equal(audit.claimedNearMissQuotes.length, 1);
});

test('ordinary in-scene quotation is not read as a claim about the discarded draft', () => {
  // Quotation marks carry the learner's own words, Write entries and released
  // evidence throughout this harness. Only a quote inside the correcting
  // sentence is a claim about what the tutor was going to say.
  const audit = auditTutorStubSelfCorrectionDisclosure({
    text: 'I nearly answered a different question. Your point about “sources of water” is the one to take up. “I open the repair notebook at the shower entry.” What does that let us carry forward?',
    priorAttemptTexts: ['A first draft.', NEAR_MISS],
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.equal(audit.disclosed, true);
  assert.deepEqual(audit.claimedNearMissQuotes, []);
});

test('an unquoted self-correction in the tutor’s own words is accepted', () => {
  const audit = auditTutorStubSelfCorrectionDisclosure({
    text: 'I nearly answered a different question. You said sources of water, so that is where we start.',
    priorAttemptTexts: ['A first draft.', NEAR_MISS],
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.equal(audit.disclosed, true);
});

test('a disclosure that names the apparatus is rejected', () => {
  const audit = auditTutorStubSelfCorrectionDisclosure({
    text: 'I was about to say something about the shower, but my first draft was rejected by the guard. Sources of water, then.',
    priorAttemptTexts: ['A first draft.', NEAR_MISS],
  });
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'harness_machinery_in_public_speech'));
});

test('a plain answer with no disclosure at all is an equally clean outcome', () => {
  const audit = auditTutorStubSelfCorrectionDisclosure({
    text: 'Sources of water is the right place to start. Where does this room get its water?',
    priorAttemptTexts: ['A first draft.', NEAR_MISS],
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.equal(audit.disclosed, false);
  assert.equal(audit.marker, null);
});

test('disclosure findings are hard everywhere, including on the terminal fallback', () => {
  const rows = tutorStubGuardIssueRows({
    selfCorrectionDisclosureAudit: auditTutorStubSelfCorrectionDisclosure({
      text: 'I was about to say “a line I never wrote”, but no.',
      priorAttemptTexts: [NEAR_MISS],
    }),
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].guard, 'self_correction_disclosure');
  assert.equal(rows[0].type, 'fabricated_self_correction_quote');

  for (const options of [{}, { terminalFallback: true }, { terminalFallback: true, allowActorialAdvisory: true }]) {
    const disposition = classifyTutorStubGuardIssue(rows[0], options);
    assert.equal(disposition.strictDisposition, 'hard', JSON.stringify({ options, disposition }));
    assert.equal(disposition.shadowDisposition, 'hard');
    assert.equal(disposition.legacyOverride, null);
  }
});

test('a clean disclosure audit contributes no rows', () => {
  const rows = tutorStubGuardIssueRows({
    selfCorrectionDisclosureAudit: auditTutorStubSelfCorrectionDisclosure({
      text: 'Sources of water it is.',
      priorAttemptTexts: [NEAR_MISS],
    }),
  });
  assert.deepEqual(rows, []);
});
