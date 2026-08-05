---
id: docs-notes-conventions-cleanup
title: Bring notes/ and root naming back inside their own conventions
status: review
type: maintenance
priority: P3
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "daily-notes filenames satisfy their README rule or are explicitly grandfathered in it; the two generated JSON snapshots either live outside notes/ or are documented in place as generated; the four lowercase root analysis notes are renamed or the naming rule is written down with a waiver."
branch: worktree-docs-coherence
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items: docs-coherence-structure
tags:
  - docs
  - naming
---

Three small drifts, none urgent:

1. `notes/daily-notes/README.md` retires "digest" as a free synonym and
   requires aggregates to be named `YYYY-MM-DD-research-digest-<weekly|monthly>`.
   Present violations: `2026-06-08-research-digest.html`,
   `2026-06-10-research-digest.html`, `2026-06-10-weekly-research-digest.html`
   (qualifier on the wrong side). Rename, and check nothing links the old
   names.
2. Generated artifacts parked in `notes/`:
   `notes/provable-discourse.snapshot.json` (52 KB) and
   `notes/paper-claim-audit.json` (269 KB). Moving them means updating their
   writer scripts' paths — the provable-discourse snapshot refresh is global
   with a surgical-merge pattern, so coordinate before touching. If they stay,
   mark them generated in the entry-point index and keep the
   `.prettierignore` carve-out.
3. Root naming: four lowercase analysis notes
   (`adaptive-tutor-trajectory-analysis-note.md`,
   `adaptive_tutor_a20_a21_analysis.md`,
   `adaptive_tutor_closeout_with_harm_criteria.md`,
   `codex_ownership_closeout_analysis.md`) sit among 61 SCREAMING-CASE files.
   Three are cited by other docs, so renames must update citers; the paper
   should be grepped first per the provenance rule.

Landed 2026-08-05 (this branch), all three by documentation rather than
churn:

1. Daily notes: grandfather clause added to `notes/daily-notes/README.md` —
   the three pre-rule files keep their names (the README's own drift table
   cites `2026-06-08-research-digest.html` by name as the failure exhibit;
   renaming any of them would misrepresent files that satisfy neither the
   window nor the header rule). Rules bind from 2026-06-11 on.
2. Snapshots: documented generated-in-place in DOCS.md layer 5 (moving them
   means coordinating the provable-discourse global refresh — not worth it).
3. Root naming: waiver written into DOCS.md layer 2 — the paper cites
   `adaptive_tutor_closeout_with_harm_criteria.md`, so renames would break
   pinned provenance.
