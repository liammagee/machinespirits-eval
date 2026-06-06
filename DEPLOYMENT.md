# Deployment — eval servers ↔ machinespirits.org

How the two Node servers in this repo relate to the public site, what is safe to
publish today, and the gate on everything else. Read this before exposing
anything on a non-localhost interface.

## The three moving parts

| Thing | What it is | Where it runs | Auth |
|-------|-----------|---------------|------|
| **Eval dashboard** — `server.js` (`npm start` → `STANDALONE=true node server.js`) | pilot participant surface, eval DB browser, run launchers | localhost (default `127.0.0.1`) | **basic-auth, bind-tied** — open on localhost, required on any public bind |
| **Poetics workbench** — `scripts/browse-poetics-scripts.js` (`npm run poetics:serve`, :3466) | generated-script browser, compose, live sit-in, run launcher | localhost (`127.0.0.1`) | **basic-auth, bind-tied** — open on localhost, required on any public bind |
| **The website** — `../machinespirits-website` | Vite + Node app, the actual machinespirits.org | fly.io app `my-website-dtq0ia` (region `lax`, `internal_port 8080`), CI deploy via `.github/workflows/deploy.yml` | **yes** — `AUTH_DB_PATH=/data/lms.sqlite` |

The eval dashboard and the poetics workbench are **internal tools built on a
localhost trust model**. The website is a separately-deployed, auth-bearing
product. They are not the same kind of thing, and the first two are not drop-in
deployable to the third.

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

## Why these servers are localhost-only

Both expose **unauthenticated, metered, money-spending endpoints**. In the
poetics workbench alone (the code comments say so verbatim):

- `POST /api/compose/live/turn` — a **real paid OpenRouter call per AI turn**
- `POST /api/jobs` — a launcher that can **spawn paid generation/replay runs**
- `POST /api/compose/live/save`, `POST /api/jobs/:id/stop` — unauthenticated mutations

The eval dashboard additionally serves the `/pilot` participant surface, which
has its own isolation requirement before any non-localhost exposure.

Binding any of this to a public interface puts paid-LLM spend and a job runner
in front of the entire internet. **Auth (or a network gate) is required before
any non-localhost deployment.** This is a standing decision (2026-06-04), and
the tooling is built to honor it — `serve-poetics-browser.mjs` pins the host to
`127.0.0.1` so the footgun isn't one keystroke away.

As of 2026-06-06 that requirement is **enforced in code**, not just by
convention. Both servers mount the shared guard in `services/httpBasicAuth.js`:

- credentials present → basic-auth is enforced on every request;
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

## Path B — the live server, public (auth gate landed; deploy is the remaining step) 🟡

Making the live workbench itself reachable at machinespirits.org (so others can
drive compose / browse traces interactively) is a real option. **Step 1 (the
auth prerequisite) shipped 2026-06-06**; what remains is the deploy itself
(Step 2). Until that is run, no public live URL exists.

### Step 1 — gate the metered + mutating surfaces ✅ (DONE)

Shipped **option (a), whole-server basic-auth**, bind-tied so it can't be
forgotten on a public deploy (see "Why these servers are localhost-only" above
and `services/httpBasicAuth.js`). The guard sits in front of *every* route —
simpler and safer than gating individual endpoints, since a read-only GET on
this surface still leaks the eval DB. To run a server authenticated:

```bash
# poetics workbench, public bind, behind basic-auth
POETICS_AUTH_USER=… POETICS_AUTH_PASS=… \
  node scripts/browse-poetics-scripts.js --host 0.0.0.0 --port 8080

# eval dashboard, same shape
EVAL_AUTH_USER=… EVAL_AUTH_PASS=… HOST=0.0.0.0 PORT=8080 STANDALONE=true node server.js
```

On fly, the credentials are set as app secrets (`fly secrets set …`), never
baked into the image. Two alternatives were considered and deferred — **(b)** a
network gate (Cloudflare Access / Tailscale, no in-app auth) and **(c)** shared
identity via the website's `AUTH_DB` (`/data/lms.sqlite`). Basic-auth is the
smallest sufficient gate; revisit (b)/(c) only if the audience or product
requirements change.

### Step 2 — deploy as its own fly app (do NOT fold into the website container)

- New `fly.toml` + `Dockerfile` for a `machinespirits-poetics` app; bind
  `0.0.0.0:8080` inside the container (`--host 0.0.0.0 --port 8080`); the Step-1
  gate is what makes that bind safe.
- Expose at a subdomain (`poetics.machinespirits.org`) via a fly cert, or
  reverse-proxy a path from the website. Keep it a separate app so its blast
  radius (paid runs, the eval DB) never shares the website's volume or identity.
- The eval DB and dialogue logs it reads are large and currently local; decide
  whether the deployed instance ships a read-only snapshot DB or mounts a volume.

### Step 3 — the `/pilot` surface is a separate decision

`server.js`'s participant surface has its own isolation requirement (real-consent
gating, server isolation) tracked separately. Do not let a workbench deploy drag
the pilot surface public as a side effect.

---

## Summary

- **Local:** `npm run poetics:serve` → `http://127.0.0.1:3466` (canonical, idempotent).
- **Public static content:** Path A, already live for the arc; safe to extend to
  other read-only snapshots.
- **Public live workbench:** Path B. Step 1 (bind-tied basic-auth) **landed
  2026-06-06**; a public bind without credentials now refuses to start. The
  remaining work is Step 2 — packaging each server as its own fly app and
  running the deploy. No live URL exists until that is done.
