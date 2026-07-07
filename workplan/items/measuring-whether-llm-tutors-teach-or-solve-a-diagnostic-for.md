---
id: measuring-whether-llm-tutors-teach-or-solve-a-diagnostic-for
title: "Measuring Whether LLM Tutors Teach or Solve: A Diagnostic for
  Educational Impact"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-06-22
updated: 2026-06-24
verification: ArXiv source record and roundup note reviewed; decision appended;
  no immediate MathTutorBench cross-validation task spawned.
links:
  notes: notes/daily-notes/2026-06-18-research-roundup.html
milestone: human-pilot-prep
branch: codex/workplan-board-triage
claim_status: methods
---

arXiv:2606.16206 [UNBLOCK] — surfaced by the daily routine (2026-06-18-research-roundup.html).

This is the empirical twin of the project's rubric v2.2 design question. The project already separates content_accuracy from scaffolding dimensions; 2606.16206 provides external validation that this split matters and a ready benchmark (MathTutorBench) for cross-validating cell scores. Could sharpen the §6.3 discussion by quantifying the solve/teach gap across cells — cells with high tutor_first_turn_score but low learner_growth_index are direct instances of the phenomenon.

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-06-24 Codex: Source triage: the solve/teach gap directly supports separating content accuracy from scaffolding and agency-preserving criteria. It reinforces the current rubric design rather than requiring a new run now.
