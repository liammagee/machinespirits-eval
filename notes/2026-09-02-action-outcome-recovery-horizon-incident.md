# Action-outcome recovery turn-horizon incident

Date: 2026-09-02

Workplan item: `adaptive-curriculum-memory-controller`

Affected study: `tutor-stub-action-outcome-comparable-collection-v2-failed-unit-recovery`

## What happened

The authorized three-dialogue technical recovery started from merged commit
`16cf3e2c63d7be09add9d352275adb118db91809`. Its first unit resumed a source
dialogue with four accepted turns and passed `--auto-turns 8`. The trace then
reported `turnHorizonMode: additional`, so the process continued beyond the
registered total horizon of eight turns. The operator stopped the run before a
second unit started.

The interrupted segment made 18 durable provider-dispatch reservations. Seventeen
completed and the eighteenth had been dispatched when the process was stopped.
The first unit durably completed turns 5 through 10 and began learner processing
for turn 11. No other recovery unit was touched.

## Root cause

Turn orchestration already implemented the intended rule: a resume interprets
the configured count as the total dialogue horizon. The noninteractive
application selected that mode only when it received a `resumedDialogue` object.
The CLI resume path did not pass that object across this boundary even though
`args.resume` was present. The application therefore selected the fresh-run
`additional` mode.

The initial regression test called turn orchestration directly. It proved the
inner calculation but did not cross the public CLI/application boundary where
resume state was lost. The shared attempt ledger independently enforced the
study and unit attempt ceilings, but it had no registered maximum turn and
therefore could not stop a turn-9 reservation. Interrupted-launch sealing also
counted the legacy batch reservation event and omitted the newer per-dispatch
reservation events.

## Evidence disposition

The original source trace and the interrupted continuation trace remain
immutable. The continuation trace is sealed by SHA-256 in the recovery design.
Turns 5 through 8 occurred before the registered horizon and are accepted once;
they will be materialized into a fresh lineage trace without provider calls.
Turns 9 and 10, and the partial work for turn 11, remain incident evidence but
are excluded from the registered eight-turn corpus. Their provider reservations
still count against the 100-attempt recovery ceiling. Nothing is resampled and
no output is selected by quality.

## Permanent controls

1. The noninteractive application derives resume mode from the actual
   `--resume` or `--resume-last` request as well as a supplied resume object.
2. Every collection child passes the registered total turn horizon into the
   shared attempt ledger. The ledger rejects an over-horizon call before it can
   reserve or dispatch to a provider.
3. Interrupted closeout reconciles open per-dispatch attempts, terminalizes
   them, and counts both legacy and per-dispatch reservations before admitting
   recovery.
4. The recovery runner accepts the sealed predecessor explicitly, validates its
   18/17/1 accounting and exact touched unit, banks only the sealed through-turn-8
   prefix, and dispatches only the two still-incomplete units.
5. Regression tests cover the public noninteractive boundary, child-to-ledger
   horizon propagation, fail-before-dispatch enforcement, interrupted
   per-dispatch reconciliation, and exact prefix truncation.

## Impact

The defect consumed recovery budget and time. It did not change the registered
scientific design, measurement rules, model route, seed, or claim boundary. The
incident produces no evidence about learning, transfer, human benefit, action
family superiority, or memory-controller benefit.
