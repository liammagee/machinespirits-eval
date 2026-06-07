# A18.22 Panel Vote-Rule Diagnosis

Date: 2026-06-06

Status: zero-API protocol diagnosis complete. A18.21 remains a strict v1
contrast-panel failure.

## Problem

A18.21 showed a split between two layers of the panel ontology:

- critics generally identified S1 as the side using the selected policy;
- all critics selected S1 as the winner on both pairs;
- the strict `strict_v1` transfer vote still failed both pairs at `2/5`;
- the binding field was `learner_resistance_addressed_side`, with some critics
  marking `neither` even when their justification described S1 as applying the
  selected repair.

This means the third-family result is not a clean negative about policy memory.
It is a negative under the stricter public-uptake ontology: critics did not
consistently say the learner's resistance was addressed by S1 in the required
field.

## Decision

Do not relax A18.21 after the fact. Its recorded status stays:

`contrast_panel_not_yet_reliable`

For future panels, freeze a new `policy_core_v2` rule:

- vote-blocking:
  - `selected_policy_side == hidden_s1_side`;
  - `winner == hidden_s1_side`;
  - `origin_class == policy_transfer_like`;
  - `differential_policy_use >= 4`;
  - `ordinary_public_inference_risk != high`;
- diagnostic but not vote-blocking:
  - `learner_resistance_addressed_side`.

The new frozen protocol is:

`config/recursive-tutor-learning/a18-panel-vote-rule-v2.yaml`

The contrast-panel script now supports:

```bash
npm run poetics:recursive-tutor-contrast-panel -- --vote-rule policy_core_v2 ...
```

The default remains `strict_v1`.

## Interpretation

This is not lowering the evidential standard in general. It separates two
claims:

1. **Policy-core transfer**: blind critics see the policy-memory side as using
   the selected repair, winning the contrast, and doing so for
   policy-transfer-like rather than ordinary-public-inference reasons.
2. **Learner-resistance uptake**: blind critics also mark the learner's
   resistance as addressed by that side.

The first claim is the counterfactual teacher-as-learner policy-transfer claim.
The second is a stronger public-dialogue uptake claim. A18.21 failed the second
under v1.

## Next Move

Use `policy_core_v2` only for future, pre-registered panels. The next cheap
step is to validate the v2 protocol and run a no-score packaging smoke. Do not
spend on another panel until a fresh family clears the same local gates.
