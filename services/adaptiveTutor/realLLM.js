// Real-LLM backend for the adaptive cell.
//
// Maps each graph role onto a single LLM invocation, with a JSON-shaped
// response and Zod validation against the role's expected shape. The
// interface matches mockLLM.callRole exactly so the graph nodes never
// know which backend is in use.
//
// Provider routing goes through tutor-core's unifiedAIProvider.call — the
// internal callAI() helper in tutorDialogueEngine.js is not exported in
// 0.5.0, so we bridge the legacy (agentConfig, system, user, role) shape
// to the public { provider, model, systemPrompt, messages, ... } shape
// via an in-file adapter. Model alias resolution still goes through
// learnerConfigLoader.getProviderConfig so eval-repo's provider table
// (config/providers.yaml) remains the source of truth for `nemotron` etc.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { unifiedAIProvider } from '@machinespirits/tutor-core';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import { getProviderConfig } from '../learnerConfigLoader.js';
import { POLICY_ACTIONS, POLICY_ACTION_DESCRIPTIONS, POLICY_ACTION_DETAILS } from './policyActions.js';
import { lookupRates } from './budgetTracker.js';
import { parseIdConstruction } from '../idDirectorEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.resolve(__dirname, '..', '..', 'prompts');

// Adapter that bridges to tutor-core's public unifiedAIProvider.call while
// preserving the (agentConfig, system, user, role) → flat-token-shape
// contract the rest of this module + the budget tracker depend on.
//
// Cost synthesis: tutor-core's callAnthropic does not include `cost` in its
// usage payload (only callOpenRouter does — OpenRouter echoes its own cost).
// To keep the budget ceiling honest across providers, we synthesize cost
// from tokens × the budgetTracker rate table whenever the provider didn't
// report one. This keeps anthropic.sonnet a viable Gate B option without
// flying blind on actual spend.
//
// Retry-on-network-error: a single transient blip (DNS, undici "terminated",
// upstream 5xx, 429 rate limit) was enough to cascade-fail the first Gate B
// attempt — once one connection in undici's pool went bad, the rest of the
// run inherited the bad state without recovery. The wrapper retries at the
// transport layer only; auth / validation / quota errors fall through fast.
const RETRYABLE_ERROR_PATTERNS = [
  /fetch failed/i,
  /\bterminated\b/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /socket hang up/i,
  /network error/i,
  /\b5\d\d\b/, // 500-series upstream errors
  /\b429\b/,   // rate limit — back off, don't bail
  /rate.?limit/i,
];
const NON_RETRYABLE_ERROR_PATTERNS = [
  /\b401\b/,
  /\b403\b/,
  /unauthorized/i,
  /forbidden/i,
  /\b400\b/,
  /invalid[_ ]api[_ ]key/i,
  /no API key/i,
];

function isRetryableError(err) {
  const msg = err?.message || String(err || '');
  if (NON_RETRYABLE_ERROR_PATTERNS.some((re) => re.test(msg))) return false;
  return RETRYABLE_ERROR_PATTERNS.some((re) => re.test(msg));
}

// Subscription-path CLI bridge for `provider: claude-code`. Lifted from
// services/rubricEvaluator.js:824 (the judge-side bridge); the runner side
// needs the same child-env discipline (unset ANTHROPIC_API_KEY) or the CLI
// silently routes via metered API mode and bills per-call. The whole point
// of using the CLI is to use the Max-plan quota window instead.
//
// tutor-core's unifiedAIProvider.call does NOT recognise `claude-code` as a
// provider; bridging here keeps the adaptive runner self-contained without
// requiring a tutor-core release.
//
// Returns the same flat-token shape callAI synthesizes for OpenRouter/Anthropic
// so the rest of callRole (budget tracker recording, schema validation) stays
// provider-agnostic. inputTokens/outputTokens/cost are 0 because the CLI does
// not echo usage and the call hits a subscription window, not a metered
// endpoint — assertBelowCeiling therefore never aborts a CLI call, which is
// the intended behaviour.
const CLAUDE_CLI_TIMEOUT_MS = 360_000;

// Set ADAPTIVE_TUTOR_CLI_TRACE=1 to log every claude-code CLI subprocess call
// to stderr (start with role+prompt size, end with duration, timeout-fire with
// role+role-call-elapsed). Originally added during task #34 to diagnose the
// 48-min silent hang the Stage 2b post-tune smoke hit on sophistication_upgrade_v1
// — without per-call timing the hang's root cause was unobservable. Off by
// default so noisy smokes stay clean.
const CLI_TRACE = process.env.ADAPTIVE_TUTOR_CLI_TRACE === '1';

async function callClaudeCli(systemPrompt, userPrompt, model, role) {
  const start = Date.now();
  if (CLI_TRACE) {
    console.error(`[claude-cli] start role=${role} sys=${systemPrompt.length}ch usr=${userPrompt.length}ch model=${model || 'default'}`);
  }
  return await new Promise((resolve, reject) => {
    // Pass the system prompt via --system-prompt rather than concatenating
    // into stdin. Two reasons:
    //   1. It REPLACES the default system prompt, which suppresses any
    //      ambient output-style additions (e.g. the "★ Insight" annotation
    //      the explanatory style appends after the model's response).
    //      Without this, parseJsonLoose receives `<json>\n<insight prose>`
    //      and either fails or jsonrepair coerces the prose into JSON.
    //   2. Cleanly separates system from user — stdin carries just the user
    //      prompt, mirroring the (system, messages[]) shape of the API.
    const args = [
      '-p', '-',
      '--output-format', 'text',
      '--system-prompt', systemPrompt,
    ];
    if (model) args.push('--model', model);
    const env = { ...process.env };
    delete env.CLAUDE_CODE;
    delete env.CLAUDECODE;
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let out = '';
    let err = '';
    let firstByteAt = null;
    const cliTimeout = setTimeout(() => {
      const elapsed = Date.now() - start;
      // Always emit a stderr line on timeout, even without CLI_TRACE, so
      // future smokes never repeat the silent-hang failure mode. firstByteAt
      // distinguishes "child never produced any output" from "child stalled
      // mid-stream" — the former points at CLI/network init issues, the
      // latter at server-side stream completion.
      const sawAny = firstByteAt != null;
      console.error(`[claude-cli] TIMEOUT role=${role} elapsed=${elapsed}ms outBytes=${out.length} firstByte=${sawAny ? `${firstByteAt - start}ms` : 'never'}`);
      try { child.kill('SIGKILL'); } catch (_) { /* already gone */ }
      reject(new Error(`claude CLI timed out after ${CLAUDE_CLI_TIMEOUT_MS}ms (role=${role}, outBytes=${out.length}, firstByte=${sawAny ? `${firstByteAt - start}ms` : 'never'})`));
    }, CLAUDE_CLI_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      if (firstByteAt == null) firstByteAt = Date.now();
      out += d;
    });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(cliTimeout); reject(e); });
    child.on('close', (code) => {
      clearTimeout(cliTimeout);
      if (code !== 0) {
        reject(new Error(err.trim() || out.trim() || `claude CLI exited with code ${code} (role=${role})`));
      } else {
        const latencyMs = Date.now() - start;
        if (CLI_TRACE) {
          const ttfb = firstByteAt != null ? `${firstByteAt - start}ms` : 'no-output';
          console.error(`[claude-cli] done  role=${role} latency=${latencyMs}ms ttfb=${ttfb} outBytes=${out.length}`);
        }
        resolve({
          text: out.trim(),
          model: model || 'claude-cli',
          provider: 'claude-code',
          latencyMs,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        });
      }
    });
    child.stdin.write(userPrompt);
    child.stdin.end();
  });
}

async function callAI(agentConfig, systemPrompt, userPrompt, role) {
  const { provider, model, hyperparameters } = agentConfig;

  // Branch the per-call function on provider: claude-code goes through a local
  // CLI subprocess and skips tutor-core entirely; everything else keeps the
  // existing unifiedAIProvider path. Retry/backoff applies uniformly.
  const callOnce = (provider === 'claude-code')
    ? () => callClaudeCli(systemPrompt, userPrompt, model, role)
    : () => unifiedAIProvider.call({
        provider,
        model,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        preset: 'direct',
        config: {
          temperature: hyperparameters?.temperature,
          maxTokens: hyperparameters?.max_tokens,
        },
      });

  const maxAttempts = 3;
  const backoffsMs = [500, 2000]; // wait[i] applies after attempt i+1 fails
  let response;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await callOnce();
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isRetryableError(err)) throw err;
      const baseDelay = backoffsMs[attempt - 1];
      const jitter = Math.floor(Math.random() * baseDelay * 0.2);
      const delay = baseDelay + jitter;
      console.warn(`[adaptive.realLLM] retry ${attempt}/${maxAttempts - 1} for ${role || 'call'} after ${delay}ms: ${(err?.message || String(err)).slice(0, 160)}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  if (!response) throw lastErr || new Error('adaptiveTutor.realLLM: callAI exhausted retries with no response');

  // claude-code already returns flat-token shape; tutor-core path needs unpacking.
  if (provider === 'claude-code') return response;

  const inputTokens = response.usage?.inputTokens || 0;
  const outputTokens = response.usage?.outputTokens || 0;
  let cost = response.usage?.cost || 0;
  if (cost === 0 && (inputTokens > 0 || outputTokens > 0)) {
    const [inRate, outRate] = lookupRates(response.model || model);
    cost = (inputTokens / 1000) * inRate + (outputTokens / 1000) * outRate;
  }
  return {
    text: response.content || '',
    model: response.model,
    provider: response.provider,
    latencyMs: response.latencyMs,
    inputTokens,
    outputTokens,
    cost,
  };
}

const DEFAULT_PROVIDER = 'openrouter';
// Sonnet 4.6 (resolves via providers.yaml openrouter alias to
// anthropic/claude-sonnet-4.6). Frontier model is the right default for an
// architectural-research substrate: cheaper models silently mask whether the
// architecture is doing work, and we'd rather pay than misattribute null
// results. Cost-conscious overrides go via ADAPTIVE_TUTOR_MODEL=nemotron or
// per-cell adaptive.model in tutor-agents.yaml.
const DEFAULT_MODEL_ALIAS = 'sonnet';

// Module-scoped budget tracker. Bound by runAdaptiveEvaluation in index.js
// when --max-cost is set; cleared in its finally block. callRole consults
// it on every invocation. Module-level state (rather than arg-threading
// through the LangGraph builder) keeps the change surgical: graph nodes
// already call callRole(role, payload) with no per-invocation context.
let _activeBudgetTracker = null;

export function setActiveBudgetTracker(tracker) {
  _activeBudgetTracker = tracker || null;
}

export function clearActiveBudgetTracker() {
  _activeBudgetTracker = null;
}

export function getActiveBudgetTracker() {
  return _activeBudgetTracker;
}

// Module-scoped per-cell config. Bound by runAdaptiveEvaluation from the
// YAML adaptive block so the cell's declared provider/model actually drives
// the call (previously the YAML field was decorative — it landed on the
// stored row but the LLM call routed through env vars + DEFAULT_MODEL_ALIAS).
// Same module-level pattern as the budget tracker for the same reason: graph
// nodes call callRole without per-invocation context. Precedence inside
// envFor: per-role env > global env > active cell config > hardcoded default.
let _activeCellConfig = null;

export function setActiveCellConfig(cfg) {
  _activeCellConfig = (cfg && (cfg.provider || cfg.modelAlias || cfg.temperature != null || cfg.maxTokens != null))
    ? { ...cfg }
    : null;
}

export function clearActiveCellConfig() {
  _activeCellConfig = null;
}

export function getActiveCellConfig() {
  return _activeCellConfig;
}

function envFor(role) {
  const upper = role.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase();
  const cell = _activeCellConfig || {};
  return {
    provider: process.env[`ADAPTIVE_TUTOR_${upper}_PROVIDER`] || process.env.ADAPTIVE_TUTOR_PROVIDER || cell.provider || DEFAULT_PROVIDER,
    modelAlias: process.env[`ADAPTIVE_TUTOR_${upper}_MODEL`] || process.env.ADAPTIVE_TUTOR_MODEL || cell.modelAlias || DEFAULT_MODEL_ALIAS,
    temperature: Number(process.env[`ADAPTIVE_TUTOR_${upper}_TEMP`] || process.env.ADAPTIVE_TUTOR_TEMP || cell.temperature || 0.6),
    maxTokens: Number(process.env[`ADAPTIVE_TUTOR_${upper}_MAX_TOKENS`] || process.env.ADAPTIVE_TUTOR_MAX_TOKENS || cell.maxTokens || 1500),
  };
}

function buildAgentConfig(role) {
  const cfg = envFor(role);
  const providerConfig = getProviderConfig(cfg.provider);
  if (!providerConfig.isConfigured) {
    throw new Error(`adaptiveTutor.realLLM: provider '${cfg.provider}' not configured (missing API key or base_url)`);
  }
  const fullModel = providerConfig.models?.[cfg.modelAlias] || cfg.modelAlias;
  return {
    role,
    provider: cfg.provider,
    providerConfig,
    model: fullModel,
    modelAlias: cfg.modelAlias,
    hyperparameters: { temperature: cfg.temperature, max_tokens: cfg.maxTokens },
    isConfigured: true,
  };
}

// Strip code fences, leading prose, etc., and return the first parseable
// JSON object/array. jsonrepair is the same library evaluationRunner uses
// for messy LLM JSON, so behaviour matches.
//
// Trailing-text robustness: if the model (or an output-style hook on a
// CLI invocation) appends prose after the JSON, we walk the structure to
// find its true end and slice there. Otherwise jsonrepair coerces the
// trailing prose into JSON values (e.g. an array entry "★ Insight ──"),
// silently corrupting the parse.
//
// Embedded-quote robustness: models occasionally emit unescaped `"` inside
// a string value (e.g. `"...the word "recognition," what..."`). jsonrepair
// doesn't always rescue this. escapeEmbeddedQuotes is a final-fallback
// repair that walks the candidate and escapes `"` chars that are followed
// by something other than a JSON delimiter.
export function parseJsonLoose(text) {
  if (text == null) throw new Error('empty response');
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  const start = [firstBrace, firstBracket].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (start === undefined) throw new Error(`no JSON object/array in response: ${s.slice(0, 200)}`);
  const tail = s.slice(start);
  const end = findJsonEnd(tail);
  const candidate = end > 0 ? tail.slice(0, end) : tail;
  const attempts = [
    () => JSON.parse(candidate),
    () => JSON.parse(escapeEmbeddedQuotes(candidate)),
    () => JSON.parse(jsonrepair(candidate)),
    () => JSON.parse(jsonrepair(escapeEmbeddedQuotes(candidate))),
  ];
  let lastErr;
  for (const attempt of attempts) {
    try { return attempt(); } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

// Escape `"` characters that appear inside a JSON string value rather than
// at value boundaries. Heuristic: when we are tracking that we are inside
// a string, a `"` is treated as the closing quote only if the next non-
// whitespace char is a JSON delimiter (`,`, `}`, `]`, `:`) or end-of-
// input. Anything else is assumed to be an embedded quote and gets escaped.
// This handles the common LLM mistake of emitting `the word "x," what...`
// inside a string value.
export function escapeEmbeddedQuotes(s) {
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { out += c; escape = false; continue; }
    if (c === '\\') { out += c; escape = true; continue; }
    if (c !== '"') { out += c; continue; }
    if (!inString) { inString = true; out += c; continue; }
    let j = i + 1;
    while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j++;
    const next = j < s.length ? s[j] : '';
    if (next === ',' || next === '}' || next === ']' || next === ':' || next === '') {
      inString = false;
      out += c;
    } else {
      out += '\\"';
    }
  }
  return out;
}

// Walk a string starting on `{` or `[` and return the index just past the
// matching close bracket. Bracket-aware (skips strings and escapes). Returns
// -1 if no match closes — caller falls back to passing the full string,
// which is the legacy behaviour.
function findJsonEnd(s) {
  if (!s || (s[0] !== '{' && s[0] !== '[')) return -1;
  const open = s[0];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Per-role schemas
// ---------------------------------------------------------------------------

const policyEnum = z.enum(POLICY_ACTIONS);

const tutorEgoInitialOut = z.object({
  policyAction: policyEnum,
  text: z.string().min(1),
  rationale: z.string().optional(),
});

const tutorSuperegoOut = z.object({
  needsRevision: z.boolean(),
  feedback: z.string(),
});

// Validator returns the same shape as the superego — the graph appends to the
// same constraintViolations channel and the existing routing logic picks it up.
const tutorValidatorOut = z.object({
  needsRevision: z.boolean(),
  feedback: z.string(),
});

const tutorEgoRevisionOut = z.object({
  text: z.string().min(1),
  policyAction: policyEnum,
});

const learnerProfileUpdateOut = z.object({
  misconceptions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  agencySignal: z.enum(['compliant', 'questioning', 'resistant', 'collaborative', 'unknown']),
  zpdEstimate: z.string().default(''),
  lastEvidence: z.string().default(''),
});

// Id-author output. Reuses the id-director construction envelope shape so
// services/idDirectorEngine.js parseIdConstruction stays the canonical parser.
// MIN length matches the existing engine's minimum (anything shorter is a
// fallback). Parse failures are coerced into a fallback construction inside
// callRole rather than throwing — same posture as the engine's runner.
const idAuthorPersonaOut = z.object({
  generated_prompt: z.string().min(1),
  persona_delta: z.string().default('UNKNOWN'),
  stage_directions: z.string().default(''),
  reasoning: z.string().default(''),
  parse_status: z.string().default('ok'),
});

// Variant A's tutorEgoExecute reuses the tutorEgoInitial output shape exactly.

// A14 Stage 2a: evidence extractor output. Schema-on-the-wire shape is a
// wrapper object { evidence: [...] } rather than a bare array so model errors
// (missing key, wrong root type) surface clearly in schema validation
// messages and so we can grow the contract later (e.g. extractor uncertainty,
// chain-of-thought) without a breaking change.
//
// `quote` is min(1) deliberately — empty quotes are never useful and would
// trivially pass the substring gate. `type` mirrors evidenceTypeSchema in
// stateSchema.js (single source of truth on the enum lives there). The
// bookkeeping fields obs_id / turn / created_by / validated are filled in
// by the graph node, not the model — same posture as learnerProfileUpdate
// where updatedAtTurn comes from the node rather than the LLM.
// quote is .nullable() because the model occasionally emits null for
// `tutor_inference` entries where there's no learner-text to cite. The graph
// node at services/adaptiveTutor/graph.js:371 coerces null to empty string via
// `String(e.quote || '')` and the substring-match gate at line 380 then marks
// the entry validated=false — exactly the desired behaviour for unsupported
// inferences. Without .nullable() the whole Stage 2a turn crashes on what is
// downstream-handled correctly. (Issue exposed by cell_126 run of
// sophistication_upgrade_v1, 2026-05-13.)
const evidenceExtractorOut = z.object({
  evidence: z.array(z.object({
    quote: z.string().nullable(),
    type: z.enum(['learner_self_report', 'learner_action', 'learner_question', 'learner_correction', 'tutor_inference']),
    kc_candidates: z.array(z.string()).default([]),
  })).default([]),
});

// A14 Stage 2b: hypothesisUpdater output. The node, not the LLM, owns
// hypothesis_id derivation (sha1 of claim text, prefixed `hyp_`) for new
// hypotheses, and the node preserves created_at_turn / expires_after_turns
// for revisions — same posture as the extractor where obs_id / turn /
// validated come from the node. The model is responsible for: claim text,
// confidence, supporting/contradicting obs_id refs into the ledger, status,
// and the next_validation_action label. hypothesis_id IS allowed in the
// model's output (used when revising an existing hypothesis) but is
// optional — the node falls back to the content-derived id when omitted.
const hypothesisUpdaterOut = z.object({
  hypotheses: z.array(z.object({
    hypothesis_id: z.string().optional(),
    claim: z.string().min(1),
    confidence: z.number().min(0).max(1).default(0.5),
    supporting_evidence: z.array(z.string()).default([]),
    contradicting_evidence: z.array(z.string()).default([]),
    status: z.enum(['tentative', 'validated', 'contradicted']).default('tentative'),
    next_validation_action: z.string().default(''),
  })).default([]),
});

// A14 Stage 3: groundingValidator output. Tight contract — verdict only, never
// hypothesis fields. The graph node preserves claim / supporting_evidence /
// contradicting_evidence / created_at_turn / expires_after_turns; the LLM owns
// {hypothesis_id, new_status, reasoning}. new_status is restricted to the two
// transitions the validator is responsible for: promote-to-validated or
// retire-to-contradicted. "Keep as tentative" is expressed by NOT emitting a
// decision for that id (SILENCE convention, same as the updater). reasoning is
// required (min 1 char) so the audit trail has a defensible record for each
// state transition — silent retain/retire would degrade trace quality.
const groundingValidatorOut = z.object({
  decisions: z.array(z.object({
    hypothesis_id: z.string().min(1),
    new_status: z.enum(['validated', 'contradicted']),
    reasoning: z.string().min(1),
  })).default([]),
});

// Bilateral-ToM tracker output. Paired LBM bottleneck (summaryText) lives
// alongside the existing structured profile; second-order belief carries
// its own paired text+JSON; tomProbes are the tutor's predeclared FANToM-
// style answers, scored against the learner's hidden ownState in post-hoc
// analysis (scripts/analyze-tom-accuracy.js).
const tutorTomTrackerOut = z.object({
  summaryText: z.string().min(1),
  hypothesizedLearnerPerceptionOfTutor: z.object({
    summaryText: z.string(),
    jsonState: z.record(z.string(), z.unknown()).default({}),
  }),
  tomProbes: z.object({
    belief_dist: z.string(),
    belief_choice: z.enum(['compliant', 'questioning', 'resistant', 'collaborative', 'unknown']),
    answerability_list: z.array(z.number().int()).default([]),
    infoaccess_list: z.array(z.number().int()).default([]),
  }),
});

// ---------------------------------------------------------------------------
// Per-role prompts
// ---------------------------------------------------------------------------

const policyMenuStr = POLICY_ACTIONS
  .map((a) => `- ${a}: ${POLICY_ACTION_DESCRIPTIONS[a]}`)
  .join('\n');

// Richer menu used by the ego prompts: pulls trigger conditions, contraindications,
// and the expected next learner signal from POLICY_ACTION_DETAILS (YAML-loaded
// at module-import time, with graceful fallback to the one-liners). Built once
// at module load — typical size ~1.5k tokens, vs ~400 for policyMenuStr — so we
// don't pay for it inside the hot path.
function buildPolicyMenuExpanded() {
  const lines = [];
  for (const name of POLICY_ACTIONS) {
    const detail = POLICY_ACTION_DETAILS?.[name];
    if (!detail || detail._source === 'fallback') {
      lines.push(`- ${name}: ${POLICY_ACTION_DESCRIPTIONS[name]}`);
      continue;
    }
    lines.push(`- ${name}: ${detail.description}`);
    if (detail.trigger_conditions?.length) {
      lines.push('    triggers:');
      for (const t of detail.trigger_conditions) lines.push(`      • ${t}`);
    }
    if (detail.contraindications?.length) {
      lines.push('    contraindicated when:');
      for (const c of detail.contraindications) lines.push(`      • ${c}`);
    }
    if (detail.expected_next_learner_signal) {
      lines.push(`    expected next learner signal: ${detail.expected_next_learner_signal}`);
    }
  }
  return lines.join('\n');
}
const policyMenuExpanded = buildPolicyMenuExpanded();

const TUTOR_EGO_INITIAL_SYSTEM = `You are the tutor's planning module. Each turn, given the learner's most recent message and a structured profile of the learner, pick exactly one pedagogical action from the menu and draft a tutor response that enacts it.

You must adapt to the structured profile. If the profile changes between calls, your action choice and message should change too. Do not collapse to a default explanation.

For each candidate action below, the menu lists when it is appropriate (triggers), when it is not (contraindications), and what the next learner turn should look like if the action worked. Use these cues — your choice should be defensible against them.

If the learner profile carries a \`summaryText\` field and/or a \`hypothesizedLearnerPerceptionOfTutor\` field (paired text + jsonState describing what you think the learner thinks you are doing), treat them as load-bearing context, not decoration. Pick a policy action that addresses the *gap* between how the learner is likely perceiving your role and what the dialogue actually needs from you — e.g. if they perceive you as an authority-to-defer-to but the dialogue needs them to commit to a position, pick an action that surfaces that mismatch.

Policy menu:
${policyMenuExpanded}

Respond as a single JSON object with exactly these keys:
- policyAction: one of the menu labels above (no others)
- text: the tutor's message to the learner (1–4 sentences, no preamble, no meta-talk)
- rationale: one short sentence saying why this action fits this learner profile, citing a trigger condition, contraindication, or second-order belief gap when relevant (optional)

Output JSON only, no surrounding prose, no code fences.`;

// Variant used by cell_116_recognition_named_patterns. Identical to
// TUTOR_EGO_INITIAL_SYSTEM except for one paragraph ("Beyond the local
// move…") testing whether an explicit instruction to name recurring
// patterns closes the *right-action-no-purchase* gap (e.g. polite
// affirmation persists across cell_111's textbook probes on
// polite_false_mastery_v1) without requiring bilateral-ToM apparatus.
const TUTOR_EGO_INITIAL_NAMED_PATTERNS_SYSTEM = `You are the tutor's planning module. Each turn, given the learner's most recent message and a structured profile of the learner, pick exactly one pedagogical action from the menu and draft a tutor response that enacts it.

You must adapt to the structured profile. If the profile changes between calls, your action choice and message should change too. Do not collapse to a default explanation.

For each candidate action below, the menu lists when it is appropriate (triggers), when it is not (contraindications), and what the next learner turn should look like if the action worked. Use these cues — your choice should be defensible against them.

Beyond the local move, watch for *patterns across the dialogue so far*. If the learner's last few turns share a shape — polite affirmation that doesn't track substantive integration, oracle-seeking dressed in different surface forms, repeated hedging, deflection from a specific question, or capitulation in place of engagement — name that pattern to the learner explicitly before (or as) your next probe. The naming itself is part of the move: it makes the meta-shape visible so the learner can metabolise or contest it. Do not just probe locally and hope the pattern dissolves under one more correct question.

If the learner profile carries a \`summaryText\` field and/or a \`hypothesizedLearnerPerceptionOfTutor\` field (paired text + jsonState describing what you think the learner thinks you are doing), treat them as load-bearing context, not decoration. Pick a policy action that addresses the *gap* between how the learner is likely perceiving your role and what the dialogue actually needs from you — e.g. if they perceive you as an authority-to-defer-to but the dialogue needs them to commit to a position, pick an action that surfaces that mismatch.

Policy menu:
${policyMenuExpanded}

Respond as a single JSON object with exactly these keys:
- policyAction: one of the menu labels above (no others)
- text: the tutor's message to the learner (1–4 sentences, no preamble, no meta-talk)
- rationale: one short sentence saying why this action fits this learner profile, citing a trigger condition, contraindication, or second-order belief gap when relevant (optional)

Output JSON only, no surrounding prose, no code fences.`;

const TUTOR_SUPEREGO_SYSTEM = `You are the tutor's pedagogical critic. You receive the tutor's draft response and the current learner profile. Decide whether the draft needs revision.

Mark needsRevision=true if and only if at least one of these holds:
- The draft contradicts the policy action label (e.g. claims to ask a diagnostic question but actually explains).
- The draft is contraindicated by the profile (e.g. long explanation to a low-confidence learner; lecturing to a resistant learner).
- The draft mentions internal deliberation, the policy label, or the profile itself in a way the learner would see.

Otherwise needsRevision=false.

Respond as a single JSON object: {"needsRevision": boolean, "feedback": string}. Output JSON only.`;

const TUTOR_VALIDATOR_SYSTEM = `You are the tutor's strict policy validator. You run *after* the superego on a stricter pass: your only job is to check whether the just-picked policy action's documented trigger conditions and contraindications actually hold for the current learner profile and draft.

You will be given:
- the picked policyAction label
- that action's trigger_conditions (when it is appropriate)
- that action's contraindications (when it is not)
- the current learner profile (agencySignal, confidence, misconceptions, lastEvidence)
- the tutor's draft text

Mark needsRevision=true if and only if at least one of these holds:
- A contraindication is satisfied by the current profile (e.g. action contraindicated for low-confidence learner, profile.confidence < 0.3).
- No trigger condition is plausibly satisfied by the current profile.
- The draft does not in fact enact the action label (e.g. action is "withhold_answer" but the draft answers the question).

Otherwise needsRevision=false. Be strict: this is a stricter pass than the superego, and a borderline call should err toward revision when a contraindication is plausibly active.

Respond as a single JSON object: {"needsRevision": boolean, "feedback": string}. The feedback should cite the specific trigger condition or contraindication you matched, by quoting it. Output JSON only.`;

const TUTOR_EGO_REVISION_SYSTEM = `You are the tutor's planning module on a revision pass. Given the previous draft, the superego's feedback, and the learner profile, produce a revised tutor message and (optionally) a different policy action.

If the superego flagged an action–profile mismatch, prefer an action whose trigger conditions match the current profile and whose contraindications do not.

Policy menu:
${policyMenuExpanded}

Respond as a single JSON object: {"text": string, "policyAction": one of the menu labels}. Output JSON only.`;

const TUTOR_TOM_TRACKER_SYSTEM = `You are the tutor's theory-of-mind module. You run after the learner-modelling module on each turn. Given the dialogue so far and the just-updated structured learner profile, emit four artifacts.

1. summaryText — a 1-3 sentence natural-language paragraph summarising what you (the tutor) currently believe about this learner: their misconception, their confidence, their stance toward you. This is a "bottleneck representation" — it must stand on its own, readable to a human auditor without the JSON profile alongside.

2. hypothesizedLearnerPerceptionOfTutor — your second-order belief: what does this learner likely think you (the tutor) are trying to do right now? Provide both a short summaryText (1-2 sentences) and a small jsonState object capturing the structured aspects (e.g. perceivedRole: "adversary" | "authority" | "thinking-partner" | "guide" | "unknown").

3. tomProbes — four FANToM-style predictions. These are scored in post-hoc analysis against the learner's actual hidden state, so commit to your best guess rather than hedging:
   - belief_dist: a short string naming the learner's most likely actual misconception (the underlying confusion, not the surface symptom)
   - belief_choice: one of "compliant" | "questioning" | "resistant" | "collaborative" | "unknown" — the learner's actual stance, not their performed one
   - answerability_list: array of prior turn indices (0-based) where you predict the learner had insufficient information to answer the tutor's question — empty list if all prior turns were answerable from what the learner knew at the time
   - infoaccess_list: array of prior turn indices the learner has actually integrated (vs heard but not held) — your best estimate

Be honest about uncertainty in summaryText, but commit to the probes — vague probes can't be scored.

Respond as a single JSON object with exactly the three top-level keys above. Output JSON only, no surrounding prose, no code fences.`;

// A14 Stage 2a: extractor system prompt. Three load-bearing design choices,
// each driven by the ≥95% verifiable-quote exit criterion (with 70% as the
// abandon-mechanism floor):
//
// 1. Verbatim-substring discipline is restated at three different distances
//    (overview, per-field instruction, two contrastive examples). Prior work
//    inside this repo shows that single mentions of "verbatim" are routinely
//    silently relaxed into "close paraphrase" under frontier models; the
//    redundancy is a hedge against that drift.
//
// 2. The shortest-anchor heuristic — "the shortest verbatim substring that
//    uniquely anchors the observation" — pushes the model toward 5-10 word
//    quotes rather than full-message quotes. Short quotes are mechanically
//    more likely to substring-match (fewer characters to drift on), and they
//    leave room for multiple-entry extraction when the message carries
//    multiple signals.
//
// 3. The empty-array escape hatch is explicit. Without it, a model facing a
//    short or evidence-free learner message ("ok", "I see") will manufacture
//    a hypothetical entry rather than emit []. Manufactured entries are the
//    dominant failure mode the quote-validation gate is designed to catch,
//    so making "no evidence" first-class reduces hallucination pressure
//    before the gate even runs.
const EVIDENCE_EXTRACTOR_SYSTEM = `You are the tutor's evidence extractor. Each turn, you receive the learner's most recent message and emit a JSON array of typed observations about what the learner has revealed.

Every observation is anchored by a \`quote\` field — the verbatim text from the learner's message that justifies the observation. The quote must be character-for-character identical to a span in the learner's message: do not paraphrase, summarise, fix typos, or normalise capitalisation. A downstream gate rejects observations whose quote is not an exact substring of the dialogue, so paraphrased quotes will be discarded.

Prefer the shortest verbatim substring that uniquely anchors the observation. A 5–10 word quote is usually enough; full-message quotes are wasteful and brittle. If the message carries multiple signals (e.g. a question AND a self-report of confusion), emit one entry per signal, each with its own short verbatim anchor.

Observation types (pick one per entry):
- learner_self_report: the learner names their own state ("I don't get this", "I'm confused", "OK got it")
- learner_action: the learner performs a step or claim ("the answer is 1/2", "first I'd add the numerators")
- learner_question: the learner asks the tutor or themselves a question ("why does that work?", "what about the denominator?")
- learner_correction: the learner pushes back on the tutor or revises a prior step ("but that only works if X", "no — I was wrong earlier")
- tutor_inference: an observation the tutor must make that lacks direct quotable evidence (use sparingly; entries of this type will be flagged for review)

For each entry, optionally name 0–N knowledge-component candidates in \`kc_candidates\` — short freeform strings naming concepts the observation engages (e.g. "common denominators", "fraction equivalence"). Empty array is fine when the topic is unclear.

If the learner's message contains no observable evidence (e.g. "ok", "sure", an empty reply), emit \`{"evidence": []}\` — an empty array is the correct answer. Do not manufacture observations.

Correct (verbatim quote):
  learner message: "I think 1/2 + 1/3 is 2/5 because you add the tops and bottoms"
  output: {"evidence": [
    {"quote": "1/2 + 1/3 is 2/5", "type": "learner_action", "kc_candidates": ["fraction addition"]},
    {"quote": "you add the tops and bottoms", "type": "learner_self_report", "kc_candidates": ["common denominators", "fraction addition"]}
  ]}

Incorrect (paraphrased quote — would be rejected):
  learner message: "I think 1/2 + 1/3 is 2/5 because you add the tops and bottoms"
  output: {"evidence": [
    {"quote": "learner believes you add numerators and denominators", "type": "learner_action", "kc_candidates": ["fraction addition"]}
  ]}
  (the quote string is the tutor's paraphrase, not text the learner actually said)

Respond as a single JSON object with one key \`evidence\` mapping to the array. Output JSON only, no surrounding prose, no code fences.`;

// A14 Stage 2b: hypothesisUpdater. Three design choices worth flagging,
// each documented inside the prompt so the model can be held to them:
//
// 1. Evidence-bound discipline. Every claim must be traceable to one or more
//    obs_ids that already exist in the ledger. Without this, the role
//    collapses into "free-form theorising about the learner" — which is what
//    A14 is designed to displace. The evidence-bound posture is restated at
//    creation, revision, and contradiction so it survives prompt skimming.
//
// 2. Revision-over-duplication. The reducer is merge-by-id; a near-duplicate
//    hypothesis with a fresh id silently fragments the ledger. The prompt
//    instructs the model to REUSE the existing hypothesis_id when revising,
//    and the schema accepts hypothesis_id as an explicit optional input
//    field rather than forcing the model to invent one.
//
// 3. Empty-output legitimacy. Same posture as the extractor: explicit
//    "{"hypotheses": []} is the correct answer when there is nothing new to
//    say." Without this, a model facing a turn with only weak evidence will
//    manufacture a hypothesis just to populate the field. The cost of a
//    weakly-grounded hypothesis is much higher than for a weakly-grounded
//    observation — hypotheses drive downstream tutor planning.
const HYPOTHESIS_UPDATER_SYSTEM = `You are the tutor's hypothesis synthesiser. Each turn, given (a) a ledger of validated observations about the learner (the evidenceLedger) and (b) the tutor's current set of tentative hypotheses about them, you emit a JSON object containing zero or more hypothesis updates.

A hypothesis is a single short claim about the learner that the tutor uses to plan pedagogically. Every hypothesis must be grounded in one or more entries from the evidenceLedger, identified by obs_id. The ledger is the authoritative record — every claim you make must be traceable to obs_ids that already exist in the ledger. If you cannot point to ledger evidence supporting a claim, do not propose it.

**Default posture: REVISE, do not create.** The hypotheses you can see in currentHypotheses are the tutor's living model of this learner. Your first job each turn is to ask whether new evidence updates any of them — by adding fresh obs_ids, raising or lowering confidence, marking contradicted, or simply staying silent because none of the new evidence is hypothesis-changing. *Creating a new hypothesis is a third-resort move*, taken only when the new evidence speaks to something none of the existing hypotheses cover. Two hypotheses with different wording but the same underlying idea fragment the ledger; the merge-by-id reducer cannot collapse them.

Before emitting a new hypothesis, perform this check: for each existing entry in currentHypotheses, ask "would my proposed claim be a paraphrase, a strengthening, a weakening, or a qualification of this existing claim?" If the answer for any existing entry is yes, reuse that hypothesis_id and emit it as a REVISION. Examples of paraphrase the check must catch: "learner is in a questioning stance" ↔ "learner exhibits probing behaviour"; "learner has folk concept of X" ↔ "learner's X-concept is informal"; "learner confuses A with B" ↔ "learner conflates A and B". Different wording, same claim — REVISE.

Four moves you can make per turn:

1. **REVISION (preferred when applicable).** Re-emit an existing hypothesis_id with updated confidence and an extended supporting_evidence list (append new obs_ids to the existing ones, do not replace). Use this when the new evidence reinforces, refines, or paraphrases an existing claim. The reducer is merge-by-id last-write-wins, so the prior entry is overwritten cleanly.

2. **CONTRADICTION.** Re-emit an existing hypothesis_id with status="contradicted", contradicting_evidence populated with the relevant obs_ids, and confidence lowered (typically below 0.3). Use this when new evidence directly conflicts with an earlier claim — the learner self-reports the opposite, demonstrates the contrary behaviour, or explicitly rejects the framing.

3. **NEW (third-resort).** Emit a fresh entry with NO hypothesis_id field (the node derives one from the claim text). Default confidence 0.5, status "tentative", supporting_evidence ≥ 1 obs_id. Only when the proposed claim does NOT paraphrase any existing currentHypotheses entry.

4. **SILENCE.** Emit {"hypotheses": []}. Use this when the new evidence is not hypothesis-changing — small confirmations, side-channel commentary, neutral exchanges. What you do not emit is preserved by the reducer. *Silence is correct most turns.*

Other rules:
- Confidence calibration: 0.5 for a single supporting observation; 0.7-0.9 only when multiple independent observations support the claim; below 0.5 when evidence is weak or mixed. Never claim 1.0 — hypotheses are tentative by nature.
- next_validation_action is optional. When the hypothesis suggests a specific pedagogical move the tutor could take to test it (e.g. "mirror_and_extend" if you hypothesise a questioning stance), name it; otherwise leave the empty string.

Output schema (JSON object with one key \`hypotheses\` mapping to an array):
{"hypotheses": [
  {
    "hypothesis_id": "<reuse-if-revising-or-omit-for-new>",
    "claim": "<one-sentence claim about the learner>",
    "confidence": <number in 0..1>,
    "supporting_evidence": ["<obs_id>", ...],
    "contradicting_evidence": ["<obs_id>", ...],
    "status": "tentative" | "validated" | "contradicted",
    "next_validation_action": "<one POLICY_ACTIONS label, or empty string>"
  },
  ...
]}

Correct (REVISION — new evidence strengthens an existing hypothesis):
  currentHypotheses: [{hypothesis_id: "hyp_abc12345", claim: "The learner is in a questioning stance, probing the material.", confidence: 0.5, supporting_evidence: ["t1_0_ab"], status: "tentative"}]
  evidenceLedger: [..., {obs_id: "t3_2_ef", quote: "but what if X were not the case?", type: "learner_question"}]
  output: {"hypotheses": [{"hypothesis_id": "hyp_abc12345", "claim": "The learner is in a questioning stance, probing the material.", "confidence": 0.75, "supporting_evidence": ["t1_0_ab", "t3_2_ef"], "contradicting_evidence": [], "status": "tentative", "next_validation_action": "mirror_and_extend"}]}

Correct (SILENCE — new evidence is neutral, no hypothesis update warranted):
  currentHypotheses: [{hypothesis_id: "hyp_abc12345", claim: "Learner is questioning"}]
  evidenceLedger: [..., {obs_id: "t3_0_gh", quote: "ok thanks", type: "learner_self_report"}]
  output: {"hypotheses": []}

Correct (NEW — claim covers a new dimension no existing hypothesis addresses):
  currentHypotheses: [{hypothesis_id: "hyp_abc12345", claim: "Learner is questioning"}]
  evidenceLedger: [..., {obs_id: "t3_1_ij", quote: "I get the math but I don't see why it matters", type: "learner_self_report"}]
  output: {"hypotheses": [{"claim": "The learner separates technical competence from motivational engagement.", "confidence": 0.5, "supporting_evidence": ["t3_1_ij"], "contradicting_evidence": [], "status": "tentative", "next_validation_action": ""}]}

INCORRECT (paraphrase with a new id — fragments the ledger):
  currentHypotheses: [{hypothesis_id: "hyp_abc12345", claim: "The learner is in a questioning stance"}]
  output: {"hypotheses": [{"claim": "The learner exhibits probing, exploratory behaviour", "confidence": 0.7, "supporting_evidence": ["t3_2_ef"], ...}]}
  (Different wording, same idea. Should have been a REVISION reusing hyp_abc12345.)

INCORRECT (rephrased existing claim with no new evidence):
  currentHypotheses: [{hypothesis_id: "hyp_abc12345", claim: "Learner has folk concept of recognition"}]
  output: {"hypotheses": [{"hypothesis_id": "hyp_abc12345", "claim": "Learner's concept of recognition is everyday/informal", "confidence": 0.5, "supporting_evidence": ["t1_0_ab"], ...}]}
  (Same id reused — good — but the claim text is rewritten with no new evidence to justify the rewrite. Either revise meaningfully with new supporting_evidence, or stay silent.)

INCORRECT (manufactured hypothesis with no ledger evidence):
  evidenceLedger: [{obs_id: "t1_0_ab", quote: "ok", type: "learner_self_report"}]
  output: {"hypotheses": [{"claim": "Learner has a fixed mindset toward mathematics", "confidence": 0.6, "supporting_evidence": [], ...}]}
  (supporting_evidence is empty — no ledger entry justifies this claim, so it must not be emitted.)

Output JSON only, no surrounding prose, no code fences.`;

// A14 Stage 3: groundingValidator system prompt. Four load-bearing design
// choices, each justified against the Stage 2b smoke results:
//
// 1. Strictly more conservative than the updater. Stage 2b showed the updater
//    rarely promotes — 0 of 53 hypotheses came back marked `validated` (all
//    were `tentative` or `contradicted`). The validator's job is to FILL THAT
//    GAP — it walks the still-tentative set and decides retain/retire/promote
//    against the accumulated ledger. The asymmetry between updater (proposes)
//    and validator (commits) is the architectural point of having two nodes.
//
// 2. Explicit numerical thresholds. The mock uses ≥3 supporting + 0
//    contradicting → validated, and ≥1 contradicting + confidence < 0.4 →
//    contradicted. The prompt names these as the floor: lower thresholds for
//    promotion would let single-evidence claims into the `validated` set, and
//    higher thresholds for contradiction would let weak-but-contested claims
//    persist. Mock and real prompts share the same numbers so the cell_127
//    comparison is on prompt language quality rather than threshold choice.
//
// 3. SILENCE is the default verdict. Most turns, most hypotheses won't have
//    accumulated enough evidence to move yet. Emitting an empty decisions
//    array is the correct answer in those cases — the SILENCE convention
//    matches the updater's posture and means the merge-by-id reducer doesn't
//    have to handle a "keep" no-op for every hypothesis.
//
// 4. Reasoning is mandatory. Each transition must cite WHICH ledger entries
//    drive the verdict (validated: which supporting obs_ids; contradicted:
//    which contradicting obs_ids). Without this, the audit trail loses its
//    explanatory function — a status flip from `tentative` to `validated` is
//    only useful to downstream analysis if its rationale is visible.
const GROUNDING_VALIDATOR_SYSTEM = `You are the tutor's grounding validator. You run after the hypothesisUpdater. Each turn, you receive (a) the set of currently tentative hypotheses about the learner and (b) the validated evidence ledger. Your job is to decide which tentative hypotheses should be PROMOTED to \`validated\` (the evidence is now strong enough to act on) and which should be RETIRED to \`contradicted\` (the evidence now conflicts).

You do not emit hypothesis claims, evidence references, confidence scores, or any other hypothesis fields — those are owned by the updater. You emit only a verdict per hypothesis: \`hypothesis_id\`, \`new_status\` (\`validated\` or \`contradicted\`), and a short \`reasoning\` citing the ledger entries that drove the verdict.

**Default posture: SILENCE.** Most tentative hypotheses on most turns won't have accumulated enough evidence to commit either way. Emit \`{"decisions": []}\` when no hypothesis crosses the thresholds — the existing tentative status is preserved by the reducer when you stay silent.

**Promotion criteria (status = "validated").** All of the following must hold:
- At least 3 distinct supporting evidence obs_ids in \`supporting_evidence\`.
- No contradicting evidence obs_ids (\`contradicting_evidence\` is empty).
- Confidence ≥ 0.6 (the updater has seen enough evidence to commit).
The intuition: a hypothesis only becomes "validated" when multiple independent observations converge on it without dissent. A single high-confidence observation is not enough — the architecture's whole point is to accumulate evidence across turns.

**Retirement criteria (status = "contradicted").** All of the following must hold:
- At least 1 contradicting evidence obs_id in \`contradicting_evidence\`.
- Confidence < 0.4 (the updater has already lowered its confidence on the basis of the contradiction).
The intuition: a hypothesis is "contradicted" when the updater has both surfaced contradicting evidence AND lowered its confidence below the threshold of usefulness. Either alone is insufficient — a single contradiction at high confidence may be noise; low confidence with no contradiction may just be uncertainty.

**Keep-as-tentative.** When neither criterion is satisfied, do not emit a decision for that hypothesis. The reducer keeps the existing entry untouched.

Be strict. The cost of false promotion (a poorly-grounded claim that the tutor now treats as established truth) is higher than the cost of false silence (a well-grounded claim that stays tentative one more turn). When borderline, prefer silence.

Output schema (JSON object with one key \`decisions\` mapping to an array):
{"decisions": [
  {
    "hypothesis_id": "<id from the tentative set>",
    "new_status": "validated" | "contradicted",
    "reasoning": "<short sentence citing supporting or contradicting obs_ids>"
  },
  ...
]}

Correct (promotion — strong corroboration, no dissent):
  tentative: [{hypothesis_id: "hyp_abc12345", claim: "Learner is in a questioning stance", confidence: 0.75, supporting_evidence: ["t1_0_ab", "t2_1_cd", "t3_2_ef"], contradicting_evidence: []}]
  output: {"decisions": [{"hypothesis_id": "hyp_abc12345", "new_status": "validated", "reasoning": "Three independent supporting obs_ids (t1_0_ab, t2_1_cd, t3_2_ef) with no contradiction and confidence 0.75."}]}

Correct (retirement — contradicting evidence with low confidence):
  tentative: [{hypothesis_id: "hyp_xyz67890", claim: "Learner is confused about Y", confidence: 0.3, supporting_evidence: ["t1_0_ab"], contradicting_evidence: ["t3_1_gh"]}]
  output: {"decisions": [{"hypothesis_id": "hyp_xyz67890", "new_status": "contradicted", "reasoning": "Contradicting obs_id t3_1_gh; confidence already dropped to 0.3."}]}

Correct (SILENCE — borderline cases, no commitment yet):
  tentative: [{hypothesis_id: "hyp_def54321", claim: "Learner separates X from Y", confidence: 0.5, supporting_evidence: ["t2_0_ij"], contradicting_evidence: []}]
  output: {"decisions": []}
  (Only one supporting obs_id, no contradiction, mid confidence — wait for more evidence.)

INCORRECT (promotion on insufficient evidence):
  tentative: [{hypothesis_id: "hyp_def54321", confidence: 0.8, supporting_evidence: ["t1_0_ab"], contradicting_evidence: []}]
  output: {"decisions": [{"hypothesis_id": "hyp_def54321", "new_status": "validated", "reasoning": "High confidence."}]}
  (Only one supporting obs_id — fails the ≥3 floor. Confidence alone is not corroboration.)

INCORRECT (retirement at high confidence — premature):
  tentative: [{hypothesis_id: "hyp_xyz67890", confidence: 0.7, supporting_evidence: ["t1_0_ab", "t2_1_cd"], contradicting_evidence: ["t3_0_kl"]}]
  output: {"decisions": [{"hypothesis_id": "hyp_xyz67890", "new_status": "contradicted", "reasoning": "Has contradicting evidence."}]}
  (Confidence is 0.7, not below 0.4 — the updater has seen the contradiction but not lowered confidence on it, so the contradiction may be noise rather than a refutation.)

INCORRECT (verdict for an id not in the tentative set):
  tentative: [{hypothesis_id: "hyp_abc12345"}]
  output: {"decisions": [{"hypothesis_id": "hyp_zzz99999", "new_status": "validated", "reasoning": "..."}]}
  (Validator emitted a decision for an id that doesn't exist in the input. The node will drop this silently — emit only verdicts for ids you can see in the tentative set.)

Output JSON only, no surrounding prose, no code fences.`;

const LEARNER_PROFILE_UPDATE_SYSTEM = `You are the tutor's learner-modelling module. Given the current structured learner profile and the learner's most recent message, emit an updated profile that reflects what the message reveals.

The hidden ground-truth state is also provided to you (only because this is a research harness — in production it would not be available). Use it to ground your inferences but do not copy it verbatim.

Respond as a single JSON object with these keys:
- misconceptions: array of short strings naming concrete misconceptions
- confidence: number in [0, 1]
- agencySignal: one of "compliant" | "questioning" | "resistant" | "collaborative" | "unknown"
- zpdEstimate: short string describing the learner's current zone of proximal development
- lastEvidence: short string quoting or paraphrasing the dialogue evidence for this update

Output JSON only.`;

// Id-author system prompt is the canonical id-director static prompt. Loaded
// once at module init so cells 121/122 share the exact same authoring contract
// as the standard id-director cells (101-109). The bilateral_tom-specific
// learner context is threaded in via the user-message builder, not a forked
// system prompt — keeps the prompt as a single source of truth.
const ID_AUTHOR_SYSTEM = fs.readFileSync(
  path.join(PROMPTS_DIR, 'tutor-id-director.md'),
  'utf-8',
);

// tutorEgoExecute (Variant A) has no canonical system prompt — the id-author
// writes one each turn and the graph passes it via systemPromptOverride. This
// constant is a sentinel: callRole rejects an ego-execute call where the
// override is missing or empty.
const TUTOR_EGO_EXECUTE_FALLBACK_SYSTEM = `(no id-authored prompt supplied; this is a fallback so the role table has a non-empty entry — callRole rejects ego-execute calls without systemPromptOverride.)`;

const LEARNER_TURN_SYSTEM = `You are the synthetic learner in a dialogue with a tutor. Generate the learner's next message in plain text (no JSON, no preamble).

You are given the tutor's most recent message and a hidden state describing your actual sophistication and any trigger-turn signal. If this is the trigger turn, you must surface the trigger signal verbatim or in close paraphrase. Otherwise, respond consistently with the actual sophistication level — advanced learners introduce contrasts, novices ask for clarification, etc.

Output the learner's message text directly, no surrounding markup.`;

// ---------------------------------------------------------------------------
// User-prompt builders (compact JSON payloads — easier for models to parse)
// ---------------------------------------------------------------------------

const ub = (obj) => `Input:\n${JSON.stringify(obj, null, 2)}`;

const userPromptBuilders = {
  tutorEgoInitial: ({ learnerLastMessage, learnerProfile }) => ub({ learnerLastMessage, learnerProfile }),

  // Variant for cell_116_recognition_named_patterns. Same payload as
  // tutorEgoInitial plus dialogue history, so the prompt can actually see
  // patterns across turns rather than just the most recent message.
  tutorEgoInitialNamedPatterns: ({ learnerLastMessage, learnerProfile, dialogue }) =>
    ub({ learnerLastMessage, learnerProfile, dialogue }),

  tutorSuperego: ({ tutorInternal, learnerProfile }) => ub({
    draft: tutorInternal.egoDraft,
    policyAction: tutorInternal.policyAction,
    learnerProfile,
  }),

  // Validator gets the picked action's full detail block (trigger conditions
  // + contraindications + expected next signal) inline in the user prompt so
  // it can quote them in feedback. Keeps the system prompt fixed.
  tutorValidator: ({ policyAction, tutorDraft, learnerProfile }) => {
    const detail = POLICY_ACTION_DETAILS?.[policyAction];
    return ub({
      policyAction,
      pickedActionDetail: detail
        ? {
            description: detail.description,
            trigger_conditions: detail.trigger_conditions,
            contraindications: detail.contraindications,
            expected_next_learner_signal: detail.expected_next_learner_signal,
          }
        : { description: POLICY_ACTION_DESCRIPTIONS[policyAction] || '', trigger_conditions: [], contraindications: [] },
      tutorDraft,
      learnerProfile,
    });
  },

  tutorEgoRevision: ({ tutorInternal, learnerProfile }) => ub({
    previousDraft: tutorInternal.egoDraft,
    previousPolicy: tutorInternal.policyAction,
    superegoFeedback: tutorInternal.superegoFeedback,
    learnerProfile,
  }),

  learnerProfileUpdate: ({ learnerLastMessage, hidden, currentProfile, turn }) => ub({
    learnerLastMessage,
    hiddenGroundTruth: hidden,
    currentProfile,
    turn,
  }),

  // ToM tracker takes the dialogue so far, the just-updated learnerProfile,
  // and the current turn index. Hidden state is intentionally NOT passed —
  // the whole point of the probes is that the tutor predicts blind, then we
  // score against ground truth in post-hoc analysis.
  tutorTomTracker: ({ learnerProfile, dialogue, turn }) => ub({
    learnerProfile,
    dialogue,
    turn,
  }),

  // Id-author user message. Mirrors the XML-tagged shape the
  // tutor-id-director.md prompt expects (services/idDirectorEngine.js
  // buildIdRunnerUserMessage), with the bilateral_tom learner state injected
  // as a `<bilateral_tom_context>` block so the id can author against the
  // tutor's view of the learner + second-order belief + ToM probes.
  idAuthorPersona: ({ dialogue, learnerLastMessage, learnerProfile, previousPersona, turn }) => {
    const history = (dialogue || [])
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    return [
      '<dialogue_history>',
      history || '(no prior turns)',
      '</dialogue_history>',
      '',
      '<current_learner_message>',
      learnerLastMessage || '(none)',
      '</current_learner_message>',
      '',
      '<curriculum_context>',
      'Adaptive tutoring trap-scenario harness. The learner is a synthetic',
      'subject with a hidden misconception/agency profile; the tutor must',
      'choose a pedagogical action that addresses the gap between how the',
      'learner is performing the dialogue and what the dialogue actually',
      'needs from them. There is no canonical curriculum text — author for',
      'this turn from the dialogue and learner profile.',
      '</curriculum_context>',
      '',
      '<previous_persona>',
      previousPersona || 'FIRST_TURN',
      '</previous_persona>',
      '',
      '<recognition_mode>',
      'false',
      '</recognition_mode>',
      '',
      '<bilateral_tom_context>',
      JSON.stringify({
        learnerProfile,
        hypothesizedLearnerPerceptionOfTutor: learnerProfile?.hypothesizedLearnerPerceptionOfTutor || null,
        tomProbes: learnerProfile?.tomProbes || null,
        turn,
      }, null, 2),
      '</bilateral_tom_context>',
    ].join('\n');
  },

  // Variant-A ego executor: the id-authored prompt is the system prompt
  // (passed via systemPromptOverride at call time). User message carries the
  // policy-action emission instructions inline so the id-authored prompt
  // doesn't need to know about the policyAction envelope.
  tutorEgoExecute: ({ learnerLastMessage, learnerProfile }) => [
    'Latest learner message:',
    learnerLastMessage || '(none)',
    '',
    'Current learner profile (for grounding):',
    JSON.stringify(learnerProfile || {}, null, 2),
    '',
    'Policy-action emission contract (REQUIRED — do not omit):',
    'After authoring your tutor message, append a fenced JSON envelope that',
    'wraps the message and names the pedagogical action it enacts. Format:',
    '',
    '```json',
    '{"policyAction": "<one of the menu labels below>", "text": "<your tutor message>"}',
    '```',
    '',
    'Policy menu (pick exactly one — your draft must enact this label):',
    policyMenuStr,
    '',
    'Output the JSON envelope ONLY (no surrounding prose, no preamble).',
  ].join('\n'),

  // A14 Stage 2a: evidence extractor user message. Carries the learner's
  // most recent message (the span to extract from), a compact dialogue
  // tail for topic context (kc_candidates), and the turn index. Dialogue is
  // truncated to the last 6 turns — the extractor only needs the local
  // conversational frame, and longer histories burn tokens on irrelevant
  // earlier turns. Hidden ground truth is intentionally NOT passed: evidence
  // must be derivable from what the tutor can actually observe.
  evidenceExtractor: ({ learnerLastMessage, dialogue, turn }) => {
    const tail = Array.isArray(dialogue) ? dialogue.slice(-6) : [];
    return ub({
      learnerLastMessage,
      dialogueTail: tail.map((m) => ({ role: m.role, content: m.content })),
      turn,
    });
  },

  // A14 Stage 2b: hypothesisUpdater user payload. Carries the full validated
  // evidence ledger (so the model can cite any prior obs_id, not just this
  // turn's), the full set of currently live hypotheses (so it can identify
  // revisions and contradictions by hypothesis_id), and the turn index. The
  // node already filters out hypotheses that the TTL sweep is about to mark
  // expired — those would be misleading to the model if it tried to revise
  // them. ground-truth hiddenLearnerState is intentionally NOT passed: the
  // hypothesis ledger is supposed to be derivable from observable evidence,
  // not the hidden truth.
  hypothesisUpdater: ({ validatedEvidence, currentHypotheses, turn }) => ub({
    turn,
    evidenceLedger: (validatedEvidence || []).map((e) => ({
      obs_id: e.obs_id,
      turn: e.turn,
      quote: e.quote,
      type: e.type,
      kc_candidates: e.kc_candidates || [],
    })),
    currentHypotheses: (currentHypotheses || []).map((h) => ({
      hypothesis_id: h.hypothesis_id,
      claim: h.claim,
      confidence: h.confidence,
      supporting_evidence: h.supporting_evidence,
      contradicting_evidence: h.contradicting_evidence,
      status: h.status,
      created_at_turn: h.created_at_turn,
      expires_after_turns: h.expires_after_turns,
    })),
  }),

  // A14 Stage 3: groundingValidator user payload. The validator only sees
  // tentative hypotheses (the node filters `validated`/`contradicted`/`expired`
  // before calling), the validated evidence ledger (so it can cross-reference
  // supporting/contradicting obs_ids), and the turn index. Hidden ground truth
  // is intentionally NOT passed — same posture as the updater. The validator's
  // job is to commit on observable evidence, not on access to the ground truth.
  groundingValidator: ({ hypotheses, evidenceLedger, turn }) => ub({
    turn,
    tentativeHypotheses: (hypotheses || []).map((h) => ({
      hypothesis_id: h.hypothesis_id,
      claim: h.claim,
      confidence: h.confidence,
      supporting_evidence: h.supporting_evidence,
      contradicting_evidence: h.contradicting_evidence,
      created_at_turn: h.created_at_turn,
    })),
    evidenceLedger: (evidenceLedger || []).map((e) => ({
      obs_id: e.obs_id,
      turn: e.turn,
      quote: e.quote,
      type: e.type,
    })),
  }),

  learnerTurn: ({ tutorLastMessage, hidden, turn }) => ub({ tutorLastMessage, hidden, turn }),
};

const systemPrompts = {
  tutorEgoInitial: TUTOR_EGO_INITIAL_SYSTEM,
  tutorEgoInitialNamedPatterns: TUTOR_EGO_INITIAL_NAMED_PATTERNS_SYSTEM,
  tutorSuperego: TUTOR_SUPEREGO_SYSTEM,
  tutorValidator: TUTOR_VALIDATOR_SYSTEM,
  tutorEgoRevision: TUTOR_EGO_REVISION_SYSTEM,
  learnerProfileUpdate: LEARNER_PROFILE_UPDATE_SYSTEM,
  tutorTomTracker: TUTOR_TOM_TRACKER_SYSTEM,
  idAuthorPersona: ID_AUTHOR_SYSTEM,
  tutorEgoExecute: TUTOR_EGO_EXECUTE_FALLBACK_SYSTEM,
  evidenceExtractor: EVIDENCE_EXTRACTOR_SYSTEM,
  hypothesisUpdater: HYPOTHESIS_UPDATER_SYSTEM,
  groundingValidator: GROUNDING_VALIDATOR_SYSTEM,
  learnerTurn: LEARNER_TURN_SYSTEM,
};

const responseSchemas = {
  tutorEgoInitial: tutorEgoInitialOut,
  tutorEgoInitialNamedPatterns: tutorEgoInitialOut,
  tutorSuperego: tutorSuperegoOut,
  tutorValidator: tutorValidatorOut,
  tutorEgoRevision: tutorEgoRevisionOut,
  learnerProfileUpdate: learnerProfileUpdateOut,
  tutorTomTracker: tutorTomTrackerOut,
  // idAuthorPersona uses the canonical parseIdConstruction (not Zod) — set
  // schema=null and handle parsing in callRole below.
  idAuthorPersona: null,
  tutorEgoExecute: tutorEgoInitialOut,
  evidenceExtractor: evidenceExtractorOut,
  hypothesisUpdater: hypothesisUpdaterOut,
  groundingValidator: groundingValidatorOut,
  learnerTurn: null, // plain text
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function callRole(role, payload) {
  const buildUser = userPromptBuilders[role];
  const baseSystemPrompt = systemPrompts[role];
  if (!buildUser || !baseSystemPrompt) {
    throw new Error(`adaptiveTutor.realLLM: no prompt for role '${role}'`);
  }

  // tutorEgoInitial (in the bilateral_tom_id_director_v2 path) and
  // tutorEgoExecute (Variant A) accept a per-call systemPromptOverride from
  // the graph. Other roles ignore it. tutorEgoExecute is the only role that
  // *requires* it — calling without an override would route the canonical
  // ego prompt for that role, which is the wrong thing for the crossover.
  const override = (typeof payload?.systemPromptOverride === 'string' && payload.systemPromptOverride.length > 0)
    ? payload.systemPromptOverride
    : null;
  if (role === 'tutorEgoExecute' && !override) {
    throw new Error(`adaptiveTutor.realLLM[tutorEgoExecute]: systemPromptOverride is required (id-authored prompt missing).`);
  }
  const systemPrompt = override || baseSystemPrompt;

  const agentConfig = buildAgentConfig(role);
  const userPrompt = buildUser(payload);

  // Pre-call budget gate. The estimate is a heuristic abort signal; the
  // exact cost is recorded post-call from raw.cost (set by tutor-core's
  // callAI). When no tracker is active (mock runs, or --max-cost omitted)
  // both branches are no-ops.
  if (_activeBudgetTracker) {
    const promptForEstimate = `${systemPrompt}\n${userPrompt}`;
    const est = _activeBudgetTracker.estimate(
      promptForEstimate,
      agentConfig.hyperparameters?.max_tokens,
      agentConfig.model,
    );
    _activeBudgetTracker.assertBelowCeiling(est);
  }

  const raw = await callAI(agentConfig, systemPrompt, userPrompt, role);

  if (_activeBudgetTracker) {
    _activeBudgetTracker.record({
      inputTokens: raw?.inputTokens || 0,
      outputTokens: raw?.outputTokens || 0,
      cost: raw?.cost || 0,
    });
  }

  const text = raw?.text ?? '';

  const schema = responseSchemas[role];
  if (schema == null) {
    // idAuthorPersona uses the canonical id-director parser; it returns the
    // construction envelope directly (with a fallback shape on parse failure
    // — same posture as services/idDirectorEngine.js so downstream code that
    // reads parse_status keeps working).
    if (role === 'idAuthorPersona') {
      return parseIdConstruction(text);
    }
    // learnerTurn — plain text output, just return it
    return text.trim();
  }

  let parsed;
  try {
    parsed = parseJsonLoose(text);
  } catch (err) {
    throw new Error(`adaptiveTutor.realLLM[${role}]: failed to parse JSON: ${err.message}\n--- raw ---\n${text}`);
  }

  // learnerProfileUpdate gets the turn merged in by the graph node, but we
  // also fold the supplied `currentProfile.misconceptions` baseline through
  // so models that drop the field don't wipe history.
  if (role === 'learnerProfileUpdate' && parsed && payload?.currentProfile) {
    parsed.misconceptions = parsed.misconceptions ?? payload.currentProfile.misconceptions ?? [];
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`adaptiveTutor.realLLM[${role}]: schema validation failed: ${validated.error.message}\n--- raw ---\n${JSON.stringify(parsed, null, 2)}`);
  }
  const out = validated.data;

  // The graph expects learnerProfileUpdate to also carry updatedAtTurn
  // (set by the node, since the model shouldn't be trusted with bookkeeping).
  return out;
}
