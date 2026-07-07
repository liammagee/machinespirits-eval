// desktop/main.js
//
// Electron MAIN process — the native shell around the unchanged web stack.
//
// The renderer is the existing web UI, loaded over loopback from the embedded
// Express app (forked into a utilityProcess). main owns: writable-data
// relocation, the server handshake, the application menu, window-state, a
// content-security policy, navigation confinement, single-instance, OS-keychain
// API-key storage, an optional loopback auth token, and graceful shutdown.
//
// Modes: `npm run desktop:dev` (window) · `desktop:smoke` (headless battery) ·
// `MS_DESKTOP_SHOTS=1` (screenshot capture).
//
// Env switches: MS_HOME (home route), MS_DESKTOP_NO_CSP=1 (disable CSP),
// MS_DESKTOP_TOKEN=1 (enable the per-launch loopback auth token).

import { app, BrowserWindow, utilityProcess, shell, Menu, session, dialog, safeStorage, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolvePaths, serverEnv } from './paths.js';
import { buildMenuTemplate, parseNavHtml } from './menu.js';
import { loadWindowState, saveWindowState } from './windowState.js';
import { buildCSP, shouldOpenExternally, loopbackAuthHeaders, basicAuthHeader } from './security.js';
import { createCredentialStore } from './credentials.js';

app.setName('Scriptorium');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_ENTRY = path.join(__dirname, 'server-entry.mjs');

const SMOKE = process.env.MS_DESKTOP_SMOKE === '1';
const SHOTS = process.env.MS_DESKTOP_SHOTS === '1';
const HEADLESS = SMOKE || SHOTS;
const HOME_ROUTE = process.env.MS_HOME || '/browse';
const DEFAULT_BOUNDS = { width: 1440, height: 920 };

// Per-launch loopback token (opt-in). Fences other local processes off the
// metered API: the server enforces these creds, the renderer's requests carry
// them (injected only for the loopback origin), nobody else has them.
const authToken =
  process.env.MS_DESKTOP_TOKEN === '1'
    ? { user: 'desktop-' + crypto.randomBytes(4).toString('hex'), pass: crypto.randomBytes(24).toString('hex') }
    : null;

let serverChild = null;
let mainWin = null;
let loopbackBase = null;
let credStore = null;

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
function buildServerEnv(paths) {
  const env = serverEnv(paths);
  // Fill in API keys from the OS keychain WITHOUT overriding shell-provided ones.
  try {
    const stored = credStore?.get() || {};
    for (const [k, v] of Object.entries(stored)) if (v && !process.env[k]) env[k] = v;
  } catch {
    /* no stored creds */
  }
  if (authToken) {
    env.MS_AUTH_USER = authToken.user;
    env.MS_AUTH_PASS = authToken.pass;
  }
  return env;
}

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

// --- Session hardening: CSP, loopback-token injection, native save dialog -----
function installSession() {
  const ses = session.defaultSession;

  if (process.env.MS_DESKTOP_NO_CSP !== '1') {
    const csp = buildCSP();
    ses.webRequest.onHeadersReceived((details, cb) => {
      cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
    });
  }

  if (authToken) {
    ses.webRequest.onBeforeSendHeaders((details, cb) => {
      const extra = loopbackAuthHeaders(authToken, details.url, loopbackBase);
      cb({ requestHeaders: { ...details.requestHeaders, ...extra } });
    });
  }

  // Native save dialog for any in-app download (export artifacts, TTS audio…).
  ses.on('will-download', (_e, item) => {
    try {
      item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
    } catch {
      /* older Electron: falls back to default download behaviour */
    }
  });
}

const authHeaders = () => (authToken ? { Authorization: basicAuthHeader(authToken.user, authToken.pass) } : {});

// --- Inline splash + error pages (data: URLs, not forked surfaces) -----------
const splashDataUrl = () =>
  'data:text/html,' +
  encodeURIComponent(
    `<!doctype html><meta charset=utf8><body style="margin:0;display:grid;place-items:center;height:100vh;font:16px -apple-system,system-ui,sans-serif;background:#f4f1ea;color:#33312e"><div style="text-align:center"><div style="font-size:20px;letter-spacing:.02em">Scriptorium</div><div style="margin-top:10px;opacity:.6">Starting the local server…</div></div></body>`,
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
    title: 'Scriptorium',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#f4f1ea',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (isMaximized) win.maximize();

  // Keep the title bar fixed to the app name (don't let the page <title> override it).
  win.setTitle('Scriptorium');
  win.on('page-title-updated', (e) => e.preventDefault());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (loopbackBase && shouldOpenExternally(url, loopbackBase)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (loopbackBase && shouldOpenExternally(url, loopbackBase)) {
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

function setupKeys() {
  const p = credStore.ensureTemplate();
  shell.openPath(p);
  dialog.showMessageBox({
    type: 'info',
    title: 'Set Up API Keys',
    message: 'Add your API keys to the file that just opened.',
    detail: `Edit ${p}, save it, then restart Scriptorium. On the next launch the keys are encrypted into your OS keychain and the plaintext file is deleted.`,
    buttons: ['OK'],
  });
}

function clearKeys() {
  const choice = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['Cancel', 'Clear'],
    defaultId: 0,
    cancelId: 0,
    message: 'Clear stored API keys?',
    detail: 'This removes the encrypted keys from this app. You can add them again later.',
  });
  if (choice === 1) {
    credStore.clear();
    dialog.showMessageBox({ message: 'Stored API keys cleared. Restart to apply.', buttons: ['OK'] });
  }
}

function buildAppMenu(navItems = []) {
  const actions = {
    openDataFolder: () => shell.openPath(app.getPath('userData')),
    goHome: () => mainWin && loopbackBase && mainWin.loadURL(loopbackBase + HOME_ROUTE),
    navigate: (route) => mainWin && loopbackBase && mainWin.loadURL(loopbackBase + route),
    setupKeys,
    clearKeys,
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate({ actions, appName: 'Scriptorium', navItems })));
}

// Derive the native "Go" menu from the SAME nav source as the in-page rail
// (/_nav.html is railHtml's bare mode, generated from the NAV array). One
// definition → both menus, no duplicate list.
async function fetchNavItems(base) {
  try {
    const res = await fetch(base + '/_nav.html', { headers: authHeaders() });
    if (!res.ok) return [];
    return parseNavHtml(await res.text());
  } catch {
    return [];
  }
}

// --- Headless helpers (smoke / shots) ----------------------------------------
async function httpGet(base, p) {
  const res = await fetch(base + p, { headers: authHeaders() });
  return { status: res.status, text: await res.text() };
}

async function checkSse(base) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(base + '/__smoke/sse', { signal: ctrl.signal, headers: authHeaders() });
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

async function checkRenderAndCsp(base) {
  const violations = [];
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.on('console-message', (_e, _level, message) => {
    if (/content security policy|refused to (load|execute|apply|connect|run)/i.test(message)) violations.push(message);
  });
  let lastTitle = '';
  try {
    for (const route of ['/browse', '/compose', '/chat/']) {
      await withTimeout(win.loadURL(base + route), 12_000, `load ${route}`);
      await new Promise((r) => setTimeout(r, 400));
      lastTitle = await win.webContents.executeJavaScript('document.title');
    }
    return { rendered: !!lastTitle, title: lastTitle, violations };
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

  // Informational (always passes): reports whether the loopback token is active.
  rec('auth: loopback token', true, authToken ? 'ON (per-launch creds enforced)' : 'OFF (loopback-only)');

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
    installSession();
    if (process.platform === 'darwin') {
      app.setAboutPanelOptions({ applicationName: 'Scriptorium', applicationVersion: app.getVersion() });
      try {
        app.dock?.setIcon(nativeImage.createFromPath(path.join(__dirname, 'icon.png')));
      } catch {
        /* dock icon is best-effort */
      }
    }

    const paths = resolvePaths(app, REPO_ROOT);
    credStore = createCredentialStore({ safeStorage, dir: paths.userData });
    const env = buildServerEnv(paths);

    if (HEADLESS) {
      let info;
      try {
        info = await startServer(env);
      } catch (err) {
        console.error('\n[desktop] SERVER FAILED TO BOOT:\n' + (err.stack || err.message) + '\n');
        app.exit(1);
        return;
      }
      loopbackBase = `http://127.0.0.1:${info.port}`;
      console.log(`[desktop] server listening at ${loopbackBase}`);
      console.log(`[desktop] userData: ${paths.userData}`);

      if (SHOTS) {
        await captureShots(loopbackBase);
        stopServer();
        app.exit(0);
        return;
      }

      const results = await runSmoke(loopbackBase, info.native || {});
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
      loopbackBase = `http://127.0.0.1:${info.port}`;
      console.log(`[desktop] server listening at ${loopbackBase}`);
      console.log(`[desktop] userData: ${paths.userData}`);
      await win.loadURL(loopbackBase + HOME_ROUTE);
      // Rebuild the menu with a native "Go" menu mirroring the shared rail.
      buildAppMenu(await fetchNavItems(loopbackBase));
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
    if (!HEADLESS && BrowserWindow.getAllWindows().length === 0 && loopbackBase) {
      const paths = resolvePaths(app, REPO_ROOT);
      const win = createMainWindow(paths);
      win.loadURL(loopbackBase + HOME_ROUTE);
    }
  });
}
