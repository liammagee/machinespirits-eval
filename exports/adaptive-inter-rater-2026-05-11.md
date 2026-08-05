# Adaptive grader — inter-rater reliability (judge 1 vs judge 2)

- **Generated:** 2026-05-11T15:15:23.540Z
- **Judge 1 (original, in DB):** `codex-cli.default` (GPT-5), grader v1.0
- **Judge 2 (this pass, file):** `gemini-cli.default`, grader v1.0
- **Rows paired (both judges, all 4 dims):** 87 / 87
- **Prompt:** identical for both judges (`scripts/lib/adaptiveGraderPrompt.js`)

> Context: `docs/explorations/claude/p22-p23-parking-note.md` §"Engineering vs noise" flags single-judge + non-blind rubric as the two biggest threats to the cell_118 > cell_119 > cell_110 result. This is the inter-rater check that section recommends as the highest-ROI validation move.

## Headline

- **Cell ranking on graded overall — judge 1:** cell_118 (minimal)  >  cell_119 (no_misc)  >  cell_110 (full state)
- **Cell ranking on graded overall — judge 2:** cell_118 (minimal)  >  cell_119 (no_misc)  >  cell_110 (full state)
- **Identical ordering?** YES. **cell_118 top under both judges?** YES.
- **Cell ranking on strategy_execution — judge 1:** cell_110 (full state)  >  cell_118 (minimal)  >  cell_119 (no_misc)
- **Cell ranking on strategy_execution — judge 2:** cell_118 (minimal)  >  cell_119 (no_misc)  >  cell_110 (full state)
- **Pooled agreement (4 dims × 87 rows = 348 obs):** Pearson r=0.436, Spearman ρ=0.421, quadratic-weighted κ=0.349 (fair), exact-match 42.8%, within-1 90.5%.
- **Judge-2 leniency vs judge-1 (pooled mean signed Δ):** +0.563 points on the 1–5 scale (mean |Δ| = 0.701).

## Per-dimension agreement

| Dimension | n | j1 mean | j2 mean | Pearson r | Spearman ρ | QW κ | exact % | within-1 % | mean Δ (j2−j1) | mean \|Δ\| |
|---|---|---|---|---|---|---|---|---|---|---|
| trigger_recognition | 87 | 4.23 | 4.78 | 0.445 | 0.435 | 0.347 | 54.0 | 87.4 | +0.55 | 0.62 |
| strategy_execution | 87 | 4.10 | 4.71 | 0.406 | 0.391 | 0.329 | 50.6 | 85.1 | +0.61 | 0.75 |
| strategy_quality | 87 | 4.23 | 4.74 | 0.393 | 0.393 | 0.287 | 34.5 | 96.6 | +0.51 | 0.69 |
| pedagogical_coherence | 87 | 4.07 | 4.66 | 0.560 | 0.515 | 0.413 | 32.2 | 93.1 | +0.59 | 0.75 |
| overall | 87 | 4.16 | 4.72 | 0.479 | 0.502 | — | — | — | +0.56 | 0.68 |
| **pooled (4 dims)** | 348 | — | — | 0.436 | 0.421 | 0.349 | 42.8 | 90.5 | +0.56 | 0.70 |

## Per-cell means: judge 1 vs judge 2

| Cell | n | metric | j1 | j2 | Δ | j1 exec≤3 | j2 exec≤3 |
|---|---|---|---|---|---|---|---|
| cell_110 (full state) | 23 | trigger_recognition | 4.26 | 4.65 | +0.39 | 1/23 | 4/23 |
|  |  | strategy_execution | 4.30 | 4.57 | +0.26 |  |  |
|  |  | strategy_quality | 3.96 | 4.26 | +0.30 |  |  |
|  |  | pedagogical_coherence | 3.61 | 4.04 | +0.43 |  |  |
|  |  | overall | 4.03 | 4.38 | +0.35 |  |  |
| cell_118 (minimal) | 32 | trigger_recognition | 4.34 | 4.88 | +0.53 | 6/32 | 2/32 |
|  |  | strategy_execution | 4.28 | 4.78 | +0.50 |  |  |
|  |  | strategy_quality | 4.41 | 4.94 | +0.53 |  |  |
|  |  | pedagogical_coherence | 4.34 | 4.91 | +0.56 |  |  |
|  |  | overall | 4.34 | 4.88 | +0.53 |  |  |
| cell_119 (no_misc) | 32 | trigger_recognition | 4.09 | 4.78 | +0.69 | 11/32 | 2/32 |
|  |  | strategy_execution | 3.78 | 4.75 | +0.97 |  |  |
|  |  | strategy_quality | 4.25 | 4.88 | +0.63 |  |  |
|  |  | pedagogical_coherence | 4.13 | 4.84 | +0.72 |  |  |
|  |  | overall | 4.06 | 4.81 | +0.75 |  |  |

## Reading

1. **Does the headline survive a second judge?** The parking note's central claim is cell_118 (minimal state) > cell_119 (no_misc) > cell_110 (full state) on graded overall, with cell_119 carrying a heavy left tail on `strategy_execution`. If judge 2's orderings (above) match and cell_119 still has the most `exec≤3` rows, the result is not a single-judge artefact. If they diverge, the parking note's ~25% "engineering artefact" weight goes up.
2. **Agreement magnitude.** Quadratic-weighted κ in the 0.4–0.6 band = "moderate" (typical for LLM judges on 1–5 ordinal scales); >0.6 = "substantial". Pearson/Spearman track linear/rank concordance. Low κ but matching cell *rankings* still supports the comparative claim even if absolute levels disagree.
3. **Leniency.** A non-zero pooled mean signed Δ means one judge is systematically harsher — expected, and harmless for *within-judge* cell comparisons, which is what the parking note's claims rest on.
4. **What this does NOT fix.** The rubric itself (4 dims, chosen after the binary results were known) is the same for both judges, so this check addresses single-judge variance, not rubric-not-blind. Closing that needs a rubric authored before seeing results, or an externally-defined one — out of scope here.

---
Raw judge-2 scores: `exports/adaptive-grades-judge2-gemini.json`. Judge-1 snapshot: `exports/adaptive-grades-judge1-codex.json`. Re-run analysis only: `node scripts/rejudge-adaptive-inter-rater.js --analyze-only --judge-cli gemini`.
