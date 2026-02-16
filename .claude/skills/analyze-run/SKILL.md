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
   sqlite3 -header -column data/evaluations.db "SELECT profile_name, judge_model, COUNT(*) n, ROUND(AVG(overall_score),1) mean, ROUND(AVG(overall_score*overall_score) - AVG(overall_score)*AVG(overall_score),1) var FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%' AND overall_score IS NOT NULL GROUP BY profile_name, judge_model ORDER BY profile_name, judge_model"
   ```
   Note: SQLite has no STDEV — compute variance as AVG(x²) - AVG(x)², then take sqrt for SD.

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
