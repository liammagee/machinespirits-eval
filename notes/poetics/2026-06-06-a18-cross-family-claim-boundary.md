# A18.15 Cross-Family Claim Boundary

Date: 2026-06-06

Status: synthesis complete; no new generation or judging.

## Question

A18.15 asks what can now be claimed after the selector-family contrastive panel
(A18.10) and the correctness-gated bead-family panel (A18.14), and what still
has to be replicated before using the stronger phrase "reliable
peripeteia-induced adaptation."

## Evidence Summary

| Family | Gate | Held-out pairs | Contrastive result | Main caveat |
| --- | --- | --- | --- | --- |
| `selector_rail_priority` | A18.9 S0-hard bounded transfer | 2 | `3/5` transfer votes on `selector_holdout_blue_lower`; `5/5` on `selector_holdout_gold_middle` | First pair carried `2/5` high ordinary-public-inference cautions. |
| `bead_predecessor_priority` | A18.13 policy-correctness overlay | 2 | `5/5` transfer votes on both bead pairs | Second family depends on a post-hoc correctness gate added after A18.12 exposed wrong-target S0 survival. |

Across the four held-out contrastive pairs, no critic preferred S0 and no critic
treated S0/S1 as equivalent. The strongest single result is the bead family
after the policy-correctness gate: both pairs received unanimous transfer votes,
with ordinary-inference risk low on one pair and low-to-medium on the other.

## Supported Claim

A18 now supports a bounded counterfactual-replay claim:

> In two artificial local-relation families, a saved attempt-1 strategy lesson
> can be applied to held-out sibling cases in a way that blind contrastive
> critics distinguish from a no-policy continuation.

This is a teacher-as-learner result in the limited sense that the tutor pipeline
records a failed strategy, writes a finite policy memory, and can use that
memory to select a better public repair on held-out simulated cases.

The result also supports the contrastive-pair design choice. Asking critics to
infer origin from a single polished transcript left "organic drift" available.
Presenting S0 and S1 side by side, with hidden arm provenance and an explicit
selected-policy target, makes the relevant question sharper: which continuation
uses the learned policy, and is that use more than ordinary public inference?

## Not Supported

A18 does not yet support:

- human learning or learner outcome gains;
- a deployed adaptive tutor;
- model-weight learning;
- an online interaction effect in the main evaluation harness;
- broad transfer across ordinary curricular domains;
- a general claim that peripeteia alone causes adaptation in arbitrary
  simulated dialogues.

It also does not overturn the earlier slope-proxy nulls. A18 is an offline
counterfactual replay apparatus, not a per-turn score-rate instrument.

## Why "Reliable Peripeteia-Induced Adaptation" Is Still Too Strong

The phrase becomes defensible only if all three terms are kept narrow:

- "peripeteia-induced" means the tutor's attempt-1 failure produces an explicit
  strategy lesson, not that a dramatic twist in the public transcript suffices;
- "adaptation" means selected-policy transfer on a held-out sibling, not generic
  improved fluency or recognitive wording;
- "reliable" means the rule survives a pre-registered fresh-family replication,
  not that two retrospectively repaired families passed.

The last condition is not yet met. The bead result is important, but the
policy-correctness gate was introduced after A18.12 found the exact failure mode
it fixes. That makes A18.13 methodologically justified but not pre-registered
for the bead family. A clean reliability claim needs the A18.13 gate frozen
before the next family is generated or screened.

## Bridge Criterion

The bridge criterion for a future claim should be:

> A tutor demonstrates reliable peripeteia-induced adaptation when, under a
> frozen correctness-gated protocol, attempt-1 failure yields a finite policy
> memory whose selected repair is applied to held-out siblings more often than
> the no-policy baseline, with blind contrastive critics attributing the
> difference to that policy transfer rather than ordinary public inference.

Minimum pre-registered requirements:

1. Freeze the A18.13 policy-correctness gate before seeing the next family's
   held-out transcripts.
2. Require S0-hard local headroom under bounded continuation.
3. Require selected-policy correctness on the registered target, not merely any
   coherent repair.
4. Run the same five-critic contrastive panel only after the local gate passes.
5. Record ordinary-public-inference risk as a blocking or caveating field.
6. Report failures by family instead of pooling away no-headroom cases.

## Next Move

A18.16 should be a zero-API pre-registration step: freeze the correctness-gated
protocol, thresholds, report schema, and stop rules for a fresh third family
before any new generation or panel spending.
