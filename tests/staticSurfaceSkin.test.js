// tests/staticSurfaceSkin.test.js
//
// The static surfaces are plain files served off disk by services/evalSurfaces.js,
// so they cannot call railHtml() and must load components/skin-early-apply.js
// themselves to pick up the persisted skin. /tutor shipped without it and stayed
// parchment while the rest of the app went stark; the logic had been copied into
// rail-inject.js rather than shared, so nothing caught the omission.
//
// These assertions pin the contract that the copy is gone and every surface
// loads the one file, synchronously and before its stylesheets.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EARLY_APPLY = 'components/skin-early-apply.js';

// Static surfaces inside the researcher chrome. /pilot is deliberately outside
// it (participant-facing), so it is not listed here.
const SURFACES = ['tutor', 'adjudication', 'pilot-admin', 'human-coding-admin'];

function surfaceHtml(surface) {
  return fs.readFileSync(path.join(ROOT, 'public', surface, 'index.html'), 'utf8');
}

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
}

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
