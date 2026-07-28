---
id: tutor-shell-missing-nav-rail
title: /tutor is the only researcher surface with no nav rail
status: triaged
type: maintenance
priority: P3
owner: unassigned
source: review
created: 2026-07-28
updated: 2026-07-28
verification: >-
  Opening /tutor shows the same rail the other researcher surfaces carry, with
  "tutor lab" marked as the current destination; the tutor's own theme button
  still works and the page does not lose data-theme; a test that reads the
  surface list from the mounter fails if any researcher surface drops the rail.
links:
  code:
    - public/tutor/index.html
    - public/components/rail-inject.js
    - services/evalSurfaces.js
    - tests/staticSurfaceSkin.test.js
  items:
    - tutor-shell-misses-skin-attribute
    - scriptorium-static-tools-desktop-quality
tags:
  - ui
  - scriptorium
  - navigation
---

## Problem

`/tutor` is a dead end. Every other page's rail links *to* it — the nav table in
`scripts/browse-poetics-scripts.js` carries a `tutor` entry pointing at
`/tutor?mode=research`, labelled "tutor lab", sitting in the "make" group — but
the page itself has no rail, so there is no way back out except the browser's
back button or the wordmark.

The three sibling static surfaces all load the rail:

- `public/adjudication/index.html` — `data-active="adjudicate"`
- `public/human-coding-admin/index.html` — `data-active="human-coding-admin"`
- `public/pilot-admin/index.html` — `data-active="pilot-admin"`

`public/tutor/index.html` does not. `/pilot` is participant-facing and stays out
of the researcher chrome on purpose.

This is navigation only. The skin is already fixed: `fa261a9c` gave all four
surfaces `components/skin-early-apply.js` in `<head>`, so `/tutor` re-skins.

## Why it lasted

Two comments in the tree say `/tutor` should have the rail, and neither is
checked by anything.

`public/components/rail-inject.js` names `/tutor` in its usage example and
documents `data-compact` as existing for pages whose chrome already carries a
brand mark. The `/_nav.html` route comment
(`scripts/browse-poetics-scripts.js:1311`) names `/tutor` first in the list of
static surfaces meant to fetch the shared rail.

A missing `<script>` tag is invisible to every test in the suite. The closest
one, `tests/staticSurfaceSkin.test.js`, checks the skin rather than the nav, and
keeps its own hardcoded four-item surface list rather than reading the mount
table, so a new surface can ship outside both contracts without failing anything.

## Likely fix

Add the include to `public/tutor/index.html`, before `</body>`:

```html
<script src="/components/rail-inject.js" data-active="tutor" data-compact defer></script>
```

**It must sit above the `app.js` module script.** Both are deferred and run in
document order, and `app.js` owns `data-theme` on this page, reading its own
`machinespirits.theme` key rather than the dashboard's `poetics-theme`
(`public/tutor/app.js:1235`). Running the rail first lets `app.js` win. Checked
in the browser: with `machinespirits.theme` set to dark the page stayed dark and
the button still read "Theme: dark".

Those two keys are a real inconsistency, but merging them is a separate decision
and not needed here.

For the test, export the mount list from `services/evalSurfaces.js` and derive
the surfaces from it, with a short skip list carrying a stated reason per entry,
so the check cannot drift from what is actually mounted.

## Log

- 2026-07-28 — Split off from `tutor-shell-misses-skin-attribute`. That card was
  fixed on main by `fa261a9c`, which gave all four surfaces the skin early-apply
  in `<head>`. A parallel branch had instead added `rail-inject.js` to `/tutor`,
  which would have brought the skin *and* the nav; it was closed as superseded
  ([#333](https://github.com/liammagee/machinespirits-eval/pull/333)) because it
  applied the skin from a deferred script, so the page painted parchment and then
  snapped to stark. The nav half of that branch is the gap recorded here.
