const COMPREHENSION_SCHEMA = 'machinespirits.tutor-stub.comprehension-side-state.v1';
const HISTORY_LIMIT = 24;

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeTerm(value) {
  return oneLine(value)
    .replace(/^["'`“”‘’]+|["'`“”‘’?.!,;:]+$/gu, '')
    .replace(/^(?:a|an|the|word|term)\s+/iu, '')
    .replace(/\s+(?:please|to me)$/iu, '')
    .trim()
    .slice(0, 64);
}

function termKey(value) {
  return normalizeTerm(value).toLowerCase();
}

function classificationRequestType(classification) {
  return String(classification?.turn?.request_type || classification?.request_type || '').trim();
}

function extractedTerms(text) {
  const source = oneLine(text);
  const candidates = [];
  const patterns = [
    /\bwhat\s+does\s+["'`“”‘’]?(.{1,64}?)["'`“”‘’]?\s+mean\b/iu,
    /\bwhat\s+do\s+you\s+mean\s+by\s+["'`“”‘’]?(.{1,64}?)["'`“”‘’]?(?:\?|$)/iu,
    /\b(?:explain|define)\s+(?:the\s+)?(?:word|term\s+)?["'`“”‘’]?([\p{L}\p{N}_'-]+(?:\s+[\p{L}\p{N}_'-]+){0,2})/iu,
    /\bi\s+(?:do\s+not|don't|cannot|can't)\s+understand\s+(?:the\s+)?(?:word|term\s+)?["'`“”‘’]?([\p{L}\p{N}_'-]+(?:\s+[\p{L}\p{N}_'-]+){0,2})/iu,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const term = normalizeTerm(match?.[1]);
    if (term) candidates.push(term);
  }
  return [...new Map(candidates.map((term) => [termKey(term), term])).values()].slice(0, 3);
}

function termLooksDefined(responseText, term) {
  const response = oneLine(responseText).toLowerCase();
  const key = termKey(term);
  if (!response || !key || !response.includes(key)) return false;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(
    `(?:${escaped}\\s+(?:is|means|refers to|was|were)|(?:by|with)\\s+${escaped}\\b|${escaped}[^.!?]{0,80}\\bused\\s+to)`,
    'iu',
  ).test(response);
}

export function createTutorStubComprehensionState(snapshot = null) {
  return {
    schema: COMPREHENSION_SCHEMA,
    advancesLearnerDag: false,
    terms: Array.isArray(snapshot?.terms) ? structuredClone(snapshot.terms) : [],
    lastRequest: snapshot?.lastRequest ? structuredClone(snapshot.lastRequest) : null,
    history: Array.isArray(snapshot?.history) ? structuredClone(snapshot.history).slice(-HISTORY_LIMIT) : [],
  };
}

export function detectTutorStubComprehensionRequest({
  text = '',
  classification = null,
  explicitTerm = '',
  source = 'learner_turn',
  turn = null,
} = {}) {
  const requestType = classificationRequestType(classification);
  const terms = explicitTerm ? [normalizeTerm(explicitTerm)].filter(Boolean) : extractedTerms(text);
  const lexicalSignal =
    terms.length > 0 || /\b(?:what\s+does.+mean|what\s+do\s+you\s+mean\s+by|explain|define)\b/iu.test(text);
  const classifiedSignal = ['plain_language_request', 'plain_simplification_followup'].includes(requestType);
  const detected = source === 'slash_explain' || lexicalSignal || classifiedSignal;
  return {
    schema: 'machinespirits.tutor-stub.comprehension-request.v1',
    advancesLearnerDag: false,
    detected,
    source,
    turn: Number.isFinite(Number(turn)) ? Number(turn) : null,
    text: oneLine(text),
    requestType: requestType || null,
    terms,
    generic: detected && terms.length === 0,
  };
}

export function applyTutorStubComprehensionRequest(state, request) {
  if (!state || !request?.detected) return null;
  const turn = Number.isFinite(Number(request.turn)) ? Number(request.turn) : 0;
  const requestedTerms = [];
  for (const rawTerm of request.terms || []) {
    const term = normalizeTerm(rawTerm);
    const key = termKey(term);
    if (!key) continue;
    let entry = state.terms.find((candidate) => candidate.key === key);
    if (!entry) {
      entry = {
        key,
        term,
        status: 'unresolved',
        firstRequestedTurn: turn,
        lastRequestedTurn: turn,
        lastExplainedTurn: null,
        requestCount: 0,
        sources: [],
      };
      state.terms.push(entry);
    }
    entry.term = term;
    entry.status = entry.lastExplainedTurn === null ? 'unresolved' : 'reopened';
    entry.lastRequestedTurn = turn;
    entry.requestCount += 1;
    if (!entry.sources.includes(request.source)) entry.sources.push(request.source);
    requestedTerms.push(term);
  }
  state.lastRequest = {
    turn,
    source: request.source,
    requestType: request.requestType,
    text: request.text,
    terms: requestedTerms,
    generic: request.generic === true,
  };
  state.history.push({ type: 'request', ...structuredClone(state.lastRequest) });
  state.history = state.history.slice(-HISTORY_LIMIT);
  return tutorStubComprehensionSnapshot(state, { turn });
}

export function applyTutorStubComprehensionResponse(
  state,
  { text = '', turn = null, source = 'tutor_turn', force = false, terms = null } = {},
) {
  if (!state) return { explainedTerms: [], snapshot: null };
  const responseTurn = Number.isFinite(Number(turn)) ? Number(turn) : 0;
  const allowedTerms = Array.isArray(terms) ? new Set(terms.map(termKey).filter(Boolean)) : null;
  const explainedTerms = [];
  for (const entry of state.terms || []) {
    if (!['unresolved', 'reopened'].includes(entry.status)) continue;
    if (allowedTerms && !allowedTerms.has(entry.key)) continue;
    if (entry.lastRequestedTurn > responseTurn) continue;
    if (!force && !termLooksDefined(text, entry.term)) continue;
    entry.status = 'explained';
    entry.lastExplainedTurn = responseTurn;
    explainedTerms.push(entry.term);
  }
  if (explainedTerms.length || force) {
    state.history.push({
      type: 'response',
      turn: responseTurn,
      source,
      terms: explainedTerms,
      text: oneLine(text),
    });
    state.history = state.history.slice(-HISTORY_LIMIT);
  }
  return {
    explainedTerms,
    snapshot: tutorStubComprehensionSnapshot(state, { turn: responseTurn }),
  };
}

export function tutorStubComprehensionFeatures(state, { turn = null } = {}) {
  const currentTurn = Number.isFinite(Number(turn)) ? Number(turn) : 0;
  const unresolvedTerms = (state?.terms || [])
    .filter((entry) => ['unresolved', 'reopened'].includes(entry.status))
    .map((entry) => entry.term);
  const explainedTerms = (state?.terms || [])
    .filter((entry) => entry.status === 'explained')
    .map((entry) => entry.term);
  const age = state?.lastRequest ? Math.max(0, currentTurn - Number(state.lastRequest.turn || 0)) : null;
  const recentRequest = age !== null && age <= 1;
  const pressure = unresolvedTerms.length ? Math.min(1, 0.75 + unresolvedTerms.length * 0.1) : recentRequest ? 0.55 : 0;
  return {
    pressure: Number(pressure.toFixed(3)),
    languageOpacity: Number(pressure.toFixed(3)),
    unresolvedTerms,
    explainedTerms,
    recentRequest,
    requestAge: age,
    lastRequest: state?.lastRequest ? structuredClone(state.lastRequest) : null,
    requiresGloss: pressure > 0,
  };
}

export function tutorStubComprehensionSnapshot(state, { turn = null } = {}) {
  return {
    schema: COMPREHENSION_SCHEMA,
    advancesLearnerDag: false,
    terms: structuredClone(state?.terms || []),
    lastRequest: state?.lastRequest ? structuredClone(state.lastRequest) : null,
    history: structuredClone(state?.history || []).slice(-HISTORY_LIMIT),
    features: tutorStubComprehensionFeatures(state, { turn }),
  };
}

export function tutorStubComprehensionPrompt(state, { turn = null } = {}) {
  const features = tutorStubComprehensionFeatures(state, { turn });
  if (!features.requiresGloss && !features.recentRequest) return '';
  const requested = features.lastRequest?.terms?.length
    ? features.lastRequest.terms.join(', ')
    : 'the wording just queried';
  const unresolved = features.unresolvedTerms.length ? features.unresolvedTerms.join(', ') : 'none';
  return [
    '[Tutor-only comprehension side-state]',
    `Recent clarification target: ${requested}.`,
    `Unresolved terms: ${unresolved}.`,
    `Language-opacity pressure: ${features.languageOpacity}.`,
    'Treat the request as evidence of a vocabulary or wording gap, not resistance or low agency.',
    'Gloss the requested term immediately in ordinary language, preserve the dramatic scene, and then ask at most one concrete check.',
    'Do not advance the proof DAG until the wording gap has been addressed.',
    '[End tutor-only comprehension side-state]',
  ].join('\n');
}
