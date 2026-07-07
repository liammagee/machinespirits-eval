#!/usr/bin/env node
/* package-standalone.js — bundle a techne doc into one portable HTML file.

   Inlines local <link rel="stylesheet"> and <script src> (resolved relative
   to the doc), leaving remote assets — e.g. the Google Fonts CDN — as links.
   The result opens anywhere with no server or sibling assets/ (for sharing
   or remote viewing). The live beacon/deeplinks degrade to offline/static.

   Usage:  node notes/poetics/package-standalone.js <doc.html> [out.html]
   Default out: <doc>.standalone.html

   Also exports bundleStandalone(input) -> html string, so other tooling
   (e.g. publish-arc-to-site.js) can reuse the inliner without shelling out.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const isLocal = (href) => Boolean(href) && !/^(https?:)?\/\//.test(href) && !href.startsWith('data:');

// Inline a doc's local stylesheets and scripts; return the self-contained HTML
// string. Remote (CDN) and data: refs pass through untouched.
export function bundleStandalone(input) {
  const docDir = dirname(input);
  let html = readFileSync(input, 'utf8');

  // inline local stylesheets (remote CDN links pass through untouched)
  html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, (tag) => {
    const m = tag.match(/href="([^"]+)"/);
    if (!m || !isLocal(m[1])) return tag;
    return '<style>\n' + readFileSync(resolve(docDir, m[1]), 'utf8') + '\n</style>';
  });

  // inline local <script src> (inline JSON/data scripts have no src, so are left alone)
  html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (tag, src) => {
    if (!isLocal(src)) return tag;
    // Escape `</script` in the inlined body: the HTML parser ends a <script> at the
    // FIRST literal `</script` it sees — even inside a JS comment or string — and dumps
    // the remainder as page text. techne.js documents its own usage with a literal
    // `…></script>` in its header comment, so inlined verbatim it self-terminates.
    // `<\/script` is byte-identical in every JS context (`\/` === `/`, harmless in a
    // comment) but invisible to the HTML close-tag scanner.
    const body = readFileSync(resolve(docDir, src), 'utf8').replace(/<\/script/gi, '<\\/script');
    return '<script>\n' + body + '\n</script>';
  });

  return html;
}

// CLI entry — only when run directly, not when imported.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , input, output] = process.argv;
  if (!input) {
    console.error('usage: node package-standalone.js <doc.html> [out.html]');
    process.exit(1);
  }
  const out = output || join(dirname(input), basename(input, extname(input)) + '.standalone' + extname(input));
  writeFileSync(out, bundleStandalone(input));
  console.log('wrote ' + out + ' (self-contained)');
}
