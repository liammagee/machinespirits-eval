---
id: phase-b-rerun-under-flipped-policy
title: Re-run the Phase-B contract contrast with the guards not scripting the tutor
status: done
type: research
priority: P2
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-08
verification: >-
  RAN AND CLOSED 2026-08-08. The same registered design (frozen cells, bare vs
  contract vs empty plan, n = 12 per version per cell, same models, learner
  blind), under boundaryPolicy shadow_advisory. Primary endpoint unchanged:
  legitimate closure, contract vs bare, pooled over the three frozen cells,
  two-sided Fisher exact, alpha = 0.05. Reported against the original as a
  pair: strict-harness verdict and open-harness verdict, never pooled.
  Verdict: contract 12/36 against bare 24/36, p = 0.0091 — with the tutor
  speaking its own plan the contract lowers closure by 33 points, where the
  strict-harness original found the two versions level.
claim_status: scope-bound
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

- 2026-08-08 — **finished, and the null reverses.** Nine blocks ran back to
  back from 06:15 to 19:49 UTC, 108 dialogues and 1,235 turns, none aborted or
  exiting badly. The original run lost 14 of its 108 to codex tool-reflex
  kills, so the harness change removed that loss as well.

  The premise held. Measured from this run's own traces by
  `scripts/census-guard-template-rate.js --sweep`, every block sits at 1–5%
  template against the original's 62%, and the tutor's first draft shipped
  unaltered on 90–96% of contract turns and 48–64% of bare and empty-plan
  turns, against the original's 10% overall.

  **Primary endpoint.** Legitimate closure, contract against bare, pooled over
  the three frozen cells: contract 12/36 (33%), bare 24/36 (67%), a drop of 33
  points, two-sided Fisher exact p = 0.0091. Every cell points the same way —
  greyfen/low_agency 5/12 against 10/12, rowan/false_memory 4/12 against 7/12,
  rowan/low_agency 3/12 against 7/12.

  Reported as a pair with the original and never pooled with it: strict
  harness, contract 22/33 against bare 20/29, p = 1.000; open harness, the
  above. The strict-harness null was not the contract doing nothing. Both
  versions were reading the same template on most turns, so neither plan had
  much room to act. With the tutor speaking, the contract acts, and for this
  endpoint it costs.

  The fixed empty plan closed 19/36 (53%), which does not separate from bare
  (p = 0.34), and it is unstable across cells — 11/12, 6/12, 2/12. Treat it as
  a weak control here rather than a matched one.

  **Why the contract loses, measured rather than guessed.** The failure is
  always the same: the learner never states the conclusion. Every dialogue that
  reached closure was grounded (5/5, 4/4, 3/3 contract; 24/24 bare), so the
  voiced premises are never the problem. Three accounts were tested and failed.
  Evidence timing does not separate — the secret first becomes derivable at
  turn 6.0 in all three versions, and the contract has more turns left after
  that (7.1 against bare's 5.5). The tutor naming the verdict itself does not
  separate — it does so in 12/12 contract, 12/12 empty plan, 11/12 bare.
  Ending every turn on a question does not separate — the contract ends 99% of
  its late non-final turns that way in cell 1, but the empty plan ends 100% of
  its own and closes 11/12.

  What separates all nine blocks with no overlap is the *form* of the question.
  Share of late tutor questions that are yes/no rather than open: contract 38%,
  48%, 68%; empty plan 8%, 14%, 20%; bare 2%, 10%, 19%. Pooled, contract 51%
  (126 of 247) against bare 11% (12 of 113). A yes/no question can be answered
  without the learner ever saying the verdict, and the endpoint counts only the
  learner saying it. The contract also ran to the turn cap 24/36 against bare's
  12/36 and wrote 85 words a turn against bare's 48.

  The instruction behind it is `services/tutorStubFirstDraftContract.js:454` —
  "Ask one HANDOFF question about what SOURCE changes, supports, or rules out."
  A question about what the released clue supports takes the shape *does this
  support X*, with X spelled out by the tutor. In the cell-1 contract block,
  384 of 464 handoff instructions require a question and 180 are that one.

  Worked examples, both from the turn before the dialogue ended. Empty plan,
  which closed: "With both records, what ruined the Corvat line?" Contract,
  which did not: "Will you enter: 'The Larkin unit ruined Corvat, not Devlin's
  untidy shelf'?" The second is answerable with "yes".

  **Reading limits.** One model pairing, one learner family, three cells, and
  the two learner profiles do not differ once the world is held fixed (both
  close 7/12 in the rowan flat), so the cells vary less than three cells
  suggests. Part of the drop is the endpoint's own shape: the contract puts the
  verdict into the tutor's mouth as a question rather than leaving it for the
  learner, and closure scores only the learner. That is a real cost for a
  measure of what the learner can carry, and it is not the same as the contract
  teaching worse in every sense.

  **Do not repair the handoff and re-run against this endpoint.** Rewriting the
  slot so it asks the learner for the verdict tunes the treatment to the thing
  being scored; the contract would then beat bare because it was made to ask
  the endpoint's question. Any such run needs registering first and a scoring
  channel that does not move when the prompt does.

  Traces: `exports/tutor-stub-outcome/fallible-phaseB-shadow/`, one directory
  per block. Untracked, so they live only on the machine that ran them.
