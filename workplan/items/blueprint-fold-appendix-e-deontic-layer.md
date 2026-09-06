---
id: blueprint-fold-appendix-e-deontic-layer
title: "Fold the deontic layer into Appendix E as a new subsection"
status: triaged
type: paper
priority: P2
owner: claude
source: manual
created: 2026-09-05
updated: 2026-09-05
claim_status: planned
verification: >-
  Appendix E carries one new subsection that puts the scoreboard schema beside
  the recognition node of E.5, and names the release ledger and the proof-debt
  ledger as the two records the schema already holds. The subsection says the
  entitlement field is a narrow proxy for the conferral term, quotes the
  board-and-reader agreement range from §6.31, and says the board adds nothing
  to the authority term. E.11 gains one line if the established-or-lens split
  changes. The version rises by one patch step with a revision-history entry,
  and `npm run refs:check` and `npm run paper:manifest` stay green.
links:
  notes:
    - notes/2026-09-04-theoretical-blueprint.md
    - notes/2026-09-05-scoreboard-replay-report.md
    - notes/2026-09-05-scoreboard-crossed-run-report.md
  paper:
    - "docs/research/paper-full-2.0.md Appendix E"
  items:
    - one-adaptive-tutor-plan-line
    - scoreboard-crossed-run-paper-fold
tags:
  - paper
  - theory
---

**What this is.**

The third framing fold of §9 of `notes/2026-09-04-theoretical-blueprint.md`. It
adds one subsection after E.7, or in the place the author picks, and it does not
change any other part of Appendix E. It waits on the user's word.

**What goes in.**

The scoreboard schema of §6.31 read as a layer of rights and duties. E.5 breaks
the recognition node into three parts. Belief is whether the recogniser holds a
grounded belief in the standing. Conferral is whether the standing is really
given or only said. Authority is what gives the conferral its force. The
subsection maps the board's fields on to those parts, and says which parts the
board leaves alone. It names the release ledger and the proof-debt ledger as
records the schema already keeps.

**What §6.31 now allows, and what it forbids.**

The blueprint says the entitlement field is the checkable proxy for the conferral
term. §6.31 makes that sentence narrower in two ways.

- The board counts fewer moves than a reader counts. The board's challenge field and the readers'
  read of a delivered challenge agree in 18% to 46% of cases. Every turn the
  board marked, the readers also marked, and the readers marked many more. So the
  field is a lower bound on the move, not a measure of it.
- The board says nothing about the authority term. The §7.14 lattice was run
  again on its frozen 122 carded turns with the board fields added, and it still
  separates 0 of 7 figures. The subsection must say the board is a record of
  moves and not a figure detector.

The subsection may say the conferral term now has a field a program can read on
public text alone. It may not say the field was validated against a reader.

**Rules.**

Zero paid calls. No rescoring. No new empirical claim: every number comes from
§6.31 or from the two report notes. Edit Appendix E in place. The claim audit
runs before the splice.
