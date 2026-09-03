---
id: tutor-stub-closure-assertion-timing
title: "Strict closure misses a learner who states the answer before the last premise is grounded"
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-09-02
updated: 2026-09-03
verification: "PR #977 is merged with every CI lane green: packed offline replay closes world-040 plants-d0 at learner turn 9 when p_uncover grounds the answer carried from turn 8, closes world-038 plants-d0 at turn 8, preserves all three frozen inquiry-world closure turns, and passes 114 focused regression tests plus the 595/595 workplan source check."
branch: codex/tutor-stub-closure-assertion-timing
depends_on: []
links:
  items:
    - lesson-world-transfer
  notes:
    - notes/poetics/hero-demo-runs/2026-09-02-lesson-worlds-bench.md
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/977
tags:
  - adaptive-tutor
  - closure
  - learner-dag
---

## What was found (2026-09-02, lesson-worlds bench)

Strict closure (`services/tutorStubDialogueClosure.js`,
`strict_learner_dag_grounded_and_asserted`) needs two things in the learner
DAG: every premise on a proof path grounded, and the answer asserted. The
assertion comes only from the learner-analysis `assert_answer` slot
(`services/dramaticDerivation/learnerDag.js`, "The assertion slot is the only
channel that closes a dialogue"), and it counts only in a turn at or after
the last premise is grounded. An assertion before grounding is recorded as
`unsupported_assertion` or `premature_assertion` and then forgotten.

World 040 plants-d0: the pupil said "Sam and me" at turns 3 and 8, the
last premise was grounded at turn 10, and the dialogue ran to the 24-turn
cap with bottleneck `assertion_gap` ("the evidence supports the conclusion,
but the learner has not fully stated it"). 038 plants ran to the cap the
same way. The forced-card run of 040 never filled the slot at all.

## Options

1. Let an earlier assertion carry forward: once grounding completes, an
   assertion of the same answer constant from any earlier turn closes the
   dialogue. Cheapest; changes closure turns only where an early answer was
   later grounded, so check the frozen inquiry fixtures.
2. Keep the rule and change the tutor: after grounding, the tutor asks the
   pupil to state the answer again. Costs one turn and a prompt change.
3. Keep both as they are and report early-answer dialogues as a separate
   outcome class.

Offline first: replay the packed 040 and 038 traces through the closure rule
under option 1 before any paid run.

## Resolution (2026-09-03)

Implemented option 1. The learner DAG now retains the latest explicit answer
assertion across turns and applies it only after the same answer becomes
entailed. A later mismatching assertion supersedes an earlier correct one, and
an unsupported early assertion remains non-closing.

Offline replay of the packed learner-analysis events produced the intended
closure points without any model calls:

- world-040 plants-d0 closes at learner turn 9 when `p_uncover` completes the
  proof path; its latest matching answer assertion is on turn 8.
- world-038 plants-d0 closes at learner turn 8, where its answer assertion and
  final derivation occur together.
- frozen inquiry-world replays retain their existing closure turns: Skyway A1
  at turn 14, Skyway A3 at turn 17, and Tideway A2 at turn 8.

Regression coverage now fixes the three decision boundaries: a matching early
answer carries after grounding, a later mismatch supersedes it, and a premature
unsupported assertion cannot close the dialogue. Focused learner-DAG, closure,
public-analysis, proxy-memory, restoration, packed-replay, and frozen-replay
tests pass. PR #977 merged as `f6a864ea` after the 595/595 workplan source
check, pre-push lint and formatting, hermetic contract, risk coverage, all eight
root-test shards, and the final CI result passed. The card is closed.
