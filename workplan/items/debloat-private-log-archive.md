---
id: debloat-private-log-archive
title: De-bloat the private dialogue-log archive
status: done
type: maintenance
priority: P3
owner: codex
source: manual
created: 2026-06-28
updated: 2026-07-02
verification: "docs/archive-replication.md documents the chosen policy: freeze machinespirits-eval-private as a historical/read-only mirror, keep ~/.machinespirits-data as the canonical logs + snapshot archive, and reopen Git LFS/history rewrite only as a separate explicit maintenance project."
links:
  items: consolidate-logs-db-private-archive
  notes: docs/archive-replication.md
tags:
  - logs
  - archive
  - private-repo
  - git-history
milestone: paper-2-evidence-cleanup
---

Follow-up split from `consolidate-logs-db-private-archive`.

The historical `machinespirits-eval-private/logs` archive remains in ordinary
git history at roughly 6.9 GB. PR #66 materialized
`~/.machinespirits-data/logs` as a real non-git directory for new writes and
Syncthing replication, but did not rewrite or migrate the private repository.

Decision: freeze the old private Git repository as a historical/read-only mirror.
Do not rewrite history, migrate to Git LFS, or delete the historical `logs/`
tree as incidental public-repo cleanup. The canonical archive is
`~/.machinespirits-data`: active logs live in `~/.machinespirits-data/logs` and
consistent DB copies live in `~/.machinespirits-data/snapshots`. Reopen Git
LFS/history rewrite only as a separate explicit maintenance project if clone
size or hosting policy becomes a material problem.

2026-07-01 Codex: Confirmed the canonical storage path is already documented in
`docs/archive-replication.md`: live logs belong in
`~/.machinespirits-data/logs` as a real non-git directory, with DB snapshots
replicated separately. The remaining work is deliberately outside this checkout:
decide whether the historical private repo should be frozen, migrated to Git
LFS, or history-rewritten. Do not perform that destructive/private-repo action
as incidental public-repo cleanup.

2026-07-02 Codex: Chose the low-risk freeze policy and documented it in
`docs/archive-replication.md`: `machinespirits-eval-private` is a legacy mirror,
not the active archive; `~/.machinespirits-data` is canonical; Syncthing plus DB
snapshots is the supported recovery path; Git LFS/history rewrite is explicitly
deferred to a future, separately scheduled private-repo migration only if clone
size or hosting policy makes it necessary. No private-repo files were changed.
