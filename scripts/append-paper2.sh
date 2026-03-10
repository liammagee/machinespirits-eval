#!/bin/bash
# Append the latest Paper 2.0 PDF to another PDF.
# Usage: ./scripts/append-paper2.sh <input.pdf> [output.pdf]
#
# If output is omitted, writes to <input>-with-paper2.pdf

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <input.pdf> [output.pdf]"
  echo "Appends the latest Paper 2.0 PDF after <input.pdf>."
  exit 1
fi

INPUT="$1"
if [ ! -f "$INPUT" ]; then
  echo "Error: $INPUT not found"
  exit 1
fi

# Find the latest Paper 2.0 PDF (built by ./build.sh paper2)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PAPER2=$(ls -t "$REPO_ROOT"/paper-2.0-v*.pdf 2>/dev/null | head -1)

if [ -z "$PAPER2" ]; then
  echo "Error: No paper-2.0-v*.pdf found in $REPO_ROOT"
  echo "Run: cd docs/research && ./build.sh paper2"
  exit 1
fi

OUTPUT="${2:-${INPUT%.pdf}-with-paper2.pdf}"

echo "Input:   $INPUT"
echo "Paper 2: $PAPER2"
echo "Output:  $OUTPUT"

pdfunite "$INPUT" "$PAPER2" "$OUTPUT"

echo "Done. $(pdfinfo "$OUTPUT" 2>/dev/null | grep Pages || echo '')"
