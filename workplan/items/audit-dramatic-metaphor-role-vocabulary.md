---
id: audit-dramatic-metaphor-role-vocabulary
title: Audit dramatic metaphor and rename director role toward author
status: done
type: content
priority: P2
owner: codex
source: manual
created: 2026-06-23
updated: 2026-06-24
verification: Dramatic-machine docs, derivation notes, config names, UI labels,
  and any runtime-facing role names use a coherent metaphor set; the
  director/author distinction is either renamed safely or documented with a
  compatibility path.
branch: codex/dramatic-vocabulary-audit
links:
  notes:
    - notes/poetics/drama-machine/SPEC.md
    - notes/poetics/drama-machine/TAXONOMY.md
    - notes/poetics/drama-machine/DIRECTOR-TERMINOLOGY-AUDIT.md
    - notes/poetics/2026-06-09-free-dramaturgy-and-register-dials.md
    - notes/2026-06-09-dramatic-derivation-plan.md
  items: refresh-weber-id-charisma-recognition-thread
tags:
  - poetics
  - dramatic-derivation
  - terminology
  - author
  - director
milestone: poetics-followups
---

Capture a semantics fix before it gets normalized: the current `director` role often names what is really an authorial voice addressed *to* the director, not the director as an in-world or production-side role. The likely target is to rename this surface toward `author` / `authorial_voice`, while preserving compatibility for existing traces, exports, configs, and UI routes.

Extend the pass beyond that one label. Review the whole dramatic metaphor set for coherence and consistency: drama, cast, audience, critic, director, author, tutor, learner, actor, staging, scene, movement, act, beat, note, dials, intervention, and witness. The goal is not literary tidiness for its own sake; it is to make the machine-readable roles match the conceptual roles so future experiments are easier to reason about.

Acceptance:

- Inventory runtime-facing and doc-facing uses of `director` and adjacent dramatic terms.
- Decide whether `director` should become `author`, `authorial_voice`, or a two-role split.
- Identify required compatibility shims for existing run artifacts, URLs, config files, and scripts.
- Update the drama-machine spec/taxonomy first, then apply code/UI changes only where the semantics are stable.
- Preserve the research boundary: rename terms without changing previous empirical claims or silently reinterpreting archived artifacts.

2026-06-24 Codex: Closed as a compatibility-safe terminology decision rather
than a broad code migration. Inventory recorded in
`notes/poetics/drama-machine/DIRECTOR-TERMINOLOGY-AUDIT.md`: runtime-facing
uses include teaching-drama generator role maps and `--director-*` flags,
drama-machine compose `cast.director`, dramatic-derivation `roles.director` /
`role: director` / `via: director`, derivation world YAMLs, curriculum drama
outputs, and tests that assert the serialized role. Doc-facing uses include the
drama-machine docs, the 2026-06-09 free-dramaturgy note, the dramatic-derivation
plan, and the separate id-director/charisma family.

Decision: keep `director` as the canonical serialized key; gloss it as `scene
author / director` in human-facing docs and labels; reserve `authorial_voice`
and `staging_director` as future aliases/splits only. Do not reinterpret
archived artifacts, run metadata, or paper claims. Updated
`notes/poetics/drama-machine/{README.md,SPEC.md,TAXONOMY.md,ADAPTATION-MOVES.md,example-drama.yaml}`,
`services/poetics/dramaParameters.js`, `scripts/browse-poetics-scripts.js`, and
`scripts/drama-generator.js`. Verification: `node --check` on changed JS files;
`git diff --check`; `node scripts/workplan.js render && node scripts/workplan.js
validate` (47/47 valid); `npm run wp:check`; and `node --test
--test-force-exit tests/dramaParameters.test.js tests/dramaGenerator.test.js
tests/dramaGeneratorDirectorCache.test.js tests/dramaGeneratorRoleBudgets.test.js
tests/poeticsReportBrowser.test.js` (48/48 pass).
