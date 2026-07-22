# techne docs — the convention

Editorial HTML notes (like the dramatic-recognition arc) authored **directly as HTML**
against a shared design + behaviour framework. There is **no build step**: the `.html`
file *is* the source. Design is decoupled from content by living in separate asset files,
so a content edit can never clobber the design.

> Why not a markdown→HTML pipeline? We tried one. These docs are component-heavy
> (JS charts, filter grids, glossary tooltips, transcripts) — closer to a small
> dashboard than an essay — so a markdown source ends up ~⅓ raw-HTML islands and
> fights the converter. For *prose-first* notes, prefer markdown. For these, edit HTML.

## Files (all in `notes/poetics/`)

| File | Role |
|------|------|
| `assets/techne.css` | **Design system** — the techne palette, type scale, every component's styling. Shared by all docs. |
| `assets/techne.js` | **Behaviour** — theme toggle, reading progress, section spy, TOC drawer, filter chips, glossary tooltips, live-data beacon, bar charts. Shared; every feature is **guarded + opt-in by markup**, so it's safe on any doc. |
| `techne-template.html` | **Skeleton** to copy for a new doc. |
| `package-standalone.js` | Optional: inline the assets into one portable file for sharing / remote viewing. |
| `<your-doc>.html` | Each doc — the **source of truth**, edited directly. Must be a sibling of `assets/` so the relative `assets/…` links resolve. |

## Make a new doc

```bash
cp notes/poetics/techne-template.html notes/poetics/my-note.html
# edit <main> in my-note.html; add sections to the rail nav
```

## Edit

Open `my-note.html` and edit the HTML. That's it — no rebuild. Reload the browser.
Edit **design** in `assets/techne.css`, **behaviour** in `assets/techne.js` (changes apply to every doc).

### Optional public-site skin

Add `data-skin="machine-spirits"` to the root `<html>` element when a public note
should match the main website's Swiss / neo-brutalist design. The skin uses the
site's black, white, and `#E63946` red palette, Space Grotesk + Space Mono type,
hard borders, grid ground, and offset shadows. It is opt-in; notes without the
attribute keep the parchment editorial skin. The older `data-skin="stark"` skin
remains available for dashboard framing.

## View

- **Anywhere / offline**: open the `.html` file directly.
- **Connected / live** (beacon + run-count deeplinks): serve via the poetics browser —
  `npm run poetics:browse`, then `http://127.0.0.1:3466/arc` (it static-serves `/assets`).
  The live layer only activates if the doc has a `#beacon`; otherwise it's inert.

## Package for sharing / remote

```bash
node notes/poetics/package-standalone.js notes/poetics/my-note.html
# → notes/poetics/my-note.standalone.html  (CSS+JS inlined; fonts via CDN; opens anywhere)
```
For the arc specifically: `npm run poetics:package-arc`.

## Component vocabulary (CSS classes in techne.css)

- **Layout**: `section.s` (a numbered section) → `.diag` grid of `.ml` (the giant `.s__num`), `.body`, `.mr` (a marginal `.note`). `.shell` wraps the sections; `.hero` is the masthead.
- **Headings**: `.s__kicker` (mono eyebrow), `.s__h` (serif heading; `<em>` inside goes brick-red).
- **Components**: `.claim` (`.claim__no` / `.claim__h` / `.claim__body` / `.claim__counter`), `.note` (`.note--moss/--ochre/--ink` + `.note__lbl`), `.pq` (pull-quote + `<cite>`), `.chip` (`.chip--moss/--ochre/--brick/--ink`), `.callout`, `.timeline`, `.ladder`, `.spec`/`.spec-box`, `.ev-grid`/`.ev-card[data-status][data-tags]`, `.deeplink`, `.glossary`/`.gl-row`, `.accordion`.
- **Selectors are class-based** (`.s`, `.gl-term`) not tag-based — so components keep working regardless of the underlying tag.

## Opt-in JS features (markup that turns each on)

| Feature | Markup hook |
|---------|-------------|
| Theme toggle | `#themeToggle` button |
| Reading progress | `#railProgress` |
| Section spy | `.rail__nav a` whose `href` points at section `id`s |
| TOC drawer | `#toc` (+ `#tocToggle`, `#tocClose`, `#tocScrim`) |
| Filter chips | `[data-filter]` buttons + `.ev-card[data-tags]` |
| Glossary tooltips | `#glossaryList` (+ `.gl-row`) and inline `.gl-term`; optional aliases via `<script type="application/json" id="techne-gloss-aliases">{ "inline term": "glossary-key" }</script>` |
| Live data beacon | `#beacon` (probes the poetics browser at `:3466`) |
| Bar chart | `<svg class="chart" id="X">` + `<script type="application/json" class="techne-chart" data-target="X">{ "metrics":[…], "arms":[…] }</script>` |

**Content vs code**: doc-specific *data* (chart numbers, gloss aliases) lives in the doc as
JSON `<script>` blocks; the generic *renderer/engine* lives in `techne.js`.

## Reference example

`2026-05-26-paper-to-dramatic-recognition-arc.html` is the canonical techne doc — read it
to see every component and both charts in use.
