export const POETICS_SEMANTIC_CHANGE_ADJUDICATION_SCHEMA = 'machinespirits.poetics.semantic-change-adjudication.v1';

const CONSTRUCTS = Object.freeze({
  tutor_adaptive_mechanism: Object.freeze({
    role: 'tutor',
    positiveLabels: new Set(['representation_change', 'other_mechanism_change']),
    negativeLabel: 'no_mechanism_change',
    changeKinds: new Set([
      'criterion_gate',
      'counterexample_case',
      'role_perspective_shift',
      'evidence_standard_shift',
      'procedure_shift',
      'public_tool_shift',
    ]),
  }),
  learner_actional_change: Object.freeze({
    role: 'learner',
    positiveLabels: new Set(['representation_change', 'other_actional_change']),
    negativeLabel: 'no_actional_change',
    changeKinds: new Set([
      'criterion_application',
      'counterexample_application',
      'role_perspective_application',
      'evidence_standard_application',
      'procedure_application',
      'public_tool_use',
    ]),
  }),
});

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKind(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeStateForComparison(value) {
  return normalizeText(value).toLocaleLowerCase('en-US');
}

function evidenceSources(role) {
  return new Set([`pre_${role}`, `post_${role}`]);
}

function validateEvidence(judgment, beforeText, afterText, role) {
  const requiredSources = evidenceSources(role);
  const evidence = Array.isArray(judgment?.evidence) ? judgment.evidence : [];
  if (!evidence.length) return false;
  if (new Set(evidence.map((span) => span?.source)).size !== requiredSources.size) return false;
  return evidence.every((span) => {
    if (!requiredSources.has(span?.source)) return false;
    const quote = normalizeText(span?.quote);
    if (!quote) return false;
    const haystack = span.source === `pre_${role}` ? beforeText : afterText;
    return normalizeText(haystack).includes(quote);
  });
}

function judgmentIssue(judgment, beforeText, afterText, constructConfig) {
  if (!judgment || typeof judgment !== 'object') return 'missing_judgment';
  if (!String(judgment.judge_id || '').trim()) return 'missing_judge_id';
  if (!String(judgment.independent_run_id || '').trim()) return 'missing_independent_run_id';
  const allowedLabels = new Set([...constructConfig.positiveLabels, constructConfig.negativeLabel, 'indeterminate']);
  if (!allowedLabels.has(judgment.label)) return 'invalid_label';
  if (judgment.confidence !== 'high') return 'confidence_not_high';
  if (!String(judgment.rationale || '').trim()) return 'missing_rationale';
  if (judgment.label === 'indeterminate') return 'judge_indeterminate';
  if (constructConfig.positiveLabels.has(judgment.label)) {
    if (!String(judgment.from_state || '').trim() || !String(judgment.to_state || '').trim()) {
      return 'missing_from_or_to_state';
    }
    if (normalizeStateForComparison(judgment.from_state) === normalizeStateForComparison(judgment.to_state)) {
      return 'unchanged_from_and_to_state';
    }
    if (judgment.label !== 'representation_change' && !String(judgment.change_kind || '').trim()) {
      return 'missing_change_kind';
    }
    if (
      judgment.label !== 'representation_change' &&
      !constructConfig.changeKinds.has(normalizeKind(judgment.change_kind))
    ) {
      return 'invalid_change_kind';
    }
  }
  if (!validateEvidence(judgment, beforeText, afterText, constructConfig.role)) {
    return 'invalid_or_unquoted_evidence';
  }
  return null;
}

export function adjudicatePoeticsSemanticChange({ construct, beforeText, afterText, judgments, advisorySignals = {} }) {
  const constructConfig = CONSTRUCTS[construct];
  if (!constructConfig) throw new Error(`unsupported poetics semantic-change construct: ${construct}`);

  const supplied = Array.isArray(judgments) ? judgments : [];
  const integrityIssues = [];
  if (supplied.length !== 2) integrityIssues.push('exactly_two_judgments_required');

  const judgeIds = supplied.map((judgment) => normalizeText(judgment?.judge_id)).filter(Boolean);
  if (new Set(judgeIds).size !== judgeIds.length) integrityIssues.push('duplicate_judge_id');
  const runIds = supplied.map((judgment) => normalizeText(judgment?.independent_run_id)).filter(Boolean);
  if (new Set(runIds).size !== runIds.length) integrityIssues.push('judge_runs_not_independent');

  const validation = supplied.map((judgment) => ({
    judge_id: normalizeText(judgment?.judge_id) || null,
    issue: judgmentIssue(judgment, beforeText, afterText, constructConfig),
  }));
  const eligible = supplied.filter((judgment, index) => validation[index].issue === null);
  const labels = eligible.map((judgment) => judgment.label);
  const changeKinds = eligible.map((judgment) => {
    if (judgment.label === 'representation_change') return 'representation_change';
    if (judgment.label === constructConfig.negativeLabel) return 'none';
    return normalizeKind(judgment.change_kind);
  });
  const labelAgreement = eligible.length === 2 && labels[0] === labels[1];
  const changeKindAgreement = labelAgreement && changeKinds[0] === changeKinds[1];
  const exactAgreement = integrityIssues.length === 0 && labelAgreement && changeKindAgreement;

  const reasons = [...integrityIssues];
  for (const row of validation) {
    if (row.issue) reasons.push(`${row.judge_id || 'unknown_judge'}:${row.issue}`);
  }
  if (eligible.length === 2 && labels[0] !== labels[1]) reasons.push('semantic_label_disagreement');
  if (labelAgreement && !changeKindAgreement) reasons.push('change_kind_disagreement');
  if (eligible.length < 2) reasons.push('fewer_than_two_eligible_semantic_judges');

  const label = exactAgreement ? labels[0] : 'indeterminate';
  const value = exactAgreement ? constructConfig.positiveLabels.has(label) : null;
  const representationValue = exactAgreement ? label === 'representation_change' : null;
  const uniqueReasons = [...new Set(reasons)];

  return {
    schema: POETICS_SEMANTIC_CHANGE_ADJUDICATION_SCHEMA,
    construct,
    subject_role: constructConfig.role,
    status: exactAgreement ? 'determinate' : 'measurement_indeterminate',
    label,
    value,
    change_kind: exactAgreement ? changeKinds[0] : null,
    representation_change_measurement: {
      status: exactAgreement ? 'determinate' : 'measurement_indeterminate',
      value: representationValue,
      reasons: uniqueReasons,
    },
    reasons: uniqueReasons,
    exact_agreement_required: 2,
    eligible_judges: eligible.map((judgment) => normalizeText(judgment.judge_id)),
    vote_counts: Object.fromEntries(
      [...new Set(labels)]
        .sort()
        .map((candidate) => [candidate, labels.filter((labelValue) => labelValue === candidate).length]),
    ),
    judge_submissions: supplied.map((judgment) => ({
      judge_id: normalizeText(judgment?.judge_id) || null,
      independent_run_id: normalizeText(judgment?.independent_run_id) || null,
      label: judgment?.label || null,
      confidence: judgment?.confidence || null,
      evidence: Array.isArray(judgment?.evidence) ? judgment.evidence : [],
      change_kind:
        judgment?.label === 'representation_change'
          ? 'representation_change'
          : normalizeKind(judgment?.change_kind) || null,
      from_state: judgment?.from_state || null,
      to_state: judgment?.to_state || null,
      rationale: judgment?.rationale || null,
    })),
    judge_evidence: exactAgreement
      ? eligible.map((judgment) => ({
          judge_id: normalizeText(judgment.judge_id),
          independent_run_id: normalizeText(judgment.independent_run_id),
          evidence: judgment.evidence,
          change_kind:
            judgment.label === 'representation_change'
              ? 'representation_change'
              : normalizeKind(judgment.change_kind) || null,
          from_state: judgment.from_state || null,
          to_state: judgment.to_state || null,
          rationale: judgment.rationale,
        }))
      : [],
    advisory_signals: advisorySignals,
    lexical_or_regex_authority: 'none',
    judge_rerun_after_response_allowed: false,
    unit_rerun_allowed: false,
    replacement_allowed: false,
    outcome_selection_allowed: false,
    historical_recompute_allowed: false,
    validation,
  };
}

export function adjudicatePoeticsMechanismChange(options) {
  return adjudicatePoeticsSemanticChange({ ...options, construct: 'tutor_adaptive_mechanism' });
}

export function adjudicatePoeticsLearnerActionalChange(options) {
  return adjudicatePoeticsSemanticChange({ ...options, construct: 'learner_actional_change' });
}

export const adjudicatePoeticsRepresentationChange = adjudicatePoeticsMechanismChange;
