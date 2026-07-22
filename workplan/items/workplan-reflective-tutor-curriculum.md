---
id: workplan-reflective-tutor-curriculum
title: Load the live workplan as a reflective tutor-stub curriculum
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "The live workplan compiler preserves dependency order and source hashes; tutor-stub lists and dry-runs a selected card without a model call or proof-world substitution; focused curriculum tests pass."
claim_status: methods
depends_on: []
links:
  notes:
    - docs/tutor-stub-cli.md
tags:
  - workplan
  - curriculum
  - tutor-stub
  - reflective-inquiry
---

Project an explicitly selected set of open workplan cards into a canonical
curriculum that tutor-stub can use for reflective inquiry. The projection reads
`workplan/items/` live, keeps prerequisite edges and source hashes, and treats a
card's verification rule as something the dialogue may examine but cannot
declare satisfied.

Completion boundary:

- `--curriculum workplan --module <id>` loads one selected card without a model
  call during dry-run.
- `--list-curriculum-modules` exposes the dependency-ordered open set.
- Workplan prerequisites remain curriculum associations, not concealed proof
  facts or dramatic-derivation DAG edges.
- The ignored YAML snapshot compiler is inspection/provenance only; the live
  loader does not depend on it.

2026-07-22 Claude: Landed in commit `03e21d54` with three focused tests covering
dependency ordering, completion-boundary language, and a no-model tutor-stub
dry-run.
