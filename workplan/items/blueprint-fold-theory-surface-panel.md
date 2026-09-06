---
id: blueprint-fold-theory-surface-panel
title: "Add the wins-and-losses panel and the theorist table to the /theory surface"
status: done
type: content
priority: P3
owner: claude
source: manual
created: 2026-09-05
updated: 2026-09-05
claim_status: methods
verification: >-
  The theory synthesis page carries two new blocks: a wins-and-losses panel
  built on the three sorting questions, and the theorist table of §3. Every
  `data-ref` in the new blocks points at a file that exists, so
  `npm run theory:check` exits 0. The provenance band is re-stamped at the
  paper version in force. The page is read in a browser after the change, and
  the panel's counts are read back from the paper and not typed by hand.
links:
  notes:
    - notes/2026-09-04-theoretical-blueprint.md
    - notes/poetics/theory-synthesis.html
  code:
    - scripts/refresh-theory-synthesis.js
  paper:
    - "docs/research/paper-full-2.0.md §3, §7.12, §7.16, §6.31"
  items:
    - one-adaptive-tutor-plan-line
    - blueprint-fold-paper-3-scorekeeping
    - blueprint-fold-boundary-map-sorting-rule
tags:
  - content
  - techne
  - theory
---

**What this is.**

The fourth framing fold of §9 of `notes/2026-09-04-theoretical-blueprint.md`.
It is a change to the reference page at `/theory`, which is served from
`notes/poetics/theory-synthesis.html`. It waits on the user's word.

**Order of work.**

This card opens after the two paper folds land. The page inherits from the
paper and never states a claim first. Run the two paper cards first:
`blueprint-fold-paper-3-scorekeeping` and
`blueprint-fold-boundary-map-sorting-rule`.

**What goes in.**

- A panel that sorts the results of §6 by the three questions of §4 of the
  blueprint. Each row names the result, its section, what it adds, what it
  changes, and its endpoint. The refused rows name the question the result
  fails and the reason it failed.
- The theorist table of §3, once §3 carries it.

**What §6.31 now allows, and what it forbids.**

The panel must hold §6.31 in a row of its own, and that row must show a yes on
all three questions beside a fired kill rule. A panel that shows only wins under
a yes would teach the reader a rule the project's own last result breaks. The
row says that the board held the tutor inside its licence, that it did not move
either learner shape's channel, and that the claim is about conduct and is bound
to the models in the seats.

**Rules.**

Zero paid calls. The prose is written by hand; this is not a generated page.
Every count is read from the paper. Edit the page in place. Run
`npm run theory:synthesize` to re-stamp the band, then `npm run theory:check`.

**Done 2026-09-05.** `notes/poetics/theory-synthesis.html` carries a new section 08, *Three questions sort the wins*, with the sorting panel (carried results, refused results with the question each fails, the §6.30 subtraction row that answers yes to all three and is still refused, and §6.31 as the worked last row) and the theorist table of §3 (Hegel, Freud, Aristotle, Weber, Goffman, Brandom, Honneth, Lacan, each with the number the paper reports). The forward section moves to 09 and the nav gains a Sorting link. Every count was read back from the paper section it cites. `npm run theory:synthesize` re-stamped the band at v3.0.311; `npm run theory:check` exits 0 with 12/12 data-refs resolving. Read in the browser at `/theory` from a worktree server on port 3512: the section, the nav link, 24 table rows and one worked row render, no console errors. Zero calls.
