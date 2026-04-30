#!/usr/bin/env bash
# Build the combined "machinagogy-v2" PDF: the philosophical head-matter
# paper followed by paper-full-2.0.md as a formatted appendix.
#
# Pipeline:
#   1. pandoc machinagogy-v2.md -> machinagogy-v2.pdf  (head matter only)
#   2. ./build-appendix.sh                              (paper 2.0 -> appendix PDF)
#   3. pdfunite head + appendix -> machinagogy-v2-combined.pdf
#
# Each PDF is built with its own bibliography (the two papers cite
# overlapping but non-identical literatures, so merged-bib builds risk
# key collisions). The appendix transform renumbers Supplement I-V to
# avoid heading collision with the head paper's References section.
#
# Usage:
#   ./build-machinagogy-combined.sh                 # uses default philosophy path
#   ./build-machinagogy-combined.sh <philo-dir>     # custom philosophy article dir
#
# Default philosophy dir: ../../../machinespirits-content-philosophy/articles/ai-tutor
# (resolved relative to this script).

set -euo pipefail
cd "$(dirname "$0")"

PHILO_DIR="${1:-../../../machinespirits-content-philosophy/articles/ai-tutor}"

if [ ! -d "$PHILO_DIR" ]; then
  echo "Error: philosophy article dir not found: $PHILO_DIR" >&2
  echo "Pass it as an argument or check the sibling repo path." >&2
  exit 1
fi

PHILO_DIR="$(cd "$PHILO_DIR" && pwd)"
HEAD_MD="$PHILO_DIR/machinagogy-v2.md"
HEAD_PDF="$PHILO_DIR/machinagogy-v2.pdf"
COMBINED_PDF="$PHILO_DIR/machinagogy-v2-combined.pdf"

if [ ! -f "$HEAD_MD" ]; then
  echo "Error: $HEAD_MD not found" >&2
  exit 1
fi

V2=$(grep '^version:' paper-full-2.0.md 2>/dev/null | head -1 | sed 's/version: *"\(.*\)"/\1/')
if [ -z "$V2" ]; then V2="dev"; fi
APPENDIX_PDF="$(pwd)/paper-2.0-appendix-v${V2}.pdf"

echo "Philosophy dir: $PHILO_DIR"
echo "Paper 2.0 version: $V2"
echo

echo "[1/3] Building head matter -> machinagogy-v2.pdf"
( cd "$PHILO_DIR" && pandoc \
    --citeproc \
    --pdf-engine=xelatex \
    machinagogy-v2.md -o machinagogy-v2.pdf )
echo "  -> $HEAD_PDF"
echo

echo "[2/3] Building paper 2.0 appendix"
if [ -f "$APPENDIX_PDF" ]; then
  echo "  $APPENDIX_PDF already exists, reusing."
else
  ./build-appendix.sh
fi
echo

echo "[3/3] Splicing combined PDF"
pdfunite "$HEAD_PDF" "$APPENDIX_PDF" "$COMBINED_PDF"
PAGES=$(pdfinfo "$COMBINED_PDF" 2>/dev/null | grep '^Pages:' | awk '{print $2}')
echo "  -> $COMBINED_PDF (${PAGES:-?} pages)"
echo
echo "Done."
