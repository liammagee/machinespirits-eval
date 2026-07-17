const CAUSAL_CLAIM_PATTERN =
  /\b(?:account for|caus(?:e|ed|es|ing)|explain(?:ed|s|ing)?|prevent(?:ed|s|ing)?|produc(?:e|ed|es|ing)|stop(?:ped|s|ping)?)\b/iu;
const PRODUCTION_CAUSAL_PATTERN =
  /\b(?:account for|caus(?:e|ed|es|ing)|explain(?:ed|s|ing)?|produc(?:e|ed|es|ing))\b/iu;
const PREVENTION_CAUSAL_PATTERN =
  /\b(?:prevent(?:ed|s|ing)?|stop(?:ped|s|ping)?)\b/iu;
const NEGATIVE_CAUSAL_PATTERN =
  /\b(?:did not|didn[’']t|does not|doesn[’']t|cannot|can[’']t|could not|couldn[’']t|never)\b[^.!?]{0,24}\b(?:account for|caus(?:e|ed|es|ing)|explain(?:ed|s|ing)?|prevent(?:ed|s|ing)?|produc(?:e|ed|es|ing)|stop(?:ped|s|ping)?)\b/iu;
const PUBLIC_NEGATIVE_CAUSAL_SUPPORT_PATTERN =
  /\b(?:did not|didn[’']t|does not|doesn[’']t|cannot|can[’']t|could not|couldn[’']t|never)\b[^.!?]{0,40}\b(?:account for|caus(?:e|ed|es|ing)|explain(?:ed|s|ing)?|prevent(?:ed|s|ing)?|produc(?:e|ed|es|ing)|stop(?:ped|s|ping)?)\b|\b(?:despite|regardless|even though|even when|all the same|nevertheless)\b|\b(?:before|leads?)\b[^.!?]{0,70}\b(?:after|later|until)\b/iu;
const PUBLIC_INACTIVE_AGENT_PATTERN =
  /\b(?:cold|dark|idle|inactive|off|offline|parked|shut|stopped|unpowered)\b|\b(?:did not|didn[’']t|does not|doesn[’']t|never|not)\b[^.!?]{0,35}\b(?:activate|draw|energise|energize|operate|run|start|switch on|work)\b/iu;
const PUBLIC_PERSISTING_OUTCOME_PATTERN =
  /\b(?:all the same|despite|even though|even when|nevertheless|regardless|still|yet)\b|\b(?:brown(?:ed)? out|dimmed?|failed?|flooded?|happened|occurred|sagged?)\b[^.!?]{0,45}\b(?:anyway|regardless|still)\b/iu;

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

export function auditTutorStubPublicCausalRelationSupport({ surfaces = [], quotedLine = '' } = {}) {
  const publicText = (Array.isArray(surfaces) ? surfaces : []).join(' ');
  const family = classifyTutorStubRequestedEntryCausalRelation(quotedLine);
  const negative = tutorStubRequestedEntryNegativeCausalVisible(quotedLine);
  const publicProduction = PRODUCTION_CAUSAL_PATTERN.test(publicText);
  const publicPrevention = PREVENTION_CAUSAL_PATTERN.test(publicText);
  const inactiveAgentOutcomePersists =
    PUBLIC_INACTIVE_AGENT_PATTERN.test(publicText) &&
    PUBLIC_PERSISTING_OUTCOME_PATTERN.test(publicText);
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
    supported,
    constructions,
    public_families: [
      publicProduction ? 'production' : null,
      publicPrevention ? 'prevention' : null,
      inactiveAgentOutcomePersists ? 'inactive_candidate_with_persisting_outcome' : null,
    ].filter(Boolean),
  };
}

export function compileTutorStubWritableEntryCausalContract({ surfaces = [] } = {}) {
  const relation = auditTutorStubPublicCausalRelationSupport({ surfaces });
  if (!relation.public_families.includes('inactive_candidate_with_persisting_outcome')) return null;
  return {
    schema: 'machinespirits.tutor-stub.writable-entry-causal-contract.v1',
    public_relation: 'inactive_candidate_with_persisting_outcome',
    licensed_conclusion: 'rules_out_candidate_production',
    forbidden_relation: 'candidate_failed_to_prevent_outcome',
    instruction:
      'Public causal relation: the candidate was inactive while the outcome still occurred. Say this rules out candidate causation; never say the candidate failed to prevent or stop the outcome.',
  };
}
