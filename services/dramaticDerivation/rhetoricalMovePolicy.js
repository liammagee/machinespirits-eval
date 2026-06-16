/**
 * Scene/exchange bookkeeping and a shallow rhetorical move policy.
 *
 * The policy is deliberately small: it maps visible proof/dialogue pressure to
 * a distribution over the existing tutor figures. It is not a taxonomy of
 * situations, and it does not authorize new evidence. The stochastic path is a
 * deterministic seeded sampler over that distribution, so paid probes remain
 * reproducible.
 */

export const RHETORICAL_POLICY_SCHEMA = 'dramatic-derivation.rhetorical-policy.v0';
export const SCENE_SCHEMA = 'dramatic-derivation.scene.v0';
export const SCENE_TEMPO_SCHEMA = 'dramatic-derivation.scene-tempo.v0';
export const RECOGNITION_NEED_SCHEMA = 'dramatic-derivation.recognition-need.v0';

const SCENE_DEFAULTS = Object.freeze({
  maxExchanges: 4,
  maxPhaticExchanges: 2,
  closeOnDDecrease: true,
  closeOnConfusion: true,
  recognitionNeed: true,
  tempo: null,
});

const POLICY_DEFAULTS = Object.freeze({
  mode: 'deterministic',
  seed: 1,
  temperature: 1,
});

export const SCENE_TEMPO_BEATS = Object.freeze([
  'uptake_only',
  'repair_request',
  'recap',
  'hesitation',
  'hypothesis',
  'evidence',
  'recognition',
]);

const SCENE_TEMPO_DEFAULTS = Object.freeze({
  mode: 'sample',
  seed: 1,
  temperature: 1,
  weights: Object.freeze({
    uptake_only: 0.22,
    repair_request: 0.08,
    recap: 0.24,
    hesitation: 0.12,
    hypothesis: 0.2,
    evidence: 0.08,
    recognition: 0.06,
  }),
});

const TEMPO_BEAT_INFO = Object.freeze({
  uptake_only: {
    label: 'uptake only',
    instruction:
      'Let this exchange be simple uptake if that is honest. A brief "I see" or "yes, that much is clear" is enough; do not add board changes or a hypothesis unless something genuinely changed.',
  },
  repair_request: {
    label: 'repair request',
    instruction:
      'Make space for confusion or repair. If the thread is lost, ask for the missing link in ordinary words; do not pretend to have advanced.',
  },
  recap: {
    label: 'recap',
    instruction:
      'Use this exchange to restate what is already public in short ordinary language. Consolidate continuity; avoid adding a new conjecture unless the record now demands one.',
  },
  hesitation: {
    label: 'hesitation',
    instruction:
      'Allow a pause or uncertainty. It is acceptable to say "wait" or "I am not ready to write that yet" while naming the exact gap.',
  },
  hypothesis: {
    label: 'hypothesis',
    instruction:
      'A conjecture is welcome, but mark it as tentative. Keep it grounded in shown details and do not treat it as settled.',
  },
  evidence: {
    label: 'evidence uptake',
    instruction:
      'New evidence is entering or has just entered. Take up only what is shown, in short words, and say what it changes without racing past it.',
  },
  recognition: {
    label: 'recognition',
    instruction:
      'The scene may now stage the finding. Let the learner say the answer from their own record, with the ordinary reasons that make it theirs.',
  },
});

const EXCHANGE_TYPES = new Set([
  'substantive',
  'phatic_ack',
  'confusion',
  'repair_request',
  'resistance',
  'hypothesis',
  'assertion',
]);

export const RHETORICAL_FIGURES = Object.freeze(['erotema', 'analogia', 'exemplum', 'anaphora', 'aposiopesis']);

function parseConfig(raw, defaults, label) {
  if (raw === true || raw === undefined || raw === null) return { ...defaults };
  if (raw === false || raw === 'off') return null;
  let cfg = raw;
  if (typeof cfg === 'string') {
    if (!cfg.trim() || cfg.trim() === 'on') return { ...defaults };
    if (cfg.trim() === 'off') return null;
    try {
      cfg = JSON.parse(cfg);
    } catch (err) {
      throw new Error(`${label} config is not valid JSON: ${err.message}`);
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error(`${label} config must be a JSON object`);
  }
  for (const key of Object.keys(cfg)) {
    if (!(key in defaults)) {
      throw new Error(`${label} config: unknown key "${key}" (known: ${Object.keys(defaults).join(', ')})`);
    }
  }
  return { ...defaults, ...cfg };
}

export function normalizeSceneConfig(raw = true) {
  const cfg = parseConfig(raw, SCENE_DEFAULTS, 'scene-mode');
  if (!cfg) return null;
  for (const name of ['maxExchanges', 'maxPhaticExchanges']) {
    if (!Number.isInteger(cfg[name]) || cfg[name] < 1) {
      throw new Error(`scene-mode config: ${name} must be an integer >= 1`);
    }
  }
  return {
    ...cfg,
    tempo: normalizeSceneTempoConfig(cfg.tempo),
    closeOnDDecrease: Boolean(cfg.closeOnDDecrease),
    closeOnConfusion: Boolean(cfg.closeOnConfusion),
    recognitionNeed: normalizeRecognitionNeedPolicy(cfg.recognitionNeed),
  };
}

export function normalizeRecognitionNeedPolicy(raw = true) {
  if (raw === false || raw === 'off') return false;
  if (raw === true || raw == null || raw === 'on') return true;
  if (raw === 'direct' || raw === 'v1') return true;
  if (raw === 'gated' || raw === 'gated-v2' || raw === 'v2') return 'gated-v2';
  throw new Error(
    `scene-mode config: recognitionNeed must be true, false, "off", "direct", or "gated-v2" (got ${JSON.stringify(
      raw,
    )})`,
  );
}

export function normalizeSceneTempoConfig(raw = null) {
  if (raw == null || raw === false || raw === 'off') return null;
  let cfg = raw;
  if (cfg === true || cfg === 'on') cfg = {};
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch (err) {
      throw new Error(`scene-mode tempo config is not valid JSON: ${err.message}`);
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('scene-mode tempo config must be a JSON object, true, or "off"');
  }
  const allowed = new Set(Object.keys(SCENE_TEMPO_DEFAULTS));
  for (const key of Object.keys(cfg)) {
    if (!allowed.has(key)) {
      throw new Error(`scene-mode tempo config: unknown key "${key}" (known: ${[...allowed].join(', ')})`);
    }
  }
  const out = { ...SCENE_TEMPO_DEFAULTS, ...cfg };
  if (!['deterministic', 'sample'].includes(out.mode)) {
    throw new Error('scene-mode tempo config: mode must be "deterministic" or "sample"');
  }
  if (!Number.isFinite(Number(out.seed))) {
    throw new Error('scene-mode tempo config: seed must be numeric');
  }
  if (!Number.isFinite(Number(out.temperature)) || Number(out.temperature) <= 0) {
    throw new Error('scene-mode tempo config: temperature must be a positive number');
  }
  const weights = { ...SCENE_TEMPO_DEFAULTS.weights, ...(out.weights || {}) };
  if (!out.weights || typeof out.weights !== 'object' || Array.isArray(out.weights)) {
    if (out.weights != null) throw new Error('scene-mode tempo config: weights must be an object');
  }
  for (const key of Object.keys(weights)) {
    if (!SCENE_TEMPO_BEATS.includes(key)) {
      throw new Error(`scene-mode tempo config: unknown beat "${key}"`);
    }
    const n = Number(weights[key]);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`scene-mode tempo config: weight for "${key}" must be a non-negative number`);
    }
    weights[key] = n;
  }
  if (!SCENE_TEMPO_BEATS.some((beat) => weights[beat] > 0)) {
    throw new Error('scene-mode tempo config: at least one beat weight must be > 0');
  }
  return {
    mode: out.mode,
    seed: Number(out.seed),
    temperature: Number(out.temperature),
    weights,
  };
}

export function normalizeRhetoricalPolicyConfig(raw = true) {
  const cfg = parseConfig(raw, POLICY_DEFAULTS, 'rhetorical-policy');
  if (!cfg) return null;
  if (!['deterministic', 'sample'].includes(cfg.mode)) {
    throw new Error(`rhetorical-policy config: mode must be "deterministic" or "sample"`);
  }
  if (!Number.isFinite(Number(cfg.seed))) {
    throw new Error('rhetorical-policy config: seed must be numeric');
  }
  if (!Number.isFinite(Number(cfg.temperature)) || Number(cfg.temperature) <= 0) {
    throw new Error('rhetorical-policy config: temperature must be a positive number');
  }
  return { ...cfg, seed: Number(cfg.seed), temperature: Number(cfg.temperature) };
}

function norm(text) {
  return String(text || '').toLowerCase();
}

function countWords(text) {
  return String(text || '').split(/\s+/u).filter(Boolean).length;
}

function cognitiveTempoRow(mode, rationale) {
  return {
    mode,
    label: mode.replace(/_/g, ' '),
    deliberative: mode === 'deliberative',
    rationale,
  };
}

export function classifyCognitiveTempo({
  dialogue = '',
  exchangeType = null,
  formalActions = 0,
  hypothesis = null,
  asserts = null,
  dDelta = 0,
  boardDelta = 0,
} = {}) {
  const text = norm(dialogue);
  const words = countWords(text);
  const hasInferenceLanguage =
    /\b(because|since|so|therefore|then|if|which means|that means|implies|follows|settles|shows|proves|i think|i suppose|maybe)\b/u.test(
      text,
    );
  const anchoredUptake =
    /\b(that helps|that makes sense|i see (what|why|how)|you mean|you said|your point|your question|that question|the gap|the link|that part|the missing)\b/u.test(
      text,
    );
  if (asserts || hypothesis || formalActions > 0 || dDelta > 0 || boardDelta > 0 || hasInferenceLanguage) {
    return cognitiveTempoRow('deliberative', 'the utterance does inferential or board-changing work');
  }
  if (exchangeType === 'repair_request' || exchangeType === 'confusion') {
    return cognitiveTempoRow('repair_pause', 'the utterance pauses the proof to repair orientation');
  }
  if (exchangeType === 'resistance') {
    return cognitiveTempoRow('deliberative', 'resistance asks the record to be tested');
  }
  if (exchangeType === 'phatic_ack') {
    if (anchoredUptake) {
      return cognitiveTempoRow('situated_uptake', 'the phatic turn anchors itself to another party or a named gap');
    }
    return cognitiveTempoRow('fast_reflex', 'short phatic punctuation without situated uptake');
  }
  if (words <= 6 && /\b(yes|yeah|right|okay|ok|i guess|i see|got it|hm|mm)\b/u.test(text)) {
    return cognitiveTempoRow('fast_reflex', 'brief continuity marker');
  }
  return cognitiveTempoRow('deliberative', 'ordinary substantive dialogue');
}

function uniqueSignalRows(signals) {
  const seen = new Set();
  const out = [];
  for (const signal of signals) {
    const key = `${signal.role}:${signal.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(signal);
  }
  return out;
}

export function detectPhaticRecognition(
  dialogue = '',
  { role = 'learner', exchangeType = null, tempo = null, cognitiveTempo = null } = {},
) {
  const text = norm(dialogue);
  if (!text) return [];
  const roleName = role === 'tutor' ? 'tutor' : 'learner';
  const tempoBeat = typeof tempo === 'string' ? tempo : tempo?.beat || null;
  const cognitive = cognitiveTempo?.mode || classifyCognitiveTempo({ dialogue, exchangeType }).mode;
  const phaticFrame =
    ['phatic_ack', 'repair_request', 'confusion'].includes(exchangeType) ||
    ['uptake_only', 'repair_request', 'recap', 'hesitation'].includes(tempoBeat) ||
    /\b(yes|yeah|right|okay|ok|i see|got it|understood|wait|sorry|lost|clear)\b/u.test(text);
  const signals = [];
  const add = (type, polarity) => signals.push({ role: roleName, type, polarity });

  if (roleName === 'learner') {
    if (/\b(that helps|that makes sense|i see (what|why|how)|you mean|you said|your point|your question|that question)\b/u.test(text)) {
      add('acknowledges_tutor_guidance', 'affirming');
    }
    if (/\b(wait|sorry|lost|confus|unclear|can we|could you|say that again|go back|you lost me)\b/u.test(text)) {
      add('requests_tutor_repair', 'repair');
    }
    if (/\b(you said|you mean|your point|your question|that question|that helps)\b/u.test(text)) {
      add('marks_tutor_line', 'responsive');
    }
    if (/\b(not ready|don't have|do not have|missing|gap|i need)\b/u.test(text)) {
      add('offers_own_state_for_tutor', 'state');
    }
  } else {
    if (/\b(exactly|that's right|that is right|yes,? (that|your|you)|right,? (that|your|you))\b/u.test(text)) {
      add('affirms_learner_uptake', 'affirming');
    }
    if (/\b(you said|your line|your last line|you named|you asked|you found|you saw|you have)\b/u.test(text)) {
      add('uses_learner_language', 'responsive');
    }
    if (/\b(wait|take a breath|lost|slipped|gap|not ready|missing|pause)\b/u.test(text)) {
      add('recognizes_learner_state', 'state');
    }
  }

  if (!phaticFrame) return [];
  if (cognitive === 'fast_reflex' && !signals.some((signal) => signal.polarity !== 'affirming')) {
    return [];
  }
  return uniqueSignalRows(signals);
}

export function classifyLearnerExchange({
  dialogue = '',
  adopt = [],
  retract = [],
  deriveOutcomes = [],
  hypothesis = null,
  asserts = null,
  dBefore = null,
  dAfter = null,
  groundedBefore = null,
  groundedAfter = null,
} = {}) {
  const text = norm(dialogue);
  const formalActions =
    (adopt || []).length +
    (retract || []).length +
    (deriveOutcomes || []).filter((o) => o.status === 'voiced').length +
    (asserts ? 1 : 0);
  const dDelta = typeof dBefore === 'number' && typeof dAfter === 'number' ? dBefore - dAfter : 0;
  const boardDelta =
    typeof groundedBefore === 'number' && typeof groundedAfter === 'number' ? groundedAfter - groundedBefore : 0;
  let type = 'substantive';
  if (asserts) type = 'assertion';
  else if (hypothesis) type = 'hypothesis';
  else if (/\b(no|sorry|lost|confus|don't get|do not get|wait|unclear|what do you mean)\b/u.test(text)) {
    type = /\b(again|back|remind|lost|forgot|slipped|where did)\b/u.test(text) ? 'repair_request' : 'confusion';
  } else if (/\b(but|surely|rather|instead|can't be|cannot be|doesn't follow|does not follow)\b/u.test(text)) {
    type = 'resistance';
  } else if (!formalActions && countWords(text) <= 8 && /\b(yes|i see|got it|okay|ok|right|mm|hm|understood)\b/u.test(text)) {
    type = 'phatic_ack';
  } else if (!formalActions && !dDelta && !boardDelta && countWords(text) <= 12) {
    type = 'phatic_ack';
  }
  if (!EXCHANGE_TYPES.has(type)) type = 'substantive';
  const cognitiveTempo = classifyCognitiveTempo({
    dialogue,
    exchangeType: type,
    formalActions,
    hypothesis,
    asserts,
    dDelta,
    boardDelta,
  });
  return {
    type,
    cognitiveTempo,
    formalActions,
    dDelta,
    boardDelta,
    countsForProgress: formalActions > 0 || dDelta > 0 || boardDelta > 0 || type === 'hypothesis' || type === 'assertion',
    phatic: type === 'phatic_ack',
  };
}

export function openScene({ index, turn, dNow, targetPremise = null, targetFact = null, goal = null, reason = 'opening' }) {
  return {
    schema: SCENE_SCHEMA,
    index,
    startTurn: turn,
    endTurn: null,
    openedBy: reason,
    goal: goal || 'Orient the next local proof obligation without forcing the answer.',
    targetPremise,
    targetFact,
    dStart: dNow,
    dEnd: null,
    status: null,
    closeReason: null,
    exchanges: [],
    counts: {
      phatic: 0,
      substantive: 0,
      confusion: 0,
      repairRequest: 0,
      assertion: 0,
      fastReflex: 0,
      situatedUptake: 0,
    },
  };
}

export function estimateRecognitionNeed(scene, context = {}) {
  if (!scene) return null;
  const exchanges = scene.exchanges || [];
  const sources = [];
  const desiredActs = new Set();
  let debt = 0;
  const addNeed = (amount, source, acts = []) => {
    debt += amount;
    if (!sources.includes(source)) sources.push(source);
    for (const act of acts) desiredActs.add(act);
  };
  const last = exchanges[exchanges.length - 1] || null;
  if (last?.type === 'repair_request' || last?.type === 'confusion') {
    addNeed(0.45, 'unacknowledged_confusion', ['acknowledge_learner_state', 'repair_thread']);
  }
  if (last?.type === 'resistance') {
    addNeed(0.35, 'unacknowledged_resistance', ['acknowledge_resistance', 'return_learner_words']);
  }
  if (last?.cognitiveTempo?.mode === 'fast_reflex') {
    addNeed(0.3, 'fast_reflex_punctuation', ['invite_situated_uptake', 'slow_the_exchange']);
  }
  const lastRecognizedAt = exchanges.reduce(
    (found, exchange, idx) => (exchange.phaticRecognition?.length ? idx : found),
    -1,
  );
  const exchangesSinceRecognition = lastRecognizedAt < 0 ? exchanges.length : exchanges.length - lastRecognizedAt - 1;
  if (exchanges.length >= 2 && exchangesSinceRecognition >= 2) {
    addNeed(Math.min(0.28, exchangesSinceRecognition * 0.09), 'recognition_gap', [
      'acknowledge_prior_line',
      'invite_acknowledgement',
    ]);
  }
  if (scene.counts.phatic >= 2 && scene.counts.situatedUptake === 0) {
    addNeed(0.22, 'phatic_without_situated_uptake', ['invite_situated_uptake']);
  }
  if (context.forced) {
    addNeed(0.18, 'answer_needs_ownership', ['preserve_learner_agency']);
  }
  debt = Math.min(1, +debt.toFixed(2));
  return {
    schema: RECOGNITION_NEED_SCHEMA,
    debt,
    level: debt >= 0.6 ? 'high' : debt >= 0.3 ? 'medium' : 'low',
    sources,
    desiredActs: [...desiredActs],
    exchangesSinceRecognition,
  };
}

function recognitionPolicyName(policy) {
  return policy === 'gated-v2' ? 'gated-v2' : 'direct';
}

export function applyRecognitionNeedPolicy(need, scene, context = {}) {
  if (!need) return null;
  const policy = recognitionPolicyName(context.policy);
  if (policy === 'direct') {
    return {
      ...need,
      policy,
      active: need.debt >= 0.3,
      gateReasons: need.debt >= 0.3 ? ['direct_debt'] : [],
    };
  }

  const exchanges = scene?.exchanges || [];
  const lastRecognizedAt = exchanges.reduce(
    (found, exchange, idx) => (exchange.phaticRecognition?.length ? idx : found),
    -1,
  );
  const unresolved = exchanges.slice(lastRecognizedAt + 1);
  const breakdownCount = unresolved.filter((exchange) =>
    ['confusion', 'repair_request', 'resistance'].includes(exchange.type),
  ).length;
  const fastReflexCount = unresolved.filter((exchange) => exchange.cognitiveTempo?.mode === 'fast_reflex').length;
  const reasons = [];
  if (breakdownCount >= 2) reasons.push('repeated_unacknowledged_breakdown');
  if (fastReflexCount >= 2 && (scene?.counts?.situatedUptake || 0) === 0) reasons.push('repeated_fast_reflex');
  if (context.forced && (scene?.counts?.assertion || 0) === 0) reasons.push('forced_answer_not_yet_asserted');
  const active = need.debt >= 0.3 && reasons.length > 0;
  return {
    ...need,
    policy,
    active,
    gateReasons: reasons,
    ...(active ? {} : { suppressed: 'recognition pressure logged but not policy-active under gated-v2' }),
  };
}

export function sceneView(scene, tempo = null, recognitionNeed = null) {
  if (!scene) return null;
  return {
    schema: scene.schema,
    index: scene.index,
    startTurn: scene.startTurn,
    goal: scene.goal,
    targetPremise: scene.targetPremise,
    targetFact: scene.targetFact,
    exchangesSoFar: scene.exchanges.length,
    phaticSoFar: scene.counts.phatic,
    ...(tempo ? { tempo } : {}),
    ...(recognitionNeed ? { recognitionNeed } : {}),
  };
}

export function sceneMeta(scene, tempo = null, recognitionNeed = null) {
  const view = sceneView(scene, tempo, recognitionNeed);
  if (!view) return null;
  return {
    index: view.index,
    startTurn: view.startTurn,
    goal: view.goal,
    targetPremise: view.targetPremise,
    ...(view.tempo ? { tempo: view.tempo } : {}),
    ...(view.recognitionNeed ? { recognitionNeed: view.recognitionNeed } : {}),
  };
}

export function updateScene(scene, exchange, { turn, dNow, forced = false, endedBy = null, config = SCENE_DEFAULTS } = {}) {
  if (!scene) return { scene: null, closed: null };
  const row = {
    turn,
    ordinal: scene.exchanges.length + 1,
    type: exchange.type,
    ...(exchange.cognitiveTempo ? { cognitiveTempo: { ...exchange.cognitiveTempo } } : {}),
    ...(exchange.tempo ? { tempo: exchange.tempo } : {}),
    ...(exchange.phaticRecognition?.length
      ? { phaticRecognition: exchange.phaticRecognition.map((signal) => ({ ...signal })) }
      : {}),
    formalActions: exchange.formalActions,
    dDelta: exchange.dDelta,
    boardDelta: exchange.boardDelta,
    countsForProgress: exchange.countsForProgress,
  };
  scene.exchanges.push(row);
  if (exchange.phatic) scene.counts.phatic += 1;
  if (exchange.type === 'substantive' || exchange.countsForProgress) scene.counts.substantive += 1;
  if (exchange.type === 'confusion') scene.counts.confusion += 1;
  if (exchange.type === 'repair_request') scene.counts.repairRequest += 1;
  if (exchange.type === 'assertion') scene.counts.assertion += 1;
  if (exchange.cognitiveTempo?.mode === 'fast_reflex') scene.counts.fastReflex = (scene.counts.fastReflex || 0) + 1;
  if (exchange.cognitiveTempo?.mode === 'situated_uptake')
    scene.counts.situatedUptake = (scene.counts.situatedUptake || 0) + 1;

  let status = null;
  let closeReason = null;
  if (endedBy) {
    status = endedBy === 'grounded_anagnorisis' ? 'progressed' : 'failed';
    closeReason = `run ended: ${endedBy}`;
  } else if (forced) {
    status = 'progressed';
    closeReason = 'recognition forced';
  } else if (config.closeOnDDecrease && exchange.dDelta > 0) {
    status = 'progressed';
    closeReason = 'D decreased';
  } else if (config.closeOnConfusion && (exchange.type === 'confusion' || exchange.type === 'repair_request')) {
    status = exchange.type === 'repair_request' ? 'needs_repair' : 'clarified';
    closeReason = exchange.type;
  } else if (scene.counts.phatic >= config.maxPhaticExchanges) {
    status = 'drift_guard';
    closeReason = `phatic budget ${config.maxPhaticExchanges} reached`;
  } else if (scene.exchanges.length >= config.maxExchanges) {
    status = 'budget';
    closeReason = `exchange budget ${config.maxExchanges} reached`;
  }

  if (!status) return { scene, closed: null };
  scene.endTurn = turn;
  scene.dEnd = dNow;
  scene.status = status;
  scene.closeReason = closeReason;
  return { scene: null, closed: { ...scene, exchanges: scene.exchanges.map((e) => ({ ...e })) } };
}

function addTempo(scores, beat, score, rationale) {
  const current = scores.get(beat) || { beat, score: 0, rationales: [] };
  current.score += score;
  if (rationale) current.rationales.push(rationale);
  scores.set(beat, current);
}

function sceneTempoRow(entry) {
  const info = TEMPO_BEAT_INFO[entry.beat] || { label: entry.beat, instruction: '' };
  return {
    beat: entry.beat,
    label: info.label,
    instruction: info.instruction,
    score: entry.score,
    rationale: entry.rationales.slice(0, 2).join('; '),
  };
}

export function recommendSceneTempoBeat(world, scene, context = {}, config = null) {
  const cfg = normalizeSceneTempoConfig(config);
  if (!cfg || !scene) return null;
  const exchangeOrdinal = scene.exchanges.length + 1;
  const scores = new Map();
  for (const beat of SCENE_TEMPO_BEATS) {
    addTempo(scores, beat, cfg.weights[beat] || 0, 'base tempo weight');
  }

  const releaseDue = Boolean(context.releaseDue || context.releasedThisTurnCount > 0);
  const forced = Boolean(context.forced || context.dNow === 0);
  const recognitionNeed = context.recognitionNeed || estimateRecognitionNeed(scene, { forced });
  const hasProgress = scene.exchanges.some((exchange) => exchange.countsForProgress || exchange.dDelta > 0);
  const highPhatic = scene.counts.phatic >= Math.max(1, (context.maxPhaticExchanges || 2) - 1);

  if (forced) {
    addTempo(scores, 'recognition', 3, 'the current board already forces the answer');
    addTempo(scores, 'recap', 0.4, 'recognition should be grounded in the public path');
  } else if (releaseDue) {
    addTempo(scores, 'evidence', 2.5, 'scheduled evidence is entering this exchange');
    addTempo(scores, 'uptake_only', 0.4, 'fresh evidence may need simple uptake');
  } else if (exchangeOrdinal === 1) {
    addTempo(scores, 'hesitation', 0.45, 'scene opening can locate the social posture');
    addTempo(scores, 'uptake_only', 0.35, 'first exchange need not move the board');
  } else {
    addTempo(scores, 'recap', hasProgress ? 0.8 : 0.45, 'later exchanges can preserve continuity');
    addTempo(scores, 'uptake_only', hasProgress ? 0.7 : 0.35, 'proof progress need not happen every exchange');
    addTempo(scores, 'hesitation', 0.25, 'a natural pause can keep the scene human');
  }
  if (highPhatic) {
    addTempo(scores, 'hypothesis', 0.5, 'near the drift guard, ask for a small substantive move');
    addTempo(scores, 'recap', 0.3, 'near the drift guard, consolidate what stands');
  }
  if (!forced && !releaseDue && recognitionNeed?.debt >= 0.3 && recognitionNeed.active !== false) {
    addTempo(scores, 'recap', recognitionNeed.debt * 1.1, 'recognition debt asks the scene to return what has been heard');
    addTempo(scores, 'hesitation', recognitionNeed.debt * 0.75, 'recognition debt can slow reflexive assent into owned uptake');
    addTempo(scores, 'repair_request', recognitionNeed.debt * 0.6, 'recognition debt may need repair before proof pressure');
    if (recognitionNeed.desiredActs?.includes('invite_situated_uptake')) {
      addTempo(scores, 'uptake_only', recognitionNeed.debt * 0.35, 'invite a situated uptake rather than a new proof step');
    }
  }
  if (!releaseDue && scores.has('evidence')) scores.get('evidence').score = 0;
  if (!forced && scores.has('recognition')) scores.get('recognition').score = 0;

  const distribution = normalizeDistribution(
    [...scores.values()].filter((row) => row.score > 0).map(sceneTempoRow),
    cfg.temperature,
  );
  const selected =
    forced || releaseDue
      ? distribution.find((row) => row.beat === (forced ? 'recognition' : 'evidence')) || distribution[0]
      : choose(distribution, {
          ...cfg,
          turn: `${context.turn || 0}:${scene.index}:${exchangeOrdinal}`,
          worldId: world.id,
        });
  return {
    schema: SCENE_TEMPO_SCHEMA,
    mode: cfg.mode,
    seed: cfg.seed,
    temperature: cfg.temperature,
    turn: context.turn || null,
    scene: scene.index,
    exchange: exchangeOrdinal,
    beat: selected.beat,
    label: selected.label,
    instruction: selected.instruction,
    rationale: selected.rationale || 'selected from configured scene tempo distribution',
    distribution,
  };
}

function hashUnit(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function normalizeDistribution(rows, temperature = 1) {
  const weighted = rows.map((row) => ({
    ...row,
    score: Math.max(0.001, Number(row.score) || 0.001),
  }));
  const adjusted = weighted.map((row) => ({ ...row, weight: Math.pow(row.score, 1 / temperature) }));
  const total = adjusted.reduce((sum, row) => sum + row.weight, 0) || 1;
  return adjusted
    .map(({ score, ...row }) => ({ ...row, weight: +(row.weight / total).toFixed(3) }))
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        String(a.figure || a.beat || '').localeCompare(String(b.figure || b.beat || '')),
    );
}

function choose(distribution, { mode, seed, turn, worldId }) {
  if (mode !== 'sample') return distribution[0];
  const r = hashUnit(`${seed}:${worldId}:${turn}`);
  let acc = 0;
  for (const row of distribution) {
    acc += row.weight;
    if (r <= acc) return row;
  }
  return distribution[distribution.length - 1];
}

function lastLearnerLine(transcript = []) {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i].role === 'learner') return transcript[i];
  }
  return null;
}

function add(scores, key, score, rationale) {
  const current = scores.get(key) || { key, score: 0, rationales: [] };
  current.score += score;
  if (rationale) current.rationales.push(rationale);
  scores.set(key, current);
}

function keyOf(figure, intent, targetPremise, stance) {
  return JSON.stringify({ figure, intent, targetPremise: targetPremise || null, stance });
}

function rowFromKey(entry) {
  return { ...JSON.parse(entry.key), score: entry.score, rationale: entry.rationales.slice(0, 2).join('; ') };
}

function discursiveSummary(calibration) {
  if (!calibration || typeof calibration !== 'object') return null;
  if (calibration.publicOnly !== true || calibration.mayOverrideProofControl !== false) return null;
  return {
    publicPosture: calibration.publicPosture || null,
    uptakeQuality: calibration.uptakeQuality || null,
    pressure: calibration.advisory?.pressure || null,
    tempoBias: Array.isArray(calibration.advisory?.tempoBias) ? [...calibration.advisory.tempoBias] : [],
  };
}

function addDiscursiveCalibration(scores, calibration) {
  const summary = discursiveSummary(calibration);
  if (!summary) return null;
  const biases = Array.isArray(calibration.advisory?.rhetoricalBias) ? calibration.advisory.rhetoricalBias : [];
  const proofIntent =
    {
      release_next_evidence: 'release',
      repair_dependency: 'restore',
      invite_final_assertion: 'stage_recognition',
      consolidate_subproof: 'consolidate',
    }[calibration.proofStep?.moveFamily] || null;
  const proofTarget = calibration.proofStep?.targetPremise || null;
  for (const bias of biases) {
    if (!bias || typeof bias !== 'object') continue;
    const figure = bias.figure || 'erotema';
    const intent = proofIntent || bias.intent || 'test';
    const stance = bias.stance || summary.publicPosture || 'discursive_calibration';
    const targetPremise = proofTarget || bias.targetPremise || null;
    const weight = Number.isFinite(Number(bias.weight)) ? Number(bias.weight) : 0.12;
    add(
      scores,
      keyOf(figure, intent, targetPremise, stance),
      weight,
      `discursive calibration: ${summary.publicPosture}${proofIntent ? '; proof intent preserved' : ''}`,
    );
  }
  return summary;
}

export function recommendRhetoricalMove(world, view, context = {}, config = true) {
  const cfg = normalizeRhetoricalPolicyConfig(config);
  if (!cfg) return null;
  const scores = new Map();
  const targetFromContext = context.topProofDebt?.premiseId || context.cuePremise || context.lastReleasePremise || null;
  const lastLearner = lastLearnerLine(view.transcript);
  const exchangeType = lastLearner?.meta?.exchange?.type || null;
  const recognitionNeed = context.recognitionNeed || view.scene?.recognitionNeed || null;
  const calibrationSummary = addDiscursiveCalibration(scores, context.discursiveCalibration || view.discursiveCalibration || null);
  const lastPoint = view.trajectory?.[view.trajectory.length - 1] || null;
  const prevPoint = view.trajectory && view.trajectory.length > 1 ? view.trajectory[view.trajectory.length - 2] : null;
  const plateau = Boolean(lastPoint && prevPoint && lastPoint.D === prevPoint.D);
  const frontier = view.inference?.frontier || [];
  const stalledFrontier = frontier.find((item) => item.age >= 2 && !item.targetedByLast2);

  add(scores, keyOf('erotema', 'test', targetFromContext, 'ask'), 0.18, 'default guided-discovery pressure');
  add(scores, keyOf('analogia', 'consolidate', targetFromContext, 'transfer'), 0.12, 'make the local shape portable');

  if (context.topProofDebt) {
    add(scores, keyOf('anaphora', 'restore', context.topProofDebt.premiseId, 'proof_debt_repair'), 0.55, 'repair a staged proof debt before new work');
    add(scores, keyOf('erotema', 'restore', context.topProofDebt.premiseId, 'read_back'), 0.18, 'ask for the missing exhibit before restaging');
  }
  if (context.forced) {
    add(scores, keyOf('aposiopesis', 'stage_recognition', targetFromContext, 'near_recognition'), 0.52, 'the board forces the answer; let the learner finish it');
    add(scores, keyOf('erotema', 'stage_recognition', targetFromContext, 'last_question'), 0.22, 'one final question can stage recognition');
  }
  if (context.releaseCue || context.playableCount > 0) {
    add(scores, keyOf('exemplum', 'release', context.cuePremise, 'concrete_exhibit'), 0.42, 'fresh evidence wants concrete seating');
    add(scores, keyOf('analogia', 'release', context.cuePremise, 'bridge_exhibit'), 0.2, 'bridge the new exhibit to prior ground');
  }
  if (exchangeType === 'phatic_ack') {
    add(scores, keyOf('erotema', 'test', targetFromContext, 'uptake_check'), 0.35, 'phatic uptake needs a small check, not a lecture');
    add(scores, keyOf('anaphora', 'consolidate', targetFromContext, 'recap'), 0.18, 'repeat the live chain briefly');
  }
  if (exchangeType === 'confusion' || exchangeType === 'repair_request') {
    add(scores, keyOf('anaphora', exchangeType === 'repair_request' ? 'restore' : 'consolidate', targetFromContext, 'phatic_repair'), 0.42, 'confusion asks for continuity repair');
    add(scores, keyOf('analogia', 'orient', targetFromContext, 'lower_load'), 0.18, 'a smaller parallel can lower load');
  }
  if (exchangeType === 'resistance') {
    add(scores, keyOf('erotema', 'counter_mirror', targetFromContext, 'contrast'), 0.34, 'resistance should be tested against the record');
    add(scores, keyOf('exemplum', 'counter_mirror', targetFromContext, 'counterexample'), 0.24, 'a concrete counter-case can separate routes');
  }
  if (stalledFrontier) {
    const target = stalledFrontier.groundPremiseIds?.[0] || targetFromContext;
    add(scores, keyOf('erotema', 'consolidate', target, 'stalled_join'), 0.36, 'ask the learner to put waiting grounds together');
    add(scores, keyOf('anaphora', 'consolidate', target, 'walk_conjuncts'), 0.26, 'repeat the conjuncts without supplying the conclusion');
  }
  if (plateau && !context.forced) {
    add(scores, keyOf('exemplum', 'orient', targetFromContext, 'unstick'), 0.2, 'the D curve is flat; make one obligation concrete');
  }
  if (recognitionNeed?.debt >= 0.3 && recognitionNeed.active !== false && !context.releaseCue) {
    add(
      scores,
      keyOf('anaphora', 'consolidate', targetFromContext, 'recognitive_recap'),
      recognitionNeed.debt * 0.45,
      'recognition debt asks the tutor to return what the learner has already offered',
    );
    add(
      scores,
      keyOf('erotema', 'test', targetFromContext, 'situated_uptake_check'),
      recognitionNeed.debt * 0.32,
      'recognition debt asks for owned uptake before new proof pressure',
    );
    if (recognitionNeed.desiredActs?.includes('repair_thread')) {
      add(
        scores,
        keyOf('anaphora', 'restore', targetFromContext, 'recognitive_repair'),
        recognitionNeed.debt * 0.42,
        'the learner signaled rupture; repair the relation before advancing',
      );
    }
  }

  const distribution = normalizeDistribution([...scores.values()].map(rowFromKey), cfg.temperature);
  const selected = choose(distribution, { ...cfg, turn: view.turn, worldId: world.id });
  return {
    schema: RHETORICAL_POLICY_SCHEMA,
    mode: cfg.mode,
    seed: cfg.seed,
    temperature: cfg.temperature,
    turn: view.turn,
    selected,
    distribution,
    ...(calibrationSummary ? { discursiveCalibration: calibrationSummary } : {}),
  };
}

export function renderRhetoricalPolicy(policy) {
  if (!policy) return [];
  return [
    '',
    'RHETORICAL MOVE POLICY (advisory, no new evidence):',
    `- selected ${policy.selected.figure} / ${policy.selected.intent} / ${policy.selected.stance}${
      policy.selected.targetPremise ? ` targeting ${policy.selected.targetPremise}` : ''
    }`,
    `- rationale: ${policy.selected.rationale || 'highest-weight visible fit'}`,
    ...(policy.discursiveCalibration
      ? [
          `- discursive calibration: ${policy.discursiveCalibration.publicPosture} / ${policy.discursiveCalibration.uptakeQuality}; pressure ${policy.discursiveCalibration.pressure}`,
        ]
      : []),
    `- distribution: ${policy.distribution
      .slice(0, 4)
      .map((row) => `${row.figure}:${row.intent}:${row.weight}`)
      .join(', ')}`,
    policy.mode === 'sample'
      ? '- this run is sampling from the distribution with a fixed seed; record the sampled choice, do not hide it'
      : '- this run uses the highest-weight choice deterministically',
    'Use it as a disciplined hunch. You may override it when the record demands, but your move metadata should make the reason visible.',
  ];
}
