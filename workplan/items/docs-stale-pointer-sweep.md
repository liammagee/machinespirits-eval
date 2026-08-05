---
id: docs-stale-pointer-sweep
title: Repair stale cross-references across root and docs/
status: done
type: maintenance
priority: P2
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "Every pointer flagged by the 2026-08-05 survey is fixed, waived as a false positive, or carries a dated editor's note; a grep for the old paths finds no live references outside frozen docs."
branch: worktree-docs-coherence
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items: docs-coherence-structure
tags:
  - docs
  - pointers
---

Stale pointers found by the survey, with the outcome for each:

- [x] `scripts/ANALYSIS-SCRIPTS.md:3` sent readers to
      `notes/paper-2-0/analysis-toolkit-guide.md`; the guide lives at
      `docs/analysis-toolkit-guide.md`. Fixed.
- [x] `TUTOR-CORE-INHOUSING.md` said the npm-package copy and lockfile entry
      were "intentionally NOT pruned yet"; both are gone (0 references in
      `package.json` / lockfile). Note updated.
- [x] `GEMINI.md:1` header read "Project Memory for Claude". Fixed.
- [x] `README.md` cited `notes/known-risks-localhost-2026-02-13.md` (missing
      everywhere). Repointed at `DEPLOYMENT.md`.
- [x] `AGENTS.md` cited `notes/methods-paper-skeleton.md` (missing). Repointed
      at `docs/research/methods-paper.md`.
- [x] `docs/explorations/literature/INDEX.md:3` cited a moved file. Repointed
      at `docs/explorations/claude/agents/2026-05-01-research-resources.md`.
- [x] `CLAUDE.md` poetics outputs line pointed at
      `exports/phase2-classic-drama-*` (matches nothing). Repointed at
      `config/poetics-calibration/phase2-classic-drama-*/` (gitignored).
- [x] `CLAUDE.md` "This fork": master plan now marked historical, live work
      pointed at the board (the entry-point card owns the fuller repoint).
- [x] FALSE POSITIVE — `DEPLOYMENT.md`'s `services/poeticsMount.js` and
      `.github/workflows/deploy.yml` name files in the sibling
      `machinespirits-website` repo, and both exist there. No edit.
- [x] Frozen pre-registrations with dead supersede targets: dated editor's
      note added to `DRAMATIC-RECOGNITION-PLAN.md` (the two felicity files
      survive in git history only; wording kept as written), and the policy —
      dated editor's notes, never rewrites — is stated in DOCS.md layer 2.

All flagged pointers are now fixed, waived as false positives, or annotated.
