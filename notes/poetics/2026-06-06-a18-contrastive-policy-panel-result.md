# A18.10 Contrastive Policy-Transfer Panel Result

Date: 2026-06-06

## Claim Boundary

This is a contrastive blind panel over simulated counterfactual replays. It is
not evidence of human learning, model-weight learning, or a deployed adaptive
tutor. It tests whether critics can distinguish the policy-memory arm from the
no-policy arm when both are shown as anonymous A/B continuations.

The panel is blind to arm provenance. Critics see the candidate selector policy
and two anonymous public transcripts. They do not see which side had attempt-1
policy memory.

## Design

Family: `selector_rail_priority`

Source chain:
`exports/recursive-tutor-learning/a18.9-under-determined-local`

Panel artifacts:
`exports/recursive-tutor-learning/a18.9-under-determined-local/a18.10-contrastive-panel`

Report:
`exports/recursive-tutor-learning/a18.9-under-determined-local/a18.10-contrastive-panel/a18.10-contrastive-panel-report.json`

Critics:

- `qwen/qwen3.7-max`
- `google/gemini-3.5-flash`
- `deepseek/deepseek-v4-pro`
- `anthropic/claude-sonnet-4.6`
- `codex`

Vote rule:

- the critic must identify the hidden S1 side as the selector-policy side;
- the critic must select the hidden S1 side as the better continuation;
- `origin_class` must be `policy_transfer_like`;
- `differential_policy_use` must be at least `4`;
- high ordinary-public-inference risk blocks the vote.

If a critic says both arms address resistance, that is not automatically a
failure. S0 may address resistance by another plausible repair. The decisive
contrast is whether S1 uses the selected selector policy in a way S0 does not.

## Result

| Pair | Sibling | Hidden S1 side | Transfer votes | Ordinary-inference cautions | Status |
| --- | --- | --- | --- | --- | --- |
| `P01` | `selector_holdout_blue_lower` | `A` | `3/5` | `2/5` | `contrast_panel_pass` |
| `P02` | `selector_holdout_gold_middle` | `B` | `5/5` | `0/5` | `contrast_panel_pass` |

Overall status: `contrast_panel_pass`

No critic preferred S0 on either pair. No critic treated the arms as equivalent.
All critics identified the hidden S1 side as the selector-policy side and as the
winner on both pairs. The difference is that two critics on `P01` still judged
the S1 move at high risk of ordinary public-stage inference.

## Interpretation

A18.10 is a bounded positive for the `selector_rail_priority` family. It clears
the failure mode that blocked A18.6-A18.8: critics no longer say S0 and S1 are
equivalent, and S0 does not independently receive credit for the same selected
policy.

The residual risk is concentrated in `P01`. The policy-memory arm wins the
contrast, but two critics still regard the selector-tab move as possibly inferable
from the visible public card rather than as a strongly policy-transfer-like move.
That means the result supports a local mechanism claim for this artificial family,
not a reliable adaptation claim across families.

## Next Move

Do not tune this same selector family further. The next serious test is A18.11:
build a second under-determined transfer family with a different artificial local
relation and run the same sequence:

1. A18.9-style local S0-hard bounded-transfer screen.
2. A18.10-style contrastive blind panel only if local headroom survives.
3. Family-level comparison. A reliable claim needs more than one family.
