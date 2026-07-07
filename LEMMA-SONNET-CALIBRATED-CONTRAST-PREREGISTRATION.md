# Lemma-Map Sonnet Contrast at the Calibrated Dose — Pre-registration

**Status:** **FROZEN 2026-07-05 at this commit** (operator: "Keep going" at the calibration gate; this commit launches the matrix). Pre-freeze completed: specs written; zero-paid re-validation through the frozen `lemma-display` analysis design clean (12-run mock matrix, guardrails computing). No design, endpoint, or analysis change past this commit.
**Line:** `workplan/items/lemma-sonnet-calibrated-contrast.md`; parents: the void first attempt (`LEMMA-SONNET-CONTRAST-PREREGISTRATION.md`, floor-blind at dose 0.35) and the calibration (`workplan/items/sonnet-calibrated-worlds.md`, band found at dose 0.08).
**Question (one, model-scoped, unchanged):** does the lemma map as pure prompt information improve dialogue outcomes on a mid-tier inner loop (Sonnet), now measured at a dose where the question is answerable?

## Motivating data (declared plainly, with its weight stated)

There is **no display-arm data at this dose on this model** — the calibration screens ran baselines only, and the earlier Sonnet smoke ran at dose 0.35 (where the powered attempt subsequently voided; its seed-101 grounding did not recur and carries no weight). The design's motivation is therefore mechanistic, not empirical: the calibration showed Sonnet's failure mode at this dose is **decay-repair collapse** (dose-response: none = 3/3 grounded; 0.08 = band; 0.15 = 0/3; 0.35 = 0/12 — a shelf, not a slope), and decay-adjusted closure state is precisely the content the lemma map externalizes. This is the cleanest motivational posture the arc has had: a capability gap measured first, an artifact aimed at it second, no exploratory point estimate to anchor on. The shrinkage warnings recorded in the parent documents apply regardless.

## Bar-calibration note (carried forward)

U ≤ 42 at 12/12 is the exact one-sided 0.05 criterion. Power statement, pre-registered: good power only for large effects (a 2-turn-plus mean T\* separation under imputation); direction-without-power CLOSES the mid-tier question — no third dose, no endpoint swap, no fresh draw without a new operator decision. No prediction of confirmation is recorded.

## Arms (two)

| Arm | Label | Delta |
|---|---|---|
| A | `baseline` | calibrated stack only |
| B | `lemma-display` | + `--lemma-layer '{"display":true}'` (map as information; zero binding) |

Calibrated stack (identical, both arms): `--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '{"seed":<per-repeat>,"rate":0.08,"mutateShare":0.25,"maxConcurrent":1}'`. Backend `DERIVATION_PROVIDER=claude`, `DERIVATION_MODEL=sonnet` (CLI quota; format-proven, ~1,600 clean calls in the void attempt). Turn-watch superego OFF; strategy-ledger OFF.

## Worlds, repeats, seeds

`world-005-marrick` + `world-019-marrick-resistant` — both band-screened at this exact dose (marrick 1/3 grounded with spread; resistant 2/3). 6 repeats per arm per world, pair-interleaved, decay seeds **179, 181, 191, 193, 197, 199** (fresh primes, disjoint from every matrix, probe, screen, and smoke in the arc; the calibration's 163/167/173 are excluded as previewed). 24 runs, n = 12/arm pooled. Concurrency 3, world blocks sequential with a checkpoint; trimmed same-label resume on interruption; hang > 40 min → kill + one retry; two failures exclude the pair; >2 parse-death exclusions void. The floor-blind rule is retained verbatim from the parent (a stratum with all runs imputed at cap+1 = 29 is reported floor-blind; both floored voids) — the band screens make this unlikely but the rule stands.

## Endpoints and promotion bar

Per run: `T*` = `assertedGroundedTurn`, cap+1 = 29 imputed (caps 28; the frozen `--design lemma-display` extractor).

**Promotion bar (all three, display-vs-baseline pooled 12v12):**

1. Direction: mean T\* lower in the display arm in each non-floored stratum.
2. Pooled one-sided Mann–Whitney U ≤ 42 at 12/12.
3. Guardrails clean in the display arm: leaks 0; releases ≥ baseline − 0.5 per world; aporia-like ≤ baseline + 1 per world; guard overrides 0; zero binding events.

**Secondary (descriptive):** grounded rate; aporia-like rate (named — twice-replicated on codex); repair latency and **repair counts** (the mechanism channel at this dose: if the map works here, it should show in decay-repair behavior); mean turns; per-world strata.

## Outcomes and recorded consequences

- **Confirmed:** the lemma map is a validated mechanism for mid-tier inner loops at pre-registered tier, at the dose where mid-tier failure is decay-borne — the bookkeeping-vs-judgment law gains its capability threshold with both halves pre-registered (frontier: redundant, §6.13.17; mid-tier: additive, this document). §6.13.17 gains the coda; a Haiku-tier probe and map-section localization become proposable.
- **Not confirmed:** the mid-tier question closes MEASURED (unlike the void): the map does not rescue mid-tier decay-repair even where that is the binding failure mode; the lemma-layer line's closure extends to two model tiers; the calibration and dose-response stand as reusable instruments.
- No re-rolls, no endpoint swaps, no post-hoc arms (§5.12.6).

## Artifacts

Specs `config/drama-derivation/matrix-specs/sonnet-cal-display-{marrick,marrick-resistant}.yaml`; zero-paid validation pre-freeze; runs `exports/dramatic-derivation/matrix/sonnet-cal-display-<world>/`; analysis via the frozen `lemma-display` design; report `exports/dramatic-derivation/lemma-layer/sonnet-calibrated-contrast/`.

---

## Results addendum (2026-07-05; frozen analysis unmodified; report at `exports/dramatic-derivation/lemma-layer/sonnet-calibrated-contrast/phase3-contrasts-report.{json,md}`)

**Execution.** 24/24 runs, claude CLI (sonnet), blocks sequential at concurrency 3 (~80 min), zero interruptions, zero parse failures. The calibration held: 17/24 runs grounded overall — the dose produced a genuinely informative regime (no floor, no ceiling) on both worlds.

**Promotion bar: NOT MET — bars 1 and 2 fail; bar 3 passes 9/9.**

1. **Direction: FAIL, split strata.** Marrick: display 23.17 vs baseline 25.83 (display, clearly — 5/6 grounded all at exactly T\* = 22 vs 3/6 scattered). Marrick-resistant: display 24.83 vs baseline 23.33 (baseline — display dropped two dramas the baseline held). Per-world [-1, +1].
2. **Pooled Mann–Whitney: FAIL.** U = 65/144 vs ≤ 42; pooled T\* 24.00 vs 24.58 (Δ = −0.58).
3. **Guardrails: PASS 9/9** — zero binding events, releases at parity or better, marrick aporia actually improved (1 vs 3).

**Recorded verdict (as pre-committed): NOT CONFIRMED — and the mid-tier question closes MEASURED.** Unlike the voided first attempt, this is a real answer: at the dose where Sonnet's failure is specifically decay-repair, the lemma map as pure information does not reliably rescue it. The lemma-layer closure now spans two model tiers with both halves measured (frontier: redundant; mid-tier: not reliably additive), and the whole-line law survives its strongest test yet — an artifact aimed by a measured capability gap at exactly the content it externalizes still could not clear a pre-registered outcome bar.

**Descriptive record:**

- **The split mirrors the codex display confirmatory almost exactly** (that run: direction [-1, +1], display winning marrick and losing the resistant stratum). Two models, two independent seed draws, same shape: the map leans helpful on plain marrick and unhelpful on the resistant variant. If anything in this line deserves a future look, it is this world × map interaction — the resistant learner's push-back may interact badly with a tutor that trusts the map's "already established" entries (speculative; recorded as color only).
- Marrick display's five wins all at exactly T\* = 22 (the schedule-optimal turn) vs baseline's scatter — on the world where the map helped, it helped by *tightening* execution to the calendar, consistent with the bookkeeping reading.
- Repair latency worsened slightly in the display arm (13.56 vs 11.92) — the map does not speed repairs; where it helps it seems to prevent the *need* for late repairs (marrick aporia 1 vs 3).
- The dose-calibration methodology itself is the durable product: the band rule + dose ladder took a void, unmeasurable question to a measured answer for ~12 screen runs of quota.

**Consequences (per the freeze):** the mid-tier question closes measured; the lemma-layer line's closure extends to two tiers; the calibration and dose-response stand as reusable instruments; no further lemma draws at any tier without a fresh operator decision.
