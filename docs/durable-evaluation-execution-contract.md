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
capacity and passes the journal to a child. `services/tutorStubTraceRuntime.js`
reserves immediately before provider dispatch, records dispatch, persists the
trace response, and then terminalizes the shared attempt.

The action-outcome failed-unit recovery is the first concrete consumer. Its
partial-dialogue continuation treats `--auto-turns` as a total horizon and may
reuse a saved, accepted automated-learner output plus its saved public analysis.
The raw failed trace remains immutable; a fresh lineage trace combines the
accepted prefix with the new continuation for downstream zero-call extraction.

This is shared infrastructure, but it is not yet universal. Other paid runners
continue to use their existing ledgers and recovery rules until the migration
card `durable-evaluation-runner-migration` explicitly moves and tests each one.
No runner should claim these guarantees merely because this service exists.

The contract does not introduce a new approval ceremony. Study authorization
remains the registered design, merged launch source, user GO, and hard spend
ceiling described in `docs/paid-study-authorization-policy.md`. The journal
records and enforces execution; it does not re-authorize a study.
