import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import readline from 'node:readline';

import { resolveTutorStubCapabilities } from './tutorStubCapabilities.js';
import { createTutorStubSessionHost, TutorStubSessionHostError } from './tutorStubSessionHost.js';
import { TUTOR_STUB_SESSION_RPC_SCHEMA, TUTOR_STUB_SESSION_RPC_VERSION } from './tutorStubSessionRpc.js';
import { TUTOR_STUB_SESSION_RUNTIME_SCHEMA, TUTOR_STUB_SESSION_RUNTIME_VERSION } from './tutorStubSessionRuntime.js';

export const TUTOR_STUB_PROCESS_SESSION_SCHEMA = 'machinespirits.tutor-stub.process-session.v1';
export const TUTOR_STUB_PROCESS_SESSION_VERSION = 1;

const SESSION_MODES = new Set(['direct', 'passthrough', 'scaffold', 'mixed', 'curriculum']);
const SPECIFICATION_FIELDS = new Set([
  'id',
  'label',
  'load',
  'mode',
  'model',
  'classifierModel',
  'learnerRecordModel',
  'tutor',
  'topic',
  'world',
  'curriculum',
  'module',
  'resumeLast',
]);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function boundedString(value, name, max = 512) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string')
    throw new TutorStubSessionHostError('invalid_request', `${name} must be a string`, 400);
  const text = value.trim();
  if (!text) throw new TutorStubSessionHostError('invalid_request', `${name} must be non-empty`, 400);
  if (text.length > max) {
    throw new TutorStubSessionHostError('invalid_request', `${name} must be at most ${max} characters`, 400);
  }
  return text;
}

function normalizeSpecification(specification) {
  const unknown = Object.keys(specification).filter((key) => !SPECIFICATION_FIELDS.has(key));
  if (unknown.length) {
    throw new TutorStubSessionHostError(
      'invalid_request',
      `unsupported tutor-stub session fields: ${unknown.sort().join(', ')}`,
      400,
    );
  }
  const mode = boundedString(specification.mode || 'direct', 'mode', 32);
  if (!SESSION_MODES.has(mode)) {
    throw new TutorStubSessionHostError(
      'invalid_request',
      `mode must be one of: ${[...SESSION_MODES].join(', ')}`,
      400,
    );
  }
  const normalized = {
    id: boundedString(specification.id || `tutor-stub-${randomUUID()}`, 'id', 128),
    mode,
    model: boundedString(specification.model, 'model', 160),
    classifierModel: boundedString(specification.classifierModel, 'classifierModel', 160),
    learnerRecordModel: boundedString(specification.learnerRecordModel, 'learnerRecordModel', 160),
    tutor: boundedString(specification.tutor, 'tutor', 160),
    topic: boundedString(specification.topic, 'topic', 512),
    world: boundedString(specification.world, 'world', 160),
    curriculum: boundedString(specification.curriculum, 'curriculum', 240),
    module: boundedString(specification.module, 'module', 160),
    resumeLast: specification.resumeLast === true,
  };
  if (mode === 'curriculum' && (!normalized.curriculum || !normalized.module)) {
    throw new TutorStubSessionHostError('invalid_request', 'curriculum sessions require curriculum and module', 400);
  }
  if (mode !== 'curriculum' && (normalized.curriculum || normalized.module)) {
    throw new TutorStubSessionHostError(
      'invalid_request',
      'curriculum and module are only valid when mode is curriculum',
      400,
    );
  }
  return normalized;
}

function capabilitiesFor(specification) {
  const curriculum = specification.mode === 'curriculum';
  return resolveTutorStubCapabilities({
    passthrough: specification.mode === 'passthrough',
    interactive: true,
    world: curriculum ? false : specification.world !== 'none',
    curriculum,
    learnerDag: specification.mode === 'scaffold',
    mixedLearner: specification.mode === 'mixed',
    classifier: specification.mode !== 'passthrough',
    registerSelection: specification.mode !== 'passthrough',
    responseChecks: specification.mode !== 'passthrough',
  });
}

function provisionalSnapshot(specification) {
  const capabilities = capabilitiesFor(specification);
  const now = new Date().toISOString();
  return {
    schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
    version: TUTOR_STUB_SESSION_RUNTIME_VERSION,
    sessionId: specification.id,
    status: 'created',
    revision: 0,
    capabilitySnapshot: {
      schema: capabilities.schema,
      registryVersion: capabilities.registryVersion,
      mode: capabilities.mode,
      active: [...capabilities.active],
      available: [...capabilities.available],
    },
    lifecycle: {
      createdAt: now,
      updatedAt: now,
      loadedAt: null,
      resumedAt: null,
      finalizedAt: null,
      finalizedReason: null,
    },
    counters: { loads: 0, resumes: 0, resets: 0, steps: 0, commands: 0, learnerSteps: 0 },
    state: {
      transport: TUTOR_STUB_PROCESS_SESSION_SCHEMA,
      mode: specification.mode,
      turnCount: 0,
      publicMessageCount: 0,
    },
    events: [],
  };
}

function commandLine(root, specification, traceDir) {
  const args = [
    path.join(root, 'scripts/tutor-stub.js'),
    '--session-rpc',
    '--session-id',
    specification.id,
    '--trace-dir',
    traceDir,
    '--no-opening',
    '--no-closeout-report',
    '--no-interim-animation',
    '--no-stream',
    '--no-turn-feedback',
    '--no-remember-settings',
    '--no-color',
    '--motion',
    'off',
  ];
  const values = [
    ['model', specification.model],
    ['classifier-model', specification.classifierModel],
    ['learner-record-model', specification.learnerRecordModel],
    ['tutor', specification.tutor],
    ['topic', specification.topic],
    ['world', specification.world],
    ['curriculum', specification.curriculum],
    ['module', specification.module],
  ];
  for (const [flag, value] of values) if (value) args.push(`--${flag}`, value);
  if (specification.mode === 'passthrough') args.push('--passthrough');
  if (specification.mode === 'scaffold') args.push('--tutor-learner-dag');
  if (specification.mode === 'mixed') args.push('--mixed-learner');
  if (specification.resumeLast) args.push('--resume-last');
  return args;
}

export function tutorStubProcessWorkingDirectory(root) {
  const asarIndex = String(root || '').indexOf('.asar');
  if (asarIndex < 0) return root;
  return path.dirname(root.slice(0, asarIndex + '.asar'.length));
}

export function tutorStubProcessEnvironment(env, { electronRunAsNode = false } = {}) {
  return {
    ...env,
    ...(electronRunAsNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    TUTOR_STUB_SUMMARY_OPEN: '0',
    TUTOR_STUB_TRANSCRIPT_OPEN: '0',
    TUTOR_STUB_VOICE_OPEN: '0',
  };
}

function appendDiagnostic(current, chunk, max = 24_000) {
  const next = `${current}${chunk}`;
  return next.length > max ? next.slice(-max) : next;
}

/** Create one lazy process-backed runtime proxy for the in-process host. */
export function createTutorStubProcessSessionFactory({
  root,
  env = process.env,
  traceDir = env.TUTOR_STUB_TRACE_DIR || path.join(root || process.cwd(), '.tutor-stub-traces'),
  startupTimeoutMs = 30_000,
  requestTimeoutMs = 300_000,
  spawnProcess = spawn,
  executable = process.execPath,
  electronRunAsNode = Boolean(process.versions.electron),
} = {}) {
  if (!root) throw new Error('tutor-stub process session factory requires root');

  return async function createProcessSession(rawSpecification = {}) {
    const specification = normalizeSpecification(rawSpecification);
    let snapshot = provisionalSnapshot(specification);
    let child = null;
    let commandStream = null;
    let responseLines = null;
    let readyPromise = null;
    let nextRequest = 0;
    let stdout = '';
    let stderr = '';
    const pending = new Map();

    const rejectPending = (error) => {
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(error);
      }
      pending.clear();
    };

    const start = () => {
      if (readyPromise) return readyPromise;
      readyPromise = new Promise((resolve, reject) => {
        const args = commandLine(root, specification, traceDir);
        child = spawnProcess(executable, args, {
          cwd: tutorStubProcessWorkingDirectory(root),
          env: tutorStubProcessEnvironment(env, { electronRunAsNode }),
          stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'],
        });
        commandStream = child.stdio[3];
        const responseStream = child.stdio[4];
        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');
        child.stdout?.on('data', (chunk) => {
          stdout = appendDiagnostic(stdout, chunk);
        });
        child.stderr?.on('data', (chunk) => {
          stderr = appendDiagnostic(stderr, chunk);
        });
        responseStream.setEncoding('utf8');
        responseLines = readline.createInterface({ input: responseStream, crlfDelay: Infinity });
        const startupTimer = setTimeout(() => {
          const error = new Error(
            `tutor-stub session ${specification.id} did not become ready within ${startupTimeoutMs}ms`,
          );
          child?.kill('SIGTERM');
          reject(error);
        }, startupTimeoutMs);
        responseLines.on('line', (line) => {
          let frame;
          try {
            frame = JSON.parse(line);
          } catch {
            return;
          }
          if (frame.schema !== TUTOR_STUB_SESSION_RPC_SCHEMA || frame.version !== TUTOR_STUB_SESSION_RPC_VERSION)
            return;
          if (frame.session) snapshot = clone(frame.session);
          if (frame.type === 'ready') {
            clearTimeout(startupTimer);
            resolve(snapshot);
            return;
          }
          if (frame.type !== 'response' || !frame.id) return;
          const request = pending.get(frame.id);
          if (!request) return;
          pending.delete(frame.id);
          clearTimeout(request.timer);
          if (frame.ok) request.resolve(frame.result);
          else {
            const error = new Error(frame.error?.message || 'tutor-stub session RPC failed');
            error.code = frame.error?.code || 'session_rpc_failed';
            request.reject(error);
          }
        });
        child.on('error', (error) => {
          clearTimeout(startupTimer);
          reject(error);
          rejectPending(error);
        });
        child.on('exit', (code, signal) => {
          clearTimeout(startupTimer);
          const error = new Error(
            `tutor-stub session ${specification.id} exited before completing its request (code ${code}, signal ${signal || 'none'})${
              stderr ? `: ${stderr.trim().slice(-1000)}` : ''
            }`,
          );
          reject(error);
          rejectPending(error);
        });
      });
      return readyPromise;
    };

    const request = async (operation, payload = {}) => {
      await start();
      if (!commandStream?.writable) throw new Error(`tutor-stub session ${specification.id} control channel is closed`);
      nextRequest += 1;
      const id = `${specification.id}:${nextRequest}`;
      const result = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(
            new Error(`tutor-stub session ${specification.id} ${operation} timed out after ${requestTimeoutMs}ms`),
          );
        }, requestTimeoutMs);
        pending.set(id, { resolve, reject, timer });
      });
      commandStream.write(`${JSON.stringify({ id, operation, ...payload })}\n`);
      return result;
    };

    return {
      schema: TUTOR_STUB_PROCESS_SESSION_SCHEMA,
      version: TUTOR_STUB_PROCESS_SESSION_VERSION,
      get id() {
        return specification.id;
      },
      get status() {
        return snapshot.status;
      },
      async load() {
        await start();
        return clone(snapshot);
      },
      async resume(payload = {}) {
        return request('resume', { payload });
      },
      async reset(payload = {}) {
        return request('reset', { payload });
      },
      async step(input, options = {}) {
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
            'slash commands are not enabled on the process-backed HTTP transport yet',
            409,
          );
        }
        return request('step', { input, kind, context: options.context || {} });
      },
      async finalize(reason = 'process_session_finalize', payload = {}) {
        if (snapshot.status === 'finalized') return clone(snapshot);
        const result = await request('finalize', { reason, payload });
        commandStream?.end();
        return result;
      },
      snapshot() {
        return clone(snapshot);
      },
      diagnostics() {
        return { stdout, stderr };
      },
      terminate() {
        commandStream?.end();
        child?.kill('SIGTERM');
      },
    };
  };
}

export function createTutorStubProcessSessionHost(options = {}) {
  const { maxSessions = 32, ...factoryOptions } = options;
  return createTutorStubSessionHost({
    createSession: createTutorStubProcessSessionFactory(factoryOptions),
    maxSessions,
  });
}

export default createTutorStubProcessSessionFactory;
