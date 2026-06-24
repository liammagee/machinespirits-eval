---
id: d3-insight-action-gap-heavy-bridge-followups
title: D3. Insight-action gap heavy bridge follow-ups
status: done
type: research
priority: P3
owner: codex
source: todo
created: 2026-06-23
updated: 2026-06-24
verification: "Decision and 2026-06-24 gate logged: heavy bridge follow-ups
  require a frozen endpoint independent of the optimized metric before any paid
  escalation."
claim_status: future
links:
  notes:
    - TODO.md#D3
    - notes/design-d3-architectural-bridges.md
    - notes/d3-heavy-bridge-followup-gate.md
  paper: §6.3.9
tags:
  - d3
  - insight-action-gap
  - bridge
milestone: paper-2-evidence-cleanup
branch: codex/workplan-board-triage
---

TODO §D3 closes the lightweight bridge attempts and leaves only heavier optional follow-ups: larger best-of-N sweeps, reflector/actor split, or outcome-conditioned generation. This card keeps those as future work rather than active current-paper debt.

2026-06-24 Codex: Closed as current-board cleanup. The heavier Bridge 3b/4/5 paths remain possible future work, but the lightweight D3 attempts already set the current paper boundary and the expected marginal information does not justify a paid escalation now.

2026-06-24 Codex: Follow-up arc gate recorded in
`notes/d3-heavy-bridge-followup-gate.md`. Future Bridge 3b/4/5 work is fully
gated until it freezes an endpoint independent of coupling-cosine optimization,
plus budget and stop rules.
