#!/usr/bin/env bash
# Build PDF, short paper, and slides from paper markdown source.
# Usage:
#   ./build.sh              # build full paper PDF
#   ./build.sh full         # build full paper PDF
#   ./build.sh short        # build short paper PDF
#   ./build.sh beamer       # build slides PDF (beamer)
#   ./build.sh pptx         # build slides PPTX
#   ./build.sh slides       # build both beamer PDF and PPTX slides
#   ./build.sh all          # build everything

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
SLIDES_PDF="slides-v${VERSION}.pdf"
SLIDES_PPTX="slides-v${VERSION}.pptx"

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

build_beamer() {
  echo "Building ${SLIDES_PDF} (beamer) ..."
  pandoc --citeproc --pdf-engine=xelatex -t beamer \
    --slide-level=2 \
    slides.md -o "${SLIDES_PDF}"
  echo "  -> ${SLIDES_PDF}"
}

build_pptx() {
  echo "Building ${SLIDES_PPTX} ..."
  # Use slides-pptx.md (stripped of LaTeX commands) with styled reference doc
  if [ -f slides-pptx.md ]; then
    SLIDES_SRC="slides-pptx.md"
  else
    SLIDES_SRC="slides.md"
  fi
  PPTX_OPTS=(--citeproc --slide-level=2)
  if [ -f reference.pptx ]; then
    PPTX_OPTS+=(--reference-doc=reference.pptx)
  fi
  pandoc "${PPTX_OPTS[@]}" "${SLIDES_SRC}" -o "${SLIDES_PPTX}"
  echo "  -> ${SLIDES_PPTX}"
}

case "${1:-full}" in
  full|pdf|"")
    build_full
    ;;
  short)
    build_short
    ;;
  beamer)
    build_beamer
    ;;
  pptx)
    build_pptx
    ;;
  slides)
    build_beamer
    build_pptx
    ;;
  all)
    build_full
    build_short
    build_beamer
    build_pptx
    ;;
  *)
    echo "Usage: $0 [full|short|beamer|pptx|slides|all]"
    exit 1
    ;;
esac

echo "Done."
