---
id: tutor-shell-misses-skin-attribute
title: The /tutor shell never receives data-skin, so it stays parchment
status: done
type: maintenance
priority: P3
owner: claude
source: review
created: 2026-07-28
updated: 2026-07-28
verification: >-
  Loading /tutor with poetics-skin unset or set to stark shows the stark palette,
  matching a server-rendered page opened in the same browser; switching to
  parchment in the tweaks panel and reloading /tutor shows parchment; the tutor
  tokens still resolve when techne.css is absent.
links:
  items:
    - scriptorium-static-tools-desktop-quality
tags:
  - ui
  - scriptorium
  - skins
---

## Problem

The whole app defaults to the stark skin. `/tutor` does not, because nothing
ever sets `data-skin` on its document element.

`poetics-skin` is read in exactly two places: the rail's inline early-apply
script for server-rendered pages (`scripts/browse-poetics-scripts.js:2757`) and
`public/components/rail-inject.js:31` for static pages that include it.
`public/tutor/index.html` is served straight off disk by `express.static` and
includes neither, so the attribute is never written.

`public/tutor/styles.css` derives its own tokens from the techne ones with
parchment fallbacks — six of them, `--tutor-paper: var(--paper, #f4f0e6)` and
the same shape for panel, ink, muted, rule and accent — and the page does link
`/components/techne.css`, which carries the two `:root[data-skin="stark"]`
override blocks. So the token contract is already correct. Only the attribute
that triggers it is missing.

This matters more than it did when the gap was first noted against `/chat`:
`/chat` now 302s to `/tutor?mode=research` (`services/evalSurfaces.js:105`), so
the tutor shell is the research workbench, not a side surface.

## What is already fine

- `public/pilot-admin/index.html` — 53 hex literals, all of them inside `:root`
  token blocks, and the file carries its own two stark blocks. Re-skins.
- `public/adjudication/index.html` — 3 hex literals, all `var(--brick, #a33)`
  fallbacks, and it links `components/techne.css`. Re-skins.
- `public/pilot/index.html` — participant-facing, deliberately outside the
  researcher chrome. Leave it.

So the audit that this item came from is otherwise clean; `/tutor` is the one
surface left.

## What changed

`public/tutor/index.html` now loads `/components/rail-inject.js` with
`data-active="tutor" data-compact`, matching its three sibling surfaces. That
script was written for these four pages — its own header names `/tutor` as the
reason `data-compact` exists — so this restores an intended include rather than
adding a mechanism. The skin comes with it, and so does the shared nav rail.

The tag sits **above** `app.js`, and the comment above it says why. Both scripts
are deferred and run in document order. `app.js` owns `data-theme` on this page,
reading its own `machinespirits.theme` key rather than the dashboard's
`poetics-theme`, so it has to run last or the rail's theme read would fight it.

`tests/staticSurfaceRailContract.test.js` pins the contract: every static surface
in `STATIC_SURFACES` that isn't on a small annotated skip list must load
rail-inject, rail-inject must still write `data-skin` and default to stark, and
the tutor tokens must keep their parchment fallbacks. `STATIC_SURFACES` is now
exported from `services/evalSurfaces.js` so the test reads the real list instead
of a copy. A missing `<script>` was invisible to every other test in the suite,
which is how this lasted.

## Evidence

Checked in the browser against the dev server on :3466.

- Skin unset: `data-skin="stark"`, `--tutor-paper` resolves to `#FFFFFF`, body
  background white, rail present with "tutor lab" as the current item.
- `poetics-skin` set to parchment: attribute absent, parchment palette back.
- Theme untouched: with `machinespirits.theme` set to dark the page stayed dark
  and the button still read "Theme: dark", so the rail did not take it over.
- Stylesheet disabled at runtime: the six tutor tokens fall back to `#f4f0e6`,
  `#17201d`, `#41664f` and the rest, so the page survives techne.css failing.
- No console errors.

The new test fails against the previous commit — `git show HEAD:public/tutor/index.html`
has no rail-inject reference at all.

## Log

- 2026-07-28 — Opened while clearing stale entries out of the memory index. The
  old note recorded this as a general "bespoke static pages don't re-skin" gap
  across `/chat`, `/pilot-admin` and `/adjudication`; checking each one against
  the current tree, all three are resolved and the gap has moved to `/tutor`,
  which did not exist in that form when the note was written.
- 2026-07-28 — Fixed and closed. The card first said the stylesheet had eleven
  derived tokens; it has six.
