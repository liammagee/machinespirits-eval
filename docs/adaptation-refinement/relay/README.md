# Codex–reviewer relay protocol

**Purpose:** replace the human copy-paste relay between the codex build
session and the Claude reviewer session. Both sessions share this repo on
the same machine, so a committed file is immediately visible to the other
side. **Committed files only — never hand off through uncommitted edits.**

## Required reading for a driver

`STATE.md` plus the current direction file it names — nothing else. The
numbered history and the audit are evidence; read them only when STATE.md
points at them for the task at hand. The reviewer updates STATE.md with
every new direction; if STATE.md and a numbered file conflict, the
numbered file wins and the mismatch is reported.

## Protocol

1. **Codex** writes each boundary report to
   `relay/NNN-codex-report.md` (NNN = next number in sequence, zero-padded),
   commits it, and — when the boundary needs direction — waits for the
   matching reply before proceeding. Reports keep the same content as the
   chat reports did: commit SHA, validation state, artifact paths, result,
   diagnosis, proposed next step.
2. **Reviewer** (Claude session, polling on a loop) reviews any new report,
   writes `relay/NNN-reviewer-reply.md` with direction, and commits.
3. **Codex** treats the reply file as the go signal it used to get by paste.

## Rules

- Boundaries that need no direction under the standing instructions
  (operational retries, the pre-authorized pass path through diagnostic and
  decision readers) do not wait — codex reports and proceeds.
- Hard stops that always wait for a reply: any semantic/consensus failure,
  any contract or threshold change, and the representative-matrix boundary.
- The representative-matrix go and any scope-cut decision are made by the
  human, not by the reviewer loop; the reviewer surfaces them and the reply
  file will say so explicitly when human authorization was obtained.
- Numbering is shared across both sides (001 reviewer, 002 codex, 003
  reviewer, ...); a reply always carries the number of the report it
  answers plus its own: `004-reviewer-reply-to-003.md`.
- Neither side edits the other's files. Corrections are new files.
- The reviewer polls roughly every 20–30 minutes; codex should not assume
  an instant reply.
- **Human notes:** the human may commit `NNN-human-note.md` at any time,
  from any session. A human note outranks all agent directions; both
  agents read it before acting and the reviewer acknowledges it in the
  next reply file.
- **Direct drive (from 12 Aug 2026, human-authorized):** the reviewer
  session spawns codex runs directly through the shared runtime, so no
  human nudge is needed between boundaries. The human intervenes via
  chat with the reviewer, via a human-note file, or by running their own
  codex session — the committed files are the only state either way.

## Current standing instructions (as of 001)

- Audit triage: tier A before any smoke, tier B before the diagnostic
  freeze, tier C before the representative matrix
  (see `../2026-08-12_v3-instrument-audit.md`).
- Pass path pre-authorized: preflight → acceptance ping → smoke →
  diagnostic freeze → on sufficient support, decision readers on the same
  frozen corpus. Stop at any semantic failure and before the
  representative matrix.
- Operational failures (no artifact, no contract change) are fixed and
  retried without waiting; noted in the next report.
- Burned corpora stay burned; fresh cases under the settled contract.
