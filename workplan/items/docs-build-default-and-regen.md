---
id: docs-build-default-and-regen
title: One build default, one refresh command, one PDF pruning rule
status: triaged
type: infra
priority: P2
owner: claude
source: review
created: 2026-08-05
updated: 2026-08-05
verification: "build.sh without arguments builds (or clearly refuses in favour of) paper2; one npm command regenerates board, ref-status, atlas and arc and reports what changed; a written rule bounds the versioned PDFs kept in docs/research/."
links:
  notes: notes/poetics/2026-08-05-documentation-map.html
  items: docs-coherence-structure
tags:
  - docs
  - build
  - regeneration
---

Three regeneration papercuts:

1. `docs/research/build.sh` with no argument builds the legacy Paper 1.0
   (`paper-full.md`, v2.3.21). Only CLAUDE.md warns; the usage text does not
   mark `full` as legacy. Either flip the default to `paper2` or make the bare
   invocation print the target list with `full` marked legacy.
2. Every generated view has its own verb: `wp:render` (board), `refs:render`
   (ref-status), `atlas:build`, `poetics:arc-html`, `paper:build`. Add one
   `docs:refresh` meta-command that runs the cheap ones, diffs, and prints
   what changed (paper build stays separate — it needs LaTeX and minutes).
   `npm run research:build` already bundles paper+atlas+arc; extend or wrap.
3. About 100 versioned PDFs sit in `docs/research/` beside the sources.
   Write the keep rule (e.g. latest + any published version), apply once, and
   note it in the entry-point index. The publish staging memory already prunes
   old PDFs on the site side.

Deploy stays as is: stage into the sibling content repo, human-gated
`./publish`. Document that path in the entry-point index (DEPLOYMENT.md is the
long-form; it gets repaired under the stale-pointer card).
