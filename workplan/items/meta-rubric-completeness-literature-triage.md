---
id: meta-rubric-completeness-literature-triage
title: "Two-Level Meta-Rubrics for Evaluating Open-Ended Generation: GAMUT, a
  Benchmark for Factual Completeness"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-27
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: methods
links:
  notes:
    - notes/daily-notes/2026-07-27-research-roundup.html
  items:
    - rubric-v3-prospective-measurement-suite
    - rubric-v3-calibration-and-held-out-acceptance
    - tutor-instrumentation-showcase
tags:
  - literature
  - rubric
  - completeness
milestone: literature-triage
---

arXiv:2607.19322 [UNBLOCK] — surfaced by the daily routine (2026-07-27-research-roundup.html).

Directly on-target for the v2.2 rubric's own judge design ( config/evaluation-rubric*.yaml ) and for the poetics rubric ( config/evaluation-rubric-poetics.yaml ), both of which already ask LLM judges to grade non-flat, order-and-coverage-sensitive criteria (did the tutor's turn incorporate the superego's specific critique? did the drama's anagnorisis actually resolve the ledger, not just gesture at it?) with flat per-dimension Likert prompts. GAMUT's two-level meta-rubric structure — a rubric for generating the checklist, then a rubric for grading against it — is a concrete template for tightening `content_accuracy` and the poetics dimensions against exactly the completeness failure mode the paper identifies, rather than continuing to rely on single-shot judge prompts.

Decision, 2026-08-04: Rubric v3 is frozen and awaiting human acceptance, and the instrumentation showcase already separates the current scoring channels. A two-level meta-rubric may inform a successor, but introducing it now would move the instrument during calibration.
