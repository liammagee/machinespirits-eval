---
id: blueprint-fold-paper-3-scorekeeping
title: "Fold the scorekeeping account of recognition into paper §3"
status: done
type: paper
priority: P2
owner: claude
source: manual
created: 2026-09-05
updated: 2026-09-05
claim_status: methods
verification: >-
  Paper §3 carries one paragraph that states recognition as a scorekeeping act
  with four parts (standing, content, time, uptake), names Brandom, Honneth and
  Goffman beside Hegel, Freud, Aristotle and Weber, and points forward to §6.31
  for the one place the account was measured. No number in the paragraph is new.
  The version rises by one patch step with a revision-history entry, and
  `npm run refs:check` and `npm run paper:manifest` stay green.
links:
  notes:
    - notes/2026-09-04-theoretical-blueprint.md
    - notes/2026-09-05-scoreboard-crossed-run-report.md
  paper:
    - "docs/research/paper-full-2.0.md §3"
  items:
    - one-adaptive-tutor-plan-line
    - scoreboard-crossed-run-paper-fold
tags:
  - paper
  - theory
---

**What this is.**

The first of the five framing folds that §9 of
`notes/2026-09-04-theoretical-blueprint.md` lists. It is theory prose, not a
result. It waits on the user's word.

**What goes in.**

One paragraph in §3. Recognition is stated as an act with a public score, and
the score has four parts. Standing is who may speak. Content is what goes on the
record. Time is when it goes there. Uptake is whether the other side takes it up.
Brandom, Honneth and Goffman join the four theorists §3 already names. Brandom is cited once in
§7.13, Honneth four times in the paper, and Goffman is not in the paper at all,
so the fold adds one reference.

**What §6.31 now allows, and what it forbids.**

The blueprint was written on 2026-09-04, before Phase 1 ran. §6.31 is the one
place the scorekeeping account met a measurement, and it split the four parts
apart:

- Standing and time held. A tutor whose rights were read off a public board made
  no move outside its licence in 192 audited turns; the same tutor with the board
  hidden made three.
- Uptake did not move. Neither learner shape's own channel rose (1 of 12 against
  1 of 12; 5 of 12 against 6 of 12), so the registered kill rule fired.

So the paragraph may say that the account gives a record a program can
read. It may not say that the record changes what the learner does. One clause
must send the reader to §6.31 for that limit. The result is a conduct claim,
stack-bound to Sonnet 5 in the tutor seat and Luna in the reader seats.

**Rules.**

Zero paid calls. No rescoring. No abstract change. Edit §3 in place. The claim
audit runs before the splice.

**Done 2026-09-05.** §3.6 "Recognition as a Scorekeeping Act" added at
v3.0.309: one paragraph, no number in it; the four parts named; Brandom,
Honneth and Goffman placed beside Hegel, Freud, Aristotle and Weber; one clause
sends the reader to §6.31 and states the result there as a conduct claim bound
to Sonnet 5 in the tutor, learner and analyzer seats and Luna in the reader
seats. The bibliography gains `brandom1994` and `goffman1981`. Zero calls.
Checks green: `lint:all`, `refs:check`, `paper:manifest`,
`generate-paper-tables`, `wp:source-check`. Claim audit run on the diff: one fix taken (the Aristotle sentence now cites Appendix E.3 and E.8 and says the §7.13 unit ladder draws the same line without naming him); the version stays 3.0.309 because PR #1071, open, takes 3.0.308.
