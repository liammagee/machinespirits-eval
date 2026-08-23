import {
  buildTutorStubResistanceRecoverySemanticPrompt,
  buildTutorStubResistanceRecoverySemanticZeroCallFixture,
  validateTutorStubResistanceRecoverySemanticResponse,
} from './tutorStubResistanceRecoverySemanticAdjudicationV2.js';

export { buildTutorStubResistanceRecoverySemanticPrompt, buildTutorStubResistanceRecoverySemanticZeroCallFixture };

export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_ENSEMBLE_SCHEMA_V4 =
  'machinespirits.tutor-stub.resistance-recovery-semantic-field-local-ensemble.v4';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V4 = Object.freeze([
  'bounded_test_merits_engagement',
  'grounded_precise_jurisdictional_condition',
  'delivered_clarify_distinction',
  'delivered_register',
]);

const CORE_FIELDS = Object.freeze(TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V4.slice(0, 2));
const LEARNER_SOURCES = new Set(['prior_post_trigger', 'current_learner']);
const PRIMARY_VALUES = Object.freeze(['yes', 'no']);
const PANEL_SIZE = 3;
const MAJORITY = 2;
const LABELS = Object.freeze(['yes', 'no', 'indeterminate']);

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function counts(values) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]),
  );
}

function majority(values) {
  const voteCounts = counts(values);
  const winner = Object.entries(voteCounts).find(([, count]) => count >= MAJORITY)?.[0] || null;
  return { winner, vote_counts: voteCounts };
}

function expectedRecovery(judgment) {
  if (CORE_FIELDS.some((field) => judgment?.[field] === 'indeterminate')) return 'indeterminate';
  return CORE_FIELDS.some((field) => judgment?.[field] === 'yes') ? 'yes' : 'no';
}

function fieldLocalIssue(issue) {
  return (
    /^evidence span \d+ recovery classification must cite a post-trigger learner turn$/.test(issue) ||
    /^evidence span \d+ intervention classification must cite the intervention$/.test(issue) ||
    /^(bounded_test_merits_engagement|grounded_precise_jurisdictional_condition|delivered_clarify_distinction|delivered_register) requires exact-span evidence$/.test(
      issue,
    ) ||
    issue === 'final_recovery contradicts the registered endpoint vector'
  );
}

export function normalizeTutorStubResistanceRecoverySemanticEvidenceV4({ publicPacket, response }) {
  if (!response) return null;
  const normalized = structuredClone(response);
  for (const span of normalized.judgment?.evidence_spans || []) {
    const source = publicPacket?.[span.source_id];
    if (typeof source !== 'string' || typeof span.text !== 'string') continue;
    const start = source.indexOf(span.text);
    if (start < 0 || start !== source.lastIndexOf(span.text)) continue;
    span.start_utf16 = start;
    span.end_utf16 = start + span.text.length;
  }
  return normalized;
}

function hasEvidence(response, predicate) {
  return (response?.judgment?.evidence_spans || []).some(predicate);
}

export function validateTutorStubResistanceRecoverySemanticResponseV4({
  caseId,
  publicPacket,
  response,
  registration,
  prompt,
}) {
  if (!response) {
    return {
      response: null,
      base_valid: false,
      primary_valid: false,
      component_validity: Object.fromEntries(
        TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V4.map((field) => [field, false]),
      ),
      issues: ['missing_or_response_free'],
    };
  }
  const normalized = normalizeTutorStubResistanceRecoverySemanticEvidenceV4({ publicPacket, response });
  const legacyValidation = validateTutorStubResistanceRecoverySemanticResponse({
    caseId,
    publicPacket,
    response: normalized,
    registration,
    prompt,
  });
  const baseIssues = legacyValidation.issues.filter((issue) => !fieldLocalIssue(issue));
  const judgment = normalized.judgment || {};
  const confidenceEligible = ['high', 'medium'].includes(judgment.confidence);
  const coreValuesDeterminate = CORE_FIELDS.every((field) => PRIMARY_VALUES.includes(judgment[field]));
  const coreEvidenceValid = CORE_FIELDS.every(
    (field) =>
      judgment[field] !== 'yes' ||
      hasEvidence(normalized, (span) => span.field === field && LEARNER_SOURCES.has(span.source_id)),
  );
  const primaryConsistent =
    PRIMARY_VALUES.includes(judgment.final_recovery) && judgment.final_recovery === expectedRecovery(judgment);
  const baseValid = baseIssues.length === 0;
  const primaryValid =
    baseValid && confidenceEligible && coreValuesDeterminate && coreEvidenceValid && primaryConsistent;
  const componentValidity = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V4.map((field) => {
      let valid = baseValid && confidenceEligible && judgment[field] !== 'indeterminate';
      if (CORE_FIELDS.includes(field) && judgment[field] === 'yes') {
        valid = valid && hasEvidence(normalized, (span) => span.field === field && LEARNER_SOURCES.has(span.source_id));
      }
      if (field === 'delivered_clarify_distinction' && judgment[field] === 'yes') {
        valid = valid && hasEvidence(normalized, (span) => span.source_id === 'intervention');
      }
      if (field === 'delivered_register') {
        valid =
          valid &&
          ['warm', 'plain', 'neither'].includes(judgment[field]) &&
          (judgment[field] === 'neither' || hasEvidence(normalized, (span) => span.source_id === 'intervention'));
      }
      return [field, valid];
    }),
  );
  const issues = [...baseIssues];
  if (!confidenceEligible) issues.push('confidence_not_medium_or_high');
  if (!coreValuesDeterminate) issues.push('core_recovery_fields_not_determinate');
  if (!coreEvidenceValid) issues.push('core_recovery_evidence_not_publicly_anchored');
  if (!primaryConsistent) issues.push('primary_recovery_not_consistent_with_core_fields');
  return {
    response: normalized,
    base_valid: baseValid,
    primary_valid: primaryValid,
    component_validity: componentValidity,
    issues: [...new Set(issues)],
  };
}

function aggregateField(validation, field) {
  const eligible = validation.filter((entry) => entry.component_validity[field]);
  const result = majority(eligible.map((entry) => entry.response.judgment[field]));
  const determinate = result.winner && result.winner !== 'indeterminate';
  return {
    status: determinate ? 'determinate' : 'measurement_indeterminate',
    value: determinate ? result.winner : 'indeterminate',
    vote_counts: result.vote_counts,
    eligible_judges: eligible.map((entry) => entry.judge_id),
    supporting_judges: determinate
      ? eligible.filter((entry) => entry.response.judgment[field] === result.winner).map((entry) => entry.judge_id)
      : [],
  };
}

function abstentionReason(entry) {
  if (!entry.response) return 'missing_or_response_free';
  if (!entry.base_valid) return 'invalid_schema_quote_or_provenance';
  if (!['high', 'medium'].includes(entry.response.judgment?.confidence)) return 'confidence_low_or_invalid';
  if (!entry.primary_valid) return 'primary_recovery_invalid_or_indeterminate';
  return null;
}

export function adjudicateTutorStubResistanceRecoverySemanticJudgesV4({
  caseId,
  publicPacket,
  responses,
  registration,
  prompts,
  advisorySignals = [],
}) {
  const judges = registration?.measurement?.judges || [];
  const supplied = Array.isArray(responses) ? responses : [];
  const registeredIds = new Set(judges.map((judge) => judge.id));
  const suppliedIds = supplied.map((response) => response?.provenance?.judge_id);
  const integrityIssues = [];
  if (judges.length !== PANEL_SIZE) integrityIssues.push('registered_panel_must_have_three_judges');
  if (new Set(suppliedIds).size !== suppliedIds.length || suppliedIds.some((id) => !registeredIds.has(id))) {
    integrityIssues.push('duplicate_or_unregistered_judge');
  }
  const runs = supplied.map((response) => response?.provenance?.independent_run_id);
  if (new Set(runs).size !== runs.length) integrityIssues.push('judge_runs_not_independent');
  const promptHashes = supplied.map((response) => response?.provenance?.prompt_sha256);
  if (new Set(promptHashes).size !== promptHashes.length) integrityIssues.push('judge_prompts_not_independent');
  const packetHashes = supplied.map((response) => response?.provenance?.packet_sha256);
  if (packetHashes.length > 1 && new Set(packetHashes).size !== 1) integrityIssues.push('packet_hashes_disagree');

  const byJudge = new Map(supplied.map((response) => [response?.provenance?.judge_id, response]));
  const validation = judges.map((judge) => ({
    judge_id: judge.id,
    ...validateTutorStubResistanceRecoverySemanticResponseV4({
      caseId,
      publicPacket,
      response: byJudge.get(judge.id),
      registration,
      prompt: prompts?.[judge.id],
    }),
  }));
  const primaryEligible = validation.filter((entry) => entry.primary_valid);
  const primary = majority(primaryEligible.map((entry) => entry.response.judgment.final_recovery));
  const primaryDeterminate =
    integrityIssues.length === 0 &&
    primaryEligible.length >= MAJORITY &&
    primary.winner !== null &&
    PRIMARY_VALUES.includes(primary.winner);
  const componentMeasurement = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V4.map((field) => [field, aggregateField(validation, field)]),
  );
  const abstentions = validation
    .map((entry) => ({ judge_id: entry.judge_id, reason: abstentionReason(entry) }))
    .filter((entry) => entry.reason !== null);
  const common = {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_ENSEMBLE_SCHEMA_V4,
    case_id: caseId,
    advisory_signals: advisorySignals,
    lexical_or_regex_authority: 'none',
    evidence_offset_authority: 'deterministic_unique_exact_quote_derivation',
    component_disagreement_may_veto_primary_recovery: false,
    diagnostic_invalidity_may_veto_primary_recovery: false,
    low_confidence_disposition: 'measurement_indeterminate',
    medium_or_high_determinate_primary_eligible: true,
    repair_allowed: false,
    judge_rerun_after_response_allowed: false,
    unit_rerun_allowed: false,
    replacement_allowed: false,
    outcome_selection_allowed: false,
    validation: validation.map(({ judge_id, base_valid, primary_valid, component_validity, issues }) => ({
      judge_id,
      base_valid,
      primary_valid,
      component_validity,
      issues,
    })),
    abstentions,
    eligible_judges: primaryEligible.map((entry) => entry.judge_id),
    primary_recovery_measurement: {
      status: primaryDeterminate ? 'determinate' : 'measurement_indeterminate',
      value: primaryDeterminate ? primary.winner : 'indeterminate',
      vote_counts: primary.vote_counts,
      majority_required: MAJORITY,
      supporting_judges: primaryDeterminate
        ? primaryEligible
            .filter((entry) => entry.response.judgment.final_recovery === primary.winner)
            .map((entry) => entry.judge_id)
        : [],
    },
    component_measurement: componentMeasurement,
  };
  if (!primaryDeterminate) {
    return {
      ...common,
      status: 'measurement_indeterminate',
      reasons: [
        ...integrityIssues,
        ...(primaryEligible.length < MAJORITY ? ['fewer_than_two_valid_primary_judges'] : []),
        ...(primaryEligible.length >= MAJORITY && primary.winner === null ? ['no_primary_recovery_majority'] : []),
      ],
      judgment: null,
      final_recovery: 'indeterminate',
      fisher_analysis_allowed: false,
    };
  }
  return {
    ...common,
    status: 'determinate',
    reasons: [],
    judgment: {
      ...Object.fromEntries(
        TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V4.map((field) => [field, componentMeasurement[field].value]),
      ),
      final_recovery: primary.winner,
    },
    final_recovery: primary.winner,
    fisher_analysis_allowed: true,
  };
}

function fleissKappa(ratings) {
  if (!ratings.length || ratings.some((row) => row.length !== PANEL_SIZE)) return 0;
  const perCaseAgreement = ratings.map((row) => {
    const categoryCounts = LABELS.map((label) => row.filter((value) => value === label).length);
    return categoryCounts.reduce((sum, count) => sum + count * (count - 1), 0) / 6;
  });
  const shares = LABELS.map(
    (label) => ratings.flat().filter((value) => value === label).length / (ratings.length * PANEL_SIZE),
  );
  const observed = mean(perCaseAgreement);
  const expected = shares.reduce((sum, share) => sum + share * share, 0);
  return expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);
}

function stratum(judgment) {
  if (judgment.bounded_test_merits_engagement === 'yes') {
    return judgment.grounded_precise_jurisdictional_condition === 'yes' ? 'both' : 'merits_only';
  }
  return judgment.grounded_precise_jurisdictional_condition === 'yes' ? 'grounded_only' : 'no_recovery';
}

export function scoreTutorStubResistanceRecoverySemanticCorpusV4({ corpus, responsePairs, registration }) {
  const judges = registration.measurement.judges;
  const rows = corpus.cases.map((corpusCase) => {
    const pair = responsePairs[corpusCase.case_id] || {};
    const publicPacket = Object.fromEntries(
      ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'].map((field) => [
        field,
        corpusCase[field],
      ]),
    );
    const aggregate = adjudicateTutorStubResistanceRecoverySemanticJudgesV4({
      caseId: corpusCase.case_id,
      publicPacket,
      responses: judges.map((judge) => pair[judge.id]?.response).filter(Boolean),
      registration,
      prompts: Object.fromEntries(
        judges.filter((judge) => pair[judge.id]).map((judge) => [judge.id, pair[judge.id].prompt]),
      ),
    });
    const labels = Object.fromEntries(
      judges.map((judge) => {
        const validity = aggregate.validation.find((entry) => entry.judge_id === judge.id);
        return [judge.id, validity?.primary_valid ? pair[judge.id].response.judgment.final_recovery : 'indeterminate'];
      }),
    );
    return { corpusCase, pair, aggregate, labels };
  });
  const positives = rows.filter((row) => row.corpusCase.expected.judgment.final_recovery === 'yes');
  const negatives = rows.filter((row) => row.corpusCase.expected.judgment.final_recovery === 'no');
  const determined = rows.filter((row) => row.aggregate.status === 'determinate');
  const validations = rows.flatMap((row) => row.aggregate.validation);
  const pairwise = [];
  for (let left = 0; left < judges.length; left += 1) {
    for (let right = left + 1; right < judges.length; right += 1) {
      pairwise.push(
        ratio(rows.filter((row) => row.labels[judges[left].id] === row.labels[judges[right].id]).length, rows.length),
      );
    }
  }
  const componentSlots = rows.flatMap((row) =>
    TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V4.map((field) => ({
      field,
      expected: row.corpusCase.expected.judgment[field],
      observed: row.aggregate.component_measurement[field].value,
      determined: row.aggregate.component_measurement[field].status === 'determinate',
    })),
  );
  const strata = ['merits_only', 'grounded_only', 'both', 'no_recovery'];
  const metrics = {
    primary_seat_validity_rate: ratio(
      validations.filter((row) => row.primary_valid).length,
      rows.length * judges.length,
    ),
    panels_with_two_eligible_voters: ratio(
      rows.filter((row) => row.aggregate.eligible_judges.length >= MAJORITY).length,
      rows.length,
    ),
    per_judge_final_recovery_accuracy: Object.fromEntries(
      judges.map((judge) => [
        judge.id,
        ratio(
          rows.filter((row) => row.labels[judge.id] === row.corpusCase.expected.judgment.final_recovery).length,
          rows.length,
        ),
      ]),
    ),
    primary_sensitivity: ratio(
      positives.filter((row) => row.aggregate.final_recovery === 'yes').length,
      positives.length,
    ),
    primary_specificity: ratio(
      negatives.filter((row) => row.aggregate.final_recovery === 'no').length,
      negatives.length,
    ),
    primary_exact_accuracy: ratio(
      rows.filter((row) => row.aggregate.final_recovery === row.corpusCase.expected.judgment.final_recovery).length,
      rows.length,
    ),
    primary_determined_coverage_overall: ratio(determined.length, rows.length),
    primary_determined_coverage_by_stratum: Object.fromEntries(
      strata.map((name) => {
        const selected = rows.filter((row) => stratum(row.corpusCase.expected.judgment) === name);
        return [name, ratio(selected.filter((row) => row.aggregate.status === 'determinate').length, selected.length)];
      }),
    ),
    aggregate_component_accuracy: ratio(
      componentSlots.filter((slot) => slot.determined && slot.observed === slot.expected).length,
      componentSlots.length,
    ),
    aggregate_component_determined_coverage: ratio(
      componentSlots.filter((slot) => slot.determined).length,
      componentSlots.length,
    ),
    action_classification_accuracy: ratio(
      componentSlots.filter(
        (slot) => slot.field === 'delivered_clarify_distinction' && slot.determined && slot.observed === slot.expected,
      ).length,
      rows.length,
    ),
    register_classification_accuracy: ratio(
      componentSlots.filter(
        (slot) => slot.field === 'delivered_register' && slot.determined && slot.observed === slot.expected,
      ).length,
      rows.length,
    ),
    mean_pairwise_recovery_agreement: mean(pairwise),
    pairwise_recovery_agreement: pairwise,
    multi_rater_recovery_kappa: fleissKappa(rows.map((row) => judges.map((judge) => row.labels[judge.id]))),
    primary_indeterminate_cases: rows.length - determined.length,
    prohibited_tool_events: rows.reduce(
      (sum, row) =>
        sum +
        judges.reduce(
          (judgeSum, judge) => judgeSum + Number(row.pair[judge.id]?.response?.provenance?.prohibited_tool_events || 0),
          0,
        ),
      0,
    ),
  };
  const gates = registration.measurement.validationGates;
  const passed =
    metrics.primary_seat_validity_rate >= gates.minimumPrimarySeatValidityRate &&
    metrics.panels_with_two_eligible_voters >= gates.minimumPanelsWithTwoEligibleVoters &&
    Object.values(metrics.per_judge_final_recovery_accuracy).every(
      (value) => value >= gates.minimumPerJudgeFinalRecoveryAccuracy,
    ) &&
    metrics.primary_sensitivity >= gates.minimumPrimarySensitivity &&
    metrics.primary_specificity >= gates.minimumPrimarySpecificity &&
    metrics.primary_exact_accuracy >= gates.minimumPrimaryExactAccuracy &&
    metrics.primary_determined_coverage_overall >= gates.minimumPrimaryDeterminedCoverageOverall &&
    Object.values(metrics.primary_determined_coverage_by_stratum).every(
      (value) => value >= gates.minimumPrimaryDeterminedCoveragePerStratum,
    ) &&
    metrics.aggregate_component_accuracy >= gates.minimumAggregateComponentAccuracy &&
    metrics.aggregate_component_determined_coverage >= gates.minimumAggregateComponentDeterminedCoverage &&
    metrics.action_classification_accuracy >= gates.minimumActionClassificationAccuracy &&
    metrics.register_classification_accuracy >= gates.minimumRegisterClassificationAccuracy &&
    metrics.mean_pairwise_recovery_agreement >= gates.minimumMeanPairwiseRecoveryAgreement &&
    metrics.multi_rater_recovery_kappa >= gates.minimumMultiRaterRecoveryKappa &&
    metrics.prohibited_tool_events <= gates.maximumProhibitedToolEvents;
  return { status: passed ? 'passed' : 'failed', cases: rows.length, metrics };
}
