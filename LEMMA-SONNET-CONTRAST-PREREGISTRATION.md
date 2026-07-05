# Lemma-Map Sonnet Contrast — Pre-registration

**Status:** **FROZEN 2026-07-04 at this commit** (operator: "do the sonnet contrast first" — ahead of the shrinkage audit, their call recorded; this commit launches the matrix). Pre-freeze completed: specs written and zero-paid re-validated through the frozen `lemma-display` analysis design (mock null clean). No design, endpoint, or analysis change past this commit.
**Line:** new card `workplan/items/lemma-sonnet-contrast.md`; parents `LEMMA-DISPLAY-CONFIRMATORY-PREREGISTRATION.md` (codex: not confirmed) and the propose-go smoke `workplan/items/lemma-map-sonnet-smoke.md`.
**Question (one, model-scoped):** does the lemma map as pure prompt information improve dialogue outcomes on a **mid-tier inner loop** (Sonnet via the claude CLI) — the bookkeeping-vs-judgment framework's prediction that a state artifact helps precisely the model that cannot maintain even a small closure internally, where the frontier model (codex) found it redundant?

## Motivating data (declared plainly, with its weight stated)

The 4-run Sonnet smoke (seeds 101/103, world-019): instrument gate passed 4/4; seed 101 baseline aporia → display grounded T\* = 23 where both codex arms died; seed 103 both Sonnet arms died where codex baseline grounded. **n = 2/arm — directional color only, near-zero evidential weight.** The standing warnings apply at full strength and are part of this document: the flash smoke inverted from this exact posture (2/2 → 0/2), and the same-day codex display confirmatory flattened an exploratory U = 40.5 to U = 67. This design's motivating data would NOT survive its own bar; the contrast exists to find out whether anything does.

## Bar-calibration note (the day's lesson, applied)

U ≤ 42 at 12/12 is retained as the promotion criterion **because it is the exact one-sided 0.05 test, not because the motivating data sits near it** (it doesn't — n = 2 estimates nothing). Power statement, pre-registered: at n = 12/arm this test has good power only for large effects (roughly a 2-turn-plus mean T\* separation with the failure-imputation structure these worlds produce). A smaller true effect will likely return direction-without-power, and per §5.12.6 that outcome CLOSES the mid-tier question for this stack — it does not license a third draw. No prediction of confirmation is recorded; the honest prior after today is shrinkage.

## Arms (two)

| Arm | Label | Delta |
|---|---|---|
| A | `baseline` | binding stack only |
| B | `lemma-display` | + `--lemma-layer '{"display":true}'` (map as information; zero binding) |

Binding base (identical, both arms): `--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '<per-repeat seeds>'`. Backend `DERIVATION_PROVIDER=claude`, `DERIVATION_MODEL=sonnet` (CLI, Max-plan quota, zero marginal dollars; format-proven by the smoke's 4/4 instrument gate). Turn-watch superego OFF; strategy-ledger OFF.

## Worlds, repeats, seeds

`world-005-marrick` + `world-019-marrick-resistant` (the screened pair, unchanged for cross-model comparability with both codex draws). **Declared floor risk:** the smoke showed Sonnet baselines failing hard on world-019, and marrick has no Sonnet headroom probe; if a stratum floors in both arms (all runs imputed at cap+1), its pair-ties contribute half-wins to the pooled U and the stratum direction records as 0 — a floored stratum is reported as floor-blind, not spun. 6 repeats per arm per world, pair-interleaved, decay seeds **131, 137, 139, 149, 151, 157** (fresh primes, disjoint from every prior matrix, probe, screen, and smoke — including the smoke's 101/103, so no preview overlap at all). 24 runs, n = 12/arm pooled. Concurrency 3 within world blocks, blocks sequential with a checkpoint; interruptions resume via trimmed same-label specs; hang > 40 min → kill, one same-label retry; two failures exclude the pair; >2 parse-death exclusions void the matrix.

## Endpoints and promotion bar

Per run: `T*` = `assertedGroundedTurn`, cap+1 = 29 imputed (both caps 28; the frozen `--design lemma-display` extractor, unchanged).

**Promotion bar (all three, display-vs-baseline pooled 12v12):**

1. Direction: mean T\* lower in the display arm in each non-floored world stratum (a floored stratum, defined above, neither passes nor fails direction; at least one stratum must be non-floored for the bar to be evaluable — both floored voids the matrix as floor-blind).
2. Pooled one-sided Mann–Whitney U ≤ 42 at 12/12.
3. Guardrails clean in the display arm: leaks 0; releases ≥ baseline − 0.5 per world; aporia-like ≤ baseline + 1 per world; guard overrides 0; zero binding events.

**Secondary (descriptive, no promotion weight):** grounded rate; **aporia-like rate, named** (the one channel that replicated in both codex draws — its behavior here is recorded whatever the primary does); repair latency; mean turns played; per-world strata; within-seed cross-model comparators against both codex draws where seeds do not overlap (they do not — noted for honesty: cross-model reads here are cross-seed, aggregate-level only).

## Outcomes and recorded consequences

- **Confirmed:** the lemma map is a validated mechanism **for mid-tier inner loops** at pre-registered tier — a model-scoped claim, never a general one. §6.13.17 gains a coda: the bookkeeping-vs-judgment law acquires its capability threshold (a state artifact adds capacity below the model strength at which the bookkeeping is internally cheap; at the frontier it is redundant — both halves then pre-registered). Follow-ups (which map section carries it; a Haiku-tier probe) may be proposed.
- **Not confirmed:** the Sonnet smoke records as an unreplicated directional observation (joining the flash smoke); the mid-tier question closes for this stack; the shrinkage audit proceeds with one more paired specimen; no fourth draw of any lemma contrast without a fresh operator decision.
- No re-rolls, no endpoint swaps, no post-hoc arms (§5.12.6).

## Artifacts

Specs `config/drama-derivation/matrix-specs/sonnet-display-{marrick,marrick-resistant}.yaml`; fresh mock-validation spec + run pre-freeze; runs `exports/dramatic-derivation/matrix/sonnet-display-<world>/`; analysis via the frozen contrasts script's existing `lemma-display` design (zero-paid validated this morning and re-validated pre-freeze); report `exports/dramatic-derivation/lemma-layer/sonnet-contrast/`.

---

## Results addendum (2026-07-04; frozen analysis unmodified; report at `exports/dramatic-derivation/lemma-layer/sonnet-contrast/phase3-contrasts-report.{json,md}`)

**Execution.** 24/24 runs, claude CLI (sonnet), blocks sequential at concurrency 3 (~85 min), zero parse failures across ~1,600 role calls — the instrument held completely. One process-handling correction disclosed: block 2 was first launched untracked (a stray shell background), killed before any run completed, artifacts removed, and relaunched tracked; zero runs lost, zero data touched.

**Verdict (per the frozen floor rule): MATRIX VOID — FLOOR-BLIND.** Every one of the 24 runs, both arms, both worlds, imputed at T\* = 29 (marrick: 12/12 at cap; marrick-resistant: 12/12 at cap). Both strata floored; the pre-registered bar is not evaluable (pooled U = 72/144, the exact null midpoint, degenerate by construction). Guardrails, for the record, 9/9 clean — the display arm stayed pure information and even staged slightly more evidence (releases 7.67 vs 7.17 and 8.00 vs 6.67).

**What the void teaches (recorded, not spun):**

- **The capability threshold sits below this world pair, not within it.** Sonnet cannot bring these dramas to grounded recognition under this decay grid at all — with or without the map. The lemma map cannot rescue a drama the model cannot finish; a bookkeeping artifact moves capacity around a threshold, it does not cross one. The mid-tier question is NOT answered negative — it is unmeasurable on these worlds.
- **The smoke's seed-101 grounding did not recur** at six fresh seeds — it now looks like a favorable-draw outlier, the third smoke-tier signal this arc has watched dissolve (flash plan-mode, codex display, Sonnet display). The shrinkage file gains its cleanest specimen yet: a 1-in-2 smoke success against a 0-in-12 powered draw.
- **A real mid-tier test needs easier worlds** — a decay grid or schedule slack calibrated to put Sonnet's baseline near 30-50% grounded (the headroom band marrick occupies for codex). That is a world-authoring/calibration decision (an operator gate), and the floor-blind rule written into this document did exactly its job: no verdict was manufactured from ties.

**Consequences (per the freeze, floor-blind branch):** no confirmation and no closure of the mid-tier question — it records as UNMEASURED on this stack's current worlds; the Sonnet smoke records as an unreplicated directional observation; any retry requires Sonnet-calibrated worlds under a fresh pre-registration; the shrinkage audit proceeds with this specimen added.
