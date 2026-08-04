---
id: knowledge-conflict-resolution-literature-triage
title: "Navigating Unreliable Parametric and Contextual Knowledge: Explicit
  Knowledge Conflict Resolution for LLM Infe"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-07
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: future
links:
  notes:
    - notes/daily-notes/2026-06-21-research-roundup.html
  items:
    - the-self-correction-illusion-llms-correct-others-but-not-the
    - recode-superego-incorporation-as-a-framing-trajectory
tags:
  - literature
  - superego
  - conflict-resolution
milestone: literature-triage
---

arXiv:2606.20245 [UNBLOCK] — surfaced by the daily routine (2026-06-21-research-roundup.html).

The ego-superego architecture is exactly this pattern: the superego's critique is a conflict-resolution step between the ego's parametric priors and the in-context pedagogical constraints. MACR formalises what the project does implicitly and adds a third party (the adjudicator), which maps onto the judge model in the evaluation pipeline. The framework is a candidate design for cells 93–100 (superego variant ablations) — specifically for cell_98_two_pass and cell_99_coupling , where the conflict between ego and superego is currently handled by a single revision pass. An MACR-style explicit adjudication layer between ego and superego revision could be a cell_126+ addition.

Decision, 2026-08-04: An added adjudicator would be a new architecture and cell family, not a small refinement. Existing self-correction evidence and the planned incorporation recoding first need to show a conflict-resolution failure that an adjudicator could address.
