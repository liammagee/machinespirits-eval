import {
  TUTOR_STUB_RESISTANCE_MEASUREMENT_PANEL_SCHEMA_V8,
  validateTutorStubResistanceFidelityResponseV8,
  validateTutorStubResistanceRecoveryPrimaryResponseV8,
} from './tutorStubResistanceRecoverySemanticAdjudicationV8.js';

const PRIMARY_FIELDS = ['bounded_test_merits_engagement', 'grounded_precise_jurisdictional_condition'];

function integrityIssues(judges, responses, instrument) {
  const supplied = Array.isArray(responses) ? responses : [];
  const registered = new Set(judges.map((judge) => judge.id));
  const ids = supplied.map((row) => row?.provenance?.judge_id);
  const runs = supplied.map((row) => row?.provenance?.independent_run_id);
  const prompts = supplied.map((row) => row?.provenance?.prompt_sha256);
  const packets = supplied.map((row) => row?.provenance?.packet_sha256);
  const issues = [];
  if (judges.length !== 2) issues.push('registered_panel_must_have_two_judges');
  if (supplied.length !== 2) issues.push('exactly_two_responses_required');
  if (new Set(ids).size !== ids.length || ids.some((id) => !registered.has(id))) {
    issues.push('duplicate_or_unregistered_judge');
  }
  if (new Set(runs).size !== runs.length) issues.push('judge_runs_not_independent');
  if (new Set(prompts).size !== prompts.length) issues.push('judge_prompts_not_independent');
  if (packets.length > 1 && new Set(packets).size !== 1) issues.push('packet_hashes_disagree');
  if (supplied.some((row) => row?.provenance?.instrument !== instrument)) {
    issues.push('instrument_provenance_drifted');
  }
  return issues;
}

function counts(values) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]),
  );
}

function exactAgreement(values) {
  return values.length === 2 && values[0] === values[1] ? values[0] : null;
}

function primaryComponent(validation, field, integrity) {
  const eligible = validation.filter((row) => row.component_eligibility[field]);
  const values = eligible.map((row) => row.component_values[field]);
  const value = integrity.length === 0 ? exactAgreement(values) : null;
  return {
    status: value ? 'determinate' : 'measurement_indeterminate',
    value: value || 'indeterminate',
    vote_counts: counts(values),
    eligible_judges: eligible.map((row) => row.judge_id),
  };
}

export function adjudicateTutorStubResistanceRecoveryPrimaryPanelV9({
  caseId,
  publicPacket,
  responses,
  registration,
  prompts,
}) {
  const judges = registration?.measurement?.judges || [];
  const integrity = integrityIssues(judges, responses, 'primary_recovery');
  const byJudge = new Map((responses || []).map((response) => [response?.provenance?.judge_id, response]));
  const validation = judges.map((judge) => ({
    judge_id: judge.id,
    response: byJudge.get(judge.id) || null,
    ...validateTutorStubResistanceRecoveryPrimaryResponseV8({
      caseId,
      publicPacket,
      response: byJudge.get(judge.id),
      judge,
      prompt: prompts?.[judge.id],
    }),
  }));
  const eligible = validation.filter((row) => row.eligible);
  const votes = eligible.map((row) => row.derived_primary_value);
  const winner = integrity.length === 0 ? exactAgreement(votes) : null;
  const component_measurement = Object.fromEntries(
    PRIMARY_FIELDS.map((field) => [field, primaryComponent(validation, field, integrity)]),
  );
  return {
    schema: TUTOR_STUB_RESISTANCE_MEASUREMENT_PANEL_SCHEMA_V8,
    panel_version: 9,
    instrument: 'primary_recovery',
    case_id: caseId,
    status: winner ? 'determinate' : 'measurement_indeterminate',
    final_recovery: winner || 'indeterminate',
    primary_recovery_measurement: {
      status: winner ? 'determinate' : 'measurement_indeterminate',
      value: winner || 'indeterminate',
      vote_counts: counts(votes),
      exact_agreement_required: 2,
      eligible_judges: eligible.map((row) => row.judge_id),
    },
    component_measurement,
    validation: validation.map(
      ({ judge_id, valid, eligible: seatEligible, derived_primary_value, component_eligibility, issues }) => ({
        judge_id,
        valid,
        eligible: seatEligible,
        derived_primary_value,
        component_eligibility,
        issues,
      }),
    ),
    integrity_issues: integrity,
    reasons: [
      ...integrity,
      ...(eligible.length < 2 ? ['fewer_than_two_eligible_primary_judges'] : []),
      ...(eligible.length === 2 && !winner ? ['binary_primary_disagreement'] : []),
    ],
    component_disagreement_may_veto_primary: false,
    fidelity_may_veto_primary_measurement: false,
    repair_rerun_replacement_or_selection_allowed: false,
  };
}

function fidelityComponent(validation, field, project, integrity) {
  const eligible = validation.filter((row) => row.component_eligibility[field]);
  const rawValues = eligible.map((row) => row.component_values[field]);
  const values = rawValues.map(project);
  const value = integrity.length === 0 ? exactAgreement(values) : null;
  return {
    status: value ? 'determinate' : 'measurement_indeterminate',
    value: value || 'indeterminate',
    vote_counts: counts(values),
    raw_vote_counts: counts(rawValues),
    eligible_judges: eligible.map((row) => row.judge_id),
  };
}

export function adjudicateTutorStubResistanceFidelityPanelV9({
  caseId,
  intervention,
  responses,
  registration,
  prompts,
}) {
  const judges = registration?.measurement?.judges || [];
  const integrity = integrityIssues(judges, responses, 'intervention_fidelity');
  const byJudge = new Map((responses || []).map((response) => [response?.provenance?.judge_id, response]));
  const validation = judges.map((judge) => ({
    judge_id: judge.id,
    response: byJudge.get(judge.id) || null,
    ...validateTutorStubResistanceFidelityResponseV8({
      caseId,
      intervention,
      response: byJudge.get(judge.id),
      judge,
      prompt: prompts?.[judge.id],
    }),
  }));
  const action = fidelityComponent(validation, 'delivered_clarify_distinction', (value) => value, integrity);
  const register = fidelityComponent(
    validation,
    'delivered_register',
    (value) => (value === 'warm' ? 'warm' : ['plain', 'neither'].includes(value) ? 'nonwarm' : value),
    integrity,
  );
  const determinate = action.status === 'determinate' && register.status === 'determinate';
  return {
    schema: TUTOR_STUB_RESISTANCE_MEASUREMENT_PANEL_SCHEMA_V8,
    panel_version: 9,
    instrument: 'intervention_fidelity',
    case_id: caseId,
    status: determinate ? 'determinate' : 'measurement_indeterminate',
    action_measurement: action,
    register_measurement: register,
    validation: validation.map(({ judge_id, valid, component_eligibility, component_values, issues }) => ({
      judge_id,
      valid,
      component_eligibility,
      component_values,
      issues,
    })),
    integrity_issues: integrity,
    reasons: [
      ...integrity,
      ...(action.status !== 'determinate' ? ['binary_action_disagreement_or_missing'] : []),
      ...(register.status !== 'determinate' ? ['binary_register_disagreement_or_missing'] : []),
    ],
    plain_and_neither_projected_to_nonwarm: true,
    learner_outcome_visible_to_fidelity_judges: false,
    primary_recovery_may_be_recoded_or_vetoed: false,
    repair_rerun_replacement_or_selection_allowed: false,
  };
}

export function validateTutorStubResistanceRecoverySemanticRegistrationV9(registration) {
  const issues = [];
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-registration.v9' ||
    registration?.version !== 9 ||
    registration?.status !== 'prospective_dual_binary_confirmation'
  ) {
    issues.push('v9 recovery registration identity drifted');
  }
  const judges = registration?.measurement?.judges || [];
  const routes = [
    ['recovery_semantic_judge_a', 'codex.gpt-5.6-sol', 'codex', 'gpt-5.6-sol'],
    ['recovery_semantic_judge_b', 'claude-code.sonnet-5', 'claude-code', 'claude-sonnet-5'],
  ];
  if (
    judges.length !== 2 ||
    routes.some(
      ([id, modelRef, provider, model], index) =>
        judges[index]?.id !== id ||
        judges[index]?.modelRef !== modelRef ||
        judges[index]?.provider !== provider ||
        judges[index]?.model !== model ||
        judges[index]?.effort !== 'low' ||
        judges[index]?.independent !== true,
    )
  ) {
    issues.push('v9 recovery judge panel drifted');
  }
  if (
    registration?.measurement?.consensus?.primaryRule !== 'exact_two_of_two_derived_binary_recovery_votes' ||
    registration?.measurement?.consensus?.fidelityActionRule !== 'exact_two_of_two_action_votes' ||
    registration?.measurement?.consensus?.fidelityRegisterRule !==
      'exact_two_of_two_warm_vs_nonwarm_votes_after_plain_neither_projection' ||
    registration?.measurement?.consensus?.unitReplacementOrOutcomeSelection !== false
  ) {
    issues.push('v9 recovery binary consensus drifted');
  }
  return { valid: issues.length === 0, issues };
}
