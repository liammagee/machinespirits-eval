# 047 — Reviewer direction: report 046 accepted; re-pin the reader digest at the projected post-edit value with a byte-level equivalence proof; then readers

**Date:** 12 August 2026, ~21:55
**Authority:** direction 038's continuation policy; direction 045's
cap-raise ruling (defect #15, defect-#5 precedent); the human's
standing order of 12 August ("No hard-stop, continue until we get
this thing done — stop any further spurious stops").

**Lease:** `DRIVER-LEASE-2026-08-12-K`. Report to
`048-codex-report.md`.

## Ruling on report 046

**ACCEPTED.** The driver stopped correctly under 045's wording: 045
ordered an edit and, at the same time, an unchanged digest that the
edit necessarily changes. The zero-call projection is exactly the
evidence needed to resolve it.

## Ruling on the digest conflict

The reader-instrument digest is a fingerprint over instrument SOURCE
FILES, and the preparer file holds the transport constant. So the
digest conflates two things: the semantic instrument (what a reader
receives and how its output is read) and run-management transport
(how large a response the preparer will accept). Report 046 proves
the authorized cap edit moves ONLY the transport part:

- provider response schema: byte-identical
  (`44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1`);
- extraction schema digest: unchanged
  (`e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d`);
- the one-case response-schema BYTES a reader receives: unchanged
  (`f944b9b89c7bc3c3756bfe81dac476e2e84ca1fc215dbb1b05df89b3288135f0`,
  10,930 bytes);
- the one-case packet: unchanged
  (`237c0784f637cb74ea124a5ec2c00912e3bc39eddf6359573c276fa823c3e06b`).

Of the two options report 046 names, the reviewer selects the
narrower: **accept the mechanically changed reader digest and re-pin
it at the projected value, with a byte-level equivalence proof at the
repair commit.** Redefining the fingerprint to exclude transport
constants would change instrument-definition code itself and is
rejected as more invasive. The pin's purpose — detect semantic drift
— is preserved: every semantic surface must be shown byte-identical,
and the new digest must equal the report-046 projection exactly.

**New pinned reader schema digest, binding from the repair commit
onward:**
`7b084d936e7600a5023d133eba6660f18fffa378d9b5aed1d8a3a7b4a881e1c9`
(with preparer source SHA-256
`af2a9182e2103e6dfd422e7f1ebab8d2f2df33b908b911f52af7c065b3bb5508`).
The extraction schema digest stays `e5af8f2b…`. Any value OTHER than
the projection = stop and report; that would mean the applied edit is
not the projected edit.

## Ordered actions

### A1 — Cap raise, equivalence proof, re-pin (zero-call, ledger #15 completed)

1. Apply exactly the projected edit: `MAXIMUM_READER_RESPONSE_BYTES`
   10,500 → 14,000 in the preparer
   (`scripts/prepare-adaptive-warrant-semantic-annotations.js`), and
   update the matching preflight check in
   `scripts/run-adaptive-warrant-semantic-brittleness-preflight.js`
   (rename it for the new value). The packet cap (42,000) is NOT
   touched.
2. Equivalence proof at the repair commit, all zero-call:
   (a) the preparer diff is exactly the directed constant lines;
   (b) preparer source SHA-256 equals `af2a9182…`;
   (c) recomputed reader schema digest equals `7b084d93…`;
   (d) extraction schema digest equals `e5af8f2b…`;
   (e) provider response schema byte-identical at `44b4807e…`;
   (f) the one-case response schema regenerates to the same bytes
   (`f944b9b8…`, 10,930) and now PASSES the cap;
   (g) the one-case packet regenerates to `237c0784…`;
   (h) a synthetic schema over 14,000 bytes still fails closed.
   Any mismatch at any letter = stop and report, no further edits.
3. Update DEFECT-LEDGER #15 with the fix commit, the re-pin, and the
   equivalence proof. Focused suites + preflight green, zero-call.
   Where the preflight or tests assert the OLD digest, update those
   assertions to the new pinned values in the same commit — that is
   part of the re-pin, not extra drift.

### A2 — Readers, support gate, report 048 (paid)

4. Prepare the reader collection from the frozen 93-case packet at
   the one-case partition. Before any call, record the planned call
   count (**93 cases × 2 registered readers = 186 calls**) in the
   collection manifest.
5. Run the semantic readers under the registered protocol; score the
   support gate.
6. Report 048 with: the cap-raise disclosure (10,500 → 14,000,
   defect #15) AND the digest re-pin disclosure (old `51107d43…`,
   new `7b084d93…`, equivalence proof summary), the drop-and-log and
   93/2/3 disclosures carried forward with the full drop log, calls
   spent from **3,146/8,000** (report-031 convention: every
   `model_call_budget_reserved` event = one attempt), reader results,
   support-gate arithmetic, and BOTH coverage rates (checkpoint
   139/144 = 96.53%; final 187/192 = 97.40%). The reviewer rules on
   the matrix gate from report 048.

## Unchanged

Never patch a live run; never waive a failed gate post hoc; the two
dropped cases stay excluded forever; seed 515 unspent; human hard
stops per direction 038 (contamination, the 8,000 ceiling,
unexplained coverage loss); commit `--no-verify` with the
`Workplan-item: N/A` trailer and the Co-Authored-By convention;
NEVER push.
