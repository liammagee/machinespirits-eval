---
id: make-pilot-state-writes-atomic
title: Make human-pilot artifact writes and state transitions atomic
status: triaged
type: maintenance
priority: P1
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: Invalid retries and out-of-state tutor turns fail without
  changing pilot artifacts; valid writes and state transitions commit together
  under concurrent requests; store and route tests pass hermetically.
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
