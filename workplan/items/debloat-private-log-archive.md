---
id: debloat-private-log-archive
title: De-bloat the private dialogue-log archive
status: blocked
type: maintenance
priority: P3
owner: human
source: manual
created: 2026-06-28
updated: 2026-07-01
verification: "The private archive has a documented chosen storage path, logs are no longer ordinary large git history, and a clone/sync smoke confirms the canonical DB + logs remain recoverable."
blocked_by: Maintainer must choose and schedule the private-repo de-bloat path (freeze, Git LFS migration, or history rewrite) outside this public checkout.
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

Decide the maintainer path first: stop tracking the logs with a filesystem
archive, migrate to Git LFS, or perform a history rewrite. Then verify that the
canonical DB plus log archive can still be recovered on another machine.

2026-07-01 Codex: Confirmed the canonical storage path is already documented in
`docs/archive-replication.md`: live logs belong in
`~/.machinespirits-data/logs` as a real non-git directory, with DB snapshots
replicated separately. The remaining work is deliberately outside this checkout:
decide whether the historical private repo should be frozen, migrated to Git
LFS, or history-rewritten. Do not perform that destructive/private-repo action
as incidental public-repo cleanup.
