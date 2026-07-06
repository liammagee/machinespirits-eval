# Register-Router Contrast — Pre-registration

**Status:** **FROZEN 2026-07-06 at this commit** (operator: "go ahead" to the powered contrast; this commit launches the matrix). Pre-freeze completed and disclosed: the `register-router` analysis design entry (endpoints + router guardrails) was added to `scripts/analyze-strategy-ledger-contrasts.js` and zero-paid validated on the smoke draw (7/7 guardrails computing, RR contrast computing at 3v3 and on the pooled two-dir path). No design, endpoint, or analysis change past this commit; NO derivation-stack code change until the matrix completes.
**Line:** `workplan/items/register-router-contrast.md`; parent `workplan/items/classifier-dag-register.md` (Phase A sensor audit 87.2% chain-level on formal labels; Phase B smoke).
**Question (one, powered):** does the register router — the Phase-A-audited deterministic lexical sensor over the learner's last message, routing the tutor's per-turn stance register by classifier × DAG interaction (repair on a regressed chain; confront on mirror-residual with a derivable incompatible partner; didactic otherwise) — improve dialogue outcomes over the calibrated baseline on Sonnet?

## Motivating data (declared plainly, with its weight stated)

The 6-run smoke: router 3/3 grounded at T\* = 22 vs baseline 1/3 (raw Δ = −4.67 at n = 3); the repair rule fired once per router run, always evidenced; leaks 0. **n = 3/arm — the exploratory posture that has now shrunk or dissolved four times in this programme** (flash plan-mode, codex display, Sonnet display, and the content-compulsion promotion's ~4× shrinkage). The motivating data would NOT survive this document's own bar, and no prediction of confirmation is recorded.

## Sizing (per §5.12.7, applied)

Sized against a SHRUNKEN estimate, not the observed one: the smoke's −4.67 is discounted hard for smoke tier and selection to an assumed true Δ ≈ 1.0–1.5. **n = 20/arm pooled** (10 repeats per arm per world); exact one-sided 0.05 criterion **U ≤ 138 at 20/20** (of 400; null midpoint 200). Power statement: good power only for ~1.5-turn-plus true separations under this imputation structure; a smaller true effect will likely return direction-without-power, and per §5.12.6 that outcome CLOSES the question at this dose/model pair — it does not license a further draw.

## Arms, worlds, seeds, backend

A `baseline` vs B `register-router` (bare `--register-router` — the real sensor, no mock knobs). Stack identical (both arms): `--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '{"seed":<per-repeat>,"rate":0.08,"mutateShare":0.25,"maxConcurrent":1}'`. Worlds `world-005-marrick` + `world-019-marrick-resistant` (the screened pair; the Phase-A audit pooled both). 10 repeats per arm per world, pair-interleaved, decay seeds **433, 439, 443, 449, 457, 461, 463, 467, 479, 487** (fresh primes, disjoint from every prior matrix, probe, screen, and smoke). 40 runs, n = 20/arm pooled. `DERIVATION_PROVIDER=claude DERIVATION_MODEL=sonnet`, concurrency 3, world blocks sequential with a checkpoint; trimmed same-label resume; hang > 40 min → kill + one same-label retry; >2 parse-death exclusions void; floor-blind rule retained verbatim from the promotion pre-registration.

## Endpoints and promotion bar

`T*` = `assertedGroundedTurn`, cap+1 = 29 imputed (both caps 28; the frozen `--design register-router` extractor, RR contrast).

1. Direction: mean T\* lower in the router arm in each non-floored stratum.
2. Pooled one-sided Mann–Whitney **U ≤ 138 at 20/20** (exact one-sided 0.05).
3. Guardrails clean: leaks 0; releases ≥ baseline − 0.5 per world; aporia-like ≤ baseline + 1 per world; guard overrides 0; router fires all evidenced (0 unevidenced); register_shift events consistent with decisions (0 mismatch); per-turn decisions logged in every router run.

**Named secondaries (descriptive, no promotion weight):** grounded rate; aporia-like; repair latency; fire counts by rule and turn (quoted); sensed-label distribution; confront-window availability (partnerDerivable turns — expected 0 on these worlds, recorded either way); per-world strata.

## Consequences

- **Confirmed:** the programme's first promotable mechanism at pre-registered tier — model-scoped (Sonnet), channel-scoped (stance register), with the sensor's accuracy documented (87.2% chain-level) and every routing decision replayable. The confront-window world and the codex mechanism check proceed on a validated base; §6.13 gains the result under a fresh operator gate.
- **Not confirmed:** the question closes at this dose/model pair (no third same-shape draw); the smoke records as an unreplicated directional observation; the confront-window and codex lines proceed as mechanism studies only.
- No re-rolls, no endpoint swaps, no post-hoc arms (§5.12.6).

## Artifacts

Specs `config/drama-derivation/matrix-specs/register-router-contrast-{marrick,marrick-resistant}.yaml`; runs `exports/dramatic-derivation/matrix/register-router-contrast-<world>/`; analysis via the frozen contrasts script's `register-router` design; report `exports/classifier-dag/contrast/`.

---

## Results addendum (2026-07-06; frozen analysis unmodified; report at `exports/classifier-dag/contrast/phase3-contrasts-report.{json,md}`)

**Execution.** 40/40 runs, claude CLI (Sonnet), world blocks sequential at concurrency 3, zero parse deaths. Three EXTERNAL stops disclosed: the block-1 launch job was stopped at 6/20 and again (its resume) at 12/20, and the block-2 launch was stopped at 0/20; each time the program stood down until the operator said resume, and recovery was by label-exact trimmed specs (the 12 pre-stop results were reused unmodified; three arms that died mid-run re-ran fresh under their own labels and seeds). No design, endpoint, or stack-code change at any point between freeze and completion.

**Promotion bar: NOT MET — all three bars fail.**

1. **Direction: FAIL in both strata.** Marrick: router 23.70 vs baseline 23.00 (against by 0.70). Marrick-resistant: router 24.40 vs baseline 24.20 (against by 0.20). Neither stratum floored (grounded 8–9/10 baseline, 8/10 router per world).
2. **Pooled Mann–Whitney: FAIL.** U = 238/400 against the ≤ 138 criterion — on the WRONG side of the null midpoint (200). Pooled T\* 24.05 vs 23.60, Δ = **+0.45 against the router**. The smoke's Δ = −4.67 at n = 3 did not shrink — it sign-flipped: the fifth and cleanest dissolution specimen in the §5.12.7 record (the motivating draw was the family's strongest color; the powered draw is a small negative).
3. **Guardrails: FAIL 8/9.** One breach: releases in marrick-resistant — router mean 8.00 vs baseline 9.00, below the −0.5 margin. Read with the clean instrumentation rows (fires all evidenced, register_shift events 0 mismatch, decisions logged 419/419 turns, leaks 0, overrides 0, aporia-like within margin both worlds), this is a real behavioral trace of the register itself: the repair stance's "consolidate, do not advance" instruction measurably slowed the exhibit calendar in the harder world. The tutor obeyed the register; obeying it cost staging without buying outcomes.

**Recorded verdict (as pre-committed): NOT CONFIRMED — the question closes at this dose/model pair.** No third same-shape draw; the smoke records as an unreplicated directional observation; the confront-window and codex lines proceed as mechanism studies only.

**Named secondaries (descriptive, equal prominence):**

- **Fires: 15 repair fires across 12 of 20 router runs** (marrick 4, resistant 11 — the harder world fired more, as designed), every one evidenced (sensed label = a regressed chain at fire time; 0 unevidenced). Fire turns cluster at the mid-drama decay onset (t11–t16) with a late tail (t20–t25). CONFRONT: zero fires, exactly as the freeze anticipated — partnerDerivable on 8 of 419 router turns (1.9%; the S-derivability tail of finished dramas), and mirror-residual sensed on only 19/419 turns (4.5%); the conjunction never landed.
- **Sensed-label distribution (419 router turns):** alpha chain 229 (54.7%), beta chain 115 (27.4%), neither 56 (13.4%), mirror-residual 19 (4.5%) — learner talk is chain-dense at the frontier, replicating the smoke's distribution at scale.
- **Outcome secondaries:** grounded 16/20 vs 16/20 (identical); aporia-like 4 vs 4 (identical); repair latency 11.18 vs 11.75 (Δ −0.57 toward the router, noise-level). The mechanism changed WHEN the tutor consolidated, not whether the drama landed.
- **The §5.12.7 pattern, fifth specimen:** smoke n=3 Δ −4.67 (3/3 vs 1/3 grounded) → powered n=20 Δ +0.45 (16/20 vs 16/20). Both baseline cap-deaths in the smoke drew from the same seeds that produced 4 baseline cap-deaths in 20 here — the smoke's baseline arm was a cold draw, exactly the decomposition the audit found for the lemma-display pair.
