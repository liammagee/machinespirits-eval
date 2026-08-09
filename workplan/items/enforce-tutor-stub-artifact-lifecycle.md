---
id: enforce-tutor-stub-artifact-lifecycle
title: "Make tutor-stub empirical traces durable by construction"
status: review
type: infra
priority: P0
owner: codex
source: manual
created: 2026-08-09
updated: 2026-08-09
branch: codex/tutor-stub-artifact-lifecycle
verification: >-
  Every direct tutor-stub empirical child-command builder opts into required
  archival; the common trace writer mirrors every redacted event outside the
  worktree with a rolling integrity manifest, required mode fails before model
  calls when no archive is available, the direct-runner inventory fails CI on
  an unwired new caller, and focused tests plus lint and workplan source checks
  pass without model calls.
links:
  items:
    - run-artifact-archiving
    - consolidate-logs-db-private-archive
tags:
  - infra
  - tutor-stub
  - provenance
  - archive
---

# Make empirical tutor-stub traces survive their worktree

Tutor-stub traces are primary evidence, but the normal writers place them under
Git-ignored `exports/`, `.tutor-stub-traces/`, or `.tutor-stub-auto-eval/`
directories. Removing a temporary worktree can therefore remove the only copy.
The existing archive command preserves completed runs when someone remembers to
invoke it; this card removes that human-memory dependency for empirical traces.

## Acceptance contract

- One common trace-boundary mechanism, not one bespoke copier per experiment.
- Empirical runners request `required` archival explicitly in their child
  commands; interactive/product sessions remain opt-in.
- Each redacted JSONL event is synchronously mirrored into a compressed file in
  the private archive before the process may continue. A rolling chain hash and
  last sequence number make partial, aborted, and sealed mirrors inspectable.
- Required mode resolves the archive from an explicit path, environment, or the
  main repository sibling even when running in a linked `/private/tmp`
  worktree. If it cannot, trace creation fails before any model call.
- CI owns a direct-runner inventory: a new production caller of
  `scripts/tutor-stub.js` must opt in or record a narrow non-empirical exemption.
- The older batch archiver remains the route for compact whole-run bundles and
  light reports. The live mirror is the loss-prevention layer, not a replacement
  for evidence-package closeout.

## Claim boundary

This is evidence-lifecycle infrastructure. It recovers no already-lost corpus
and makes no empirical or pedagogical claim.

## Log

- 2026-08-09 — Opened after a second missing historical tutor-stub corpus
  blocked a deconfounding experiment. The previous archive card explicitly
  left full traces manual and other runners unwired; this follow-up moves
  preservation into the common trace boundary and makes empirical callers fail
  closed rather than silently running without a durable copy.
- 2026-08-09 — Implemented the common compressed live mirror, rolling chain
  manifest, linked-worktree archive resolution, required empirical-runner
  policy, caller-inventory audit, and hermetic archive isolation. The focused
  zero-model suite passed 201 assertions; lint, test-manifest, archive audit,
  workplan source validation, and diff checks also passed. Ready for review.
