#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_SURFACE_PRIVATE_PROJECTION_SCHEMA,
  assertTutorStubSurfaceAcceptanceContract,
  assertTutorStubSurfacePrivateProjection,
} from '../services/tutorStubSurfaceAcceptanceContract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(ROOT, 'fixtures', 'tutor-stub-surface-acceptance');
const DEFAULT_ARTIFACT_ROOT = path.join(ROOT, '.test-tmp', 'tutor-stub-surface-acceptance');

function parseArgs(argv) {
  const args = { host: null, artifactRoot: DEFAULT_ARTIFACT_ROOT, timeoutMs: 120_000 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--host') args.host = argv[++index] || null;
    else if (token === '--artifact-dir') args.artifactRoot = path.resolve(argv[++index] || args.artifactRoot);
    else if (token === '--timeout-ms') args.timeoutMs = Number(argv[++index] || args.timeoutMs);
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`unknown argument: ${token}`);
  }
  if (!args.help && !['web', 'packaged-electron'].includes(args.host)) {
    throw new Error('--host must be web or packaged-electron');
  }
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 10_000) {
    throw new Error('--timeout-ms must be an integer of at least 10000');
  }
  return args;
}

function usage() {
  return `Usage: node scripts/run-tutor-stub-surface-acceptance.mjs --host <web|packaged-electron> [--artifact-dir DIR] [--timeout-ms 120000]`;
}

function runDirectory(root, host) {
  const stamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
  return path.join(root, `${host}-${stamp}-${process.pid}`);
}

function appendLog(filePath, chunk) {
  fs.appendFileSync(filePath, chunk);
  process.stdout.write(chunk);
}

function spawnLogged(command, args, { cwd = ROOT, env, logPath, ipc = false } = {}) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ipc ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => appendLog(logPath, chunk));
  child.stderr?.on('data', (chunk) => appendLog(logPath, chunk));
  return child;
}

async function waitForExit(child, timeoutMs, label) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode || null };
  }
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    const [code, signal] = await Promise.race([once(child, 'exit'), timeout]);
    return { code, signal: signal || null };
  } finally {
    clearTimeout(timer);
  }
}

async function terminateChild(child, label) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  try {
    await waitForExit(child, 5_000, `${label} SIGTERM`);
  } catch {
    child.kill('SIGKILL');
    await waitForExit(child, 5_000, `${label} SIGKILL`);
  }
}

function copyFakeProvider(runtimeDir) {
  const binDir = path.join(runtimeDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const target = path.join(binDir, process.platform === 'win32' ? 'codex.cmd' : 'codex');
  fs.copyFileSync(path.join(FIXTURE_DIR, 'fake-codex.mjs'), target);
  if (process.platform !== 'win32') fs.chmodSync(target, 0o755);
  return binDir;
}

function acceptanceEnvironment(runDir) {
  const runtimeDir = path.join(runDir, 'runtime');
  const binDir = copyFakeProvider(runtimeDir);
  const privatePromptCanary = 'PRIVATE_ACCEPTANCE_PROMPT_CANARY_7f08a0';
  const credentialCanary = 'sk-acceptance-credential-canary-4c904b';
  const paths = {
    runtimeDir,
    providerLog: path.join(runDir, 'provider-events.jsonl'),
    result: path.join(runDir, 'result.json'),
  };
  fs.mkdirSync(path.join(runtimeDir, 'logs'), { recursive: true });
  const env = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    TUTOR_STUB_SURFACE_ACCEPTANCE: '1',
    TUTOR_STUB_ACCEPTANCE_ARTIFACT_DIR: runDir,
    TUTOR_STUB_ACCEPTANCE_RESULT: paths.result,
    TUTOR_STUB_ACCEPTANCE_EXPECTED_CONTRACT: path.join(FIXTURE_DIR, 'expected-contract.json'),
    TUTOR_STUB_ACCEPTANCE_USER_DATA: path.join(runtimeDir, 'electron-user-data'),
    ACCEPTANCE_PRIVATE_PROMPT_CANARY: privatePromptCanary,
    ACCEPTANCE_CREDENTIAL_CANARY: credentialCanary,
    OPENAI_API_KEY: credentialCanary,
    FAKE_CODEX_LOG: paths.providerLog,
    CLI_PROVIDER_CODEX_TIMEOUT_MS: '30000',
    NO_COLOR: '1',
    EVAL_DB_PATH: path.join(runtimeDir, 'evaluations.db'),
    EVAL_LOGS_DIR: path.join(runtimeDir, 'logs'),
    EVAL_EXPORTS_DIR: path.join(runtimeDir, 'exports'),
    AUTH_DB_PATH: path.join(runtimeDir, 'auth.db'),
    EVAL_WRITING_PAD_DIR: path.join(runtimeDir, 'writing-pads'),
    TUTOR_CORE_LOG_DIR: path.join(runtimeDir, 'tutor-core-logs'),
    GREENROOM_DIR: path.join(runtimeDir, 'greenroom'),
    TUTOR_STUB_TUNING_DIR: path.join(runtimeDir, 'tuning'),
    TUTOR_STUB_TRACE_DIR: path.join(runtimeDir, 'traces'),
  };
  return { env, paths, privatePromptCanary, credentialCanary };
}

async function startWebServer(env, logPath) {
  const child = spawnLogged(process.execPath, [path.join(ROOT, 'scripts', 'tutor-stub-acceptance-server.mjs')], {
    env,
    logPath,
    ipc: true,
  });
  const ready = new Promise((resolve, reject) => {
    child.on('message', (message) => {
      if (message?.type === 'listening') resolve(message.baseUrl);
      if (message?.type === 'fatal') reject(new Error(message.error));
    });
    child.once('exit', (code, signal) => {
      reject(new Error(`acceptance web server exited before readiness (code ${code}, signal ${signal || 'none'})`));
    });
  });
  try {
    return { child, baseUrl: await ready };
  } catch (error) {
    await terminateChild(child, 'unready acceptance web server');
    throw error;
  }
}

async function stopWebServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return false;
  child.send({ type: 'shutdown' });
  const result = await waitForExit(child, 8_000, 'acceptance web server shutdown');
  return result.code === 0 && result.signal === null;
}

function packagedExecutable() {
  const output = path.join(ROOT, 'dist-desktop');
  if (process.platform === 'darwin') {
    for (const directory of fs.existsSync(output) ? fs.readdirSync(output).sort() : []) {
      if (!directory.startsWith('mac')) continue;
      const candidate = path.join(output, directory, 'Scriptorium.app', 'Contents', 'MacOS', 'Scriptorium');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  const candidates = [
    path.join(output, 'linux-unpacked', 'scriptorium'),
    path.join(output, 'win-unpacked', 'Scriptorium.exe'),
  ];
  const candidate = candidates.find((entry) => fs.existsSync(entry));
  if (candidate) return candidate;
  throw new Error('packaged Scriptorium executable not found; run npm run desktop:pack first');
}

function readProviderEvents(providerLog) {
  if (!fs.existsSync(providerLog)) return [];
  return fs
    .readFileSync(providerLog, 'utf8')
    .split(/\r?\n/gu)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function privateProjection(events, { privatePromptCanary }) {
  const started = events.filter((event) => event.event === 'request_started');
  const completed = events.filter((event) => event.event === 'request_completed');
  const completedStart = started.find((event) => event.requestId === 'completed-turn');
  const delayedStart = started.find((event) => event.requestId === 'delayed-turn');
  const projection = {
    schema: TUTOR_STUB_SURFACE_PRIVATE_PROJECTION_SCHEMA,
    providerRequestsStarted: started.length,
    providerRequestsCompleted: completed.length,
    providerPromptObserved: /Can we compare the public assay marks\?/u.test(completedStart?.input || ''),
    privateCanaryObserved: started.every((event) => event.privateCanary === privatePromptCanary),
    credentialCanaryObserved: started.every((event) => event.credentialCanaryObserved === true),
    completedReplyObserved: completed.some(
      (event) =>
        event.requestId === 'completed-turn' &&
        event.response === 'Acceptance tutor reply: compare the two public marks.',
    ),
    delayedRequestObserved: Boolean(delayedStart?.delayed && /ACCEPTANCE_DELAY/u.test(delayedStart.input || '')),
    delayedCompletionAbsent: !completed.some((event) => event.requestId === 'delayed-turn'),
  };
  return assertTutorStubSurfacePrivateProjection(projection);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const startedAt = Date.now();
  const runDir = runDirectory(args.artifactRoot, args.host);
  fs.mkdirSync(runDir, { recursive: true });
  const expectedContract = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'expected-contract.json'), 'utf8'));
  const { env, paths, privatePromptCanary } = acceptanceEnvironment(runDir);
  const hostLog = path.join(runDir, `${args.host}.log`);
  let serverChild = null;
  let hostChild = null;
  let serverShutdownGraceful = null;

  try {
    if (args.host === 'web') {
      const server = await startWebServer(env, hostLog);
      serverChild = server.child;
      const electron = path.join(ROOT, 'desktop', 'node_modules', '.bin', 'electron');
      if (!fs.existsSync(electron)) throw new Error('desktop Electron runtime missing; run npm run desktop:install');
      hostChild = spawnLogged(electron, [path.join(ROOT, 'desktop', 'tutorStubAcceptanceRunner.mjs')], {
        env: { ...env, TUTOR_STUB_ACCEPTANCE_BASE_URL: server.baseUrl },
        logPath: hostLog,
      });
    } else {
      hostChild = spawnLogged(packagedExecutable(), [], {
        env: { ...env, MS_TUTOR_STUB_ACCEPTANCE: '1', MS_DESKTOP_TOKEN: '1', MS_HOME: '/tutor' },
        logPath: hostLog,
      });
    }

    const hostExit = await waitForExit(hostChild, args.timeoutMs, `${args.host} acceptance host`);
    if (args.host === 'web') {
      serverShutdownGraceful = await stopWebServer(serverChild);
      serverChild = null;
    } else {
      serverShutdownGraceful = true;
    }
    if (hostExit.code !== 0 || hostExit.signal !== null) {
      throw new Error(`acceptance host failed: ${JSON.stringify(hostExit)}`);
    }
    if (!serverShutdownGraceful) throw new Error('acceptance server did not shut down gracefully');
    if (!fs.existsSync(paths.result)) throw new Error('acceptance host did not write result.json');

    const result = assertTutorStubSurfaceAcceptanceContract(
      JSON.parse(fs.readFileSync(paths.result, 'utf8')),
      expectedContract,
    );
    const providerEvents = readProviderEvents(paths.providerLog);
    result.privateProjection = privateProjection(providerEvents, { privatePromptCanary });
    result.runtime = {
      elapsedMs: Date.now() - startedAt,
      hostExit,
      serverShutdownGraceful,
      paidModelCalls: 0,
    };
    fs.writeFileSync(paths.result, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(`\nPASS ${args.host} tutor-stub surface acceptance`);
    console.log(`artifacts: ${path.relative(ROOT, runDir)}`);
  } catch (error) {
    await terminateChild(hostChild, `${args.host} host`);
    await terminateChild(serverChild, 'web server');
    fs.writeFileSync(
      path.join(runDir, 'orchestrator-failure.json'),
      `${JSON.stringify({ error: error?.stack || String(error), elapsedMs: Date.now() - startedAt }, null, 2)}\n`,
      'utf8',
    );
    console.error(`\nFAIL ${args.host} tutor-stub surface acceptance`);
    console.error(error?.stack || String(error));
    console.error(`artifacts: ${path.relative(ROOT, runDir)}`);
    process.exitCode = 1;
  }
}

void main();
