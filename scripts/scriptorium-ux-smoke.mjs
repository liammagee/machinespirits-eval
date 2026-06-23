#!/usr/bin/env electron
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'scripts', 'browse-poetics-scripts.js');
const DEFAULT_ROUTES = [
  '/',
  '/browse',
  '/derivation',
  '/replays',
  '/compose/live',
  '/runs',
  '/board',
  '/chat/',
  '/adjudication/',
  '/pilot-admin/',
];
const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

function parseArgs(argv) {
  const args = {
    host: '127.0.0.1',
    port: Number(process.env.POETICS_PORT || 3466),
    base: '',
    out: path.join(ROOT, 'outputs', 'scriptorium-ux-smoke'),
    start: true,
    routes: DEFAULT_ROUTES,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--base') args.base = argv[++i] || '';
    else if (token === '--host') args.host = argv[++i] || args.host;
    else if (token === '--port') args.port = Number(argv[++i] || args.port);
    else if (token === '--out') args.out = path.resolve(argv[++i] || args.out);
    else if (token === '--no-start') args.start = false;
    else if (token === '--routes') args.routes = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`unknown arg: ${token}`);
  }
  if (!args.base) args.base = `http://${args.host}:${args.port}`;
  return args;
}

function usage() {
  return `Usage: electron scripts/scriptorium-ux-smoke.mjs [--port 3466] [--no-start] [--base URL] [--routes /,/browse] [--out outputs/scriptorium-ux-smoke]`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(base, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base + '/', { redirect: 'manual' });
      if (response.status >= 200 && response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`server did not become ready at ${base}: ${lastError?.message || 'timeout'}`);
}

function startServer(args) {
  const runtime = process.env.SCRIPTORIUM_UX_SMOKE_SERVER_RUNTIME === 'electron' ? 'electron' : 'node';
  const command = runtime === 'electron' ? process.execPath : process.env.NODE_BINARY || 'node';
  const child = spawn(command, [SERVER, '--port', String(args.port), '--host', args.host, '--no-open'], {
    cwd: ROOT,
    env: { ...process.env, ...(runtime === 'electron' ? { ELECTRON_RUN_AS_NODE: '1' } : {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

function slug(route, viewport) {
  const r = route === '/' ? 'home' : route.replace(/^\/+|\/+$/g, '').replace(/[^A-Za-z0-9]+/g, '-');
  return `${r || 'home'}-${viewport}.png`;
}

function htmlReport(results) {
  const rows = results.map((r) => {
    const issues = [
      ...r.consoleErrors.map((x) => `console: ${x}`),
      ...r.unlabeled.map((x) => `unlabeled: ${x}`),
      ...r.smallTargets.map((x) => `small target: ${x}`),
      ...(r.overflow ? [`overflow: document ${r.docWidth}px > viewport ${r.viewport.width}px`] : []),
      ...r.duplicateLandmarks.map((x) => `duplicate landmark: ${x}`),
    ];
    return `<tr class="${issues.length ? 'bad' : 'ok'}"><td>${r.route}</td><td>${r.viewport.name}</td><td>${r.status}</td><td>${issues.length ? issues.map((x) => `<div>${escapeHtml(x)}</div>`).join('') : 'pass'}</td><td><a href="${path.basename(r.screenshot)}">screenshot</a></td></tr>`;
  }).join('\n');
  return `<!doctype html><meta charset="utf-8"><title>Scriptorium UX smoke</title><style>body{font:14px system-ui;margin:24px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}.bad{background:#fff1ee}.ok{background:#f3fbf0}code{font-family:ui-monospace,monospace}</style><h1>Scriptorium UX smoke</h1><table><thead><tr><th>route</th><th>viewport</th><th>HTTP</th><th>issues</th><th>shot</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function pageStatus(url) {
  const response = await fetch(url, { redirect: 'manual' });
  return response.status;
}

async function auditRoute(win, base, route, viewport, outDir) {
  const url = new URL(route, base).toString();
  const consoleErrors = [];
  const onConsole = (_event, level, message) => {
    if (
      level >= 2 &&
      !/Failed to load resource.*favicon/i.test(message) &&
      !/Electron Security Warning/i.test(message)
    ) {
      consoleErrors.push(message);
    }
  };
  win.webContents.on('console-message', onConsole);
  win.setSize(viewport.width, viewport.height);
  const domReady = new Promise((resolve) => win.webContents.once('dom-ready', resolve));
  const loadFailed = new Promise((resolve) =>
    win.webContents.once('did-fail-load', (_event, code, description) => resolve(new Error(`${code} ${description}`))),
  );
  const loadTimeout = sleep(8000).then(() => new Error('dom-ready timeout'));
  win.loadURL(url).catch((error) => consoleErrors.push(error.message || String(error)));
  const loadResult = await Promise.race([domReady.then(() => null), loadFailed, loadTimeout]);
  if (loadResult instanceof Error) consoleErrors.push(loadResult.message);
  await sleep(250);
  const metrics = await win.webContents.executeJavaScript(`
(() => {
  const visible = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  };
  const text = (el) => (el && (el.innerText || el.textContent || '') || '').replace(/\\s+/g, ' ').trim();
  const byId = (id) => id ? document.getElementById(id) : null;
  const controlName = (el) => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.getAttribute('aria-labelledby')) return el.getAttribute('aria-labelledby').split(/\\s+/).map((id) => text(byId(id))).join(' ').trim();
    if (el.id) {
      const label = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (label) return text(label);
    }
    const parentLabel = el.closest('label');
    if (parentLabel) return text(parentLabel);
    if (el.title) return el.title.trim();
    return '';
  };
  const selector = 'input:not([type="hidden"]), select, textarea';
  const unlabeled = Array.from(document.querySelectorAll(selector))
    .filter((el) => visible(el) && !controlName(el))
    .map((el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.name ? '[name="' + el.name + '"]' : '')));
  const targetSelector = 'button, summary, input:not([type="hidden"]), select, textarea, a.rail__btn, a.btn, a.cmd, a.empty__btn, a.setup-action, a.goal-card, a.role-card';
  const smallTargets = window.innerWidth > 860 ? [] : Array.from(document.querySelectorAll(targetSelector))
    .filter((el) => visible(el) && !/^(checkbox|radio)$/i.test(el.type || ''))
    .map((el) => ({ el, rect: el.getBoundingClientRect(), name: controlName(el) || text(el) || el.getAttribute('href') || el.tagName.toLowerCase() }))
    .filter(({ rect }) => rect.width < 40 || rect.height < 40)
    .map(({ el, rect, name }) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' + name.slice(0, 80) + '" ' + Math.round(rect.width) + 'x' + Math.round(rect.height)));
  const landmarks = Array.from(document.querySelectorAll('header, main, nav, [role="banner"], [role="main"], [role="navigation"]'))
    .filter(visible)
    .map((el) => {
      const role = el.getAttribute('role') || (el.tagName.toLowerCase() === 'header' ? 'banner' : el.tagName.toLowerCase());
      return role + '|' + (el.getAttribute('aria-label') || text(el.querySelector('h1,h2')) || '');
    });
  const duplicates = landmarks.filter((x, i) => landmarks.indexOf(x) !== i);
  const docWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  return { docWidth, unlabeled, smallTargets, duplicateLandmarks: [...new Set(duplicates)] };
})()
`);
  const screenshot = path.join(outDir, slug(route, viewport.name));
  await win.webContents.capturePage().then((image) => fs.writeFileSync(screenshot, image.toPNG()));
  win.webContents.off('console-message', onConsole);
  return {
    route,
    viewport,
    status: await pageStatus(url),
    screenshot,
    consoleErrors,
    overflow: metrics.docWidth > viewport.width + 2,
    docWidth: metrics.docWidth,
    unlabeled: metrics.unlabeled,
    smallTargets: metrics.smallTargets,
    duplicateLandmarks: metrics.duplicateLandmarks,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) throw new Error(`invalid port: ${args.port}`);
  fs.mkdirSync(args.out, { recursive: true });
  const runDir = path.join(args.out, new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(runDir, { recursive: true });

  let server = null;
  let failed = false;
  if (args.start) server = startServer(args);
  try {
    await waitForServer(args.base);
    await app.whenReady();
    const win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setMaxListeners(64);
    const results = [];
    for (const route of args.routes) {
      for (const viewport of VIEWPORTS) {
        console.log(`audit ${route} · ${viewport.name}`);
        results.push(await auditRoute(win, args.base, route, viewport, runDir));
      }
    }
    win.destroy();
    const jsonPath = path.join(runDir, 'report.json');
    const htmlPath = path.join(runDir, 'report.html');
    fs.writeFileSync(jsonPath, JSON.stringify({ base: args.base, results }, null, 2));
    fs.writeFileSync(htmlPath, htmlReport(results));
    const failures = results.filter(
      (r) => r.status >= 400 || r.consoleErrors.length || r.overflow || r.unlabeled.length || r.smallTargets.length || r.duplicateLandmarks.length,
    );
    console.log(`scriptorium ux smoke: ${results.length - failures.length}/${results.length} checks passed`);
    console.log(`report: ${htmlPath}`);
    if (failures.length) {
      failed = true;
      for (const f of failures) {
        console.error(`${f.route} ${f.viewport.name}: ${[
          f.status >= 400 ? `HTTP ${f.status}` : '',
          f.consoleErrors.length ? `${f.consoleErrors.length} console errors` : '',
          f.overflow ? `overflow ${f.docWidth}px` : '',
          f.unlabeled.length ? `${f.unlabeled.length} unlabeled controls` : '',
          f.smallTargets.length ? `${f.smallTargets.length} small targets` : '',
          f.duplicateLandmarks.length ? `${f.duplicateLandmarks.length} duplicate landmarks` : '',
        ].filter(Boolean).join(', ')}`);
      }
      process.exitCode = 1;
    }
  } finally {
    if (server) server.kill('SIGTERM');
    await app.quit();
    if (failed) process.exit(1);
  }
}

main().catch(async (error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
  try {
    await app.quit();
  } catch {
    // ignore shutdown errors
  }
});
