#!/usr/bin/env bash
# analyze-correction-source.sh
#
# P2 / research-plan 2026-06-20: does an EXTERNAL critic (the superego, in
# multi-agent cells) lift tutor output more than ego self-revision (single-agent
# cells)? This is the "Self-Correction Illusion" (arXiv 2606.05976) effect read
# off our own data — relabeling correction from self to an external role helps.
#
# Holds recognition constant (the clean contrast is single vs multi WITHIN a
# recognition level). PRELIMINARY: marginal means, collapses learner architecture
# / conversation_mode / per-cell prompt differences — directional, not the
# pre-registered factorial. Read-only; no paid runs.
#
# Usage: scripts/analyze-correction-source.sh [judge_model]
#   EVAL_DB_PATH overrides the DB (default: data/evaluations.db)

set -euo pipefail
DB="${EVAL_DB_PATH:-data/evaluations.db}"
[ -e "$DB" ] || { echo "DB not found: $DB (set EVAL_DB_PATH)"; exit 1; }

# Default to the judge with the most rubric-2.2 rows so we never mix judges.
JUDGE="${1:-$(sqlite3 "$DB" "SELECT judge_model FROM evaluation_results
  WHERE tutor_rubric_version='2.2' AND tutor_first_turn_score IS NOT NULL
  GROUP BY judge_model ORDER BY COUNT(*) DESC LIMIT 1;")}"

echo "External-critic (multi-agent superego) vs self-revision (single-agent)"
echo "rubric v2.2 · judge = $JUDGE · DB = $DB"
echo

sqlite3 -header -column "$DB" "
SELECT
  CASE factor_recognition WHEN 1 THEN 'recognition' WHEN 0 THEN 'base' ELSE '(unset)' END AS prompt,
  CASE factor_multi_agent_tutor WHEN 1 THEN 'multi (external superego)'
       WHEN 0 THEN 'single (self-revision)' ELSE '(unset)' END AS architecture,
  COUNT(*) AS n,
  ROUND(AVG(tutor_first_turn_score), 2) AS mean_score
FROM evaluation_results
WHERE tutor_rubric_version = '2.2'
  AND tutor_first_turn_score IS NOT NULL
  AND judge_model = '$JUDGE'
  AND factor_recognition IN (0, 1)
  AND factor_multi_agent_tutor IN (0, 1)
GROUP BY 1, 2
ORDER BY 1, 2;"

echo
echo "Interpretation: the external-critic lift (multi - single) within each prompt"
echo "condition is the 'externalized correction' effect. Expect it large on bare"
echo "prompts and small under recognition (recognition substitutes for the critic)."
