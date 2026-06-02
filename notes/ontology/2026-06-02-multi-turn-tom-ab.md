# Multi-turn ToM A/B — does the consistency-checked ToM beat plain ontology guidance?

Date: 2026-06-02 · Branch: `ontology-consolidation`
No empirical claims for the paper (a bounded real screen + a mechanism interpretation).

## What was built

`scripts/run-ontology-tom-ab.js` — an N-turn A/B harness over three arms that differ **only** in
the tutor's per-turn guidance, so the contrast isolates the new ToM content:
- `baseline` — no ontology guidance
- `ontology` — `buildOntologyGuidance` policy guidance (the existing arm)
- `ontology_tom` — policy guidance **+** `computeTomBrief`, the new intervention

`computeTomBrief` (pure, unit-tested) uses the consistency machinery the *correct* way for the
surface-compliance trap: the tutor's turn-stamped acquired model of the learner is consistency-checked,
and a **grounded inconsistency** (the learner *claims* the conclusion yet *signals* weak ownership)
fires a "do not accept it; ask them to reconstruct the warrant" alert. Deferring learners get a
scaffold-toward-partnership directive. Scoring stays on an independent judge + symbolic
anagnorisis-overlap. Main-guards added to this harness and the pilot so importing `SCENARIOS` /
`computeTomBrief` never fires a run. Tests: `tests/ontologyTomHarness.test.js` (4), 17 ontology tests green.

## Result — real Codex, latent-misrecognition / surface-compliance stress trap, 3 turns

n=1 (single scenario; full stress-suite n=3 aggregate appended below):

| arm | anagnorisis-overlap | judge total |
|---|---:|---:|
| baseline | 0.00 | 2.64 |
| ontology | 1.00 | 2.79 |
| ontology_tom | 1.00 | 2.56 |

- **ontology beats baseline** (anagnorisis 1.0 vs 0.0; judge 2.79 vs 2.64) — the ontology layer helps,
  replicating the original trap-search finding on a multi-turn dialogue.
- **`ontology_tom` does NOT beat `ontology`**: identical anagnorisis (1.0), judge **−0.23** (n=1 = noise,
  but the direction is null-to-slightly-worse).

## Why — the mechanism works but is redundant (the §6.7–§6.10 motif again)

The mechanism *fired correctly*: `tomTrace.surfaceCompliance = [false, true, true]` — once the tutor had
observed the learner both claiming the conclusion and showing weak ownership, the grounded inconsistency
was detected and the alert raised. But it changed nothing, because the **plain ontology policy guidance
already prompts the tutor to refuse surface compliance.** Both tutors open with the same move:

- `ontology`: *"We can move on only if the proof is yours, not just cleaner. … tell me one place where
  the reasoning could still fail."*
- `ontology_tom`: *"We can move on only if the reasoning is yours, not just the proof style. … say in
  your own words what warrant lets the conclusion follow."*

The explicit consistency alert is **re-encoding a move the ontology guidance already supplies** — exactly
the dividing principle the §6.7–§6.10 arc converges on: a richer layer that restates what the base (here,
base + ontology) already reads buys nothing. If anything, the extra directive left the learner slightly
more defensive ("I am still fighting the feeling that this is another approval test"), costing the judge
points. The new signal (DL consistency) is *real* and *correctly computed*; it is just not *new* relative
to the ontology guidance on this trap.

## Bounds

Single scenario / single backend / heuristic anagnorisis detector / dramatic-structural form, not
learning ([[dramatic-form-not-mindreading]]). This is a screen + a mechanism interpretation, not an
effect estimate. Per the arc's anti-thrash discipline ([[feedback_ablation_creep_synthesis]],
[[project_adaptation_plan_2]]) the honest stopping point is the null-with-mechanism, not a larger sweep
chasing a different number. The mock harness (`--backend mock`) is a rigged plumbing check, not evidence.

## Full stress suite (n=3) — confirms the null

A fresh `--suite stress` run (3 scenarios, 1 run each, 3 turns):

| arm | anagnorisis-overlap | judge total |
|---|---:|---:|
| baseline | 0.83 | 2.70 |
| ontology | 1.00 | 2.67 |
| ontology_tom | 0.83 | 2.73 |

**Δ(ontology_tom − ontology): anagnorisis −0.17, judge +0.06 (noise).**

Per scenario (anagnorisis / judge):
| scenario | baseline | ontology | ontology_tom |
|---|---|---|---|
| latent_misrecognition_surface_compliance | 0.50 / 2.64 | 1.00 / 2.55 | 1.00 / 2.75 |
| publication_overclaim_resistance | 1.00 / 2.74 | 1.00 / 2.83 | 1.00 / 2.77 |
| identity_threat_analogy_resistance | 1.00 / 2.73 | 1.00 / 2.63 | **0.50** / 2.67 |

The n=3 screen confirms and slightly strengthens the n=1 read: **`ontology_tom` does not beat `ontology`.**
Anagnorisis is in fact *lower* (0.83 vs 1.00) — the tom arm's extra directiveness cost the learner the
goal in the identity-threat scenario, where over-instructing a defensive learner backfires; judge is
+0.06 (noise). (Per-scenario n=1, so individual cells are noisy and the second latent-misrecognition
sample differs slightly from the first run above — codex is stochastic; the aggregate direction
`tom ≤ ontology` is consistent across both runs.)

**Verdict.** The multi-turn, consistency-checked ToM intervention is a **null-to-slightly-negative** over
plain ontology guidance on the stress traps. The mechanism is real and correctly computed (surface
compliance detected, briefs followed); it is *redundant* with what the ontology policy guidance already
prompts, and over-instructing the tutor can make a defensive learner worse. The ontology layer itself
helps over baseline (anagnorisis 0.83→1.00); the *ToM-temporal layer on top of it* does not. This is the
§6.7–§6.10 dividing principle holding on a third, symbolic instrument: gains require signal the base does
not already read, not a richer restatement of what it does.
