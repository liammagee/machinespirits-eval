# Electron Desktop App — Technical Specification & Plan

**Status:** Draft for review
**Date:** 2026-06-22
**Branch:** `claude/electron-desktop-app`
**Worktree:** `/Users/lmagee/Dev/machinespirits/machinespirits-eval-electron`
**Author:** Claude (with Liam Magee)
**Goal:** A native desktop application that is the *exact equivalent* of the existing web UX, and that *stays in sync* with it by construction rather than by maintenance.

---

## 1. Executive summary — the one big idea

The web UI in this repo is served as **raw static HTML + Alpine.js + server-rendered HTML, with no build step**, by two Express servers that both call a single shared mounter (`services/evalSurfaces.js`). That one fact decides the entire architecture.

> **We do not re-implement the UI. We embed the existing Express app inside Electron and point a `BrowserWindow` at it over loopback.**

The Electron app becomes a thin native shell around the *unchanged* web stack. The renderer loads the same `public/*.html`, the same Alpine components, the same server-rendered pages, hitting the same `/api/*` routers over `http://127.0.0.1:<port>`. There is exactly **one** UI codebase. "Keeping web and desktop in sync" stops being a chore because there is nothing to sync — they are the same bytes.

This document specifies that shell, the seams it rides on, the small refactors that make it clean, the security/packaging story, and a phased plan with acceptance criteria.

---

## 2. Goals and non-goals

### Goals

- **G1 — Exact equivalence.** Every surface reachable in the web app is reachable, pixel- and behaviour-identical, in the desktop app: the poetics scriptorium (`/browse`, `/compose`, `/compose/live`, `/ontology`, `/rubric`, `/runs`, `/board`, `/derivation`, …), the eval admin API surfaces, the tutor playground (`/chat`), the human-learner pilot (`/pilot`, `/pilot-admin`), and the A19 adjudication forms (`/adjudication`).
- **G2 — Sync by construction.** A change to a web page or route appears in the desktop app with **zero** desktop-side edits. Divergence is prevented structurally and guarded in CI.
- **G3 — Self-contained local operation.** The app runs the whole stack locally (SQLite, dialogue logs, config, job launcher) with no deploy and no external services beyond the LLM providers it already calls.
- **G4 — Native affordances that earn the "app" label.** Menus, shortcuts, window-state persistence, native save dialogs, graceful lifecycle, OS-keychain credential storage, single-instance.
- **G5 — Streaming intact.** Server-Sent Events (SSE) for live eval/derivation/compose surfaces must work unchanged.

### Non-goals (for v1)

- **NG1 — No UI re-platforming.** No React/Vue rewrite, no renderer bundler, no component migration. (That would *create* the divergence we are trying to avoid.)
- **NG2 — No multi-user / server deployment.** This is a single-user desktop tool. The localhost-trust auth model (below) is exactly right for it.
- **NG3 — No new product features.** v1 is equivalence + native shell. New capabilities (offline queueing, richer cost dashboards) are explicitly later.
- **NG4 — No cross-platform distribution in v1.** macOS first (the dev machine). Windows/Linux are a later milestone, but nothing in the design precludes them.

---

## 3. The web UX as it exists today (grounded map)

This section is the factual baseline the spec is built on. Verified against the source on `main` @ `75d7ee3b`.

### 3.1 Two servers, one shared mount

| Server | Port (web) | Host | Launch | Entry |
|---|---|---|---|---|
| Eval (standalone) | `8081` | `127.0.0.1` | `npm start` / `npm run dev` | `server.js` |
| Poetics scriptorium | `3466` | `127.0.0.1` (pinned) | `npm run poetics:serve` | `scripts/serve-poetics-browser.mjs` → `scripts/browse-poetics-scripts.js` |

Both call **`mountEvalSurfaces(app, { root })`** (`services/evalSurfaces.js`). The poetics server is a **strict superset**: it pre-mounts `/docs/research`, calls `mountEvalSurfaces` (browse-poetics-scripts.js:1566), then adds the poetics-only routes and static dirs. **Booting the poetics app therefore exposes every surface in one process.** This is the app the desktop shell will embed.

`mountEvalSurfaces` deliberately owns *only* the routers + static dirs; the **host** owns auth, `express.json()`, the health check, the catch-all `/`, the error handler, and `listen()`. Its header comment states the governing philosophy verbatim: *"defined ONCE here … one definition, no divergence."* The desktop shell adopts the same contract — it is just another host.

### 3.2 Shared mounts (`mountEvalSurfaces`)

**API routers:**

| Mount | File | Purpose |
|---|---|---|
| `/api/eval` | `routes/evalRoutes.js` | runs, scenarios, profiles, logs, prompts, monitoring, SSE streams, Codex PTY sessions |
| `/api/chat` | `routes/chatRoutes.js` | tutor cells, persona resolution, learner-turn / tutor-turn generation (**metered**) |
| `/api/pilot` | `routes/pilotRoutes.js` | participant enrol→consent→pretest→tutoring→posttest→exit + token-gated admin |
| `/api/a19/adjudication` | `routes/a19AdjudicationRoutes.js` | blinded human-coder assignments, drafts, submissions, panel |

**Static UI surfaces:** `/chat`, `/pilot`, `/pilot-admin`, `/adjudication`, `/eval`, `/components` (shared `techne.css` design system), `/docs`. Each is `existsSync`-guarded — a missing directory is a silent skip, not a crash (relevant for packaging).

**Poetics-only surfaces** (added by `browse-poetics-scripts.js`, `:3466` only): page routes `/browse`, `/compose`, `/compose/live`, `/ontology`, `/rubric`, `/curriculum`, `/replays`, `/runs`, `/board`, `/arc`, `/story`, `/repertoire`, `/derivation`; JSON/SSE APIs under `/api/runs`, `/api/items`, `/api/compose/*`, `/api/jobs/*`, `/api/derivation/live/*`, etc.

### 3.3 Front-end stack

- **Vanilla HTML + vanilla JS + Alpine.js 3.x**, plus **server-rendered HTML** for the poetics pages (`renderBrowserHtml()`, `renderComposeHtml()`, …). CDN libs (KaTeX, marked.js, Google Fonts).
- **No bundler, no build step, no asset hashing.** Assets are served raw from `public/`.
- **Shared design system:** `public/components/techne.css` + `rail-inject.js` nav, used by every surface.

> This is the load-bearing fact for the whole port: **the front-end ports for free if and only if we keep serving it the same way.**

### 3.4 Data backends

| Backend | Path | Override seam |
|---|---|---|
| SQLite (eval + poetics sidecar tables) | `data/evaluations.db` | **`EVAL_DB_PATH`** (evaluationStore.js:62) |
| Dialogue logs | `logs/` | **`EVAL_LOGS_DIR`** (evaluationStore.js:59; adaptiveTutor/persistence.js:26) |
| Config (read-only) | `config/*.yaml` | repo-relative |
| Artifacts / reports | `exports/`, `notes/poetics/`, `public/eval/generated/` | repo-relative |
| Content packages | `content-*/courses/…` | repo-relative |

Access is via `better-sqlite3` (synchronous, WAL). **The `EVAL_DB_PATH` / `EVAL_LOGS_DIR` overrides are the exact relocation hooks the desktop needs** — see §8.3.

### 3.5 Real-time

**SSE only — no WebSocket.** Streams: `/api/eval/stream/{quick,matrix,interact,run}` (2-hour cap, 5-min keep-alive ping) and `/api/derivation/live/:label/events`. Over loopback HTTP these work in Electron **unchanged**.

### 3.6 Process spawning

`services/poetics/jobRunner.js` spawns whitelisted child `node` processes (drama generation, scoring, replay) from `POST /api/jobs`, with cost classes (free / quota / metered), argv sanitisation, and serialization of metered/quota jobs. `child_process` works in Electron's Node — this ports as-is, but its **lifecycle must be tied to app quit** (§8.7).

### 3.7 Auth

`services/httpBasicAuth.js`: HTTP Basic + RBAC (admin / participant) + **localhost trust**. On `127.0.0.1` with no creds set, it is a **no-op** (`req.evalRole` undefined → treated as admin). A public bind with no creds **refuses to start**. For a loopback desktop app this means **auth is transparently satisfied** with zero configuration. Optional hardening in §8.10.

### 3.8 Native dependencies (the ones that need care)

| Dep | Version | Why it matters for Electron |
|---|---|---|
| `better-sqlite3` | 12.5.0 | Native addon; **must be rebuilt against Electron's ABI**; cannot open a DB inside an asar archive. |
| `node-pty` | 1.0.0 | Native addon (Codex PTY sessions); same rebuild requirement. |

Everything else (`express`, `@langchain/*`, `yaml`, `zod`, `n3`, `eyereasoner`, `chalk`, `dotenv`, `jsonrepair`) is pure JS and ports without ceremony.

### 3.9 Module system

Repo is **ESM** (`"type": "module"`, `engines.node >= 20`). `evalSurfaces.js` and the routes use `import`. Desktop code is therefore ESM too; Electron ≥ 28 supports ESM in the main process, and we run the server in a child Node context regardless (§8.1).

---

## 4. Architecture decision

### 4.1 Options considered

**Strategy A — Embed the server (RECOMMENDED).**
Electron main boots the existing Express app (the poetics superset) on an ephemeral loopback port inside a child Node process; a `BrowserWindow` loads `http://127.0.0.1:<port>/`. The renderer is the unchanged web UI.

**Strategy B — Rebuild in the renderer (REJECTED).**
Re-implement each page as renderer assets and replace every HTTP route with Electron IPC handlers.

### 4.2 Why A, not B

| Dimension | A — Embed | B — Rebuild |
|---|---|---|
| Exact equivalence (G1) | By construction — same bytes | Best-effort, drifts immediately |
| Sync (G2) | Automatic — one UI codebase | Every web change must be mirrored in IPC + renderer → permanent maintenance tax |
| SSE streaming (G5) | Works unchanged (loopback HTTP) | Must be re-engineered as IPC event channels |
| Job launcher (§3.6) | `child_process` works as-is | Re-wire spawn + polling through IPC |
| `better-sqlite3` / `node-pty` | Run in the Node child, rebuilt once | Same, plus all the rewrite |
| Effort | Days | Weeks, then ongoing |
| Risk | Native-module rebuild + path relocation (known, bounded) | Behavioural divergence between two UIs (unbounded) |

Strategy B reintroduces exactly the divergence this codebase already fights with `mountEvalSurfaces` and `railHtml()` single-sourcing. It is the wrong choice for a requirement whose headline is *"keep them in sync."* **A is selected.**

The usual objection to A — *"that's just a browser pointed at localhost"* — is true and, here, correct: the requirement is equivalence + sync, and A delivers both for free while still allowing a genuine native shell (menus, lifecycle, keychain, dialogs, single-instance) around it.

---

## 5. Target architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ Electron MAIN process (desktop/main.js)                                │
│  • app lifecycle, single-instance lock, menus, shortcuts               │
│  • resolves writable paths → sets EVAL_DB_PATH / EVAL_LOGS_DIR / …     │
│  • forks the server child, awaits its "port" handshake                 │
│  • creates BrowserWindow → http://127.0.0.1:<port>/<home>              │
│  • navigation guard, external-link handling, CSP                       │
│  • safeStorage (keychain) for provider API keys                        │
│  • on quit: stop child, which stops jobRunner children, closes DB      │
└───────────────┬───────────────────────────────────┬──────────────────┘
                │ utilityProcess MessagePort          │ loads URL (HTTP)
                ▼                                     ▼
┌─────────────────────────────────────┐   ┌──────────────────────────────┐
│ SERVER child (utilityProcess)        │   │ RENDERER (BrowserWindow)     │
│  desktop/server-entry.mjs            │   │  • the UNCHANGED web UI       │
│  • buildPoeticsApp({ root })         │◀──┤  • Alpine + server-rendered   │
│  • app.listen(0, '127.0.0.1')        │   │    HTML over loopback         │
│  • posts { port } to parent          │   │  • SSE via EventSource        │
│  • better-sqlite3, node-pty (native) │   │  • contextIsolation: true     │
│  • jobRunner spawns node children    │   │    nodeIntegration: false     │
└─────────────────────────────────────┘   └──────────────────────────────┘
```

### Components

- **Main process** (`desktop/main.js`) — the only privileged code we add. Owns lifecycle, window, paths, secrets, and the child handshake. Small.
- **Server child** (`desktop/server-entry.mjs`) — a thin entry that imports the existing app factory and listens on an ephemeral port. Runs in an Electron **`utilityProcess`** for crash isolation and a clean Node context (native modules, ESM). Reports its bound port back to main.
- **Renderer** — the existing web UI, untrusted, with no Node access. All privileged work it needs already happens through the loopback HTTP API (which is why we barely need IPC).
- **Preload** (`desktop/preload.js`) — minimal `contextBridge` surface for the few things only the shell can do (e.g. "save this export via native dialog", "open external URL", "read app version"). Optional in v1.

---

## 6. The sync contract (the heart of the request)

Equivalence is automatic; *staying* equivalent is a discipline. We codify it the same way the repo already codifies `mountEvalSurfaces`.

### 6.1 Rules

1. **One UI source.** All HTML/CSS/JS lives in `public/` and the route renderers. The desktop app **must not contain any UI files** (`.html`, page CSS, Alpine components). Enforced by lint/CI (§13).
2. **One-way dependency.** `desktop/` may import from `services/` and `routes/` (e.g. the app factory). **Nothing in `services/`, `routes/`, or `public/` may import from `desktop/`.** This keeps the web stack desktop-agnostic and independently runnable — the same one-way discipline used for the in-housed `tutor-core/`.
3. **One route table.** The desktop boots the *same* app factory the web server uses. It does not re-declare routes. A CI snapshot test asserts the desktop's mounted route table equals the web server's (§13).
4. **One dependency set.** Native + server deps are declared once at the repo root. The desktop adds only `electron` + `electron-builder` (+ `@electron/rebuild`, `@electron/notarize` later). No second copy of `express`/`better-sqlite3`/etc. that can drift.
5. **Shared by reference, never by copy.** Config, content packages, and `public/` are referenced from their canonical locations (bundled read-only at package time), never forked into a desktop tree.

### 6.2 The small, sync-friendly refactor this requires

Today, app construction and `listen()` are intertwined in `server.js` and `browse-poetics-scripts.js`. To let the desktop reuse the *exact* app without copying it, factor out a pure builder:

- **Extract `buildPoeticsApp({ root, mountDocsResearch })`** from `scripts/browse-poetics-scripts.js` — everything up to but excluding `listen()`. The existing launcher (`serve-poetics-browser.mjs`) then calls `buildPoeticsApp(...).listen(PORT, HOST)`; the desktop calls `buildPoeticsApp(...).listen(0, '127.0.0.1')`. Same single-source pattern `mountEvalSurfaces` already uses one level down.
- (Optional, symmetric) do the same for `server.js` → `buildEvalApp({ root })` if we ever want to embed the slim eval-only server instead of the superset.

This is the *only* change to existing files. It is a refactor with no behavioural change, covered by the existing server smoke tests, and it makes both the web launcher and the desktop strictly thinner.

---

## 7. Module system, runtime, and tooling decisions

- **Language:** ESM throughout (matches the repo). Main entry may be `.mjs` or rely on `"type": "module"`; the server child is ESM and imports the ESM app factory directly.
- **Electron:** latest stable (≥ 31 at time of writing) — required for solid ESM-in-main and `utilityProcess` maturity. Pin exactly; Electron's bundled Node ABI is what native modules rebuild against.
- **Packager:** **electron-builder** (mature multi-target, asar + `asarUnpack`, native rebuild, code-sign/notarize, auto-update). Alternative considered: electron-forge — fine, but electron-builder's native-rebuild + notarize story is the most batteries-included for our two native deps.
- **Native rebuild:** `@electron/rebuild` in `postinstall` for dev; electron-builder rebuilds at package time for releases.

---

## 8. Detailed component design

### 8.1 Boot sequence & process model

1. `app.requestSingleInstanceLock()` — second launch focuses the existing window (the embedded server owns the DB + a fixed-ish port; we must not run two).
2. `app.whenReady()`.
3. **Resolve paths** (§8.3) and set `process.env.EVAL_DB_PATH`, `EVAL_LOGS_DIR`, `EVAL_EXPORTS_DIR` (new, see §8.3), `ROOT`/cwd, and provider keys (§8.8) **before forking**.
4. **Fork the server child** with `utilityProcess.fork(serverEntryPath, [], { stdio: 'pipe' })`. Pipe its stdout/stderr to a rotating log in `userData/logs/desktop-server.log` and (in dev) to the terminal.
5. **Await the port handshake** — child posts `{ type: 'listening', port }` once `listen(0)` resolves; main resolves a promise (with a timeout + retry, and a visible error window on failure).
6. **Create the `BrowserWindow`** and load `http://127.0.0.1:${port}/${HOME_ROUTE}` (§8.5). Restore prior window bounds (§8.9).
7. **Wire lifecycle** (§8.7): on `before-quit`, signal the child to drain (stop jobRunner children, `db.close()`), then exit.

**Why `utilityProcess` (not in-main, not `child_process.fork`):**

- *vs. in-main:* keeps `better-sqlite3`'s synchronous queries and any server hiccup off the UI/menu thread; isolates a native-module crash from the whole app.
- *vs. `child_process.fork`:* `utilityProcess` is Electron's blessed Node-child API — it runs against Electron's Node ABI (so the rebuilt native modules load correctly) and gives a typed `MessagePort` to main.

> Spike caveat to confirm in Phase 0: ESM entry inside `utilityProcess`. If a direct `.mjs` entry is problematic on the pinned Electron, fall back to a tiny CJS shim that does `await import('./server-entry.mjs')`.

### 8.2 Server embedding & port handshake

`desktop/server-entry.mjs` (sketch):

```js
// Runs inside utilityProcess (Electron's Node). ESM.
import { buildPoeticsApp } from '../scripts/browse-poetics-scripts.js'; // §6.2 export

const root = process.env.MS_APP_ROOT;            // resource root (§8.3)
const app = buildPoeticsApp({ root, mountDocsResearch: true });

const server = app.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  process.parentPort.postMessage({ type: 'listening', port });
});

process.parentPort.on('message', (e) => {
  if (e.data?.type === 'shutdown') {
    // stop jobRunner children + close DB, then exit (§8.7)
    server.close(() => process.exit(0));
  }
});
```

Main side (sketch, in `desktop/main.js`):

```js
import { utilityProcess, BrowserWindow } from 'electron';

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(serverEntry, [], { env, stdio: 'pipe' });
    const t = setTimeout(() => reject(new Error('server boot timeout')), 20_000);
    child.on('message', (m) => {
      if (m?.type === 'listening') { clearTimeout(t); resolve({ child, port: m.port }); }
    });
    child.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
}
```

**Ephemeral port (`listen(0)`)** avoids collisions with a developer's running `:8081`/`:3466` and needs no idempotent-kill logic. The renderer never sees a hard-coded port.

### 8.3 Path & resource resolution (the trickiest real-world part)

Two classes of path, handled differently.

**(a) Read-only app resources** — `public/`, `config/`, `docs/`, `prompts/`, content packages, `notes/poetics/` templates. Bundled with the app. **`better-sqlite3` cannot read inside an asar**, and several loaders use `fs` on directories — so we ship these via electron-builder `extraResources` (unpacked under `process.resourcesPath/app`) and set `MS_APP_ROOT = app.isPackaged ? path.join(process.resourcesPath, 'app') : repoRoot`. The app factory already takes `{ root }`, so this is a single injection point. (Anything the server reads via plain `fs` that ends up inside asar would need `asarUnpack`; using `extraResources` for the whole resource root sidesteps per-path archaeology.)

**(b) Writable data** — relocate into `app.getPath('userData')`:

| Data | Env var | Desktop value |
|---|---|---|
| SQLite DB | `EVAL_DB_PATH` | `userData/data/evaluations.db` |
| Dialogue logs | `EVAL_LOGS_DIR` | `userData/logs` |
| Exports / artifacts | `EVAL_EXPORTS_DIR` *(small new seam)* | `userData/exports` |
| Job logs | (under exports) | `userData/exports/.poetics-job-logs` |

`EVAL_DB_PATH` and `EVAL_LOGS_DIR` **already exist** (evaluationStore.js:59,62). `exports/` is currently repo-relative in several scripts; introducing a single `EVAL_EXPORTS_DIR` resolver (defaulting to `path.join(ROOT, 'exports')`) is a small, web-compatible addition that also helps hermetic tests. (Scope this in Phase 1; until then, exports can live under the unpacked resource root in dev.)

**First-run seeding/migration:** on first launch, if `userData/data/evaluations.db` is absent, either (i) create an empty DB (the store's migrations run on open and `mkdirSync` the parent — evaluationStore.js already does `fs.mkdirSync(dirname, {recursive:true})`), or (ii) offer to import an existing `data/evaluations.db` / `~/.machinespirits-data` DB via a native file picker. Default: create-empty + offer-import. Never write into the app bundle.

### 8.4 Native modules

- `better-sqlite3` and `node-pty` are rebuilt against Electron's ABI: `@electron/rebuild` in dev `postinstall`; electron-builder at package time.
- In packaging, mark them `asarUnpack` (e.g. `"**/node_modules/{better-sqlite3,node-pty}/**"`) so their `.node` binaries live on disk, loadable at runtime.
- **Risk:** native ABI mismatch is the classic Electron failure (`NODE_MODULE_VERSION` errors). Mitigated by pinning Electron, scripting the rebuild, and a CI "native module loads" smoke (§13).

### 8.5 Renderer & security

- `BrowserWindow` with `webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }`. The renderer is untrusted web content and gets **no Node**; it already does everything through the loopback HTTP API.
- **Navigation guard:** `webContents.on('will-navigate')` and `setWindowOpenHandler` — allow only `http://127.0.0.1:<port>`; route every external/`http(s)` link to the system browser via `shell.openExternal` (with the same "verify unfamiliar URLs" caution the platform already applies to transcript links).
- **CSP:** inject via `session.defaultSession.webRequest.onHeadersReceived`. Note the UI currently loads CDN assets (KaTeX, marked.js, Google Fonts) and uses inline `<style>`/Alpine — the CSP must permit those (or, as a later hardening, vendor the CDN libs locally to tighten it). Match the web app's effective policy so behaviour is identical.
- **Home route:** configurable `HOME_ROUTE` (default `/browse` for the scriptorium; a small main-side preference can switch it to `/chat`, `/pilot`, the eval landing, etc.). See open question O1.

### 8.6 SSE & streaming

No work required. `EventSource`/`fetch` streaming against `http://127.0.0.1:<port>/api/eval/stream/*` and `/api/derivation/live/:label/events` behaves exactly as in a browser. Verify in Phase 0 that Electron's network stack honours the 5-min keep-alive ping and 2-hour cap (it does; this is a normal HTTP connection).

### 8.7 Job launcher & child-process lifecycle

`jobRunner.js` spawns `node` children. In a desktop app these must not outlive the window:

- On `app.before-quit`: main posts `{type:'shutdown'}` to the server child; the child stops `activeJobs` (SIGTERM, then SIGKILL after a grace period), `db.close()`, then exits. Main waits (bounded) before `app.exit()`.
- The spawned children should inherit the **same resolved env** (resource root + writable paths + provider keys) so a job writing to `exports/` lands in `userData/exports`, not the bundle. This means the env injection in §8.1 must propagate through `jobRunner`'s spawn (it inherits `process.env` by default — confirm no hard-coded cwd-relative output paths escape `EVAL_EXPORTS_DIR`).
- Cost-class serialization and argv sanitisation are unchanged.

### 8.8 Credentials & secrets

Today provider keys (`OPENROUTER_API_KEY`, etc.) come from shell env / `.env`. Desktop options, in order of preference:

1. **Read existing env first** (so a developer launching from a configured shell "just works").
2. **OS keychain via Electron `safeStorage`** — a Settings pane encrypts keys at rest (Keychain on macOS); main decrypts and injects them into the server child's env at fork time. This is a *genuine improvement* the desktop form enables over a plaintext `.env`.
3. Never persist keys in `userData` plaintext or in the renderer.

### 8.9 Native desktop affordances

- **Application menu** (`Menu.setApplicationMenu`) with the standard macOS roles + app-specific items: Reload, Toggle DevTools (dev), "Open Data Folder" (`shell.openPath(userData)`), "Import Database…", "Switch Home Surface", "Settings (API keys)".
- **Keyboard shortcuts** mapped to those menu items.
- **Window-state persistence:** save/restore bounds + maximised state to `userData/window-state.json` (or the `electron-window-state` helper).
- **Native dialogs:** offer to intercept the poetics "save export / download artifact" flows with `dialog.showSaveDialog` for a native feel (optional; the in-page flows still work).
- **Single-instance** (§8.1) and **deep-linking** (later): a `mseval://run/<id>` protocol that focuses the window and navigates the renderer to that run.

### 8.10 Auth inside the desktop app

On loopback with no creds, `httpBasicAuth` is a no-op → the desktop app works with **zero auth config**, exactly as intended for a single-user tool. This also makes the long-standing *"add auth before non-localhost deploy"* blocker irrelevant for the desktop form: it never deploys.

**Optional hardening (recommended, low cost):** because any local process can reach a loopback port, generate a random per-launch secret in main, set it as the server child's `MS_AUTH_USER`/`MS_AUTH_PASS`, and inject the `Authorization: Basic …` header into renderer requests via `session.defaultSession.webRequest.onBeforeSendHeaders` (scoped to the loopback origin). This upgrades "any local app can poke the API" to "only our renderer can," with no UX cost and using the auth layer that already exists.

---

## 9. Directory layout

```
desktop/
  main.js               # app lifecycle, window, paths, secrets, child handshake (ESM)
  server-entry.mjs      # utilityProcess entry → buildPoeticsApp().listen(0)
  preload.js            # minimal contextBridge (version, save-dialog, open-external)
  paths.js              # resolve MS_APP_ROOT + writable dirs from app.getPath
  menu.js               # application menu + shortcuts
  windowState.js        # persist/restore bounds
  csp.js                # CSP + header injection
  security.js           # navigation guard, external-link handling, loopback token
electron-builder.yml    # packaging config (asar, asarUnpack, extraResources, mac)
build/                  # icons (icns/ico/png), entitlements.plist
```

Plus, in existing files (the §6.2 refactor only):
```
scripts/browse-poetics-scripts.js   # export buildPoeticsApp({ root, ... })
scripts/serve-poetics-browser.mjs   # now calls buildPoeticsApp(...).listen()
package.json                        # add desktop deps + scripts (below)
```

`package.json` additions:

```jsonc
{
  "scripts": {
    "desktop:dev":   "electron desktop/main.js",          // loopback UI, devtools
    "desktop:build": "electron-builder --mac",            // packaged dmg
    "desktop:rebuild": "electron-rebuild -f -w better-sqlite3,node-pty",
    "postinstall":   "electron-rebuild -f -w better-sqlite3,node-pty || true"
  },
  "devDependencies": {
    "electron": "PINNED",
    "electron-builder": "^25",
    "@electron/rebuild": "^3",
    "@electron/notarize": "^2"   // later milestone
  }
}
```

---

## 10. Build, packaging & distribution

- **electron-builder** with `asar: true` and `asarUnpack` for the two native modules; `extraResources` to ship the read-only resource root (`public/`, `config/`, `docs/`, `prompts/`, content packages) unpacked under `resourcesPath/app`.
- **macOS first:** `dmg` + `zip` targets; `hardenedRuntime: true`; entitlements for JIT/network as needed by Electron.
- **Code signing & notarization:** Developer ID + `@electron/notarize` `afterSign` hook — required for distribution to other machines, **not** required for personal `npm run desktop:build` + local launch. Gate this behind the "distribute to others?" decision (O2).
- **Auto-update (later):** `electron-updater` against a release feed (GitHub Releases or S3). Out of scope for v1.
- **Windows/Linux (later):** `nsis` + `AppImage`/`deb`; the only platform-specific work is icons, signing, and confirming native rebuilds — the architecture is identical.

---

## 11. Dev workflow & DX

- `npm run desktop:dev` boots main → forks the server child → opens the window with DevTools. Because the UI is served over HTTP with **no build step**, editing any `public/*.html` or route renderer and hitting **Reload** (Cmd-R) shows the change instantly — same loop as the web app. This is a real DX win of Strategy A.
- A `MS_DESKTOP_DEV=1` flag can point the window at an already-running `npm run poetics:serve` instead of forking, for fast iteration on the shell itself.

---

## 12. Testing & CI

| Test | What it guards | How |
|---|---|---|
| **Route-parity snapshot** | Sync rule #3 — desktop boots the same routes as web | Build the app via `buildPoeticsApp`, walk the Express route stack, snapshot the `{method, path}` set; assert it matches the web launcher's. Fails if desktop ever forks the route table. |
| **No-UI-in-desktop lint** | Sync rule #1 | CI grep/ESLint rule: `desktop/` contains no `*.html` and no Alpine/page CSS. |
| **One-way-dependency lint** | Sync rule #2 | Assert no file under `services/`, `routes/`, `public/` imports from `desktop/`. |
| **Headless boot smoke** | The app actually starts | Launch via `@playwright/test` Electron driver (or `electron` headless), wait for the port handshake, `GET /healthz` → `ok`, load `HOME_ROUTE`, assert a known DOM node renders. |
| **Native-module load** | ABI rebuild correctness | In the packaged/rebuilt context, `require('better-sqlite3')` opens a temp DB and `node-pty` spawns a trivial PTY. |
| **Mocked metered path** | Equivalence of a job/turn without spend | Drive a chat turn or adaptive job with `ADAPTIVE_TUTOR_LLM=mock` / injected mock deps; assert a row lands in the `userData` DB. |
| **Path-relocation** | Writable data lands in userData, not the bundle | Boot with a tmp `userData`; run a mock job; assert DB + logs + exports wrote under tmp. |

These run in the existing `node --test` harness where possible; the Electron-driver tests are a separate `desktop:test` job. The route-parity + no-fork + one-way tests are the *enforcement* of the sync contract — without them, "stays in sync" is a hope, not a guarantee.

---

## 13. Security considerations (consolidated)

- Renderer: `contextIsolation` + `sandbox` + `nodeIntegration:false`; no remote content beyond loopback + whitelisted CDNs; strict navigation guard; external links to system browser only.
- Loopback API: bound to `127.0.0.1`; ephemeral port; optional per-launch Basic-auth token (§8.10) to fence off other local processes.
- Secrets: OS keychain via `safeStorage`; never in renderer, never plaintext in `userData`.
- CSP injected at the session layer; tighten by vendoring CDN libs in a later hardening pass.
- Job spawning: existing argv sanitisation + cost-class serialization retained; children inherit the sandboxed env and are killed on quit.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Native ABI mismatch (`NODE_MODULE_VERSION`) for `better-sqlite3` / `node-pty` | Med | High | Pin Electron; scripted `@electron/rebuild`; CI native-load smoke. |
| R2 | ESM entry inside `utilityProcess` quirks on pinned Electron | Med | Med | Phase-0 spike; CJS `await import()` shim fallback. |
| R3 | `fs`/SQLite paths resolving inside asar (read failures) | Med | High | Ship resource root via `extraResources` (unpacked); inject `MS_APP_ROOT`; `asarUnpack` native modules. |
| R4 | `exports/` writes escaping to the read-only bundle | Med | Med | Add `EVAL_EXPORTS_DIR` seam; path-relocation test; audit jobRunner output paths. |
| R5 | Orphaned job children after quit | Low | Med | Lifecycle shutdown protocol (§8.7) + grace-period SIGKILL. |
| R6 | CSP breaks CDN-loaded KaTeX/marked/Fonts → blank pages | Med | Med | Match web's effective policy first; vendor CDNs later. |
| R7 | Drift creeps back in (someone adds a desktop-only page) | Low | High | Sync-contract CI tests (§12) fail the build. |
| R8 | Two instances racing on the SQLite file | Low | High | Single-instance lock (§8.1). |
| R9 | macOS Gatekeeper blocks an unsigned local build | Low | Low | Personal use: right-click-open / ad-hoc sign; distribution: notarize (O2). |

---

## 15. Phased plan

Effort estimates are rough engineer-days for one developer; each phase ends with a demoable artifact.

### Phase 0 — Equivalence spike (½–1 day) — *de-risks everything*
- Minimal `desktop/main.js` + `server-entry.mjs`. For speed, **skip the §6.2 refactor**: set `EVAL_DB_PATH`/`EVAL_LOGS_DIR` to a tmp dir, pick a free port in main, `utilityProcess.fork` the existing poetics launcher (or a 5-line ephemeral-listen wrapper), open a window at it.
- **Verify:** every surface renders; SSE streams tick; a `mock` job runs; `better-sqlite3` + `node-pty` load after `electron-rebuild`.
- **Exit criterion:** screenshots of `/browse`, `/chat`, `/pilot`, `/compose/live` (SSE) running in an Electron window.

### Phase 1 — Clean embedding & path relocation (1–2 days)
- Land the §6.2 `buildPoeticsApp` refactor; desktop and web both consume it; route-parity test passes.
- Implement `paths.js`: `MS_APP_ROOT`, `EVAL_DB_PATH`, `EVAL_LOGS_DIR`, `EVAL_EXPORTS_DIR` → `userData`; first-run create-empty + import-existing-DB picker.
- **Exit:** app runs entirely out of `userData` + bundled resources; nothing writes to the repo/bundle.

### Phase 2 — Native shell (1–2 days)
- Single-instance, window-state, application menu + shortcuts, navigation guard, external-link handling, CSP, graceful-shutdown lifecycle (job-child cleanup + `db.close()`).
- **Exit:** behaves like a real macOS app; clean quit leaves no orphan processes.

### Phase 3 — Desktop-native value-adds (1–2 days)
- `safeStorage` API-key settings pane; optional loopback auth token; native save dialogs for exports; "Open Data Folder"; (optional) `mseval://` deep links.
- **Exit:** keys stored in Keychain; metered surfaces usable with a desktop spend-confirm.

### Phase 4 — Packaging (1–2 days)
- `electron-builder.yml`: asar + `asarUnpack` natives + `extraResources` resource root; mac `dmg`; icons/entitlements; native rebuild at package time.
- **Exit:** `npm run desktop:build` produces a launchable `.dmg` on a clean machine (unsigned).

### Phase 5 — Sync guards & CI (1 day)
- Route-parity snapshot, no-UI-in-desktop lint, one-way-dependency lint, headless boot smoke, native-load smoke, path-relocation test wired into CI.
- **Exit:** a PR that forks the UI or the route table **fails CI**. This is the deliverable that makes "stay in sync" real.

### Phase 6 (optional, later) — Distribution & cross-platform
- Developer-ID signing + notarization (`@electron/notarize`); `electron-updater` auto-update; Windows/Linux targets; CDN-vendoring CSP hardening.

**Critical path:** Phase 0 → 1 → 5. Phases 2–4 are parallelizable once Phase 1 lands. Phase 5's guards are what convert a one-time port into a durably-synced one — do not skip them.

---

## 16. Acceptance criteria (v1 "done")

- **AC1** Launching the app opens a window showing the scriptorium home; every web surface (`/browse`, `/compose`, `/compose/live`, `/ontology`, `/rubric`, `/runs`, `/board`, `/derivation`, `/chat`, `/pilot`, `/pilot-admin`, `/adjudication`, `/eval`) renders and functions identically to the web app.
- **AC2** SSE-driven surfaces stream live in the window.
- **AC3** The job launcher runs a (mockable) job; output + DB rows land in `userData`, never in the bundle.
- **AC4** All reads/writes are relocated: DB, logs, exports under `app.getPath('userData')`; config/public/content read from the bundled resource root.
- **AC5** Quit terminates the server child and all job children; no orphan processes; DB closed cleanly.
- **AC6** Editing a `public/` page or route renderer changes the desktop app on reload with **no desktop-side edit** (manual proof of sync).
- **AC7** CI fails if `desktop/` contains UI files, if the route table diverges, or if `services/`/`routes/`/`public/` import from `desktop/`.
- **AC8** `npm run desktop:build` yields a launchable macOS `.dmg`.
- **AC9** Provider keys load from env and can be stored in the OS keychain; none persist in plaintext.

---

## 17. Decisions taken (sensible defaults — say the word to change any)

Rather than block on a questionnaire, the plan assumes these defaults:

- **D1 — Embed the superset.** Boot the poetics app (it includes all eval/chat/pilot/adjudication surfaces). One window, one process tree.
- **D2 — macOS first, personal use.** No signing/notarization in v1; revisit for distribution (O2).
- **D3 — Keychain for keys, env fallback.** Read existing env, offer `safeStorage` storage.
- **D4 — Expose metered surfaces** (jobs, `/compose/live`) with the existing cost-confirm plus a desktop spend guard — the desktop is *the* place this is safe, since it's single-user localhost.
- **D5 — ESM + Electron-builder + utilityProcess**, Electron pinned to current stable.

## 18. Open questions to confirm

- **O1 — Home surface.** Default window route: `/browse` (scriptorium), or the eval landing, `/chat`, or `/pilot`? (Trivially configurable; just need your default.)
- **O2 — Distribution.** Personal-only (skip signing) or share with others (adds Developer-ID + notarization, Phase 6)?
- **O3 — Scope trim.** Ship the full superset (D1), or hide some surfaces (e.g. the participant `/pilot` flow) behind a flag for a tidier single-user tool?
- **O4 — Exports seam timing.** Add `EVAL_EXPORTS_DIR` now (Phase 1) so jobs write cleanly to `userData`, or defer and let exports sit under the resource root short-term?

---

## Appendix A — Why this is *not* "just a browser"

A browser tab can't: own the app lifecycle and kill orphaned job children on quit; store provider keys in the OS keychain; relocate the data store to a per-user writable dir; present native menus/shortcuts/save-dialogs; run as a single instance guarding a SQLite file; or ship as a notarized, double-clickable artifact with no terminal. Strategy A keeps the *UI* a browser (which is the point — that's what makes it equivalent and synced) while wrapping it in a genuine native shell that does all of the above.

## Appendix B — Files touched vs. files added

- **Added (new, desktop-only):** everything under `desktop/`, `electron-builder.yml`, `build/` icons, desktop CI jobs.
- **Modified (minimal, behaviour-preserving):** `scripts/browse-poetics-scripts.js` (extract `buildPoeticsApp`), `scripts/serve-poetics-browser.mjs` (call it), `package.json` (deps + scripts), and a one-line `EVAL_EXPORTS_DIR` resolver where `exports/` is currently hard-coded.
- **Untouched (the whole point):** `public/**`, the four routers, `services/evalSurfaces.js`, `services/httpBasicAuth.js`, every page and component. The desktop app consumes them; it does not copy or fork them.
