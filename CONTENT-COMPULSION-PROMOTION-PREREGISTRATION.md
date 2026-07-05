# Content-Compulsion Promotion Run — Pre-registration

**Status:** **FROZEN 2026-07-05 at this commit** (operator: "do the larger promotion run"; this commit launches the matrix). Pre-freeze completed: specs written; zero-paid validated through the frozen `lemma` design at n=10-repeat shape (LB computes on 20v20 pooled, guardrails compute). No design/endpoint/analysis change and NO derivation-stack code change past this commit until the matrix completes.
**Line:** `workplan/items/content-compulsion-promotion.md`; parent `CONTENT-COMPULSION-CONTRAST-PREREGISTRATION.md` (not confirmed: direction-without-power, Δ = −2.17, U = 50/144, guardrails 9/9, mechanism 7/7).
**Question (unchanged, now powered):** does the content-compulsion stack (forced frontier choice + evidence-bearing strategy refusal) improve dialogue outcomes over the calibrated baseline on Sonnet?

## Sizing (per §5.12.7, applied)

This is the SECOND draw on this hypothesis; the first returned Δ = −2.17 at n = 12/arm. Per the shrinkage audit's rule the design is sized against a SHRUNKEN estimate (Δ ≈ 1.4–1.7, roughly the observed effect discounted by the audit's selection gap): **n = 20/arm pooled** (10 repeats per arm per world). At 20/20 the exact one-sided 0.05 critical value is **U ≤ 138** (of 400; null midpoint 200). No prediction of confirmation is recorded; the first draw's own direction could be the tail of a smaller truth — that is precisely what this run measures.

## Arms, worlds, seeds, backend

A `baseline` vs B `lemma-bound` (forced choice + refusal gate), stack identical to the parent: `--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '{"seed":<per-repeat>,"rate":0.08,"mutateShare":0.25,"maxConcurrent":1}'`. Worlds `world-005-marrick` + `world-019-marrick-resistant`. 10 repeats per arm per world, pair-interleaved, decay seeds **293, 307, 311, 313, 317, 331, 337, 347, 349, 353** (fresh primes, disjoint from all prior). 40 runs, n = 20/arm pooled. `DERIVATION_PROVIDER=claude DERIVATION_MODEL=sonnet`, concurrency 3, world blocks sequential with a checkpoint; trimmed same-label resume; hang > 40 min → kill + one retry; >2 parse-death exclusions void; floor-blind rule retained verbatim.

## Endpoints and promotion bar

`T*` = `assertedGroundedTurn`, cap+1 = 29 imputed (caps 28; frozen `--design lemma` extractor, LB contrast).

1. Direction: mean T\* lower in the bound arm in each non-floored stratum.
2. Pooled one-sided Mann–Whitney **U ≤ 138 at 20/20** (exact one-sided 0.05).
3. Guardrails clean in the bound arm: leaks 0; releases ≥ baseline − 0.5 per world; aporia-like ≤ baseline + 1 per world; guard overrides 0; untagged departures 0; frontier-choice coverage ≥ 0.8.

**Named secondaries (descriptive):** refusal triggers/switches/defends with quoted raws + post-refusal recovery; grounded rate; aporia-like; repair latency; per-world strata; refusal-involved-run outcomes.

## Consequences

- **Confirmed:** content compulsion is the family's first promotable strategy-layer mechanism at pre-registered tier; §6.13.18 gains the confirmation (paper addendum a separate operator-gated step); the six exploration lines proceed on a validated base.
- **Not confirmed:** the mechanism stands behaviorally validated but without demonstrated outcome value at either n; the question closes at this dose/model pair (a third draw would need a materially different design, not more of the same); the exploration lines proceed as mechanism studies only.
- No re-rolls, no endpoint swaps, no post-hoc arms (§5.12.6).

## Artifacts

Specs `config/drama-derivation/matrix-specs/sonnet-promo-{marrick,marrick-resistant}.yaml`; zero-paid validation pre-freeze; runs `exports/dramatic-derivation/matrix/sonnet-promo-<world>/`; report `exports/dramatic-derivation/lemma-layer/content-compulsion-promotion/`.
