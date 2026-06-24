---
id: audit-dramatic-metaphor-role-vocabulary
title: Audit dramatic metaphor and rename director role toward author
status: triaged
type: content
priority: P2
owner: unassigned
source: manual
created: 2026-06-23
updated: 2026-06-24
verification: Dramatic-machine docs, derivation notes, config names, UI labels,
  and any runtime-facing role names use a coherent metaphor set; the
  director/author distinction is either renamed safely or documented with a
  compatibility path.
links:
  notes:
    - notes/poetics/drama-machine/SPEC.md
    - notes/poetics/drama-machine/TAXONOMY.md
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
