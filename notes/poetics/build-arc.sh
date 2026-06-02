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

# Self-contained portable copy: inline techne.css + arc.js (fonts stay on the CDN).
# Opens anywhere with no server or sibling assets/ — for sharing / remote viewing.
STANDALONE="arc-standalone.html"
node - "$OUT" "$STANDALONE" <<'NODE'
const fs = require('fs');
const [, , inp, outp] = process.argv;
let h = fs.readFileSync(inp, 'utf8');
const css = fs.readFileSync('assets/techne.css', 'utf8');
const js = fs.readFileSync('assets/arc.js', 'utf8');
h = h.replace(/<link rel="stylesheet" href="assets\/techne\.css"[^>]*>/, '<style>\n' + css + '\n</style>');
h = h.replace(/<script src="assets\/arc\.js"[^>]*><\/script>/, '<script>\n' + js + '\n</script>');
fs.writeFileSync(outp, h);
NODE
echo "built $STANDALONE (self-contained)"
