import { masteryFor } from './knowledgeTracing.js';
import {
  diagnoseDomainMisconception,
  getPolicyActionTemplate,
} from './domainMisconceptions.js';
import { challengeActionTemplate } from './challengeState.js';
import { includesAny } from './textMetrics.js';

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
  'transfer_repair',
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
  scenario = {},
  evidence,
  mastery,
  relationState,
  validationNeed,
  challengeState = null,
  transferState = null,
  turnIndex = 0,
  maxTutorTurns = null,
  useOutcomeGate = true,
} = {}) {
  const kcId = evidence.kcCandidates[0];
  const p = masteryFor(mastery, kcId);
  const rawOutcomeGate = buildOutcomeGate({ evidence, mastery });
  const transferGate = buildTransferGate({
    scenario,
    evidence,
    transferState,
    turnIndex,
    maxTutorTurns,
  });
  const outcomeGate = useOutcomeGate
    ? rawOutcomeGate
    : {
        ...rawOutcomeGate,
        status: 'disabled',
        reason: `Ablation: ${rawOutcomeGate.reason}`,
        blockedPolicies: [],
      };
  const transferPromptCount = transferState?.promptCount || 0;
  const lastLearnerResponseTurn = Number.isInteger(maxTutorTurns)
    && turnIndex >= maxTutorTurns - 2
    && turnIndex < maxTutorTurns - 1;
  const transferRepairDue = transferGate.required
    && !transferGate.observed
    && transferPromptCount > 0
    && ['correct', 'partial'].includes(evidence.outcome);
  const lastChanceTransferProbe = transferGate.required
    && !transferGate.observed
    && transferPromptCount === 0
    && lastLearnerResponseTurn
    && (
      (evidence.outcome === 'correct'
        && ['collaborative', 'compliant', 'corrective', 'questioning'].includes(evidence.stance))
      || (evidence.outcome === 'partial'
        && evidence.stance === 'collaborative'
        && p >= 0.52)
    );

  if (transferRepairDue) {
    return policy(
      'transfer_repair',
      evidence,
      'A prior transfer prompt did not yield observable learner-owned transfer; ask one narrow transfer repair before consolidation.',
      outcomeGate,
      challengeState,
      transferGate,
    );
  }

  if (lastChanceTransferProbe) {
    return policy(
      'transfer_repair',
      evidence,
      'This is the last tutor turn that can still receive learner evidence; combine the remaining repair check with a narrow transfer probe.',
      outcomeGate,
      challengeState,
      transferGate,
    );
  }

  if (useOutcomeGate && outcomeGate.status === 'repair_required') {
    return policy(
      'misconception_repair',
      evidence,
      'Domain misconception is still active; repair and verify before transfer.',
      outcomeGate,
      challengeState,
      transferGate,
    );
  }

  if (
    challengeState?.mode === 'hard'
    && challengeState?.level === 'resolved'
    && evidence.outcome === 'correct'
    && p >= 0.6
    && ((challengeState.resolvedTurns || 0) >= 3 || evidence.stance === 'corrective')
    && transferGate.allowsConsolidation
  ) {
    return policy(
      'productive_struggle_hold',
      evidence,
      'Hard-mode learner has already repaired and is showing readiness; hand agency back instead of adding another repair or transfer demand.',
      outcomeGate,
      challengeState,
      transferGate,
    );
  }

  if (relationState === 'repair' && evidence.stance === 'corrective') {
    return policy('repair_misrecognition', evidence, 'Learner corrected the tutor reading.', outcomeGate, challengeState, transferGate);
  }

  if (relationState === 'repair' && evidence.affect === 'discouraged') {
    return policy('affective_repair', evidence, 'Learner shows discouragement before usable task evidence.', outcomeGate, challengeState, transferGate);
  }

  if (validationNeed === 'teach_back') {
    return policy('teach_back', evidence, 'Polite agreement is not mastery evidence.', outcomeGate, challengeState, transferGate);
  }

  if (
    challengeState?.mode === 'hard'
    && challengeState?.level === 'resolved'
    && (challengeState.resolvedTurns || 0) >= 2
    && evidence.outcome === 'correct'
    && p >= 0.6
    && transferGate.allowsConsolidation
  ) {
    return policy(
      'summarize_and_check',
      evidence,
      'Hard-mode challenge was repaired; consolidate the learner-owned distinction and restore agency instead of repeating transfer.',
      outcomeGate,
      challengeState,
      transferGate,
    );
  }

  if (evidence.outcome === 'correct' && (p >= 0.6 || evidence.stance === 'collaborative')) {
    const reason = transferGate.required && !transferGate.observed
      ? 'Learner has repaired the local issue, but hidden-state assessment still needs learner-owned transfer before consolidation.'
      : 'Mastery is high enough to test transfer.';
    return policy('transfer_challenge', evidence, reason, outcomeGate, challengeState, transferGate);
  }

  if (evidence.outcome === 'partial' && evidence.stance === 'claim') {
    return policy('contrastive_probe', evidence, 'Learner made a partial claim that needs a boundary test.', outcomeGate, challengeState, transferGate);
  }

  if (evidence.outcome === 'partial' && p >= 0.52) {
    return policy('minimal_hint', evidence, 'Learner has a bridgeable gap.', outcomeGate, challengeState, transferGate);
  }

  if (evidence.outcome === 'partial') {
    return policy('faded_example', evidence, 'Learner has partial structure but low mastery.', outcomeGate, challengeState, transferGate);
  }

  if (evidence.outcome === 'incorrect') {
    return policy('contrastive_probe', evidence, 'Learner made a misconception visible.', outcomeGate, challengeState, transferGate);
  }

  return policy('diagnostic_probe', evidence, 'Evidence is insufficient for personalization.', outcomeGate, challengeState, transferGate);
}

export function buildOutcomeGate({ evidence, mastery }) {
  const diagnosis = evidence.domainDiagnosis;
  const kcId = evidence.kcCandidates[0];
  if (diagnosis?.repairNeeded) {
    return {
      status: 'repair_required',
      reason: diagnosis.label,
      blockedPolicies: ['transfer_challenge', 'transfer_repair', 'summarize_and_check'],
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
      allowedPolicies: ['transfer_challenge', 'transfer_repair', 'summarize_and_check', 'teach_back'],
      successCriteria: diagnosis?.successMarkers || [],
      masteryAtGate: masteryFor(mastery, kcId),
    };
  }

  return {
    status: 'verify_before_transfer',
    reason: 'Learner evidence is not yet enough for transfer.',
    blockedPolicies: ['transfer_challenge'],
    allowedPolicies: ['diagnostic_probe', 'contrastive_probe', 'minimal_hint', 'faded_example', 'teach_back', 'transfer_repair'],
    successCriteria: diagnosis?.successMarkers || [],
    masteryAtGate: masteryFor(mastery, kcId),
  };
}

export function initialTransferState(scenario = {}) {
  return {
    required: Boolean(scenario.challenge_profile?.hidden_state_trap),
    observed: false,
    observedTurnIndex: null,
    markers: [],
    evidence: '',
    justObserved: false,
    prompted: false,
    promptCount: 0,
    lastPromptTurnIndex: null,
    lastPromptPolicy: null,
    repairCount: 0,
  };
}

export function updateTransferState({
  scenario = {},
  previous = initialTransferState(scenario),
  evidence,
  turnIndex = 0,
} = {}) {
  const observation = detectTransferObservation({
    scenario,
    evidence,
    previous,
    turnIndex,
  });
  if (!observation.observed) {
    return {
      ...previous,
      required: Boolean(scenario.challenge_profile?.hidden_state_trap),
      justObserved: false,
    };
  }
  return {
    ...previous,
    required: Boolean(scenario.challenge_profile?.hidden_state_trap),
    observed: true,
    observedTurnIndex: turnIndex,
    markers: observation.markers,
    evidence: evidence.quote || '',
    justObserved: true,
  };
}

export function recordTransferPrompt({
  previous = initialTransferState(),
  policy: selectedPolicy,
  turnIndex = 0,
} = {}) {
  const policyName = typeof selectedPolicy === 'string'
    ? selectedPolicy
    : selectedPolicy?.selectedPolicy;
  if (!['transfer_challenge', 'transfer_repair'].includes(policyName)) {
    return previous;
  }
  return {
    ...previous,
    prompted: true,
    promptCount: (previous.promptCount || 0) + 1,
    lastPromptTurnIndex: turnIndex,
    lastPromptPolicy: policyName,
    repairCount: policyName === 'transfer_repair'
      ? (previous.repairCount || 0) + 1
      : (previous.repairCount || 0),
  };
}

export function detectTransferObservation({
  scenario = {},
  evidence = {},
  previous = initialTransferState(scenario),
  turnIndex = 0,
} = {}) {
  const text = String(evidence.quote || '').toLowerCase();
  const kcId = evidence.kcCandidates?.[0] || '';
  const candidates = transferMarkerCandidates(kcId, scenario.id);
  const markers = candidates.filter((pattern) => text.includes(pattern));
  if (kcId === 'debugging_root_cause_trace' || String(scenario.id).includes('programming_debugging')) {
    return {
      observed: evidence.outcome === 'correct' && programmingDebuggingTransferObserved(text),
      markers: markers.length ? markers : programmingDebuggingTransferMarkers(text),
    };
  }
  if (kcId === 'construct_measurement_validity' || String(scenario.id).includes('social_measurement')) {
    return {
      observed: evidence.outcome === 'correct' && measurementValidityTransferObserved(text),
      markers: markers.length ? markers : measurementValidityTransferMarkers(text),
    };
  }
  const postTransferPrompt = previous?.lastPromptTurnIndex === turnIndex - 1
    && ['transfer_challenge', 'transfer_repair'].includes(previous?.lastPromptPolicy);
  const generic = includesAny(text, [
    'transfer',
    'new case',
    'different case',
    'future',
    'next experiment',
    'next time',
    'same rule',
    'same fair-test rule',
    'same trace-first rule',
  ]);
  return {
    observed: evidence.outcome === 'correct' && (markers.length > 0 || (postTransferPrompt && generic)),
    markers,
  };
}

function buildTransferGate({ scenario = {}, evidence, transferState, turnIndex, maxTutorTurns }) {
  const required = Boolean(scenario.challenge_profile?.hidden_state_trap);
  const observed = Boolean(transferState?.observed);
  const maxTurns = Number.isInteger(maxTutorTurns) ? maxTutorTurns : null;
  const finalTutorTurn = maxTurns !== null && turnIndex >= maxTurns - 1;
  const readyForTransfer = evidence?.outcome === 'correct';
  const status = !required
    ? 'not_required'
    : observed
      ? 'observed'
      : readyForTransfer
        ? (finalTutorTurn ? 'missing_at_final_turn' : 'needs_learner_transfer')
        : 'not_ready';
  return {
    required,
    observed,
    status,
    allowsConsolidation: !required || observed,
    observedTurnIndex: transferState?.observedTurnIndex ?? null,
    markers: transferState?.markers || [],
    promptCount: transferState?.promptCount || 0,
    lastPromptTurnIndex: transferState?.lastPromptTurnIndex ?? null,
    lastPromptPolicy: transferState?.lastPromptPolicy || null,
    repairCount: transferState?.repairCount || 0,
    warning: status === 'missing_at_final_turn'
      ? 'Final tutor turn reached without learner-owned transfer evidence; outcome should not be treated as adapted.'
      : '',
  };
}

function transferMarkerCandidates(kcId, scenarioId) {
  if (kcId === 'argument_evidence_warrant' || String(scenarioId).includes('argument_warrant')) {
    return ['different policy', 'new policy', 'school-uniform', 'uniform', 'single quote', 'what the quote proves', 'stronger data', 'generalizing'];
  }
  if (kcId === 'experimental_variable_control' || String(scenarioId).includes('science_variable_control')) {
    return ['next experiment', 'future experiment', 'team a', 'team b', 'fertilizer type', 'battery', 'brighter bulb', 'room temperature', 'same fair-test rule', 'not extra water too', 'otherwise similar conditions'];
  }
  if (kcId === 'debugging_root_cause_trace' || String(scenarioId).includes('programming_debugging')) {
    return ['future bug', 'bad-total bug', 'order total', 'invoice total', 'cart total', 'payment total', 'amount list', 'missing amount', 'invalid amount', 'undefined', 'null amount', 'same trace-first rule'];
  }
  if (kcId === 'construct_measurement_validity' || String(scenarioId).includes('social_measurement')) {
    return ['different survey', 'different single-item', 'new single-item', 'new survey', 'course-belonging', 'course belonging', 'belonging item', 'belonging question', 'belong in the course', 'belonging construct', 'engagement program', 'engagement item', 'safe at school', 'safety item', 'school safety', 'program group', 'same construct rule'];
  }
  return [];
}

function programmingDebuggingTransferObserved(text) {
  const totalContext = includesAny(text, [
    'bad-total bug',
    'order total',
    'invoice total',
    'cart total',
    'payment total',
    'invoice bug',
    'cart bug',
    'order bug',
    'line total',
    'linetotal',
    'price',
    'qty',
    'total field',
    'total-returning function',
    'function returning nan for a total',
    'amount list',
    'amounts [',
    'amount undefined',
    'amount is undefined',
    'cart with',
    'cart item',
    'line item',
    'running total',
    'total +=',
    'total = total + amount',
    '0 + undefined',
    'accumulator',
  ]);
  const invalidInputContext = includesAny(text, [
    'undefined',
    'null amount',
    'null value',
    'empty string',
    'missing amount',
    'missing numeric',
    'invalid amount',
    'invalid amounts',
    'invalid data',
    'bad data',
    'parsed empty',
    'number(amount)',
    'reject invalid',
    'validate or reject',
  ]);
  const averageOnly = includesAny(text, ['average', 'scores array', 'calculateaveragescore'])
    && !includesAny(text, [
      'order total',
      'invoice total',
      'cart total',
      'payment total',
      'invoice bug',
      'cart bug',
      'order bug',
      'amount list',
      'amounts [',
      'line total',
      'linetotal',
      'price',
      'qty',
      'amount undefined',
      'amount is undefined',
      'cart with',
      'cart item',
      'line item',
      'total +=',
      'total = total + amount',
      '0 + undefined',
    ]);
  const validZeroAsInvalid = includesAny(text, [
    'zero total is the first invalid',
    'total = 0 is the first invalid',
    'first invalid intermediate = `total = 0`',
    'first invalid intermediate = total = 0',
    'first invalid step: total = 0',
  ]);
  return totalContext && invalidInputContext && !averageOnly && !validZeroAsInvalid;
}

function programmingDebuggingTransferMarkers(text) {
  const markers = [];
  if (includesAny(text, ['order total', 'invoice total', 'cart total', 'payment total', 'bad-total bug'])) {
    markers.push('bad_total_field');
  }
  if (includesAny(text, ['cart with', 'cart item', 'line item', 'amount undefined', 'amount is undefined'])) {
    markers.push('bad_total_field');
  }
  if (includesAny(text, ['undefined', 'null amount', 'empty string', 'missing amount', 'invalid amount', 'invalid data', 'bad data'])) {
    markers.push('invalid_amount_data');
  }
  if (includesAny(text, ['total +=', 'accumulator', 'running total', 'number(amount)'])) {
    markers.push('first_invalid_total_intermediate');
  }
  return markers;
}

function measurementValidityTransferObserved(text) {
  const differentCase = includesAny(text, [
    'different single-item',
    'new single-item',
    'new survey',
    'course-belonging',
    'course belonging',
    'belonging item',
    'belonging question',
    'engagement program',
    'engagement item',
    'safe at school',
    'safety item',
    'school safety',
  ]);
  const singleItemBoundary = includesAny(text, [
    'single item',
    'one item',
    'one question',
    'one survey question',
    'one self-report',
    'one belonging item',
    'single belonging item',
    'one engagement item',
    'one direct item',
  ]);
  const cannotProve = includesAny(text, [
    'not proof',
    'not prove',
    "can't prove",
    'cant prove',
    'cannot prove',
    'cannot support',
    'not enough',
    'not by itself',
    'not yet a causal claim',
    'not that the program caused',
    'not the whole construct',
    'not the whole construct or proof',
    'not proof of impact',
    'only a clue',
  ]);
  return differentCase && singleItemBoundary && cannotProve;
}

function measurementValidityTransferMarkers(text) {
  const markers = [];
  if (includesAny(text, ['course-belonging', 'course belonging', 'belonging item', 'belonging question'])) {
    markers.push('course_belonging_single_item');
  }
  if (includesAny(text, ['engagement program', 'engagement item', 'safe at school', 'safety item', 'school safety'])) {
    markers.push('new_single_item_case');
  }
  if (includesAny(text, ['not proof', 'not prove', "can't prove", 'cant prove', 'cannot prove', 'not enough', 'not by itself', 'not the whole construct', 'only a clue'])) {
    markers.push('single_item_boundary');
  }
  return markers;
}

function policy(selectedPolicy, evidence, reason, outcomeGate, challengeState = null, transferGate = null) {
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
    transferGate,
    actionTemplate: mergeActionTemplates(domainTemplate || genericTemplate, challengeTemplate),
    challengeDirective: challengeState?.directive || '',
    challengeState: challengeState ? structuredClone(challengeState) : null,
  };
}

function buildGenericActionTemplate(selectedPolicy) {
  if (selectedPolicy === 'transfer_repair') {
    return {
      name: 'narrow_transfer_repair',
      mustDo: [
        'Do not summarize or close the lesson.',
        'Name exactly one new case or near-miss case.',
        'Ask the learner for the specific missing boundary markers in their own words.',
        'Require a compact labeled answer so the next turn can verify learner-owned transfer.',
      ],
      mustAvoid: [
        'Do not repeat the previous broad transfer prompt.',
        'Do not introduce a second full example.',
        'Do not provide the final answer before the learner has supplied the transfer markers.',
      ],
      messageFrame: 'The previous transfer attempt did not create observable learner-owned transfer. Ask one narrow new case and require the missing boundary markers before any summary.',
      successCheck: 'Learner should supply the portable rule in a new case, including the boundary or near-miss that prevents overgeneralization.',
    };
  }
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
