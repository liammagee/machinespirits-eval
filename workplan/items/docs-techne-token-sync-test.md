---
id: docs-techne-token-sync-test
title: Test-enforce the techne token mirror (served subset vs editorial source)
status: done
type: infra
priority: P3
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "tests/techneTokenMirror.test.js fails on value drift between the served subset and the dashboard BASE_CSS (all four skin blocks) and between the shared dark palettes; the light-palette divergence is documented and guarded, not silently equalized."
branch: worktree-docs-coherence
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items: docs-coherence-structure
tags:
  - docs
  - design
  - tests
---

The survey flagged a `--paper` mismatch between the served subset
(`public/components/techne.css`) and the editorial design system
(`notes/poetics/assets/techne.css`), synced by comment only.

What measuring found (2026-08-05), which rewrote the goal:

- The served copy's own header claims to mirror the **dashboard's** inline
  BASE_CSS, not the editorial file — and against the dashboard it is already
  VALUE-equal in all four skin blocks. Every apparent diff was formatting
  (`.18` vs `0.18`, spacing) or same-value indirection
  (`--prussian: var(--indigo)` where `--indigo` holds the same hex).
- The editorial LIGHT palette differs wholesale (10 tokens: the whole
  paper/ink family) — a deliberate second tuning for long-form docs, not
  drift. The DARK palette is genuinely shared and equal.

Landed accordingly (`tests/techneTokenMirror.test.js`, in the hermetic
manifest): value-normalized comparison (whitespace, leading-zero decimals,
one level of `var()`), asserting (1) served == dashboard in `:root`, dark,
stark, stark-dark, with minimum shared-token floors so parsing breakage cannot
pass vacuously; (2) editorial dark == served dark; (3) the light palettes
STAY different — so equalizing them ever again must be a deliberate,
test-visible act. No palette value was changed.
