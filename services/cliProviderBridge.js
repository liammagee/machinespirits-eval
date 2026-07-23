import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { recordExternalApiCall } from './apiPayloadCapture.js';
import { normalizeTokenUsage } from './tokenUsage.js';

// Model CLIs are security boundaries. Do not copy process.env into them: the
// eval process commonly holds credentials for several unrelated providers as
// well as Node loader flags that can execute code before the CLI starts.
//
// The common list is limited to executable discovery, the user's auth/config
// home, locale, temporary files, and network transport. Provider lists contain
// only credentials/config understood by that selected CLI. In particular,
// Claude stays on its authenticated CLI session rather than receiving the
// Anthropic API key, preserving the bridge's no-API-credit behavior.
export const CLI_PROVIDER_COMMON_ENV_KEYS = Object.freeze([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TERM',
  'TZ',
  'TMPDIR',
  'TMP',
  'TEMP',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'no_proxy',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
]);

export const CLI_PROVIDER_ENV_KEYS = Object.freeze({
  codex: Object.freeze([
    'CODEX_HOME',
    'CODEX_API_KEY',
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_ORG_ID',
    'OPENAI_ORGANIZATION',
    'OPENAI_PROJECT_ID',
  ]),
  'claude-code': Object.freeze(['CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_OAUTH_TOKEN']),
});

// Existing integration tests exercise the real process boundary with a fake
// `codex` executable. Node's test runner marks the process with
// NODE_TEST_CONTEXT; under that marker only, pass the finite harness contract
// below. Never accept a FAKE_* wildcard or caller-controlled production list.
const CLI_PROVIDER_TEST_ENV_KEYS = Object.freeze([
  'FAKE_CODEX_LOG',
  'FAKE_CODEX_DELAY_MS',
  'FAKE_CODEX_VALID_ANALYSIS',
  'FAKE_CODEX_ANALYSIS_DELAY_MS',
  'FAKE_CODEX_FIXTURE_MODE',
]);

export function buildCliProviderEnv(provider, sourceEnv = process.env) {
  const env = {};
  const keys = [...CLI_PROVIDER_COMMON_ENV_KEYS, ...(CLI_PROVIDER_ENV_KEYS[provider] || [])];
  if (sourceEnv?.NODE_TEST_CONTEXT) keys.push(...CLI_PROVIDER_TEST_ENV_KEYS);
  for (const key of keys) {
    if (sourceEnv?.[key] !== undefined) env[key] = String(sourceEnv[key]);
  }
  return env;
}

export class CliProviderPolicyError extends Error {
  constructor(provider, audit) {
    super(`${provider} CLI response rejected by the no-tools policy`);
    this.name = 'CliProviderPolicyError';
    this.code = 'CLI_PROVIDER_POLICY_VIOLATION';
    this.provider = provider;
    // `audit` contains counts and allowlisted type labels only. It never holds
    // raw JSONL events, command arguments, child output, or environment data.
    this.audit = audit;
  }
}

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
const DEFAULT_CLI_MAX_STDOUT_BYTES = positiveIntEnv('CLI_PROVIDER_MAX_STDOUT_BYTES', 16 * 1024 * 1024);
const DEFAULT_CLI_MAX_STDERR_BYTES = positiveIntEnv('CLI_PROVIDER_MAX_STDERR_BYTES', 1024 * 1024);
const DEFAULT_CLI_VERSION_TIMEOUT_MS = positiveIntEnv('CLI_PROVIDER_VERSION_TIMEOUT_MS', 5_000);
const CLI_PROVIDERS = new Set(['claude-code', 'codex']);
const CLI_EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'config']);
let cachedCodexCliVersion;

function codexCliVersion({ enabled = true } = {}) {
  if (!enabled) return null;
  if (cachedCodexCliVersion !== undefined) return cachedCodexCliVersion;
  const result = spawnSync('codex', ['--version'], {
    encoding: 'utf8',
    env: buildCliProviderEnv('codex'),
    timeout: DEFAULT_CLI_VERSION_TIMEOUT_MS,
    maxBuffer: DEFAULT_CLI_MAX_STDERR_BYTES,
  });
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

// `read-only` prevents writes but still allows shell commands to read local
// files. These switches remove every stable tool-bearing Codex surface before
// the request reaches the model. `--strict-config` makes an older/incompatible
// CLI fail closed instead of silently ignoring a control. The JSONL audit
// below remains a second, post-response boundary.
export const CODEX_CLI_TOOL_ISOLATION_ARGS = Object.freeze([
  '--strict-config',
  '--disable',
  'shell_tool',
  '--disable',
  'unified_exec',
  '--disable',
  'apps',
  '--disable',
  'multi_agent',
  '--disable',
  'browser_use',
  '--disable',
  'in_app_browser',
  '--disable',
  'computer_use',
  '--disable',
  'image_generation',
  '--disable',
  'tool_suggest',
  '--disable',
  'hooks',
  '--disable',
  'shell_snapshot',
  '-c',
  'web_search="disabled"',
]);

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

function outputLimitError(provider, stream, maxBytes) {
  const error = new Error(`${provider} CLI ${stream} exceeded the ${maxBytes}-byte safety limit`);
  error.code = 'CLI_PROVIDER_OUTPUT_LIMIT';
  error.provider = provider;
  error.stream = stream;
  error.maxBytes = maxBytes;
  return error;
}

function positiveLimit(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
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

export function cliProviderNoToolsPromptTail({ structuredOutput = false } = {}) {
  const outputInstruction = structuredOutput
    ? ' Return only the requested JSON object.'
    : ' Return only the requested text response.';
  return `This is a tool-free model call. No command, filesystem, browser, app, connector, subagent, or other tool is available. Do not attempt any action beyond generating the response.${outputInstruction}`;
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
  return `${prompt}\n\n${cliProviderNoToolsPromptTail({ structuredOutput })}`;
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

const ALLOWED_CODEX_EVENT_TYPES = new Set([
  'thread.started',
  'turn.started',
  'item.started',
  'item.updated',
  'item.completed',
  'turn.completed',
]);
const ALLOWED_CODEX_ITEM_TYPES = new Set(['agent_message', 'reasoning']);
const KNOWN_PROHIBITED_CODEX_TYPES = new Set([
  'command_execution',
  'file_change',
  'function_call',
  'mcp_tool_call',
  'tool_call',
  'web_search',
]);

function safeCodexTypeLabel(value, allowed) {
  const label = String(value || 'unknown');
  if (allowed.has(label) || KNOWN_PROHIBITED_CODEX_TYPES.has(label)) return label;
  return 'unknown';
}

function auditCodexStructuredEvents(events = [], { strict = true, invalidLines = 0 } = {}) {
  const eventTypeCounts = {};
  const itemTypeCounts = {};
  const prohibited = [];
  for (const [index, event] of events.entries()) {
    const rawEventType = String(event?.type || 'unknown');
    const rawItemType = String(event?.item?.type || '');
    const eventType = safeCodexTypeLabel(rawEventType, ALLOWED_CODEX_EVENT_TYPES);
    const itemType = rawItemType ? safeCodexTypeLabel(rawItemType, ALLOWED_CODEX_ITEM_TYPES) : '';
    eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
    if (itemType) itemTypeCounts[itemType] = (itemTypeCounts[itemType] || 0) + 1;
    if (
      strict &&
      (!ALLOWED_CODEX_EVENT_TYPES.has(rawEventType) ||
        (rawEventType.startsWith('item.') && !rawItemType) ||
        (rawItemType && !ALLOWED_CODEX_ITEM_TYPES.has(rawItemType)))
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
  maxStdoutBytes,
  maxStderrBytes,
}) {
  if (signal?.aborted) throw abortError(role);
  const userText = buildCliUserText(userPrompt, messageHistory);
  const start = Date.now();
  const effectiveTimeout = timeoutMs || DEFAULT_CLAUDE_TIMEOUT_MS;
  const effectiveEffort = resolveCliEffort('claude-code', effort);
  const stdoutLimit = positiveLimit(maxStdoutBytes, DEFAULT_CLI_MAX_STDOUT_BYTES);
  const stderrLimit = positiveLimit(maxStderrBytes, DEFAULT_CLI_MAX_STDERR_BYTES);
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
      const env = buildCliProviderEnv('claude-code');
      const child = spawnImpl('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], env, cwd: isolation.cwd });
      let out = '';
      let err = '';
      let outBytes = 0;
      let errBytes = 0;
      let outputExceeded = false;
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
        outBytes += Buffer.byteLength(d);
        if (outBytes > stdoutLimit) {
          outputExceeded = true;
          clearTimeout(cliTimeout);
          child.kill('SIGKILL');
          reject(outputLimitError('claude', 'stdout', stdoutLimit));
          return;
        }
        out += d;
      });
      child.stderr.on('data', (d) => {
        errBytes += Buffer.byteLength(d);
        if (errBytes > stderrLimit) {
          outputExceeded = true;
          clearTimeout(cliTimeout);
          child.kill('SIGKILL');
          reject(outputLimitError('claude', 'stderr', stderrLimit));
          return;
        }
        err += d;
      });
      child.on('error', (e) => {
        clearTimeout(cliTimeout);
        signal?.removeEventListener('abort', onAbort);
        const launchError = new Error(`claude CLI failed to start (${e?.code || 'spawn_error'})`);
        launchError.code = e?.code || 'CLI_PROVIDER_SPAWN_FAILED';
        reject(launchError);
      });
      child.on('close', (code) => {
        clearTimeout(cliTimeout);
        signal?.removeEventListener('abort', onAbort);
        if (outputExceeded) return;
        if (code !== 0) {
          const exitError = new Error(`claude CLI exited with code ${code}`);
          exitError.code = 'CLI_PROVIDER_EXIT_FAILED';
          exitError.exitCode = code;
          exitError.stdoutBytes = Buffer.byteLength(out);
          exitError.stderrBytes = Buffer.byteLength(err);
          reject(exitError);
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
  maxStdoutBytes,
  maxStderrBytes,
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
  const stdoutLimit = positiveLimit(maxStdoutBytes, DEFAULT_CLI_MAX_STDOUT_BYTES);
  const stderrLimit = positiveLimit(maxStderrBytes, DEFAULT_CLI_MAX_STDERR_BYTES);
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
        ...CODEX_CLI_TOOL_ISOLATION_ARGS,
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
      if (effectiveEffort && effectiveEffort !== 'config') {
        args.push('-c', `model_reasoning_effort="${effectiveEffort}"`);
      }
      if (replacementInstructionsFile) {
        args.push('-c', `model_instructions_file=${JSON.stringify(replacementInstructionsFile)}`);
      }
      if (model && model !== 'auto') args.push('-m', model);
      if (schemaFile) args.push('--output-schema', schemaFile);
      args.push('-o', outFile, '-');

      const child = spawnImpl('codex', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: tmpDir,
        env: buildCliProviderEnv('codex'),
      });
      let err = '';
      let stdout = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let outputExceeded = false;
      const jsonl = createCodexJsonlEventParser((event) => {
        // Only policy-allowed event shapes may cross the streaming boundary.
        // Prohibited events stay internal long enough to count and reject;
        // command payloads are never forwarded into UI/log callbacks.
        const singleEventAudit = auditCodexStructuredEvents([event]);
        if (singleEventAudit.prohibited_event_count === 0) onEvent?.(event);
      });
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
        stderrBytes += Buffer.byteLength(d);
        if (stderrBytes > stderrLimit) {
          outputExceeded = true;
          clearTimeout(cliTimeout);
          child.kill('SIGKILL');
          reject(outputLimitError('codex', 'stderr', stderrLimit));
          return;
        }
        err += d;
      });
      child.stdout.on('data', (data) => {
        const chunk = String(data || '');
        stdoutBytes += Buffer.byteLength(chunk);
        if (stdoutBytes > stdoutLimit) {
          outputExceeded = true;
          clearTimeout(cliTimeout);
          child.kill('SIGKILL');
          reject(outputLimitError('codex', 'stdout', stdoutLimit));
          return;
        }
        stdout += chunk;
        jsonl.push(chunk);
      });
      child.on('error', (e) => {
        clearTimeout(cliTimeout);
        signal?.removeEventListener('abort', onAbort);
        const launchError = new Error(`codex CLI failed to start (${e?.code || 'spawn_error'})`);
        launchError.code = e?.code || 'CLI_PROVIDER_SPAWN_FAILED';
        reject(launchError);
      });
      child.on('close', (code) => {
        clearTimeout(cliTimeout);
        signal?.removeEventListener('abort', onAbort);
        if (outputExceeded) return;
        const parsedStream = jsonl.end();
        const eventAudit = auditCodexStructuredEvents(parsedStream.events, {
          strict: true,
          invalidLines: parsedStream.invalidLines.length,
        });
        if (eventAudit.prohibited_event_count > 0) {
          reject(new CliProviderPolicyError('codex', eventAudit));
          return;
        }
        if (code !== 0) {
          const exitError = new Error(`codex CLI exited with code ${code}`);
          exitError.code = 'CLI_PROVIDER_EXIT_FAILED';
          exitError.exitCode = code;
          exitError.stdoutBytes = Buffer.byteLength(stdout);
          exitError.stderrBytes = Buffer.byteLength(err);
          reject(exitError);
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
      maxStdoutBytes: opts?.maxStdoutBytes,
      maxStderrBytes: opts?.maxStderrBytes,
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
      maxStdoutBytes: opts?.maxStdoutBytes,
      maxStderrBytes: opts?.maxStderrBytes,
    });
  }
  if (!opts?.fallbackCallAI) {
    throw new Error(`No fallback AI caller supplied for provider ${agentConfig?.provider || 'unknown'}`);
  }
  return await opts.fallbackCallAI(agentConfig, systemPrompt, userPrompt, role, opts);
}
