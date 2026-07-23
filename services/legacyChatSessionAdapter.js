import { randomUUID } from 'node:crypto';

import { loadTutorAgents } from './evalConfigLoader.js';
import { computeLegacyChatConfigHash } from './legacyChatConfig.js';
import { LEGACY_CHAT_ENGINE_ID, loadCurriculumContext, loadPromptFile, runTutorTurn } from './legacyChatEngine.js';
import { buildChatDirectorPlan } from './legacyChatCurriculum.js';
import { normalizeCli } from './legacyChatTutorEngine.js';
import { TutorStubSessionHostError } from './tutorStubSessionHost.js';
import { TUTOR_STUB_SESSION_RUNTIME_SCHEMA, TUTOR_STUB_SESSION_RUNTIME_VERSION } from './tutorStubSessionRuntime.js';

export const CELL_LAB_SESSION_SCHEMA = 'machinespirits.cell-lab.session-adapter.v1';
export const CELL_LAB_SESSION_VERSION = 1;
export const CELL_LAB_RESEARCH_TRACE_SCHEMA = 'machinespirits.cell-lab.research-trace.v1';
export const CELL_LAB_RESEARCH_TRACE_VERSION = 1;

const CELL_LAB_CAPABILITY_SCHEMA = 'machinespirits.cell-lab.capability-snapshot.v1';
const SPECIFICATION_FIELDS = new Set([
  'id',
  'label',
  'load',
  'engine',
  'mode',
  'cell',
  'cellName',
  'topic',
  'lectureRef',
  'curriculumRef',
  'personaId',
  'director',
  'cli',
  'useClaudeCli',
  'sampling',
]);
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function invalid(message) {
  return new TutorStubSessionHostError('invalid_request', message, 400);
}

function boundedString(value, name, max = 512, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw invalid(`${name} is required`);
    return null;
  }
  if (typeof value !== 'string') throw invalid(`${name} must be a string`);
  const text = value.trim();
  if (!text) {
    if (required) throw invalid(`${name} is required`);
    throw invalid(`${name} must be non-empty`);
  }
  if (text.length > max) throw invalid(`${name} must be at most ${max} characters`);
  return text;
}

function normalizeSampling(value) {
  if (value === undefined || value === null) return { temperature: null, maxTokens: null };
  if (!isPlainObject(value)) throw invalid('sampling must be an object');
  const unknown = Object.keys(value).filter((key) => !['temperature', 'maxTokens'].includes(key));
  if (unknown.length) throw invalid(`unsupported cell_lab sampling fields: ${unknown.sort().join(', ')}`);
  const temperature = value.temperature ?? null;
  const maxTokens = value.maxTokens ?? null;
  if (temperature !== null && (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
    throw invalid('sampling.temperature must be a number between 0 and 2');
  }
  if (maxTokens !== null && (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 32_768)) {
    throw invalid('sampling.maxTokens must be an integer between 1 and 32768');
  }
  return { temperature, maxTokens };
}

function normalizeSpecification(specification) {
  if (!isPlainObject(specification)) throw invalid('cell_lab session specification must be an object');
  const unknown = Object.keys(specification).filter((key) => !SPECIFICATION_FIELDS.has(key));
  if (unknown.length) throw invalid(`unsupported cell_lab session fields: ${unknown.sort().join(', ')}`);
  if (specification.cell && specification.cellName && specification.cell !== specification.cellName) {
    throw invalid('cell and cellName must agree when both are provided');
  }
  if (
    specification.director !== undefined &&
    specification.director !== null &&
    !isPlainObject(specification.director)
  ) {
    throw invalid('director must be an object');
  }
  if (specification.cli !== undefined && specification.cli !== null && !isPlainObject(specification.cli)) {
    throw invalid('cli must be an object');
  }
  if (specification.useClaudeCli !== undefined && typeof specification.useClaudeCli !== 'boolean') {
    throw invalid('useClaudeCli must be a boolean');
  }
  const id = boundedString(specification.id || `cell-lab-${randomUUID()}`, 'id', 128, { required: true });
  if (!SESSION_ID_PATTERN.test(id)) {
    throw new TutorStubSessionHostError(
      'invalid_session_id',
      'session id must be 1-128 letters, numbers, dots, colons, underscores, or hyphens',
      400,
    );
  }
  const engine = boundedString(specification.engine || LEGACY_CHAT_ENGINE_ID, 'engine', 32, { required: true });
  if (engine !== LEGACY_CHAT_ENGINE_ID) throw invalid(`cell_lab adapter requires engine ${LEGACY_CHAT_ENGINE_ID}`);
  const mode = boundedString(specification.mode || LEGACY_CHAT_ENGINE_ID, 'mode', 32, { required: true });
  if (mode !== LEGACY_CHAT_ENGINE_ID) throw invalid(`cell_lab sessions require mode ${LEGACY_CHAT_ENGINE_ID}`);
  return {
    id,
    label: boundedString(specification.label, 'label', 160),
    engine,
    mode,
    cellName: boundedString(specification.cell || specification.cellName, 'cell', 160, { required: true }),
    topic: boundedString(specification.topic || 'general conversation', 'topic', 512, { required: true }),
    lectureRef: boundedString(specification.lectureRef, 'lectureRef', 240),
    curriculumRef: boundedString(specification.curriculumRef, 'curriculumRef', 240),
    personaId: boundedString(specification.personaId, 'personaId', 160),
    director: specification.director ? clone(specification.director) : null,
    cli: normalizeCli({ cli: specification.cli, useClaudeCli: specification.useClaudeCli === true }),
    sampling: normalizeSampling(specification.sampling),
  };
}

function publicCapabilitySnapshot() {
  return {
    schema: CELL_LAB_CAPABILITY_SCHEMA,
    registryVersion: CELL_LAB_SESSION_VERSION,
    mode: LEGACY_CHAT_ENGINE_ID,
    active: ['eval_cell', 'public_dialogue'],
    available: ['eval_cell', 'public_dialogue', 'research_trace'],
  };
}

function architectureFor(profile) {
  return {
    hasSuperego: Boolean(profile.superego),
    promptType: profile.factors?.prompt_type || null,
    recognitionMode: Boolean(profile.recognition_mode),
    conversationMode: profile.conversation_mode || null,
    learnerArchitecture: profile.learner_architecture || null,
    idDirector: profile.factors?.id_director === true,
  };
}

function curriculumProjection(curriculum) {
  if (!curriculum) return null;
  return {
    kind: curriculum.kind || null,
    courseId: curriculum.courseId || null,
    courseTitle: curriculum.courseTitle || null,
    lectureRef: curriculum.lectureRef || null,
    sourceRef: curriculum.sourceRef || curriculum.lectureRef || null,
    moduleId: curriculum.moduleId || null,
    title: curriculum.title || null,
    dramaticShape: curriculum.dramaticShape || null,
  };
}

/**
 * Create the in-process research adapter for the legacy eval-cell chat engine.
 *
 * `snapshot()` is intentionally learner-safe. `researchSnapshot()` is a
 * separate method consumed only by the administrator-gated research route.
 */
export function createCellLabSessionFactory({
  env = process.env,
  now = () => new Date(),
  loadTutorAgentsFn = loadTutorAgents,
  loadCurriculumContextFn = loadCurriculumContext,
  loadPromptFileFn = loadPromptFile,
  buildChatDirectorPlanFn = buildChatDirectorPlan,
  runTutorTurnFn = runTutorTurn,
} = {}) {
  return async function createCellLabSession(rawSpecification = {}) {
    const specification = normalizeSpecification(rawSpecification);
    const profile = loadTutorAgentsFn()?.profiles?.[specification.cellName];
    if (!profile) {
      throw new TutorStubSessionHostError(
        'cell_lab_cell_not_found',
        `unknown cell_lab cell: ${specification.cellName}`,
        404,
      );
    }
    if (profile.runner === 'adaptive') {
      throw new TutorStubSessionHostError(
        'cell_lab_runner_unsupported',
        `cell_lab cannot execute adaptive runner cell: ${specification.cellName}`,
        409,
      );
    }
    if (!profile.ego) throw invalid(`cell_lab cell ${specification.cellName} has no ego configuration`);

    const curriculum = loadCurriculumContextFn({
      lectureRef: specification.lectureRef,
      curriculumRef: specification.curriculumRef,
    });
    if ((specification.lectureRef || specification.curriculumRef) && !curriculum) {
      throw new TutorStubSessionHostError(
        'cell_lab_curriculum_not_found',
        'the requested cell_lab curriculum source was not found',
        404,
      );
    }
    const directorPlan = buildChatDirectorPlanFn({
      sourceContext: curriculum,
      director: specification.director,
      topic: specification.topic,
    });
    const egoPromptText = loadPromptFileFn(profile.ego.prompt_file);
    const superegoPromptText = profile.superego ? loadPromptFileFn(profile.superego.prompt_file) : '';
    const configHash = computeLegacyChatConfigHash({
      cellName: specification.cellName,
      egoConfig: profile.ego,
      superegoConfig: profile.superego,
      egoPromptText,
      superegoPromptText,
      topic: specification.topic,
      lectureText: curriculum?.text || '',
      personaId: specification.personaId,
    });

    const createdAt = now().toISOString();
    let status = 'created';
    let revision = 0;
    let publicMessages = [];
    let traceTurns = [];
    let terminationReason = null;
    let resolveClosed;
    const closed = new Promise((resolve) => {
      resolveClosed = resolve;
    });
    const lifecycle = {
      createdAt,
      updatedAt: createdAt,
      loadedAt: null,
      resumedAt: null,
      finalizedAt: null,
      finalizedReason: null,
    };
    const counters = { loads: 0, resumes: 0, resets: 0, steps: 0, commands: 0, learnerSteps: 0 };

    const tick = () => {
      const value = now();
      const timestamp = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
      lifecycle.updatedAt = timestamp;
      return timestamp;
    };

    const publicSnapshot = () => ({
      schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
      version: TUTOR_STUB_SESSION_RUNTIME_VERSION,
      sessionId: specification.id,
      status,
      revision,
      capabilitySnapshot: publicCapabilitySnapshot(),
      lifecycle: clone(lifecycle),
      counters: clone(counters),
      state: {
        transport: CELL_LAB_SESSION_SCHEMA,
        engine: LEGACY_CHAT_ENGINE_ID,
        mode: LEGACY_CHAT_ENGINE_ID,
        turnCount: traceTurns.length,
        publicMessageCount: publicMessages.length,
        opening: null,
        publicMessages: clone(publicMessages),
      },
    });

    const researchSnapshot = () => ({
      schema: CELL_LAB_RESEARCH_TRACE_SCHEMA,
      version: CELL_LAB_RESEARCH_TRACE_VERSION,
      sessionId: specification.id,
      engine: LEGACY_CHAT_ENGINE_ID,
      status,
      revision,
      configHash,
      cell: {
        name: specification.cellName,
        description: profile.description || '',
        architecture: architectureFor(profile),
        factors: clone(profile.factors || {}),
        dialogue: clone(profile.dialogue || null),
        ego: clone(profile.ego),
        superego: clone(profile.superego || null),
      },
      source: {
        topic: specification.topic,
        lectureRef: specification.lectureRef,
        curriculumRef: specification.curriculumRef,
        personaId: specification.personaId,
        curriculum: curriculumProjection(curriculum),
        director: clone(directorPlan),
      },
      substrate: {
        cli: clone(specification.cli),
        sampling: clone(specification.sampling),
      },
      turns: clone(traceTurns),
      totals: traceTurns.reduce(
        (totals, turn) => ({
          inputTokens: totals.inputTokens + (turn.totals?.inputTokens || 0),
          outputTokens: totals.outputTokens + (turn.totals?.outputTokens || 0),
          latencyMs: totals.latencyMs + (turn.totals?.latencyMs || 0),
          costUsd: totals.costUsd + (turn.totals?.costUsd || 0),
        }),
        { inputTokens: 0, outputTokens: 0, latencyMs: 0, costUsd: 0 },
      ),
    });

    const requireActive = (operation) => {
      if (status !== 'active') {
        throw new Error(`cannot ${operation} tutor-stub session while status is ${status}`);
      }
    };

    const terminate = (reason = 'terminated') => {
      if (terminationReason) return closed;
      terminationReason = reason;
      resolveClosed({ sessionId: specification.id, reason });
      return closed;
    };

    return {
      schema: CELL_LAB_SESSION_SCHEMA,
      version: CELL_LAB_SESSION_VERSION,
      id: specification.id,
      get status() {
        return status;
      },
      async load() {
        if (status !== 'created') return publicSnapshot();
        status = 'active';
        counters.loads += 1;
        lifecycle.loadedAt = tick();
        revision += 1;
        return publicSnapshot();
      },
      async resume() {
        throw new TutorStubSessionHostError(
          'runtime_resume_unavailable',
          'cell_lab session resume is not implemented yet',
          409,
        );
      },
      async reset() {
        requireActive('reset');
        publicMessages = [];
        traceTurns = [];
        counters.resets += 1;
        revision += 1;
        tick();
        return { reset: true };
      },
      async step(input, options = {}) {
        requireActive('step');
        const kind = options.kind || 'auto';
        if (
          kind === 'command' ||
          (kind === 'auto' &&
            String(input || '')
              .trim()
              .startsWith('/'))
        ) {
          throw new TutorStubSessionHostError(
            'command_transport_unavailable',
            'slash commands are not enabled for cell_lab sessions',
            409,
          );
        }
        const learnerMessage = String(input || '').trim();
        if (!learnerMessage) throw invalid('cell_lab learner input must be non-empty');
        if (!specification.cli.provider && !env.OPENROUTER_API_KEY) {
          throw new TutorStubSessionHostError(
            'model_provider_unavailable',
            'OPENROUTER_API_KEY is not set; configure it or select a local CLI substrate',
            503,
          );
        }
        const history = publicMessages.map((message) => ({
          role: message.role === 'assistant' ? 'tutor' : 'learner',
          content: message.content,
        }));
        const result = await runTutorTurnFn({
          profile,
          apiKey: env.OPENROUTER_API_KEY || null,
          history,
          learnerMessage,
          topic: specification.topic,
          curriculum,
          directorPlan,
          cli: specification.cli,
          temperature: specification.sampling.temperature,
          maxTokens: specification.sampling.maxTokens,
        });
        const tutorMessage = String(result?.finalMessage || '').trim();
        if (!tutorMessage) throw new Error('cell_lab tutor turn returned no public message');
        const completedAt = tick();
        const turn = {
          turn: traceTurns.length + 1,
          completedAt,
          learnerMessage,
          finalMessage: tutorMessage,
          wasRevised: result.wasRevised === true,
          architecture: clone(result.architecture || architectureFor(profile)),
          deliberation: clone(result.deliberation || []),
          totals: clone(result.totals || {}),
        };
        traceTurns = [...traceTurns, turn];
        publicMessages = [
          ...publicMessages,
          { role: 'user', content: learnerMessage },
          { role: 'assistant', content: tutorMessage },
        ];
        counters.steps += 1;
        counters.learnerSteps += 1;
        revision += 1;
        return { accepted: true, turn: { learner: learnerMessage, tutor: tutorMessage } };
      },
      async finalize(reason = 'cell_lab_finalize') {
        requireActive('finalize');
        status = 'finalized';
        lifecycle.finalizedReason = reason;
        lifecycle.finalizedAt = tick();
        revision += 1;
        return { finalized: true, reason };
      },
      snapshot() {
        return publicSnapshot();
      },
      researchSnapshot() {
        return researchSnapshot();
      },
      closed,
      terminate,
    };
  };
}

export default createCellLabSessionFactory;
