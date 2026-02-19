---
title: "*Geist* in the Machine"
subtitle: "Mutual Recognition and Multiagent Architecture\\newline for Dialectical AI Tutoring"
author: "Liam Magee"
institute: "Education Policy, Organization and Leadership\\newline University of Illinois Urbana-Champaign"
date: "February 2026"
bibliography: references.bib
csl: apa.csl
theme: "metropolis"
aspectratio: 169
toc: false
header-includes:
  - \input{slides-header.tex}
---

## The Problem

\vspace{0.5em}

Current AI tutoring treats learners as **knowledge deficits** to be filled.

\vspace{0.5em}

- Learner says something interesting $\rightarrow$ tutor redirects to curriculum
- Learner struggles $\rightarrow$ tutor simplifies or restates
- Learner resists $\rightarrow$ tutor notes "engagement metrics" and moves on

\vspace{0.5em}

\alert{The learner is never encountered as a subject.}

This maps onto Hegel's master--slave dialectic: the master (tutor) consumes the slave's (learner's) labor without genuine encounter.

---

## Hegel's Alternative: Mutual Recognition

\vspace{0.5em}

**Recognition** (*Anerkennung*): each party acknowledges the other as an autonomous consciousness whose understanding has intrinsic validity.

\vspace{0.5em}

:::::::::::::: {.columns}
::: {.column width="50%"}

**What it is**

- A \alert{relational stance}
- How the tutor constitutes the learner
- Achievable without consciousness

:::
::: {.column width="50%"}

**What it is not**

- Not agreement --- can disagree while recognizing
- Not affirmation --- "good job!" is not recognition
- Not a consciousness requirement

:::
::::::::::::::

---

## The Drama Machine

\vspace{0.5em}

:::::::::::::: {.columns}
::: {.column width="48%"}

\begin{block}{Ego (Response Generator)}
\begin{itemize}
\item Generates pedagogical suggestions
\item Has \textbf{final authority} over output
\item Can override or incorporate Superego feedback
\end{itemize}
\end{block}

:::
::: {.column width="48%"}

\begin{block}{Superego (Internal Critic)}
\begin{itemize}
\item Evaluates Ego's draft
\item Checks pedagogical quality
\item Structured critique: approve / revise / reject
\end{itemize}
\end{block}

:::
::::::::::::::

\vspace{0.5em}

\alert{Recognition prompts} add Hegelian theory to both Ego and Superego:

- *"Acknowledge the learner as an autonomous subject..."*
- *"Evaluate whether the response treats the learner's understanding as having intrinsic validity..."*

---

## Phase 2: Advanced Mechanisms

\vspace{0.3em}

Nine architectural mechanisms tested beyond base Ego/Superego:

\vspace{0.3em}

\footnotesize

| Mechanism | What it does |
|:----------|:-------------|
| Self-reflection | Ego reviews own prior performance |
| Bidirectional profiling | Theory of Mind models of each party |
| Intersubjective recognition | Explicit other-awareness prompts |
| Combined (all three) | Full mechanism stack |
| Cross-turn superego memory | Superego retains conversation context |
| Prompt rewriting | Dynamic prompt evolution mid-dialogue |
| Quantitative disposition | Numeric stance tracking |
| Prompt erosion | Gradual prompt degradation test |

\normalsize

---

## Evaluation Design

\vspace{0.5em}

**37 evaluations**, N=3,383 primary scored responses

\vspace{0.5em}

:::::::::::::: {.columns}
::: {.column width="55%"}

- **2\texttimes 2\texttimes 2 factorial** (N=350)
  - Recognition \texttimes{} Architecture \texttimes{} Learner type
- **Memory isolation** (N=120)
  - Disentangle recognition from episodic memory
- **Multi-model probe** (N=655)
  - 5 ego models, architecture held constant

:::
::: {.column width="45%"}

- **Dynamic learner tests** (N=660)
  - Mechanisms with feedback-capable learners
- **Cross-judge replication** (N=977)
  - GPT-5.2 independent validation
- **14-dimension rubric**
  - Scored by Claude Opus 4.6

:::
::::::::::::::

---

## Finding 1: Memory Isolation (The Definitive Finding)

\vspace{0.3em}

2\texttimes 2 design (N=120, 30/cell) disentangles recognition from episodic memory:

\vspace{0.5em}

\centering

|  | No Memory | Memory |
|:--|:-----------:|:--------:|
| **No Recognition** | 75.4 | 80.2 |
| **Recognition** | \alert{90.6} | \alert{91.2} |

\raggedright

\vspace{0.5em}

- **Recognition**: \alert{+15.2 pts}, d=1.71, p<.001
- **Memory**: +4.8 pts, d=0.46, n.s.
- **Interaction**: --4.2 pts (ceiling effect, not synergy)

Recognition alone accounts for nearly the entire improvement.

---

## Finding 2: Full Factorial (2\texttimes 2\texttimes 2)

\vspace{0.3em}

N=350, Kimi K2.5 ego, Opus 4.6 judge:

\vspace{0.3em}

\footnotesize

| Cell | Recog | Arch | Learner | M (SD) |
|:------:|:-------:|:------:|:---------:|:--------:|
| 1 | -- | Single | Single | 73.4 (16.2) |
| 2 | -- | Multi | Single | 69.9 (23.3) |
| 3 | -- | Single | Multi | 75.5 (15.2) |
| 4 | -- | Multi | Multi | 75.2 (18.1) |
| 5 | + | Single | Single | \alert{90.2} (7.1) |
| 6 | + | Multi | Single | \alert{83.9} (18.1) |
| 7 | + | Single | Multi | \alert{90.1} (7.1) |
| 8 | + | Multi | Multi | \alert{87.3} (10.3) |

\normalsize

**Recognition**: \alert{+14.4 pts}, F(1,342)=110.04, p<.001, $\eta^2$=.243, d=1.11

---

## Finding 3: Architecture is Additive

Multi-model probe (N=655, 5 ego models):

\vspace{0.3em}

\footnotesize

| Model | Base | +Arch | +Recog | +Both | A\texttimes B |
|:-------|:------:|:-------:|:--------:|:-------:|:-----:|
| Kimi K2.5 | 73.4 | 75.5 | \alert{90.2} | 90.1 | +0.5 |
| Haiku | 78.2 | 81.9 | \alert{93.3} | 93.5 | --3.7 |
| DeepSeek-R1 | 71.1 | 71.3 | \alert{88.9} | 83.2 | --5.7 |
| GLM-4.7 | 63.9 | 62.2 | \alert{73.5} | 74.9 | +3.1 |
| Nemotron | 62.3 | 62.6 | \alert{78.2} | 72.5 | --5.7 |

\normalsize

- A\texttimes B interaction: --5.7 to +3.1 (mean --1.8) --- \alert{no synergy}
- Recognition range: +9.6 to +17.8 across all models

---

## Finding 4: Domain Generalizability

Recognition effect across 6 tutorial domains (N=60):

\vspace{0.3em}

\footnotesize

| Domain | Base | Recog | $\Delta$ |
|:--------|:------:|:-------:|:---:|
| Climate science | 72.0 | 93.8 | \alert{+21.8} |
| Ethics | 72.3 | 89.3 | \alert{+17.0} |
| Mathematics | 73.0 | 89.2 | \alert{+16.2} |
| Philosophy | 75.2 | 89.7 | \alert{+14.5} |
| Machine learning | 78.0 | 91.5 | \alert{+13.5} |
| Poetry | 86.0 | 92.5 | +6.5 |

\normalsize

\vspace{0.3em}

Strong for conceptual domains (+14 to +22 pts). Weakest for poetry (+6.5) --- high baseline leaves less room for improvement.

---

## Finding 5: Scripted vs. Dynamic Learners

:::::::::::::: {.columns}
::: {.column width="48%"}

\begin{alertblock}{Scripted learners}
\begin{itemize}
\item Pre-written responses
\item 9 mechanisms cluster within 2.4 pts
\item No differentiation --- noise floor
\end{itemize}
\end{alertblock}

:::
::: {.column width="48%"}

\begin{exampleblock}{Dynamic learners}
\begin{itemize}
\item LLM-generated, ego/superego
\item Mechanisms spread 5+ pts
\item Recognition doubles: +7.6 $\rightarrow$ \textbf{+14.8}
\end{itemize}
\end{exampleblock}

:::
::::::::::::::

\vspace{0.5em}

**Lesson**: Mechanism effects require genuine feedback loops to manifest.

---

## Finding 6: Dynamic Learner Mechanisms

Complete 2\texttimes 4 matrix (N=480, Haiku ego, dynamic learner):

\vspace{0.3em}

| Mechanism | Base | Recog | $\Delta$ |
|:-----------|:------:|:-------:|:---:|
| Self-reflection | 72.3 | 85.6 | +13.3 |
| Bidirectional profiling | 74.6 | \alert{88.8} | +14.2 |
| Intersubjective | 67.7 | 82.8 | +15.1 |
| Combined | 73.7 | 87.8 | +14.1 |

\vspace{0.3em}

- Variance collapses with added mechanisms (SD: 22.5 $\rightarrow$ 11.8)
- Recognition $\Delta$ stable (+13.3 to +15.1) regardless of mechanism
- Profiling = highest ceiling; intersubjective = lowest floor

---

## Finding 7: Cognitive Prosthesis Fails

Can a strong Superego (Kimi K2.5) compensate for a weak Ego (Nemotron)?

\vspace{0.5em}

:::::::::::::: {.columns}
::: {.column width="55%"}

\begin{alertblock}{No.}
Full mechanism stack scores \textbf{49.5} ---\\that's \alert{--15 pts below} Nemotron\\simple base (64.2)
\end{alertblock}

:::
::: {.column width="45%"}

- Same mechanisms boost Haiku by **+20 pts**
- Static dims fine (spec 4.0)
- Dynamic dims fail (adaptation 1.8)
- Parse failures: 16--45\% of turns

:::
::::::::::::::

\vspace{0.5em}

**Minimum ego capability threshold**: The mechanisms amplify what the Ego can already do --- they cannot substitute for missing capability.

---

## Finding 8: Cross-Judge Robustness

GPT-5.2 independently rejudged N=977 paired responses:

\vspace{0.3em}

| Finding | Claude | GPT-5.2 | Replicates? |
|:---------|:--------:|:---------:|:-------------:|
| Recognition (memory) | d=1.71 | d=1.54 | Yes |
| Memory effect | d=0.46 | d=0.49 | Yes (small) |
| Architecture effect | +2.6 | --0.2 | Yes (null) |
| Mechanism clustering | 2.8 pt | 4.4 pt | Yes (null) |

\vspace{0.3em}

- Inter-judge r = 0.44--0.64 (all p<.001)
- GPT-5.2 finds 37--59\% of Claude's effect magnitudes
- Always same direction --- \alert{no sign reversals}

---

## What Recognition Looks Like

\vspace{0.5em}

**Base tutor** to a struggling learner:

> "You left off at the neural networks section. Complete this lecture to maintain your learning streak."

\vspace{0.3em}

**Recognition tutor** to the same learner:

> "This is your third session --- you've persisted through quiz-479-3 three times, which signals you're wrestling with how recognition operates in the dialectic..."

\vspace{0.3em}

Three systematic changes:

1. The ego \alert{listens to its internal critic} (superego feedback incorporated)
2. The tutor \alert{builds on learner contributions} (not redirecting to curriculum)
3. \alert{Mid-conversation strategy shifts} occur (30\% of recognition dialogues vs 0\% base)

---

## Dialectical Impasse: The Strongest Test

Three 5-turn scenarios with escalating resistance (N=24):

\vspace{0.3em}

- **Epistemic resistance** (Popperian critique): Recognition \alert{+43 pts}
- **Productive deadlock** (incompatible frameworks): Recognition \alert{+29 pts}
- **Affective shutdown** (emotional retreat): Recognition --1.1 (null)

\vspace{0.3em}

Resolution strategy coding ($\chi^2$=24.00, p<.001, V=1.000):

- **Base**: 12/12 withdraw from encounter entirely
- **Recognition**: 10/12 scaffolded reframing (*Aufhebung*), 1 mutual recognition, 1 domination

\vspace{0.3em}

The null on affective shutdown sharpens the claim: recognition's contribution is **epistemological**, not primarily affective.

---

## The Learner Superego Paradox

\vspace{0.5em}

Multi-agent learner architecture **hurts** learner quality (d=1.43, F=68.28, p<.001):

\vspace{0.3em}

- Designed to improve through internal self-critique
- Actually over-edits --- polishes away messy, authentic engagement
- Recognition partially rescues multi-agent learner (d=0.79, p=.004)

\vspace{0.5em}

\begin{exampleblock}{Hegelian interpretation}
External recognition from an Other is structurally more effective than internal self-critique. You cannot bootstrap genuine dialogue from a monologue.
\end{exampleblock}

---

## Practical Recommendations

\vspace{0.5em}

:::::::::::::: {.columns}
::: {.column width="50%"}

1. \alert{Add recognition prompts}
   - Immediate +14 pt improvement
   - No architecture changes needed

2. **Architecture is optional**
   - Modest additive benefit (+2 pts)

3. **Use dynamic learners for testing**
   - Scripted learners mask effects

:::
::: {.column width="50%"}

4. **Theory of Mind profiling**
   - Best mechanism for ceiling performance

5. **Token budgets can be cut 4--16x**
   - No quality loss

6. **Minimum ego capability matters**
   - Mechanisms amplify, don't substitute

:::
::::::::::::::

---

## Limitations

\vspace{0.5em}

1. **Simulated learners, not humans** --- all "learners" are LLM agents
2. **LLM-as-judge** --- Claude Opus evaluates (mitigated by GPT-5.2 cross-judge)
3. **Single content domain** --- primarily philosophy of education
4. **No longitudinal data** --- snapshots, not learning trajectories
5. **Prompt-level intervention** --- recognition embedded in prompts, not weights
6. **Small N per cell** --- 30 observations per condition in key experiments

---

## Conclusion

\vspace{0.5em}

**Recognition theory** produces robust, replicable improvements in AI tutoring quality:

- d=1.11 to d=1.71 depending on experiment
- Replicates across 5 models, 6 domains, 2 judges
- Survives all controls: memory isolation, prompt elaboration, token budget

\vspace{0.3em}

**Multi-agent architecture** contributes additively but modestly.

\vspace{0.5em}

\begin{block}{The Key Insight}
Philosophical theories of intersubjectivity can serve as productive design heuristics for AI systems. Recognition is better understood as an \alert{achievable relational stance} than a requirement for machine consciousness.
\end{block}

---

## Thank You

\vspace{2em}

\vspace{0.8em}

\normalsize

*Geist* in the Machine (v2.3.14)

\footnotesize

37 evaluations | N=3,383 scored | 5 ego models | 2 judges

\vspace{1.5em}

\normalsize

Liam Magee

\footnotesize

Education Policy, Organization and Leadership

University of Illinois Urbana-Champaign

