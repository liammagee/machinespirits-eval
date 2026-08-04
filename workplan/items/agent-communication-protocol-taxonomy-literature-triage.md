---
id: agent-communication-protocol-taxonomy-literature-triage
title: A Technical Taxonomy of LLM Agent Communication Protocols
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-06-23
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: future
links:
  notes:
    - notes/daily-notes/2026-06-23-research-roundup.html
  items:
    - version-symmetric-trace-transformation-pipeline
    - refactor-adaptive-trace-projection
    - codebase-refactoring-program
tags:
  - literature
  - multi-agent
  - protocols
milestone: literature-triage
---

arXiv:2606.19135 [UNBLOCK] — surfaced by the daily routine (2026-06-23-research-roundup.html).

The bilateral ego-superego architecture is itself an asymmetric two-agent protocol: tutor-ego sends a draft, superego returns a critique, ego revises. Formalising this exchange using the taxonomy's "message semantics" axis would make the deliberation loop unit-testable at the wire level and clarify which cells with multi_agent_tutor: true but superego: null are genuinely single-agent vs. self-reflection loops. The topology axis is also directly applicable to the LangGraph adaptive runner (cells 110–113), whose state transitions are currently implicit in services/adaptiveTutor/graph.js .

Decision, 2026-08-04: The symmetric trace pipeline and adaptive trace projector already provide versioned message and state-transition contracts, while the active refactoring programme is consolidating their owners. Without an observed interoperability or trace-shape failure, a second protocol formalisation task would duplicate those contracts.
