---
id: character-grounded-story-generation-literature-triage
title: "From Personas to Plot: Character-Grounded Multi-Agent Story Generation
  for Long-Form Narratives"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-03
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: future
links:
  notes:
    - notes/daily-notes/2026-07-03-research-roundup.html
  items:
    - scenario-presentation-variety
    - character-development-capacity
    - proof-dag-dramatic-derivation-assessment
tags:
  - literature
  - poetics
  - world-state
milestone: literature-triage
---

arXiv:2607.00918 [UNBLOCK] — surfaced by the daily routine (2026-07-03-research-roundup.html).

MAGNET's "persona-grounded agents + shared world state + evolving goals" is close kin to scripts/drama-generator.js 's turn_plan and the poetics adaptation loop ( npm run poetics:adaptation-loop ). ATLAS's cross-scene consistency check is a concrete candidate mechanism for poetics:structure-critic / poetics:audit to catch drift in generated dramas' peripeteia/anagnorisis beats before scoring — currently consistency is checked only implicitly via the critic rubric, not via an explicit world-state diff.

Decision, 2026-08-04: The repository now has broader world presentation, explicit character-development instrumentation, and proof-DAG dramatic-derivation checks. A separate ATLAS-style consistency critic would duplicate those seams unless a concrete cross-scene state-drift failure is first demonstrated.
