---
id: tutor-stub-curriculum-mastery-runtime
title: Add curriculum authoring, progression, and mastery to tutor-stub
status: triaged
type: infra
priority: P2
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: "The existing curriculum builder and a tutor-stub/Scriptorium workbench author, lint, hash, preview without spend, and round-trip one multi-module course; /module, /next, and /progress drive diagnostic, scaffold, independent-check, and transfer phases for two non-detective curricula; public state cannot expose private verifier material; external workplan completion is never inferred from dialogue."
depends_on:
  - tutor-stub-capability-session-runtime
links:
  notes:
    - docs/tutor-stub-prompt-and-world-authoring.md
    - curriculum/CURRICULUM-FORMAT.md
  items:
    - adaptive-curriculum-memory-controller
    - scenario-presentation-variety
    - scriptorium-creation-flows
tags:
  - tutor-stub
  - super-app
  - curriculum
  - mastery
  - authoring
---

Tutor-stub can reflect on one canonical curriculum module, and the repository
already compiles curricula into worlds and dramas, but the live app does not
sequence modules or own an evidence-backed mastery lifecycle. Integrate the
existing builder/compiler as a schema-aware workbench, then add current-session
module progression and transfer checks over public evidence.

Longitudinal learner memory remains owned by
`adaptive-curriculum-memory-controller`; this card must consume that contract
rather than inventing a second cross-session store.
