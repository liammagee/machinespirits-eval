import { TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3 } from './tutorStubResistanceSemanticAdjudicationV3.js';
import { adjudicateTutorStubResistanceSemanticJudgesV4 } from './tutorStubResistanceSemanticAdjudicationV4.js';

const LABELS = ['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither', 'indeterminate'];

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function fleissKappa(ratings) {
  if (!ratings.length || ratings.some((row) => row.length !== 3)) return 0;
  const perCaseAgreement = ratings.map((row) => {
    const counts = LABELS.map((label) => row.filter((value) => value === label).length);
    return counts.reduce((sum, count) => sum + count * (count - 1), 0) / 6;
  });
  const totalRatings = ratings.length * 3;
  const categoryShares = LABELS.map((label) => ratings.flat().filter((value) => value === label).length / totalRatings);
  const observed = mean(perCaseAgreement);
  const expected = categoryShares.reduce((sum, share) => sum + share * share, 0);
  return expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);
}

function eligibleLabel(result, pair, judgeId) {
  const validation = result.validation.find((row) => row.judge_id === judgeId);
  const response = pair[judgeId]?.response;
  return validation?.valid &&
    response?.judgment?.confidence === 'high' &&
    response.judgment.final_label !== 'indeterminate'
    ? response.judgment.final_label
    : 'indeterminate';
}

export function scoreTutorStubResistanceSemanticCorpusV4({ corpus, responsePairs, registration }) {
  const judges = registration.measurement.judges;
  const rows = corpus.cases.map((corpusCase) => {
    const pair = responsePairs[corpusCase.case_id] || {};
    const result = adjudicateTutorStubResistanceSemanticJudgesV4({
      source: corpusCase.source,
      publicContext: corpusCase.public_context,
      caseId: corpusCase.case_id,
      responses: judges.map((judge) => pair[judge.id]?.response).filter(Boolean),
      registration,
      prompts: Object.fromEntries(
        judges.filter((judge) => pair[judge.id]).map((judge) => [judge.id, pair[judge.id].prompt]),
      ),
    });
    const labels = Object.fromEntries(judges.map((judge) => [judge.id, eligibleLabel(result, pair, judge.id)]));
    return { corpusCase, pair, result, labels };
  });
  const positives = rows.filter((row) => row.corpusCase.expected.label === 'frame_refuser');
  const productive = rows.filter((row) => row.corpusCase.expected.label === 'frame_defiant_or_productive_dispute');
  const negatives = rows.filter((row) => row.corpusCase.expected.label !== 'frame_refuser');
  const determined = rows.filter((row) => row.result.status === 'determinate');
  const validations = rows.flatMap((row) => row.result.validation);
  const pairwiseAgreements = [];
  for (let left = 0; left < judges.length; left += 1) {
    for (let right = left + 1; right < judges.length; right += 1) {
      pairwiseAgreements.push(
        ratio(rows.filter((row) => row.labels[judges[left].id] === row.labels[judges[right].id]).length, rows.length),
      );
    }
  }
  const componentSlots = rows.flatMap((row) =>
    TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => ({
      expected: row.corpusCase.expected.judgment[field],
      observed: row.result.component_measurement[field].value,
      determined: row.result.component_measurement[field].status === 'determinate',
    })),
  );
  const ratings = rows.map((row) => judges.map((judge) => row.labels[judge.id]));
  const metrics = {
    judgment_validity_rate: ratio(validations.filter((row) => row.valid).length, rows.length * judges.length),
    panels_with_two_eligible_voters: ratio(
      rows.filter((row) => row.result.eligible_judges.length >= 2).length,
      rows.length,
    ),
    per_judge_exact_label_accuracy: Object.fromEntries(
      judges.map((judge) => [
        judge.id,
        ratio(rows.filter((row) => row.labels[judge.id] === row.corpusCase.expected.label).length, rows.length),
      ]),
    ),
    primary_sensitivity: ratio(
      positives.filter((row) => row.result.final_label === 'frame_refuser').length,
      positives.length,
    ),
    primary_specificity: ratio(
      negatives.filter((row) => row.result.status === 'determinate' && row.result.final_label !== 'frame_refuser')
        .length,
      negatives.length,
    ),
    primary_exact_label_accuracy: ratio(
      rows.filter((row) => row.result.final_label === row.corpusCase.expected.label).length,
      rows.length,
    ),
    primary_productive_dispute_recall: ratio(
      productive.filter((row) => row.result.final_label === 'frame_defiant_or_productive_dispute').length,
      productive.length,
    ),
    primary_determined_coverage_overall: ratio(determined.length, rows.length),
    primary_determined_coverage_by_class: Object.fromEntries(
      LABELS.slice(0, 3).map((label) => {
        const classRows = rows.filter((row) => row.corpusCase.expected.label === label);
        return [label, ratio(classRows.filter((row) => row.result.status === 'determinate').length, classRows.length)];
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
    mean_pairwise_label_agreement: mean(pairwiseAgreements),
    pairwise_label_agreement: pairwiseAgreements,
    multi_rater_kappa: fleissKappa(ratings),
    primary_indeterminate_cases: rows.length - determined.length,
    abstaining_judgments: rows.reduce((sum, row) => sum + row.result.abstentions.length, 0),
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
    Object.values(metrics.per_judge_exact_label_accuracy).every(
      (accuracy) => accuracy >= gates.minimumPerJudgeExactLabelAccuracy,
    ) &&
    metrics.primary_sensitivity >= gates.minimumPrimarySensitivity &&
    metrics.primary_specificity >= gates.minimumPrimarySpecificity &&
    metrics.primary_exact_label_accuracy >= gates.minimumPrimaryExactLabelAccuracy &&
    metrics.primary_productive_dispute_recall >= gates.minimumPrimaryProductiveDisputeRecall &&
    metrics.primary_determined_coverage_overall >= gates.minimumPrimaryDeterminedCoverageOverall &&
    Object.values(metrics.primary_determined_coverage_by_class).every(
      (coverage) => coverage >= gates.minimumPrimaryDeterminedCoveragePerClass,
    ) &&
    metrics.aggregate_component_accuracy >= gates.minimumAggregateComponentAccuracy &&
    metrics.aggregate_component_determined_coverage >= gates.minimumAggregateComponentDeterminedCoverage &&
    metrics.mean_pairwise_label_agreement >= gates.minimumMeanPairwiseLabelAgreement &&
    metrics.multi_rater_kappa >= gates.minimumMultiRaterKappa &&
    metrics.prohibited_tool_events <= gates.maximumProhibitedToolEvents;
  return {
    status: passed ? 'passed' : 'failed',
    corpus_id: corpus.corpus_id,
    cases: rows.length,
    metrics,
    rows: rows.map((row) => ({
      case_id: row.corpusCase.case_id,
      expected: row.corpusCase.expected.label,
      observed: row.result.final_label,
      status: row.result.status,
      component_indeterminate_fields: TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.filter(
        (field) => row.result.component_measurement[field].status === 'measurement_indeterminate',
      ),
    })),
  };
}
