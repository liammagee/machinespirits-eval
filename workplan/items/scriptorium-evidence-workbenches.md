---
id: scriptorium-evidence-workbenches
title: Scriptorium evidence workbenches for scripts, proof runs, and replays
status: triaged
type: ops
priority: P1
owner: unassigned
source: manual
created: 2026-06-23
updated: 2026-06-23
verification: A reviewer can find, inspect, compare, flag, and label scripts/proof runs/replays from first-class evidence workbench views without route guessing.
links:
  notes: notes/poetics/2026-06-23-scriptorium-dashboard-ux-audit-plan.md
  items:
    - scriptorium-ux-safety-net
    - scriptorium-control-room-first-run
tags:
  - scriptorium
  - ux
  - evidence
  - review
---

Context: `/browse` and `/derivation` expose rich data, but the workbench loop is
still fragmented. Replays are present as a route but not yet promoted to the
same level as scripts and proof runs.

Acceptance criteria:
- [ ] Add saved views and active filter chips to `/browse`.
- [ ] Add compare mode for scripts and replay/original pairs.
- [ ] Give `/derivation` group summaries, collapsible groups, and selected-run
      comparison.
- [ ] Promote `/replays` into a first-class evidence comparison surface.
- [ ] Make all filters visibly labeled and URL-permalinkable.
- [ ] Keep proof-run checker outcomes clearly separate from AI quality scores.
