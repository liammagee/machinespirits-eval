export const TUTOR_STUB_TURN_FAILURE_RECORD_SCHEMA = 'machinespirits.tutor-stub.turn-failure-record.v1';
export const TUTOR_STUB_TURN_FAILURE_SUMMARY_SCHEMA = 'machinespirits.tutor-stub.turn-failure-summary.v1';
export const TUTOR_STUB_TURN_FAILURE_TRACE_EVENT_SCHEMA = 'machinespirits.tutor-stub.turn-failure-trace-event.v1';

const AUDIT_ISSUE_SOURCES = Object.freeze([
  ['leak', 'leakAudit', 'leaks'],
  ['human_scaffold', 'scaffoldAudit', 'issues'],
  ['question_support', 'questionSupportAudit', 'issues'],
  ['dramatic_release', 'dramaticReleaseAudit', 'issues'],
  ['actorial_realization', 'actorialRealizationAudit', 'issues'],
  ['response_composition', 'responseCompositionAudit', 'issues'],
  ['live_turn_progression_v1', 'liveTurnProgressionAudit', 'issues'],
  ['live_source_action_alignment_v1', 'liveSourceActionAlignmentAudit', 'issues'],
  ['repetition', 'repetitionAudit', 'issues'],
  ['dialogue_closure', 'closureAudit', 'issues'],
]);

function jsonClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function oneLine(value) {
  return String(value || '')
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function modeToken(value, fallback = 'unknown') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  return normalized || fallback;
}

function addUniqueIssue(target, issue) {
  const row = {
    guard: modeToken(issue?.guard),
    type: modeToken(issue?.type || issue?.issueType),
    reason: oneLine(issue?.reason) || null,
  };
  const key = `${row.guard}:${row.type}:${row.reason || ''}`;
  if (!target.has(key)) target.set(key, row);
}

function issuesFromAudits(audits = null) {
  const source = audits || {};
  const issues = new Map();
  for (const [guard, auditKey, findingsKey] of AUDIT_ISSUE_SOURCES) {
    const audit = source[auditKey];
    const findings = Array.isArray(audit?.[findingsKey]) ? audit[findingsKey] : [];
    for (const issue of findings) {
      addUniqueIssue(issues, { guard, ...issue });
    }
    if (audit?.ok === false && findings.length === 0) {
      addUniqueIssue(issues, { guard, type: 'audit_failed_without_findings' });
    }
  }
  for (const [axis, audit] of Object.entries(source.responseConfigurationAudit?.axes || {})) {
    if (audit?.visible === false) {
      addUniqueIssue(issues, {
        guard: 'response_configuration',
        type: 'axis_not_visible',
        reason: axis,
      });
    }
  }
  for (const premise of source.releaseDeliveryAudit?.missingPremises || []) {
    addUniqueIssue(issues, {
      guard: 'release_delivery',
      type: 'missing_due_evidence',
      reason: premise,
    });
  }
  return [...issues.values()];
}

function issuesFromAttempt(attempt = {}) {
  const issues = new Map();
  for (const span of attempt.guardedSpans || []) addUniqueIssue(issues, span);
  for (const issue of issuesFromAudits(attempt.audits)) addUniqueIssue(issues, issue);
  if (attempt.auditOk === false && issues.size === 0) {
    addUniqueIssue(issues, { guard: 'response_check', type: 'audit_failed_without_findings' });
  }
  return [...issues.values()];
}

function failedCandidate(attempt = {}) {
  const issues = issuesFromAttempt(attempt);
  if (attempt.auditOk !== false && issues.length === 0) return null;
  return {
    kind: attempt.kind || 'unknown',
    attempt: attempt.attempt ?? null,
    provider: attempt.provider || null,
    model: attempt.model || null,
    text: String(attempt.candidate?.text || ''),
    issues,
    guardedSpans: jsonClone(attempt.guardedSpans || []),
    repairedSpans: jsonClone(attempt.repairedSpans || []),
  };
}

function rejectedCandidates(turnRecord = {}) {
  const rows = (turnRecord.tutorGuardAccounting?.attempts || []).map(failedCandidate).filter(Boolean);
  if (rows.length) return rows;
  if (turnRecord.tutorResponseRepaired || turnRecord.tutorDeterministicFallback) {
    return [
      {
        kind: 'legacy_response_check_failure',
        attempt: null,
        provider: turnRecord.provider || null,
        model: turnRecord.model || null,
        text: '',
        issues: [
          {
            guard: 'response_check',
            type: turnRecord.tutorDeterministicFallback
              ? 'fallback_used_without_attempt_details'
              : 'repair_used_without_attempt_details',
            reason: 'Legacy-compatible trace flags a response-check intervention without candidate-level findings.',
          },
        ],
        guardedSpans: [],
        repairedSpans: [],
      },
    ];
  }
  return [];
}

function aggregateGuardFailures(candidates) {
  const labels = new Map();
  for (const candidate of candidates) {
    for (const issue of candidate.issues) {
      const mode = `guard.${modeToken(issue.guard)}.${modeToken(issue.type)}`;
      const label = labels.get(mode) || {
        mode,
        subject: 'tutor_candidate',
        status: 'confirmed',
        observedAt: 'pre_delivery',
        source: 'deterministic_response_check',
        confidence: 'deterministic',
        evidence: { attempts: [] },
      };
      label.evidence.attempts.push({
        kind: candidate.kind,
        attempt: candidate.attempt,
        provider: candidate.provider,
        model: candidate.model,
        reason: issue.reason,
        guardedSpans: candidate.guardedSpans.filter(
          (span) => modeToken(span.guard) === issue.guard && modeToken(span.issueType || span.type) === issue.type,
        ),
      });
      labels.set(mode, label);
    }
  }
  return [...labels.values()];
}

function pointOfActionFailure(turnRecord = {}) {
  const point = turnRecord.pointOfAction || null;
  const trigger = point?.assigned_trigger || null;
  const compliance = point?.compliance || null;
  if (!trigger || compliance?.compliant !== false) return null;
  return {
    mode: `conduct.${modeToken(trigger)}.unhandled`,
    subject: 'delivered_tutor_response',
    status: 'confirmed',
    observedAt: 'delivery',
    source: 'point_of_action_compliance',
    confidence: 'deterministic',
    evidence: {
      detectorVersion: compliance.detector_version || point.detector_version || null,
      arm: compliance.arm || point.arm || null,
      components: jsonClone(compliance.components || {}),
      realizedActionFamily: compliance.realized_action_family || null,
    },
  };
}

function feedbackForTurn(turnRecord, feedbackObservations = []) {
  const matches = feedbackObservations.filter((observation) => {
    const rated = observation?.ratedResponse || null;
    if (!rated) return false;
    if (turnRecord.turnId && rated.turnId) return rated.turnId === turnRecord.turnId;
    return Number.isFinite(Number(turnRecord.turn)) && Number(rated.turn) === Number(turnRecord.turn);
  });
  return matches.at(-1);
}

function humanFeedbackFailure(turnRecord, feedbackObservations) {
  const observation = feedbackForTurn(turnRecord, feedbackObservations);
  if (observation?.feedback?.rating !== 'down') return null;
  const reason = observation.feedback.reason || 'unhelpful';
  return {
    mode: `feedback.${modeToken(reason)}`,
    subject: 'delivered_tutor_response',
    status: 'human_reported',
    observedAt: 'next_learner_turn',
    source: 'human_turn_feedback',
    confidence: 'human_report',
    evidence: {
      reasonLabel: observation.feedback.reasonLabel || null,
      scope: observation.feedback.scope || null,
      hasComment: Boolean(oneLine(observation.feedback.comment)),
      observationType: observation.observationType || null,
      subjectiveHelpfulness: observation.outcomes?.subjectiveHelpfulness ?? observation.feedback.helpfulness ?? -1,
    },
  };
}

function efficacyForTurn(turnRecord, nextTurnRecord = null) {
  const efficacy = nextTurnRecord?.previousRegisterEfficacy || null;
  if (!efficacy) return null;
  if (Number.isFinite(Number(efficacy.registerTurn)) && Number(efficacy.registerTurn) !== Number(turnRecord.turn)) {
    return null;
  }
  return efficacy;
}

function outcomeFailure(turnRecord, nextTurnRecord) {
  const efficacy = efficacyForTurn(turnRecord, nextTurnRecord);
  if (!['regression_or_overreach', 'no_clear_progress'].includes(efficacy?.label)) return null;
  const candidate = efficacy.label === 'no_clear_progress';
  return {
    mode: `interaction.${modeToken(efficacy.label)}`,
    subject: 'interaction_outcome',
    status: candidate ? 'candidate' : 'confirmed',
    observedAt: 'next_learner_turn',
    source: 'next_turn_register_efficacy',
    confidence: candidate ? 'heuristic' : 'deterministic_proxy',
    evidence: {
      evaluatedAtTurn: efficacy.evaluatedAtTurn ?? nextTurnRecord?.turn ?? null,
      progressScore: efficacy.progressScore ?? null,
      dagProgress: efficacy.dagProgress ?? null,
      mismatch: efficacy.mismatch || null,
      delta: jsonClone(efficacy.delta || null),
      caveat: efficacy.caveat || null,
    },
  };
}

function runtimeFailure(turnRecord = {}) {
  if (!turnRecord.quarantined && !turnRecord.quarantine?.failure) return null;
  const failure = turnRecord.quarantine?.failure || {};
  return {
    mode: `runtime.${modeToken(failure.category, 'recoverable_turn_failure')}.${modeToken(failure.reason)}`,
    subject: 'runtime',
    status: 'confirmed',
    observedAt: 'turn_execution',
    source: 'diagnostic_quarantine',
    confidence: 'deterministic',
    evidence: {
      disposition: failure.disposition || null,
      errorCode: turnRecord.quarantine?.error?.code || null,
      rolledBack: turnRecord.quarantine?.transaction?.rolledBack === true,
    },
  };
}

function runIdentity(runStart = {}, tracePath = null, traceSealed = null) {
  const metadata = runStart.metadata || {};
  const world = metadata.world || {};
  const learnerProfile = metadata.autoLearner?.profile || metadata.mixedLearner?.profile || null;
  return {
    id: runStart.runId || null,
    tracePath: tracePath || null,
    sealed: traceSealed,
    worldId: typeof world === 'string' ? world : world.id || null,
    learnerProfileId:
      metadata.autoLearner?.profileId ||
      metadata.mixedLearner?.profileId ||
      learnerProfile?.id ||
      learnerProfile?.profile_id ||
      null,
    interactionMode: metadata.lab?.mode || metadata.interactiveRoleModes?.mode || null,
    provenanceSha: metadata.provenance?.git?.sha || null,
  };
}

function publicOpening(events) {
  const opening = events.find((event) => event?.type === 'tutor_opening');
  return String(opening?.text || opening?.opening || '');
}

function classificationSignal(turnRecord = {}) {
  const turn = turnRecord.classification?.turn || {};
  return {
    requestType: turn.request_type || null,
    discourseMove: turn.discourse_move || null,
    evidenceUse: turn.evidence_use || null,
    epistemicStance: turn.epistemic_stance || null,
    affect: turn.affect || null,
    agency: turn.agency || null,
    pedagogicalNeed: turn.pedagogical_need || null,
  };
}

function deliveredResponse(turnRecord = {}) {
  const delivery = turnRecord.tutorGuardAccounting?.finalDelivery || {};
  return {
    text: String(turnRecord.tutor || delivery.candidate?.text || ''),
    source: delivery.source || null,
    provider: delivery.provider || turnRecord.provider || null,
    model: delivery.model || turnRecord.model || null,
    auditOk: delivery.auditOk ?? null,
    repaired: Boolean(turnRecord.tutorResponseRepaired),
    deterministicFallback: Boolean(turnRecord.tutorDeterministicFallback),
    quarantined: Boolean(turnRecord.quarantined),
  };
}

function trainingDisposition(turnRecord, failures, candidates, delivered, traceSealed) {
  const distinctRejectedCandidate = candidates.some((candidate) => candidate.text && candidate.text !== delivered.text);
  const safetyEligible = traceSealed === true && !delivered.quarantined && delivered.auditOk !== false;
  const exclusions = [
    traceSealed === true ? null : traceSealed === false ? 'unsealed_trace' : 'trace_seal_pending',
    delivered.quarantined ? 'quarantined_turn' : null,
    delivered.deterministicFallback ? 'deterministic_fallback_requires_review' : null,
    !distinctRejectedCandidate ? 'no_distinct_rejected_candidate' : null,
    delivered.auditOk === false ? 'final_delivery_audit_failed' : null,
    failures.some((failure) => failure.status === 'candidate') ? 'contains_unvalidated_candidate_label' : null,
  ].filter(Boolean);
  return {
    detectorCandidate: failures.length > 0,
    preferencePairCandidate: Boolean(safetyEligible && distinctRejectedCandidate),
    correctedTargetCandidate: Boolean(
      safetyEligible && distinctRejectedCandidate && !delivered.deterministicFallback && delivered.repaired,
    ),
    humanFeedbackConfirmed: failures.some((failure) => failure.status === 'human_reported'),
    humanGroundTruthValidated: false,
    trainingLicensed: false,
    requiresReview: true,
    exclusions,
  };
}

export function buildTutorStubTurnFailureRecord({
  runStart = {},
  turnRecord,
  nextTurnRecord = null,
  feedbackObservations = [],
  tracePath = null,
  traceSealed = null,
  publicMessages = [],
} = {}) {
  if (!turnRecord) return null;
  const candidates = rejectedCandidates(turnRecord);
  const failures = aggregateGuardFailures(candidates);
  for (const label of [
    pointOfActionFailure(turnRecord),
    humanFeedbackFailure(turnRecord, feedbackObservations),
    outcomeFailure(turnRecord, nextTurnRecord),
    runtimeFailure(turnRecord),
  ]) {
    if (label) failures.push(label);
  }
  failures.sort((left, right) => left.mode.localeCompare(right.mode));
  const delivered = deliveredResponse(turnRecord);
  const efficacy = efficacyForTurn(turnRecord, nextTurnRecord);
  const point = turnRecord.pointOfAction || null;
  return {
    schema: TUTOR_STUB_TURN_FAILURE_RECORD_SCHEMA,
    run: runIdentity(runStart, tracePath, traceSealed),
    turn: {
      number: Number(turnRecord.turn),
      id: turnRecord.turnId || null,
      learnerAuthorship: turnRecord.learnerResponseProvenance?.authorship || 'unknown',
    },
    publicContext: {
      messages: jsonClone(publicMessages),
      learner: String(turnRecord.learner || ''),
    },
    signals: {
      learner: classificationSignal(turnRecord),
      pointOfAction: point
        ? {
            detectorVersion: point.detector_version || null,
            trigger: point.assigned_trigger || null,
            candidates: jsonClone(point.candidates || null),
            suppression: jsonClone(point.suppression || null),
            compliance: jsonClone(point.compliance || null),
          }
        : null,
    },
    failures,
    rejectedCandidates: candidates,
    delivered,
    nextTurnOutcome: nextTurnRecord
      ? {
          turn: nextTurnRecord.turn ?? null,
          learner: String(nextTurnRecord.learner || ''),
          classification: classificationSignal(nextTurnRecord),
          efficacy: jsonClone(efficacy),
        }
      : null,
    training: trainingDisposition(turnRecord, failures, candidates, delivered, traceSealed),
  };
}

export function parseTutorStubTraceJsonl(text) {
  const events = [];
  const malformedLines = [];
  for (const [index, line] of String(text || '')
    .split(/\r?\n/u)
    .entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      malformedLines.push({ line: index + 1, error: oneLine(error?.message || error) });
    }
  }
  return { events, malformedLines };
}

export function buildTutorStubTurnFailureRecords({
  runStart = {},
  turnRecords = [],
  tracePath = null,
  traceSealed = null,
  opening = '',
  includeClean = false,
  feedbackRecords = [],
} = {}) {
  const feedbackObservations = [
    ...turnRecords.map((turn) => turn.feedbackObservation).filter(Boolean),
    ...feedbackRecords.filter(Boolean),
  ];
  const records = [];
  const publicMessages = [];
  if (opening) publicMessages.push({ role: 'assistant', content: opening });
  for (const [index, turnRecord] of turnRecords.entries()) {
    const contextMessages = [...publicMessages, { role: 'user', content: String(turnRecord.learner || '') }];
    const record = buildTutorStubTurnFailureRecord({
      runStart,
      turnRecord,
      nextTurnRecord: turnRecords[index + 1] || null,
      feedbackObservations,
      tracePath,
      traceSealed,
      publicMessages: contextMessages,
    });
    if (record && (includeClean || record.failures.length > 0)) records.push(record);
    publicMessages.push({ role: 'user', content: String(turnRecord.learner || '') });
    publicMessages.push({ role: 'assistant', content: String(turnRecord.tutor || '') });
  }
  return records;
}

export function buildTutorStubTurnFailureTraceEvents({
  runStart = {},
  turnRecords = [],
  tracePath = null,
  traceSealed = false,
  opening = '',
  phase = traceSealed ? 'sealed' : 'incremental',
  feedbackRecords = [],
} = {}) {
  const records = buildTutorStubTurnFailureRecords({
    runStart,
    turnRecords,
    tracePath,
    traceSealed,
    opening,
    feedbackRecords,
  });
  const latestTurn = Math.max(0, ...turnRecords.map((turn) => Number(turn?.turn) || 0));
  const selected = phase === 'sealed' ? records : records.filter((record) => record.turn.number >= latestTurn - 1);
  return selected.map((record) => ({
    type: 'turn_failure_recorded',
    schema: TUTOR_STUB_TURN_FAILURE_TRACE_EVENT_SCHEMA,
    phase,
    turn: record.turn.number,
    turnId: record.turn.id,
    failureModes: record.failures.map((failure) => failure.mode),
    record,
    publicTranscriptChanged: false,
  }));
}

export function backfillTutorStubTurnFailures({ events = [], tracePath = null, includeClean = false } = {}) {
  const runStart = events.find((event) => event?.type === 'run_start') || {};
  const traceSealed = events.some((event) => event?.type === 'run_end');
  const turnRecords = events
    .filter((event) => event?.type === 'turn_complete' && event.turnRecord)
    .map((event) => event.turnRecord);
  const feedbackRecords = events
    .map((event) => {
      if (event?.type === 'tutor_feedback_rating_recorded') return event.record;
      if (event?.type === 'tutor_feedback_observation') return event.observation;
      return null;
    })
    .filter(Boolean);
  const records = buildTutorStubTurnFailureRecords({
    runStart,
    turnRecords,
    tracePath,
    traceSealed,
    opening: publicOpening(events),
    includeClean,
    feedbackRecords,
  });
  return {
    records,
    turnsScanned: turnRecords.length,
    runId: runStart.runId || null,
  };
}

export function tutorStubFailureModeMatches(record, filters = []) {
  const normalized = (Array.isArray(filters) ? filters : [filters])
    .map((filter) =>
      String(filter || '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
  if (!normalized.length) return true;
  return (record?.failures || []).some((failure) =>
    normalized.some((filter) => {
      const prefix = filter.endsWith('*') ? filter.slice(0, -1) : filter;
      return (
        failure.mode === prefix ||
        failure.mode.startsWith(`${prefix}.`) ||
        (filter.endsWith('*') && failure.mode.startsWith(prefix))
      );
    }),
  );
}

export function summarizeTutorStubTurnFailures(records = [], extra = {}) {
  const labels = records.flatMap((record) => record.failures || []);
  const countBy = (values) =>
    values.reduce((counts, value) => {
      const key = String(value || 'unknown');
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  return {
    schema: TUTOR_STUB_TURN_FAILURE_SUMMARY_SCHEMA,
    generatedAt: new Date().toISOString(),
    records: records.length,
    labels: labels.length,
    byMode: countBy(labels.map((label) => label.mode)),
    byStatus: countBy(labels.map((label) => label.status)),
    bySubject: countBy(labels.map((label) => label.subject)),
    preferencePairCandidates: records.filter((record) => record.training?.preferencePairCandidate).length,
    correctedTargetCandidates: records.filter((record) => record.training?.correctedTargetCandidate).length,
    humanFeedbackConfirmedRecords: records.filter((record) => record.training?.humanFeedbackConfirmed).length,
    humanGroundTruthValidatedRecords: 0,
    trainingLicensed: false,
    ...jsonClone(extra),
  };
}
