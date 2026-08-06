---
id: guard-findings-feed-forward
title: Feed guard findings into the next turn's request instead of redrafting this one
status: triaged
type: research
priority: P2
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-06
verification: >-
  GATED on guard-policy-default-flip landing. Then: an instrumented run where
  each tutor request carries the previous turn's findings as one line each, no
  same-turn redraft for quality findings, against a control without the lines.
  Readout: finding recurrence turn over turn, and the quality instruments per
  condition. The retry ladder stays for contract findings only.
claim_status: planned
links:
  code:
    - services/tutorStubTutorTurnPipeline.js
    - services/tutorStubFirstDraftContract.js
  items:
    - guard-policy-default-flip
    - guard-validity-study
tags:
  - tutor-stub
  - guards
---

## The idea

The retry analysis on Phase B says the model acts on what it is told: the
rewrite cleared 70% of the findings named to it. It still failed 80% of the
time because fixing the named faults tripped unnamed checks — a same-turn
conjunction it cannot see whole. So move the signal to where the model uses
signal well: ship the turn, and put last turn's findings into the next turn's
request, one plain line each ("your last turn did not take up the learner's
words"; "you have repeated the notebook line three turns running").

This is the project's own strongest adaptivity lever — in-context signal beats
architectural correction — applied to the harness's feedback instead of the
learner's.

## Why it might fail, stated up front

Findings are about a turn that is now past; the next moment may not afford the
fix, and stale instructions could read as noise or bend the tutor toward
compliance prose. The control run exists to catch exactly that. The cost is
one instrumented pair; no new machinery beyond assembling lines the traces
already carry.

## Log

- 2026-08-06 — filed from the retry analysis. Waits for the default flip; no
  code changed.
