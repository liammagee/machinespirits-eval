---
name: ms-techne-doc
description: Create, edit, inspect, or package a hand-authored techne HTML note using the shared techne.css and techne.js framework. Publishing is a separate external action and requires an explicit publish request plus confirmation after a dry-run.
---

Work on **techne docs** — hand-authored editorial HTML notes against a shared framework. Read the full convention first: `notes/poetics/TECHNE-DOCS.md`.

**Key fact: the `.html` IS the source — edit it directly. There is no build/compile step.** Design lives in `notes/poetics/assets/techne.css`; behaviour in `notes/poetics/assets/techne.js` (shared, guarded, opt-in by markup). Doc-specific *data* (chart numbers, glossary aliases) lives in the doc as `<script type="application/json">` blocks; the generic renderer/engine lives in `techne.js`.

## Tasks

**Make a new doc**

Read `notes/poetics/techne-template.html`, create the requested file with
`apply_patch`, then edit `<main>` and add each section's `id` to the rail nav.
See TECHNE-DOCS.md for the component vocabulary and opt-in feature hooks.

**Edit**
- Content → edit the doc's `.html` directly (no rebuild; just reload).
- Design → `assets/techne.css`. Behaviour → `assets/techne.js` (affects every doc; keep new features guarded so they stay safe on docs lacking that markup).

**View**
- Offline / anywhere: open the `.html`.
- Live (beacon + run-count deeplinks): `npm run poetics:browse`, then `http://127.0.0.1:3466/arc`.

**Package a portable single file** (sharing / remote viewing)
```bash
node notes/poetics/package-standalone.js notes/poetics/<name>.html   # → <name>.standalone.html
npm run poetics:package-arc                                          # arc shortcut
```

**Publish the arc to machinespirits.org** (only on an explicit publish request)
```bash
npm run poetics:publish-arc -- --dry-run     # preview the plan, write nothing
```

The dry-run is inspection only. Staging writes to a sibling repository and
`--publish` deploys externally; after showing the dry-run, obtain immediate
confirmation for the exact next action. Do not infer staging or deployment
authority from a request to create, edit, view, package, rebuild, or share a
local file. Do not probe this publisher with unknown flags or `--help`; its
current parser does not fail closed on unknown options.

After confirmation, use exactly one of:

```bash
npm run poetics:publish-arc                  # stage only
npm run poetics:publish-arc -- --publish     # stage and deploy live
```
The note is published like the other `ai-tutor` explainers (e.g. `geist-explained.html`):
a self-contained, public-ised HTML article dropped into
`../machinespirits-content-philosophy/articles/ai-tutor/`, whose `./publish` triggers
the website's Fly redeploy. Live URL (the static content path, same as `geist-explained.html` —
**not** an `/essays/` route): `https://machinespirits.org/content/articles/ai-tutor/dramatic-recognition-arc.html`.
The script bundles the standalone, neutralises the localhost `:3466` live layer
(`--live-base URL` to instead point at a deployed browser), writes a metadata
frontmatter stub `.md` *before* the `.html` (so `./build` never clobbers it), and
copies the referenced cartoon PNGs. **The outward deploy is human-gated — only `--publish` pushes.**

## Reference
- Convention + component vocabulary + opt-in feature table: `notes/poetics/TECHNE-DOCS.md`
- Canonical example (every component + both charts): `notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html`

## Gotchas
- Selectors in `techne.css`/`techne.js` are class-based (`.s`, `.gl-term`), not tag-based — keep them that way so components survive tag changes.
- The connected `:3466/arc` view needs the poetics browser to serve `/assets` (route in `scripts/browse-poetics-scripts.js`); restart it after asset changes.
- A new doc must sit beside `assets/` (in `notes/poetics/`) so the relative `assets/…` links resolve.
- Visually inspect edited/package output at desktop and mobile widths.
- A claim-bearing techne doc inherits from one canonical paper. Verify every
  numeric/empirical statement against `docs/research/paper-full-2.0.md` and use
  `paper-claim-auditor` after substantive claim or caption edits.
- Use `$ms-theory-synthesis` for the dedicated theory surface; this skill owns
  the general HTML framework and packaging behavior.
