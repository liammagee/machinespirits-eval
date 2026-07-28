# Program 2 Phase 5e R2 pilot amendment 1

Date: 2026-07-27
Status: prospective repair before any replacement pilot call
Workplan item: `program-2-phase5d-second-transfer-world`

## Failed pilot remains immutable

The first certified R2 pilot at source SHA
`5dc9bafc95e8cacbdb03c37f35cc8f461516617d` stopped after its second job.
One of four dialogues sealed. The `proof_skipper` silent-control job failed
both permitted attempts, so the frozen futility rule aborted the two remaining
jobs. The run is an apparatus-feasibility failure with no treatment-effect
estimate; its certificate, launch state, and traces remain unchanged under
`exports/program2-live-pilot-5e-r2-pilot/`.

The first failed attempt reached the correct final answer in the learner's
public turn, but the deterministic closure fallback replaced that specific
finding with generic uptake. The second attempt entailed the final answer
without making the required public assertion; the `compress_sayback` handoff
then remained questionless and never returned the world's public question.
That attempt ended on a Codex CLI policy violation caused by an unrecognized
transport/schema event rather than a known tool event.

## Prospective repair

This amendment changes only the three delivery seams exposed by those frozen
traces:

1. When the proof DAG entails the secret but the learner has not asserted it,
   `compress_sayback` compiles an assertion-gap handoff that asks the world's
   already-public question.
2. A mandatory deterministic closure preserves a learner-specific public
   finding before the explicit closing sentence; generic uptake cannot erase
   the answer that triggered closure.
3. A Codex CLI policy violation may receive at most one separately metered
   retry only when its sanitized event audit contains no known tool event.
   Command, file-change, function, MCP, tool-call, and web-search events remain
   terminal and fail closed.

Exact zero-model replay tests pin the first attempt's learner answer and the
second attempt's assertion gap. The model stack, Skyway world, four-cell pilot
matrix, seeds, local mini artifact, horizons, evidence-use classifier, safety
rules, cohort gates, and endpoint are unchanged.

## Replacement-run gate

The replacement pilot must use a new export root, a fresh clean commit, and a
new certificate bound to that commit. The old export root is never resumed or
overwritten. The 18-dialogue cohort remains closed: only a four-of-four sealed
replacement pilot that passes the frozen bundle checks can justify preparing
the cohort certificate, and launching the cohort still requires its own
authorization.
