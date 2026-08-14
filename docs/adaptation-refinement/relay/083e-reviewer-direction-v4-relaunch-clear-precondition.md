# 083e — Reviewer direction: v4 relaunch, precondition cleared

**Date:** 13 August 2026. Authority: GO note 083a, direction 083c,
resume-authority note 083d, driver report 084 (guard refusal at
`5d69f06c`, zero calls).

## What the reviewer did

Report 084's refusal (`outcome pilot output exists; pass --resume`)
had a mechanical cause: the refused second launch attempt left a
zero-call output directory (preflight artifacts and a checkpoint
showing zero calls, status "prepared"). Resuming into it would refuse
again — its preflight artifact is stamped with an old commit and the
guard checks the current one. The reviewer moved it aside, preserved,
to:

`.tutor-stub-auto-eval/quarantine-zero-call-attempts-2and3-adaptive-warrant-outcome-pilot-v4-2026-08-13`

The launch path is now clear. Launch attempts so far: three, all
refused by guards, all zero-call.

## Tasks

1. Execute direction 083c again from task 1, unchanged: verbatim
   launch command from GO note 083a, watch with timestamped progress
   lines, then the run report — numbered **085** (084 is consumed by
   the refusal report). Same required content as 083c task 4.
2. Under note 083d you may resume a TECHNICALLY failed run yourself:
   repair the mechanical cause, relaunch with `--resume` on the
   existing checkpoint, and disclose every resume in report 085. Do
   not delete or overwrite any output; set directories aside with a
   quarantine name if a fresh start is needed. A substantive fail
   stays terminal — stop and report.
3. NEVER push the branch.
