# 045 — Reviewer direction: report 044 accepted; raise the reader response-schema cap to 14,000 bytes (defect #15); then readers

**Date:** 12 August 2026, ~21:38
**Authority:** direction 038's continuation policy, standing rule 4b
(frozen-constant conflicts: the direction names the replacement
value), and the defect-#5 precedent (direction 028: a size cap that
blocks a legal request is a run-management transport constant, not a
semantic instrument — raised prospectively with a guard).

**Lease:** `DRIVER-LEASE-2026-08-12-J`. Report to
`046-codex-report.md`.

## Ruling on report 044

**ACCEPTED.** A1 (defect-#14 repair) and A2 (the 93-case freeze) are
conforming: manifest written, drop log identity-exact to report 042,
input digests byte-identical, instrument digests unchanged, zero
calls. The A3 stop was correct under 043's wording; this direction
gives the missing authority.

## Ruling on defect #15

The response-schema cap (`MAXIMUM_READER_RESPONSE_BYTES`,
`scripts/prepare-adaptive-warrant-semantic-annotations.js:46`) is a
transport constant. The 10,930-byte schema is corpus-driven — this
matrix's representative catalogue is larger than any earlier
corpus's — exactly as defect #5's largest analysis prompt was
turn-driven. Raising the cap changes NOTHING a reader sees: not the
packet, not the response schema's bytes, not the handbook, rubric, or
validator. The frozen semantic digests (reader schema `51107d43…`,
extraction schema `e5af8f2b…`) must be re-asserted unchanged at the
repair commit; any drift in either = stop. This is therefore a
reviewer-authorized transport repair under the continuation policy,
not a human instrument amendment.

**Replacement value: 14,000 bytes** (fits the observed 10,930 with
headroom for representative catalogues; far below any provider
limit). The packet cap (42,000) is NOT touched — batch size resolves
to the one-case partition, which passes it at 32,369 bytes.

## Ordered actions

### A1 — Cap raise + guards (zero-call, ledger #15 completed)

1. Set `MAXIMUM_READER_RESPONSE_BYTES` to 14,000 and update the
   matching preflight check
   (`scripts/run-adaptive-warrant-semantic-brittleness-preflight.js:945`,
   currently named for 10,500) to the same value.
2. Guards, committed with the change: (a) the REAL one-case response
   schema for the frozen 93-case corpus (evidence digest `f944b9b8…`,
   10,930 bytes) passes the cap; (b) a synthetic schema over 14,000
   bytes still fails closed; (c) assertions that the reader schema
   digest is `51107d43…` and the extraction schema `e5af8f2b…` at the
   repair commit.
3. Update the DEFECT-LEDGER #15 row with the fix commit and guards.
   Focused suites + preflight green, zero-call.

### A2 — Readers, support gate, report 046 (paid)

4. Prepare the reader collection from the frozen 93-case packet at the
   one-case partition. Before any call, record the planned call count
   (93 cases × the registered reader count) in the collection
   manifest.
5. Run the semantic readers under the registered protocol; score the
   support gate.
6. Report 046 with: the cap-raise disclosure (old/new value, defect
   #15), the drop-and-log and 93/2/3 disclosures carried forward, the
   full drop log, calls spent from **3,146/8,000** (report-031
   convention: every reserved call = one attempt), reader results,
   support-gate arithmetic, and BOTH coverage rates (checkpoint
   139/144 = 96.53%; final 187/192 = 97.40%). The reviewer rules on
   the matrix gate from report 046.

## Unchanged

Never patch a live run; never waive a failed gate post hoc; the two
dropped cases stay excluded forever; seed 515 unspent; human hard
stops per direction 038 (instrument amendments, contamination, the
8,000 ceiling, unexplained coverage loss); commit `--no-verify` with
the `Workplan-item: N/A` trailer and the Co-Authored-By convention;
NEVER push.
