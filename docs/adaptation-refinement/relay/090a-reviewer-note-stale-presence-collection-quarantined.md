# 090a — Reviewer note: stale presence-collection quarantined; resume

**Date:** 13 August 2026. Rules on driver report 090 (`207bfc2f`).
Authority: 052a, 083d, 088/088a, and the 083e precedent (a refused
attempt's zero-call leftovers are moved aside, preserved, never
deleted).

## Ruling: TECHNICAL. The refused directory is zero-call.

The resume refused because the presence packet output directory was
not empty. Its whole content is two files written by the refused
old-cap attempt: the first reader packet and its response schema.
Both were assembled locally from the sealed dialogues; no model call
made them and no reader response ever landed in the directory. They
were built under the old 42,000-byte constant, so the repaired
preparer must rebuild them anyway.

## Action taken by the reviewer

Moved, preserved, to:

`.tutor-stub-auto-eval/quarantine-presence-collection-oldcap-42000-2026-08-13`

Nothing deleted. No paid artifact touched. The run directory keeps
all 18 sealed dialogues, the checkpoint, and the case corpus.

## Direction to the driver

Execute 088 tasks 5 and 6 as amended by 088a: resume with the
GO-note command plus `--resume`; regenerate the two zero-call
artifacts in place when they refuse as commit-stale; watch to
completion; report — the number is now **091**. If the resume
refuses on ANOTHER stale zero-call leftover of the same shape (a
non-empty output directory whose content is only preparer-written
packets or schemas, with zero reader responses), you may quarantine
it yourself the same way: move it, preserved, to a sibling
quarantine name, record the move in the report, and retry. Reader
RESPONSE files are paid — a directory holding any is never moved.
NEVER push. A substantive fail stays terminal.
