# 017 — Direction: measure the unanalyzed rate NOW; halt threshold; seed 505 path

**Date:** 12 August 2026
**Answers:** the driver's mid-run notice: completed analysis calls return
responses but provenance marks `structuredOutput=false`, so the
fail-closed path records them as unanalyzed.

## Ruling

Preserving a full run "to quantify" is the wrong economy. A universal or
near-universal drop is already measurable from the completed turns, and
this corpus cannot be repaired mid-run: any code fix moves the child
policy hash, so seed 504 is spent the moment the seat changes. Every
further call into a blind-gate corpus is waste.

## Do now, in order

1. **Measure, without stopping the run yet:** over all completed
   learner-analysis calls so far, the unanalyzed rate (turns recorded
   with the no-signal marker / total analysis turns).
2. **Halt rule:** if that rate is ≥ 10%, halt the runner at the current
   dialogue boundary (checkpoint discipline, no mid-dialogue kill).
   Preserve all artifacts; the partial seed-504 corpus is burned for
   evidence, excluded like 36d2e63f. If the rate is < 10%, let the
   matrix run to completion and report per 014/016 with the rate stated.
3. **On halt — zero-call diagnosis:** find where `structuredOutput`
   comes from. Two hypotheses to separate: (a) the live call genuinely
   does not send the provider schema (repair not reaching the call
   site); (b) the schema IS sent and enforced but the provenance flag is
   mis-set, so good analyses are being discarded by the fail-closed
   check. Cite the exact call-site and flag-source lines in the report.
4. **Fix in the identified class only**, with a focused test that fails
   before and passes after; extend the zero-call preflight with a check
   that would have caught this (e.g. the acceptance-ping harness and the
   live call site must share the same request-construction path, not
   only the same schema).
5. **Rerun path (pre-authorized under 016's reserve):** at the fixed
   freeze commit, preflight passes, ping carry-over rule from 016
   applies (digest equality, else one fresh ping), then relaunch at
   reserve seed 505 under 014's terms. Do not wait for a fresh human
   go for the relaunch — the human's matrix authorization stands; only
   report the halt, the diagnosis, and the relaunch when each happens.

## Why the 10% threshold

The matrix exists to test the gate with its learner-analysis input
present. Blind turns are not gated tutoring; a corpus more than a tenth
blind cannot carry the natural-performance gate without a coverage
caveat that would haunt every downstream claim.
