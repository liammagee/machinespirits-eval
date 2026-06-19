# Machine Spirits Curriculum Format v0.1

Status: draft, implemented by `services/curriculum/curriculumCompiler.js`.

## Standards Position

Use a CASE-inspired graph as the curriculum spine, not a full LMS package:

- [1EdTech CASE 1.1](https://www.1edtech.org/standards/case) is the closest standard for machine-readable competencies, learning outcomes, academic standards, and associations. In this repo, the curriculum document, modules, and knowledge components map to CASE-style framework/items/associations.
- [1EdTech Common Cartridge](https://www.1edtech.org/standards/cc) is better treated as a future export/package target for LMS content, not the internal source of truth.
- [LRMI](https://www.dublincore.org/about/lrmi/) is useful for discovery metadata on resources, but it does not describe the adaptive evidence/verifier loop.

The authoring format is YAML because the repo already uses YAML for cells, worlds, rubrics, scenarios, and drama specs. A later exporter can project the stable subset into CASE JSON.

## Canonical Shape

```yaml
schema_version: ms-curriculum-v0.1
id: ai_foundations_v1
version: 1.0.0
title: AI Foundations: Models, Evidence, and Responsible Systems
standard_profile:
  spine: 1EdTech CASE 1.1 inspired
  extensions:
    - ms:evidence
    - ms:verifier
    - ms:misconception
    - ms:drama_binding
    - ms:world_adaptation

modules:
  - id: AF6
    sequence: 6
    title: Evaluation, generalization, calibration, and shift
    hours: "9"
    main_artifact: model audit and claim-evidence table
    primary_verifier: metric engine and evaluation linter
    essential_question: What evidence supports a claim that a model will work beyond the data used to build it?
    knowledge_components:
      - id: AF-601
        statement: Construct and interpret a confusion matrix
    canonical_tasks:
      - Derive metrics from counts rather than memorized formulas
    verifiers:
      - A metric engine recomputes all values from predictions...
    misconception_signatures:
      - High accuracy means a good classifier
    transfer_challenge: Audit a persuasive but invalid model-performance report...

associations:
  - from: AF5
    to: AF6
    relation: prerequisite_of
```

## Field Semantics

`modules[]` and `knowledge_components[]` are the portable curriculum graph. These should remain close to CASE-style learning outcomes and associations.

`canonical_tasks[]`, `verifiers[]`, `misconception_signatures[]`, `mastery_gate`, and `transfer_challenge` are Machine Spirits extensions. They are deliberately not hidden in prose because they are the bridge from curriculum to adaptive state, item generation, verification, and drama compilation.

`associations[]` is currently module-level prerequisite structure extracted from the Mermaid graph. It can later be extended to knowledge-component prerequisites and external standards alignment.

## Drama Compilation Contract

`scripts/compile-curriculum-to-drama.js` lowers the canonical curriculum into the current generator's `dramas:` YAML. Each module becomes a teaching-drama seed with:

- topic from the module essential question,
- learner start state from artifact, misconception, task, and verifier fields,
- approach choices from deterministic module defaults,
- `curriculum_binding` metadata linking the drama back to module and KC ids,
- for runnable modules, the locked `world_adaptation_spec_id`, `world_adaptation_spec_hash`, and a
  `world_public_constraints` projection with artifact/verifier/action-policy guidance safe for drama prompts,
- a per-turn `turn_plan` using the drama-machine move vocabulary.

The generated drama file is a runnable control artifact for `scripts/generate-pedagogical-dramas.js`. The
generator preserves the world binding in held-out keys/traces and injects only the public-safe constraint
projection into tutor/learner side constraints. It is not an empirical claim that the curriculum works.

## World Adaptation Contract

`scripts/compile-curriculum-to-worlds.js` lowers the canonical curriculum into locked `world_adaptation_spec` records for the adaptive tutor's Plan 2.1 closed loop. This is the Plan 2.4 bridge: the curriculum defines the local world before dialogue begins, then the runtime uses that fixed world contract to constrain policy selection and annotate adaptation contracts.

Each compiled spec contains:

- `id`, `version`, `source_curriculum_id`, `module_id`, `locked_at_compile_time`, and deterministic `spec_hash`,
- learner-state evidence from knowledge components, misconception signatures, and verifier signals,
- `action_policy` with allowed, preferred, and disallowed Plan 2.1 action families,
- `expected_transitions` with observable success/failure evidence for adaptive actions,
- `forbidden_moves` covering hidden-label exposure, premature proof supply, and artifact replacement,
- `outcome_observability` tying the world back to artifacts and verifiers.

The world spec is not an evaluator. It can shape action affordances and record expected observables, but it must not be used by itself to prove learning success. Independent outcome and quality analyses remain required.

## Current Commands

```bash
npm run curriculum:convert:ai-foundations
npm run curriculum:compile:drama
npm run curriculum:compile:drama -- --mvp --out curriculum/ai-foundations.mvp-dramas.yaml
npm run curriculum:compile:worlds
npm run curriculum:compile:worlds -- --check
```
