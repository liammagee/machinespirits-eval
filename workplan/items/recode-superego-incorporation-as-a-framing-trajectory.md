---
id: recode-superego-incorporation-as-a-framing-trajectory
title: Recode superego incorporation as a framing trajectory
status: done
type: research
priority: P3
owner: codex
source: daily-routine
created: 2026-07-20
updated: 2026-08-05
branch: codex/recode-superego-framing-trajectory
verification: >-
  A deterministic sample of cell 21 and cells 48-49 dialogue traces is coded
  against a versioned framing-trajectory codebook, compared with the recomputed
  incorporationRate proxy, and accompanied by an explicit audit of historical
  dimension_convergence availability; the report preserves trace hashes and
  states whether the measures agree without mutating source data.
claim_status: exploratory
links:
  notes:
    - notes/daily-notes/2026-07-20-research-roundup.html
    - notes/research-plans/2026-07-27-research-plan.html
    - notes/2026-08-05-superego-framing-trajectory-recoding.md
  code:
    - services/superegoFramingTrajectoryAnalyzer.js
    - scripts/analyze-superego-framing-trajectory.js
    - tests/superegoFramingTrajectoryAnalyzer.test.js
    - tests/superegoFramingTrajectoryCli.test.js
  data:
    - config/analysis/superego-framing-trajectory-codebook-v1.json
    - data/paper2/superego-framing-trajectory-coding-v1.json
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/492
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

- 2026-08-05 — Closed after PR #492 merged as `dc684140`. The committed
  codebook, trace-pinned coding ledger, deterministic report, read-only CLI,
  and 42 focused tests satisfy the card's registered verification. The 6/12
  semantic split remains explicitly exploratory and does not replace the
  production metric; independent coding is a separate future validation gate.
- 2026-08-05 — Ready for review. The zero-model analyzer found 135 historical
  rows, 132 unique dialogues with 132/132 trace availability, 465 superego
  checks, and 185 immediate revision-demanding cases eligible for semantic
  coding. A prospectively fixed systematic sample selected four cases per
  target profile (12 total), pinned to source-trace SHA-256 values. Single-coder
  results were 6/12 reframes and 6/12 restatements: cell 21 = 2/4 reframes,
  cell 48 = 3/4, cell 49 = 1/4. The recomputed dialogue-level
  `incorporationRate` was positive for all 12 and the event-local revision
  signal agreed with the semantic code in only 6/12, so the existing structural
  proxy was non-discriminating in this sample. Historical database values were
  absent for both `incorporation_rate` (0/12) and `dimension_convergence`
  (0/12); the latter cannot be reconstructed without per-turn rubric
  trajectories and was not backfilled. The result is an exploratory
  construct-separation diagnostic, not a validated replacement metric;
  independent second coding is required for reliability or prevalence claims.
  Focused service plus CLI tests passed 42/42, including proof that the analyzer
  leaves its SQLite source byte-identical. No model calls were made.
- 2026-08-05 — Activated from current `origin/main` after PR #489
  housekeeping. A read-only premise audit found 135 historical rows across the
  three target profiles and available dialogue traces, but zero populated
  `incorporation_rate` or `dimension_convergence` values. The analysis will
  therefore recompute the existing incorporation proxy from each frozen trace,
  report convergence as unavailable for this corpus, and keep that missingness
  explicit rather than mutating the evaluation DB or fabricating a comparison.
- 2026-07-28 — Card opened from the 2026-07-27 research plan, where this was the
  third of three ranked items. Promoted from `workplan/inbox/2026-07-20-arxiv-2607.11680.md`.
