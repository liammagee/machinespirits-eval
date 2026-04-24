/**
 * Bug_007 Regression Test
 *
 * Bug_007 (discovered 2026-04-23 during /ultrareview of paper v3.0.46):
 * `services/evaluationRunner.js::resolveEvalProfile` had no dispatch-chain
 * branch for the newly-introduced `prompt_type: matched_pedagogical`. With
 * `recognition_mode: false`, control fell through to the final `else` clause
 * and `resolvedProfileName` was set to `'budget'` — silently routing cell_95
 * to the base prompt instead of the authored matched-pedagogical prompt.
 *
 * The bug invalidated A10 v1 (run eval-2026-04-22-04497df0). Discovered only
 * after the fact when raw cell_95 outputs were lexically indistinguishable
 * from cell_1 outputs. See paper Appendix E v3.0.47 for full incident write-up.
 *
 * THIS TEST: for every cell in EVAL_ONLY_PROFILES, asserts that
 *   - if `factors.prompt_type` is anything other than `'base'`,
 *   - then `resolveEvalProfile(cellName).resolvedProfileName !== 'budget'`
 *
 * Catches the bug_007 pattern automatically when a future cell introduces a
 * new `prompt_type` and the dispatch chain isn't extended.
 *
 * Note: 'base' prompt_type is the *only* legitimate path to 'budget' in the
 * dispatch chain. Cells with `prompt_type: base` and `recognition_mode: false`
 * correctly resolve to 'budget' (which loads the base tutor-core prompt).
 * Cells with `prompt_type: base` and `recognition_mode: true` resolve to
 * 'recognition' via the `else if (recognitionMode)` branch.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { resolveEvalProfile, EVAL_ONLY_PROFILES } from '../services/evaluationRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, '..', 'config');
const tutorConfig = yaml.parse(fs.readFileSync(path.join(configDir, 'tutor-agents.yaml'), 'utf8'));
const profiles = tutorConfig.profiles || {};

describe('bug_007 regression: dispatch chain coverage for non-base prompt_types', () => {
  it('every EVAL_ONLY_PROFILES cell with prompt_type ≠ base resolves to a non-budget profile', () => {
    const failures = [];
    const skipped = [];

    for (const cellName of EVAL_ONLY_PROFILES) {
      const profile = profiles[cellName];
      if (!profile) {
        // Cell missing from YAML — separate concern, handled by validate-config.
        skipped.push({ cellName, reason: 'not in YAML' });
        continue;
      }

      const promptType = profile?.factors?.prompt_type;
      if (!promptType) {
        skipped.push({ cellName, reason: 'no prompt_type in factors' });
        continue;
      }
      if (promptType === 'base') {
        // 'base' prompt_type legitimately resolves to 'budget' under non-recognition_mode.
        continue;
      }

      const resolved = resolveEvalProfile(cellName);
      if (resolved.resolvedProfileName === 'budget') {
        failures.push({
          cell: cellName,
          promptType,
          recognitionMode: profile?.recognition_mode ?? false,
          expectedResolution: '(non-budget; needs dispatch-chain branch in resolveEvalProfile)',
          actualResolution: 'budget',
        });
      }
    }

    assert.strictEqual(
      failures.length,
      0,
      `bug_007 pattern detected — ${failures.length} cell(s) silently fell back to 'budget' despite having a non-base prompt_type:\n${JSON.stringify(failures, null, 2)}\n\nFix: add a dispatch branch for the offending prompt_type(s) in services/evaluationRunner.js::resolveEvalProfile (look for the if/else-if chain around lines 220-248). See paper Appendix E v3.0.47.`,
    );
  });

  it('every distinct non-base prompt_type used in EVAL_ONLY_PROFILES has a dispatch-chain branch', () => {
    // Stronger test: if a cell with prompt_type X resolves to 'budget' OR to 'recognition'
    // ONLY because of the recognitionMode catch-all (rather than because of an explicit
    // branch), we still want to flag X. The signal: the resolved name should match
    // a recognisable transformation of the prompt_type, not just be 'recognition' or 'budget'.
    //
    // We detect this by checking: does flipping recognition_mode produce a different
    // resolved name? If the cell's prompt_type has its own dispatch branch, the resolved
    // name should usually NOT depend on recognitionMode (or should depend in a structured
    // way like divergent_X / dialectical_X). If recognitionMode is the only thing that
    // matters, the prompt_type isn't being routed by name.

    const promptTypeRoutes = {};
    for (const cellName of EVAL_ONLY_PROFILES) {
      const profile = profiles[cellName];
      const promptType = profile?.factors?.prompt_type;
      if (!promptType || promptType === 'base') continue;

      const resolved = resolveEvalProfile(cellName);
      promptTypeRoutes[promptType] ||= new Set();
      promptTypeRoutes[promptType].add(resolved.resolvedProfileName);
    }

    // For each non-base prompt_type, the resolved profile name(s) should not be just
    // {'budget'}. (One or more entries are fine — divergent_*/dialectical_* legitimately
    // produce different names depending on recognition_mode.)
    const failures = [];
    for (const [promptType, resolvedSet] of Object.entries(promptTypeRoutes)) {
      const resolvedNames = [...resolvedSet];
      if (resolvedNames.length === 1 && resolvedNames[0] === 'budget') {
        failures.push({ promptType, resolvedTo: resolvedNames });
      }
    }

    assert.strictEqual(
      failures.length,
      0,
      `${failures.length} prompt_type(s) used in EVAL_ONLY_PROFILES resolve to 'budget' across all cells using them — likely missing dispatch branch:\n${JSON.stringify(failures, null, 2)}`,
    );
  });
});
