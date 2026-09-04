---
id: agentantibody-an-adaptive-immune-system-for-defending-llm-ag
title: "AgentAntibody: An Adaptive Immune System for Defending LLM Agents
  against Prompt Injection"
status: done
type: research
priority: P3
owner: codex
source: daily-routine
created: 2026-08-10
updated: 2026-09-04
verification: A zero-call source-and-test audit shows the tutor-core Writing Pad
  selectively accumulates and consolidates state rather than flatly overwriting
  it, states the consequence for cell 21, and distinguishes the trap suite's
  within-scenario history from its absent learner-keyed cross-scenario memory.
claim_status: methods
branch: codex/agentantibody-writing-pad-audit
links:
  paper:
    - docs/research/paper-full-2.0.md#669-writing-pad-controlled-ablation
    - docs/research/paper-full-2.0.md#68-architectural-extension-the-adaptive-runner-and-trap-scenario-methodology
  notes:
    - notes/daily-notes/2026-08-10-research-roundup.html
    - notes/2026-09-04-writing-pad-state-lifecycle-audit.md
---

arXiv:2608.04053 [UNBLOCK] — surfaced by the daily routine (2026-08-10-research-roundup.html).

A close structural cousin of cell 21's dynamic prompt rewriting with the Writing Pad — both keep a persistent, cross-turn text artifact that accumulates what the agent has learned rather than treating each turn as stateless. AgentAntibody's update rule (add a new antibody on each novel threat, reuse a matching one otherwise) is a concrete design to check the Writing Pad against: does it accumulate and compact the way an immune memory does, or does it overwrite? The same online, per-encounter learning pattern is also a candidate lens for the trap-scenario suite (cells 110-125), where the adaptive tutor currently has no persistent memory of which traps a given learner has already tried across turns.

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-08-28 Claude: Promoted for the read-only half only. Whether the Writing Pad accumulates and compacts across turns or overwrites is answerable by reading `tutor-core/services/writingPadService.js`, costs nothing, and would say something real about cell 21 and about the trap suite's missing cross-turn learner memory. The paper's security framing is not the reason to keep it. Kept at P3.

2026-09-04 Codex: Completed the zero-call audit in
`notes/2026-09-04-writing-pad-state-lifecycle-audit.md`. The tutor-core pad
selectively accumulates and consolidates learner-keyed state: conscious scratch
is promoted then cleared, preconscious patterns append or reinforce and can
decay, and eligible recognition moments append as compact unconscious traces.
Cell 21 therefore has durable selected memory but regenerates its current
prompt-rewrite block from accumulated dialogue evidence rather than appending
every directive. The adaptive trap runner keeps append-reduced history within a
scenario, but every scenario invocation starts a new in-memory checkpointer and
base state, so no learner-keyed memory carries attempted traps across scenarios.
Focused deterministic verification passed (8 tutor-core Writing Pad/session
tests and 5 mock adaptive closed-loop tests); model-backed calls: 0.
