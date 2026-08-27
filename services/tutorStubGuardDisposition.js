export const TUTOR_STUB_GUARD_DISPOSITION_SCHEMA = 'machinespirits.tutor-stub.guard-disposition.v1';
// 3 (2026-07-26): the terminal-fallback boundary now also downgrades
// dramatic-form findings, so a trace's disposition rows are not comparable
// with a version-2 trace without accounting for that.
// 4 (2026-07-28): dialogue_closure gained premature_dialogue_close, so a
// version-3 trace cannot carry that row and its absence there means nothing.
// 5 (2026-07-28): repetition gained tutor_turn_without_advance, a second
// channel that fires on a stall the lexical similarity score never sees.
// 6 (2026-07-31): the shadow column widens — live_turn_progression_v1,
// repetition, and human_scaffold.redundant_local_requestion read ADVISORY
// under the shadow policy. The strict column is byte-identical to version 5,
// so default-policy traces stay comparable; shadow-policy traces from
// version 6 are NOT comparable with any earlier shadow reading. Motivated by
// the 2026-07-31 three-arm manner test: those families templated two-thirds
// of turns and answered nearly every learner-pressure turn themselves,
// making tutor-conduct experiments unmeasurable under strict.
// 7 (2026-08-08): live_source_action_alignment_v1.due_source_action_referent_missing
// reads ADVISORY under the shadow policy. The strict column is byte-identical
// to version 6, so default-policy traces stay comparable; shadow-policy traces
// from version 7 are NOT comparable with an earlier shadow reading on that one
// finding — and the gap is wide, not marginal: on the 44 Phase B turns where
// this guard was the last objector, the demotion moves 33 of them from
// "template shipped" to "the model's own repair shipped".
// 8 (2026-08-10): two active public-obligation findings stay hard in both
// columns. The broad live-progression family remains advisory under shadow;
// only failing to answer/defer an active public request, or replacing it with
// another question, regains a veto.
// 9 (2026-08-11): an action family owned by active adaptive-warrant final
// authority must be visible in the delivered public text. Ordinary selector
// configuration misses remain non-vetoing; this rule is scoped to the causal
// intervention whose delivery the mechanism study is intended to verify.
// 10 (2026-08-12): on the deterministic terminal fallback only, selected
// adaptive-warrant tactic visibility is advisory because the harness owns the
// fixed safety prose. Repetition is explicitly excluded from the older broad
// conversational accommodation and remains blocking on the last resort.
// 11 (2026-08-23): two registered-contrast findings are hard in both columns.
// They fire only when a study passes its own delivered-contrast rule in, so no
// earlier trace can carry either row and version-10 readings stay comparable.
// The broad live-progression family is unchanged and still advisory in shadow.
// 12 (2026-08-26): the terminal-fallback accommodations now demote the shadow
// column as well as the strict column. They were written (v. 2026-07-22) when
// strict was the delivered policy; live dialogues moved to shadow_advisory on
// 2026-08-07, and a shadow column left hard let a conversational composition
// finding (learner_selected_test_not_acknowledged) reject the deterministic
// fallback and kill the dialogue — the two face-B marrick technical losses in
// the resistant-learner merged powered run. Evidence, clue-transaction,
// closure, public-obligation, registered-contrast, repetition and unknown
// findings keep their vetoes on the last resort in both columns.
export const TUTOR_STUB_GUARD_DISPOSITION_CATALOG_VERSION = 12;

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
    type: 'public_obligation_unresolved',
    category: 'public_obligation_integrity',
    rationale:
      'An active learner-directed request for a public result must be answered or deferred with a named limit and concrete public next condition.',
  }),
  rule({
    guard: 'live_turn_progression_v1',
    type: 'public_obligation_replaced_by_question',
    category: 'public_obligation_integrity',
    rationale: 'A new tutor question cannot discharge or replace an active learner-directed public-result obligation.',
  }),
  rule({
    guard: 'live_turn_progression_v1',
    type: 'registered_question_rule_forbids_question',
    category: 'registered_contrast_integrity',
    rationale:
      'A study that registers one side of its contrast as asking no question is naming the difference it is read on. ' +
      'The broad progression family is advisory under shadow, which let the v8 boredom run ship two turns its own audit had already faulted.',
  }),
  rule({
    guard: 'live_turn_progression_v1',
    type: 'registered_question_rule_requires_question',
    category: 'registered_contrast_integrity',
    rationale: 'The other side of the same registered contrast must deliver the question the study says it delivers.',
  }),
  rule({
    guard: 'live_turn_progression_v1',
    type: '*',
    dispositions: STRICT_HARD_SHADOW_ADVISORY,
    category: 'conversational_integrity',
    rationale:
      'The plain live response must answer the learner, respect terminal question ownership, and keep its typed public focus. ' +
      'Shadow (v6): recorded, not vetoing — under strict this family answered most learner-pressure turns with templates.',
  }),
  rule({
    guard: 'live_source_action_alignment_v1',
    type: '*',
    category: 'dramatic_realization',
    rationale:
      'Each exact due source must appear once, with its pre-source carrier and any opt-in post-source accessibility sentence visible at their typed live boundaries.',
  }),
  rule({
    guard: 'live_source_action_alignment_v1',
    type: 'due_source_action_referent_missing',
    dispositions: STRICT_HARD_SHADOW_ADVISORY,
    category: 'dramatic_realization',
    rationale:
      'The draft said the source but did not anchor it to the carrier. Shadow (v7): recorded, not vetoing. ' +
      'This was the guard that stopped the repair pass from ever landing. On the 44 Phase B turns where this ' +
      'guard family was the last objector, a repair ran on all 44 and its reply carried every required passage ' +
      'word for word on 38 — and the fixed template shipped anyway, because 34 of those repairs failed this ' +
      "check alone, on where the passage sat rather than whether it was there. Demoting it lets the model's own " +
      'reply ship on 33 of the 44. The occurrence check, which asks whether the words are present at all, keeps ' +
      'its veto under the wildcard rule above.',
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
    dispositions: STRICT_HARD_SHADOW_ADVISORY,
    category: 'conversational_integrity',
    rationale: 'A locally resolved public question must not be demanded again. Shadow (v6): recorded, not vetoing.',
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
      dispositions: STRICT_HARD_SHADOW_ADVISORY,
      category: 'conversational_integrity',
      rationale:
        'Material tutor repetition must not trap the learner in a repeated exchange. Shadow (v6): recorded, not vetoing.',
    }),
  ),
  rule({
    guard: 'repetition',
    type: 'tutor_turn_without_advance',
    dispositions: STRICT_HARD_SHADOW_ADVISORY,
    category: 'conversational_integrity',
    rationale:
      'A turn that restates the covered ground in fresh words traps the learner just as surely. ' +
      'Shadow (v6): recorded, not vetoing; the windowed check already grades the strict channel.',
  }),
  ...[
    'premature_dialogue_close',
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
  rule({
    guard: 'dialogue_closure',
    type: 'premature_dialogue_close',
    category: 'semantic_closure_integrity',
    rationale: 'The tutor may not declare the case closed before the closure conditions are met.',
  }),

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
  rule({
    guard: 'adaptive_warrant_delivery',
    type: 'selected_action_family_not_visible',
    category: 'causal_intervention_integrity',
    rationale:
      'An action family selected by active adaptive-warrant final authority must be publicly realized before the turn can count as delivered.',
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
  // safety text. When it fails a conversational-integrity, dramatic-form or
  // optional actorial-realization check there is no further candidate —
  // rejecting it kills the whole dialogue. On the terminal-fallback attempt
  // only, those known surface findings are delivered as recorded advisories
  // instead of fatals. Evidence, clue-transaction, semantic-closure,
  // pedagogical-support, and all unknown issues remain hard everywhere.
  const terminalFallbackConversationalOverride =
    terminalFallback &&
    resolved.known &&
    resolved.rule.category === 'conversational_integrity' &&
    normalized.guard !== 'repetition' &&
    resolved.rule.strict === HARD;
  const terminalFallbackActorialOverride =
    terminalFallback && resolved.known && normalized.guard === 'actorial_realization' && resolved.rule.strict === HARD;
  // Dramatic *form* on the last resort (2026-07-26). The fallback is fixed
  // harness text wrapped around per-world clue prose, so whether a released
  // clue arrives with a visible entrance or exhibit action is decided by the
  // authored clue, not by anything the fallback can supply. Free-running
  // dialogues died here twice — every candidate rejected, the fallback
  // included, leaving the tutor with nothing it was permitted to say. The
  // shadow column already reads these as realization rather than public-state
  // integrity, and requiring the shadow disposition to be advisory is what
  // keeps `live_source_action_alignment_v1` (hard in both columns) and the two
  // hard `dramatic_release` types — duplicate delivery, source-perspective
  // drift — fatal here. Whether the clue's *content* was delivered stays
  // separately and hardly audited by `release_delivery`.
  const terminalFallbackDramaticFormOverride =
    terminalFallback &&
    resolved.known &&
    resolved.rule.category === 'dramatic_realization' &&
    resolved.rule.strict === HARD &&
    resolved.rule.shadow === ADVISORY;
  const terminalFallbackStyleOverride =
    terminalFallback &&
    resolved.known &&
    normalized.guard === 'adaptive_warrant_delivery' &&
    normalized.type === 'selected_action_family_not_visible';
  const terminalFallbackOverride =
    terminalFallbackConversationalOverride ||
    terminalFallbackActorialOverride ||
    terminalFallbackDramaticFormOverride ||
    terminalFallbackStyleOverride;
  const strictDisposition = actorialOverride || terminalFallbackOverride ? ADVISORY : resolved.rule.strict;
  // The accommodation must hold under whichever boundary policy is delivered.
  // Demoting only the strict column stops protecting the last resort the day
  // the delivered policy becomes shadow_advisory (catalog version 12).
  const shadowDisposition = terminalFallbackOverride ? ADVISORY : resolved.rule.shadow;
  return {
    issue: normalized,
    known: resolved.known,
    match: resolved.match,
    ruleId: resolved.rule.id,
    category: resolved.rule.category,
    rationale: resolved.rule.rationale,
    strictDisposition,
    shadowDisposition,
    legacyOverride: actorialOverride
      ? 'allow_actorial_advisory'
      : terminalFallbackConversationalOverride
        ? 'terminal_fallback_conversational_advisory'
        : terminalFallbackActorialOverride
          ? 'terminal_fallback_actorial_advisory'
          : terminalFallbackDramaticFormOverride
            ? 'terminal_fallback_dramatic_form_advisory'
            : terminalFallbackStyleOverride
              ? 'terminal_fallback_style_advisory'
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

// The default here is the catalog's reference column, NOT the runtime default.
// Live dialogues run shadow_advisory from 2026-08-07 and pass it explicitly
// (`tutorStubTutorTurnPipeline.js`, resolved from TUTOR_STUB_GUARD_POLICY).
// Strict stays the default of this function because the first-draft campaign
// machinery calls it bare and was calibrated under strict; flipping it here
// would re-calibrate that apparatus as a side effect of a delivery change.
// Any new analysis must pass a policy: a bare call answers a question about
// the strict column, which is not the regime live runs are decided under.
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
export function tutorStubTerminalFallbackFailureMessage(
  deliveryDecision = null,
  { candidateText = '', attemptCount = null, tracePath = '' } = {},
) {
  const hardIssues = Array.isArray(deliveryDecision?.hardIssues) ? deliveryDecision.hardIssues : [];
  const heading = Number.isFinite(Number(attemptCount))
    ? `Tutor response recovery stopped after ${Number(attemptCount)} rejected candidates: the deterministic fallback did not pass its final response check.`
    : 'Tutor deterministic fallback did not pass its final response check.';
  const issueLines = hardIssues.length
    ? hardIssues.map((issue) => {
        const key = `${issue.guard || 'unknown_guard'}:${issue.type || 'unknown_issue'}`;
        if (issue.guard === 'leak') return `- ${key} — candidate details withheld at the public-evidence boundary`;
        return `- ${key}${issue.reason ? ` — ${issue.reason}` : ''}`;
      })
    : ['- unclassified_hard_guard_failure'];
  const safeCandidate = String(candidateText || '').trim();
  const candidateLine = hardIssues.some((issue) => issue?.guard === 'leak')
    ? 'Rejected fallback: omitted because the failed candidate may contain non-public evidence.'
    : safeCandidate
      ? `Rejected fallback: ${JSON.stringify(safeCandidate)}`
      : null;
  const traceLine = String(tracePath || '').trim() ? `Trace: ${String(tracePath).trim()}` : null;
  return [heading, 'Blocking issue:', ...issueLines, candidateLine, traceLine].filter(Boolean).join('\n');
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
  const adaptiveWarrantDelivery = source.responseConfigurationAudit?.adaptive_warrant_delivery || null;
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
    // Only populated on the self-correction pass. It carries no catalog rule,
    // so the unknown-issue default makes its findings hard in both dispositions
    // — a fabricated near-miss or a mention of the apparatus can never ship.
    ...auditIssueRows('self_correction_disclosure', source.selfCorrectionDisclosureAudit),
  ];
  for (const [axis, audit] of Object.entries(source.responseConfigurationAudit?.axes || {})) {
    if (axis === 'actorial_part' || audit?.compatibility_alias_of || audit?.visible !== false) continue;
    if (axis === 'action_family' && adaptiveWarrantDelivery?.active === true) {
      rows.push({
        guard: 'adaptive_warrant_delivery',
        type: 'selected_action_family_not_visible',
        selected: audit?.selected || null,
        desired_action_family: adaptiveWarrantDelivery.desired_action_family || null,
        reason: `active warrant final authority selected ${adaptiveWarrantDelivery.desired_action_family || audit?.selected || 'an action family'}, but the public tutor response did not visibly realize it`,
      });
      continue;
    }
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
