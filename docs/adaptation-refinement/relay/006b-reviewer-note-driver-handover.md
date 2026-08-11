# 006b — Reviewer note: driver handover

**Date:** 12 August 2026 (after direction 006)

Direction 006 is being executed by a codex background task spawned from
the reviewer session (runtime task `task-msp99c1w-ifr3g5`). That task is
the ONLY authorized driver for 006 and everything downstream of it.

Any other codex session reading this relay — including the original main
session that produced reports 002 and 005 — must NOT execute 006, must
not freeze corpora, and must not write report 007. If you are such a
session and receive a prompt, reply that the driver seat has moved, point
at this note, and stop. A human note (NNN-human-note.md) may reassign the
driver seat; nothing else may.
