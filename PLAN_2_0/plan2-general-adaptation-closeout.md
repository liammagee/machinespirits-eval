# Plan 2.0 General-Adaptation Closeout

Date: 2026-06-18
Branch head entering repair pass: `f00ef2c6`
Conclusion: **provisional simulated evidence of general adaptation**, with strict limits.

## Scope and Limits

This is a simulated adaptive-runner evidence slice. Generation for these runs
reported `llmMode=mock`; Sonnet (`claude-code/sonnet`) was the judge used for
the final tables. This does not claim human learning, deployment readiness,
Opus robustness, or retroactive rescoring of historical runs.

The branch no longer supports the earlier failure closeout as the final state.
The failed paired-suite pass diagnosed concrete mechanism bugs, which were
fixed and re-evaluated against both the failed held-out suite and the previously
passed cross-suite.

## Mechanism Repairs

- Let actionable high-confidence states proceed through the gate when the
  selected action is compatible with the dominant hypothesis.
- Treat affective, overload, substantive-objection, and task-misread language as
  learner-state evidence instead of empty release.
- After an inconclusive diagnostic under the same live condition, switch to the
  dominant hypothesis's top non-diagnostic compatible action when one exists.
- Add answer-seeking cues for activity-avoidance phrasing such as "walk me
  through the answer."

## Final Runs and Cells

| Suite | Cell | Run ID | Role | Judge rows |
|---|---|---|---|---|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | `eval-2026-06-19-6c59b6e9` | baseline | Sonnet 6/6 |
| Cross-suite | `cell_150_plan2_quality_repeat_contextual_crosssuite` | `eval-2026-06-19-044225fd` | treatment | Sonnet 6/6 |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | `eval-2026-06-19-08df153e` | baseline | Sonnet 8/8 |
| Paired | `cell_152_plan2_pair_specificity_repeat_contextual` | `eval-2026-06-19-c2bf8146` | treatment | Sonnet 8/8 |

## Strict Shift

| Suite | Profile | Strict shift | Family match | Notes |
|---|---|---:|---:|---|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | 6/6 (100%) | 6/6 (100%) | Previously passed suite, restored after answer-seeking cue fix |
| Cross-suite | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 6/6 (100%) | 6/6 (100%) | Preserves frozen-policy transfer |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | 8/8 (100%) | 8/8 (100%) | Held-out paired baseline |
| Paired | `cell_152_plan2_pair_specificity_repeat_contextual` | 8/8 (100%) | 8/8 (100%) | Held-out paired treatment |

## Sonnet Quality

| Suite | Profile | Quality | Delta vs baseline | Last turn | Holistic | Learner | Dialogue |
|---|---|---:|---:|---:|---:|---:|---:|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | 18.1 | 0.0 | 33.1 | 11.0 | 17.4 | 10.8 |
| Cross-suite | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 22.9 | +4.8 | 35.2 | 17.3 | 23.4 | 15.6 |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | 31.0 | 0.0 | 60.0 | 16.2 | 27.1 | 20.6 |
| Paired | `cell_152_plan2_pair_specificity_repeat_contextual` | 34.0 | +3.0 | 67.8 | 18.6 | 26.7 | 23.0 |

## Pair Specificity

| Profile | Scenario exact | Family match | Pair specificity | Different-state action divergence | Same-state compatibility | False-positive divergence |
|---|---:|---:|---:|---:|---:|---:|
| `cell_151_plan2_pair_specificity_closed_loop` | 8/8 (100%) | 100.0% | 3/3 | 100.0% | 100.0% | 0.0% |
| `cell_152_plan2_pair_specificity_repeat_contextual` | 8/8 (100%) | 100.0% | 3/3 | 100.0% | 100.0% | 0.0% |

## Outcome Closure

| Suite | Profile | Contract | Closed | Observable | Success | Failure | Inconclusive | Failure update | No repeat after non-success | Gate repairs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | 100.0% | 100.0% | 100.0% | 1 | 0 | 14 | 100.0% | 78.6% | 0 |
| Cross-suite | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 100.0% | 100.0% | 100.0% | 1 | 0 | 14 | 100.0% | 78.6% | 0 |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | 100.0% | 100.0% | 100.0% | 1 | 0 | 15 | 100.0% | 86.7% | 0 |
| Paired | `cell_152_plan2_pair_specificity_repeat_contextual` | 100.0% | 100.0% | 100.0% | 1 | 0 | 15 | 100.0% | 86.7% | 0 |

## Residual Failure Families

- Prerequisite and misrecognition scenarios still expose weak generic first
  diagnostics and generic minimal-hint realization. Strict adaptation is fixed,
  but some dialogue quality remains low.
- Outcome closure is structurally present, but most closures are still
  inconclusive. This is not yet strong evidence of reliable learner-state
  improvement.
- Repeat-contextual realization helps Sonnet quality modestly, but the gain is
  not large enough to support deployment claims.

## Ablations

| Ablation | Status | Reason |
|---|---|---|
| State scramble | Not run | This pass was a mechanism repair plus held-out/passed-suite re-evaluation |
| Outcome closure off | Not run | Reserved for the next ablation pass after this frozen-policy positive |
| Context realization off | Not run | Reserved for the next ablation pass after this frozen-policy positive |

## Artifacts

Ignored exports were not forced into Git. Final reports:

- `exports/plan2-general-adaptation-final2-crosssuite-strategy-shift.json`
- `exports/plan2-general-adaptation-final2-crosssuite-sonnet-quality.json`
- `exports/plan2-general-adaptation-final2-crosssuite-sonnet-quality.md`
- `exports/plan2-general-adaptation-final2-crosssuite-outcome-closure.json`
- `exports/plan2-general-adaptation-final2-crosssuite-outcome-closure.md`
- `exports/plan2-general-adaptation-final2-pair-specificity.json`
- `exports/plan2-general-adaptation-final2-pair-specificity.md`
- `exports/plan2-general-adaptation-final2-paired-strategy-shift.json`
- `exports/plan2-general-adaptation-final2-paired-sonnet-quality.json`
- `exports/plan2-general-adaptation-final2-paired-sonnet-quality.md`
- `exports/plan2-general-adaptation-final2-paired-outcome-closure.json`
- `exports/plan2-general-adaptation-final2-paired-outcome-closure.md`

## Bounded Claim

`cell_150_plan2_quality_repeat_contextual_crosssuite` and
`cell_152_plan2_pair_specificity_repeat_contextual` preserve exact adaptive
strategy shifting on the cross-suite and paired held-out suites, respectively,
and each improves Sonnet composite quality over its frozen baseline. This is
provisional simulated evidence that Plan 2.0's closed-loop policy generalizes
beyond the original trap suite after the repaired state-action pathway.

The claim is bounded to mock generated dialogues, Sonnet scoring, and these
trap-derived simulated suites. It does not establish human learning, broad
deployment readiness, or judge-robust effects.
