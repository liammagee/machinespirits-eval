export const TUTOR_STUB_GUARD_DISPOSITION_SCHEMA = 'machinespirits.tutor-stub.guard-disposition.v1';
export const TUTOR_STUB_GUARD_DISPOSITION_CATALOG_VERSION = 2;

export const TUTOR_STUB_GUARD_BOUNDARY_POLICIES = Object.freeze({
  strict: 'strict',
  shadowAdvisory: 'shadow_advisory',
});

const HARD = 'hard';
const ADVISORY = 'advisory';
const REPORT_ONLY = 'report_only';

const HARD_IN_BOTH = Object.freeze({ strict: HARD, shadow: HARD });
const STRICT_HARD_SHADOW_ADVISORY = Object.freeze({ strict: HARD, shadow: ADVISORY });
const REPORT_IN_STRICT_SHADOW_ADVISORY = Object.freeze({ strict: REPORT_ONLY, shadow: ADVISORY });

function rule({ guard, type, dispositions = HARD_IN_BOTH, category, rationale }) {
  return Object.freeze({
    id: `${guard}:${type}`,
    guard,
    type,
    strict: dispositions.strict,
    shadow: dispositions.shadow,
    category,
    rationale,
  });
}

/**
 * Issue-level boundary catalog. The strict column is the current delivery
 * contract. The shadow column records the proposed narrower boundary without
 * changing what is delivered. Unknown issue types always fail closed.
 */
const RULES = Object.freeze([
  // Evidence and private-state boundaries are never advisory.
  rule({
    guard: 'leak',
    type: '*',
    category: 'public_evidence_integrity',
    rationale: 'Private, future, unsupported, or concealed evidence cannot enter public speech.',
  }),
  rule({
    guard: 'release_delivery',
    type: 'missing_due_evidence',
    category: 'clue_transaction_integrity',
    rationale: 'A due clue must be present before its release transaction can commit.',
  }),
  rule({
    guard: 'live_turn_progression_v1',
    type: '*',
    category: 'conversational_integrity',
    rationale:
      'The plain live response must answer the learner, respect terminal question ownership, and keep its typed public focus.',
  }),
  rule({
    guard: 'live_source_action_alignment_v1',
    type: '*',
    category: 'dramatic_realization',
    rationale:
      'Each exact due source must appear once, with its pre-source carrier and any opt-in post-source accessibility sentence visible at their typed live boundaries.',
  }),
  rule({
    guard: 'release_delivery',
    type: 'release_delivery_audit_failed',
    category: 'clue_transaction_integrity',
    rationale: 'An unexplained failed release audit must fail closed.',
  }),
  rule({
    guard: 'dramatic_release',
    type: 'duplicate_clue_delivery',
    category: 'clue_transaction_integrity',
    rationale: 'A newly released clue may be delivered only once in its release turn.',
  }),
  rule({
    guard: 'dramatic_release',
    type: 'source_perspective_drift',
    category: 'public_evidence_integrity',
    rationale: "The speaking source may not inherit another public actor's deed, custody, or possession.",
  }),

  // Questions and composition failures that change public meaning remain hard.
  rule({
    guard: 'question_support',
    type: 'abstract_proof_language',
    category: 'conversational_integrity',
    rationale: 'Private proof machinery must not replace public people, objects, or records.',
  }),
  rule({
    guard: 'question_support',
    type: 'missing_direct_response',
    category: 'conversational_integrity',
    rationale: 'An explicitly outstanding learner question must be answered before development.',
  }),
  rule({
    guard: 'question_support',
    type: 'unanswerable_open_recall',
    category: 'conversational_integrity',
    rationale: 'The tutor may not ask the learner to invent unstaged information.',
  }),
  rule({
    guard: 'human_scaffold',
    type: 'redundant_local_requestion',
    category: 'conversational_integrity',
    rationale: 'A locally resolved public question must not be demanded again.',
  }),
  ...[
    'proposed_move_misread_as_completed',
    'conditional_answer_misread_as_present_claim',
    'learner_selected_test_not_acknowledged',
    'missing_tutor_development',
    'resolved_point_reopened',
    'unsupported_endorsement_request',
  ].map((type) =>
    rule({
      guard: 'response_composition',
      type,
      category: 'conversational_integrity',
      rationale: 'The response must preserve the learner move and advance only licensed public work.',
    }),
  ),
  ...['repeated_tutor_sentence', 'repeated_tutor_response', 'repeated_tutor_opening'].map((type) =>
    rule({
      guard: 'repetition',
      type,
      category: 'conversational_integrity',
      rationale: 'Material tutor repetition must not trap the learner in a repeated exchange.',
    }),
  ),
  ...[
    'missing_explicit_dialogue_close',
    'closure_response_opens_another_turn',
    'multiple_closure_questions',
    'closure_reopens_proof_work',
  ].map((type) =>
    rule({
      guard: 'dialogue_closure',
      type,
      category: 'semantic_closure_integrity',
      rationale: 'A mandatory terminal act must close semantically and must not reopen proof work.',
    }),
  ),

  // These remain strict today, but are separately visible in the proposed
  // shadow policy because they concern realization or optional support rather
  // than public-state integrity.
  ...['missing_bounded_choice', 'missing_clarification_invitation'].map((type) =>
    rule({
      guard: 'question_support',
      type,
      dispositions: STRICT_HARD_SHADOW_ADVISORY,
      category: 'pedagogical_support',
      rationale: 'The support affordance is useful but does not itself establish public correctness.',
    }),
  ),
  ...[
    'meta_dramatic_announcement',
    'role_label_stage_direction',
    'opaque_clue_release',
    'missing_in_scene_enactment',
    'missing_exhibit_action',
    'missing_return_to_inquiry',
  ].map((type) =>
    rule({
      guard: 'dramatic_release',
      type,
      dispositions: STRICT_HARD_SHADOW_ADVISORY,
      category: 'dramatic_realization',
      rationale:
        'The clue form may miss the selected dramatic treatment while content delivery remains separately audited.',
    }),
  ),
  ...['missing_selected_actorial_part', 'missing_selected_performance_tactic'].map((type) =>
    rule({
      guard: 'actorial_realization',
      type,
      dispositions: STRICT_HARD_SHADOW_ADVISORY,
      category: 'trajectory_configuration',
      rationale: 'Exact selected part and tactic remain measured without being confused with evidence safety.',
    }),
  ),
  ...['missing_learner_uptake', 'generic_learner_uptake', 'verbatim_learner_echo'].map((type) =>
    rule({
      guard: 'response_composition',
      type,
      dispositions: STRICT_HARD_SHADOW_ADVISORY,
      category: 'learner_response_surface',
      rationale:
        'Surface uptake recognition remains strict pending independent review, while semantic misread checks stay hard.',
    }),
  ),
  rule({
    guard: 'response_configuration',
    type: 'axis_not_visible',
    dispositions: REPORT_IN_STRICT_SHADOW_ADVISORY,
    category: 'trajectory_configuration',
    rationale:
      'Non-actorial configuration axes were never delivery vetoes and remain report-only under the strict policy.',
  }),
]);

const RULES_BY_KEY = new Map(RULES.map((entry) => [entry.id, entry]));

function normalizedIssue(issue) {
  const source = issue && typeof issue === 'object' ? issue : {};
  return {
    ...source,
    guard: String(source.guard || '').trim() || null,
    type: String(source.type || '').trim() || null,
  };
}

function ruleForIssue(issue) {
  const exact = issue.guard && issue.type ? RULES_BY_KEY.get(`${issue.guard}:${issue.type}`) : null;
  if (exact) return { rule: exact, known: true, match: 'exact' };
  const wildcard = issue.guard ? RULES_BY_KEY.get(`${issue.guard}:*`) : null;
  if (wildcard) return { rule: wildcard, known: true, match: 'guard_wildcard' };
  return {
    known: false,
    match: 'fail_closed',
    rule: {
      id: 'unknown_issue_fail_closed',
      guard: issue.guard,
      type: issue.type,
      strict: HARD,
      shadow: HARD,
      category: 'unknown',
      rationale: 'Unknown or malformed response-check issues fail closed.',
    },
  };
}

export function classifyTutorStubGuardIssue(issue, { allowActorialAdvisory = false, terminalFallback = false } = {}) {
  const normalized = normalizedIssue(issue);
  const resolved = ruleForIssue(normalized);
  const actorialOverride = allowActorialAdvisory && resolved.known && normalized.guard === 'actorial_realization';
  // Terminal-fallback accommodation (committee-runtime-main-reconciliation,
  // 2026-07-22): the deterministic fallback is the harness's last-resort
  // safety text. When it fails a conversational-integrity or optional
  // actorial-realization check there is no further candidate — rejecting it
  // kills the whole dialogue. On the terminal-fallback attempt only, those
  // known surface findings are delivered as recorded advisories instead of
  // fatals. Evidence, clue-transaction, semantic-closure, pedagogical-support,
  // and all unknown issues remain hard everywhere.
  const terminalFallbackConversationalOverride =
    terminalFallback &&
    resolved.known &&
    resolved.rule.category === 'conversational_integrity' &&
    resolved.rule.strict === HARD;
  const terminalFallbackActorialOverride =
    terminalFallback && resolved.known && normalized.guard === 'actorial_realization' && resolved.rule.strict === HARD;
  const terminalFallbackOverride = terminalFallbackConversationalOverride || terminalFallbackActorialOverride;
  const strictDisposition = actorialOverride || terminalFallbackOverride ? ADVISORY : resolved.rule.strict;
  return {
    issue: normalized,
    known: resolved.known,
    match: resolved.match,
    ruleId: resolved.rule.id,
    category: resolved.rule.category,
    rationale: resolved.rule.rationale,
    strictDisposition,
    shadowDisposition: resolved.rule.shadow,
    legacyOverride: actorialOverride
      ? 'allow_actorial_advisory'
      : terminalFallbackConversationalOverride
        ? 'terminal_fallback_conversational_advisory'
        : terminalFallbackActorialOverride
          ? 'terminal_fallback_actorial_advisory'
          : null,
  };
}

function decisionFor(dispositions, key) {
  const hardRows = dispositions.filter((row) => row[key] === HARD);
  const advisoryRows = dispositions.filter((row) => row[key] === ADVISORY);
  const reportRows = dispositions.filter((row) => row[key] === REPORT_ONLY);
  return {
    ok: hardRows.length === 0,
    hardIssues: hardRows.map((row) => ({ ...row.issue })),
    advisoryIssues: advisoryRows.map((row) => ({ ...row.issue })),
    reportOnlyIssues: reportRows.map((row) => ({ ...row.issue })),
  };
}

export function decideTutorStubGuardDelivery(
  issueRows = [],
  {
    allowActorialAdvisory = false,
    boundaryPolicy = TUTOR_STUB_GUARD_BOUNDARY_POLICIES.strict,
    terminalFallback = false,
  } = {},
) {
  if (!Object.values(TUTOR_STUB_GUARD_BOUNDARY_POLICIES).includes(boundaryPolicy)) {
    throw new Error(`unknown tutor-stub guard boundary policy: ${boundaryPolicy}`);
  }
  const sourceIssues = Array.isArray(issueRows) ? issueRows : [issueRows];
  const dispositions = sourceIssues.map((issue) =>
    classifyTutorStubGuardIssue(issue, { allowActorialAdvisory, terminalFallback }),
  );
  const strictDecision = decisionFor(dispositions, 'strictDisposition');
  const shadowDecision = decisionFor(dispositions, 'shadowDisposition');
  const effective =
    boundaryPolicy === TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory ? shadowDecision : strictDecision;
  return {
    // Preserve the delivery-decision envelope consumed by existing traces and
    // reports. The issue-level policy and its provenance are versioned
    // independently below.
    schema: 'machinespirits.tutor-stub.guard-delivery-decision.v1',
    version: 2,
    dispositionSchema: TUTOR_STUB_GUARD_DISPOSITION_SCHEMA,
    catalogVersion: TUTOR_STUB_GUARD_DISPOSITION_CATALOG_VERSION,
    boundaryPolicy,
    ok: effective.ok,
    allowActorialAdvisory: Boolean(allowActorialAdvisory),
    terminalFallback: Boolean(terminalFallback),
    hardIssues: effective.hardIssues,
    advisoryIssues: effective.advisoryIssues,
    reportOnlyIssues: effective.reportOnlyIssues,
    dispositions: dispositions.map((row) => ({
      issue: { ...row.issue },
      known: row.known,
      match: row.match,
      ruleId: row.ruleId,
      category: row.category,
      rationale: row.rationale,
      strictDisposition: row.strictDisposition,
      shadowDisposition: row.shadowDisposition,
      effectiveDisposition:
        boundaryPolicy === TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory
          ? row.shadowDisposition
          : row.strictDisposition,
      legacyOverride: row.legacyOverride,
    })),
    provenance: {
      schema: TUTOR_STUB_GUARD_DISPOSITION_SCHEMA,
      catalogVersion: TUTOR_STUB_GUARD_DISPOSITION_CATALOG_VERSION,
      boundaryPolicy,
      unknownIssuesFailClosed: true,
      deterministicAuditsMutated: false,
    },
    shadow: {
      policy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory,
      ok: shadowDecision.ok,
      hardIssues: shadowDecision.hardIssues,
      advisoryIssues: shadowDecision.advisoryIssues,
      reportOnlyIssues: shadowDecision.reportOnlyIssues,
      reclassifiedIssues: dispositions
        .filter((row) => row.strictDisposition !== row.shadowDisposition)
        .map((row) => ({
          ...row.issue,
          from: row.strictDisposition,
          to: row.shadowDisposition,
          ruleId: row.ruleId,
        })),
    },
  };
}

/**
 * Build the user-facing fatal message from the effective hard boundary only.
 * Advisory and report-only findings remain in the trace/decision envelope but
 * must not be presented as causes of a terminal delivery failure.
 */
export function tutorStubTerminalFallbackFailureMessage(deliveryDecision = null) {
  const hardIssues = Array.isArray(deliveryDecision?.hardIssues) ? deliveryDecision.hardIssues : [];
  const details = hardIssues.length
    ? hardIssues.map((issue) => `${issue.guard || 'unknown_guard'}:${issue.type || 'unknown_issue'}`).join(', ')
    : 'unclassified_hard_guard_failure';
  return `Tutor deterministic fallback failed final audit: ${details}`;
}

function issueRows(guard, issues) {
  // The audit namespace is assigned by the caller, not trusted from an issue
  // payload. This prevents a malformed finding from relabelling a hard leak
  // as a report-only configuration miss.
  return (Array.isArray(issues) ? issues : []).map((issue) => ({ ...issue, guard }));
}

function auditIssueRows(guard, audit, findingsKey = 'issues') {
  const rows = issueRows(guard, audit?.[findingsKey]);
  if (audit?.ok === false && rows.length === 0) {
    rows.push({
      guard,
      type: 'audit_failed_without_findings',
    });
  }
  return rows;
}

/** Build one immutable view of deterministic audit findings for disposition. */
export function tutorStubGuardIssueRows(audits = null) {
  const source = audits || {};
  const rows = [
    ...auditIssueRows('leak', source.leakAudit, 'leaks'),
    ...auditIssueRows('human_scaffold', source.scaffoldAudit),
    ...auditIssueRows('question_support', source.questionSupportAudit),
    ...auditIssueRows('dramatic_release', source.dramaticReleaseAudit),
    ...auditIssueRows('actorial_realization', source.actorialRealizationAudit),
    ...auditIssueRows('response_composition', source.responseCompositionAudit),
    ...auditIssueRows('live_turn_progression_v1', source.liveTurnProgressionAudit),
    ...auditIssueRows('live_source_action_alignment_v1', source.liveSourceActionAlignmentAudit),
    ...auditIssueRows('repetition', source.repetitionAudit),
    ...auditIssueRows('dialogue_closure', source.closureAudit),
  ];
  for (const [axis, audit] of Object.entries(source.responseConfigurationAudit?.axes || {})) {
    if (axis === 'actorial_part' || audit?.visible !== false) continue;
    rows.push({
      guard: 'response_configuration',
      type: 'axis_not_visible',
      axis,
      selected: audit?.selected || null,
    });
  }
  const missingPremises = Array.isArray(source.releaseDeliveryAudit?.missingPremises)
    ? source.releaseDeliveryAudit.missingPremises
    : [];
  for (const premise of missingPremises) {
    rows.push({
      guard: 'release_delivery',
      type: 'missing_due_evidence',
      premise,
    });
  }
  if (source.releaseDeliveryAudit?.ok === false && missingPremises.length === 0) {
    rows.push({
      guard: 'release_delivery',
      type: 'release_delivery_audit_failed',
    });
  }
  return rows.map((row) => ({ ...row }));
}

export function tutorStubGuardDispositionCatalog() {
  return RULES.map((entry) => ({ ...entry }));
}
