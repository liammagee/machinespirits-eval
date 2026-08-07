---
id: phase-b-rerun-under-flipped-policy
title: Re-run the Phase-B contract contrast with the guards not scripting the tutor
status: triaged
type: research
priority: P2
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-07
verification: >-
  PARKED ON QUOTA — guard-policy-default-flip landed 2026-08-07 and the user
  parked the run the same day until codex quota is free again. It needs no
  further decision, only headroom. Then: the same registered design
  (frozen cells, bare vs contract vs empty plan, n = 12 per version per cell,
  same models, learner blind), under boundaryPolicy shadow_advisory. Primary
  endpoint unchanged. Reported against the original as a pair: strict-harness
  verdict and open-harness verdict, never pooled.
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
- 2026-08-07 — the flip merged (PR #546) and the user parked the re-run until
  codex quota is free again. No decision is outstanding. Cost was counted off
  the original traces rather than estimated: ~4,100 calls expected, all on the
  codex subscription, about three-quarters gpt-5.6-terra and one-quarter
  gpt-5.6-sol, with no judge spend because closure is checked in code. Launch
  when there is headroom for roughly 4,100 calls in one quota window, or take
  the one-cell pilot first.
