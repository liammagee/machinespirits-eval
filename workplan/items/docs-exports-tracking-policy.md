---
id: docs-exports-tracking-policy
title: Make exports/ tracking policy and reality agree
status: review
type: maintenance
priority: P2
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
branch: worktree-docs-coherence
verification: "gitignore rules and tracked reality agree for exports/ (explicit negations or a recorded untracking decision); every paper-cited exports path either resolves in a fresh checkout or carries an explicit archive pointer."
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items: docs-coherence-structure
tags:
  - docs
  - policy
  - exports
---

The stated convention and the repository disagree:

- `.gitignore` has a bare `exports` rule with no negations, and the
  `prototypes/` rule says it "mirrors the exports/ convention" (never tracked).
  Yet 912 files (613 MB) under `exports/` are tracked; 991 are local-only.
  Tracked additions happen ad hoc ("rescue" commits).
- `*.csv` is globally ignored, so only 4 of 15 exports CSVs are tracked; a
  paper citation to an ignored CSV points at a file absent from fresh clones.
- The paper's own stance (Appendix: "ignored exports cited, not forced into
  Git") accepts dangling citations; a link-checker cannot tell those from rot.

Decide and write down one rule. Candidate: exports/ stays ignored; anything a
paper section cites gets either (a) an explicit `!` negation and tracking, or
(b) a pointer into the private archive repo (LOGS_ROOT convention) recorded
next to the citation. Then reconcile the 912 tracked files against that rule
once, and note the decision in the entry-point index.

Related fix already landed on the survey branch: CLAUDE.md's poetics outputs
line pointed at `exports/phase2-classic-drama-*`, which matches nothing — the
artifacts live under `config/poetics-calibration/`.

Landed 2026-08-05 (this branch): the rule is written down — `.gitignore`'s
`exports` line now carries the actual policy (ignored by default; a
paper-cited artifact may be force-added and stays tracked; never assume an
exports path resolves in a fresh clone), and DOCS.md layer 6 states the same.
The `prototypes/` "mirrors the exports convention" comment is no longer
contradicted: the stated convention now matches reality.

Remaining before done (needs the PRIMARY checkout — gitignored content does
not exist in linked worktrees): sweep the paper's exports citations once and
force-add or archive-annotate the cited-but-untracked files (the ~11 CSVs the
survey found, plus any md). `ref-governance` already validates tracked refs.
