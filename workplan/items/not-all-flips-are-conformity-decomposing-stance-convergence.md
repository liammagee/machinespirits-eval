---
id: not-all-flips-are-conformity-decomposing-stance-convergence
title: "Not All Flips Are Conformity: Decomposing Stance Convergence in
  Multi-Agent LLM Debate"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-06-22
updated: 2026-06-24
verification: Paper 2.0 §6.12 already folds this in as a killed Stage 0
  measurement gate; adaptation-conformity scripts compile, while missing local
  exports and the rushed human anchor are tracked by the follow-up item.
claim_status: killed
links:
  notes:
    - notes/daily-notes/2026-06-09-research-roundup.html
    - notes/2026-06-09-adaptation-conformity-classifier-stage0-preregistration.md
  paper: docs/research/paper-full-2.0.md
  scripts:
    - scripts/adaptation-conformity-harvest.py
    - scripts/adaptation-conformity-classifier.py
    - scripts/adaptation-conformity-score-human.py
  items: revisit-adaptation-conformity-human-anchor
branch: codex/not-all-flips-conformity
tags:
  - adaptation-null
  - conformity
  - superego
milestone: paper-2-evidence-cleanup
---

arXiv:2606.00820 [UNBLOCK] — surfaced by the daily routine (2026-06-09-research-roundup.html).

This directly operationalises the question the ego-superego loop currently cannot answer: when the ego revises after superego critique, is that genuine pedagogical adaptation or social compliance with an authoritative inner voice? The 3-source framework (instability / conformity / persuasion) could be adapted as a post-hoc classifier on ego revision turns, sharpening the adaptationIndex and potentially resolving the "near-miss is learner draw or structural cap" problem in /ms-replay-one-side .

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-06-23 Codex: Verified the paper/prereg/script surface. Paper 2.0 §6.12 already reports this as a killed Stage 0 measurement gate rather than an open implementation task: the pre-registered classifier-vs-human gate failed far below the kappa >= 0.60 threshold, and the disposition is no tune-and-retry and no full classifier run. The preregistration and companion scripts exist, and the adaptation-conformity scripts compile. The expected `exports/adaptation-conformity-*` artifacts are not present in this checkout, so the score-only path currently stops at the missing `exports/adaptation-conformity-gate.jsonl`. Per user caveat, the human anchor was rushed and should be treated as a weak operator check, not robust human reliability; follow-up `revisit-adaptation-conformity-human-anchor` tracks artifact recovery and any later deliberate re-annotation.
