// desktop/appFactory.mjs
//
// The SINGLE place the desktop constructs the app it serves.
//
// In production (smoke=false) it returns EXACTLY the web poetics app — the
// superset built by the exported `createPoeticsBrowserApp` factory (which mounts
// the four shared /api/* routers + static UI via mountEvalSurfaces, plus the
// poetics-only routes). Because the desktop serves the identical factory output,
// the desktop and web route tables are the same by construction. That invariant
// is locked by tests/desktopRouteParity.test.js — the "stays in sync" guard.
//
// In smoke mode (smoke=true) it wraps that app in a parent that adds no-cost
// /__smoke probe routes for the headless boot battery. Those NEVER ship in
// production (the parity + no-probe tests enforce it).

import express from 'express';
import { createPoeticsBrowserApp } from '../scripts/browse-poetics-scripts.js';

export function buildDesktopApp({ smoke = false, dbPath, host = '127.0.0.1' } = {}) {
  const poeticsApp = createPoeticsBrowserApp({ dbPath, host });
  if (!smoke) return poeticsApp; // production: the unchanged web app

  // Smoke-only wrapper: probe routes are matched BEFORE the real app (which is
  // mounted as a sub-app, keeping its own auth + json middleware).
  const root = express();
  root.get('/__smoke/ping', (_req, res) => res.type('text/plain').send('pong\n'));
  root.get('/__smoke/sse', (_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      res.write(`event: tick\ndata: ${JSON.stringify({ n })}\n\n`);
      if (n >= 3) {
        clearInterval(timer);
        res.end();
      }
    }, 50);
    res.on('close', () => clearInterval(timer));
  });
  root.use(poeticsApp);
  root.locals.poeticsApp = poeticsApp; // expose for DB-handle shutdown
  return root;
}
