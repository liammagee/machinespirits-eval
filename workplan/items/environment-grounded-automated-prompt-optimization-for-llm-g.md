---
id: environment-grounded-automated-prompt-optimization-for-llm-g
title: Environment-Grounded Automated Prompt Optimization for LLM Game Agents
status: triaged
type: research
priority: P2
owner: unassigned
source: daily-routine
created: 2026-06-22
updated: 2026-06-22
verification: Paper read; a one-line note records whether it changes our rubric,
  prompts, architecture or eval design; this item is then closed or spawns a
  concrete task.
links:
  notes: notes/daily-notes/2026-06-18-research-roundup.html
---

arXiv:2606.17838 [UNBLOCK] — surfaced by the daily routine (2026-06-18-research-roundup.html).

The module decomposition mirrors the ego/superego split almost exactly: the goal descriptor ≈ ego (observation → intention) and the action selector ≈ superego (intention → constrained output). The behavior-analyser + mutator loop is a candidate mechanism for the npm run prompt-lab -- autotune workflow: instead of hand-tuning prompts/tutor-ego*.md , run an offline evolutionary loop guided by tutor_first_turn_score returns. Especially relevant for cells 93–100 (superego variant ablations).

Triage: promote to a research item (link the paper §) or drop with a reason.