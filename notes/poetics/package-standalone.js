#!/usr/bin/env node
/* package-standalone.js — bundle a techne doc into one portable HTML file.

   Inlines local <link rel="stylesheet"> and <script src> (resolved relative
   to the doc), leaving remote assets — e.g. the Google Fonts CDN — as links.
   The result opens anywhere with no server or sibling assets/ (for sharing
   or remote viewing). The live beacon/deeplinks degrade to offline/static.

   Usage:  node notes/poetics/package-standalone.js <doc.html> [out.html]
   Default out: <doc>.standalone.html
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename, extname, join } from 'node:path';

const [, , input, output] = process.argv;
if (!input) {
  console.error('usage: node package-standalone.js <doc.html> [out.html]');
  process.exit(1);
}

const docDir = dirname(input);
const isLocal = (href) => Boolean(href) && !/^(https?:)?\/\//.test(href) && !href.startsWith('data:');

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
  return '<script>\n' + readFileSync(resolve(docDir, src), 'utf8') + '\n</script>';
});

const out = output || join(docDir, basename(input, extname(input)) + '.standalone' + extname(input));
writeFileSync(out, html);
console.log('wrote ' + out + ' (self-contained)');
