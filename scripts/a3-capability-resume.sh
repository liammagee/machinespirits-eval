#!/usr/bin/env bash
# A3 Option B: Resume the 4 runs that hit OpenRouter 402 credit exhaustion.
# - Qwen: partial (~33 attempts missing)
# - DeepSeek: fresh (all 63)
# - Kimi K2.5: fresh (all 63)
# - Haiku: fresh (all 63)
# Credits topped up 2026-04-20. Zombies already deleted.

set -u

LOG_DIR="/tmp/a3-capability"
mkdir -p "$LOG_DIR"

resume_one() {
  local label="$1"
  local run_id="$2"
  local logfile="$LOG_DIR/${label}-resume.log"
  echo "[$(date +%H:%M:%S)] Resuming $label ($run_id)" | tee -a "$LOG_DIR/master.log"
  node scripts/eval-cli.js resume "$run_id" \
    --parallelism 5 \
    --skip-rubric \
    > "$logfile" 2>&1
  local rc=$?
  echo "[$(date +%H:%M:%S)] Finished $label-resume (rc=$rc)" | tee -a "$LOG_DIR/master.log"
}

resume_one "qwen35"  "eval-2026-04-20-0bbdb49a"
resume_one "deepseek" "eval-2026-04-20-ad22a157"
resume_one "kimi-k25" "eval-2026-04-20-3a2ea3cc"
resume_one "haiku"   "eval-2026-04-20-f30da006"

echo "[$(date +%H:%M:%S)] All A3 resumes complete." | tee -a "$LOG_DIR/master.log"
