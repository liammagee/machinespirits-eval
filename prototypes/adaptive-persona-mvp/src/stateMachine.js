import { masteryFor } from './knowledgeTracing.js';
import {
  diagnoseDomainMisconception,
  getPolicyActionTemplate,
} from './domainMisconceptions.js';
import { challengeActionTemplate } from './challengeState.js';

export const POLICIES = Object.freeze([
  'diagnostic_probe',
  'contrastive_probe',
  'minimal_hint',
  'faded_example',
  'productive_struggle_hold',
  'affective_repair',
  'repair_misrecognition',
  'misconception_repair',
  'teach_back',
  'transfer_challenge',
  'summarize_and_check',
]);

export function extractEvidence(event) {
  const quote = event.learner || '';
  const kcCandidates = event.kc ? [event.kc] : [];
  const outcome = event.outcome || 'unobserved';
  const stance = event.stance || 'claim';
  const domainDiagnosis = diagnoseDomainMisconception({
    kcId: kcCandidates[0],
    quote,
    outcome,
    stance,
    trapProbeRequired: Boolean(event.trap_probe_required),
  });

  return {
    obsId: event.id,
    quote,
    validated: quote.length > 0 && quote.includes(event.learner || ''),
    evidenceType: event.stance === 'corrective' ? 'learner_correction' : 'learner_self_report',
    kcCandidates,
    outcome,
    affect: event.affect || 'neutral',
    stance,
    expectedPolicy: event.expected_policy || null,
    trapProbeRequired: Boolean(event.trap_probe_required),
    domainDiagnosis,
  };
}

export function transitionRelationState({ evidence, mastery, challengeState = null }) {
  const kcId = evidence.kcCandidates[0];
  const p = masteryFor(mastery, kcId);

  if (challengeState?.level === 'escalated') {
    return {
      relationState: 'misconception_repair',
      recognitionRisk: 'challenge_reversion',
      validationNeed: 'escalated_repair',
      challengeState,
    };
  }

  if (evidence.domainDiagnosis?.repairNeeded) {
    return {
      relationState: 'misconception_repair',
      recognitionRisk: 'premature_transfer',
      validationNeed: 'domain_repair',
      challengeState,
    };
  }

  if (evidence.stance === 'corrective' || evidence.affect === 'frustrated') {
    return {
      relationState: 'repair',
      recognitionRisk: 'misrecognition',
      validationNeed: 'repair_first',
      challengeState,
    };
  }

  if (evidence.affect === 'discouraged') {
    return {
      relationState: 'repair',
      recognitionRisk: 'over_scaffolding',
      validationNeed: 'ask_for_reasoning',
      challengeState,
    };
  }

  if (evidence.outcome === 'unobserved' || evidence.stance === 'compliant') {
    return {
      relationState: 'diagnostic',
      recognitionRisk: 'premature_closure',
      validationNeed: 'teach_back',
      challengeState,
    };
  }

  if (evidence.outcome === 'correct' && (p >= 0.6 || evidence.stance === 'collaborative')) {
    return {
      relationState: 'transfer',
      recognitionRisk: 'none',
      validationNeed: 'none',
      challengeState,
    };
  }

  if (evidence.outcome === 'partial') {
    return {
      relationState: 'scaffolded_practice',
      recognitionRisk: 'none',
      validationNeed: 'none',
      challengeState,
    };
  }

  return {
    relationState: 'diagnostic',
    recognitionRisk: 'over_inference',
    validationNeed: 'ask_for_reasoning',
    challengeState,
  };
}

export function selectPolicy({
  evidence,
  mastery,
  relationState,
  validationNeed,
  challengeState = null,
  useOutcomeGate = true,
} = {}) {
  const kcId = evidence.kcCandidates[0];
  const p = masteryFor(mastery, kcId);
  const rawOutcomeGate = buildOutcomeGate({ evidence, mastery });
  const outcomeGate = useOutcomeGate
    ? rawOutcomeGate
    : {
        ...rawOutcomeGate,
        status: 'disabled',
        reason: `Ablation: ${rawOutcomeGate.reason}`,
        blockedPolicies: [],
      };

  if (useOutcomeGate && outcomeGate.status === 'repair_required') {
    return policy(
      'misconception_repair',
      evidence,
      'Domain misconception is still active; repair and verify before transfer.',
      outcomeGate,
      challengeState,
    );
  }

  if (
    challengeState?.mode === 'hard'
    && challengeState?.level === 'resolved'
    && evidence.outcome === 'correct'
    && p >= 0.6
    && ((challengeState.resolvedTurns || 0) >= 3 || evidence.stance === 'corrective')
  ) {
    return policy(
      'productive_struggle_hold',
      evidence,
      'Hard-mode learner has already repaired and is showing readiness; hand agency back instead of adding another repair or transfer demand.',
      outcomeGate,
      challengeState,
    );
  }

  if (relationState === 'repair' && evidence.stance === 'corrective') {
    return policy('repair_misrecognition', evidence, 'Learner corrected the tutor reading.', outcomeGate, challengeState);
  }

  if (relationState === 'repair' && evidence.affect === 'discouraged') {
    return policy('affective_repair', evidence, 'Learner shows discouragement before usable task evidence.', outcomeGate, challengeState);
  }

  if (validationNeed === 'teach_back') {
    return policy('teach_back', evidence, 'Polite agreement is not mastery evidence.', outcomeGate, challengeState);
  }

  if (
    challengeState?.mode === 'hard'
    && challengeState?.level === 'resolved'
    && (challengeState.resolvedTurns || 0) >= 2
    && evidence.outcome === 'correct'
    && p >= 0.6
  ) {
    return policy(
      'summarize_and_check',
      evidence,
      'Hard-mode challenge was repaired; consolidate the learner-owned distinction and restore agency instead of repeating transfer.',
      outcomeGate,
      challengeState,
    );
  }

  if (evidence.outcome === 'correct' && (p >= 0.6 || evidence.stance === 'collaborative')) {
    return policy('transfer_challenge', evidence, 'Mastery is high enough to test transfer.', outcomeGate, challengeState);
  }

  if (evidence.outcome === 'partial' && evidence.stance === 'claim') {
    return policy('contrastive_probe', evidence, 'Learner made a partial claim that needs a boundary test.', outcomeGate, challengeState);
  }

  if (evidence.outcome === 'partial' && p >= 0.52) {
    return policy('minimal_hint', evidence, 'Learner has a bridgeable gap.', outcomeGate, challengeState);
  }

  if (evidence.outcome === 'partial') {
    return policy('faded_example', evidence, 'Learner has partial structure but low mastery.', outcomeGate, challengeState);
  }

  if (evidence.outcome === 'incorrect') {
    return policy('contrastive_probe', evidence, 'Learner made a misconception visible.', outcomeGate, challengeState);
  }

  return policy('diagnostic_probe', evidence, 'Evidence is insufficient for personalization.', outcomeGate, challengeState);
}

export function buildOutcomeGate({ evidence, mastery }) {
  const diagnosis = evidence.domainDiagnosis;
  const kcId = evidence.kcCandidates[0];
  if (diagnosis?.repairNeeded) {
    return {
      status: 'repair_required',
      reason: diagnosis.label,
      blockedPolicies: ['transfer_challenge', 'summarize_and_check'],
      allowedPolicies: ['misconception_repair', 'teach_back', 'diagnostic_probe'],
      successCriteria: diagnosis.successMarkers,
      masteryAtGate: masteryFor(mastery, kcId),
    };
  }

  if (evidence.outcome === 'correct' || diagnosis?.repaired) {
    return {
      status: 'open',
      reason: 'Learner supplied visible success evidence.',
      blockedPolicies: [],
      allowedPolicies: ['transfer_challenge', 'summarize_and_check', 'teach_back'],
      successCriteria: diagnosis?.successMarkers || [],
      masteryAtGate: masteryFor(mastery, kcId),
    };
  }

  return {
    status: 'verify_before_transfer',
    reason: 'Learner evidence is not yet enough for transfer.',
    blockedPolicies: ['transfer_challenge'],
    allowedPolicies: ['diagnostic_probe', 'contrastive_probe', 'minimal_hint', 'faded_example', 'teach_back'],
    successCriteria: diagnosis?.successMarkers || [],
    masteryAtGate: masteryFor(mastery, kcId),
  };
}

function policy(selectedPolicy, evidence, reason, outcomeGate, challengeState = null) {
  const kcId = evidence.kcCandidates[0];
  const domainTemplate = getPolicyActionTemplate({
    kcId,
    selectedPolicy,
    diagnosis: evidence.domainDiagnosis,
  });
  const genericTemplate = buildGenericActionTemplate(selectedPolicy);
  const challengeTemplate = challengeActionTemplate(challengeState);
  return {
    selectedPolicy,
    reason,
    evidenceRefs: [evidence.obsId],
    outcomeGate,
    actionTemplate: mergeActionTemplates(domainTemplate || genericTemplate, challengeTemplate),
    challengeDirective: challengeState?.directive || '',
    challengeState: challengeState ? structuredClone(challengeState) : null,
  };
}

function buildGenericActionTemplate(selectedPolicy) {
  if (selectedPolicy !== 'productive_struggle_hold') return null;
  return {
    name: 'readiness_sensitive_agency_handoff',
    mustDo: [
      'Acknowledge that the learner has already done the required repair or transfer work.',
      'Do not ask the learner to redo the same task.',
      'Hand agency back with a compact portable rule or next-use criterion.',
    ],
    mustAvoid: [
      'Do not introduce a new transfer problem.',
      'Do not reopen misconception repair unless new evidence shows the misconception returned.',
      'Do not praise generically; name the specific work the learner already did.',
    ],
    messageFrame: 'The learner has already supplied enough repair or transfer evidence. Consolidate briefly and hand control back rather than adding another demand.',
    successCheck: 'Learner should retain agency and not be forced through repeated proof of understanding.',
  };
}

function mergeActionTemplates(domainTemplate, challengeTemplate) {
  if (!domainTemplate) return challengeTemplate;
  if (!challengeTemplate) return domainTemplate;
  return {
    name: `${domainTemplate.name}+${challengeTemplate.name}`,
    mustDo: [...(domainTemplate.mustDo || []), ...(challengeTemplate.mustDo || [])],
    mustAvoid: [...(domainTemplate.mustAvoid || []), ...(challengeTemplate.mustAvoid || [])],
    messageFrame: `${domainTemplate.messageFrame} ${challengeTemplate.messageFrame}`,
    successCheck: `${domainTemplate.successCheck} ${challengeTemplate.successCheck}`,
    fallbackMessage: domainTemplate.fallbackMessage,
  };
}
