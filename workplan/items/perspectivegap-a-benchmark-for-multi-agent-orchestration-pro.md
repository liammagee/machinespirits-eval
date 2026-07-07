---
id: perspectivegap-a-benchmark-for-multi-agent-orchestration-pro
title: "PerspectiveGap: A Benchmark for Multi-Agent Orchestration Prompting"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-06-22
updated: 2026-06-24
verification: ArXiv source record and roundup note reviewed; decision appended;
  no superego prompt-leakage audit spawned.
links:
  notes: notes/daily-notes/2026-06-11-research-roundup.html
milestone: literature-triage
branch: codex/workplan-board-triage
claim_status: future
---

arXiv:2606.08878 [UNBLOCK] — surfaced by the daily routine (2026-06-11-research-roundup.html).

The "Prompt Economy" principle (loop-centred orchestrations that minimise role/engineering overhead) is a direct frame for auditing the ego-superego cells: does the superego prompt contain only what the superego needs, or is there bleed-through of ego-level context? The benchmark's leakage metric — GPT-5.5 49.1% vs. average 246.5% — is a concrete diagnostic the project could apply to prompts/tutor-superego*.md to test whether superego prompts inadvertently expose ego-level reasoning. Could unblock the superego ablation work (cells 93–100).

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-06-24 Codex: Source triage: PerspectiveGap is relevant to prompt economy and information leakage between agents, but a superego leakage audit should be designed as its own bounded instrument rather than folded into this cleanup.
