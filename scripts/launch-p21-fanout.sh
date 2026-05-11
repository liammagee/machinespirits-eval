#!/usr/bin/env bash
# launch-p21-fanout.sh — P2.1 N=24 fan-out across 4 v2 cells.
#
# Pre-registered analysis plan locked in p2-followup-pre-registration.md
# §P2.1 (cooling period: earliest run-start 2026-05-09 UTC).
#
# Layout:
#   wave 1 = 4× cell_111_v2 (recognition_only)        }  K=8 concurrent,
#          + 4× cell_116_v2 (recognition_named_pat..) }  ~22 min wallclock
#   wave 2 = 4× cell_115_v2 (bilateral_tom)           }  K=8 concurrent,
#          + 4× cell_117_v2 (bilateral_tom_named_pa.) }  ~22 min wallclock
#
# Each `node eval-cli.js run --runs 1` produces 6 rows (1 batch of 6
# v2 scenarios). 4 procs/cell × 6 rows = N=24 per cell. Writes land
# directly in data/evaluations.db (SQLite WAL mode handles concurrent
# writers).
#
# After both waves: harvests the per-cell run_ids from log files and
# runs analyze-strategy-shift.js per cell, writing
# exports/p21-N24-{cell111..cell117}-v2.json.
#
# Usage:
#   bash scripts/launch-p21-fanout.sh              # default 2-wave K=8 mixed (~45 min)
#   bash scripts/launch-p21-fanout.sh --sequential # one cell at a time, K=4 within-cell
#   bash scripts/launch-p21-fanout.sh --probe      # 1 proc/cell smoke (~22 min)
#   bash scripts/launch-p21-fanout.sh --skip-cooling-check     # bypass date guard
#   bash scripts/launch-p21-fanout.sh --skip-quota-pause       # skip the inter-cell pause prompt
#                                                                in --sequential mode
#
# --sequential mode runs cells one at a time at K=4 instead of K=8 mixed.
# Reason: the 2026-05-08 multi-cell probe showed bilateral_tom cells (115, 117)
# burn ~5× more LLM calls per turn than recognition_only cells (111, 116) —
# enough that K=4×2 mixed exhausted the Max-plan claude-code quota window
# partway through. Sequential mode keeps each cell's burn rate small enough
# to finish before quota pressure builds, and pauses for confirmation before
# starting a heavier bilateral_tom cell so you can wait for a quota reset.

set -euo pipefail
cd "$(dirname "$0")/.."

# ------------------------------ flags -------------------------------------

PROBE=0
SEQUENTIAL=0
SKIP_COOLING_CHECK=0
SKIP_QUOTA_PAUSE=0
for arg in "$@"; do
  case "$arg" in
    --probe) PROBE=1 ;;
    --sequential) SEQUENTIAL=1 ;;
    --skip-cooling-check) SKIP_COOLING_CHECK=1 ;;
    --skip-quota-pause) SKIP_QUOTA_PAUSE=1 ;;
    -h|--help)
      sed -n '2,40p' "$0"; exit 0 ;;
    *)
      echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# ------------------------- cooling-period guard ---------------------------

EARLIEST="2026-05-09"
TODAY=$(date -u +%Y-%m-%d)
if [[ "$SKIP_COOLING_CHECK" -eq 0 && "$TODAY" < "$EARLIEST" ]]; then
  echo "ERROR: pre-reg cooling period not yet expired." >&2
  echo "  today=$TODAY earliest=$EARLIEST" >&2
  echo "  pass --skip-cooling-check only if you intend to invalidate the pre-reg." >&2
  exit 1
fi

# --------------------------- run parameters -------------------------------

K_PER_CELL=4
[[ "$PROBE" -eq 1 ]] && K_PER_CELL=1

LOG_DIR=$(mktemp -d /tmp/p21-fanout-XXXXX)
if [[ "$SEQUENTIAL" -eq 1 ]]; then
  echo "PLAN: P2.1 N=24 fan-out (K=${K_PER_CELL} per cell, sequential one-cell-at-a-time)"
else
  echo "PLAN: P2.1 N=24 fan-out (K=${K_PER_CELL} per cell, 2 waves K=8 mixed)"
fi
echo "LOGS: $LOG_DIR"
echo "DB:   $(pwd)/data/evaluations.db"
echo ""

WAVE1_CELLS=(cell_111_a13_C1_recognition_only_v2 cell_116_recognition_named_patterns_v2)
WAVE2_CELLS=(cell_115_bilateral_tom_v2          cell_117_bilateral_tom_named_patterns_v2)
ALL_CELLS=("${WAVE1_CELLS[@]}" "${WAVE2_CELLS[@]}")

# ------------------------------ run a wave --------------------------------

run_wave() {
  local wave_label="$1"
  shift
  local cells=("$@")
  echo "=== wave $wave_label START $(date +%H:%M:%S) — cells: ${cells[*]} ==="
  for cell in "${cells[@]}"; do
    for ((i=1; i<=K_PER_CELL; i++)); do
      ADAPTIVE_TUTOR_LLM=real \
        node scripts/eval-cli.js run --profiles "$cell" --runs 1 \
        > "$LOG_DIR/${cell}_${i}.log" 2>&1 &
    done
  done
  wait
  echo "=== wave $wave_label DONE  $(date +%H:%M:%S) ==="
}

if [[ "$SEQUENTIAL" -eq 1 ]]; then
  # Sequential order: cheap recognition_only cells first, expensive bilateral_tom
  # cells last. If quota runs out partway, the cheaper data is already in the DB.
  SEQ_ORDER=(
    cell_111_a13_C1_recognition_only_v2
    cell_116_recognition_named_patterns_v2
    cell_115_bilateral_tom_v2
    cell_117_bilateral_tom_named_patterns_v2
  )
  for idx in "${!SEQ_ORDER[@]}"; do
    cell="${SEQ_ORDER[$idx]}"
    if [[ "$idx" -gt 0 && "$SKIP_QUOTA_PAUSE" -eq 0 ]]; then
      echo ""
      if [[ "$cell" == *"bilateral_tom"* ]]; then
        echo "  NEXT CELL: $cell — bilateral_tom (~5× LLM burn vs recognition_only)."
        echo "  If on Max-plan claude-code, consider waiting for the 11:30 America/Chicago"
        echo "  quota reset before continuing. Re-run with --skip-quota-pause to bypass."
      else
        echo "  NEXT CELL: $cell"
      fi
      read -r -p "  Press Enter to start (or Ctrl-C to abort): " _unused
    fi
    run_wave "$((idx+1))" "$cell"
  done
else
  run_wave 1 "${WAVE1_CELLS[@]}"
  run_wave 2 "${WAVE2_CELLS[@]}"
fi

# ----------------------- harvest per-cell run_ids -------------------------

echo ""
echo "=== captured run_ids ==="
declare -A CELL_RUNIDS
for cell in "${ALL_CELLS[@]}"; do
  ids=$(grep -h "^\[adaptive\] ${cell}: runId=" "$LOG_DIR"/${cell}_*.log \
        | sed -E 's/.*runId=([^ ]+).*/\1/' \
        | tr '\n' ',' | sed 's/,$//')
  CELL_RUNIDS[$cell]=$ids
  echo "  $cell -> $ids"
done

# Persist a manifest so the user can re-run analyses later without re-grepping
MANIFEST="$LOG_DIR/run-manifest.txt"
{
  echo "# P2.1 N=24 fan-out manifest — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for cell in "${ALL_CELLS[@]}"; do
    echo "${cell}=${CELL_RUNIDS[$cell]}"
  done
} > "$MANIFEST"
echo "  manifest -> $MANIFEST"

# ---------------------- refresh strategy-shift exports --------------------

echo ""
echo "=== analyze-strategy-shift per cell ==="
mkdir -p exports
for cell in "${ALL_CELLS[@]}"; do
  ids=${CELL_RUNIDS[$cell]}
  if [[ -z "$ids" ]]; then
    echo "  SKIP $cell — no run_ids captured (check $LOG_DIR/${cell}_*.log)"
    continue
  fi
  short=$(echo "$cell" | sed -E 's/cell_([0-9]+).*/cell\1/')
  out="exports/p21-N24-${short}-v2.json"
  echo "  $cell -> $out"
  node scripts/analyze-strategy-shift.js \
    --run-id "$ids" --profile "$cell" --out "$out"
done

# Combined granular export across all 4 cells (for the 4-arm comparison)
ALL_IDS=""
for cell in "${ALL_CELLS[@]}"; do
  [[ -n "${CELL_RUNIDS[$cell]}" ]] && ALL_IDS="${ALL_IDS},${CELL_RUNIDS[$cell]}"
done
ALL_IDS=${ALL_IDS#,}
if [[ -n "$ALL_IDS" ]]; then
  out="exports/p21-N24-granular-v2.json"
  echo "  (4-arm combined) -> $out"
  node scripts/analyze-strategy-shift.js --run-id "$ALL_IDS" --out "$out"
fi

echo ""
echo "=== fan-out complete $(date +%H:%M:%S) ==="
echo "exports: exports/p21-N24-cell{111,115,116,117}-v2.json + p21-N24-granular-v2.json"
echo "logs:    $LOG_DIR"
