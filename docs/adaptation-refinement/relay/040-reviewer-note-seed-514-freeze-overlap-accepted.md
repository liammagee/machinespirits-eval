# 040 — Reviewer note: report 039 accepted; seed-514 matrix clean; freeze-overlap hard stop stands; the human decides the exclusion rule

**Date:** 12 August 2026
**Authority:** direction 038 and unattended note 023. This note closes
lease `DRIVER-LEASE-2026-08-12-G` and issues no new lease.

## Ruling

**Report 039 is ACCEPTED. The hard stop stands.** Direction 038 keeps
contamination and provenance anomalies as human hard stops, and the
annotation freeze failing closed on a verified overlap with excluded
corpora is such an anomaly. This stop is NOT one of the spurious stops
the human forbade: the continue-until-done instruction removed the
harness-defect stops, and the driver correctly continued through
defect #12 under that policy before stopping here.

The run itself is the best of the arc: 24/24 dialogues, eight turns
each, 606/606 calls completed with zero transport errors, exact
live/offline parity 192/192 with zero mismatches, and no coverage
halt.

## Required coverage quotation

- **Checkpoint coverage rate:** 139/144 analyzed = 96.53%; 5/144
  unanalyzed = 3.47% — inside the frozen 15% line.
- **Final descriptive coverage rate:** 187/192 analyzed = 97.40%;
  5/192 unanalyzed = 2.60%. By condition: active gate 92/96 analyzed,
  observe 95/96 analyzed.

## Defect #12 handling — conforming

The final status checker wrote `invalid_parity` on a clean run because
it dropped the five analysis-error turns from its own denominators,
though the registered fallback path emits and audits a decision on
those turns. The driver diagnosed it zero-call, ledgered it (entry
#12), guarded it, repaired it prospectively at `3eca7086`, and
re-ran the full zero-call chain green at that commit. The replay
resolves seed 514 to `complete` with 192/192 parity. This is exactly
the continuation policy: the run's data was never touched; only the
reducer that reads it was repaired.

## Reviewer verification (zero calls)

- Overlap audit read (`adaptive-warrant-r39-seed514-overlap-audit.json`):
  95 candidate cases, 21 excluded corpora, 3 overlap rows across 2
  unique fingerprints, ruling field records the human hard stop,
  `next_seed_launched: false`.
- All three overlapping turns are the LOW-AGENCY learner's opening
  turn: "Could you choose what I should check first?" (Larkspur
  fridge) and "Could you choose what I should examine first?"
  (Foxtrot jukebox, both conditions). Producing jobs confirmed in the
  live root.
- The matched excluded corpora are real and named: a prior mechanism
  run, the preserved-unscored 36d2e63f matrix, and burned seed 504.
  These are content matches, not bookkeeping errors.
- No seed-515 dry or live artifact exists (only zero-call chain files
  at the repaired commit). No stray run processes. The candidate
  corpus, private key, and predictions are quarantined under the live
  root and unlicensed. No reader was called.
- Ledger #12 is present with its guard. Budget arithmetic checks:
  2,540 + 606 = **3,146/8,000**; remaining 4,854.

## Reviewer reading

This overlap is deterministic recurrence of a formulaic opening, not
data leakage. The low-agency persona asks the same nine-word question
at turn 1 in every seed and every world — that is what the persona is
FOR. The exclusion rule fingerprints single turns, while the
annotation unit is a whole case; the recurring text carries no
run-specific information a reader could use. Every future seed will
regenerate near-identical turn-1 texts and hit the same overlap, so
"burn 514 and spend 515 unchanged" is not an option — it spends ~600
calls to reach the same stop, and re-rolling on unchanged conditions
is seed shopping.

## The decision owed by the human

Amending the freeze or its exclusion rule amends the registered
instrument — human authority only. The choices:

1. **Amend the exclusion rule prospectively and re-freeze seed 514.**
   Fingerprint whole cases (all turns) instead of single turns, or
   exempt turn-1 texts below a stated length. Then re-run the freeze
   on the quarantined seed-514 corpus under the amended registered
   rule, with the amendment and this overlap disclosed in the report.
   Un-burning seed 514 for this purpose is the human's call; in
   support: no reader saw anything, the freeze failed closed before
   licensing, and the run passed every gate of its own. The reviewer
   leans here, whole-case variant, because whole-case fingerprints
   still catch genuine leakage.
2. **Keep the rule; drop the 3 overlapping cases and freeze 92/95.**
   Also an instrument change (the freeze is registered as
   all-observe-decision), and the loss lands exactly on the
   low-agency turn-1 cells — small but biased.
3. **Stop the matrix programme here.**

Until the human rules: no seed 515, no reader calls, no
pre-registration freeze, no outcome launch. The watch loop drops to a
slow heartbeat.

## Addendum (same day, ~21:00) — the collision is structural at turn 1

The sibling session pointed at the fingerprint function; the reviewer
verified it in source (zero calls). The case fingerprint
(`annotationCaseFingerprint`,
`scripts/run-adaptive-warrant-baseline-study.js:2184`) hashes exactly
four fields: the transcript before the decision, the current learner
turn, the learner record at the decision, and the record trajectory.
The transcript field is built from prior public turns only
(`scripts/run-adaptive-warrant-baseline-study.js:1915`), so at a
turn-1 decision it is EMPTY. The record counts at turn 1 are zero
grounded / zero voiced against a world-fixed total. So at turn 1 the
fingerprint depends on nothing but the learner's first sentence and
the world — identical fingerprints across seeds are FORCED whenever a
persona repeats its formulaic opener, and no run-specific content
enters the hash at all. From turn 2 on, the hashed transcript contains
model-generated tutor text, which diverges across seeds, so collisions
after turn 1 are effectively impossible. The observed data matches:
all three overlap rows are turn-1 rows.

This settles the reading: the overlap is a structural property of the
fingerprint at turn 1, not evidence of reuse. It strengthens option 1.
Two wordings reach the same place and the human may pick either: (a)
whole-case fingerprints (this note), or (b) the sibling's drop-and-log
variant — at freeze time, drop duplicate cases against excluded
corpora and log them, content-blind, disclosed, prospective, instead
of failing the whole freeze closed. Either is an instrument amendment
and needs the human's ruling.
