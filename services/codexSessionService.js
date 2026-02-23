import fs from 'fs';
import path from 'path';
import pty from 'node-pty';

const MAX_SESSIONS = 8;
const MAX_BUFFER_CHARS = 500_000;
const HARD_KILL_DELAY_MS = 2_000;
const STALE_SESSION_MS = 6 * 60 * 60 * 1000; // 6h

const sessions = new Map();
let sessionCounter = 0;

function nowIso() {
  return new Date().toISOString();
}

function makeSessionId() {
  sessionCounter += 1;
  return `codex-${Date.now()}-${sessionCounter}`;
}

function sanitizeArgs(args) {
  if (!Array.isArray(args)) return [];
  return args.filter((arg) => typeof arg === 'string' && arg.length > 0).slice(0, 64);
}

function resolveCwd(cwd) {
  const resolved = cwd ? path.resolve(cwd) : process.cwd();
  if (!fs.existsSync(resolved)) {
    throw new Error(`cwd does not exist: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`cwd is not a directory: ${resolved}`);
  }
  return resolved;
}

function trimSessionBuffer(session) {
  if (session.totalChars <= MAX_BUFFER_CHARS) return;
  while (session.events.length > 0 && session.totalChars > MAX_BUFFER_CHARS) {
    const removed = session.events.shift();
    session.totalChars -= removed.text.length;
  }
}

function addOutput(session, stream, text) {
  if (!text) return;
  const event = {
    idx: session.nextEventIdx++,
    stream,
    text,
    ts: nowIso(),
  };
  session.events.push(event);
  session.totalChars += text.length;
  trimSessionBuffer(session);
  session.lastActivityAt = event.ts;
}

function respondToTerminalQueries(session, text) {
  if (!text) return;
  if (text.includes('\u001b[6n')) {
    // Device Status Report request: report cursor row/col.
    session.process.write('\u001b[1;1R');
  }
}

function sessionSummary(session) {
  return {
    id: session.id,
    command: session.command,
    args: session.args,
    cwd: session.cwd,
    status: session.status,
    pid: session.pid,
    createdAt: session.createdAt,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    exitedAt: session.exitedAt,
    exitCode: session.exitCode,
    signal: session.signal,
    eventCount: session.nextEventIdx,
  };
}

function cleanupStaleSessions() {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (session.status === 'running') continue;
    const endedAtMs = session.exitedAt ? new Date(session.exitedAt).getTime() : now;
    if (now - endedAtMs > STALE_SESSION_MS) {
      sessions.delete(session.id);
    }
  }
}

export function createCodexSession(options = {}) {
  cleanupStaleSessions();
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error(`session limit reached (${MAX_SESSIONS})`);
  }

  const command = 'codex';
  const args = sanitizeArgs(options.args);
  const cwd = resolveCwd(options.cwd);

  const env = {
    ...process.env,
    ...(options.noColor ? { NO_COLOR: '1' } : {}),
    ...(options.env && typeof options.env === 'object' ? options.env : {}),
  };

  const child = pty.spawn(command, args, {
    name: options.termName || 'xterm-256color',
    cols: Number.isFinite(options.cols) ? Number(options.cols) : 120,
    rows: Number.isFinite(options.rows) ? Number(options.rows) : 40,
    cwd,
    env,
  });

  const id = makeSessionId();
  const session = {
    id,
    command,
    args,
    cwd,
    pid: child.pid ?? null,
    status: 'running',
    createdAt: nowIso(),
    startedAt: nowIso(),
    lastActivityAt: nowIso(),
    exitedAt: null,
    exitCode: null,
    signal: null,
    events: [],
    nextEventIdx: 0,
    totalChars: 0,
    process: child,
  };

  sessions.set(id, session);

  child.onData((chunk) => {
    const text = String(chunk);
    addOutput(session, 'stdout', text);
    respondToTerminalQueries(session, text);
  });
  child.onExit(({ exitCode, signal }) => {
    session.status = 'exited';
    session.exitCode = exitCode;
    session.signal = signal;
    session.exitedAt = nowIso();
    session.lastActivityAt = session.exitedAt;
  });

  return sessionSummary(session);
}

export function listCodexSessions() {
  cleanupStaleSessions();
  return [...sessions.values()].map((session) => sessionSummary(session));
}

export function getCodexSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return sessionSummary(session);
}

export function pollCodexSession(sessionId, cursor = -1) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const fromIdx = Number.isFinite(cursor) ? Number(cursor) : -1;
  const events = session.events.filter((event) => event.idx > fromIdx);
  const nextCursor = events.length > 0 ? events[events.length - 1].idx : fromIdx;

  return {
    session: sessionSummary(session),
    cursor: fromIdx,
    nextCursor,
    events,
  };
}

export function writeCodexSessionInput(sessionId, input, appendNewline = true) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`session not found: ${sessionId}`);
  }
  if (session.status !== 'running') {
    throw new Error(`session is not running: ${sessionId}`);
  }
  if (typeof input !== 'string') {
    throw new Error('input must be a string');
  }

  const payload = appendNewline ? `${input}\r` : input;
  session.process.write(payload);
  session.lastActivityAt = nowIso();
  return { accepted: true, bytes: Buffer.byteLength(payload) };
}

export function terminateCodexSession(sessionId, signal = 'SIGTERM') {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (session.status !== 'running') {
    return {
      ...sessionSummary(session),
      alreadyExited: true,
    };
  }

  try {
    session.process.kill(signal);
  } catch (error) {
    addOutput(session, 'stderr', `[terminate-error] ${error.message}\n`);
  }

  setTimeout(() => {
    if (session.status === 'running') {
      try {
        session.process.kill('SIGKILL');
      } catch {
        // ignore
      }
    }
  }, HARD_KILL_DELAY_MS);

  return sessionSummary(session);
}
