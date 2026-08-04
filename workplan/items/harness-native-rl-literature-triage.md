---
id: harness-native-rl-literature-triage
title: "OpenForgeRL: Train Harness-native Agents in Any Environment"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-27
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: future
links:
  notes:
    - notes/daily-notes/2026-07-27-research-roundup.html
  items:
    - tutor-stub-transition-reward-model
    - adaptive-curriculum-memory-controller
    - program-2-committee-floor-ablation
tags:
  - literature
  - reinforcement-learning
  - harness
milestone: literature-triage
---

arXiv:2607.21557 [UNBLOCK] — surfaced by the daily routine (2026-07-27-research-roundup.html).

A close structural match for the project's own CLI-bridge architecture (`--ego-model codex.gpt-5.5` etc. reaching tutor-core's dialogue engine via tutor-core/services/externalAIProvider.js ) and for `services/adaptiveTutor/`'s LangGraph runner — both are exactly the kind of "harness the model calls flow through" that OpenForgeRL's proxy pattern targets. Most directly relevant to any future move from hand-tuned prompt/mechanism ablation (the current cells 1-125 factorial) toward RL-trained tutor policies: OpenForgeRL is a plausible infrastructure choice for training an ego or superego policy end-to-end inside the actual dialogue-engine harness instead of a simplified proxy environment.

Decision, 2026-08-04: The transition/reward-model claim was killed and the adaptive controller is blocked on that missing prerequisite. Program 2 is separately testing the value of its fine-tuned committee. Harness-native RL is therefore a future infrastructure option, not an executable next task.
