---
id: multi-step-prompt-optimization-literature-triage
title: "FAPO: Fully Autonomous Prompt Optimization of Multi-Step LLM Pipelines"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-06-23
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: future
links:
  notes:
    - notes/daily-notes/2026-06-23-research-roundup.html
  items:
    - environment-grounded-automated-prompt-optimization-for-llm-g
    - sepo-self-evolving-prompt-agent-for-system-prompt-optimizati
tags:
  - literature
  - prompt-optimization
  - multi-agent
milestone: literature-triage
---

arXiv:2606.19605 [UNBLOCK] — surfaced by the daily routine (2026-06-23-research-roundup.html).

The three-level escalation maps directly onto the project's prompt-lab autotune workflow ( npm run prompt-lab -- autotune ), which currently operates at prompt-text level only. FAPO's step-level failure attribution is the missing mechanism for deciding when to escalate from per-prompt tuning to structural changes in the ego/superego dialogue engine — precisely the question that stalled the cells 93–100 superego-variant ablations. The attribution logic could be adapted to route tutor_first_turn_score residuals back to the specific ego or superego prompt that caused them.

Decision, 2026-08-04: Two earlier literature-triage decisions already defer automated prompt mutation until the project has a validated objective and bounded optimization protocol. Step-level failure attribution is useful design context, but it does not remove that gate or justify a new autotune loop.
