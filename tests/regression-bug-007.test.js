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
 * from cell_1 outputs. See paper Appendix E v3.0.47 for the full incident.
 *
 * THIS TEST asserts on `resolveEvalProfile(cellName).dispatchedProfileName` —
 * the if/else-if chain's pick. For every canonical YAML cell:
 *   - if `factors.prompt_type` is anything other than `'base'`,
 *   - then the dispatch chain must route it by name (not fall through to
 *     'budget' via the final `else`).
 *
 * `dispatchedProfileName` remains a diagnostic compatibility field for this
 * incident. Since tutor-core was in-housed, it must equal the profile that
 * actually loads; a missing target now fails closed rather than degrading.
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
import { CANONICAL_EVAL_PROFILES, resolveEvalProfile } from '../services/evaluationRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, '..', 'config');
const tutorConfig = yaml.parse(fs.readFileSync(path.join(configDir, 'tutor-agents.yaml'), 'utf8'));
const profiles = tutorConfig.profiles || {};

describe('bug_007 regression: dispatch chain coverage for non-base prompt_types', () => {
  it('every canonical cell with prompt_type ≠ base dispatches to a non-budget profile', () => {
    const failures = [];
    const skipped = [];

    for (const cellName of CANONICAL_EVAL_PROFILES) {
      const profile = profiles[cellName];

      if (profile?.runner === 'adaptive') {
        // Adaptive cells bypass evaluationRunner.js and tutor-core's dialogue
        // engine entirely (CLAUDE.md: "Runner Dispatch"). resolveEvalProfile()
        // is never called on their dispatch path, so dispatch coverage is
        // not a meaningful invariant for them.
        skipped.push({ cellName, reason: 'runner: adaptive (bypasses dispatch)' });
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
      // A non-base prompt_type landing on budget means there is no dispatch
      // branch for it — bug_007.
      if (resolved.dispatchedProfileName === 'budget') {
        failures.push({
          cell: cellName,
          promptType,
          recognitionMode: profile?.recognition_mode ?? false,
          expectedDispatch: '(non-budget; needs a dispatch-chain branch in resolveEvalProfile)',
          actualDispatch: 'budget',
        });
      }
    }

    assert.strictEqual(
      failures.length,
      0,
      `bug_007 pattern detected — ${failures.length} cell(s) silently dispatched to 'budget' despite having a non-base prompt_type:\n${JSON.stringify(failures, null, 2)}\n\nFix: add a dispatch branch for the offending prompt_type(s) in services/evaluationRunner.js::resolveEvalProfile (the if/else-if chain on promptType). See paper Appendix E v3.0.47.`,
    );
  });

  it('every distinct non-base prompt_type used in canonical cells has a dispatch-chain branch', () => {
    // Same invariant as test 1, restated at prompt_type granularity: collect
    // every *dispatch* name produced for each non-base prompt_type across the
    // cells that use it. If a prompt_type's only dispatch target is 'budget',
    // it has no branch of its own — bug_007.
    //
    const promptTypeDispatches = {};
    for (const cellName of CANONICAL_EVAL_PROFILES) {
      const profile = profiles[cellName];
      if (profile?.runner === 'adaptive') continue; // adaptive cells bypass dispatch
      const promptType = profile?.factors?.prompt_type;
      if (!promptType || promptType === 'base') continue;

      const resolved = resolveEvalProfile(cellName);
      promptTypeDispatches[promptType] ||= new Set();
      promptTypeDispatches[promptType].add(resolved.dispatchedProfileName);
    }

    // For each non-base prompt_type, the dispatch target(s) should not be just
    // {'budget'}. (More than one entry is fine — divergent_*/dialectical_*
    // legitimately dispatch to different names depending on recognition_mode.)
    const failures = [];
    for (const [promptType, dispatchSet] of Object.entries(promptTypeDispatches)) {
      const dispatchNames = [...dispatchSet];
      if (dispatchNames.length === 1 && dispatchNames[0] === 'budget') {
        failures.push({ promptType, dispatchesTo: dispatchNames });
      }
    }

    assert.strictEqual(
      failures.length,
      0,
      `${failures.length} prompt_type(s) used in EVAL_ONLY_PROFILES dispatch only to 'budget' across all cells using them — missing dispatch branch:\n${JSON.stringify(failures, null, 2)}`,
    );
  });

  it('matched_pedagogical / matched_behaviorist dispatch by name (A10/A10b density controls)', () => {
    // Positive pin for the density-control case: both the dispatch diagnostic
    // and actual in-housed target must retain the authored profile.
    const cases = [
      ['cell_95_base_matched_single_unified', 'matched_pedagogical'],
      ['cell_96_base_behaviorist_single_unified', 'matched_behaviorist'],
    ];
    for (const [cellName, expectedDispatch] of cases) {
      assert.ok(
        CANONICAL_EVAL_PROFILES.includes(cellName) && profiles[cellName],
        `${cellName} should be a registered cell with a YAML definition`,
      );
      const resolved = resolveEvalProfile(cellName);
      assert.strictEqual(
        resolved.dispatchedProfileName,
        expectedDispatch,
        `${cellName} must dispatch to '${expectedDispatch}'`,
      );
      assert.strictEqual(resolved.resolvedProfileName, expectedDispatch);
    }
  });
});
