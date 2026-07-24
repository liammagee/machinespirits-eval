import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  buildCliProviderEnv,
  CLI_PROVIDER_COMMON_ENV_KEYS,
  CLI_PROVIDER_ENV_KEYS,
  CLAUDE_CLI_ISOLATION_ARGS,
  normalizeModelCliProvider,
  resolveModelCliExecutable,
} from './cliProviderBridge.js';

const MODES = new Set([
  'one-shot-external',
  'persistent-text',
  'interactive-user-authorized',
  'agentic-batch-user-authorized',
]);
const EXTERNAL_TEXT_PROVIDERS = new Set(['agy', 'ollama']);
const DEFAULT_MAX_STDOUT_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_STDERR_BYTES = 1024 * 1024;

function uniqueArgs(args) {
  return Array.isArray(args) ? args.map((arg) => String(arg)) : [];
}

function addClaudeIsolation(args) {
  const next = [...args];
  for (let index = 0; index < CLAUDE_CLI_ISOLATION_ARGS.length; index += 1) {
    const flag = CLAUDE_CLI_ISOLATION_ARGS[index];
    if (next.includes(flag)) {
      if (flag === '--tools' && !next.includes('')) next.push('');
      continue;
    }
    next.push(flag);
    if (flag === '--tools') next.push('');
  }
  return next;
}

function policyArgs(provider, mode, args, allowTools) {
  if (mode === 'persistent-text') {
    if (provider !== 'claude-code') throw new Error('persistent-text mode is only supported for claude-code');
    if (allowTools) throw new Error('persistent-text model calls cannot enable tools');
    return addClaudeIsolation(args);
  }
  if (mode === 'one-shot-external') {
    if (!EXTERNAL_TEXT_PROVIDERS.has(provider)) {
      throw new Error(`one-shot-external mode does not support ${provider}`);
    }
    if (allowTools) throw new Error('one-shot external model calls cannot enable tools');
    if (provider === 'agy') {
      if (args.includes('--dangerously-skip-permissions')) {
        throw new Error('agy one-shot calls cannot bypass tool permissions');
      }
      return args.includes('--sandbox') ? args : [...args, '--sandbox'];
    }
    return args;
  }
  if (allowTools !== true) {
    throw new Error(`${mode} mode requires explicit allowTools: true authorization`);
  }
  return args;
}

function policyEnv(provider, sourceEnv, overrides = {}) {
  const env = buildCliProviderEnv(provider, sourceEnv);
  const allowed = new Set([...CLI_PROVIDER_COMMON_ENV_KEYS, ...(CLI_PROVIDER_ENV_KEYS[provider] || [])]);
  for (const [key, value] of Object.entries(overrides || {})) {
    if (!allowed.has(key)) throw new Error(`Environment key ${key} is not allowed for ${provider}`);
    if (value !== undefined && value !== null) env[key] = String(value);
  }
  return env;
}

function isolatedCwd(provider) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `ms-model-cli-${provider.replace(/[^a-z0-9]+/gu, '-')}-`));
}

export function createModelCliLaunchPlan({
  provider,
  command = null,
  args = [],
  mode,
  cwd = null,
  sourceEnv = process.env,
  envOverrides = {},
  allowTools = false,
} = {}) {
  const normalizedProvider = normalizeModelCliProvider(provider);
  if (!MODES.has(mode)) throw new Error(`Unknown model CLI launch mode: ${mode || 'missing'}`);
  const executable = resolveModelCliExecutable(normalizedProvider, command);
  const plannedArgs = policyArgs(normalizedProvider, mode, uniqueArgs(args), allowTools);
  const isolated = mode === 'one-shot-external' || mode === 'persistent-text';
  const launchCwd = isolated ? isolatedCwd(normalizedProvider) : path.resolve(cwd || process.cwd());
  if (!fs.existsSync(launchCwd) || !fs.statSync(launchCwd).isDirectory()) {
    throw new Error(`Model CLI working directory is not available for ${normalizedProvider}`);
  }
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (isolated) fs.rmSync(launchCwd, { recursive: true, force: true });
  };
  return {
    command: executable,
    args: plannedArgs,
    cwd: launchCwd,
    env: policyEnv(normalizedProvider, sourceEnv, envOverrides),
    cleanup,
    policy: Object.freeze({
      provider: normalizedProvider,
      mode,
      toolAuthority: allowTools ? 'explicit-user-authorized' : 'none',
      cwdIsolation: isolated ? 'fresh-temporary-directory' : 'explicit-caller-directory',
      environment: 'provider-allowlist',
    }),
  };
}

export function spawnModelCliProcess(options = {}) {
  const { spawnImpl = spawn, stdio = ['pipe', 'pipe', 'pipe'], ...planOptions } = options;
  const plan = createModelCliLaunchPlan(planOptions);
  let child;
  try {
    child = spawnImpl(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      stdio,
    });
  } catch (error) {
    plan.cleanup();
    throw error;
  }
  child.once?.('error', plan.cleanup);
  child.once?.('close', plan.cleanup);
  return { child, policy: plan.policy, cleanup: plan.cleanup };
}

function positiveLimit(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function callExternalModelCliText({
  provider,
  command = null,
  args = [],
  prompt,
  role = 'external-model-call',
  timeoutMs = 180_000,
  sourceEnv = process.env,
  envOverrides = {},
  spawnImpl = spawn,
  maxStdoutBytes,
  maxStderrBytes,
  promptTransport = 'stdin',
} = {}) {
  if (!['stdin', 'argument'].includes(promptTransport)) {
    throw new Error('Model CLI prompt transport must be stdin or argument');
  }
  const promptText = String(prompt || '');
  const launchArgs = promptTransport === 'argument' ? [...args, promptText] : args;
  const stdoutLimit = positiveLimit(maxStdoutBytes, DEFAULT_MAX_STDOUT_BYTES);
  const stderrLimit = positiveLimit(maxStderrBytes, DEFAULT_MAX_STDERR_BYTES);
  const startedAt = Date.now();
  const launch = spawnModelCliProcess({
    provider,
    command,
    args: launchArgs,
    mode: 'one-shot-external',
    sourceEnv,
    envOverrides,
    allowTools: false,
    spawnImpl,
  });
  const { child } = launch;
  return await new Promise((resolve, reject) => {
    let out = '';
    let outBytes = 0;
    let errBytes = 0;
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch (_) {
        /* already gone */
      }
      finish(reject, new Error(`${normalizeModelCliProvider(provider)} CLI timed out (role=${role})`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      outBytes += Buffer.byteLength(chunk);
      if (outBytes > stdoutLimit) {
        child.kill('SIGKILL');
        finish(reject, new Error(`${normalizeModelCliProvider(provider)} CLI stdout exceeded safety limit`));
        return;
      }
      out += chunk;
    });
    child.stderr.on('data', (chunk) => {
      errBytes += Buffer.byteLength(chunk);
      if (errBytes > stderrLimit) {
        child.kill('SIGKILL');
        finish(reject, new Error(`${normalizeModelCliProvider(provider)} CLI stderr exceeded safety limit`));
      }
    });
    child.on('error', (error) => {
      const launchError = new Error(`${normalizeModelCliProvider(provider)} CLI failed to start`);
      launchError.code = error?.code || 'MODEL_CLI_SPAWN_FAILED';
      finish(reject, launchError);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const exitError = new Error(`${normalizeModelCliProvider(provider)} CLI exited with code ${code}`);
        exitError.code = 'MODEL_CLI_EXIT_FAILED';
        exitError.exitCode = code;
        exitError.stdoutBytes = outBytes;
        exitError.stderrBytes = errBytes;
        finish(reject, exitError);
        return;
      }
      const text = out.trim();
      if (!text) {
        finish(reject, new Error(`${normalizeModelCliProvider(provider)} CLI produced no output (role=${role})`));
        return;
      }
      finish(resolve, {
        text,
        provider: normalizeModelCliProvider(provider),
        latencyMs: Date.now() - startedAt,
        policy: launch.policy,
      });
    });
    if (promptTransport === 'stdin') child.stdin.write(promptText);
    child.stdin.end();
  });
}
