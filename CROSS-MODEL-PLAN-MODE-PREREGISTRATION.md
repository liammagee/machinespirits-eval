# Cross-Model Plan-Mode Interaction — Pre-registration

**Status:** **FROZEN 2026-07-04 at this commit** (operator go for the whole pipeline); analysis script and specs zero-paid validated before this freeze (mock null: interaction 0, U=72, bar correctly NOT MET). No design, endpoint, or analysis change past this point.
**Question (one, interaction-primary):** does the plan-mode stock-take help a **weaker inner loop more than a stronger one**? The operator's ceiling hypothesis: codex-class models re-plan implicitly every turn, ceiling-ing outer-loop effects; a weaker but format-reliable model should benefit more.
**Motivating data (declared):** the closed plan-mode contrast on codex (direction without power, no negative transfer) and the 4-run gemini-flash smoke (plan-mode 2/2 grounded vs baseline 1/2 on the same seeds where codex went 0/2 vs 1/2; per-seed outcome inversions between models). This design tests the interaction those data suggest.

## Data: one reused arm, one new arm (declared plainly)

- **Codex cells: REUSED, whole and unselected** — the complete 24-run plan-mode matrix (`exports/dramatic-derivation/matrix/ledger-plan-mode-{hethel-resistant,marrick}`), run 2026-07-04 under `PLAN-MODE-STOCKTAKE-PREREGISTRATION.md` with identical conditions, worlds, and seeds. It predates this pre-registration and helped motivate it; reusing it whole (no subset, no selection) is declared as such, which makes this design **confirmatory for the flash arm and the interaction**, replication-plus-extension in tier.
- **Flash cells: NEW** — 24 runs, `openrouter`/`gemini-flash`, same two worlds, same binding stack, same seed-pair design (seeds 31/37/41/43/47/53 shared within pairs), labels `baseline-rN` / `plan-mode-rN`.
- **Preview declaration:** the 4-run flash smoke previewed seeds 31 and 37 (one pair per seed on hethel-resistant). Smoke runs are design probes and never enter contrast data; the new flash runs at those seeds are fresh draws, and a **sensitivity read excluding seeds 31/37** is pre-registered as a secondary check.

## Binding conditions (identical to both parent matrices, all cells)

`--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '{"seed":<per-repeat>,"rate":0.35,"mutateShare":0.5,"maxConcurrent":3}'`; plan-mode arm adds `--strategy-ledger '{"planMode":true}'`. Turn-watch superego OFF everywhere.

## Primary endpoint and promotion bar

Per cell: `T*` = `assertedGroundedTurn`, cap+1 imputed (hethel-resistant 26, marrick 28). For each (model, world, seed): the **pair difference** `Δ = T*(plan-mode) − T*(baseline)` — pair-differencing on shared seeds removes the decay-schedule effect. 12 Δ per model.

**Promotion bar (all three required):**

1. **Interaction direction in BOTH worlds:** mean Δ(flash) < mean Δ(codex) within each world's stratum.
2. **Pooled one-sided Mann–Whitney on the pair differences** (flash Δ vs codex Δ, flash lower): U ≤ 42 at 12/12 (exact one-sided 0.05 criterion; the p calculation shown in the addendum).
3. **Flash-arm validity:** instrument gate (all 24 flash runs complete and parseable — flash is format-proven, but any parse-death excludes per the standing retry rule and >2 exclusions void the matrix); guardrails clean on the flash plan-mode arm (leaks 0; releases ≥ baseline − 0.5 per world; aporia-like ≤ baseline + 1 per world; guard overrides 0; stock-take coverage ≥ 0.8).

**Secondary (descriptive, no promotion weight):** the grounded-rate interaction; the seeds-31/37-excluded sensitivity read (10 Δ per model); stock-take usage by model (corrections demanded/answered per run — the smoke showed flash demanding 5–6/run vs codex's sparse rate); per-model arm contrasts.

## Execution (maximal sensible parallelism)

Flash is dollar-metered, not quota-windowed, so **both world blocks run simultaneously**, each at concurrency 3 (six concurrent runs), pair-interleaved arm order within each block. Projected: ≈ $3.30 (probed $0.137/run mean), ≈ 20–30 min wall-clock. The codex arm requires zero compute (reused). Interruptions resume via trimmed same-label specs; if the account balance exhausts mid-matrix, runs fail visibly and resume after top-up (balance at freeze: $4.76). Analysis: a dedicated script (`scripts/analyze-cross-model-interaction.js`), written and zero-paid-validated BEFORE the freeze, unmodified after the first paid run.

## Outcomes and recorded consequences

- **Confirmed:** the ceiling hypothesis is supported at pre-registered tier — outer-loop value depends on inner-loop strength, and the §6.13.16 story gains a model-scope coda (the line's nulls are claims about strong inner loops, not about outer loops as such). Any further build-out (a powered flash-primary plan-mode contrast, adapter work for weaker models) is a separate operator decision.
- **Not confirmed:** the model-confound question closes for this stack; the flash smoke stands recorded as an unreplicated directional anomaly; §6.13.16's closure reads unchanged.
- No re-rolls, no endpoint swaps, no post-hoc cells (§5.12.6).

## Artifacts

Flash specs `config/drama-derivation/matrix-specs/flash-plan-mode-{hethel-resistant,marrick}.yaml`; runs `exports/dramatic-derivation/matrix/flash-plan-mode-<world>/`; report `exports/dramatic-derivation/strategy-ledger/cross-model/cross-model-interaction-report.{json,md}`.

---

## Results addendum (2026-07-04; frozen analysis unmodified; report at `exports/dramatic-derivation/strategy-ledger/cross-model/cross-model-interaction-report.{json,md}`)

**Execution.** 24/24 flash runs, both world blocks genuinely parallel at concurrency 3 (six concurrent dramas), zero interruptions, ~9 min wall-clock, ≈ $3.12 total (hethel ≈ $1.72, marrick ≈ $1.40 — within the $3.30 projection). Codex arm reused whole as declared, zero compute.

**Promotion bar: NOT MET — all three components fail, and the interaction points the OPPOSITE way from the ceiling hypothesis.**

1. **Interaction direction: FAIL in both worlds.** Mean Δ(flash) is *higher* (worse) than mean Δ(codex) in each stratum: hethel-resistant +2.17 vs −1.00; marrick 0.00 vs −2.00. Plan-mode helped the strong inner loop directionally and *hurt* the weak one.
2. **Pooled Mann–Whitney: FAIL.** U_low = 96/144 against the ≤ 42 criterion — not merely underpowered but on the wrong side of the null (72).
3. **Flash-arm validity: FAIL on one guardrail.** Instrument gate clean (24/24 parseable — flash is format-proven), leaks 0, overrides 0, releases at parity, stock-take coverage 1.00; but hethel plan-mode aporia-like 5 vs baseline 3 exceeds the +1 allowance — **negative transfer on flash**, the very channel the codex plan-mode arm kept clean (0/6 there).

**Recorded verdict (as pre-committed): NOT CONFIRMED — the model-confound question closes for this stack.** The flash smoke stands recorded as an unreplicated directional anomaly, and §6.13.16's closure reads unchanged. Worse for the hypothesis than a mere null: on this stack the outer loop's marginal value *decreases* as the inner loop weakens.

**Descriptive record (no promotion weight):**

- **The smoke inverted on fresh samples at its own seeds.** The 4-run smoke's plan-mode 2/2 grounded (seeds 31/37, hethel) came back 0/2 in the matrix at the same seeds — same decay schedules (seed-pinned), new model samples. Pure sampling variance at n=2/arm; the read-rule that licensed only *proposing* this test (never claiming from it) did its job.
- **Grounded-rate interaction, same reversal:** flash ΔGrounded −0.17 (plan-mode grounds less: hethel 1/6 vs 3/6) vs codex +0.25. Flash never grounds marrick in either arm (0/12) — marrick pair-deltas are ties at cap+1, so the hethel stratum carries the test, as the pooled-U design absorbs.
- **The weak model uses the second voice heavily and it does not help:** flash demanded 5.25 corrections/run (5.08 answered) vs codex's 1.25 — a 4× reorientation rate coinciding with directionally worse outcomes. The stock-take mechanism itself stayed flawless on both models (coverage 1.00); the *answers* it elicits from a weaker ego appear to be churn, not course-correction.
- Sensitivity read excluding previewed seeds 31/37 (pre-registered): flash +0.88 vs codex −3.13 — the reversal is not an artifact of the previewed pairs.
- What this licenses: the §6.13.16 line-closure now carries a **two-model** scope note instead of a one-model caveat — the outer-loop nulls are not an artifact of a too-strong inner loop; if anything, outer-loop machinery *presupposes* a competent inner loop rather than compensating for a weak one (consistent with the arc's scaffolds-reallocate-not-add lesson and with the GLM instrument result: protocol compliance itself is capacity).
