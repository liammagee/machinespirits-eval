---
id: hero-demo-ghost-world-examples
title: "Record chatty with/without examples on a new demo world for the hero brief"
status: review
type: content
priority: P2
owner: claude
source: manual
created: 2026-09-01
updated: 2026-09-01
verification: "World-035 (The Nine O'Clock Ghost) and its demo-tier stress
  schedule pass derivation:quality, the prompt-audit dry run, and both
  regression gates. One free-running dialogue per arm (bare tutor vs the
  full six-env adaptive stack, claude-code Sonnet both seats) is recorded
  with traces committed in-branch, reviewed with review-stress-bench, and
  rendered to swimlane HTML. The hero demo gains a section showing the
  learner's early vs late lines in the adaptive run against the bare run,
  labelled free-running illustration on an unratified schedule — never
  merged into the adjudicated tallies."
depends_on:
  - adaptive-tutor-hero-demo-lay-rewrite
links:
  notes:
    - notes/poetics/2026-09-01-adaptive-tutor-hero-demo.html
  items:
    - adaptation-planted-stress-bench
    - adaptive-causality-repertoire
branch: claude/adaptive-tutor-demo-rewrite-msldm1
tags:
  - adaptive-tutor
  - marketing
  - showcase
  - worlds
---

# Chatty with/without examples on a new demo world

The hero brief needs more recorded examples, on a scenario a lay reader
follows instantly. This card tracks a new world plus one with/without pair
of free-running dialogues on it.

## The world

`config/drama-derivation/world-035-nine-oclock-ghost.yaml` — a flat-share
whose wifi dies at nine every night. The chat blames Pip, whose game
download starts at nine; the real cause is the hallway heater's ancient
timer plug spraying noise over the router's channel. Same proof shape as
Rowan Flat (a clock coincidence is not a traced path; the accused housemate;
the social cost of writing the true answer), so the proven stuck-state
detectors and move cards apply unchanged. Register: flat-share banter.

`config/drama-derivation/stress/world-035-stress-schedule.yaml` plants the
six proven states at turns 2, 4, 6, 8, 9, 10 — demo-tier, NOT ratified.

## The runs

Two arms, one dialogue each to start, both seats claude-code Sonnet 5
(no codex CLI in this container — same-family seats, stated as a bound):

- OFF: no adaptive env vars — the never-adapting baseline.
- ON: the six-env full stack from `scripts/generate-baseline-manifest.js`
  (manner switch + v6 trigger, quiet detector, dose ladder, contract
  licence, clue insertion), card routing left to the router.

Traces land under `exports/tutor-stub-outcome/hero-demo-ghost/` and are
copied into `notes/poetics/hero-demo-runs/` so the ephemeral container
cannot lose them (exports/ is gitignored and the private archive repo is
not present here).

## Review and rendering

`scripts/review-stress-bench.js` over both arms for the plant-by-plant
sheet; `scripts/render-stress-comparison.js` for the swimlane HTML that
drops into the techne note.

## Claim discipline

Everything from this card is free-running illustration on an unratified
schedule: no new tallies, no pooling with the crossed-effects numbers, the
boundary stated on the page beside the examples. Improvement is shown by
quoting the learner's own early and late lines, not by scoring them.
