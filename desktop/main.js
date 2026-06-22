// desktop/main.js
//
// Electron MAIN process — the native shell around the unchanged web stack.
//
// The renderer is the existing web UI, loaded over loopback from the embedded
// Express app (forked into a utilityProcess). main owns: writable-data
// relocation, the server handshake, the application menu, window-state, a
// content-security policy, navigation confinement (external links → system
// browser), single-instance, and graceful shutdown.
//
// Modes: `npm run desktop:dev` (window) · `desktop:smoke` (headless battery) ·
// `MS_DESKTOP_SHOTS=1` (screenshot capture).

import { app, BrowserWindow, utilityProcess, shell, Menu, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolvePaths, serverEnv } from './paths.js';
import { buildMenuTemplate } from './menu.js';
import { loadWindowState, saveWindowState } from './windowState.js';
import { buildCSP, shouldOpenExternally } from './security.js';

app.setName('Machine Spirits');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_ENTRY = path.join(__dirname, 'server-entry.mjs');

const SMOKE = process.env.MS_DESKTOP_SMOKE === '1';
const SHOTS = process.env.MS_DESKTOP_SHOTS === '1';
const HEADLESS = SMOKE || SHOTS;
const HOME_ROUTE = process.env.MS_HOME || '/browse';
const DEFAULT_BOUNDS = { width: 1440, height: 920 };

let serverChild = null;
let mainWin = null;
let mainBase = null;

// --- Single-instance (one process guards the SQLite file) --------------------
let hasLock = true;
if (!HEADLESS) {
  hasLock = app.requestSingleInstanceLock();
  if (!hasLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWin) {
        if (mainWin.isMinimized()) mainWin.restore();
        mainWin.focus();
      }
    });
  }
}

// --- Server child handshake --------------------------------------------------
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

// --- Session hardening: CSP for every loopback document ----------------------
function installSessionHardening() {
  if (process.env.MS_DESKTOP_NO_CSP === '1') return;
  const csp = buildCSP();
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });
}

// --- Inline splash + error pages (data: URLs, not forked surfaces) -----------
const splashDataUrl = () =>
  'data:text/html,' +
  encodeURIComponent(
    `<!doctype html><meta charset=utf8><body style="margin:0;display:grid;place-items:center;height:100vh;font:16px -apple-system,system-ui,sans-serif;background:#f4f1ea;color:#33312e"><div style="text-align:center"><div style="font-size:20px;letter-spacing:.02em">Machine Spirits</div><div style="margin-top:10px;opacity:.6">Starting the local server…</div></div></body>`,
  );

const errorDataUrl = (msg) =>
  'data:text/html,' +
  encodeURIComponent(
    `<!doctype html><meta charset=utf8><body style="margin:0;padding:40px;font:14px -apple-system,system-ui,sans-serif;background:#f4f1ea;color:#33312e"><h2>Could not start the local server</h2><pre style="white-space:pre-wrap;background:#fff;border:1px solid #ddd;padding:16px;border-radius:8px;overflow:auto">${String(msg).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</pre><p style="opacity:.7">If native modules are stale, run <code>npm run desktop:rebuild</code> in the worktree.</p></body>`,
  );

// --- Window ------------------------------------------------------------------
function createMainWindow(paths) {
  const stateFile = path.join(paths.userData, 'window-state.json');
  const { bounds, isMaximized } = loadWindowState(stateFile, DEFAULT_BOUNDS);

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    title: 'Machine Spirits',
    backgroundColor: '#f4f1ea',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (isMaximized) win.maximize();

  // External links → system browser; in-app navigation stays on loopback.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (mainBase && shouldOpenExternally(url, mainBase)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (mainBase && shouldOpenExternally(url, mainBase)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.on('close', () => {
    try {
      saveWindowState(stateFile, win.getNormalBounds(), win.isMaximized());
    } catch {
      /* ignore */
    }
  });

  win.loadURL(splashDataUrl());
  mainWin = win;
  return win;
}

function buildAppMenu() {
  const actions = {
    openDataFolder: () => shell.openPath(app.getPath('userData')),
    goHome: () => mainWin && mainBase && mainWin.loadURL(mainBase + HOME_ROUTE),
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate({ actions, appName: 'Machine Spirits' })));
}

// --- Headless helpers (smoke / shots) ----------------------------------------
async function httpGet(base, p) {
  const res = await fetch(base + p);
  return { status: res.status, text: await res.text() };
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

// Load the key surfaces in a hidden window and watch for CSP violations — proves
// the CSP we inject does not break the real pages.
async function checkRenderAndCsp(base) {
  const violations = [];
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.on('console-message', (_e, _level, message) => {
    if (/content security policy|refused to (load|execute|apply|connect|run)/i.test(message)) {
      violations.push(message);
    }
  });
  let lastTitle = '';
  try {
    for (const route of ['/browse', '/compose', '/chat/']) {
      await withTimeout(win.loadURL(base + route), 12_000, `load ${route}`);
      await new Promise((r) => setTimeout(r, 400));
      lastTitle = await win.webContents.executeJavaScript('document.title');
    }
    return { rendered: true, title: lastTitle, violations };
  } catch (e) {
    return { rendered: false, title: String(e?.message || e), violations };
  } finally {
    win.destroy();
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
  rec('GET /chat/  (static UI surface)', chat.status === 200 && /<\/html>/i.test(chat.text), `status=${chat.status}`);

  const runs = await httpGet(base, '/api/eval/runs');
  rec('GET /api/eval/runs  (SQLite query)', runs.status === 200, `status=${runs.status}`);

  let sseOk = false;
  try {
    sseOk = await checkSse(base);
  } catch {
    sseOk = false;
  }
  rec('SSE /__smoke/sse  (event-stream over loopback)', sseOk, sseOk ? '3 events received' : 'no stream');

  rec('native: better-sqlite3', String(native.betterSqlite3).startsWith('loaded'), native.betterSqlite3);
  rec('native: node-pty', String(native.nodePty).startsWith('loaded'), native.nodePty);

  const rc = await checkRenderAndCsp(base);
  rec(
    'renderer  loads browse/compose/chat',
    rc.rendered,
    rc.rendered ? `document.title=${JSON.stringify(rc.title)}` : rc.title,
  );
  rec(
    'CSP  no violations on those surfaces',
    rc.violations.length === 0,
    rc.violations.length ? rc.violations.slice(0, 3).join(' | ') : 'clean',
  );

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
      await new Promise((r) => setTimeout(r, 900));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(outDir, `${name}.png`), img.toPNG());
      const { width, height } = img.getSize();
      console.log(`[shots] ${name}.png (${width}x${height})`);
    } catch (e) {
      console.log(`[shots] FAILED ${route}: ${String(e?.message || e)}`);
    }
  }
  win.destroy();
}

// --- Lifecycle ---------------------------------------------------------------
if (hasLock) {
  app.whenReady().then(async () => {
    installSessionHardening();

    const paths = resolvePaths(app, REPO_ROOT);
    const env = serverEnv(paths);

    if (HEADLESS) {
      let info;
      try {
        info = await startServer(env);
      } catch (err) {
        console.error('\n[desktop] SERVER FAILED TO BOOT:\n' + (err.stack || err.message) + '\n');
        app.exit(1);
        return;
      }
      const base = `http://127.0.0.1:${info.port}`;
      console.log(`[desktop] server listening at ${base}`);
      console.log(`[desktop] userData: ${paths.userData}`);

      if (SHOTS) {
        await captureShots(base);
        stopServer();
        app.exit(0);
        return;
      }

      const results = await runSmoke(base, info.native || {});
      const pass = results.filter((r) => r.ok).length;
      console.log('\n==================== DESKTOP SMOKE ====================');
      for (const r of results) {
        console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.info ? `\n          ↳ ${r.info}` : ''}`);
      }
      console.log('------------------------------------------------------');
      console.log(`  ${pass}/${results.length} checks passed`);
      console.log('======================================================\n');
      stopServer();
      app.exit(pass === results.length ? 0 : 1);
      return;
    }

    // --- Normal (windowed) mode: window-first with a splash, then load app. ---
    buildAppMenu();
    const win = createMainWindow(paths);
    try {
      const info = await startServer(env);
      mainBase = `http://127.0.0.1:${info.port}`;
      console.log(`[desktop] server listening at ${mainBase}`);
      console.log(`[desktop] userData: ${paths.userData}`);
      await win.loadURL(mainBase + HOME_ROUTE);
    } catch (err) {
      console.error('[desktop] server failed:', err.message);
      win.loadURL(errorDataUrl(err.stack || err.message));
    }
  });

  app.on('before-quit', stopServer);
  app.on('window-all-closed', () => {
    stopServer();
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (!HEADLESS && BrowserWindow.getAllWindows().length === 0 && mainBase) {
      const paths = resolvePaths(app, REPO_ROOT);
      const win = createMainWindow(paths);
      win.loadURL(mainBase + HOME_ROUTE);
    }
  });
}
