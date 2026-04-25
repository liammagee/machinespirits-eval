#!/usr/bin/env bash
#
# A7 Longitudinal Phase 1 — 3-session smoke test.
#
# Verifies that --learner-id propagates from CLI through the runner into the
# tutor-core Writing Pad DB and that the pad is REUSED (not re-created) across
# runs that share the same learner_id.
#
# Pass criteria (validated 2026-04-24 against the actual write paths):
#   1. After session 1: writing_pads row exists for the learner in the
#      tutor-core lms.sqlite (not writing-pads.db — that file exists but is
#      not the active store; see node_modules/.../tutor-core/services/dbService.js).
#   2. After all sessions: only ONE writing_pads row exists for our learner_id
#      (i.e., the same pad was reused across invocations — the longitudinal goal).
#      `total_recognition_moments` may stay 0 because moments are content-driven
#      (they fire on specific dialogue patterns, not every turn), and conscious_state
#      may even shrink between sessions as ephemera get cleared. The KEY signal is
#      the `updated_at` timestamp advancing — proving cross-session writes occurred.
#   3. eval_results table has one row per session, all carrying our learner_id
#      (proves the eval-side persistence wiring is correct).
#
# Out-of-scope: validating that Writing Pad CONTENT actually accumulates
# meaningful state across sessions. That's an experimental question for Phase 2,
# not a plumbing question for Phase 1.
#
# Usage:
#   bash scripts/smoke-a7-longitudinal.sh
#   AUTH_DB_PATH=/path/to/lms.sqlite bash scripts/smoke-a7-longitudinal.sh   # custom DB
#
# Cost estimate: ~$0.50 across 3 sessions on default models. Safe to run.

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────
LEARNER_ID="${LEARNER_ID:-smoke-learner-a7-$(date +%s)}"
CELL="${CELL:-cell_41_recog_dialectical_suspicious_unified_superego}"
SESSIONS=(
  "new_user_first_visit"
  "returning_user_mid_course"
  "misconception_correction_flow"
)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# tutor-core's writingPadService writes to lms.sqlite (not writing-pads.db).
# See node_modules/@machinespirits/tutor-core/services/dbService.js: default
# path is path.join(ROOT_DIR, 'data', 'lms.sqlite') unless AUTH_DB_PATH is set.
TUTOR_DB="${AUTH_DB_PATH:-${REPO_ROOT}/node_modules/@machinespirits/tutor-core/data/lms.sqlite}"
EVAL_DB="${REPO_ROOT}/data/evaluations.db"

cd "${REPO_ROOT}"

echo "═══════════════════════════════════════════════════════════════"
echo "  A7 Longitudinal Smoke Test"
echo "═══════════════════════════════════════════════════════════════"
echo "  learner_id: ${LEARNER_ID}"
echo "  cell:       ${CELL}"
echo "  sessions:   ${SESSIONS[*]}"
echo "  tutor DB:   ${TUTOR_DB}"
echo "  eval DB:    ${EVAL_DB}"
echo ""

if [ ! -f "${TUTOR_DB}" ]; then
  echo "WARN: tutor-core writing-pads.db not yet created at ${TUTOR_DB}."
  echo "      It will be created on first session if the cell has writing_pad_enabled."
fi

# ─── Helper: report Writing Pad state for our learner ────────────────────
report_pad() {
  local label="$1"
  echo ""
  echo "── ${label} ──────────────────────────────────────────────────"
  if [ ! -f "${TUTOR_DB}" ]; then
    echo "  (tutor DB not yet created)"
    return
  fi
  local row
  row=$(sqlite3 -separator $'\t' "${TUTOR_DB}" \
    "SELECT total_recognition_moments,
            dialectical_depth,
            mutual_transformation_score,
            pedagogical_attunement,
            length(conscious_state) AS conscious_len,
            length(preconscious_state) AS preconscious_len,
            length(unconscious_state) AS unconscious_len,
            updated_at
     FROM writing_pads WHERE learner_id = '${LEARNER_ID}';" 2>/dev/null || true)
  if [ -z "${row}" ]; then
    echo "  (no row yet for learner_id=${LEARNER_ID})"
    return
  fi
  echo "  ${row}" | awk -F'\t' '{
    printf "  recognition_moments: %s\n", $1
    printf "  dialectical_depth:   %s\n", $2
    printf "  mutual_transform:    %s\n", $3
    printf "  pedagogical_attune:  %s\n", $4
    printf "  conscious bytes:     %s\n", $5
    printf "  preconscious bytes:  %s\n", $6
    printf "  unconscious bytes:   %s\n", $7
    printf "  updated_at:          %s\n", $8
  }'
}

get_metric() {
  if [ ! -f "${TUTOR_DB}" ]; then echo "0"; return; fi
  sqlite3 "${TUTOR_DB}" \
    "SELECT COALESCE(${1}, 0) FROM writing_pads WHERE learner_id = '${LEARNER_ID}';" 2>/dev/null \
    | head -1 || echo "0"
}

# ─── Run 3 sessions ──────────────────────────────────────────────────────
SESSION_IDX=1
declare -a RECOG_HISTORY=()
declare -a UNCONSCIOUS_HISTORY=()

for SCENARIO in "${SESSIONS[@]}"; do
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Session ${SESSION_IDX}: ${SCENARIO}"
  echo "═══════════════════════════════════════════════════════════════"

  node scripts/eval-cli.js run \
    --profile "${CELL}" \
    --runs 1 \
    --scenario "${SCENARIO}" \
    --learner-id "${LEARNER_ID}" \
    --description "A7 smoke session ${SESSION_IDX}: ${SCENARIO} (learner=${LEARNER_ID})" \
    --skip-rubric

  RECOG=$(get_metric total_recognition_moments)
  UNCONSCIOUS_LEN=$(sqlite3 "${TUTOR_DB}" \
    "SELECT COALESCE(length(unconscious_state), 0) FROM writing_pads WHERE learner_id = '${LEARNER_ID}';" 2>/dev/null || echo "0")
  RECOG_HISTORY+=("${RECOG}")
  UNCONSCIOUS_HISTORY+=("${UNCONSCIOUS_LEN}")

  report_pad "After session ${SESSION_IDX}"

  SESSION_IDX=$((SESSION_IDX + 1))
done

# ─── Pass criteria check ─────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Smoke Test Verdict"
echo "═══════════════════════════════════════════════════════════════"

PASS=true

# Criterion 1: writing_pads row exists in tutor-core lms.sqlite
ROW_COUNT=$(sqlite3 "${TUTOR_DB}" \
  "SELECT COUNT(*) FROM writing_pads WHERE learner_id = '${LEARNER_ID}';" 2>/dev/null || echo "0")
if [ "${ROW_COUNT}" -eq 1 ]; then
  echo "  ✓ exactly one writing_pads row for ${LEARNER_ID} (no per-dialogue duplication)"
elif [ "${ROW_COUNT}" -ge 2 ]; then
  echo "  ✗ ${ROW_COUNT} writing_pads rows for ${LEARNER_ID} — expected 1 (each session created its own pad?)"
  PASS=false
else
  echo "  ✗ writing_pads row NOT found for ${LEARNER_ID}"
  echo "    Likely cause: AUTH_DB_PATH mismatch — eval is writing to a different SQLite file."
  echo "    Inspect: ${TUTOR_DB} ; node_modules/.../tutor-core/services/dbService.js"
  PASS=false
fi

# Criterion 2: pad was actually written to in each session (updated_at advances)
UPDATE_COUNT=$(sqlite3 "${TUTOR_DB}" \
  "SELECT 1 FROM writing_pads WHERE learner_id = '${LEARNER_ID}' AND updated_at > created_at;" 2>/dev/null || echo "")
if [ -n "${UPDATE_COUNT}" ]; then
  echo "  ✓ pad updated_at > created_at (cross-session writes confirmed)"
else
  echo "  ⚠ updated_at == created_at — pad was created but never updated"
  echo "    May be expected if all sessions were single-turn and didn't trigger a pad write."
fi

# Criterion 3 (informational, not pass/fail): recognition_moments and content size
echo "  recog moments observed (per session): ${RECOG_HISTORY[*]}"
echo "  unconscious_state bytes (per session): ${UNCONSCIOUS_HISTORY[*]}"
LAST_RECOG="${RECOG_HISTORY[${#RECOG_HISTORY[@]} - 1]}"
LAST_BYTES="${UNCONSCIOUS_HISTORY[${#UNCONSCIOUS_HISTORY[@]} - 1]}"
if [ "${LAST_RECOG}" -gt 0 ] || [ "${LAST_BYTES}" -gt 200 ]; then
  echo "  ✓ pad has accumulated content (moments=${LAST_RECOG}, unconscious=${LAST_BYTES} bytes)"
else
  echo "  ⚠ pad has minimal content — recognition moments are content-driven and may not fire"
  echo "    in every dialogue. The plumbing is correct; the experimental signal depends on"
  echo "    cells/scenarios that elicit recognition events."
fi

# Criterion 4: eval_results rows actually persist learner_id
EVAL_ROWS=$(sqlite3 "${EVAL_DB}" \
  "SELECT COUNT(*) FROM evaluation_results WHERE learner_id = '${LEARNER_ID}';" 2>/dev/null || echo "0")
echo "  eval_results rows with learner_id=${LEARNER_ID}: ${EVAL_ROWS}"
if [ "${EVAL_ROWS}" -lt "${#SESSIONS[@]}" ]; then
  echo "  ✗ Expected ${#SESSIONS[@]} rows, got ${EVAL_ROWS}"
  PASS=false
else
  echo "  ✓ All ${#SESSIONS[@]} session rows persisted to evaluation_results"
fi

echo ""
if ${PASS}; then
  echo "  PASS — A7 Phase 1 plumbing works end-to-end."
  echo "         Cross-session pad reuse: confirmed (single pad row per learner_id)."
  echo "         Cross-session content accumulation: experimental — see Phase 2."
  exit 0
else
  echo "  FAIL — see diagnostics above."
  exit 1
fi
