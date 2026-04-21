#!/usr/bin/env bash
# A3 Option B: Capability threshold for cognitive prosthesis (cell_66 descriptive).
# Runs cell_66 across 4 intermediate ego models (+ Haiku top-up, + Qwen cell_5 baseline).
# All runs use kimi-k2.5 as superego (cell default). Nemotron cell_66 data (n=30) already in DB.

set -u  # Undefined-var guard. No -e: one failed model shouldn't abort the rest.

LOG_DIR="/tmp/a3-capability"
mkdir -p "$LOG_DIR"

CELL66="cell_66_recog_dialectical_profile_prosthesis_descriptive"
CELL5="cell_5_recog_single_unified"

run_one() {
  local label="$1"
  local profiles="$2"
  local ego="$3"
  local logfile="$LOG_DIR/${label}.log"
  echo "[$(date +%H:%M:%S)] Starting $label (ego=$ego, profiles=$profiles)" | tee -a "$LOG_DIR/master.log"
  node scripts/eval-cli.js run \
    --profiles "$profiles" \
    --ego-model "$ego" \
    --runs 3 \
    --parallelism 5 \
    --skip-rubric \
    > "$logfile" 2>&1
  local rc=$?
  echo "[$(date +%H:%M:%S)] Finished $label (rc=$rc)" | tee -a "$LOG_DIR/master.log"
  # Extract run ID from log for later judging
  grep -oE 'eval-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-f0-9]+' "$logfile" | head -1 >> "$LOG_DIR/run-ids.txt"
}

# 1. GLM-4.7 × cell_66
run_one "glm47" "$CELL66" "openrouter.glm47"

# 2. Qwen 3.5 × {cell_5, cell_66} — needs cell_5 baseline too
run_one "qwen35" "$CELL5,$CELL66" "openrouter.qwen3.5"

# 3. DeepSeek V3.2 × cell_66
run_one "deepseek" "$CELL66" "openrouter.deepseek"

# 4. Kimi K2.5 × cell_66
run_one "kimi-k25" "$CELL66" "openrouter.kimi-k2.5"

# 5. Haiku × cell_66 (top-up from n=2)
run_one "haiku" "$CELL66" "openrouter.haiku"

echo "[$(date +%H:%M:%S)] All A3 runs complete. Run IDs:" | tee -a "$LOG_DIR/master.log"
cat "$LOG_DIR/run-ids.txt" | tee -a "$LOG_DIR/master.log"
