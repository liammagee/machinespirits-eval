/**
 * The techne design tokens live in three places with two contracts:
 *
 *   1. public/components/techne.css — the served app-UI subset, whose header
 *      says it mirrors the poetics dashboard's inline BASE_CSS. Contract:
 *      every token both declare must be VALUE-equal, in every skin block.
 *   2. notes/poetics/assets/techne.css — the editorial design system. Its
 *      LIGHT palette is a deliberately different tuning (docs vs app UI), but
 *      the DARK palette is shared: tokens both declare must be value-equal.
 *
 * Before this test the mirrors were maintained by hand-written "keep in sync"
 * comments only. Comparison is value-based, not textual: whitespace,
 * leading-zero decimals (.18 vs 0.18) and one level of same-block var()
 * indirection do not count as drift.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const servedCss = read('public/components/techne.css');
const editorialCss = read('notes/poetics/assets/techne.css');
const dashboardJs = read('scripts/browse-poetics-scripts.js');

function dashboardBaseCss() {
  const i = dashboardJs.indexOf('const BASE_CSS');
  assert.ok(i > 0, 'BASE_CSS constant not found in browse-poetics-scripts.js');
  const open = dashboardJs.indexOf('`', i);
  const close = dashboardJs.indexOf('`', open + 1);
  return dashboardJs.slice(open + 1, close);
}

// First balanced { ... } block after the first occurrence of `selector`.
function block(css, selector) {
  const at = css.indexOf(selector);
  if (at < 0) return '';
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (!depth) return css.slice(open, i);
    }
  }
  return '';
}

function tokens(css) {
  const map = {};
  for (const [, name, value] of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/giu)) {
    if (!(name in map)) map[name] = value.trim();
  }
  return map;
}

// Value normalizer: strip spaces, add leading zeros to bare decimals, then
// resolve one level of var(--x) against the same block's map.
function normalized(value, map) {
  let v = String(value)
    .replace(/\s+/gu, '')
    .replace(/(^|[(,])\.(\d)/gu, '$10.$2');
  const varRef = /^var\((--[a-z0-9-]+)\)$/iu.exec(v);
  if (varRef && map[varRef[1]] != null) {
    v = normalized(map[varRef[1]], {});
  }
  return v;
}

function assertMirror(aCss, bCss, selector, minShared, label) {
  const a = tokens(block(aCss, selector));
  const b = tokens(block(bCss, selector));
  const shared = Object.keys(a).filter((k) => k in b);
  assert.ok(
    shared.length >= minShared,
    `${label} ${selector}: only ${shared.length} shared tokens — parsing broke or a block was renamed`,
  );
  const drift = shared.filter((k) => normalized(a[k], a) !== normalized(b[k], b));
  assert.deepEqual(
    drift.map((k) => `${k}: ${a[k]} != ${b[k]}`),
    [],
    `${label} ${selector}: token values drifted`,
  );
}

test('served techne subset mirrors the dashboard BASE_CSS in every skin block', () => {
  const base = dashboardBaseCss();
  assertMirror(base, servedCss, ':root', 20, 'dashboard vs served');
  assertMirror(base, servedCss, '[data-theme="dark"]', 15, 'dashboard vs served');
  assertMirror(base, servedCss, '[data-skin="stark"]', 15, 'dashboard vs served');
  assertMirror(base, servedCss, '[data-skin="stark"][data-theme="dark"]', 15, 'dashboard vs served');
});

test('editorial and served stylesheets share one dark palette', () => {
  assertMirror(editorialCss, servedCss, '[data-theme="dark"]', 15, 'editorial vs served');
});

test('editorial light palette is a distinct tuning, not an accidental copy', () => {
  // Documents the intended divergence: if someone "fixes" the light palettes
  // into equality, this fails and forces the change to be deliberate.
  const a = tokens(block(editorialCss, ':root'));
  const b = tokens(block(servedCss, ':root'));
  assert.notEqual(normalized(a['--paper'], a), normalized(b['--paper'], b));
});
