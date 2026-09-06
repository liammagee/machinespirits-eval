---
id: blueprint-fold-build-guide-public-score
title: "Add a public-score build rule to the tutor build guide and the ideal-tutor page"
status: done
type: content
priority: P3
owner: claude
source: manual
created: 2026-09-05
updated: 2026-09-05
claim_status: methods
verification: >-
  HOW-TO-BUILD-A-TUTOR.md carries one new numbered rule on keeping a public
  score, placed so it does not collide with the existing rule 6, and the rule
  states the audit result and the null side by side. The ideal-tutor page
  carries the same rule and passes its provenance check. The outward publish
  stays behind the human gate of `publish-ideal-tutor-blueprint`. Every number
  in the rule traces to §6.31.
links:
  notes:
    - notes/2026-09-04-theoretical-blueprint.md
    - notes/poetics/ideal-tutor-blueprint.html
    - notes/2026-09-05-scoreboard-crossed-run-report.md
  code:
    - scripts/refresh-blueprint.js
  paper:
    - "docs/research/paper-full-2.0.md §6.31"
  items:
    - one-adaptive-tutor-plan-line
    - publish-ideal-tutor-blueprint
    - scoreboard-crossed-run-paper-fold
tags:
  - content
  - techne
  - blueprint
---

**What this is.**

The fifth framing fold of §9 of `notes/2026-09-04-theoretical-blueprint.md`. It
touches two files: the build guide at `HOW-TO-BUILD-A-TUTOR.md` and the recipe
page at `notes/poetics/ideal-tutor-blueprint.html`. It waits on the user's word.

**The wording problem this card must fix.**

The blueprint asks for a sixth rule that reads "keep a public score, and make it
the endpoint". §6.31 ran after the blueprint was written, and it does not support
the second half of that sentence. The board was the endpoint of Phase 1, and the
registered kill rule fired: the tutor that read the board moved neither learner
shape's own channel above the tutor that could not see it, 1 of 12 against 1 of
12 and 5 of 12 against 6 of 12.

What the run does support is the first half, and one more fact. The board tutor
made no move outside its licence in 192 audited turns. The same tutor with the
board hidden made three in its own 192 turns. So the rule the guide may carry is
narrower than the blueprint's draft:

> Keep a public score, and use it to audit what the tutor may do. It gives you a
> record a program can check. On the one crossed run that measured it, it did not
> raise the learner's channel, and the licence that kept the tutor clean also held
> a clue back until turn 8.

The rule must name the cost. §6.31 quotes the dialogue where the board tutor
challenged at every turn, released nothing, and ended with the channel silent.

**A placement point.**

The guide numbers its build rules 1 to 5, and its section 6 is the graveyard.
A rule called "6" would collide with it. Pick a number that does not collide, or
move the graveyard, before writing the text.

**Rules.**

Zero paid calls. No new claim: every number comes from §6.31. Edit both files in
place; no numbered copy of the page. The outward publish is not part of this
card and stays behind its own human gate.

**Done 2026-09-05.** `HOW-TO-BUILD-A-TUTOR.md` carries rule 5b, *Keep a public score, and use it to audit what the tutor may do*, placed before the four-steps-to-contingency section so it does not collide with rule 6. The rule states the audit result (0 unlicensed moves in 192 audited turns against 3 for the blind tutor) beside the null (1 of 12 against 1 of 12 in effort; 5 of 12 against 6 of 12 in warrant), the 18% to 46% agreement lower bound, and the 0 of 7 lattice result of §7.14, and closes on build it for the audit trail, not for movement. `notes/poetics/ideal-tutor-blueprint.html` carries the same rule as claim 9 with an audit-only chip. `npm run blueprint:refresh` re-stamped the band at v3.0.311; `npm run blueprint:check` exits 0 with 17/17 data-refs resolving. Read in the browser at `/blueprint` from a worktree server on port 3512: claim 9 renders with its chip, no console errors. Every number traces to §6.31 (and §7.14 for the lattice). The outward publish stays behind `publish-ideal-tutor-blueprint`. Zero calls.
