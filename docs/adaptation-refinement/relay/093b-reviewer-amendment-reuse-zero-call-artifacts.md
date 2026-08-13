# 093b — Reviewer amendment: reuse the zero-call artifacts on resume

**Date:** 13 August 2026. Rules on the driver's second structural
stop (no report number was spent; state clean at `2c438d0c`). Amends
093a task 6. Authority: 052a, 083d, 088/088a, 091a, 092a, 093a.

## The driver's stop was correct — the third leg of the same knot

093a task 6 kept the standing instruction to regenerate the two
zero-call artifacts at the repair commit. But the paid collections
and the original emitted freeze bind the HASHES of the artifacts as
they were at launch, and both children check those bytes. The
reviewer confirmed, zero-call, that the on-disk artifacts still
match the frozen bindings exactly:

- brittleness preflight
  `743ee634b1b1ec00fb44844f049ec0554def63abe043b9bdf0676cbf2a5e6b1a`
- schema-acceptance carryover
  `47efb49445a94980b563cb00a96714d4290d92da7f73501c160d3c2f43776111`

Regenerating them at a newer commit would change their bytes and
orphan the paid responses — the same defect class as the freeze
re-emission that 093a already fixed. The regeneration habit was
right while nothing was frozen against the artifacts; it is wrong
now that they are bound into paid evidence.

## Amendment to 093a task 6

Do NOT regenerate the two zero-call artifacts. Instead, in the same
parent repair commit:

1. On the reader-resume path (both child checkpoints exist), the
   parent must REUSE the on-disk brittleness preflight and
   schema-acceptance carryover. It validates them by hash against
   the collection and freeze bindings, and by commit stamp against
   the recorded launch commit — it must NOT demand they be stamped
   at current HEAD. A hash or stamp mismatch refuses with a clear
   error.
2. On every other path (no child checkpoints), the current
   staleness behavior stays: HEAD-fresh artifacts required, the
   regenerate-in-place authority stands unchanged.
3. This is a parent-only change; the parent is pinned by no digest.
   The four-element child diff from 093a stands EXACTLY as written —
   no fifth child change.
4. Tests, added to 093a task 5's list: on reader-resume the parent
   accepts launch-stamped artifacts that match the frozen hashes and
   calls no regeneration; a byte-drifted artifact refuses; a fresh
   run still demands HEAD-fresh artifacts.

Every other 093a task stands unchanged: original-freeze reuse,
collection reuse, allowance, pin re-pin with the full-diff proof,
counter opening at 4,966, resume with the GO-note command plus
`--resume`, watch to completion, report **094**. Interpretation
stays reserved to the reviewer.

NEVER push. Never touch paid artifacts — which now includes the two
zero-call artifacts above, byte-frozen into the paid bindings. A
substantive fail stays terminal.
