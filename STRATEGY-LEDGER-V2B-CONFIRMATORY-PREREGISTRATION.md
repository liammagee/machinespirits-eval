# Strategy Ledger V2b — Confirmatory Replication Pre-registration

**Status:** **FROZEN 2026-07-03 at this commit** (operator go received); no design, endpoint, or analysis change past this point — the zero-paid validation and its two applicability fixes predate the freeze. Step 1 of `workplan/items/strategy-ledger-followups.md` — **everything else on that card waits on this result**.
**Tier:** pre-registered **confirmatory** for one primary endpoint. Success upgrades §6.13.16's V2b claim from pilot to confirmed-at-n=12; failure-to-replicate is recorded with equal prominence and closes the line.
**Pilot being confirmed:** `STRATEGY-LEDGER-V2-PREREGISTRATION.md` V2b — the v1 commit/audit ledger improved repair latency under binding conditions (8.06 vs 11.23 turns, both worlds, U = 8/36 at n = 6/arm; 61% vs 50% of slips repaired; guardrails clean).

## Question (one, confirmatory)

Does the v1 strategy ledger (`--strategy-ledger '{"registerPalette":["modern"]}'` — held scene commitments, deterministic scene-close audits binding the next opening; NO trialling, NO stance palette, NO release intent) reduce **repair latency** relative to no ledger, under the pilot-validated binding conditions, at n = 12/arm?

## Arms (two — the trialling arm is deliberately absent per the pilot's V2a result)

| Arm | Label | Delta |
|---|---|---|
| A | `baseline` | — |
| B | `ledger-v1` | `--strategy-ledger '{"registerPalette":["modern"]}'` |

Binding base (identical to the pilot, both arms): `--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '<seed varies by repeat, see below>'`. Superego OFF, critic OFF, no acts.

## Worlds, repeats, and the one deliberate delta from the pilot

- `world-010-hethel-resistant` + `tutor-scripts/hethel-v001.md`
- `world-005-marrick` + `tutor-scripts/marrick-v001.md`
- **6 repeats per arm per world** → 24 runs, **n = 12/arm pooled**, interleaved (r1 both arms, r2 …) so interruption keeps arms balanced.
- **Decay seed varies by repeat and is SHARED within a repeat pair** — the one design improvement over the pilot (which fixed seed 11 throughout): repeats r1–r6 use seeds **11, 13, 17, 19, 23, 29** respectively, identical for both arms of the same repeat. This removes seed-specific-schedule artifacts and makes each repeat a matched pair on decay potential. The frozen analysis remains the unpaired pre-registered test; any paired re-analysis is post-hoc and labeled as such.
- **No new headroom gate.** The pilot's 18 runs under these exact conditions are the precondition evidence (T\* ranged over {never, cap, cap−k}; failures occurred; repair traffic in every run).

## Backend

`DERIVATION_PROVIDER=codex`, all roles, CLI default model (recorded from the first run's diagnosis; must match the pilot's recorded model family — if the codex default has changed since the pilot, record the change and proceed; the contrast is within-run-set). Serialized; two attended world-blocks (~2.5 h each); hang > 40 min → kill, re-run once under the same label; two failures exclude the label (reported).

## Endpoints

- **PRIMARY (sole confirmatory endpoint): repair latency** — mean turns from each decay slip to the first repair/re-adoption of that premise, cap+1 imputed when never repaired (the frozen `analyze-strategy-ledger-contrasts.js` extractor, unmodified).
- **Promotion bar (all three required):**
  1. Direction consistent in BOTH worlds (ledger-v1 lower in each world's stratum);
  2. Pooled one-sided Mann–Whitney U, p < 0.05 at n = 12/12 (computed from the frozen script's U; the one-sided exact criterion at 12/12 is U ≤ 42);
  3. All guardrails clean in the ledger arm (leaks 0; releases ≥ baseline − 0.5 per world; aporia ≤ baseline + 1 per world; commitment coverage ≥ 0.8; guard overrides 0).
- **Secondary (descriptive only, no promotion weight):** T\*, grounded rate, aporia-like rate, repair share (repairs/decays), mode-flap rate, audit kept/drift mix.
- Analysis: the frozen `--design v2` tables read the two-arm matrix as-is (V2b is the only populated contrast; V2a/V2c rows sit empty). No analysis-script changes after the first paid run; the pooled one-sided p-value for the promotion bar is computed from the reported U by exact/normal approximation in the results addendum, shown with the calculation.

## Outcomes and their recorded consequences

- **Confirmed** (all three bars met): §6.13.16 gains a one-paragraph confirmatory upgrade (new revision entry; claim stays conduct-only, this engine, simulated learners); step 2 of the follow-ups card (composition-module registration) unlocks.
- **Not confirmed** (any bar missed): recorded in §6.13.16 with equal prominence as a failure-to-replicate at n=12; steps 2–4 of the card close; the pilot signal stands as pilot-only, permanently.
- No intermediate re-rolls, no endpoint swaps, no post-hoc arm additions (§5.12.6 discipline).

## Artifacts

- Spec: `config/drama-derivation/matrix-specs/ledger-v2b-confirm-{hethel-resistant,marrick}.yaml`
- Runs: `exports/dramatic-derivation/matrix/ledger-v2b-confirm-<world>/<arm>/`
- Report: `exports/dramatic-derivation/strategy-ledger/v2b-confirmatory-report.{json,md}` (frozen script, `--design v2`, `--out` stem noted in the addendum)
- Zero-paid validation before the paid matrix: both specs run end-to-end in mock mode through the frozen analysis.

---

## Results addendum (2026-07-04; frozen analysis unmodified; report at `exports/dramatic-derivation/strategy-ledger/v2b-confirm/v2-contrasts-report.{json,md}` — the frozen script's fixed stem inside the pre-declared directory)

**Execution.** 24/24 runs (two operator interruptions; both resumes used trimmed specs re-running only incomplete labels under their own names, per the retry rule — arms stayed seed-pair balanced throughout). Backend: codex CLI default, matching the pilot.

**Promotion bar: NOT MET (bars 1–2 pass; bar 3 fails).**

1. **Direction both worlds: PASS.** Repair latency lower in the ledger arm in each world's stratum ([-1, -1]).
2. **Pooled one-sided Mann–Whitney: PASS.** U = 37.5 ≤ 42 (exact one-sided 0.05 criterion at 12/12); normal approximation z = (37.5 − 72)/√300 = −1.99, one-sided p ≈ 0.023. Point estimate 8.02 vs 9.24 turns (Δ ≈ −1.21; smaller than the pilot's −3.17, as regression toward the mean predicts).
3. **Ledger-arm guardrails: FAIL.** `aporia-hethel-resistant-ledger-v1` (4 aporia-like verdicts vs baseline 2; limit baseline+1) and `releases-marrick-ledger-v1` (mean releases 7.00 vs 7.67; limit baseline−0.5).

**The guardrail failure is not noise — the secondary endpoints give it three pre-registered-magnitude signals of its own, all consistent in both worlds:** grounded rate 0.25 vs 0.50 (halved), time-to-recognition 27.17 vs 25.58 (worse), aporia-like rate 0.75 vs 0.50 (worse). At n = 6 the pilot's guardrails were clean by small-n luck; at n = 12 the picture is a genuine trade: the commit/audit loop reliably speeds the repair of slipped premises *and* reliably costs dramatic outcomes — more stalls and disengagements, fewer grounded recognitions, slower ones when they come.

**Recorded consequences (as pre-committed):** V2b is **not confirmed**; §6.13.16 records the replicated-mechanism-with-negative-transfer result with equal prominence; steps 2–4 of `strategy-ledger-followups` close permanently (no composition-module registration, no localization, no D2). The pilot signal stands as pilot-only. This is §6.13.15's promotion discipline reproducing its own precedent one layer up: a conduct overlay that is locally compliant — locally *helpful*, here — can still carry negative transfer, and the artifact pool again contains no strategy overlay that beats the kernel without it.
