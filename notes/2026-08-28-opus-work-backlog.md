# Opus work backlog — 2026-08-28

A ranked view of open workplan cards that Opus can do now, alone, with no paid
API calls and no human input. Source of truth stays `workplan/items/`; this note
links, it does not copy. Board state at time of writing: 550 items, 7 triaged,
6 active, 5 blocked, 4 in review. Lint and `wp:source-check` are green on main.

## Ready now (unassigned, no blockers, zero paid calls)

1. **`adaptive-eval-resume-and-shared-budget-scope`** (P1, infra).
   Add an adaptive dispatch to `eval-cli resume` and make multi-profile
   `--max-cost` scope explicit. Its dependency
   (`budget-tracker-balance-probe-and-rates`) is done, so the card is
   unblocked. Verification is offline runner tests only.

2. **`trap-and-dag-budget-ledger-adoption`** (P1, infra).
   Put the shared budget ledger at every metered-call boundary in the
   id-director trap pilot, the dialogue-engine trap baseline, and the
   DAG-resistance comparison. Same done dependency; mocked launcher tests only.

3. **`adaptive-tutor-canonical-kernel-contract`** (P1, infra).
   Name the canonical adaptive-tutor kernel, map each surface to it, and add
   seam tests. The card marks this as zero-call architecture and methods work.
   Larger than 1 and 2; mostly reading, writing, and focused tests.

4. **`tutor-core-runtime-lint-defects`** (P2, maintenance).
   Two probable runtime faults in `tutor-core/` (a const reassignment in
   `negotiateDialectically()`, an undeclared identifier in `quickGenerate()`).
   Small, sharp, test-first. Good first task of a session.

5. **`provider-balance-capability-probe`** (P2, infra).
   Optional provider-balance lookup for budgeted runs. Mocked tests only; no
   live provider contact.

6. **`tutor-core-lint-and-format`** (P3, maintenance).
   Bring `tutor-core/` under a committed lint/format policy. Do this only
   after card 4 lands — the card order is explicit about that.

## Small standing chores

- **Inbox triage.** Seven arxiv captures from 2026-08-10 and 2026-08-17 sit in
  `workplan/inbox/` untriaged. Shape each into a card or drop it, per the
  inbox README.

## Design-only, if the queue above empties

- **`adaptive-warrant-fine-grain-semantic-encoding-redesign`** (P2, research,
  claim_status `future`). Opus can draft the revised event-identity contract.
  The card authorizes no study and no model calls; any empirical attempt needs
  a fresh registration.

## Not for Opus right now

- `a1-human-learner-validation`, `impasse-corpus-phase1`,
  `superego-taxonomy-human-validation`, `rubric-v3-calibration-and-held-out-acceptance`
  — blocked on humans (IRB, annotation, expert coders, calibration).
- `warrant-quote-rule-letter-case` — waits until the guarded main block closes;
  the rule file is pinned by that run's instrument freeze.
- The four review-status cards — owned by codex, in review; do not pile on.
- The active experiment cards (`edged-register-stub-dag-replication`,
  frame-refuser pair, `adaptive-curriculum-memory-controller`) — engineering
  scaffolding is possible, but the runs themselves are paid and attended, so
  start these only with the user present.
