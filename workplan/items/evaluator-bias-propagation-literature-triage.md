---
id: evaluator-bias-propagation-literature-triage
title: "Contagion Networks: Evaluator Bias Propagation in Multi-Agent LLM Systems"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-07
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: methods
links:
  notes:
    - notes/daily-notes/2026-06-20-research-roundup.html
  items:
    - the-confident-liar-diagnosing-multi-agent-debate-with-log-pr
    - rubric-v3-calibration-and-held-out-acceptance
    - test-canonical-posthoc-analysis-pipeline
tags:
  - literature
  - judge-reliability
  - multi-agent
milestone: literature-triage
---

arXiv:2606.20493 [UNBLOCK] — surfaced by the daily routine (2026-06-20-research-roundup.html).

A direct warning for the project's LLM-as-judge pipeline. The inter-rater reliability methodology ( analyze-judge-reliability.js , paired rejudge runs) assumes independent judges; contagion contamination is a live threat if superego-critique context leaks into judge prompts. Also structural: in the Ego→Superego→Ego revision loop, a biased superego critique compounds across revision rounds and across cells, precisely the systematic drift §5.4 tries to detect. The adversarial-critic-insertion mitigation maps directly onto the dialectical_suspicious superego cells 22–33.

Decision, 2026-08-04: The canonical post-hoc pipeline and v3 calibration already separate instrument identities and judge inputs, and no critique-context leak is evidenced here. The paper remains a warning and future audit lens, but it does not justify changing evaluator claims or spawning a duplicate reliability task.
