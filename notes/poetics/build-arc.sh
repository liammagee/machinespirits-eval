#!/usr/bin/env bash
# Build the dramatic-recognition arc note: arc.md (content) -> styled HTML.
# Design lives in assets/techne.css + assets/arc.js; chrome in arc.template.html.
set -euo pipefail
cd "$(dirname "$0")"
OUT="2026-05-26-paper-to-dramatic-recognition-arc.html"
pandoc arc.md \
  --template=arc.template.html \
  --from=markdown --to=html5 \
  --output="$OUT"
echo "built $OUT from arc.md"
