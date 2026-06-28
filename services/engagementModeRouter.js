const REGISTERS = Object.freeze([
  'clarity',
  'scaffolding',
  'accountable_bid_authority',
  'plain_compression',
  'lived_stakes_reentry',
  'transfer_grounding',
  'charismatic_challenge',
  'witnessing_restraint',
]);

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
  return registerHistory.filter((register) => REGISTER_SET.has(register)).slice(-2);
}

function pushFlag(flags, condition, flag) {
  if (condition && !flags.includes(flag)) flags.push(flag);
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
    if (REGISTER_SET.has(mode)) modes.push(mode);
  }
  return modes.slice(-2);
}

// Backward-compatible alias for existing id-director plumbing.
export const extractEngagementModeHistory = extractEngagementRegisterHistory;

function routedRegister({
  learner_signal,
  selected_register,
  register_reason,
  evidence_span,
  risk_flags,
  register_history,
  resistance_signal = null,
  resistance_strategy = null,
  resistance_move = null,
}) {
  const routed = {
    learner_signal,
    selected_register,
    selected_mode: selected_register,
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
  switch (signal) {
    case 'boredom':
      return {
        resistance_strategy: 'concrete_scene_test',
        resistance_move:
          'Replace the list with one concrete scene or object that makes the hinge testable; ask the learner to use the scene to accept or break the claim.',
      };
    case 'frustration':
      return {
        resistance_strategy: 'stuck_step_resolution',
        resistance_move:
          'Name the exact step that is stuck, give one textual or conceptual anchor that resolves it, and ask for a forced-choice reconstruction so frustration has somewhere to go.',
      };
    case 'irrelevance':
      return {
        resistance_strategy: 'owned_case_transfer',
        resistance_move:
          'Move the claim into a case the learner can own, then make the learner judge whether the case proves or breaks the claim.',
      };
    case 'question_flood':
      return {
        resistance_strategy: 'question_collapse',
        resistance_move:
          'Collapse the question flood into one decisive question, answer only that hinge, and require a provisional commitment before inviting more questions.',
      };
    case 'rote_parroting':
      return {
        resistance_strategy: 'anti_formula_generation',
        resistance_move:
          'Forbid mere sequence terms, give one concrete pressure test, and ask the learner to generate the idea in a fresh sentence or example.',
      };
    case 'dismissal':
      return {
        resistance_strategy: 'minimum_viable_test',
        resistance_move:
          'Do not argue for attention; offer one short test whose result decides whether continuing is worth it.',
      };
    default:
      return {
        resistance_strategy: 'single_hinge_test',
        resistance_move:
          'Find the one hinge behind the resistance, state it plainly, and ask for one concrete test rather than another explanation.',
      };
  }
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

  const transferPatterns = [
    /\buse (that|this) material\b/i,
    /\bai syllabus\b/i,
    /\bcampus faq\b/i,
    /\bsyllabus\b/i,
    /\bcurriculum\b/i,
    /\bbaseline\b/i,
    /\bdecision rights?\b/i,
    /\bfailure evidence\b/i,
    /\btask\b/i,
    /\bdata\b/i,
    /\bstudent work\b/i,
    /\bdon't drag (this|it) back\b/i,
  ];
  const plainPatterns = [
    /\bplain words?\b/i,
    /\bplainly\b/i,
    /\bplain language\b/i,
    /\bno grand language\b/i,
    /\bsay it this way\b/i,
    /\bsay it in plain\b/i,
    /\bone way to check\b/i,
  ];
  const simplificationPatterns = [
    /\beven simpler\b/i,
    /\bsimpler\b/i,
    /\bwhat would i say back\b/i,
    /\bsay back\b/i,
    /\bprove i got it\b/i,
    /\bmake the check\b/i,
  ];
  const authorityPatterns = [
    /\bwhy should i\b/i,
    /\btrust(ing)?\b/i,
    /\bworth trusting\b/i,
    /\bperformance\b/i,
    /\bpolished\b/i,
    /\bstatus\b/i,
    /\bprofound\b/i,
    /\bimpressive\b/i,
    /\badmire\b/i,
    /\bbid for authority\b/i,
    /\btrying to make me think\b/i,
  ];
  const vulnerabilityPatterns = [
    /\bi want you to tell me\b/i,
    /\bi'?m not sure i deserve\b/i,
    /\bdeserve\b/i,
    /\bno shame\b/i,
    /\bfeel bad\b/i,
    /\bi'?m worried\b/i,
    /\bi have to admit\b/i,
    /\bmorally\b/i,
    /\buneasy\b/i,
  ];
  const scaffoldingPatterns = [
    /\bstep by step\b/i,
    /\bbreak (it|this) down\b/i,
    /\bwalk me through\b/i,
    /\bnext step\b/i,
    /\bwhat should i do\b/i,
    /\bhow do i start\b/i,
  ];
  const resistanceSignalPatterns = [
    {
      signal: 'frustration',
      patterns: [/\bfrustrat(?:ed|ing|ion)\b/i, /\bannoy(?:ed|ing)\b/i, /\bfed up\b/i],
    },
    {
      signal: 'irrelevance',
      patterns: [
        /\birrelevant\b/i,
        /\bpointless\b/i,
        /\bwhat'?s the point\b/i,
        /\bdon'?t see the point\b/i,
        /\bwhy (?:does|should) (?:this|that|it) matter\b/i,
        /\bwhy should i care\b/i,
        /\bwhat (?:is|are) (?:this|that|it) supposed to explain\b/i,
        /\bwhat does (this|that|it) have to do with\b/i,
        /\bhow is (this|that|it) useful\b/i,
      ],
    },
    {
      signal: 'rote_parroting',
      patterns: [
        /\bparrot(?:ing)?\b/i,
        /\bjust repeat\b/i,
        /\brepeat the sequence\b/i,
        /\bmemor(y|ize|ising|izing)\b/i,
        /\bformula\b/i,
        /\brecite\b/i,
      ],
    },
    {
      signal: 'question_flood',
      patterns: [
        /\bbut why\b/i,
        /\bwhy does that matter\b/i,
        /\bwhat am i supposed to do with\b/i,
        /\bwhy (?:this|hegel|not|should|does)\b/i,
      ],
      questionFlood: true,
    },
    {
      signal: 'boredom',
      patterns: [
        /\bboring\b/i,
        /\bbored\b/i,
        /\bdead\b/i,
        /\blist[- ]like\b/i,
        /\bmoving arrows\b/i,
        /\bworksheet\b/i,
        /\bnot engaging\b/i,
        /\bi don't care\b/i,
      ],
    },
    {
      signal: 'dismissal',
      patterns: [/\bwhatever\b/i, /\bjust give me the answer\b/i, /\bthis feels fake\b/i],
    },
  ];
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

  const priorInstructional = previousModes.includes('scaffolding') || previousModes.includes('clarity');
  const priorPlain = previousModes.includes('plain_compression') || previousModes.includes('lived_stakes_reentry');
  if (simplificationPatterns.some((pattern) => pattern.test(current)) && priorPlain) {
    pushFlag(riskFlags, true, 'flat_protocol');
    return routedRegister({
      learner_signal: 'plain_simplification_followup',
      selected_register: 'lived_stakes_reentry',
      register_reason:
        'The learner is asking for an even simpler check after a plain-language move, so the tutor should add one ordinary stake before returning to compact validation.',
      evidence_span: firstMatch(message, simplificationPatterns),
      risk_flags: riskFlags,
      register_history: previousModes,
    });
  }

  if (priorInstructional && hasResistanceSignal(current)) {
    const resistance = detectResistanceSignal(message || history);
    return routedRegister({
      learner_signal: 'instructional_register_exhausted',
      selected_register: 'charismatic_challenge',
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
      selected_register: 'witnessing_restraint',
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
      selected_register: 'transfer_grounding',
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
      selected_register: 'accountable_bid_authority',
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
      selected_register: 'plain_compression',
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
      selected_register: 'scaffolding',
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
      selected_register: 'charismatic_challenge',
      register_reason:
        'The learner signals low engagement or performative compliance, so the tutor should use sharper contrast while preserving a refusal path.',
      evidence_span: resistance.evidence,
      risk_flags: riskFlags,
      register_history: previousModes,
      resistance_signal: resistance.signal,
      ...responseStrategyForSignal(resistance.signal),
    });
  }

  return routedRegister({
    learner_signal: 'conceptual_clarity_request',
    selected_register: 'clarity',
    register_reason:
      'No status, transfer, vulnerability, or register refusal dominates; the tutor should clarify one distinction and ask one check.',
    evidence_span: firstMatch(message, [/\bwhy\b/i, /\bwhat\b/i, /\bdon't understand\b/i, /\bpoint\b/i]),
    risk_flags: riskFlags,
    register_history: previousModes,
  });
}
