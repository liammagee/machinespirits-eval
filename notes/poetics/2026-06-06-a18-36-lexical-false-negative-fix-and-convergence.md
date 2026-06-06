# A18.36 — Lexical correctness false-negative fix + first fresh-family convergence

Date: 2026-06-06

Claim boundary: `simulated_teacher_as_learner_not_human_learning`.

## The headline

`relational_betweenness_priority` (authored in the A18.35 fanout, after the bead
positive control was frozen, passing all zero-API gates) is the **first fresh
family to show genuine architecture-independent local headroom on BOTH held-out
siblings**. This is the convergence signal the A18.26+ series was hunting.

| channel | sibling-1 (blue_right, target slot 6) | sibling-2 (gold_middle, target slot 7) |
|---|---|---|
| gate `local_verdict` | S0 revise_again, S1 survivor | S0 revise_again, S1 survivor |
| policy distinctiveness | 0.273 (`policy_distinct`) | 0.212 (`policy_distinct`) |
| S0 shortcut → target | colour → slot 1 (wrong) | lane/reach → slot 3 (wrong) |
| S1 span → target | "tag-and-stud span" → slot 6 (right) | "bracketed by the tag and the stud" → slot 7 (right) |

The two S0 arms fail via *different* surface shortcuts (colour vs lane); both S1
arms succeed via the *registered* span relation. Three independent channels agree
(gate survival, policy distinctiveness, direct reading of the continuations).

## The bug it exposed: `lexical_correctness_false_negative`

The zero-API correctness overlay used **contiguous-substring** matching
(`phraseHits`). A genuinely-correct S1 continuation —

> "Only slot six **has a** neri, the plain tan one."
> "the buff ralo **at** slot seven sits inside that span"

— was scored `missing_registered_target` because the registered alias was
`neri in slot six` / `ralo in slot seven`. The matcher even failed to register
S0's *wrong* target when phrased naturally. This is an **instrument bug, not a
design failure**: the target *was* derived; the overlay couldn't see it.

## The fix (additive, order-insensitive, proximity-bounded)

`run-recursive-tutor-policy-ablation.js` now also computes a relaxed match:
ordinal normalization (`six`/`sixth`/`6` collapse), light stemming, and
**slot-anchor windowed** matching (type token within a bounded window of the
`slot N` anchor), plus a span-concept fallback for relation markers (span word +
both derived endpoints within a clause window). The strict `correct`/`verdict`
fields are **unchanged**; the relaxed verdict is added alongside
(`relaxed_correct`, `relaxed_verdict`, `relaxed_target_hits`,
`lexical_false_negative`), and `analyzePolicyCorrectness` exposes
`relaxed_verdict` + `lexical_false_negative_corrected`. Backward compatibility:
all 64 recursive-tutor tests still pass.

## Anti-closed-loop proof

The matcher was **not** loosened until the desired arm passed. Its discriminating
power is pinned by `tests/recursiveTutorPolicyCorrectness.test.js` (11 tests)
using the **verbatim** S0/S1 continuations:

- S1 correct targets now match in natural word order (fixes the false negative).
- **Both wrong-slot S0 arms still fail** to match the correct target; sibling-1's
  S0 is positively flagged for the *wrong* target it actually picked
  (`slot one neri`).
- Span markers reject both colour/lane S0 arms; an adversarial cross-clause
  mention (names slot six but selects slot two) is rejected; the frozen-bead
  positive control still matches without over-matching.

The convergence claim therefore rests on architecture-independent channels
(direct reading + gate + distinctiveness), with the overlay only *un-masking*
what those channels already showed — not on a tuned overlay.

## Relaxed rescore artifact

`scripts/rescore-recursive-tutor-correctness-relaxed.js` (zero-API; reads the
preserved replay outputs only) re-scores both preserved siblings:

```
family_local_headroom_relaxed: true
corrected_false_negatives: 2
sib1: strict no_correct_policy_application -> relaxed policy_memory_correctness_advantage
sib2: strict no_correct_policy_application -> relaxed policy_memory_correctness_advantage
both S0: relaxed_correct=false (still rejected)
both S1: relaxed_correct=true  (selected span policy applied)
```

Artifact (gitignored): `exports/recursive-tutor-learning/a18.35-relational-betweenness-local/a18.36-relaxed-correctness-rescore.json`.
Regenerate via the rescore driver on the two preserved
`a18.6-policy-ablation.sib{1,2}-*` reports.

## What this does and does not establish

- DOES: one independently-authored fresh family produces architecture-independent
  local headroom on two held-out siblings, and the apparatus's correctness
  overlay was masking it via a lexical artifact now fixed and validated.
- DOES NOT (yet): establish a convergence *rate*. n=1 family. The A18.37
  replication fanout runs the remaining 11 families to test whether convergence
  generalizes or `relational_betweenness` is a singleton.
