---
name: query-db
description: Query the evaluation database for results, run metadata, or cross-run comparisons
argument-hint: "<natural language question about evaluation data>"
allowed-tools: Bash, Read
---

Answer questions about evaluation data by querying `data/evaluations.db`.

## Database schema

### evaluation_results (key columns)

| Column | Type | Description |
|--------|------|-------------|
| `run_id` | TEXT | Run identifier (e.g. `eval-2026-02-03-f5d4dd93`) |
| `profile_name` | TEXT | Cell name (e.g. `cell_1_base_single_unified`) |
| `scenario_id` | TEXT | Scenario name |
| `scenario_type` | TEXT | `single-turn` or `multi-turn` |
| `model` | TEXT | Ego model (full OpenRouter path) |
| `ego_model` | TEXT | Tutor ego model |
| `superego_model` | TEXT | Tutor superego model |
| `judge_model` | TEXT | Which judge scored this row |
| `conversation_mode` | TEXT | NULL or `messages` |
| **Tutor scores** | | |
| `tutor_first_turn_score` | REAL | **Primary tutor score** (Turn 0). `overall_score` is deprecated alias. |
| `tutor_last_turn_score` | REAL | Last turn score (multi-turn only) |
| `tutor_development_score` | REAL | Change from first to last turn |
| `tutor_scores` | JSON | Per-dimension tutor scores |
| `tutor_holistic_overall_score` | REAL | Holistic tutor assessment |
| `tutor_holistic_summary` | TEXT | Holistic tutor narrative |
| **Learner scores** | | |
| `learner_overall_score` | REAL | Learner quality score |
| `learner_scores` | JSON | Per-dimension learner scores |
| `learner_holistic_overall_score` | REAL | Holistic learner assessment |
| **Dialogue quality** | | |
| `dialogue_quality_score` | REAL | Bilateral dialogue quality |
| `dialogue_quality_summary` | TEXT | Dialogue quality narrative |
| **Factor columns** | | |
| `factor_recognition` | TEXT | `base` or `recognition` |
| `factor_multi_agent_tutor` | TEXT | `true` or `false` |
| `factor_multi_agent_learner` | TEXT | `unified` or `ego_superego` |
| `learner_architecture` | TEXT | Full learner architecture string |
| **Other** | | |
| `suggestions` | JSON | Actual response content (array of turn objects) |
| `scores_with_reasoning` | JSON | Per-dimension scores with judge reasoning |
| `created_at` | TEXT | Timestamp |

### evaluation_runs

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Run ID |
| `created_at` | TEXT | Start time |
| `description` | TEXT | Run description |
| `total_tests` | INT | Planned test count |
| `status` | TEXT | running/completed/failed |
| `metadata` | JSON | Config, model overrides, CLI flags |

## Critical rules

1. **Always filter by `judge_model`** — runs can have rows from multiple judges. Mixing judges gives wrong results.
2. Primary score column is **`tutor_first_turn_score`** (NOT `overall_score`, NOT `base_score`).
3. Use `LIKE '%partial-id%'` for run ID matching.
4. For effect sizes: Cohen's d = (M1 - M2) / pooled_SD.
5. Always check for NULLs: `WHERE tutor_first_turn_score IS NOT NULL`.
6. **NEVER run DELETE with LIKE patterns** — enumerate specific IDs. Wildcard deletes have destroyed live runs.
7. SQLite has no STDEV — use: `SQRT(AVG(x*x) - AVG(x)*AVG(x))` for standard deviation.
8. Legacy cell names (`cell_1`) coexist with canonical names (`cell_1_base_single_unified`). Use `LIKE 'cell_1%'` for cross-run queries.

## Common query patterns

```sql
-- Run summary (tutor scores by cell and judge)
SELECT profile_name, judge_model, COUNT(*) n,
  ROUND(AVG(tutor_first_turn_score),1) mean,
  ROUND(SQRT(AVG(tutor_first_turn_score*tutor_first_turn_score) - AVG(tutor_first_turn_score)*AVG(tutor_first_turn_score)),1) sd
FROM evaluation_results WHERE run_id LIKE '<id>%' AND tutor_first_turn_score IS NOT NULL
GROUP BY profile_name, judge_model;

-- Recent runs
SELECT id, description, total_tests, status, created_at
FROM evaluation_runs ORDER BY created_at DESC LIMIT 20;

-- Cross-judge comparison
SELECT judge_model, COUNT(*) n, ROUND(AVG(tutor_first_turn_score),1) mean
FROM evaluation_results WHERE run_id LIKE '<id>%' AND tutor_first_turn_score IS NOT NULL
GROUP BY judge_model;

-- Multi-turn summary (first vs last turn)
SELECT profile_name,
  ROUND(AVG(tutor_first_turn_score),1) t0,
  ROUND(AVG(tutor_last_turn_score),1) last,
  ROUND(AVG(tutor_development_score),1) dev
FROM evaluation_results WHERE run_id LIKE '<id>%' AND tutor_last_turn_score IS NOT NULL
GROUP BY profile_name;

-- Learner + dialogue quality
SELECT profile_name,
  ROUND(AVG(learner_overall_score),1) learner,
  ROUND(AVG(dialogue_quality_score),1) dq
FROM evaluation_results WHERE run_id LIKE '<id>%' AND learner_overall_score IS NOT NULL
GROUP BY profile_name;
```

Now answer the user's question: $ARGUMENTS
