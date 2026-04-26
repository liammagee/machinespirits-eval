#!/usr/bin/env bash
#
# AI Literacy Benchmark — base vs recognition × course 901 scenarios.
#
# Runs cell_1 (base) and cell_5 (recognition) on the AI literacy content
# package (course 901: "Reading Charisma in the Algorithmic Era") to
# replicate the recognition main effect on a sixth domain. Pattern matches
# A6 domain-generalisation runs (programming, math, creative writing, SEL,
# peer-support) — see TODO.md §A6 for the canonical commands.
#
# Design:
#   - 2 cells × 3 runs × 6 ai-literacy scenarios = 36 dialogues
#   - 4 single-turn (3 core + 1 mood) + 2 multi-turn (misconception correction,
#     productive deadlock — 3 turns each)
#   - Sonnet 4.6 judge (default), Haiku 4.5 ego (matched to A6 anchor cells
#     for cross-domain comparison)
#
# Usage:
#   bash scripts/run-ai-literacy-benchmark.sh
#   RUNS=1 bash scripts/run-ai-literacy-benchmark.sh   # cheaper smoke
#   bash scripts/run-ai-literacy-benchmark.sh --skip-rubric  # generation only
#
# Cost estimate: ~$10-15 OpenRouter for the full $N = 36$ at 3 runs each.
# Wall-clock: ~1-2 hours at the runner's default parallelism (2).
#
# After completion: re-run with `evaluate <runId>` to score, then compare
# the recognition delta to the A6 cross-domain anchors:
#   philosophy d=2.71, programming d=2.33, math d=1.45, creative d=1.96,
#   SEL d=1.82, peer-support d=1.57.
#
# AI literacy might land anywhere in that range — the domain is meta
# (reading the medium itself rather than learning a discipline) and a
# recognition-friendly d>1.5 would be unsurprising; a d<1.0 would be
# evidence that the recognition effect attenuates on critical-media-studies
# content.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

RUNS="${RUNS:-3}"
EXTRA_ARGS=()
for arg in "$@"; do
  EXTRA_ARGS+=("${arg}")
done

echo "═══════════════════════════════════════════════════════════════"
echo "  AI Literacy Benchmark — base vs recognition × course 901"
echo "═══════════════════════════════════════════════════════════════"
echo "  Cells:    cell_1_base_single_unified, cell_5_recog_single_unified"
echo "  Scenarios: 6 ai-literacy scenarios (4 single-turn + 2 multi-turn)"
echo "  Runs/cell: ${RUNS}"
echo "  Total:    $((2 * RUNS * 6)) dialogues"
echo "  Content: ./content-ai-literacy"
echo ""

EVAL_CONTENT_PATH=./content-ai-literacy \
EVAL_SCENARIOS_FILE=./content-ai-literacy/scenarios-ai-literacy.yaml \
node scripts/eval-cli.js run \
  --profile cell_1_base_single_unified,cell_5_recog_single_unified \
  --runs "${RUNS}" \
  --description "AI literacy benchmark: base vs recognition × course 901 (Reading Charisma in the Algorithmic Era)" \
  "${EXTRA_ARGS[@]}"

echo ""
echo "Next steps:"
echo "  1. Verify run completed:"
echo "     sqlite3 data/evaluations.db \"SELECT profile_name, COUNT(*) FROM evaluation_results WHERE run_id LIKE 'eval-%' AND scenario_id LIKE 'ai_literacy_%' GROUP BY profile_name\""
echo "  2. Judge (if not already): node scripts/eval-cli.js evaluate <runId>"
echo "  3. Compare recognition delta to A6 anchors. If d ≥ 1.5, AI literacy"
echo "     is a recognition-friendly domain (consistent with critical-theory"
echo "     content benefiting from autonomous-subject framing). If d < 1.0,"
echo "     attenuation worth noting in §6.6.6 / §A6 follow-up."
