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
