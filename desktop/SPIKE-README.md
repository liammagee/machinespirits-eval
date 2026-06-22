# Phase 0 — Electron equivalence spike

This is the de-risking spike from [`ELECTRON-DESKTOP-APP-PLAN.md`](../ELECTRON-DESKTOP-APP-PLAN.md) §15.
It proves the core architecture (Strategy A — *embed the unchanged Express app, point a
window at it*) end-to-end, with **zero edits to existing files**.

## What it does

- `desktop/server-entry.mjs` runs inside an Electron **`utilityProcess`**. It builds the
  real poetics scriptorium app via the exported factory `createPoeticsBrowserApp()`
  (the superset that also mounts the `/api/eval`, `/api/chat`, `/api/pilot`,
  `/api/a19/adjudication` routers and the static UI surfaces), listens on an
  **ephemeral loopback port**, and reports that port back to main.
- `desktop/main.js` (the Electron **main** process) relocates the SQLite DB + logs into
  `app.getPath('userData')` via the existing `EVAL_DB_PATH` / `EVAL_LOGS_DIR` seams,
  forks the server child, awaits the port handshake, and opens a `BrowserWindow` at
  `http://127.0.0.1:<port>/browse`.

## Run it

```bash
# from this worktree (machinespirits-eval-electron)
npm install            # installs electron + @electron/rebuild + existing deps
npm run desktop:rebuild # rebuild native modules (better-sqlite3, node-pty) for Electron's ABI
npm run desktop:smoke  # headless PASS/FAIL battery, exits 0/1 (no GUI)
npm run desktop:dev    # opens the actual window at /browse
```

## ⚠️ Native-ABI caveat (important)

`npm run desktop:rebuild` recompiles `better-sqlite3` and `node-pty` against **Electron's**
Node ABI. After that, **plain `node` in this worktree can no longer load them**
(`npm test`, `node scripts/...` that touch the DB will throw `NODE_MODULE_VERSION`).
That is expected and is *why this lives in a separate worktree* — the main checkout's
`node_modules` is untouched. To go back to plain-Node usage here, run
`npx electron-rebuild` is reversed by a normal `npm rebuild better-sqlite3 node-pty`.

(Phase 4 packaging handles this properly: electron-builder rebuilds at package time and
the shipped app only ever runs under Electron.)

## What it proves / does not prove

**Proves (Phase 0 scope):** the existing app boots under Electron with native modules;
the utilityProcess fork + ESM + port handshake works; SSE survives loopback; the real UI
renders in a `BrowserWindow`; writable data lands in `userData`, not the repo.

**Does NOT prove (later phases):** packaging/asar resource resolution (Phase 1/4),
graceful job-child cleanup under real load (Phase 2), credential storage (Phase 3),
the `buildPoeticsApp` extraction + route-parity CI guard (Phase 1/5). The spike imports
the *already-exported* factory, so no refactor was needed to get here.

---

## Phase 1 (landed)

Phase 1 turns the spike into a structured shell and adds the sync guard:

- **`appFactory.mjs`** — the single `buildDesktopApp({ smoke })` constructor. Production
  returns *exactly* the web poetics app (`createPoeticsBrowserApp`); smoke mode wraps it
  with the `/__smoke/*` probe routes. (No `buildPoeticsApp` extraction was needed — the web
  server already exports the factory; `buildDesktopApp` is the desktop's single seam onto it.)
- **`routeParity.js` + `tests/desktopRouteParity.test.js`** — the **stays-in-sync guard**:
  asserts the desktop's production route table equals the web app's, and that no `/__smoke`
  route ships in production. A future desktop-only route fork fails this test.
- **`paths.js`** — central resolution of writable dirs (DB, logs, exports) into `userData`
  via `EVAL_DB_PATH` / `EVAL_LOGS_DIR` / `EVAL_EXPORTS_DIR`, plus `MS_APP_ROOT`. `main.js`
  calls `app.setName('Machine Spirits')` so the data dir is named, not the generic `Electron`.
- **`EVAL_EXPORTS_DIR` seam** — added to `services/poetics/jobRunner.js` (behaviour-preserving:
  defaults to `<repo>/exports` when unset) so the desktop's job logs land in `userData`.

Run the parity guard (in this Electron-ABI worktree, via Electron's Node):

```bash
EVAL_DB_PATH=$(mktemp -d)/t.db EVAL_LOGS_DIR=$(mktemp -d) \
  ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron --test tests/desktopRouteParity.test.js
```

In CI (fresh checkout, Node ABI) it runs under the normal `node --test` suite.

**Deferred to later phases (documented, not done):** fully relocating *spawned-job artifact*
outputs (drama-generator `outBase`, etc.) — these write `exports/...` relative to the child's
cwd and need per-script `EVAL_EXPORTS_DIR` awareness; first-run "import existing DB" picker
(Phase 3 dialog work); packaged-mode resource resolution via `MS_APP_ROOT` (Phase 4 asar).
