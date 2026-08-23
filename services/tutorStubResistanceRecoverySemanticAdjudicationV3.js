import {
  buildTutorStubResistanceRecoverySemanticPrompt,
  buildTutorStubResistanceRecoverySemanticZeroCallFixture,
  validateTutorStubResistanceRecoverySemanticResponse,
} from './tutorStubResistanceRecoverySemanticAdjudicationV2.js';

// V3 preserves the independently elicited, quote-anchored V2 seat prompt and
// response schema. It changes only the panel rule after the manipulation V3
// validation demonstrated that whole-vector unanimity can destroy otherwise
// valid semantic measurements. The primary recovery judgment and every
// diagnostic field are therefore aggregated independently.

export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_ENSEMBLE_SCHEMA_V3 =
  'machinespirits.tutor-stub.resistance-recovery-semantic-hierarchical-ensemble.v3';
export const TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V3 = Object.freeze([
  'bounded_test_merits_engagement',
  'grounded_precise_jurisdictional_condition',
  'delivered_clarify_distinction',
  'delivered_register',
]);

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

function abstentionReason(entry) {
  if (!entry.response) return 'missing_or_response_free';
  if (!entry.valid) return 'invalid_schema_span_or_provenance';
  if (entry.response.judgment?.confidence !== 'high') return 'confidence_not_high';
  if (entry.response.judgment?.final_recovery === 'indeterminate') return 'judge_indeterminate';
  return null;
}

function aggregateField(eligible, field) {
  const result = majority(eligible.map((entry) => entry.response.judgment[field]));
  return {
    status: result.winner && result.winner !== 'indeterminate' ? 'determinate' : 'measurement_indeterminate',
    value: result.winner && result.winner !== 'indeterminate' ? result.winner : 'indeterminate',
    vote_counts: result.vote_counts,
    supporting_judges:
      result.winner && result.winner !== 'indeterminate'
        ? eligible.filter((entry) => entry.response.judgment[field] === result.winner).map((entry) => entry.judge_id)
        : [],
  };
}

function impliedRecovery(componentJudgment) {
  const core = [
    componentJudgment.bounded_test_merits_engagement,
    componentJudgment.grounded_precise_jurisdictional_condition,
  ];
  if (core.includes('indeterminate')) return 'indeterminate';
  return core.includes('yes') ? 'yes' : 'no';
}

export function adjudicateTutorStubResistanceRecoverySemanticJudgesV3({
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
  if (new Set(suppliedIds).size !== suppliedIds.length || suppliedIds.some((judgeId) => !registeredIds.has(judgeId))) {
    integrityIssues.push('duplicate_or_unregistered_judge');
  }
  const independentRuns = supplied.map((response) => response?.provenance?.independent_run_id);
  if (new Set(independentRuns).size !== independentRuns.length) integrityIssues.push('judge_runs_not_independent');
  const promptHashes = supplied.map((response) => response?.provenance?.prompt_sha256);
  if (new Set(promptHashes).size !== promptHashes.length) integrityIssues.push('judge_prompts_not_independent');
  const packetHashes = supplied.map((response) => response?.provenance?.packet_sha256);
  if (packetHashes.length > 1 && new Set(packetHashes).size !== 1) integrityIssues.push('packet_hashes_disagree');

  const byJudge = new Map(supplied.map((response) => [response?.provenance?.judge_id, response]));
  const validation = judges.map((judge) => {
    const response = byJudge.get(judge.id);
    return {
      judge_id: judge.id,
      response,
      ...validateTutorStubResistanceRecoverySemanticResponse({
        caseId,
        publicPacket,
        response,
        registration,
        prompt: prompts?.[judge.id],
      }),
    };
  });
  const eligible = validation.filter((entry) => abstentionReason(entry) === null);
  const abstentions = validation
    .map((entry) => ({ judge_id: entry.judge_id, reason: abstentionReason(entry) }))
    .filter((entry) => entry.reason !== null);
  const primary = majority(eligible.map((entry) => entry.response.judgment.final_recovery));
  const primaryDeterminate =
    integrityIssues.length === 0 &&
    eligible.length >= MAJORITY &&
    primary.winner !== null &&
    PRIMARY_VALUES.includes(primary.winner);
  const component_measurement = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V3.map((field) => [field, aggregateField(eligible, field)]),
  );
  const componentJudgment = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V3.map((field) => [field, component_measurement[field].value]),
  );
  const common = {
    schema: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_ENSEMBLE_SCHEMA_V3,
    case_id: caseId,
    advisory_signals: advisorySignals,
    lexical_or_regex_authority: 'none',
    component_disagreement_may_veto_primary_recovery: false,
    repair_allowed: false,
    judge_rerun_after_response_allowed: false,
    unit_rerun_allowed: false,
    replacement_allowed: false,
    outcome_selection_allowed: false,
    validation: validation.map(({ judge_id, valid, issues }) => ({ judge_id, valid, issues })),
    abstentions,
    eligible_judges: eligible.map((entry) => entry.judge_id),
    primary_recovery_measurement: {
      status: primaryDeterminate ? 'determinate' : 'measurement_indeterminate',
      value: primaryDeterminate ? primary.winner : 'indeterminate',
      vote_counts: primary.vote_counts,
      majority_required: MAJORITY,
      supporting_judges: primaryDeterminate
        ? eligible
            .filter((entry) => entry.response.judgment.final_recovery === primary.winner)
            .map((entry) => entry.judge_id)
        : [],
    },
    component_measurement,
  };
  if (!primaryDeterminate) {
    const reasons = [...integrityIssues];
    if (eligible.length < MAJORITY) reasons.push('fewer_than_two_valid_high_confidence_judges');
    if (eligible.length >= MAJORITY && primary.winner === null) reasons.push('no_primary_recovery_majority');
    return {
      ...common,
      status: 'measurement_indeterminate',
      reasons: [...new Set(reasons)],
      judgment: null,
      final_recovery: 'indeterminate',
      fisher_analysis_allowed: false,
    };
  }
  const judgment = { ...componentJudgment, final_recovery: primary.winner };
  const diagnosticRecovery = impliedRecovery(componentJudgment);
  return {
    ...common,
    status: 'determinate',
    reasons: [],
    judgment,
    final_recovery: primary.winner,
    fisher_analysis_allowed: true,
    component_vector_diagnostic: {
      implied_recovery: diagnosticRecovery,
      agrees_with_primary: diagnosticRecovery === primary.winner,
      required_for_primary_determination: false,
      indeterminate_fields: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V3.filter(
        (field) => component_measurement[field].status === 'measurement_indeterminate',
      ),
    },
    judge_evidence: eligible.map((entry) => ({
      judge_id: entry.judge_id,
      evidence_spans: entry.response.judgment.evidence_spans,
      confidence: entry.response.judgment.confidence,
    })),
  };
}

function fleissKappa(ratings) {
  if (!ratings.length || ratings.some((row) => row.length !== PANEL_SIZE)) return 0;
  const perCaseAgreement = ratings.map((row) => {
    const categoryCounts = LABELS.map((label) => row.filter((value) => value === label).length);
    return categoryCounts.reduce((sum, count) => sum + count * (count - 1), 0) / 6;
  });
  const totalRatings = ratings.length * PANEL_SIZE;
  const shares = LABELS.map((label) => ratings.flat().filter((value) => value === label).length / totalRatings);
  const observed = mean(perCaseAgreement);
  const expected = shares.reduce((sum, share) => sum + share * share, 0);
  return expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);
}

function eligibleLabel(aggregate, pair, judgeId) {
  const validation = aggregate.validation.find((row) => row.judge_id === judgeId);
  const response = pair[judgeId]?.response;
  return validation?.valid &&
    response?.judgment?.confidence === 'high' &&
    response.judgment.final_recovery !== 'indeterminate'
    ? response.judgment.final_recovery
    : 'indeterminate';
}

function stratum(judgment) {
  if (judgment.bounded_test_merits_engagement === 'yes') {
    return judgment.grounded_precise_jurisdictional_condition === 'yes' ? 'both' : 'merits_only';
  }
  return judgment.grounded_precise_jurisdictional_condition === 'yes' ? 'grounded_only' : 'no_recovery';
}

export function scoreTutorStubResistanceRecoverySemanticCorpusV3({ corpus, responsePairs, registration }) {
  const judges = registration.measurement.judges;
  const rows = corpus.cases.map((corpusCase) => {
    const pair = responsePairs[corpusCase.case_id] || {};
    const publicPacket = Object.fromEntries(
      ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'].map((field) => [
        field,
        corpusCase[field],
      ]),
    );
    const aggregate = adjudicateTutorStubResistanceRecoverySemanticJudgesV3({
      caseId: corpusCase.case_id,
      publicPacket,
      responses: judges.map((judge) => pair[judge.id]?.response).filter(Boolean),
      registration,
      prompts: Object.fromEntries(
        judges.filter((judge) => pair[judge.id]).map((judge) => [judge.id, pair[judge.id].prompt]),
      ),
    });
    const labels = Object.fromEntries(judges.map((judge) => [judge.id, eligibleLabel(aggregate, pair, judge.id)]));
    return { corpusCase, pair, aggregate, labels };
  });
  const positives = rows.filter((row) => row.corpusCase.expected.judgment.final_recovery === 'yes');
  const negatives = rows.filter((row) => row.corpusCase.expected.judgment.final_recovery === 'no');
  const determined = rows.filter((row) => row.aggregate.status === 'determinate');
  const validations = rows.flatMap((row) => row.aggregate.validation);
  const pairwiseAgreements = [];
  for (let left = 0; left < judges.length; left += 1) {
    for (let right = left + 1; right < judges.length; right += 1) {
      pairwiseAgreements.push(
        ratio(rows.filter((row) => row.labels[judges[left].id] === row.labels[judges[right].id]).length, rows.length),
      );
    }
  }
  const componentSlots = rows.flatMap((row) =>
    TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V3.map((field) => ({
      field,
      expected: row.corpusCase.expected.judgment[field],
      observed: row.aggregate.component_measurement[field].value,
      determined: row.aggregate.component_measurement[field].status === 'determinate',
    })),
  );
  const strata = ['merits_only', 'grounded_only', 'both', 'no_recovery'];
  const metrics = {
    judgment_validity_rate: ratio(validations.filter((row) => row.valid).length, rows.length * judges.length),
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
    mean_pairwise_recovery_agreement: mean(pairwiseAgreements),
    pairwise_recovery_agreement: pairwiseAgreements,
    multi_rater_recovery_kappa: fleissKappa(rows.map((row) => judges.map((judge) => row.labels[judge.id]))),
    primary_indeterminate_cases: rows.length - determined.length,
    abstaining_judgments: rows.reduce((sum, row) => sum + row.aggregate.abstentions.length, 0),
    invalid_judgments: validations.filter((row) => !row.valid).length,
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
    metrics.judgment_validity_rate >= gates.minimumJudgmentValidityRate &&
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
  return {
    status: passed ? 'passed' : 'failed',
    corpus_id: corpus.corpus_id,
    cases: rows.length,
    metrics,
    rows: rows.map((row) => ({
      case_id: row.corpusCase.case_id,
      expected: row.corpusCase.expected.judgment.final_recovery,
      observed: row.aggregate.final_recovery,
      status: row.aggregate.status,
      component_indeterminate_fields: TUTOR_STUB_RESISTANCE_RECOVERY_SEMANTIC_FIELDS_V3.filter(
        (field) => row.aggregate.component_measurement[field].status === 'measurement_indeterminate',
      ),
    })),
  };
}

export { buildTutorStubResistanceRecoverySemanticPrompt, buildTutorStubResistanceRecoverySemanticZeroCallFixture };
