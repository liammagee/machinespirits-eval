---
id: make-pilot-state-writes-atomic
title: Make human-pilot artifact writes and state transitions atomic
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-22
updated: 2026-07-24
verification: Invalid retries and out-of-state tutor turns fail without changing
  pilot artifacts; valid writes and state transitions commit together under
  concurrent requests; store and route tests pass hermetically.
claim_status: planned
depends_on: []
links:
  items:
    - a1-human-learner-validation
  code:
    - services/pilotStore.js
tags:
  - human-pilot
  - transactions
  - data-integrity
  - concurrency
milestone: human-pilot-prep
branch: codex/make-pilot-state-writes-atomic
---

`recordTestResponses()` and `recordExitSurvey()` write participant data before
validating the session transition, so a rejected retry can still overwrite a
finalized artifact. `appendTurn()` does not enforce the tutoring state and
allocates turn indices outside an atomic transition.

Acceptance:

- Validate the expected state before every write and commit artifact plus state
  transition in one transaction.
- Reject tutor turns outside `TUTORING` and allocate turn indices atomically.
- Add changed-data retry tests for finalized pretest, posttest, and exit survey
  records; each must throw and leave stored rows byte-equivalent.
- Add concurrent append tests proving stable ordering or explicit conflict.

Log:

- 2026-07-24 — Added immediate SQLite transaction boundaries for session
  transitions, test artifact plus phase completion, exit survey plus session
  completion, and tutoring-only turn appends. A 5-second busy timeout and
  in-transaction index allocation serialize concurrent append clients.
- 2026-07-24 — Added changed-data retry, out-of-phase append, and independent
  process concurrency coverage to the existing pilot test suite. Focused tests
  pass 39/39; the hermetic root suite and tutor-core suite pass (133/133 core),
  alongside lint, format, workplan (168/168), and diff checks. No hermetic test
  manifest, package, or workflow files were changed.
