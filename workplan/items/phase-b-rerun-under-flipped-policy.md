---
id: phase-b-rerun-under-flipped-policy
title: Re-run the Phase-B contract contrast with the guards not scripting the tutor
status: triaged
type: research
priority: P2
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-06
verification: >-
  DOUBLY GATED — starts only after guard-policy-default-flip lands AND the
  user authorizes the spend. Then: the same registered design (frozen cells,
  bare vs contract vs empty plan, n = 12 per version per cell, same models,
  learner blind), on catalog v7. Primary endpoint unchanged. Reported against
  the original as a pair: strict-harness verdict and open-harness verdict,
  never pooled.
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

Cost is the full Phase-B bill again (nine conditions, ~1,150 turns, codex
gpt-5.6-terra) — hence the user gate. A one-cell pilot first is the cheaper
option if the spend needs staging.

## Log

- 2026-08-06 — filed with the user's proviso: full validity-study results
  before anything proceeds, and this run additionally waits for explicit
  authorization.
