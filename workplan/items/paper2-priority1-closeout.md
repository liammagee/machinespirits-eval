---
id: paper2-priority1-closeout
title: "Paper 2.0 priority-1 closeout: provenance, agenda, board, and worktrees"
status: done
type: paper
priority: P1
owner: codex
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "Paper 2.0 v3.0.228 reconciles §9 with the completed Program-2 arc and live board; Phase 5d headline claims are registered; the 16-module atlas and dramatic-recognition arc use the public-site design and current conversational summaries; workplan, paper-manifest, provable-discourse, artifact builds, visual QA, and paper-claim-auditor checks pass; retired worktrees receive a no-deletion audit."
claim_status: methods
branch: codex/priority-1-closeout
links:
  paper: §9, Appendix F
  notes:
    - notes/paper-2-0/drafts/section-9-priority1-closeout.md
    - notes/2026-07-22-priority-1-worktree-audit.md
    - notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html
    - docs/research/atlas/atlas.yaml
  items:
    - program-2-context-vs-weights-finetune
    - superego-taxonomy-human-validation
    - impasse-corpus-phase1
tags:
  - paper-2-0
  - provenance
  - workplan
  - closeout
milestone: paper-2-0
---

Close the remaining non-PDF parts of the highest-priority paper pass: register
the Phase 5d claims, make the forward agenda describe the actual next decisions,
remove stale active/review states and retired-runbook assumptions from the
board, and audit local worktrees before any deletion decision.

The PDF was rebuilt separately before this item began and is deliberately out
of scope here.

2026-07-22 Codex: Closed. Paper 2.0 is v3.0.228; all 27 Phase 5d bindings pass
against the checked-in manifest while the 18 pre-existing snapshot warnings
remain unbaselined for their owners. Paper manifest 60/0/0, atlas 0/0,
workplan 132/132, register-policy 22/22, provable-discourse tests 69/69, and
the hermetic repository suite 6,330 passed / 0 failed / 1 skipped. The required
paper-claim-auditor review is recorded in the task handoff.

2026-07-22 Codex follow-up: Restyled the dramatic-recognition arc and research
atlas to match the Machine Spirits public site, rewrote their reader-facing
copy in a more conversational idiom, extended the arc through §6.13.19 and the
atlas through §6.22, and rebuilt the nine-panel standalone arc plus all 16 atlas
modules. Local desktop/mobile QA passed; the publisher preview path performed
no staging or publication.
