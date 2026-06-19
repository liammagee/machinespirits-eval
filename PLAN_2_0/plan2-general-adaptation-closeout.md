# Plan 2.0 General-Adaptation Closeout

Date: 2026-06-18
Branch head entering closeout: `085fc073`
Conclusion: **Plan 2.0 did not generalize under these tests.**

## Scope

This is a simulated adaptive-runner evidence slice only. It does not claim
human learning, deployment readiness, or retroactive rescoring of historical
runs. Generation for these adaptive runs reported `llmMode=mock`; Sonnet
(`claude-code/sonnet`) was the primary judge for quality. Opus and Codex were
not run for this follow-up because the frozen paired-suite gate failed before a
robustness pass was justified.

## Runs and Cells

| Stage | Cell | Run ID | Role | Judge rows |
|---|---|---|---|---|
| 1 | `cell_136_plan2_closed_loop_crosssuite` | `eval-2026-06-18-9cf05f23` | cross-suite baseline | Sonnet 6/6 |
| 1 | `cell_150_plan2_quality_repeat_contextual_crosssuite` | `eval-2026-06-18-e2f0ae3b` | frozen cross-suite treatment | Sonnet 6/6 |
| 2 | `cell_151_plan2_pair_specificity_closed_loop` | `eval-2026-06-18-f2b6a183` | paired-suite baseline | Sonnet 8/8 |
| 2 | `cell_152_plan2_pair_specificity_repeat_contextual` | `eval-2026-06-18-6d758a00` | frozen paired-suite treatment | Sonnet 8/8 |

## Strict Shift

| Stage | Profile | Strict shift | Family match | Notes |
|---|---|---:|---:|---|
| 1 | `cell_136_plan2_closed_loop_crosssuite` | 6/6 (100%) | 6/6 (100%) | Baseline cross-suite transfer |
| 1 | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 6/6 (100%) | 6/6 (100%) | Passed frozen-policy transfer gate |
| 2 | `cell_151_plan2_pair_specificity_closed_loop` | 5/8 (62.5%) | 5/8 (62.5%) | Failed paired-suite generalization |
| 2 | `cell_152_plan2_pair_specificity_repeat_contextual` | 5/8 (62.5%) | 5/8 (62.5%) | Same failures as baseline |

## Sonnet Quality

| Stage | Profile | Quality | Delta vs baseline | Last turn | Holistic | Learner | Dialogue |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | `cell_136_plan2_closed_loop_crosssuite` | 19.3 | 0.0 | 38.8 | 6.0 | 23.1 | 9.2 |
| 1 | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 21.5 | +2.3 | 39.4 | 12.7 | 19.0 | 15.0 |
| 2 | `cell_151_plan2_pair_specificity_closed_loop` | 23.4 | 0.0 | 44.1 | 8.1 | 26.9 | 14.5 |
| 2 | `cell_152_plan2_pair_specificity_repeat_contextual` | 27.9 | +4.5 | 53.0 | 15.2 | 27.1 | 16.4 |

Quality improved modestly for the repeat-contextual treatment, but Stage 2 did
not pass the strict-shift gate, so this is not evidence of general adaptation.

## Pair Specificity

| Profile | Scenario exact | Pair specificity | Different-state action divergence | Same-state compatibility | False-positive divergence |
|---|---:|---:|---:|---:|---:|
| `cell_151_plan2_pair_specificity_closed_loop` | 5/8 (62.5%) | 1/3 (33.3%) | 2/3 (66.7%) | 1/1 (100%) | 0/1 (0%) |
| `cell_152_plan2_pair_specificity_repeat_contextual` | 5/8 (62.5%) | 1/3 (33.3%) | 2/3 (66.7%) | 1/1 (100%) | 0/1 (0%) |

Failure families:

- `ambiguous_why_works`: both missing-prerequisite and substantive-objection
  variants collapsed to `diagnose_with_discriminating_question`.
- `explain_more_overload_or_shutdown`: working-memory overload correctly
  selected `lower_cognitive_load`, but affective shutdown collapsed to
  `diagnose_with_discriminating_question`.
- `stuck_on_quiz`: answer seeking vs task misread passed.
- `misrecognition_same_state_control`: same-state compatibility passed; the
  suite did not show excess divergence on wording-only variants.

## Outcome Closure

| Profile | Contract complete | Intervention closure | Transition observable | Success | Failure | Inconclusive | Failure update | No repeat after non-success | Gate repairs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `cell_151_plan2_pair_specificity_closed_loop` | 24/24 (100%) | 16/16 (100%) | 16/16 (100%) | 2 | 0 | 14 | 14/14 (100%) | 5/14 (35.7%) | 2 |
| `cell_152_plan2_pair_specificity_repeat_contextual` | 24/24 (100%) | 16/16 (100%) | 16/16 (100%) | 2 | 0 | 14 | 14/14 (100%) | 5/14 (35.7%) | 2 |

The runtime machinery is present: contracts exist, pending interventions close,
and observed-transition records are written. The problem is behavioral: closure
mostly produces inconclusive outcomes, and the policy repeats after non-success
in 9/14 non-success closures. In the affective-shutdown failure, the selector
first chose `acknowledge_and_redirect`, but the gate repaired it back to
`diagnose_with_discriminating_question` under `HIGH_CONFIDENCE_WITH_HIGH_UNCERTAINTY`.

## Ablations

| Ablation | Status | Reason |
|---|---|---|
| State scramble | Not run | Stage 2 frozen paired-suite test failed |
| Outcome closure off | Not run | Stage 2 frozen paired-suite test failed |
| Context realization off | Not run | Stage 2 frozen paired-suite test failed |

Stage 5 ablations are reserved for a frozen-policy positive. Running them after
this failure would turn the branch into a tuning loop rather than a closeout.

## Artifacts

Ignored exports were not forced into Git. Regenerate or inspect:

- `exports/plan2-general-adaptation-stage1-strategy-shift.json`
- `exports/plan2-general-adaptation-stage1-sonnet-quality.json`
- `exports/plan2-general-adaptation-stage1-sonnet-quality.md`
- `exports/plan2-general-adaptation-stage2-strategy-shift.json`
- `exports/plan2-general-adaptation-stage2-pair-specificity.json`
- `exports/plan2-general-adaptation-stage2-pair-specificity.md`
- `exports/plan2-general-adaptation-stage2-sonnet-quality.json`
- `exports/plan2-general-adaptation-stage2-sonnet-quality.md`
- `exports/plan2-general-adaptation-stage3-outcome-closure.json`
- `exports/plan2-general-adaptation-stage3-outcome-closure.md`

## Bounded Claim

`cell_150_plan2_quality_repeat_contextual_crosssuite` gave weak positive
cross-suite transfer on the existing trap-style suite: strict shift stayed 6/6
and Sonnet quality rose by +2.3 over `cell_136`. But the paired hidden-state
suite did not generalize: both frozen baseline and repeat-contextual treatment
fell to 5/8 strict shift and only 1/3 divergent pairs showed full pair
specificity. The main failure is not missing trace infrastructure; it is
insufficient state-action specificity after ambiguous learner evidence,
especially when the gate repairs actionable affective responses back into
generic diagnosis.
