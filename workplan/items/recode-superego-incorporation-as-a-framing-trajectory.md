---
id: recode-superego-incorporation-as-a-framing-trajectory
title: Recode superego incorporation as a framing trajectory
status: triaged
type: research
priority: P3
owner: unassigned
source: daily-routine
created: 2026-07-20
updated: 2026-07-28
verification: >-
  A sample of cell 21 and cells 48-49 tutor_deliberation logs hand-coded against
  the five-stage framing trajectory, reporting for each superego check whether the
  next ego turn reframes or only restates, set against the existing
  incorporationRate and dimension_convergence values for the same rows through an
  analyze:traces re-analysis; the write-up says whether the two measures agree or
  the trajectory coding catches incorporation the text proxy misses.
claim_status: planned
links:
  notes:
    - notes/daily-notes/2026-07-20-research-roundup.html
    - notes/research-plans/2026-07-27-research-plan.html
tags:
  - writing-pad
  - prompt-erosion
  - deliberation
---

## Problem

`analyzeSuperegoIncorporation()` in `services/dialogueTraceAnalyzer.js` reduces
the whole question of whether the ego took up its superego's critique to a single
`incorporationRate` ratio built from text proxies. That ratio cannot separate two
different things: an ego that genuinely reframes after a check, and an ego that
restates its prior answer in slightly different words.

Cell 21 (dynamic prompt rewriting with the Writing Pad) and the prompt-erosion
cells 48-49 both try to track that distinction, and both currently do it through
the same proxy.

"From Prompt Engineering to Epistemic Prompting" (arXiv:2607.11680) offers a
five-stage framing trajectory — prompt, response, learner uptake, disciplinary
check, reframe — grounded in education research. It is a candidate second coding
scheme, worth trying precisely because it was built outside this project and so
does not inherit our assumptions.

## What to do

Read-only recoding. Take existing `tutor_deliberation_*` logs for cell 21 and
cells 48-49, and hand-code a small sample of turns against the five stages. The
question each turn has to answer: did a superego check produce a traceable
reframe in the next ego turn, or did the ego restate what it already said?

## Evaluate

Existing dialogue logs, plus the `incorporation_rate` and
`dimension_convergence` columns for cells 21, 48 and 49 — an
`npm run analyze:traces` re-analysis, no new generation.

The result is a comparison, not a replacement: either the two measures agree, in
which case the current proxy is doing its job, or the trajectory coding catches
incorporation the proxy misses, which would be worth reporting on its own.

## Log

- 2026-07-28 — Card opened from the 2026-07-27 research plan, where this was the
  third of three ranked items. Promoted from `workplan/inbox/2026-07-20-arxiv-2607.11680.md`.
