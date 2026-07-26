---
id: tutor-instrumentation-showcase
title: Instrumentation showcase — two free-running dialogues, bare vs instrumented, run to close
status: active
type: infra
priority: P2
owner: claude
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: "`npm run tutor:stub:showcase -- --print-plan` emits a finite zero-call
  plan whose arms hold learner parity in every preset; a paid run writes report.json,
  report.md, and a turn-aligned two-column transcripts.html; each arm's resolution
  verdict comes from the stub's own closure lifecycle, and guard coverage is reported
  separately from guard failures."
claim_status: methods
depends_on:
  - tutor-instrumentation-ab-harness
links:
  notes:
    - docs/tutor-instrumentation-showcase.md
  items:
    - tutor-instrumentation-ab-harness
tags:
  - tutor-stub
  - instrument
  - demo
branch: claude/tutor-instrumentation-ab
---

The frozen A/B answers what a given advisory block buys on one recorded turn.
It cannot produce a conversation that ends: the frozen learner utterances were
written in reply to the recorded tutor, so no arm is ever talked to a
conclusion. Showing the system to anyone outside the project needs transcripts
that resolve.

This item builds the second instrument. Each arm spawns its own
`scripts/tutor-stub.js` child with `--auto-learner`, runs to its own close on a
short contemporary world, and both are rendered side by side with a benchmark
panel: turns, calls, seconds per turn, tokens, guard coverage, guard failures,
first-draft repairs, and whether the dialogue resolved.

Design decisions worth keeping:

- **Learner parity is the free-running analogue of the A/B's guard pinning.**
  Nothing can be frozen here, so the plan freezes everything *except* a declared
  tutor-side flag set. `assertTutorStubShowcaseLearnerParity` strips those flags
  from each arm's child argv, normalises the per-arm trace directory, and
  requires a byte-identical residue per (scenario, model) cell. Without it a
  "bare" arm could quietly get an easier learner and the demo would be showing
  the learner. A flag outside the declared set is rejected at config load.
- **Guard coverage is reported separately from guard merit.** On the probe runs
  the bare arm ran 4 of the 7 `tutor*Audit` checks and the instrumented arm ran
  all 7. A bare arm's clean sheet is partly a bare arm not being checked, so
  `auditsRun` and `auditsFailed` are distinct columns and the prose above the
  table says why.
- **Resolution is the stub's own verdict**, read off
  `dialogueClosure.lifecycle.completedAtTurn`, not off the transcript text — the
  same mechanism asked of both arms. `stopReason` records why an unresolved
  dialogue stopped, and `budgetBinding` prevents a truncated dialogue being read
  as a finished one.
- **First-draft repair is the architectural moment.**
  `turnRecord.tutorResponseRepaired: true` marks a draft that failed its guards
  and was regenerated before the learner saw it. Machine-recorded, so the demo
  shows measured behaviour rather than a characterisation of it.
- **Turn-aligned columns, not swimlanes.** Free-running arms share no learner
  spine, so the A/B's renderer does not apply. Each arm gets a full-height
  column and the columns align by turn index; a cell past the end of a shorter
  dialogue says so rather than shifting rows out of alignment.

Standing limitation, stated in the config, the service header, `report.md`, and
on the rendered page: **this is not a controlled comparison.** Each arm has its
own learner answering its own tutor, so the transcripts diverge after the first
exchange and no difference between them is attributable to instrumentation
alone. The frozen A/B stays the causal instrument; the two are meant to be read
together. Nothing here is an empirical claim about learning, human or
simulated, and none of it belongs in the paper as one.

Cost measured on the probe turns (codex CLI, medium effort): bare 28.5s wall and
4 model calls per turn, instrumented 47.2s and 5, the extra call being the
first-draft repair. Tokens are recorded but the CLI bridges are
subscription-quota, so cost is expressed in calls and wall clock rather than
dollars.
