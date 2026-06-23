# Scriptorium — desktop app

A native desktop wrapper around the Machine Spirits web UX. It runs the entire
stack locally (the poetics scriptorium, tutor playground, eval API, human-learner
pilot, A19 adjudication) in one window — no server to deploy, no browser tab. It is
the **same** UI as the web app by construction (it embeds the unchanged Express app
and points a window at it), so the two never drift. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for how that works and how to change the UX.

---

## Quick start

You are in the `machinespirits-eval-electron` git worktree (the desktop build lives
in its own worktree on the `claude/electron-desktop-app` branch — see the caveat at
the bottom).

```bash
# 1. install deps (includes electron + electron-builder)
npm install

# 2. compile the native modules for Electron's ABI (one-time, after install)
npm run desktop:rebuild

# 3. launch the app
npm run desktop:dev
```

A window opens on the poetics scriptorium (`/browse`). The local server boots in a
background process on an ephemeral loopback port; you never manage a port.

---

## Commands

| Command | What it does |
|---|---|
| `npm run desktop:dev` | Launch the app window. |
| `npm run desktop:smoke` | Headless self-test: boots the app, hits every surface + SSE + CSP, prints PASS/FAIL, exits. No window. |
| `npm run desktop:test` | Run the desktop test suite (route-parity, sync-contract, paths, security, menu, window-state, credentials). |
| `npm run desktop:rebuild` | Recompile native modules (`better-sqlite3`, `node-pty`) for Electron's ABI. Run once after `npm install`. |
| `npm run desktop:pack` | Build an unpacked `.app` into `dist-desktop/` (fast; for local use/verification). |
| `npm run desktop:dist` | Build a `.dmg` installer into `dist-desktop/`. |

---

## Using the app

- **Surfaces.** Everything the web app exposes: `/browse` (scriptorium), `/compose`
  and `/compose/live` (authoring + live sit-in), `/ontology`, `/rubric`, `/runs`,
  `/board`, `/derivation`, the tutor playground (`/chat`), the participant pilot
  (`/pilot`), and A19 adjudication (`/adjudication`). Navigate via the in-page nav
  rail (**Board** is a primary, always-visible item), the native **Go** menu
  (⌘1–⌘9 for the first nine destinations, plus a dedicated **⌘B** for Board), or
  **View → Home** (⇧⌘H).
- **The board.** `/board` is a live kanban of the workplan — **drag a card between
  lanes** to change its status (it writes to `workplan/items/` and re-renders).
  Editing needs the repo on disk, so it works in dev and the browser dev server; a
  packaged app's bundled board is read-only (the drop reverts).
- **API keys.** **File → Set Up API Keys…** writes a `keys.env` template and opens
  it. Add your provider keys (e.g. `OPENROUTER_API_KEY=…`), save, and restart. On the
  next launch the keys are encrypted into your **macOS keychain** and the plaintext
  file is deleted. (Keys already in your shell environment are used as-is and win
  over stored ones.) **File → Clear Stored API Keys** removes them.
- **Your data.** Everything writable lives in
  `~/Library/Application Support/Scriptorium/` — the SQLite DB
  (`data/evaluations.db`), logs, exports, writing-pad DBs, and the encrypted keys.
  Nothing is written into the app bundle or the repo. **File → Open Data Folder**
  opens it. To fully uninstall, delete the app and that folder.
- **External links** open in your system browser; the app window stays on the local
  app.

---

## Security

- **Loopback only.** The embedded server binds `127.0.0.1` on an ephemeral port.
- **Sandboxed renderer.** `contextIsolation` + `sandbox` on, `nodeIntegration` off —
  the UI has no Node access; it only talks to the local HTTP API.
- **Content-Security-Policy** is injected for every page (allows the UI's Google
  Fonts + jsDelivr origins; everything else is locked to `self`). Disable for
  debugging with `MS_DESKTOP_NO_CSP=1`.
- **Keychain** for API keys at rest (Electron `safeStorage`).
- **Optional loopback token** (`MS_DESKTOP_TOKEN=1`): generates a per-launch
  credential the server enforces and the window carries (never leaked off-origin),
  fencing other local processes off the metered API. Off by default since loopback
  binding already keeps it private to your machine.

### Environment switches

| Var | Effect |
|---|---|
| `MS_HOME` | Home route (default `/browse`). |
| `MS_DESKTOP_TOKEN=1` | Enable the per-launch loopback auth token. |
| `MS_DESKTOP_NO_CSP=1` | Disable the injected CSP (debugging). |
| `EVAL_DB_PATH`, `EVAL_LOGS_DIR`, … | Override any writable location (otherwise defaults under userData). |

---

## Troubleshooting

- **Window shows "Could not start the local server" / `NODE_MODULE_VERSION`
  mismatch.** The native modules aren't built for Electron. Run
  `npm run desktop:rebuild`.
- **`npm test` or `node scripts/…` fails in THIS worktree with a better-sqlite3 ABI
  error.** Expected: `desktop:rebuild` compiled the natives for Electron, not Node.
  Use `npm run desktop:test` here; run the plain-Node suite in a fresh checkout. To
  restore plain-Node use here: `npm rebuild better-sqlite3 node-pty`.
- **A metered feature says it has no API key.** Set keys via **File → Set Up API
  Keys…** and restart, or launch from a shell that already exports them.
- **The dev menu-bar / dock name shows "Electron".** That's the stock Electron
  binary's bundle name. The packaged app (`Scriptorium.app`) always shows
  "Scriptorium"; for the dev build, run `npm run desktop:brand-dev` once to rename it
  (macOS only; reverts on `npm install`). The window title bar, dock icon, and About
  panel show "Scriptorium" either way.

## App name & icon

The app is named **Scriptorium** (`productName` in `electron-builder.yml`,
`app.setName` in `desktop/main.js`). The icon source is `desktop/icon.svg`; regenerate
the raster + `.icns` with `./node_modules/.bin/electron desktop/make-icon.mjs` followed
by the `sips`/`iconutil` steps (the dev dock icon is set live via `app.dock.setIcon`).

---

## Building a distributable

```bash
npm run desktop:pack    # → dist-desktop/mac-*/Scriptorium.app   (run locally)
npm run desktop:dist    # → dist-desktop/Scriptorium-<ver>.dmg   (installer)
```

The build packs the app into an asar with `better-sqlite3` + `node-pty` unpacked,
and (if you have an Apple Development identity) signs it locally. That is enough to
**run it yourself**. Shipping it to **other** machines needs Developer-ID signing +
notarization (next section).

### Distribution to other machines (Phase 6 — requires your accounts)

These steps are user-/account-specific and are intentionally not wired by default:

1. **Developer-ID signing + notarization.** Set, before `desktop:dist`:
   ```bash
   export CSC_NAME="Developer ID Application: <Your Name> (TEAMID)"
   export APPLE_ID="you@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
   export APPLE_TEAM_ID="TEAMID"
   ```
   then add to `electron-builder.yml`:
   ```yaml
   mac:
     hardenedRuntime: true
     notarize: true        # uses APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID
   ```
2. **Auto-update.** Add `electron-updater`, a `publish:` provider (e.g. GitHub
   Releases) to `electron-builder.yml`, and an `autoUpdater.checkForUpdatesAndNotify()`
   call in `desktop/main.js` guarded by `app.isPackaged`.
3. **Windows / Linux.** Add `win` (`nsis`) and `linux` (`AppImage`/`deb`) targets.
   The architecture is identical; only icons, signing, and the native rebuild differ.
4. **Tighter CSP.** Vendor the Google-Fonts/jsDelivr assets locally and drop those
   origins from `desktop/security.js`'s `buildCSP()`.

---

## How it works (short version)

`desktop/main.js` (Electron main) relocates writable data into `userData`, forks the
existing Express app into a `utilityProcess` on an ephemeral loopback port, and loads
that URL in a `BrowserWindow`. Production serves the *unchanged* web app via
`createPoeticsBrowserApp()`; the desktop adds only the native shell. The full design
and the rules for changing the shared UX are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).
