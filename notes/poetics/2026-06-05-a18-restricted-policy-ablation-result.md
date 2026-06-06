# A18.7 Restricted Policy-Memory Ablation Result

Date: 2026-06-05

## Claim Boundary

This is a simulated counterfactual replay ablation. It is not evidence of human
learning, model-weight learning, or a deployed adaptive tutor. It tests a
narrower mechanism question: if held-out inner metadata is withheld from both
arms, does explicit attempt-1 policy memory become necessary for the held-out
rewrite to pass the local recursive tutor-learning gate?

## Design

Family: `window_scope_claim`

Held-out sibling: `window_holdout_mira_label`

- S0: fresh held-out Codex rewrite without policy memory.
- S1: fresh held-out Codex rewrite with the filled attempt-1 policy memory.
- Both arms: `inner_max_chars = 0`, so held-out inner state and key metadata are
  withheld from the rewrite prompt.
- S1 only: `policy_memory_max_chars = 18000`, preserving the learned policy
  channel after the inner-state channel is shut off.
- Panel policy: `headroom`, so the blind panel runs only if S1 survives locally
  while S0 does not.

Artifact:
`exports/recursive-tutor-learning/a18-pilot-local/a18.7-restricted-policy-ablation-window/a18.7-restricted-policy-ablation-report.json`

Prompt audit:

- S0 and S1 prompts both show `[none]` for held-out inner state / full transcript
  context.
- S1 prompt contains the filled policy fields, including `diagnostic_trigger`
  and `preferred_move`.
- S0 prompt contains no policy memory.

## Result

| Arm | Local status | Notable local scores |
| --- | --- | --- |
| S0 no policy memory | `survivor` | `public_causal_bridge=0.85`, `tutor_learning_signal=0.85`, `recursive_dyadic_update=0.75` |
| S1 policy memory | `survivor` | `public_causal_bridge=0.85`, `tutor_learning_signal=0.85`, `recursive_dyadic_update=0.75` |

Verdicts:

- Local verdict: `no_local_headroom`
- Panel verdict: `not_panelled`
- Panel skip reason: `no_local_headroom:no_local_headroom`

The headroom rule worked: no blind panel was run because the no-policy control
survived the local gate.

## Interpretation

A18.7 is another negative for the causal policy-memory claim. With hidden inner
state removed, S0 could still infer the effective public repair from the visible
stage: duplicate `mira` labels, a brace over slots one through three, and a
learner saying comparison still leaves them using the active-looking part. That
public apparatus is already enough for a strong rewriter to invent the
scope/window test.

S1 uses the policy memory more cleanly, but not uniquely. The local gate scores
the resulting transcript's recursive tutor-learning form, not whether that form
required the policy-memory channel. Therefore the current family remains
constructible without explicit policy transfer.

This strengthens the standing boundary:

> A18 currently demonstrates constructibility of locally strong recursive
> tutor-learning transcripts. It does not yet demonstrate that explicit
> attempt-1 policy memory is causally responsible for held-out transfer.

## Design Consequence

The next design should stop spending panels on `window_scope_claim` unless a
new local contrast first makes S0 fail. The problem is not only hidden metadata;
it is that wholesale rewrite authority plus an already-informative public stage
lets the control discover the repair.

A stronger next variant should reduce at least one of these freedoms:

- make S0 perform a bounded tutor-only continuation rather than rewrite the full
  public transcript;
- use held-out families where the public setup admits multiple plausible
  repairs and the attempt-1 policy selects among them;
- add a policy-use contrast gate that fails when S0 independently instantiates
  the same policy fields as S1;
- require multiple held-out siblings and treat a single S0 survivor as a
  no-headroom stop condition.
