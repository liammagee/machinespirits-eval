import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { resolveTutorStubCommand } from './tutorStubCommandRegistry.js';

export const TUTOR_STUB_CODEX_REMOTE_BRIDGE_SCHEMA = 'machinespirits.tutor-stub.codex-remote-bridge.v1';
export const TUTOR_STUB_CODEX_REMOTE_BRIDGE_VERSION = 1;

const REMOTE_BLOCKED_COMMANDS = new Map([
  ['demo', 'guided terminal demos are not available remotely; start a session and use tutor_turn instead'],
  ['proof', 'proof subprocesses and exports stay local; run /proof in the terminal CLI'],
  ['visualization', 'local visualization files are not exposed by this bridge'],
  ['transcript', 'local transcript files are not exposed by this bridge; tutor_status returns the public messages'],
  ['voice', 'microphone and speaker controls require the local browser companion'],
  ['tune', 'review-gated tuning artifacts must be managed from the local terminal CLI'],
  ['scenario', 'scenario process relaunch is unavailable remotely; stop this session and call tutor_start with world'],
  [
    'board',
    'workplan process relaunch is unavailable remotely; stop this session and call tutor_start in curriculum mode',
  ],
  ['reset', 'use tutor_reset so Codex receives the new session state'],
  ['quit', 'use tutor_stop so the MCP host can close and evict the child process cleanly'],
  ['lab', 'lab process relaunch is unavailable remotely; select mode when calling tutor_start'],
]);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null));
}

function bridgeError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function commandToken(input) {
  return String(input || '')
    .trim()
    .split(/\s+/u)[0];
}

export function tutorStubCodexRemoteCommandAdmission(input) {
  const normalized = String(input || '').trim();
  if (!normalized.startsWith('/')) {
    return {
      allowed: false,
      code: 'invalid_remote_command',
      status: 400,
      message: 'remote tutor commands must begin with /',
    };
  }
  const definition = resolveTutorStubCommand(commandToken(normalized));
  if (!definition) {
    return {
      allowed: false,
      code: 'unknown_remote_command',
      status: 400,
      message: `unknown tutor command: ${commandToken(normalized)}`,
    };
  }
  const blockedReason = REMOTE_BLOCKED_COMMANDS.get(definition.id);
  if (blockedReason) {
    return {
      allowed: false,
      commandId: definition.id,
      code: 'remote_command_requires_local_surface',
      status: 409,
      message: `${definition.token} is terminal-only on the Codex bridge: ${blockedReason}`,
    };
  }
  return {
    allowed: true,
    commandId: definition.id,
    summary: definition.summary,
  };
}

function publicMessages(snapshot) {
  const messages = Array.isArray(snapshot?.state?.publicMessages) ? snapshot.state.publicMessages : [];
  return messages
    .filter((message) => message && ['assistant', 'user'].includes(message.role) && typeof message.content === 'string')
    .map(({ role, content }) => ({ role, content }));
}

function latestMessage(messages, role) {
  return messages.findLast((message) => message.role === role)?.content || null;
}

export function tutorStubCodexRemoteSessionView(snapshot, { includeMessages = false } = {}) {
  if (!snapshot || typeof snapshot !== 'object') throw bridgeError('invalid_session_snapshot', 'invalid tutor session');
  const messages = publicMessages(snapshot);
  const state = snapshot.state || {};
  const capabilitySnapshot = snapshot.capabilitySnapshot || {};
  return compactObject({
    schema: TUTOR_STUB_CODEX_REMOTE_BRIDGE_SCHEMA,
    version: TUTOR_STUB_CODEX_REMOTE_BRIDGE_VERSION,
    sessionId: snapshot.sessionId,
    status: snapshot.status,
    revision: snapshot.revision,
    mode: state.mode || state.capabilityMode || capabilitySnapshot.mode,
    interactionMode: state.interactionMode,
    worldId: state.worldId,
    curriculumModuleId: state.curriculumModuleId,
    turnCount: state.turnCount || 0,
    publicMessageCount: state.publicMessageCount ?? messages.length,
    opening: state.opening?.content || messages[0]?.content || null,
    latestLearner: latestMessage(messages, 'user'),
    latestTutor: latestMessage(messages, 'assistant'),
    activeCapabilities: Array.isArray(capabilitySnapshot.active) ? [...capabilitySnapshot.active] : [],
    publicMessages: includeMessages ? messages : undefined,
  });
}

function operationSession(operation) {
  return operation?.session && typeof operation.session === 'object' ? operation.session : null;
}

function currentTurn(operation) {
  const turn = operation?.result?.turn;
  if (!turn || typeof turn !== 'object') return null;
  return {
    learner: typeof turn.learner === 'string' ? turn.learner : null,
    tutor: typeof turn.tutor === 'string' ? turn.tutor : null,
  };
}

export function createTutorStubCodexRemoteBridge({ host } = {}) {
  if (!host || typeof host.create !== 'function' || typeof host.step !== 'function') {
    throw new Error('Codex tutor bridge requires a tutor-stub session host');
  }
  let activeSessionId = null;

  const resolveSessionId = (requested = null) => {
    if (requested) return requested;
    const sessions = host.list();
    if (activeSessionId && sessions.some((session) => session.sessionId === activeSessionId)) {
      return activeSessionId;
    }
    if (sessions.length === 1) {
      activeSessionId = sessions[0].sessionId;
      return activeSessionId;
    }
    throw bridgeError(
      'active_session_required',
      sessions.length
        ? 'more than one tutor session is active; provide sessionId'
        : 'no tutor session is active; call tutor_start first',
      409,
    );
  };

  return Object.freeze({
    get activeSessionId() {
      return activeSessionId;
    },
    async start(options = {}) {
      const specification = compactObject({
        id: options.sessionId,
        mode: options.mode || 'mixed',
        model: options.model,
        classifierModel: options.classifierModel,
        learnerRecordModel: options.learnerRecordModel,
        tutor: options.tutor,
        topic: options.topic,
        world: options.world,
        curriculum: options.curriculum,
        module: options.module,
        resume: options.resume,
        resumeLast: options.resumeLast === true,
        load: { source: 'codex_remote_mcp' },
      });
      const snapshot = await host.create(specification);
      activeSessionId = snapshot.sessionId;
      return tutorStubCodexRemoteSessionView(snapshot, { includeMessages: true });
    },
    async turn({ sessionId = null, learnerText }) {
      const id = resolveSessionId(sessionId);
      const operation = await host.step(id, learnerText, {
        kind: 'learner',
        context: { source: 'codex_remote_mcp' },
      });
      const session = operationSession(operation);
      const turn = currentTurn(operation);
      const view = tutorStubCodexRemoteSessionView(session);
      return {
        ...view,
        accepted: operation?.result?.accepted === true,
        learner: turn?.learner || learnerText,
        tutor: turn?.tutor || view.latestTutor,
      };
    },
    async command({ sessionId = null, command }) {
      const admission = tutorStubCodexRemoteCommandAdmission(command);
      if (!admission.allowed) throw bridgeError(admission.code, admission.message, admission.status);
      const id = resolveSessionId(sessionId);
      const operation = await host.step(id, command, {
        kind: 'command',
        context: { source: 'codex_remote_mcp' },
      });
      const session = operationSession(operation);
      return {
        ...tutorStubCodexRemoteSessionView(session),
        accepted: operation?.result?.accepted !== false,
        command: command.trim(),
        commandId: admission.commandId,
        summary: admission.summary,
        output: operation?.result?.command?.output || '',
      };
    },
    status({ sessionId = null } = {}) {
      if (!sessionId && !activeSessionId && host.list().length !== 1) {
        return {
          schema: TUTOR_STUB_CODEX_REMOTE_BRIDGE_SCHEMA,
          version: TUTOR_STUB_CODEX_REMOTE_BRIDGE_VERSION,
          activeSessionId: null,
          sessions: host.list().map((snapshot) => tutorStubCodexRemoteSessionView(snapshot)),
        };
      }
      const id = resolveSessionId(sessionId);
      return tutorStubCodexRemoteSessionView(host.get(id), { includeMessages: true });
    },
    async reset({ sessionId = null, reason = 'codex_remote_reset' } = {}) {
      const id = resolveSessionId(sessionId);
      const operation = await host.reset(id, { reason });
      return {
        ...tutorStubCodexRemoteSessionView(operationSession(operation), { includeMessages: true }),
        reset: operation?.result?.reset === true,
        reason,
      };
    },
    interrupt({ sessionId = null, reason = 'codex_remote_interrupt' } = {}) {
      const id = resolveSessionId(sessionId);
      const operation = host.interrupt(id, reason);
      if (activeSessionId === id) activeSessionId = null;
      return {
        sessionId: id,
        interrupted: operation?.result?.interrupted === true,
        reason,
      };
    },
    async stop({ sessionId = null, reason = 'codex_remote_stop' } = {}) {
      const id = resolveSessionId(sessionId);
      const operation = await host.finalize(id, reason, { source: 'codex_remote_mcp' });
      if (activeSessionId === id) activeSessionId = null;
      return {
        sessionId: id,
        finalized: operation?.result?.finalized === true,
        reason,
      };
    },
  });
}

function toolResult(data, text) {
  return {
    content: [{ type: 'text', text }],
    structuredContent: { data: clone(data) },
  };
}

function toolError(error) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `${error?.code || 'tutor_bridge_error'}: ${error?.message || String(error)}`,
      },
    ],
  };
}

function registerBridgeTool(server, bridge, name, config, invoke, format) {
  server.registerTool(
    name,
    {
      ...config,
      outputSchema: { data: z.record(z.string(), z.unknown()) },
    },
    async (input) => {
      try {
        const data = await invoke(bridge, input);
        return toolResult(data, format(data));
      } catch (error) {
        return toolError(error);
      }
    },
  );
}

export function createTutorStubCodexRemoteMcpServer({ host } = {}) {
  const bridge = createTutorStubCodexRemoteBridge({ host });
  const server = new McpServer({
    name: 'machinespirits-tutor-stub',
    version: String(TUTOR_STUB_CODEX_REMOTE_BRIDGE_VERSION),
  });

  registerBridgeTool(
    server,
    bridge,
    'tutor_start',
    {
      title: 'Start tutor dialogue',
      description:
        'Start a process-backed Machine Spirits tutor session. Defaults to mixed mode. Return the public opening and make this the active session.',
      inputSchema: {
        sessionId: z.string().min(1).max(128).optional(),
        mode: z.enum(['direct', 'passthrough', 'scaffold', 'mixed', 'curriculum']).optional(),
        model: z.string().min(1).max(160).optional(),
        classifierModel: z.string().min(1).max(160).optional(),
        learnerRecordModel: z.string().min(1).max(160).optional(),
        tutor: z.string().min(1).max(160).optional(),
        topic: z.string().min(1).max(512).optional(),
        world: z.string().min(1).max(160).optional(),
        curriculum: z.string().min(1).max(240).optional(),
        module: z.string().min(1).max(160).optional(),
        resume: z.string().min(1).max(1024).optional(),
        resumeLast: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    (activeBridge, input) => activeBridge.start(input),
    (data) =>
      `Tutor session ${data.sessionId} started in ${data.mode} mode.${data.opening ? `\n\ntutor > ${data.opening}` : ''}`,
  );

  registerBridgeTool(
    server,
    bridge,
    'tutor_turn',
    {
      title: 'Send learner turn',
      description:
        'Send the learner text exactly as supplied into the active public tutor dialogue. Do not paraphrase, summarize, or answer it in Codex; the tutor runtime must answer it.',
      inputSchema: {
        sessionId: z.string().min(1).max(128).optional(),
        learnerText: z.string().min(1).max(32_000),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    (activeBridge, input) => activeBridge.turn(input),
    (data) => `learner > ${data.learner}\n\ntutor > ${data.tutor || '[no tutor response]'}`,
  );

  registerBridgeTool(
    server,
    bridge,
    'tutor_command',
    {
      title: 'Run tutor control command',
      description:
        'Run a supported tutor-stub slash command outside learner speech, including /meta ask, /meta, /translate, /register, /character, /tutor, /learner, /analysis, /status, and /help. Terminal-only commands return an explicit alternative.',
      inputSchema: {
        sessionId: z.string().min(1).max(128).optional(),
        command: z.string().min(1).max(32_000),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    (activeBridge, input) => activeBridge.command(input),
    (data) => `${data.command}\n\n${data.output || `${data.summary} (completed)`}`,
  );

  registerBridgeTool(
    server,
    bridge,
    'tutor_status',
    {
      title: 'Inspect tutor dialogue',
      description:
        'Read the active tutor session and its public transcript only. Hidden tutor state, private reasoning, and provider diagnostics are not exposed.',
      inputSchema: { sessionId: z.string().min(1).max(128).optional() },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    (activeBridge, input) => activeBridge.status(input),
    (data) =>
      data.sessionId
        ? `Tutor session ${data.sessionId}: ${data.status}, ${data.turnCount} completed turn(s).${data.latestTutor ? `\n\nlatest tutor > ${data.latestTutor}` : ''}`
        : `No active tutor session. ${data.sessions?.length || 0} session(s) are available.`,
  );

  registerBridgeTool(
    server,
    bridge,
    'tutor_reset',
    {
      title: 'Reset tutor dialogue',
      description: 'Clear unfinished dialogue work and restart the same tutor inquiry.',
      inputSchema: {
        sessionId: z.string().min(1).max(128).optional(),
        reason: z.string().min(1).max(240).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    (activeBridge, input) => activeBridge.reset(input),
    (data) => `Tutor session ${data.sessionId} reset (${data.reason}).`,
  );

  registerBridgeTool(
    server,
    bridge,
    'tutor_interrupt',
    {
      title: 'Interrupt tutor model call',
      description:
        'Immediately terminate a tutor session whose model call is stuck. The session cannot continue afterward.',
      inputSchema: {
        sessionId: z.string().min(1).max(128).optional(),
        reason: z.string().min(1).max(240).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    (activeBridge, input) => activeBridge.interrupt(input),
    (data) => `Tutor session ${data.sessionId} interrupted (${data.reason}).`,
  );

  registerBridgeTool(
    server,
    bridge,
    'tutor_stop',
    {
      title: 'Finish tutor dialogue',
      description:
        'Finalize the active tutor session, write its normal trace/summary artifacts, and stop its child process.',
      inputSchema: {
        sessionId: z.string().min(1).max(128).optional(),
        reason: z.string().min(1).max(240).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    (activeBridge, input) => activeBridge.stop(input),
    (data) => `Tutor session ${data.sessionId} finalized (${data.reason}).`,
  );

  return { server, bridge };
}

export default createTutorStubCodexRemoteBridge;
