// desktop/main.js
//
// Electron MAIN process for the Phase-0 equivalence spike.
//
// What it proves (see ELECTRON-DESKTOP-APP-PLAN.md §15, Phase 0):
//   1. The existing Express app boots inside Electron's runtime, with native
//      modules (better-sqlite3, node-pty) rebuilt for Electron's ABI.
//   2. main forks the server in a utilityProcess, awaits a port handshake, and
//      points a BrowserWindow at http://127.0.0.1:<ephemeral-port>.
//   3. Writable data (SQLite DB + logs) is relocated into app.getPath('userData')
//      via the EVAL_DB_PATH / EVAL_LOGS_DIR seams — nothing writes to the repo.
//   4. SSE streams and the real UI render over loopback.
//
// Two modes:
//   • `npm run desktop:dev`   → opens a visible window at the home route.
//   • `npm run desktop:smoke` → runs an automated check battery, prints a
//                               PASS/FAIL report, and exits 0/1 (no GUI needed).

import { app, BrowserWindow, utilityProcess, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_ENTRY = path.join(__dirname, 'server-entry.mjs');

const SMOKE = process.env.MS_DESKTOP_SMOKE === '1';
const HOME_ROUTE = process.env.MS_HOME || '/browse'; // poetics scriptorium home

let serverChild = null;

// --- Writable-data relocation: the seam that lets a packaged app run cleanly ---
// (Phase 1 will extend this to exports/ + resource root; the spike does DB+logs.)
function resolveServerEnv() {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');
  const logsDir = path.join(userData, 'logs');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
  return {
    ...process.env,
    EVAL_DB_PATH: process.env.EVAL_DB_PATH || path.join(dataDir, 'evaluations.db'),
    EVAL_LOGS_DIR: process.env.EVAL_LOGS_DIR || logsDir,
    MS_APP_ROOT: REPO_ROOT,
  };
}

// --- Fork the server child and await its { type:'listening', port } handshake ---
function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(SERVER_ENTRY, [], { env, stdio: 'pipe' });
    serverChild = child;

    const timeout = setTimeout(() => reject(new Error('server boot timed out after 30s')), 30_000);

    child.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
    child.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`));

    child.on('message', (msg) => {
      if (msg?.type === 'listening') {
        clearTimeout(timeout);
        resolve(msg);
      } else if (msg?.type === 'fatal') {
        clearTimeout(timeout);
        reject(new Error(`server fatal at "${msg.stage}":\n${msg.error}`));
      }
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`server process exited early (code ${code})`));
    });
  });
}

function stopServer() {
  if (!serverChild) return;
  try {
    serverChild.postMessage({ type: 'shutdown' });
  } catch {
    /* ignore */
  }
  const child = serverChild;
  setTimeout(() => {
    try {
      child?.kill();
    } catch {
      /* ignore */
    }
  }, 1500);
  serverChild = null;
}

// --- Smoke helpers -----------------------------------------------------------
async function httpGet(base, p) {
  const res = await fetch(base + p);
  const text = await res.text();
  return { status: res.status, text };
}

async function checkSse(base) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(base + '/__smoke/sse', { signal: ctrl.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      if ((buf.match(/data:/g) || []).length >= 3) {
        await reader.cancel();
        break;
      }
    }
    return (buf.match(/data:/g) || []).length >= 3;
  } finally {
    clearTimeout(timer);
  }
}

async function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function runSmoke(base, native) {
  const results = [];
  const rec = (name, ok, info) => results.push({ name, ok, info });

  const health = await httpGet(base, '/healthz');
  rec('GET /healthz', health.status === 200 && /ok/.test(health.text), `status=${health.status}`);

  const browse = await httpGet(base, '/browse');
  rec(
    'GET /browse  (poetics scriptorium home)',
    browse.status === 200 && /<\/html>/i.test(browse.text),
    `status=${browse.status} bytes=${browse.text.length}`,
  );

  const chat = await httpGet(base, '/chat/');
  rec(
    'GET /chat/  (static UI surface via mountEvalSurfaces)',
    chat.status === 200 && /<\/html>/i.test(chat.text),
    `status=${chat.status}`,
  );

  const runs = await httpGet(base, '/api/eval/runs');
  rec('GET /api/eval/runs  (SQLite query via better-sqlite3)', runs.status === 200, `status=${runs.status}`);

  let sseOk = false;
  try {
    sseOk = await checkSse(base);
  } catch {
    sseOk = false;
  }
  rec('SSE /__smoke/sse  (event-stream over loopback)', sseOk, sseOk ? '3 events received' : 'no stream');

  rec('native: better-sqlite3', String(native.betterSqlite3).startsWith('loaded'), native.betterSqlite3);
  rec('native: node-pty', String(native.nodePty).startsWith('loaded'), native.nodePty);

  // Renderer proof: load the home route in a hidden BrowserWindow.
  let rendererOk = false;
  let rendererInfo = '';
  try {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    await withTimeout(win.loadURL(base + HOME_ROUTE), 10_000, 'renderer load');
    const title = await win.webContents.executeJavaScript('document.title');
    rendererOk = true;
    rendererInfo = `loaded ${HOME_ROUTE}, document.title=${JSON.stringify(title)}`;
    win.destroy();
  } catch (e) {
    rendererInfo = String(e?.message || e);
  }
  rec('renderer  loadURL(home) in BrowserWindow', rendererOk, rendererInfo);

  return results;
}

// --- App lifecycle -----------------------------------------------------------
app.whenReady().then(async () => {
  const env = resolveServerEnv();

  let info;
  try {
    info = await startServer(env);
  } catch (err) {
    console.error('\n[spike] SERVER FAILED TO BOOT:\n' + (err.stack || err.message) + '\n');
    if (SMOKE) {
      app.exit(1);
    }
    return;
  }

  const base = `http://127.0.0.1:${info.port}`;
  console.log(`[spike] server listening at ${base}  (DB: ${env.EVAL_DB_PATH})`);

  // --- Screenshot mode: capture the real surfaces offscreen to PNG artifacts. ---
  if (process.env.MS_DESKTOP_SHOTS === '1') {
    const outDir = path.join(__dirname, 'spike-shots');
    fs.mkdirSync(outDir, { recursive: true });
    const surfaces = [
      ['browse', '/browse'],
      ['chat', '/chat/'],
      ['pilot', '/pilot/'],
      ['compose', '/compose'],
    ];
    const win = new BrowserWindow({
      width: 1440,
      height: 920,
      show: false,
      paintWhenInitiallyHidden: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    for (const [name, route] of surfaces) {
      try {
        await withTimeout(win.loadURL(base + route), 12_000, `load ${route}`);
        await new Promise((r) => setTimeout(r, 900)); // let fonts + Alpine paint
        const img = await win.webContents.capturePage();
        const file = path.join(outDir, `${name}.png`);
        fs.writeFileSync(file, img.toPNG());
        const { width, height } = img.getSize();
        console.log(`[spike] shot: ${file} (${width}x${height})`);
      } catch (e) {
        console.log(`[spike] shot FAILED ${route}: ${String(e?.message || e)}`);
      }
    }
    win.destroy();
    stopServer();
    app.exit(0);
    return;
  }

  if (SMOKE) {
    const results = await runSmoke(base, info.native || {});
    const pass = results.filter((r) => r.ok).length;
    const total = results.length;
    console.log('\n==================== PHASE 0 SPIKE SMOKE ====================');
    for (const r of results) {
      console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.info ? `\n          ↳ ${r.info}` : ''}`);
    }
    console.log('------------------------------------------------------------');
    console.log(`  ${pass}/${total} checks passed`);
    console.log('============================================================\n');
    stopServer();
    app.exit(pass === total ? 0 : 1);
    return;
  }

  // --- Dev mode: open a visible window at the home route. ---
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    title: 'Machine Spirits — Desktop (Phase 0 spike)',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // External links → system browser; keep in-app navigation on loopback only.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(base)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(base)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  await win.loadURL(base + HOME_ROUTE);
});

app.on('before-quit', stopServer);
app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});
