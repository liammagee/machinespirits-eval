---
id: strict-policy-null-sweep
title: Re-read the nulls that were measured while the guard wrote the tutor's turns
status: triaged
type: infra
priority: P1
owner: claude
source: manual
created: 2026-08-09
updated: 2026-08-09
verification: >-
  A table in the guard catalog listing every tutor-stub null cited in
  paper-full-2.0.md whose run predates the 2026-08-07 delivery flip, each
  marked with where its treatment lived (the tutor's prose, or somewhere the
  guard never touched), a template rate where traces survive, and one of three
  verdicts: safe, diluted, or unrecoverable. Every null marked diluted carries
  a caveat in place in the paper. No re-run is part of this card.
claim_status: planned
links:
  code:
    - scripts/census-guard-template-rate.js
    - services/tutorStubGuardDisposition.js
    - docs/tutor-stub-guard-catalog.md
  items:
    - tutor-stub-template-rate-audit
    - phase-b-rerun-under-flipped-policy
    - guard-policy-default-flip
tags:
  - tutor-stub
  - guards
  - paper
---

## Why

Phase B is the worked example. Its null — contract 22/33 against bare 20/29,
p = 1.000 — was measured through a delivery guard that replaced the tutor's
drafted turn with a fixed template on 62% of turns. Re-run with the tutor
speaking, the same design gave contract 12/36 against bare 24/36, p = 0.0091.
The null was the harness.

The template-rate audit already narrowed the rule that let that pass: an
outcome result is safe from the guard only when the treatment is not carried
in the prose the guard replaces. Checking the endpoint in code does not save
you, because the guard deletes the treatment rather than the measurement.
Phase B checked its endpoint in code, with no judge model anywhere, and still
moved by 33 points.

Nobody has applied that rule backwards. Every tutor-stub run before
2026-08-07 ran strict by default, so every null from one of them is a
candidate, and each needs one question answered: did the treatment live in
the tutor's wording?

## How

1. List the tutor-stub nulls cited in `docs/research/paper-full-2.0.md` whose
   run predates the flip. The flip is the dividing line, not a per-run stamp,
   for the reason in the next step.
2. For each, say where the treatment lived. A prompt that changes how the
   tutor writes is a candidate. A treatment carried somewhere the guard never
   touches — the world, the clue-release schedule, the learner, the model
   seat — is safe on its face and can be marked and dropped.
3. Stamp a template rate where traces survive, using the census script.
   Where they do not, say so and mark the null unrecoverable rather than
   guessing a rate.
4. Table into the guard catalog; caveats in place in the paper for anything
   marked diluted, as one pass with its own changelog entry.

## What the traces can and cannot supply

Counted on this machine 2026-08-09: of everything under `exports/`, 42,052
recorded turns carry the advisory stamp and 132 carry the strict one, spread
over two small run directories (`figure-fresh`, `figure-probe`). The sweep
over `exports/tutor-stub-outcome` returns 17 runs of 30 turns or more and
every one of them is advisory. The original Phase B is not here at all.

So this is mostly not a trace-reading job. `exports/` is untracked and
differs per checkout, and the strict-policy runs are the ones that have
largely not survived. Step 3 will come back empty for most rows, which is why
the verdict has three values and not two. The work is step 2 — reading each
null's own design and saying where the treatment sat.

## Scope

No re-run is licensed by this card. Finding a diluted null tells you the
result is unmeasured, not that it points the other way; only Phase B was
re-run, and that took its own registration. A candidate worth re-running gets
its own card and its own gate.

## Log

- 2026-08-09 — filed off the Phase-B reversal, as the first of the two things
  that reversal leaves open. The other is an endpoint that does not move when
  the prompt moves, which the contract question needs before it can be
  reopened; not this card.
