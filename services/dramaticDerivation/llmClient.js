/**
 * LLM client for the dramatic-derivation role bridges — the mock/real seam
 * (same discipline as services/adaptiveTutor/llm.js: default is mock so
 * smokes, tests, and plumbing iterations cost nothing; DERIVATION_LLM=real
 * routes through tutor-core's unifiedAIProvider with providers.yaml alias
 * resolution).
 *
 *   DERIVATION_LLM       mock (default) | real
 *   DERIVATION_PROVIDER  provider name (default: openrouter)
 *   DERIVATION_MODEL     model alias or id (default: gemini-flash — the
 *                        plan's cheap-default cost discipline, §3 step 5)
 *
 * The mock backend answers from the bridge-supplied `meta` hints through the
 * SAME parse path the real backend uses, so llmRoles' prompt → JSON → output
 * plumbing is exercised end-to-end with zero model calls. Per-client usage
 * (calls, tokens, synthesized cost) is accumulated for the loop ledger.
 */

import { unifiedAIProvider } from '../../tutor-core/index.js';
import { getProviderConfig } from '../learnerConfigLoader.js';
import { lookupRates } from '../adaptiveTutor/budgetTracker.js';

const DEFAULT_PROVIDER = 'openrouter';
const DEFAULT_MODEL_ALIAS = 'gemini-flash';

export function llmMode() {
  return (process.env.DERIVATION_LLM || 'mock').toLowerCase();
}

export function resolveTarget() {
  const provider = process.env.DERIVATION_PROVIDER || DEFAULT_PROVIDER;
  const alias = process.env.DERIVATION_MODEL || DEFAULT_MODEL_ALIAS;
  let model = alias;
  try {
    const cfg = getProviderConfig(provider);
    model = cfg?.models?.[alias] || alias;
  } catch {
    /* unknown provider in config — pass alias through, the call will say so */
  }
  return { provider, model };
}

const NON_RETRYABLE = [/\b40[013]\b/, /unauthorized/i, /forbidden/i, /invalid[_ ]api[_ ]key/i, /no API key/i];

function mockResponse(role, meta = {}) {
  if (role === 'director') {
    return JSON.stringify({
      direction: meta.releaseSurface
        ? `[It comes before the room: ${meta.releaseSurface}]`
        : `[The question holds the stage: ${meta.question || ''}]`,
    });
  }
  if (role === 'tutor') {
    return JSON.stringify({
      dialogue: meta.releaseSurface
        ? `Consider what is now before you: ${meta.releaseSurface} What does it do to what you already hold?`
        : 'Hold what you have against the rules you trust. What follows, and what is still missing?',
      move: {
        figure: 'erotema',
        target_premise: meta.cuePremise || null,
        intent: meta.cuePremise ? 'release' : 'consolidate',
      },
    });
  }
  if (role === 'learner') {
    const adoptAll = Array.from({ length: meta.adoptableCount || 0 }, (_, i) => i);
    return JSON.stringify({
      dialogue: meta.patternAssertion
        ? `Then it is shown: ${meta.patternAssertion.surface}.`
        : adoptAll.length
          ? 'I take what has been shown and set it beside the rest.'
          : 'I am listening; nothing new is on the table.',
      adopt_indices: adoptAll,
      retract_indices: [],
      hypothesis: meta.patternAssertion ? null : adoptAll.length ? 'weighing what this changes' : null,
      asserts_binding: meta.patternAssertion ? meta.patternAssertion.binding : null,
    });
  }
  throw new Error(`derivation.llmClient: unknown mock role '${role}'`);
}

/**
 * @returns {{ call(role, {system, user, meta}) => Promise<string>,
 *             usage() => {calls, inputTokens, outputTokens, costUSD},
 *             mode: string }}
 */
export function makeLlmClient({ mode = llmMode(), temperature = 0.7, maxTokens = 600 } = {}) {
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 };

  async function callOnce(system, user, target) {
    return unifiedAIProvider.call({
      provider: target.provider,
      model: target.model,
      systemPrompt: system,
      messages: [{ role: 'user', content: user }],
      preset: 'direct',
      config: { temperature, maxTokens },
    });
  }

  async function call(role, { system, user, meta }) {
    usage.calls += 1;
    if (mode === 'mock') return mockResponse(role, meta);
    if (mode !== 'real') {
      throw new Error(`derivation.llmClient: unknown DERIVATION_LLM mode '${mode}' (expected 'mock' or 'real')`);
    }
    const target = resolveTarget();
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await callOnce(system, user, target);
        const inputTokens = response.usage?.inputTokens || 0;
        const outputTokens = response.usage?.outputTokens || 0;
        let cost = response.usage?.cost || 0;
        if (cost === 0 && (inputTokens > 0 || outputTokens > 0)) {
          const [inRate, outRate] = lookupRates(response.model || target.model);
          cost = (inputTokens / 1000) * inRate + (outputTokens / 1000) * outRate;
        }
        usage.inputTokens += inputTokens;
        usage.outputTokens += outputTokens;
        usage.costUSD += cost;
        return response.content || '';
      } catch (err) {
        lastErr = err;
        const msg = err?.message || String(err);
        if (attempt === 3 || NON_RETRYABLE.some((re) => re.test(msg))) throw err;
        await new Promise((r) => setTimeout(r, attempt * 750));
      }
    }
    throw lastErr;
  }

  return { call, usage: () => ({ ...usage }), mode };
}
