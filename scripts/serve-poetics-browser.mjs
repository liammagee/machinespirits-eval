#!/usr/bin/env node
/* serve-poetics-browser.mjs — the One True Way to run the poetics scriptorium.
 *
 * Problem this solves: ad-hoc `node scripts/browse-poetics-scripts.js --port NNNN`
 * invocations left several instances on different ports, so "which one has the
 * latest code?" became a live question. This launcher fixes a single canonical
 * port (3466) and is idempotent: it frees that port first (killing any stale
 * instance), then starts a fresh server on it. Re-run it any time — you always
 * land on the same URL, always running the current code.
 *
 *   npm run poetics:serve            # restart the canonical server on :3466 (foreground)
 *   npm run poetics:serve -- --port 3500   # override the canonical port
 *   POETICS_PORT=3500 npm run poetics:serve
 *
 * Host is pinned to 127.0.0.1 on purpose. The scriptorium exposes UNAUTHENTICATED
 * metered surfaces (POST /api/jobs spawns paid runs; POST /api/compose/live/turn
 * is a paid LLM call per turn) — binding it to a public interface would expose
 * those to anyone. Public exposure goes through the deploy path in DEPLOYMENT.md
 * (static snapshot, or the live server only AFTER auth lands), never this script.
 */
import { spawn, execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, 'browse-poetics-scripts.js');
const HOST = '127.0.0.1'; // never public — see header note

function parsePort() {
  const i = process.argv.indexOf('--port');
  if (i >= 0 && process.argv[i + 1]) return Number.parseInt(process.argv[i + 1], 10);
  if (process.env.POETICS_PORT) return Number.parseInt(process.env.POETICS_PORT, 10);
  return 3466; // canonical
}

const PORT = parsePort();
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`serve-poetics-browser: invalid port ${PORT}`);
  process.exit(1);
}

// Free the canonical port: find anything listening on it (macOS/Linux lsof) and
// kill it, so the restart is clean. Best-effort — if lsof is missing or nothing
// is listening, we just proceed and let the server's own EADDRINUSE surface.
function freePort(port) {
  let pids = [];
  try {
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    }).trim();
    pids = out ? out.split(/\s+/).filter(Boolean) : [];
  } catch {
    return; // lsof absent, or nothing listening (lsof exits non-zero) — fine.
  }
  const self = String(process.pid);
  for (const pid of pids) {
    if (pid === self) continue;
    try {
      execFileSync('kill', [pid]);
      console.log(`serve-poetics-browser: stopped stale instance on :${port} (pid ${pid})`);
    } catch {
      console.warn(`serve-poetics-browser: could not stop pid ${pid} on :${port}`);
    }
  }
}

freePort(PORT);

// Hand off to the real server, inheriting stdio so Ctrl-C stops it and its log
// lines (including the http://127.0.0.1:PORT URL it prints) reach the terminal.
const child = spawn(process.execPath, [SERVER, '--port', String(PORT), '--host', HOST], {
  stdio: 'inherit',
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
