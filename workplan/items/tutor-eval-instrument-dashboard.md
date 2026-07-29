---
id: tutor-eval-instrument-dashboard
title: One map and one page for every tutor-scoring instrument
status: review
type: infra
priority: P2
owner: claude
source: manual
created: 2026-07-29
updated: 2026-07-29
verification: "`node scripts/build-tutor-stub-ab-dashboard.js` runs on file reads
  alone, reports the run and lane counts, and writes
  `exports/tutor-stub-ab/dashboard.html`; unit tests assert the merge attaches a
  verdict only when run, case, version and model lane all match, that a reply no
  judge read says so rather than borrowing a verdict, and that both pairwise
  file generations normalize; the page carries the four-channel inventory and
  the no-cross-channel-averaging note."
claim_status: methods
depends_on:
  - tutor-instrumentation-ab-harness
tags:
  - tutor-stub
  - tooling
---

The bench grew four scoring channels in a week and their verdicts landed in
four shapes across two dozen files. Two additions make that trackable.

`/ms-eval-instruments` (`.claude/skills/ms-eval-instruments/SKILL.md`) is the
formal instrument map: the four families — rubric scoring, deterministic
checks, the tutor-stub comparison channels, computed process measures — with
where each channel's outputs live and the rule for reading disagreement
between plan-aware and plan-blind channels.

`scripts/build-tutor-stub-ab-dashboard.js` + `services/tutorStubAbDashboardHtml.js`
build one page over the frozen A/B pool: a verdict matrix per version and
model lane (guard rules broken per turn, PR-benchmark passes and broken rules,
blind and clue-shown pairwise records), every pairwise verdict with the
judge's stated reason, and the transcripts with each channel's reading
attached to the exact reply it read. Verdicts join only on run + case +
version + model lane; pairwise rows that do not record their source run stay
in their own section rather than being pinned to a guessed text. Default
scope is runs an LLM channel has read; `--all-runs` widens it. No model
calls, no DB access.

Not claimed: any new result. The page presents the channels' existing
verdicts side by side and never combines them.
