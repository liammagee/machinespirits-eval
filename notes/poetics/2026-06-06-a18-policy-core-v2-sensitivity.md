# A18.24 Policy-Core V2 Sensitivity on A18.21

Date: 2026-06-06

Status: zero-API diagnostic recomposition. This does not relabel A18.21.

## Source

Saved score directory:

`exports/recursive-tutor-learning/a18.19-fresh-family-local/sidepair_bracket_priority/a18.21-contrast-panel`

The recomposition used the saved critic JSON rows and
`summarizeContrastScores(..., { voteRule: "policy_core_v2" })`.

## Result

| Vote rule | Overall status | `sidepair_holdout_blue_lower` | `sidepair_holdout_green_left` |
| --- | --- | --- | --- |
| `strict_v1` | `contrast_panel_not_yet_reliable` | fail, `2/5` | fail, `2/5` |
| `policy_core_v2` | `contrast_panel_pass` | pass, `3/5` | pass, `3/5` |

Both v2 passes are exact-majority passes, not robust supermajorities.

## Per-Critic Pattern

`sidepair_holdout_blue_lower`:

| Critic | V2 vote | Strict-v1 vote | Blocking/caveat |
| --- | --- | --- | --- |
| Codex | pass | pass | none |
| Qwen | pass | pass | none |
| Gemini | pass | fail | learner-resistance diagnostic warning |
| Claude | fail | fail | differential policy use `3` |
| DeepSeek | fail | fail | selected policy side `both` / equivalence |

`sidepair_holdout_green_left`:

| Critic | V2 vote | Strict-v1 vote | Blocking/caveat |
| --- | --- | --- | --- |
| Codex | pass | pass | none |
| Qwen | pass | pass | none |
| Gemini | pass | fail | learner-resistance diagnostic warning |
| Claude | fail | fail | differential policy use `3` |
| DeepSeek | fail | fail | high ordinary-public-inference risk |

## Interpretation

A18.21 is a useful near-miss. Under the future policy-core rule, blind critics
would narrowly identify the S1 policy-memory side as the transfer-like winner on
both pairs. But the recomposition also exposes why the v2 claim must remain
narrow:

- each pair has one learner-resistance diagnostic warning;
- both passes are exactly `3/5`;
- Claude still sees policy use as not different enough (`3`);
- DeepSeek remains a substantive blocker on one pair by equivalence and on the
  other by high ordinary-public-inference risk.

So A18.21 supports the motivation for v2, but it cannot be counted as a v2
replication because the rule was frozen after the scores were known.

## Next Move

Run a fresh post-v2 family through the same local gates before any paid panel.
The decisive future test is whether a family generated after the v2 freeze can
clear local correctness and then pass the policy-core contrast panel without
relying on post-hoc recomposition.
