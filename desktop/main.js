// desktop/main.js
//
// Electron MAIN process.
//
// Architecture (see ELECTRON-DESKTOP-APP-PLAN.md): the renderer is the unchanged
// web UI. main relocates writable data into userData, forks the existing Express
// app in a utilityProcess on an ephemeral loopback port, awaits a port
// handshake, and points a BrowserWindow at it. External links open in the system
// browser; in-app navigation is confined to the loopback origin.
//
// Modes:
//   • `npm run desktop:dev`   → visible window at the home route.
//   • `npm run desktop:smoke` → headless PASS/FAIL battery, exits 0/1.
//   • `MS_DESKTOP_SHOTS=1 …`  → capture PNGs of the surfaces, then exit.

import { app, BrowserWindow, utilityProcess, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolvePaths, serverEnv } from './paths.js';

// Set the app identity BEFORE any getPath('userData') call so the writable data
// dir is "Machine Spirits", not Electron's generic default.
app.setName('Machine Spirits');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_ENTRY = path.join(__dirname, 'server-entry.mjs');

const SMOKE = process.env.MS_DESKTOP_SMOKE === '1';
const SHOTS = process.env.MS_DESKTOP_SHOTS === '1';
const HOME_ROUTE = process.env.MS_HOME || '/browse'; // poetics scriptorium home

let serverChild = null;

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
  const child = serverChild;
  serverChild = null;
  try {
    child.postMessage({ type: 'shutdown' });
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    try {
      child?.kill();
    } catch {
      /* ignore */
    }
  }, 1500);
}

// --- Smoke / shots helpers ---------------------------------------------------
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

async function captureShots(base) {
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
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  for (const [name, route] of surfaces) {
    try {
      await withTimeout(win.loadURL(base + route), 12_000, `load ${route}`);
      await new Promise((r) => setTimeout(r, 900)); // let fonts + Alpine paint
      const img = await win.webContents.capturePage();
      const file = path.join(outDir, `${name}.png`);
      fs.writeFileSync(file, img.toPNG());
      const { width, height } = img.getSize();
      console.log(`[shots] ${file} (${width}x${height})`);
    } catch (e) {
      console.log(`[shots] FAILED ${route}: ${String(e?.message || e)}`);
    }
  }
  win.destroy();
}

function openWindow(base) {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    title: 'Machine Spirits — Desktop',
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
  return win.loadURL(base + HOME_ROUTE).then(() => win);
}

// --- App lifecycle -----------------------------------------------------------
app.whenReady().then(async () => {
  const paths = resolvePaths(app, REPO_ROOT);
  const env = serverEnv(paths);

  let info;
  try {
    info = await startServer(env);
  } catch (err) {
    console.error('\n[desktop] SERVER FAILED TO BOOT:\n' + (err.stack || err.message) + '\n');
    if (SMOKE || SHOTS) app.exit(1);
    return;
  }

  const base = `http://127.0.0.1:${info.port}`;
  console.log(`[desktop] server listening at ${base}`);
  console.log(`[desktop] userData: ${paths.userData}`);
  console.log(`[desktop] db: ${paths.dbPath}`);

  if (SHOTS) {
    await captureShots(base);
    stopServer();
    app.exit(0);
    return;
  }

  if (SMOKE) {
    const results = await runSmoke(base, info.native || {});
    const pass = results.filter((r) => r.ok).length;
    const total = results.length;
    console.log('\n==================== DESKTOP SMOKE ====================');
    for (const r of results) {
      console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.info ? `\n          ↳ ${r.info}` : ''}`);
    }
    console.log('------------------------------------------------------');
    console.log(`  ${pass}/${total} checks passed`);
    console.log('======================================================\n');
    stopServer();
    app.exit(pass === total ? 0 : 1);
    return;
  }

  await openWindow(base);
});

app.on('before-quit', stopServer);
app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // (dev convenience) re-open is handled by relaunching; spike keeps it simple.
  }
});
