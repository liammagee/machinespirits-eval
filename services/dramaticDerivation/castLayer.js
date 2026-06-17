export const CAST_LAYER_SCHEMA = 'dramatic-derivation.cast-state.v0';
export const TUTOR_REINVENTION_SCHEMA = 'dramatic-derivation.tutor-reinvention.v0';

export const CAST_REINVENTION_TRIGGERS = Object.freeze([
  'echo_without_ownership',
  'didactic_failure',
  'recognition_pressure_unresolved',
  'defensive_after_correction',
  'repeated_same_object_repair',
  'scene_needs_repair',
]);

const FORBIDDEN_KEYS = new Set([
  'secret',
  'proofPath',
  'proof_path',
  'rawBoard',
  'raw_board',
  'hiddenBoard',
  'hidden_board',
  'corruptionLedger',
  'corruption_ledger',
  'D',
  'dNow',
  'dIfRestored',
  'deltaD',
  'finalD',
  'trajectoryD',
  'boardD',
  'sourcePremiseIds',
  'sourceProofPathIds',
  'proofTree',
  'closureTrace',
  'premiseId',
  'premiseIds',
  'ruleId',
  'ruleIds',
  'predicate',
  'predicateName',
  'releaseSchedule',
  'release_schedule',
  'releasedFacts',
  'released_facts',
  'ledger',
]);

const ALLOWED_REINVENTION_CHANGES = Object.freeze([
  'tone',
  'figure',
  'tempo',
  'example_style',
  'recognition_act',
]);

const FORBIDDEN_REINVENTION_CHANGES = Object.freeze([
  'release_timing',
  'secret',
  'proof_target',
  'answer_assertion',
  'restore_authority',
  'hold_authority',
]);

const STANCE_FALLBACKS = Object.freeze({
  echo_without_ownership: 'co-investigator',
  didactic_failure: 'patient demonstrator',
  recognition_pressure_unresolved: 'recognitive listener',
  defensive_after_correction: 'co-investigator',
  repeated_same_object_repair: 'repair-and-rebuild guide',
  scene_needs_repair: 'plain explainer',
});

function norm(text) {
  return String(text || '').toLowerCase();
}

function cleanText(value, fallback = null, max = 220) {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, max) : fallback;
}

function cleanList(value, maxItems = 4, maxChars = 100) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, null, maxChars)).filter(Boolean).slice(0, maxItems);
}

function auditForbiddenKeys(value, path = []) {
  const leaks = [];
  if (!value || typeof value !== 'object') return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => leaks.push(...auditForbiddenKeys(item, [...path, String(index)])));
    return leaks;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (FORBIDDEN_KEYS.has(key)) leaks.push({ path: nextPath.join('.'), key });
    leaks.push(...auditForbiddenKeys(child, nextPath));
  }
  return leaks;
}

export function auditCastLayerPublicInput(input = {}) {
  const leaks = auditForbiddenKeys(input);
  return {
    ok: leaks.length === 0,
    leaks,
    forbiddenKeys: [...FORBIDDEN_KEYS].sort(),
  };
}

function publicTranscriptLines(transcript = []) {
  return (Array.isArray(transcript) ? transcript : [])
    .filter((line) => ['learner', 'tutor', 'stage', 'director'].includes(line?.role))
    .map((line) => ({
      role: line.role === 'director' ? 'stage' : line.role,
      text: cleanText(line.text, '', 240),
      exchangeType: line.meta?.exchange?.type || line.exchangeType || null,
    }))
    .filter((line) => line.text);
}

function lastLearnerText(lines = []) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].role === 'learner') return lines[i].text;
  }
  return '';
}

function authoredTutor(worldCast = {}) {
  const tutor = worldCast?.tutor && typeof worldCast.tutor === 'object' ? worldCast.tutor : {};
  return {
    stableRole: cleanText(tutor.role, 'tutor', 80),
    publicIdentity: cleanText(tutor.public_identity || tutor.publicIdentity, 'public guide of the inquiry', 160),
    temperament: cleanList(tutor.temperament),
    pedagogicalHabit: cleanText(tutor.pedagogical_habit || tutor.pedagogicalHabit, null, 180),
    recognitionStyle: cleanText(tutor.recognition_style || tutor.recognitionStyle, null, 180),
    defaultStance: cleanText(tutor.default_stance || tutor.defaultStance, 'careful guide', 80),
    risks: cleanList(tutor.risks, 4, 140),
  };
}

function authoredLearner(worldCast = {}, worldLearnerVoice = null) {
  const learner = worldCast?.learner && typeof worldCast.learner === 'object' ? worldCast.learner : {};
  return {
    stableRole: cleanText(learner.role, 'learner', 80),
    publicIdentity: cleanText(learner.public_identity || learner.publicIdentity, worldLearnerVoice || 'public learner in the inquiry', 170),
    level: cleanText(learner.level, null, 80),
    priorBias: cleanText(learner.prior_bias || learner.priorBias, null, 170),
    temperament: cleanList(learner.temperament),
    recognitionNeed: cleanText(learner.recognition_need || learner.recognitionNeed, null, 170),
    likelyFailure: cleanText(learner.likely_failure || learner.likelyFailure, null, 170),
    phaticStyle: cleanText(learner.phatic_style || learner.phaticStyle, null, 120),
  };
}

function authoredRelation(worldCast = {}, worldSetting = null) {
  const relation = worldCast?.relation && typeof worldCast.relation === 'object' ? worldCast.relation : {};
  return {
    frame: cleanText(relation.frame, 'public inquiry', 120),
    powerGradient: cleanText(relation.power_gradient || relation.powerGradient, null, 100),
    stakes: cleanText(relation.stakes, worldSetting, 180),
    trustBaseline: cleanText(relation.trust_baseline || relation.trustBaseline, null, 100),
  };
}

function postureFromPublicSignals({ discursiveCalibration, transcript, learnerState = {} }) {
  if (discursiveCalibration?.publicPosture) return discursiveCalibration.publicPosture;
  if (learnerState.publicPosture) return learnerState.publicPosture;
  const text = norm(lastLearnerText(publicTranscriptLines(transcript)));
  if (/\b(as you said|you said|just repeating|i can repeat)\b/u.test(text)) return 'fluent_echo';
  if (/\b(but i already|you keep|not what i meant|i told you)\b/u.test(text)) return 'defensive_after_correction';
  if (/\b(why does|why would|what does .* matter|what is .* for)\b/u.test(text)) return 'purpose_question';
  if (/\b(i am lost|i'm lost|lost me|confused|do not follow|don't follow)\b/u.test(text)) return 'confused';
  if (/\b(whatever|i'm done|i am done|just tell me|don't care|do not care)\b/u.test(text)) return 'social_disengagement';
  return 'ordinary';
}

function relationTrustFromSignals({ discursiveCalibration, recognitionNeed, scene }) {
  const strain = discursiveCalibration?.conversationalStrain?.level || null;
  const pressure = recognitionNeed || discursiveCalibration?.recognitionPressure || scene?.recognitionNeed || null;
  if (strain === 'high' || pressure?.level === 'high') return 'strained';
  if (strain === 'medium' || pressure?.active) return 'working_but_thin';
  if (scene?.status === 'needs_repair' || scene?.closeStatus === 'needs_repair') return 'working_but_thin';
  return 'working';
}

function activeCommitmentFor({ tutor, learner, relation, posture }) {
  const recognition = learner.recognitionNeed || tutor.recognitionStyle;
  if (posture === 'fluent_echo') return 'check ownership without treating fluent echo as mastery';
  if (posture === 'defensive_after_correction') return 'separate correction from dismissal and re-open joint inquiry';
  if (posture === 'purpose_question') return 'connect the current public object to the question before pressing on';
  if (posture === 'social_disengagement') return 'restore contact through a small public re-entry';
  if (recognition) return recognition;
  if (relation.powerGradient) return `teach within ${relation.powerGradient} pressure without overstepping the learner`;
  return 'keep proof conduct clear while letting the learner own the next step';
}

function publicRepairSignals(repairSignals = []) {
  return (Array.isArray(repairSignals) ? repairSignals : [])
    .map((signal) => ({
      publicObject: cleanText(signal?.publicObject, null, 120),
      count: Number.isFinite(Number(signal?.count)) ? Number(signal.count) : 0,
      sameObject: signal?.sameObject === true,
    }))
    .filter((signal) => signal.publicObject || signal.count > 0 || signal.sameObject);
}

function triggerFromSignals({ discursiveCalibration, didacticMode, scene, transcript, recognitionNeed, repairSignals }) {
  const lines = publicTranscriptLines(transcript);
  const text = norm(lastLearnerText(lines));
  const repairs = publicRepairSignals(repairSignals);
  const posture = postureFromPublicSignals({ discursiveCalibration, transcript });
  const didacticFailed =
    didacticMode?.learningSignal &&
    didacticMode.learningSignal !== 'unknown' &&
    (didacticMode.scope === 'next_act' || scene?.closeStatus === 'needs_repair' || scene?.status === 'needs_repair');
  if (posture === 'fluent_echo' || didacticMode?.learningSignal === 'echo_only') {
    return { trigger: 'echo_without_ownership', rationale: 'public learner talk echoes the tutor without ownership' };
  }
  if (posture === 'defensive_after_correction') {
    return { trigger: 'defensive_after_correction', rationale: 'learner is defensive after repeated correction' };
  }
  if (repairs.some((signal) => signal.sameObject && signal.count >= 2)) {
    return { trigger: 'repeated_same_object_repair', rationale: 'same public object needed repeated repair' };
  }
  if (didacticFailed) {
    return { trigger: 'didactic_failure', rationale: 'public didactic exit condition did not clear within scope' };
  }
  const pressure = recognitionNeed || discursiveCalibration?.recognitionPressure || scene?.recognitionNeed || null;
  if (pressure?.active && pressure.level === 'high') {
    return { trigger: 'recognition_pressure_unresolved', rationale: 'recognition pressure remains high' };
  }
  if (scene?.closeStatus === 'needs_repair' || scene?.status === 'needs_repair' || /\b(lost|confused|do not follow|don't follow)\b/u.test(text)) {
    return { trigger: 'scene_needs_repair', rationale: 'scene closes or reads as needing public repair' };
  }
  return null;
}

function deriveTutorReinventionState({
  castState,
  transcript = [],
  scene = null,
  turn = null,
  discursiveCalibration = null,
  didacticMode = null,
  recognitionNeed = null,
  repairSignals = [],
  enabled = true,
} = {}) {
  const inputAudit = auditCastLayerPublicInput({
    transcript,
    scene,
    turn,
    discursiveCalibration,
    didacticMode,
    recognitionNeed,
    repairSignals,
  });
  if (!enabled || !inputAudit.ok || !castState) {
    return null;
  }
  const selected = triggerFromSignals({
    discursiveCalibration,
    didacticMode,
    scene,
    transcript,
    recognitionNeed,
    repairSignals,
  });
  if (!selected) return null;
  const fromStance = cleanText(castState.tutor?.currentStance, 'careful guide', 80);
  const toStance = STANCE_FALLBACKS[selected.trigger] || 'co-investigator';
  if (fromStance === toStance && selected.trigger !== 'echo_without_ownership') {
    return null;
  }
  const repairs = publicRepairSignals(repairSignals);
  const currentObject = cleanText(
    didacticMode?.currentObject || repairs.find((signal) => signal.publicObject)?.publicObject || scene?.goal,
    'the current public object',
    140,
  );
  const state = {
    schema: TUTOR_REINVENTION_SCHEMA,
    publicOnly: true,
    active: true,
    source: selected.trigger === 'didactic_failure' ? 'didactic_failure' : 'public_dialogue_state',
    trigger: selected.trigger,
    fromStance,
    toStance,
    publicRationale: selected.rationale,
    allowedChanges: [...ALLOWED_REINVENTION_CHANGES],
    forbiddenChanges: [...FORBIDDEN_REINVENTION_CHANGES],
    exitCondition:
      selected.trigger === 'echo_without_ownership'
        ? 'learner restates the current distinction in their own words'
        : selected.trigger === 'recognition_pressure_unresolved'
          ? 'learner visibly accepts the acknowledgement or names the remaining friction'
          : `learner takes up ${currentObject} without renewed repair`,
    scope: scene?.index ? 'scene' : 'next_scene',
    startedTurn: Number.isFinite(Number(turn)) ? Number(turn) : null,
    expiresAtActEnd: true,
    mayOverrideProofControl: false,
    proofControlAuthority: 'none',
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditCastLayerPublicInput(state),
  };
}

function projectionLines(state, roleName) {
  if (!state || state.publicOnly !== true || state.mayOverrideProofControl !== false || state.inputAudit?.ok === false) return [];
  const reinvention = state.reinvention?.active ? state.reinvention : null;
  const common = {
    director: [
      `Tutor: ${state.tutor.stableRole}${state.tutor.publicIdentity ? ` — ${state.tutor.publicIdentity}` : ''}.`,
      `Learner: ${state.learner.stableRole}${state.learner.publicIdentity ? ` — ${state.learner.publicIdentity}` : ''}.`,
      `Relation: ${state.relation.frame}${state.relation.pressure ? `; pressure: ${state.relation.pressure}` : ''}.`,
      ...(reinvention ? [`Authorized tutor stance for this scene: ${reinvention.fromStance} -> ${reinvention.toStance}.`] : []),
    ],
    tutor: [
      `Your public role: ${state.tutor.stableRole}; current stance: ${state.tutor.currentStance}.`,
      `Learner posture: ${state.learner.currentPosture}; likely hazard: ${state.learner.likelyFailure || 'premature closure'}.`,
      `Relation pressure: ${state.relation.currentTrust}; commitment: ${state.tutor.activeCommitment}.`,
      ...(reinvention
        ? [
            `Tutor reinvention active: ${reinvention.fromStance} -> ${reinvention.toStance}.`,
            `Rationale: ${reinvention.publicRationale}. Exit: ${reinvention.exitCondition}.`,
            `Allowed changes: ${reinvention.allowedChanges.join(', ')}. Forbidden changes: ${reinvention.forbiddenChanges.join(', ')}.`,
          ]
        : []),
    ],
    learner: [
      `Your public role: ${state.learner.stableRole}${state.learner.publicIdentity ? ` — ${state.learner.publicIdentity}` : ''}.`,
      `Relation to tutor: ${state.relation.frame}${state.relation.powerGradient ? ` (${state.relation.powerGradient})` : ''}.`,
      ...(state.learner.phaticPattern ? [`Speech habit to inhabit: ${state.learner.phaticPattern}.`] : []),
      ...(state.relation.pressure ? [`Public stakes: ${state.relation.pressure}.`] : []),
    ],
    tutorSuperego: [
      `Audit tutor stance: current stance ${state.tutor.currentStance}; default stance ${state.tutor.defaultStance}.`,
      ...(reinvention
        ? [
            `Reinvention audit: ${reinvention.fromStance} -> ${reinvention.toStance}; exit condition: ${reinvention.exitCondition}.`,
            'Block any reinvention that changes release timing, proof target, restore/hold authority, or answer assertion.',
          ]
        : ['No tutor reinvention is active; audit ordinary stance compliance only.']),
    ],
  };
  return common[roleName] || [];
}

function rejectedState(inputAudit) {
  const state = {
    schema: CAST_LAYER_SCHEMA,
    publicOnly: true,
    authority: 'public_cast_context',
    mayOverrideProofControl: false,
    proofControlAuthority: 'none',
    tutor: {
      stableRole: 'tutor',
      publicIdentity: 'public guide of the inquiry',
      defaultStance: 'careful guide',
      currentStance: 'careful guide',
      riskFlags: [],
      activeCommitment: 'input rejected by public-only audit',
    },
    learner: {
      stableRole: 'learner',
      publicIdentity: 'public learner in the inquiry',
      currentPosture: 'ordinary',
      likelyFailure: null,
      recognitionNeed: null,
      phaticPattern: null,
    },
    relation: {
      frame: 'public inquiry',
      currentTrust: 'unknown',
      pressure: null,
      powerGradient: null,
    },
    reinvention: null,
    promptNotes: {
      director: [],
      tutor: [],
      learner: [],
      tutorSuperego: [],
    },
    evidence: ['input rejected by public-only audit'],
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditCastLayerPublicInput(state),
  };
}

export function deriveCastState(input = {}) {
  const inputAudit = auditCastLayerPublicInput(input);
  if (!inputAudit.ok) return rejectedState(inputAudit);
  const worldCast = input.worldCast || input.cast || {};
  const tutor = authoredTutor(worldCast);
  const learner = authoredLearner(worldCast, cleanText(input.worldLearnerVoice, null, 180));
  const relation = authoredRelation(worldCast, cleanText(input.worldSetting, null, 180));
  const currentPosture = postureFromPublicSignals({
    discursiveCalibration: input.discursiveCalibration,
    transcript: input.transcript,
    learnerState: input.learnerState || input.publicLearnerState || {},
  });
  const currentTrust = relationTrustFromSignals({
    discursiveCalibration: input.discursiveCalibration,
    recognitionNeed: input.recognitionNeed,
    scene: input.scene,
  });
  const baseState = {
    schema: CAST_LAYER_SCHEMA,
    publicOnly: true,
    authority: 'public_cast_context',
    mayOverrideProofControl: false,
    proofControlAuthority: 'none',
    tutor: {
      stableRole: tutor.stableRole,
      publicIdentity: tutor.publicIdentity,
      defaultStance: tutor.defaultStance,
      currentStance: tutor.defaultStance,
      temperament: tutor.temperament,
      pedagogicalHabit: tutor.pedagogicalHabit,
      recognitionStyle: tutor.recognitionStyle,
      riskFlags: tutor.risks,
      activeCommitment: activeCommitmentFor({ tutor, learner, relation, posture: currentPosture }),
    },
    learner: {
      stableRole: learner.stableRole,
      publicIdentity: learner.publicIdentity,
      level: learner.level,
      priorBias: learner.priorBias,
      temperament: learner.temperament,
      currentPosture,
      likelyFailure: learner.likelyFailure,
      recognitionNeed: learner.recognitionNeed,
      phaticPattern: learner.phaticStyle,
    },
    relation: {
      frame: relation.frame,
      currentTrust,
      pressure: relation.stakes,
      powerGradient: relation.powerGradient,
      trustBaseline: relation.trustBaseline,
    },
    reinvention: null,
    promptNotes: {
      director: [],
      tutor: [],
      learner: [],
      tutorSuperego: [],
    },
    evidence: [
      worldCast && Object.keys(worldCast).length ? 'authored public cast block' : 'fallback public setting and learner voice',
      ...(input.stagePrologue ? ['public director prologue'] : []),
      ...(input.discursiveCalibration ? ['public discursive calibration'] : []),
      ...(input.didacticMode ? ['public didactic mode'] : []),
    ],
    inputAudit,
  };
  const reinvention = deriveTutorReinventionState({
    castState: baseState,
    transcript: input.transcript,
    scene: input.scene,
    turn: input.turn,
    discursiveCalibration: input.discursiveCalibration,
    didacticMode: input.didacticMode,
    recognitionNeed: input.recognitionNeed,
    repairSignals: input.repairSignals,
    enabled: input.reinventionEnabled !== false,
  });
  const currentStance = reinvention?.active ? reinvention.toStance : baseState.tutor.currentStance;
  const state = {
    ...baseState,
    tutor: {
      ...baseState.tutor,
      currentStance,
    },
    reinvention,
  };
  const withPrompts = {
    ...state,
    promptNotes: {
      director: projectionLines(state, 'director'),
      tutor: projectionLines(state, 'tutor'),
      learner: projectionLines(state, 'learner'),
      tutorSuperego: projectionLines(state, 'tutorSuperego'),
    },
  };
  return {
    ...withPrompts,
    nonLeakAudit: auditCastLayerPublicInput(withPrompts),
  };
}

export function projectCastStateForRole(state, roleName) {
  if (!state || state.publicOnly !== true || state.mayOverrideProofControl !== false || state.inputAudit?.ok === false) {
    return [];
  }
  const notes = roleName === 'tutor_superego' ? state.promptNotes?.tutorSuperego : state.promptNotes?.[roleName];
  return Array.isArray(notes) ? notes.slice() : projectionLines(state, roleName);
}
