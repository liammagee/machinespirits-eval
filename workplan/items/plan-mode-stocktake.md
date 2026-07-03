---
id: plan-mode-stocktake
title: Plan-mode stock-take — dialogic between-scene reorientation (course-changing outer loop)
status: active
type: research
priority: P1
owner: unassigned
source: manual
created: 2026-07-04
updated: 2026-07-04
branch: worktree-strategy-ledger-followups
verification: "Implementation gated (34/34 incl. L7: stock-takes fire, corrections answered, commitment machinery suppressed, proof fingerprints byte-identical on/off) and tested (21/21). Item closes when the pre-registered plan-mode contrast is run and its verdict recorded — or the line is explicitly dropped."
claim_status: planned
links:
  notes:
    - PLAN-MODE-STOCKTAKE-PREREGISTRATION.md
    - LAYERED-DECISION-LOOPS-PLAN.md
  items:
    - strategy-ledger-followups
tags:
  - adaptive-tutor
  - derivation
  - outer-loop
  - plan-mode
  - ego-superego
---

Operator articulation (2026-07-04): the outer loop the closed strategy-ledger
line never tested — a **stock-take**, with a different functional question
than the turn-based exchange ("is the current course still the right one?"),
conducted as an inner monologue between ego and superego asking for course
correction and planning; the equivalent of a plan mode.

Mechanistically distinct from the closed commitment line on four axes:
**dialogic** (a separate stock-take call under its own diagnostic charter, not
fields in the ego's call) · **diagnostic** (situation appraisal, not
conformance or selection) · **off the stage clock** (one extra superego-side
call per scene boundary; zero dialogue turns) · **reorienting** (the ego's
answer REPLACES its working orientation; no audit, no drift-grading — the
frame-rewrite channel the adversarial-superego result proved load-bearing,
without the conformance pressure the confirmatory run showed manufactures
rigidity). The V2b confirmatory failure pattern motivates it directly: the
ledger arm's losses were stalls/disengagements — dramas needing a course
change that the held plan suppressed.

Implemented 2026-07-04 as `--strategy-ledger '{"planMode":true}'` (exclusive
with trialling; suppresses all commitment machinery; keeps the ledger's
bookkeeping as stock-take EVIDENCE — the role that instrumentation turned out
to be good at). Pre-registration skeleton drafted
(`PLAN-MODE-STOCKTAKE-PREREGISTRATION.md`): two arms, n=12/arm,
hethel-resistant + marrick, fresh prime seeds, OUTCOME-primary endpoint (T*)
with the V2b-style three-part bar — accountable to outcomes from the start,
since the closed line improved a conduct channel while losing outcomes.

Recorded consequences either way: confirmed → the dialogic/off-clock cell of
the outer-loop design space works where the monologic/conformance cell
failed; not confirmed → the outer-loop line in this stack closes whole (both
variants non-promotable), no third variant without stepping back from the
engine.

AWAITING GO for the paid contrast (parallelized 2026-07-04, pre-freeze: concurrency 3 per block with pair-interleaved arms for symmetric quota exposure — probed, the CLI multiplexes; ~1.5-2h wall-clock in two checkpointed blocks). The
pre-registration freezes at the commit preceding the first paid run; the
analysis gains its plan-mode design entry and is zero-paid validated before
that freeze.
