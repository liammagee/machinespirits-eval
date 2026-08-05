# D1 Pass 6 — Multi-Feature OLS Regression

**Run:** `eval-2026-04-24-e9a785c0` (A10b 4-way matched-specificity)
**Judge:** claude-code/sonnet
**Predictors:** 6 features (intercept + 6 predictors = 7 columns)

Tests whether ends-with-question retains its within-cell mediator status when partialled-out for the other regex + embedding features. The within-cell univariate analyses (passes 3-5) reported zero-order Pearson r; this pass reports OLS partial coefficients (each coefficient is the marginal contribution of the feature to score, holding the other predictors constant).

## 1. Per-cell OLS coefficients

### cell_1 (base) (n = 50)

*Error: OLS: singular matrix at col 1*

### cell_5 (recognition) (n = 44)

R² = **0.320**, adjusted R² = 0.210; n = 44, k = 7 (incl. intercept)

| Predictor | β | SE | t | p (two-sided) |
| --- | --- | --- | --- | --- |
| (intercept) | 38.79 | 8.67 | 4.472 | < .001 |
| Ends with question | 26.34 | 10.85 | 2.428 | 0.02 |
| Intersub. advantage (embedding) | -49.54 | 33.25 | -1.490 | 0.14 |
| Second-person density | 194.11 | 116.80 | 1.662 | 0.10 |
| Scaffolding moves | 280.00 | 168.13 | 1.665 | 0.10 |
| Broad acknowledgement | -176.82 | 267.57 | -0.661 | 0.51 |
| Question-mark rate | 7.77 | 229.39 | 0.034 | 0.97 |

### cell_95 (matched-pedagogical) (n = 47)

R² = **0.308**, adjusted R² = 0.204; n = 47, k = 7 (incl. intercept)

| Predictor | β | SE | t | p (two-sided) |
| --- | --- | --- | --- | --- |
| (intercept) | 54.02 | 5.47 | 9.871 | < .001 |
| Ends with question | 38.52 | 16.49 | 2.336 | 0.02 |
| Intersub. advantage (embedding) | -82.15 | 40.39 | -2.034 | 0.04 |
| Second-person density | 47.43 | 91.47 | 0.519 | 0.60 |
| Scaffolding moves | -91.79 | 221.33 | -0.415 | 0.68 |
| Broad acknowledgement | -988.90 | 569.10 | -1.738 | 0.08 |
| Question-mark rate | 249.95 | 366.66 | 0.682 | 0.50 |

### cell_96 (matched-behaviorist) (n = 50)

*Error: OLS: singular matrix at col 1*

## 2. Pooled OLS coefficients (all 4 cells, n ≈ 191)

R² = **0.254**, adjusted R² = 0.230; n = 191, k = 7 (incl. intercept)

| Predictor | β | SE | t | p (two-sided) |
| --- | --- | --- | --- | --- |
| (intercept) | 26.33 | 2.41 | 10.946 | < .001 |
| Ends with question | 28.54 | 10.80 | 2.643 | 0.008 |
| Intersub. advantage (embedding) | 34.34 | 15.12 | 2.271 | 0.02 |
| Second-person density | 193.50 | 49.17 | 3.935 | < .001 |
| Scaffolding moves | 434.21 | 149.08 | 2.913 | 0.004 |
| Broad acknowledgement | -441.36 | 198.56 | -2.223 | 0.03 |
| Question-mark rate | 170.05 | 202.34 | 0.840 | 0.40 |

## 3. Findings

**ends-with-question partial coefficient (controlling for the 5 other features):**
- cell_5: β = 26.34, p = 0.02
- cell_95: β = 38.52, p = 0.02

Both partial coefficients are positive: the within-cell mediator finding survives multivariate control. Ending the tutor turn with a question retains a positive marginal contribution to score even after partialling out second-person density, scaffolding moves, broad acknowledgement, question rate, and the embedding-based intersub_advantage. The §7.10 mediator interpretation is robust to the multi-channel-correlate confound.

**intersub_advantage partial coefficient (Simpson's-paradox check):**
- Pooled (all 4 cells): β = 34.34, p = 0.02
- cell_5 within: β = -49.54, p = 0.14
- cell_95 within: β = -82.15, p = 0.04

Simpson's paradox replicates at the multivariate level: pooled β is positive but within-cell β is negative in both intersubjective cells. The §7.10 reading (intersub_advantage is a family marker, not a within-cell mediator) survives multivariate control.

## 4. Caveats

- Per-cell n ≈ 50 with k = 7 columns (including intercept) gives df ≈ 43. Estimates are stable but power for individual coefficients is modest; a single-feature SE of ~10 score points is typical.
- Multicollinearity among predictors (especially question_rate ↔ ends_with_question and intersub_advantage ↔ second_person_density) inflates SE without biasing β. Variance inflation factors are not reported here but pairwise predictor r is bounded by §5b of the pass-5 report (largest pairwise |r| = 0.31).
- p-values use the normal approximation to Student's t with df = n - k. For df ≈ 43, this is essentially identical to the exact t distribution.
- Single judge (Sonnet) for the primary analysis. Cross-judge replication via the pass-5 cross-judge script (`scripts/analyze-d1-cross-judge-replication.js`).
- This is a *post-hoc* analysis on already-collected data; no pre-registration. Reads as descriptive evidence of within-cell relationships, not causal mediation.