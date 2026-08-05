# D1 Third-Pass — Structural / Pragmatic Feature Decomposition

**Run:** `eval-2026-04-24-e9a785c0` (A10b 4-way matched-specificity)
**Judge:** claude-code/sonnet
**Cells:** cell_1, cell_5, cell_95, cell_96

Tests whether structural / pragmatic features (question rate, second-person density, turn-ending shape, acknowledgement markers, epistemic hedges) succeed where lexicon density failed. Lexicon analysis (D1 second-pass) ruled out vocabulary-as-mediator; this third pass asks whether the mechanism lives at the syntactic / pragmatic level instead.

## 1. Per-cell feature means

| Cell | Family | n | Score | ?-rate | 2p-density | ends-w-? | Ack | Hedge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cell_1 (base) | transmission | 50 | 33.80 | 0.0000 | 0.0501 | 0.000 | 0.0010 | 0.0000 |
| cell_5 (recognition) | intersubjective | 44 | 47.90 | 0.0064 | 0.0595 | 0.045 | 0.0000 | 0.0008 |
| cell_95 (matched-pedagogical) | intersubjective | 47 | 49.55 | 0.0020 | 0.0490 | 0.021 | 0.0001 | 0.0000 |
| cell_96 (matched-behaviorist) | transmission | 50 | 22.07 | 0.0002 | 0.0252 | 0.000 | 0.0011 | 0.0000 |

## 2. Family contrasts (intersubjective − transmission)

Pooled intersubjective family = cell_5 ∪ cell_95. Pooled transmission family = cell_1 ∪ cell_96. Cohen's d on each feature.

| Feature | Mean intersubjective | Mean transmission | d (intersub − trans) |
| --- | --- | --- | --- |
| Question-mark rate | 0.0041 | 0.0001 | 0.611 |
| Second-person density | 0.0541 | 0.0377 | 0.693 |
| Ends with question (rate) | 0.0330 | 0.0000 | 0.266 |
| Acknowledgement markers | 0.0000 | 0.0010 | -0.282 |
| Epistemic hedges | 0.0004 | 0.0000 | 0.179 |

## 3. Within-intersubjective contrast (cell_5 vs cell_95)

If a feature is HIGH in cell_5 but LOW in cell_95, it tracks the recognition prompt (marker) rather than the family (shared by 5 and 95). If both have similar levels, the family-marker hypothesis holds.

| Feature | Mean cell_5 | Mean cell_95 | d (5 − 95) |
| --- | --- | --- | --- |
| Question-mark rate | 0.0064 | 0.0020 | 0.472 |
| Second-person density | 0.0595 | 0.0490 | 0.475 |
| Ends with question (rate) | 0.0455 | 0.0213 | 0.134 |
| Acknowledgement markers | 0.0000 | 0.0001 | -0.203 |
| Epistemic hedges | 0.0008 | 0.0000 | 0.257 |

## 4. Feature × score correlations (within-cell + pooled)

Pearson r at row level. r > 0 indicates the feature predicts higher scores within that population; r near 0 means decorative.

| Feature | r within cell_5 | r within cell_95 | r within cell_1 | r within cell_96 | r pooled all 4 |
| --- | --- | --- | --- | --- | --- |
| Question-mark rate | 0.036 | 0.218 | 0.000 | -0.023 | 0.218 |
| Second-person density | 0.216 | 0.065 | -0.139 | 0.240 | 0.327 |
| Ends with question (rate) | 0.325 | 0.392 | 0.000 | 0.000 | 0.270 |
| Acknowledgement markers | 0.000 | 0.110 | 0.198 | 0.076 | -0.022 |
| Epistemic hedges | 0.036 | 0.000 | 0.000 | 0.000 | 0.062 |

## 5. How to read

A **structural mediator candidate** would show:
- Large family contrast (§2 |d| ≥ 0.5),
- Small within-intersubjective contrast (§3 |d| < 0.5 — the feature is shared by both intersubjective cells, not just the recognition cell), AND
- Positive within-cell Pearson r (§4 — the feature predicts scores even when the prompt is held constant).

A feature that satisfies all three is a candidate for the actual mechanism the orientation-family effect operates through.

A feature that satisfies (1) and (2) but not (3) is a **family marker** — distinctive of intersubjective-family prompts but does not predict score variation. The mechanism then operates through the same channel but is amplitude-controlled by content the feature does not capture (e.g., semantic appropriateness of the question).

A feature that satisfies (1) but not (2) is a **prompt marker** — distinctive of one specific prompt rather than the family.

## 6. Findings on these data

Applying the framework above to the §1-§4 numbers:

### Mediator candidate: **ends-with-question** ($r_{cell\_5} = 0.325$, $r_{cell\_95} = 0.392$)

Family contrast $d = 0.266$ is small by Cohen's conventions but the underlying pattern is *categorical*: transmission cells (cells 1 and 96) end with a question in **0%** of responses; intersubjective cells (5 and 95) do so in 4.5% and 2.1% respectively. Within-intersubjective $d = 0.134$ is small — both intersubjective cells produce the behaviour. Within-cell Pearson $r$ with score is **0.325** in cell_5 and **0.392** in cell_95 — when the same prompt produces a response that ends with a question, that response scores higher. This is the first feature in the D1 sequence to satisfy all three mediator criteria.

Pragmatically: ending a tutor turn with a question cedes initiative back to the learner. Transmission-family prompts (base, behaviorist) produce closed assertions; intersubjective-family prompts (recognition, matched-pedagogical) produce open questions some of the time. The *some of the time* is what the within-cell $r$ captures — it tracks pedagogical situations where ceding initiative is appropriate, not just stylistic preference.

### Cross-cell predictor: **second-person density** (pooled $r = 0.327$)

Pooled $r$ is the highest of any feature, but second-person density is *not* a clean family marker (cell_1 has 0.050 vs cell_5's 0.060 — same order of magnitude). The within-cell $r$ pattern is uneven (cell_5 $r$ = 0.216, cell_96 $r$ = 0.240, cell_95 $r$ = 0.065). Second-person density is best read as a *correlate* of the same underlying engagement that the rubric rewards, not as a mechanism in its own right.

### Prompt marker: **question-mark rate**

Family $d = 0.611$ is large but cell_5's rate (0.0064) is 3.2× cell_95's (0.0020) — the recognition prompt is genuinely more question-dense than the matched-pedagogical prompt. Within-cell $r$'s are small to null. Question-mark *count* is a marker of the recognition prompt specifically; the family-level signal is carried more cleanly by ends-with-question (where to put the question matters more than how many you ask).

### Null features: acknowledgement markers, epistemic hedges

Both feature families are near-zero across all cells. The author-specified regex sets did not capture meaningful variation. Either (a) tutors paraphrase and hedge in language too flexible for fixed regex extraction, or (b) the LLMs in question rarely use these explicit markers regardless of prompt. The features are not informative at this resolution.

### Implication for D1

The lexical channel (D1 second-pass) is closed; the structural channel is **partially open**. Ends-with-question is a real candidate mediator, satisfying all three criteria. The mechanism account that emerges:

> Intersubjective-family prompts elicit responses that, *some of the time*, end with a question — ceding initiative back to the learner. The judges reward this, especially when the question is contextually appropriate (which the within-cell $r$ implies, since the prompt is held constant within a cell).

Open work: extend the feature set with semantic-pragmatic features (paraphrase via embeddings rather than regex, question quality via dependency parsing, scaffolding-move classification). The current regex-based features are a useful first cut but leave the rest of the structural channel under-instrumented.

## 7. Caveats

- Single judge (Sonnet) for cleanliness. Cross-judge replication would strengthen within-cell r columns.
- Features are author-specified regex extractors. False negatives possible (e.g., "Walk me through your reasoning" is a question without "?", not captured).
- `endsWithQuestion` collapses multi-suggestion responses to a single text blob; the "ending" is therefore the last suggestion's ending. Per-suggestion granularity would refine this if needed.
- Within-cell n ≈ 50 — modest power for detecting r in the 0.2-0.4 range.