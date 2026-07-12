import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { recordExternalApiCall } from './apiPayloadCapture.js';

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
      process.env.CLI_PROVIDER_CODEX_EFFORT ||
        process.env.CLI_PROVIDER_EFFORT ||
        process.env.CODEX_REASONING_EFFORT ||
        'xhigh',
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

export function createCodexJsonlEventParser(onEvent = null) {
  let buffer = '';
  const events = [];
  const invalidLines = [];

  const consumeLine = (rawLine) => {
    const line = String(rawLine || '').trim();
    if (!line) return;
    try {
      const event = JSON.parse(line);
      events.push(event);
      try {
        onEvent?.(event);
      } catch (_) {
        /* A display callback must never fail the model call. */
      }
    } catch (_) {
      invalidLines.push(line);
    }
  };

  return {
    events,
    invalidLines,
    push(chunk) {
      buffer += String(chunk || '');
      const lines = buffer.split(/\r?\n/u);
      buffer = lines.pop() || '';
      for (const line of lines) consumeLine(line);
    },
    end() {
      consumeLine(buffer);
      buffer = '';
      return { events, invalidLines };
    },
  };
}

export function codexFinalMessageFromEvents(events = []) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index] || {};
    const item = event.item || {};
    const text =
      (item.type === 'agent_message' && item.text) ||
      (event.type === 'agent_message' && (event.text || event.message)) ||
      event.final_output ||
      null;
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return '';
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

function abortError(role) {
  const error = new Error(`CLI model call aborted (role=${role})`);
  error.name = 'AbortError';
  return error;
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

async function callCodexCli({
  systemPrompt,
  userPrompt,
  model,
  role,
  messageHistory,
  timeoutMs,
  effort,
  onEvent,
  signal,
}) {
  if (signal?.aborted) throw abortError(role);
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
        '--json',
      ];
      if (effectiveEffort && effectiveEffort !== 'config') {
        args.push('-c', `model_reasoning_effort="${effectiveEffort}"`);
      }
      if (model && model !== 'auto') args.push('-m', model);
      args.push('-o', outFile, '-');

      const child = spawn('codex', args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpDir });
      let err = '';
      let stdout = '';
      const jsonl = createCodexJsonlEventParser(onEvent);
      const onAbort = () => {
        try {
          child.kill('SIGKILL');
        } catch (_) {
          /* already gone */
        }
        reject(abortError(role));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
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
      child.stdout.on('data', (data) => {
        const chunk = String(data || '');
        stdout += chunk;
        jsonl.push(chunk);
      });
      child.on('error', (e) => {
        clearTimeout(cliTimeout);
        signal?.removeEventListener('abort', onAbort);
        reject(e);
      });
      child.on('close', (code) => {
        clearTimeout(cliTimeout);
        signal?.removeEventListener('abort', onAbort);
        const parsedStream = jsonl.end();
        if (code !== 0) {
          reject(new Error(err.trim() || stdout.trim() || `codex CLI exited with code ${code} (role=${role})`));
          return;
        }

        const fileText = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim() : '';
        const eventText = codexFinalMessageFromEvents(parsedStream.events);
        const text = fileText || eventText;
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
          streamedEvents: parsedStream.events.length,
          invalidStreamLines: parsedStream.invalidLines.length,
          outputSource: fileText ? 'output_file' : 'jsonl_event_fallback',
        });
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Split a provider-shaped messages array (OpenAI-style {role, content})
 * into the (systemPrompt, userPrompt, messageHistory) triple the CLI
 * call functions expect. System-role messages are folded into the system
 * prompt (deduped against an explicitly-passed one — tutor-core's
 * _callAIOnce sends the same system text both ways); the last non-system
 * message becomes the user prompt; the rest become history.
 *
 * @param {Array} messages - Provider-shaped message array
 * @param {string} [systemPrompt] - Separately-passed system prompt
 * @returns {{systemPrompt: string, userPrompt: string, messageHistory: Array}}
 */
export function splitProviderMessages(messages, systemPrompt = '') {
  const systemParts = systemPrompt ? [systemPrompt] : [];
  const rest = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== 'object') continue;
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '');
    if (m.role === 'system') {
      if (content && !systemParts.includes(content)) systemParts.push(content);
    } else {
      rest.push({ role: m.role || 'user', content });
    }
  }
  const last = rest.length > 0 ? rest[rest.length - 1] : null;
  return {
    systemPrompt: systemParts.join('\n\n'),
    userPrompt: last ? last.content : '',
    messageHistory: rest.slice(0, -1),
  };
}

/**
 * Build a tutor-core external-AI-provider hook backed by this CLI bridge.
 *
 * Registered from the eval side via tutor-core's setExternalAIProviderHook()
 * (see services/evaluationRunner.js), which extends CLI providers
 * (codex / claude-code) into tutor-core's dialogue engine — the callAI
 * standard loop AND the unified/aiService dialectical layer — without
 * tutor-core importing any eval code.
 *
 * Every call is also pushed through apiPayloadCapture's external-record
 * channel so dialogue-log apiPayload entries (and payload-grep delivery
 * verification) keep working on the CLI path, where the fetch wrapper
 * sees nothing.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.callCli] - Injection point for tests (defaults to
 *   the real callAIWithCliBridge; same signature)
 * @param {Function} [opts.recordCall] - Injection point for tests (defaults
 *   to apiPayloadCapture.recordExternalApiCall)
 * @returns {{handles: Function, call: Function}}
 */
export function buildCliProviderHook({ callCli = callAIWithCliBridge, recordCall = recordExternalApiCall } = {}) {
  return {
    handles: (provider) => isCliProvider(provider),
    call: async (request = {}) => {
      const { provider, model, channel } = request;
      const split = splitProviderMessages(request.messages, request.systemPrompt);
      const started = Date.now();
      const requestBody = {
        model,
        provider,
        channel: channel || null,
        systemPrompt: split.systemPrompt,
        messages: [...split.messageHistory, ...(split.userPrompt ? [{ role: 'user', content: split.userPrompt }] : [])],
      };
      try {
        const result = await callCli(
          { provider, model },
          split.systemPrompt,
          split.userPrompt,
          `dialogue-engine:${channel || 'unknown'}`,
          { messageHistory: split.messageHistory.length > 0 ? split.messageHistory : undefined },
        );
        recordCall({
          provider,
          requestBody,
          responseBody: { text: result?.text ?? '', model: result?.model || model },
          durationMs: Date.now() - started,
        });
        return result;
      } catch (error) {
        recordCall({
          provider,
          requestBody,
          durationMs: Date.now() - started,
          error,
        });
        throw error;
      }
    },
  };
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
      onEvent: opts?.onEvent,
      signal: opts?.signal,
    });
  }
  if (!opts?.fallbackCallAI) {
    throw new Error(`No fallback AI caller supplied for provider ${agentConfig?.provider || 'unknown'}`);
  }
  return await opts.fallbackCallAI(agentConfig, systemPrompt, userPrompt, role, opts);
}
