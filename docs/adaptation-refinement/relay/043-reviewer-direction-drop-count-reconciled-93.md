# 043 — Reviewer direction: report 042 accepted; drop count reconciled to 93/2/3; repair the freeze exactness check; then readers

**Date:** 12 August 2026, ~21:22
**Authority:** the human's ruling of 21:04 ("drop the three duplicate
cases and proceed"), direction 041, direction 038's continuation
policy. This direction reconciles 041's drop-set expectation against
the verified data and orders the freeze completed.

**Lease:** `DRIVER-LEASE-2026-08-12-I`. Report to
`044-codex-report.md`.

## Ruling on report 042

**ACCEPTED.** The driver stopped exactly where 041 told it to stop,
spent zero calls, and exposed nothing to any reader.

## Reconciliation (reviewer verification, zero calls)

The "three duplicate cases" in the ruling and 041's "expect 92/3"
inherited a miscount from reviewer note 040. The r39 overlap audit
records `overlap_row_count: 3` and `unique_overlap_fingerprint_count:
2` — its three rows are case-by-corpus MATCH relationships: the fridge
candidate matches one excluded corpus; ONE foxtrot candidate matches
two. The reviewer re-read the audit rows and the quarantined 95-case
private key directly:

- 95 candidates; NO fingerprint appears twice among them;
- exactly one candidate carries each collided fingerprint
  (`case-c4119d73…` fridge, `case-d4bcf08b…` foxtrot);
- only ONE foxtrot low-agency turn-1 candidate exists at all — the
  intervening dialogue's turn 1 never became a candidate case, so no
  third overlapping candidate exists anywhere in the corpus.

92 was therefore arithmetically impossible; the only way to reach it
is deleting a clean, non-overlapping case at random, which the ruling
cannot have meant. The ruling's intent — retain nothing that overlaps
an excluded corpus, then proceed — is fully satisfied at 93. The
reviewer also confirmed both dropped fingerprints and both sample ids
are absent from every retained artifact outside the quarantine
folders.

**Amended expectation, binding for A2: 93 frozen cases, 2 dropped
candidates, 3 logged match relationships — identity-exact to the drop
log quoted in report 042.** Any other set = stop and report.

## Ordered actions

### A1 — Repair the freeze exactness check (zero-call, ledger #14)

The final refreeze attempt failed with "mechanism-validation freeze
does not have exact cell, turn, and observe-only coverage": the
freeze's legacy coverage check still demands a case for every cell and
turn, which a drop-and-log freeze by design no longer has. This is a
deterministic reducer defect in the defect-#12 family (a checker that
ignores a registered, disclosed path) and falls under the continuation
policy:

1. Amend the check so expected coverage = full design MINUS exactly
   the logged `dropped_overlap_cases` (and consistent with the run's
   registered analysis-error fallback turns, per the defect-#12
   convention). Any OTHER gap — an unlogged missing case, a wrong
   cell, a missing turn — still fails closed.
2. DEFECT-LEDGER entry #14 with guards: (a) a synthetic corpus with
   one logged drop passes the coverage check and writes its manifest;
   (b) the same corpus with one UNLOGGED missing case still fails
   closed; (c) registered fallback turns do not fail it.
3. Focused suites green at the repair commit.

### A2 — Complete the seed-514 re-freeze (zero-call)

4. Re-run the amended freeze end-to-end on the unchanged quarantined
   95-case input. Expect: manifest WRITTEN; 93 frozen; the drop log
   byte-identical in identities to report 042's (same sample ids,
   fingerprints, corpus matches). Record all digests. Reader schema
   must remain `51107d43…`; extraction schema `e5af8f2b…`.

### A3 — Readers, support gate, report 044 (paid)

5. Unchanged from direction 041: readers on the frozen 93-case packet
   under the registered protocol, support gate, then report 044 with
   the amendment disclosures (drop-and-log, the 93/2/3 reconciliation,
   the exactness-check repair), the full drop log, calls spent from
   **3,146/8,000** (report-031 convention), reader results,
   support-gate arithmetic, and BOTH coverage rates (checkpoint
   139/144 = 96.53%; final 187/192 = 97.40%). The reviewer rules on
   the matrix gate from report 044.

## Unchanged

Never patch a live run; never waive a failed gate post hoc; the two
dropped cases join the excluded set forever; seed 515 stays unspent;
human hard stops per direction 038; commit `--no-verify` with the
`Workplan-item: N/A` trailer and the Co-Authored-By convention; NEVER
push.
