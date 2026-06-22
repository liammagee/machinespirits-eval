// tests/desktopRouteParity.test.js
//
// The "stays in sync" guard. Asserts the desktop's PRODUCTION app serves exactly
// the same route table as the canonical web poetics app, and ships no /__smoke
// probe routes. A future change that forks the desktop's routes fails here.
//
// Self-hermetic: relocates every writable store into a temp dir BEFORE importing
// the app, so it never touches the real DB/logs — safe under `npm test` and CI.
// In CI (fresh checkout = Node ABI) it runs under plain `node --test`. In an
// Electron-ABI worktree, run it via `npm run desktop:test` (Electron's Node).

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-parity-'));
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

const HOST = '127.0.0.1';
const DB = () => process.env.EVAL_DB_PATH;
let buildDesktopApp, createPoeticsBrowserApp, diffRoutes, routeFingerprint;

before(async () => {
  ({ buildDesktopApp } = await import('../desktop/appFactory.mjs'));
  ({ createPoeticsBrowserApp } = await import('../scripts/browse-poetics-scripts.js'));
  ({ diffRoutes, routeFingerprint } = await import('../desktop/routeParity.js'));
});

function closeApp(app) {
  try {
    (app?.locals?.poeticsApp || app)?.locals?.db?.close?.();
  } catch {
    /* ignore */
  }
}

test('desktop production app == web poetics app (route parity)', () => {
  const web = createPoeticsBrowserApp({ dbPath: DB(), host: HOST });
  const desktop = buildDesktopApp({ smoke: false, dbPath: DB(), host: HOST });
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
  const desktop = buildDesktopApp({ smoke: false, dbPath: DB(), host: HOST });
  try {
    assert.ok(
      !routeFingerprint(desktop).some((x) => x.includes('__smoke')),
      'production app must not expose /__smoke probe routes',
    );
  } finally {
    closeApp(desktop);
  }
});
