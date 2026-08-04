---
id: adaptive-tutoring-router-literature-triage
title: "Learning to Prompt: Improving Student Engagement with Adaptive LLM-based
  High-School Tutoring"
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
    - a1-human-learner-validation
    - tutor-stub-latency-routing-optimization
    - tutor-stub-transition-reward-model
tags:
  - literature
  - adaptive-tutor
  - simulated-learner
milestone: literature-triage
---

arXiv:2606.20138 [UNBLOCK] — surfaced by the daily routine (2026-06-23-research-roundup.html).

The 14-feature turn-level featurizer is a lightweight proxy for rubric v2.2 evaluation: instead of an LLM judge call per turn, a trained routing model could select the next prompt variant in real time — making the adaptive runner (cells 110–113) cheaper to iterate on during prompt-lab autotune sessions. The sim-to-real transfer result also directly supports the external validity argument for the human-learner pilot (§A1 TODO): if simulation-trained routers transfer in this setting, the project's simulated-learner training runs are more predictive of real-learner outcomes than the current conservative framing allows.

Decision, 2026-08-04: A lightweight routing model could be useful, but the project has no supported learned reward model and the human-transfer question remains owned by the blocked human pilot. The active latency-routing card already tests cheaper attributable routing without making a sim-to-real claim.
