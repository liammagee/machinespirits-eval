---
id: reader-agreement-preflight
title: Read archived transcripts with the registered reader seats before a paid run
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-09-04
updated: 2026-09-04
branch: claude/reader-agreement-preflight
verification: >-
  npm run tutor:stub:reader-preflight runs the registered reader seats over an
  archived calibration run through the live adjudication code path, makes no
  tutor or learner call, and reports the reader gates the design registers
  (per-pair floor for depth and satisfiable; modal rule with backstop for
  merged v5) against the floors in the registration. Dry runs on the depth
  v5 treatment archive (18 cases, 90 calls) and the merged v5 faceA archive
  (12 cases, 60 calls) make zero calls.
claim_status: methods
links:
  items:
    - frame-refuser-depth-study
    - frame-refuser-satisfiable-condition
    - resistant-learner-strategy-close
  notes:
    - scripts/run-reader-agreement-preflight.js
    - services/tutorStubReaderAgreementPreflight.js
tags:
  - tutor-stub
  - resistant-learners
  - readers
  - preflight
---

## Problem

The three reader gates (determinate outcome rate, eligible votes per seat,
pairwise exact endpoint agreement) were checked only inside a paid
calibration block. When a reader model changes, or a reader prompt changes,
the first test of the panel is a live run that also buys tutor and learner
turns. A reader panel that cannot agree on old transcripts will not agree on
new ones, and that can be learned for the price of the reader calls alone.

## What was built

One script and one service, no new gate.

- `npm run tutor:stub:reader-preflight` takes a registration file
  (depth, satisfiable or merged design), an arm or face, and one or more
  archived run directories under the private archive.
- It rebuilds each complete case's public packet from the archived trace and
  transcript with the same builder the live runtime uses, then calls the
  live `adjudicateFinalHorizon` with the registered seats, effort and output
  schema. Reader calls only. No tutor, learner or persona call.
- It scores the reader gates with the same helper the live calibration
  summary calls (`summarizeTutorStubResistantLearnerReaderGates`, now
  exported and shared by the depth and satisfiable summarizers), so the
  numbers match what a live block would print.
- The gate set follows the design, not the script. Depth and satisfiable
  register a per-pair floor, so the report carries `determinate_outcome`,
  `eligible_vote_rate_per_seat_and_instrument` and
  `pairwise_exact_endpoint_agreement`. Merged v5 registers no per-pair
  floor; its gates are `primary_endpoint_determinacy` and
  `primary_endpoint_reader_eligibility_and_validity_backstop` (cases with
  two eligible votes, mean pairwise agreement against the backstop), and
  per-seat eligibility and the pairs are report only. A parity test checks
  each set against the live summarizer's gates.
- It reports what it cannot check: the live-only gates (delivery rate,
  bridge read bound, prohibited delivery, jurisdiction retained, typed
  failure accounting) are listed as not checked, never as passed.
- Verdict: `passed` (exit 0), `failed` (exit 1), or `incomplete` (exit 2)
  when a transport failure left any seat unread. A bridge outage never reads
  as reader disagreement.
- `--out` is created once and never overwritten. `--ceiling` caps reader
  calls (default cases times seats times two). `--dry-run` lists cases,
  seats and planned calls and makes no call.

## Dry-run figures (2026-09-04, zero calls)

| design | scope | cases | seats | planned reader calls |
|---|---|---|---|---|
| depth v5 | treatment, run `frame-refuser-depth-gate1-v5-2026-08-30` | 18 | 3 | 90 |
| merged v5 | faceA, run `resistant-learner-merged-calibration-v5-2026-08-26` | 12 | 3 + 2 fidelity | 60 |

## Not done here

- No paid preflight has run. The first paid use needs a go and a ceiling
  from the user; the card only ships the tool.
- The fake corpus in the test carries 10 cases so the registered floor of 8
  is met; a real corpus below the floor fails the floor, as it should.

## Log

- 2026-09-04: Built and tested offline (9 tests). First draft compared the
  merged face against an unregistered per-pair floor and would have failed
  every merged preflight; fixed to read the rule from the design. Dry runs
  on the two archived runs above. PR opened.
- 2026-09-04: Closed after PR #1004 merged as `5ce49e49`. The tool is in
  `main`. No paid preflight has run; the first one still needs a go and a
  ceiling from the user.
