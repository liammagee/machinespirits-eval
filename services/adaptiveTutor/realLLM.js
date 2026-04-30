// Real-LLM backend for the adaptive cell.
//
// Maps each graph role onto a single tutor-core callAI() invocation, with
// a JSON-shaped response and Zod validation against the role's expected
// shape. The interface matches mockLLM.callRole exactly so the graph
// nodes never know which backend is in use.
//
// Provider routing reuses tutor-core's tutorDialogueEngine.callAI — the
// same path the existing tutor + learner agents use. Model resolution
// goes through learnerConfigLoader.getProviderConfig so eval-repo's
// provider table (config/providers.yaml) is the source of truth.

import { tutorDialogueEngine } from '@machinespirits/tutor-core';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import { getProviderConfig } from '../learnerConfigLoader.js';
import { POLICY_ACTIONS, POLICY_ACTION_DESCRIPTIONS } from './policyActions.js';

const { callAI } = tutorDialogueEngine;

const DEFAULT_PROVIDER = 'openrouter';
const DEFAULT_MODEL_ALIAS = 'nemotron';

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

const TUTOR_EGO_INITIAL_SYSTEM = `You are the tutor's planning module. Each turn, given the learner's most recent message and a structured profile of the learner, pick exactly one pedagogical action from the menu and draft a tutor response that enacts it.

You must adapt to the structured profile. If the profile changes between calls, your action choice and message should change too. Do not collapse to a default explanation.

Policy menu:
${policyMenuStr}

Respond as a single JSON object with exactly these keys:
- policyAction: one of the menu labels above (no others)
- text: the tutor's message to the learner (1–4 sentences, no preamble, no meta-talk)
- rationale: one short sentence saying why this action fits this learner profile (optional)

Output JSON only, no surrounding prose, no code fences.`;

const TUTOR_SUPEREGO_SYSTEM = `You are the tutor's pedagogical critic. You receive the tutor's draft response and the current learner profile. Decide whether the draft needs revision.

Mark needsRevision=true if and only if at least one of these holds:
- The draft contradicts the policy action label (e.g. claims to ask a diagnostic question but actually explains).
- The draft is contraindicated by the profile (e.g. long explanation to a low-confidence learner; lecturing to a resistant learner).
- The draft mentions internal deliberation, the policy label, or the profile itself in a way the learner would see.

Otherwise needsRevision=false.

Respond as a single JSON object: {"needsRevision": boolean, "feedback": string}. Output JSON only.`;

const TUTOR_EGO_REVISION_SYSTEM = `You are the tutor's planning module on a revision pass. Given the previous draft, the superego's feedback, and the learner profile, produce a revised tutor message and (optionally) a different policy action.

${policyMenuStr}

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
  tutorEgoRevision: TUTOR_EGO_REVISION_SYSTEM,
  learnerProfileUpdate: LEARNER_PROFILE_UPDATE_SYSTEM,
  learnerTurn: LEARNER_TURN_SYSTEM,
};

const responseSchemas = {
  tutorEgoInitial: tutorEgoInitialOut,
  tutorSuperego: tutorSuperegoOut,
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
  const raw = await callAI(agentConfig, systemPrompt, userPrompt, role);
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
