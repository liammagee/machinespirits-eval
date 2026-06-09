# A19 Attempt-1 Gate Report

Status: deterministic attempt-1 gate summary; zero API calls in this reporter.

## Boundary

- A18 replay artifacts are treated as attempt-1 gate evidence only.
- Mock-backed survivors are fixture survivors, not empirical survivors.
- S0/S1 escalation remains blocked for empirical claims until a real attempt-1 survivor exists.

## Summary

- Status: `fail`
- Empirical status: `real_attempt1_blocked`
- Families: 1
- Fixture survivors: 0
- Real survivors: 0
- Blocked: 1
- Missing attempt-1 replay: 0

## Gate Thresholds

| field | threshold |
| --- | ---: |
| old_warrant_misclassification | 0.7 |
| resistance_diagnosis | 0.7 |
| strategy_revision_accountability | 0.7 |
| recursive_dyadic_update | 0.7 |
| non_leakage | 0.9 |

## Families

| family | old-rule decoy | expected failure | status | next gate | old warrant | diagnosis | accountability | recursive update | non-leakage |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| strategy_reversal_error_spotting | continue_solving_with_surface_cues | wrong_strategy_family | blocked | stop_before_s0s1 | 0.85 | 0.75 | 0.8 | 0.62 | 1 |

## Blockers

- strategy_reversal_error_spotting: below_threshold
- strategy_reversal_error_spotting: a18_replay_gate_not_survivor

## Claims Not Licensed

- human_learning
- deployed_adaptive_tutor
- model_weight_learning
- main_harness_rate_effect
- paid_blind_panel_result
- S0/S1 escalation from this family because the real attempt-1 gate blocked
