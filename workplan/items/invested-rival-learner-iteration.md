---
id: invested-rival-learner-iteration
title: "Iterate the invested-rival learner with Luna, then retest Qwen"
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-09-01
updated: 2026-09-02
verification: "Five sealed dialogues and 20 logical Opus assessments completed in 101/110 attempts; the private reports separate Luna development from the frozen one-dialogue-per-model held-out comparison and preserve the exploratory claim boundary."
claim_status: exploratory
links:
  notes:
    - notes/invested-rival-learner-iteration-v1-design.md
    - notes/invested-rival-learner-iteration-v1-go-2026-09-01.md
  items:
    - invested-rival-luna-reference
  runs:
    - invested-rival-learner-iteration-v1
tags: [qwen, luna, learner-profiles, tutor-stub, iteration, holdout]
---

# Iterate the active resistant learner

Use Luna to develop a behavior-only progression scaffold that produces a real
initial commitment, evidence-sensitive movement, semantic variety and a stable
voice. Freeze that mechanism before applying it to Luna, normal Qwen and
abliterated Qwen on a held-out contemporary inquiry.

## Acceptance

- [x] Design fixes the two Luna development rungs, held-out world, three final
  arms, routes, measurements, stopping rules, claim boundary and 110-attempt
  ceiling.
- [x] Prompt/world audits and focused tests pass; the zero-call preview contains
  two development lanes, three held-out lanes and 25 assessment packets.
- [x] The user authorizes launch; the design and plain GO note reach `main` in one PR.
- [x] A clean detached launch completes all five dialogues and assessments, or
  preserves the first non-recoverable failure under the shared ceiling.
- [x] The private report separates development from held-out evidence and states
  whether the active-progression mechanism improved the original failure mode.

## Log

- 2026-09-01: Design work began after the Luna reference showed the same core
  plateau as both Qwen variants: the learner was coherent and lexically varied
  but behaved like a procedural evidence auditor, repeated the same semantic
  demand and did not inhabit its opening rival explanation. Model activity is
  inactive; 0/110 attempts used.
- 2026-09-01: Zero-call rehearsal produced two Luna development lanes, three
  held-out learner lanes and 25 Opus packet previews. Both worlds pass the
  derivation-quality gate; speaker prompt and privilege audits pass at every
  proof-release boundary; focused continuity, launcher-inventory and workplan
  checks pass. No model was contacted.
- 2026-09-01: User authorized the prepared study with "okay lets proceed."
  The plain GO note records that instruction without requiring a special
  copy/paste formula. Model activity remains inactive at 0/110 attempts while
  the single launch PR is prepared.
- 2026-09-02: PR #934 merged at launch commit `898ed9c3`. The clean detached
  run completed all five dialogues and all 20 logical assessments in 25 planned
  Opus packets. Two response-free assessment calls passed on one bounded retry
  each; no dialogue or valid assessment was rerun. The sealed ledger records
  101 reserved attempts under the 110-attempt ceiling.
- 2026-09-02: The Luna development iteration improved from D1 to D2 on the
  registered 1-5 measures: overall quality 2 to 4, pedagogy 2 to 4,
  nonrepetition 2 to 3 and character adherence 3 to 4. In the frozen held-out
  scene, Luna scored 3/3/3/2, normal Qwen 3.5/4/3/3 and abliterated Qwen
  4/4/3/4 on those same measures. All three learners produced a real
  claim-prediction-revision-concession arc, but semantic repetition remained
  3/5 and Luna underplayed the invested-rival voice. With one held-out dialogue
  per route, this is evidence that the scaffold improved the original failure
  mode, not a model ranking or a causal abliteration result.
- 2026-09-02: Private artifact hashes: completed
  `38704a2385dcc3eba024cf0b5e4f40441e50167b096a69fe701fe04412c13754`;
  development report data
  `9c2d927c33f695ce43b2bd6196a77b084d342317192129df2fdb35f929092501`;
  held-out report data
  `b78b81612468580140733cc7c46acec573b56cea89163587cacbc17a4319f5d1`;
  development public interchange
  `ca862cd42a816c055a203357709c7a7ed1292488b5ee408fdcc80e254cb0df93`;
  held-out public interchange
  `ac76fc4d05bddd095fb0ffa08cc6473a9333f2cb16961853b72826c8db2e0367`.
