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
