---
name: ms-author-paper2
description: Author or revise a requested section of the canonical Paper 2.0 while preserving claim provenance, version history, and sealed evidence. Use for paper edits; use ms-discuss-paper for read-only discussion and ms-build-paper for build-only requests.
---

# Author Paper 2.0

The authority is `docs/research/paper-full-2.0.md`. Never author current claims
against `paper-full.md`, a stale PDF, an old section catalog, or a spin-off.

## Scope and claim boundary

1. Resolve the requested section dynamically from current headings and read the
   surrounding argument plus the latest entries in Appendix F.
2. Classify the requested change as framing, theoretical synthesis,
   methodological description, empirical claim, or correction.
3. For every empirical or numeric statement, trace the exact existing paper
   claim to its run/artifact and evaluation DB lane. Do not introduce a new
   empirical claim in a paper edit without the canonical evidence and current
   user authority for that substantive change.
4. Preserve sealed history. Do not recompute historical scores, relabel rubric
   versions, convert missing measurements to false/null, or silently pool
   judges, rubrics, corpora, or incomplete blocks.
5. Treat `config_exists` as context, not evidence. Do not use `pending` as an
   evidence adapter.

## Edit workflow

- For a review request, remain read-only and report proposed changes.
- For an authorized edit, change only the requested section and necessary
  cross-references.
- Update the frontmatter version and add a concise Appendix F revision entry
  describing claim impact and provenance. Do not rewrite earlier history.
- Keep workplan/claim-status links aligned when the edit changes the paper's
  claim boundary.

## Verify

Run the narrow checks implicated by the change:

```bash
npm run paper:provable-discourse
npm run paper:bug-audit
npm run research:build:paper
git diff --check
```

Use more focused validators when the edited section names them; do not run a
full suite as ceremony. After any substantive paper edit, use the
`paper-claim-auditor` reviewer and resolve every claim-integrity defect before
calling the work complete.

Report the section changed, version/history update, claim status, exact evidence
sources, checks run, PDF path, and any remaining indeterminate point.
