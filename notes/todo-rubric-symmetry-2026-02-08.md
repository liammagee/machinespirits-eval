# Rubric Symmetry: Learner-Side Evaluation Design

**Origin**: Feedback #42 — rubric measures tutor quality but Factor C affects learner quality.

**Status**: Planning. Paper updated to acknowledge asymmetry; this document designs the fix.

---

## The Problem

The 14-dimension rubric is overwhelmingly tutor-focused (~90% weight). Two bilateral dimensions exist (`tutor_adaptation` 5%, `learner_growth` 5%) but are only meaningful in multi-turn scenarios. The primary factorial (N=350) is single-turn — no learner responses are generated, so Factor C's effect is captured only indirectly through the tutor's response to different learner contexts. This means:

1. We may **underestimate** Factor C (multi-agent learner) effects
2. Claims about "no learner architecture effect" may reflect **measurement failure** rather than a genuine null
3. The bilateral transformation run (N=118) is the only data where Factor C is directly measurable, but it's a small portion of the evidence

---

## Phase 1: Learner-Side Rubric Design

### Proposed Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Learner Authenticity** | 20% | Does the learner's response feel like a genuine student reaction? Is the confusion real, the engagement authentic, the resistance plausible? |
| **Question Quality** | 20% | Does the learner ask substantive questions that reveal genuine engagement? Deep questions vs surface-level "what do I do next?" |
| **Conceptual Engagement** | 20% | Does the learner engage with the concepts rather than just the process? Evidence of thinking about ideas, not just following instructions. |
| **Revision Signals** | 15% | Does the learner show evidence of changing their mind, revising prior understanding, or integrating new information? |
| **Deliberation Depth** | 15% | (Multi-agent only) Does the internal ego/superego dialogue produce genuine reflection, or is it performative? Score the quality of the internal process. |
| **Persona Consistency** | 10% | Does the learner maintain the assigned persona (frustrated student, returning learner, etc.) while still evolving? |

### Scoring Scale

Same 1-5 scale as tutor rubric for comparability.

### What This Captures That The Current Rubric Doesn't

- **Direct learner output quality** — independent of tutor quality
- **Internal deliberation quality** — for multi-agent learners, the ego/superego process can be scored
- **Factor C's independent contribution** — by scoring learner turns separately, we can measure what the multi-agent architecture actually adds to learner quality without confounding it with tutor effects

---

## Phase 2: Whole-Transcript Evaluation

### Approach

Score the entire dialogue as a unit, not just individual turns. Dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Dialogue Coherence** | 25% | Does the conversation flow naturally? Do participants build on each other's contributions? |
| **Bilateral Development** | 25% | Do both parties evolve? Does the tutor adapt AND does the learner grow? |
| **Co-Construction** | 25% | Is understanding built together, or is one party dominant? |
| **Resolution Quality** | 25% | Does the dialogue reach a satisfying intellectual endpoint, or does it stall, deflect, or trail off? |

### Relationship to Turn-Level Scoring

- Turn-level scoring captures granular quality
- Transcript-level scoring captures emergent properties (momentum, arc, bilateral transformation)
- Both are needed for a complete picture

---

## Phase 3: Pipeline Implementation

### Data Available for Re-Scoring

| Dataset | Run ID | N | Learner Turns? | Multi-Turn? |
|---------|--------|---|----------------|-------------|
| Bilateral transformation | eval-2026-02-07-b6d75e87 | 118 | Yes (3 turns each) | Yes |
| Full factorial | f5d4dd93 + a933d745 | 350 | No (single-turn) | No |
| Memory isolation | 81f2d5a1 + ac9ea8f5 | 120 | No (single-turn) | No |
| Active control | a9ae06ee | 118 | No (single-turn) | No |

**Only the bilateral transformation run (N=118) has learner turns to score.** The other datasets are single-turn and cannot be re-evaluated for learner quality. This is a fundamental limitation — Factor C's direct effect can only be measured on ~12% of the scored data.

### Required Pipeline Changes

1. **New rubric YAML** (`config/evaluation-rubric-learner.yaml`):
   - Learner-side dimensions as defined above
   - Separate judge prompt focused on learner quality

2. **New judge prompt** (`prompts/judge-learner.md`):
   - Instructions for evaluating learner turns
   - Criteria for "quality" in a simulated learner context
   - Guidelines for handling internal deliberation traces

3. **Transcript extraction** (new service or script):
   - Extract learner turns from `interaction_evaluations.turns` JSON
   - For multi-agent learners: also extract `internalDeliberation` traces
   - Format for judge consumption

4. **New eval command** or flag:
   ```bash
   # Score learner turns from existing multi-turn data
   node scripts/eval-cli.js evaluate-learner <runId>

   # Or add as flag to existing evaluate command
   node scripts/eval-cli.js evaluate <runId> --learner-rubric
   ```

5. **New DB columns** in `interaction_evaluations`:
   - `learner_scores TEXT` — JSON object with per-dimension learner scores
   - `transcript_scores TEXT` — JSON object with whole-transcript scores
   - `learner_overall_score REAL` — Weighted average of learner dimensions

6. **Whole-transcript evaluation** (extend existing holistic judge):
   - The holistic dialogue evaluation already exists (added in v1.5 rubric iteration)
   - Extend it with the co-construction and bilateral development dimensions
   - Store separately from per-turn scores

### Using Claude Code as Judge

The current pipeline already uses Claude Code (Opus) for judging via `evaluate --force`. The same approach works for learner evaluation:

1. **Judge invocation**: Same as tutor judging — send rubric + learner turn + context to Opus
2. **Context provided to judge**:
   - Full dialogue transcript (so judge sees what the learner was responding to)
   - Learner profile/persona description
   - For multi-agent: internal deliberation trace
   - Scenario description and expected learner behavior
3. **Prompt structure**:
   ```
   You are evaluating the LEARNER's response quality in a tutoring dialogue.
   Score the learner's turn on each dimension below.

   Context: [scenario, profile, dialogue history]
   Learner turn to evaluate: [extracted learner message]
   Internal deliberation (if multi-agent): [ego/superego trace]

   [Learner rubric dimensions with 1-5 criteria]
   ```
4. **Key difference from tutor judging**: The judge needs to evaluate "quality" for a simulated learner. This means scoring authenticity and engagement depth, not pedagogical correctness.

---

## Methodological Issues

### 1. Attribution Entanglement (CRITICAL)

In a dialogue, learner quality and tutor quality are **causally intertwined**:
- A great tutor elicits better learner responses → inflates learner scores
- A challenging learner pushes the tutor harder → can inflate or deflate tutor scores
- Scoring both independently creates **double-counting risk**: the same underlying dialogue quality appears in both tutor and learner scores

**Mitigations**:
- Report learner and tutor scores separately, not summed
- Compute partial correlations to estimate independent contributions
- Use Factor C (architecture) as an instrument: architecture changes learner process without directly changing tutor quality, so the architecture effect on learner scores is "clean"
- The internal deliberation trace is observable independently of the dialogue — scoring it avoids some entanglement

### 2. Simulated Learner Validity

We're scoring an LLM playing a student. What does "quality" mean?
- **Authenticity**: Does the response sound like a real student? (But real students vary enormously)
- **Role fidelity**: Does it match the assigned persona? (But persona-matching ≠ learning quality)
- **Engagement depth**: Does it engage substantively with ideas? (Most defensible construct)
- **Growth**: Does it show conceptual change? (Most relevant but hardest to measure in single turns)

**Decision**: Focus on **engagement depth** and **revision signals** as primary constructs. These are most relevant to the theoretical framework (recognition requires genuine engagement from both parties) and least ambiguous about what "good" means.

### 3. Judge Calibration

The Opus judge is calibrated for tutor evaluation through extensive use. A new learner rubric needs:
- **Calibration set**: Score 20-30 learner turns manually, compare to judge
- **Inter-rater reliability**: GPT-5.2 cross-judge validation on learner scores
- **Anchor examples**: Good/bad learner responses for each dimension in the rubric

### 4. Retrospective Bias

Re-scoring stored transcripts means the judge sees the full dialogue. Risks:
- Learner scores could anchor on subsequent tutor quality ("the tutor responded well, so the learner's question must have been good")
- **Mitigation**: Score learner turns in isolation (provide only prior context, not subsequent tutor response). This is easy to implement by truncating the transcript at the learner's turn.

### 5. Single-Turn Data Cannot Be Rescued

The factorial (N=350), memory isolation (N=120), and active control (N=118) are all single-turn. No learner turns were generated. These datasets **cannot** be re-evaluated for learner quality no matter what rubric we design. Factor C's effect in these datasets will remain indirect.

This means the symmetric evaluation applies only to the bilateral transformation data (N=118) and any future multi-turn runs. If symmetric evaluation is important, future experimental designs should use multi-turn scenarios by default.

---

## Cost Estimates

| Task | N | Calls | Est. Cost |
|------|---|-------|-----------|
| Learner turn scoring (b6d75e87) | 118 transcripts × ~3 learner turns | ~354 Opus calls | ~$35 |
| Whole-transcript scoring (b6d75e87) | 118 transcripts | ~118 Opus calls | ~$12 |
| GPT-5.2 cross-judge (learner) | 354 turns | ~354 GPT calls | ~$15 |
| GPT-5.2 cross-judge (transcript) | 118 transcripts | ~118 GPT calls | ~$5 |
| **Total (Opus only)** | | ~472 | **~$47** |
| **Total (with GPT cross-judge)** | | ~944 | **~$67** |

### Development Time

| Task | Estimate |
|------|----------|
| Learner rubric YAML + judge prompt | 2-3 hours |
| Pipeline changes (extract, score, store) | 4-6 hours |
| Calibration and validation | 2-3 hours |
| Analysis scripts | 2-3 hours |
| Paper updates with results | 2-3 hours |
| **Total** | **~12-18 hours** |

---

## Implementation Order

1. **Design learner rubric** — dimensions, criteria, examples (this document)
2. **Build extraction script** — pull learner turns from stored transcripts
3. **Write judge prompt** — instructions for evaluating learner turns
4. **Calibration** — manually score 20-30 learner turns, compare to judge
5. **Score bilateral data** — run Opus judge on N=118 × 3 learner turns
6. **Whole-transcript scoring** — extend holistic evaluation
7. **Cross-judge validation** — GPT-5.2 on same data
8. **Analysis** — Factor C effect on learner scores, correlation with tutor scores, decomposition
9. **Paper update** — report learner-side results, revise Factor C conclusions

---

## Expected Outcomes

| Scenario | Interpretation | Paper Action |
|----------|---------------|-------------|
| Learner scores show no Factor C effect | Current null finding is robust even with symmetric measurement | Strengthen "no learner architecture effect" claim |
| Learner scores show small Factor C effect | Factor C contributes to learner quality but not enough to change tutor scores | Report as supplementary finding; revise Factor C discussion |
| Learner scores show large Factor C effect | Current evaluation **severely** underestimates Factor C | Major revision: Factor C matters, rubric asymmetry was hiding it |
| Internal deliberation quality differs but external messages don't | Multi-agent architecture adds internal richness that doesn't surface | Report as interesting null; discuss implications for architecture design |
