# 020 — Codex report: mechanical-offset repair and counterfactual stop

**Date:** 12 August 2026
**Driver lease:** `DRIVER-LEASE-2026-08-12-D`
**Boundary:** relay-019 zero-call counterfactual failed the seed-506 relaunch gate; waiting for human direction

## Prospective repair

Commit `bacf10b6719238e919385a437134838a1a4e1f2c` implements relay 019's
mechanical span rule for both model seats:

- the live learner-analysis and semantic-reader model schemas now request one
  literal `evidence_span` string and contain no numeric offset fields;
- the validator locates that quote exactly once in the current learner turn and
  derives JavaScript UTF-16 `start` and exclusive `end` offsets;
- missing and repeated quotes fail closed;
- event order and overlap are checked from the derived intervals;
- act-specific target/value constraints are unchanged;
- the design records the repair as prospective and does not rescore any
  historical corpus;
- the zero-call preflight now audits both model-facing schemas for derivable
  offset fields and dynamically covers unique, absent, duplicate, and
  overlapping quotes;
- `scripts/replay-adaptive-warrant-semantic-counterfactual.js` binds an exact
  halted trace closure and replays the production strict parser without a
  provider call.

Focused live-extractor, reader-instrument, and semantic-gate tests passed:
126/126. The clean detached commit preflight passed 36/36 with verdict
`instrument_ready`. Its SHA-256 is
`4e15fc2c9ba9d19fb8923c9483ffdce07adbbeb4713f8f13b5d9c4347b08cfe2`.

## Exact zero-call counterfactual

The replay used all 48 preserved learner-analysis responses from the six sealed
seed-505 traces at
`/private/tmp/adaptive-warrant-v3-matrix-live-a4529e79-s505`. It was bound to:

- original source commit:
  `a4529e798012b2fb0366fea30fc2a0798b3a69ab`;
- repaired validator commit:
  `bacf10b6719238e919385a437134838a1a4e1f2c`;
- six-trace input-closure SHA-256:
  `60124bc8910b54bbebde7db2a17a9d458edfaf220622d0791a01707236046ffc`.

The artifact is
`/private/tmp/adaptive-warrant-v3-seed505-offset-counterfactual-bacf10b6.json`,
SHA-256
`5a5f2f61ee9d373533bfe2507d6e79d8e3b0c82a8dd2003c193ea5edc385dc6d`.
It records zero provider calls.

Result:

- completed analysis responses: 48;
- predicted surviving analyses: 22;
- predicted discarded analyses: 26;
- predicted discard rate: **26/48 = 54.2%**;
- predeclared maximum: 10%;
- seed-506 relaunch gate: **FAIL**.

The 26 discarded rows partition as:

- 15 target/value-contract failures without overlap;
- six target/value-contract failures plus overlapping non-atomic events;
- four overlap-only failures;
- one genuinely non-literal evidence quote;
- zero other failures.

At event-field granularity, the non-exclusive residual issue counts are 19
`events[0].target:value_component_sets_forbidden_for_non_request`, six at
`events[1]`, two at `events[2]`, ten
`overlapping_events:non_atomic_span`, and one
`events[1].evidence_span:not_literal`.

## Classification and stop

Mechanical offset derivation removes the identified schema arithmetic confound,
but the residual discard rate remains far above the predeclared threshold. The
residue is therefore semantic non-compliance under the unchanged act contract,
not an offset or transport artifact. In particular, Luna frequently assigns
requested value/component sets to non-request acts, and sometimes expresses
multiple events with overlapping non-atomic clauses.

Per relay 019, seed 506 is not launched. No acceptance ping, matrix dialogue,
semantic reader, decision reader, or outcome call was made after the seed-505
halt. The remaining choice is human-facing: upgrade the learner-analysis seat
model or explicitly accept and preregister a coverage caveat before any further
representative matrix.
