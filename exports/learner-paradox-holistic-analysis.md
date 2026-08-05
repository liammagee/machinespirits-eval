# Learner Paradox — Convergent Validity Analysis

Generated: 2026-04-17T00:42:51.321Z
Cell min-n threshold: 5

Pairs are same-row rubric AND holistic scores across four learner architectures.
All scores in 0–100 range. Correlations are Pearson r on the paired vectors.

## Pooled across all runs

If the rubric-artifact account is correct, the holistic gap should be ≤ the rubric gap (because the holistic judge sees past what the rubric does not reward). If the capability-ceiling account is correct, the holistic gap should be as negative as (or more negative than) the rubric gap.

Paired rows: 1806

| Architecture | n | Rubric M (SD) | Holistic M (SD) | Rubric↔Holistic r |
|--------------|---|---------------|-----------------|-------------------|
| unified | 444 | 57.67 (16.54) | 55.54 (19.62) | 0.729 |
| ego_superego | 422 | 61.08 (16.00) | 62.16 (18.55) | 0.747 |
| unified_recognition | 458 | 63.61 (13.65) | 61.62 (18.24) | 0.771 |
| ego_superego_recognition | 482 | 62.95 (14.59) | 62.65 (17.19) | 0.704 |

| Contrast | n (ego_sup) | n (unified) | Rubric Δ | Holistic Δ | d (rubric) | d (holistic) |
|----------|-------------|-------------|----------|------------|------------|--------------|
| Base: ego_superego − unified | 422 | 444 | 3.41 | 6.62 | 0.209 | 0.346 |
| Recognition: ego_superego_recognition − unified_recognition | 482 | 458 | -0.66 | 1.03 | -0.046 | 0.058 |

| Cell | Architecture | n | Rubric M | Holistic M | Δ (H − R) |
|------|--------------|---|----------|------------|-----------|
| cell_1 | unified | 11 | 66.80 | 71.04 | 4.25 |
| cell_2 | ego_superego | 10 | 47.74 | 47.88 | 0.14 |
| cell_3 | unified | 6 | 68.93 | 77.50 | 8.57 |
| cell_4 | ego_superego | 6 | 48.11 | 60.83 | 12.72 |
| cell_5 | unified_recognition | 11 | 66.86 | 71.18 | 4.32 |
| cell_6 | ego_superego_recognition | 11 | 50.87 | 54.55 | 3.67 |
| cell_7 | unified_recognition | 6 | 69.55 | 74.17 | 4.62 |
| cell_8 | ego_superego_recognition | 14 | 42.85 | 52.77 | 9.92 |
| cell_72 | ego_superego | 6 | 45.44 | 49.17 | 3.72 |
| cell_73 | ego_superego_recognition | 6 | 52.48 | 46.46 | -6.02 |
| cell_74 | ego_superego | 6 | 45.85 | 49.17 | 3.31 |
| cell_75 | ego_superego_recognition | 6 | 52.83 | 48.96 | -3.88 |
| cell_76 | ego_superego | 6 | 52.64 | 49.58 | -3.06 |
| cell_77 | ego_superego_recognition | 6 | 45.25 | 45.21 | -0.04 |
| cell_80 | unified | 186 | 56.17 | 50.99 | -5.18 |
| cell_81 | ego_superego | 179 | 60.29 | 60.58 | 0.29 |
| cell_82 | unified | 216 | 57.54 | 56.32 | -1.22 |
| cell_83 | ego_superego | 209 | 63.89 | 65.34 | 1.45 |
| cell_84 | unified_recognition | 209 | 62.45 | 58.50 | -3.95 |
| cell_85 | ego_superego_recognition | 204 | 65.20 | 64.17 | -1.03 |
| cell_86 | unified_recognition | 189 | 64.80 | 62.85 | -1.94 |
| cell_87 | ego_superego_recognition | 190 | 67.64 | 65.68 | -1.96 |
| cell_88 | ego_superego_recognition | 21 | 47.52 | 60.80 | 13.28 |
| cell_89 | ego_superego_recognition | 22 | 47.51 | 49.70 | 2.19 |
| cell_90 | unified_recognition | 14 | 61.95 | 64.23 | 2.29 |

## Paradox run only (run_id = eval-2026-02-20-25c78e91)

This slice reproduces the d=3.05 contrast on cells 1–8 with same-row rubric AND holistic.

Paired rows: 47

| Architecture | n | Rubric M (SD) | Holistic M (SD) | Rubric↔Holistic r |
|--------------|---|---------------|-----------------|-------------------|
| unified | 12 | 69.22 (5.70) | 74.58 (10.97) | 0.199 |
| ego_superego | 11 | 45.89 (10.42) | 53.18 (20.03) | 0.436 |
| unified_recognition | 12 | 69.68 (5.58) | 75.00 (7.69) | 0.063 |
| ego_superego_recognition | 12 | 47.43 (8.45) | 63.33 (13.54) | 0.345 |

| Contrast | n (ego_sup) | n (unified) | Rubric Δ | Holistic Δ | d (rubric) | d (holistic) |
|----------|-------------|-------------|----------|------------|------------|--------------|
| Base: ego_superego − unified | 11 | 12 | -23.33 | -21.40 | -2.815 | -1.343 |
| Recognition: ego_superego_recognition − unified_recognition | 12 | 12 | -22.25 | -11.67 | -3.107 | -1.060 |

| Cell | Architecture | n | Rubric M | Holistic M | Δ (H − R) |
|------|--------------|---|----------|------------|-----------|
| cell_1 | unified | 6 | 69.52 | 71.67 | 2.15 |
| cell_2 | ego_superego | 5 | 43.22 | 44.00 | 0.78 |
| cell_3 | unified | 6 | 68.93 | 77.50 | 8.57 |
| cell_4 | ego_superego | 6 | 48.11 | 60.83 | 12.72 |
| cell_5 | unified_recognition | 6 | 69.81 | 75.83 | 6.02 |
| cell_6 | ego_superego_recognition | 6 | 47.39 | 60.00 | 12.61 |
| cell_7 | unified_recognition | 6 | 69.55 | 74.17 | 4.62 |
| cell_8 | ego_superego_recognition | 6 | 47.48 | 66.67 | 19.19 |

## Interpretation

Pooled across all cells, ego_superego learners score higher than unified on the rubric (Δ=3.41, d=0.21) and higher on holistic judgment (Δ=6.62, d=0.35).
Recognition contrast (pooled): rubric Δ=-0.66 (d=-0.05), holistic Δ=1.03 (d=0.06).
**Paradox run (base contrast):** rubric Δ=-23.33 (d=-2.82), holistic Δ=-21.40 (d=-1.34). The published d=3.05 was on first-turn rubric only (n=72 per arch × single-prompt mode); this paired paradox-run subset has n=11/12.
**Paradox run (recognition contrast):** rubric Δ=-22.25 (d=-3.11), holistic Δ=-11.67 (d=-1.06).
Rubric↔holistic correlations (pooled) are 0.704–0.771 across architectures — convergent validity does **not** break down for ego_superego learners.

The d=3.05 paradox was computed on the 2×2×2 factorial cells 1–8 (N=144, single-prompt mode, Paper 1.0 §6.16). The paradox run slice above gives the cell-matched d on both metrics on the exact rows the paradox came from. The pooled subset (N=1806), dominated by messages-mode cells 80–87, confirms the effect does not generalize.
