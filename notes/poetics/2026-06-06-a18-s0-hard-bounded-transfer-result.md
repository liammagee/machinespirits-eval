# A18.8 S0-Hard Bounded-Transfer Result

Date: 2026-06-06

## Claim Boundary

This is a simulated counterfactual replay screen. It is not evidence of human
learning, model-weight learning, or a deployed adaptive tutor. It tests whether
the current positive A18 family can show policy-memory transfer after removing
two sources of S0 generosity:

- wholesale transcript rewrite authority; and
- hidden held-out inner metadata.

## Design

Family: `window_scope_claim`

Held-out sibling: `window_holdout_mira_label`

Artifact:
`exports/recursive-tutor-learning/a18-pilot-local/a18.8-s0-hard-bounded-transfer-window/a18.8-s0-hard-bounded-transfer-report.json`

Local-only command shape:

- S0: fresh bounded continuation, no policy memory.
- S1: fresh bounded continuation, attempt-1 policy memory.
- Both arms: `inner_max_chars=0`.
- Both arms: `rewrite_mode=bounded_continuation`, preserving the original public
  transcript prefix and appending at most six public lines.
- Policy contrast gate enabled.
- Blind panel skipped for this first hardened local screen.

## Result

| Arm | Local status | Local scores | Policy signature |
| --- | --- | --- | --- |
| S0 no policy memory | `survivor` | `public_causal_bridge=0.88`, `tutor_learning_signal=0.85`, `recursive_dyadic_update=0.80` | `strategy_hit=true`; strategy names include `scope_test` |
| S1 policy memory | `survivor` | `public_causal_bridge=0.85`, `tutor_learning_signal=0.85`, `recursive_dyadic_update=0.75` | `strategy_hit=true`; strategy names include `scope_test` |

Verdicts:

- Local verdict: `no_local_headroom`
- Policy-contrast verdict: `s0_recreates_policy_strategy`
- Panel verdict: `not_panelled`

S0 not only survived; it scored slightly higher locally than S1 on several
fields. The policy contrast gate then made the qualitative failure explicit:
S0 independently instantiated the learned policy's named strategy, `scope_test`.

## Interpretation

A18.8 is a stricter negative for `window_scope_claim`. Removing held-out inner
state and replacing full rewrites with bounded continuation still does not make
policy memory load-bearing. The visible public setup already contains the repair
path: duplicate `mira`, a brace over slots one through three, and a learner who
asks for a clearer public test after comparison fails. A capable rewriter can
infer the brace/scope move from that public apparatus alone.

This is useful because it localizes the failure. The problem is no longer just:

- hidden metadata leakage; or
- full transcript rewrite authority.

The deeper problem is that the public stage overdetermines the correct repair.
The policy memory is real but redundant.

## Design Consequence

Stop spending on `window_scope_claim` as a policy-memory transfer candidate. It
can remain as a constructibility/control specimen, but not as evidence that a
bounded tutor policy learned from attempt 1 causes held-out transfer.

The next viable design must make the policy select among multiple plausible
public repairs rather than name the only visible repair. Required changes:

- build new held-out siblings where the public setup admits at least two
  plausible next tutor strategies;
- make the attempt-1 policy choose the right strategy under a transfer condition
  that is not obvious from the held-out public stage alone;
- treat any S0 survivor or S0 policy-strategy hit as an immediate local stop;
- keep bounded continuation and policy-contrast gating as defaults;
- panel only after S1 survives, S0 fails, and S0 does not instantiate the policy
  signature.
