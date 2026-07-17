---
id: audience-register-pragmatics-runtime
title: "Carry first-order Audience into runtime register pragmatics"
status: triaged
type: maintenance
priority: P2
owner: unassigned
source: manual
created: 2026-07-11
updated: 2026-07-11
verification: "A versioned runtime schema can represent speaker, hearer, optional audience, and audience alignment while Audience remains non-enacted; compatibility and focused tests pass."
links:
  notes:
    - BELIEF-DESIRE-DAG.md
    - notes/poetics/drama-machine/TAXONOMY.md
    - notes/poetics/drama-machine/SPEC.md
  items:
    - register-taxonomy-negative-registers
tags:
  - audience
  - registers
  - pragmatics
  - ontology
---

The formal layer now distinguishes Audience from the `{T,L,D}` bearers and
reifies register as a speaker–hearer–optional-audience relation. Runtime
conditioning remains deliberately deferred.

Acceptance:

- Decide how `audience.context` enters director and role prompts without giving
  Audience a turn, cast binding, interior agency, or belief/desire graph.
- Introduce a canonical `addressee_profile` runtime key only with a mirrored
  `audience_register` compatibility alias and versioned trace migration.
- Preserve `selected_register` and continuous register-vector comparability.
- Version the irony/sarcasm rubric only if transcripts expose audience evidence;
  do not reinterpret historical register scores.
- Keep `turn_plan.role`, speaker menus, role maps, and cast bindings limited to
  enacted roles.
