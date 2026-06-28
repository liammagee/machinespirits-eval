---
id: debloat-private-log-archive
title: De-bloat the private dialogue-log archive
status: triaged
type: maintenance
priority: P3
owner: unassigned
source: manual
created: 2026-06-28
updated: 2026-06-28
verification: "The private archive has a documented chosen storage path, logs are no longer ordinary large git history, and a clone/sync smoke confirms the canonical DB + logs remain recoverable."
links:
  items: consolidate-logs-db-private-archive
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
