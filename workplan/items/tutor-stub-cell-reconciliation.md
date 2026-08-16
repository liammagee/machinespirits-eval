---
id: tutor-stub-cell-reconciliation
title: Map and reconcile the tutor-stub and cell-based harnesses
status: active
type: research
priority: P3
owner: claude
source: manual
created: 2026-08-16
updated: 2026-08-16
verification: A survey note maps the two harnesses side by side (tutor,
  learner, run, score, adaptation, shared seams, one-world-only parts) and
  closes with two or three reconciliation options and their costs. No
  option is chosen without a human ruling; no code changes land from the
  survey itself.
claim_status: planned
links:
  notes:
    - notes/2026-08-16-harness-reconciliation-brief.md
  code:
    - config/tutor-agents.yaml
    - services/tutorStubEdgeTimingPolicy.js
    - docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md
tags:
  - tutor-stub
  - cells
  - architecture
  - reconciliation
branch: design/harness-reconciliation
---

The repo runs two worlds that both define a tutor: the cell world
(profiles in the agents YAML, LLM judges, database rows, the factorial
and id-director machinery) and the tutor-stub world (typed action
contracts, the proof-DAG, the warrant gate, deterministic readers).
Findings cross between them informally — the edge-timing register policy
was born in the cell-side switching study and folded into tutor-stub as
an overlay — but nothing states how a claim transfers or which parts are
duplicates.

First step: a read-only survey note per the brief
(`notes/2026-08-16-harness-reconciliation-brief.md`), ending in options,
not a decision. Work happens in the `../ms-harness-reconciliation`
worktree on `design/harness-reconciliation`; never push without a human
ruling. Coordinate with the live normative-contract line and the paused
edged-register line before touching any shared service.
