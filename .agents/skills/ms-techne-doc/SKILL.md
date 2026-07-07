---
name: ms-techne-doc
description: Create, edit, view, or package a "techne doc" — a hand-authored editorial HTML note (like the dramatic-recognition arc / "summary arc") built against the shared techne.css + techne.js framework. Use when asked to make, edit, update, rebuild, view, or share the arc note, the summary arc, or a new techne/editorial HTML note. These docs are edited as HTML directly — there is no build step.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Work on **techne docs** — hand-authored editorial HTML notes against a shared framework. Read the full convention first: `notes/poetics/TECHNE-DOCS.md`.

**Key fact: the `.html` IS the source — edit it directly. There is no build/compile step.** Design lives in `notes/poetics/assets/techne.css`; behaviour in `notes/poetics/assets/techne.js` (shared, guarded, opt-in by markup). Doc-specific *data* (chart numbers, glossary aliases) lives in the doc as `<script type="application/json">` blocks; the generic renderer/engine lives in `techne.js`.

## Tasks

**Make a new doc**
```bash
cp notes/poetics/techne-template.html notes/poetics/<name>.html
```
Then edit `<main>` and add each section's `id` to the rail nav. See TECHNE-DOCS.md for the component vocabulary and opt-in feature hooks.

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

**Publish the arc to machinespirits.org** (via the content-philosophy → Fly pathway)
```bash
npm run poetics:publish-arc -- --dry-run     # preview the plan, write nothing
npm run poetics:publish-arc                  # stage into ../machinespirits-content-philosophy
npm run poetics:publish-arc -- --publish     # stage + run ./publish (DEPLOYS LIVE, ~3-5 min)
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
