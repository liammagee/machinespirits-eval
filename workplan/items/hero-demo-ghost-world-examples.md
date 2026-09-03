---
id: hero-demo-ghost-world-examples
title: "Record with/without examples on new demo worlds and build the tabbed hero-demo app"
status: done
type: content
priority: P2
owner: claude
source: manual
created: 2026-09-01
updated: 2026-09-03
verification: "Verified on 2026-09-03 against origin/main@2af95ac6: PR
  #918 is merged; all three bare/adaptive trace pairs and interchanges are
  packed; node scripts/render-hero-demo-swimlanes.js --check reports 24
  turns for Rowan, Ghost, and Fraction and 'note is current'; the app meets
  the teaching-register, turn-link, evidence-ledger, illustration-boundary,
  resistant-profile, and one-of-six detector-firing criteria."
depends_on:
  - adaptive-tutor-hero-demo-lay-rewrite
links:
  notes:
    - notes/poetics/2026-09-01-adaptive-tutor-hero-demo.html
    - notes/poetics/2026-09-01-adaptive-tutor-demo-app.html
  prs:
    - 918
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

## Phase 2 (2026-09-01): the tabbed app and a K-12 world

`notes/poetics/2026-09-01-adaptive-tutor-demo-app.html` turns the linear
note into a tabbed walk-through: start-here intro, a works/didn't ledger
(every number from the 29 August note and Paper 2.0 §6.3, §6.23–§6.24),
Rowan Flat as the counted evidence with a moment selector, and one tab per
recorded scenario with a full side-by-side transcript reader driven by
embedded JSON (learner line, tutor line, planted state, detector reading).

`config/drama-derivation/world-036-class-plant.yaml` + its demo-tier
schedule: a Year 6 class-plant mystery in an eleven-year-old's voice, same
proof shape. Recorded with the same two arms as world-035; traces under
`notes/poetics/hero-demo-runs/world-036/`. Same claim discipline: the
recordings are illustration, never pooled with the crossed-effects tallies.

## Phase 3 (2026-09-01): swimlanes, teaching tone, a classroom lesson

Full with/without transcripts for every scenario now go through the shared
dramatic-dialogue renderer (`scripts/render-hero-demo-swimlanes.js` builds a
strict parallel interchange per world from the packed traces, writes it as
`interchange.json` beside them, and splices the rendered fragment into the
app between markers; `--check` reports staleness). Each moment on a tab
links to its turn in the full swimlane. The app copy was rewritten to
explain rather than promote.

The K-12 whodunit (world-036) is retired from the app in favour of a
conventional lesson: `config/drama-derivation/world-037-fraction-sum.yaml`,
a Year 7 tutorial on adding fractions in which the pupil defends two
fifths. Its demo-tier schedule draws each planted moment from a profile in
`scripts/tutor-stub-learner-profile-contracts.js` (answer seeking as the
base profile; overconfident/premature closure, affective resistance,
low-trust scepticism, false memory, and the fused stake as plants) with
repair gold from the profile repair models and the move cards. A fresh
Rowan Flat pair was also recorded so the studied scenario has a full
swimlane beside its counted evidence, clearly labelled as illustration.

## Phase 4 (2026-09-01): rulings on the recordings, and why the gap is small

All 24 planted replies on world-035 and world-037 (plus the fresh world-030
pair as an appendix) were ruled hit/partial/miss against the schedule gold by
the model that built the page, as a draft for the author to ratify:
`notes/poetics/hero-demo-runs/2026-09-01-adjudication-draft.md`. Counts sit on
the two scenario tabs with the caveat (single-author gold, draft ruling, k=1).
Ghost 2/6 vs 3/6, fraction 3/6 vs 3/6, fresh Rowan 3/6 vs 3/6.

The small gap has three named causes, now on the method tab: the live v6
trigger is lexical and was built from one inquiry world, so it fired 1/6 on
the lesson; the Sonnet learner-sim resolves its own planted state inside the
planted line in about half the turns (5/12 realized on the fresh Rowan pair),
where the counted runs used a codex learner; and the whole-stack effect on the
trigger's home world (world-033: 10/24 vs 15/29) is about one hit per ten
plants, below what six plants show; on Rowan the pressure-only stack lost.

## Closeout log

- 2026-09-03 Codex: Closed after independently reconciling the acceptance
  criteria against current `origin/main` at `2af95ac6`. PR #918 is merged as
  `7ed9bc816f992048a7428b44a4457124ad315314`; the checked-in transcript
  pairs, interchanges, app copy, provenance, and stated limits are present,
  and the renderer freshness check passes without rewriting the note. No
  model/provider calls were made during this reconciliation.
