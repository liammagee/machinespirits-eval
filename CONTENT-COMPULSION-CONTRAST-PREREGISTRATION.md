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
