// tests/staticSurfaceRailContract.test.js
//
// The skin/nav contract for the plain-file surfaces.
//
// Server-rendered pages get both from railHtml(): the rail markup, and an inline
// early-apply that reads the persisted `poetics-skin` and writes `data-skin` on
// <html> before first paint. Static surfaces can't call railHtml(), so they load
// /components/rail-inject.js instead, which does the same two jobs.
//
// /tutor was missing that script for months. Its stylesheet derives every token
// from techne's with parchment fallbacks, so nothing looked broken — the shell
// just quietly stayed parchment while the rest of the app defaulted to stark.
// A missing <script> is invisible to every other test in the suite, hence this one.
//
// The checks are filesystem reads, but the surface list comes from the mounter
// itself rather than a second copy here — importing it drags in the route stack,
// which opens the DB, so the writable stores move to a temp dir before the import
// lands (same pattern as navParity.test.js).

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-railcontract-'));
for (const [k, v] of [
  ['EVAL_DB_PATH', path.join(tmp, 'evaluations.db')],
  ['EVAL_LOGS_DIR', path.join(tmp, 'logs')],
  ['EVAL_EXPORTS_DIR', path.join(tmp, 'exports')],
  ['AUTH_DB_PATH', path.join(tmp, 'lms.sqlite')],
  ['EVAL_WRITING_PAD_DIR', path.join(tmp, 'writing-pads')],
  ['TUTOR_CORE_LOG_DIR', path.join(tmp, 'tutor-core-logs')],
]) {
  process.env[k] = process.env[k] || v;
}
fs.mkdirSync(path.join(tmp, 'logs'), { recursive: true });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Mounts deliberately outside the researcher chrome. Each needs a stated reason:
// this is the list a future surface must argue its way onto, not a dumping ground.
const NO_RAIL = new Map([
  ['/pilot', 'participant-facing — study subjects must not see researcher navigation'],
  ['/eval', 'static explainers, not an app surface'],
  ['/components', 'the design system itself, served as assets'],
  ['/docs', 'the documentation tree, not an app surface'],
]);

let railHosts;

before(async () => {
  const { STATIC_SURFACES } = await import('../services/evalSurfaces.js');
  railHosts = STATIC_SURFACES.filter(([mount]) => !NO_RAIL.has(mount)).filter(([, dir]) =>
    fs.existsSync(path.join(ROOT, dir, 'index.html')),
  );
});

test('every researcher-facing static surface loads rail-inject.js', () => {
  assert.ok(railHosts.length >= 4, `expected at least the four known rail hosts, found ${railHosts.length}`);

  for (const [mount, dir] of railHosts) {
    const file = path.join(dir, 'index.html');
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(
      html,
      /<script[^>]+src=["']\/components\/rail-inject\.js["']/,
      `${mount} (${file}) does not load /components/rail-inject.js, so data-skin is never set there ` +
        `and the page ignores the persisted skin. Add the script tag, or add ${mount} to NO_RAIL with a reason.`,
    );
  }
});

test('rail-inject applies the persisted skin, defaulting to stark', () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/components/rail-inject.js'), 'utf8');
  assert.match(src, /poetics-skin/, 'rail-inject should read the persisted skin key');
  assert.match(src, /setAttribute\(\s*['"]data-skin['"]/, 'rail-inject should write data-skin on <html>');
  assert.match(src, /=\s*['"]stark['"]/, 'an unset skin should default to stark, mirroring the rail early-apply');
});

test('the tutor shell keeps parchment fallbacks so it survives techne.css failing to load', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/tutor/styles.css'), 'utf8');
  // Token names carry digits (--paper-2, --ink-3), so the character class must too.
  const derived = css.match(/--tutor-[\w-]+:\s*var\(--[\w-]+,\s*#[0-9a-f]{3,8}\s*\)/gi) || [];
  assert.ok(
    derived.length >= 6,
    `expected the tutor tokens to derive from techne with fallbacks, found ${derived.length}`,
  );
});
