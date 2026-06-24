---
id: d4-disposition-gradient-architecture-matched-sel-replication
title: D4. Architecture-matched SEL disposition-gradient replication
status: done
type: research
priority: P3
owner: codex
source: todo
created: 2026-06-23
updated: 2026-06-24
verification: "Decision and 2026-06-24 DB inventory logged: cells 40-45 on the
  exact SEL scenario set have zero existing rows, so the clean replication
  requires a new paid run."
claim_status: future
links:
  notes:
    - TODO.md#D4
    - notes/d4-sel-disposition-gradient-gate.md
  paper: §6.6.8
tags:
  - d4
  - disposition
  - sel
milestone: paper-2-evidence-cleanup
branch: codex/workplan-board-triage
---

TODO §D4 is resolved at the architecture-scope-limit level, but it names one clean deferred test: cells 40-45 × SEL. This card captures that optional replication without reopening the settled D4 claim.

2026-06-24 Codex: Closed as current-board cleanup. The architecture-scope limit is already stated; the clean SEL replication would be useful only if the disposition-gradient claim becomes central in a future paper.

2026-06-24 Codex: Follow-up arc gate recorded in
`notes/d4-sel-disposition-gradient-gate.md`. The linked export path is absent
in this checkout, and production DB inventory found zero cells 40-45 rows on the
exact SEL scenarios. The clean replication is fully gated until a 144-row paid
run is approved.
