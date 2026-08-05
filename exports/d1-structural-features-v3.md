# D1 Fifth-Pass — Embedding-Based Semantic Features

**Run:** `eval-2026-04-24-e9a785c0` (A10b 4-way matched-specificity)
**Judge:** claude-code/sonnet
**Embedding model:** OpenAI text-embedding-3-small (1536 dims)
**Cells:** cell_1, cell_5, cell_95, cell_96

Pass 3 (basic regex) and pass 4 (refined regex) reached the limits of bag-of-features pragmatics. Pass 5 adds embedding-based semantic features that catch flexible-synonym paraphrase, framing, and rhythm that fixed regex misses. Two hand-authored canonical references (~120 words each):

- **Intersubjective scaffolding canonical**: exemplifies turn-taking, question-asking, learner-acknowledgement, inclusive framing, and invitations to articulate intuition.
- **Transmission explanation canonical**: exemplifies direct explanation, definition-and-application, definitive framing, instruction to memorize, no questions.

Three derived features per response: cosine similarity to each canonical, plus their *difference* (intersub_advantage = sim_intersub − sim_transmission). The advantage feature isolates the direction of pragmatic style independent of overall tutor-talk semantics.

## 1. Per-cell embedding feature means

| Cell | Family | n | Score | sim_intersub | sim_transmission | intersub_advantage |
| --- | --- | --- | --- | --- | --- | --- |
| cell_1 (base) | transmission | 50 | 33.80 | 0.3343 | 0.2477 | 0.0865 |
| cell_5 (recognition) | intersubjective | 44 | 47.90 | 0.3443 | 0.2512 | 0.0931 |
| cell_95 (matched-pedagogical) | intersubjective | 47 | 49.55 | 0.3428 | 0.2662 | 0.0766 |
| cell_96 (matched-behaviorist) | transmission | 50 | 22.07 | 0.2588 | 0.3016 | -0.0429 |

## 2. Family contrasts (intersubjective − transmission)

| Feature | Mean intersubjective | Mean transmission | d (intersub − trans) |
| --- | --- | --- | --- |
| sim_intersub | 0.3435 | 0.2965 | 0.905 |
| sim_transmission | 0.2589 | 0.2747 | -0.316 |
| intersub_advantage | 0.0846 | 0.0218 | 0.810 |

## 3. Within-intersubjective contrast (cell_5 vs cell_95)

| Feature | Mean cell_5 | Mean cell_95 | d (5 − 95) |
| --- | --- | --- | --- |
| sim_intersub | 0.3443 | 0.3428 | 0.037 |
| sim_transmission | 0.2512 | 0.2662 | -0.318 |
| intersub_advantage | 0.0931 | 0.0766 | 0.266 |

## 4. Feature × score correlations (within-cell + pooled)

| Feature | r within cell_5 | r within cell_95 | r within cell_1 | r within cell_96 | r pooled all 4 |
| --- | --- | --- | --- | --- | --- |
| sim_intersub | -0.298 | -0.315 | -0.003 | 0.176 | 0.303 |
| sim_transmission | 0.138 | 0.014 | 0.185 | 0.202 | -0.088 |
| intersub_advantage | -0.282 | -0.242 | -0.136 | 0.013 | 0.259 |

## 5. Cross-feature correlation matrix (pass 3 + pass 4 + pass 5, pooled across 4 cells)

Identifies redundancy (features measuring the same underlying construct) and complementarity (features capturing orthogonal channels). High |r| (e.g. > 0.5) between two features means they probably reflect the same channel.

### 5a. Pearson r with score (pooled, all features)

| Feature | r with score |
| --- | --- |
| secondPersonDensity | 0.327 |
| sim_intersub | 0.303 |
| endsWithQuestion | 0.270 |
| intersub_advantage | 0.259 |
| scaffoldingMoves | 0.226 |
| questionRate | 0.218 |
| inclusiveFraming | 0.180 |
| indirectQuestionRate | -0.097 |
| sim_transmission | -0.088 |
| broadAcknowledgement | -0.086 |
| hedgeRate | 0.062 |
| broadHedge | 0.054 |
| acknowledgementRate | -0.022 |
| modalInvitation | 0.000 |

### 5b. Pairwise r between embedding features and regex features

Shows how much overlap each regex feature has with the embedding-derived intersubjective_advantage. High |r| means the embedding catches the same channel as the regex.

| Regex feature | r with intersub_advantage |
| --- | --- |
| questionRate | 0.251 |
| secondPersonDensity | 0.308 |
| endsWithQuestion | 0.132 |
| acknowledgementRate | -0.019 |
| hedgeRate | 0.078 |
| indirectQuestionRate | -0.010 |
| scaffoldingMoves | 0.009 |
| inclusiveFraming | 0.195 |
| modalInvitation | 0.000 |
| broadAcknowledgement | 0.203 |
| broadHedge | -0.046 |

## 6. Findings on these data

**Strongest pooled-r positive feature**: `secondPersonDensity` (r = 0.327 with score across all 4 cells).

**intersub_advantage (the headline embedding feature)**: family d = 0.810 (intersub vs trans), within-intersubjective d = 0.266, within-cell r = cell_5 **-0.282**, cell_95 **-0.242**, pooled 0.259.

### Interpretation: Simpson's paradox at the embedding level

**The pooled positive correlation is misleading.** Pooled $r = +0.259$ across all four cells looks like a mediator, but **within each intersubjective cell** (where the prompt is held constant), the correlation is *negative* ($r = -0.282$ in cell_5, $r = -0.242$ in cell_95). Cell_1 is also slightly negative; only cell_96 (which has very low advantage scores AND very low rubric scores) anchors the positive end. This is a classic **Simpson's paradox**: between-cell variance dominates the pooled correlation; within cells, the relationship reverses.

**Substantive read**: the more a response in cell_5 or cell_95 pattern-matches the generic intersubjective canonical, the *lower* its rubric score. Possible mechanism: responses that match the canonical too closely sound formulaic — the canonical captures family-level pragmatic *form* (turn-taking, scaffolding, inclusive framing) but not response-level *substance* (specific engagement with the scenario's content). The rubric rewards substance; surface-form mimicry of the canonical is a weak proxy that tracks lower-quality responses.

intersub_advantage is therefore a **family marker** (family d = 0.810, strong) but **not a within-cell mediator** — opposite of what the auto-generated mediator-criteria check would assert if it used pooled r alone. The mediator-criteria framework needs to be evaluated within-cell, not pooled, to avoid this trap.

**Implication for ends-with-question (pass 3)**: that finding survives. Cell_5 within-cell $r = +0.325$, cell_95 $r = +0.392$ — both positive, both substantial. ends-with-question is a *real* within-cell mediator; intersub_advantage is *not*. The two features differ in mechanism: ending-with-question is a discrete pragmatic act that varies meaningfully even within a fixed prompt, while embedding similarity to a canonical captures something more like overall stylistic conformity, which has a ceiling effect within prompt.

### Cross-feature check (§5b)

Pairwise r between intersub_advantage and the regex features is uniformly small (largest |r| = 0.31 with second-person density). The embedding feature is **largely orthogonal** to the regex features — it captures something different. But that "something different" is a family marker, not a within-cell mediator (per the Simpson's analysis above). The orthogonality is real but does not yield a new mechanism candidate.

Where embedding-feature r with regex-features is high (e.g. > 0.5), the two would be measuring the same channel and the embedding could be a drop-in replacement. Here no pairwise r exceeds 0.31; the embedding and the regexes are sampling different aspects of response style.

### Mediator scoreboard (D1 sequence summary)

| Pass | Feature | Type | Family d | Within-cell r (cell_5 / cell_95) | Verdict |
| --- | --- | --- | --- | --- | --- |
| 3 | ends-with-question | pragmatic | small (categorical) | +0.325 / +0.392 | **Strongest within-cell mediator** |
| 3 | second-person density | pragmatic | 0.69 | +0.216 / +0.065 | Family-aligned correlate |
| 3 | question-mark rate | pragmatic | 0.61 | +0.036 / +0.218 | Recognition-prompt marker |
| 4 | scaffolding-move imperatives | pragmatic | 0.59 | +0.186 / +0.048 | Cleanest family marker |
| 4 | broad acknowledgement | pragmatic | 0.14 | -0.181 / -0.307 | Negative correlate (formulaic echoing) |
| 5 | intersub_advantage | semantic | 0.81 | -0.282 / -0.242 | Family marker, **negative** within-cell (Simpson's) |

Net: ends-with-question remains the only feature that satisfies all three mediator criteria within both intersubjective cells. Embeddings discriminate families well but introduce Simpson's-paradox risk that surface pragmatic features avoid.

## 7. Caveats

- Single judge (Sonnet) for cleanliness. Cross-judge replication would strengthen within-cell r columns.
- Two canonical references are author-specified and intentionally extreme. Real tutor responses sit at varied points along the intersubjective ↔ transmission continuum; the binary canonical contrast may oversimplify.
- Embedding semantics are model-dependent. text-embedding-3-small captures English well but its judgments of "what is intersubjective" are themselves a language-model artifact.
- Multi-feature mediation analysis (multiple regression with all regex + embedding features as predictors of score) is the natural next step but requires a JS OLS implementation; deferred to pass 6.