# A18.6 Policy-Memory Ablation Result

Date: 2026-06-05

## Claim Boundary

This is a simulated counterfactual replay ablation. It is not evidence of human
learning, model-weight learning, or a deployed adaptive tutor. The question is
narrower: did the explicit attempt-1 policy memory make the held-out transcript
survive local and blind-panel gates, or could the same rewrite path succeed
without that memory?

## Design

Family tested first: `window_scope_claim`, because it was the only A18.5 panel
pass.

- S0: fresh held-out Codex rewrite with no `--policy-memory`.
- S1: existing policy-memory held-out rewrite from A18.5.
- Same held-out sibling: `window_holdout_mira_label`.
- Same local gate and same blind panel rubric.
- Panel report: `exports/recursive-tutor-learning/a18-pilot-local/a18.6-policy-ablation-window/a18.6-policy-ablation-report.json`

`glyph_tail_owner` was held as a near-miss diagnostic: recognition survived in
A18.5, but origin attribution failed because the tutor's public stock-taking
contrast was too weak. `peg_lane_modifier` stayed held back because its
attempt-1 old-warrant failure remained too implicit.

## Result

| Arm | Local status | Recognition votes | Peripeteia-origin votes | Panel status |
| --- | --- | ---: | ---: | --- |
| S0 no policy memory | `survivor` | 5/5 | 3/5 | `panel_pass` |
| S1 policy memory | `survivor` | 4/5 | 4/5 | `panel_pass` |

Verdicts:

- Local verdict: `no_local_headroom`
- Panel verdict: `no_panel_headroom`

## Interpretation

This is a negative ablation for the current A18 policy-memory claim. The
policy-memory arm did not uniquely cause survival: the no-policy control also
passed both local and blind-panel gates.

The result does not invalidate the broader teacher-as-learner idea. It shows
that the current replay channel is still too permissive: S0 has enough held-out
context and rewrite authority to invent a successful public mechanism without
using the attempt-1 learned policy. Under this design, a panel survivor can show
that a transcript is constructible, but not that bounded tutor-policy memory is
doing causal work.

## Next Constraint

The next design must make the learned policy the only additional difference
between arms. Options:

- Reduce held-out inner context available to S0 so it cannot infer the repair
  strategy from target metadata alone.
- Run multiple held-out siblings per family and require S1>S0 rate, not a single
  artifact pass.
- Pre-register a policy-use evidence test: the S1 public move must instantiate a
  field from the filled policy object, while S0 must not receive that object.
- Keep local and panel gates, but add an arm-level contrast gate before any
  claim about recursive tutor learning.

Current status: A18 demonstrates constructibility of panel-passing adaptive
transcripts, but A18.6 blocks the stronger claim that explicit policy-memory
transfer caused the successful held-out rewrite.
