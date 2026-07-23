import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { resolveTutorStubCapabilities } from './tutorStubCapabilities.js';
import { getTutorStubLab } from './tutorStubLabs.js';
import { createTutorStubSessionHost, TutorStubSessionHostError } from './tutorStubSessionHost.js';
import { normalizeTutorStubResumeTrace } from './tutorStubSessionRecipe.js';
import { TUTOR_STUB_SESSION_RPC_SCHEMA, TUTOR_STUB_SESSION_RPC_VERSION } from './tutorStubSessionRpc.js';
import { TUTOR_STUB_SESSION_RUNTIME_SCHEMA, TUTOR_STUB_SESSION_RUNTIME_VERSION } from './tutorStubSessionRuntime.js';

export const TUTOR_STUB_PROCESS_SESSION_SCHEMA = 'machinespirits.tutor-stub.process-session.v1';
export const TUTOR_STUB_PROCESS_SESSION_VERSION = 1;

const SESSION_MODES = new Set(['direct', 'passthrough', 'scaffold', 'mixed', 'curriculum']);
const PROCESS_SESSION_LAB_MODES = new Map([
  ['pure_chat', 'passthrough'],
  ['human_scaffold', 'scaffold'],
]);
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const RESUME_TRACE_EXTENSION = '.jsonl';
const MAX_RESUME_TRACE_DIRECTORIES = 256;
const MAX_RESUME_TRACE_FILES = 2_048;
const MAX_RESUME_DIRECTORY_ENTRIES = 8_192;
const MAX_RESUME_TRACE_BYTES = 64 * 1024 * 1024;
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
  'lab',
  'resume',
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
  const selectedLab = boundedString(specification.lab, 'lab', 64);
  if (selectedLab && !getTutorStubLab(selectedLab)) {
    throw new TutorStubSessionHostError('invalid_request', 'lab must name a registered tutor-stub capability lab', 400);
  }
  if (selectedLab && !PROCESS_SESSION_LAB_MODES.has(selectedLab)) {
    throw new TutorStubSessionHostError(
      'lab_transport_unavailable',
      `lab ${selectedLab} is not available through the process-backed HTTP transport`,
      409,
    );
  }
  const requiredLabMode = selectedLab ? PROCESS_SESSION_LAB_MODES.get(selectedLab) : null;
  const mode = boundedString(specification.mode || requiredLabMode || 'direct', 'mode', 32);
  if (!SESSION_MODES.has(mode)) {
    throw new TutorStubSessionHostError(
      'invalid_request',
      `mode must be one of: ${[...SESSION_MODES].join(', ')}`,
      400,
    );
  }
  if (requiredLabMode && mode !== requiredLabMode) {
    throw new TutorStubSessionHostError(
      'lab_mode_mismatch',
      `lab ${selectedLab} requires mode ${requiredLabMode}`,
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
    lab: selectedLab,
    resume: boundedString(specification.resume, 'resume', 1_024),
    resumeLast: specification.resumeLast === true,
  };
  if (!SESSION_ID_PATTERN.test(normalized.id)) {
    throw new TutorStubSessionHostError(
      'invalid_session_id',
      'session id must be 1-128 letters, numbers, dots, colons, underscores, or hyphens',
      400,
    );
  }
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
  if (normalized.resume && normalized.resumeLast) {
    throw new TutorStubSessionHostError(
      'invalid_request',
      'resume and resumeLast are mutually exclusive; use an explicit resume source when both are available',
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
      opening: null,
      publicMessages: [],
    },
    events: [],
  };
}

export function tutorStubProcessSessionTraceDirectory(traceRoot, sessionId) {
  const digest = createHash('sha256').update(sessionId).digest('hex').slice(0, 16);
  const readable = sessionId.replaceAll(/[^A-Za-z0-9._-]/gu, '_').slice(0, 48) || 'session';
  return path.join(traceRoot, `${readable}-${digest}`);
}

export function tutorStubProcessCommandLine(root, specification, traceDir) {
  const args = [
    path.join(root, 'scripts/tutor-stub.js'),
    '--session-rpc',
    '--session-id',
    specification.id,
    '--trace-dir',
    traceDir,
    '--opening-realizer',
    'deterministic',
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
    ['lab', specification.lab],
    ['resume', specification.resume],
  ];
  for (const [flag, value] of values) if (value) args.push(`--${flag}`, value);
  if (specification.mode === 'passthrough') args.push('--passthrough', '--no-opening');
  if (specification.mode === 'scaffold') {
    args.push('--dag', '--tutor-learner-dag', '--dag-mode', 'defeasible_human_scaffold');
  }
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

function resumeSourceError(code, message) {
  return new TutorStubSessionHostError(code, message, 400);
}

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function traceRootForFactory(root, traceDir) {
  return path.isAbsolute(traceDir) ? path.resolve(traceDir) : path.resolve(root, traceDir);
}

function assertSafeTraceFile(candidate, { traceRoot, realTraceRoot }) {
  const absolute = path.resolve(candidate);
  if (!isPathWithin(traceRoot, absolute) || path.extname(absolute).toLowerCase() !== RESUME_TRACE_EXTENSION) {
    throw resumeSourceError('invalid_resume_source', 'resume source must be a trace inside configured trace storage');
  }

  let stats;
  let realFile;
  try {
    stats = fs.lstatSync(absolute);
    if (stats.isSymbolicLink() || !stats.isFile()) throw new Error('not a regular file');
    if (stats.size > MAX_RESUME_TRACE_BYTES) throw new Error('trace exceeds the safe read limit');
    realFile = fs.realpathSync(absolute);
  } catch {
    throw resumeSourceError('invalid_resume_source', 'resume source is not a readable tutor-stub trace');
  }
  if (!isPathWithin(realTraceRoot, realFile)) {
    throw resumeSourceError('invalid_resume_source', 'resume source must be a trace inside configured trace storage');
  }
  return { filePath: realFile, mtimeMs: stats.mtimeMs, size: stats.size };
}

function readBoundedDirectory(directory, counters) {
  const entries = [];
  let handle;
  try {
    handle = fs.opendirSync(directory);
    for (;;) {
      const entry = handle.readSync();
      if (!entry) break;
      counters.entries += 1;
      if (counters.entries > MAX_RESUME_DIRECTORY_ENTRIES) {
        throw resumeSourceError(
          'resume_trace_scan_limit',
          'configured trace storage exceeds the safe resume scan limit',
        );
      }
      entries.push(entry);
    }
  } catch (error) {
    if (error instanceof TutorStubSessionHostError) throw error;
    throw resumeSourceError('invalid_resume_source', 'configured trace storage is not readable');
  } finally {
    try {
      handle?.closeSync();
    } catch {
      // The sanitized read error above is sufficient; close failure adds no
      // useful public detail and must not reveal a host path.
    }
  }
  return entries;
}

function collectResumeTraceFiles(traceRoot) {
  let realTraceRoot;
  try {
    const stats = fs.statSync(traceRoot);
    if (!stats.isDirectory()) throw new Error('not a directory');
    realTraceRoot = fs.realpathSync(traceRoot);
  } catch {
    throw resumeSourceError('resume_source_not_found', 'no resumable tutor-stub trace is available');
  }

  const counters = { entries: 0, directories: 0, files: 0 };
  const candidates = [];
  const rootEntries = readBoundedDirectory(realTraceRoot, counters);
  for (const entry of rootEntries) {
    const entryPath = path.join(realTraceRoot, entry.name);
    if (entry.isFile() && entry.name.endsWith(RESUME_TRACE_EXTENSION)) {
      counters.files += 1;
      candidates.push(assertSafeTraceFile(entryPath, { traceRoot: realTraceRoot, realTraceRoot }));
    } else if (entry.isDirectory()) {
      counters.directories += 1;
      if (counters.directories > MAX_RESUME_TRACE_DIRECTORIES) {
        throw resumeSourceError(
          'resume_trace_scan_limit',
          'configured trace storage exceeds the safe resume scan limit',
        );
      }
      for (const child of readBoundedDirectory(entryPath, counters)) {
        if (!child.isFile() || !child.name.endsWith(RESUME_TRACE_EXTENSION)) continue;
        counters.files += 1;
        candidates.push(
          assertSafeTraceFile(path.join(entryPath, child.name), { traceRoot: realTraceRoot, realTraceRoot }),
        );
      }
    }
    if (counters.files > MAX_RESUME_TRACE_FILES) {
      throw resumeSourceError('resume_trace_scan_limit', 'configured trace storage exceeds the safe resume scan limit');
    }
  }
  return { candidates, realTraceRoot };
}

function normalizeSafeResumeCandidate(candidate) {
  try {
    const source = normalizeTutorStubResumeTrace(candidate.filePath);
    return source.turns.length ? source : null;
  } catch {
    return null;
  }
}

/**
 * Resolve browser/API resume selectors before a child process is started.
 *
 * Unlike the terminal helper, this boundary never resolves against cwd and
 * never sends `--resume-last` into a per-session trace namespace. It scans
 * only the configured root and one namespace level, then hands the child one
 * already-validated absolute trace path.
 */
export function resolveTutorStubProcessResumePath({ resume, resumeLast }, { root, traceDir }) {
  if (!resume && !resumeLast) return null;
  const traceRoot = traceRootForFactory(root, traceDir);

  if (resume && path.isAbsolute(resume)) {
    let realTraceRoot;
    try {
      realTraceRoot = fs.realpathSync(traceRoot);
    } catch {
      throw resumeSourceError('resume_source_not_found', 'no resumable tutor-stub trace is available');
    }
    const candidate = assertSafeTraceFile(resume, { traceRoot, realTraceRoot });
    if (!normalizeSafeResumeCandidate(candidate)) {
      throw resumeSourceError('invalid_resume_source', 'resume source is not a resumable tutor-stub trace');
    }
    return candidate.filePath;
  }

  const { candidates, realTraceRoot } = collectResumeTraceFiles(traceRoot);
  if (resumeLast) {
    const ordered = candidates.sort(
      (left, right) => right.mtimeMs - left.mtimeMs || left.filePath.localeCompare(right.filePath),
    );
    let inspectedBytes = 0;
    for (const candidate of ordered) {
      inspectedBytes += candidate.size;
      if (inspectedBytes > MAX_RESUME_TRACE_BYTES) {
        throw resumeSourceError(
          'resume_trace_scan_limit',
          'configured trace storage exceeds the safe resume scan limit',
        );
      }
      if (normalizeSafeResumeCandidate(candidate)) return candidate.filePath;
    }
    throw resumeSourceError('resume_source_not_found', 'no resumable tutor-stub trace is available');
  }

  const raw = String(resume || '').trim();
  const hasPathSyntax = raw.includes('/') || raw.includes('\\');
  if (hasPathSyntax) {
    const candidatePath = path.resolve(realTraceRoot, raw);
    const candidate = assertSafeTraceFile(candidatePath, { traceRoot: realTraceRoot, realTraceRoot });
    if (!normalizeSafeResumeCandidate(candidate)) {
      throw resumeSourceError('invalid_resume_source', 'resume source is not a resumable tutor-stub trace');
    }
    return candidate.filePath;
  }

  const expectedName = raw.endsWith(RESUME_TRACE_EXTENSION) ? raw : `${raw}${RESUME_TRACE_EXTENSION}`;
  const matches = candidates.filter((candidate) => path.basename(candidate.filePath) === expectedName);
  if (matches.length > 1) {
    throw resumeSourceError('ambiguous_resume_source', 'resume run id matches more than one stored tutor-stub trace');
  }
  if (!matches.length) {
    throw resumeSourceError('resume_source_not_found', 'resume run id was not found in configured trace storage');
  }
  if (!normalizeSafeResumeCandidate(matches[0])) {
    throw resumeSourceError('invalid_resume_source', 'resume source is not a resumable tutor-stub trace');
  }
  return matches[0].filePath;
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
  const traceRoot = traceRootForFactory(root, traceDir);

  return async function createProcessSession(rawSpecification = {}) {
    const normalized = normalizeSpecification(rawSpecification);
    const resumePath = resolveTutorStubProcessResumePath(normalized, { root, traceDir: traceRoot });
    const specification = resumePath ? { ...normalized, resume: resumePath, resumeLast: false } : normalized;
    let snapshot = provisionalSnapshot(specification);
    let child = null;
    let commandStream = null;
    let responseLines = null;
    let readyPromise = null;
    let nextRequest = 0;
    let stdout = '';
    let stderr = '';
    let terminationReason = null;
    let closedInfo = null;
    let resolveClosed;
    const closed = new Promise((resolve) => {
      resolveClosed = resolve;
    });
    const pending = new Map();

    const fatalError = (code, message, options = {}) => {
      const error = new Error(message, options);
      error.code = code;
      error.fatalSession = true;
      return error;
    };

    const settleClosed = (details) => {
      if (closedInfo) return closedInfo;
      closedInfo = Object.freeze({ sessionId: specification.id, ...details });
      resolveClosed(closedInfo);
      return closedInfo;
    };

    const rejectPending = (error) => {
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(error);
      }
      pending.clear();
    };

    const start = () => {
      if (readyPromise) return readyPromise;
      if (terminationReason) {
        return Promise.reject(
          fatalError(
            'session_terminated',
            `tutor-stub session ${specification.id} was terminated before it started (${terminationReason})`,
          ),
        );
      }
      readyPromise = new Promise((resolve, reject) => {
        const sessionTraceDir = tutorStubProcessSessionTraceDirectory(traceRoot, specification.id);
        const args = tutorStubProcessCommandLine(root, specification, sessionTraceDir);
        child = spawnProcess(executable, args, {
          cwd: tutorStubProcessWorkingDirectory(root),
          env: tutorStubProcessEnvironment(env, { electronRunAsNode }),
          stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'],
        });
        commandStream = child.stdio[3];
        const responseStream = child.stdio[4];
        commandStream.on('error', (error) => {
          const fatal = fatalError(
            'session_control_stream_failed',
            `tutor-stub session ${specification.id} control stream failed: ${error.message}`,
            { cause: error },
          );
          rejectPending(fatal);
          terminate('control_stream_failed');
        });
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
          const error = fatalError(
            'session_start_timeout',
            `tutor-stub session ${specification.id} did not become ready within ${startupTimeoutMs}ms`,
          );
          reject(error);
          rejectPending(error);
          terminate('startup_timeout');
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
          const fatal = fatalError(
            'session_process_error',
            `tutor-stub session ${specification.id} process error: ${error.message}`,
            { cause: error },
          );
          reject(fatal);
          rejectPending(fatal);
          settleClosed({ reason: terminationReason || 'process_error', error: fatal.message });
        });
        child.on('exit', (code, signal) => {
          clearTimeout(startupTimer);
          const error = fatalError(
            'session_process_exited',
            `tutor-stub session ${specification.id} exited before completing its request (code ${code}, signal ${signal || 'none'})`,
          );
          error.stdoutBytes = Buffer.byteLength(stdout);
          error.stderrBytes = Buffer.byteLength(stderr);
          reject(error);
          rejectPending(error);
          settleClosed({
            reason: terminationReason || (snapshot.status === 'finalized' ? 'finalized' : 'process_exit'),
            code,
            signal: signal || null,
          });
        });
      });
      return readyPromise;
    };

    const request = async (operation, payload = {}) => {
      await start();
      if (!commandStream?.writable) {
        const error = fatalError(
          'session_control_closed',
          `tutor-stub session ${specification.id} control channel is closed`,
        );
        terminate('control_channel_closed');
        throw error;
      }
      nextRequest += 1;
      const id = `${specification.id}:${nextRequest}`;
      const result = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          const error = fatalError(
            'session_request_timeout',
            `tutor-stub session ${specification.id} ${operation} timed out after ${requestTimeoutMs}ms`,
          );
          reject(error);
          terminate('request_timeout');
        }, requestTimeoutMs);
        pending.set(id, { resolve, reject, timer });
      });
      commandStream.write(`${JSON.stringify({ id, operation, ...payload })}\n`, (error) => {
        if (!error) return;
        const pendingRequest = pending.get(id);
        if (!pendingRequest) return;
        pending.delete(id);
        clearTimeout(pendingRequest.timer);
        const fatal = fatalError(
          'session_control_write_failed',
          `tutor-stub session ${specification.id} control write failed: ${error.message}`,
          { cause: error },
        );
        pendingRequest.reject(fatal);
        terminate('control_write_failed');
      });
      return result;
    };

    const terminate = (reason = 'terminated') => {
      if (terminationReason) return closed;
      terminationReason = reason;
      const error = fatalError('session_terminated', `tutor-stub session ${specification.id} terminated (${reason})`);
      rejectPending(error);
      responseLines?.close();
      commandStream?.end();
      if (!child) {
        settleClosed({ reason, code: null, signal: null });
        return closed;
      }
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      const forceTimer = setTimeout(() => {
        if (child?.exitCode === null && child?.signalCode === null) child.kill('SIGKILL');
      }, 1_000);
      forceTimer.unref?.();
      void closed.finally(() => clearTimeout(forceTimer));
      return closed;
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
      async resume() {
        throw new TutorStubSessionHostError(
          'runtime_resume_unavailable',
          'process-backed sessions can only resume at creation time with resume or resumeLast',
          409,
        );
      },
      async reset(payload = {}) {
        await request('reset', { payload });
        return { reset: true };
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
        const result = await request('step', { input, kind, context: options.context || {} });
        const learner = typeof result?.turn?.learner === 'string' ? result.turn.learner : null;
        const tutor = typeof result?.turn?.tutor === 'string' ? result.turn.tutor : null;
        return {
          accepted: result?.accepted === true,
          ...(learner || tutor ? { turn: { learner, tutor } } : {}),
        };
      },
      async finalize(reason = 'process_session_finalize', payload = {}) {
        if (snapshot.status === 'finalized') return clone(snapshot);
        await request('finalize', { reason, payload });
        terminate('finalized');
        return { finalized: true, reason };
      },
      snapshot() {
        return clone(snapshot);
      },
      diagnostics() {
        return { stdout, stderr };
      },
      closed,
      terminate,
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
