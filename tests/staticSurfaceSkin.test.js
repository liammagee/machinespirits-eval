// tests/staticSurfaceSkin.test.js
//
// The static surfaces are plain files served off disk by services/evalSurfaces.js,
// so they cannot call railHtml() and must load components/skin-early-apply.js
// themselves to pick up the persisted skin. /tutor shipped without it and stayed
// parchment while the rest of the app went stark; the logic had been copied into
// rail-inject.js rather than shared, so nothing caught the omission.
//
// The same is true of the nav rail, which those surfaces load through
// components/rail-inject.js. /tutor shipped without that too, which left it a
// one-way door: every other page's rail links to it as "tutor lab", and once
// there you had nothing to click back to.
//
// These assertions pin the contract that the early-apply copy is gone and that
// every researcher surface loads both scripts — the skin one synchronously,
// before its stylesheets.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { STATIC_SURFACES } from '../services/evalStaticSurfaces.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EARLY_APPLY = 'components/skin-early-apply.js';
const RAIL_INJECT = 'components/rail-inject.js';

// Mounts deliberately outside the researcher chrome. Each needs a stated reason:
// this is the list a new surface must argue its way onto, not a dumping ground.
const NO_CHROME = new Map([
  ['/pilot', 'participant-facing — study subjects must not see researcher navigation'],
  ['/eval', 'static explainers, not an app surface'],
  ['/components', 'the design system itself, served as assets'],
  ['/docs', 'the documentation tree, not an app surface'],
]);

// Derived from the mount table rather than hand-kept here. A copy is how /tutor
// slipped: it was mounted for months without being on anyone's list to check.
const SURFACES = STATIC_SURFACES.filter(([mount]) => !NO_CHROME.has(mount))
  .map(([, dir]) => dir.replace(/^public\//u, ''))
  .filter((surface) => fs.existsSync(path.join(ROOT, 'public', surface, 'index.html')));

function surfaceHtml(surface) {
  return fs.readFileSync(path.join(ROOT, 'public', surface, 'index.html'), 'utf8');
}

test('the researcher surfaces are read from the mount table', () => {
  assert.ok(SURFACES.length >= 4, `expected at least the four known researcher surfaces, found ${SURFACES.length}`);
});

for (const surface of SURFACES) {
  test(`/${surface} loads the shared skin early-apply`, () => {
    const html = surfaceHtml(surface);
    assert.ok(html.includes(`src="/${EARLY_APPLY}"`), `${surface} must load /${EARLY_APPLY}`);
  });

  test(`/${surface} applies the skin before paint`, () => {
    const html = surfaceHtml(surface);
    const tag = new RegExp(`<script[^>]*src="/${EARLY_APPLY.replace(/[/.]/gu, '\\$&')}"[^>]*>`, 'u').exec(html);
    assert.ok(tag, `${surface} must load /${EARLY_APPLY}`);
    // `defer` or `async` would run it after the document parses, so the page
    // paints parchment and then snaps to stark.
    assert.ok(!/\sdefer[\s>]/u.test(tag[0]), `${surface} must not defer the skin early-apply`);
    assert.ok(!/\sasync[\s>]/u.test(tag[0]), `${surface} must not load the skin early-apply async`);

    const firstStylesheet = html.indexOf('<link rel="stylesheet"');
    if (firstStylesheet !== -1) {
      assert.ok(tag.index < firstStylesheet, `${surface} must load the skin early-apply before its first stylesheet`);
    }
  });

  test(`/${surface} loads the shared nav rail`, () => {
    const html = surfaceHtml(surface);
    assert.match(
      html,
      new RegExp(`<script[^>]+src="/${RAIL_INJECT.replace(/[/.]/gu, '\\$&')}"`, 'u'),
      `${surface} must load /${RAIL_INJECT}, or it becomes a page with no way back into the app. ` +
        `If it belongs outside the researcher chrome, add its mount to NO_CHROME with a reason.`,
    );
  });
}

test('rail-inject leaves a host page its skip link', () => {
  const railInject = fs.readFileSync(path.join(ROOT, 'public/components/rail-inject.js'), 'utf8');
  // Injecting at body.firstChild puts ~40 nav links ahead of the skip link,
  // which is the tabbing the link exists to skip. /tutor is the only surface
  // with one today, so a "simplification" back to firstChild would look safe.
  assert.match(
    railInject,
    /skip-link/u,
    'rail-inject.js must insert the rail after a host page’s .skip-link, not ahead of it',
  );
});

test('rail-inject no longer carries its own copy of the early-apply', () => {
  const railInject = fs.readFileSync(path.join(ROOT, 'public/components/rail-inject.js'), 'utf8');
  // A comment may name the key; an actual read of it is the duplication.
  assert.ok(
    !/getItem\(\s*['"]poetics-skin['"]\s*\)/u.test(railInject),
    'rail-inject.js must not re-implement the skin early-apply',
  );
});

test('the shared early-apply defaults to stark and respects an explicit choice', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', EARLY_APPLY), 'utf8');
  assert.match(source, /poetics-skin/u);
  assert.match(source, /sk\s*=\s*'stark'/u);
  // Only stark is written. Any other stored value must leave the attribute
  // unset so the page keeps its parchment defaults.
  assert.match(source, /if\s*\(sk === 'stark'\)/u);
});
