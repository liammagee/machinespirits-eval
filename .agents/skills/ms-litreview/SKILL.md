---
name: ms-litreview
description: Synthesize the bounded local PDF corpus for a specific research question and relate it to current project decisions. Use for corpus-grounded reviews; browse current primary literature when currency or exhaustiveness is required. Default to an in-chat review unless the user asks for an artifact.
---

# Local Literature Review

The local corpus is under `docs/explorations/literature/pdfs/`. Establish its
actual files and dates at run time; do not repeat a stale paper count or static
subdirectory map.

## Scope

1. Extract the topic, specific questions, desired depth, and whether the user
   wants a saved artifact.
2. Discover candidate PDFs by filenames, metadata, and text search, then state
   the bounded corpus selection. A local-corpus review is not an exhaustive or
   current literature review.
3. If the request asks for current scholarship, citations beyond the corpus, or
   a claim likely to have changed, browse primary papers/official proceedings
   and label the added web corpus separately.
4. Cross-reference only current, verified project authorities: the canonical
   paper, relevant workplan items, and architecture/design docs discovered in
   the live tree. Do not hardcode provider-specific strategy paths.

Delegation is optional and proportional. Use a read-only subagent only when the
selected corpus is large enough to benefit; direct synthesis is valid.

## Grounding

- Cite every literature claim to exact PDF filename plus page/section, DOI,
  arXiv ID, or another stable identifier.
- Distinguish a paper's findings, the project's interpretation, and a proposed
  design implication.
- Name disagreements and study limitations.
- Do not turn a spin-off review into a new empirical project claim or edit the
  canonical paper through this skill.

## Output

Default to chat. When the user explicitly requests a file, write to their path
or a unique file under `docs/explorations/literature/synthesis/`; never
overwrite an earlier review silently.

Use this shape as needed:

- question and corpus boundary;
- synthesis by question;
- evidence table with exact identifiers/pages;
- implications for current project decisions;
- contradictions and unresolved gaps; and
- bounded recommendations that distinguish evidence from conjecture.

Report corpus coverage dates, PDFs actually read, any browsed additions,
cross-referenced project sources, output path if written, and the most important
uncertainty.
