---
title: "*Geist* in the Machine: Mechanism Tracing in Recognition-Oriented AI Tutoring"
author: "Liam Magee"
date: "April 2026"
version: "1.1.1"
bibliography: references.bib
csl: apa.csl
link-citations: true
abstract: |
  A companion study established that recognition-enhanced prompts and multiagent architecture produce large effects on AI tutoring quality (d=1.11, N=4,312). This paper asks: *through what mechanisms?* We motivate three candidate mechanisms drawing on Hegel's recognition theory---calibration (prompt-level), error correction (architecture-level), and adaptive responsiveness (interaction-level)---and test them using process tracing adapted for AI agent architectures. Across a $2 \times 2$ factorial with three generation models (DeepSeek V3.2, Haiku 4.5, Gemini Flash 3.0; N=453) and three independent judges (1,296 scored rows), **two mechanisms are supported and one is null on the primary pre-registered analysis with a pending boundary-condition finding awaiting replication**. Calibration narrows within-response variance (d=0.52--0.64) and operates independently of architecture. Error correction interacts with calibration through universal substitution: the superego's benefit diminishes under recognition (15--17% additivity deficit across all models), though a model-dependent residual persists on weaker models (+12.3 pts on Gemini Flash 3.0). Adaptive responsiveness is not supported as a general mechanism (all d $\leq$ 0.15 on N=432, well-powered to detect d $\geq$ 0.27); an exploratory analysis of 10-turn disengagement scenarios shows a scenario-conditional effect (d=1.63, $p \approx .0006$) surviving Holm--Bonferroni correction but resting on one model, one judge, and one scenario and reported as pending replication. Both supported mechanisms operate on tutor production: on strong models, tutor effects are 7--12$\times$ larger than learner effects. Effect magnitudes are judge-dependent (Sonnet-judge d $\approx$ 1.88; Gemini-3.1-Pro-judge d $\approx$ 1.44; GPT-5.4-judge d $\approx$ 1.56; pooled d $\approx$ 1.63) though direction replicates in all 9 judge $\times$ run cells. All findings concern tutor output quality as assessed by LLM judges interacting with synthetic learners.
fontsize: 12pt
geometry: margin=1in
header-includes: |
  \usepackage{float}
  \floatplacement{figure}{H}
---

# *Geist* in the Machine: Mechanism Tracing in Recognition-Oriented AI Tutoring

*This is a condensed version of the full paper. For complete results, appendices, system prompts, and reproducibility commands, see the full paper.*

## 1. Introduction

The dominant paradigm in AI-assisted education treats learning as information transfer, with learners as passive recipients. This paper proposes an alternative grounded in Hegel's theory of mutual recognition [@Hegel1977PhenomenologyMiller], where genuine understanding requires acknowledging the other as an autonomous subject. We operationalize this as concrete design heuristics for AI tutoring systems---and then trace the *mechanisms* through which those heuristics alter system behavior.

A terminological clarification: "recognition" operates at three nested levels in this paper. First, as **philosophical inspiration** from Hegel's account of mutual recognition. Second, as **operational design heuristic**---prompt instructions and architectural choices that treat learners as autonomous subjects. Third, as **observable discourse effects**---what the prompts measurably do (more questions, less variable output, substantive revision). The empirical claims concern primarily the third level. We do not claim the system instantiates mutual recognition in Hegel's philosophical sense; we claim that design heuristics drawn from recognition theory produce measurable and traceable effects on system behavior.

### The explanatory gap

A companion pilot study [@magee2026geist] established that recognition-enhanced prompts produce large effects (d=1.11, N=4,312) but did not explain *why*. Five findings resist ablative explanation: the tutor-learner asymmetry, opaque superego function, model-dependent architecture effects, unknown trajectory dynamics, and unexamined deliberation-output relationships.

### Three candidate mechanisms

We motivate three candidate mechanisms drawing on recognition theory:

1. **Calibration** (prompt-level): Recognition-oriented prompts narrow the tutor's output distribution, producing more uniform quality. The prompt constrains responses to engage with the specific learner, eliminating high-variance generic approaches.

2. **Error correction** (architecture-level): The superego provides structurally external feedback [@kamoi2024selfcorrection], but its effectiveness depends on ego receptivity. Recognition theory predicts substantive revision under recognition versus cosmetic compliance under baseline.

3. **Adaptive responsiveness** (interaction-level): Recognition's temporal unfolding predicts increasing quality across turns as the tutor adapts to learner-specific signals.

## 2. System Architecture and Methodology

### Architecture

The system implements a bilateral ego-superego architecture for both tutor and learner. The tutor ego generates pedagogical responses; an optional superego critiques for pedagogical soundness; the ego revises. Every exchange is logged with verbatim text, creating the observability needed for process tracing.

The $2 \times 2$ factorial (recognition $\times$ architecture) maps directly to mechanism isolation: single-agent cells test calibration alone; multi-agent cells test calibration + error correction; multi-turn dialogues test all three mechanisms. The architecture is a research instrument for mechanism observability (~225,000 input tokens per 10-turn dialogue), not a deployable tutoring system.

### Process tracing methodology

We adapt process tracing from comparative politics [@bennett2015process] for AI agent architectures, combining three analytical methods: a **superego critique taxonomy** classifying what the superego objects to (10 categories), **revision delta analysis** measuring ego output changes after critique, and **turn-by-turn trajectory analysis** testing whether adaptation accumulates across conversations. Every mechanistic claim is registered in a provable discourse framework (119 claims, 18 evidence adapter types) that machine-verifies assertions against data.

### Evaluation design

Three structurally different generation models (DeepSeek V3.2, 685B MoE; Haiku 4.5, proprietary; Gemini Flash, multimodal) scored by three independent judges (Claude Sonnet 4.6, Gemini 3.1 Pro, GPT-5.4). Total: N=453 dialogues, 1,296 scored rows (3 runs $\times$ 3 judges $\times$ 144 rows), zero nulls. Rubric v2.2: 8 tutor dimensions using GuideEval P$\to$O$\to$E decomposition plus content accuracy.

## 3. Results

### 3.1 Calibration (Mechanism 1)

Recognition-enhanced prompts narrow within-response dimension spread from SD=0.619 to SD=0.539 (d=0.52, medium effect, DeepSeek). The effect replicates on Haiku (d=0.64). The pattern is **floor-lifting**: the weakest dimensions under baseline improve most under recognition, while already-strong dimensions remain stable. Dimension rank order is preserved (Spearman $\rho$=0.95), indicating calibration shifts the *level* without changing the *structure* of quality.

The effect operates identically without a superego---single-agent and multi-agent cells show equivalent variance reduction---confirming calibration as a prompt-level mechanism independent of architecture.

**Behavioral signature.** Recognition-oriented prompts produce 5.4$\times$ more questions per turn (0.63 vs 0.10 pooled; Gemini Flash: 19.8$\times$). A formal mediation analysis shows 42.4% of the first-turn recognition effect is mediated through question-asking frequency (Sobel z=8.46, p<.001). Question rates are flat across turns, consistent with a prompt-level (not adaptive) mechanism.

**Scenario effects.** The largest effects appear in impasse scenarios---Epistemic Resistance (+38.3) and Productive Deadlock (+34.9)---where the learner actively resists. The smallest appear in Misconception Correction (+13.6) and Mood scenarios (+13.4). Recognition-oriented prompts require the tutor to engage with the specific content of the learner's contribution, and this specificity matters most when the contribution is resistant or adversarial.

### 3.2 Error Correction (Mechanism 2)

Superego approval rates shift dramatically under recognition (DeepSeek: 13%$\to$55%; Haiku: 52%$\to$66%), consistent with a calibrated ego producing fewer errors for the superego to catch. A 10-category critique taxonomy reveals condition-dependent patterns: under baseline, the superego primarily critiques scaffolding and engagement quality; under recognition, these categories become rare as calibration pre-empts the failures.

**Universal substitution.** The superego provides +9--15 points under baseline but its marginal value diminishes under recognition, with a consistent 15--17% additivity deficit across all three models (DeepSeek 15%, Haiku 16%, Gemini Flash 17%). However, the residual architecture benefit under recognition is model-dependent: near-zero on strong models but +12.3 points on Gemini Flash, where base quality is low enough that calibration alone cannot handle all failure modes.

**Mechanism isolation.** Dedicated isolation runs (N=108, DeepSeek, 9 scenarios) confirm: superego adds +9.2 pts under base (d=1.13, p=.002) but +1.1 under recognition (d=0.08, NS)---calibration pre-empts 88% of the superego's contribution. Calibration alone (51.4) outscores error correction alone (36.9) by d=1.03 in 7/9 scenarios.

**Mechanistic account.** The 15--17% additivity deficit corresponds to the critique-category overlap where calibration operationalises what the superego was catching (vagueness, elicitation, content accuracy). The model-dependent residual tracks post-calibration error headroom: strong models (DeepSeek, Haiku) have little headroom left for the superego to capture, while Gemini Flash 3.0's weaker base leaves affective-attunement gaps that the recognition prompt does not fully pre-empt. See the full paper for the taxonomy-level breakdown.

### 3.3 Adaptive Responsiveness (Mechanism 3)

**Null on the primary pre-registered analysis.** Formal tests on N=432 multi-turn dialogues (3--5 turns) find that no experimental factor modulates within-dialogue trajectories: recognition d=0.03 on tutor slopes, all factors d $\leq$ 0.15, well-powered to detect d $\geq$ 0.27. Cross-judge validation confirms the null across all three judges.

Both recognition and baseline tutors adapt substantially (AdaptΔ > 0.79), but at similar rates. Recognition sets the level higher (T0: 62.4 vs 41.6) without changing the slope. The recognition condition operates through *calibration*---setting the initial level---not *adaptation*---driving within-dialogue improvement.

**Pending boundary-condition finding requiring replication.** An exploratory analysis of three trajectory-specific scenarios (N=72, 8--10 turns, DeepSeek V3.2 generation, Sonnet judge only) reveals a scenario-conditional effect in one scenario: the 10-turn disengagement scenario produces dramatically steeper recognition slopes (d=1.63, $t(21.9)=3.99$, $p \approx .0006$), with the gap widening from +12 pts at T0 to +35 pts at T8--T10. The effect survives Holm--Bonferroni correction across the three scenario tests (family-wise $\alpha = 0.05$, so threshold $\alpha/3 = 0.0167$); the two 8-turn scenarios are null ($d \leq 0.30$). Because this rests on one model, one judge, one scenario, and n=12 per condition, we report it as **a pending boundary-condition finding requiring replication** rather than a validated third mechanism. The three-mechanism model therefore resolves to two supported general mechanisms and one pre-registered mechanism that is null on the primary analysis, with a pending boundary-condition effect awaiting replication.

### 3.4 Tutor-Learner Asymmetry

Both supported mechanisms operate on tutor production. The asymmetry is model-dependent:

| Model | Tutor d | Learner d | Ratio |
|-------|---------|-----------|-------|
| DeepSeek (N=146) | 1.88 | 0.25 | 7.5:1 |
| Haiku (N=163) | 1.84 | 0.16 | 11.5:1 |
| Gemini Flash (N=144) | 1.87 | 1.20 | 1.6:1 |

The Gemini Flash result suggests a generation-quality floor: when base-condition tutors produce such poor output that the learner has little productive material to engage with, recognition-enhanced prompts rescue the tutor's output quality, and the improved output elicits better learner engagement. On strong models, even base-condition tutors produce adequate output, so learner quality is near its ceiling regardless.

### 3.5 Cross-Judge Validation

Recognition effect directions replicate unanimously across all 9 judge $\times$ run cells (d=1.34--1.92). Inter-judge Pearson correlations range from r=0.45 to r=0.89. The universal substitution pattern (15--17% additivity deficit) replicates across all three judges. A consistent leniency gradient emerges: Gemini 3.1 Pro most lenient, GPT-5.4 most severe, Sonnet intermediate.

**Per-judge effect-size decomposition.** Absolute magnitudes are judge-dependent even though direction is conserved. Decomposing the 1.34--1.92 range by (run $\times$ judge) cell yields judge-mean effects of Sonnet 4.6 d $\approx$ 1.88, GPT-5.4 d $\approx$ 1.56, Gemini 3.1 Pro d $\approx$ 1.44, with within-row $\Delta d$ of 0.47--0.58 (exceeding the 0.1 $d$ robustness threshold in every generation run). The judge-adjusted pooled estimate is d $\approx$ 1.63. Sonnet-only historical results are an upper bound, Gemini-3.1-Pro-only results a lower bound, and future replications should pre-register the judge panel and report per-judge effect sizes rather than pooling under a single judge.

## 4. Discussion

### From effects to mechanisms

The three-mechanism model resolves to **two general mechanisms and one pre-registered mechanism that is null on the primary analysis, with a pending boundary-condition effect awaiting replication**:

- **Calibration** operates at the prompt level, narrowing output variance and lifting the quality floor. It accounts for the majority of the recognition effect and is independent of architecture.
- **Error correction** operates at the architecture level, catching failures the ego cannot self-correct. It interacts with calibration through universal substitution: on strong models, calibration pre-empts the errors the superego would catch, making the multi-agent architecture largely redundant.
- **Adaptive responsiveness** is null on the primary analysis (all $d \leq 0.15$ on N=432, well-powered). An exploratory 10-turn disengagement finding (d=1.63, one model, one judge, one scenario) is a pending boundary-condition effect, not a validated general mechanism.

### What the design heuristic explains and what it does not

**What it explains:** Why intersubjective prompts produce calibrated output. Why the superego's benefit collapses under recognition. Why impasse scenarios show the largest effects.

**What it does not explain:** Why effect magnitude is near-identical across structurally different models (DeepSeek d=1.88, Haiku d=1.84, Gemini Flash d=1.92). Why adaptive responsiveness fails as a general mechanism. Why the learner superego paradox (d=3.05) degrades rather than improves quality.

### The apparatus as method

A distinctive contribution is the evaluation apparatus itself. The provable discourse framework (119 claims, 18 evidence adapters) machine-verifies every paper claim against data. Nine post-extraction corrections during the pilot study follow the same error-correction pattern observed in the architecture---the framework functions as a "superego" for research claims, forcing genuine revision rather than cosmetic compliance. Four rubric iterations (v1$\to$v2$\to$v2.1$\to$v2.2), each driven by specific construct-validity failures, mirror the error correction mechanism the paper studies. This reflexive structure is not incidental but a consequence of the subject matter.

## 5. Limitations

**Synthetic learners.** All evaluations use LLM-generated learner turns. The supported mechanisms trace tutor-internal processes observable regardless of learner type, but pedagogical significance awaits human learner validation.

**Recursive evaluation.** Mechanism claims are LLM-assessed claims about LLM-internal processes. Cross-judge validation mitigates this for factorial-level claims (9/9 cells unanimous), but process-level claims (critique taxonomy, revision quality) remain unvalidated by human expert coding. The pilot apparatus is operationalised in the repository (`scripts/human-validation-sample.js` for stratified sampling, `docs/research/human-coding-codebook.md` v1.0 for the per-category codebook, `scripts/human-validation-analyze.js` for Cohen's $\kappa$ / Fleiss' $\kappa$ / per-category F1 / confusion matrices, plus an inter-LLM κ baseline as lower-bound reference). Target floor: $\kappa \geq 0.60$. Execution cost reduces to rater recruitment + ~1 hour/rater; rater data is the only remaining step.

**Prompt density.** The recognition prompt (~5,100 tokens) is substantially larger than the baseline. Four evidence lines argue against reducing the effect to prompt density: placebo control (length-matched, no recognition theory), prompt elaboration baseline (344-line base hurts strong models), autotuning (gap widens under optimization), and mediation (42.4% through question-asking). However, prompt content and prompt density are not fully separable.

**Model transience.** Findings are model-version-specific, though three-model $\times$ three-judge replication strengthens generalizability. The "general mechanism" claim is scoped to the tested capability tier (a ~30-point baseline range spanning open-weight mid-sized to proprietary-compact models); a fourth-model replication at the frontier tier (Opus-, GPT-5.4-class generator) would test whether recognition saturates against an already-calibrated strong model.

**Rubric single-construct structure.** Principal components analysis on 1,584 per-turn observations shows the 8 v2.2 tutor dimensions largely measure a single construct (PC1 = 80.7%, one Kaiser factor, mean inter-dimension r = 0.776). Calibration's variance-reduction effect is meaningful *because* the dimensions co-vary, but dimension-targeted prompt optimisation (engineering a specific pedagogical skill) should be read as shifting the single underlying quality factor through prompt wording, not moving one skill while others are held constant.

**Reproduction cost.** The evaluation apparatus is inexpensive to reproduce at the LLM-judge tier: the three core generation runs cost \$114.58 on OpenRouter pass-through pricing (recorded), and full core reproduction including a 3-judge panel falls in the \$500--1,500 range at late-2026 API rates. The genuine replication barrier is human-learner validation (~\$20K--50K at N=200) and human-expert rater coding for the superego-critique taxonomy, not compute.

## 6. Conclusion

Recognition theory, operationalized as a design heuristic rather than an ontological claim, provides a framework for building AI systems whose outputs are specifically adapted to user input rather than generically responsive. Two mechanisms are supported: calibration (prompt-level output distribution narrowing) and error correction (architecture-level critique with universal substitution and model-dependent residual). Adaptive responsiveness is null on the primary pre-registered analysis, with a pending boundary-condition effect (10-turn disengagement, single model, single judge) awaiting replication. Three findings remain unexplained: the model-dependent residual architecture benefit (why Gemini Flash 3.0 alone retains +12.3 pts of superego benefit under recognition), the M3 primary null, and the learner superego paradox (d=3.05).

Four directions are most pressing: replicating the pending M3 boundary-condition effect on additional models and judges, executing the now-operationalised human-coding pilot (§5 Limitations; infrastructure delivered, rater data outstanding), human-learner validation (the genuine replication barrier at ~\$20K--50K per N=200 cohort), and a frontier-tier fourth-model replication to test whether recognition saturates against an already-calibrated strong generator. The methodological contribution---process tracing adapted for agent architectures, provable discourse for machine-verifiable research claims, with judge-adjusted rather than judge-pooled effect-size reporting---is transferable regardless of domain.

## References

::: {#refs}
:::
