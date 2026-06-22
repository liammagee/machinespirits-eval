---
id: consolidate-logs-db-private-archive
title: Consolidate dialogue logs + DB into the private archive repo
status: triaged
type: infra
priority: P2
owner: unassigned
source: manual
created: 2026-06-22
updated: 2026-06-22
verification: >-
  Dialogue logs are co-located with the DB under the private archive;
  npm run provenance:validate finds the logs; the dramatic fork's sibling-path
  log_dir stopgap is removed.
links:
  items: build-workplan-tooling
tags: [infra, provenance, logs, archive]
---

Standing infra task. The DB is already canonical at `~/.machinespirits-data`, but
dialogue logs are scattered (only the private repo git-archives them). Provenance
validation needs them co-located; the dramatic fork uses a sibling-path
`log_dir` stopgap until this lands.

No code surgery in the eval repo beyond pointing `EVAL_LOGS_DIR` at the
consolidated location and removing the stopgap; verify with provenance:validate.
