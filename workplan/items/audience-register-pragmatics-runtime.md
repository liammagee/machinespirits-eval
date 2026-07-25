---
id: audience-register-pragmatics-runtime
title: "Carry first-order Audience into runtime register pragmatics"
status: done
type: maintenance
priority: P2
owner: codex
source: manual
created: 2026-07-11
updated: 2026-07-26
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
branch: codex/audience-register-pragmatics-runtime
---

The formal layer now distinguishes Audience from the `{T,L,D}` bearers and
reifies register as a speaker–hearer–optional-audience relation. Runtime
conditioning now carries that relation without promoting Audience into the
enacted cast.

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

2026-07-26 Codex: Claimed in an isolated current-main worktree. Implementation
will preserve the existing engagement-stance series and treat the legacy
`audience_register` field only as an addressee-profile compatibility alias;
the first-order Audience remains declarative and non-enacted.

2026-07-26 Codex: Implemented response-configuration v3 and register-pragmatics
v1. The runtime now records enacted speaker/hearer positions, canonical
`addressee_profile`, and an optional declared or implied Audience with explicit
non-enactment invariants. Authored `audience.context` reaches tutor-stub,
compact-speaker, director, and derivation-role prompts through a public-only
projection; critic panels, cast bindings, turns, agency, and belief graphs do
not cross that boundary. Stored v2 configurations and v4 selections migrate at
read time while `selected_register`, `register_vector`, and
`engagement_stance_vector` remain unchanged. The irony/sarcasm rubric was not
versioned because this code-only change produced no model transcript evidence.
Verified by the focused runtime, prompt, frozen-replay, world-quality, lint,
source-only workplan, zero-call CLI dry-run, and full hermetic suites (6,790
root + 137 tutor-core tests).
