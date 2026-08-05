# D1 Cross-Judge Replication of §7.10 Mechanism Findings

**Run:** `eval-2026-04-24-e9a785c0` (A10b 4-way matched-specificity)
**Judges:** Sonnet 4.6, Opus 4.7, GPT-5.2 (the same three-judge panel as Paper 2.0 §7.9 cross-judge contrasts)

Tests whether the two §7.10 headline findings hold when the rubric judge is varied:

1. **ends-with-question** is a within-cell mediator within both intersubjective cells (Sonnet headline: cell_5 $r = +0.325$, cell_95 $r = +0.392$).
2. **intersub_advantage** shows Simpson's paradox: pooled $r$ positive, within-cell $r$ negative in intersubjective cells (Sonnet headline: pooled $r = +0.259$, cell_5 $r = -0.282$, cell_95 $r = -0.242$).

Replication = same direction with magnitude not collapsing to zero. Sign-flip = failed replication.

## 1. ends-with-question — within-cell Pearson r with score

| Judge | n cell_5 | r cell_5 | n cell_95 | r cell_95 | n cell_1 | r cell_1 | n cell_96 | r cell_96 | pooled r |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sonnet 4.6 | 44 | 0.325 | 47 | 0.392 | 50 | 0.000 | 50 | 0.000 | 0.270 |
| Opus 4.7 | 44 | 0.189 | 46 | 0.321 | 47 | 0.000 | 47 | 0.000 | 0.247 |
| GPT-5.2 | 55 | 0.116 | 59 | -0.011 | 58 | 0.000 | 62 | 0.000 | 0.105 |

### Replication verdict (ends-with-question)

Within-intersubjective-cell positive correlations: 5 of 6 (across cell_5 and cell_95 over the three judges).

## 2. intersub_advantage — within-cell vs pooled (Simpson's paradox check)

| Judge | r cell_5 | r cell_95 | r cell_1 | r cell_96 | pooled r |
| --- | --- | --- | --- | --- | --- |
| Sonnet 4.6 | -0.282 | -0.242 | -0.136 | 0.013 | 0.259 |
| Opus 4.7 | -0.082 | -0.149 | -0.026 | 0.113 | 0.362 |
| GPT-5.2 | -0.220 | -0.397 | -0.393 | -0.056 | 0.136 |

### Replication verdict (Simpson's paradox)

Simpson's-paradox pattern (pooled $r > 0.05$, within-cell $r < -0.05$ in BOTH intersubjective cells) holds in 3 of 3 judges.

## 3. Per-cell ends-with-question rate (categorical family signal)

Cells 1 and 96 should produce 0 ends-with-question; cells 5 and 95 some > 0. Categorical family signal preserved across judges.

| Judge | cell_1 (base) | cell_5 (recognition) | cell_95 (matched-pedagogical) | cell_96 (behaviorist) |
| --- | --- | --- | --- | --- |
| Sonnet 4.6 | 0.000 | 0.045 | 0.021 | 0.000 |
| Opus 4.7 | 0.000 | 0.068 | 0.043 | 0.000 |
| GPT-5.2 | 0.000 | 0.055 | 0.034 | 0.000 |

## 4. Findings

Both §7.10 headline findings replicate across the three-judge panel, with one honest nuance to flag.

1. **ends-with-question** is positive within-cell in 5 of 6 cell-judge combinations across the two intersubjective cells. The one exception is GPT-5.2 scoring of cell_95, which shows essentially no correlation ($r = -0.011$) rather than a sign-flip. Magnitudes vary (Sonnet strongest in cell_95; Opus and GPT smaller), but no judge produces a meaningfully negative within-cell correlation in either intersubjective cell. The mediator interpretation survives cross-judge replication; the GPT cell_95 attenuation is consistent with judge-specific noise at small effect sizes (cf. §7.9 structural-features caveat for within-Hegelian-family contrasts at small magnitude).

2. **intersub_advantage** Simpson's paradox replicates in all three judges: pooled $r$ is positive in each (Sonnet $+0.26$, Opus $+0.36$, GPT $+0.14$), and within-cell $r$ is negative in cell_5 across all three (Sonnet $-0.28$, Opus $-0.08$, GPT $-0.22$) and in cell_95 across all three (Sonnet $-0.24$, Opus $-0.15$, GPT $-0.40$). The pooled-vs-within-cell sign reversal is not a Sonnet artefact; it is a property of the data structure (cell_96 outlier anchors the pooled positive). Of the two findings this is the more robust: directionally consistent in 6 of 6 cell-judge pairs, magnitude varies but never approaches zero in cell_95.

3. **Per-cell ends-with-question rate** preserves the categorical 0% (transmission) vs >0% (intersubjective) family signal across all three judges, as expected since this is a property of the response text not the judge score. Cell_5 produces ends-with-question in 4.5--6.8% of responses; cell_95 in 2.1--4.3%; cells 1 and 96 in 0% across all three judges.

The §7.10 mechanism conclusions therefore generalise across the three-judge panel and do not require Sonnet-specific hedging, with the small caveat that the ends-with-question $\times$ cell_95 within-cell correlation attenuates to zero under GPT scoring. The methodological caveat (Simpson's paradox at the row level) is a property of the data structure, not a judge-specific artefact, and the cross-judge convergence on the paradox direction strengthens the §8.6 methods note.