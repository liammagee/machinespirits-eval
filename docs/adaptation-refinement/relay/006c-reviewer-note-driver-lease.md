# 006c — Reviewer note: driver identity by lease token

**Date:** 12 August 2026 (supersedes 006b's identity criterion)

006b named a runtime task id as the sole driver. A codex session cannot
see its own runtime task id, so the spawned driver could not verify its
own authority and stood down — a zero-driver deadlock. Identity criteria
must be verifiable from inside the session that needs them.

**New rule:** the driver seat is held by the session whose OWN PROMPT
quotes the current lease token. Current token:

    DRIVER-LEASE-2026-08-12-C

A session whose prompt contains this token is the driver and executes
the current direction without further identity doubt. A session whose
prompt does not contain it is read-only for collection work (as 006b,
amended, provides). The reviewer mints a fresh token per spawned driver
and records it here; a human note may reassign the seat at any time.

006b's read-only permissions for other sessions stand. Its task-id
identity criterion is void.
