# 037 — Reviewer note: report 036 accepted; seed-513 hard stop stands; the human decides next

**Date:** 12 August 2026
**Authority:** direction 035 and unattended note 023. This note closes
lease `DRIVER-LEASE-2026-08-12-F` and issues no new lease.

## Ruling

**Report 036 is ACCEPTED. The hard stop stands.** Direction 035 said any
seed-513 failure of any kind means report and human hard stop, and the
launcher's own local test preflight failing is such a failure. The
driver did exactly what the direction ordered: no repair, no retry, no
alternate command, no reserve spend. The reviewer authorizes nothing
further. The watch loop is stopped.

The good news inside the stop: **zero paid calls were spent.** The
guard net worked — a pre-existing test caught the new defect before any
child started.

## Reviewer verification (zero calls)

- Driver process exited; no stray run processes remain.
- The live root (`/private/tmp/adaptive-warrant-v3-matrix-live-37385273-r35-s513`)
  holds only the plan and authorization records; 0 job dirs, no study
  rows. 0 complete, 0 killed, 0 incomplete, 24 unstarted — matching 036.
- The failing test reproduces at the report commit:
  `node --test tests/tutorStubGuardAccounting.test.js` gives 15/16 pass;
  the writable-entry ownership test fails on
  "The first-log-entry-log entry is not public yet…" — 036's exact quote.
- Ledger entry #11 records the defect. Its guard already exists (the
  test that caught it); the wider closure is listed for any repair.

## Budget — driver recount adopted

Seed 512 cost **298 attempts** (293 completed + 2 errors + 3 in flight
at the kill), per the report-031 convention. Running total:
**2,540/4,000.** Seed 513 added zero. The reviewer's earlier ~293/~2,535
figures are superseded.

## Two readings recorded for the human

1. **The fallback-pass closure was green but narrow.** The retained
   corpora expose only one unique target signature (the generic
   sentinel), so composite targets — like the writable-entry case that
   failed — were never inside the closure's reach. The closure idea is
   right; its corpus was too small. Any authorized repair must widen it
   to synthetic targets covering every target kind and label shape the
   ledger can emit.
2. **"Progression stays blocking" (035) vs the closure's advisory
   rows.** The closure marks learner-uptake issues advisory on the
   terminal fallback. That status comes from the PRE-EXISTING
   catalog-v9 terminal-fallback policy, not from this repair; the
   checks 035 meant by "progression" — contract compile, obligation
   resolution, leak, provenance, source alignment, repetition — remain
   blocking and all pass. Model drafts keep every blocking check. This
   is the reviewer's reading; the human may overrule it.

## The decision owed by the human

Direction 035 leaves the reviewer no authority after a seed-513
failure. The choices:

1. **Repair and spend seed 514** (the last reserve): fix the composite
   label (defect #11), widen the fallback-pass closure as above, run
   the zero-call chain, launch at 514.
2. **Repair and un-burn seed 513.** Seed 513 failed before any paid
   call — no trace exists, no data was seen, so reuse cannot
   contaminate. This keeps 514 in reserve. The reviewer leans this way
   but cannot un-burn a seed the direction declared burned; only the
   human can.
3. **Stop the matrix programme here.**

Headroom: 1,460 calls; the matrix costs ~600.
