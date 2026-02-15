---
name: analyze-run
description: Analyze an evaluation run — pull scores from the DB, compute statistics, and summarize findings
argument-hint: <run-id>
allowed-tools: Bash, Read, Grep, Glob
---

Analyze evaluation run `$ARGUMENTS`.

## Steps

1. Query the database for this run:
   ```bash
   sqlite3 data/evaluations.db "SELECT tutor_profile, scenario_id, judge_model, COUNT(*) as n, ROUND(AVG(overall_score),1) as mean, ROUND(STDEV(overall_score),1) as sd FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%' AND overall_score IS NOT NULL GROUP BY tutor_profile, scenario_id, judge_model ORDER BY tutor_profile, scenario_id"
   ```

2. Show overall summary: N scored, judge model(s), cell means, recognition delta if applicable.

3. If there are both base and recognition cells, compute:
   - Mean difference (recognition - base)
   - Effect size estimate (Cohen's d using pooled SD)
   - Note any ceiling effects (means > 90)

4. Flag any issues:
   - Mixed judge models (filter by `judge_model`)
   - Low N per cell (< 20 is underpowered)
   - NULL scores (incomplete judging)
   - Check: `SELECT COUNT(*) FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%' AND overall_score IS NULL`

## Important
- Always filter by `judge_model` — runs can have rows from multiple judges
- Score column is `overall_score` (NOT `base_score`)
- Model format is dot notation: `openrouter.nemotron`, NOT slash
- Run IDs can be partial — use LIKE with % suffix
