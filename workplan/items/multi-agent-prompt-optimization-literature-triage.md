---
id: multi-agent-prompt-optimization-literature-triage
title: "MAS-PromptBench: When Does Prompt Optimization Improve Multi-Agent LLM
  Systems?"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-02
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: future
links:
  notes:
    - notes/daily-notes/2026-07-02-research-roundup.html
  items:
    - environment-grounded-automated-prompt-optimization-for-llm-g
    - sepo-self-evolving-prompt-agent-for-system-prompt-optimizati
tags:
  - literature
  - prompt-optimization
  - superego
milestone: literature-triage
---

arXiv:2606.23664 [UNBLOCK] — surfaced by the daily routine (2026-07-02-research-roundup.html).

Directly bears on npm run prompt-lab -- autotune and any future automated tuning of prompts/tutor-ego*.md / tutor-superego*.md : the bilateral ego-superego architecture is exactly a 2-agent MAS with an explicit communication protocol (critique → revision), which is the regime MAS-PromptBench finds optimization works best in. The negative-gain finding is a caution for cells 93-100 (superego variant ablations) — before autotuning, check whether the superego's critique surface is "explicit and verifiable" enough for optimization to help rather than regress cell scores.

Decision, 2026-08-04: The finding reinforces the existing decision that prompt optimization requires an explicit, verifiable objective and a bounded validation design. No current prompt or cell should change from this paper alone, so no duplicate autotune task is created.
