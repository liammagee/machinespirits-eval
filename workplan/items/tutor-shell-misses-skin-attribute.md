---
id: tutor-shell-misses-skin-attribute
title: The /tutor shell never receives data-skin, so it stays parchment
status: triaged
type: maintenance
priority: P3
owner: unassigned
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
parchment fallbacks — `--tutor-paper: var(--paper, #f4f0e6)` and ten more of the
same shape — and the page does link `/components/techne.css`, which carries the
two `:root[data-skin="stark"]` override blocks. So the token contract is
already correct. Only the attribute that triggers it is missing.

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

## Likely fix

Add `<script src="/components/rail-inject.js">` to the tutor shell, or lift the
early-apply into a small shared script both the rail and the static pages load.
The second is better if any other static surface is added later — the current
duplication between the inline rail script and `rail-inject.js` is what let this
slip in the first place.

Whichever way, keep the parchment fallbacks in `tutor/styles.css`: they are what
makes the page legible if `techne.css` fails to load.

## Log

- 2026-07-28 — Opened while clearing stale entries out of the memory index. The
  old note recorded this as a general "bespoke static pages don't re-skin" gap
  across `/chat`, `/pilot-admin` and `/adjudication`; checking each one against
  the current tree, all three are resolved and the gap has moved to `/tutor`,
  which did not exist in that form when the note was written.
