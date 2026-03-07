---
title: "*Geist* in the Machine"
subtitle: "Mechanism Tracing in Recognition-Oriented\\newline AI Tutoring Architectures"
author: "Liam Magee"
institute: "Education Policy, Organization and Leadership\\newline University of Illinois Urbana-Champaign"
date: "March 2026"
version: "1.0.0"
bibliography: references.bib
csl: apa.csl
theme: "metropolis"
aspectratio: 169
toc: false
header-includes:
  - \input{slides-header.tex}
---

## From "Does It Work?" to "How Does It Work?"

\vspace{0.5em}

A companion pilot study established that recognition-enhanced prompts produce **large effects** on AI tutoring quality:

\vspace{0.3em}

- $2 \times 2 \times 2$ factorial (N=4,312): \alert{d = 1.11}, recognition $\eta^2 = .243$
- Memory isolation (N=120): recognition d=1.71, memory d=0.46
- Cross-judge replication with GPT-5.2: same directions, compressed magnitudes

\vspace{0.5em}

These results are \alert{robust but opaque}. They show *something* is happening --- but not *why*.

\vspace{0.3em}

**This paper:** trace the mechanisms through which recognition-oriented design alters system behavior.

---

## Three Senses of "Recognition"

\vspace{0.5em}

:::::::::::::: {.columns}
::: {.column width="33%"}

\alert{1. Philosophical inspiration}

Hegel's mutual recognition: genuine understanding requires acknowledging the Other as autonomous.

:::
::: {.column width="33%"}

\alert{2. Design heuristic}

Prompt instructions: "engage with the learner's interpretation," "pose questions rather than provide answers."

:::
::: {.column width="34%"}

\alert{3. Discourse effects}

What the prompts measurably *do*: more questions, less variable output, substantive revision.

:::
::::::::::::::

\vspace{0.5em}

Empirical claims concern \alert{level 3}. Hegel motivates the design; we measure the discourse effects.

---

## Three Candidate Mechanisms

\vspace{0.5em}

| Mechanism | Level | Prediction |
|-----------|-------|------------|
| **M1: Calibration** | Prompt | Narrows output distribution; floor-lifting |
| **M2: Error Correction** | Architecture | Superego catches failures ego can't self-correct |
| **M3: Adaptive Responsiveness** | Interaction | Turn-by-turn quality improvement over time |

\vspace{0.5em}

Each maps to a different level of the architecture:

- M1 operates without a superego (prompt-level)
- M2 requires ego-superego exchange (architecture-level)
- M3 requires multi-turn dialogue (interaction-level)

\vspace{0.3em}

The $2 \times 2$ factorial (recognition $\times$ architecture) isolates M1 from M2.

---

## Architecture and Observability

\vspace{0.5em}

:::::::::::::: {.columns}
::: {.column width="50%"}

**Bilateral ego-superego**

- Tutor: ego generates $\to$ superego critiques $\to$ ego revises
- Learner: ego reacts $\to$ superego challenges $\to$ ego refines
- Every exchange logged with verbatim text

:::
::: {.column width="50%"}

**Process tracing toolkit**

- 10-category superego critique taxonomy
- Revision delta analysis (R1 $\to$ R2)
- Turn-by-turn trajectory curves
- 119 provable discourse claims

:::
::::::::::::::

\vspace{0.5em}

**Design**: research instrument for mechanism observability, not a deployable system.

~225K input tokens per 10-turn multi-agent dialogue.

---

## Evaluation Design

\vspace{0.5em}

**Three generation models** (structurally different):

- DeepSeek V3.2 (685B MoE, open-weight) --- N=146
- Haiku 4.5 (proprietary, speed-optimized) --- N=163
- Gemini Flash (proprietary, multimodal) --- N=144

\vspace{0.3em}

**Three independent judges**: Sonnet 4.6, Gemini 3.1 Pro, GPT-5.4

\vspace{0.3em}

**Total**: 1,296 scored rows (3 runs $\times$ 3 judges $\times$ 144 rows), \alert{zero nulls}

\vspace{0.3em}

**Rubric**: v2.2 --- 8 tutor dimensions (GuideEval P$\to$O$\to$E + content accuracy)

---

## M1: Calibration --- Supported

\vspace{0.5em}

Recognition-oriented prompts \alert{narrow the output distribution}:

\vspace{0.3em}

| Metric | Base | Recognition | Effect |
|--------|------|-------------|--------|
| Within-response SD (DeepSeek) | 0.619 | 0.539 | d=0.52 |
| Within-response SD (Haiku) | 0.617 | 0.499 | d=0.64 |

\vspace{0.3em}

- **Floor-lifting**: weakest dimensions improve most; strong dimensions stable
- Dimension rank preserved (Spearman $\rho$=0.95)
- Operates identically \alert{without a superego} --- purely prompt-level
- Recognition 9/9 judge $\times$ run cells unanimous (d=1.34--1.92)

---

## M1: The Behavioral Signature

\vspace{0.5em}

Recognition-oriented prompts produce \alert{5.4$\times$ more questions per turn}:

\vspace{0.3em}

| Model | Base q/turn | Recog q/turn | Ratio |
|-------|------------|--------------|-------|
| DeepSeek | 0.06 | 0.39 | 6.2$\times$ |
| Haiku | 0.25 | 0.89 | 3.6$\times$ |
| Gemini Flash | 0.03 | 0.65 | \alert{19.8$\times$} |

\vspace{0.3em}

- **Mediation**: 42.4% of first-turn effect through question-asking (Sobel z=8.46)
- Question rates **flat across turns** $\to$ prompt-level effect, not adaptive
- Largest effects in impasse scenarios (Epistemic Resistance +38.3, Productive Deadlock +34.9)

---

## M2: Error Correction --- Supported (Model-Dependent)

\vspace{0.5em}

Superego approval rates shift under recognition:

- DeepSeek: 13% $\to$ \alert{55\%}
- Haiku: 52% $\to$ \alert{66\%}

\vspace{0.3em}

Calibration pre-empts the errors the superego would catch.

\vspace{0.5em}

**Universal substitution** (15--17% additivity deficit across all 3 models):

\vspace{0.3em}

| Model | Superego benefit (base) | Superego benefit (recog) | Residual |
|-------|------------------------|--------------------------|----------|
| DeepSeek | +9.4 | +0.9 | $\approx 0$ |
| Haiku | +6.8 | +1.2 | $\approx 0$ |
| Gemini Flash | +14.8 | \alert{+12.3} | Substantial |

\vspace{0.3em}

Weaker models retain residual: calibration alone can't handle all failure modes.

---

## M2: Mechanism Isolation

\vspace{0.5em}

Dedicated isolation runs (N=108, DeepSeek, 9 scenarios):

\vspace{0.3em}

:::::::::::::: {.columns}
::: {.column width="50%"}

**Superego under base**

- Adds \alert{+9.2 pts} (d=1.13, p=.002)
- Catches content leakage, sycophancy, generic responses

:::
::: {.column width="50%"}

**Superego under recognition**

- Adds +1.1 pts (d=0.08, NS)
- Calibration pre-empts \alert{88\%} of its contribution

:::
::::::::::::::

\vspace{0.5em}

Head-to-head: calibration alone (51.4) outscores error correction alone (36.9) by d=1.03 in 7/9 scenarios.

\vspace{0.3em}

$\Rightarrow$ On strong models, the multi-agent architecture becomes largely \alert{redundant} under recognition.

---

## M3: Adaptive Responsiveness --- Not a General Mechanism

\vspace{0.5em}

Formal tests on N=432 dialogues (3--5 turns):

\vspace{0.3em}

- Recognition on tutor slopes: \alert{d = 0.03}
- All factors $\times$ all dimensions: d $\leq$ 0.15
- Well-powered to detect d $\geq$ 0.27
- Replicated across all three judges

\vspace{0.5em}

Both conditions adapt substantially (AdaptΔ > 0.79), but at \alert{similar rates}.

\vspace{0.3em}

Recognition sets the **level** higher (T0: 62.4 vs 41.6) without changing the **slope**.

---

## M3: Conditional Emergence

\vspace{0.5em}

In trajectory-specific scenarios (N=72, 8--10 turns):

\vspace{0.3em}

| Scenario | Turns | Slope d | Gap at T0 | Gap at final turn |
|----------|-------|---------|-----------|-------------------|
| Disengagement | 10 | \alert{1.63***} | +12 pts | \alert{+35 pts} |
| Frustration → breakthrough | 8 | 0.30 | +15 pts | +18 pts |
| Epistemic resistance | 8 | 0.15 | +20 pts | +22 pts |

\vspace{0.3em}

M3 is a \alert{conditional emergent property} of M1+M2 accumulating over sufficient turns in scenarios demanding sustained re-engagement.

\vspace{0.3em}

$\Rightarrow$ The three-mechanism model resolves to **two general mechanisms and one conditional property**.

---

## Tutor-Learner Asymmetry

\vspace{0.5em}

Both supported mechanisms operate on \alert{tutor production}:

\vspace{0.3em}

| Model | Tutor d | Learner d | Ratio |
|-------|---------|-----------|-------|
| DeepSeek | 1.88 | 0.25 | 7.5 : 1 |
| Haiku | 1.84 | 0.16 | 11.5 : 1 |
| Gemini Flash | 1.87 | \alert{1.20} | \alert{1.6 : 1} |

\vspace{0.5em}

**Generation-quality threshold**: When base tutors are catastrophically weak (Gemini Flash base $\approx$ 17 pts), recognition-enhanced prompts rescue the tutor's output quality, and improved output elicits better learner engagement.

\vspace{0.3em}

On strong models, even base tutors produce adequate output $\to$ learner quality is already at ceiling.

---

## Cross-Judge Validation

\vspace{0.5em}

Three independent judges $\times$ three generation models = \alert{9 cells, all unanimous}:

\vspace{0.3em}

- Recognition effect: d = 1.34--1.92 across all 9 cells
- Inter-judge r = 0.45--0.89
- Universal substitution pattern replicates in all 3 judges
- Leniency gradient: Gemini Pro (lenient) $>$ Sonnet $>$ GPT-5.4 (severe)

\vspace{0.5em}

The leniency gradient is \alert{judge-specific, not run-specific} --- confirms judge calibration rather than data artifact.

---

## The Apparatus as Method

\vspace{0.5em}

:::::::::::::: {.columns}
::: {.column width="50%"}

**Provable discourse**

- 119 machine-verified claims
- 18 evidence adapter types
- Staleness fingerprints detect data drift
- Claims are a contract between text and data

:::
::: {.column width="50%"}

**Self-correcting apparatus**

- 9 post-extraction corrections in pilot
- 4 rubric iterations (v1 $\to$ v2.2)
- Test suite as analytical provenance
- Framework as "research superego"

:::
::::::::::::::

\vspace{0.5em}

The apparatus mirrors the mechanisms it studies: error correction (catching stale claims) and substantive revision (rubric iteration).

---

## What Recognition Explains and What It Does Not

\vspace{0.5em}

:::::::::::::: {.columns}
::: {.column width="50%"}

\alert{What the design heuristic explains}

- Calibrated output (d=0.52--0.64)
- Superego collapse under recognition
- Largest effects in impasse scenarios
- Tutor-learner asymmetry

:::
::: {.column width="50%"}

\alert{What it does not explain}

- Near-identical d across 3 models (1.84--1.92)
- M3 null despite theoretical motivation
- Learner superego paradox (d=3.05)

:::
::::::::::::::

\vspace{0.5em}

These anomalies suggest the supported mechanisms may be surface expressions of a deeper process --- perhaps how recognition framing restructures the model's attention over its input context.

---

## Key Limitations

\vspace{0.5em}

1. **Synthetic learners** --- mechanisms trace tutor-internal processes; pedagogical significance awaits human learner validation

2. **Recursive evaluation** --- mechanism claims are LLM-assessed claims about LLM-internal processes; human expert coding (30--50 exchanges, Cohen's $\kappa$) is the most important outstanding validation

3. **Prompt density** --- recognition prompt is ~5,100 tokens; four evidence lines against crude reduction, but content and density are not fully separable

4. **Model transience** --- findings are model-version-specific (mitigated by 3-model $\times$ 3-judge replication)

---

## Conclusion

**Two mechanisms supported, one conditionally:**

- \alert{Calibration}: prompt-level output distribution narrowing (d=0.52--0.64)
- \alert{Error correction}: architecture-level critique with universal substitution (15--17% deficit)
- \alert{Adaptive responsiveness}: conditional property over 10+ turns in re-engagement scenarios

\vspace{0.3em}

**Three contributions:**

1. Mechanism-level account of recognition-oriented AI tutoring (moving from "whether" to "how")
2. Process tracing adapted for AI agent architectures
3. Provable discourse as transferable methodology for mechanistic LLM evaluation

\vspace{0.2em}

\footnotesize All findings concern tutor output quality as assessed by LLM judges interacting with synthetic learners.

---

## {.standout}

Thank you

\vspace{1em}

\normalsize

Full paper, codebase, and evaluation data available at:

\texttt{github.com/lmagee/machinespirits-eval}

\vspace{1em}

\footnotesize

Liam Magee --- University of Illinois Urbana-Champaign

lmagee@illinois.edu
