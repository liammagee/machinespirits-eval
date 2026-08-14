# 088 — Reviewer ruling: presence packet cap raise; repair and resume

**Date:** 13 August 2026. Rules on driver report 087 (`1176a1ff`).
Authority: ruling 052a, note 083d (human resume authority), GO note
083a, and the transport-constant rule from directions 028 and 045 ("a
size cap that blocks a legal request is a run-management transport
constant, not a semantic instrument — raised prospectively with a
guard").

## Ruling: TECHNICAL-CLASS transport-cap refusal. Not a substantive fail.

Report 087: the first presence packet is 46,007 bytes against the
42,000-byte cap; zero reader calls.

Reviewer diagnosis, zero-call, at the packet and its v3 counterpart:

- The refused v4 packet holds ONE case of 1,705 bytes. The rest is
  static frame: semantic-annotation catalog 23,087 bytes, response
  JSON schema 13,551, handbook 7,928.
- The admitted v3 packet (r43, same batch size 1) was 32,369 bytes
  with an 11,159-byte catalog and an 11,713-byte schema.
- The growth (~13.6 KB) is the registered deference-sensor change
  (`46bfbdd9`, extraction schema v3.2) enlarging the catalog and
  schema that every packet carries. Case content did not grow.
- Every one of the 288 presence packets carries this frame, so all
  would refuse — this is not one outlier.
- The v3 remedy for oversize packets (shrink the batch, r43) is
  exhausted: the batch is already one case.
- Worst-case v4 packet: static frame 44,302 bytes plus the largest
  blinded case (9,549 bytes) = at most 53,851 bytes.
- The decision channel's preparer
  (`scripts/prepare-adaptive-warrant-annotation-batches.js`) has no
  byte cap; the exposure is presence-only.

The cap is a transport guard on prompt length. Raising it changes no
packet byte, no blinding, no case content, no reader wording. The
alternative repair — trimming the catalog or handbook — WOULD alter
the frozen instrument and is refused.

## Registered-constant change: packet cap 42,000 → 60,000 bytes

60,000 covers the measured worst case (53,851) with ~11% headroom.
The response cap (14,000) is NOT raised: the current response schema
is 12,706 bytes and fits; a guard that has not refused keeps its
value.

Recorded limitation (adds to 083b's): v4 presence packets (up to ~54
KB) exceed the ~32 KB packets under which the frozen instrument's
presence-gate confirmation ran. The growth is registered-sensor frame,
not case content.

`scripts/score-semantic-reader-presence-gate.js` keeps
`PACKET_CAP = 42000` unchanged — it records the frozen instrument's
validation conditions and is not on the launch path (same treatment
as its old extraction digest, note 083b).

## Direction to the driver

1. Raise the packet cap to 60,000 in exactly these places:
   - `scripts/prepare-adaptive-warrant-semantic-annotations.js`
     (`MAXIMUM_READER_PACKET_BYTES`, line ~45).
   - `scripts/score-adaptive-warrant-outcome-study.js`
     (`PRESENCE_CHANNEL_CAPS.packet_cap`, line ~79).
   - `docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json`
     (`presence_channel.caps_bytes.packet`).
   Leave every 14,000 response cap unchanged. Leave
   `score-semantic-reader-presence-gate.js` unchanged.
2. Re-pin `presence_channel.digests.preparer_sha256` in the pilot
   manifest to the new SHA-256 of the edited preparer (the bindings
   guard checks it). Touch no other digest.
3. Update the launcher's stale error text
   (`presence reader packet caps are not 14000/42000`) to name the
   manifest values, and update or add tests that assert the cap so
   the focused launcher and preparer test files pass.
4. Commit (standard recipe, no push).
5. Resume with the GO-note command plus `--resume`. Regenerate the
   two zero-call artifacts (brittleness preflight, schema-acceptance
   carryover) in place when they refuse as commit-stale, exactly as
   in 086 task 4. Never touch paid artifacts.
6. Watch to completion. Report **089** with the full 083c task-4
   content, plus: the final packet-size range the preparer reports,
   every resume, and this cap change with its commit hash.

## Not a post-hoc waiver (ruling 074a)

No outcome gate is touched. The 144-case fingerprint guard, coverage
guard, bindings guard, and both reader channels run unchanged. The
raised constant is prospective: no reader call was made under the old
cap, so no result is re-admitted by the change.
