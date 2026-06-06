# A18.14 Correctness-Gated Bead Panel Result

Date: 2026-06-06

Status: contrastive blind panel pass.

## Question

A18.14 asked whether the two A18.13-corrected
`bead_predecessor_priority` pairs would survive a blind contrastive panel. The
decisive read was stricter than raw local adaptation: do critics attribute S1's
use of the registered `predecessor_alias_test` to policy transfer rather than
ordinary public inference or generic transcript improvement?

## Command

```bash
npm run poetics:recursive-tutor-contrast-panel -- \
  --chain-dir exports/recursive-tutor-learning/a18.12-second-family-repair-local \
  --family bead_predecessor_priority \
  --out-dir exports/recursive-tutor-learning/a18.12-second-family-repair-local/a18.14-correctness-gated-contrast-panel \
  --run-id a18-14-bead-correctness-gated-panel \
  --force
```

The panel wrapper used the A18.13 overlay at:

`exports/recursive-tutor-learning/a18.12-second-family-repair-local/a18.13-policy-correctness-report.json`

The wrapper's report file keeps the legacy filename
`a18.10-contrastive-panel-report.json` inside the A18.14 output directory.

## Results

Output directory:

`exports/recursive-tutor-learning/a18.12-second-family-repair-local/a18.14-correctness-gated-contrast-panel`

Critics:

- `qwen/qwen3.7-max`
- `google/gemini-3.5-flash`
- `deepseek/deepseek-v4-pro`
- `anthropic/claude-sonnet-4.6`
- `codex`

Panel status: `contrast_panel_pass`

| Pair | Sibling | S1 side | Transfer votes | Ordinary public inference votes | Equivalent votes | S0 preferred |
| --- | --- | --- | --- | --- | --- | --- |
| `P01` | `bead_holdout_blue_upper` | `A` | `5/5` | `0/5` | `0/5` | `0/5` |
| `P02` | `bead_holdout_gold_middle` | `B` | `5/5` | `0/5` | `0/5` | `0/5` |

Ordinary-inference risk:

- `P01`: all five critics marked low risk.
- `P02`: three critics marked low risk; Claude and Codex marked medium risk.

No critic errors were recorded.

## Interpretation

A18.14 gives the second-family contrastive support that A18.11 and A18.12 did
not provide under the raw local gate. The decisive correction is A18.13: the
gold sibling no longer counts S0 as equivalent headroom just because S0 produced
a coherent repair. S0 chose the wrong target via an exact repeated-mark repair;
S1 chose the registered target via the registered bead-predecessor policy. The
panel then unanimously identified S1 as the policy-transfer-like side.

This strengthens the claim from "one selector-family artifact" to "two
artificial local-relation families with contrastive panel support," with a
material caveat: the second family requires the A18.13 policy-correctness gate.

## Claim Boundary

Supported:

- Simulated counterfactual replay can preserve a learned attempt-1 policy and
  apply it to held-out siblings.
- Blind contrastive critics can distinguish the policy-memory arm from the
  no-policy arm when the local gate also requires selected-policy correctness.
- The result is not reducible to adjacency or generic learner uptake in these
  two bead pairs: both pairs received `5/5` transfer votes, with no equivalence
  or S0-preferred votes.

Not supported:

- A deployed adaptive tutor.
- Human learner outcomes.
- Model-weight learning.
- A broad claim about all curricular domains or all local devices.

## Next Move

A18.15 should synthesize A18.10 and A18.14 into a cross-family claim boundary:
what can now be said about reliable peripeteia-induced adaptation, and what
still requires pre-registered replication under the correctness gate.
