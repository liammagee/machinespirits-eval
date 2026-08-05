---
id: docs-coherence-structure
title: "Docs coherence: one entry point, tight layout, easy regeneration"
status: done
type: infra
priority: P1
owner: claude
source: manual
created: 2026-08-05
updated: 2026-08-05
verification: "All child docs-* cards are done; a root entry-point doc reaches every layer in one hop; regeneration and deploy each have one documented command."
branch: worktree-docs-coherence
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items:
    - docs-stray-servers-lockdown
    - docs-poetics-eval-api-guard
    - docs-entry-point-index
    - docs-exports-tracking-policy
    - docs-stale-pointer-sweep
    - docs-build-default-and-regen
    - docs-techne-token-sync-test
    - docs-notes-conventions-cleanup
tags:
  - docs
  - structure
---

Umbrella for the documentation-coherence pass (2026-08-05 survey). Goal, in the
user's words: a tight coordinated documentation structure with a clear entry
point, good maintainable qualities, logical folder layout, and easy
regeneration / redeployment.

The survey (four read-only sweeps: servers/routes, markdown inventory,
notes/workplan/exports, HTML/design) is written up as a techne doc:
`notes/poetics/2026-08-05-documentation-map.html`. Each fray item there maps to
one child card here.

Working method:

- Doc-only repairs land first (stale pointers, titles, wrong paths).
- Server and build behaviour changes ride their own cards with tests.
- Frozen pre-registrations get dated editor's notes only, never rewrites —
  the paper cites them at specific commits.

CLOSED 2026-08-05, all eight children done across PRs #497, #500, #502 and
the citation-sweep PR. What now exists: `DOCS.md` as the one entry point
(linked from all three agent docs and README); the illustrated map at
`/map` on the scriptorium; one perimeter across every server; one cheap
regeneration verb (`docs:refresh`) plus the PDF keep rule; written policies
for exports tracking, frozen-doc edits, and the naming waivers; and tests
holding the seams (route parity, perimeter, token mirror, subject-explorer
guard).
