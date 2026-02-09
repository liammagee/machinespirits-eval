#!/usr/bin/env bash
# Build PDF (and optionally PPTX) from paper markdown source.
# Usage:
#   ./build.sh              # build full paper PDF
#   ./build.sh full         # build full paper PDF
#   ./build.sh slides       # build slides PPTX from full paper (basic pandoc output)
#   ./build.sh all          # build PDF + slides

set -euo pipefail
cd "$(dirname "$0")"

# Extract version from paper-full.md YAML frontmatter
VERSION=$(grep '^version:' paper-full.md | head -1 | sed 's/version: *"\(.*\)"/\1/')
if [ -z "$VERSION" ]; then
  echo "Warning: no version found in paper-full.md frontmatter, using 'dev'"
  VERSION="dev"
fi

FULL_PDF="paper-full-v${VERSION}.pdf"
SLIDES_PPTX="paper-slides-v${VERSION}.pptx"

PANDOC_OPTS=(
  --citeproc
  --pdf-engine=xelatex
  -H header.tex
)

build_full() {
  echo "Building ${FULL_PDF} ..."
  pandoc "${PANDOC_OPTS[@]}" paper-full.md -o "${FULL_PDF}"
  echo "  -> ${FULL_PDF}"
}

build_slides() {
  echo "Building ${SLIDES_PPTX} (basic pandoc conversion) ..."
  pandoc --citeproc paper-full.md -o "${SLIDES_PPTX}"
  echo "  -> ${SLIDES_PPTX}"
  echo "  Note: For the full presentation, see notes/Drama-Machine-Presentation.pptx"
}

case "${1:-full}" in
  full|pdf|"")
    build_full
    ;;
  slides)
    build_slides
    ;;
  all)
    build_full
    build_slides
    ;;
  *)
    echo "Usage: $0 [full|slides|all]"
    exit 1
    ;;
esac

echo "Done."
