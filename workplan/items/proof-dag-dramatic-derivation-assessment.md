---
id: proof-dag-dramatic-derivation-assessment
title: Proof-DAG dramatic-derivation formalism and external learner-DAG assessment
status: done
type: research
priority: P2
owner: codex
source: manual
created: 2026-06-24
updated: 2026-06-24
verification: "Proof-DAG / dramatic-derivation arc merged to main on
  codex/proof-dag-assessment: services/dramaticDerivation/{learnerDag,
  proxyDagMemory,assessment,conceptSchema}.js plus the derivationLearnerDag /
  dramaticDerivation test suite are green, and the learner-proxy-DAG A/B is
  closed out."
claim_status: exploratory
links:
  notes:
    - notes/2026-06-24-proof-dag-formalism-plan.md
  prs:
    - codex/proof-dag-assessment
tags:
  - proof-dag
  - dramatic-derivation
  - learner-dag
  - assessment
milestone: poetics-followups
---

Retroactive card capturing the proof-DAG / dramatic-derivation arc that landed on `main` via `codex/proof-dag-assessment` but had no `workplan/items/` entry. Created so the board reflects the work per the workplan one-rule (link, never copy — design rationale stays in the note).

Scope of the landed arc:
- **Formalism**: layered authored-proof-graph + machine-checkable derivation certificate + reconstructed learner proof sketch + external graph-alignment assessment. Plan and SOTA positioning in `notes/2026-06-24-proof-dag-formalism-plan.md`.
- **Services**: `services/dramaticDerivation/{learnerDag,proxyDagMemory,assessment,conceptSchema}.js` (+ `engine.js`/`llmRoles.js`/`index.js` extensions), keeping assessment external to the learner.
- **Ontology/config**: `config/ontology/derivation-concepts.ttl` controlled vocabulary; the `world-016-ai-syllabus-af1` AI-syllabus proof-DAG scenario.
- **Scripts**: `scripts/{run-learner-proxy-dag-ab,analyze-derivation-learner-dag-batch,run-derivation-loop}.js`.
- **Tests**: `tests/dramaticDerivation{Assessment,ConceptSchema,Confront,LearnerDag,ProxyDagMemory}.test.js` and `tests/derivationLearnerDagBatch.test.js`.

2026-06-24 Claude: Card created during a board review. The learner-proxy-DAG A/B is closed out and the arc is merged, so this is filed `done`/`exploratory`. The formalism note carries further optional extensions (richer proof-certificate formats, broader scenario coverage); those are roadmap, not blockers — spin a fresh card if pursued.
