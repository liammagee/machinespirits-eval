# PAPER-UNIFIED.md Revision Plan — COMPLETE

**Date:** 2026-02-04
**Status:** Complete — all findings incorporated into PAPER-FULL and PAPER-SHORT.
Superseded by `todos-feedback-2026-02-07.md`.

## Overview

This note outlines a plan to revise PAPER-UNIFIED.md using findings from the robust evaluation
framework developed in January-February 2026. The evaluation framework now has 3,000+ results
across multiple models, scenarios, and factorial conditions, providing much stronger empirical
grounding than the original paper.

## Key New Findings to Incorporate

### 1. Recognition Theory Validation (NEW)

The base vs enhanced vs recognition eval (eval-2026-02-03-86b159cd) isolated the recognition
theory contribution from prompt engineering effects:

| Prompt Type | Avg Score | vs Base |
|-------------|-----------|---------|
| Recognition | 94.0 | +20.1 |
| Enhanced | 85.3 | +11.4 |
| Base | 73.9 | — |

**Effect decomposition:**
- Total recognition effect: +20.1 points
- Prompt engineering alone: +11.4 points (57%)
- Recognition theory unique value: +8.7 points (43%)

**Paper implication:** This directly addresses the confound identified in Section 7. We can now
claim that recognition theory has measurable value beyond better prompt engineering.

### 2. Revised Factor Effects

The original paper reports:
- Recognition: +35.1 points (85% of improvement)
- Multi-agent: +6.2 points (15% of improvement)

The robust evaluation (n=3,000+) shows:
- Factor A (Recognition): +9 to +20 points (dominant, consistent)
- Factor B (Tutor multi-agent): -1 to +1 points (minimal, not significant)
- Factor C (Learner ego/superego): -11 to +1.5 points (context-dependent)

**Paper implication:** Multi-agent tutor architecture shows less benefit than originally reported.
The extended 2×2×2 study needs updated numbers. Recognition remains dominant.

### 3. A×B Interaction is Recognition-Specific (NEW)

The enhanced + multi-agent eval (eval-2026-02-04-948e04b3) tested whether the A×B synergy
generalizes beyond recognition prompts:

| Prompt Type | Single-agent | Multi-agent | Delta |
|-------------|--------------|-------------|-------|
| Recognition | 72.2 | 81.5 | +9.2 |
| Enhanced | 83.3 | 83.3 | +0.0 |

**Finding:** The multi-agent synergy (+9.2 points) is specific to recognition prompts.
Enhanced prompts show no benefit from multi-agent architecture.

**Interpretation:** Recognition theory creates *conditions* where the superego's challenge
adds value. Enhanced prompts (better instructions alone) don't benefit because they don't
create the same deliberative space. The superego needs recognition-framed dialogue to
contribute meaningfully.

**Paper implication:** This strengthens the theoretical claim about recognition as emergent
property. The architecture matters only when paired with recognition framing.

### 4. Factor C (Learner Architecture) Context Dependence

Original paper: "Multi-agent learner deliberation shows no effect"

New finding: Effect is model and scenario dependent:
- Single-turn with kimi: +1.5 points (psycho slightly better)
- Multi-turn with kimi: -11.0 points (unified much better)

**Paper implication:** The "no effect" claim needs nuance. Unified learner is recommended for
production, but the mechanism behind Factor C reversal on multi-turn is an open question.

### 5. Hardwired Rules Ablation

Superego critique analysis (186 rejections from 455 dialogues) identified top patterns:
- Engagement (64%), Specificity (51%), Struggle (48%), Memory (31%), Level-matching (20%)

Hardwired rules capturing these patterns achieve ~50% of superego benefit at 70% cost savings.

**Paper implication:** Adds to Section 7.3 "Value of Internal Dialogue" — dynamic dialogue
provides unique value on challenging scenarios, but static rules suffice for easier ones.

### 6. Domain Generalizability (NEW)

The elementary content eval (eval-2026-02-04-79b633ca) tested whether findings generalize
from graduate philosophy to 4th-grade math (fractions). Created minimal test content at
`content-test-elementary/` with environment variable support for switching domains.

**Factor effects comparison:**

| Factor | Elementary (Math) | Philosophy (Hegel) |
|--------|-------------------|-------------------|
| A: Recognition | +4.4 pts | +13.9 pts |
| B: Multi-agent tutor | **+9.9 pts** | +0.5 pts |
| C: Learner psycho | +0.75 pts | +2.1 pts |
| Overall avg | 68.0 | 85.9 |
| Best config | recog+multi (77.3) | recog+multi (94.0) |

**Key findings:**

1. **Factor effects invert by domain**: On elementary content, multi-agent architecture
   (+9.9) matters more than recognition theory (+4.4). On philosophy, it's reversed.

2. **Multi-agent as error correction**: The nemotron model hallucinated philosophy content
   (479-lecture-1) even when given elementary curriculum context. The superego caught and
   corrected these domain errors — critical for new domain deployment.

3. **Recognition theory is domain-sensitive**: Philosophical language of recognition
   (mutual acknowledgment, transformation) resonates more with graduate-level abstract
   content than concrete 4th-grade math.

4. **Architecture recommendation varies by use case**:
   - New/untrained domain: Multi-agent essential (superego catches domain errors)
   - Well-trained domain: Recognition prompts sufficient, multi-agent optional

**Paper implication:** Adds important nuance to claims about recognition theory universality.
The framework's value depends on content domain and model training. Multi-agent architecture
provides robustness for domain transfer that single-agent cannot match.

## Sections Requiring Updates

### Abstract
- Update effect sizes to match robust evaluation
- Add recognition theory validation finding
- Revise multi-agent contribution claim

### Section 5: Evaluation Methodology
- Add description of enhanced prompt condition
- Describe the 3-way comparison (base vs enhanced vs recognition)
- Update sample sizes (now n=3,000+)
- Add cost/quality analysis methodology

### Section 6: Results

#### 6.1 Factorial Analysis
- Update Factor A (recognition) effect size
- Revise Factor B (multi-agent tutor) claim — effect is minimal
- Add Factor C context-dependence finding

#### 6.6 Extended Ablation Study
- Update 2×2×2 results with robust data
- Add note on kimi vs nemotron model differences
- Add multi-turn vs single-turn interaction

#### NEW Section: Recognition Theory Validation
- Present base vs enhanced vs recognition results
- Decompose recognition effect into prompt engineering + theory
- Discuss implications for theoretical claims

#### NEW Section: Cost/Quality Analysis
- Present cost per test by configuration
- Recommend optimal production configuration
- Discuss tradeoffs

### Section 7: Discussion

#### 7.1 What the Difference Consists In
- Strengthen with recognition theory validation data

#### 7.2 Recognition as Emergent Property
- Discuss enhanced vs recognition finding
- Theory adds value beyond instructable rules

#### 7.3 Value of Internal Dialogue
- Add hardwired rules finding
- Dynamic dialogue valuable for challenging scenarios

### Section 8: Limitations
- Add note on model-specific effects (Factor C reversal with kimi)
- Acknowledge evaluation-only testing (no live learners yet)
- Add domain generalizability caveat (findings strongest on philosophy content)
- Note model hallucination issue on new domains (nemotron suggests 479 for elementary)

## New Tables/Figures Needed

1. **Table: Base vs Enhanced vs Recognition Comparison**
   - 4 scenarios × 3 prompt types × 3 reps
   - Effect decomposition

2. **Table: Revised Factor Effects (Full Factorial)**
   - Factor A, B, C main effects
   - Interaction effects
   - By-scenario breakdown

3. **Table: Cost/Quality Tradeoffs**
   - Configuration × avg score × cost per test

4. **Figure: Recognition Effect Decomposition**
   - Stacked bar showing prompt engineering vs theory contributions

5. **Table: Domain Generalizability Comparison**
   - Elementary vs Philosophy factor effects
   - Shows inverted A/B importance by domain
   - Supports architecture recommendations

## Writing Tasks

- [x] Update abstract with revised findings
- [x] Add enhanced prompt condition to methodology
- [x] Revise Section 6.1 with correct factor effects
- [x] Add new Recognition Theory Validation section
- [x] Add Cost/Quality Analysis section
- [x] Add Domain Generalizability section (or subsection in Discussion)
- [x] Update Section 7 discussion with new evidence
- [x] Revise limitations section (add domain transfer caveats)
- [x] Create new tables/figures
- [x] Update all effect sizes throughout

## Notes for Further Work

The following items were deprioritized during evaluation but may warrant future investigation:

### 1. Factor C Reversal Mechanism
Why does learner ego/superego architecture hurt performance on multi-turn with kimi (-11 pts)
but slightly help on single-turn (+1.5 pts)? Hypothesis: Extra deliberation interferes with
kimi's reasoning on complex scenarios. Would need model-switching eval to confirm (nemotron ego
+ kimi superego vs kimi ego + kimi superego).

### 2. Temperature Optimization
Current ego temperature is 0.6. Lower values (0.3-0.4) might reduce variance/generic fallbacks.
However, hardwired rules already address this issue, making temperature tuning low ROI.

### 3. Retry-on-Generic Strategy
Pre-superego signal check to retry if ego output doesn't mention context signals. Deprioritized
because superego already handles this via reject+retry dialogue, and hardwired rules encode
the fix statically.

### 4. Increased Replication
Multi-turn scenarios have high variance (SD=16 vs 9 for single-turn). More replications (5+)
would improve statistical power. However, n=218 kimi multi-turn results already sufficient
for main findings.

### 5. Live Learner Evaluation
All current evaluation uses simulated learners. Validation with actual human learners would
strengthen ecological validity claims. This is a substantial undertaking requiring IRB approval
and participant recruitment.

### 6. Longitudinal Effects
Current evaluation measures single-interaction quality. The recognition framework's claims
about mutual transformation and memory suggest longitudinal studies tracking learner progress
over multiple sessions would be valuable.

## Timeline

1. **Week 1:** Update methodology and results sections with new data
2. **Week 2:** Add new sections (recognition validation, cost/quality)
3. **Week 3:** Revise discussion and abstract
4. **Week 4:** Create tables/figures, final polish

## Reproducible Evaluation Commands

The following commands reproduce the key analyses in this revision plan.

### 1. Base vs Enhanced vs Recognition (Finding #1)

Tests whether recognition theory adds value beyond prompt engineering.

```bash
# Run the 3-way comparison (base, enhanced, recognition prompts)
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_9_enhanced_single_unified,cell_5_recog_single_unified \
  --scenarios struggling_learner,concept_confusion,mood_frustrated_explicit,high_performer \
  --runs 3

# Analyze results (substitute actual run ID)
node scripts/eval-cli.js report eval-2026-02-03-86b159cd
```

### 2. Full 2×2×2 Factorial with Kimi (Findings #2, #4)

Tests all factor combinations with kimi-k2.5 model.

```bash
# Run full factorial (8 cells × 15 scenarios × 3 reps)
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_2_base_single_psycho,cell_3_base_multi_unified,cell_4_base_multi_psycho,cell_5_recog_single_unified,cell_6_recog_single_psycho,cell_7_recog_multi_unified,cell_8_recog_multi_psycho \
  --runs 3

# Factor effect analysis query
sqlite3 data/evaluations.db "
SELECT
  profile_name,
  ROUND(AVG(overall_score), 1) as avg_score,
  COUNT(*) as n
FROM evaluation_results
WHERE run_id = 'eval-2026-02-03-f5d4dd93'
  AND overall_score IS NOT NULL
GROUP BY profile_name
ORDER BY avg_score DESC
"
```

### 3. A×B Interaction Test (Finding #3)

Tests whether multi-agent synergy requires recognition prompts.

```bash
# Enhanced + multi-agent comparison
node scripts/eval-cli.js run \
  --profiles cell_9_enhanced_single_unified,cell_11_enhanced_multi_unified \
  --scenarios struggling_learner,concept_confusion,mood_frustrated_explicit \
  --runs 3

# Compare to recognition + multi-agent (from factorial)
# cell_5 vs cell_7 (recognition single vs multi)
# cell_9 vs cell_11 (enhanced single vs multi)
```

### 4. Domain Generalizability (Finding #6)

Tests whether findings transfer to different content domains.

```bash
# Run with elementary content (4th grade fractions)
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_3_base_multi_unified,cell_5_recog_single_unified,cell_7_recog_multi_unified \
  --scenarios struggling_student,concept_confusion,frustrated_student \
  --runs 1

# Compare factor effects across domains
sqlite3 data/evaluations.db "
SELECT
  profile_name,
  ROUND(AVG(overall_score), 1) as avg
FROM evaluation_results
WHERE run_id = 'eval-2026-02-04-79b633ca'
GROUP BY profile_name
ORDER BY avg DESC
"
```

### 5. Cost/Quality Analysis

```bash
# Get cost data by configuration
sqlite3 data/evaluations.db "
SELECT
  profile_name,
  ROUND(AVG(overall_score), 1) as avg_score,
  ROUND(AVG(latency_ms)/1000, 1) as avg_seconds,
  COUNT(*) as n
FROM evaluation_results
WHERE overall_score IS NOT NULL
  AND run_id LIKE 'eval-2026-02-%'
GROUP BY profile_name
ORDER BY avg_score DESC
"
```

### 6. Superego Critique Pattern Analysis (Finding #5)

```bash
# Extract rejection patterns from dialogue logs
node -e "
import fs from 'fs';
import path from 'path';

const logsDir = './logs/tutor-dialogues';
const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.json'));

const patterns = { engagement: 0, specificity: 0, struggle: 0, memory: 0, recognition: 0 };
let totalRejections = 0;

for (const file of files.slice(-500)) {
  const data = JSON.parse(fs.readFileSync(path.join(logsDir, file)));
  for (const step of data.steps || []) {
    if (step.role === 'superego' && step.verdict?.action === 'reject') {
      totalRejections++;
      const feedback = (step.verdict.feedback || '').toLowerCase();
      if (feedback.includes('engag')) patterns.engagement++;
      if (feedback.includes('specific')) patterns.specificity++;
      if (feedback.includes('struggl')) patterns.struggle++;
      if (feedback.includes('memory') || feedback.includes('history')) patterns.memory++;
      if (feedback.includes('recogni')) patterns.recognition++;
    }
  }
}

console.log('Total rejections:', totalRejections);
for (const [k, v] of Object.entries(patterns)) {
  console.log(k + ':', v, '(' + Math.round(100*v/totalRejections) + '%)');
}
"
```

### Key Run IDs for Reference

| Finding | Run ID | Description |
|---------|--------|-------------|
| Recognition validation | eval-2026-02-03-86b159cd | Base vs enhanced vs recognition |
| Full factorial (kimi) | eval-2026-02-03-f5d4dd93 | 8 cells × 15 scenarios × 3 reps |
| A×B interaction | eval-2026-02-04-948e04b3 | Enhanced + multi-agent test |
| Domain generalizability | eval-2026-02-04-79b633ca | Elementary fractions content |

## Dependencies

- Evaluation database with 3,000+ results ✓
- Base vs enhanced vs recognition eval complete ✓
- Factor effect analysis complete ✓
- Cost data available ✓
- Domain generalizability eval complete ✓ (eval-2026-02-04-79b633ca)
- Elementary test content created ✓ (content-test-elementary/)
