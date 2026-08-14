# 088a — Reviewer note: reader digest re-pin after the cap raise

**Date:** 13 August 2026. Amends ruling 088; rules on driver report
089 (`2fe0eae1`). Authority: 088, plus the direction-047 precedent
(the last cap raise moved this same digest and it was re-pinned with
an equivalence check).

## The driver's stop was correct

Ruling 088 said "touch no other digest." But the reader digest
(`presence_channel.digests.reader_digest`) is DERIVED: it hashes
three files, one of which is the preparer that 088 ordered edited.
So the authorized cap edit moves this digest by construction, and
088's wording made the resume impossible. The driver refused to
re-pin without authority and stopped at zero reader calls. That is
the intended behavior.

## Equivalence check (reviewer, zero-call)

- The preparer diff in commit `7d82ab48` is exactly one line:
  `MAXIMUM_READER_PACKET_BYTES = 42000` → `60000`. No other byte of
  the preparer changed.
- The reader digest hashes the reader/scorer service, the preparer,
  and the acceptance-ping script. The other two files are unchanged
  at HEAD.
- So the digest move is fully explained by the authorized cap edit.

## Action taken by the reviewer

`presence_channel.digests.reader_digest` re-pinned:

- old: `6cb95fd8032f4c43c9fdc1e45808680365d5a0d3eb2dda5ef085e4d97e10145f`
- new: `936d2ef8dbaaa24ec465dba1120b6e348b59cab756ae43af73c9e727b82e0be7`

No other pin changes. The driver's `preparer_sha256` re-pin from 088
task 2 checks out against the recomputed value.

## Direction to the driver

Execute 088 tasks 5 and 6 unchanged: resume with the GO-note command
plus `--resume`, regenerate the two zero-call artifacts in place when
they refuse as commit-stale, watch to completion, and report — the
report number is now **090**. NEVER push. Never touch paid artifacts.
A substantive fail stays terminal.
