#!/usr/bin/env bash
#
# A7 Longitudinal — Phase 2: 80-dialogue study.
#
# Tests whether the Writing Pad accumulates pedagogically meaningful state
# across 8 sequential sessions per simulated learner, and whether
# recognition (cell 41) accelerates the accumulation relative to base
# (cell 40). Phase 1 plumbing (--learner-id flag, smoke test) verified
# via scripts/smoke-a7-longitudinal.sh; Phase 2 is the experimental run.
#
# Design (TODO.md §A7 Phase 2):
#   - 2 cells × 5 simulated learners × 8 ordered scenarios = 80 dialogues
#   - Each learner's 8 sessions share a single --learner-id (cross-session pad)
#   - Sessions ordered by intended difficulty (intro → impasse → culmination)
#   - Sequential per learner (mid-session writing pad mutations are not
#     amenable to within-learner parallelism); parallel across learners
#     by running them in subshells.
#
# Expected wall-clock: ~10-15 hours at 5 learners running concurrently
# (each learner does 8 sessions sequentially × ~15-25 min/session).
# Cost estimate: $30-60 OpenRouter for the full N=80.
#
# Usage:
#   # Sanity-check first via the Phase 1 smoke (one learner, 3 sessions):
#   bash scripts/smoke-a7-longitudinal.sh
#
#   # Then run the full Phase 2 study:
#   bash scripts/run-a7-phase2-longitudinal.sh
#
#   # Or test on a single learner first:
#   LEARNERS_PER_CELL=1 bash scripts/run-a7-phase2-longitudinal.sh
#
# Resume: each `eval-cli.js run` invocation is its own short run; if any
# session fails partway, the existing checkpoint system handles in-dialogue
# resume, and you can re-invoke this script (sessions already in the DB
# under the same learner_id won't be re-generated; new sessions will pick
# up cleanly).

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────
LEARNERS_PER_CELL="${LEARNERS_PER_CELL:-5}"
CELLS=(
  "cell_40_base_dialectical_suspicious_unified_superego"
  "cell_41_recog_dialectical_suspicious_unified_superego"
)
# Session order — intentional difficulty curve. Earliest sessions establish
# baseline rapport / surface struggles; later sessions test whether
# accumulated pad state (recognition moments, archetype evolution, prior
# breakthroughs) reduces the cost of impasse handling.
SESSIONS=(
  "new_user_first_visit"
  "returning_user_mid_course"
  "concept_confusion"
  "misconception_correction_flow"
  "epistemic_resistance_impasse"
  "mood_frustration_to_breakthrough"
  "mutual_transformation_journey"
  "productive_deadlock_impasse"
)
TIMESTAMP="${TIMESTAMP:-$(date +%s)}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

# ─── Sanity ──────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════"
echo "  A7 Longitudinal Phase 2 — 80-dialogue study"
echo "═══════════════════════════════════════════════════════════════"
echo "  Cells:    ${CELLS[*]}"
echo "  Learners/cell: ${LEARNERS_PER_CELL}"
echo "  Sessions: ${#SESSIONS[@]}"
echo "  Total:    $(( ${#CELLS[@]} * LEARNERS_PER_CELL * ${#SESSIONS[@]} )) dialogues"
echo "  Timestamp tag: ${TIMESTAMP}"
echo ""

# ─── Worker: sequential 8-session arc for one learner ────────────────────
# Forks per (cell, learner_index). Each learner's 8 sessions run sequentially
# so the Writing Pad accumulates as sessions advance.
run_learner_arc() {
  local cell="$1"
  local label="$2"           # "base" | "recog"
  local learner_idx="$3"     # 01 | 02 | ...
  local learner_id="a7-phase2-${label}-${learner_idx}-${TIMESTAMP}"
  local arc_log="${REPO_ROOT}/logs/a7-phase2-${learner_id}.log"

  mkdir -p "$(dirname "${arc_log}")"
  echo "[$(date +%H:%M:%S)] START arc ${learner_id}" | tee -a "${arc_log}"

  local session_idx=1
  for scenario in "${SESSIONS[@]}"; do
    echo "[$(date +%H:%M:%S)]   session ${session_idx}/${#SESSIONS[@]} — ${scenario}" | tee -a "${arc_log}"
    if ! node scripts/eval-cli.js run \
      --profile "${cell}" \
      --runs 1 \
      --scenario "${scenario}" \
      --learner-id "${learner_id}" \
      --description "A7 Phase 2 [${label} ${learner_idx}] session ${session_idx}: ${scenario}" \
      --skip-rubric \
      >> "${arc_log}" 2>&1; then
      echo "[$(date +%H:%M:%S)]   session ${session_idx} FAILED — see ${arc_log}" | tee -a "${arc_log}"
      # Don't bail — continue to next session so partial arcs are still useful
    fi
    session_idx=$(( session_idx + 1 ))
  done

  echo "[$(date +%H:%M:%S)] DONE arc ${learner_id}" | tee -a "${arc_log}"
}

# ─── Launch all (cell × learner) arcs in parallel ─────────────────────────
# Each arc runs 8 sessions sequentially in its subshell. Arcs are independent
# (different learner_ids → different writing pads → no shared state).
PIDS=()
for cell in "${CELLS[@]}"; do
  if [[ "${cell}" == *recog* ]]; then label="recog"; else label="base"; fi
  for i in $(seq 1 "${LEARNERS_PER_CELL}"); do
    learner_idx=$(printf "%02d" "${i}")
    run_learner_arc "${cell}" "${label}" "${learner_idx}" &
    PIDS+=($!)
    sleep 2  # stagger arc launches so the eval-cli wrapper doesn't race on init
  done
done

echo ""
echo "Launched ${#PIDS[@]} arcs (PIDs: ${PIDS[*]})"
echo "Tail any arc with: tail -f logs/a7-phase2-a7-phase2-*-${TIMESTAMP}.log"
echo "Wait for completion below; ETA ~10-15 hours."
echo ""

FAILED_ARCS=0
for pid in "${PIDS[@]}"; do
  if ! wait "${pid}"; then
    FAILED_ARCS=$(( FAILED_ARCS + 1 ))
  fi
done

# ─── Final state ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  A7 Phase 2 — Run Complete"
echo "═══════════════════════════════════════════════════════════════"
echo "  Failed arcs: ${FAILED_ARCS}/${#PIDS[@]}"
echo ""
echo "Next steps:"
echo "  1. Verify session completeness:"
echo "     sqlite3 data/evaluations.db \"SELECT learner_id, COUNT(*) FROM evaluation_results WHERE learner_id LIKE 'a7-phase2-%-${TIMESTAMP}' GROUP BY learner_id\""
echo "  2. Run analysis:"
echo "     node scripts/analyze-a7-longitudinal.js --timestamp ${TIMESTAMP}"
echo "  3. (Optional) Judge for tutor scores:"
echo "     # Pick out the run_ids and run \`evaluate <runId>\` per arc, or"
echo "     # batch-judge all rows tagged with this timestamp suffix."
echo ""

exit "${FAILED_ARCS}"
