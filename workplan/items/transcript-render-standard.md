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

## Face-value demo shipped (2026-08-03)

User ask: a comparison a cold reader can see at face value — difficult
learner, volatile teacher, contemporary scene, no legalistic phrasing.
Built world-034 (The Flagged Paragraph: group project, plagiarism flag,
portal at nine, the chat ready to blame Jae; the real source is the
group lead's own notes sync) + a demo-tier stress schedule, ran bare
and full stack live (13 turns each, all six plants, leaks 0), and added
a third lane by frozen regeneration: a harried "reactive teacher"
costume (labeled control — snappish, says "calm down", pushes its own
conclusion). Sol-tagged, standing rulings by conduct: **reactive 0/5,
bare 1/5, full stack 4/5.** The reactive lane capitulates to the false
memory at t9 and re-argues evidence at the stake; bare re-argues at
the stake too; the full stack changes register at the mockery, credits
before correcting at the grievance, reopens the misremembered exhibit,
and splits the finding from her standing at the stake. Rendered
three-lane swimlane: `exports/demo34-three-lanes.{md,html}`; rows +
rulings beside it. Demo-tier: k=1, unratified schedule, one authored
costume lane.

## Demo regenerated under the repaired world (2026-08-03)

Fresh k=1 pair on the gate-passing world-034 (notes t3, diff-read t5,
sync t6), volatile lane rebuilt from the new bare seats, same tagger
and conduct rulings: **reactive 1/5, bare 4/5, full stack 5/5.** Two
notes. First: the full stack's turn-2 reply makes the FULL wager from
the sonnet seat, live — "does Jae's entry show the flagged paragraph's
actual words under that edit? If it does, send it" — the first sonnet
first-demand wager ever recorded; turn 2 collides with a clue
delivery, and the recovery-card fix is what lets the card survive the
retry there. Second: this bare dialogue was unusually strong (4/5 vs
its 8/15 world-030 record; its own t2 harnessed the deadline raw), so
the demo's between-lane gap is narrower than the k=3 benches — k=1
each way, demo-tier, read the lanes not the totals. First bare regen
folded at turn 7 before the late plants (one-dialogue variance;
re-rolled, all six landed). Files: exports/demo34b-three-lanes.{md,html}.
