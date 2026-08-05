# D1 Fourth-Pass — Refined Structural / Pragmatic Features

**Run:** `eval-2026-04-24-e9a785c0` (A10b 4-way matched-specificity)
**Judge:** claude-code/sonnet
**Cells:** cell_1, cell_5, cell_95, cell_96

Pass 3 surfaced ends-with-question as the first concrete structural mediator candidate (within-cell r = 0.325 in cell_5, r = 0.392 in cell_95). Pass 4 adds six refined regex features targeting pass 3's known gaps: indirect questions (without `?`), scaffolding-move imperatives, inclusive framing, modal invitations, broad acknowledgement (quotes + flexible paraphrase), and broad epistemic hedges.

## 1. Per-cell feature means

| Cell | Family | n | Score | Indirect-? | Scaffold | Inclusive | Modal | Ack | Hedge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cell_1 (base) | transmission | 50 | 33.80 | 0.0000 | 0.0000 | 0.0143 | 0.0000 | 0.0015 | 0.0008 |
| cell_5 (recognition) | intersubjective | 44 | 47.90 | 0.0003 | 0.0051 | 0.0135 | 0.0000 | 0.0029 | 0.0008 |
| cell_95 (matched-pedagogical) | intersubjective | 47 | 49.55 | 0.0000 | 0.0038 | 0.0066 | 0.0000 | 0.0015 | 0.0000 |
| cell_96 (matched-behaviorist) | transmission | 50 | 22.07 | 0.0003 | 0.0000 | 0.0000 | 0.0000 | 0.0011 | 0.0000 |

## 2. Family contrasts (intersubjective − transmission)

| Feature | Mean intersubjective | Mean transmission | d (intersub − trans) |
| --- | --- | --- | --- |
| Indirect questions (no `?`) | 0.0001 | 0.0001 | -0.010 |
| Scaffolding-move imperatives | 0.0044 | 0.0000 | 0.591 |
| Inclusive framing (let's/we/us) | 0.0099 | 0.0071 | 0.155 |
| Modal invitations | 0.0000 | 0.0000 | 0.000 |
| Broad acknowledgement (quotes + paraphrase) | 0.0022 | 0.0013 | 0.138 |
| Broad epistemic hedges | 0.0004 | 0.0004 | -0.002 |

## 3. Within-intersubjective contrast (cell_5 vs cell_95)

| Feature | Mean cell_5 | Mean cell_95 | d (5 − 95) |
| --- | --- | --- | --- |
| Indirect questions (no `?`) | 0.0003 | 0.0000 | 0.310 |
| Scaffolding-move imperatives | 0.0051 | 0.0038 | 0.121 |
| Inclusive framing (let's/we/us) | 0.0135 | 0.0066 | 0.410 |
| Modal invitations | 0.0000 | 0.0000 | 0.000 |
| Broad acknowledgement (quotes + paraphrase) | 0.0029 | 0.0015 | 0.221 |
| Broad epistemic hedges | 0.0008 | 0.0000 | 0.257 |

## 4. Feature × score correlations (within-cell + pooled)

| Feature | r within cell_5 | r within cell_95 | r within cell_1 | r within cell_96 | r pooled all 4 |
| --- | --- | --- | --- | --- | --- |
| Indirect questions (no `?`) | -0.076 | 0.000 | 0.000 | -0.165 | -0.097 |
| Scaffolding-move imperatives | 0.186 | 0.048 | 0.000 | 0.000 | 0.226 |
| Inclusive framing (let's/we/us) | 0.028 | -0.038 | 0.285 | 0.000 | 0.180 |
| Modal invitations | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| Broad acknowledgement (quotes + paraphrase) | -0.181 | -0.307 | -0.380 | 0.042 | -0.086 |
| Broad epistemic hedges | 0.019 | 0.000 | 0.119 | 0.000 | 0.054 |

## 5. Comparison to pass 3

Pass 3's ends-with-question feature had within-cell r = 0.325 (cell_5) and r = 0.392 (cell_95). Pass 4 features that beat or match those numbers are stronger structural mediator candidates; features substantially below are at most secondary channels.

| Feature | r cell_5 | r cell_95 | Verdict |
| --- | --- | --- | --- |
| **Pass 3: ends-with-question** | **0.325** | **0.392** | **Reference** |
| Indirect questions (no `?`) | -0.076 | 0.000 | Weak / null |
| Scaffolding-move imperatives | 0.186 | 0.048 | Modest, below ends-w-? |
| Inclusive framing (let's/we/us) | 0.028 | -0.038 | Weak / null |
| Modal invitations | 0.000 | 0.000 | Weak / null |
| Broad acknowledgement (quotes + paraphrase) | -0.181 | -0.307 | Modest, below ends-w-? |
| Broad epistemic hedges | 0.019 | 0.000 | Weak / null |

## 6. Findings on these data

**Strongest positive within-cell correlation**: Scaffolding-move imperatives (cell_5 r = 0.186, cell_95 r = 0.048, pooled r = 0.226). Below pass 3's ends-with-question reference (r = 0.325 / 0.392).

**Strongest negative within-cell correlation**: Broad acknowledgement (quotes + paraphrase) (cell_5 r = -0.181, cell_95 r = -0.307, pooled r = -0.086). The feature predicts *lower* scores within cells — explicit acknowledgement markers (quoted text, "your X" possessives, paraphrase phrases) appear in weaker responses more often than in stronger ones. Possible interpretations: (a) verbose acknowledgement substitutes for substantive engagement; (b) the strongest tutor responses engage with learner content without surface-level echoing; (c) regex artefact (technical-term quotes counted alongside learner echoes). The rubric's "active sense-making" criteria reward synthetic moves over reflective ones.

**Cleanest family marker**: Scaffolding-move imperatives (family d = 0.591, within-intersubjective d = 0.121). Both intersubjective cells produce the behaviour; transmission cells do not. Within-cell r is modest (cell_5 0.186, cell_95 0.048) — the feature is *characteristic* of intersubjective-family prompts but does not by itself predict score variation strongly.

### Per-feature commentary

**Indirect questions (no `?`)** — family d = -0.010, within-intersub d = 0.310, within-cell r (5/95) = -0.076/0.000, pooled r = -0.097.

**Scaffolding-move imperatives** — family d = 0.591, within-intersub d = 0.121, within-cell r (5/95) = 0.186/0.048, pooled r = 0.226.

**Inclusive framing (let's/we/us)** — family d = 0.155, within-intersub d = 0.410, within-cell r (5/95) = 0.028/-0.038, pooled r = 0.180.

**Modal invitations** — family d = 0.000, within-intersub d = 0.000, within-cell r (5/95) = 0.000/0.000, pooled r = 0.000.

**Broad acknowledgement (quotes + paraphrase)** — family d = 0.138, within-intersub d = 0.221, within-cell r (5/95) = -0.181/-0.307, pooled r = -0.086.

**Broad epistemic hedges** — family d = -0.002, within-intersub d = 0.257, within-cell r (5/95) = 0.019/0.000, pooled r = 0.054.

### Synthesis

Read pass 3 + pass 4 jointly. **ends-with-question (pass 3) remains the single strongest within-cell correlate of score** (r = 0.325 / 0.392), and no pass-4 feature beats it. Pass 4 surfaces two additional findings:

1. **Scaffolding-move imperatives** ("Try ...", "Notice ...", "Consider ...") are a clean *family marker*: family d ≈ 0.59, within-intersubjective d ≈ 0.12, AND modestly positive within-cell r in cell_5 (0.186). Cell_5 and cell_95 both produce them; cell_1 and cell_96 do not. Confirms the intersubjective-family stance manifests through scaffolding pragmatics as well as ending-shape.

2. **Broad acknowledgement** (quoted spans + "your X" possessives + paraphrase markers) is *negatively* correlated with score across most cells. This is the only consistently-signed effect in the negative direction. The rubric appears to penalise (or at least not reward) verbose surface-level echoing of learner content; it rewards synthetic engagement that does not need to quote.

Together with pass 3, the structural channel reads as **multi-feature, weakly-individuated**: the intersubjective stance manifests through ending-shape (strongest mediator), scaffolding moves (clean family marker, weaker mediator), inclusive framing (cell-1 specific), and *avoidance* of explicit acknowledgement (negative correlate). No single feature fully accounts for the orientation-family score effect; a multi-feature mediation account is consistent with the data but not yet formally tested.

The next-most-tractable instrument is **embedding-based semantic features** — paraphrase-of-learner-input via cosine similarity, response-to-prototype distance for canonical scaffolding examples. Embeddings would catch what regex misses (a tutor that paraphrases the learner using flexible synonyms rather than fixed phrases). API-cheap (~$0.01 for embeddings on 200 rows). Would also enable a formal mediation analysis on combined regex + embedding features.

## 7. Caveats

- Single judge (Sonnet) for cleanliness. Cross-judge replication would strengthen within-cell r columns.
- Features remain author-specified regex extractors. Subject to false negatives (e.g., a tutor that paraphrases without using "your X" possessives or quoted spans is missed by broadAcknowledgement).
- Features are likely correlated (inclusive framing co-occurs with scaffolding moves, etc.). Pooled r columns over-estimate independent contributions; a mediation analysis would partial out shared variance.
- n ≈ 50/cell is modest power for r in the 0.2-0.4 range. CI is approximately ±0.27 around each within-cell r at this n.