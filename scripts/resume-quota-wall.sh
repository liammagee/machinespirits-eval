#!/usr/bin/env bash
# resume-quota-wall.sh — replay the resume + analysis tail of
# launch-p21-fanout.sh after one or more cells hit a quota wall mid-run.
#
# Pass the LOG_DIR the launch script printed at startup. The helper will:
#   1. Read run-manifest.txt if present (clean exit case), else grep run_ids
#      out of the per-process *.log files (script-died-mid-run case).
#   2. For each run_id that has empty (suggestions='[]', overall_score IS NULL)
#      rows in data/evaluations.db, delete them and call
#      `eval-cli.js resume <runId> --skip-rubric` to re-run the missing
#      scenarios.
#   3. Refresh the per-cell + combined strategy-shift JSON exports.
#
# Usage:
#   bash scripts/resume-quota-wall.sh /tmp/p21-fanout-XXXXX
#   bash scripts/resume-quota-wall.sh /tmp/p21-fanout-XXXXX --dry-run
#   bash scripts/resume-quota-wall.sh /tmp/p21-fanout-XXXXX --skip-analysis
#
# --dry-run: print what would happen without touching the DB or calling resume.
# --skip-analysis: skip the analyze-strategy-shift refresh at the tail.

set -euo pipefail
cd "$(dirname "$0")/.."

LOG_DIR=""
SKIP_ANALYSIS=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --skip-analysis) SKIP_ANALYSIS=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) LOG_DIR="$arg" ;;
  esac
done

if [[ -z "$LOG_DIR" ]]; then
  echo "ERROR: log dir path required (the LOG_DIR the launch script printed)." >&2
  echo "Usage: bash scripts/resume-quota-wall.sh /tmp/p21-fanout-XXXXX" >&2
  exit 2
fi
if [[ ! -d "$LOG_DIR" ]]; then
  echo "ERROR: log dir not found: $LOG_DIR" >&2
  exit 2
fi

DB="$(pwd)/data/evaluations.db"
MANIFEST="$LOG_DIR/run-manifest.txt"

echo "PLAN: resume quota-wall fan-out from $LOG_DIR"
echo "DB:   $DB"
[[ "$DRY_RUN" -eq 1 ]] && echo "MODE: DRY RUN (no DB writes, no resume calls, no exports)"
echo ""

# ----------------- build cell -> run_ids map ------------------------------

declare -A CELL_RUNIDS
ALL_CELLS=()

if [[ -f "$MANIFEST" ]]; then
  echo "=== reading run-manifest.txt ==="
  while IFS='=' read -r cell ids; do
    [[ -z "$cell" || "$cell" =~ ^# ]] && continue
    CELL_RUNIDS[$cell]="$ids"
    ALL_CELLS+=("$cell")
    echo "  $cell -> $ids"
  done < "$MANIFEST"
else
  echo "=== no manifest; greping run_ids from per-process logs ==="
  # Discover cell names from log filenames matching cell_*_NN.log
  for logfile in "$LOG_DIR"/cell_*.log; do
    [[ -f "$logfile" ]] || continue
    base=$(basename "$logfile" .log)
    cell=$(echo "$base" | sed -E 's/_[0-9]+$//')
    [[ -z "$cell" ]] && continue
    if [[ -z "${CELL_RUNIDS[$cell]:-}" ]]; then
      ALL_CELLS+=("$cell")
      CELL_RUNIDS[$cell]=""
    fi
    runid=$(grep -h "^\[adaptive\] ${cell}: runId=" "$logfile" 2>/dev/null \
            | sed -E 's/.*runId=([^ ]+).*/\1/' | head -1)
    if [[ -n "$runid" ]]; then
      if [[ -z "${CELL_RUNIDS[$cell]}" ]]; then
        CELL_RUNIDS[$cell]="$runid"
      else
        CELL_RUNIDS[$cell]="${CELL_RUNIDS[$cell]},$runid"
      fi
    fi
  done
  for cell in "${ALL_CELLS[@]}"; do
    echo "  $cell -> ${CELL_RUNIDS[$cell]:-(none)}"
  done
fi

if [[ "${#ALL_CELLS[@]}" -eq 0 ]]; then
  echo "ERROR: no cells / run_ids discovered in $LOG_DIR" >&2
  exit 1
fi

# ----------------- resume each run_id that has empty rows -----------------

echo ""
echo "=== resume incomplete runs ==="
for cell in "${ALL_CELLS[@]}"; do
  IFS=',' read -ra runids <<< "${CELL_RUNIDS[$cell]}"
  for runid in "${runids[@]}"; do
    [[ -z "$runid" ]] && continue
    # Defensive validation — run_ids out of the manifest/logs should be
    # alphanumerics + - + _ only. Skip anything that isn't, so the SQL below
    # can't be coerced into something unintended.
    if ! [[ "$runid" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "  WARN: skipping malformed runid for $cell: '$runid'"
      continue
    fi
    empty=$(sqlite3 "$DB" "SELECT COUNT(*) FROM evaluation_results WHERE run_id = '$runid' AND overall_score IS NULL AND suggestions = '[]';")
    if [[ "$empty" -eq 0 ]]; then
      echo "  $cell $runid: complete (no empty rows) — skip"
      continue
    fi
    echo "  $cell $runid: $empty empty rows — clean + resume"
    if [[ "$DRY_RUN" -eq 0 ]]; then
      sqlite3 "$DB" "DELETE FROM evaluation_results WHERE run_id = '$runid' AND overall_score IS NULL AND suggestions = '[]';"
      ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js resume "$runid" --skip-rubric
    fi
  done
done

# ----------------- refresh strategy-shift exports -------------------------

if [[ "$SKIP_ANALYSIS" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
  echo ""
  echo "=== analyze-strategy-shift per cell ==="
  mkdir -p exports
  for cell in "${ALL_CELLS[@]}"; do
    ids=${CELL_RUNIDS[$cell]}
    if [[ -z "$ids" ]]; then
      echo "  SKIP $cell — no run_ids"
      continue
    fi
    short=$(echo "$cell" | sed -E 's/cell_([0-9]+).*/cell\1/')
    out="exports/p21-N24-${short}-v2.json"
    echo "  $cell -> $out"
    node scripts/analyze-strategy-shift.js \
      --run-id "$ids" --profile "$cell" --out "$out"
  done

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
fi

echo ""
echo "=== resume complete $(date +%H:%M:%S) ==="
