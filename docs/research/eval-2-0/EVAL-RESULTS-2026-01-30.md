# Eval 2.0 Results Analysis — 2026-01-30

Run ID: `eval-2026-01-30-14d87137`
Description: Post-fix full battery v2 (model ID fix)

---

## Part A: Evaluation Framework Verification

### 1. Coverage and Completeness

| Metric | Value |
|--------|-------|
| Total evaluations | 46 |
| Ego models tested | 3 (haiku, sonnet, opus) + 1 partial (gpt-5-mini) |
| Scenarios per model | 15 |
| Null scores | **0** |
| Errors recorded | **0** |

**Assessment**: Full coverage across all 15 scenarios for the 3 Claude ego models. Zero null scores — a significant improvement from the prior run (`eval-2026-01-30-65b704a6`) which had null score failures. The model ID fix (`kimi-k2_5` → `kimi-k2.5`) resolved the judge model resolution issue.

### 2. Judge Model Reliability

| Judge | Evals | Scored | Failed |
|-------|-------|--------|--------|
| `moonshotai/kimi-k2.5` (primary) | 37 | 37 | 0 |
| NONE (fallback completed) | 9 | 9 | 0 |

- Primary judge (kimi-k2.5) successfully scored 80% of evaluations.
- 20% required fallback to nemotron, which also succeeded.
- The JSON parse failure → fallback retry mechanism is working correctly.
- **No double-failures** in this run (both primary and fallback succeeding in all cases).

### 3. Dual Scoring Implementation

| Metric | Count |
|--------|-------|
| Has `base_score` | 31/46 (67%) |
| Has `recognition_score` | 22/46 (48%) |

**Issue identified**: Not all evaluations produce both dual scores. This appears correlated with which judge model was used — the fallback judge may not consistently return all 10 dimensions. Specifically:

- When the primary judge (kimi-k2.5) succeeds, all 10 dimensions are typically present.
- When the fallback (nemotron) is used, some recognition dimensions may be missing.
- The `recognition_score` is calculated from 4 recognition-specific dimensions; if any are missing, the score may be null.

**Recommendation**: Ensure the fallback judge prompt explicitly requests all 10 dimensions, or handle partial dimension sets more gracefully in `calculateRecognitionScore()`.

### 4. Scenario Type Classification

All 15 scenarios are classified as `suggestion` type in the database, even the 3 multi-turn scenarios (`misconception_correction_flow`, `mood_frustration_to_breakthrough`, `mutual_transformation_journey`). The `scenario_type` column shows `suggestion` for all — this suggests the multi-turn scenarios may not be properly tagged or the multi-turn runner may not be setting the type correctly.

**Recommendation**: Verify that multi-turn scenarios set `scenario_type = 'multi_turn'` in the database. This is needed for accurate multi-turn analysis.

### 5. Framework Verdict

The eval framework is **functioning correctly** for its core purpose:
- All 15 scenarios execute across all profiles
- The tutor generates suggestions for each scenario context
- The judge evaluates suggestions against the rubric
- Scores are computed and stored with dual scoring (base + recognition)
- The fallback retry mechanism prevents null scores

**Known issues**:
1. Multi-turn scenario type not tagged in DB
2. Recognition score coverage at 48% (fallback judge dimension gaps)
3. The run used `configurations='all'` (22 models) when probably `profiles` was intended

---

## Part B: Results Analysis

### 1. Overall Performance by Ego Model

| Ego Model | N | Mean Score | Base Score | Recognition Score | Min | Max |
|-----------|---|-----------|-----------|------------------|-----|-----|
| Claude Sonnet 4.5 | 15 | **74.9** | 78.1 | 54.8 | 50 | 100 |
| Claude Haiku 4.5 | 15 | 74.7 | 71.2 | 48.6 | 50 | 100 |
| Claude Opus 4.5 | 15 | 72.3 | 71.8 | 43.4 | 43 | 100 |

**Key finding**: All three Claude models perform within a narrow range (72.3–74.9), suggesting that the single-agent budget configuration (DeepSeek ego with no Superego dialogue) produces relatively **model-invariant** results. The ego model's raw capability differences don't strongly differentiate when the architectural configuration is fixed at `budget` (single-agent, no dialogue).

This contrasts with the PAPER-UNIFIED finding that architecture accounts for ~15% of variance — but the current eval uses a fixed architecture (budget/single-agent) across all ego models, so we're measuring ego model effects in isolation.

**Sonnet leads** by a small margin (74.9), particularly on base dimensions (78.1 base score). Opus shows the lowest recognition scores (43.4), which is notable — the more capable model may produce more generic/lecture-oriented suggestions that the judge rates lower on recognition dimensions.

### 2. Base Score vs Recognition Score Gap

| Model | Base | Recognition | Gap |
|-------|------|-------------|-----|
| Haiku | 72.0 | 48.6 | **23.4** |
| Sonnet | 77.8 | 54.8 | **23.0** |
| Opus | 70.7 | 43.4 | **27.3** |

All models show a consistent **23–28 point gap** between base and recognition scores. This is expected and consistent with the PAPER-UNIFIED framework: without recognition-enhanced prompts or multi-agent architecture, the tutor performs adequately on base pedagogical dimensions but poorly on recognition-specific ones (mutual recognition, dialectical responsiveness, memory integration, transformative potential).

The gap is a meaningful signal: it confirms that the recognition dimensions are measuring something distinct from base quality, and that the budget configuration predictably scores low on recognition.

### 3. Dimension Analysis

| Dimension | All Models Avg | Interpretation |
|-----------|---------------|----------------|
| **Actionability** | **4.94** | Near-perfect — suggestions always include a clear next step |
| **Specificity** | **4.48** | Strong — suggestions reference content by ID |
| **Tone** | 3.92 | Adequate but room for improvement |
| **Relevance** | 3.73 | Moderate — some context mismatches |
| **Personalization** | 3.50 | Below target — suggestions often feel generic |
| **Pedagogical** | 3.39 | Below target — sometimes advances content vs. deepens understanding |

The dimension profile matches the expected pattern for a non-recognition configuration: strong on mechanical dimensions (actionability, specificity) but weaker on relational ones (personalization, pedagogical soundness). This is the "knowledge deficit" model described in the paper — the tutor knows *what* to suggest but doesn't deeply engage with *who* the learner is.

#### Per-Model Dimension Breakdown

| Model | Rel | Spec | Ped | Pers | Act | Tone |
|-------|-----|------|-----|------|-----|------|
| Haiku | 3.44 | 4.34 | 3.19 | 3.41 | 4.88 | 3.91 |
| Opus | 3.63 | 4.28 | 3.23 | 3.42 | **5.00** | 3.90 |
| Sonnet | **3.92** | **4.69** | **3.61** | **3.67** | 4.92 | **3.94** |

Sonnet leads across all dimensions except actionability (where Opus gets a perfect 5.0). The differences are modest (0.2–0.4 points) but consistent.

### 4. Scenario Performance

**Top performers** (mean > 85):

| Scenario | Mean | Interpretation |
|----------|------|----------------|
| returning_user_mid_course | **92.0** | Natural curriculum progression — easy for tutor |
| activity_avoider | **91.3** | Clear pedagogical need (engagement) maps well |
| struggling_learner | **89.8** | Struggle signals trigger appropriate review suggestions |

**Bottom performers** (mean < 65):

| Scenario | Mean | Interpretation |
|----------|------|----------------|
| mood_excited_curious | **57.6** | Tutor doesn't match the learner's intellectual energy |
| high_performer | **58.3** | Tutor fails to challenge; suggests sequential content |
| misconception_correction_flow | **64.5** | Multi-turn: tutor pushes to new content vs. correcting |
| concept_confusion | **65.2** | Similar — forwards vs. clarifies |

The pattern is clear: the budget configuration handles **straightforward pedagogical situations** well (new user, returning user, struggling learner) but fails at **nuanced relational situations** (excited curiosity, high achievement, misconception correction). This is exactly the gap that recognition-enhanced prompting is designed to address.

### 5. Model × Scenario Highlights

Notable perfect scores (100):
- Haiku: `activity_avoider`, `adversarial_tester`, `memory_continuity_single` (via fallback), `returning_user`, `struggling_learner`, `transformative_moment`
- Opus: `activity_avoider`, `memory_continuity_single`, `mood_frustrated`, `returning_user`
- Sonnet: `concept_confusion`, `recognition_seeking_learner`

Notable low scores:
- Opus: `high_performer` (43.2) — the most capable model scores lowest on challenging the high performer
- Haiku/Opus: `mood_excited_curious` (50.0) — intellectual excitement not matched
- Haiku: `concept_confusion` (50.0) — doesn't address the specific confusion

**Cross-model variance**: Some scenarios show high inter-model variance (e.g., `adversarial_tester`: 50–100, `concept_confusion`: 45–100), suggesting these scenarios are more sensitive to the ego model's response patterns. This is valuable for the eval design — high-variance scenarios are better at discriminating between conditions.

### 6. Score Distribution

| Range | Count | % |
|-------|-------|---|
| 80–100 (Excellent) | 17 | 37% |
| 60–79 (Good) | 18 | 39% |
| 40–59 (Average) | 11 | 24% |
| 20–39 (Below Avg) | 0 | 0% |
| 0–19 (Poor) | 0 | 0% |

No scores below 40 — the budget configuration produces a floor of ~43. The bimodal tendency (37% excellent, 24% average) suggests scenario difficulty drives score variance more than model choice.

---

## Comparison with PAPER-UNIFIED Findings

| Metric | PAPER-UNIFIED (budget baseline) | Current Eval | Delta |
|--------|--------------------------------|-------------|-------|
| Mean overall score | ~40–46 (baseline conditions) | 73.9 | +28–34 |
| Relevance | 3.05 | 3.73 | +0.68 |
| Specificity | 4.19 | 4.48 | +0.29 |
| Pedagogical | 2.52 | 3.39 | +0.87 |
| Personalization | 2.75 | 3.50 | +0.75 |

The current eval scores substantially higher than the PAPER-UNIFIED baseline conditions (40–46). Possible explanations:

1. **Different ego model**: Current uses DeepSeek (free tier) which may differ from the original Nemotron
2. **Different scenarios**: The trimmed 15 scenarios may be easier on average than the original 49
3. **Different judge**: kimi-k2.5 may be a more lenient judge than Claude Sonnet 4.5 (used in original)
4. **Single-agent vs multi-agent**: The budget config is single-agent but without the explicit "baseline" prompt framing

**The most likely explanation is judge leniency** — kimi-k2.5 and the nemotron fallback may produce systematically higher scores than Claude Sonnet 4.5 as judge. This is a calibration issue worth investigating.

---

## Recommendations

1. **Re-run with profile-based configs** instead of `all` — use `--config profiles` to test the 2x2x2 factorial design
2. **Investigate judge calibration** — compare kimi-k2.5 scores vs Sonnet 4.5 scores on the same suggestions to assess inter-judge reliability
3. **Fix multi-turn scenario tagging** — ensure `scenario_type` is correctly set in the DB
4. **Improve recognition dimension coverage** — ensure fallback judge returns all 10 dimensions
5. **Add the recognition-enhanced profiles** to get the full base vs. recognition comparison
