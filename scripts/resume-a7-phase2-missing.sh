#!/usr/bin/env bash
#
# A7 Phase 2 — Resume the 12 sessions that failed mid-run on the
# 1777173286 timestamp tag (OpenRouter `402 Insufficient credits`
# during the heavy multi-turn impasse scenarios).
#
# 9 arcs are missing session 8 (productive_deadlock_impasse).
# 2 arcs (recog-01, recog-05) are also missing session 7
# (mutual_transformation_journey).
# 1 arc (base-02) is missing session 5 (epistemic_resistance_impasse).
#
# Note on ordering: re-running an earlier-numbered session AFTER its
# nominal slot writes pad state out of original sequence. For H1 (per-
# learner moment totals) this is irrelevant — we just count rows. For
# H2/H3 trajectory analyses the affected arcs (base-02 sess 5;
# recog-01 + recog-05 sess 7) should be flagged.
#
# Usage:
#   bash scripts/resume-a7-phase2-missing.sh
#
# Cost estimate: ~$0.70, wall-clock ~30 min (fork-per-arc parallel).

set -euo pipefail
TIMESTAMP=1777173286
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"
mkdir -p logs

run_session() {
  local cell="$1" label="$2" idx="$3" scenario="$4" session_num="$5"
  local learner_id="a7-phase2-${label}-${idx}-${TIMESTAMP}"
  local arc_log="logs/a7-phase2-resume-${learner_id}.log"
  echo "[$(date +%H:%M:%S)] resume ${learner_id} session ${session_num}: ${scenario}" | tee -a "${arc_log}"
  if ! node scripts/eval-cli.js run \
    --profile "${cell}" \
    --runs 1 \
    --scenario "${scenario}" \
    --learner-id "${learner_id}" \
    --description "A7 Phase 2 RESUME [${label} ${idx}] session ${session_num}: ${scenario}" \
    --skip-rubric \
    >> "${arc_log}" 2>&1; then
    echo "[$(date +%H:%M:%S)]   FAILED — see ${arc_log}" | tee -a "${arc_log}"
    return 1
  fi
  echo "[$(date +%H:%M:%S)]   done ${learner_id} session ${session_num}" | tee -a "${arc_log}"
}

# Single-session arcs — independent, run all in parallel.
SINGLE=(
  "cell_40_base_dialectical_suspicious_unified_superego base 01 productive_deadlock_impasse 8"
  "cell_40_base_dialectical_suspicious_unified_superego base 02 epistemic_resistance_impasse 5"
  "cell_40_base_dialectical_suspicious_unified_superego base 03 productive_deadlock_impasse 8"
  "cell_40_base_dialectical_suspicious_unified_superego base 04 productive_deadlock_impasse 8"
  "cell_40_base_dialectical_suspicious_unified_superego base 05 productive_deadlock_impasse 8"
  "cell_41_recog_dialectical_suspicious_unified_superego recog 02 productive_deadlock_impasse 8"
  "cell_41_recog_dialectical_suspicious_unified_superego recog 03 productive_deadlock_impasse 8"
  "cell_41_recog_dialectical_suspicious_unified_superego recog 04 productive_deadlock_impasse 8"
)

PIDS=()
for entry in "${SINGLE[@]}"; do
  ( run_session $entry ) &
  PIDS+=($!)
  sleep 2
done

# Two-session arcs — run sequentially within each arc, parallel across arcs.
two_session_arc() {
  local label="$1" idx="$2"
  local cell="cell_41_recog_dialectical_suspicious_unified_superego"
  run_session "${cell}" "${label}" "${idx}" mutual_transformation_journey 7 || true
  run_session "${cell}" "${label}" "${idx}" productive_deadlock_impasse 8 || true
}

( two_session_arc recog 01 ) &
PIDS+=($!)
( two_session_arc recog 05 ) &
PIDS+=($!)

echo ""
echo "Launched ${#PIDS[@]} resume tasks. Waiting..."
echo ""

FAILED=0
for pid in "${PIDS[@]}"; do
  if ! wait "${pid}"; then
    FAILED=$(( FAILED + 1 ))
  fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  A7 Phase 2 — Resume Complete"
echo "═══════════════════════════════════════════════════════════════"
echo "  Failed tasks: ${FAILED}/${#PIDS[@]}"
echo ""
echo "Re-run analysis:"
echo "  node scripts/analyze-a7-longitudinal.js --timestamp ${TIMESTAMP}"

exit "${FAILED}"
