const CAUSAL_CLAIM_PATTERN =
  /\b(?:account for|caus(?:e|ed|es|ing)|explain(?:ed|s|ing)?|prevent(?:ed|s|ing)?|produc(?:e|ed|es|ing)|stop(?:ped|s|ping)?)\b/iu;
const PRODUCTION_CAUSAL_PATTERN =
  /\b(?:account for|caus(?:e|ed|es|ing)|explain(?:ed|s|ing)?|produc(?:e|ed|es|ing))\b/iu;
const PREVENTION_CAUSAL_PATTERN = /\b(?:prevent(?:ed|s|ing)?|stop(?:ped|s|ping)?)\b/iu;
const NEGATIVE_CAUSAL_PATTERN =
  /\b(?:did not|didn[’']t|does not|doesn[’']t|cannot|can[’']t|could not|couldn[’']t|never)\b[^.!?]{0,24}\b(?:account for|caus(?:e|ed|es|ing)|explain(?:ed|s|ing)?|prevent(?:ed|s|ing)?|produc(?:e|ed|es|ing)|stop(?:ped|s|ping)?)\b/iu;
const PUBLIC_NEGATIVE_CAUSAL_SUPPORT_PATTERN =
  /\b(?:did not|didn[’']t|does not|doesn[’']t|cannot|can[’']t|could not|couldn[’']t|never)\b[^.!?]{0,40}\b(?:account for|caus(?:e|ed|es|ing)|explain(?:ed|s|ing)?|prevent(?:ed|s|ing)?|produc(?:e|ed|es|ing)|stop(?:ped|s|ping)?)\b|\b(?:despite|regardless|even though|even when|all the same|nevertheless)\b|\b(?:before|leads?)\b[^.!?]{0,70}\b(?:after|later|until)\b/iu;
const PUBLIC_INACTIVE_AGENT_PATTERN =
  /\b(?:cold|dark|idle|inactive|off|offline|parked|shut|stopped|unpowered)\b|\b(?:did not|didn[’']t|does not|doesn[’']t|never|not)\b[^.!?]{0,35}\b(?:activate|draw|energise|energize|operate|run|start|switch on|work)\b/iu;
const PUBLIC_PERSISTING_OUTCOME_PATTERN =
  /\b(?:all the same|despite|even though|even when|nevertheless|regardless|still|yet)\b|\b(?:brown(?:ed)? out|dimmed?|failed?|flooded?|happened|occurred|sagged?)\b[^.!?]{0,45}\b(?:anyway|regardless|still)\b/iu;
const NEGATIVE_PRODUCTION_TUPLE_PATTERN =
  /(?:^|[,;]\s*|\b(?:because|but|so|yet)\s+)(?:the\s+)?([^,;.!?]{1,64}?)\s+\b(?:cannot|can[’']t|could not|couldn[’']t|did not|didn[’']t|does not|doesn[’']t|never)\s+(?:account for|caus(?:e|ed|es|ing)|explain(?:ed|s|ing)?|produc(?:e|ed|es|ing))\s+(?:the\s+)?([^,;.!?]{1,80}?)(?=[.;!?]|$)/giu;
const CAUSAL_ROLE_STOP_WORDS = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those']);

function causalRoleToken(value = '') {
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

function causalRoleTokens(value = '') {
  return new Set(
    (String(value || '').match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [])
      .map(causalRoleToken)
      .filter((token) => token && !CAUSAL_ROLE_STOP_WORDS.has(token)),
  );
}

function causalProductionTuples(value = '') {
  const text = String(value || '');
  NEGATIVE_PRODUCTION_TUPLE_PATTERN.lastIndex = 0;
  const tuples = [];
  for (const match of text.matchAll(NEGATIVE_PRODUCTION_TUPLE_PATTERN)) {
    const subject = String(match[1] || '').trim();
    const outcome = String(match[2] || '').trim();
    if (subject && outcome) tuples.push({ subject, outcome });
  }
  return tuples;
}

function sameRoleTokens(actual = '', expected = '') {
  const actualTokens = [...causalRoleTokens(actual)];
  const expectedTokens = [...causalRoleTokens(expected)];
  return (
    actualTokens.length > 0 &&
    actualTokens.length === expectedTokens.length &&
    expectedTokens.every((token) => actualTokens.includes(token))
  );
}

function typedCausalRelationBinding({ quotedLine = '', causalContract = null } = {}) {
  const subject = String(causalContract?.subject || '').trim();
  const outcome = String(causalContract?.outcome || '').trim();
  const family = String(causalContract?.family || '').trim() || 'production';
  if (!subject && !outcome) {
    return {
      required: false,
      preserved: true,
      subject: null,
      outcome: null,
      family: null,
      polarity: null,
      candidates: [],
    };
  }
  const candidates = causalProductionTuples(quotedLine).map((tuple) => ({
    ...tuple,
    subject_tokens: [...causalRoleTokens(tuple.subject)],
    outcome_tokens: [...causalRoleTokens(tuple.outcome)],
    subject_preserved: sameRoleTokens(tuple.subject, subject),
    outcome_preserved: sameRoleTokens(tuple.outcome, outcome),
  }));
  const familyPreserved = family === 'production';
  const polarityPreserved = tutorStubRequestedEntryNegativeCausalVisible(quotedLine);
  const preserved =
    familyPreserved &&
    polarityPreserved &&
    candidates.some((candidate) => candidate.subject_preserved && candidate.outcome_preserved);
  return {
    required: true,
    preserved,
    subject,
    outcome,
    family,
    polarity: 'negative',
    required_subject_tokens: [...causalRoleTokens(subject)],
    required_outcome_tokens: [...causalRoleTokens(outcome)],
    family_preserved: familyPreserved,
    polarity_preserved: polarityPreserved,
    candidates,
  };
}

export function tutorStubRequestedEntryCausalClaimVisible(value = '') {
  return CAUSAL_CLAIM_PATTERN.test(String(value || ''));
}

export function tutorStubRequestedEntryNegativeCausalVisible(value = '') {
  return NEGATIVE_CAUSAL_PATTERN.test(String(value || ''));
}

export function classifyTutorStubRequestedEntryCausalRelation(value = '') {
  const text = String(value || '');
  const production = PRODUCTION_CAUSAL_PATTERN.test(text);
  const prevention = PREVENTION_CAUSAL_PATTERN.test(text);
  if (production && prevention) return 'mixed';
  if (production) return 'production';
  if (prevention) return 'prevention';
  return null;
}

export function auditTutorStubPublicCausalRelationSupport({
  surfaces = [],
  quotedLine = '',
  causalContract = null,
} = {}) {
  const publicText = (Array.isArray(surfaces) ? surfaces : []).join(' ');
  const family = classifyTutorStubRequestedEntryCausalRelation(quotedLine);
  const negative = tutorStubRequestedEntryNegativeCausalVisible(quotedLine);
  const publicProduction = PRODUCTION_CAUSAL_PATTERN.test(publicText);
  const publicPrevention = PREVENTION_CAUSAL_PATTERN.test(publicText);
  const inactiveAgentOutcomePersists =
    PUBLIC_INACTIVE_AGENT_PATTERN.test(publicText) && PUBLIC_PERSISTING_OUTCOME_PATTERN.test(publicText);
  const relationBinding = typedCausalRelationBinding({ quotedLine, causalContract });
  let supported = false;
  const constructions = [];
  if (family === 'production' && negative && inactiveAgentOutcomePersists) {
    supported = true;
    constructions.push('inactive_candidate_with_persisting_outcome_rules_out_production');
  }
  if (family === 'production' && publicProduction && PUBLIC_NEGATIVE_CAUSAL_SUPPORT_PATTERN.test(publicText)) {
    supported = true;
    constructions.push('public_production_relation');
  }
  if (family === 'prevention' && publicPrevention && PUBLIC_NEGATIVE_CAUSAL_SUPPORT_PATTERN.test(publicText)) {
    supported = true;
    constructions.push('public_prevention_relation');
  }
  if (!negative && family === 'production' && publicProduction) {
    supported = true;
    constructions.push('public_positive_production_relation');
  }
  if (!negative && family === 'prevention' && publicPrevention) {
    supported = true;
    constructions.push('public_positive_prevention_relation');
  }
  return {
    family,
    negative,
    supported: supported && relationBinding.preserved,
    constructions,
    relation_binding: relationBinding,
    subject_binding: relationBinding,
    public_families: [
      publicProduction ? 'production' : null,
      publicPrevention ? 'prevention' : null,
      inactiveAgentOutcomePersists ? 'inactive_candidate_with_persisting_outcome' : null,
    ].filter(Boolean),
  };
}

export function compileTutorStubWritableEntryCausalContract({ evidence = [], surfaces = [] } = {}) {
  const relation = auditTutorStubPublicCausalRelationSupport({ surfaces });
  if (!relation.public_families.includes('inactive_candidate_with_persisting_outcome')) return null;
  const typedRows = (Array.isArray(evidence) ? evidence : []).filter((entry) => entry?.causal_relation);
  if (typedRows.length > 1) {
    throw new Error('writable-entry causal contract requires exactly one typed public relation');
  }
  const typedRow = typedRows[0] || null;
  const typed = typedRow?.causal_relation || null;
  if (typed) {
    if (
      typed.kind !== 'inactive_candidate_with_persisting_outcome' ||
      typed.family !== 'production' ||
      !String(typed.subject || '').trim() ||
      !String(typed.outcome || '').trim()
    ) {
      throw new Error('writable-entry causal relation metadata is incomplete or incompatible');
    }
    const typedSurfaceRelation = auditTutorStubPublicCausalRelationSupport({
      surfaces: [typedRow.surface],
    });
    if (!typedSurfaceRelation.public_families.includes('inactive_candidate_with_persisting_outcome')) {
      throw new Error('writable-entry causal relation metadata is not grounded in its public surface');
    }
  }
  const subject = String(typed?.subject || '').trim() || null;
  const outcome = String(typed?.outcome || '').trim() || null;
  return {
    schema: 'machinespirits.tutor-stub.writable-entry-causal-contract.v1',
    public_relation: 'inactive_candidate_with_persisting_outcome',
    licensed_conclusion: 'rules_out_candidate_production',
    forbidden_relation: 'candidate_failed_to_prevent_outcome',
    family: typed ? 'production' : null,
    polarity: typed ? 'negative' : null,
    subject,
    outcome,
    public_evidence_surface: typedRow?.surface || null,
    instruction: subject
      ? `Public causal relation: “${subject}” was inactive while “${outcome || 'the outcome'}” still occurred. Keep “${subject}” as the exact causal subject; do not widen it to a larger actor. Say this rules out production by “${subject}”; never say it failed to prevent or stop the outcome.`
      : 'Public causal relation: the candidate was inactive while the outcome still occurred. Say this rules out candidate causation; never say the candidate failed to prevent or stop the outcome.',
  };
}
