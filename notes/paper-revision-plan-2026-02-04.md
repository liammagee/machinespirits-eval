# PAPER-UNIFIED.md Revision Plan

**Date:** 2026-02-04
**Status:** Planning

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

### 3. Factor C (Learner Architecture) Context Dependence

Original paper: "Multi-agent learner deliberation shows no effect"

New finding: Effect is model and scenario dependent:
- Single-turn with kimi: +1.5 points (psycho slightly better)
- Multi-turn with kimi: -11.0 points (unified much better)

**Paper implication:** The "no effect" claim needs nuance. Unified learner is recommended for
production, but the mechanism behind Factor C reversal on multi-turn is an open question.

### 4. Hardwired Rules Ablation

Superego critique analysis (186 rejections from 455 dialogues) identified top patterns:
- Engagement (64%), Specificity (51%), Struggle (48%), Memory (31%), Level-matching (20%)

Hardwired rules capturing these patterns achieve ~50% of superego benefit at 70% cost savings.

**Paper implication:** Adds to Section 7.3 "Value of Internal Dialogue" — dynamic dialogue
provides unique value on challenging scenarios, but static rules suffice for easier ones.

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

## Writing Tasks

- [ ] Update abstract with revised findings
- [ ] Add enhanced prompt condition to methodology
- [ ] Revise Section 6.1 with correct factor effects
- [ ] Add new Recognition Theory Validation section
- [ ] Add Cost/Quality Analysis section
- [ ] Update Section 7 discussion with new evidence
- [ ] Revise limitations section
- [ ] Create new tables/figures
- [ ] Update all effect sizes throughout

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

## Dependencies

- Evaluation database with 3,000+ results ✓
- Base vs enhanced vs recognition eval complete ✓
- Factor effect analysis complete ✓
- Cost data available ✓
