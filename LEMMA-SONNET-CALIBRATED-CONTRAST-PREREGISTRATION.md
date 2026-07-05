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
