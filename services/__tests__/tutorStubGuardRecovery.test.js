import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseTutorStubGuardRecoveryCandidates,
  repairTutorStubThirdPersonSourceLeadIn,
  tutorStubGuardDeliveryDecision,
  tutorStubLearnerRequestedPlainStyle,
  tutorStubPlainRecoveryAllowsActorialAdvisory,
} from '../tutorStubGuardRecovery.js';

test('third-person authored-source casting is repaired without changing the quoted evidence', () => {
  const source =
    'The town assayer presses a hand to the seal: “I say Verrell alone draws the crucible.” What does that establish?';
  const repair = repairTutorStubThirdPersonSourceLeadIn({
    text: source,
    dramaticReleaseFrame: {
      entries: [{ mode: 'enacted_role', role: 'town assayer' }],
    },
    responseConfiguration: { actorial_host_part: 'examiner' },
  });

  assert.equal(repair.changed, true);
  assert.equal(
    repair.text,
    'I hold the evidence before us: “I say Verrell alone draws the crucible.” What does that establish?',
  );
  assert.match(repair.text, /“I say Verrell alone draws the crucible\.”/u);
  assert.doesNotMatch(repair.text, /town assayer/iu);
});

test('mechanical source repair leaves presented exhibits and unrelated prose untouched', () => {
  const source = 'The town assayer presses a hand to the seal, and the learner waits.';
  const repair = repairTutorStubThirdPersonSourceLeadIn({
    text: source,
    dramaticReleaseFrame: {
      entries: [{ mode: 'presented_exhibit', role: 'town assayer' }],
    },
  });

  assert.equal(repair.changed, false);
  assert.equal(repair.text, source);
});

test('paired recovery JSON yields independently auditable policy and plain candidates', () => {
  const parsed = parseTutorStubGuardRecoveryCandidates(`\`\`\`json
{"policy_repair":"I perform the selected part.","plain_recovery":"I will keep this direct."}
\`\`\``);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.parseMode, 'paired_json');
  assert.equal(parsed.policyRepair, 'I perform the selected part.');
  assert.equal(parsed.plainRecovery, 'I will keep this direct.');
});

test('legacy single repair output remains a policy candidate without inventing a fallback', () => {
  const parsed = parseTutorStubGuardRecoveryCandidates('A single repaired reply.');

  assert.equal(parsed.ok, false);
  assert.equal(parsed.parseMode, 'legacy_single_candidate');
  assert.equal(parsed.policyRepair, 'A single repaired reply.');
  assert.equal(parsed.plainRecovery, '');
});

test('plain-style repair is detected from both public wording and classifier meaning', () => {
  assert.equal(
    tutorStubLearnerRequestedPlainStyle('Drop the formality. Talk to me like an equal.'),
    true,
  );
  assert.equal(
    tutorStubLearnerRequestedPlainStyle("We don't live in a B-grade detective novel."),
    true,
  );
  assert.equal(
    tutorStubLearnerRequestedPlainStyle('Keep going.', {
      turn: {
        discourse_move: 'repair_request',
        summary: 'Requests direct, equal, non-theatrical conversation.',
        pedagogical_need: 'plain, peer-level language',
      },
    }),
    true,
  );
  assert.equal(tutorStubLearnerRequestedPlainStyle('What does the byline establish?'), false);
});

test('actorial realization can be advisory without weakening hard public-safety failures', () => {
  const issues = [
    { guard: 'actorial_realization', type: 'missing_selected_actorial_part' },
    { guard: 'leak', type: 'unreleased_premise_content' },
  ];
  const decision = tutorStubGuardDeliveryDecision(issues, { allowActorialAdvisory: true });

  assert.equal(decision.ok, false);
  assert.deepEqual(decision.advisoryIssues.map((issue) => issue.guard), ['actorial_realization']);
  assert.deepEqual(decision.hardIssues.map((issue) => issue.guard), ['leak']);

  const softOnly = tutorStubGuardDeliveryDecision(issues.slice(0, 1), { allowActorialAdvisory: true });
  assert.equal(softOnly.ok, true);
  assert.equal(softOnly.hardIssues.length, 0);
});

test('plain recovery keeps character strict in verification and advisory in collection', () => {
  assert.equal(tutorStubPlainRecoveryAllowsActorialAdvisory({ loopMode: 'strict' }), false);
  assert.equal(tutorStubPlainRecoveryAllowsActorialAdvisory({ loopMode: 'diagnostic' }), true);
  assert.equal(
    tutorStubPlainRecoveryAllowsActorialAdvisory({
      loopMode: 'strict',
      learnerRequestedPlainStyle: true,
    }),
    true,
  );
});
