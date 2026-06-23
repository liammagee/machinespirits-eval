---
id: scriptorium-control-room-first-run
title: Scriptorium control-room front door and first-run data health
status: triaged
type: ops
priority: P0
owner: unassigned
source: manual
created: 2026-06-23
updated: 2026-06-23
verification: The dashboard front door clearly identifies Scriptorium, shows role-based next actions, distinguishes DB-backed script corpus from file-backed proof runs, and gives a no-spend path out of an empty script corpus.
links:
  notes: notes/poetics/2026-06-23-scriptorium-dashboard-ux-audit-plan.md
  items:
    - scriptorium-ux-safety-net
    - scriptorium-responsive-shell-navigation
tags:
  - scriptorium
  - ux
  - onboarding
  - data-health
---

Context: this checkout has an empty `poetics_*` script corpus but 59 proof-run
artifacts. The current dashboard renders honestly, but it does not yet explain
what is missing, what is available, or the safest first action.

Acceptance criteria:
- [ ] Reframe home as "Scriptorium" or "Scriptorium control room" rather than a
      generic "Eval control room".
- [ ] Add role-based entry points: Reader, Builder, Reviewer, Operator,
      Researcher.
- [ ] Add data-health cards for script DB, proof artifacts, open flags, and jobs.
- [ ] Add first-run actions for empty script DB: use fixture, ingest artifacts,
      generate mock script, or open proof runs.
- [ ] Show command/cost class for setup actions.
- [ ] Keep the reflexive pedagogy note, but below operational orientation.
