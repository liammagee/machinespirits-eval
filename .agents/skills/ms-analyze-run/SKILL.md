---
name: ms-analyze-run
description: Summarize one existing evaluation run from stored scores, judges, cells, and completeness metadata. Use for a run-level statistical overview; use ms-deep-dive for transcripts or qualitative assessment and ms-query-db for an ad hoc database question.
---

Analyze the exact evaluation run named by the user. Resolve a shorthand to one
unambiguous run ID before querying.

## Steps

1. **Get run overview** — success, attempts, judge and rubric lanes, cell
   profiles, and provenance:
   ```bash
   sqlite3 -readonly -header -column data/evaluations.db "SELECT profile_name, judge_model, tutor_rubric_version, learner_rubric_version, dialogue_rubric_version, success, COUNT(*) n, COUNT(DISTINCT attempt_index) attempts, COUNT(DISTINCT config_hash) config_hashes FROM evaluation_results WHERE run_id = '<exact-run-id>' GROUP BY profile_name, judge_model, tutor_rubric_version, learner_rubric_version, dialogue_rubric_version, success ORDER BY profile_name, judge_model"
   ```
   Select one judge and rubric-version lane before summarizing scores. If the
   user asks for cross-judge reliability, route to the content-matched
   reliability analysis instead of pooling judges.

2. **Check for multi-turn data** — if `tutor_last_turn_score` is populated, report both Turn 0 and last-turn scores:
   ```bash
   sqlite3 -readonly -header -column data/evaluations.db "SELECT profile_name, COUNT(tutor_last_turn_score) has_last_turn, COUNT(learner_overall_score) has_learner, COUNT(dialogue_quality_score) has_dq, ROUND(AVG(tutor_first_turn_score),2) t0_mean, ROUND(AVG(tutor_last_turn_score),2) last_mean, ROUND(AVG(tutor_development_score),2) dev_mean FROM evaluation_results WHERE run_id = '<exact-run-id>' AND success = 1 AND judge_model = '<judge>' AND tutor_rubric_version = '<tutor-version>' GROUP BY profile_name"
   ```

3. **Show summary**: N planned/successful/scored, selected judge/rubric lane,
   cell means and spread, missingness, and config-hash consistency.

4. Compute a contrast only when the run's registered design or live factor
   columns identify the comparison. Do not infer base/recognition treatment
   from profile-name substrings. Use the design's own threshold or sensitivity
   rule; do not impose a universal power, floor, or ceiling cutoff.

5. **Check learner scores** if present:
   ```bash
   sqlite3 -readonly -header -column data/evaluations.db "SELECT profile_name, judge_model, learner_rubric_version, dialogue_rubric_version, ROUND(AVG(learner_overall_score),2) learner_mean, ROUND(AVG(dialogue_quality_score),2) dq_mean FROM evaluation_results WHERE run_id = '<exact-run-id>' AND success = 1 AND judge_model = '<judge>' AND learner_rubric_version = '<learner-version>' AND dialogue_rubric_version = '<dialogue-version>' GROUP BY profile_name, judge_model, learner_rubric_version, dialogue_rubric_version"
   ```

6. **Flag issues**:
   - Mixed judge or rubric versions
   - Multiple config hashes for the same profile/scenario lane
   - NULL scores (incomplete judging):
     ```bash
     sqlite3 -readonly data/evaluations.db "SELECT COUNT(*) incomplete FROM evaluation_results WHERE run_id = '<exact-run-id>' AND (success <> 1 OR tutor_first_turn_score IS NULL)"
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
- Resolve partial run IDs in a separate lookup, then use the exact ID
- Legacy cell names (e.g. `cell_1`) may coexist with canonical names (`cell_1_base_single_unified`)
