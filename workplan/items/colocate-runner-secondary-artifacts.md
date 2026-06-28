---
id: colocate-runner-secondary-artifacts
title: Co-locate runner transcripts and checkpoints with canonical logs
status: triaged
type: maintenance
priority: P3
owner: unassigned
source: manual
created: 2026-06-28
updated: 2026-06-28
verification: "A smoke run writes dialogue logs, transcripts, and checkpoints under the same canonical data-home logs root unless an explicit test override is set; `npm test` and `npm run wp:check` pass."
links:
  items: consolidate-logs-db-private-archive
tags:
  - logs
  - runner
  - data-home
  - artifacts
milestone: paper-2-evidence-cleanup
---

Follow-up split from `consolidate-logs-db-private-archive`.

`evaluationStore` now writes hash-verifiable dialogue logs through the canonical
logs root. `evaluationRunner.js` still has secondary artifact paths for
`transcripts/` and `checkpoints/` under `EVAL_ROOT/logs`, which is not the same
contract.

This is not part of the `paper2.provenance.dialogue_hashes` gate, but it is
still cleanup worth doing so a run's generated artifacts are not scattered
across worktrees.
