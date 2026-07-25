#!/usr/bin/env node

// Drive a real tutor-stub session from a non-interactive host — a Claude Code
// remote session, a CI job, any place without a TTY.
//
// Nothing here reimplements the tutor. The chain is already in the repo:
//
//   scripts/tutor-stub.js --session-rpc     the real CLI, JSONL over fd 3/4
//     ^ spawned by services/tutorStubProcessSessionFactory.js
//       ^ mounted at /api/tutor-stub by services/evalSurfaces.js
//
// This script is a client for that HTTP transport plus the two pieces of
// bookkeeping a shell-driven caller cannot keep in its head between commands:
// the server process and the current session id.
//
// The remote-session enabler is the model default. A cloud container has no
// OPENROUTER_API_KEY, but Claude Code ships an authenticated `claude` binary on
// PATH, and services/cliProviderBridge.js already speaks to it. Defaulting to
// claude-code.sonnet-5 means a fresh container needs no credentials at all.
// The catalog default (codex.gpt-5.6-terra) would need a CLI that is not there.

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Sonnet 5 over the Claude Code CLI bridge: no API key required in a cloud
// container. Override with --model for any ref in `worlds` output.
export const DEFAULT_REMOTE_MODEL = 'claude-code.sonnet-5';
export const DEFAULT_REMOTE_PORT = 8099;
export const DEFAULT_REMOTE_LAB = 'pure_chat';
export const DEFAULT_REMOTE_TUTOR = 'dramatic-detective@v1';

// A learner turn crosses the HTTP transport, the RPC child, and a bridged CLI
// call. The bridge alone can take minutes on a long scaffold turn.
const DEFAULT_STEP_TIMEOUT_MS = 600_000;
const CONTROL_TIMEOUT_MS = 60_000;
const SERVER_READY_TIMEOUT_MS = 90_000;
const SERVER_PROBE_INTERVAL_MS = 500;

const SUBCOMMANDS = new Set(['worlds', 'start', 'say', 'status', 'transcript', 'end']);

/**
 * The session pointer is developer-facing state for this script only; the
 * served stack never opens it, so it is deliberately absent from
 * desktop/paths.js. The env override exists so tests can isolate it.
 */
export function resolveRemoteStateDir(env = process.env) {
  return env.TUTOR_STUB_REMOTE_STATE_DIR || path.join(ROOT, '.tutor-stub-remote');
}

function statePath(env = process.env) {
  return path.join(resolveRemoteStateDir(env), 'session.json');
}

export function readRemoteState(env = process.env) {
  try {
    return JSON.parse(fs.readFileSync(statePath(env), 'utf8'));
  } catch {
    return null;
  }
}

export function writeRemoteState(state, env = process.env) {
  const dir = resolveRemoteStateDir(env);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath(env), `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

export function clearRemoteState(env = process.env) {
  try {
    fs.rmSync(statePath(env));
  } catch {
    // Already gone is the desired end state.
  }
}

export function parseRemoteArgs(argv) {
  const [subcommand, ...rest] = argv;
  if (!subcommand || subcommand === '--help' || subcommand === '-h') return { subcommand: 'help' };
  if (!SUBCOMMANDS.has(subcommand)) {
    throw new Error(`unknown subcommand: ${subcommand} (expected one of ${[...SUBCOMMANDS].join(', ')})`);
  }

  const args = { subcommand, json: false, autostart: true, stopServer: false, positional: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === '--json') args.json = true;
    else if (token === '--no-autostart') args.autostart = false;
    else if (token === '--stop-server') args.stopServer = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = rest[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`--${key} requires a value`);
      args[key.replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else args.positional.push(token);
  }

  if (args.port !== undefined) {
    const port = Number(args.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`invalid --port: ${args.port}`);
    args.port = port;
  }
  if (args.timeout !== undefined) {
    const timeout = Number(args.timeout);
    if (!Number.isFinite(timeout) || timeout <= 0) throw new Error(`invalid --timeout: ${args.timeout}`);
    args.timeout = timeout;
  }
  return args;
}

export function buildSessionSpecification(args = {}) {
  const specification = {
    lab: args.lab || DEFAULT_REMOTE_LAB,
    tutor: args.tutor || DEFAULT_REMOTE_TUTOR,
    model: args.model || DEFAULT_REMOTE_MODEL,
  };
  // `world: none` is how the transport asks for a worldless session, so an
  // explicit value is always forwarded verbatim.
  if (args.world !== undefined) specification.world = args.world;
  if (args.topic) specification.topic = args.topic;
  if (args.curriculum) specification.curriculum = args.curriculum;
  if (args.module) specification.module = args.module;
  if (args.classifierModel) specification.classifierModel = args.classifierModel;
  return specification;
}

/** Public dialogue lives at state.publicMessages as {role, content} pairs. */
export function extractDialogue(session) {
  const messages = session?.state?.publicMessages;
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({
      speaker: message.role === 'assistant' ? 'tutor' : 'learner',
      text: message.content,
    }));
}

/** The transport reports failures as an {error:{code,message}} envelope. */
export function describeError(payload, fallback = 'tutor-stub request failed') {
  if (!payload?.error) return null;
  const { code, message } = payload.error;
  return `${code || 'error'}: ${message || fallback}`;
}

export function baseUrl(args = {}, env = process.env) {
  if (args.baseUrl) return args.baseUrl.replace(/\/+$/u, '');
  const port = args.port || Number(env.TUTOR_STUB_REMOTE_PORT) || DEFAULT_REMOTE_PORT;
  return `http://127.0.0.1:${port}`;
}

async function request(base, method, endpoint, body, timeoutMs = CONTROL_TIMEOUT_MS) {
  const response = await fetch(`${base}/api/tutor-stub${endpoint}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => ({}));
  const described = describeError(payload);
  if (described) throw new Error(described);
  if (!response.ok) throw new Error(`tutor-stub request failed (HTTP ${response.status})`);
  return payload;
}

async function serverReachable(base) {
  try {
    const response = await fetch(`${base}/api/tutor-stub/`, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer(base, args, env = process.env) {
  if (await serverReachable(base)) return { started: false };
  if (!args.autostart) throw new Error(`no tutor-stub server reachable at ${base} (and --no-autostart was passed)`);

  const port = new URL(base).port || String(DEFAULT_REMOTE_PORT);
  const logDir = resolveRemoteStateDir(env);
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'server.log');
  const log = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...env, PORT: port, STANDALONE: 'true' },
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();

  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await serverReachable(base)) return { started: true, pid: child.pid, logFile };
    await new Promise((resolve) => setTimeout(resolve, SERVER_PROBE_INTERVAL_MS));
  }
  throw new Error(`tutor-stub server did not become ready within ${SERVER_READY_TIMEOUT_MS / 1000}s — see ${logFile}`);
}

function requireSessionId(args, env) {
  const sessionId = args.session || readRemoteState(env)?.sessionId;
  if (!sessionId) throw new Error('no active tutor-stub session — run `start` first, or pass --session <id>');
  return sessionId;
}

function printDialogue(dialogue, { limit = null } = {}) {
  const shown = limit === null ? dialogue : dialogue.slice(-limit);
  for (const turn of shown) {
    const label = turn.speaker === 'tutor' ? 'TUTOR' : 'LEARNER';
    console.log(`\n[${label}]\n${turn.text}`);
  }
}

function emit(args, payload, render) {
  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else render();
}

const USAGE = `Usage: node scripts/tutor-stub-remote.js <subcommand> [options]

Drives the real tutor-stub CLI (scripts/tutor-stub.js --session-rpc) from a
non-interactive host. Boots the server on demand and remembers the session id
between invocations, so each turn is a single command.

Subcommands
  worlds                    list labs, worlds, tutors and model refs
  start                     create a session (boots the server if needed)
  say <text>                send a learner turn and print the tutor's reply
  status                    turn counters and lifecycle for the session
  transcript                print the full public dialogue
  end                       finalize the session

Options
  --world <id>              world id, or "none" (default: transport default)
  --lab <id>                capability lab (default: ${DEFAULT_REMOTE_LAB})
  --tutor <ref>             tutor ref (default: ${DEFAULT_REMOTE_TUTOR})
  --model <ref>             model ref (default: ${DEFAULT_REMOTE_MODEL})
  --topic <text>            session topic
  --curriculum <id>         curriculum id (with --module)
  --module <id>             curriculum module id
  --session <id>            target a specific session instead of the saved one
  --port <n>                server port (default: ${DEFAULT_REMOTE_PORT})
  --base-url <url>          talk to an already-running server
  --timeout <ms>            step timeout (default: ${DEFAULT_STEP_TIMEOUT_MS})
  --no-autostart            fail instead of booting a server
  --stop-server             (end) also stop a server this script started
  --json                    machine-readable output

Slash commands are not available: the process-backed HTTP transport rejects
{"kind":"command"} with command_transport_unavailable by design.

Examples
  node scripts/tutor-stub-remote.js start --world world_001_nocturne
  node scripts/tutor-stub-remote.js say "I am ready to begin."
  node scripts/tutor-stub-remote.js end`;

async function runWorlds(base, args) {
  const payload = await request(base, 'GET', '/catalog');
  const catalog = payload.catalog || {};
  emit(args, catalog, () => {
    for (const key of ['labs', 'worlds', 'tutors']) {
      const entries = catalog[key] || [];
      console.log(`\n${key} (${entries.length}):`);
      for (const entry of entries) console.log(`  ${entry.id || entry.ref || entry}`);
    }
    const models = catalog.models || [];
    console.log(`\nmodels (${models.length}):`);
    for (const model of models) console.log(`  ${model.ref}${model.ref === DEFAULT_REMOTE_MODEL ? '  (default)' : ''}`);
    console.log(`\ndefaults: ${JSON.stringify(catalog.defaults || {})}`);
  });
}

async function runStart(base, args, env, server) {
  const specification = buildSessionSpecification(args);
  const payload = await request(base, 'POST', '/sessions', specification, DEFAULT_STEP_TIMEOUT_MS);
  const session = payload.session || {};
  writeRemoteState(
    {
      sessionId: session.sessionId,
      baseUrl: base,
      specification,
      serverPid: server.started ? server.pid : (readRemoteState(env)?.serverPid ?? null),
      startedAt: new Date().toISOString(),
    },
    env,
  );
  emit(args, { session, specification }, () => {
    console.log(`session ${session.sessionId} (${session.status})`);
    console.log(`  ${specification.lab} · ${specification.world ?? 'default world'} · ${specification.model}`);
    printDialogue(extractDialogue(session));
    console.log('\nNext: node scripts/tutor-stub-remote.js say "<your first learner turn>"');
  });
}

async function runSay(base, args, env) {
  const sessionId = requireSessionId(args, env);
  const input = args.positional.join(' ').trim();
  if (!input) throw new Error('say requires text: tutor-stub-remote.js say "your learner turn"');
  const timeout = args.timeout ? Number(args.timeout) : DEFAULT_STEP_TIMEOUT_MS;
  const payload = await request(
    base,
    'POST',
    `/sessions/${encodeURIComponent(sessionId)}/steps`,
    { input, kind: 'learner' },
    timeout,
  );
  emit(args, payload, () => {
    const tutor = payload.result?.turn?.tutor;
    if (tutor) console.log(`\n[TUTOR]\n${tutor}`);
    else printDialogue(extractDialogue(payload.session), { limit: 2 });
  });
}

async function runStatus(base, args, env) {
  const sessionId = requireSessionId(args, env);
  const payload = await request(base, 'GET', `/sessions/${encodeURIComponent(sessionId)}`);
  const session = payload.session || {};
  emit(args, session, () => {
    console.log(`session ${session.sessionId} (${session.status})`);
    console.log(`  turns: ${session.state?.turnCount ?? 0} · messages: ${session.state?.publicMessageCount ?? 0}`);
    console.log(`  world: ${session.state?.worldId ?? 'n/a'} · mode: ${session.state?.capabilityMode ?? 'n/a'}`);
    console.log(`  counters: ${JSON.stringify(session.counters || {})}`);
  });
}

async function runTranscript(base, args, env) {
  const sessionId = requireSessionId(args, env);
  const payload = await request(base, 'GET', `/sessions/${encodeURIComponent(sessionId)}`);
  const dialogue = extractDialogue(payload.session);
  emit(args, dialogue, () => {
    if (!dialogue.length) console.log('(no public dialogue yet)');
    else printDialogue(dialogue);
  });
}

async function runEnd(base, args, env) {
  const sessionId = requireSessionId(args, env);
  const state = readRemoteState(env);
  const payload = await request(base, 'POST', `/sessions/${encodeURIComponent(sessionId)}/finalize`, {
    reason: args.reason || 'remote_cli_end',
  });

  if (args.stopServer && state?.serverPid) {
    try {
      process.kill(state.serverPid);
    } catch {
      // A server that is already down needs no stopping.
    }
  }
  clearRemoteState(env);
  emit(args, payload, () => {
    console.log(`session ${sessionId} finalized`);
    if (args.stopServer && state?.serverPid) console.log(`stopped server pid ${state.serverPid}`);
  });
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseRemoteArgs(argv);
  if (args.subcommand === 'help') {
    console.log(USAGE);
    return 0;
  }

  const saved = readRemoteState(env);
  // An explicit --base-url/--port always wins; otherwise reuse whatever server
  // the saved session is actually running on.
  const explicitTarget = Boolean(args.baseUrl || args.port);
  const base = explicitTarget ? baseUrl(args, env) : saved?.baseUrl || baseUrl(args, env);

  // `worlds` and `start` may boot a server; the rest act on a live session and
  // should fail loudly rather than silently starting a second one.
  const server =
    args.subcommand === 'worlds' || args.subcommand === 'start'
      ? await ensureServer(base, args, env)
      : { started: false };
  if (server.started && !args.json) console.log(`[tutor-stub-remote] started server pid ${server.pid} at ${base}`);

  if (args.subcommand === 'worlds') await runWorlds(base, args);
  else if (args.subcommand === 'start') await runStart(base, args, env, server);
  else if (args.subcommand === 'say') await runSay(base, args, env);
  else if (args.subcommand === 'status') await runStatus(base, args, env);
  else if (args.subcommand === 'transcript') await runTranscript(base, args, env);
  else if (args.subcommand === 'end') await runEnd(base, args, env);
  return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(`[tutor-stub-remote] ${error.message}`);
    process.exitCode = 1;
  }
}
