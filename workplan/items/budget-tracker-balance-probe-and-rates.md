---
id: budget-tracker-balance-probe-and-rates
title: "Budget tracker safety foundation: durable reservations and rate provenance"
status: review
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: Transactional SQLite tests prove per-attempt reservations survive
  store reopen, ambiguous attempts remain charged, and concurrent reservations
  cannot oversubscribe the ceiling; mocked real-LLM tests prove persistence
  happens before every physical retry or corrective dispatch, provider-reported
  zero is distinct from missing cost, non-metered routes are explicit, and
  catalog estimates or conservative bounds carry provider/model/source/date
  provenance rather than masquerading as exact spend.
claim_status: methods
links:
  notes:
    - services/adaptiveTutor/budgetTracker.js
    - services/adaptiveTutor/realLLM.js
  items:
    - provider-balance-capability-probe
    - adaptive-eval-resume-and-shared-budget-scope
    - trap-and-dag-budget-ledger-adoption
tags:
  - adaptive-tutor
  - spend-ceiling
  - codex-sol
  - effort-xhigh
branch: codex/budget-tracker-balance-probe-and-rates
---

The initial card combined three concerns that do not currently share an honest
end-to-end completion boundary. The pre-coding audit found deeper defects in
the safety rail itself:

1. One pre-call check can cover up to three physical transport attempts, and
   the format-correction call bypasses that check. Failed or crashed calls can
   therefore spend without entering the accumulator.
2. The in-memory scalar restarts at zero and cannot make a reservation durable
   before dispatch. A post-call snapshot is too late for crash safety.
3. Provider-reported `0` and absent cost are conflated. Unknown models inherit
   an unlabeled fallback rate, so an estimate is stored as though it were exact.
4. Provider route matters: CLI/local calls are not dollar-metered here, but the
   provider-blind fallback can still reject them as if they were.

This PR therefore lands the reusable foundation: a run-scoped SQLite attempt
ledger; transactional reserve-before-dispatch and settle/ambiguous states;
rehydration from the same evaluation store; and structured cost provenance with
separate provider-reported, catalog-estimated, conservative-bound, unknown, and
not-metered-here states. Dates are provenance, not a brittle expiry switch.

It intentionally does **not** claim that adaptive `resume` exists (the current
resume command only reconstructs standard evaluations), that the id-director
and disposable DAG launchers are fully covered, or that every provider exposes
a balance API. Those integrations are the linked follow-up cards. In
particular, balance probing must be capability-based and optional; an
unsupported or temporarily unavailable probe is not a zero balance.

Suggested worker: Codex Sol at Extra High reasoning effort.

2026-08-27 Codex: Pre-coding audit narrowed the card to the safety-critical
foundation above. Model activity remained inactive and no provider call was
made. The branch was created at `973e1f2f` and refreshed before commit to
current `main` at `a6fc9249`.

2026-08-27 Codex: Implemented the safety foundation. The evaluation store now
commits a run ceiling and provider-qualified attempt reservation in one
`BEGIN IMMEDIATE` transaction before dispatch; pending and ambiguous attempts
retain exposure across store reopen, and an above-ceiling settlement is
recorded before the adaptive run halts. Every transport retry and format
correction gets its own reservation. Provider-reported zero, missing cost,
catalog estimates, conservative unresolved exposure, and `not_metered_here`
activity remain distinct, with configured and observed provider/model plus the
numeric rate snapshot persisted as provenance. OpenRouter no longer converts a
missing provider cost into numeric zero.

Offline evidence: 86/86 focused Node checks and 35/35 in-housed provider checks
passed; `npm run lint:all`, `npm run test:manifest`,
`npm run wp:source-check` (542/542 cards), and `git diff --check` passed. An
independent Extra High safety review reported no actionable findings. Model
activity remained inactive: 0 provider/model calls completed, 0 failed, hard
ceiling 0. No balance probe or paid/model-backed run was started.
