---
name: build-arc
description: Rebuild the dramatic-recognition arc note (the summary HTML) from its markdown source via the pandoc pipeline. Use when asked to rebuild, regenerate, or update the arc note / "summary arc" / dramatic-recognition arc page, or to view it. Edit content in arc.md — never the generated .html.
allowed-tools: Bash, Read, Edit, Grep, Glob
---

Rebuild the dramatic-recognition arc note — a self-contained editorial HTML summary of the poetics arc — from its markdown source. Content and design are decoupled, mirroring the paper's md→PDF build.

## Source files (in `notes/poetics/`)

- `arc.md` — **the content you edit.** Markdown prose + pandoc fenced divs (`::: {.class}`). Five widget-heavy sections (hero, glossary, evidence, ending-shape, adaptation) are raw-HTML islands inside fenced `{=html}` blocks, because they carry JS-rendered charts, the filter grid, the glossary tooltip list, transcripts, and accordions that markdown can't express.
- `arc.template.html` — the chrome/layout shell (`$body$` slot).
- `assets/techne.css` — the design system.
- `assets/arc.js` — behaviour (theme toggle, scroll-spy, JS charts, live-data hydrate, glossary tooltips).
- `build-arc.sh` — the pandoc build (wrapped by the npm script below).

## Steps

1. **Build:**
   ```bash
   npm run poetics:build-arc
   ```
   This regenerates BOTH outputs (never hand-edit either — they are overwritten on every build):
   - `notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html` — styled doc; links `assets/techne.css` + `assets/arc.js`.
   - `notes/poetics/arc-standalone.html` — self-contained portable copy (CSS + JS inlined, fonts via CDN); opens anywhere with no server.

2. **Report** the build result and both output paths.

## Editing

- **Content** → `notes/poetics/arc.md`. Prose is plain markdown; components are fenced divs; the 5 widget sections are raw-HTML islands (edit as HTML inside the `{=html}` fence).
- **Design** → `assets/techne.css`. **Behaviour** → `assets/arc.js`. **Chrome** → `arc.template.html`.
- Do NOT edit the generated `.html` files — `build-arc.sh` overwrites them.

## Viewing

- **Connected / live** (beacon + run-count deeplinks): `http://127.0.0.1:3466/arc` — needs the poetics browser running (`npm run poetics:browse`), which statically serves `/assets`, `/images`, `/docs/research`.
- **Anywhere / offline / remote**: open `notes/poetics/arc-standalone.html`. The live beacon/deeplinks degrade to "offline/static" (expected); all content, design, charts, theme toggle, and filters still work.

## Gotchas

- The `.html` is a **build artifact** — edits there vanish on the next build. Source of truth = `arc.md` + template + assets.
- Pandoc rewrites semantic tags (`<section>`→`<div>`, `<dfn>`→`<span>`) and strips classes off `<p>`. That's why selectors in `techne.css`/`arc.js` are **class-based** (`.s`, `.gl-term`, not `section.s`/`dfn.gl-term`) and `build-arc.sh` pre-converts classed `<p>`→`<div>` and `<cite>`→`<span>`. When adding a component, prefer a class-based selector + a fenced div; if it's chart/transcript/filter-like, make it a raw-HTML island.
- For the connected view to load styling, the poetics browser must serve `/assets` (route in `scripts/browse-poetics-scripts.js`); restart it (`npm run poetics:browse`) after asset changes.
