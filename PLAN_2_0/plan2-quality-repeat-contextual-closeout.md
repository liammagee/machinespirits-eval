# Plan 2.0 Adaptation Branch Closeout

Date: 2026-06-18

Branch: `claude/derivation-fast-iteration`
Evidence head before this closeout note: `0159e3fe`

## Claim

`cell_149_plan2_quality_repeat_contextual` preserves strict adaptive strategy shifting and improves the Plan 2.0 tutoring-quality composite over the prior closed-loop baseline under the completed Sonnet judge pass. Opus broadly agrees on positive last-turn/development quality, with two scenario-level negative-development caveats. Codex remains tentative only.

This is a merge-ready evidence slice, not a new tuning loop.

## Runs And Cells

Plan 2.0 sweep run ids used for the final Sonnet quality comparison:

- `eval-2026-06-18-fd368169`
- `eval-2026-06-18-03a41262`
- `eval-2026-06-18-9d608b54`
- `eval-2026-06-18-4a9d6d6c`
- `eval-2026-06-18-66f9a6b1`
- `eval-2026-06-18-132c26c0`
- `eval-2026-06-18-472e33c5`

Cells in the final Sonnet comparison:

- `cell_135_plan2_closed_loop` (baseline)
- `cell_137_plan2_quality_ownership`
- `cell_138_plan2_quality_fit`
- `cell_139_plan2_quality_discriminating`
- `cell_143_plan2_quality_progressive`
- `cell_147_plan2_quality_contextual`
- `cell_149_plan2_quality_repeat_contextual`

Primary closeout run for `cell_149`: `eval-2026-06-18-472e33c5`.

## Judge Split

`eval-2026-06-18-472e33c5` now has three preserved judge histories:

| Judge model | Rows | First-turn complete | Last-turn complete | Learner-overall complete | Dialogue-quality complete | Role |
|---|---:|---:|---:|---:|---:|---|
| `claude-code/sonnet` | 8 | 8/8 | 8/8 | 8/8 | 8/8 | Primary final table |
| `claude-code/opus` | 8 | 8/8 | 8/8 | 8/8 | 8/8 | Robustness cross-check |
| `codex-cli/auto` | 8 | 8/8 | 8/8 | 8/8 | 8/8 | Tentative screen only |

The Plan 2.0 quality composite uses `learner_overall_score`; the DB acceptance check above also verifies that the learner and dialogue score fields are complete for each judge bucket.

## Strict Shift

Final Sonnet-filtered strict-shift artifact:

- `exports/plan2-quality-repeat-contextual-final-strategy-shift.json`

Result for `cell_149_plan2_quality_repeat_contextual` on `claude-code/sonnet`:

| N | Strict shift | Shift window | Family match | Same-action refinements |
|---:|---:|---:|---:|---:|
| 8 | 100.0% (8/8) | 100.0% (8/8) | 100.0% (8/8) | 100.0% (3/3) |

## Final Sonnet Quality Table

Artifact:

- `exports/plan2-quality-repeat-contextual-final-sonnet-quality.md`
- `exports/plan2-quality-repeat-contextual-final-sonnet-quality.json`

Judge model: `claude-code/sonnet`
Baseline: `cell_135_plan2_closed_loop`

| Profile | N | Quality N | Strict shift | Quality | Delta vs baseline | Tutor last | Tutor holistic | Learner | Dialogue | Dev |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `cell_149_plan2_quality_repeat_contextual` | 8 | 8 | 100.0% (8/8) | 56.3 | +12.8 | 85.5 | 32.8 | 58.9 | 48.0 | +13.6 |
| `cell_138_plan2_quality_fit` | 8 | 8 | 87.5% (7/8) | 44.7 | +1.2 | 67.2 | 19.8 | 55.1 | 36.7 | +4.7 |
| `cell_135_plan2_closed_loop` | 8 | 8 | 100.0% (8/8) | 43.5 | 0.0 | 54.4 | 20.2 | 56.9 | 42.7 | -15.5 |
| `cell_147_plan2_quality_contextual` | 8 | 8 | 87.5% (7/8) | 42.9 | -0.6 | 60.6 | 22.2 | 58.1 | 30.8 | +3.6 |
| `cell_137_plan2_quality_ownership` | 8 | 8 | 87.5% (7/8) | 42.7 | -0.8 | 61.9 | 20.9 | 53.5 | 34.4 | -8.3 |
| `cell_139_plan2_quality_discriminating` | 8 | 8 | 100.0% (8/8) | 41.6 | -1.9 | 57.7 | 16.3 | 57.7 | 34.7 | -6.9 |
| `cell_143_plan2_quality_progressive` | 8 | 8 | 87.5% (7/8) | 41.3 | -2.3 | 45.3 | 25.8 | 57.2 | 36.7 | -18.9 |

## Opus Cross-Check

Artifacts:

- `exports/plan2-quality-repeat-contextual-final-opus-quality.md`
- `exports/plan2-quality-repeat-contextual-final-opus-quality.json`

Judge model: `claude-code/opus`

| Profile | N | Quality N | Strict shift | Quality | Tutor last | Tutor holistic | Learner | Dialogue | Dev |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `cell_149_plan2_quality_repeat_contextual` | 8 | 8 | 100.0% (8/8) | 56.3 | 78.3 | 39.8 | 58.0 | 48.9 | +14.1 |

Opus agrees on positive average last-turn and development quality, but not uniformly by scenario. Negative-development scenarios:

| Scenario | Opus dev | Opus last | Opus dialogue |
|---|---:|---:|---:|
| `answer_seeking_to_productive_struggle_v1` | -12.5 | 62.5 | 43.7 |
| `false_confusion_v1` | -3.7 | 71.3 | 32.5 |

These caveats bound the claim: Opus supports the branch-level direction but does not license "uniformly better tutoring."

## Codex Tentative Screen

Artifacts:

- `exports/plan2-quality-repeat-contextual-final-codex-quality.md`
- `exports/plan2-quality-repeat-contextual-final-codex-quality.json`

Judge model: `codex-cli/auto`

| Profile | N | Quality N | Strict shift | Quality | Tutor last | Tutor holistic | Learner | Dialogue | Dev |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `cell_149_plan2_quality_repeat_contextual` | 8 | 8 | 100.0% (8/8) | 63.7 | 84.2 | 39.7 | 68.1 | 62.7 | +16.7 |

Codex is retained only as a tentative same-run screen. It is not part of the final branch claim.

## Claim Limits

- Simulated adaptive-trap evidence only.
- No human-learning claim.
- No general deployment claim.
- No retroactive historical rescoring claim.
- Judge histories are kept separate with exact `--judge-model` filters; Codex/Sonnet/Opus rows are not averaged together.
- Opus is a robustness check, not the tuning target.
- No further parameter search is warranted unless a later primary judge contradicts the Sonnet/Opus direction above.

## Implementation Notes

The final analysis code now supports exact judge filtering:

- `scripts/analyze-adaptation-quality.js --judge-model <label>`
- `scripts/analyze-strategy-shift.js --judge-model <label>`

`services/evaluationRunner.js` also hardens CLI-judge JSON parsing for array-wrapped scored objects and string-array JSON chunks observed during the Opus cross-check. This is parser recovery only; it does not alter scoring semantics.
