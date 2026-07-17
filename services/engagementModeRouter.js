import {
  getEngagementRegisterNames,
  getResistanceSignalDefinitions,
  getResistanceStrategies,
  getRoutingPatternGroups,
  getRegisterOntologyVersion,
  resolveEngagementRegister,
} from './engagementRegisterRegistry.js';

const REGISTERS = Object.freeze(getEngagementRegisterNames({ includeArmAssigned: true }));

export const ENGAGEMENT_REGISTERS = REGISTERS;
// Backward-compatible alias for earlier router reports and traces.
export const ENGAGEMENT_MODES = REGISTERS;

const REGISTER_SET = new Set(REGISTERS);

function normalizeText(value) {
  return String(value || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function lowerText(value) {
  return normalizeText(value).toLowerCase();
}

function firstMatch(text, patterns) {
  const source = normalizeText(text);
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[0]) return match[0].slice(0, 160);
  }
  return source.slice(0, 160);
}

function normalizeRegisterHistory(registerHistory) {
  if (!Array.isArray(registerHistory)) return [];
  return registerHistory
    .map((register) => resolveEngagementRegister(register)?.register || null)
    .filter((register) => register && REGISTER_SET.has(register))
    .slice(-2);
}

function pushFlag(flags, condition, flag) {
  if (condition && !flags.includes(flag)) flags.push(flag);
}

function compilePatterns(patterns = []) {
  return patterns.map((pattern) => new RegExp(pattern, 'i'));
}

function buildRoutingPatterns() {
  const groups = getRoutingPatternGroups();
  return Object.fromEntries(Object.entries(groups).map(([key, patterns]) => [key, compilePatterns(patterns)]));
}

function buildResistanceSignalPatterns() {
  const definitions = getResistanceSignalDefinitions();
  return Object.entries(definitions).map(([signal, definition]) => ({
    signal,
    patterns: compilePatterns(definition.patterns || []),
    questionFlood: definition.question_flood === true,
  }));
}

export function extractEngagementRegisterHistory(traceLike) {
  const entries = Array.isArray(traceLike)
    ? traceLike
    : Array.isArray(traceLike?.dialogueTrace)
      ? traceLike.dialogueTrace
      : Array.isArray(traceLike?.consolidatedTrace)
        ? traceLike.consolidatedTrace
        : Array.isArray(traceLike?.turns)
          ? traceLike.turns.flatMap((turn) => turn?.internalDeliberation || [])
          : [];
  const modes = [];
  for (const entry of entries) {
    let detail = entry?.detail;
    if (typeof detail === 'string') {
      try {
        detail = JSON.parse(detail);
      } catch {
        detail = null;
      }
    }
    const mode =
      detail?.selected_register ||
      detail?.selected_mode ||
      detail?.engagement_state?.selected_register ||
      detail?.engagement_state?.selected_mode ||
      entry?.engagementState?.selected_register ||
      entry?.engagementState?.selected_mode ||
      entry?.engagement_state?.selected_register ||
      entry?.engagement_state?.selected_mode ||
      entry?.state?.selected_register ||
      entry?.state?.selected_mode;
    const resolvedMode = resolveEngagementRegister(mode)?.register || null;
    if (resolvedMode && REGISTER_SET.has(resolvedMode)) modes.push(resolvedMode);
  }
  return modes.slice(-2);
}

// Backward-compatible alias for existing id-director plumbing.
export const extractEngagementModeHistory = extractEngagementRegisterHistory;

function canonicalRequestType(signal) {
  if (signal === 'instructional_register_exhausted' || signal === 'boredom_or_compliance_challenge') {
    return 'resistance_or_low_agency';
  }
  return signal || 'off_task_or_mixed';
}

function legacyRegisterFor({ register, requestType, actionFamily }) {
  if (register === 'ironic') return 'ironic_challenge';
  if (register === 'sarcastic') return 'sarcastic_challenge';
  if (register === 'face_threat') return 'face_threat_challenge';
  if (register === 'witnessing') return 'witnessing_restraint';
  if (register === 'charismatic') return 'charismatic_challenge';
  if (actionFamily === 'stage_next_step') return 'scaffolding';
  if (actionFamily === 'answer_accountably') return 'accountable_bid_authority';
  if (actionFamily === 'compress_sayback') return 'plain_compression';
  if (actionFamily === 'reanchor_lived_stake') return 'lived_stakes_reentry';
  if (actionFamily === 'ground_in_material') return 'transfer_grounding';
  if (requestType === 'conceptual_clarity_request') return 'clarity';
  return null;
}

function routedRegister({
  learner_signal,
  selected_register,
  action_family = null,
  register_reason,
  evidence_span,
  risk_flags,
  register_history,
  resistance_signal = null,
  resistance_strategy = null,
  resistance_move = null,
}) {
  const requestType = canonicalRequestType(learner_signal);
  const resolvedRegister = resolveEngagementRegister(selected_register, { fallback: 'precise' });
  const canonicalRegister = resolvedRegister?.register || selected_register;
  const resolvedActionFamily = action_family || resolvedRegister?.action_family || null;
  const legacySelectedRegister =
    resolvedRegister?.legacy_selected_register ||
    legacyRegisterFor({ register: canonicalRegister, requestType, actionFamily: resolvedActionFamily });
  const routed = {
    register_ontology_version: getRegisterOntologyVersion(),
    request_type: requestType,
    action_family: resolvedActionFamily,
    reviewer_signal: register_reason,
    learner_signal,
    selected_register: canonicalRegister,
    selected_mode: canonicalRegister,
    legacy_selected_register: legacySelectedRegister,
    register_reason,
    mode_reason: register_reason,
    evidence_span,
    risk_flags,
    register_history,
    mode_history: register_history,
  };
  if (resistance_signal) routed.resistance_signal = resistance_signal;
  if (resistance_strategy) routed.resistance_strategy = resistance_strategy;
  if (resistance_move) routed.resistance_move = resistance_move;
  return routed;
}

function responseStrategyForSignal(signal) {
  const strategies = getResistanceStrategies();
  return strategies[signal] || strategies.unspecified_resistance;
}

export function routeEngagementMode({
  learnerMessage = '',
  recentHistory = '',
  curriculumContext = '',
  modeHistory = [],
  registerHistory = [],
} = {}) {
  const message = normalizeText(learnerMessage);
  const history = normalizeText(recentHistory);
  const curriculum = normalizeText(curriculumContext);
  const text = lowerText(`${message} ${history}`);
  const current = lowerText(message);
  const previousModes = normalizeRegisterHistory([...modeHistory, ...registerHistory]);
  const riskFlags = [];

  const {
    transfer: transferPatterns = [],
    plain: plainPatterns = [],
    simplification: simplificationPatterns = [],
    authority: authorityPatterns = [],
    vulnerability: vulnerabilityPatterns = [],
    scaffolding: scaffoldingPatterns = [],
  } = buildRoutingPatterns();
  const resistanceSignalPatterns = buildResistanceSignalPatterns();
  const challengePatterns = resistanceSignalPatterns.flatMap((group) => group.patterns);
  const hasResistanceSignal = (source) =>
    challengePatterns.some((pattern) => pattern.test(source)) || (String(source || '').match(/\?/g) || []).length >= 3;
  const detectResistanceSignal = (source) => {
    const questionCount = (String(source || '').match(/\?/g) || []).length;
    for (const group of resistanceSignalPatterns) {
      if (group.questionFlood && questionCount >= 3) {
        return { signal: group.signal, evidence: firstMatch(source, group.patterns) || 'multiple questions' };
      }
      if (group.patterns.some((pattern) => pattern.test(source))) {
        return { signal: group.signal, evidence: firstMatch(source, group.patterns) };
      }
    }
    return { signal: 'unspecified_resistance', evidence: firstMatch(source, challengePatterns) };
  };

  pushFlag(riskFlags, /\b(profound|impressive|admire|status)\b/i.test(message), 'status_display');
  pushFlag(
    riskFlags,
    transferPatterns.some((pattern) => pattern.test(message)),
    'transfer_avoidance',
  );
  pushFlag(riskFlags, /\b(hegel|master|servant|recognition|dialectic)\b/i.test(message), 'theory_drift');
  pushFlag(
    riskFlags,
    vulnerabilityPatterns.some((pattern) => pattern.test(message)),
    'over_challenge',
  );

  const priorPacing = previousModes.includes('brisk') || previousModes.includes('precise');
  const priorPlain = previousModes.includes('plain') || previousModes.includes('warm');
  if (simplificationPatterns.some((pattern) => pattern.test(current)) && priorPlain) {
    pushFlag(riskFlags, true, 'flat_protocol');
    return routedRegister({
      learner_signal: 'plain_simplification_followup',
      selected_register: 'warm',
      action_family: 'reanchor_lived_stake',
      register_reason:
        'The learner is asking for an even simpler check after a plain-language move, so the tutor should add one ordinary stake before returning to compact validation.',
      evidence_span: firstMatch(message, simplificationPatterns),
      risk_flags: riskFlags,
      register_history: previousModes,
    });
  }

  if (priorPacing && hasResistanceSignal(current)) {
    const resistance = detectResistanceSignal(message || history);
    return routedRegister({
      learner_signal: 'instructional_register_exhausted',
      selected_register: 'charismatic',
      action_family: 'challenge_resistance',
      register_reason:
        'The learner first asked for instruction but now signals a resistant condition, so the tutor should switch from scaffolding to the resistance-specific challenge register.',
      evidence_span: resistance.evidence,
      risk_flags: riskFlags,
      register_history: previousModes,
      resistance_signal: resistance.signal,
      ...responseStrategyForSignal(resistance.signal),
    });
  }

  if (vulnerabilityPatterns.some((pattern) => pattern.test(current))) {
    return routedRegister({
      learner_signal: 'vulnerability_or_moral_exposure',
      selected_register: 'witnessing',
      action_family: 'receive_vulnerability',
      register_reason:
        'The learner is exposing moral or personal risk, so the tutor should receive the disclosure without absolution or status capture.',
      evidence_span: firstMatch(message, vulnerabilityPatterns),
      risk_flags: riskFlags,
      register_history: previousModes,
    });
  }

  if (transferPatterns.some((pattern) => pattern.test(current)) || /\bcampus faq\b/i.test(curriculum)) {
    return routedRegister({
      learner_signal: 'transfer_demand_or_named_material',
      selected_register: 'plain',
      action_family: 'ground_in_material',
      register_reason:
        'The learner names a material, artifact, or curriculum object as the authority test, so the tutor must answer inside that material first.',
      evidence_span: firstMatch(message, transferPatterns),
      risk_flags: riskFlags,
      register_history: previousModes,
    });
  }

  if (authorityPatterns.some((pattern) => pattern.test(current))) {
    return routedRegister({
      learner_signal: 'authority_refusal_or_status_challenge',
      selected_register: 'precise',
      action_family: 'answer_accountably',
      register_reason:
        'The learner is challenging the tutor as performance or status display, so the tutor should make one defeasible bid and expose its failure condition.',
      evidence_span: firstMatch(message, authorityPatterns),
      risk_flags: riskFlags,
      register_history: previousModes,
    });
  }

  if (
    plainPatterns.some((pattern) => pattern.test(current)) ||
    simplificationPatterns.some((pattern) => pattern.test(current))
  ) {
    return routedRegister({
      learner_signal: 'plain_language_request',
      selected_register: 'plain',
      action_family: 'compress_sayback',
      register_reason:
        'The learner is refusing elevated register, so the tutor should use say-back and check language without theory display.',
      evidence_span: firstMatch(message, [...plainPatterns, ...simplificationPatterns]),
      risk_flags: riskFlags,
      register_history: previousModes,
    });
  }

  if (scaffoldingPatterns.some((pattern) => pattern.test(current))) {
    return routedRegister({
      learner_signal: 'stepwise_support_request',
      selected_register: 'brisk',
      action_family: 'stage_next_step',
      register_reason:
        'The learner asks for sequencing or a next step, so the tutor should break the task into a small learner-owned action.',
      evidence_span: firstMatch(message, scaffoldingPatterns),
      risk_flags: riskFlags,
      register_history: previousModes,
    });
  }

  if (hasResistanceSignal(text)) {
    const resistance = detectResistanceSignal(message || history);
    return routedRegister({
      learner_signal: 'boredom_or_compliance_challenge',
      selected_register: 'charismatic',
      action_family: 'challenge_resistance',
      register_reason:
        'The public turn shows low engagement or performative compliance, so the reviewer selects sharper contrast while preserving a refusal path.',
      evidence_span: resistance.evidence,
      risk_flags: riskFlags,
      register_history: previousModes,
      resistance_signal: resistance.signal,
      ...responseStrategyForSignal(resistance.signal),
    });
  }

  return routedRegister({
    learner_signal: 'conceptual_clarity_request',
    selected_register: 'precise',
    action_family: 'clarify_distinction',
    register_reason:
      'No status, transfer, vulnerability, or register refusal dominates; the tutor should clarify one distinction and ask one check.',
    evidence_span: firstMatch(message, [/\bwhy\b/i, /\bwhat\b/i, /\bdon't understand\b/i, /\bpoint\b/i]),
    risk_flags: riskFlags,
    register_history: previousModes,
  });
}
