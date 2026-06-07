# A18.20/A18.21 Sidepair Local and Panel Result

Date: 2026-06-06

Status: local screen passed; strict contrastive panel failed. This is a bounded
near-miss, not a panel pass.

## Question

A18.20 asked whether the low-lexical `sidepair_bracket_priority` family from
A18.19 could produce two local candidates under the frozen A18.16 protocol.

A18.21 then asked whether those candidates would pass the five-critic blind
contrastive panel.

## Local Run

Chain:

`exports/recursive-tutor-learning/a18.19-fresh-family-local`

Attempt-1 training replay:

- result: `survivor: 1`

Policy fill:

- result: `filled: 1`

Policy preferred move:

`pose_counterexample: The learner's public split makes the flat comparison insufficient; the selected repair should suppress the obvious vote and force a complementary-fleck counterexample.`

## Held-Out Local Screens

| Sibling | Raw local verdict | Effective local verdict | Policy contrast | Distinctiveness | Policy correctness | S0 | S1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sidepair_holdout_green_left` | `no_local_headroom` | `policy_memory_local_advantage` | `policy_distinct` | `0.180` | `policy_memory_correctness_advantage` | `survivor` but wrong target | `survivor`, selected policy applied |
| `sidepair_holdout_blue_lower` | `policy_memory_local_advantage` | `policy_memory_local_advantage` | `policy_distinct` | `0.282` | `policy_memory_correctness_advantage` | `revise_again` | `survivor`, selected policy applied |

This clears A18.20. Unlike `hinge_shadow_priority`, the low-lexical family
produced two local candidates under protocol v1.

## Panel

Command:

```bash
npm run poetics:recursive-tutor-contrast-panel -- \
  --chain-dir exports/recursive-tutor-learning/a18.19-fresh-family-local/sidepair_bracket_priority \
  --family sidepair_bracket_priority \
  --out-dir exports/recursive-tutor-learning/a18.19-fresh-family-local/sidepair_bracket_priority/a18.21-contrast-panel \
  --run-id a18-21-sidepair-contrast-panel \
  --min-critics 5 \
  --panel-threshold majority \
  --force
```

Report:

`exports/recursive-tutor-learning/a18.19-fresh-family-local/sidepair_bracket_priority/a18.21-contrast-panel/a18.10-contrastive-panel-report.json`

Panel status: `contrast_panel_not_yet_reliable`

| Pair | Sibling | S1 side | Transfer votes | Required | Status |
| --- | --- | --- | --- | --- | --- |
| `P01` | `sidepair_holdout_blue_lower` | `B` | `2/5` | `3/5` | `contrast_panel_fail` |
| `P02` | `sidepair_holdout_green_left` | `B` | `2/5` | `3/5` | `contrast_panel_fail` |

No critic preferred S0. All critics selected S1 as the winner on both pairs.
S1 identification was also strong:

- `P01`: 4/5 selected S1 as the policy side; DeepSeek marked `both`.
- `P02`: 5/5 selected S1 as the policy side.

The strict vote failed because the frozen vote rule also requires the critic to
mark learner resistance as addressed by S1 and to score differential policy use
at least 4.

## Sensitivity Read

Zero-API sensitivity on the saved critic rows:

| Variant | `sidepair_holdout_blue_lower` | `sidepair_holdout_green_left` |
| --- | --- | --- |
| Frozen rule | `2/5` | `2/5` |
| Drop only `learner_resistance_addressed_side` requirement | `3/5` | `3/5` |
| Also allow differential policy use >= 3 | `4/5` | `4/5` |
| Selected-policy side + S1 winner only | `4/5` | `4/5` |

This is post-hoc and does not convert A18.21 into a pass. It diagnoses where
the strict gate is binding.

## Interpretation

This is a near-miss under the strict A18.16 panel rule:

- local correctness and policy distinctiveness both worked;
- blind critics generally saw S1 as the policy side and winner;
- the panel did not agree that the public transcript showed learner-resistance
  uptake strongly enough under the current field semantics.

The result does not overturn A18.15's bounded positive, and it does not support
a reliable-adaptation claim. It shows that the next bottleneck is no longer
lexical self-solving but the panel vote ontology: the current panel prompt asks
critics to separately identify policy use, winner, and learner-resistance
addressing, and the last field is doing most of the blocking.

## Decision

Do not count A18.21 as a pass. Do not re-label it under a relaxed rule.

Next move: A18.22 should pre-register a panel-rule diagnosis. Either keep the
strict A18.16 panel rule and design transcripts with more explicit learner
resistance uptake, or define a new protocol version in which
`learner_resistance_addressed_side` is diagnostic rather than vote-blocking.
Any new rule must be frozen before another panel or family is scored.
