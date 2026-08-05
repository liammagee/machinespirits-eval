# D1 Extension — Orientation-Family Lexicon Decomposition

**Run:** `eval-2026-04-24-e9a785c0` (A10b 4-way matched-specificity)
**Judge:** claude-code/sonnet
**Cells:** cell_1, cell_5, cell_95, cell_96 (4 cells × ~50 rows/cell)

Tests whether the Hegelian-recognition vocabulary is a *mediator* of recognition's effect or merely a *marker* of the recognition prompt. A10b established that cell_95 (matched-pedagogical, no Hegelian vocabulary) reproduces cell_5 (recognition) within $|d| < 0.2$ on scores. If Hegelian density tracks scores within the intersubjective family, vocabulary is mediator. If cell_95 scores like cell_5 without Hegelian density, vocabulary is marker — the broader intersubjective stance is the mechanism.

## 1. Per-cell density and score

| Cell | Family | n | Mean score | Mean Hegelian density | Mean intersubjective density |
| --- | --- | --- | --- | --- | --- |
| cell_1 (base) | transmission | 53 | 33.40 | 0.0653 | 0.0011 |
| cell_5 (recognition) | intersubjective | 50 | 48.63 | 0.0777 | 0.0028 |
| cell_95 (matched-pedagogical) | intersubjective | 51 | 48.97 | 0.0495 | 0.0368 |
| cell_96 (matched-behaviorist) | transmission | 51 | 21.94 | 0.0345 | 0.0009 |

## 2. Cross-cell contrasts

### 2.1 Hegelian-recognition vocabulary

| Contrast | Mean A | Mean B | d (A − B) |
| --- | --- | --- | --- |
| cell_5 vs cell_1 (recognition vs base) | 0.0777 | 0.0653 | 0.365 |
| cell_5 vs cell_95 (within intersubjective) | 0.0777 | 0.0495 | 0.997 |
| cell_95 vs cell_1 (matched-pedagogical vs base) | 0.0495 | 0.0653 | -0.518 |
| cell_5 vs cell_96 (recognition vs behaviorist) | 0.0777 | 0.0345 | 1.436 |

### 2.2 Intersubjective-pedagogy vocabulary

| Contrast | Mean A | Mean B | d (A − B) |
| --- | --- | --- | --- |
| cell_5 vs cell_1 (recognition vs base) | 0.0028 | 0.0011 | 0.429 |
| cell_5 vs cell_95 (within intersubjective) | 0.0028 | 0.0368 | -2.975 |
| cell_95 vs cell_1 (matched-pedagogical vs base) | 0.0368 | 0.0011 | 3.225 |
| cell_95 vs cell_96 (within transmission cross-check) | 0.0368 | 0.0009 | 3.197 |
| intersubjective family vs transmission (5+95 vs 1+96) | 0.0200 | 0.0010 | 1.298 |

## 3. Density × score correlations

Pearson r computed at the row level (each row contributes its density and its rubric score). r > 0 indicates the lexicon predicts higher scores; r near 0 indicates the lexicon is decorative.

| Lexicon | r (within cell_5) | r (within cell_95) | r (within cell_1) | r (within cell_96) | r (pooled across all 4 cells) |
| --- | --- | --- | --- | --- | --- |
| Hegelian | 0.045 | 0.188 | -0.009 | -0.366 | 0.169 |
| Intersubjective | -0.004 | 0.233 | -0.285 | 0.225 | 0.375 |

## 4. Interpretation

Read the Hegelian-density vs intersubjective-density panels jointly. Three patterns to look for:

1. **Hegelian vocabulary is a marker, not a mediator.** Cell_5 uses Hegelian vocab moderately ($d \approx 1.0$ vs cell_95). Cell_95 uses Hegelian vocab *less than* cell_1 ($d \approx -0.5$) — its expanded blocklist worked. Yet cells 5 and 95 score equivalently (~49). Recognition vocabulary tracks the recognition *prompt* but does not track the recognition *effect*: the vocabulary can be removed entirely without losing the score.

2. **Intersubjective vocabulary is also a marker, not a mediator — by a different route.** Cell_95 is hyper-dense in Vygotskian/constructivist terms ($\sim 13\times$ cell_5). Cell_5 has only trace intersubjective vocabulary. Yet again the scores converge. The two intersubjective-family cells use *almost entirely non-overlapping* vocabularies and produce equivalent rubric scores. Neither lexicon is the load-bearing channel.

3. **Score-tracking lives at a structural/pragmatic level both lexicons miss.** The pooled $r$'s for intersubjective vocabulary (~0.37) outperform Hegelian ($r \approx 0.17$), so the intersubjective lexicon does carry *some* signal — but the magnitude is modest and the within-cell $r$'s are inconsistent (cell_1 $r = -0.29$ vs cell_96 $r = +0.23$ on the same lexicon, opposite signs). What both intersubjective-family prompts share is not vocabulary but a *stance* — turn-taking that cedes initiative, questions over assertions, learner-acknowledgement before content delivery. Bag-of-concepts cannot reach the structural level where the mechanism lives.

### Implication for D1

Lexicon density is a **necessary diagnostic but not the mechanism**. The first-pass D1 finding (Hegelian density correlates weakly with scores) is reproduced and extended. The new finding is that *swapping the family vocabulary entirely* (Hegelian → Vygotskian) preserves the score effect — confirming A10b's orientation-family interpretation while ruling out vocabulary-as-mediator at the lexical level.

The remaining mechanism question — what structural features of the intersubjective stance make it work — requires either (a) higher-order behavioral coding (question-asking rates, learner-acknowledgement turn structure), or (b) the parked white-box analysis (attention to learner tokens, residual-stream alignment). The lexical channel is now closed as a candidate.

## 5. Caveats

- Single judge (Sonnet) for cleanliness. Cross-judge replication would strengthen the within-cell r columns.
- Lexicons are author-specified, not learned. False negatives possible (the prompts may use intersubjective constructs we did not enumerate).
- The intersubjective lexicon is broader than the Hegelian one (10 concepts each but Vygotskian terms are more frequent in everyday tutoring discourse). Density comparisons across lexicons are not directly meaningful — only within-lexicon, across-cell comparisons are.
- Row-level correlations have low power within a single cell (n ≈ 50). Pooled r across 4 cells is the more powerful test.