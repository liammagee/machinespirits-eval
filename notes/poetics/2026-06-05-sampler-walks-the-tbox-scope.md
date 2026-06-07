# Scope — the sampler walks the TBox (#9, the generative arc)

Date: 2026-06-05
Status: design note (no code yet). Serves the original ask: *"a robust and replicable
machine for generating varied forms of adaptation, responsive to contexts and alter
egos."* The scoring side (adaptation-core + bridge + correction axis) is built and
committed; this is the generative side.

## The one idea

The **same `ms:` TBox a critic walks to SCORE, a sampler walks to GENERATE.**
`validateTurnPlan` already *rejects* a turn_plan with a form-conflict (a move that
`contraindicatesForm` a targeted form — R6). The sampler is **that constraint run
backwards**: instead of flagging conflicts after the fact, it *enumerates the valid
space* up front and samples varied points from it. Generation and validation share one
vocabulary; nothing new is invented to generate that the critic didn't already use to
score. That duality is the whole elegance — and the test that it's real is a
**round-trip**: every sampled turn_plan must pass the existing `validateTurnPlan`.

## What the sampler walks (already in the ontology)

- **`aimsAtForm`** — for each target form, the moves that advance it (RouteChange→Peripeteia,
  ActionGate/RecognitionPress→Anagnorisis, …). The *candidate* pool.
- **`contraindicatesForm` / R6** — moves to exclude (Hold⊣Peripeteia, PseudoCatharsis⊣Catharsis).
  The *forbidden* set. (This is `validateTurnPlan`'s conflict check, used as a filter.)
- **`performedByRole`** — restrict each turn's pool to the acting role's repertoire.
- **`correctsAgency` (the alter-egos)** — condition sampling on the interior agencies:
  a tutor turn's `route_change` is gated by the superego-as-mechanism-critic; a learner
  turn's reframe by the superego-as-costume-guard. This is where *"responsive to alter
  egos"* enters — the sampler doesn't just pick moves, it picks moves *a given ego/superego
  configuration would license*.
- **scene / persona slots** — *"responsive to contexts"*: weight/condition the draw on the
  drama's scene + learner persona (the composer's slot model).

## Build stages (incremental; stop at any point and it's still useful)

1. **Turn-plan sampler (the core).** Input: target forms + role. Query the closure for the
   `aimsAtForm`/`contraindicatesForm` facts, build the valid move pool, sample varied
   move-sets, emit a `turn_plan`. **Acceptance test:** N sampled plans, 100% pass
   `validateTurnPlan` (round-trip) and ≥K distinct move-sets (a diversity floor).
2. **Condition on context + alter-egos.** Fold scene/persona + ego/superego/id into the
   draw (weights + the `correctsAgency` gate). Same round-trip acceptance.
3. **Widen to full drama specs.** From turn_plan to `drama: / cast: / audience:` — the
   composer's slots, sampled from priors under the same constraints.
4. **Wire it in.** A "suggest" action in `/compose` (the sampler is the composer's
   automation), and the `/ms-drama-machine` skill's brief→spec step becomes
   ontology-driven instead of hand-sampled.

## Honest boundary (do not oversell)

- The ontology constrains **form-validity, not pedagogical quality**. A valid turn_plan is
  a well-*formed* drama, not a *good* one — same boundary as the scoring side
  (`dramatic-form-not-mindreading`). The sampler makes *valid, varied* dramas; whether they
  *teach* is the empirical question the §6.7–§6.10 nulls already bear on.
- **Value-over-baseline is empirical, not assumed.** There is already a brief-driven sampler
  (the `/ms-drama-machine` skill). Whether an *ontology-walking* sampler produces
  more-varied / more-valid / more-useful specs than the brief-driven one is a measurable
  claim — and the ontology-ToM-layer null (`project_ontology_tom_layer_null`) is the
  cautionary precedent: a richer formal layer did NOT beat a plainer one there. So the
  first real result to seek is **diversity + validity vs the existing sampler**, not a bare
  "it generates."
- This is **generative scaffolding**; any empirical claim lands in `docs/research/paper-full-2.0.md`.

## Smallest next step

Stage 1 alone — a `sampleTurnPlan(targets, role)` that round-trips through
`validateTurnPlan` at 100% with a diversity floor — is the minimum that proves the
generate⊨score duality. Everything after is widening, not a new idea.
