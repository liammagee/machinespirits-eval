# Lemma-Display Confirmatory Contrast — Pre-registration

**Status:** **FROZEN 2026-07-04 at this commit** (operator sanctioned: "Good, do it"; this commit launches the paid matrix). Pre-freeze completed and disclosed: the `lemma-display` analysis design entry and both matrix specs were written and zero-paid validated on a mock null (all deltas 0.00, guardrails computing, display arm binding-event-free) BEFORE this freeze. No design, endpoint, or analysis change past this commit.
**Line:** `workplan/items/proof-lemma-layer.md`; parent document `LEMMA-LAYER-PREREGISTRATION.md` (frozen 6c26c21f, verdict recorded).
**Question (one, confirmatory):** does the **lemma map as pure prompt information** — the chainer-computed, learner-board-anchored map of intermediate conclusions, shown to tutor and (mirrored, concealment-strict) learner, binding NOTHING — improve dialogue outcomes over the identical stack without it?

## Motivating data (declared plainly)

The parent contrast's display arm, **declared descriptive at that freeze and not promoted from it**: T\* 26.33 vs 28.58 (lower both worlds, U = 40.5/144), grounded 6/12 vs 1/12, aporia-like 0.42 vs 0.92, zero binding events. This design re-tests that exact effect on fresh seeds at pre-registered tier. The redundancy prediction (stall-watcher precedent: derivable information is worthless to a strong model) failed on that draw; the mechanism reading being confirmed is **externalized bookkeeping, not externalized judgment** — the map carries decay-adjusted closure state of the LEARNER's board, which the tutor tracks badly over 20+ turns.

## Arms (two)

| Arm | Label | Delta |
|---|---|---|
| A | `baseline` | binding stack only |
| B | `lemma-display` | + `--lemma-layer '{"display":true}'` (map as information; no frontier choice, no release gating, no scene-exit wiring) |

Binding base (identical, both arms): `--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '<per-repeat seeds>'`. Turn-watch superego OFF; strategy-ledger OFF; no bound arm (the parent run's instrument finding about label matching is moot here — display has no choice channel).

## Worlds, repeats, seeds, backend

`world-005-marrick` + `world-019-marrick-resistant` (both screened for headroom; same pair as the parent contrast). 6 repeats per arm per world, pair-interleaved (`baseline-rN`, `lemma-display-rN`), decay seeds **101, 103, 107, 109, 113, 127** shared within pairs — fresh primes, disjoint from every prior matrix and probe in the arc (11–29, 31–53, 59–79, 83–97 all used). 24 runs, n = 12/arm pooled. Backend `DERIVATION_PROVIDER=codex`, concurrency 3 within world blocks, blocks sequential with a checkpoint; interruptions resume via trimmed same-label specs; hang > 40 min → kill, one same-label retry; two failures exclude the pair (reported).

## Endpoints and promotion bar

Per run: `T*` = `assertedGroundedTurn`, cap+1 = 29 imputed (both worlds cap 28; the frozen extractor, `--design lemma-display`).

**Promotion bar (all three, display-vs-baseline pooled 12v12):**

1. **Direction both worlds:** mean T\* lower in the display arm within each world's stratum.
2. **Pooled one-sided Mann–Whitney U ≤ 42** at 12/12 (exact one-sided 0.05; the parent draw gave U = 40.5 — the bar is set exactly where the motivating data would clear it, declared as such).
3. **Guardrails clean in the display arm:** leaks 0; releases ≥ baseline − 0.5 per world; aporia-like ≤ baseline + 1 per world; guard overrides 0; zero binding events (the arm stays pure information).

**Secondary (descriptive, no promotion weight):** grounded rate (the parent draw's largest margin, 6/12 vs 1/12); aporia-like rate; repair latency (the arc's standing cross-check); per-world strata; mean turns played (the survival channel).

## Outcomes and recorded consequences

- **Confirmed:** the arc's first positive mechanism at pre-registered tier. §6.13 gains the result and its law-refinement — *constraint layers reallocate capacity; an information layer that externalizes closure bookkeeping adds it* — with the parent contrast disclosed as the exploratory draw and this as the confirmation. Scaling/mechanism-localization follow-ups (which map section carries the effect; learner-mirror-only ablation) may be pre-registered afterward.
- **Not confirmed:** the display signal records as an unreplicated exploratory observation alongside the parent verdict; the lemma-layer line closes whole (binding non-promotable, information unconfirmed); the implementation and Gate-0 instruments remain in the toolbox; no third draw without a fresh operator decision.
- No re-rolls, no endpoint swaps, no post-hoc arms (§5.12.6).

## Artifacts

Specs `config/drama-derivation/matrix-specs/lemma-display-{marrick,marrick-resistant}.yaml`; mock validation spec + run pre-freeze; runs `exports/dramatic-derivation/matrix/lemma-display-<world>/`; analysis via the frozen contrasts script's `lemma-display` design entry (added + zero-paid validated BEFORE the freeze); report `exports/dramatic-derivation/lemma-layer/display-confirmatory/`.
