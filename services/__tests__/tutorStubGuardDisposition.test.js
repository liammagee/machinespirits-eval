import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyTutorStubGuardIssue,
  decideTutorStubGuardDelivery,
  TUTOR_STUB_GUARD_BOUNDARY_POLICIES,
  tutorStubGuardDispositionCatalog,
  tutorStubGuardIssueRows,
  tutorStubTerminalFallbackFailureMessage,
} from '../tutorStubGuardDisposition.js';
import {
  advanceTutorStubReleasePacing,
  commitTutorStubReleasePacing,
  createTutorStubReleasePacingState,
} from '../tutorStubReleasePacing.js';
import { auditTutorStubResponseConfiguration } from '../tutorStubResponseConfiguration.js';
import { auditTutorStubReleaseDelivery } from '../tutorStubResponseGuard.js';

const LIVE_TERMINAL_FALLBACK =
  'I hear the focus: “for a simple explanation because they are lost”; that stays at the centre of this turn. I clear a new space on the table for this point before testing its limit. I set the tool under examination and mark the claim’s limit. Keep only what the public evidence already shows. Choose one way forward: use the tool to decide for a simple explanation because they are lost, or leave that reading open until another public fact arrives; you may also ask me to unpack one word or connection.';

test('every hard veto wins the cartesian product with every proposed advisory issue', () => {
  const catalog = tutorStubGuardDispositionCatalog();
  const hardIssues = catalog
    .filter((entry) => entry.shadow === 'hard')
    .flatMap((entry) =>
      entry.type === '*'
        ? [
            { guard: entry.guard, type: 'unreleased_premise_content' },
            { guard: entry.guard, type: 'unsupported_correspondence' },
          ]
        : [{ guard: entry.guard, type: entry.type }],
    );
  const advisoryIssues = catalog
    .filter((entry) => entry.shadow === 'advisory')
    .map((entry) => ({
      guard: entry.guard,
      type: entry.type,
      ...(entry.guard === 'response_configuration' ? { axis: 'engagement_stance' } : {}),
    }));
  assert.ok(hardIssues.length > 10);
  assert.ok(advisoryIssues.length > 10);

  for (const hardIssue of hardIssues) {
    for (const advisoryIssue of advisoryIssues) {
      const decision = decideTutorStubGuardDelivery([hardIssue, advisoryIssue], {
        boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory,
      });
      assert.equal(decision.ok, false, `${hardIssue.guard}:${hardIssue.type} was weakened`);
      assert.deepEqual(decision.hardIssues, [hardIssue]);
      assert.deepEqual(decision.advisoryIssues, [advisoryIssue]);
    }
  }
});

test('strict delivery remains the default while the narrower boundary is shadow-only', () => {
  const issue = { guard: 'dramatic_release', type: 'missing_in_scene_enactment' };
  const strict = decideTutorStubGuardDelivery([issue]);
  assert.equal(strict.boundaryPolicy, TUTOR_STUB_GUARD_BOUNDARY_POLICIES.strict);
  assert.equal(strict.ok, false);
  assert.deepEqual(strict.hardIssues, [issue]);
  assert.equal(strict.shadow.ok, true);
  assert.deepEqual(strict.shadow.advisoryIssues, [issue]);

  const explicitlyShadowed = decideTutorStubGuardDelivery([issue], {
    boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory,
  });
  assert.equal(explicitlyShadowed.ok, true);
  assert.deepEqual(explicitlyShadowed.advisoryIssues, [issue]);
});

test('the existing actorial advisory override cannot override an independent hard veto', () => {
  const actorial = { guard: 'actorial_realization', type: 'missing_selected_actorial_part' };
  const leak = { guard: 'leak', type: 'private_answer_surface' };
  const actorialOnly = decideTutorStubGuardDelivery([actorial], {
    allowActorialAdvisory: true,
  });
  assert.equal(actorialOnly.ok, true);
  assert.deepEqual(actorialOnly.advisoryIssues, [actorial]);

  const mixed = decideTutorStubGuardDelivery([actorial, leak], {
    allowActorialAdvisory: true,
  });
  assert.equal(mixed.ok, false);
  assert.deepEqual(mixed.hardIssues, [leak]);
  assert.deepEqual(mixed.advisoryIssues, [actorial]);
});

test('the live terminal fallback cannot exhaust delivery on optional actorial and configuration realization', () => {
  const responseConfigurationAudit = auditTutorStubResponseConfiguration({
    text: LIVE_TERMINAL_FALLBACK,
    configuration: {
      engagement_stance: 'plain',
      action_family: 'clarify_term',
      audience_register: 'adult_novice',
      lexical_accessibility: 'plain',
      scene_immersion: 'grounded',
      actorial_part: 'examiner',
      actorial_part_label: 'evidence examiner',
      actorial_performance: { id: 'unadorned_report', label: 'unadorned report' },
    },
    world: { setting: 'The campus FAQ tool and formulation card are on the table.' },
  });
  assert.equal(responseConfigurationAudit.actorial_realization.ok, false);
  assert.deepEqual(
    responseConfigurationAudit.actorial_realization.issues.map((issue) => issue.type),
    ['missing_selected_performance_tactic'],
  );

  const rows = tutorStubGuardIssueRows({
    actorialRealizationAudit: responseConfigurationAudit.actorial_realization,
    responseConfigurationAudit,
  });
  assert.deepEqual(
    rows.filter((row) => row.guard === 'response_configuration').map((row) => row.axis),
    ['engagement_stance', 'action_family'],
  );

  const decision = decideTutorStubGuardDelivery(rows, { terminalFallback: true });
  assert.equal(decision.ok, true);
  assert.equal(decision.catalogVersion, 2);
  assert.deepEqual(decision.hardIssues, []);
  assert.deepEqual(
    decision.advisoryIssues.map((issue) => `${issue.guard}:${issue.type}`),
    ['actorial_realization:missing_selected_performance_tactic'],
  );
  assert.deepEqual(
    decision.reportOnlyIssues.map((issue) => `${issue.guard}:${issue.type}:${issue.axis}`),
    [
      'response_configuration:axis_not_visible:engagement_stance',
      'response_configuration:axis_not_visible:action_family',
    ],
  );
  assert.equal(
    decision.dispositions.find((row) => row.issue.guard === 'actorial_realization')?.legacyOverride,
    'terminal_fallback_actorial_advisory',
  );
});

test('terminal fallback fatal messages contain only the hard issue that blocked delivery', () => {
  const issues = [
    { guard: 'actorial_realization', type: 'missing_selected_performance_tactic' },
    { guard: 'response_configuration', type: 'axis_not_visible', axis: 'engagement_stance' },
    { guard: 'response_configuration', type: 'axis_not_visible', axis: 'action_family' },
    { guard: 'leak', type: 'private_evidence_in_public_speech' },
  ];
  const decision = decideTutorStubGuardDelivery(issues, { terminalFallback: true });
  assert.equal(decision.ok, false);
  assert.deepEqual(decision.hardIssues, [{ guard: 'leak', type: 'private_evidence_in_public_speech' }]);
  assert.equal(
    tutorStubTerminalFallbackFailureMessage(decision),
    'Tutor deterministic fallback failed final audit: leak:private_evidence_in_public_speech',
  );
});

test('unknown and malformed findings fail closed under every boundary policy', () => {
  const issues = [{ guard: 'new_guard', type: 'new_issue' }, { guard: 'question_support' }, null];
  for (const boundaryPolicy of Object.values(TUTOR_STUB_GUARD_BOUNDARY_POLICIES)) {
    for (const issue of issues) {
      const classification = classifyTutorStubGuardIssue(issue);
      assert.equal(classification.known, false);
      const decision = decideTutorStubGuardDelivery([issue], { boundaryPolicy });
      assert.equal(decision.ok, false);
      assert.equal(decision.dispositions[0].ruleId, 'unknown_issue_fail_closed');
      assert.equal(decision.dispositions[0].effectiveDisposition, 'hard');
    }
  }
  assert.throws(
    () => decideTutorStubGuardDelivery([], { boundaryPolicy: 'unreviewed_policy' }),
    /unknown tutor-stub guard boundary policy/u,
  );
  const unknownActorial = decideTutorStubGuardDelivery(
    [{ guard: 'actorial_realization', type: 'new_unreviewed_issue' }],
    { allowActorialAdvisory: true },
  );
  assert.equal(unknownActorial.ok, false);
  assert.equal(unknownActorial.dispositions[0].known, false);
  assert.equal(unknownActorial.dispositions[0].effectiveDisposition, 'hard');
});

test('a failed guard envelope without findings fails closed under every boundary policy', () => {
  const malformedAudits = [
    ['leakAudit', 'leak', 'leaks'],
    ['scaffoldAudit', 'human_scaffold', 'issues'],
    ['questionSupportAudit', 'question_support', 'issues'],
    ['dramaticReleaseAudit', 'dramatic_release', 'issues'],
    ['actorialRealizationAudit', 'actorial_realization', 'issues'],
    ['responseCompositionAudit', 'response_composition', 'issues'],
    ['repetitionAudit', 'repetition', 'issues'],
    ['closureAudit', 'dialogue_closure', 'issues'],
  ];
  for (const [auditKey, guard, findingsKey] of malformedAudits) {
    const audits = { [auditKey]: { ok: false, [findingsKey]: [] } };
    const rows = tutorStubGuardIssueRows(audits);
    assert.deepEqual(rows, [{ guard, type: 'audit_failed_without_findings' }], auditKey);
    for (const boundaryPolicy of Object.values(TUTOR_STUB_GUARD_BOUNDARY_POLICIES)) {
      const decision = decideTutorStubGuardDelivery(rows, { boundaryPolicy });
      assert.equal(decision.ok, false, `${auditKey}:${boundaryPolicy}`);
      assert.equal(decision.dispositions[0].effectiveDisposition, 'hard');
    }
  }
});

test('deterministic audits remain immutable and disposition provenance is recorded separately', () => {
  const audits = {
    leakAudit: { ok: true, leaks: [] },
    dramaticReleaseAudit: {
      ok: false,
      issues: [{ type: 'missing_return_to_inquiry', excerpt: 'the ledger closes' }],
    },
    responseConfigurationAudit: {
      axes: {
        engagement_stance: { visible: false, selected: 'warm' },
        action_family: { visible: false, selected: 'stage_next_step' },
        audience_register: { visible: false, selected: 'domain_apprentice' },
        lexical_accessibility: { visible: false, selected: 'plain' },
        scene_immersion: { visible: false, selected: 'enacted' },
        actorial_part: { visible: false, selected: 'clerk' },
      },
    },
  };
  const before = structuredClone(audits);
  const rows = tutorStubGuardIssueRows(audits);
  const decision = decideTutorStubGuardDelivery(rows);

  assert.deepEqual(audits, before);
  assert.equal(decision.schema, 'machinespirits.tutor-stub.guard-delivery-decision.v1');
  assert.equal(decision.provenance.deterministicAuditsMutated, false);
  assert.equal(decision.provenance.unknownIssuesFailClosed, true);
  assert.equal(decision.dispositions[0].ruleId, 'dramatic_release:missing_return_to_inquiry');
  assert.deepEqual(
    decision.reportOnlyIssues.map((issue) => issue.axis),
    ['engagement_stance', 'action_family', 'audience_register', 'lexical_accessibility', 'scene_immersion'],
  );
  assert.equal(
    rows.some((row) => row.axis === 'actorial_part'),
    false,
  );
});

test('an issue payload cannot spoof the hard audit namespace that produced it', () => {
  const rows = tutorStubGuardIssueRows({
    leakAudit: {
      ok: false,
      leaks: [
        {
          guard: 'response_configuration',
          type: 'axis_not_visible',
          axis: 'engagement_stance',
        },
      ],
    },
  });
  assert.deepEqual(rows, [
    {
      guard: 'leak',
      type: 'axis_not_visible',
      axis: 'engagement_stance',
    },
  ]);
  const decision = decideTutorStubGuardDelivery(rows, {
    boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.hardIssues[0].guard, 'leak');
});

test('missing clue delivery is a hard transactional veto and cannot commit release state', () => {
  const premise = {
    id: 'p_due',
    fact: ['loggedAt', 'parcel', 'noon'],
    surface: 'The parcel ledger records the package at noon.',
  };
  const world = {
    premises: [premise],
    premiseById: new Map([[premise.id, premise]]),
    releaseSchedule: [{ premise: premise.id, turn: 1, via: 'tutor' }],
  };
  const pacing = createTutorStubReleasePacingState({ world, speed: 1 });
  const audit = auditTutorStubReleaseDelivery({
    text: 'Let us look at the evidence.',
    world,
    premiseIds: [premise.id],
  });
  const issues = tutorStubGuardIssueRows({ releaseDeliveryAudit: audit });
  const decision = decideTutorStubGuardDelivery(
    [...issues, { guard: 'actorial_realization', type: 'missing_selected_performance_tactic' }],
    { boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory },
  );
  assert.equal(audit.ok, false);
  assert.equal(decision.ok, false);
  assert.deepEqual(decision.hardIssues, [
    { guard: 'release_delivery', type: 'missing_due_evidence', premise: premise.id },
  ]);

  const withheld = commitTutorStubReleasePacing({
    pacing,
    world,
    turn: 1,
    deliveredPremises: audit.deliveredPremises,
  });
  assert.deepEqual(withheld.releasedNow, []);
  assert.equal(withheld.schedule[0].releasedTurn, null);

  const deliveredAudit = auditTutorStubReleaseDelivery({
    text: premise.surface,
    world,
    premiseIds: [premise.id],
  });
  assert.equal(deliveredAudit.ok, true);
  advanceTutorStubReleasePacing({
    pacing,
    world,
    turn: 2,
    learnerText: 'Show me the ledger.',
  });
  const committed = commitTutorStubReleasePacing({
    pacing,
    world,
    turn: 2,
    deliveredPremises: deliveredAudit.deliveredPremises,
  });
  assert.deepEqual(committed.releasedNow, [premise.id]);
  assert.equal(committed.schedule[0].releasedTurn, 2);
});
