---
id: blueprint-fold-boundary-map-sorting-rule
title: "Fold the three sorting questions into paper §7.12 and §7.16"
status: triaged
type: paper
priority: P2
owner: claude
source: manual
created: 2026-09-05
updated: 2026-09-05
claim_status: planned
verification: >-
  Paper §7.12 and §7.16 state the three sorting questions as one rule, and each
  question points at results the paper already reports on both sides of the
  boundary. The prose says a no on all three predicts a null, and a yes on all three
  does not predict a win, and it cites §6.31 as the case that answers yes to all
  three and still fired its kill rule.
  No result is re-sorted into a new claim tier. The version rises by one patch
  step with a revision-history entry, and `npm run refs:check` and
  `npm run paper:manifest` stay green.
links:
  notes:
    - notes/2026-09-04-theoretical-blueprint.md
    - notes/2026-09-05-scoreboard-crossed-run-report.md
  paper:
    - "docs/research/paper-full-2.0.md §7.12, §7.16"
  items:
    - one-adaptive-tutor-plan-line
    - scoreboard-crossed-run-paper-fold
tags:
  - paper
  - theory
---

**What this is.**

The second framing fold of §9 of `notes/2026-09-04-theoretical-blueprint.md`.
It states in the paper the rule that §4 of the blueprint uses to sort every win
and loss of §6. Theory prose, no new study. It waits on the user's word.

**The rule, as §4 of the blueprint states it.**

1. Does it add structure the model cannot read off the page? New signal, not the
   same signal written again.
2. Does it change standing or timing, and not manner or description?
3. Is the endpoint a change on the record that a program can check, and not a
   judge's reading of a reply?

**What §6.31 now allows, and what it forbids.**

The blueprint states the rule in one direction only: a study that answers no to
all three will return a null. §6.31 is the first case that answers **yes** to all
three and still fired its registered kill rule. The board adds a shared public
record. It changes standing through the licence. Its endpoint is a program's
count of licensed and unlicensed moves. The learner channel still did not move.

So the fold must state the rule in both directions. A study that answers no to
all three is not worth its calls. A study that answers yes to all three can still
return a null, and §6.31 is the worked case. The fold must also carry the
split §6.31 found: the conduct term moved and the uptake term did not.

**Rules.**

Zero paid calls. No result changes its claim tier because of this fold. Edit
§7.12 and §7.16 in place. The claim audit runs before the splice.
