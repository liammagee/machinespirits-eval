/**
 * Model-stack default warning (CLAUDE.md "Model stack default").
 *
 * Standing directive (repository owner, 2026-07-07): nemotron/kimi must
 * never be the DEFAULT pairing for new runs — the strong stack
 * (codex.gpt-5.5 or claude-code Sonnet 5 via the CLI bridge) is the
 * default unless the user explicitly specifies otherwise. Nulls generated
 * on nemotron/kimi are stack-bounded until replicated on a strong model
 * (the A4 false-negative concern).
 *
 * This module implements the non-blocking detection half: given the
 * resolved run configs, report which cells would run on the weak
 * OpenRouter pairing with no explicit model override. The runner prints
 * the result to stderr and proceeds unchanged — a warning, not a
 * behavior change to existing cells.
 */

import * as evalConfigLoader from './evalConfigLoader.js';

const WEAK_EGO_PATTERN = /nemotron/i;
const WEAK_SUPEREGO_PATTERN = /kimi/i;

/**
 * Does this config carry any explicit tutor-side model override?
 * (Overrides are the user "specifying otherwise" — no warning then.)
 */
function hasExplicitTutorOverride(config) {
  return Boolean(
    config?.modelOverride || config?.tutorModelOverride || config?.egoModelOverride || config?.superegoModelOverride,
  );
}

/**
 * Collect configs whose resolved tutor stack is the weak nemotron/kimi
 * OpenRouter pairing and which carry no explicit model override.
 *
 * @param {Array<Object>} targetConfigs - Resolved run configs ({profileName, ...overrides})
 * @returns {Array<{profileName: string, ego: string|null, superego: string|null}>}
 */
export function collectWeakStackConfigs(targetConfigs = []) {
  const flagged = [];
  for (const config of Array.isArray(targetConfigs) ? targetConfigs : []) {
    if (!config || typeof config !== 'object') continue;
    if (!config.profileName) continue;
    if (hasExplicitTutorOverride(config)) continue;

    let profile = null;
    try {
      profile = evalConfigLoader.getTutorProfile(config.profileName);
    } catch {
      continue; // unknown profile — other validation will surface it
    }
    const egoModel = profile?.ego?.model || null;
    const superegoModel = profile?.superego?.model || null;
    const weakEgo = egoModel != null && WEAK_EGO_PATTERN.test(String(egoModel));
    const weakSuperego = superegoModel != null && WEAK_SUPEREGO_PATTERN.test(String(superegoModel));
    if (weakEgo || weakSuperego) {
      flagged.push({ profileName: config.profileName, ego: egoModel, superego: superegoModel });
    }
  }
  return flagged;
}

/**
 * Build the human-readable warning (or null when nothing is flagged).
 *
 * @param {Array} flagged - Output of collectWeakStackConfigs
 * @param {number} totalConfigs - Total configs in the run
 * @returns {string|null}
 */
export function formatWeakStackWarning(flagged, totalConfigs = 0) {
  if (!Array.isArray(flagged) || flagged.length === 0) return null;
  const example = flagged[0];
  const exampleBits = [
    example.ego ? `ego=${example.ego}` : null,
    example.superego ? `superego=${example.superego}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return [
    `[stack-default] WARNING: ${flagged.length} of ${totalConfigs} selected cell(s) resolve to the weak`,
    `nemotron/kimi OpenRouter pairing with no explicit model override (e.g. ${example.profileName}: ${exampleBits}).`,
    `Per CLAUDE.md "Model stack default", nemotron/kimi must never be the default pairing for new runs —`,
    `default to the CLI bridge instead: --ego-model codex.gpt-5.5 --superego-model codex.gpt-5.5`,
    `(or claude-code.sonnet-5), unless the weak stack is an explicit design choice for this run.`,
    `Nulls generated on nemotron/kimi are stack-bounded until replicated on a strong model.`,
    `Proceeding unchanged (non-blocking warning).`,
  ].join('\n');
}

/**
 * Convenience: detect + print to stderr in one call. Never throws.
 *
 * @param {Array<Object>} targetConfigs
 * @returns {boolean} Whether a warning was printed
 */
export function warnIfWeakStackDefault(targetConfigs = []) {
  try {
    const flagged = collectWeakStackConfigs(targetConfigs);
    const message = formatWeakStackWarning(flagged, Array.isArray(targetConfigs) ? targetConfigs.length : 0);
    if (message) {
      console.error(message);
      return true;
    }
  } catch {
    /* a warning must never break a run */
  }
  return false;
}
