---
id: tutor-instrumentation-ab-harness
title: Instrumentation A/B — bare tutor vs instrumented tutor on one frozen dialogue
status: active
type: infra
priority: P2
owner: claude
source: manual
created: 2026-07-26
updated: 2026-07-29
verification: "`npm run tutor:stub:ab -- --print-plan` emits a finite zero-call plan;
  the baseline arm's projected request is exactly the learner utterance with zero
  advisory chars; every arm is audited with the recorded run's guard set and pinning
  is an identity on the fixtures; a paid run writes report.json, report.md, and a
  swimlane diff whose failure-cluster deltas separate the arms."
claim_status: methods
links:
  notes:
    - docs/tutor-instrumentation-ab.md
tags:
  - tutor-stub
  - instrument
  - frozen-replay
branch: claude/tutor-instrumentation-ab
---

The tutor stub has accumulated a lot of private planner context — an evidence
window, a learner classifier, a redacted learner proof-DAG, a human discourse
scaffold, a per-turn performance contract. Nothing measured what any single
piece buys, because varying instrumentation previously meant rerunning the whole
dialogue and losing the comparison.

This item builds the A/B: replay one recorded dialogue past N arms that differ
only in which advisory blocks reach the speaking tutor, grade every arm with the
same deterministic frozen-turn audit (PR #261's `auditTutorStubFrozenCandidate`),
and render the arms as a swimlane diff with the shared learner on the spine.

Design decisions worth keeping:

- **Advisory-block projection.** Instrumentation already ships as delimited
  `[Header] … [End header]` blocks in the final user message. An arm is a subset
  of those blocks; stripping all of them leaves exactly the learner's utterance.
  This needs no change to `scripts/tutor-stub.js`.
- **Guard pinning.** Every arm is audited with the guard set the *recording* had
  enabled. Without it a bare arm is graded with all guards off and passes
  trivially. Pinning is an exact identity on the fixture guards, so it cannot
  itself move a verdict.
- **One slot, two headers.** The contract renders under either
  `[Tutor-only host plan]` or `[Tutor-only first-draft performance contract]`;
  they are one feature, else an arm could claim it dropped the contract while
  the contract was still present.

Why the reports lead with cluster counts rather than pass rate: every recorded
fixture turn fails `liveTurnProgressionAudit:learner_uptake_not_realized`, so
pass rate reads 0/N for every arm. That is the known *live-parity
reclassification* the frozen-replay corpus already tracks, not a defect this
work introduced — `auditTutorStubFrozenCandidate` skips the live
turn-progression and source-alignment audits only when handed a valid
`jointPerformanceComposition`, which a text-only replay never has. Nocturne
t007/t009/t010 carry `recordedAuditOk: true` yet recompute to `ok: false` on
exactly those two cluster families, and `tests/tutorStubFrozenReplay.test.js`
asserts that reclassifications never land outside them.

Not established, and deliberately not claimed anywhere: whether
`tutor:stub:pr-benchmark` now gates harder than it used to. It grades freshly
generated text, not recorded text, and has not been run against this.

First result, 2026-07-29. Broken rules per turn, pooled over every run so far:
bare tutor 5.04, contract 1.67, and 4.4–5.3 for each of the other single pieces
— length padding, continuity, evidence window, learner classifier, redacted
proof-DAG readout, discourse scaffold. Only the per-turn performance contract
leaves the bare tutor's band. The apparent cost of the contract, that it was the
only arm that ever leaked, does not survive inspection: all nine recorded leaks
are checker false positives, tracked in
`workplan/items/tutor-stub-leak-audit-false-positives.md`.

Standing limitation: turns after the first are counterfactual for every arm
except the one that produced the recording, since the frozen learner utterances
answered the recorded tutor. Each row is a same-context comparison of N tutors
on one fixed prompt, not two free-running conversations. This is a visual and
regression instrument; it says nothing about human learning.
