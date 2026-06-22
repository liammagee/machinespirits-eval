---
id: auto-drop-daily-routine
title: Auto-drop daily-routine actions into the workplan inbox
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-06-22
updated: 2026-06-22
branch: claude/derivation-fast-iteration
verification: >-
  .github/workflows/workplan-ingest.yml runs `wp:ingest --daily` on a
  research-roundup PR and commits per-paper captures (deduped by arXiv id) to the
  PR branch; ingestDaily parses <div class="paper"> entries; the historical
  backfill produced 40 captures locally; workplan.js is lint-clean and wp:test is
  green.
links:
  items: build-workplan-tooling
  notes: notes/daily-notes/README.md
tags: [workplan, ci, daily-routine]
---

Closes the "optional routine hook" from [[build-workplan-tooling]]. The daily
research roundup now feeds the board hands-off: each paper's "Project relevance"
note becomes an inbox capture, deduped by arXiv id (mirroring the roundup's own
dedup rule), with the paper's flag (UNBLOCK / WATCH) carried into the capture for
triage prioritisation. Triage promotes the actionable ones to items and drops the
WATCH-only ones with a reason.
