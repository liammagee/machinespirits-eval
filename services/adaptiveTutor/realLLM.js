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

import { unifiedAIProvider } from '@machinespirits/tutor-core';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import { getProviderConfig } from '../learnerConfigLoader.js';
import { POLICY_ACTIONS, POLICY_ACTION_DESCRIPTIONS, POLICY_ACTION_DETAILS } from './policyActions.js';
import { lookupRates } from './budgetTracker.js';

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

async function callAI(agentConfig, systemPrompt, userPrompt, role) {
  const { provider, model, hyperparameters } = agentConfig;
  const callOnce = () => unifiedAIProvider.call({
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
const DEFAULT_MODEL_ALIAS = 'nemotron';

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

function envFor(role) {
  const upper = role.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase();
  return {
    provider: process.env[`ADAPTIVE_TUTOR_${upper}_PROVIDER`] || process.env.ADAPTIVE_TUTOR_PROVIDER || DEFAULT_PROVIDER,
    modelAlias: process.env[`ADAPTIVE_TUTOR_${upper}_MODEL`] || process.env.ADAPTIVE_TUTOR_MODEL || DEFAULT_MODEL_ALIAS,
    temperature: Number(process.env[`ADAPTIVE_TUTOR_${upper}_TEMP`] || process.env.ADAPTIVE_TUTOR_TEMP || 0.6),
    maxTokens: Number(process.env[`ADAPTIVE_TUTOR_${upper}_MAX_TOKENS`] || process.env.ADAPTIVE_TUTOR_MAX_TOKENS || 1500),
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
function parseJsonLoose(text) {
  if (text == null) throw new Error('empty response');
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  const start = [firstBrace, firstBracket].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (start === undefined) throw new Error(`no JSON object/array in response: ${s.slice(0, 200)}`);
  const candidate = s.slice(start);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(jsonrepair(candidate));
  }
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

Policy menu:
${policyMenuExpanded}

Respond as a single JSON object with exactly these keys:
- policyAction: one of the menu labels above (no others)
- text: the tutor's message to the learner (1–4 sentences, no preamble, no meta-talk)
- rationale: one short sentence saying why this action fits this learner profile, citing a trigger condition or contraindication when relevant (optional)

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

const LEARNER_PROFILE_UPDATE_SYSTEM = `You are the tutor's learner-modelling module. Given the current structured learner profile and the learner's most recent message, emit an updated profile that reflects what the message reveals.

The hidden ground-truth state is also provided to you (only because this is a research harness — in production it would not be available). Use it to ground your inferences but do not copy it verbatim.

Respond as a single JSON object with these keys:
- misconceptions: array of short strings naming concrete misconceptions
- confidence: number in [0, 1]
- agencySignal: one of "compliant" | "questioning" | "resistant" | "collaborative" | "unknown"
- zpdEstimate: short string describing the learner's current zone of proximal development
- lastEvidence: short string quoting or paraphrasing the dialogue evidence for this update

Output JSON only.`;

const LEARNER_TURN_SYSTEM = `You are the synthetic learner in a dialogue with a tutor. Generate the learner's next message in plain text (no JSON, no preamble).

You are given the tutor's most recent message and a hidden state describing your actual sophistication and any trigger-turn signal. If this is the trigger turn, you must surface the trigger signal verbatim or in close paraphrase. Otherwise, respond consistently with the actual sophistication level — advanced learners introduce contrasts, novices ask for clarification, etc.

Output the learner's message text directly, no surrounding markup.`;

// ---------------------------------------------------------------------------
// User-prompt builders (compact JSON payloads — easier for models to parse)
// ---------------------------------------------------------------------------

const ub = (obj) => `Input:\n${JSON.stringify(obj, null, 2)}`;

const userPromptBuilders = {
  tutorEgoInitial: ({ learnerLastMessage, learnerProfile }) => ub({ learnerLastMessage, learnerProfile }),

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

  learnerTurn: ({ tutorLastMessage, hidden, turn }) => ub({ tutorLastMessage, hidden, turn }),
};

const systemPrompts = {
  tutorEgoInitial: TUTOR_EGO_INITIAL_SYSTEM,
  tutorSuperego: TUTOR_SUPEREGO_SYSTEM,
  tutorValidator: TUTOR_VALIDATOR_SYSTEM,
  tutorEgoRevision: TUTOR_EGO_REVISION_SYSTEM,
  learnerProfileUpdate: LEARNER_PROFILE_UPDATE_SYSTEM,
  learnerTurn: LEARNER_TURN_SYSTEM,
};

const responseSchemas = {
  tutorEgoInitial: tutorEgoInitialOut,
  tutorSuperego: tutorSuperegoOut,
  tutorValidator: tutorValidatorOut,
  tutorEgoRevision: tutorEgoRevisionOut,
  learnerProfileUpdate: learnerProfileUpdateOut,
  learnerTurn: null, // plain text
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function callRole(role, payload) {
  const buildUser = userPromptBuilders[role];
  const systemPrompt = systemPrompts[role];
  if (!buildUser || !systemPrompt) {
    throw new Error(`adaptiveTutor.realLLM: no prompt for role '${role}'`);
  }

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
