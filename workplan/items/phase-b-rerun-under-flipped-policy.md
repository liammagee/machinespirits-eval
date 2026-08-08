---
id: phase-b-rerun-under-flipped-policy
title: Re-run the Phase-B contract contrast with the guards not scripting the tutor
status: active
type: research
priority: P2
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-08
verification: >-
  RUNNING from 2026-08-08. The same registered design (frozen cells, bare vs
  contract vs empty plan, n = 12 per version per cell, same models, learner
  blind), under boundaryPolicy shadow_advisory. Primary endpoint unchanged:
  legitimate closure, contract vs bare, pooled over the three frozen cells,
  two-sided Fisher exact, alpha = 0.05. Reported against the original as a
  pair: strict-harness verdict and open-harness verdict, never pooled.
claim_status: planned
links:
  code:
    - services/tutorStubGuardDisposition.js
  items:
    - guard-policy-default-flip
    - guard-validity-study
    - tutor-fallible-learner-closure-prereg
tags:
  - tutor-stub
  - guards
  - fallible-learner
---

## Why this one run

The Phase-B null — contract 67% closure vs bare 69%, p = 1.0 — is the one
registered finding the guard result genuinely reopens. Both versions spoke
through a harness that replaced the tutor's words on 43–74% of turns, and the
two versions were diluted unequally (contract cells 21–28% model-as-written,
bare 0–1%). A real difference between a tutor that carries its plan and one
that does not had little room to express itself when both mostly read from the
same script.

Everything else stands without a re-run: closure endpoints elsewhere are
evidence-driven and template-tolerant (the qwen floor closed at 100%
template), and prose-read findings get rates stamped instead
(`tutor-stub-template-rate-audit`).

## What a re-run can and cannot say

It can say whether the contract moves closure when the tutor actually speaks.
It cannot rescue the original registration — the original verdict stands as
the strict-harness result; this is a new registration on a changed harness,
and the two are reported side by side. If the null repeats with the tutor
speaking, the null is strong and the contract question closes for good.

Cost is the full Phase-B bill again — hence the user gate. Counted from the
stored traces of the original run: 108 dialogues, 1,156 turns, 4,702 model
calls. Under the flipped default the rewrite rung fires on 404 drafts instead
of 1,041, so the re-run should come in near 4,100 calls. Every call is on the
codex subscription, roughly three in four on gpt-5.6-terra (tutor turn,
rewrite, self-correction, opening, learner speech) and one in four on
gpt-5.6-sol (the learner-analysis read, one per turn). Closure is decided in
code against the proof-DAG, so no judge model is billed at all. A one-cell
pilot first is the cheaper option if the spend needs staging.

## Log

- 2026-08-06 — filed with the user's proviso: full validity-study results
  before anything proceeds, and this run additionally waits for explicit
  authorization.
- 2026-08-07 — first gate cleared. The study reported (108 pairs, draft 4.17 vs
  template 2.51) and the default flipped, so a re-run would now put the tutor's
  own words in the dialogue on roughly 98% of turns instead of 38%. Still
  waiting on the spend authorization. The catalog reference is the
  `boundaryPolicy` stamp, not a catalog version — v6 covers both columns.
- 2026-08-08 — **launched.** Registered here before the first paid call, as
  the design requires. One thing changes from the original Phase B: the guard
  policy, which is now `shadow_advisory` and comes from today's `main` with no
  override (`scripts/tutor-stub.js` resolves it; `TUTOR_STUB_GUARD_POLICY=strict`
  would restore the old regime). Everything else is held: the three frozen
  cells `false_memory × world_030_rowan_flat`, `low_agency × world_030_rowan_flat`,
  `low_agency × world_023_greyfen_lab`; three versions per cell, bare
  (`--blocks none`), contract (`--blocks first_draft_contract`) and the fixed
  empty plan (`--blocks empty_plan`); n = 12 dialogues per version per cell;
  codex `gpt-5.6-terra` in both seats at medium effort; authored turn caps
  (rowan 12, greyfen 14); the learner blind to version. Nine blocks, 108
  dialogues.

  **The original run is kept, and here is what keeping it means.** Its traces
  are not on this machine — `exports/` is untracked, so artifacts differ per
  checkout, and `fallible-phaseB` is absent here. What is kept is what was
  recorded: the per-cell logs and the verdict in
  `tutor-fallible-learner-closure-prereg`, paper §6.23 at v3.0.265, and the
  template rates in the guard catalog. None of those is edited by this card.
  The new run writes to `exports/tutor-stub-outcome/fallible-phaseB-shadow/`,
  one directory per block, so on any checkout where the original traces do
  exist nothing of theirs is touched.

  Attended and pausable. The runner records each dialogue to `results.jsonl`
  as it lands and a rerun with the same `--out` skips what is already there,
  so a stop costs at most the dialogue in flight. Command per block:

  ```
  node scripts/run-contract-outcome-pilot.js \
    --worlds <world> --n 12 --learner-profile <profile> \
    --blocks <none|first_draft_contract|empty_plan> --arm <bare|contract|empty_plan> \
    --out exports/tutor-stub-outcome/fallible-phaseB-shadow/<arm>--<profile>--<world>
  ```

- 2026-08-07 — the flip merged (PR #546) and the user parked the re-run until
  codex quota is free again. No decision is outstanding. Cost was counted off
  the original traces rather than estimated: ~4,100 calls expected, all on the
  codex subscription, about three-quarters gpt-5.6-terra and one-quarter
  gpt-5.6-sol, with no judge spend because closure is checked in code. Launch
  when there is headroom for roughly 4,100 calls in one quota window, or take
  the one-cell pilot first.
