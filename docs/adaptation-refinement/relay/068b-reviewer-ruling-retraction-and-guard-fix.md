# 068b — Reviewer ruling: 068/068a retracted; report 068 accepted; guard fix

**Date:** 13 August 2026.

## Retraction

Ruling + direction 068 and GO note 068a are **VOID**. They were written on a
wrong premise: that no lawful instrument freeze survives. The reviewer's and
second session's sweeps missed `/private/tmp`; driver report 068 (commits
`7a7d1abd`, `369becfe`) found the seed-514 r52 presence-confirmation freeze
there, and it is lawful. A further reviewer error compounded this: the driver
takes were launched with a backgrounding pattern that reported completion at
spawn time, so the reviewer read live takes as cut off and ruled over a
report that was still being written. The driver launched under the void
direction 068 was killed during its zero-call read phase: **no call was
spent, no commit was made, nothing was amended**. The paid schema-acceptance
ping is NOT authorized. No input-seam amendment is wanted.

## Report 068 accepted

The freeze at
`/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json`
is the lawful `--instrument-freeze` input. Verified three times independently
(driver, second session, reviewer): natural schema, `status: frozen`, all
bindings exist and match their recorded SHA-256s, acceptance artifact
`passed` / transport-only / calls 1-1-1, response schema equal to the
manifest pin. All ten artifacts are preserved with hash checks at
`../machinespirits-eval-private/artifacts/adaptive-warrant-outcome-a1/seed-514-instrument-freeze/`.
The launch reads the original `/private/tmp` paths; the copy is a backup.

## Guard defect fixed (reviewer edit, three-way confirmed)

Report 068's stop (`standing-permission menu byte guard failed`) was a
harness bug, not menu drift: the frozen menu `.txt` is the `menu_text` field
plus exactly one trailing newline (the pinned SHA covers the file bytes), so
the strict equality at `verifyOutcomePilotManifestBindings` could never pass
on the frozen bytes. The second session reproduced it independently; the
reviewer confirmed byte-for-byte. Fix: compare the field plus one newline
against the file. One line, plus a new regression test that runs the guard
on the real frozen files. Focused suite 25/25, ESLint pass. The reviewer
made this edit directly (user directed cutting relay round-trips); the
second session's independent diagnosis stands as the second pair of eyes.

## Budget

Nothing spent since 3,523 / 11,337. The plan stays **594** calls; the 595
figure in void ruling 068 is withdrawn. Fresh GO note: `068c`.

**Morning-review flag:** the 068 retraction, the reviewer-made harness edit,
and the `/private/tmp` preservation are all listed for the human's review.
