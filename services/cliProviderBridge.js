import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function positiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_CLAUDE_TIMEOUT_MS = positiveIntEnv(
  'CLI_PROVIDER_CLAUDE_TIMEOUT_MS',
  positiveIntEnv('ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS', 180_000),
);
const DEFAULT_CODEX_TIMEOUT_MS = positiveIntEnv(
  'CLI_PROVIDER_CODEX_TIMEOUT_MS',
  positiveIntEnv('ID_DIRECTOR_CODEX_CLI_TIMEOUT_MS', 300_000),
);
const CLI_PROVIDERS = new Set(['claude-code', 'codex']);
const CLI_EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'config']);

export function normalizeCliEffort(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (!CLI_EFFORT_LEVELS.has(normalized)) {
    throw new Error(`CLI effort must be low|medium|high|xhigh|max|config (got ${value})`);
  }
  return normalized;
}

export function resolveCliEffort(provider, explicitEffort = null) {
  const normalizedProvider = String(provider || '').trim();
  if (!isCliProvider(normalizedProvider)) return null;
  const explicit = normalizeCliEffort(explicitEffort);
  if (explicit) return explicit;
  if (normalizedProvider === 'codex') {
    return normalizeCliEffort(
      process.env.CLI_PROVIDER_CODEX_EFFORT || process.env.CLI_PROVIDER_EFFORT || process.env.CODEX_REASONING_EFFORT || 'xhigh',
    );
  }
  if (normalizedProvider === 'claude-code') {
    return normalizeCliEffort(
      process.env.CLI_PROVIDER_CLAUDE_EFFORT ||
        process.env.CLI_PROVIDER_EFFORT ||
        process.env.CLAUDE_CODE_EFFORT ||
        process.env.CLAUDE_EFFORT ||
        null,
    );
  }
  return null;
}

export function isCliProvider(provider) {
  return CLI_PROVIDERS.has(provider);
}

export function cliAwareProviderConfig(provider, providerConfig) {
  if (!isCliProvider(provider)) return providerConfig;
  return {
    ...(providerConfig || {}),
    isConfigured: true,
    apiKey: '',
  };
}

export function isProviderConfigured(provider, providerConfig) {
  return isCliProvider(provider) || Boolean(providerConfig?.isConfigured);
}

function buildCliUserText(userPrompt, messageHistory) {
  let userText = '';
  if (Array.isArray(messageHistory) && messageHistory.length > 0) {
    const transcript = messageHistory.map((m) => `${m.role || 'user'}: ${m.content || ''}`).join('\n\n');
    userText += `Conversation so far:\n${transcript}\n\n`;
  }
  userText += `Latest message:\n${userPrompt}`;
  return userText;
}

async function callClaudeCli({ systemPrompt, userPrompt, model, role, messageHistory, timeoutMs, effort }) {
  const userText = buildCliUserText(userPrompt, messageHistory);
  const start = Date.now();
  const effectiveTimeout = timeoutMs || DEFAULT_CLAUDE_TIMEOUT_MS;
  const effectiveEffort = resolveCliEffort('claude-code', effort);

  return await new Promise((resolve, reject) => {
    const args = ['-p', '-', '--output-format', 'text', '--system-prompt', systemPrompt];
    if (model) args.push('--model', model);
    if (effectiveEffort && effectiveEffort !== 'config') args.push('--effort', effectiveEffort);
    const env = { ...process.env };
    delete env.CLAUDE_CODE;
    delete env.CLAUDECODE;
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let out = '';
    let err = '';
    const cliTimeout = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch (_) {
        /* already gone */
      }
      reject(new Error(`claude CLI timed out after ${effectiveTimeout}ms (role=${role})`));
    }, effectiveTimeout);
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', (e) => {
      clearTimeout(cliTimeout);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(cliTimeout);
      if (code !== 0) {
        reject(new Error(err.trim() || out.trim() || `claude CLI exited with code ${code} (role=${role})`));
      } else {
        resolve({
          text: out.trim(),
          model: model || 'claude-cli',
          provider: 'claude-code',
          effort: effectiveEffort || null,
          latencyMs: Date.now() - start,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        });
      }
    });
    child.stdin.write(userText);
    child.stdin.end();
  });
}

async function callCodexCli({ systemPrompt, userPrompt, model, role, messageHistory, timeoutMs, effort }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-cli-provider-codex-'));
  const outFile = path.join(tmpDir, 'last-message.txt');
  const start = Date.now();
  const effectiveTimeout = timeoutMs || DEFAULT_CODEX_TIMEOUT_MS;
  const effectiveEffort = resolveCliEffort('codex', effort);
  const prompt = [
    'System prompt for this role:',
    systemPrompt,
    '',
    'User input for this turn:',
    buildCliUserText(userPrompt, messageHistory),
  ].join('\n');

  try {
    return await new Promise((resolve, reject) => {
      const args = [
        'exec',
        '--skip-git-repo-check',
        '--ephemeral',
        '--ignore-user-config',
        '-s',
        'read-only',
        '-C',
        tmpDir,
        '--color',
        'never',
      ];
      if (effectiveEffort && effectiveEffort !== 'config') {
        args.push('-c', `model_reasoning_effort="${effectiveEffort}"`);
      }
      if (model && model !== 'auto') args.push('-m', model);
      args.push('-o', outFile, '-');

      const child = spawn('codex', args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpDir });
      let err = '';
      const cliTimeout = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (_) {
          /* already gone */
        }
        reject(new Error(`codex CLI timed out after ${effectiveTimeout}ms (role=${role})`));
      }, effectiveTimeout);
      child.stderr.on('data', (d) => {
        err += d;
      });
      child.stdout.on('data', () => {});
      child.on('error', (e) => {
        clearTimeout(cliTimeout);
        reject(e);
      });
      child.on('close', (code) => {
        clearTimeout(cliTimeout);
        if (code !== 0) {
          reject(new Error(err.trim() || `codex CLI exited with code ${code} (role=${role})`));
          return;
        }

        const text = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim() : '';
        if (!text) {
          reject(new Error(`codex CLI produced no output message (role=${role})`));
          return;
        }
        resolve({
          text,
          model: model || 'codex-cli',
          provider: 'codex',
          effort: effectiveEffort || null,
          reasoningEffort: effectiveEffort || null,
          latencyMs: Date.now() - start,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        });
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function callAIWithCliBridge(agentConfig, systemPrompt, userPrompt, role, opts = {}) {
  if (agentConfig?.provider === 'claude-code') {
    return await callClaudeCli({
      systemPrompt,
      userPrompt,
      model: agentConfig.model,
      role,
      messageHistory: opts?.messageHistory,
      timeoutMs: opts?.timeoutMs,
      effort: opts?.effort,
    });
  }
  if (agentConfig?.provider === 'codex') {
    return await callCodexCli({
      systemPrompt,
      userPrompt,
      model: agentConfig.model,
      role,
      messageHistory: opts?.messageHistory,
      timeoutMs: opts?.timeoutMs,
      effort: opts?.effort,
    });
  }
  if (!opts?.fallbackCallAI) {
    throw new Error(`No fallback AI caller supplied for provider ${agentConfig?.provider || 'unknown'}`);
  }
  return await opts.fallbackCallAI(agentConfig, systemPrompt, userPrompt, role, opts);
}
