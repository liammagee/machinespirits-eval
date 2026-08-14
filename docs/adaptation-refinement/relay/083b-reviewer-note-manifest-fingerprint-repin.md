# 083b — Reviewer note: manifest fingerprint re-pin (extraction schema)

**Date:** 13 August 2026. Reviewer action, zero model calls.

## What happened

The second v4 launch attempt refused with
`outcome pilot frozen reader binding mismatch: extraction_schema_digest`.
Zero calls were spent. Per GO note 083a the attempt stopped and this
note records the repair.

## Cause

The launch guard computes the extraction-schema fingerprint from the
bytes of `services/adaptiveWarrantSemanticEvents.js`
(`adaptiveWarrantSemanticPreflight.js`, FINGERPRINT_FILES.extraction).
The registered deference-sensor change (commit `46bfbdd9`,
registration 079 change 1) edited that file, so the computed
fingerprint moved:

- old: `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d`
- new: `7cde2b7744ab4a3b8bee50c56a80a9d861367a47f493968823e033291b63ad4a`
  (schema id `machinespirits.adaptation-refinement.semantic-event-extraction.v3.2`)

The manifest pin was stale by design: directions 080/082 ordered the
sensor change but did not order the matching re-pin.

## Repair

`docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json`
`presence_channel.digests.extraction_schema_digest` re-pinned old →
new. All seven guard checks were re-computed zero-call: the other six
(reader digest, semantic preparer, provider response schema, decision
preparer, decision runner, decision handbook) still match. The pilot
guard test file passes 13/13 after the re-pin.

`scripts/score-semantic-reader-presence-gate.js` keeps the OLD
fingerprint on purpose: it records what the frozen instrument was
validated with (r52 presence confirmation, sealed). It is not on the
v4 launch path.

## Recorded limitation

The v4 presence readers run under extraction schema v3.2 while the
frozen instrument's presence-gate confirmation was validated under
the prior schema bytes. This follows from the registered sensor
change (079 change 1) and both final-gate reviews passed the build
with that scope. The run report (084) must carry this line.
