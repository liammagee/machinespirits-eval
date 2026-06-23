---
id: a17-one-side-replay-replication-across-scenes
title: A17. One-Side Replay Replication Across Scenes
status: triaged
type: experiment
priority: P2
owner: unassigned
source: todo
created: 2026-06-22
updated: 2026-06-22
verification: Replication across scenes run; results in exports/; the
  one-side-replay claim updated or closed in the paper.
links:
  notes: TODO.md#A17
  paper: §7.9
  exports: exports/replay-d5-run3-socratic/
claim_status: exploratory
tags:
  - replay
  - poetics
  - learner-variance
---

TODO §A17 asks whether the D_OED5 run3 verdict generalizes across scenes now that per-run director plans are persisted.

Acceptance:
- Generate fresh D_OED5 and D_OED4 scenes with `director-<arm>.json` persistence intact.
- Replay each scene's learner side K≈8 and score with `scripts/score-replays.js`.
- Report whether each scene is a structural cap or learner-draw case, then update §7.9 or close the follow-up as exploratory.
