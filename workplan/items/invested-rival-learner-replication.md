---
id: invested-rival-learner-replication
title: "Replicate the invested-rival learner scaffold across worlds and models"
status: active
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-09-02
updated: 2026-09-02
branch: codex/invested-rival-assessment-recovery
verification: "Second pause sealed at 294/396: all 18 dialogues and 20/90 physical Opus packets are valid; assessment-only recovery preserves them and exposes exactly 70 missing packets."
claim_status: planned
links:
  notes:
    - notes/invested-rival-learner-replication-v1.md
  items:
    - invested-rival-learner-iteration
tags: [qwen, luna, learner-profiles, tutor-stub, replication, holdout]
---

# Replicate the active resistant-learner mechanism

Cross the frozen active-progression scaffold against the original
invested-rival prompt for Luna, normal Qwen and abliterated Qwen across three
new contemporary proof worlds.

## Acceptance

- [x] Prospective design fixes worlds, arms, order, routes, endpoints, gates,
  stopping rules, claim boundary and 396-attempt ceiling.
- [x] Zero-call prompt/world and packet preflight passes from a clean branch.
- [x] Design and runner reach `main`; a plain GO note is committed on a
  descendant of the clean detached launch commit.
- [ ] All 18 dialogues and 72 logical assessments complete, or the first
  non-recoverable failure is preserved without rerunning valid outputs.
- [ ] The private report applies the frozen gates and the Markdown note records
  each launch, run, recovery and analysis step.

## Log

- 2026-09-02: User requested the replication and a Markdown step record. The
  study is prospectively fixed at 18 dialogues and nine matched mechanism
  pairs across three new worlds and three learner routes. Model activity is
  inactive; 0/396 attempts used.
- 2026-09-02: Zero-call preflight passed all 38 proof worlds, 18 learner prompt
  boundaries, 24 tutor release boundaries, 90 assessment packets, 79 focused
  tests and 590 workplan items. No model or provider call was made.
- 2026-09-02: Pre-launch integration review split each world's 30 assessment
  packets into fixed baseline and scaffold batches of 15, respecting the
  shared scorer's 18-packet limit. Fresh dry-run, formatting, lint and focused
  tests all passed. Model activity remains inactive at 0/396.
- 2026-09-02: PR #938 passed CI and merged at launch commit `7e502650`. The
  signed GO note records the user's direct replication instruction and the
  unchanged 396-attempt ceiling; launch remains pending at 0/396.
- 2026-09-02: Initial launch admission stopped at 0/396 because the GO note
  named only the YAML, while the runner registers the Markdown design path.
  Correcting the note to name both paths is documentation-only recovery; no
  provider was contacted and the approved study is unchanged.
- 2026-09-02: Corrected admission launched successfully. At the user's pause,
  four Luna dialogues were complete and Tideway Luna baseline had six complete
  exchanges plus learner turn seven. The interruption was sealed at 76/396:
  75 completed responses and one response-free Sol attempt. A fresh recovery
  will preserve the prefix, retry only the interrupted tutor turn, and continue
  the untouched plan.
- 2026-09-02: Actual-source recovery rehearsal found exactly four complete
  arms, 13 saved replies in the Tideway partial arm, and one interrupted tutor
  attempt. Shared recovery tests passed 12/12 and the focused suite passed
  80/80. Recovery code is ready to merge; model activity is inactive at 76/396.
- 2026-09-02: The first recovery completed all 18 dialogues. The user paused
  during Opus assessment; the run was sealed at 294/396 with 20/90 valid
  physical packets and three response-free assessment reservations. Model
  activity is inactive and no completed output will be rerun.
- 2026-09-02: Assessment-only recovery now validates the actual sealed archive,
  preserves all 18 dialogues and 20 valid packets, reconciles 271 generation
  plus 23 assessment reservations, and schedules only the 70 missing packets.
  Focused tests pass 58/58 with formatting, lint and archive reconciliation
  clean. The unchanged ceiling leaves 102 attempts for completion and the
  remaining response-free reserve.
