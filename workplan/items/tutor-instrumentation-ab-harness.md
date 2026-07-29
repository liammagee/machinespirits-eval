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
  advisory chars; the plan control's projected request is the learner utterance plus
  one fixed 995-char plan, identical on every turn; every arm is audited with the
  recorded run's guard set and pinning is an identity on the fixtures; a paid run
  writes report.json, report.md, and a swimlane diff whose failure-cluster deltas
  separate the arms; `node scripts/judge-tutor-stub-ab-pairs.js --mock` exercises
  the whole blind-judging path with no model calls, and `--limit 0` re-summarises a
  recorded corpus without judging anything."
claim_status: scope-bound
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

First result, 2026-07-29, on the bench's own rules. Broken rules per turn,
pooled over every run so far: bare tutor 5.04, contract 1.67, and 4.4–5.3 for
each of the other single pieces — length padding, continuity, evidence window,
learner classifier, redacted proof-DAG readout, discourse scaffold. Only the
per-turn performance contract leaves the bare tutor's band. The apparent cost of
the contract, that it was the only arm that ever leaked, does not survive
inspection: all nine recorded leaks are checker false positives, tracked in
`workplan/items/tutor-stub-leak-audit-false-positives.md`.

Second result, 2026-07-29: an outside reader reverses that ordering. Most of
the bench's rules ask whether the tutor did what its host plan told it to do, so
the arm carrying the plan wins them close to by construction. To score the same
recorded replies through a channel that shares nothing with the plan,
`scripts/judge-tutor-stub-ab-pairs.js` shows a judge the frozen public
transcript, the learner's turn, and two candidate next turns labelled A and B,
and asks which is the better next thing to say. The judge never sees the plan,
the private notes, or the rules; the A/B layout is fixed by a hash of the pair
id; the judge runs on a model that wrote neither reply. Over 88 pairs on
Nocturne and Greyfen, 68 decided: **the contract is preferred on 10, 15%**
(se 4%). Not length — the contract wins 0% in the band where it is 292–506 chars
longer and 12% where the two replies are within 121 chars. Not layout — 11% when
the bare reply is shown first, 18% when second. 20 pairs were turned away by the
judge's own content filter, all in Greyfen.

Third result, 2026-07-29: a plan with none of our content buys nothing. The
contract does two things at once — it hands the tutor a shape for the turn and
it fills that shape with the turn's own case facts and proof state. The plan
control (`generic_plan_only`) keeps the first and drops the second: a fixed
995-character four-slot writing plan, the same text on every turn of both
scenes, so it cannot carry anything about the turn it is attached to. On eleven
turns in one batch (`exports/tutor-stub-ab/plan-control-1/`) the bench scores
bare 54 broken rules, generic plan 61, contract 18. Blind, the generic plan ties
the bare tutor 4–4 and beats the contract 8–0. Two of those eight pairs had the
contract reply *shorter* than the generic one. Both comparisons rest on 8
decided pairs with 3 turned away, so they are small; the direction agrees with
the 88-pair set.

Why the two rulers disagree, countable rather than asserted. The bench computes
a performance contract for every turn and grades all three arms against it, but
shows it to one. Split the contract's 36-cluster win by what each rule keys on:
26 come from rules that grade against the plan's own named slots — did you use
the part it named (−8), the tactic it named (−8), the source it named (−4), the
question its handoff permits (−4), plus uptake and handoff-question rules (−2).
Only 10 come from rules graded against the public scene every arm shares —
asking for evidence not yet in the scene (−3), releasing a clue with no
character or gesture to carry it (−2), and six others at −1. The plan control's
+7 is the same effect backwards: its own text says end with one question, so on
turns where the hidden contract forbids a question it breaks that rule three
times more often than the bare tutor, which stays quiet by luck.

In flight, not yet a result: one objection to the blind reading is that the
judge cannot tell a scheduled clue release from invented plot, and penalised the
contract for the former. `--show-due` puts the clue the world file schedules for
that turn in front of the judge as a fact of the scene, alike for both
candidates. At 34 of 88 pairs it does not rescue the contract — 20 decided,
contract on 2 (10%), against 0 of 14 decided blind on those same pairs — but it
is a third of the set and should finish before the conclusion is written
anywhere else.

Standing limitation: turns after the first are counterfactual for every arm
except the one that produced the recording, since the frozen learner utterances
answered the recorded tutor. Each row is a same-context comparison of N tutors
on one fixed prompt, not two free-running conversations. This is a visual and
regression instrument; it says nothing about human learning. The blind judge is
a second instrument, not a ground truth: it is one model's reading of which turn
serves the learner better, on two scenes, with one speaking model behind both
candidates. It is worth what it is worth because it shares nothing with the plan
— not because it is right.
