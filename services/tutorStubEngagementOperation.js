export const TUTOR_STUB_ENGAGEMENT_OPERATION_SCHEMA =
  'machinespirits.tutor-stub.engagement-operation.v1';

export const TUTOR_STUB_ENGAGEMENT_OPERATION_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.engagement-operation-audit.v1';

const PRESSURE_TARGET_TOKENS = new Set([
  'accusation',
  'case',
  'charge',
  'claim',
  'conclusion',
  'verdict',
]);
const SET_AGAINST_PATTERN =
  /\bi\s+(?:hold|lay|place|press|set|pit)\b[^.!?]{1,100}\bagainst\b/iu;
const TYPED_INACTIVITY_CUE_PATTERN =
  /\b(?:cold|dark(?:ness)?|dormant|idle|inactive|off|offline|parked|quiescent|shut|silent|stopped|unpowered)\b/iu;
const ABSTRACT_CASE_STATUS_PATTERN =
  /\b(?:case|claim|conclusion|verdict)\s+(?:is|looks?|seems?|stands?)\s+(?:limited|strong|weak|weakened)\b/iu;

const ROLE_STOP_WORDS = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those']);
const EVIDENCE_STOP_WORDS = new Set([
  ...ROLE_STOP_WORDS,
  'and',
  'at',
  'be',
  'during',
  'every',
  'for',
  'from',
  'in',
  'of',
  'on',
  'out',
  'remain',
  'still',
  'stood',
  'to',
  'while',
  'with',
]);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function roleToken(value = '') {
  let token = String(value || '')
    .toLowerCase()
    .replace(/[’']/gu, '')
    .replace(/[^\p{L}\p{N}-]/gu, '');
  if (/^brown(?:ed|out)?$/u.test(token)) return 'brown';
  if (token.length > 4 && /(?:ing|ed|es|s)$/u.test(token)) {
    token = token.replace(/(?:ing|ed|es|s)$/u, '');
  }
  return token;
}

function roleTokens(value = '') {
  return new Set(
    (String(value || '').match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [])
      .flatMap((token) => token.split(/-/u))
      .map(roleToken)
      .filter((token) => token && !ROLE_STOP_WORDS.has(token)),
  );
}

function roleVisible(text, role) {
  const actual = roleTokens(text);
  const expected = [...roleTokens(role)];
  return expected.length > 0 && expected.every((token) => actual.has(token));
}

function roleHeadVisible(text, role) {
  const expected = [...roleTokens(role)];
  if (expected.length === 0) return false;
  return roleTokens(text).has(expected.at(-1));
}

function pressureTargetVisible(text) {
  return [...roleTokens(text)].some((token) => PRESSURE_TARGET_TOKENS.has(token));
}

function publicEvidenceAnchorTokens(contract = null) {
  const excluded = new Set([
    ...roleTokens(contract?.causal_relation?.subject),
    ...roleTokens(contract?.causal_relation?.outcome),
  ]);
  return [...roleTokens(contract?.public_evidence_surface)].filter(
    (token) => !excluded.has(token) && !EVIDENCE_STOP_WORDS.has(token),
  );
}

function publicEvidenceAnchorVisible(text, contract = null) {
  const expected = publicEvidenceAnchorTokens(contract);
  if (expected.length === 0) return false;
  const actual = roleTokens(text);
  return expected.some((token) => actual.has(token));
}

function publicEvidenceCueVisible(text, contract = null) {
  return (
    publicEvidenceAnchorVisible(text, contract) ||
    (contract?.evidence_cue_family === 'inactive_candidate' &&
      TYPED_INACTIVITY_CUE_PATTERN.test(text))
  );
}

export function compileTutorStubEngagementOperation({
  engagementStance = null,
  causalRelationContract = null,
} = {}) {
  if (engagementStance !== 'charismatic') return null;
  if (
    causalRelationContract?.schema !== 'machinespirits.tutor-stub.writable-entry-causal-contract.v1' ||
    causalRelationContract?.public_relation !== 'inactive_candidate_with_persisting_outcome' ||
    causalRelationContract?.family !== 'production' ||
    causalRelationContract?.polarity !== 'negative' ||
    !oneLine(causalRelationContract?.subject) ||
    !oneLine(causalRelationContract?.outcome) ||
    !oneLine(causalRelationContract?.public_evidence_surface)
  ) {
    return null;
  }
  const subject = oneLine(causalRelationContract.subject);
  const outcome = oneLine(causalRelationContract.outcome);
  return {
    schema: TUTOR_STUB_ENGAGEMENT_OPERATION_SCHEMA,
    active: true,
    id: 'public_pressure_collision',
    owner: 'performance_entry',
    boundary_owner: 'performance_response',
    engagement_stance: 'charismatic',
    pressure_target_family: 'public_accusation_or_claim',
    operator_family: 'first_person_set_against',
    evidence_cue_family: 'inactive_candidate',
    causal_relation: {
      family: 'production',
      polarity: 'negative',
      subject,
      outcome,
    },
    public_evidence_surface: oneLine(causalRelationContract.public_evidence_surface),
    instruction:
      `Begin exactly “I set” and place the public inactivity clue against the accusation or claim about the ${subject} and the ${outcome}. ` +
      'Keep “I set … against …” in that sentence and name the clue, pressure target, subject, and outcome. Do not merely say the case is weak or that the subject cannot explain the outcome; PERFORMANCE RESPONSE states the exact causal boundary.',
  };
}

export function auditTutorStubEngagementOperation({
  contract = null,
  performanceEntry = '',
  performanceResponse = '',
} = {}) {
  if (!contract) {
    return {
      schema: TUTOR_STUB_ENGAGEMENT_OPERATION_AUDIT_SCHEMA,
      active: false,
      ok: true,
      visible: true,
      issues: [],
      reason: 'no typed engagement operation applies',
    };
  }
  const text = oneLine(performanceEntry);
  const boundaryText = oneLine(performanceResponse);
  const operationBody = text;
  const againstIndex = operationBody.toLowerCase().indexOf(' against ');
  const rightOperand = againstIndex >= 0 ? operationBody.slice(againstIndex + ' against '.length) : '';
  const relation = contract?.causal_relation || {};
  const checks = {
    schema_matches: contract?.schema === TUTOR_STUB_ENGAGEMENT_OPERATION_SCHEMA,
    contract_active: contract?.active === true,
    owner_matches: contract?.owner === 'performance_entry',
    boundary_owner_matches: contract?.boundary_owner === 'performance_response',
    operation_matches: contract?.id === 'public_pressure_collision',
    begins_typed_operation: /^I set\b/u.test(text),
    first_person_set_against_visible: SET_AGAINST_PATTERN.test(operationBody),
    public_evidence_cue_visible: publicEvidenceCueVisible(operationBody, contract),
    pressure_target_visible: pressureTargetVisible(rightOperand),
    entry_subject_visible: roleVisible(text, relation.subject),
    entry_outcome_head_visible: roleHeadVisible(text, relation.outcome),
    boundary_subject_visible: roleVisible(boundaryText, relation.subject),
    boundary_outcome_visible: roleVisible(boundaryText, relation.outcome),
    not_abstract_case_status: !ABSTRACT_CASE_STATUS_PATTERN.test(operationBody),
  };
  const issues = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([type]) => ({ type, owner: 'performance_entry' }));
  return {
    schema: TUTOR_STUB_ENGAGEMENT_OPERATION_AUDIT_SCHEMA,
    active: true,
    ok: issues.length === 0,
    visible: issues.length === 0,
    operation: contract.id || null,
    owner: contract.owner || null,
    checks,
    issues,
    reason:
      issues.length === 0
        ? 'the model-owned PERFORMANCE entry enacts the typed public-pressure collision'
        : `typed public-pressure collision missing: ${issues.map((issue) => issue.type).join(', ')}`,
  };
}
