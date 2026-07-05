# Content-Compulsion Contrast — Pre-registration

**Status:** **FROZEN 2026-07-05 at this commit** (operator: "Do it"; this commit launches the matrix). Pre-freeze completed: specs written; zero-paid validated through the frozen `lemma` design on a mock null (LB computes, guardrails compute, LD/LX empty as expected). No change past this commit.
**Line:** `workplan/items/content-compulsion-contrast.md`; parents: the refusal smoke (confirmed-flip, 1 switch/0 defends, n=1) and §6.13.18's named exit.
**Question (one, model-scoped):** does the content-compulsion STACK — forced frontier choice plus the strategy-refusal backstop (repeat-pick over criterial regression → one refusal demanding defend-or-switch) — improve dialogue outcomes over the identical calibrated stack without any lemma machinery, on Sonnet?

## Motivating data (declared, with weight)

The refusal smoke: one trigger, one SWITCH (press-on reversed into repair, full recovery, grounded 22), zero defends; bound 3/3 grounded vs baseline 3/3 (one pair +1). **n = 1 flip — near-zero weight; §5.12.7's shrinkage record applies at full strength and is cited in advance.** Declared risk: trigger sparsity — the refusal fired once in three runs; most of the arm's delta will come from the forced-choice machinery, with the refusal as backstop. The design therefore tests the stack, with per-trigger behavior a named secondary, never a promotion channel.

## Arms, worlds, seeds, backend

A `baseline` (calibrated stack only) vs B `lemma-bound` (+ `--lemma-layer '{"bind":true}'` — forced choice + refusal gate live). Stack identical: `--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '{"seed":<per-repeat>,"rate":0.08,"mutateShare":0.25,"maxConcurrent":1}'`. `world-005-marrick` + `world-019-marrick-resistant` (band-screened at this dose). 6 repeats/arm/world, pair-interleaved, seeds **263, 269, 271, 277, 281, 283** (fresh primes, disjoint from every prior matrix/probe/screen/smoke). 24 runs, n = 12/arm pooled. `DERIVATION_PROVIDER=claude DERIVATION_MODEL=sonnet`, concurrency 3, blocks sequential with checkpoint; trimmed same-label resume; hang > 40 min → kill + one retry; >2 parse-death exclusions void; floor-blind rule retained verbatim from the calibrated-contrast prereg.

## Endpoints and promotion bar

`T*` = `assertedGroundedTurn`, cap+1 = 29 imputed (caps 28; frozen `--design lemma` extractor, LB contrast).

1. Direction: mean T\* lower in the bound arm in each non-floored stratum.
2. Pooled one-sided Mann–Whitney U ≤ 42 at 12/12.
3. Guardrails clean in the bound arm: leaks 0; releases ≥ baseline − 0.5 per world; aporia-like ≤ baseline + 1 per world; guard overrides 0; untagged departures 0; frontier-choice coverage ≥ 0.8 (exercised = tutor|tutor_retry|delegate).

Power statement: good power only for ~2-turn-plus separations; direction-without-power CLOSES the question. No prediction of confirmation recorded. **Named secondaries (descriptive):** refusal triggers/switches/defends with quoted raws; post-refusal recovery (regressed lemma re-grounds); grounded rate; aporia-like; repair latency; per-world strata.

## Consequences

- **Confirmed:** content compulsion is a validated mechanism at tier for the mid-tier band — the first promotable strategy-layer result in the family; §6.13.18 gains the confirmation and the exit is no longer hypothetical. Localization follow-ups proposable.
- **Not confirmed:** the stack records as non-promotable at this bar; the smoke's flip stands as an unreplicated behavioral observation (the mechanism EXISTS; its outcome value does not clear the bar); the family closes with all exits measured. No re-rolls, no endpoint swaps (§5.12.6).

## Artifacts

Specs `config/drama-derivation/matrix-specs/sonnet-compulsion-{marrick,marrick-resistant}.yaml`; runs `exports/dramatic-derivation/matrix/sonnet-compulsion-<world>/`; report `exports/dramatic-derivation/lemma-layer/content-compulsion/`.

---

## Results addendum (2026-07-05; frozen analysis unmodified; report at `exports/dramatic-derivation/lemma-layer/content-compulsion/phase3-contrasts-report.{json,md}`)

**Execution.** 24/24, claude CLI (sonnet), blocks sequential at concurrency 3 (~95 min), zero interruptions, zero parse failures.

**Promotion bar: NOT MET — bar 1 passes (for the first time in the family), bar 2 fails, bar 3 passes 9/9.**

1. **Direction: PASS in BOTH worlds** — T\* 23.50 vs 25.67 pooled (Δ = −2.17), lower in each stratum ([-1, -1]). The family's first both-worlds direction pass on an outcome primary.
2. **Pooled Mann–Whitney: FAIL.** U = 50/144 vs ≤ 42 (one-sided p ≈ 0.09). Direction-without-power at n = 12/arm, exactly the outcome the power statement anticipated for sub-2-turn-plus effects... the observed Δ was 2.17 and still missed — the imputation-heavy tie structure costs rank power.
3. **Guardrails: PASS 9/9** — aporia-like IMPROVED in both worlds (1 vs 3 each), releases above parity, untagged 0, frontier coverage 1.00, zero overrides.

**Recorded verdict (as pre-committed): NOT CONFIRMED.** The stack is non-promotable at this bar; no endpoint swaps (§5.12.6). The pre-registered consequence is amended in one respect the data forces: the smoke's flip does NOT stand as an unreplicated observation — **the behavioral mechanism replicated robustly** (see below); it is the outcome claim that lacks power at this n.

**Named secondaries (descriptive, per the freeze):**

- **Refusals: 7 fired, 6 SWITCHED, 1 defended — and all seven refusal-involved runs grounded.** Every switch preceded recovery of the regressed ground; the one defense ("The estate note just staged names Edony…") was substantive and its run also grounded. Strategy-change-under-adversity is now a reliably inducible behavior, not a one-off.
- **Grounded 10/12 vs 6/12** (both worlds better); **repair latency 9.02 vs 14.81** (Δ = −5.79, both worlds, U = 37.5 — a named secondary that would have cleared the numeric criterion; the frozen primary was T\* and stays T\*).
- Every one of the four endpoint families signals positive in both worlds with zero negative transfer — unique in the §6.13.16–.18 record.

**What this licenses within the freeze:** the family closes with all exits measured; the content-compulsion mechanism stands as behaviorally validated (7/7) with outcome direction consistently favorable but below the pre-registered power bar. Any promotion attempt requires a fresh operator decision — the honest design per §5.12.7 would be n sized against a shrunken Δ ≈ 1.4–1.7 (roughly n = 20+/arm) or a grounded-rate primary.
