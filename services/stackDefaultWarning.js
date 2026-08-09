/**
 * Model-stack default warning (CLAUDE.md "Model stack default").
 *
 * Standing directive (repository owner, 2026-07-07): nemotron/kimi must
 * never be the DEFAULT pairing for new runs — the strong stack
 * (codex.gpt-5.6-luna or claude-code Sonnet 5 via the CLI bridge) is the
 * default unless the user explicitly specifies otherwise. Nulls generated
 * on nemotron/kimi are stack-bounded until replicated on a strong model
 * (the A4 false-negative concern).
 *
 * This module implements the non-blocking detection half: given the
 * resolved run configs, report which cells would run on the weak
 * OpenRouter pairing. The runner prints the result to stderr and
 * proceeds unchanged — a warning, not a behavior change to existing cells.
 *
 * The check reads the models that will actually be called: an override
 * replaces the cell YAML's model, and the models left after that are what
 * gets tested. Until 2026-08-08 it did the opposite — any tutor-side
 * override at all skipped the check, so the August register runs passed
 * --tutor-model codex.gpt-5.5, went on calling the YAML's nemotron on the
 * id-director path, and never saw the warning.
 */

import * as evalConfigLoader from './evalConfigLoader.js';

const WEAK_EGO_PATTERN = /nemotron/i;
const WEAK_SUPEREGO_PATTERN = /kimi/i;

/**
 * The ego and id models a config will actually call: the CLI override where
 * one applies, the cell YAML otherwise. --model and --tutor-model replace
 * both seats; --ego-model and --superego-model replace one each.
 */
function effectiveStack(config, profile) {
  const both = config?.tutorModelOverride || config?.modelOverride || null;
  const ego = config?.egoModelOverride || both;
  const superego = config?.superegoModelOverride || both;
  return {
    ego: ego || profile?.ego?.model || null,
    superego: superego || profile?.superego?.model || null,
  };
}

/**
 * Collect configs whose tutor stack, after any overrides, is the weak
 * nemotron/kimi OpenRouter pairing.
 *
 * @param {Array<Object>} targetConfigs - Resolved run configs ({profileName, ...overrides})
 * @returns {Array<{profileName: string, ego: string|null, superego: string|null}>}
 */
export function collectWeakStackConfigs(targetConfigs = []) {
  const flagged = [];
  for (const config of Array.isArray(targetConfigs) ? targetConfigs : []) {
    if (!config || typeof config !== 'object') continue;
    if (!config.profileName) continue;

    let profile = null;
    try {
      profile = evalConfigLoader.getTutorProfile(config.profileName);
    } catch {
      continue; // unknown profile — other validation will surface it
    }
    const { ego: egoModel, superego: superegoModel } = effectiveStack(config, profile);
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
    `[stack-default] WARNING: ${flagged.length} of ${totalConfigs} selected cell(s) will call the weak`,
    `nemotron/kimi OpenRouter pairing (e.g. ${example.profileName}: ${exampleBits}).`,
    `Per CLAUDE.md "Model stack default", nemotron/kimi must never be the default pairing for new runs —`,
    `default to the CLI bridge instead: --ego-model codex.gpt-5.6-luna --superego-model codex.gpt-5.6-luna`,
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
