---
id: tutor-stub-template-rate-audit
title: Stamp every cited tutor-stub run with its measured template rate
status: triaged
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-06
verification: >-
  A table, checked into the guard catalog doc, listing every tutor-stub run
  cited in paper-full-2.0.md with its template rate and model-as-written rate
  measured from its own traces by the census/replay script. Paper §s that read
  tutor prose off a guarded run carry the rate beside the claim. The paper
  edit itself waits for guard-validity-study to conclude so the whole account
  lands in one pass.
claim_status: methods
links:
  code:
    - scripts/replay-guard-fallback-delivery.js
    - docs/tutor-stub-guard-catalog.md
  items:
    - guard-regime-fallback-census-at-scale
    - guard-validity-study
tags:
  - tutor-stub
  - guards
  - paper
---

## Why

The guard ladder exists only in the tutor-stub apparatus, so most of the paper
is untouched. Within that apparatus, outcome-channel results are insensitive
to who wrote the prose; but any § that reads tutor prose — the
instrumentation showcase, the move-library transfer deltas, the derivation-arc
adaptation readings — was reading a mix of model text and template, in
unknown proportion per run. The proportion is measurable after the fact from
each run's traces, for free.

Positive effects found through dilution are more likely understated than
false; the stamp turns that from an argument into a number per run.

## How

1. Enumerate tutor-stub runs cited in `docs/research/paper-full-2.0.md`
   (grep export paths and run IDs; the pre-registration docs at repo root
   name the rest).
2. Run the census over each run's trace directory. Older traces predate the
   current accounting record; where the record is absent, count fallback
   events directly and say which counter was used.
3. Table into the guard catalog doc; one-line rate citations into the
   affected §s — after the validity study concludes, as one paper pass with
   its own changelog entry.

## Log

- 2026-08-06 — filed. Deterministic and unpaid; only its paper pass waits on
  the study.
