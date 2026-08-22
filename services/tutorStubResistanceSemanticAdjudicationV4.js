import {
  TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3,
  validateTutorStubResistanceSemanticResponseV3,
} from './tutorStubResistanceSemanticAdjudicationV3.js';

// V4 changes only the panel rule. The independently elicited, quote-anchored
// V3 judge response remains frozen because the V3 validation showed that its
// primary semantic label was reliable (Sol 80/80; Sonnet 74/80). The failed
// part was the V3 panel rule: any component disagreement vetoed a shared
// primary label. V4 therefore treats the primary label and each diagnostic
// component as separate hierarchical measurements.

export const TUTOR_STUB_RESISTANCE_SEMANTIC_ENSEMBLE_SCHEMA_V4 =
  'machinespirits.tutor-stub.resistance-semantic-hierarchical-ensemble.v4';
export const TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V4 = 'prospective_frame_resistance_semantic_v4';

const FINAL_LABELS = Object.freeze(['frame_refuser', 'frame_defiant_or_productive_dispute', 'neither']);
const PANEL_SIZE = 3;
const MAJORITY = 2;

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
  if (entry.response.judgment?.final_label === 'indeterminate') return 'judge_indeterminate';
  return null;
}

function aggregateComponent(eligible, field) {
  const votes = eligible.map((entry) => entry.response.judgment[field]);
  const result = majority(votes);
  return {
    status: result.winner ? 'determinate' : 'measurement_indeterminate',
    value: result.winner || 'indeterminate',
    vote_counts: result.vote_counts,
    supporting_judges: result.winner
      ? eligible.filter((entry) => entry.response.judgment[field] === result.winner).map((entry) => entry.judge_id)
      : [],
  };
}

function primaryLabelFromVector(judgment) {
  if (TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.some((field) => judgment[field] === 'indeterminate')) {
    return 'indeterminate';
  }
  if (
    judgment.jurisdiction_dispute === 'yes' &&
    judgment.licensed_participation === 'no' &&
    judgment.participation_withholding === 'yes' &&
    judgment.productive_counterframing === 'no'
  ) {
    return 'frame_refuser';
  }
  if (
    judgment.jurisdiction_dispute === 'yes' &&
    judgment.licensed_participation === 'yes' &&
    judgment.productive_counterframing === 'yes'
  ) {
    return 'frame_defiant_or_productive_dispute';
  }
  return 'neither';
}

export function adjudicateTutorStubResistanceSemanticJudgesV4({
  source,
  publicContext,
  caseId,
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
  if (new Set(independentRuns).size !== independentRuns.length) {
    integrityIssues.push('judge_runs_not_independent');
  }
  const promptHashes = supplied.map((response) => response?.provenance?.prompt_sha256);
  if (new Set(promptHashes).size !== promptHashes.length) {
    integrityIssues.push('judge_prompts_not_independent');
  }
  const sourceHashes = supplied.map((response) => response?.provenance?.source_sha256);
  if (sourceHashes.length > 1 && new Set(sourceHashes).size !== 1) {
    integrityIssues.push('source_hashes_disagree');
  }

  const byJudge = new Map(supplied.map((response) => [response?.provenance?.judge_id, response]));
  const validation = judges.map((judge) => {
    const response = byJudge.get(judge.id);
    return {
      judge_id: judge.id,
      response,
      ...validateTutorStubResistanceSemanticResponseV3({
        source,
        publicContext,
        caseId,
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
  const primaryVotes = eligible.map((entry) => entry.response.judgment.final_label);
  const primary = majority(primaryVotes);
  const primaryDeterminate =
    integrityIssues.length === 0 &&
    eligible.length >= MAJORITY &&
    primary.winner !== null &&
    FINAL_LABELS.includes(primary.winner);

  const component_measurement = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [field, aggregateComponent(eligible, field)]),
  );
  const componentJudgment = Object.fromEntries(
    TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.map((field) => [field, component_measurement[field].value]),
  );
  const boundary = {
    schema: TUTOR_STUB_RESISTANCE_SEMANTIC_ENSEMBLE_SCHEMA_V4,
    advisory_signals: advisorySignals,
    lexical_or_regex_authority: 'none',
    component_disagreement_may_veto_primary_label: false,
    repair_allowed: false,
    judge_rerun_after_response_allowed: false,
    unit_rerun_allowed: false,
    replacement_allowed: false,
    outcome_selection_allowed: false,
  };
  const common = {
    case_id: caseId,
    ...boundary,
    validation: validation.map(({ judge_id, valid, issues }) => ({ judge_id, valid, issues })),
    abstentions,
    eligible_judges: eligible.map((entry) => entry.judge_id),
    primary_label_measurement: {
      status: primaryDeterminate ? 'determinate' : 'measurement_indeterminate',
      value: primaryDeterminate ? primary.winner : 'indeterminate',
      vote_counts: primary.vote_counts,
      majority_required: MAJORITY,
      supporting_judges: primaryDeterminate
        ? eligible
            .filter((entry) => entry.response.judgment.final_label === primary.winner)
            .map((entry) => entry.judge_id)
        : [],
    },
    component_measurement,
  };

  if (!primaryDeterminate) {
    const reasons = [...integrityIssues];
    if (eligible.length < MAJORITY) reasons.push('fewer_than_two_valid_high_confidence_judges');
    if (eligible.length >= MAJORITY && primary.winner === null) reasons.push('no_primary_label_majority');
    return {
      ...common,
      status: 'measurement_indeterminate',
      reasons: [...new Set(reasons)],
      judgment: null,
      final_label: 'indeterminate',
    };
  }

  const judgment = { ...componentJudgment, final_label: primary.winner };
  const vectorLabel = primaryLabelFromVector(componentJudgment);
  return {
    ...common,
    status: 'determinate',
    reasons: [],
    judgment,
    final_label: primary.winner,
    component_vector_diagnostic: {
      implied_label: vectorLabel,
      agrees_with_primary: vectorLabel === primary.winner,
      required_for_primary_determination: false,
      indeterminate_fields: TUTOR_STUB_RESISTANCE_SEMANTIC_FIELDS_V3.filter(
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

export function validateTutorStubResistanceSemanticRegistrationV4(registration) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-semantic-adjudication-registration.v4' ||
    registration?.version !== 4 ||
    registration?.status !== 'hierarchical_ensemble_frozen_pending_independent_v4_heldout'
  ) {
    issues.push('v4 registration identity drifted');
  }
  if (registration?.observationSemantics !== TUTOR_STUB_RESISTANCE_SEMANTIC_OBSERVATION_V4) {
    issues.push('v4 observation semantics drifted');
  }
  if (
    registration?.instrument?.ensembleImplementationPath !== 'services/tutorStubResistanceSemanticAdjudicationV4.js' ||
    registration?.instrument?.seatImplementationPath !== 'services/tutorStubResistanceSemanticAdjudicationV3.js' ||
    registration?.instrument?.seatImplementationSha256 !==
      'a66a16c4ea80a831065234507be8308d8e3ac3cf9d6de4a0e49395c8164fa7ff' ||
    registration?.instrument?.seatResponseSchemaSha256 !==
      '4840ef6ebc5135d98aeb3d70d5a22416601a62fe1dc6bb3c225c05e606673033' ||
    registration?.instrument?.developmentEvidenceSha256 !==
      '326911439429c4529f933593794b397247185555b9d59ccc0798fe14d488441e'
  ) {
    issues.push('v4 frozen instrument binding drifted');
  }
  const judges = registration?.measurement?.judges || [];
  const exactRoutes = [
    ['semantic_judge_a', 'codex.gpt-5.6-sol', 'codex', 'gpt-5.6-sol'],
    ['semantic_judge_b', 'claude-code.sonnet-5', 'claude-code', 'claude-sonnet-5'],
    ['semantic_judge_c', 'codex.gpt-5.5', 'codex', 'gpt-5.5'],
  ];
  if (
    judges.length !== PANEL_SIZE ||
    exactRoutes.some(
      ([id, modelRef, provider, model], index) =>
        judges[index]?.id !== id ||
        judges[index]?.modelRef !== modelRef ||
        judges[index]?.provider !== provider ||
        judges[index]?.model !== model ||
        judges[index]?.effort !== 'low' ||
        judges[index]?.independent !== true,
    )
  ) {
    issues.push('v4 judge panel drifted');
  }
  const consensus = registration?.measurement?.hierarchicalConsensus || {};
  if (
    consensus.primaryLabelRule !== 'two_of_three_valid_high_confidence_judge_labels' ||
    consensus.componentRule !== 'two_of_three_valid_high_confidence_field_values_independently' ||
    consensus.componentDisagreementMayVetoPrimaryLabel !== false ||
    consensus.invalidLowConfidenceOrMissingDisposition !== 'judge_abstention' ||
    consensus.noPrimaryMajorityDisposition !== 'measurement_indeterminate' ||
    consensus.classifierOrRegexTiebreaker !== false
  ) {
    issues.push('v4 hierarchical consensus drifted');
  }
  if (
    registration?.heldoutFreezeProtocol?.authoredAfterInstrumentFreezeCommit !== true ||
    registration?.heldoutFreezeProtocol?.v1V2V3TextOrGoldEligibleForV4 !== false ||
    registration?.heldoutFreezeProtocol?.postHeldoutInstrumentOrGateTuning !== false ||
    registration?.authorization?.validationModelCallsAuthorized !== false ||
    registration?.authorization?.confirmationModelCallsAuthorized !== false
  ) {
    issues.push('v4 heldout or authorization boundary drifted');
  }
  return { valid: issues.length === 0, issues };
}
