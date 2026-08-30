---
id: agentantibody-an-adaptive-immune-system-for-defending-llm-ag
title: "AgentAntibody: An Adaptive Immune System for Defending LLM Agents
  against Prompt Injection"
status: triaged
type: research
priority: P3
owner: unassigned
source: daily-routine
created: 2026-08-10
updated: 2026-08-28
verification: A read-only audit of the Writing Pad states whether it accumulates
  and compacts across turns or overwrites, and names the consequence for the
  trap suite's lack of cross-turn learner memory.
links:
  notes: notes/daily-notes/2026-08-10-research-roundup.html
---

arXiv:2608.04053 [UNBLOCK] — surfaced by the daily routine (2026-08-10-research-roundup.html).

A close structural cousin of cell 21's dynamic prompt rewriting with the Writing Pad — both keep a persistent, cross-turn text artifact that accumulates what the agent has learned rather than treating each turn as stateless. AgentAntibody's update rule (add a new antibody on each novel threat, reuse a matching one otherwise) is a concrete design to check the Writing Pad against: does it accumulate and compact the way an immune memory does, or does it overwrite? The same online, per-encounter learning pattern is also a candidate lens for the trap-scenario suite (cells 110-125), where the adaptive tutor currently has no persistent memory of which traps a given learner has already tried across turns.

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-08-28 Claude: Promoted for the read-only half only. Whether the Writing Pad accumulates and compacts across turns or overwrites is answerable by reading `tutor-core/services/writingPadService.js`, costs nothing, and would say something real about cell 21 and about the trap suite's missing cross-turn learner memory. The paper's security framing is not the reason to keep it. Kept at P3.
