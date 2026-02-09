#!/usr/bin/env bash
# Build PDFs (and optionally PPTX) from paper markdown sources.
# Usage:
#   ./build.sh              # build both PDFs
#   ./build.sh full         # build full paper PDF only
#   ./build.sh short        # build short paper PDF only
#   ./build.sh slides       # build slides PPTX from full paper (basic pandoc output)
#   ./build.sh all          # build PDFs + slides

set -euo pipefail
cd "$(dirname "$0")"

# Extract version from paper-full.md YAML frontmatter
VERSION=$(grep '^version:' paper-full.md | head -1 | sed 's/version: *"\(.*\)"/\1/')
if [ -z "$VERSION" ]; then
  echo "Warning: no version found in paper-full.md frontmatter, using 'dev'"
  VERSION="dev"
fi

FULL_PDF="paper-full-v${VERSION}.pdf"
SHORT_PDF="paper-short-v${VERSION}.pdf"
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

build_short() {
  echo "Building ${SHORT_PDF} ..."
  pandoc "${PANDOC_OPTS[@]}" paper-short.md -o "${SHORT_PDF}"
  echo "  -> ${SHORT_PDF}"
}

build_slides() {
  echo "Building ${SLIDES_PPTX} (basic pandoc conversion) ..."
  pandoc --citeproc paper-full.md -o "${SLIDES_PPTX}"
  echo "  -> ${SLIDES_PPTX}"
  echo "  Note: For the full presentation, see notes/Drama-Machine-Presentation.pptx"
}

case "${1:-pdf}" in
  full)
    build_full
    ;;
  short)
    build_short
    ;;
  slides)
    build_slides
    ;;
  all)
    build_full
    build_short
    build_slides
    ;;
  pdf|"")
    build_full
    build_short
    ;;
  *)
    echo "Usage: $0 [full|short|slides|pdf|all]"
    exit 1
    ;;
esac

echo "Done."
