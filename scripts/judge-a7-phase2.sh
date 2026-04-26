#!/usr/bin/env bash
#
# A7 Phase 2 — judge the 80 dialogues for H2 (per-session score
# trajectory). Each session was its own eval-cli run, so we have
# 80 distinct run_ids to score. Runs evaluate in parallel batches.
#
# Cost estimate: ~$1-2 (Sonnet 4.6 default judge × 80 dialogues).
# Wall-clock: ~30-45 min depending on judge parallelism.

set -euo pipefail
TIMESTAMP=1777173286
PARALLEL_JOBS="${PARALLEL_JOBS:-4}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

echo "═══════════════════════════════════════════════════════════════"
echo "  A7 Phase 2 — Judging (H2 score trajectory)"
echo "═══════════════════════════════════════════════════════════════"

# Portable alternative to `mapfile` (not in macOS's bash 3.2). Reads
# run_ids one-per-line into the RUN_IDS array.
RUN_IDS=()
while IFS= read -r line; do
  RUN_IDS+=("$line")
done < <(
  sqlite3 data/evaluations.db \
    "SELECT DISTINCT run_id FROM evaluation_results WHERE learner_id LIKE '%-${TIMESTAMP}' ORDER BY created_at;"
)

echo "  run_ids to judge: ${#RUN_IDS[@]}"
echo "  parallel jobs:    ${PARALLEL_JOBS}"
echo ""

mkdir -p logs/a7-judge

# Batch parallel: launch up to PARALLEL_JOBS at a time, wait for any to
# complete, then launch the next. Simple producer-consumer with bash.
ACTIVE_PIDS=()
COMPLETED=0
FAILED=0

launch_judge() {
  local run_id="$1"
  local logfile="logs/a7-judge/${run_id}.log"
  ( node scripts/eval-cli.js evaluate "${run_id}" --tutor-only --skip-deliberation > "${logfile}" 2>&1 \
      && echo "[$(date +%H:%M:%S)] DONE ${run_id}" \
      || echo "[$(date +%H:%M:%S)] FAIL ${run_id}" ) &
  ACTIVE_PIDS+=($!)
}

for run_id in "${RUN_IDS[@]}"; do
  while [ "${#ACTIVE_PIDS[@]}" -ge "${PARALLEL_JOBS}" ]; do
    NEW_PIDS=()
    for p in "${ACTIVE_PIDS[@]}"; do
      if kill -0 "$p" 2>/dev/null; then
        NEW_PIDS+=("$p")
      else
        wait "$p" 2>/dev/null
        if [ $? -eq 0 ]; then
          COMPLETED=$(( COMPLETED + 1 ))
        else
          FAILED=$(( FAILED + 1 ))
        fi
      fi
    done
    ACTIVE_PIDS=("${NEW_PIDS[@]}")
    [ "${#ACTIVE_PIDS[@]}" -ge "${PARALLEL_JOBS}" ] && sleep 2
  done
  launch_judge "${run_id}"
done

# Drain remaining
for p in "${ACTIVE_PIDS[@]}"; do
  wait "$p" 2>/dev/null && COMPLETED=$(( COMPLETED + 1 )) || FAILED=$(( FAILED + 1 ))
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Judging complete: ${COMPLETED}/${#RUN_IDS[@]} succeeded, ${FAILED} failed"
echo "═══════════════════════════════════════════════════════════════"
exit "${FAILED}"
