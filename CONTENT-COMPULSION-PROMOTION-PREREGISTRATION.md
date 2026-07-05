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

---

## Results addendum (2026-07-05; frozen analysis unmodified; report at `exports/dramatic-derivation/lemma-layer/content-compulsion-promotion/phase3-contrasts-report.{json,md}`)

**Execution.** 40/40 runs, claude CLI (Sonnet), world blocks sequential at concurrency 3 (~2.5 h total), zero parse deaths, zero kills or retries, zero resumes. The derivation stack was untouched between freeze and completion, as pre-committed.

**Promotion bar: NOT MET — bars 1 and 2 fail; bar 3 passes 9/9.**

1. **Direction in every non-floored stratum: FAIL.** Marrick (both arms 6/10 grounded, non-floored): bound 25.60 vs baseline 25.00 — AGAINST the bound arm by 0.60. Marrick-resistant (non-floored): bound 24.10 vs baseline 25.70 — toward the bound arm by 1.60. Direction split; the bar requires it in both.
2. **Pooled Mann–Whitney: FAIL.** U = 190/400 against the ≤ 138 criterion (null midpoint 200). Pooled T\* 24.85 vs 25.35, Δ = −0.50 — the exploratory Δ of −2.17 shrank by a factor of ~4, landing almost exactly where the §5.12.7 shrinkage rule predicted (the design was sized against Δ ≈ 1.4–1.7; the realized effect came in below even that).
3. **Guardrails: PASS, 9/9.** Leaks 0; releases above baseline parity in both worlds (7.70 vs 7.50; 8.60 vs 8.30); aporia-like within margin (4 vs 3; 3 vs 5); overrides 0; untagged departures 0; frontier-choice coverage 1.00.

**Recorded verdict (as pre-committed): NOT CONFIRMED — the question closes at this dose/model pair.** The mechanism stands behaviorally validated but without demonstrated outcome value at either n (12/arm or 20/arm). No third same-shape draw; the exploration lines proceed as mechanism studies only.

**Named secondaries (descriptive, equal prominence):**

- **Refusal tally: 6 fired across 20 bound runs** (5 in three marrick runs, 1 in marrick-resistant) — 3 defended, 3 switched, and **all four refusal-involved runs grounded** (T\* 23, 22, 24, 22). The parent draw's mechanism finding replicates end-to-end at scale: triggers fired only on repeat-pick-plus-regression, and every defense cites actual staged scene evidence rather than boilerplate. Quoted defenses: *"The just-staged note names the sole hand at the very crucible already matched to the dross — that's the last piece castBlankFor needed"* (marrick r1 t10); *"the inventory just placed on the table is the burin-holder ledger itself, the exact document the die line was waiting on"* (marrick r6 t22); *"The blank finding already stands on the learner's own board from turn 10-11; the live work now is pinning the notch to one tool"* (marrick r9 t14). Switches: dieCutWith→castBlankFor after 2 regressions (r1 t14), castBlankFor→struckBy (r9 t23), dieCutWith→blankFrom (resistant r1 t14).
- **Repair latency — the parent's strongest secondary — did NOT replicate.** Parent draw: 9.02 vs 14.81 (U = 37.5/144, bound better). This draw: 15.90 vs 15.56 (Δ +0.33, sign flipped). A second named-secondary shrinkage specimen for §5.12.7.
- **Grounded rate: bound 13/20 vs baseline 11/20** (+0.10) — positive but noise-level.
- **T\* saturates at the fast end.** Every grounded bound run in marrick-resistant landed at exactly T\* = 22, as did most grounded baseline runs; when either arm succeeds on that world it hits the same earliest-achievable turn. Any real contrast there is in failure *rate*, not speed — a measurement note for any future design on these worlds.
- **The world × arm interaction recurs.** The parent draw had both strata toward the bound arm; this draw splits them (marrick against, resistant toward). This is the third contrast in the family whose per-world pattern failed to reproduce across draws — the instability is the constant, not any particular direction.
