---
id: strict-policy-null-sweep
title: Re-read the nulls that were measured while the guard wrote the tutor's turns
status: active
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

## Step 1 — the nulls this covers, and where each treatment sat

Dates bound the sweep. The tutor stub was created 2026-07-06 (`490b66a4`), its
first delivery-guard audit landed 2026-07-10, dispositions were centralised
2026-07-16, and the default flipped 2026-08-07. Only work inside that window
could have had a draft discarded.

**Safe, and stamped.**

- **§6.16, the green room.** Gate 1 fails 3/17 against a 60% bar, 2026-07-12.
  The treatment is a coach's prompt book injected into the tutor's system
  prompt, so it is carried in the prose and the guard could have deleted it.
  It did not. `greenroom-gate1-2026-07-12` counts 314 turns at 6% template and
  89% model as written, already recorded in the catalog. The tutor spoke; the
  notes did not change what it said.
- **§6.17, register selection.** The null on the Sonnet family, run
  2026-07-13/14. The treatment is the tutor's speaking stance — three register
  policies — so this was the strongest candidate on the list. It is now
  stamped. The trace files went with the `machinespirits-eval-preconscious`
  worktree, but each auto-eval report embeds its own per-turn records and those
  carry the `deterministic_fallback` event. Counted there: 91 of 1,582 turns,
  5.8% template, and near-even across the three registers — bland 34/535,
  field 37/502, negative 20/545. The widest gap inside a single profile is six
  points (`proof_skipper`: field 8%, negative 2%), against Phase B's 21–28%
  versus 0–1%. Limits: three of the four profiles (`diligent`, `false_memory`,
  `proof_skipper`; `affective_resistant` left no report), Sonnet block only.
  The Terra block left nothing, and failed its own manipulation gate anyway.

**Safe on their face — the guard was never in the loop.**

- **§6.19**, the sensor program: zero-call, synthetic kernels.
- **§6.20 and §6.22**, Program-2 offline: training and grading over archived
  moments, with no live delivery.

**Unrecoverable.**

- **§6.18's addendum, the point-of-action coaching gate**, 2026-07-18. The
  `side_coach` miss is directional (+0.146 Sonnet, +0.142 Terra, both CIs
  across zero) and its treatment is a coaching line inside the tutor's turn, so
  it is a candidate. Nothing survives to stamp: no
  `exports/tutor-stub-first-draft-series`, no point-of-action traces, only
  `config/adaptive-tutor-evidence/point-of-action-gate-grade.json`.
- **§6.21, Program-2 Phase 5 live.** The primary endpoint fails, +0.040 with
  CI95 [−0.054, +0.133], run 2026-07-20/22. The treatment is a trained warrant
  move in the tutor's words, which is exactly what a veto deletes. The run used
  the pinned runtime `../ms-phase5-pinned`, which is gone; `exports/` holds a 5b
  dry run and nothing else. The section already locates its loss to a
  question-discipline leak rather than to a missing cue, which argues against a
  guard explanation — but that is a reading, not a rate. Phase 5f is a
  different case: "not estimable, insufficient opportunities" is an absent
  denominator, not a null.

**Out of scope.**

- **§6.18's main series, V17–V53.** The repair-and-fallback ladder is the
  subject of that section, not a confound inside it.
- **§6.13.** Its stage is the derivation harness, not the tutor stub —
  separate scripts, and its results start 2026-06-09, before the stub existed.
  Its harness enforcement governs premise release; it has no discard-the-draft-
  and-speak-a-template path.
- **§6.23 and §6.24** already read their own template rates and stamp their
  policy.

**One thing this turned up that is not a null.** §7.4.5 and §8.5 describe
strict delivery as a feature: V17's four cells recorded zero final-delivery
audit failures. That claim is about a mode that stopped being the default on
2026-08-07. Step 4 should date it, not caveat it.

So of the five candidates, two are cleared by a measured rate, two cannot be
measured at all, and one is out of scope. Nothing here is marked diluted, and
no re-run follows from it.

## Log

- 2026-08-09 — filed off the Phase-B reversal, as the first of the two things
  that reversal leaves open. The other is an endpoint that does not move when
  the prompt moves, which the contract question needs before it can be
  reopened; not this card.
- 2026-08-09 — steps 1 and 2 done, and step 3 done for the two rows that could
  carry a rate. §6.17 was the one worth the dig: its traces are gone, but the
  auto-eval reports under `exports/register-confirmatory-evidence/` embed their
  own per-turn records, which is where the 5.8% came from. Left to do is step 4
  — the table into `docs/tutor-stub-guard-catalog.md`, plus dating §7.4.5's
  strict-delivery claim in the paper. No caveat is owed to any null, because
  none of them came back diluted.
