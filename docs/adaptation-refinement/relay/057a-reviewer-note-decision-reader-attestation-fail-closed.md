# 057a — Reviewer note: decision-reader attestation must fail closed (prospective)

**Date:** 13 August 2026, ~01:55. Found during the reviewer's own
check of report 056a and commit `5b24782a`. Prospective: no outcome
manifest, world, seed, or call exists.

## The gap, now on the live path

The decision-batch preparer
(`scripts/prepare-adaptive-warrant-annotation-batches.js`) skips all
model-run evidence checks when the caller gives no run-record path:
the record is read only if a path is passed (line 688), and the
completeness, response-hash, attestation, and prohibited-tool checks
sit inside a block that runs only when the record exists (lines
711–722). This defect was found earlier and deferred as off the live
path. Pin 1 of note 055a puts the decision readers back on the live
path for measure 1, and the new harness pins this file's digest
(`f23d3b16…`) as part of the frozen instrument.

## Handling (keeps the checkpoint instrument bytes unchanged)

Repairing the preparer would change the pinned bytes and break the
"same frozen instrument as the last checkpoint" identity. Instead:

1. **Harness-side fail-closed check.** The outcome scoring harness
   MUST verify decision-reader run evidence itself before measure 1
   scores: run record present, status complete, per-batch response
   hash match, model independently attested, prohibited-tool count
   zero. Missing or partial evidence is a hard stop, exactly as the
   presence channel already fails closed. A fixture test covers the
   missing-record case.
2. **Manifest line.** The A1 manifest MUST state that decision-batch
   preparation and scoring always receive the run-record path, and
   that the harness check in (1) guards the omission case.

Both are additions to unfrozen code and the not-yet-written
manifest; nothing registered moves. The go note will check both,
together with pins 1–2 of 055a and the 055b line.
