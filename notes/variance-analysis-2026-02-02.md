# Variance Analysis: eval-2026-02-01-f8734b08

Date: 2026-02-02
Run: 192 results, 8 scenarios x 8 factorial cells x 3 reps
All kimi-k2.5 ego, skip-rubric then evaluated via claude CLI

## Key Finding: High within-cell variance is tutor output instability, not judge noise

30 of 64 cells have "extreme" spread (>30 points between reps).
Score distribution is bimodal: 73 results at 10-20, 50 at 90-100.

### Cause: kimi-k2.5 non-deterministically falls back to generic responses

Low-scoring reps produce template-like outputs ("Begin with the foundational lecture",
"Resume your current course to maintain learning momentum") that ignore scenario context.
High-scoring reps produce context-aware responses referencing specific learner struggles.

The judge is consistent — same generic output gets the same low scores for the same reasons.

### Factorial cell configs (confirmed — no model confound)

ALL 8 cells use kimi-k2.5 as the ego (suggestion generator).

| Cell | Ego Model | Ego Prompt | Superego | Dialogue |
|------|-----------|------------|----------|----------|
| cell_1_base_single_unified | kimi-k2.5 | tutor-ego.md | NONE | disabled |
| cell_2_base_single_psycho | kimi-k2.5 | tutor-ego.md | NONE | disabled |
| cell_3_base_multi_unified | kimi-k2.5 | tutor-ego.md | kimi-k2.5 | enabled (2 rounds) |
| cell_4_base_multi_psycho | kimi-k2.5 | tutor-ego.md | kimi-k2.5 | enabled (2 rounds) |
| cell_5_recog_single_unified | kimi-k2.5 | tutor-ego-recognition.md | NONE | disabled |
| cell_6_recog_single_psycho | kimi-k2.5 | tutor-ego-recognition.md | NONE | disabled |
| cell_7_recog_multi_unified | kimi-k2.5 | tutor-ego-recognition.md | nemotron | enabled (2 rounds) |
| cell_8_recog_multi_psycho | kimi-k2.5 | tutor-ego-recognition.md | nemotron | enabled (2 rounds) |

nemotron is only the superego (critic), never the ego (generator).

### Per-cell performance

| Cell | Avg | SD | Notes |
|------|-----|-----|-------|
| cell_7_recog_multi_unified | 87.7 | 24.9 | Best: recognition prompt + nemotron critic |
| cell_8_recog_multi_psycho | 89.0 | 17.8 | Best: recognition prompt + nemotron critic |
| cell_6_recog_single_psycho | 61.6 | 39.9 | Recognition prompt helps but no critic |
| cell_5_recog_single_unified | 48.5 | 41.4 | Recognition prompt but highest variance |
| cell_4_base_multi_psycho | 34.6 | 27.7 | Critic helps somewhat without recognition |
| cell_3_base_multi_unified | 31.5 | 27.7 | Same |
| cell_1_base_single_unified | 26.9 | 27.6 | Worst: base prompt, no critic |
| cell_2_base_single_psycho | 25.4 | 23.8 | Worst |

### ANOVA results

- Recognition prompts (A): +42 points, F=95.8, p<.05, eta²=0.305 — dominant factor
- Multi-agent tutor (B): +20 points, F=21.8, p<.05, eta²=0.069
- Learner architecture (C): not significant (F=0.86)
- A×B interaction significant (F=9.4): multi-agent matters MORE with recognition prompts

### Prompt template differences driving the effect

Base prompt (tutor-ego.md, 345 lines):
- Generic decision heuristics: Struggle Stop Rule, Momentum Rule, Onboarding Rule
- No memory integration, no recognition-specific language
- No explicit instructions to reference learner-specific context

Recognition prompt (tutor-ego-recognition.md, 403 lines):
- Memory integration ("Writing Pad": conscious/preconscious/unconscious layers)
- Critical rules: Recognition Rule, Intellectual Resistance Rule, Repair Rule,
  Productive Struggle Rule, Memory Integration Rule
- Explicit instructions to engage with learner's specific situation

### Why multi-agent helps

Single-agent: one-shot generation, no review. Generic fallbacks ship unchecked.
Multi-agent: superego pre-analyzes learner signals, reviews ego output, rejects
generic suggestions and forces revision. Acts as quality gate.

### Caveat: Learner architecture factor (C) was not exercised

All scenarios in this run were single-turn. The learner ego_superego architecture
(factor C) is only triggered during multi-turn scenarios — it generates LLM learner
responses between turns via `generateLearnerResponse()` (evaluationRunner.js:1381).

In single-turn tests, the learner architecture config is stored in the DB
(`learner_architecture` column) but has zero operational effect. The ANOVA finding
of F=0.86 for factor C is therefore meaningless — it reflects random noise across
a dormant factor, not evidence that learner architecture doesn't matter.

**Implication:** To properly test whether a strong superego model improves
performance in the learner role (as it does in the tutor role), multi-turn
scenarios must be included in factorial runs. The current data cannot answer
this question.

### Potential improvements to investigate

1. Add specificity instructions to base prompt (cheapest fix)
2. Post-generation validation: check suggestion references scenario-specific elements
3. Inject structured context fields (not just raw learner_context string)
4. Reduce kimi-k2.5 temperature or add retry-on-generic logic
5. Consider whether base prompt is a realistic control or just under-specified
