# The Learner Superego Paradox: Recognition as External Self-Regulation

**Status**: Complete. N=118/118 scored, significance tests computed, ego_superego_recognition re-run with bug fix applied.

---

## Core Finding

The multi-agent (ego/superego) learner architecture produces **lower-quality** learner responses than the single-agent (unified) learner, as measured by the symmetric learner rubric (6 dimensions, 0-100 scale). The ego/superego process was designed to improve learner responses through internal self-critique (ego drafts, superego critiques, ego revises). Instead, it makes responses significantly worse. The superego acts like an overzealous editor: it polishes away the messy, confused, persona-consistent engagement that makes a simulated student believable. The result is responses that sound more "correct" but less like an actual student.

Recognition partially rescues ego_superego learner quality but has no effect on already-high unified learner quality. Crucially, recognition does not improve the internal ego/superego process itself — it works *around* the superego by creating external conditions that elicit more authentic responses despite the mediocre internal deliberation.

---

## Results

### 2×2 ANOVA: Overall Learner Score (Architecture × Recognition)

N=118, Grand Mean=69.0

| Effect | F(1,114) | p | eta² | Interpretation |
|---|---|---|---|---|
| **Architecture (C)** | **68.28** | **< .001** | **.342** | Massive effect; ego/superego hurts learner quality |
| Recognition (A) | 5.70 | .019 | .029 | Small main effect |
| **A × C Interaction** | **11.50** | **< .001** | **.058** | Recognition helps ego/superego but not unified |

### Cell Means

| Architecture | N | Mean | SD range |
|---|---|---|---|
| unified | 30 | **76.1** | 70.1–80.9 |
| unified + recognition | 30 | **74.8** | 71.1–79.7 |
| ego_superego | 28 | **57.5** | 20.6–77.8 |
| ego_superego + recognition | 30 | **67.0** | 38.4–87.5 |

### Effect Sizes

| Comparison | Cohen's d | Direction |
|---|---|---|
| Architecture main effect | **1.43** | unified >> ego_superego |
| Recognition main effect | 0.34 | recognition > base |
| Recognition within unified | -0.46 (p=.082, n.s.) | No effect |
| Recognition within ego_superego | **0.79** (p=.004) | Recognition rescues ego_superego |

### Simple Effects: Recognition Within Architecture

The interaction means recognition's effect depends entirely on which learner architecture is present:

- **Unified learner**: Already producing authentic, engaged responses. Recognition doesn't improve them further (76.1 → 74.8, d=-0.46, p=.082 n.s.). There's nothing to fix.
- **Ego/superego learner**: The superego has flattened the responses. The recognitive tutor creates space — by treating the learner as an autonomous subject rather than demanding "correct" answers — that partially restores authentic engagement (57.5 → 67.0, d=0.79, p=.004). But it only gets them to ~67, not to the ~75 that unified learners achieve naturally.

---

## Per-Dimension Breakdown

### Dimension Means (1-5 scale)

| Dimension | unified | unified+R | ego_sup | ego_sup+R |
|---|---|---|---|---|
| Learner Authenticity | 4.01 | 4.00 | 3.57 | 3.98 |
| Question Quality | 4.20 | 4.13 | 3.29 | 3.74 |
| Conceptual Engagement | 4.40 | 4.26 | 3.29 | 3.98 |
| Revision Signals | 3.74 | 3.73 | 3.61 | 3.87 |
| Deliberation Depth | N/A | N/A | **2.76** | **2.67** |
| Persona Consistency | 3.67 | 3.72 | 2.96 | 3.88 |

### Per-Dimension 2×2 ANOVAs

| Dimension | Arch F(1,114) | Arch p | Arch eta² | Recog F | Recog p | **Interaction F** | **Interact p** | **Interact eta²** |
|---|---|---|---|---|---|---|---|---|
| **Persona Consistency** | 17.62 | < .001 | .091 | 33.22 | < .001 | **29.21** | **< .001** | **.151** |
| **Conceptual Engagement** | 38.09 | < .001 | .220 | 5.24 | .024 | **15.44** | **< .001** | **.089** |
| Learner Authenticity | 13.72 | < .001 | .095 | 7.33 | .008 | **9.06** | **.003** | **.063** |
| Question Quality | 33.07 | < .001 | .216 | 1.64 | .203 | **4.42** | **.038** | **.029** |
| Revision Signals | 0.32 | .570 | .003 | 1.09 | .300 | 1.35 | .248 | .012 |

Four of five dimensions show significant interactions. The dimension breakdown tells you *how* recognition rescues the ego_superego learner:

1. **Persona consistency** (largest interaction, eta²=.151): The superego breaks character — a "frustrated student" stops sounding frustrated. The recognitive tutor *validates* the persona instead of demanding compliance, so the learner can stay in character. Recognition effect within ego_superego: +0.92 on the 1-5 scale.

2. **Conceptual engagement** (eta²=.089): The superego suppresses messy, genuine thinking about ideas. Recognition elicits it back by responding to what the learner actually said rather than what the learner "should" say. Recognition effect within ego_superego: +0.69.

3. **Learner authenticity** (eta²=.063): The superego makes responses sound less like a real student. Recognition partially restores authentic-sounding reactions. Effect within ego_superego: +0.41.

4. **Question quality** (eta²=.029): The superego flattens questions toward the procedural ("what should I do next?"). Recognition draws out more substantive questions. Effect within ego_superego: +0.45.

5. **Revision signals** (n.s.): Neither architecture nor recognition affects whether learners show evidence of changing their mind. This dimension may be more dependent on dialogue position than on treatment condition.

### Deliberation Depth: Uniformly Poor, Unaffected by Recognition

| Condition | Mean | SD | N |
|---|---|---|---|
| ego_superego base | 2.76 | 0.63 | 28 |
| ego_superego + recognition | 2.67 | 0.61 | 30 |
| **Difference** | -0.08 | | t(55.4)=-0.42, p=.679, d=-0.11 |

Recognition does **not** improve the internal ego/superego process. The superego's critiques remain formulaic regardless of tutor framework. Recognition improves external output *despite* the mediocre internal process — it works around the superego rather than through it. This is the punchline: you can't fix a monological process by changing the external context. The superego remains a bad editor; the recognitive tutor succeeds by giving the learner permission to override the editor.

---

## Theoretical Significance

### Recognition as External Self-Regulation

This finding has a clean Hegelian interpretation: **recognition provides externally what the superego tries to provide internally — and does it more effectively.**

The tutor operating within a recognitive framework:
- Treats the learner as an autonomous subject capable of genuine understanding
- Creates conditions where authentic confusion, resistance, and conceptual struggle are *valued*
- Responds to the learner's actual engagement rather than demanding a pre-processed version

The internal superego, by contrast:
- Critiques the ego's initial reaction before the tutor ever sees it
- Smooths out persona-inconsistent elements (rough edges, frustration, naive questions)
- Produces responses that are more "correct" but less authentically student-like
- **Competes with the recognitive encounter** by pre-digesting the learner's raw reaction

### The Mirror-Image Interaction

The learner-side results provide the **mirror image** of the tutor-side A×C interaction:

| Rubric | Recognition helps unified MORE | Recognition helps ego_superego MORE |
|---|---|---|
| **Tutor-side** (factorial, N=350) | **Yes**: +15.4 pts vs +4.4 pts | |
| **Learner-side** (bilateral, N=118) | | **Yes**: +9.5 pts vs -1.3 pts |

This is not a contradiction — it's the same dynamic seen from two measurement perspectives. Same mechanism, two measurement angles:

- **Tutor rubric**: Recognition improves tutor output more when the learner is unified (raw, authentic input gives the recognitive tutor more to work with).
- **Learner rubric**: Recognition improves learner output more when the learner has a superego (the recognitive tutor counteracts the superego's flattening, partially rescuing learner authenticity).

Together:
- **Unified learner + recognition**: Best tutor output (recognition has authentic material to work with) AND already-high learner quality (no superego interference). This is the optimal configuration.
- **Ego_superego learner + recognition**: Recognition partially rescues learner quality but the tutor gets pre-processed input, limiting tutor-side gains.

### The Deliberation Depth Problem

The ego/superego deliberation process itself scores poorly (2.7/5) regardless of condition. Superego critiques are generic rather than specific. Ego revisions are cosmetic rather than substantive. The internal process adds little value — it's "performative deliberation."

This makes a theoretical point: external recognition from an Other is structurally different from — and more effective than — internal self-critique. You can't bootstrap genuine dialogue from a monologue. In Hegelian terms: self-consciousness cannot fully develop through internal self-relation alone. The subject needs recognition from another consciousness, not just from an internal mirror. The superego is an internal mirror; the recognitive tutor is an authentic Other.

---

## Practical Implications

### 1. For System Design
The current ego/superego prompts for the learner are poorly calibrated — the superego optimizes for "good student responses" rather than "authentic student responses." A redesigned learner superego could:
- Critique for *inauthenticity* rather than for quality
- Push the ego toward messier, more persona-consistent responses
- Focus on whether the learner is genuinely engaging with ideas rather than performing engagement

### 2. For the Paper
This finding strengthens the recognition framework's theoretical position:
- Recognition is not just one of several equivalent interventions
- It provides something structurally unique: external validation that internal self-regulation cannot replicate
- The null Factor C result in the tutor-side rubric was not measurement failure — it reflects a genuine dynamic where the superego's contribution is neutral-to-negative
- The mirror-image interaction pattern across tutor and learner rubrics is a compelling structural result
- The uniformly poor deliberation depth (2.7/5) suggests current ego/superego architectures produce performative rather than genuine internal dialogue

### 3. For Future Experiments
- Test a "recognition-aware" learner superego that critiques for authenticity
- Investigate whether the superego's negative effect varies by turn (early vs late)
- Run GPT-5.2 cross-judge validation on learner scores
- Extend to other ego models beyond kimi-k2.5

---

## Caveats

1. **Bug found and fixed**: Initial run scored ego_superego_recognition (N=30) without deliberation traces or deliberation_depth dimension due to string-matching bug (`=== 'ego_superego'` didn't match `'ego_superego_recognition'`). Fixed to use `.includes('ego_superego')`. Cell re-run completed; all numbers above are from the corrected data.
2. **Same judge for all cells**: Opus judges both unified and ego_superego learners. Cross-judge validation with GPT-5.2 needed.
3. **Persona label bug**: Initial run used "eager_novice" fallback label. Fixed to use actual learnerContext from dialogue logs. Impact minimal since judge scores on transcript content.
4. **Single ego model**: All dialogues used kimi-k2.5. The superego's formulaic critiques may be model-specific.
5. **Small N for ego_superego base**: N=28 (vs 30 for other cells) due to 2 rows with null learner_architecture.
6. **ANOVA assumptions**: Unbalanced design (N=28 vs 30). Type I SS used; Type III may yield slightly different F-values. Formal publication should use Type III with proper software (R/SPSS).

---

## Data Source

- Run: eval-2026-02-07-b6d75e87 (bilateral transformation, N=118, 3 scenarios)
- Rubric: config/evaluation-rubric-learner.yaml (6 dimensions, learner-side)
- Judge: Claude Code (Opus)
- Architecture distribution: 30 unified, 28 ego_superego, 30 unified_recognition, 30 ego_superego_recognition
- Initial scoring: 2026-02-08
- ego_superego_recognition re-run: 2026-02-08 (with deliberation traces + deliberation_depth)
- Significance tests: 2026-02-08
