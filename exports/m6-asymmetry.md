# M6 — Tutor–Learner Asymmetry: Rubric vs Holistic Adjudication

Generated: 2026-04-17T03:02:12.397Z

Scope: messages-mode 2×2×2 factorial cells 80–87, rubric v2.2, rows with all four metrics populated (tutor rubric, tutor holistic, learner rubric, learner holistic). Recognition arm = cells 84–87; base arm = cells 80–83.

Recognition effect d computed as Cohen's d (recog − base, pooled SD). Rubric↔holistic Pearson r computed within each role on the paired subset.

## Pooled across judges

N total: 1552 (base 778, recog 774)

| Metric | N base | N recog | Mean base | Mean recog | Δ | d (recog − base) |
|--------|--------|---------|-----------|------------|---|------------------|
| tutor rubric | 778 | 774 | 41.40 | 62.03 | 20.63 | 1.120 |
| tutor holistic | 778 | 774 | 22.10 | 35.06 | 12.95 | 0.565 |
| learner rubric | 778 | 774 | 59.48 | 65.23 | 5.75 | 0.379 |
| learner holistic | 778 | 774 | 58.24 | 62.74 | 4.50 | 0.238 |

Rubric↔holistic Pearson r within role (pooled): tutor 0.567, learner 0.751.

### Primary test: does the tutor–learner d-gap shrink on holistic?

| Metric family | Tutor d | Learner d | Gap (t − l) | Learner/Tutor ratio |
|---------------|---------|-----------|-------------|---------------------|
| Rubric | 1.120 | 0.379 | 0.741 | 0.338 |
| Holistic | 0.565 | 0.238 | 0.327 | 0.421 |

Tutor–learner d-gap on rubric: **0.741**. On holistic: **0.327**. Shrinkage: **55.9%**.

## Per-judge breakdown

### claude-code/sonnet

N total: 688 (base 346, recog 342). Rubric↔holistic r: tutor 0.640, learner 0.828.

| Metric | Mean base | Mean recog | d (recog − base) |
|--------|-----------|------------|------------------|
| tutor rubric | 38.05 | 58.44 | 1.225 |
| tutor holistic | 23.88 | 36.77 | 0.601 |
| learner rubric | 54.93 | 60.86 | 0.423 |
| learner holistic | 55.89 | 60.24 | 0.246 |

Tutor–learner d-gap: rubric 0.802; holistic 0.355; shrinkage 55.7%.

### gemini-3.1-pro-preview

N total: 432 (base 216, recog 216). Rubric↔holistic r: tutor 0.570, learner 0.724.

| Metric | Mean base | Mean recog | d (recog − base) |
|--------|-----------|------------|------------------|
| tutor rubric | 44.05 | 67.49 | 1.050 |
| tutor holistic | 20.09 | 37.03 | 0.560 |
| learner rubric | 58.05 | 65.20 | 0.413 |
| learner holistic | 57.50 | 63.26 | 0.241 |

Tutor–learner d-gap: rubric 0.637; holistic 0.319; shrinkage 49.9%.

### gpt-5.4

N total: 432 (base 216, recog 216). Rubric↔holistic r: tutor 0.513, learner 0.653.

| Metric | Mean base | Mean recog | d (recog − base) |
|--------|-----------|------------|------------------|
| tutor rubric | 44.13 | 62.26 | 1.167 |
| tutor holistic | 21.28 | 30.36 | 0.603 |
| learner rubric | 68.20 | 72.20 | 0.360 |
| learner holistic | 62.73 | 66.16 | 0.246 |

Tutor–learner d-gap: rubric 0.807; holistic 0.358; shrinkage 55.7%.

## Interpretation

The tutor–learner recognition-effect d-gap narrows substantially on holistic, consistent with the rubric-artifact account for M6's remaining piece (rubric 0.741 → holistic 0.327, shrinkage 55.9%).

Additional checks worth running if the primary test is ambiguous:
- Regress learner score on learner-message token length (is the effect absorbed by length?)
- Check per-dimension learner rubric scores under recog vs base (which dimensions move, which don't?)
- Same contrast on messages-mode cells 80–87 restricted to single-architecture (unified-only) to rule out architecture × recognition interaction confound.
