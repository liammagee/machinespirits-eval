---
title: "Two Methods-Level Corrections for LLM-Tutor Mediator Analysis: Within-Cell Diagnostics and Rubric Over-Specification"
author: "Liam Magee"
date: "April 2026"
version: "0.3.0"
# Target venue: NeurIPS 2026 workshop on evaluation/benchmarking for foundation
# models (anticipated Sept 2026 deadline). 4-page short-paper format = ~3,200
# word target. Backup: COLM 2027 (Mar 2027 deadline, 8-page main / 4-page short).
#
# Template note: this draft uses the project's pandoc + xelatex pipeline
# (header.tex). When the specific NeurIPS 2026 workshop CFP publishes its
# required style file (typically neurips_2026.sty or a workshop-specific
# variant), the conversion is mechanical: pandoc has good NeurIPS template
# support via --template, and the markdown source is template-agnostic. Estimate
# ~2 hours for the conversion plus a proofreading pass. Conversion is deferred
# until the CFP is published.
bibliography: references.bib
csl: apa.csl
link-citations: true
fontsize: 11pt
geometry: margin=1in
header-includes: |
  \usepackage{float}
  \floatplacement{figure}{H}
abstract: |
  LLM-tutor evaluation pipelines routinely report *mediator* findings: response-level features (question-asking, acknowledgement, scaffolding) are claimed to explain a portion of the score gap between conditions. Two methods-level assumptions underlie these claims and frequently fail in practice. **First**, that pooled-r between feature and score across conditions identifies within-condition mechanism. **Second**, that rubric dimensions are discriminantly valid such that per-dimension mediation claims are warranted. We articulate a **three-criterion within-cell mediator diagnostic** (large family contrast, small within-family contrast, positive within-cell Pearson r) and pair it with a **rubric over-specification check** based on principal-components analysis of dimension scores. We illustrate both corrections on a five-pass mechanism analysis from a published recognition-theoretic apparatus [@magee2026geist]: of seven candidate response-level features, only one (ending the tutor turn with a question) survives all three criteria; one (embedding-similarity to an intersubjective canonical) exhibits a textbook Simpson's paradox; the rubric's eight dimensions reduce empirically to one factor (PC1 = 80.7\%). Both findings are robust across three independent LLM judges (Sonnet 4.6, Opus 4.7, GPT-5.2), survive multivariate OLS control, and replicate across multiple runs and applications within the source apparatus, with a single-turn-vs-multi-turn scope condition that itself follows from the diagnostic's logic. We argue that any LLM-tutor evaluation reporting mediator-r should report within-cell as well as pooled correlations, and that any evaluation reporting per-dimension claims should report PCA dimensionality alongside rubric scores.
---

# 1. Introduction

LLM-as-judge evaluation of AI tutors increasingly reports not only headline score gaps between conditions but also response-level *mechanisms*: candidate features (question-asking rate, acknowledgement markers, scaffolding moves) are regressed on condition with and without the feature as covariate, and the indirect-effect proportion is reported [@baron1986moderator; @mackinnon2008introduction]. Two assumptions underpin this analysis and routinely fail on LLM-tutor data.

**First**, that pooled-$r$ between feature and score across conditions identifies within-condition mechanism. When a feature distribution differs substantially across conditions and scores differ alongside it, the pooled correlation can be driven entirely by between-condition variance while within-condition correlations are zero or reversed --- Simpson's paradox at the response level [@pearl2009causality].

**Second**, that LLM-as-judge rubric dimensions are discriminantly valid such that per-dimension mediation claims describe movement of $k$ independent constructs. When the dimensions are highly correlated and load on one or two empirical factors, per-dimension claims describe shifts in the underlying factor along whichever surface dimension the prompt foregrounds.

We articulate two corrections that address these assumptions directly. Section 2 specifies a **three-criterion within-cell mediator diagnostic** requiring within-condition Pearson $r$ as a separate criterion from family-level contrast. Section 3 illustrates the diagnostic on a five-pass mechanism analysis from a recognition-theoretic apparatus [@magee2026geist]. Section 4 adds the **rubric over-specification check** based on PCA of dimension scores. Section 5 reports the diagnostic's behaviour across multiple runs, judges, generation models, and applications, surfacing a single-turn-vs-multi-turn scope condition that the diagnostic itself flags. Section 6 situates the contribution against related work; Section 7 concludes with the practical recommendation that mediator-r tables include within-cell as well as pooled correlations, and that rubric-dimension claims report PCA dimensionality.

# 2. The three-criterion within-cell mediator diagnostic

Consider a factorial design with two prompt families $A$ (recognition / intersubjective) and $B$ (transmission / behaviourist), and within each family two cells: $a_1$ and $a_2$ for family $A$, $b_1$ and $b_2$ for family $B$. The headline finding is a substantial score gap between $A$ and $B$ on aggregate. The methodological question is which response-level features mediate that gap.

A response-level feature $f$ qualifies as a within-cell mediator candidate when all three criteria are met:

1. **Large family contrast.** $|d_{AB}(f)| \geq 0.5$ between $A$ and $B$ on the feature itself. The feature distinguishes the families. If it does not, it cannot mediate the family-level effect.

2. **Small within-family contrast.** $|d_{a_1 a_2}(f)| < 0.5$ between two cells within the same family. Both family-member prompts elicit the feature; if only one does, the feature is a *prompt marker* (specific to one prompt) rather than a *family marker* (shared across the family), and any score correlation reflects prompt-specific properties not family-level mechanism.

3. **Positive within-cell Pearson r with score** in each family-member cell: $r_{a_1}(f, \text{score}) > 0$ and $r_{a_2}(f, \text{score}) > 0$. When the prompt is held constant, the feature still predicts higher scores. This isolates the response-level mediating role from cross-cell variance that the family contrast (criterion 1) already captures.

A feature passes the mediator bar only by satisfying all three criteria. Failure on any one criterion disqualifies the feature as a within-cell mediator while preserving its possible role as:

- A **family marker**: passes criteria 1 and 2 but fails criterion 3. The feature characterises the family but does not predict scores within it. The feature is downstream of the family-level treatment but not the channel through which the treatment operates.
- A **prompt marker**: passes criterion 1 but fails criterion 2. The feature distinguishes one specific prompt rather than the family; it is part of the prompt's surface composition, not the family's pragmatic stance.
- A **negative correlate**: criteria 1 and 2 may pass, but criterion 3 fails *with negative sign*. The feature appears more often in lower-scoring responses within cells. This pattern is informative when the feature is one a researcher might naively try to optimise for: explicit acknowledgement markers, for instance, are surrogate moves that responses fall back on when substantive engagement is thin.
- **Simpson's paradox disqualified**: criterion 1 passes (large family contrast); criterion 3 fails (negative within-cell r in both family $A$ cells); pooled $r$ across all four cells is positive. The pooled positive correlation is driven entirely by between-family variance — typically by an outlier cell whose feature mean and score mean both lie at one extreme. The diagnostic flags this case explicitly because pooled-r alone would have presented the feature as a strong mediator candidate.

The third disqualification mode is what makes the diagnostic methodologically substantive. Without criterion 3, a feature exhibiting large family contrast and significant pooled-$r$ — the most common combination in published mediator analyses — would pass through as a confirmed mediator. Pearl's [-@pearl2009causality] formalisation of Simpson's paradox shows that pooled correlations *cannot* identify within-stratum effects when the strata differ on the predictor; the third criterion enforces the stratum-level check that the formalisation requires.

# 3. Worked example: a five-pass mechanism analysis

We illustrate the diagnostic on the five-pass response-level mechanism analysis reported in Magee [-@magee2026geist §7.10, §7.10.1, §8.6.1]. The source corpus is a four-cell matched-specificity comparison: cell 1 (generic baseline), cell 5 (recognition-theoretic prompt with explicit Hegelian vocabulary), cell 95 (matched-pedagogical prompt grounded in Vygotsky/Piaget/Kapur/Chi/VanLehn/Graesser, no Hegelian vocabulary), and cell 96 (matched-behaviorist prompt grounded in Skinner/Gagné/Keller/Thorndike/Rosenshine, no recognition or constructivist vocabulary). Cells 5 and 95 sit in the **intersubjective family**; cells 1 and 96 in the **transmission family**. The headline factorial finding [@magee2026geist §7.9] is a between-family pooled Cohen's $d \approx 1.38$, with within-Hegelian-family pooled $d = 0.15$ — recognition and matched-pedagogical are statistically indistinguishable, while both substantially outperform the transmission cells.

The five-pass sequence asked: which response-level feature, if any, mediates the between-family effect? Each pass added a new feature class:

- **Pass 1**: theory-driven Hegelian recognition lexicon (recognition / mutuality / autonomy / dialectic / transformation / intersubjectivity / struggle / repair / hegel / genuine).
- **Pass 2**: Vygotskian/constructivist intersubjective lexicon (scaffolding / construct / sense-making / productive struggle / dialogic / inquiry).
- **Pass 3**: regex-based pragmatic features (question-mark rate, second-person density, ends-with-question, acknowledgement markers, epistemic hedges).
- **Pass 4**: refined regex (indirect questions, scaffolding-move imperatives, inclusive framing, modal invitations, broad acknowledgement, broad hedge).
- **Pass 5**: embedding-based similarity to hand-authored intersubjective and transmission canonicals (OpenAI text-embedding-3-small).

We apply the three-criterion diagnostic to seven representative features from this sequence. The Sonnet 4.6 judge produces the within-cell Pearson $r$ values reported in Table 1; cells 5 and 95 each carry $n \approx 50$ rows.

| Feature | Crit 1 (family d) | Crit 2 (within-family d) | Crit 3 (within-cell r in cell_5 / cell_95) | Verdict |
|---|---|---|---|---|
| Hegelian lexicon density | small | very large (cell_5 $\gg$ cell_95) | small | Prompt marker only |
| Intersubjective lexicon density | moderate | very large (cell_95 $\gg$ cell_5) | mixed signs across cells | Prompt marker only |
| Question-mark rate | 0.61 | 0.47 (cell_5 $3\times$ cell_95) | small | Prompt marker, modest predictor |
| Scaffolding-move imperatives | 0.59 | 0.12 | $+0.19$ / $+0.05$ | Family marker, weak mediator |
| Broad acknowledgement | 0.14 | small | $-0.18$ / $-0.31$ | Negative correlate |
| **Ends-with-question** | **categorical** (4.5\% / 2.1\% vs 0\%) | **0.13** | **$+0.325$ / $+0.392$** | **Mediator** |
| Intersub. canonical similarity | **0.81** | 0.27 | **$-0.28$ / $-0.24$** (negative within-cell, positive pooled) | Family marker; **Simpson's paradox** disqualifies as mediator |

**Reading the table.** The two lexicon passes (rows 1--2) illustrate the role of criterion 2: cell 5 uses Hegelian vocabulary moderately while cell 95 actively suppresses it (within-family $d \approx 1.0$); cell 95 is hyper-dense in Vygotskian vocabulary while cell 5 has only trace amounts (within-family $d \approx 3$). Both lexicons are *prompt markers*, not family markers; pooled-r alone would have wrongly presented either as a mediator candidate.

**Scaffolding-move imperatives** ("Try ...", "Notice ...", "Consider ...") satisfy criteria 1--2 (family $d = 0.59$; within-family $d = 0.12$) and yield modestly positive within-cell $r$. The feature characterises the intersubjective family but is only a weak mediator.

**Broad acknowledgement** (quoted text, "your X" possessives, paraphrase markers) yields uniformly *negative* within-cell $r$ ($-0.18$ in cell 5, $-0.31$ in cell 95, $-0.38$ in cell 1). Verbose surface acknowledgement appears more often in *lower-scoring* responses --- surrogate moves that responses fall back on when substantive engagement is thin. The rubric is not fooled by surface empathy. The negative within-cell direction is informative, not just disqualifying: it cautions against operationalist readings that would mandate "more acknowledgement" as a quality intervention.

**Ends-with-question** satisfies all three criteria. Family contrast is categorical (transmission cells: 0\% of responses; intersubjective cells: 4.5\% in cell 5, 2.1\% in cell 95). Within-family $d = 0.13$ is small. Within-cell $r = +0.325$ (cell 5) and $+0.392$ (cell 95). Pragmatically, ending the turn with a question cedes initiative to the learner; the within-cell correlation captures situations where doing so is contextually appropriate, not just stylistic preference.

**Intersubjective canonical similarity** is the diagnostic's central illustration. The embedding-derived feature has pooled $r = +0.26$ but reverses sign within each intersubjective cell ($r = -0.28$ in cell 5, $-0.24$ in cell 95). The pooled positive is driven entirely by the cell 96 outlier (low embedding-similarity *and* low scores) anchoring the lower-left of the pooled scatter. Without criterion 3 the feature would pass as a strong mediator; with criterion 3 it is correctly identified as a family marker capturing family-level pragmatic *form* but not response-level *substance*. Responses matching the canonical too closely sound formulaic, and the rubric rewards substance.

# 4. Rubric over-specification: a complementary caution

The diagnostic addresses pooled-vs-within-cell mediator inference but presupposes that the rubric's per-dimension scores are themselves meaningful as separate constructs. This presupposition is independently testable and frequently fails. Magee [-@magee2026geist §8.6] reports principal-components analysis on 1,584 per-turn observations under an eight-dimension v2.2 LLM-tutor rubric: PC1 explains **80.7\%** of variance; the Kaiser criterion yields exactly one factor with eigenvalue $> 1$; sampling adequacy is excellent (KMO = 0.938); the mean inter-dimension correlation is $r = 0.776$ (range 0.589–0.921). The pattern replicates across conditions (PC1 $= 80.2\%$ base, $75.6\%$ recognition) and across generation models (PC1 $= 77.3\%$ DeepSeek, $68.0\%$ Haiku). A forced two-factor varimax rotation separates `content_accuracy` (loading 0.923 on Factor 2) from the seven pedagogical dimensions (loadings 0.68–0.85 on Factor 1).

The eight dimensions, in other words, measure essentially **one underlying construct** plus a separable content-accuracy modifier. Per-dimension mediation claims under such a rubric describe shifts in the single underlying factor along whichever surface dimension the prompt's wording happens to foreground; they do not describe selective movement of $k$ independent skills.

This finding pairs directly with the within-cell mediator diagnostic. Consider a published mediator analysis that reports: "the recognition prompt improves `adaptive_responsiveness` ($d = 0.6$) without affecting `clarity_structure` ($d = 0.1$); therefore recognition selectively engages adaptive responsiveness." Under PC1 = 80.7\%, this claim is weakly supported at best: the apparent dimension-specific differential could reflect the prompt's wording foregrounding one facet of an underlying construct that *did* shift overall, with the other dimension's null result reflecting weighting of the prompt against that facet rather than insensitivity. The honest reading is "recognition shifts overall pedagogical quality with prompt-specific dimensional emphasis," not "recognition selectively engages adaptive responsiveness."

We therefore propose a **rubric over-specification check** as a methods-level companion to the diagnostic: any LLM-tutor evaluation reporting per-dimension findings should also report (a) the dimensionality of its rubric under PCA on a representative sample of scores, (b) the inter-dimension correlation matrix, and (c) the proportion of variance explained by PC1. When PC1 explains $\geq 70\%$ of variance, per-dimension claims should be hedged accordingly; per-dimension *mediation* claims should be retracted unless the dimensions are demonstrated to be discriminantly valid on the specific dataset under analysis.

The pairing has two effects. First, the within-cell diagnostic protects against Simpson's-paradox false positives; the rubric check protects against per-dimension construct-validity false positives. Second, both checks are computationally inexpensive: the within-cell diagnostic requires only the per-cell correlation matrix; the rubric check requires only PCA on dimension scores. Neither requires re-running the underlying generation or judging.

# 5. Application across runs and conditions

The diagnostic was developed against one corpus (A10b) and one judge (Sonnet 4.6). To assess its stability and surface scope conditions, we apply it to additional runs, judges, and applications within the source apparatus [@magee2026geist §7.10.1].

**Cross-judge.** The A10b corpus was scored by Sonnet 4.6, Opus 4.7, and GPT-5.2. Ends-with-question within-cell $r$ remains positive in 5 of 6 cell-judge combinations (cell 5 / cell 95: Sonnet $+0.325$/$+0.392$; Opus $+0.189$/$+0.321$; GPT $+0.116$/$-0.011$). The single exception (GPT $\times$ cell 95) is essentially zero, not a sign-flip. The intersub_advantage Simpson's-paradox replicates in 3/3 judges: pooled $r$ positive (range $+0.14$ to $+0.36$), within-cell $r$ negative in both intersubjective cells across all three judges. Neither finding is judge-specific.

**Multivariate OLS control.** A six-predictor regression (ends-with-question + 5 other regex/embedding features) per cell. Ends-with-question partial coefficient remains positive and significant in both intersubjective cells: cell 5 $\beta = 26.34$ ($p = 0.02$); cell 95 $\beta = 38.52$ ($p = 0.02$). The single-feature mediator interpretation is not collinearity-driven; the intersub_advantage Simpson's direction also survives multivariate control.

**Cross-run, cross-application: a single-turn-vs-multi-turn scope condition.** The diagnostic was applied to five additional runs. In single-turn intersubjective cells, ends-with-question within-cell $r$ replicates uniformly: an independent A10 philosophy run yields $r = +0.346$; an A6 programming run (different domain, Haiku ego) yields $r = +0.202$; a D2 peer-support listener coaching run (different application entirely, Haiku ego) yields $r = +0.739$ --- the strongest within-cell $r$ in the sequence. In multi-turn cells, the relationship reverses sign across architectures: messages-mode single-agent recognition yields $r = -0.301$; messages-mode multi-agent recognition $r = -0.203$; dialectical multi-agent recognition with a dynamic learner $r = -0.087$ to $-0.199$.

The single-turn-vs-multi-turn split has a clean pragmatic interpretation. In single-turn settings, ending the response with a question is the only available channel to cede initiative back to the learner. In multi-turn settings, the rubric scores the full dialogue arc; ending the *final* turn with a question leaves the conversation unresolved, and the judges penalise it. The same surface feature signals different pragmatic acts in different discourse contexts. The diagnostic's logic itself produces this scope condition: criterion 3 is checked within-cell, and the same feature can meet it in one set of cells and fail it in another. The mediator interpretation is correctly hedged to its applicable scope.

**Beyond the source apparatus.** The applications above share one recognition-theoretic corpus. A stronger generality claim --- that the diagnostic transfers to LLM-tutor evaluation pipelines using different rubrics, prompts, and judges --- requires application to independently published rubrics. We document the procedure for such application as an explicit six-step protocol [@magee2026geist §8.6.2]: identify the family partition, compute the candidate feature per row, test criterion 1 (family $|d| \geq 0.5$), test criterion 2 (within-family $|d| < 0.5$), test criterion 3 (within-cell $r > 0$ in each family-member cell), pair with PCA over-specification check on the source rubric. Reference scripts for steps 2--5 are open-sourced; data-loading is the only extension point. Candidate independent rubrics include MathTutorBench [@macina2025mathtutorbench], ICAP-aligned LLM-as-judge studies [@chi2014icap], and LLM-Rubric [@hashemi2024llmrubric]. We leave application to those rubrics as future work. The source-apparatus replications above already demonstrate stability across 3 judges, 3 generation models, 3 domains, 2 applications, 2 turn modes, and 3 architectures, and the explicit application protocol makes the procedural argument for transfer; converting that procedural argument to an empirical one is the natural next step.

# 6. Related work

The within-cell mediator diagnostic operationalises Pearl's [-@pearl2009causality] formalisation of Simpson's paradox in the LLM-tutor context: pooled correlations cannot identify within-stratum mechanism when strata differ on the predictor, and criterion 3 enforces the stratum-level check the formalisation requires. The diagnostic sits adjacent to the broader mediation-analysis literature [@baron1986moderator; @mackinnon2008introduction; @imai2010general], which formalises necessary conditions for mediation under causal-graph assumptions. Our scope is narrower: we do not claim causal mediation in the strict counterfactual sense, since LLM-tutor data is observational at the within-cell level; we claim only that pooled-r alone is insufficient evidence of within-cell mechanism and that within-cell r is a necessary supplementary check.

LLM-as-judge methodology has documented systematic biases in judge-side artefacts (positional bias, length preferences, stylometric cues) [@zheng2023judging; @gu2025surveyjudge; @liu2025discerning; @li2024llmsjudges] and proposed structured rubric-based methodologies for the tutor sub-domain [@hashemi2024llmrubric]. Our corrections are orthogonal: they address how mediator analyses are *interpreted* over judge scores, not how the scores are produced, and compose with judge-bias hedging rather than replacing it.

PCA on rubric scores has a long tradition in educational measurement [@brookhart2013rubrics], where rubric over-specification is a known concern even for human raters. Our contribution is to import this routine check into the LLM-tutor evaluation pipeline, where it has been notably absent. Behavioural-feature mediation in LLM tutoring [@magee2026geist §6.1.7] reports question-asking rate as a 42\% direct mediator of the recognition effect; this finding survives the three-criterion check on single-turn cells. The diagnostic's contribution is to flag when a similar mediation finding *does not* survive --- most importantly, the embedding-similarity case in §3 --- and to make failure modes diagnosable rather than implicit.

# 7. Conclusion

We have argued that two assumptions underlying common LLM-tutor mediator analyses --- that pooled correlations identify within-condition mechanism, and that rubric dimensions are independently scorable --- frequently fail in practice, and that two computationally cheap corrections (the three-criterion within-cell mediator diagnostic and the rubric over-specification check) should accompany any future analysis at this scale. Both reframe existing analyses rather than requiring re-runs: the diagnostic uses the same per-row data as pooled mediation; the rubric check uses the same dimension scores.

The corrections are most informative where they would change a published conclusion. A feature with significant pooled-r that fails the within-cell criterion is a candidate retraction; a per-dimension claim under PC1 $\geq 70\%$ is a candidate hedge. Application to one already-published mechanism analysis [@magee2026geist] revealed exactly this pattern: of seven candidate response-level features, only one survived all three criteria, and one exhibited a textbook Simpson's paradox that pooled-r alone would have presented as a strong mediator.

We are not arguing that pooled-r mediator analyses should be abandoned; they are useful exploratory tools, and many published findings will survive the within-cell check intact. We argue only that pooled-r should be reported *alongside* within-cell r, and that rubric-dimension claims should be reported *alongside* PCA dimensionality. The practical recommendation is small: add a within-cell-r column to mediator tables, and add a "PCA dimensionality" line to rubric descriptions. With these two additions the field can begin to distinguish family markers from within-cell mediators, and per-dimension claims from underlying-construct claims, more reliably than current practice allows.

# Acknowledgments

This methods paper extracts and generalises material developed during the empirical work reported in @magee2026geist. The application protocol in §5 documents existing analysis scripts; the diagnostic itself was developed iteratively through the five-pass mechanism analysis on the recognition-theoretic apparatus. We thank readers of pre-submission drafts for feedback on the framing of the Simpson's-paradox illustration and on the scope of the rubric over-specification claim.

# Author contributions and conflict-of-interest statement

The author declares no financial conflicts of interest. The recognition-theoretic apparatus that supplies the worked example [@magee2026geist] is the author's prior work; the methods paper extracts and generalises material from that paper without introducing new empirical claims (per the source-of-truth discipline documented in the project's authoring guidelines). All analysis scripts and per-row data referenced in §3 and §5 are open-sourced under the same license as the source apparatus.

# About the author

Liam Magee is a researcher in AI evaluation, specialising in mediator analysis and methodological transparency for LLM-as-judge pipelines. The recognition-theoretic apparatus that supplies the worked example for this paper is the author's primary research programme; the present methods paper documents and generalises one strand of methodological infrastructure developed in that programme.

# References
