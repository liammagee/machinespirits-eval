# A19 Attempt-1 Gate Report

Status: deterministic attempt-1 gate summary; zero API calls in this reporter.

## Boundary

- A18 replay artifacts are treated as attempt-1 gate evidence only.
- Mock-backed survivors are fixture survivors, not empirical survivors.
- S0/S1 escalation remains blocked for empirical claims until a real attempt-1 survivor exists.

## Summary

- Status: `fail`
- Empirical status: `fixture_only_no_empirical_claim`
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
| addressed_claim_withdrawal | repeat_original_explanation | redirect_after_resistance | blocked | stop_before_s0s1 | 0.7 | 0.8 | 0.85 | 0.65 | 1 |

## Blockers

- addressed_claim_withdrawal: below_threshold
- addressed_claim_withdrawal: a18_replay_gate_not_survivor

## Claims Not Licensed

- human_learning
- deployed_adaptive_tutor
- model_weight_learning
- main_harness_rate_effect
- paid_blind_panel_result
- an empirical A19 attempt-1 survival rate while all survivors are mock-backed

