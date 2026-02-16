---
name: query-db
description: Query the evaluation database for results, run metadata, or cross-run comparisons
argument-hint: "<natural language question about evaluation data>"
allowed-tools: Bash, Read
---

Answer questions about evaluation data by querying `data/evaluations.db`.

## Database schema

Key table: `evaluation_results`
- `run_id` — evaluation run identifier (e.g. `eval-2026-02-03-f5d4dd93`)
- `profile_name` — cell name (e.g. `cell_1_base_single_unified`)
- `scenario_id` — scenario name
- `model` — ego model used (e.g. `openrouter/moonshotai/kimi-k2.5`)
- `overall_score` — judge score (0-100), the primary outcome measure
- `judge_model` — which judge scored this row
- `scores` — JSON with per-dimension scores
- `suggestions` — the actual tutor response text
- `learner_overall_score` — learner-side score (bilateral runs only)
- `learner_scores` — JSON learner dimension scores
- `created_at` — timestamp

## Critical rules

1. **Always filter by `judge_model`** — runs can have rows from multiple judges. Mixing judges gives wrong results.
2. Score column is `overall_score` (NOT `base_score` — that doesn't exist).
3. Use `LIKE '%partial-id%'` for run ID matching.
4. For effect sizes, compute Cohen's d = (M1 - M2) / pooled_SD.
5. Check for NULLs: `WHERE overall_score IS NOT NULL`.

## Common query patterns

```sql
-- Run summary
SELECT profile_name, judge_model, COUNT(*) n, ROUND(AVG(overall_score),1) mean,
  ROUND(AVG(overall_score*overall_score) - AVG(overall_score)*AVG(overall_score),1) var
FROM evaluation_results WHERE run_id LIKE '<id>%' AND overall_score IS NOT NULL
GROUP BY profile_name, judge_model;

-- All runs
SELECT run_id, COUNT(*) n, ROUND(AVG(overall_score),1) mean, MIN(created_at) started
FROM evaluation_results WHERE overall_score IS NOT NULL
GROUP BY run_id ORDER BY started DESC LIMIT 20;

-- Cross-judge comparison
SELECT judge_model, COUNT(*) n, ROUND(AVG(overall_score),1) mean
FROM evaluation_results WHERE run_id LIKE '<id>%' AND overall_score IS NOT NULL
GROUP BY judge_model;
```

Now answer the user's question: $ARGUMENTS
