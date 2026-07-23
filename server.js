/**
 * @machinespirits/eval - Standalone Server
 *
 * Runs the evaluation system as a standalone application.
 * This server provides:
 * - API endpoints for evaluation runs, results, and analysis
 * - Static file serving for the UI components
 * - Documentation serving
 *
 * Environment variables:
 *   PORT - Server port (default: 8081)
 *   STANDALONE - Set to 'true' to run in standalone mode
 *
 * Usage:
 *   STANDALONE=true node server.js
 *   # or
 *   npm start
 */

import 'dotenv/config';
import express from 'express';
import { resolveBasicAuthGuard, makeRoleGate } from './services/httpBasicAuth.js';
import { mountEvalSurfaces } from './services/evalSurfaces.js';
import { installApplicationShutdownHandlers } from './services/applicationShutdown.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

const app = express();
const PORT = Number(process.env.PORT) || 8081;
// Default to loopback. A public bind is opt-in via HOST=0.0.0.0, and the auth
// guard below refuses that bind without credentials.
const HOST = process.env.HOST || '127.0.0.1';
const isStandalone = process.env.STANDALONE === 'true';

// Basic-auth guard FIRST, before any route. Open on localhost with no creds;
// throws (refuses to start) on a public bind without creds — see services/httpBasicAuth.js.
const authGuard = resolveBasicAuthGuard({ prefix: 'EVAL', host: HOST, realm: 'machine spirits eval' });
if (authGuard) {
  app.use(authGuard);
  console.log('[EvalServer] basic-auth ENABLED (credentials required)');
}
// Default-deny role gate (Design A — perimeter RBAC). No-op on localhost-open
// and for the admin role; restricts a 'participant' credential to the pilot +
// adjudication allowlist (see services/httpBasicAuth.js PARTICIPANT_ALLOWLIST).
app.use(makeRoleGate());

// Middleware
app.use(express.json());

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.log('[EvalServer] Created data directory');
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    package: '@machinespirits/eval',
    version: pkg.version,
    mode: isStandalone ? 'standalone' : 'mounted',
  });
});

// Static eval surfaces optionally ask the poetics dashboard for its nav rail.
// The standalone eval server does not own that chrome, so return an empty
// fragment instead of a noisy 404. The poetics app provides the real route.
app.get('/_nav.html', (_req, res) => {
  res.type('html').send('');
});

// API routers + static UI surfaces (the shared /api/* routers and the public/
// UI dirs) are defined once in services/evalSurfaces.js and shared with the
// poetics browser (scripts/browse-poetics-scripts.js), so the eval route-set
// can't drift between the two servers. Auth, JSON parsing, the health check,
// the standalone '/', and listen() stay here — this app owns those.
mountEvalSurfaces(app, { root: __dirname });

// In standalone mode, serve a basic UI
if (isStandalone) {
  // The landing links the shared design system (/components/techne.css — the
  // same paper/ink tokens, type, and theming the poetics scriptorium renders)
  // so the standalone server stops being a styled island. Page-specific layout
  // (hero / stat strip / card grid) is inlined on top of those tokens, the same
  // way the scriptorium home does. The scriptorium's nav rail is deliberately
  // NOT reused: its links target poetics-only routes this server doesn't mount.
  app.get('/', (req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>machine spirits · eval</title>
<link rel="stylesheet" href="/components/techne.css">
<style>
.wrap{ width:min(1080px, calc(100vw - 40px)); margin:0 auto; }
.bar{ display:flex; align-items:center; gap:14px; padding:14px 0 12px; border-bottom:1px solid var(--rule); }
.bar .glyph{ color:var(--brick); font-size:1.15em; line-height:1; animation:railspin 32s linear infinite; }
@keyframes railspin{ to{ transform:rotate(360deg); } }
.bar .wordmark{ font-family:"Fraunces",Georgia,serif; font-style:italic; font-variation-settings:"SOFT" 50,"WONK" 1,"opsz" 96; font-size:16px; color:var(--ink); }
.bar .tag{ font-family:"JetBrains Mono",monospace; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-4); }
.bar .spacer{ flex:1; }
.bar .toggle{ min-height:0; padding:5px 11px; font-size:11px; }
.hero{ padding:42px 0 6px; }
.hero .k{ font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-4); }
.hero h1{ margin:10px 0 12px; font-style:italic; font-size:clamp(1.9rem,1.3rem + 2vw,2.8rem); line-height:1.03; }
.hero p{ margin:0; font-size:16px; color:var(--ink-2); max-width:68ch; }
.stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--rule); border:1px solid var(--rule); margin:28px 0 8px; }
@media(max-width:620px){ .stats{ grid-template-columns:repeat(2,1fr); } }
.stat{ background:var(--paper-4); padding:14px 14px; }
.stat .n{ font-family:"Fraunces",Georgia,serif; font-weight:600; font-size:21px; color:var(--moss-deep); line-height:1; }
.stat .l{ font-family:"JetBrains Mono",monospace; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-4); margin-top:8px; }
h2.section{ font-family:"JetBrains Mono",monospace; font-weight:600; font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); margin:42px 0 4px; }
.section-sub{ color:var(--ink-4); margin:0 0 16px; font-size:13px; max-width:74ch; }
.grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(248px,1fr)); gap:13px; }
a.card{ display:block; text-decoration:none; border-top:3px solid var(--ink-4); transition:background .12s var(--ease), border-color .12s var(--ease); }
a.card:hover{ background:color-mix(in srgb, var(--moss-soft) 32%, var(--paper-4)); }
a.card.moss{ border-top-color:var(--moss); }
a.card.ochre{ border-top-color:var(--ochre); }
a.card.indigo{ border-top-color:var(--indigo); }
a.card .t{ font-family:-apple-system,system-ui,sans-serif; font-weight:600; font-size:14px; color:var(--ink); }
a.card .d{ color:var(--ink-3); font-size:12.5px; margin:5px 0 10px; line-height:1.45; }
a.card .cta{ font-family:"JetBrains Mono",monospace; font-size:11px; color:var(--moss-deep); }
.api{ border:1px solid var(--rule); background:var(--paper-3); }
.api .row{ display:flex; align-items:baseline; gap:12px; padding:10px 14px; border-bottom:1px solid var(--rule-soft); }
.api .row:last-child{ border-bottom:0; }
.api .m{ font-family:"JetBrains Mono",monospace; font-size:10px; font-weight:600; letter-spacing:.06em; padding:2px 7px; border:1px solid var(--rule); color:var(--ink-3); flex:0 0 auto; }
.api .m.get{ color:var(--moss-deep); border-color:color-mix(in srgb, var(--moss) 50%, var(--rule)); }
.api .m.post{ color:var(--ochre-d); border-color:color-mix(in srgb, var(--ochre) 50%, var(--rule)); }
.api .p{ font-family:"JetBrains Mono",monospace; font-size:12.5px; color:var(--ink); }
.api .dsc{ color:var(--ink-4); font-size:12px; margin-left:auto; text-align:right; }
@media(max-width:620px){ .api .dsc{ display:none; } }
.foot{ margin:38px 0 60px; color:var(--ink-4); font-family:"JetBrains Mono",monospace; font-size:11px; }
.foot a{ color:var(--ink-3); }
</style>
</head>
<body>
<div class="wrap">
  <div class="bar">
    <span class="glyph" aria-hidden="true">◐</span>
    <span class="wordmark">machine spirits</span>
    <span class="tag">eval · standalone</span>
    <span class="spacer"></span>
    <button class="btn toggle" id="themeToggle" type="button">theme</button>
  </div>

  <header class="hero">
    <div class="k">evaluation server</div>
    <h1>Machine Spirits Eval</h1>
    <p>The tutoring-evaluation system, running standalone — interactive tutor surfaces, the human-learner pilot, blinded adjudication, and the eval API, all from one process.</p>
  </header>

  <div class="stats">
    <div class="stat"><div class="n">v${pkg.version}</div><div class="l">package</div></div>
    <div class="stat"><div class="n">standalone</div><div class="l">mode</div></div>
    <div class="stat"><div class="n">5</div><div class="l">api routers</div></div>
    <div class="stat"><div class="n">SQLite</div><div class="l">store</div></div>
  </div>

  <h2 class="section">Interactive</h2>
  <p class="section-sub">Hands-on surfaces — play a role, run a session, code a transcript.</p>
  <div class="grid">
    <a class="card panel moss" href="/tutor">
      <div class="t">Tutor studio</div>
      <div class="d">Start or resume a safe tutor-stub lab through the shared browser and desktop session surface.</div>
      <div class="cta">/tutor →</div>
    </a>
    <a class="card panel moss" href="/tutor?mode=research">
      <div class="t">Tutor research lab</div>
      <div class="d">Explore supported cells from <code>tutor-agents.yaml</code> and inspect the ego / superego deliberation through the shared session protocol.</div>
      <div class="cta">/tutor?mode=research →</div>
    </a>
    <a class="card panel indigo" href="/pilot">
      <div class="t">Learner pilot</div>
      <div class="d">The participant flow: enrol → consent → pretest → tutoring → posttest → exit survey.</div>
      <div class="cta">/pilot →</div>
    </a>
    <a class="card panel ochre" href="/adjudication">
      <div class="t">A19 adjudication</div>
      <div class="d">Complete blinded human-adjudication coding forms through the dashboard.</div>
      <div class="cta">/adjudication →</div>
    </a>
    <a class="card panel indigo" href="/human-coding-admin">
      <div class="t">Labelling game</div>
      <div class="d">Label the blinded superego taxonomy or tutor-stub impasse corpus with dataset-specific guidance and per-rater files.</div>
      <div class="cta">/human-coding-admin →</div>
    </a>
    <a class="card panel" href="/pilot-admin">
      <div class="t">Pilot admin</div>
      <div class="d">Operator dashboard for pilot sessions — token-gated.</div>
      <div class="cta">/pilot-admin →</div>
    </a>
  </div>

  <h2 class="section">Reference</h2>
  <div class="grid">
    <a class="card panel moss" href="/health">
      <div class="t">Health</div>
      <div class="d">Service status, package version, and run mode as JSON — the liveness probe.</div>
      <div class="cta">/health →</div>
    </a>
  </div>

  <h2 class="section">Eval API</h2>
  <p class="section-sub">Mounted under <code>/api/eval</code> · also live: <code>/api/tutor-stub</code>, the compatibility <code>/api/chat</code> catalogue, <code>/api/pilot</code>, <code>/api/a19/adjudication</code>, and <code>/api/human-coding</code>.</p>
  <div class="api">
    <div class="row"><span class="m get">GET</span><span class="p">/api/eval/scenarios</span><span class="dsc">list evaluation scenarios</span></div>
    <div class="row"><span class="m get">GET</span><span class="p">/api/eval/profiles</span><span class="dsc">list tutor profiles</span></div>
    <div class="row"><span class="m get">GET</span><span class="p">/api/eval/runs</span><span class="dsc">list evaluation runs</span></div>
    <div class="row"><span class="m get">GET</span><span class="p">/api/eval/runs/:id</span><span class="dsc">run detail</span></div>
    <div class="row"><span class="m post">POST</span><span class="p">/api/eval/quick</span><span class="dsc">run a quick evaluation</span></div>
  </div>

  <div class="foot">machine spirits · eval · v${pkg.version} — <a href="/health">/health</a></div>
</div>
<script>
(function(){
  var KEY='ms-theme', root=document.documentElement, saved=null;
  try{ saved=localStorage.getItem(KEY); }catch(e){}
  if(saved){ root.setAttribute('data-theme', saved); }
  var btn=document.getElementById('themeToggle');
  if(btn){ btn.addEventListener('click', function(){
    var next = root.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try{ localStorage.setItem(KEY, next); }catch(e){}
  }); }
})();
</script>
</body>
</html>`);
  });
}

// Error handler
app.use((err, req, res, _next) => {
  console.error('[EvalServer] Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

export function startEvalServer() {
  const server = app.listen(PORT, HOST, () => {
    console.log(`[EvalServer] Machine Spirits Eval running at http://${HOST}:${PORT}`);
    console.log(`[EvalServer] Mode: ${isStandalone ? 'standalone' : 'mounted'}`);
    console.log(`[EvalServer] API: http://${HOST}:${PORT}/api/eval`);
    console.log(`[EvalServer] Tutor: http://${HOST}:${PORT}/tutor`);
  });
  const shutdown = installApplicationShutdownHandlers({ app, server });
  server.once('close', shutdown.dispose);
  return server;
}

// Start server and install signal handling only for the executable entry point.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startEvalServer();
}

export { app };
