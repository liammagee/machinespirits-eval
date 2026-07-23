import * as evalConfigLoader from './evalConfigLoader.js';
import { buildChatDirectorPlan } from './legacyChatCurriculum.js';
import { loadCurriculumContext, loadPromptFile, runTutorTurn } from './legacyChatEngine.js';
import { streamSingleAgentTurn } from './legacyChatTutorEngine.js';
import * as pilotStore from './pilotStore.js';

export const PILOT_TUTOR_ADAPTER_SCHEMA = 'machinespirits.pilot.tutor-session-adapter.v1';
export const PILOT_TUTOR_ADAPTER_VERSION = 1;

const DEFAULT_TOPIC = 'fractions tutoring session';
const MAX_LEARNER_MESSAGE_LENGTH = 32_768;

function pilotError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function validateLearnerMessage(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw pilotError('PILOT_LEARNER_MESSAGE_REQUIRED', 'learnerMessage is required', 400);
  }
  if (value.length > MAX_LEARNER_MESSAGE_LENGTH) {
    throw pilotError(
      'PILOT_LEARNER_MESSAGE_TOO_LONG',
      `learnerMessage must be at most ${MAX_LEARNER_MESSAGE_LENGTH} characters`,
      400,
    );
  }
  return value.trim();
}

function traceUsage(trace) {
  if (trace.totals) return trace.totals;
  return {
    inputTokens: trace.inputTokens || 0,
    outputTokens: trace.outputTokens || 0,
    latencyMs: trace.latencyMs || 0,
  };
}

/**
 * Dedicated adapter for the blinded participant tutoring phase.
 *
 * The pilot row remains authoritative for cell, curriculum, history, provider,
 * and time cap. No caller-provided research configuration is accepted here.
 */
export function createPilotTutorSessionAdapter({
  store = pilotStore,
  loadTutorAgents = evalConfigLoader.loadTutorAgents,
  loadCurriculum = loadCurriculumContext,
  loadPrompt = loadPromptFile,
  buildDirectorPlan = buildChatDirectorPlan,
  runTurn = runTutorTurn,
  streamTurn = streamSingleAgentTurn,
  env = process.env,
} = {}) {
  async function executeTurn({ sessionId, learnerMessage, onDelta = null } = {}) {
    const message = validateLearnerMessage(learnerMessage);
    const session = store.getSession(sessionId);
    if (!session) throw pilotError('PILOT_SESSION_NOT_FOUND', `pilot session ${sessionId} not found`, 404);
    if (session.status !== store.PILOT_STATUSES.TUTORING) {
      throw pilotError('PILOT_WRONG_PHASE', `pilot session not in tutoring phase (current: ${session.status})`, 409);
    }
    if (store.isTutoringExpired(session)) {
      store.endTutoring(sessionId, { reason: 'timed_out' });
      throw pilotError('PILOT_TIMED_OUT', 'tutoring time cap exceeded', 410);
    }

    const cellName = session.condition_cell;
    const profile = loadTutorAgents()?.profiles?.[cellName];
    if (!profile) throw pilotError('PILOT_CELL_NOT_FOUND', `cell "${cellName}" not found`, 404);
    if (!profile.ego) throw pilotError('PILOT_CELL_NO_EGO', `cell "${cellName}" has no ego config`, 400);

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) throw pilotError('PILOT_NO_API_KEY', 'OPENROUTER_API_KEY is not set', 503);

    const topic = DEFAULT_TOPIC;
    const lectureRef = session.scenario_lecture_ref || null;
    const curriculum = loadCurriculum({ lectureRef });
    if (lectureRef && !curriculum) {
      throw pilotError('PILOT_CURRICULUM_NOT_FOUND', `pilot curriculum ${lectureRef} not found`, 404);
    }
    const directorPlan = buildDirectorPlan({ sourceContext: curriculum, director: null, topic });
    const history = store.listTurns(sessionId).map((turn) => ({ role: turn.role, content: turn.content }));

    const egoPromptText = loadPrompt(profile.ego.prompt_file);
    const superegoPromptText = profile.superego ? loadPrompt(profile.superego.prompt_file) : '';
    const configHash = store.computeConfigHash({
      cellName,
      egoConfig: profile.ego,
      superegoConfig: profile.superego,
      egoPromptText,
      superegoPromptText,
      topic,
      lectureText: curriculum?.text || '',
    });

    const common = {
      profile,
      apiKey,
      history,
      learnerMessage: message,
      topic,
      curriculum,
      directorPlan,
    };
    const trace =
      typeof onDelta === 'function' && !profile.superego
        ? await streamTurn({ ...common, onDelta })
        : await runTurn({ ...common, useClaudeCli: false });
    const totals = traceUsage(trace);
    const deliberation = trace.deliberation || [];
    const egoEntry = deliberation.find((entry) => entry.role === 'ego');
    const superegoEntry = deliberation.find((entry) => entry.role === 'superego');

    store.appendTurn(sessionId, {
      role: 'learner',
      content: message,
      configHash,
    });
    const tutorTurn = store.appendTurn(sessionId, {
      role: 'tutor',
      content: trace.finalMessage,
      deliberation,
      wasRevised: trace.wasRevised === true,
      configHash,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      latencyMs: totals.latencyMs,
      egoModel: egoEntry?.model || trace.egoModel || null,
      superegoModel: superegoEntry?.model || null,
    });

    const refreshed = store.getSession(sessionId);
    return {
      schema: PILOT_TUTOR_ADAPTER_SCHEMA,
      version: PILOT_TUTOR_ADAPTER_VERSION,
      finalMessage: trace.finalMessage,
      sessionId,
      turnIndex: tutorTurn.turnIndex,
      tutoringTimeRemainingMs: store.tutoringTimeRemainingMs(refreshed),
      deliberation,
      totals,
    };
  }

  return Object.freeze({
    schema: PILOT_TUTOR_ADAPTER_SCHEMA,
    version: PILOT_TUTOR_ADAPTER_VERSION,
    executeTurn,
  });
}

export const pilotTutorSessionAdapter = createPilotTutorSessionAdapter();

export default pilotTutorSessionAdapter;
