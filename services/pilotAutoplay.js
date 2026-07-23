/**
 * Pilot Autoplay — drive a synthetic (llm-learner) pilot session through the
 * SAME tutor loop a human participant drives.
 *
 * This is the synthetic twin of the human /pilot path. It reuses, unchanged:
 *   - the tutor engine        → runTutorTurn() through legacyChatEngine.js
 *   - per-turn persistence     → pilotStore.appendTurn() (same config_hash +
 *                                cumulative dialogue_content_hash discipline)
 * and swaps the human's typed message for the learner ego/superego engine
 *   - the learner engine       → interactionEngine.generateLearnerResponse()
 *
 * The result is a format-identical pilot_turns transcript that sits beside human
 * sessions in the same DB — the tutor-learner symmetry principle applied to
 * provenance: one instrument, a swappable learner source. The synthetic side
 * additionally captures the learner's internal ego/superego deliberation, which
 * a human session has no analogue for.
 *
 * SPEND SAFETY. Every turn-pair is two paid LLM calls (one learner, one tutor).
 * The loop is bounded by BOTH a turn-pair count (primary) and a conservative USD
 * cost backstop (secondary), is admin-gated at the route layer, and defaults to
 * a MOCK dep set that makes zero network calls. Real spend is an explicit
 * opt-in. Cumulative tokens + estimated cost are surfaced in the return value.
 */

import * as pilotStore from './pilotStore.js';
import * as evalConfigLoader from './evalConfigLoader.js';
import interactionEngine from './learnerTutorInteractionEngine.js';
import { runTutorTurn, loadCurriculumContext, loadPromptFile } from './legacyChatEngine.js';

export const DEFAULT_MAX_TURN_PAIRS = 4;
export const DEFAULT_COST_CAP_USD = 1.0;
export const MAX_TURN_PAIRS_CEILING = 12;

// Conservative blended price used ONLY for the secondary cost backstop. It
// deliberately over-estimates (most pilot-cell models are far cheaper) so the
// cap trips early rather than late — a safety bias, not an accounting figure.
const CONSERVATIVE_USD_PER_1K_TOKENS = 0.01;

const CHAT_MIN_MAX_TOKENS = 4000;

function estimateCostUsdDefault({ inputTokens = 0, outputTokens = 0 }) {
  return ((inputTokens + outputTokens) / 1000) * CONSERVATIVE_USD_PER_1K_TOKENS;
}

// OpenRouter learner call adapter, matching the substrate the human pilot tutor
// path is locked to (OpenRouter only — no Claude-CLI substrate for autoplay, so
// spend stays on one metered provider). Mirrors the /api/chat/learner-turn
// adapter so the synthetic learner is generated identically to the chat UI's.
async function openRouterLearnerCall(apiKey, modelRef, systemPrompt, messages, options = {}) {
  let modelId = modelRef;
  if (!modelRef) {
    modelId = 'nvidia/nemotron-3-nano-30b-a3b';
  } else if (!modelRef.includes('/') && modelRef.includes('.')) {
    modelId = evalConfigLoader.resolveModel(modelRef).model;
  }
  const start = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:8081/pilot',
      'X-Title': 'Machine Spirits Pilot (autoplay learner)',
    },
    body: JSON.stringify({
      model: modelId,
      temperature: options.temperature ?? 0.7,
      max_tokens: Math.max(options.maxTokens ?? CHAT_MIN_MAX_TOKENS, CHAT_MIN_MAX_TOKENS),
      messages: [
        { role: 'system', content: systemPrompt },
        ...(messages || []).map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      ],
    }),
  });
  const latencyMs = Date.now() - start;
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }
  const payload = await response.json();
  return {
    content: payload.choices?.[0]?.message?.content || '',
    usage: {
      inputTokens: payload.usage?.prompt_tokens || 0,
      outputTokens: payload.usage?.completion_tokens || 0,
    },
    model: modelId,
    latencyMs,
  };
}

// Default learner generator: the real ego/superego learner. When a cell has
// learner_architecture: ego_superego this yields the learner's own internal
// deliberation, symmetric to the tutor's.
async function generateLearnerDefault({ profile, history, topic, personaId, tutorMessage, apiKey }) {
  const learnerProfileName = profile.learner_architecture || 'unified';
  const trace = {
    metrics: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      learnerInputTokens: 0,
      learnerOutputTokens: 0,
      tutorInputTokens: 0,
      tutorOutputTokens: 0,
    },
  };
  const llmCall = (modelRef, systemPrompt, messages, options = {}) =>
    openRouterLearnerCall(apiKey, modelRef, systemPrompt, messages, options);

  const result = await interactionEngine.generateLearnerResponse({
    tutorMessage: tutorMessage || `Let's begin a conversation about ${topic}. What's on your mind?`,
    topic,
    conversationHistory: history.map((m) => ({ role: m.role, content: m.content })),
    learnerProfile: learnerProfileName,
    personaId,
    llmCall,
    memoryContext: null,
    trace,
  });

  return {
    externalMessage: result.externalMessage || '',
    deliberation: result.internalDeliberation || [],
    suggestsEnding: !!result.suggestsEnding,
    learnerProfile: learnerProfileName,
    usage: {
      inputTokens: trace.metrics.learnerInputTokens || 0,
      outputTokens: trace.metrics.learnerOutputTokens || 0,
    },
  };
}

// ── Mock dep set ──────────────────────────────────────────────────────────
// Deterministic, zero-network learner + tutor. Used by the route's default
// mock mode (wiring validation without spend) and by the test/smoke suite.
// Content varies by turn position so transcripts read realistically and the
// cumulative dialogue_content_hash advances.
const MOCK_LEARNER_LINES = [
  'I think fractions are just like slicing a pizza, right? Three out of eight slices is 3/8.',
  'Wait — so if I eat two more slices, is that 5/8? I added the tops but kept the bottom. Did I do that right?',
  "Okay, but what happens when the pizzas are cut differently? 1/2 plus 1/3 confuses me — the slices aren't the same size.",
  'So I need a common bottom number first. For 1/2 and 1/3 that would be sixths... 3/6 plus 2/6 is 5/6?',
  'That actually makes sense now. Could you give me a trickier one to check I really get it?',
];
const MOCK_TUTOR_LINES = [
  "Pizza is a great anchor. You've got the idea that the bottom number is how many equal slices the whole is cut into. Hold onto that — what does the top number count?",
  'Good instinct, and notice what you did: you added the tops because the slices were the same size. So 3/8 + 2/8 = 5/8 works *because* the eighths match. When would that break?',
  "Exactly the right thing to be bothered by. Halves and thirds aren't the same-sized slices, so we can't just add tops. What could we do to make the slices comparable?",
  "That's the move — a common denominator. You rewrote both as sixths and added: 3/6 + 2/6 = 5/6. Say back to me *why* the bottoms had to match before adding.",
  "Let's test it: try 2/3 + 1/4. Walk me through finding the common slices first, then add — I'll follow your reasoning.",
];

export function buildMockDeps() {
  return {
    generateLearner: async ({ history }) => {
      const pairIndex = Math.floor(history.length / 2);
      const line = MOCK_LEARNER_LINES[pairIndex % MOCK_LEARNER_LINES.length];
      return {
        externalMessage: line,
        deliberation: [
          { role: 'ego_initial', content: `(mock) first reaction to the tutor: ${line.slice(0, 40)}…` },
          { role: 'superego', content: '(mock) am I just guessing, or do I actually follow the reasoning?' },
          { role: 'ego_revision', content: `(mock) final, after self-check: ${line}` },
        ],
        suggestsEnding: false,
        learnerProfile: 'ego_superego',
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    },
    runTutorTurnFn: async ({ history }) => {
      const pairIndex = Math.floor(history.length / 2);
      const line = MOCK_TUTOR_LINES[pairIndex % MOCK_TUTOR_LINES.length];
      return {
        finalMessage: line,
        wasRevised: false,
        deliberation: [{ role: 'ego', label: 'Ego — initial draft', content: line }],
        totals: { inputTokens: 0, outputTokens: 0, latencyMs: 0 },
      };
    },
  };
}

/**
 * Run an llm-learner session end to end: enrolled → tutoring → (N turn-pairs) →
 * tutoring_done. Persists every turn to pilot_turns with full provenance.
 *
 * @param {object} opts
 * @param {string} opts.sessionId          - an existing learner_source='llm' session
 * @param {number} [opts.maxTurnPairs]     - primary bound (clamped to MAX_TURN_PAIRS_CEILING)
 * @param {number} [opts.costCapUsd]       - secondary conservative USD backstop
 * @param {string} [opts.topic]            - tutoring topic (defaults from the cell/lecture)
 * @param {string} [opts.personaId]        - learner persona
 * @param {function} [opts.onEvent]        - progress callback (turn_pair events)
 * @param {object} [deps]                  - injectable engines (default = real; mock for tests)
 */
export async function runAutoplay(
  {
    sessionId,
    maxTurnPairs = DEFAULT_MAX_TURN_PAIRS,
    costCapUsd = DEFAULT_COST_CAP_USD,
    topic = null,
    personaId = 'eager_novice',
    onEvent = null,
  } = {},
  deps = {},
) {
  const {
    store = pilotStore,
    loadProfile = (cellName) => evalConfigLoader.loadTutorAgents()?.profiles?.[cellName],
    runTutorTurnFn = runTutorTurn,
    loadCurriculum = loadCurriculumContext,
    loadPrompt = loadPromptFile,
    generateLearner = generateLearnerDefault,
    estimateCost = estimateCostUsdDefault,
    apiKey = process.env.OPENROUTER_API_KEY,
  } = deps;

  const isMock = generateLearner !== generateLearnerDefault;
  const pairBudget = Math.max(1, Math.min(Number(maxTurnPairs) || DEFAULT_MAX_TURN_PAIRS, MAX_TURN_PAIRS_CEILING));

  const session = store.getSession(sessionId);
  if (!session) {
    const err = new Error(`pilot session ${sessionId} not found`);
    err.code = 'PILOT_SESSION_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (session.learner_source !== 'llm') {
    const err = new Error(`autoplay requires a learner_source='llm' session (got '${session.learner_source}')`);
    err.code = 'PILOT_NOT_LLM_SESSION';
    err.statusCode = 409;
    throw err;
  }

  const cellName = session.condition_cell;
  const profile = loadProfile(cellName);
  if (!profile) {
    const err = new Error(`cell "${cellName}" not found in tutor-agents config`);
    err.code = 'PILOT_CELL_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }
  if (!profile.ego) {
    const err = new Error(`cell "${cellName}" has no ego config`);
    err.code = 'PILOT_CELL_NO_EGO';
    err.statusCode = 400;
    throw err;
  }
  if (!isMock && !apiKey) {
    const err = new Error('OPENROUTER_API_KEY is not set — required for a real (non-mock) autoplay run');
    err.code = 'PILOT_NO_API_KEY';
    err.statusCode = 503;
    throw err;
  }

  const lectureRef = session.scenario_lecture_ref || null;
  const sessionTopic = topic || 'fractions tutoring session';

  // config_hash is stable across the session (profile + prompts + topic +
  // lecture don't change mid-run), so compute it once and share it across every
  // turn — identical to how the human /pilot path hashes a turn pair.
  const curriculum = lectureRef ? loadCurriculum(lectureRef) : null;
  const egoPromptText = loadPrompt(profile.ego.prompt_file);
  const superegoPromptText = profile.superego ? loadPrompt(profile.superego.prompt_file) : '';
  const configHash = store.computeConfigHash({
    cellName,
    egoConfig: profile.ego,
    superegoConfig: profile.superego,
    egoPromptText,
    superegoPromptText,
    topic: sessionTopic,
    lectureText: curriculum?.text || '',
  });

  // Advance enrolled → tutoring (the llm fast-path transition). If already in
  // tutoring (a resumed run), leave it.
  if (session.status === store.PILOT_STATUSES.ENROLLED) {
    store.startTutoring(sessionId);
  } else if (session.status !== store.PILOT_STATUSES.TUTORING) {
    const err = new Error(`session must be 'enrolled' or 'tutoring' to autoplay (got '${session.status}')`);
    err.code = 'PILOT_BAD_AUTOPLAY_STATE';
    err.statusCode = 409;
    throw err;
  }

  const spend = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
  const turns = [];
  let stoppedReason = 'max_turn_pairs';
  let completedPairs = 0;

  for (let pair = 0; pair < pairBudget; pair++) {
    // Authoritative history from the DB (matches the human path replaying turns).
    const history = store.listTurns(sessionId).map((t) => ({ role: t.role, content: t.content }));
    const lastTutor = [...history].reverse().find((h) => h.role === 'tutor');
    const tutorMessage = lastTutor?.content || null;

    // 1. Learner produces its message (+ internal deliberation).
    const learnerOut = await generateLearner({
      profile,
      cellName,
      history,
      topic: sessionTopic,
      personaId,
      tutorMessage,
      apiKey,
    });
    spend.inputTokens += learnerOut.usage?.inputTokens || 0;
    spend.outputTokens += learnerOut.usage?.outputTokens || 0;

    // 2. Tutor responds via the SAME engine the human path uses. history does
    //    NOT include the new learner message; runTutorTurn takes it separately.
    const trace = await runTutorTurnFn({
      profile,
      apiKey,
      history,
      learnerMessage: learnerOut.externalMessage,
      topic: sessionTopic,
      curriculum,
      useClaudeCli: false,
    });
    spend.inputTokens += trace.totals?.inputTokens || 0;
    spend.outputTokens += trace.totals?.outputTokens || 0;
    spend.estimatedCostUsd = estimateCost(spend);

    // 3. Persist the pair: learner first, then tutor (turn_index order matches
    //    the human path). The learner turn carries its deliberation trace — the
    //    one thing a human session has no analogue for.
    const egoEntry = (trace.deliberation || []).find((d) => d.role === 'ego');
    const superegoEntry = (trace.deliberation || []).find((d) => d.role === 'superego');

    const learnerTurn = store.appendTurn(sessionId, {
      role: 'learner',
      content: learnerOut.externalMessage,
      deliberation: learnerOut.deliberation,
      configHash,
      inputTokens: learnerOut.usage?.inputTokens ?? null,
      outputTokens: learnerOut.usage?.outputTokens ?? null,
    });
    const tutorTurn = store.appendTurn(sessionId, {
      role: 'tutor',
      content: trace.finalMessage,
      deliberation: trace.deliberation,
      wasRevised: trace.wasRevised,
      configHash,
      inputTokens: trace.totals?.inputTokens ?? null,
      outputTokens: trace.totals?.outputTokens ?? null,
      latencyMs: trace.totals?.latencyMs ?? null,
      egoModel: egoEntry?.model || null,
      superegoModel: superegoEntry?.model || null,
    });

    turns.push(
      { index: learnerTurn.turnIndex, role: 'learner', content: learnerOut.externalMessage },
      { index: tutorTurn.turnIndex, role: 'tutor', content: trace.finalMessage, wasRevised: !!trace.wasRevised },
    );
    completedPairs++;

    if (typeof onEvent === 'function') {
      onEvent({ type: 'turn_pair', pair, completedPairs, spend: { ...spend } });
    }

    // Stop conditions (checked after persisting so the transcript is intact).
    if (learnerOut.suggestsEnding) {
      stoppedReason = 'learner_ended';
      break;
    }
    if (spend.estimatedCostUsd >= costCapUsd) {
      stoppedReason = 'cost_cap';
      break;
    }
    const refreshed = store.getSession(sessionId);
    if (store.isTutoringExpired(refreshed)) {
      stoppedReason = 'time_cap';
      break;
    }
  }

  store.endTutoring(sessionId, { reason: 'completed' });
  const finalSession = store.getSession(sessionId);

  return {
    sessionId,
    cellName,
    learnerSource: 'llm',
    mock: isMock,
    turnPairs: completedPairs,
    stoppedReason,
    status: finalSession.status,
    spend,
    turns,
  };
}

export default { runAutoplay, buildMockDeps, DEFAULT_MAX_TURN_PAIRS, DEFAULT_COST_CAP_USD, MAX_TURN_PAIRS_CEILING };
