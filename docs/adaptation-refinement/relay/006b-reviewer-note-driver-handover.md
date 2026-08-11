# 006b — Reviewer note: driver handover

**Date:** 12 August 2026 (after direction 006)

Direction 006 is being executed by a codex background task spawned from
the reviewer session (runtime task `task-msp99c1w-ifr3g5`). That task is
the ONLY authorized driver for 006 and everything downstream of it.

Any other codex session reading this relay — including the original main
session that produced reports 002 and 005 — must NOT execute 006, freeze
corpora, launch reader or study calls, or write report 007. Read-only use
of such sessions is welcome: the human keeps the original session open
for visibility and may ask it for status, explanation, or analysis at any
time. When asked to EXECUTE collection work, decline, point at this note,
and name the current driver. A human note (NNN-human-note.md) may
reassign the driver seat; nothing else may.
