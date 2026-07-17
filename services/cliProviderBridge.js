import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { recordExternalApiCall } from './apiPayloadCapture.js';
import { normalizeTokenUsage } from './tokenUsage.js';

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
let cachedCodexCliVersion;

function codexCliVersion({ enabled = true } = {}) {
  if (!enabled) return null;
  if (cachedCodexCliVersion !== undefined) return cachedCodexCliVersion;
  const result = spawnSync('codex', ['--version'], { encoding: 'utf8' });
  cachedCodexCliVersion = result.status === 0 ? String(result.stdout || '').trim() || null : null;
  return cachedCodexCliVersion;
}

// Ambient-context isolation for `claude` CLI subprocess calls.
//
// `--system-prompt` only replaces the system prompt TEXT — it does not stop
// the CLI from loading ambient customizations (CLAUDE.md, skills, plugins,
// hooks, MCP servers) resolved from the spawn cwd and user config. Measured
// 2026-07-17: from the repo cwd that layer injected ~16k prompt tokens of
// project context — research hypotheses and standing directives included —
// into every call, and a direct probe quoted CLAUDE.md verbatim. For an eval
// instrument that is contamination (sharpest on the judge: closed-loop
// scoring tell).
//
// `--safe-mode` starts the CLI with all customizations disabled;
// `--no-session-persistence` keeps eval calls out of on-disk session
// history; `--tools ''` removes the built-in agentic toolset (bridge calls
// are pure text generation — a judge or ego must never run tools mid-call).
// Spawning from an empty temp cwd is defense in depth, mirroring the codex
// path (which was always isolated: --ephemeral --ignore-user-config
// --ignore-rules + tmp cwd).
//
// Instrument boundary: runs generated before this change saw the ambient
// context on claude-code calls; runs after do not. CLAUDE_CLI_CONTEXT_ISOLATION
// is stamped into run metadata (evaluationRunner createRun) and onto each
// bridge result so pre/post rows stay distinguishable. Within-run
// comparability is unaffected.
export const CLAUDE_CLI_CONTEXT_ISOLATION = 'safe-mode-v1';
export const CLAUDE_CLI_ISOLATION_ARGS = Object.freeze(['--safe-mode', '--no-session-persistence', '--tools', '']);

/**
 * Per-call isolation bundle for spawning `claude`: the shared flag set plus
 * a fresh empty cwd. Callers spread `args`, spawn with `cwd`, and call
 * `cleanup()` once the call settles.
 */
export function claudeCliIsolation() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-claude-cli-'));
  return {
    args: [...CLAUDE_CLI_ISOLATION_ARGS],
    cwd,
    cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }),
  };
}

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

export function codexUsageFromEvents(events = []) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index] || {};
    const usage = event.usage || event.metrics?.usage || null;
    if (!usage || typeof usage !== 'object') continue;
    const normalized = normalizeTokenUsage(usage);
    if (normalized.tokenUsageAvailable) return normalized;
  }
  return null;
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

export function buildCodexCliPromptText({
  systemPrompt = '',
  userPrompt = '',
  messageHistory = [],
  structuredOutput = false,
} = {}) {
  const prompt = [
    'System prompt for this role:',
    systemPrompt,
    '',
    'User input for this turn:',
    buildCliUserText(userPrompt, messageHistory),
  ].join('\n');
  return structuredOutput
    ? `${prompt}\n\nThis is a no-tools structured-output call. Do not run commands, inspect files, browse, call tools, or take any action beyond returning the requested JSON object.`
    : prompt;
}

function abortError(role) {
  const error = new Error(`CLI model call aborted (role=${role})`);
  error.name = 'AbortError';
  return error;
}

function normalizedOutputSchema(outputSchema) {
  if (outputSchema === null || outputSchema === undefined) return null;
  if (!outputSchema || typeof outputSchema !== 'object' || Array.isArray(outputSchema)) {
    throw new Error('CLI output schema must be a JSON object');
  }
  try {
    return JSON.parse(JSON.stringify(outputSchema));
  } catch (error) {
    throw new Error(`CLI output schema must be JSON serializable: ${error.message}`);
  }
}

function cliModelAttestationBasis(model) {
  return model ? 'explicit_cli_model_argument_accepted_bridge_echo' : 'cli_default_not_independently_attested';
}

const ALLOWED_STRUCTURED_CODEX_EVENT_TYPES = new Set([
  'thread.started',
  'turn.started',
  'item.started',
  'item.updated',
  'item.completed',
  'turn.completed',
]);
const ALLOWED_STRUCTURED_CODEX_ITEM_TYPES = new Set(['agent_message', 'reasoning']);

function auditCodexStructuredEvents(events = [], { strict = false, invalidLines = 0 } = {}) {
  const eventTypeCounts = {};
  const itemTypeCounts = {};
  const prohibited = [];
  for (const [index, event] of events.entries()) {
    const eventType = String(event?.type || 'unknown');
    const itemType = String(event?.item?.type || '');
    eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
    if (itemType) itemTypeCounts[itemType] = (itemTypeCounts[itemType] || 0) + 1;
    if (
      strict &&
      (!ALLOWED_STRUCTURED_CODEX_EVENT_TYPES.has(eventType) ||
        (itemType && !ALLOWED_STRUCTURED_CODEX_ITEM_TYPES.has(itemType)))
    ) {
      prohibited.push({ index, event_type: eventType, item_type: itemType || null });
    }
  }
  if (strict && Number(invalidLines) > 0) {
    prohibited.push({ index: null, event_type: 'invalid_jsonl', item_type: null, count: Number(invalidLines) });
  }
  return {
    event_type_counts: eventTypeCounts,
    item_type_counts: itemTypeCounts,
    prohibited_event_count: prohibited.length,
    prohibited_events: prohibited,
    invalid_jsonl_line_count: Number(invalidLines),
    policy: strict ? 'strict_no_tools_allowlist' : 'observational_only',
  };
}

async function callClaudeCli({
  systemPrompt,
  userPrompt,
  model,
  role,
  messageHistory,
  timeoutMs,
  effort,
  outputSchema,
  signal,
  spawnImpl = spawn,
}) {
  if (signal?.aborted) throw abortError(role);
  const userText = buildCliUserText(userPrompt, messageHistory);
  const start = Date.now();
  const effectiveTimeout = timeoutMs || DEFAULT_CLAUDE_TIMEOUT_MS;
  const effectiveEffort = resolveCliEffort('claude-code', effort);
  const schema = normalizedOutputSchema(outputSchema);

  // Every claude call — schema or not — runs context-isolated (see
  // CLAUDE_CLI_ISOLATION_ARGS above). Before 2026-07-17 only outputSchema
  // calls were isolated; plain-text calls inherited the repo cwd's ambient
  // project context.
  const isolation = claudeCliIsolation();
  try {
    return await new Promise((resolve, reject) => {
      const args = ['-p', '-', '--output-format', 'text', '--system-prompt', systemPrompt, ...isolation.args];
      if (model) args.push('--model', model);
      if (effectiveEffort && effectiveEffort !== 'config') args.push('--effort', effectiveEffort);
      if (schema) {
        args.push('--json-schema', JSON.stringify(schema));
      }
      const env = { ...process.env };
      delete env.CLAUDE_CODE;
      delete env.CLAUDECODE;
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;
      const child = spawnImpl('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], env, cwd: isolation.cwd });
      let out = '';
      let err = '';
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
        signal?.removeEventListener('abort', onAbort);
        reject(e);
      });
      child.on('close', (code) => {
        clearTimeout(cliTimeout);
        signal?.removeEventListener('abort', onAbort);
        if (code !== 0) {
          reject(new Error(err.trim() || out.trim() || `claude CLI exited with code ${code} (role=${role})`));
        } else {
          resolve({
            text: out.trim(),
            model: model || 'claude-cli',
            provider: 'claude-code',
            effort: effectiveEffort || null,
            latencyMs: Date.now() - start,
            ...normalizeTokenUsage(null),
            cost: 0,
            structuredOutput: Boolean(schema),
            contextIsolation: CLAUDE_CLI_CONTEXT_ISOLATION,
            structuredEventAudit: {
              event_type_counts: {},
              item_type_counts: {},
              prohibited_event_count: 0,
              prohibited_events: [],
              enforcement: 'claude_tools_disabled',
            },
            prohibitedToolEventCount: 0,
            modelAttestationBasis: cliModelAttestationBasis(model),
            modelIndependentlyAttested: false,
          });
        }
      });
      child.stdin.write(userText);
      child.stdin.end();
    });
  } finally {
    isolation.cleanup();
  }
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
  outputSchema,
  developmentModelInstructionsFile,
  allowDevelopmentBaseInstructionsOverride = false,
  modelInstructionsSource = null,
  spawnImpl = spawn,
}) {
  if (signal?.aborted) throw abortError(role);
  let replacementInstructionsSourceFile = null;
  let replacementInstructionsBytes = null;
  let replacementInstructionsSha256 = null;
  if (
    developmentModelInstructionsFile !== undefined &&
    developmentModelInstructionsFile !== null &&
    developmentModelInstructionsFile !== ''
  ) {
    if (allowDevelopmentBaseInstructionsOverride !== true) {
      throw new Error('Codex base-instructions replacement requires the explicit development-only capability');
    }
    replacementInstructionsSourceFile = path.resolve(String(developmentModelInstructionsFile));
    let stat = null;
    try {
      stat = fs.statSync(replacementInstructionsSourceFile);
    } catch {
      throw new Error(`Codex model instructions file does not exist: ${replacementInstructionsSourceFile}`);
    }
    if (!stat.isFile()) {
      throw new Error(`Codex model instructions path must be a file: ${replacementInstructionsSourceFile}`);
    }
    replacementInstructionsBytes = fs.readFileSync(replacementInstructionsSourceFile);
    replacementInstructionsSha256 = createHash('sha256').update(replacementInstructionsBytes).digest('hex');
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-cli-provider-codex-'));
  const outFile = path.join(tmpDir, 'last-message.txt');
  const start = Date.now();
  const effectiveTimeout = timeoutMs || DEFAULT_CODEX_TIMEOUT_MS;
  const effectiveEffort = resolveCliEffort('codex', effort);
  const schema = normalizedOutputSchema(outputSchema);
  const schemaFile = schema ? path.join(tmpDir, 'output-schema.json') : null;
  if (schemaFile) fs.writeFileSync(schemaFile, `${JSON.stringify(schema, null, 2)}\n`, { mode: 0o600 });
  const replacementInstructionsFile = replacementInstructionsBytes ? path.join(tmpDir, 'model-instructions.md') : null;
  if (replacementInstructionsFile) {
    fs.writeFileSync(replacementInstructionsFile, replacementInstructionsBytes, { mode: 0o600 });
  }
  const prompt = buildCodexCliPromptText({
    systemPrompt,
    userPrompt,
    messageHistory,
    structuredOutput: Boolean(schema),
  });

  try {
    return await new Promise((resolve, reject) => {
      const args = [
        'exec',
        '--skip-git-repo-check',
        '--ephemeral',
        '--ignore-user-config',
        '--ignore-rules',
        '-s',
        'read-only',
        '-C',
        tmpDir,
        '--color',
        'never',
        '--json',
      ];
      if (replacementInstructionsFile) args.splice(1, 0, '--strict-config');
      if (effectiveEffort && effectiveEffort !== 'config') {
        args.push('-c', `model_reasoning_effort="${effectiveEffort}"`);
      }
      if (replacementInstructionsFile) {
        args.push('-c', `model_instructions_file=${JSON.stringify(replacementInstructionsFile)}`);
      }
      if (model && model !== 'auto') args.push('-m', model);
      if (schemaFile) args.push('--output-schema', schemaFile);
      args.push('-o', outFile, '-');

      const child = spawnImpl('codex', args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpDir });
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
        const eventAudit = auditCodexStructuredEvents(parsedStream.events, {
          strict: Boolean(schema),
          invalidLines: parsedStream.invalidLines.length,
        });
        if (code !== 0) {
          reject(new Error(err.trim() || stdout.trim() || `codex CLI exited with code ${code} (role=${role})`));
          return;
        }

        const fileText = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim() : '';
        const eventText = codexFinalMessageFromEvents(parsedStream.events);
        const tokenUsage = codexUsageFromEvents(parsedStream.events);
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
          ...(tokenUsage || normalizeTokenUsage(null)),
          cost: 0,
          streamedEvents: parsedStream.events.length,
          streamEventTypeCounts: Object.fromEntries(
            [...new Set(parsedStream.events.map((event) => String(event?.type || 'unknown')))]
              .sort()
              .map((type) => [
                type,
                parsedStream.events.filter((event) => String(event?.type || 'unknown') === type).length,
              ]),
          ),
          streamItemTypeCounts: Object.fromEntries(
            [...new Set(parsedStream.events.map((event) => String(event?.item?.type || 'none')))]
              .sort()
              .map((type) => [
                type,
                parsedStream.events.filter((event) => String(event?.item?.type || 'none') === type).length,
              ]),
          ),
          invalidStreamLines: parsedStream.invalidLines.length,
          outputSource: fileText ? 'output_file' : 'jsonl_event_fallback',
          structuredOutput: Boolean(schema),
          structuredEventAudit: eventAudit,
          prohibitedToolEventCount: eventAudit.prohibited_event_count,
          modelAttestationBasis: cliModelAttestationBasis(model),
          modelIndependentlyAttested: false,
          baseInstructionsMode: replacementInstructionsFile ? 'replacement_file' : 'codex_default',
          modelInstructionsSource: replacementInstructionsFile ? modelInstructionsSource : null,
          modelInstructionsSha256: replacementInstructionsSha256,
          modelInstructionsBytes: replacementInstructionsBytes?.length ?? null,
          codexCliVersion: codexCliVersion({ enabled: spawnImpl === spawn }),
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
      outputSchema: opts?.outputSchema,
      signal: opts?.signal,
      spawnImpl: opts?.spawnImpl,
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
      outputSchema: opts?.outputSchema,
      developmentModelInstructionsFile: opts?.developmentModelInstructionsFile,
      allowDevelopmentBaseInstructionsOverride: opts?.allowDevelopmentBaseInstructionsOverride,
      modelInstructionsSource: opts?.modelInstructionsSource,
      spawnImpl: opts?.spawnImpl,
    });
  }
  if (!opts?.fallbackCallAI) {
    throw new Error(`No fallback AI caller supplied for provider ${agentConfig?.provider || 'unknown'}`);
  }
  return await opts.fallbackCallAI(agentConfig, systemPrompt, userPrompt, role, opts);
}
