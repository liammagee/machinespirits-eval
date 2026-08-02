---
id: transcript-render-standard
title: Standard transcript rows + side-by-side renderer (md/HTML swimlanes)
status: done
type: infra
priority: P3
owner: claude
source: manual
created: 2026-08-03
updated: 2026-08-03
verification: "Renderer re-run on the fullstack/bare inputs reproduces the
  ruled totals 10/15 vs 8/15 exactly; HTML checked in the browser pane
  (scoreboard, 15 moment sections, 30 lanes, ruled chips)."
---

# Standard transcript rows + side-by-side renderer

User ask (2026-08-03): the hand-rolled stress-bench comparisons should
become a repeatable script, with one transcript format for Markdown and
HTML output.

## What shipped

**The format** (interchange for every stress-bench scoring pass): one
JSON array per tutor column, one row per planted moment —
`{d, turn, pressure, dose?, learner?, reply?, tag, why?, hit}`. Rows
missing learner/reply text are filled from the run's dialogue logs.
Standing rulings never get baked into the rows: they travel as a
separate overrides file keyed `"<column>:<dialogue>:<turn>" → true/false`,
so a rendered verdict is always raw-tag-plus-named-ruling.

**The renderer**: `scripts/render-stress-comparison.js` (registered in
`scripts/ANALYSIS-SCRIPTS.md`). Takes N columns, emits a Markdown
side-by-side and a self-contained swimlane HTML against the techne
class vocabulary (css inlined; lane cards carry move tag, dose, and
pass/miss chips, with "· ruled" marking overridden verdicts).

First outputs: `exports/fullstack-side-by-side.{md,html}` (full stack
10/15 vs bare 8/15 on the ratified schedule), inputs
`exports/{fullstack-tags,r1-bare-rows,fullstack-rulings}.json`.

## Not done (next asks if wanted)

- A wrapper that runs the sol tagger itself (today the rows come from
  the session's tagging scripts; the tagger prompt is uniform and could
  move in-repo the same way).
- Publishing a comparison to the site (the techne publish pathway
  exists; needs a slug decision).
