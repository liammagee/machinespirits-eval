#!/usr/bin/env node
/**
 * Audit and reconstruct API message chains for evaluation runs/results.
 *
 * For each API exchange, emits:
 *   - system_prompt   (observed or reconstructed)
 *   - user_request    (observed or reconstructed)
 *   - api_response    (observed from trace)
 *
 * Usage:
 *   node scripts/audit-message-chain.js --result-id <id>
 *   node scripts/audit-message-chain.js --run-id <runId> [--scenario <id>] [--profile <name>] [--limit <n>]
 *
 * Options:
 *   --result-id <id>       Audit one evaluation_results row
 *   --run-id <id>          Audit all dialogue rows in a run (filtered by --scenario/--profile)
 *   --scenario <id>        Optional scenario filter (run mode)
 *   --profile <name>       Optional profile filter (run mode)
 *   --limit <n>            Max rows in run mode (default: unlimited)
 *   --include-learner      Include learner internal API calls (learner_*)
 *   --full-prompts         Include full reconstructed prompt text (default: excerpt)
 *   --line-mode            Compact dialogue view: Sys/User/Assistant lines per exchange
 *   --max-chars <n>        Excerpt length for text mode and compact JSON fields (default: 1200)
 *   --system-prompt-max-chars <n>  Excerpt length for system prompts only (default: 240)
 *   --show-raw-api         Include raw API request/response payload excerpts
 *   --raw-api-max-chars <n> Excerpt length for raw API payload blocks (default: 220)
 *   --no-color             Disable ANSI colors in text output
 *   --json                 Emit JSON instead of human-readable text
 *   --out <path>           Write output to a file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import Database from 'better-sqlite3';
import chalk from 'chalk';
import YAML from 'yaml';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import { buildMessageChain } from '../services/evaluationRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.EVAL_DB_PATH || path.join(ROOT, 'data', 'evaluations.db');
const DIALOGUE_LOGS_DIR = path.join(ROOT, 'logs', 'tutor-dialogues');
const LOCAL_PROMPTS_DIR = path.join(ROOT, 'prompts');
const LEARNER_CONFIG_PATH = path.join(ROOT, 'config', 'learner-agents.yaml');

const args = process.argv.slice(2);

function getFlag(name) {
  return args.includes(`--${name}`);
}

function getOption(name, defaultValue = null) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

function parseInteger(value, fallback = null) {
  if (value == null) return fallback;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function usageAndExit(message = null, code = 1) {
  if (message) console.error(`Error: ${message}\n`);
  console.error('Usage:');
  console.error(
    '  node scripts/audit-message-chain.js --result-id <id> [--json] [--line-mode] [--show-raw-api] [--raw-api-max-chars <n>] [--no-color] [--system-prompt-max-chars <n>] [--out <path>]',
  );
  console.error(
    '  node scripts/audit-message-chain.js --run-id <runId> [--scenario <id>] [--profile <name>] [--limit <n>] [--include-learner] [--json] [--line-mode] [--show-raw-api] [--raw-api-max-chars <n>] [--no-color] [--system-prompt-max-chars <n>] [--out <path>]',
  );
  process.exit(code);
}

const resultId = getOption('result-id');
const runId = getOption('run-id');
const scenarioFilter = getOption('scenario');
const profileFilter = getOption('profile');
const limit = parseInteger(getOption('limit'));
const includeLearner = getFlag('include-learner');
const fullPrompts = getFlag('full-prompts');
const lineMode = getFlag('line-mode');
const showRawApi = getFlag('show-raw-api') || lineMode;
const jsonMode = getFlag('json');
const outPath = getOption('out');
const maxChars = parseInteger(getOption('max-chars'), 1200);
const systemPromptMaxChars = parseInteger(getOption('system-prompt-max-chars'), 240);
const rawApiMaxChars = parseInteger(getOption('raw-api-max-chars'), 220);
const noColor = getFlag('no-color');
const colorEnabled = !jsonMode && !noColor && process.stdout.isTTY && !process.env.NO_COLOR && !outPath;
const C = {
  title: (s) => (colorEnabled ? chalk.bold.cyan(s) : s),
  key: (s) => (colorEnabled ? chalk.bold.white(s) : s),
  meta: (s) => (colorEnabled ? chalk.gray(s) : s),
  ok: (s) => (colorEnabled ? chalk.green(s) : s),
  warn: (s) => (colorEnabled ? chalk.yellow(s) : s),
  bad: (s) => (colorEnabled ? chalk.red(s) : s),
  seq: (s) => (colorEnabled ? chalk.bold.blue(s) : s),
  divider: (s) => (colorEnabled ? chalk.gray(s) : s),
};

if (!resultId && !runId) {
  usageAndExit('Provide either --result-id or --run-id.');
}
if (resultId && runId) {
  usageAndExit('Use exactly one of --result-id or --run-id.');
}

function clip(text, n = 1200) {
  if (text == null) return null;
  const str = String(text);
  if (str.length <= n) return str;
  return `${str.slice(0, n)}... [truncated ${str.length - n} chars]`;
}

function compactValue(value, maxChars = 1200) {
  if (value == null) return null;
  if (typeof value === 'string') return clip(value, maxChars);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => compactValue(v, maxChars));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = compactValue(v, maxChars);
  }
  return out;
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function findTutorCorePromptsDir() {
  try {
    const req = createRequire(import.meta.url);
    const tutorCorePkg = req.resolve('@machinespirits/tutor-core/package.json');
    const tutorCoreDir = path.dirname(tutorCorePkg);
    const promptsDir = path.join(tutorCoreDir, 'prompts');
    if (fs.existsSync(promptsDir)) return promptsDir;
  } catch {
    /* ignore */
  }

  const localDevPath = path.resolve(ROOT, '..', 'machinespirits-tutor-core', 'prompts');
  if (fs.existsSync(localDevPath)) return localDevPath;

  return null;
}

const promptDirs = [];
if (fs.existsSync(LOCAL_PROMPTS_DIR)) promptDirs.push(LOCAL_PROMPTS_DIR);
const tutorCorePromptsDir = findTutorCorePromptsDir();
if (tutorCorePromptsDir) promptDirs.push(tutorCorePromptsDir);

function readPromptFile(promptFile) {
  if (!promptFile) return null;
  for (const dir of promptDirs) {
    const fullPath = path.join(dir, promptFile);
    if (fs.existsSync(fullPath)) {
      try {
        return {
          promptFile,
          path: fullPath,
          text: fs.readFileSync(fullPath, 'utf8'),
          source: dir === LOCAL_PROMPTS_DIR ? 'eval/prompts' : 'tutor-core/prompts',
        };
      } catch {
        return {
          promptFile,
          path: fullPath,
          text: null,
          source: dir === LOCAL_PROMPTS_DIR ? 'eval/prompts' : 'tutor-core/prompts',
          error: 'read_failed',
        };
      }
    }
  }
  return {
    promptFile,
    path: null,
    text: null,
    source: 'missing',
    error: 'not_found',
  };
}

function loadLearnerConfig() {
  try {
    const content = fs.readFileSync(LEARNER_CONFIG_PATH, 'utf8');
    return YAML.parse(content);
  } catch {
    return {};
  }
}

const learnerConfig = loadLearnerConfig();

function getLearnerProfile(learnerArchitecture) {
  const profiles = learnerConfig?.profiles || {};
  if (!learnerArchitecture) return profiles.unified || null;
  return profiles[learnerArchitecture] || profiles.unified || null;
}

function resolveSystemPromptSource({ agent, resultRow, priorExtensions }) {
  const tutorProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[resultRow.profile_name] || {};
  const learnerProfile = getLearnerProfile(resultRow.learner_architecture);

  let promptFile = null;
  let role = null;
  if (agent === 'ego') {
    promptFile = tutorProfile?.ego?.prompt_file || null;
    role = 'tutor_ego';
  } else if (agent === 'superego') {
    promptFile = tutorProfile?.superego?.prompt_file || null;
    role = 'tutor_superego';
  } else if (agent === 'learner_ego_initial' || agent === 'learner_ego_revision') {
    promptFile = learnerProfile?.ego?.prompt_file || learnerProfile?.unified_learner?.prompt_file || null;
    role = 'learner_ego';
  } else if (agent === 'learner_superego') {
    promptFile = learnerProfile?.superego?.prompt_file || null;
    role = 'learner_superego';
  } else if (agent === 'learner_synthesis') {
    promptFile = learnerProfile?.synthesis?.prompt_file || learnerProfile?.unified_learner?.prompt_file || null;
    role = 'learner_synthesis';
  }

  const promptObj = readPromptFile(promptFile);
  const extensionText = (priorExtensions || []).map((e) => e.detail || '').filter(Boolean).join('\n\n');
  const hasExtensions = extensionText.length > 0;

  if (!promptObj || !promptObj.text) {
    return {
      status: 'missing',
      role,
      prompt_file: promptFile,
      source: promptObj?.source || 'unknown',
      text: hasExtensions ? extensionText : null,
      note: hasExtensions ? 'base prompt missing, only dynamic extension candidates available' : 'prompt unavailable',
    };
  }

  const combined = hasExtensions ? `${promptObj.text}\n\n${extensionText}` : promptObj.text;
  return {
    status: hasExtensions ? 'reconstructed' : 'observed',
    role,
    prompt_file: promptObj.promptFile,
    source: promptObj.source,
    path: promptObj.path,
    text: combined,
    note: hasExtensions ? 'includes dynamic extension candidates inferred from prior trace entries' : null,
  };
}

function normalizeResponseText(entry) {
  if (entry.agent === 'superego' && entry.action === 'review') {
    return entry.feedback || entry.verdict?.feedback || safeJson(entry.verdict || {});
  }
  if (Array.isArray(entry.suggestions) && entry.suggestions.length > 0) {
    return entry.suggestions
      .map((s, i) => {
        const body = s.message || s.title || safeJson(s);
        return `[Suggestion ${i + 1}] ${body}`;
      })
      .join('\n');
  }
  if (Array.isArray(entry.output) && entry.output.length > 0) {
    return safeJson(entry.output);
  }
  if (entry.detail) return entry.detail;
  if (entry.contextSummary) return entry.contextSummary;
  if (entry.metrics?.text) return entry.metrics.text;
  return safeJson(entry);
}

function extractContentField(content) {
  if (content == null) return null;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        if (typeof item?.content === 'string') return item.content;
        return null;
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join('\n') : null;
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }
  return safeJson(content);
}

function readApiPayload(entry) {
  return entry?.apiPayload || entry?.api_payload || null;
}

function extractSystemPromptFromRequestBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (typeof body.system === 'string') return body.system;
  if (typeof body.systemInstruction === 'string') return body.systemInstruction;
  if (typeof body.systemInstruction?.text === 'string') return body.systemInstruction.text;
  if (Array.isArray(body.messages)) {
    const systemTexts = body.messages
      .filter((m) => m?.role === 'system')
      .map((m) => extractContentField(m?.content))
      .filter(Boolean);
    if (systemTexts.length > 0) return systemTexts.join('\n\n');
  }
  return null;
}

function extractUserRequestFromRequestBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (Array.isArray(body.messages)) {
    const userTexts = body.messages
      .filter((m) => m?.role === 'user')
      .map((m) => extractContentField(m?.content))
      .filter(Boolean);
    if (userTexts.length > 0) return userTexts.join('\n\n');
  }
  if (Array.isArray(body.contents)) {
    const userTexts = body.contents
      .map((c) => {
        if (Array.isArray(c?.parts)) return c.parts.map((p) => p?.text).filter(Boolean).join('\n');
        return extractContentField(c?.content || c?.text || null);
      })
      .filter(Boolean);
    if (userTexts.length > 0) return userTexts.join('\n\n');
  }
  return null;
}

function extractResponseTextFromResponseBody(body) {
  if (body == null) return null;
  if (typeof body === 'string') return body;
  if (typeof body !== 'object') return safeJson(body);

  if (Array.isArray(body.choices) && body.choices.length > 0) {
    const first = body.choices[0];
    const content = first?.message?.content ?? first?.delta?.content ?? first?.text ?? null;
    const text = extractContentField(content);
    if (text) return text;
  }

  if (Array.isArray(body.content) && body.content.length > 0) {
    const text = extractContentField(body.content);
    if (text) return text;
  }

  if (typeof body.output_text === 'string') return body.output_text;
  if (body.candidates?.[0]?.content?.parts) {
    const parts = body.candidates[0].content.parts.map((p) => p?.text).filter(Boolean);
    if (parts.length > 0) return parts.join('\n');
  }

  if (typeof body.text === 'string') return body.text;
  return safeJson(body);
}

function tryParseJsonString(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractPrimaryMessage(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const parsed = tryParseJsonString(value);
    if (!parsed) return value;
    return extractPrimaryMessage(parsed);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const first = value[0];
    if (typeof first?.message === 'string') return first.message;
    if (typeof first?.content === 'string') return first.content;
    if (typeof first?.text === 'string') return first.text;
    return extractPrimaryMessage(first);
  }
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.text === 'string') return value.text;
    if (Array.isArray(value.candidate_suggestions) && value.candidate_suggestions.length > 0) {
      const msg = extractPrimaryMessage(value.candidate_suggestions[0]);
      if (msg) return msg;
    }
    if (Array.isArray(value.suggestions) && value.suggestions.length > 0) {
      const msg = extractPrimaryMessage(value.suggestions[0]);
      if (msg) return msg;
    }
    if (Array.isArray(value.choices) && value.choices.length > 0) {
      const choice = value.choices[0];
      const msg = extractPrimaryMessage(choice?.message || choice?.delta || choice?.text || null);
      if (msg) return msg;
    }
  }
  return null;
}

function extractObservedPayloadSegments(entry) {
  const payload = readApiPayload(entry);
  if (!payload || typeof payload !== 'object') return null;

  const requestBody = payload.request?.body ?? null;
  const responseBody = payload.response?.body ?? null;
  const systemPrompt = extractSystemPromptFromRequestBody(requestBody);
  const userRequest = extractUserRequestFromRequestBody(requestBody);
  const responseText = extractResponseTextFromResponseBody(responseBody);

  return {
    payload,
    systemPrompt,
    userRequest,
    responseText,
  };
}

function findLastIndex(trace, startIdx, predicate) {
  for (let i = startIdx; i >= 0; i--) {
    if (predicate(trace[i])) return i;
  }
  return -1;
}

function collectPriorExtensions(trace, idx, agent) {
  const out = [];
  const extensionAgentsForEgo = new Set(['ego_self_reflection', 'ego_intersubjective', 'ego_strategy']);
  const extensionAgentsForSuperego = new Set(['superego_self_reflection', 'superego_disposition']);

  const extensionAgents =
    agent === 'ego'
      ? extensionAgentsForEgo
      : agent === 'superego'
        ? extensionAgentsForSuperego
        : new Set();

  if (extensionAgents.size === 0) return out;

  for (let i = idx - 1; i >= 0; i--) {
    const entry = trace[i];
    if (!entry || !extensionAgents.has(entry.agent)) continue;
    out.push({
      trace_index: i,
      agent: entry.agent,
      action: entry.action,
      detail: entry.detail || entry.contextSummary || '',
      timestamp: entry.timestamp || null,
    });
    if (out.length >= 3) break;
  }

  return out.reverse();
}

function deriveUserRequest(trace, idx, entry) {
  if (entry.agent === 'ego') {
    const contextIdx = findLastIndex(trace, idx - 1, (e) => e.agent === 'user' && e.action === 'context_input');
    if (contextIdx !== -1) {
      return {
        status: 'observed',
        source: 'trace:user/context_input',
        trace_index: contextIdx,
        text: trace[contextIdx].rawContext || trace[contextIdx].contextSummary || null,
      };
    }
    return {
      status: 'missing',
      source: 'trace:user/context_input',
      trace_index: null,
      text: null,
      note: 'No preceding context_input entry found for ego call.',
    };
  }

  if (entry.agent === 'superego') {
    const draftIdx = findLastIndex(
      trace,
      idx - 1,
      (e) => e.agent === 'ego' && (e.action === 'generate' || e.action === 'revise'),
    );
    if (draftIdx !== -1) {
      const draft = trace[draftIdx];
      return {
        status: 'reconstructed',
        source: 'trace:prior_ego_draft',
        trace_index: draftIdx,
        text: safeJson({
          candidate_suggestions: draft.suggestions || draft.output || null,
          reasoning: 'Superego review request reconstructed from prior ego draft.',
        }),
      };
    }
    return {
      status: 'missing',
      source: 'trace:prior_ego_draft',
      trace_index: null,
      text: null,
      note: 'No prior ego draft found before superego review.',
    };
  }

  if (entry.agent.startsWith('learner_')) {
    const tutorIdx = findLastIndex(
      trace,
      idx - 1,
      (e) => e.agent === 'ego' && (e.action === 'generate' || e.action === 'revise'),
    );
    if (tutorIdx !== -1) {
      const tutorEntry = trace[tutorIdx];
      const tutorMsg = Array.isArray(tutorEntry.suggestions) && tutorEntry.suggestions.length > 0
        ? tutorEntry.suggestions[0]?.message || tutorEntry.suggestions[0]?.title
        : tutorEntry.detail || tutorEntry.contextSummary || null;
      return {
        status: 'reconstructed',
        source: 'trace:prior_tutor_output',
        trace_index: tutorIdx,
        text: tutorMsg,
      };
    }
    return {
      status: 'missing',
      source: 'trace:prior_tutor_output',
      trace_index: null,
      text: null,
      note: 'No prior tutor output found before learner call.',
    };
  }

  return {
    status: 'missing',
    source: 'unknown',
    trace_index: null,
    text: null,
    note: 'No request reconstruction rule for this agent/action.',
  };
}

function isApiTraceEntry(entry, includeLearnerCalls) {
  if (!entry || !entry.agent || !entry.action) return false;
  if (entry.agent === 'ego' && (entry.action === 'generate' || entry.action === 'revise')) return true;
  if (entry.agent === 'superego' && entry.action === 'review') return true;
  if (
    includeLearnerCalls &&
    entry.agent.startsWith('learner_') &&
    (entry.action === 'deliberation' || entry.action === 'response')
  ) {
    return true;
  }
  return false;
}

function classifyDialogueChannel(entry) {
  if (!entry || !entry.agent) return 'unknown';

  if (entry.agent === 'superego') return 'tutor_ego_superego';

  if (entry.agent === 'ego') {
    // Ego interacting with superego during internal deliberation
    if (entry.to === 'superego' || entry.direction === 'request') return 'tutor_ego_superego';
    // Ego output directed outward (single-agent mode, or final incorporated output)
    if (entry.to === 'user' || entry.direction === 'response') return 'tutor_learner';
    return 'tutor_ego_superego';
  }

  if (entry.agent.startsWith('learner_')) {
    // Learner internal deliberation chain
    if (entry.action === 'deliberation') return 'learner_ego_superego';
    // Learner synthesized outward response
    if (entry.action === 'response') return 'tutor_learner';
    return 'learner_ego_superego';
  }

  return 'unknown';
}

function loadDialogueLog(dialogueId) {
  if (!dialogueId) return null;
  const direct = path.join(DIALOGUE_LOGS_DIR, `${dialogueId}.json`);
  if (fs.existsSync(direct)) {
    return { path: direct, json: JSON.parse(fs.readFileSync(direct, 'utf8')) };
  }
  const files = fs.readdirSync(DIALOGUE_LOGS_DIR).filter((f) => f.includes(dialogueId) && f.endsWith('.json'));
  if (files.length === 0) return null;
  const fp = path.join(DIALOGUE_LOGS_DIR, files[0]);
  return { path: fp, json: JSON.parse(fs.readFileSync(fp, 'utf8')) };
}

function buildExchangesForResult(resultRow, dialogueLog, options = {}) {
  const { includeLearnerCalls = false } = options;
  const trace = Array.isArray(dialogueLog?.dialogueTrace) ? dialogueLog.dialogueTrace : [];
  const exchanges = [];

  for (let i = 0; i < trace.length; i++) {
    const entry = trace[i];
    if (!isApiTraceEntry(entry, includeLearnerCalls)) continue;

    const priorExtensions = collectPriorExtensions(trace, i, entry.agent);
    const payloadSegments = extractObservedPayloadSegments(entry);

    const fallbackSystemPrompt = resolveSystemPromptSource({
      agent: entry.agent,
      resultRow,
      priorExtensions,
    });
    const systemPrompt = payloadSegments?.systemPrompt
      ? {
          status: 'observed',
          role: fallbackSystemPrompt?.role || null,
          prompt_file: fallbackSystemPrompt?.prompt_file || null,
          source: 'trace:api_payload',
          text: payloadSegments.systemPrompt,
          note: 'Observed directly from API request payload',
        }
      : fallbackSystemPrompt;

    const fallbackUserRequest = deriveUserRequest(trace, i, entry);
    const userRequest = payloadSegments?.userRequest
      ? {
          status: 'observed',
          source: 'trace:api_payload',
          trace_index: i,
          text: payloadSegments.userRequest,
          note: 'Observed directly from API request payload',
        }
      : fallbackUserRequest;

    const responseText = payloadSegments?.responseText || normalizeResponseText(entry);
    const apiResponseSource = payloadSegments?.responseText ? 'trace:api_payload' : 'trace';

    exchanges.push({
      sequence: exchanges.length + 1,
      trace_index: i,
      agent: entry.agent,
      action: entry.action,
      dialogue_channel: classifyDialogueChannel(entry),
      turn_index: entry.turnIndex ?? null,
      round: entry.round ?? null,
      timestamp: entry.timestamp || null,
      model: entry.metrics?.model || entry.model || null,
      provider: entry.metrics?.provider || entry.provider || null,
      latency_ms: entry.latencyMs || entry.metrics?.latencyMs || null,
      token_usage: {
        input: entry.metrics?.inputTokens ?? null,
        output: entry.metrics?.outputTokens ?? null,
      },
      system_prompt: systemPrompt,
      user_request: userRequest,
      api_response: {
        status: 'observed',
        source: apiResponseSource,
        text: responseText,
      },
      api_payload: payloadSegments?.payload || null,
      dynamic_extensions: priorExtensions,
    });
  }

  const gaps = [];
  const missingSystem = exchanges.filter((e) => e.system_prompt?.status === 'missing').length;
  const missingUser = exchanges.filter((e) => e.user_request?.status === 'missing').length;
  if (missingSystem > 0) gaps.push(`${missingSystem} exchange(s) missing system prompt reconstruction.`);
  if (missingUser > 0) gaps.push(`${missingUser} exchange(s) missing user-request reconstruction.`);

  const dialogueChannelCounts = exchanges.reduce((acc, ex) => {
    const key = ex.dialogue_channel || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    trace_count: trace.length,
    exchange_count: exchanges.length,
    dialogue_channel_counts: dialogueChannelCounts,
    exchanges,
    gaps,
  };
}

function colorStatus(status) {
  const s = status || 'unknown';
  if (s === 'observed') return C.ok(s);
  if (s === 'reconstructed') return C.warn(s);
  if (s === 'missing') return C.bad(s);
  return C.meta(s);
}

function colorChannel(channel) {
  const c = channel || 'unknown';
  if (c === 'tutor_ego_superego') return C.title(c);
  if (c === 'learner_ego_superego') return C.warn(c);
  if (c === 'tutor_learner') return C.ok(c);
  return C.meta(c);
}

function indentBlock(text, indent = '    ') {
  if (text == null || text === '') return `${indent}(missing)`;
  return String(text)
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
}

function channelSceneTitle(channel) {
  if (channel === 'tutor_ego_superego') return 'Scene: Tutor Ego ↔ Superego';
  if (channel === 'learner_ego_superego') return 'Scene: Learner Ego ↔ Superego';
  if (channel === 'tutor_learner') return 'Scene: Tutor ↔ Learner';
  return `Scene: ${channel || 'unknown'}`;
}

function valueToExcerpt(value, maxChars = 220) {
  if (value == null) return null;
  if (typeof value === 'string') return clip(value, maxChars);
  return clip(safeJson(value), maxChars);
}

function pushRawApiBlock(lines, ex, maxChars = 220, baseIndent = '', contentOnly = false) {
  lines.push(`${baseIndent}${C.key('Raw API:')}`);
  if (!ex.api_payload) {
    lines.push(`${baseIndent}  ${C.meta('(unavailable for this exchange)')}`);
    return;
  }

  const endpoint = ex.api_payload.endpoint || '?';
  const method = ex.api_payload.request?.method || 'POST';
  const requestBodyObj = ex.api_payload.request?.body ?? null;
  const responseBodyObj = ex.api_payload.response?.body ?? null;

  lines.push(`${baseIndent}  ${C.meta(`${method} ${endpoint}`)}`);
  if (contentOnly) {
    const reqSystem = extractSystemPromptFromRequestBody(requestBodyObj);
    const reqUser = extractUserRequestFromRequestBody(requestBodyObj);
    const respAssistant = extractResponseTextFromResponseBody(responseBodyObj);

    lines.push(`${baseIndent}  ${C.key('Req Sys:')}`);
    lines.push(indentBlock(clip(reqSystem || '(missing)', maxChars), `${baseIndent}    `));
    lines.push(`${baseIndent}  ${C.key('Req User:')}`);
    lines.push(indentBlock(clip(reqUser || '(missing)', maxChars), `${baseIndent}    `));
    lines.push(`${baseIndent}  ${C.key('Res Assistant:')}`);
    lines.push(indentBlock(clip(respAssistant || '(missing)', maxChars), `${baseIndent}    `));
    return;
  }

  const requestBody = valueToExcerpt(requestBodyObj, maxChars) || '(missing)';
  const responseBody = valueToExcerpt(responseBodyObj, maxChars) || '(missing)';
  lines.push(`${baseIndent}  ${C.key('Request:')}`);
  lines.push(indentBlock(requestBody, `${baseIndent}    `));
  lines.push(`${baseIndent}  ${C.key('Response:')}`);
  lines.push(indentBlock(responseBody, `${baseIndent}    `));
}

function formatTextReport(
  audit,
  maxTextChars = 1200,
  showFullPrompts = false,
  systemPromptChars = 240,
  includeRawApi = false,
  rawApiChars = 220,
) {
  const lines = [];
  lines.push(
    `${C.key('Result')} ${audit.result.id} | run=${audit.result.run_id} | profile=${audit.result.profile_name} | scenario=${audit.result.scenario_id}`,
  );
  lines.push(`${C.key('Dialogue')} ${audit.result.dialogue_id}`);
  lines.push(`${C.key('Log')} ${audit.log_path || '(missing)'}`);
  lines.push(`${C.key('Conversation Mode')} ${audit.conversation_mode || C.meta('(unknown)')}`);
  lines.push(
    `${C.key('Exchanges')} ${audit.exchange_count} | trace=${audit.trace_count} | includeLearner=${audit.include_learner_calls ? C.ok('yes') : C.meta('no')}`,
  );
  const channelSummary = Object.entries(audit.dialogue_channel_counts || {})
    .map(([k, v]) => `${colorChannel(k)}=${v}`)
    .join(', ');
  lines.push(`${C.key('Channels')} ${channelSummary || '(none)'}`);
  if (audit.conversation_history) {
    lines.push(`${C.key('Conversation History')} ${audit.conversation_history.length} turn(s) stored`);
  }
  if (audit.tutor_message_chain) {
    lines.push(`${C.key('Tutor Message Chain')} ${audit.tutor_message_chain.length} message(s) derived`);
  }
  if (audit.gaps.length > 0) {
    lines.push(`${C.bad('Gaps')} ${audit.gaps.join(' ')}`);
  }
  lines.push('');

  const channelOrder = ['tutor_ego_superego', 'learner_ego_superego', 'tutor_learner', 'unknown'];
  const grouped = new Map();
  for (const ex of audit.exchanges) {
    const key = ex.dialogue_channel || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(ex);
  }

  const renderExchange = (ex) => {
    lines.push(
      `${C.seq(`[${ex.sequence}]`)} ${C.meta('[')}${colorChannel(ex.dialogue_channel || 'unknown')}${C.meta(']')} ${ex.agent}/${ex.action} turn=${ex.turn_index ?? '-'} model=${ex.model || '?'} provider=${ex.provider || '?'} latency=${ex.latency_ms ?? '?'}ms`,
    );

    const sysText = ex.system_prompt?.text || null;
    const sysShown = showFullPrompts ? sysText : clip(sysText, systemPromptChars);
    lines.push(
      `${C.key('SYSTEM_PROMPT')} (${colorStatus(ex.system_prompt?.status || 'missing')} | ${C.meta(ex.system_prompt?.source || 'unknown')}):`,
    );
    lines.push(sysShown || C.bad('(missing)'));

    const reqText = ex.user_request?.text || null;
    lines.push(
      `${C.key('USER_REQUEST')} (${colorStatus(ex.user_request?.status || 'missing')} | ${C.meta(ex.user_request?.source || 'unknown')}):`,
    );
    lines.push(clip(reqText, maxTextChars) || C.bad('(missing)'));

    const respText = ex.api_response?.text || null;
    lines.push(
      `${C.key('API_RESPONSE')} (${colorStatus(ex.api_response?.status || 'unknown')} | ${C.meta(ex.api_response?.source || 'unknown')}):`,
    );
    lines.push(clip(respText, maxTextChars) || C.bad('(missing)'));
    lines.push(`${C.key('PAYLOAD_CAPTURE')} ${ex.api_payload ? C.ok('yes') : C.warn('no')}`);
    if (includeRawApi) {
      pushRawApiBlock(lines, ex, rawApiChars);
    }
    lines.push(C.divider('-'.repeat(88)));
    lines.push('');
  };

  for (const channel of channelOrder) {
    const items = grouped.get(channel) || [];
    if (items.length === 0) continue;
    lines.push(`${C.key('=== CHANNEL ===')} ${colorChannel(channel)} ${C.meta(`(${items.length})`)}`);
    lines.push('');
    for (const ex of items) renderExchange(ex);
  }

  return lines.join('\n');
}

function formatLineModeReport(
  audit,
  maxTextChars = 1200,
  showFullPrompts = false,
  systemPromptChars = 240,
  includeRawApi = true,
  rawApiChars = 220,
) {
  const lines = [];
  lines.push(
    `${C.key('Result')} ${audit.result.id} | run=${audit.result.run_id} | profile=${audit.result.profile_name} | scenario=${audit.result.scenario_id}`,
  );
  lines.push(`${C.key('Dialogue')} ${audit.result.dialogue_id}`);
  lines.push(`${C.key('Log')} ${audit.log_path || '(missing)'}`);
  lines.push(`${C.key('Conversation Mode')} ${audit.conversation_mode || C.meta('(unknown)')}`);
  lines.push(
    `${C.key('Exchanges')} ${audit.exchange_count} | trace=${audit.trace_count} | includeLearner=${audit.include_learner_calls ? C.ok('yes') : C.meta('no')}`,
  );
  if (audit.conversation_history) {
    lines.push(`${C.key('Conversation History')} ${audit.conversation_history.length} turn(s) stored`);
  }
  lines.push('');

  const channelOrder = ['tutor_ego_superego', 'learner_ego_superego', 'tutor_learner', 'unknown'];
  const grouped = new Map();
  for (const ex of audit.exchanges) {
    const key = ex.dialogue_channel || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(ex);
  }

  for (const channel of channelOrder) {
    const items = grouped.get(channel) || [];
    if (items.length === 0) continue;
    lines.push(`${C.key(channelSceneTitle(channel))} ${C.meta(`(${items.length} exchange${items.length === 1 ? '' : 's'})`)}`);
    lines.push(`${C.divider('  ' + '─'.repeat(72))}`);
    lines.push('');

    for (const ex of items) {
      const sysText = ex.system_prompt?.text || null;
      const sysShown = showFullPrompts ? sysText : clip(sysText, systemPromptChars);
      const reqRaw = ex.user_request?.text || null;
      const respRaw = ex.api_response?.text || null;
      const reqText = extractPrimaryMessage(reqRaw) || reqRaw;
      const respText = extractPrimaryMessage(respRaw) || respRaw;

      lines.push(
        `${C.seq(`[${ex.sequence}]`)} ${C.meta(`${ex.agent}/${ex.action}`)} ${C.meta(`turn=${ex.turn_index ?? '-'}`)} ${C.meta(`model=${ex.model || '?'}`)}`,
      );
      lines.push(`  ${C.key('Semantic:')}`);
      lines.push(`  ${C.key('Sys:')}`);
      lines.push(indentBlock(sysShown || C.bad('(missing)'), '    '));
      lines.push(`  ${C.key('User:')}`);
      lines.push(indentBlock(clip(reqText, maxTextChars) || C.bad('(missing)'), '    '));
      lines.push(`  ${C.key('Assistant:')}`);
      lines.push(indentBlock(clip(respText, maxTextChars) || C.bad('(missing)'), '    '));
      if (includeRawApi) {
        // Line mode favors readability: show only content-bearing message fields from raw payload.
        pushRawApiBlock(lines, ex, rawApiChars, '  ', true);
      }
      lines.push('');
    }
  }

  if (audit.gaps.length > 0) {
    lines.push(`${C.bad('Gaps')} ${audit.gaps.join(' ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

function compactForJson(auditObj, maxTextChars = 1200, showFullPrompts = false, systemPromptChars = 240) {
  if (showFullPrompts) return auditObj;

  const out = structuredClone(auditObj);
  for (const ex of out.exchanges || []) {
    if (ex.system_prompt?.text) ex.system_prompt.text = clip(ex.system_prompt.text, systemPromptChars);
    if (ex.user_request?.text) ex.user_request.text = clip(ex.user_request.text, maxTextChars);
    if (ex.api_response?.text) ex.api_response.text = clip(ex.api_response.text, maxTextChars);
    if (ex.api_payload) ex.api_payload = compactValue(ex.api_payload, maxTextChars);
    if (Array.isArray(ex.dynamic_extensions)) {
      ex.dynamic_extensions = ex.dynamic_extensions.map((d) => ({
        ...d,
        detail: clip(d.detail, maxTextChars),
      }));
    }
  }
  return out;
}

function queryResults(db) {
  if (resultId) {
    const row = db
      .prepare(
        `
        SELECT id, run_id, scenario_id, profile_name, dialogue_id, provider, model,
               ego_model, superego_model, learner_architecture, conversation_mode, created_at
        FROM evaluation_results
        WHERE id = ?
      `,
      )
      .get(resultId);
    if (!row) usageAndExit(`Result not found: ${resultId}`);
    return [row];
  }

  const where = ['run_id = ?', 'dialogue_id IS NOT NULL'];
  const params = [runId];
  if (scenarioFilter) {
    where.push('scenario_id = ?');
    params.push(scenarioFilter);
  }
  if (profileFilter) {
    where.push('profile_name = ?');
    params.push(profileFilter);
  }
  let sql = `
    SELECT id, run_id, scenario_id, profile_name, dialogue_id, provider, model,
           ego_model, superego_model, learner_architecture, conversation_mode, created_at
    FROM evaluation_results
    WHERE ${where.join(' AND ')}
    ORDER BY created_at ASC
  `;
  if (Number.isFinite(limit) && limit > 0) {
    sql += ` LIMIT ${limit}`;
  }
  const rows = db.prepare(sql).all(...params);
  if (rows.length === 0) usageAndExit(`No dialogue rows found for run: ${runId}`);
  return rows;
}

const db = new Database(DB_PATH, { readonly: true });
const rows = queryResults(db);
db.close();

const audits = rows.map((row) => {
  const log = loadDialogueLog(row.dialogue_id);
  if (!log) {
    return {
      result: row,
      include_learner_calls: includeLearner,
      log_path: null,
      trace_count: 0,
      exchange_count: 0,
      exchanges: [],
      gaps: ['Dialogue log file not found.'],
      prompt_dirs_checked: promptDirs,
    };
  }

  const built = buildExchangesForResult(row, log.json, { includeLearnerCalls: includeLearner });

  // Extract conversation mode and history from dialogue log or DB row
  const conversationMode = log.json.conversationMode || row.conversation_mode || null;
  const conversationHistory = log.json.conversationHistory || null;
  const tutorMessageChain = conversationHistory ? buildMessageChain(conversationHistory) : null;

  return {
    result: row,
    include_learner_calls: includeLearner,
    log_path: log.path,
    prompt_dirs_checked: promptDirs,
    conversation_mode: conversationMode,
    conversation_history: conversationHistory,
    tutor_message_chain: tutorMessageChain,
    ...built,
  };
});

const outputPayload = {
  generated_at: new Date().toISOString(),
  db_path: DB_PATH,
  query: {
    result_id: resultId || null,
    run_id: runId || null,
    scenario: scenarioFilter || null,
    profile: profileFilter || null,
    limit: Number.isFinite(limit) ? limit : null,
    include_learner: includeLearner,
    line_mode: lineMode,
    show_raw_api: showRawApi,
    system_prompt_max_chars: systemPromptMaxChars,
    raw_api_max_chars: rawApiMaxChars,
  },
  audits: audits.map((a) => compactForJson(a, maxChars, fullPrompts, systemPromptMaxChars)),
};

let rendered;
if (jsonMode) {
  rendered = JSON.stringify(outputPayload, null, 2);
} else {
  const blocks = [];
  blocks.push(C.title('API Message Chain Audit'));
  blocks.push(`${C.key('Generated')} ${outputPayload.generated_at}`);
  blocks.push(`${C.key('Rows')} ${audits.length}`);
  blocks.push(`${C.key('Mode')} ${lineMode ? 'line-mode' : 'detailed'}`);
  blocks.push(`${C.key('Raw API')} ${showRawApi ? `on (${rawApiMaxChars} chars)` : 'off'}`);
  blocks.push(`${C.key('Prompt dirs')} ${promptDirs.length > 0 ? promptDirs.join(', ') : '(none found)'}`);
  blocks.push(`${C.key('System prompt max chars')} ${systemPromptMaxChars}`);
  blocks.push('');
  for (const audit of audits) {
    blocks.push(
      lineMode
        ? formatLineModeReport(audit, maxChars, fullPrompts, systemPromptMaxChars, showRawApi, rawApiMaxChars)
        : formatTextReport(audit, maxChars, fullPrompts, systemPromptMaxChars, showRawApi, rawApiMaxChars),
    );
    blocks.push(C.divider('-'.repeat(100)));
  }
  rendered = blocks.join('\n');
}

if (outPath) {
  const absoluteOut = path.resolve(outPath);
  fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
  fs.writeFileSync(absoluteOut, rendered + '\n');
  console.log(`Wrote audit output: ${absoluteOut}`);
}

if (!outPath || !jsonMode) {
  console.log(rendered);
}
