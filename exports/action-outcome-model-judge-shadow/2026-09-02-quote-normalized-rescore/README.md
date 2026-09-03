# Re-score of tutor-stub-action-outcome-model-judge-shadow-v1 under the current validator

No model calls. The archived responses are unchanged; only the validator moved.

| Measure | Archived | Re-scored |
|---|---:|---:|
| Eligible, Sol | 35 | 35 |
| Eligible, Opus | 33 | 35 |
| Paired protocol-valid cases | 33 | 35 |
| Delivery exact | 30/33 | 31/35 |
| Delivery kappa | 0.791 | 0.735 |
| Outcome exact | 17/33 | 18/35 |
| Outcome kappa | 0.361 | 0.357 |
| Joint exact | 17/33 | 18/35 |
| Joint kappa | 0.361 | 0.357 |
| Paired measurement indeterminate | 27 | 26 |
| Exact-consensus binary records | 5 | 5 |
| Status | exploratory_model_pair_failed | exploratory_model_pair_failed |

## Validity changes

- case-0002/judge_opus: archived issues ["delivery_quote_not_exact","outcome_quote_not_exact"] -> re-scored issues [], notes ["delivery_quote_matched_after_quote_mark_normalization","outcome_quote_matched_after_quote_mark_normalization"]
- case-0011/judge_opus: archived issues ["delivery_quote_not_exact"] -> re-scored issues [], notes ["delivery_quote_matched_after_quote_mark_normalization"]

## Rows whose consensus changed

- case-0002: measurement_indeterminate (joint_exact false) -> inconclusive (joint_exact true)
- case-0011: measurement_indeterminate (joint_exact false) -> measurement_indeterminate (joint_exact false)

## Re-scored report

# Action-outcome Opus-Sol shadow judgment

**Verdict: exploratory_model_pair_failed. The registered human gates remain pending and the controller study is not licensed.**

Both model seats produced protocol-valid judgments for 35/35 cases. Joint delivery-plus-outcome exact agreement was 51.4% (Cohen kappa 0.357).

The pair produced 5 exact-consensus binary records. Paired measurement indeterminacy was 26/35 (74.3%).

## Agreement

| Measure | Exact | Cohen kappa |
|---|---:|---:|
| Delivery | 88.6% | 0.735 |
| Outcome | 51.4% | 0.357 |
| Joint delivery + outcome | 51.4% | 0.357 |

## Diagnostic checks

| Check | Observed | Threshold | Pass |
|---|---:|---:|:---:|
| protocol_valid_rate_per_seat | {"judge_sol":1,"judge_opus":1} | 0.9 | PASS |
| joint_exact_agreement | 0.5142857142857142 | 0.8 | FAIL |
| paired_measurement_indeterminate_rate | 0.7428571428571429 | 0.2 | FAIL |
| exact_consensus_binary_records | 5 | 24 | FAIL |
| exact_consensus_binary_records_per_move_family | {"explain_model":2,"minimal_support":2,"request_self_explanation":1} | 6 | FAIL |

## Claim boundary

This shadow study can establish only cross-model reproducibility, protocol-validity, indeterminacy, and candidate binary-yield for semantic judgment of the frozen 35 simulated-learner cases. It cannot validate the construct without an external human anchor, satisfy the source study's registered human gates, establish learning or transfer, compare action-family effectiveness, or license the memory-controller study.

This is a shadow model-measurement result. It neither populates the two human submission files nor changes the source study's registered review verdict.
