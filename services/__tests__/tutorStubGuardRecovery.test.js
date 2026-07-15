import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeTutorStubGuardUptakeDevelopment,
  parseTutorStubGuardRecoveryCandidates,
  repairTutorStubMissingClarificationInvitation,
  repairTutorStubThirdPersonSourceLeadIn,
  tutorStubGuardDeliveryDecision,
  tutorStubActorialPerformanceMayBeAdvisory,
  tutorStubLearnerRequestedPlainStyle,
  tutorStubPlainRecoveryAllowsActorialAdvisory,
  tutorStubPolicyRecoveryAllowsPerformanceAdvisory,
} from '../tutorStubGuardRecovery.js';

test('guard uptake recomposition removes overlapping recovery acknowledgements', () => {
  const text = composeTutorStubGuardUptakeDevelopment({
    uptake:
      'I run my finger beneath the ledger’s marks: enter it. The voices show varied performance, but not yet adaptation.',
    development:
      'I press my finger beside the ledger’s changing voices: yes, enter that. It proves varied conduct, but not yet adaptation. Turn now to the hall trial.',
  });

  assert.equal(
    text,
    'I run my finger beneath the ledger’s marks: enter it. The voices show varied performance, but not yet adaptation. Turn now to the hall trial.',
  );
  assert.equal((text.match(/not yet adaptation/gu) || []).length, 1);
});

test('guard uptake recomposition preserves an overlapping sentence that carries the host action', () => {
  const text = composeTutorStubGuardUptakeDevelopment({
    uptake: 'Aye—the burin fixes the notched die to Edony.',
    development:
      'I hold the notched R beside the estate inventory and trace the square bite with my needle: Edony kept the sprung-heel burin, so she cut this die. The weir-forge dross places the blanks with her.',
  });

  assert.match(text, /I hold the notched R beside the estate inventory/iu);
  assert.match(text, /trace the square bite/iu);
  assert.match(text, /weir-forge dross places the blanks with her/iu);
});

test('clarification repair applies only when that affordance is the sole hard failure', () => {
  const repaired = repairTutorStubMissingClarificationInvitation({
    text: 'I set the slate between us. Does that distinction fit?',
    deliveryDecision: {
      hardIssues: [
        { guard: 'question_support', type: 'missing_clarification_invitation' },
      ],
    },
  });
  assert.equal(repaired.changed, true);
  assert.match(repaired.text, /ask me to unpack any word or connection/iu);

  const unsafe = repairTutorStubMissingClarificationInvitation({
    text: 'A contaminated reply.',
    deliveryDecision: {
      hardIssues: [
        { guard: 'question_support', type: 'missing_clarification_invitation' },
        { guard: 'leak', type: 'unreleased_premise_content' },
      ],
    },
  });
  assert.equal(unsafe.changed, false);
});

test('clarification repair does not duplicate an ordinary-language invitation', () => {
  const source = 'If any word or link needs opening, ask me plainly.';
  const repaired = repairTutorStubMissingClarificationInvitation({
    text: source,
    deliveryDecision: {
      hardIssues: [{ guard: 'question_support', type: 'missing_clarification_invitation' }],
    },
  });

  assert.equal(repaired.changed, false);
  assert.equal(repaired.text, source);
});

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

test('source repair matches the stable role when authoring adds a descriptive activity', () => {
  const repair = repairTutorStubThirdPersonSourceLeadIn({
    text:
      'The building manager reads the notice: “I posted this Monday: Wrenfold may clear appliances.” What changes?',
    dramaticReleaseFrame: {
      entries: [{ mode: 'enacted_role', role: 'building manager reading the lift notice' }],
    },
    responseConfiguration: { actorial_host_part: 'record_keeper' },
  });

  assert.equal(repair.changed, true);
  assert.match(repair.text, /^I mark the evidence in the open record:/u);
  assert.match(repair.text, /“I posted this Monday: Wrenfold may clear appliances\.”/u);
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

test('policy recovery may miss only the optional tactic after visibly performing its host part', () => {
  assert.equal(
    tutorStubActorialPerformanceMayBeAdvisory({
      issues: [{ type: 'missing_selected_performance_tactic' }],
    }),
    true,
  );
  assert.equal(
    tutorStubPolicyRecoveryAllowsPerformanceAdvisory({
      issues: [{ type: 'missing_selected_performance_tactic' }],
    }),
    true,
  );
  assert.equal(
    tutorStubPolicyRecoveryAllowsPerformanceAdvisory({
      issues: [
        { type: 'missing_selected_actorial_part' },
        { type: 'missing_selected_performance_tactic' },
      ],
    }),
    false,
  );
  assert.equal(tutorStubPolicyRecoveryAllowsPerformanceAdvisory({ issues: [] }), false);
});
