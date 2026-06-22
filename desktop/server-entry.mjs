// desktop/server-entry.mjs
//
// Runs inside an Electron `utilityProcess` (Electron's own Node runtime), NOT
// the main process. Its job is the core Phase-0 de-risk: boot the *existing*
// web stack — unchanged — inside Electron and report the bound port back to
// main, which then points a BrowserWindow at it.
//
// We consume the poetics scriptorium's exported factory `createPoeticsBrowserApp`
// (scripts/browse-poetics-scripts.js). That app is the SUPERSET: it applies the
// POETICS auth guard + express.json, mounts the four shared /api/* routers and
// the static UI surfaces (via mountEvalSurfaces), AND adds the poetics-only
// routes (/browse, /compose, /ontology, /runs, /board, …). So one factory call
// gives us every web surface. No existing file is modified.
//
// Native modules: importing the factory pulls in evaluationStore + poeticsStore,
// which load `better-sqlite3` and open the DB at import time. If better-sqlite3
// is not rebuilt for Electron's ABI, that import throws here and we report a
// fatal — which is exactly the signal Phase 0 exists to surface.

import express from 'express';
import { createPoeticsBrowserApp } from '../scripts/browse-poetics-scripts.js';

const HOST = '127.0.0.1';
const dbPath = process.env.EVAL_DB_PATH || undefined; // factory also falls back to EVAL_DB_PATH

function send(msg) {
  try {
    process.parentPort?.postMessage(msg);
  } catch {
    /* parentPort absent (e.g. run under plain node) — ignore */
  }
}

// --- Build the real app via its sanctioned factory (same call main() uses). ---
let poeticsApp;
try {
  poeticsApp = createPoeticsBrowserApp({ dbPath, host: HOST });
} catch (err) {
  send({ type: 'fatal', stage: 'build-app', error: err?.stack || String(err) });
  process.exit(1);
}

// Parent wrapper: register smoke-only routes BEFORE delegating to the poetics
// app, so they are matched ahead of any catch-all the poetics app registers.
// The poetics app keeps its own auth + json middleware when mounted here.
const root = express();

root.get('/__smoke/ping', (_req, res) => res.type('text/plain').send('pong\n'));

// A no-cost SSE endpoint to prove text/event-stream survives Electron's loopback
// network stack (the real /api/eval/stream/* endpoints do metered work, so we
// don't touch them in an automated smoke).
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

// --- Listen on an ephemeral loopback port (no collision with :8081 / :3466). ---
const server = root.listen(0, HOST, async () => {
  const { port } = server.address();

  // better-sqlite3 is already proven (the factory built + opened the DB above).
  // Probe node-pty lazily — it is only used by the Codex PTY routes, so it does
  // not block boot, but we still want to know whether its ABI rebuild took.
  let nodePty = 'not-loaded';
  try {
    await import('node-pty');
    nodePty = 'loaded';
  } catch (err) {
    nodePty = `FAILED: ${err?.message || err}`;
  }

  send({
    type: 'listening',
    port,
    native: { betterSqlite3: 'loaded (app build ok)', nodePty },
  });
});

server.on('error', (err) => {
  send({ type: 'fatal', stage: 'listen', error: err?.stack || String(err) });
  process.exit(1);
});

// Graceful shutdown on request from main: close the SQLite handle, stop the
// server, then exit. (Electron also tears down utilityProcess children when the
// main process exits, so this is belt-and-suspenders.)
process.parentPort?.on('message', (e) => {
  const data = e?.data ?? e;
  if (data?.type === 'shutdown') {
    try {
      poeticsApp.locals?.db?.close?.();
    } catch {
      /* ignore */
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref?.();
  }
});
