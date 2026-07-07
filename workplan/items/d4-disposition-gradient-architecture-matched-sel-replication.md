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
verification: "DB audit shows eval-2026-06-24-250c6251 has 144/144 successful
  rows and 144/144 Sonnet-scored first turns; report and Paper 2.0 §6.6.8
  record the scope-bound verdict."
claim_status: scope-bound
links:
  notes:
    - TODO.md#D4
    - notes/d4-sel-disposition-gradient-gate.md
  paper: §6.6.8
  exports:
    - exports/d4-sel-disposition-gradient-eval-2026-06-24-250c6251.md
  runs:
    - eval-2026-06-24-250c6251
tags:
  - d4
  - disposition
  - sel
milestone: paper-2-evidence-cleanup
branch: codex/d2-d6-followups
---

TODO §D4 is resolved at the architecture-scope-limit level, but it names one clean deferred test: cells 40-45 × SEL. This card captures that optional replication without reopening the settled D4 claim.

2026-06-24 Codex: Closed as current-board cleanup. The architecture-scope limit is already stated; the clean SEL replication would be useful only if the disposition-gradient claim becomes central in a future paper.

2026-06-24 Codex: Follow-up arc gate recorded in
`notes/d4-sel-disposition-gradient-gate.md`. The linked export path is absent
in this checkout, and production DB inventory found zero cells 40-45 rows on the
exact SEL scenarios. The clean replication is fully gated until a 144-row paid
run is approved.

2026-06-24 Codex: Reopened per user approval to do D4 now. Target run is cells
40-45 on the eight SEL scenarios, 3 runs each, Haiku generation, Sonnet CLI
judge, written to the production evaluation DB/log store.

2026-06-24 Codex: Completed paid D4 replication. Run
`eval-2026-06-24-250c6251` generated 144/144 successful rows and now has
144/144 `claude-code/sonnet` first-turn scores. Result is scope-bound:
recognition improves all three disposition families on SEL (suspicious +17.1,
adversary +7.3, advocate +15.4), but the predicted monotone suspicious >
adversary > advocate ordering does not replicate because advocate exceeds
adversary. Report:
`exports/d4-sel-disposition-gradient-eval-2026-06-24-250c6251.md`; paper
updated in §3.4, §6.6.8, and revision history v3.0.170.
