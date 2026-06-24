---
id: the-confident-liar-diagnosing-multi-agent-debate-with-log-pr
title: "The Confident Liar: Diagnosing Multi-Agent Debate with Log-Probabilities
  and LLM-as-Judge"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-06-22
updated: 2026-06-24
verification: ArXiv source record and roundup note reviewed; decision appended;
  no log-probability instrumentation task spawned.
links:
  notes: notes/daily-notes/2026-06-12-research-roundup.html
milestone: literature-triage
branch: codex/workplan-board-triage
claim_status: methods
---

arXiv:2606.10296 [UNBLOCK] — surfaced by the daily routine (2026-06-12-research-roundup.html).

The Constructor/Auditor pairing is structurally identical to the ego/superego pairing. The confident-liar finding directly interrogates the project's evaluate pipeline: if the judge scores high-fluency, high-confidence ego outputs independently of whether the pedagogical content is correct, then tutor_first_turn_score may be measuring confident generation, not genuine recognition. The log-probability instrument is cheap to add to any eval run (no extra API calls) and could serve as a calibration signal alongside the existing rubric scores. Mark Warschauer is a prominent educational technology researcher (UCI); the rubric-scoring domain in this paper maps closely to the v2.2 rubric evaluation workflow.

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-06-24 Codex: Source triage: the Constructor/Auditor confidence-vs-judge signal is relevant to ego/superego calibration, but provider logprob availability and judge coupling need a separate design. Do not alter evaluator claims from this capture alone.
