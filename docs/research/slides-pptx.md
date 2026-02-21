---
title: "*Geist* in the Machine"
subtitle: "Mutual Recognition and Multiagent Architecture for Dialectical AI Tutoring"
author: "Liam Magee"
date: "February 2026"
bibliography: references.bib
csl: apa.csl
---

# Motivation

## The Problem

Current AI tutoring treats learners as **knowledge deficits** to be filled.

- Learner says something interesting → tutor redirects to curriculum
- Learner struggles → tutor simplifies or restates
- Learner resists → tutor notes "engagement metrics" and moves on

**The learner is never encountered as a subject.**

This maps onto Hegel's master--slave dialectic: the master (tutor) consumes the slave's (learner's) labor without genuine encounter.

---

## Hegel's Alternative: Mutual Recognition

**Recognition** (*Anerkennung*): each party acknowledges the other as an autonomous consciousness whose understanding has intrinsic validity.

:::::::::::::: {.columns}
::: {.column width="50%"}

**What it is**

- A **relational stance**
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

# Architecture

## The Drama Machine

:::::::::::::: {.columns}
::: {.column width="50%"}

**Ego** (Response Generator)

- Generates pedagogical suggestions
- Has **final authority** over output
- Can override or incorporate Superego feedback

:::
::: {.column width="50%"}

**Superego** (Internal Critic)

- Evaluates Ego's draft
- Checks pedagogical quality
- Structured critique: approve / revise / reject

:::
::::::::::::::

**Recognition prompts** add Hegelian theory to both Ego and Superego:

- *"Acknowledge the learner as an autonomous subject..."*
- *"Evaluate whether the response treats the learner's understanding as having intrinsic validity..."*

---

## Phase 2: Advanced Mechanisms

Nine architectural mechanisms tested beyond base Ego/Superego:

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

---

# Method

## Evaluation Design

**48 evaluations**, N=4,144 primary scored responses

- **2x2x2 factorial** (N=350): Recognition x Architecture x Learner type
- **Memory isolation** (N=120): Disentangle recognition from episodic memory
- **Multi-model probe** (N=655): 5 ego models, architecture held constant
- **Dynamic learner tests** (N=743): 7 mechanisms with feedback-capable learners
- **Cross-judge replication** (N=1,193): GPT-5.2 independent validation

**14-dimension rubric** scored by Claude Opus 4.6

---

# Results

## Finding 1: Memory Isolation (The Definitive Finding)

2x2 design (N=120, 30/cell) disentangles recognition from episodic memory:

|  | No Memory | Memory |
|:--|:-----------:|:--------:|
| **No Recognition** | 75.4 | 80.2 |
| **Recognition** | **90.6** | **91.2** |

- **Recognition**: **+15.2 pts**, d=1.71, p<.001
- **Memory**: +4.8 pts, d=0.46, n.s.
- **Interaction**: -4.2 pts (ceiling effect, not synergy)

Recognition alone accounts for nearly the entire improvement.

---

## Finding 2: Full Factorial (2x2x2)

N=350, Kimi K2.5 ego, Opus 4.6 judge:

| Cell | Recog | Arch | Learner | M (SD) |
|:------:|:-------:|:------:|:---------:|:--------:|
| 1 | - | Single | Single | 73.4 (16.2) |
| 2 | - | Multi | Single | 69.9 (23.3) |
| 3 | - | Single | Multi | 75.5 (15.2) |
| 4 | - | Multi | Multi | 75.2 (18.1) |
| 5 | + | Single | Single | **90.2** (7.1) |
| 6 | + | Multi | Single | **83.9** (18.1) |
| 7 | + | Single | Multi | **90.1** (7.1) |
| 8 | + | Multi | Multi | **87.3** (10.3) |

**Recognition**: **+14.4 pts**, F(1,342)=110.04, p<.001, d=1.11

---

## Finding 3: Architecture is Additive

Multi-model probe (N=655, 5 ego models):

| Model | Base | +Arch | +Recog | +Both | AxB |
|:-------|:------:|:-------:|:--------:|:-------:|:-----:|
| Kimi K2.5 | 73.4 | 75.5 | **90.2** | 90.1 | +0.5 |
| Haiku | 78.2 | 81.9 | **93.3** | 93.5 | -3.7 |
| DeepSeek-R1 | 71.1 | 71.3 | **88.9** | 83.2 | -5.7 |
| GLM-4.7 | 63.9 | 62.2 | **73.5** | 74.9 | +3.1 |
| Nemotron | 62.3 | 62.6 | **78.2** | 72.5 | -5.7 |

- AxB interaction: -5.7 to +3.1 (mean -1.8) --- **no synergy**
- Recognition range: +9.6 to +17.8 across all models

---

## Finding 4: Domain Generalizability

Recognition effect across 6 tutorial domains (N=60):

| Domain | Base | Recog | Delta |
|:--------|:------:|:-------:|:---:|
| Climate science | 72.0 | 93.8 | **+21.8** |
| Ethics | 72.3 | 89.3 | **+17.0** |
| Mathematics | 73.0 | 89.2 | **+16.2** |
| Philosophy | 75.2 | 89.7 | **+14.5** |
| Machine learning | 78.0 | 91.5 | **+13.5** |
| Poetry | 86.0 | 92.5 | +6.5 |

Strong for conceptual domains (+14 to +22 pts). Weakest for poetry (+6.5) --- high baseline leaves less room for improvement.

---

## Finding 5: Scripted vs. Dynamic Learners

:::::::::::::: {.columns}
::: {.column width="50%"}

**Scripted learners**

- Pre-written responses
- 9 mechanisms cluster within 2.4 pts
- No differentiation --- noise floor

:::
::: {.column width="50%"}

**Dynamic learners**

- LLM-generated, ego/superego
- 7 mechanisms, all show positive delta
- Recognition doubles: +7.6 → **+14.2**

:::
::::::::::::::

**Lesson**: Mechanism effects require genuine feedback loops to manifest.

---

## Finding 6: Dynamic Learner Mechanisms

2x7 mechanism matrix (N=408, Haiku + Nemotron ego, dynamic learner):

| Mechanism | Base | Recog | Delta |
|:-----------|:------:|:-------:|:---:|
| Self-reflection | 71.4 | 85.9 | +14.5 |
| Bidirectional profiling | 75.5 | **88.8** | +13.3 |
| Intersubjective | 67.7 | 82.8 | +15.1 |
| Combined | 73.9 | 87.8 | +13.9 |
| Quantitative* | 66.8 | 76.5 | +9.7 |
| Erosion* | 66.2 | 74.2 | +8.0 |
| Tutor-profiling* | 69.5 | 79.1 | +9.6 |

*Nemotron ego (lower absolute scores). All 7 mechanisms show positive recognition delta (+8.0 to +15.1).

---

## Finding 7: Cognitive Prosthesis Fails

Can a strong Superego (Kimi K2.5) compensate for a weak Ego (Nemotron)?

**No.** Full mechanism stack scores **49.5** --- that's **-15 pts below** Nemotron simple base (64.2)

- Same mechanisms boost Haiku by +20 pts but hurt Nemotron by -15 pts
- Static dimensions fine (spec accuracy 4.0); dynamic dimensions fail (adaptation 1.8)
- Parse failures: Kimi returns malformed JSON 16--45% of turns

**Minimum ego capability threshold**: The mechanisms amplify what the Ego can already do --- they cannot substitute for missing capability.

---

## Finding 8: Cross-Judge Robustness

GPT-5.2 independently rejudged N=1,193 paired responses:

| Finding | Claude | GPT-5.2 | Replicates? |
|:---------|:--------:|:---------:|:-------------:|
| Recognition (memory) | d=1.71 | d=1.54 | Yes |
| Memory effect | d=0.46 | d=0.49 | Yes (small) |
| Architecture effect | +2.6 | -0.2 | Yes (null) |
| Mechanism clustering | 2.8 pt | 4.4 pt | Yes (null) |

- Inter-judge r = 0.44--0.64 (all p<.001)
- GPT-5.2 finds 37--59% of Claude's effect magnitudes
- Always same direction --- **no sign reversals**

---

# Qualitative Evidence

## What Recognition Looks Like

**Base tutor** to a struggling learner:

> "You left off at the neural networks section. Complete this lecture to maintain your learning streak."

**Recognition tutor** to the same learner:

> "This is your third session --- you've persisted through quiz-479-3 three times, which signals you're wrestling with how recognition operates in the dialectic..."

Three systematic changes:

1. The ego **listens to its internal critic** (superego feedback incorporated)
2. The tutor **builds on learner contributions** (not redirecting to curriculum)
3. **Mid-conversation strategy shifts** occur (30% of recognition dialogues vs 0% base)

---

## Dialectical Impasse: The Strongest Test

Three 5-turn scenarios with escalating resistance (N=24):

- **Epistemic resistance** (Popperian critique): Recognition **+43 pts**
- **Productive deadlock** (incompatible frameworks): Recognition **+29 pts**
- **Affective shutdown** (emotional retreat): Recognition -1.1 (null)

Resolution strategy coding (chi-square=24.00, p<.001, V=1.000):

- **Base**: 12/12 withdraw from encounter entirely
- **Recognition**: 10/12 scaffolded reframing (*Aufhebung*), 1 mutual recognition, 1 domination

The null on affective shutdown sharpens the claim: recognition's contribution is **epistemological**, not primarily affective.

---

## The Learner Superego Paradox

Multi-agent learner architecture **hurts** learner quality (d=1.43, F=68.28, p<.001):

- Designed to improve through internal self-critique
- Actually over-edits --- polishes away messy, authentic engagement
- Recognition partially rescues multi-agent learner (d=0.79, p=.004)

**Hegelian interpretation**: External recognition from an Other is structurally more effective than internal self-critique. You cannot bootstrap genuine dialogue from a monologue.

---

# Implications

## Practical Recommendations

1. **Add recognition prompts** --- immediate +14 pt improvement, no architecture changes needed
2. **Architecture is additive, not synergistic** --- quality filtering + error correction (+2 pts), enables self-reflection and ToM profiling
3. **Use dynamic learners** for testing --- scripted learners mask mechanism effects
4. **Theory of Mind profiling** --- best mechanism for ceiling performance
5. **Token budgets can be cut 4--16x** with no quality loss
6. **Minimum ego capability matters** --- mechanisms amplify, don't substitute

---

## Limitations

1. **Simulated learners, not humans** --- all "learners" are LLM agents
2. **LLM-as-judge** --- Claude Opus evaluates (mitigated by GPT-5.2 cross-judge)
3. **Single content domain** --- primarily philosophy of education
4. **No longitudinal data** --- snapshots, not learning trajectories
5. **Prompt-level intervention** --- recognition embedded in prompts, not weights
6. **Small N per cell** --- 30 observations per condition in key experiments

---

## Conclusion

**Recognition theory** produces robust, replicable improvements in AI tutoring quality:

- d=1.11 to d=1.71 depending on experiment
- Replicates across 5 models, 6 domains, 2 judges
- Survives all controls: memory isolation, prompt elaboration, token budget

**Multi-agent architecture** contributes additively but modestly.

**The key insight**: Philosophical theories of intersubjectivity can serve as productive design heuristics for AI systems. Recognition is better understood as an achievable relational stance than a requirement for machine consciousness.

---

## Thank You

**Paper**: *Geist* in the Machine (v2.3.17)

**48 evaluations** | **N=4,144 scored** | **5 ego models** | **2 judges**

Liam Magee

Education Policy, Organization and Leadership

University of Illinois Urbana-Champaign

