// tests/desktopSyncContract.test.js — pure, runs under plain `node --test`.
//
// Mechanically enforces the "stays in sync" contract (see desktop/ARCHITECTURE.md):
//   1. desktop/ contains NO UI files — the web UI lives in public/ + the route
//      renderers, and the desktop serves it unchanged. A desktop-only .html would
//      be a fork.
//   2. ONE-WAY dependency — the web stack (services/, routes/, public/) must never
//      import from desktop/, so it stays runnable + reasoned-about without the
//      desktop shell (mirrors the in-housed tutor-core's one-way rule).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, keep) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, keep));
    else if (keep(full)) out.push(full);
  }
  return out;
}

test('desktop/ contains no UI files (no fork of the shared web surfaces)', () => {
  const html = walk(path.join(REPO, 'desktop'), (f) => f.endsWith('.html')).map((f) => path.relative(REPO, f));
  assert.deepEqual(
    html,
    [],
    `desktop/ must contain no .html — UI lives in public/ + route renderers. Found: ${html.join(', ')}`,
  );
});

test('one-way dependency: services/ routes/ public/ never import from desktop/', () => {
  const importsDesktop = /(?:^|[^.\w])(?:from|import|require)\s*\(?\s*['"][^'"]*\/desktop\//m;
  const offenders = [];
  for (const sub of ['services', 'routes', 'public']) {
    for (const f of walk(path.join(REPO, sub), (x) => /\.(?:js|mjs|cjs)$/.test(x))) {
      if (importsDesktop.test(fs.readFileSync(f, 'utf8'))) offenders.push(path.relative(REPO, f));
    }
  }
  assert.deepEqual(offenders, [], `the web stack must not depend on desktop/. Offenders: ${offenders.join(', ')}`);
});
