# Ownership Benchmark Report

Generated: 2026-06-17T03:26:49.361Z

## Boundary

- Zero-paid synthetic controls only.
- Positive and negative controls keep proof status, final D, and release signature fixed.
- Disqualification controls deliberately move proof/release state and must be rejected.
- This validates the evaluator before it is used to mine new artifacts; it does not promote any runtime policy.

## Summary

- Cases: 12
- Passed: 12
- Failed: 0
- All passed: yes

| Case | Control | Expected | Actual | Reliability matched | Ownership delta | Result |
|---|---|---|---|---|---:|---|
| positive-own-words-use | positive | eligible_for_replay_gate | eligible_for_replay_gate | yes | 3.00 | pass |
| positive-purpose-link | positive | eligible_for_replay_gate | eligible_for_replay_gate | yes | 2.00 | pass |
| positive-contrast-case | positive | eligible_for_replay_gate | eligible_for_replay_gate | yes | 3.00 | pass |
| positive-recovery-transfer | positive | eligible_for_replay_gate | eligible_for_replay_gate | yes | 3.00 | pass |
| negative-warmer-echo | negative | matched_reliability_no_ownership_gain | matched_reliability_no_ownership_gain | yes | 0.00 | pass |
| negative-phatic-only | negative | matched_reliability_no_ownership_gain | matched_reliability_no_ownership_gain | yes | 0.00 | pass |
| negative-fluent-paraphrase-no-use | negative | matched_reliability_no_ownership_gain | matched_reliability_no_ownership_gain | yes | 0.00 | pass |
| negative-dramatic-texture | negative | matched_reliability_no_ownership_gain | matched_reliability_no_ownership_gain | yes | 0.00 | pass |
| disqualify-release-shift | disqualification | not_matched_reliability | not_matched_reliability | no | 2.00 | pass |
| disqualify-final-d-regression | disqualification | not_matched_reliability | not_matched_reliability | no | 2.00 | pass |
| disqualify-verdict-regression | disqualification | not_matched_reliability | not_matched_reliability | no | 3.00 | pass |
| disqualify-added-release | disqualification | not_matched_reliability | not_matched_reliability | no | 2.00 | pass |

## Interpretation

The ownership evaluator passes the declared proof-matched benchmark controls. It can distinguish direct ownership gains from prose-only changes and reject confounded proof/release changes.
