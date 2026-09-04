---
id: runtime-file-digest-refusals-record-only
title: Record file digests at run time instead of refusing on drift
status: active
type: infra
priority: P1
owner: claude
source: review
created: 2026-09-04
updated: 2026-09-04
verification: "No service under services/tutorStub*.js throws on a drifted digest of a code, schema, prompt, design, registration or go-request file. Each such site records the observed and recorded digests. Sealed corpus and certificate pins are unchanged. lint:all, test:ratchets and the hermetic suite pass."
claim_status: planned
links:
  items:
    - in-place-edits-numbered-file-ratchet
---

## What this changes

PR #994 took the file-digest pins out of the tests. The same pattern still ran
inside `services/tutorStub*.js`: code read a file, hashed it, and threw (or
pushed a blocking issue) when the digest did not match a value stored in code
or in a registration. A one-line bug fix in a judge or a schema then read as a
design change, which is what the two hard rules in `CLAUDE.md` ban.

Each such site now records the observed and the recorded digest and carries on.
New helper: `services/recordedFileDigest.js`.

## Inventory

(filled in by the change)

## Left as is

(filled in by the change)
