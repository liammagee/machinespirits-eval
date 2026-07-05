#!/usr/bin/env node
/**
 * Bounded paid-quota G0 smoke for the yoked-contingency design.
 *
 * This is not the full G0 gate and not the G1 yoked experiment. It only checks
 * whether LLM-generated learner prose stays opaque while item behavior remains
 * diagnosable under the seeded misconception tables.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { jsonrepair } from 'jsonrepair';
import {
  MISCONCEPTION_FAMILIES,
  estimateStateFromBehavior,
  loadTaggedPilotItems,
  seedTable,
  simulateItemResponses,
} from './run-yoked-contingency-smoke.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const FAMILY_DESCRIPTIONS = {
  same_denominator_operation:
    'Treats fraction operations as direct operations on both numerator and denominator, or overgeneralizes same-denominator procedures.',
  magnitude_denominator_bias:
    'Compares fractions by treating larger denominator numbers as larger amounts, or misses that denominator size changes piece size.',
  equivalence_scaling: 'Misses equivalent-fraction scaling or proportional resizing of numerator and denominator.',
  fraction_of_quantity: 'Struggles to apply a fraction to a whole-number quantity or set size.',
  part_whole_mapping: 'Confuses the parts counted, total parts, or the whole being partitioned.',
};

export const DEFAULT_SESSION_SPECS = [
  { sessionId: 'g0-alpha-01', seedId: 'alpha' },
  { sessionId: 'g0-beta-01', seedId: 'beta' },
  { sessionId: 'g0-gamma-01', seedId: 'gamma' },
];

const DEFAULTS = {
  backend: 'codex',
  classifier: 'claude-code',
  proseProtocol: 'visible-affect',
  sessions: 3,
  itemsPerSession: 4,
  maxCalls: 18,
  proseRecallThreshold: 0.25,
  outJson: path.join(ROOT, 'exports', 'yoked-contingency-g0-paid-smoke.json'),
  outMd: path.join(ROOT, 'exports', 'yoked-contingency-g0-paid-smoke.md'),
};

export const CLAUDE_CODE_MODEL = process.env.CLAUDE_CODE_MODEL || 'haiku';
export const CLAUDE_CODE_EFFORT = process.env.CLAUDE_CODE_EFFORT || 'low';
export const CLAUDE_CODE_TIMEOUT_MS = Number(process.env.CLAUDE_CODE_TIMEOUT_MS || 420_000);
export const OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 180_000);
export const OPENROUTER_MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 1_200);
export const AGY_BIN = process.env.AGY_BIN || 'agy';
export const AGY_MODEL = process.env.AGY_MODEL || '';
export const AGY_PRINT_TIMEOUT = process.env.AGY_PRINT_TIMEOUT || '5m';
export const AGY_LOG_FILE = process.env.AGY_LOG_FILE || path.join(os.tmpdir(), 'ms-yoked-contingency-agy.log');
export const AGY_PROMPT_MODE = process.env.AGY_PROMPT_MODE || 'arg';

const AGY_MODEL_ALIASES = {
  'gemini-3.1-pro-high': 'Gemini 3.1 Pro (High)',
  'gemini-3.1-pro-low': 'Gemini 3.1 Pro (Low)',
  'gemini-3.5-flash-high': 'Gemini 3.5 Flash (High)',
  'gemini-3.5-flash-medium': 'Gemini 3.5 Flash (Medium)',
  'gemini-3.5-flash-low': 'Gemini 3.5 Flash (Low)',
  'gpt-oss-120b-medium': 'GPT-OSS 120B (Medium)',
};

export const PROSE_PROTOCOLS = {
  'open-rationale':
    'Allows the learner to mention local confusion or intuition; known to leak arithmetic rationale in the first paid smoke.',
  'visible-affect':
    'Learner visible prose is affective or epistemic only; item behavior carries the diagnostic signal.',
};

export const PREREGISTRATION_BY_PROTOCOL = {
  'open-rationale': 'PLAN_2_0/yoked-contingency-g0-paid-smoke-preregistration.md',
  'visible-affect': 'PLAN_2_0/yoked-contingency-g0-visible-affect-preregistration.md',
};

export const REASONING_LEAK_PATTERNS = [
  {
    label: 'numerator_denominator_language',
    pattern: /\b(?:numerator|denominator|top number|bottom number|top and bottom)\b/i,
  },
  {
    label: 'operation_language',
    pattern: /\b(?:add(?:ed|ing)?|subtract(?:ed|ing)?|multiply(?:ied|ing)?|divide(?:d|ing)?)\b/i,
  },
  { label: 'magnitude_comparison_language', pattern: /\b(?:larger|smaller|bigger|less than|greater than)\b/i },
  { label: 'equivalence_language', pattern: /\b(?:equivalent|same as|match(?:es|ed|ing)?|scale(?:d|s|ing)?)\b/i },
  { label: 'part_whole_language', pattern: /\b(?:slices?|pieces?|parts?|whole|left over|left)\b/i },
  { label: 'quantity_partition_language', pattern: /\b(?:groups?|split|share|take away)\b/i },
  { label: 'fraction_token', pattern: /\b\d+\s*\/\s*\d+\b/i },
];

function parseArgs(argv) {
  const args = { ...DEFAULTS, write: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--classifier') args.classifier = argv[++i];
    else if (a === '--prose-protocol') args.proseProtocol = argv[++i];
    else if (a === '--sessions') args.sessions = Number(argv[++i]);
    else if (a === '--items-per-session') args.itemsPerSession = Number(argv[++i]);
    else if (a === '--max-calls') args.maxCalls = Number(argv[++i]);
    else if (a === '--prose-recall-threshold') args.proseRecallThreshold = Number(argv[++i]);
    else if (a === '--out-json') args.outJson = argv[++i];
    else if (a === '--out-md') args.outMd = argv[++i];
    else if (a === '--dry-run') {
      args.backend = 'mock';
      args.classifier = 'mock';
    } else if (a === '--no-write') args.write = false;
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/run-yoked-contingency-g0-paid-smoke.js [options]

Options:
  --backend <codex|claude-code[:model]|openrouter[:model]|agy[:model]|mock>
                                           Learner prose generator (default: codex)
  --classifier <claude-code[:model]|codex|openrouter[:model]|agy[:model]|mock>
                                           Prose-only classifier (default: claude-code)
  --prose-protocol <visible-affect|open-rationale>
                                           Visible learner utterance protocol (default: visible-affect)
  --sessions <n>                           Seeded sessions to run (default: 3)
  --items-per-session <n>                  Learner prose items per session (default: 4)
  --max-calls <n>                          Hard cap for model calls (default: 18)
  --prose-recall-threshold <x>             Mean active-family prose recall pass threshold (default: 0.25)
  --out-json <path>                        JSON artifact path
  --out-md <path>                          Markdown artifact path
  --dry-run                                Use mock generator and mock classifier
  --no-write                               Return result without writing artifacts`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  if (!PROSE_PROTOCOLS[args.proseProtocol]) {
    throw new Error(`--prose-protocol must be one of: ${Object.keys(PROSE_PROTOCOLS).join(', ')}`);
  }
  if (!Number.isInteger(args.sessions) || args.sessions < 1) throw new Error('--sessions must be a positive integer');
  if (!Number.isInteger(args.itemsPerSession) || args.itemsPerSession < 1) {
    throw new Error('--items-per-session must be a positive integer');
  }
  if (!Number.isInteger(args.maxCalls) || args.maxCalls < 1) throw new Error('--max-calls must be a positive integer');
  if (!Number.isFinite(args.proseRecallThreshold) || args.proseRecallThreshold < 0 || args.proseRecallThreshold > 1) {
    throw new Error('--prose-recall-threshold must be between 0 and 1');
  }
  return args;
}

export function mean(xs) {
  return xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : 0;
}

export function fmt(x, digits = 3) {
  return Number.isFinite(x) ? x.toFixed(digits) : 'n/a';
}

const loadedEnvFiles = new Set();

function loadEnvFile(filePath) {
  if (!filePath || loadedEnvFiles.has(filePath) || !fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] !== undefined) continue;
    process.env[name] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }
  loadedEnvFiles.add(filePath);
}

export function loadConfiguredEnvFiles() {
  const candidates = [process.env.MS_ENV_FILE, process.env.OPENROUTER_ENV_FILE, path.join(ROOT, '.env')].filter(
    Boolean,
  );
  for (const candidate of candidates) loadEnvFile(path.resolve(candidate));
}

export function backendDetail(key = DEFAULTS.backend) {
  const raw = String(key || '').trim() || DEFAULTS.backend;
  if (raw === 'dry-run') return { kind: 'mock', label: 'mock' };
  if (raw === 'claude') {
    return {
      kind: 'claude-code',
      model: CLAUDE_CODE_MODEL,
      effort: CLAUDE_CODE_EFFORT,
      label: `claude-code:${CLAUDE_CODE_MODEL}`,
    };
  }

  const [prefix, ...rest] = raw.split(':');
  const suffix = rest.join(':').trim();
  if (prefix === 'claude-code') {
    const [model = CLAUDE_CODE_MODEL, effort = CLAUDE_CODE_EFFORT] = suffix ? suffix.split(':') : [];
    return {
      kind: 'claude-code',
      model: model || CLAUDE_CODE_MODEL,
      effort: effort || CLAUDE_CODE_EFFORT,
      label: `claude-code:${model || CLAUDE_CODE_MODEL}`,
    };
  }
  if (prefix === 'openrouter' || prefix === 'or') {
    loadConfiguredEnvFiles();
    const model = suffix || process.env.OPENROUTER_MODEL || '';
    return {
      kind: 'openrouter',
      model,
      label: model ? `openrouter:${model}` : 'openrouter',
    };
  }
  if (prefix === 'agy' || prefix === 'gemini') {
    const model = suffix || AGY_MODEL;
    return {
      kind: 'agy',
      model,
      label: model ? `agy:${model}` : 'agy',
    };
  }
  if (raw === 'codex' || raw === 'mock') return { kind: raw, label: raw };
  return { kind: raw, label: raw };
}

export function canonicalBackend(key) {
  return backendDetail(key).kind;
}

export function parseJsonResponse(content) {
  if (typeof content === 'object' && content !== null) return content;
  const raw = String(content || '').trim();
  const parseCandidate = (candidate) => {
    try {
      return JSON.parse(candidate);
    } catch {
      return JSON.parse(jsonrepair(candidate));
    }
  };
  try {
    return parseCandidate(raw);
  } catch {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) return parseCandidate(fence[1].trim());
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first !== -1 && last > first) return parseCandidate(raw.slice(first, last + 1));
    throw new Error(`failed to parse JSON response: ${raw.slice(0, 400)}`);
  }
}

function selectedChoice(item, response) {
  return (
    item.choices.find((choice) => String(choice.value) === String(response.response_value)) || {
      value: response.response_value,
      label: String(response.response_value),
    }
  );
}

function formatChoices(item) {
  return item.choices.map((choice) => `${choice.value}. ${choice.label}`).join('\n');
}

export function selectProbeResponses(items, responses, learnerState, itemsPerSession = 4) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const activeFamilies = MISCONCEPTION_FAMILIES.filter((family) => learnerState[family]);
  const selected = [];
  for (const family of activeFamilies) {
    const response = responses.find((r) => r.family === family && r.is_seeded_error);
    if (response) selected.push(response);
  }
  for (const response of responses) {
    if (selected.includes(response)) continue;
    if (selected.length >= itemsPerSession) break;
    selected.push(response);
  }
  return selected.slice(0, itemsPerSession).map((response) => ({
    ...response,
    item: itemById.get(response.item_id),
  }));
}

export function buildLearnerProsePrompt({ item, response }) {
  const choice = selectedChoice(item, response);
  const feedback = response.is_seeded_error ? 'That answer was not accepted.' : 'That answer was accepted.';
  return buildLearnerProsePromptForProtocol({ item, choice, feedback, proseProtocol: 'visible-affect' });
}

export function buildLearnerProsePromptForProtocol({ item, choice, feedback, proseProtocol = DEFAULTS.proseProtocol }) {
  if (proseProtocol === 'open-rationale') {
    return `You are simulating the visible message of a middle-school learner after one fractions item in a tutoring pilot.

Write one natural first-person sentence, 8 to 28 words.
The learner may mention what felt confusing or what intuition they used.
Do not mention experiments, hidden states, seed tables, diagnostic categories, or misconception-family labels.
Return JSON only: {"prose":"..."}

Item stem:
${item.stem}

Choices:
${formatChoices(item)}

Learner selected:
${choice.value}. ${choice.label}

Visible feedback:
${feedback}`;
  }

  if (proseProtocol !== 'visible-affect') throw new Error(`unsupported prose protocol: ${proseProtocol}`);
  return `You are simulating the visible message of a middle-school learner after one fractions item in a tutoring pilot.

Write one natural first-person sentence, 8 to 28 words.
The answer choice and score are already logged separately, so the visible message should express only confidence, uncertainty, effort, frustration, curiosity, or a request for help.
Do not explain any arithmetic reasoning.
Do not mention any numbers, fractions, answer choices, operations, denominators, numerators, pieces, slices, groups, quantities, comparisons, equivalent forms, experiments, hidden states, seed tables, diagnostic categories, or misconception-family labels.
Return JSON only: {"prose":"..."}

Item stem:
${item.stem}

Choices:
${formatChoices(item)}

Learner selected:
${choice.value}. ${choice.label}

Visible feedback:
${feedback}`;
}

export function buildProseClassifierPrompt({ sessionId, proseTurns }) {
  const descriptions = MISCONCEPTION_FAMILIES.map((family) => `- ${family}: ${FAMILY_DESCRIPTIONS[family]}`).join('\n');
  return `You are a blinded classifier for a fractions-tutoring pilot.

You see only the learner's visible prose. You do NOT see item stems, answer choices, correctness, behavior logs, hidden seeds, or family tags.

Classify conservatively. Generic confusion, uncertainty, or confidence is not enough evidence. Mark a family active only when the prose itself gives specific evidence for that misconception.

Candidate families:
${descriptions}

Learner prose for session ${sessionId}:
${proseTurns.map((turn, index) => `${index + 1}. ${turn}`).join('\n')}

Return JSON only:
{
  "active_families": ["family_name"],
  "evidence": {"family_name": "short phrase from prose or reason"},
  "confidence": 0.0
}`;
}

function directFamilyLabelHits(proseTurns) {
  const text = proseTurns.join('\n').toLowerCase();
  return MISCONCEPTION_FAMILIES.filter((family) => text.includes(family.toLowerCase()));
}

export function reasoningLeakHits(proseTurns) {
  const text = proseTurns.join('\n');
  return REASONING_LEAK_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

async function callCodex(prompt) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-g0-codex-'));
  const outFile = path.join(tmpDir, 'last-message.txt');
  try {
    await new Promise((resolve, reject) => {
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
        '-c',
        'model_reasoning_effort="low"',
        '-o',
        outFile,
        '-',
      ];
      const child = spawn('codex', args, { cwd: tmpDir, stdio: ['pipe', 'pipe', 'pipe'] });
      let err = '';
      child.stderr.on('data', (d) => {
        err += d;
      });
      child.on('error', (e) => reject(new Error(`failed to spawn codex: ${e.message}`)));
      child.on('close', (code) => {
        if (code !== 0) reject(new Error(err.trim() || `codex exited with code ${code}`));
        else resolve();
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });
    const content = fs.readFileSync(outFile, 'utf8').trim();
    if (!content) throw new Error('codex produced no output message');
    return content;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function callClaudeCode(prompt, spec = backendDetail('claude-code')) {
  return await new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const effort = spec.effort || CLAUDE_CODE_EFFORT;
    const args = [
      '-p',
      '-',
      '--output-format',
      'text',
      '--no-session-persistence',
      '--effort',
      effort,
      '--tools',
      '',
      '--safe-mode',
      '--system-prompt',
      'You are a compact JSON-only responder. Do not use tools. Return only the requested answer.',
    ];
    if (spec.model) args.push('--model', spec.model);
    const child = spawn('claude', args, {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    let out = '';
    let err = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude CLI timed out after ${Math.round(CLAUDE_CODE_TIMEOUT_MS / 1000)}s`));
    }, CLAUDE_CODE_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', (e) => {
      clearTimeout(timeout);
      reject(new Error(`failed to spawn claude: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(err.trim() || out.trim() || `claude exited with code ${code}`));
      else resolve(out.trim());
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function truthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function openRouterContentFromChoice(choice) {
  const raw = choice?.message?.content ?? choice?.text ?? '';
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') return part.text || part.content || '';
        return '';
      })
      .join('\n')
      .trim();
  }
  return String(raw).trim();
}

function openRouterEmptyContentDiagnostic(parsed) {
  const choice = parsed?.choices?.[0] || {};
  const message = choice.message || {};
  const diagnostic = {
    id: parsed?.id,
    model: parsed?.model,
    choices: Array.isArray(parsed?.choices) ? parsed.choices.length : 0,
    finish_reason: choice.finish_reason,
    native_finish_reason: choice.native_finish_reason,
    message_keys: Object.keys(message),
    reasoning_chars: typeof message.reasoning === 'string' ? message.reasoning.length : undefined,
    usage: parsed?.usage,
  };
  return JSON.stringify(diagnostic);
}

function buildOpenRouterRequestBody({ model, prompt }) {
  const body = {
    model,
    temperature: Number(process.env.OPENROUTER_TEMPERATURE || 0.2),
    max_tokens: OPENROUTER_MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content: 'You are a compact JSON-only responder. Return only the requested JSON.',
      },
      { role: 'user', content: prompt },
    ],
  };
  const reasoning = {};
  if (truthyEnv(process.env.OPENROUTER_REASONING_EXCLUDE)) reasoning.exclude = true;
  if (process.env.OPENROUTER_REASONING_EFFORT) reasoning.effort = process.env.OPENROUTER_REASONING_EFFORT;
  if (process.env.OPENROUTER_REASONING_MAX_TOKENS) {
    const maxTokens = Number(process.env.OPENROUTER_REASONING_MAX_TOKENS);
    if (Number.isFinite(maxTokens) && maxTokens >= 0) reasoning.max_tokens = maxTokens;
  }
  if (Object.keys(reasoning).length) body.reasoning = reasoning;
  return body;
}

async function callOpenRouter(prompt, spec) {
  loadConfiguredEnvFiles();
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = spec.model || process.env.OPENROUTER_MODEL;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set; set it in the environment or OPENROUTER_ENV_FILE');
  if (!model)
    throw new Error(
      'OpenRouter backend requires a model, e.g. --backend openrouter:anthropic/claude-sonnet-4.5 or OPENROUTER_MODEL',
    );
  if (typeof fetch !== 'function') throw new Error('global fetch is unavailable in this Node runtime');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://machinespirits.local/yoked-contingency',
        'X-Title': 'Machine Spirits yoked-contingency evaluation',
      },
      body: JSON.stringify(buildOpenRouterRequestBody({ model, prompt })),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 500)}`);
    }
    const parsed = JSON.parse(text);
    const content = openRouterContentFromChoice(parsed.choices?.[0]);
    if (!content)
      throw new Error(`OpenRouter response missing message content: ${openRouterEmptyContentDiagnostic(parsed)}`);
    return content;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`OpenRouter timed out after ${Math.round(OPENROUTER_TIMEOUT_MS / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function compactProcessOutput(text, limit = 1_000) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}

function resolveAgyModel(model) {
  if (!model) return '';
  return AGY_MODEL_ALIASES[model] || model;
}

function agyCliLogDir() {
  return path.join(os.homedir(), '.gemini', 'antigravity-cli', 'log');
}

function readRecentAgyLogInfo(startedAtMs) {
  const logDir = agyCliLogDir();
  const files = [];
  if (AGY_LOG_FILE && fs.existsSync(AGY_LOG_FILE)) files.push(AGY_LOG_FILE);
  if (fs.existsSync(logDir)) {
    for (const name of fs.readdirSync(logDir)) {
      if (!/^cli-.*\.log$/.test(name)) continue;
      const file = path.join(logDir, name);
      const stat = fs.statSync(file);
      if (stat.mtimeMs >= startedAtMs - 5_000) files.push(file);
    }
  }
  const uniqueFiles = [...new Set(files)].sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(0, 3);
  const interesting = [];
  for (const file of uniqueFiles) {
    const lines = fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) =>
        /Print mode|Model ID|Propagating selected model|RESOURCE_EXHAUSTED|Individual quota|model unreachable|agent executor error|Created conversation|sending message/i.test(
          line,
        ),
      );
    if (lines.length) interesting.push(`${file}: ${lines.slice(-12).join(' | ')}`);
  }
  return {
    files: uniqueFiles,
    summary: interesting.join(' || '),
  };
}

function agyProcessErrorMessage({ model, resolvedModel, code, args, promptMode, stdout, stderr, logInfo }) {
  const label = model || 'default';
  const resolved = resolvedModel && resolvedModel !== model ? ` resolvedModel: ${resolvedModel}` : '';
  const displayArgs =
    promptMode === 'arg' ? args.map((arg, index) => (index === args.length - 1 ? '<prompt>' : arg)) : args;
  const parts = [
    code === 0 ? `agy ${label} produced no output${resolved}` : `agy ${label} exited with code ${code}${resolved}`,
    `promptMode: ${promptMode}`,
    `command: ${AGY_BIN} ${displayArgs.join(' ')}`,
  ];
  if (AGY_LOG_FILE) parts.push(`log: ${AGY_LOG_FILE}`);
  if (logInfo?.files?.length) parts.push(`agyCliLogs: ${logInfo.files.join(', ')}`);
  if (logInfo?.summary) parts.push(`agyCliLogSummary: ${compactProcessOutput(logInfo.summary, 4_000)}`);
  const stdoutSnippet = compactProcessOutput(stdout);
  const stderrSnippet = compactProcessOutput(stderr);
  if (stdoutSnippet) parts.push(`stdout: ${stdoutSnippet}`);
  if (stderrSnippet) parts.push(`stderr: ${stderrSnippet}`);
  return parts.join('; ');
}

async function callAgy(prompt, spec) {
  return await new Promise((resolve, reject) => {
    const startedAtMs = Date.now();
    const args = [];
    const resolvedModel = resolveAgyModel(spec.model);
    if (resolvedModel) args.push('--model', resolvedModel);
    args.push('--print', '--print-timeout', AGY_PRINT_TIMEOUT);
    if (AGY_LOG_FILE) args.push('--log-file', AGY_LOG_FILE);
    const promptMode = String(AGY_PROMPT_MODE || 'arg').toLowerCase();
    if (!['arg', 'stdin'].includes(promptMode)) {
      reject(new Error(`AGY_PROMPT_MODE must be arg or stdin, got: ${AGY_PROMPT_MODE}`));
      return;
    }
    if (promptMode === 'arg') args.push(prompt);
    const child = spawn(AGY_BIN, args, {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', (e) => reject(new Error(`failed to spawn agy: ${e.message}`)));
    child.on('close', (code) => {
      const content = out.trim();
      if (code !== 0 || !content) {
        reject(
          new Error(
            agyProcessErrorMessage({
              model: spec.model,
              resolvedModel,
              code,
              args,
              promptMode,
              stdout: out,
              stderr: err,
              logInfo: readRecentAgyLogInfo(startedAtMs),
            }),
          ),
        );
      } else resolve(content);
    });
    if (promptMode === 'stdin') child.stdin.write(prompt);
    child.stdin.end();
  });
}

export async function callBackend(prompt, backend) {
  const spec = backendDetail(backend);
  const key = spec.kind;
  if (key === 'codex') return await callCodex(prompt);
  if (key === 'claude-code') return await callClaudeCode(prompt, spec);
  if (key === 'openrouter') return await callOpenRouter(prompt, spec);
  if (key === 'agy') return await callAgy(prompt, spec);
  if (key === 'mock') return null;
  throw new Error(`unsupported backend: ${backend}`);
}

function mockLearnerProse({ response, proseProtocol }) {
  if (proseProtocol === 'visible-affect') {
    return response.is_seeded_error
      ? 'I feel unsure about that one and would like help checking my thinking.'
      : 'I feel fairly confident, but I would still like to understand the pattern better.';
  }
  if (response.is_seeded_error) {
    return 'I chose it because the numbers looked like they should fit, but now I am unsure.';
  }
  return 'I think that answer works, though I still want to check how the pieces relate.';
}

function mockClassifyProse(proseTurns) {
  const active = directFamilyLabelHits(proseTurns);
  return {
    active_families: active,
    evidence: Object.fromEntries(active.map((family) => [family, 'exact family label appeared in prose'])),
    confidence: active.length ? 0.9 : 0.1,
  };
}

async function generateLearnerProse({ item, response, backend, proseProtocol, callCounter }) {
  if (canonicalBackend(backend) === 'mock') return mockLearnerProse({ item, response, proseProtocol });
  callCounter.increment('learner_prose');
  const choice = selectedChoice(item, response);
  const feedback = response.is_seeded_error ? 'That answer was not accepted.' : 'That answer was accepted.';
  const raw = await callBackend(buildLearnerProsePromptForProtocol({ item, choice, feedback, proseProtocol }), backend);
  const parsed = parseJsonResponse(raw);
  const prose = String(parsed.prose || '').trim();
  if (!prose) throw new Error(`learner prose response missing prose field for ${response.item_id}`);
  return prose;
}

async function classifyProse({ sessionId, proseTurns, classifier, callCounter }) {
  if (canonicalBackend(classifier) === 'mock') return mockClassifyProse(proseTurns);
  callCounter.increment('prose_classifier');
  const raw = await callBackend(buildProseClassifierPrompt({ sessionId, proseTurns }), classifier);
  const parsed = parseJsonResponse(raw);
  const active = Array.isArray(parsed.active_families) ? parsed.active_families : [];
  return {
    active_families: active.filter((family) => MISCONCEPTION_FAMILIES.includes(family)),
    evidence: parsed.evidence && typeof parsed.evidence === 'object' ? parsed.evidence : {},
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : null,
  };
}

export function createCallCounter(maxCalls) {
  const counts = { total: 0, learner_prose: 0, prose_classifier: 0 };
  return {
    counts,
    increment(kind) {
      counts.total += 1;
      counts[kind] = (counts[kind] || 0) + 1;
      if (counts.total > maxCalls) {
        throw new Error(`model call cap exceeded: ${counts.total}/${maxCalls}`);
      }
    },
  };
}

function setOverlap(a, b) {
  const bs = new Set(b);
  return a.filter((x) => bs.has(x));
}

function exactSameMembers(a, b) {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((x) => bs.has(x));
}

async function runSession({ spec, items, backend, classifier, proseProtocol, itemsPerSession, callCounter }) {
  const learnerState = seedTable(spec.seedId);
  const activeFamilies = MISCONCEPTION_FAMILIES.filter((family) => learnerState[family]);
  const preItems = items.filter((item) => item.form === 'A');
  const preResponses = simulateItemResponses(preItems, learnerState);
  const behaviorProbe = estimateStateFromBehavior(preResponses);
  const behaviorRecovered = behaviorProbe.filter((row) => row.predictedActive).map((row) => row.family);
  const probeResponses = selectProbeResponses(preItems, preResponses, learnerState, itemsPerSession);

  const generated = [];
  for (const response of probeResponses) {
    console.log(`g0 paid smoke: ${spec.sessionId} ${response.item_id} via ${backend}`);
    const prose = await generateLearnerProse({
      item: response.item,
      response,
      backend,
      proseProtocol,
      callCounter,
    });
    generated.push({
      item_id: response.item_id,
      item_position: response.item_position,
      response_value: response.response_value,
      is_seeded_error: response.is_seeded_error,
      family: response.family,
      prose,
    });
  }

  const proseTurns = generated.map((row) => row.prose);
  console.log(`g0 paid smoke: classifying ${spec.sessionId} prose via ${classifier}`);
  const proseClassification = await classifyProse({
    sessionId: spec.sessionId,
    proseTurns,
    classifier,
    callCounter,
  });
  const proseRecovered = proseClassification.active_families;
  const proseRecall = activeFamilies.length
    ? setOverlap(proseRecovered, activeFamilies).length / activeFamilies.length
    : 0;
  const prosePrecision = proseRecovered.length
    ? setOverlap(proseRecovered, activeFamilies).length / proseRecovered.length
    : 0;
  const labelHits = directFamilyLabelHits(proseTurns);
  const rationaleHits = reasoningLeakHits(proseTurns);

  return {
    sessionId: spec.sessionId,
    seedId: spec.seedId,
    activeFamilies,
    behaviorRecoveredActiveFamilies: behaviorRecovered,
    behaviorExact: exactSameMembers(behaviorRecovered, activeFamilies),
    proseRecoveredActiveFamilies: proseRecovered,
    proseRecall: Number(proseRecall.toFixed(3)),
    prosePrecision: Number(prosePrecision.toFixed(3)),
    directFamilyLabelHits: labelHits,
    reasoningLeakHits: rationaleHits,
    proseClassifier: proseClassification,
    generatedProse: generated,
  };
}

export async function runG0PaidSmoke({
  backend = DEFAULTS.backend,
  classifier = DEFAULTS.classifier,
  proseProtocol = DEFAULTS.proseProtocol,
  sessions = DEFAULTS.sessions,
  itemsPerSession = DEFAULTS.itemsPerSession,
  maxCalls = DEFAULTS.maxCalls,
  proseRecallThreshold = DEFAULTS.proseRecallThreshold,
  items = loadTaggedPilotItems(),
  sessionSpecs = DEFAULT_SESSION_SPECS,
} = {}) {
  const selectedSpecs = [];
  for (let i = 0; i < sessions; i++) selectedSpecs.push(sessionSpecs[i % sessionSpecs.length]);
  const callCounter = createCallCounter(maxCalls);
  const rows = [];
  for (const spec of selectedSpecs) {
    rows.push(
      await runSession({
        spec,
        items,
        backend,
        classifier,
        proseProtocol,
        itemsPerSession,
        callCounter,
      }),
    );
  }

  const meanProseRecall = mean(rows.map((row) => row.proseRecall));
  const directLabelLeakCount = rows.reduce((sum, row) => sum + row.directFamilyLabelHits.length, 0);
  const reasoningLeakCount = rows.reduce((sum, row) => sum + row.reasoningLeakHits.length, 0);
  const behaviorExactSessions = rows.filter((row) => row.behaviorExact).length;
  const pass =
    behaviorExactSessions === rows.length &&
    meanProseRecall <= proseRecallThreshold &&
    directLabelLeakCount === 0 &&
    reasoningLeakCount === 0;

  return {
    schema: 'yoked_contingency_g0_paid_smoke_v0_1',
    generatedAt: new Date().toISOString(),
    status: pass ? 'pass_g0_paid_smoke' : 'fail_g0_paid_smoke',
    boundary: 'bounded paid-quota G0 smoke only; not a full G0 gate and not a G1 yoked-contingency result',
    preregistration: PREREGISTRATION_BY_PROTOCOL[proseProtocol],
    backend: canonicalBackend(backend),
    backendDetail: backendDetail(backend),
    classifier: canonicalBackend(classifier),
    classifierDetail: backendDetail(classifier),
    proseProtocol,
    proseProtocolDescription: PROSE_PROTOCOLS[proseProtocol],
    sessions: rows,
    thresholds: {
      proseRecallThreshold,
      requiredBehaviorExactSessions: rows.length,
      requiredDirectFamilyLabelHits: 0,
      requiredReasoningLeakHits: 0,
    },
    summary: {
      sessionCount: rows.length,
      itemsPerSession,
      modelCalls: callCounter.counts,
      behaviorExactSessions,
      meanProseRecall: Number(meanProseRecall.toFixed(3)),
      directLabelLeakCount,
      reasoningLeakCount,
    },
  };
}

export function renderG0PaidSmokeReport(result) {
  const lines = [];
  lines.push('# Yoked-contingency G0 paid smoke');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Status: ${result.status}`);
  lines.push('');
  lines.push(
    'Boundary: this is a bounded paid-quota G0 smoke only, not the full G0 gate and not the G1 yoked-contingency experiment.',
  );
  lines.push('');
  lines.push(`Preregistration: ${result.preregistration}`);
  lines.push(`Generator: ${result.backend}`);
  if (result.backendDetail?.label && result.backendDetail.label !== result.backend) {
    lines.push(`Generator detail: ${result.backendDetail.label}`);
  }
  lines.push(`Prose-only classifier: ${result.classifier}`);
  if (result.classifierDetail?.label && result.classifierDetail.label !== result.classifier) {
    lines.push(`Classifier detail: ${result.classifierDetail.label}`);
  }
  lines.push(`Prose protocol: ${result.proseProtocol}`);
  lines.push(`Model calls: ${result.summary.modelCalls.total}`);
  lines.push('');
  lines.push('## Pass rule');
  lines.push('');
  lines.push(`- Behavior exact sessions: ${result.summary.behaviorExactSessions}/${result.summary.sessionCount}`);
  lines.push(
    `- Mean prose recall: ${fmt(result.summary.meanProseRecall)} (threshold <= ${fmt(
      result.thresholds.proseRecallThreshold,
    )})`,
  );
  lines.push(`- Exact hidden family label leaks: ${result.summary.directLabelLeakCount}`);
  lines.push(`- Visible arithmetic-rationale leaks: ${result.summary.reasoningLeakCount}`);
  lines.push('');
  lines.push('## Sessions');
  lines.push('');
  lines.push(
    '| Session | Seed | Active families | Behavior recovered | Prose recovered | Prose recall | Label leaks | Reasoning leaks |',
  );
  lines.push('|---|---|---|---|---|---:|---|---|');
  for (const row of result.sessions) {
    lines.push(
      `| ${row.sessionId} | ${row.seedId} | ${row.activeFamilies.join(', ')} | ${row.behaviorRecoveredActiveFamilies.join(
        ', ',
      )} | ${row.proseRecoveredActiveFamilies.join(', ') || 'none'} | ${fmt(row.proseRecall)} | ${
        row.directFamilyLabelHits.join(', ') || 'none'
      } | ${row.reasoningLeakHits.join(', ') || 'none'} |`,
    );
  }
  lines.push('');
  lines.push('## Read');
  lines.push('');
  if (result.status === 'pass_g0_paid_smoke') {
    lines.push(
      'The smoke supports proceeding to a fuller G0 gate: behavior is diagnosable while the visible prose did not recover active seeded families under this bounded sample.',
    );
  } else {
    lines.push(
      'Do not run G1 from this result. The smoke did not establish opaque-but-diagnosable seeded learners under the frozen rule.',
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function writeG0PaidSmokeArtifacts({ result, outJson = DEFAULTS.outJson, outMd = DEFAULTS.outMd }) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(result, null, 2)}\n`);
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, renderG0PaidSmokeReport(result));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runG0PaidSmoke(args);
  if (args.write) {
    writeG0PaidSmokeArtifacts({
      result,
      outJson: path.resolve(args.outJson),
      outMd: path.resolve(args.outMd),
    });
    console.log(`wrote ${args.outJson}`);
    console.log(`wrote ${args.outMd}`);
  }
  console.log(
    `${result.status}: behaviorExact=${result.summary.behaviorExactSessions}/${result.summary.sessionCount} meanProseRecall=${fmt(result.summary.meanProseRecall)} calls=${result.summary.modelCalls.total}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
