---
id: tutor-stub-director-meta-control
title: "Separate learner-to-director tutor controls from object-language turns"
status: done
type: maintenance
priority: P1
owner: codex
source: manual
created: 2026-07-24
updated: 2026-07-24
verification: "Focused command-registry, interactive CLI, transcript/replay, reset/resume, prompt-boundary, and formatting/lint checks prove /meta and /director requests alter subsequent tutor delivery without entering public learner dialogue, learner-DAG evidence, or Replay JS; bare /director and /notes retain released-note viewing behavior."
branch: codex/tutor-stub-director-command
links:
  notes:
    - notes/2026-07-24-tutor-stub-latency-and-discourse-plane.md
  items:
    - tutor-stub-human-discourse-layer
    - tutor-stub-dialogue-first-terminal-presentation
tags:
  - tutor-stub
  - cli
  - discourse-plane
  - director
---

Give the learner an explicit control channel for requests about the tutor rather
than forcing those requests through the public subject-matter dialogue. Preserve
the existing released-director-notes view while separating private
learner-to-director instructions from public learner speech and proof state.

Acceptance criteria:

- `/meta <request>` and `/director <request>` store the same bounded private
  tutor-delivery direction; bare `/meta` reports it and `/meta clear` ends it.
- Bare `/director` and `/notes` still show only the opening and released scene
  notes; `/notes` does not become a mutation alias.
- A tutor-change request applies to subsequent tutor replies until replaced or
  cleared, with deterministic semantics for commands entered during a model
  call, `/reset`, mixed-prefetch invalidation, and explicit trace resume.
- The request is absent from public learner history, learner-DAG analysis, proof
  and release state, and Replay JS. It is visible as private provenance in trace,
  transcript settings, and the director ledger.
- The speaking tutor treats it as untrusted delivery guidance subordinate to
  public evidence, response contracts, closure, and safety; no new director
  model call is introduced.

2026-07-24 Codex: Activated in an isolated worktree from current `origin/main`.
The implementation preserves `/director` as the released-notes viewer and adds
an argument-bearing private control plus the explicit `/meta` command.

2026-07-24 Codex: Implemented and validated the private guidance state, prompt
boundary, command registry/help/completions, mixed-prefetch invalidation,
in-flight merge behavior, reset/resume restoration, trace/transcript provenance,
and public-only replay exclusion. Verification passed 42/42 full interactive
tests, 82/82 focused capability/discourse/prompt/transcript tests, 20/20 required
prompt/world tests, the 29-world quality audit, repository-wide ESLint and
Prettier, skill-sync checks, and the 174-item workplan checks. All model-facing
tests used the fake CLI; no external model call was made.
