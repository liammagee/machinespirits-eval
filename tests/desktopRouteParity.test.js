// tests/desktopRouteParity.test.js
//
// The "stays in sync" guard. Asserts that the desktop's PRODUCTION app serves
// exactly the same route table as the canonical web poetics app, and that it
// ships no /__smoke probe routes. If a future change forks the desktop's routes
// (mounts a subset, adds desktop-only endpoints, etc.) this fails instead of
// silently drifting.
//
// Run in CI with plain `node --test` (fresh checkout = Node ABI). In a worktree
// whose native modules were rebuilt for Electron, run it via Electron's Node:
//   EVAL_DB_PATH=$(mktemp -d)/t.db EVAL_LOGS_DIR=$(mktemp -d) \
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron --test tests/desktopRouteParity.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDesktopApp } from '../desktop/appFactory.mjs';
import { createPoeticsBrowserApp } from '../scripts/browse-poetics-scripts.js';
import { diffRoutes, routeFingerprint } from '../desktop/routeParity.js';

const dbPath = process.env.EVAL_DB_PATH; // hermetic temp DB supplied by the runner
const HOST = '127.0.0.1';

function closeApp(app) {
  try {
    (app?.locals?.poeticsApp || app)?.locals?.db?.close?.();
  } catch {
    /* ignore */
  }
}

test('desktop production app == web poetics app (route parity)', () => {
  const web = createPoeticsBrowserApp({ dbPath, host: HOST });
  const desktop = buildDesktopApp({ smoke: false, dbPath, host: HOST });
  try {
    const fp = routeFingerprint(desktop);
    assert.ok(fp.length > 10, `expected a populated route table, got ${fp.length} layers`);
    const d = diffRoutes(web, desktop);
    assert.ok(
      d.equal,
      `desktop route table diverged from web:\n  only in web: ${d.onlyInA.join(', ')}\n  only in desktop: ${d.onlyInB.join(', ')}`,
    );
  } finally {
    closeApp(web);
    closeApp(desktop);
  }
});

test('production build ships no /__smoke probe routes', () => {
  const desktop = buildDesktopApp({ smoke: false, dbPath, host: HOST });
  try {
    const fp = routeFingerprint(desktop);
    assert.ok(!fp.some((x) => x.includes('__smoke')), 'production app must not expose /__smoke probe routes');
  } finally {
    closeApp(desktop);
  }
});
