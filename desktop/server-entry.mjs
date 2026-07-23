// desktop/server-entry.mjs
//
// Runs inside an Electron `utilityProcess` (Electron's own Node runtime), NOT
// the main process. It builds the desktop app via the shared factory
// (production = the unchanged web poetics superset; see appFactory.mjs), listens
// on an ephemeral loopback port, and reports the bound port + native-module
// status back to main, which then points a BrowserWindow at it.
//
// Native modules: building the app loads `better-sqlite3` and opens the DB at
// import time. If it isn't rebuilt for Electron's ABI, the build throws here and
// we report a fatal — exactly the signal Phase 0 existed to surface.

import { buildDesktopApp } from './appFactory.mjs';

const HOST = '127.0.0.1';
const SMOKE = process.env.MS_DESKTOP_SMOKE === '1';
const dbPath = process.env.EVAL_DB_PATH || undefined; // factory also falls back to EVAL_DB_PATH

function send(msg) {
  try {
    process.parentPort?.postMessage(msg);
  } catch {
    /* parentPort absent (e.g. run under plain node) — ignore */
  }
}

let app;
try {
  app = buildDesktopApp({ smoke: SMOKE, dbPath, host: HOST });
} catch (err) {
  send({ type: 'fatal', stage: 'build-app', error: err?.stack || String(err) });
  process.exit(1);
}

const server = app.listen(0, HOST, async () => {
  const { port } = server.address();
  // better-sqlite3 is proven by the app build above; probe node-pty lazily
  // (only the Codex PTY routes need it, so it does not block boot).
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

// Graceful shutdown on request from main: close the SQLite handle (which lives
// on the poetics app's locals, whether or not we wrapped it for smoke), stop the
// server, then exit.
process.parentPort?.on('message', async (e) => {
  const data = e?.data ?? e;
  if (data?.type !== 'shutdown') return;

  // Stop any in-flight jobRunner child processes so none outlive the app.
  try {
    const jobRunner = await import('../services/poetics/jobRunner.js');
    for (const job of jobRunner.listJobs?.() || []) {
      if (job?.status === 'running') {
        try {
          jobRunner.stopJob?.(job.id);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* jobRunner not loaded — nothing to stop */
  }

  try {
    (app.locals.poeticsApp || app).locals?.db?.close?.();
  } catch {
    /* ignore */
  }
  try {
    await (app.locals.poeticsApp || app).locals?.tutorStubSessionHost?.closeAll?.('desktop_shutdown');
  } catch {
    /* session child cleanup is best-effort during app shutdown */
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref?.();
});
