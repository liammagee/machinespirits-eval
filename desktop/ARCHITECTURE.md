# Desktop app architecture — and how to keep web + desktop in sync

**Read this before changing anything under `desktop/` or touching how the web UI is
served.** It defines the one rule that keeps the desktop app a faithful, zero-drift
mirror of the web UX: **there is one UI codebase, and the desktop embeds it.**

## The one big idea

The web UI in this repo has **no build step** — it is raw HTML + Alpine.js +
server-rendered HTML, served by Express. The desktop app does **not** re-implement
any of it. Instead:

```
Electron main (desktop/main.js)
  └─ forks a utilityProcess (desktop/server-entry.mjs)
        └─ buildDesktopApp()  →  createPoeticsBrowserApp()   ← the REAL web app
        └─ app.listen(0, '127.0.0.1')   (ephemeral loopback port)
  └─ BrowserWindow → http://127.0.0.1:<port>/browse   ← loads the unchanged UI
```

The renderer literally requests the same `public/*.html`, the same Alpine
components, and the same `/api/*` routes the browser does. So the desktop app is the
web app, wearing a native shell.

## How to update the app "core" (for BOTH web and desktop)

> To change the UX, edit the web stack. The desktop updates automatically.

| To change… | Edit… | Desktop picks it up because… |
|---|---|---|
| A page / component / styles | `public/**` (e.g. `public/tutor/`, `public/components/techne.css`) | the renderer loads `public/` over loopback — same files |
| A server-rendered poetics page | the `render*Html()` fns in `scripts/browse-poetics-scripts.js` | the desktop serves that exact app |
| An API route / behaviour | `routes/**`, `services/**` | mounted by the shared `mountEvalSurfaces` / the factory |
| What surfaces exist at all | `services/evalSurfaces.js` (shared mounter) | both web servers AND the desktop use it |

You should **never** need to edit `desktop/` to change the UX. If you find yourself
copying a page or a route into `desktop/`, stop — that is the drift this design
exists to prevent.

After any such change, prove parity still holds:

```bash
npm run desktop:test     # in this Electron-ABI worktree (uses Electron's Node)
# or, in a fresh checkout / CI:
npm test                 # the desktop tests run on the Node ABI
```

## The sync contract (enforced by tests, not by trust)

1. **One UI source.** `desktop/` contains **no** UI files (no `.html`, no page CSS,
   no Alpine components). Guard: `tests/desktopSyncContract.test.js`.
2. **One-way dependency.** `desktop/` may import from `services/` and `scripts/`;
   `services/`, `routes/`, and `public/` must **never** import from `desktop/`, so the
   web stack stays runnable and re-reasoned without the shell (same discipline as the
   in-housed `tutor-core/`). Guard: `tests/desktopSyncContract.test.js`.
3. **One route table.** The desktop's production app is *exactly*
   `createPoeticsBrowserApp()` (see `desktop/appFactory.mjs`); the route table must
   equal the web app's, and no `/__smoke` probe route may ship. Guard:
   `tests/desktopRouteParity.test.js`.
4. **One dependency set.** Native + server deps are declared once at the repo root.
   The desktop adds only `electron` + `electron-builder` (+ `@electron/rebuild`).

If a change legitimately needs the desktop to diverge (rare), update the guard test
in the same commit, with a comment explaining why — never silently.

## Seams you will touch (and the rules for them)

- **`desktop/appFactory.mjs` — `buildDesktopApp({ smoke })`.** The single place the
  desktop constructs its app. Production returns the unchanged web app; `smoke: true`
  wraps it with `/__smoke` probe routes for the headless battery. Keep production
  identical to the web app.
- **`desktop/paths.js` — writable-store relocation.** A packaged app's bundle is
  **read-only** (an asar archive). Every writable store therefore must live in
  `app.getPath('userData')`, set via an env override. Currently relocated:
  `EVAL_DB_PATH`, `EVAL_LOGS_DIR`, `EVAL_EXPORTS_DIR`, `AUTH_DB_PATH` (tutor-core),
  `EVAL_WRITING_PAD_DIR`, `TUTOR_CORE_LOG_DIR`.
  **Rule:** if you add a new writable store anywhere in the stack, give it an env
  override and relocate it here, or the packaged app will try to write inside the
  asar and crash at boot. `tests/desktopPaths.test.js` guards the env set.
- **`desktop/security.js` — CSP + nav guard.** The injected Content-Security-Policy
  enumerates the exact external origins the UI uses (Google Fonts, jsDelivr). If the
  UI adds a new CDN, add it here, or that resource is blocked. The smoke's
  "CSP no violations" check catches breakage.
- **Native "Go" menu — `desktop/menu.js` + `desktop/main.js`.** The desktop menu
  bar's Go submenu is built from the SAME nav source as the in-page rail: main
  fetches `/_nav.html` (railHtml's bare mode, generated from the `NAV` array in
  `scripts/browse-poetics-scripts.js`), `parseNavHtml()` turns it into items, and
  `buildMenuTemplate({ navItems })` renders them. Add a destination to `NAV` and it
  shows up in BOTH the rail (web + desktop) and the native menu — one definition.
- **Board CRUD — `POST /api/workplan/{move,add,update,delete}`.** `/board` is an
  editable kanban: it defaults to open-work focus while `?focus=all` and
  `?focus=settled` expose completed/dropped history; drag = move (status), card
  click = edit, lane "+" = add, editor Delete = delete. The routes call the
  workplan's exported `setItemField` /
  `updateItem` / `addItem` / `deleteItem` (`scripts/workplan.js`), which write the
  item file + re-render `board.json` — the CLI (`wp …`) and the dashboard share that
  one write path. Writes need `workplan/` on disk, so editing works in dev + the
  browser dev server; a packaged app (workplan/ in the asar) returns 500 and the UI
  reverts. The project's historical arc is folded into the Project-history band on
  `/timeline` (rendered from `PROJECT_HISTORY` in `scripts/browse-poetics-scripts.js`).
- **Timeline + GitHub — `/timeline`, `services/githubInfo.js`.** Milestones live in
  `workplan/milestones.yaml` (workplan.js `loadMilestones`/`upsertMilestone`/
  `deleteMilestone`; items reference one via `milestone:`). `services/githubInfo.js`
  resolves the `origin` repo, builds branch/commit/tag/PR links (pure, tested), and
  pulls live activity via the `gh` CLI (cached 60s, fails soft). `/timeline` joins
  milestones + items + that activity; `/api/{milestones,github/activity}` back it.
  Dependencies (`depends_on`, cycle-checked by `validateDependencies`) render as card
  badges on `/board`. New repo data source? Add it to `githubInfo.js`, not the route.

## File map

```
desktop/
  main.js          # Electron main: lifecycle, window, menu, paths, server handshake, CSP, token
  server-entry.mjs # utilityProcess entry → buildDesktopApp().listen(0); graceful job cleanup
  appFactory.mjs   # buildDesktopApp({smoke}) — the single seam onto createPoeticsBrowserApp
  paths.js         # relocate writable stores → userData (env overrides)
  security.js      # isLoopbackUrl / shouldOpenExternally / buildCSP / loopbackAuthHeaders
  menu.js          # application-menu template (pure)
  windowState.js   # window bounds persistence (pure)
  credentials.js   # OS-keychain API-key storage (pure logic, injected safeStorage)
  README.md        # how to run + use + build + distribute
  ARCHITECTURE.md  # (this file)
electron-builder.yml # packaging (asar + unpacked natives; entry override; mac targets)
tests/desktop*.test.js # parity + sync-contract + paths + security + menu + windowState + credentials
```

## Verification at a glance

| Command | What it checks | Runtime |
|---|---|---|
| `npm run desktop:test` | all desktop tests (parity, sync-contract, paths, …) | Electron's Node (this worktree) |
| `npm run desktop:smoke` | boots the real app in Electron, hits every surface + SSE + CSP | Electron |
| `npm run desktop:pack` then run the `.app` with `MS_DESKTOP_SMOKE=1` | the **packaged** app boots from the asar | Electron |
| `npm test` (fresh checkout / CI) | desktop tests on the Node ABI | Node |

## The native-ABI worktree caveat

Running `npm run desktop:rebuild` compiles `better-sqlite3` + `node-pty` for
**Electron's** ABI. After that, **plain `node`/`npm test` in this worktree cannot
load them** (`NODE_MODULE_VERSION` mismatch). That is why the desktop lives in its
own git worktree and why `desktop:test` runs via `ELECTRON_RUN_AS_NODE`. A fresh
checkout / CI uses the Node ABI and runs everything with plain `node`. To return
this worktree to plain-Node use: `npm rebuild better-sqlite3 node-pty`.
