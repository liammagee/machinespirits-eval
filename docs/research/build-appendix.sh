#!/usr/bin/env bash
# Build Paper 2.0 as a standalone appendix PDF, then optionally append it
# to another PDF.
#
# Usage:
#   ./build-appendix.sh                    # build appendix PDF only
#   ./build-appendix.sh <input.pdf>        # append to input, write input-combined.pdf
#   ./build-appendix.sh <input.pdf> <out>  # append to input, write to <out>
#
# The appendix version:
#   - Wraps the entire paper under a single top-level "Appendix" heading
#   - Demotes all internal headings by one level (§1 → A.1, §2 → A.2, ...)
#   - Renames internal appendices A-E → I-V to avoid collision
#   - Restarts page numbering with "A-" prefix
#   - Removes the standalone title/author block

set -euo pipefail
cd "$(dirname "$0")"

V2=$(grep '^version:' paper-full-2.0.md 2>/dev/null | head -1 | sed 's/version: *"\(.*\)"/\1/')
if [ -z "$V2" ]; then V2="dev"; fi

APPENDIX_PDF="paper-2.0-appendix-v${V2}.pdf"
TMPFILE=$(mktemp /tmp/paper2-appendix-XXXXXX.md)

trap 'rm -f "$TMPFILE"' EXIT

echo "Preparing appendix markdown..."

# 1. Strip YAML frontmatter and standalone title heading, then transform
awk '
  BEGIN { in_front=0; front_done=0; title_skipped=0 }
  /^---$/ && !front_done { in_front = !in_front; if (!in_front) front_done=1; next }
  in_front { next }
  # Skip the first top-level heading (duplicate of YAML title)
  /^# / && !title_skipped { title_skipped=1; next }
  { print }
' paper-full-2.0.md | \
sed '
  # Rename internal appendices to avoid collision with parent document
  s/^## Appendix A:/## Supplement I:/
  s/^## Appendix B:/## Supplement II:/
  s/^## Appendix C:/## Supplement III:/
  s/^## Appendix D:/## Supplement IV:/
  s/^## Appendix E:/## Supplement V:/
  s/Appendix A/Supplement I/g
  s/Appendix B/Supplement II/g
  s/Appendix C/Supplement III/g
  s/Appendix D/Supplement IV/g
  s/Appendix E/Supplement V/g
' > "$TMPFILE"

# 2. Build the appendix PDF
#    --shift-heading-level-by=1 demotes all ## to ###, etc.
#    We prepend a single top-level heading so it becomes "Appendix A" in the parent
echo "Building ${APPENDIX_PDF}..."

cat > "${TMPFILE}-wrapper.md" << 'WRAPPER_EOF'
---
bibliography: references.bib
header-includes: |
  \usepackage{unicode-math}
  \setmathfont{latinmodern-math.otf}
  \usepackage{etoolbox}
  \usepackage{newunicodechar}
  \newunicodechar{≈}{$\approx$}
  \newunicodechar{≥}{$\geq$}
  \newunicodechar{𝜒}{$\chi$}
  \tracinglostchars=0
  \let\oldtexttt\texttt
  \DeclareRobustCommand{\texttt}[1]{{\ttfamily\small #1}}
  \let\oldtextunderscore\_
  \renewcommand{\_}{\oldtextunderscore\hspace{0pt}}
  \AtBeginEnvironment{longtable}{\small\setlength{\tabcolsep}{5pt}}
  \apptocmd{\Shaded}{\footnotesize}{}{}
  \pagenumbering{arabic}
  \renewcommand{\thepage}{A-\arabic{page}}
---

# Appendix: From Effects to Mechanisms — Recognition-Enhanced AI Tutoring Through Process Tracing

WRAPPER_EOF

cat "$TMPFILE" >> "${TMPFILE}-wrapper.md"

pandoc \
  --citeproc \
  --pdf-engine=xelatex \
  --shift-heading-level-by=1 \
  "${TMPFILE}-wrapper.md" -o "${APPENDIX_PDF}"

rm -f "${TMPFILE}-wrapper.md"

echo "  -> ${APPENDIX_PDF}"

# 3. Optionally combine with another PDF
if [ $# -ge 1 ]; then
  INPUT="$1"
  if [ ! -f "$INPUT" ]; then
    echo "Error: $INPUT not found"
    exit 1
  fi
  OUTPUT="${2:-${INPUT%.pdf}-combined.pdf}"
  echo "Combining: $INPUT + ${APPENDIX_PDF} -> $OUTPUT"
  pdfunite "$INPUT" "${APPENDIX_PDF}" "$OUTPUT"
  echo "  -> $OUTPUT ($(pdfinfo "$OUTPUT" 2>/dev/null | grep Pages || echo 'done'))"
fi

echo "Done."
