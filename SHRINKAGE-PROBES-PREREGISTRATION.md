# Shrinkage Probes — Pre-registration (methodology, §5.12.7)

**Status:** **FROZEN 2026-07-07 at this commit** (operator: "do two suspicion-probing experiments"; this commit launches the runs). These are the two discriminating tests §5.12.7 registered as open when it read the six-specimen record as "a family of near-zero true effects under tail-selection": they probe the MEASUREMENT account itself, not any mechanism. **No mechanism or outcome claim can result from either limb; every closed question stays closed regardless of what they show.** Analysis is deterministic (`scripts/analyze-shrinkage-probes.js`, written and zero-paid validated pre-freeze); no promotion bar exists — the pre-stated reads below are the entire licensed output.

## Limb B — within-seed replication (the drift test)

**Question:** is the smoke-to-confirmatory gap attributable to backend drift across the time window, or to sampling variance at fixed conditions? The record's one accidental datum (the flash smoke inverting at its own seeds) points at sampling variance; this makes the measurement deliberate.

**Design:** re-run the register-router smoke's EXACT six arms — same world (marrick), same config, same decay seeds **419/421/431** (reused BY DESIGN, declared), same provider (Sonnet CLI), same labels — **twice**, into fresh dirs (`register-router-smoke-rerun1`, `-rerun2`). Together with the original smoke this gives three replications of the identical 6-arm experiment, hours-to-days apart.

**Pre-stated reads (B):**
1. **Outcome-flip count:** across the three replications, how many of the six arm-slots change outcome class (grounded vs cap-death) between any two replications? **If ≥ 2 of 6 slots flip, within-seed sampling variance is established as the dominant term** — decay seeds do not pin outcomes, smoke-tier n = 3 contrasts are formally uninformative about mechanisms, and drift is unnecessary as an explanation of the §5.12.7 record. If ≤ 1 slot flips (outcomes nearly pinned), sampling variance is small at fixed seeds and the drift explanation returns to the table with a design for testing it (a matrix-window replication).
2. The smoke's arm-level pattern (router 3/3 vs baseline 1/3) either recurs in the replications or does not — recorded plainly.
3. Router fires per arm across replications (does the same seed produce the same fires?) — descriptive.

## Limb A — null-scaling controls (the selection-asymmetry test)

**Question:** the observed record is 100% *advanced* signals (nulls are never re-run), so near-universal decline is the censored-sample expectation under zero truth. Scaling KNOWN-NULL smokes breaks the censoring: under the zero-truth + symmetric-noise account, scaled nulls should move symmetrically (signs random, occasional excursions); if scaled nulls sit dead while promoted smokes always collapse, the asymmetry would be real evidence against the account.

**A1 — placebo scaling (Sonnet).** The learner-mirror-refusal smoke was a perfect null with an *inert* arm (zero fires; §6.13.18 coda): scaling it is a pure harness placebo — the arms differ by a flag that does nothing. n = 10/arm on marrick at dose 0.08, pair-interleaved, fresh primes **541, 547, 557, 563, 569, 571, 577, 587, 593, 599**; arms `baseline` vs `mirror-refusal` (`--learner-mirror-refusal on`, real trigger — expected to keep firing zero times).
**A2 — active-null scaling (codex).** The codex register-router smoke was null (1/3 vs 1/3 grounded) with an *active* arm (6 evidenced fires): scaling it measures the fate of a null-coloured active mechanism. n = 10/arm on marrick at the codex dose 0.35, pair-interleaved, fresh primes **601, 607, 613, 617, 619, 631, 641, 643, 647, 653**; arms `baseline` vs `register-router`. **Declared explicitly: the register-router outcome question is CLOSED (§6.13.19) and stays closed; A2 licenses no mechanism reading in either direction.**

**Pre-stated reads (A):**
1. For each scaled null: pooled Δ (T\*, cap+1 = 29 imputed) and one-sided U at 10/10 — reported as a *measurement of the null distribution*, not as a test of anything.
2. **Excursion check:** does either scaled null produce a signal of the size that got smokes promoted (|Δ| ≥ 1.5, or a 3-run stretch of same-direction pair-splits)? If yes, tantalizing-thread-sized signals arise from known nulls and the promoted smokes' colour was unremarkable — the zero-truth account confirmed from the other side.
3. **Sign symmetry:** the two scaled nulls' Δ signs (random under the account; both-dead-flat would be the anomaly worth noting).
4. Conduct sanity: leaks 0; A1 fires expected 0 (any fire is reported with its evidence); A2 fires evidenced as before.

## Execution

Limb B and A2 run in PARALLEL (disjoint quotas: Sonnet CLI vs codex CLI); A1 follows B on the Sonnet quota. Concurrency 3 within each matrix; 40-min hang → kill + one same-label retry; interruption → trimmed same-label resume; external stop → stand down for the operator. Specs `config/drama-derivation/matrix-specs/{register-router-smoke-rerun1,register-router-smoke-rerun2,null-scale-mirror-refusal,null-scale-codex-router}.yaml`; runs under `exports/dramatic-derivation/matrix/`; analysis report `exports/classifier-dag/shrinkage-probes/`.

## Consequences (pre-committed)

Whatever the results: no mechanism question reopens, no new mechanism claim arises. §5.12.7's sentence "neither has been run" is replaced by the recorded outcomes; the reads above license at most (i) a statement about which term dominates smoke-tier variance, (ii) a statement about whether the censored record's asymmetry survives an uncensored control, and (iii) the standing recommendation for smoke design that follows (e.g., minimum n or endpoint changes for future screens). No re-rolls, no endpoint swaps, no post-hoc limbs.
