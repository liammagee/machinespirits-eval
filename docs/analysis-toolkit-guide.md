# Analysis Toolkit Guide

Decision tree for Paper 2.0 post-hoc analysis. See also `scripts/ANALYSIS-SCRIPTS.md` for full registry, and the `/analyze-data` Claude skill.

## Standard Pipeline (after a new run)

```
1. evaluate         →  Score all rows (per-turn + holistic + learner + dialogue)
2. analyze:effects  →  ANOVA, effect sizes, marginal means
3. analyze:traces   →  Process measures from dialogue logs (RevDelta, EgoSpec, etc.)
4. analyze:trajectories → Per-dimension trajectory curves (learner + tutor)
5. analyze:change   →  Symmetric within-test first-to-last delta
```

```bash
node scripts/eval-cli.js evaluate <runId>
node scripts/analyze-eval-results.js --run-id <runId>
node scripts/analyze-mechanism-traces.js <runId>
node scripts/analyze-trajectory-curves.js <runId>
node scripts/analyze-within-test-change.js <runId>
```

## Cross-Judge Validation

```
1. rejudge with GPT  →  Creates new rows with GPT scores
2. analyze:reliability → Inter-judge correlation on content-hashed pairs
```

```bash
node scripts/eval-cli.js rejudge <runId> --judge openrouter.gpt
node scripts/analyze-judge-reliability.js
```

**Prerequisite**: At least one run must have been scored by two different judges (same `suggestions` content, different `judge_model`).

## Qualitative Depth

```
1. assess-transcripts  →  AI narrative assessment (API calls)
2. qualitative-analysis → Rule-based thematic coding (free)
3. qualitative-analysis-ai → LLM theme discovery (API calls)
```

```bash
node scripts/assess-transcripts.js <runId> [--blinded]
node scripts/qualitative-analysis.js
node scripts/qualitative-analysis-ai.js --mode both
```

## Paper 2.0 Mechanisms

| Analysis | Script | Paper section |
|----------|--------|---------------|
| Trajectory curves | `analyze-trajectory-curves.js` | 6.12.1-6.12.2 |
| Mechanism traces | `analyze-mechanism-traces.js` | 6.2 |
| Within-test change | `analyze-within-test-change.js` | 6.15 |
| Learning stagnation | `analyze-learning-stagnation.js` | 6.15 |
| Rubric consistency | `analyze-rubric-consistency.js` | 5.4 |
| Impasse strategies | `code-impasse-strategies.js` | 6.11 (API) |
| Dialectical modulation | `code-dialectical-modulation.js` | 6.11 (API) |

## Data Prerequisites

| Score column | Populated by | Required for |
|--------------|--------------|--------------|
| `tutor_first_turn_score` | `evaluate` | effects, modulation |
| `tutor_last_turn_score` | `evaluate --multiturn-only` | trajectories, change |
| `learner_scores` (JSON) | `evaluate` | trajectories, stagnation |
| `scores_with_reasoning` | `evaluate` | modulation, rubric consistency |
| `tutor_holistic_overall_score` | `evaluate` | rubric consistency |
| `dialogue_quality_score` | `evaluate` | rubric consistency |
| Dialogue logs | `run` (auto-saved) | traces, change, impasse coding |

## npm Shortcuts

All pure-computation scripts have `analyze:*` npm shortcuts:

```bash
npm run analyze:effects         # ANOVA + effect sizes
npm run analyze:costs           # Token/cost breakdown
npm run analyze:traces -- <id>  # Process measures (needs runId)
npm run analyze:reliability     # Inter-judge correlation
npm run analyze:trajectories -- <id>  # Trajectory curves (needs runId or --all-multiturn)
npm run analyze:change          # Within-test delta
npm run analyze:modulation      # Modulation metrics
npm run analyze:stagnation      # Learning stagnation
```

LLM-based scripts (assess-transcripts, qualitative-analysis-ai, code-impasse-strategies, code-dialectical-modulation) are excluded from npm shortcuts to prevent accidental API spend.
