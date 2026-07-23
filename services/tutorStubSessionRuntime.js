import {
  TUTOR_STUB_COMMAND_REGISTRY,
  resolveTutorStubCommand,
  tutorStubCommandAvailable,
  tutorStubCommandUnavailableReasons,
} from './tutorStubCommandRegistry.js';
import { TUTOR_STUB_CAPABILITY_SNAPSHOT_SCHEMA } from './tutorStubCapabilities.js';

export const TUTOR_STUB_SESSION_RUNTIME_SCHEMA = 'machinespirits.tutor-stub.session-runtime.v1';
export const TUTOR_STUB_SESSION_RUNTIME_VERSION = 1;
export const TUTOR_STUB_SESSION_EVENT_SCHEMA = 'machinespirits.tutor-stub.session-event.v1';
export const TUTOR_STUB_SESSION_STATUSES = Object.freeze(['created', 'active', 'finalized']);

let nextSessionSequence = 0;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function nowIso(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('session runtime clock must return a valid date');
  return date.toISOString();
}

function normalizeSessionId(value) {
  const id = String(value || '').trim();
  if (!id) throw new Error('session runtime id must be non-empty');
  return id;
}

function defaultSessionId(now) {
  nextSessionSequence += 1;
  return `tutor-stub-session-${now.replaceAll(/[^0-9]/gu, '').slice(0, 17)}-${nextSessionSequence}`;
}

function normalizeCapabilities(capabilities) {
  if (capabilities?.schema !== TUTOR_STUB_CAPABILITY_SNAPSHOT_SCHEMA) {
    throw new Error(`session runtime requires a ${TUTOR_STUB_CAPABILITY_SNAPSHOT_SCHEMA} capability snapshot`);
  }
  if (capabilities.compatibility?.valid !== true) {
    const issues = capabilities.compatibility?.issues?.map((issue) => issue.message).filter(Boolean) || [];
    throw new Error(
      `session runtime capability snapshot is incompatible${issues.length ? `: ${issues.join('; ')}` : ''}`,
    );
  }
  return deepFreeze(clone(capabilities));
}

function normalizeAdapters(adapters) {
  if (!adapters || typeof adapters !== 'object' || Array.isArray(adapters)) return Object.freeze({});
  for (const [name, adapter] of Object.entries(adapters)) {
    if (typeof adapter !== 'function') throw new Error(`session runtime adapter ${name} must be a function`);
  }
  return Object.freeze({ ...adapters });
}

function normalizeHandlers(handlers) {
  if (!handlers || typeof handlers !== 'object' || Array.isArray(handlers)) return Object.freeze({});
  for (const [name, handler] of Object.entries(handlers)) {
    if (typeof handler !== 'function') throw new Error(`session runtime command handler ${name} must be a function`);
  }
  return Object.freeze({ ...handlers });
}

function splitCommandInput(input) {
  const trimmed = String(input || '').trim();
  const token = trimmed.split(/\s+/u)[0] || '';
  return {
    input: trimmed,
    token,
    argument: trimmed.slice(token.length).trim(),
  };
}

function copyPromiseHints(source, target) {
  if (!source || typeof source !== 'object' || !target || typeof target !== 'object') return target;
  if ('tutorStubBlocksPrompt' in source) target.tutorStubBlocksPrompt = source.tutorStubBlocksPrompt;
  return target;
}

export function createTutorStubCommandHandlers(execute) {
  if (typeof execute !== 'function') throw new Error('command handler adapter must be a function');
  return Object.freeze(
    Object.fromEntries(
      TUTOR_STUB_COMMAND_REGISTRY.commands.map((definition) => [
        definition.handler,
        (invocation) => execute(invocation),
      ]),
    ),
  );
}

export function assertTutorStubCommandHandlers(handlers) {
  const normalized = normalizeHandlers(handlers);
  const missing = TUTOR_STUB_COMMAND_REGISTRY.commands
    .filter((definition) => typeof normalized[definition.handler] !== 'function')
    .map((definition) => definition.handler);
  if (missing.length) throw new Error(`missing tutor-stub command handlers: ${missing.join(', ')}`);
  return true;
}

export function createTutorStubSessionRuntime({
  id = null,
  capabilities,
  initialState = {},
  adapters = {},
  commandHandlers = {},
  onEvent = null,
  now = () => new Date(),
} = {}) {
  const frozenCapabilities = normalizeCapabilities(capabilities);
  const lifecycleAdapters = normalizeAdapters(adapters);
  const handlers = normalizeHandlers(commandHandlers);
  if (onEvent !== null && typeof onEvent !== 'function') throw new Error('session runtime onEvent must be a function');
  if (typeof now !== 'function') throw new Error('session runtime clock must be a function');

  const createdAt = nowIso(now);
  const sessionId = normalizeSessionId(id || defaultSessionId(createdAt));
  const capsule = {
    status: 'created',
    revision: 0,
    sequence: 0,
    createdAt,
    updatedAt: createdAt,
    loadedAt: null,
    resumedAt: null,
    finalizedAt: null,
    finalizedReason: null,
    state: clone(initialState),
    counters: {
      loads: 0,
      resumes: 0,
      resets: 0,
      steps: 0,
      commands: 0,
      learnerSteps: 0,
    },
    events: [],
  };

  const emit = (event, details = {}, traceEvent = null) => {
    capsule.sequence += 1;
    capsule.updatedAt = nowIso(now);
    const record = deepFreeze({
      schema: TUTOR_STUB_SESSION_EVENT_SCHEMA,
      sessionId,
      sequence: capsule.sequence,
      event,
      traceEvent,
      status: capsule.status,
      revision: capsule.revision,
      at: capsule.updatedAt,
      details: clone(details),
    });
    capsule.events.push(record);
    onEvent?.(record);
    return record;
  };

  const refreshState = (fallback = undefined) => {
    const snapshot = lifecycleAdapters.snapshot?.({
      sessionId,
      status: capsule.status,
      revision: capsule.revision,
      state: clone(capsule.state),
    });
    if (snapshot !== undefined) capsule.state = clone(snapshot);
    else if (fallback !== undefined) capsule.state = clone(fallback);
  };

  const requireActive = (operation) => {
    if (capsule.status !== 'active') {
      throw new Error(`cannot ${operation} tutor-stub session while status is ${capsule.status}`);
    }
  };

  const settle = ({ operation, result, complete, failed }) => {
    const onComplete = (value) => {
      complete(value);
      return value;
    };
    const onFailed = (error) => {
      failed(error);
      throw error;
    };
    if (result && typeof result.then === 'function') {
      return copyPromiseHints(result, Promise.resolve(result).then(onComplete, onFailed));
    }
    try {
      return onComplete(result);
    } catch (error) {
      if (operation.endsWith('_completed')) throw error;
      return onFailed(error);
    }
  };

  const invoke = ({ name, payload = {}, startDetails = {}, completeDetails = () => ({}), transition = null }) => {
    const adapter = lifecycleAdapters[name];
    emit(`${name}_started`, startDetails);
    let result;
    try {
      result = adapter?.({
        sessionId,
        payload: clone(payload),
        state: clone(capsule.state),
        capabilities: frozenCapabilities,
      });
    } catch (error) {
      emit(`${name}_failed`, { message: error.message });
      throw error;
    }
    return settle({
      operation: `${name}_completed`,
      result,
      complete(value) {
        transition?.(value);
        refreshState(payload.state);
        capsule.revision += 1;
        emit(`${name}_completed`, completeDetails(value));
      },
      failed(error) {
        emit(`${name}_failed`, { message: error.message });
      },
    });
  };

  const dispatchCommand = (input, { context = {} } = {}) => {
    requireActive('dispatch a command in');
    const parsed = splitCommandInput(input);
    const definition = resolveTutorStubCommand(parsed.token);
    if (!definition) {
      const invocation = deepFreeze({ ...parsed, context: clone(context), definition: null, sessionId });
      const value = lifecycleAdapters.unknownCommand?.(invocation) ?? false;
      emit('command_unknown', { token: parsed.token, input: parsed.input });
      return value;
    }
    const mode = frozenCapabilities.mode === 'passthrough' ? 'passthrough' : 'normal';
    const commandOptions = { mode, capabilities: frozenCapabilities };
    const invocation = deepFreeze({
      ...parsed,
      id: definition.id,
      canonicalToken: definition.token,
      handler: definition.handler,
      traceEvent: definition.traceEvent,
      definition,
      context: clone(context),
      sessionId,
    });
    if (!tutorStubCommandAvailable(definition.id, commandOptions)) {
      const reasons = tutorStubCommandUnavailableReasons(definition.id, commandOptions);
      const value =
        lifecycleAdapters.commandUnavailable?.({
          ...invocation,
          reasons,
          capabilityMode: frozenCapabilities.mode,
        }) ?? false;
      emit('command_rejected', {
        commandId: definition.id,
        token: parsed.token,
        canonicalToken: definition.token,
        reasons,
      });
      return value;
    }
    const handler = handlers[definition.handler];
    if (!handler) throw new Error(`missing tutor-stub command handler: ${definition.handler}`);

    emit('command_started', {
      commandId: definition.id,
      token: parsed.token,
      canonicalToken: definition.token,
      handler: definition.handler,
      duringTurn: Boolean(context.duringTurn),
    });
    let result;
    try {
      result = handler(invocation);
    } catch (error) {
      emit('command_failed', { commandId: definition.id, message: error.message }, definition.traceEvent);
      throw error;
    }
    return settle({
      operation: 'command_completed',
      result,
      complete() {
        capsule.counters.commands += 1;
        refreshState();
        emit(
          'command_completed',
          {
            commandId: definition.id,
            token: parsed.token,
            canonicalToken: definition.token,
            handler: definition.handler,
            duringTurn: Boolean(context.duringTurn),
          },
          definition.traceEvent,
        );
      },
      failed(error) {
        emit('command_failed', { commandId: definition.id, message: error.message }, definition.traceEvent);
      },
    });
  };

  const api = {
    get id() {
      return sessionId;
    },
    get status() {
      return capsule.status;
    },
    load(payload = {}) {
      if (capsule.status !== 'created')
        throw new Error(`cannot load tutor-stub session while status is ${capsule.status}`);
      return invoke({
        name: 'load',
        payload,
        startDetails: { source: payload.source || 'configuration' },
        completeDetails: () => ({ source: payload.source || 'configuration' }),
        transition() {
          capsule.status = 'active';
          capsule.loadedAt = capsule.updatedAt;
          capsule.counters.loads += 1;
        },
      });
    },
    resume(payload = {}) {
      requireActive('resume');
      return invoke({
        name: 'resume',
        payload,
        startDetails: { source: payload.source || null },
        completeDetails: () => ({ source: payload.source || null, turns: payload.turns ?? null }),
        transition() {
          capsule.resumedAt = capsule.updatedAt;
          capsule.counters.resumes += 1;
        },
      });
    },
    reset(payload = {}) {
      requireActive('reset');
      return invoke({
        name: 'reset',
        payload,
        startDetails: { reason: payload.reason || 'dialogue_reset' },
        completeDetails: () => ({ reason: payload.reason || 'dialogue_reset' }),
        transition() {
          capsule.counters.resets += 1;
        },
      });
    },
    step(input, { kind = 'auto', context = {} } = {}) {
      requireActive('step');
      const command =
        kind === 'command' ||
        (kind === 'auto' &&
          String(input || '')
            .trim()
            .startsWith('/'));
      capsule.counters.steps += 1;
      if (command) return dispatchCommand(input, { context });
      capsule.counters.learnerSteps += 1;
      return invoke({
        name: 'step',
        payload: { input, kind, context },
        startDetails: { kind, source: context.source || null },
        completeDetails: () => ({ kind, source: context.source || null }),
      });
    },
    dispatchCommand,
    sync(reason = 'external_state_changed') {
      requireActive('synchronize');
      refreshState();
      capsule.revision += 1;
      emit('state_synchronized', { reason });
      return api.snapshot();
    },
    finalize(reason = 'exit', payload = {}) {
      if (capsule.status === 'finalized') return api.snapshot();
      const result = invoke({
        name: 'finalize',
        payload: { ...payload, reason },
        startDetails: { reason },
        completeDetails: () => ({ reason }),
        transition() {
          capsule.status = 'finalized';
          capsule.finalizedAt = capsule.updatedAt;
          capsule.finalizedReason = reason;
        },
      });
      return result && typeof result.then === 'function' ? result.then(() => api.snapshot()) : api.snapshot();
    },
    snapshot() {
      refreshState();
      return deepFreeze({
        schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
        version: TUTOR_STUB_SESSION_RUNTIME_VERSION,
        sessionId,
        status: capsule.status,
        revision: capsule.revision,
        capabilitySnapshot: {
          schema: frozenCapabilities.schema,
          registryVersion: frozenCapabilities.registryVersion,
          mode: frozenCapabilities.mode,
          active: [...frozenCapabilities.active],
          available: [...frozenCapabilities.available],
        },
        lifecycle: {
          createdAt: capsule.createdAt,
          updatedAt: capsule.updatedAt,
          loadedAt: capsule.loadedAt,
          resumedAt: capsule.resumedAt,
          finalizedAt: capsule.finalizedAt,
          finalizedReason: capsule.finalizedReason,
        },
        counters: clone(capsule.counters),
        state: clone(capsule.state),
        events: clone(capsule.events),
      });
    },
  };

  emit('created', { capabilityMode: frozenCapabilities.mode });
  return Object.freeze(api);
}
