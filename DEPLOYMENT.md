# Deployment — eval servers ↔ machinespirits.org

How the two Node servers in this repo relate to the public site, what is safe to
publish today, and the gate on everything else. Read this before exposing
anything on a non-localhost interface.

## The three moving parts

| Thing | What it is | Where it runs | Auth |
|-------|-----------|---------------|------|
| **Eval dashboard** — `server.js` (`npm start` → `STANDALONE=true node server.js`) | pilot participant surface, eval DB browser, run launchers | localhost (default `127.0.0.1`) | **basic-auth, bind-tied** — open on localhost, required on any public bind |
| **Poetics workbench** — `scripts/browse-poetics-scripts.js` (`npm run poetics:serve`, :3466) | generated-script browser, compose, live sit-in, run launcher | localhost (`127.0.0.1`) or `/poetics` on the website | **split** — read-only pages public; `/admin/*` requires basic-auth on public binds |
| **The website** — `../machinespirits-website` | Vite + Node app, the actual machinespirits.org | fly.io app `my-website-dtq0ia` (region `lax`, `internal_port 8080`), CI deploy via `.github/workflows/deploy.yml` | **yes** — `AUTH_DB_PATH=/data/lms.sqlite` |

The eval dashboard is an **internal tool built on a localhost trust model**. The
poetics workbench now supports a public-read / admin-write split, but its operator
controls still inherit the same localhost-first assumptions. The website is a
separately-deployed, auth-bearing product. They are not the same kind of thing,
and the eval servers are not drop-in deployable to the website without the mount
and auth split described below.

## Local dev — one canonical server

Don't hand-roll `node scripts/browse-poetics-scripts.js --port NNNN`; that's how
we ended up with several instances on different ports. Use:

```bash
npm run poetics:serve        # canonical: frees :3466, starts fresh, foreground
```

It is idempotent — re-run it any time and you land on the same URL
(`http://127.0.0.1:3466`) running the current code. Host is pinned to
`127.0.0.1` on purpose (see the safety note below). Override the port with
`-- --port 3500` or `POETICS_PORT=3500` if you must.

## Why operator surfaces are gated

Both expose **unauthenticated, metered, money-spending endpoints**. In the
poetics workbench alone (the code comments say so verbatim):

- `POST /admin/api/compose/live/turn` — a **real paid OpenRouter call per AI turn**
- `POST /admin/api/jobs` — a launcher that can **spawn paid generation/replay runs**
- `POST /admin/api/compose/live/save`, `POST /admin/api/jobs/:id/stop` — mutating controls

The eval dashboard additionally serves the `/pilot` participant surface, which
has its own isolation requirement before any non-localhost exposure.

Binding any of this to a public interface puts paid-LLM spend and a job runner
in front of the entire internet. **Auth (or a network gate) is required before
any non-localhost deployment.** This is a standing decision (2026-06-04), and
the tooling is built to honor it — `serve-poetics-browser.mjs` pins the host to
`127.0.0.1` so the footgun isn't one keystroke away.

As of 2026-06-06 that requirement is **enforced in code**, not just by
convention. Both servers use the shared guard in `services/httpBasicAuth.js`:

- eval dashboard: credentials present → basic-auth is enforced on every request;
- poetics workbench: credentials present → `/admin/*` is basic-auth protected
  while read-only pages remain public;
- no credentials + localhost bind → open (frictionless local dev, unchanged);
- no credentials + **non-local bind → the process refuses to start** (the guard
  resolver throws before `app.listen`).

So there is no runtime path that exposes a public interface with an open door.
Credentials come from `POETICS_AUTH_USER`/`POETICS_AUTH_PASS` and
`EVAL_AUTH_USER`/`EVAL_AUTH_PASS`, each falling back to shared
`MS_AUTH_USER`/`MS_AUTH_PASS`. Tests: `services/__tests__/httpBasicAuth.test.js`.

---

## Path A — static snapshot (SAFE, already in use) ✅

The clean, existing path publishes a **static snapshot**, never the live server.
This is how the dramatic-recognition arc is already public:

> **Live:** https://machinespirits.org/content/articles/ai-tutor/dramatic-recognition-arc.html

### How it works

`notes/poetics/publish-arc-to-site.js` (`npm run poetics:publish-arc`):

1. bundles the source HTML into a self-contained standalone (CSS+JS inlined),
2. **public-ises it** — strips the localhost `:3466` live-data layer (beacon,
   run-count deeplinks, TOC readouts) so the page is a static snapshot with no
   dependency on a running server,
3. stages it into **`../machinespirits-content-philosophy/articles/ai-tutor/`**
   (NOT the website repo directly),
4. that repo's `./publish` fires a `content-updated` GitHub dispatch, which
   triggers the website's fly redeploy.

```bash
npm run poetics:publish-arc -- --dry-run    # print the plan, write nothing
npm run poetics:publish-arc                 # stage only (no deploy)
npm run poetics:publish-arc -- --publish    # stage + ./publish (DEPLOYS LIVE — human-gated)
```

Serves at the static content path `/content/articles/ai-tutor/<slug>.html`
(same as `geist-explained.html`), not an `/essays/` route. Unknown routes on the
site soft-200 to the homepage, so **verify a publish by grepping page content,
not the HTTP status.**

### To snapshot another view

The same bundler (`notes/poetics/package-standalone.js`) can publicise any
self-contained workbench page. A read-only `/browse` or `/rubric` snapshot is a
safe candidate; the live, money-spending pages (`/runs`, `/compose/live`) are
not — there's nothing to snapshot there but the controls, and the controls are
the hazard.

---

## Path B — the live workbench, public at machinespirits.org/poetics 🟡

Making the live workbench reachable at machinespirits.org (so others can drive
compose / browse traces interactively) is a real option, and the chosen shape is
an **in-process mount into the existing website** — one fly app
(`my-website-dtq0ia`), one process, the URL `machinespirits.org/poetics` — *not*
a separate fly app. **Step 1 (the auth prerequisite) shipped 2026-06-06** and
**Step 2 (the in-process integration) is built**; what remains are the
account-owner commands (upload the DB, deploy). Until those run, no public live
URL exists.

### Step 1 — gate the metered + mutating surfaces ✅ (DONE)

Shipped the bind-tied auth prerequisite so it can't be forgotten on a public
deploy (see "Why these servers are localhost-only" above and
`services/httpBasicAuth.js`). The current poetics shape is public-read,
admin-write: read-only pages and GET APIs stay public under `/poetics`, while
metered or mutating controls live under `/poetics/admin/*` and require Basic
Auth. Legacy public tool pages (`/poetics/runs`, `/poetics/compose/live`) redirect
to `/poetics/admin/*`; legacy public tool APIs do not execute. To run a server
authenticated:

```bash
# poetics workbench, public bind, with /admin/* behind basic-auth
POETICS_AUTH_USER=… POETICS_AUTH_PASS=… \
  node scripts/browse-poetics-scripts.js --host 0.0.0.0 --port 8080

# eval dashboard, same shape
EVAL_AUTH_USER=… EVAL_AUTH_PASS=… HOST=0.0.0.0 PORT=8080 STANDALONE=true node server.js
```

On fly, the credentials are set as app secrets (`fly secrets set …`), never
baked into the image. Two alternatives were considered and deferred — **(b)** a
network gate (Cloudflare Access / Tailscale, no in-app auth) and **(c)** shared
identity via the website's `AUTH_DB` (`/data/lms.sqlite`). Basic-auth on
`/poetics/admin/*` is the smallest sufficient gate for the current operator
surfaces; revisit (b)/(c) only if the audience or product requirements change.

### Step 2 — mount the workbench in-process at `/poetics` ✅ (built)

The workbench is folded into the website as a `/poetics` sub-app — one fly app
(`my-website-dtq0ia`), one Node process, the URL `machinespirits.org/poetics`.
Three website-side files (`../machinespirits-website`) do it:

- **`services/poeticsMount.js`** — the mount. Dynamically imports the eval repo's
  `createPoeticsBrowserApp` factory and registers it under `/poetics` with
  `app.use`. It mounts *only* when basic-auth creds are present, copies the DB to
  an ephemeral path first (below), and rewrites the workbench's absolute
  same-origin URLs (`/api…`, `<a href="/browse">`, `url(/…)`) to sit under
  `/poetics`. The whole thing is wrapped in try/catch: a missing DB, a broken
  checkout, or a failed import degrades to "/poetics absent" and never takes the
  main site down.
- **`server.js`** — one line, `await mountPoetics(app)`, placed before the SPA
  catch-all so `/poetics/*` resolves to the sub-app rather than `index.html`.
- **`Dockerfile`** — a clone block (after the website's own build/prune) that
  `git clone`s the eval repo at `POETICS_REF` (default `main`) into
  `/app/poetics-src`, runs `npm install --omit=dev`, and sets `POETICS_SRC`.
  The clone/install is fatal: a broken checkout aborts the website image build
  rather than silently shipping a dark `/poetics`.

**Code arrives by git clone at build time** — the workbench source is *not*
vendored into the website repo. Bump `POETICS_CACHE_BUST` to force a fresh clone;
point `POETICS_REF` at another branch or tag to move the pinned snapshot. The
clone carries whatever the branch git-tracks (so push your poetics work before
deploying).

**The DB is a frozen volume snapshot, copied to ephemeral at boot.** The live DB
at `data/evaluations.db` is a symlink outside the repo (it points at
`~/.machinespirits-data/`), so it can't ride along in the clone. Instead
`poetics:stage-deploy-db` writes a consistent snapshot to `deploy/evaluations.db`
(SQLite online backup, ~270 MB), you upload it once to the website's fly volume
at `/data/poetics/evaluations.db`, and at boot `poeticsMount.js` copies it to
`/tmp/poetics/evaluations.db` and opens *that*. The store opens read-write (WAL
pragma + migrations), so opening the volume copy directly would mutate it —
hence the ephemeral copy. Writes through the deployed site (labels, saved
compositions) land in `/tmp` and vanish on restart; the volume snapshot stays
pristine. Re-upload to refresh the public corpus.

**⚠ The money-spending buttons are ARMED here — `/poetics/admin/*` is the gate.**
This is the load-bearing difference from a standalone deploy. The website already
holds live `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` secrets (its own features
use them), and an in-process sub-app inherits the same `process.env`. So once
`/poetics` mounts, `POST /poetics/admin/api/jobs` (spawns paid runs) and
`POST /poetics/admin/api/compose/live/turn` (a paid call per turn) are live for
authenticated admins — there is no "omit the API key to keep them inert" option
the way a separate app had. The basic-auth password is the barrier between the
public internet and your LLM bill for those admin routes. That is why
`poeticsMount.js` still refuses to mount without creds.

**Degraded views** — the clone carries only what the branch tracks, so:

- `logs/` is gitignored → not cloned → the disk-backed full-transcript
  drill-downs and replay bundles read missing files and come up empty. The
  DB-backed views (browse / atlas / rubric / ontology and in-DB previews) work
  normally from the uploaded snapshot.
- `docs/` and most of `exports/` and `config/poetics-calibration/` *are* tracked,
  so those views are largely intact (unlike the earlier separate-app plan, which
  excluded them via `.dockerignore`).

**Deploy sequence for shipping eval `main`** (account-owner command boundary:
Codex can prepare and verify the local artifacts, but the final Fly upload/deploy
is public, authenticated, and billable):

```bash
# 1. from the eval repo, make sure the code Fly will clone is current
cd /Users/lmagee/Dev/machinespirits/machinespirits-eval
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main

# 2. snapshot the DB → deploy/evaluations.db (~270 MB), from the eval repo
npm run poetics:stage-deploy-db

# 3. upload the snapshot to the website's fly volume (machine must be up)
cd /Users/lmagee/Dev/machinespirits/machinespirits-website
fly ssh console -a my-website-dtq0ia -C "mkdir -p /data/poetics"
fly ssh sftp put /Users/lmagee/Dev/machinespirits/machinespirits-eval/deploy/evaluations.db /data/poetics/evaluations.db -a my-website-dtq0ia

# 4. the password (you set this; shown for completeness — already done per your note)
fly secrets set POETICS_AUTH_USER=<you-pick> POETICS_AUTH_PASS=<you-pick> -a my-website-dtq0ia

# 5. deploy the website, forcing a fresh poetics clone from eval main
fly deploy -a my-website-dtq0ia \
  --build-arg POETICS_REF=main \
  --build-arg POETICS_CACHE_BUST=$(date +%s)
```

Live at `https://machinespirits.org/poetics` once the deploy completes; operator
tools are under `https://machinespirits.org/poetics/admin/`. No separate app, no
extra DNS, no new TLS cert — it shares the website's machine, volume, and
certificate.

### Refreshing the public corpus (data-only — no rebuild)

The public corpus is the **frozen volume snapshot**, not the live eval DB. Because
`poeticsMount.js` copies that snapshot to `/tmp` *at boot*, a running process keeps
serving whatever it copied last — so moving the corpus forward is a data-plane-only
loop of **re-run steps 2–3 (re-stage + re-upload) and restart**, with **no image
rebuild and no `fly deploy`**:

```bash
# 1. (re-)snapshot the current eval DB → deploy/evaluations.db, from the eval repo
npm run poetics:stage-deploy-db

# 2. re-upload the snapshot over the old one on the website's fly volume
cd /Users/lmagee/Dev/machinespirits/machinespirits-website
fly ssh sftp put /Users/lmagee/Dev/machinespirits/machinespirits-eval/deploy/evaluations.db /data/poetics/evaluations.db -a my-website-dtq0ia

# 3. restart so the boot-copy re-runs and picks up the new snapshot
fly apps restart my-website-dtq0ia
# (single machine instead of the whole app: fly machine restart 28675d9b394768 -a my-website-dtq0ia)
```

These are the same **steps 2–3** of the deploy sequence above, plus a restart.
The restart is the load-bearing part: skip it and the machine keeps serving the
previous `/tmp` copy until its next reboot. Step 1 (push) and step 5 (`fly deploy`)
are *not* needed here because no code changed.

To ship **newer workbench code** (not data), do the opposite — re-run steps 1 and
5 (confirm the target eval ref is pushed, then `fly deploy` with a fresh
`POETICS_CACHE_BUST`). A code deploy reboots the machine anyway, so it also
re-copies whatever snapshot is currently on the volume; you only need the
standalone restart above when the *data* changed but the *code* did not.

### Step 3 — the `/pilot` surface is a separate decision

`server.js`'s participant surface has its own isolation requirement (real-consent
gating, server isolation) tracked separately. Do not let a workbench deploy drag
the pilot surface public as a side effect.

---

## Summary

- **Local:** `npm run poetics:serve` → `http://127.0.0.1:3466` (canonical, idempotent).
- **Public static content:** Path A, already live for the arc; safe to extend to
  other read-only snapshots.
- **Public live workbench:** Path B, an **in-process `/poetics` mount into the
  website** (one fly app `my-website-dtq0ia`, URL `machinespirits.org/poetics`) —
  *not* a separate fly app. Step 1 (basic-auth tied to the bind) **landed
  2026-06-06**; a public bind without credentials refuses to start. Step 2 (the
  three website-side files — `services/poeticsMount.js`, one `server.js` line, a
  `Dockerfile` clone block) is **built**. What remains are the account-owner
  commands: confirm eval `main` is pushed, `poetics:stage-deploy-db` + sftp the
  snapshot to the volume, and `fly deploy -a my-website-dtq0ia` (public,
  billable). **The
  `/poetics/admin/*` password is the gate** — the website already holds the LLM
  keys, so the metered buttons are armed for authenticated admins the moment
  `/poetics` mounts. The earlier separate-app
  artifacts (`Dockerfile.poetics`, `fly.poetics.toml`, `.dockerignore`) were
  removed in favour of this shape. The eval dashboard (`server.js`) is *not*
  exposed — it drags the `/pilot` surface (Step 3). No live URL exists until the
  deploy runs.
