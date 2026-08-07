---
id: guard-policy-default-flip
title: Make the shadow-advisory guard column the default delivery policy
status: review
type: infra
priority: P1
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-07
verification: >-
  DONE 2026-08-07. The live default is shadow_advisory with strict as the opt-in
  (pipeline plus CLI, pinned at the source by test); evidence-safety,
  clue-bookkeeping and closure findings still veto, pinned exhaustively in
  services/__tests__/tutorStubGuardDisposition.test.js; and one fixture runs
  under both policies in tests/tutorStubGuardAccounting.test.js, delivering a
  fixed template under strict and the model's own draft under the default with
  the same findings recorded either way. The catalog bump and the
  advance-window change were deliberately not done — reasons on the card.
claim_status: settled
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

## What actually landed (2026-08-07)

The study's full readout held the shape at 108 pairs (draft 4.17 vs template
2.51, template wins 2, no family favouring the template), so no family was
carved out and the flip went in whole.

- `services/tutorStubTutorTurnPipeline.js` and `scripts/tutor-stub.js` now
  resolve `shadow_advisory` unless `TUTOR_STUB_GUARD_POLICY=strict`.
- `tests/tutorStubTutorTurnPipeline.test.js` pins both runtime lines at the
  source, since each is a local const unreachable without a full turn.
- `tests/tutorStubGuardAccounting.test.js` runs one draft under both policies —
  strict ships a fixed template, the default ships the model's own words, and
  the same seven findings are recorded either way. That is the instrumented
  pair the verification line asked for.
- The safety guarantee was already pinned exhaustively: the cartesian-product
  test in `services/__tests__/tutorStubGuardDisposition.test.js` checks every
  hard-in-shadow rule against every advisory under the relaxed policy.
- Seven test files that describe the strict ladder now pin
  `TUTOR_STUB_GUARD_POLICY=strict` in their fixtures, so they keep testing the
  ladder rather than drifting with the default.
- `docs/tutor-stub-guard-catalog.md` carries the readout, the flip, and a
  two-part classification of every recorded run: which are effectively archived
  and which are sound but not comparable across the policy boundary.

**Three departures from the plan above, each deliberate.**

1. **No catalog bump to v7.** The version records the rule table, and no rule
   moved — only which column the runtime reads. A bump would say the 19 runs
   already decided under the shadow column cannot pool with post-flip runs, and
   they can, exactly. Comparability follows the `boundaryPolicy` stamp every
   trace already carries. The catalog header now says a column change is
   stamped per delivery rather than versioned.
2. **The advance window stays at 1.** Under shadow, `tutor_turn_without_advance`
   is advisory, so windowing it changes the advisory count and nothing about
   delivery. It became a measurement question and belongs in its own change.
3. **The library default stays strict.** `decideTutorStubGuardDelivery` still
   answers under the strict column when called bare, because three sites in the
   first-draft campaign machinery
   (`services/tutorStubJointPerformanceFirstDraft.js`) call it that way and were
   calibrated that way; flipping it there would re-calibrate a separate
   apparatus as a side effect of a delivery change. The live path passes the
   policy explicitly.

The reported-instrument bullet under "What lands with it" is analysis-side and
did not land here; it stays with `tutor-stub-template-rate-audit`.

## Log

- 2026-08-06 — card filed while the validity study's main pass runs. No code
  changed.
- 2026-08-07 — flipped. Full study readout on `guard-validity-study`. Tutor-stub
  suite green at 2009 tests. Three planned items deliberately not done, with
  reasons above. `phase-b-rerun-under-flipped-policy` is now unblocked on this
  card and still gated on the user's go-ahead for the spend.
