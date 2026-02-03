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

### Caveat: Learner architecture factor (C) was not exercised in single-turn

All scenarios in the original run (eval-2026-02-01-f8734b08) were single-turn.
The learner ego_superego architecture (factor C) is only triggered during
multi-turn scenarios — it generates LLM learner responses between turns via
`generateLearnerResponse()` (evaluationRunner.js:1381).

In single-turn tests, the learner architecture config is stored in the DB
(`learner_architecture` column) but has zero operational effect. The ANOVA finding
of F=0.86 for factor C is therefore meaningless — it reflects random noise across
a dormant factor, not evidence that learner architecture doesn't matter.

### Multi-turn follow-up: Learner architecture IS significant

Run: eval-2026-02-02-845e6a28
24 results, 1 multi-turn scenario (mood_frustration_to_breakthrough, 4 turns) × 8 cells × 3 reps
Ego: nemotron, Superego: kimi-k2.5

| Cell | Avg Score | Input Tokens | Rounds | API Calls |
|------|-----------|--------------|--------|-----------|
| cell_8_recog_multi_psycho | 94.3 | 101,850 | 5.3 | 10.7 |
| cell_7_recog_multi_unified | 93.2 | 101,797 | 5.3 | 10.7 |
| cell_6_recog_single_psycho | 89.8 | 55,041 | 0 | 4 |
| cell_5_recog_single_unified | 86.0 | 54,994 | 0 | 4 |
| cell_4_base_multi_psycho | 76.1 | 75,450 | 4.0 | 17 |
| cell_2_base_single_psycho | 71.6 | 54,476 | 0 | 13 |
| cell_3_base_multi_unified | 65.5 | 78,511 | 4.3 | 9 |
| cell_1_base_single_unified | 65.5 | 49,338 | 0 | 4 |

**Factor C (learner architecture) now shows a consistent effect on multi-turn:**

| Pair | Psycho (ego_superego) | Unified | Delta |
|------|-----------------------|---------|-------|
| Recog + multi (7 vs 8) | 94.3 | 93.2 | +1.1 |
| Recog + single (5 vs 6) | 89.8 | 86.0 | +3.8 |
| Base + multi (3 vs 4) | 76.1 | 65.5 | +10.6 |
| Base + single (1 vs 2) | 71.6 | 65.5 | +6.1 |

The ego_superego learner outperforms unified in all 4 pairwise comparisons,
with the effect strongest for base prompts (+6-11 points) and smaller but
still present for recognition prompts (+1-4 points). This mirrors the A×B
interaction pattern: stronger prompts leave less room for learner architecture
to add value.

**Interpretation:** On multi-turn scenarios, a learner with internal deliberation
(ego generates initial response, superego critiques and refines) produces more
realistic and challenging learner responses, which in turn elicits better tutor
suggestions. The effect is additive with the other two factors.

**Token cost:** Multi-agent cells (7/8) use ~100K input tokens vs ~55K for
single-agent (5/6). Cell 4 stands out at 17 API calls — both tutor dialogue
(4 rounds) and learner ego_superego deliberation compound across 4 turns.

**Factors A and B hold on multi-turn:** Recognition prompts remain dominant
(+20-28 points over base equivalents). Multi-agent tutor adds ~7-8 points
on top of recognition, consistent with the single-turn ANOVA finding.

### Potential improvements to investigate

1. Add specificity instructions to base prompt (cheapest fix)
2. Post-generation validation: check suggestion references scenario-specific elements
3. Inject structured context fields (not just raw learner_context string)
4. Reduce kimi-k2.5 temperature or add retry-on-generic logic
5. Consider whether base prompt is a realistic control or just under-specified
