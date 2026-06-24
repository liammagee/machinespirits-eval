---
id: sepo-self-evolving-prompt-agent-for-system-prompt-optimizati
title: "SePO: Self-Evolving Prompt Agent for System Prompt Optimization"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-06-22
updated: 2026-06-24
verification: ArXiv source record and roundup note reviewed; decision appended;
  no prompt-optimization pilot spawned.
links:
  notes: notes/daily-notes/2026-06-17-research-roundup.html
milestone: literature-triage
branch: codex/workplan-board-triage
claim_status: future
---

arXiv:2606.04465 [UNBLOCK] — surfaced by the daily routine (2026-06-17-research-roundup.html).

The ego's system prompt in cells 1–8 is currently hand-tuned and frozen at run time. SePO's self-referential design suggests a viable path to jointly optimising the ego prompt and the superego's critique instructions — which is exactly the lever the DRAMATIC-RECOGNITION-PLAN.md §3.2 calls for but leaves unspecified. Worth piloting on a single cell pair (e.g., cells 3/4) before the next large factorial run.

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-06-24 Codex: Source triage: SePO is a good precedent for self-improving prompt agents, but applying it to ego/superego prompts would be a paid/experimental prompt-optimization loop. Defer until a specific cell pair and kill gate are chosen.
