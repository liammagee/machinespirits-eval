---
id: guard-policy-default-flip
title: Make the shadow-advisory guard column the default delivery policy
status: triaged
type: infra
priority: P1
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-06
verification: >-
  GATED: does not start until guard-validity-study reports its full sample and
  the draft-beats-template shape holds. Then: the default boundary policy
  becomes shadow_advisory, the disposition catalog bumps to v7 with an
  incomparability note, the advance window default moves off per-turn, a
  regression test pins that evidence-safety, clue-bookkeeping and closure
  findings still veto, and one instrumented dialogue pair (same seed, old vs
  new default) shows model text delivered where the template shipped before.
claim_status: planned
links:
  code:
    - services/tutorStubGuardDisposition.js
    - services/tutorStubTutorTurnPipeline.js
    - docs/tutor-stub-guard-catalog.md
  items:
    - guard-validity-study
    - guard-regime-fallback-census-at-scale
    - guard-delivery-prefer-model-over-canned
tags:
  - tutor-stub
  - guards
---

## What flips

One default: delivery decisions run the disposition catalog's shadow-advisory
column instead of the strict column. Quality findings — uptake, focus, advance,
costume, repetition — keep being recorded on every draft and stop vetoing
delivery. The three contract families (evidence safety, clue bookkeeping,
closure) are hard in BOTH columns, so nothing about them changes. Measured on
Phase B by replay: template rate 62% → 2%, with zero safety findings on
anything that would ship.

## What lands with it

- Catalog version 6 → 7, with the header note that v6-and-earlier traces are
  not comparable to v7 traces and must not pool.
- The advance window default moves off per-turn (one consolidating turn is
  teaching; a run is a stall) — the knob exists, this sets it.
- The recorded findings become reported instruments: per-condition rates of
  part-performed, turn-advanced, uptake-realized, alongside outcomes. No new
  measurement — the findings already land in traces; this is analysis-side
  reporting.
- Standing rule into the catalog header: new checks enter report-only and are
  promoted to veto only on validity evidence (the replay-plus-blind-scoring
  loop), each promotion bumping the version.

## Why gated

The interim study numbers (33 pairs: draft 4.15 vs template 2.73 overall,
template outright wins 0) are one-directional but a third of the sample. The
full readout per guard family is the licence; a family whose vetoes outscore
the drafts keeps its veto and is carved out here. Full results before any
default moves — user proviso, 2026-08-06.

## Log

- 2026-08-06 — card filed while the validity study's main pass runs. No code
  changed.
