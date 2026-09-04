# Durable evaluation execution contract

This contract defines the shared runtime boundary for model-backed evaluation
work. It separates four kinds of state that previously became conflated during
an operator pause or process failure.

1. **Attempt state** records each paid model attempt immediately before provider
   dispatch. Every reservation must end exactly once as completed, failed,
   cancelled before dispatch, or interrupted after dispatch. Capacity is only a
   local allowance; unused capacity is released and never counted as an attempt.
2. **Unit state** records accepted work. Restart may continue only missing work
   from the latest durable accepted turn or output. It may not rerun a completed
   unit or choose among multiple valid outcomes.
3. **Workflow state** records running, pause requested, paused, resuming,
   complete, or failed. A pause changes only this plane.
4. **Scientific verdict state** records the registered measurement disposition.
   Pause, resume, and technical recovery do not revise it.

`services/durableAttemptJournal.js` supplies the append-only reservation
journal, cross-process lock, stale in-flight reconciliation, durable pause state
machine, and the status projection used for user-visible counts and clock
estimates. `services/paidStudyLaunchContract.js` allocates reversible unit
capacity and passes the journal to a child.
`services/durablePaidModelAttemptBudget.js` adapts that journal to the budget
interface used by the invested-rival generation and assessment paths.
`services/tutorStubTraceRuntime.js` and the invested-rival runners reserve
immediately before provider dispatch, record dispatch, persist the response,
and then terminalize the shared attempt.

The action-outcome failed-unit recovery is the first concrete consumer. Its
partial-dialogue continuation treats `--auto-turns` as a total horizon and may
reuse a saved, accepted automated-learner output plus its saved public analysis.
The raw failed trace remains immutable; a fresh lineage trace combines the
accepted prefix with the new continuation for downstream zero-call extraction.

Resume has two independent horizon controls. The public CLI/application boundary
must propagate an actual resume request into orchestration, where a fixed turn
count means the dialogue's total horizon. The shared attempt ledger also receives
that maximum turn and refuses a reservation before provider dispatch when a call
would exceed it. Integration tests must cross the public application boundary;
testing orchestration alone does not prove that CLI state reached it. When a
launcher dies, closeout first reconciles every per-dispatch reservation, assigns
each one a terminal disposition, and includes those reservations in the study
total before another recovery can be admitted.

`config/paid-study-launcher-inventory.json` is the executable boundary. Its
`durableMigration` partition distinguishes the six launchers whose own dispatch
and recovery paths have exercised this contract from thirteen historical or
fixed-ceiling launchers retired from future paid dispatch. A retired launcher
remains readable for zero-call inspection and analysis, but
`services/retiredPaidLauncher.js` stops its paid path before admission,
destination creation, or provider dispatch. Reuse requires a prospective
successor design and a new launcher; retirement never rewrites sealed evidence.

The contract does not introduce a new approval ceremony. Study authorization
remains the registered design, merged launch source, user GO, and hard spend
ceiling described in `docs/paid-study-authorization-policy.md`. The journal
records and enforces execution; it does not re-authorize a study.
