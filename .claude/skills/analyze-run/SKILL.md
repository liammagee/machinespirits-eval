---
name: analyze-run
description: Analyze an evaluation run — pull scores from the DB, compute statistics, and summarize findings
argument-hint: <run-id>
allowed-tools: Bash, Read, Grep, Glob
---

Analyze evaluation run `$ARGUMENTS`.

## Steps

1. **Get run overview** — row counts, judge models, cell profiles:
   ```bash
   sqlite3 -header -column data/evaluations.db "SELECT profile_name, judge_model, scenario_type, COUNT(*) n, ROUND(AVG(tutor_first_turn_score),1) t0_mean, ROUND(AVG(tutor_last_turn_score),1) last_mean, ROUND(AVG(tutor_development_score),1) dev FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%' AND tutor_first_turn_score IS NOT NULL GROUP BY profile_name, judge_model, scenario_type ORDER BY profile_name"
   ```
   Note: SQLite has no STDEV — compute variance as AVG(x²) - AVG(x)², then take sqrt for SD.

2. **Check for multi-turn data** — if `tutor_last_turn_score` is populated, report both Turn 0 and last-turn scores:
   ```bash
   sqlite3 -header -column data/evaluations.db "SELECT profile_name, COUNT(tutor_last_turn_score) has_last_turn, COUNT(learner_overall_score) has_learner, COUNT(dialogue_quality_score) has_dq FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%' GROUP BY profile_name"
   ```

3. **Show summary**: N scored, judge model(s), cell means, recognition delta if applicable.

4. If there are both base and recognition cells, compute:
   - Mean difference (recognition - base)
   - Effect size estimate (Cohen's d using pooled SD)
   - Note any ceiling effects (means > 90)

5. **Check learner scores** if present:
   ```bash
   sqlite3 -header -column data/evaluations.db "SELECT profile_name, ROUND(AVG(learner_overall_score),1) learner_mean, ROUND(AVG(dialogue_quality_score),1) dq_mean FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%' AND learner_overall_score IS NOT NULL GROUP BY profile_name"
   ```

6. **Flag issues**:
   - Mixed judge models (must filter by `judge_model` for valid comparisons)
   - Low N per cell (< 20 is underpowered)
   - NULL scores (incomplete judging):
     ```bash
     sqlite3 data/evaluations.db "SELECT COUNT(*) incomplete FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%' AND tutor_first_turn_score IS NULL"
     ```
   - Missing last-turn scores on multi-turn rows (may need `evaluate --multiturn-only`)

## Score columns reference
| Column | Meaning |
|--------|---------|
| `tutor_first_turn_score` | Turn 0 tutor score (primary measure). `overall_score` is deprecated alias. |
| `tutor_last_turn_score` | Last turn tutor score (multi-turn only) |
| `tutor_development_score` | Change from first to last turn |
| `learner_overall_score` | Learner quality score |
| `dialogue_quality_score` | Bilateral dialogue quality |
| `tutor_holistic_overall_score` | Holistic tutor assessment |
| `learner_holistic_overall_score` | Holistic learner assessment |

## Important
- **Always filter by `judge_model`** — runs can have rows from multiple judges
- `tutor_first_turn_score` is the primary tutor score column (NOT `overall_score`)
- Run IDs can be partial — use LIKE with % suffix
- Legacy cell names (e.g. `cell_1`) may coexist with canonical names (`cell_1_base_single_unified`)
