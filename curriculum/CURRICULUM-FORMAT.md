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

## Rhetorical Dramatic Plan Contract

`scripts/compile-curriculum-to-rhetorical-dramatic-plans.js` lowers the canonical curriculum into
`rhetorical_dramatic_plans` (validated + content-hashed via `computeRhetoricalDramaticPlanHash`). This is the
rhetorical lineage: each plan binds a module to a world spec and a rhetorical-dramatic shape, and
`compile-curriculum-to-drama.js --from-rhetorical-plans` projects those plans into the runnable `dramas:` spec
(`curriculum/ai-foundations.rhetorical-dramas.yaml`) instead of compiling drama seeds straight from the
curriculum. Compiled drama ids are `D_AF<N>_CURRICULUM` (curriculum source) or `D_AF<N>_CURRICULUM_ADAPTIVE`
(rhetorical-plan source).

## Current Commands

```bash
# 1. markdown source -> canonical curriculum object (add --check to validate only)
npm run curriculum:convert:ai-foundations

# 2. canonical -> locked world specs (--check validates hashes; --all for every module, default --mvp)
npm run curriculum:compile:worlds
npm run curriculum:compile:worlds -- --check

# 3. canonical -> rhetorical-dramatic plans (--mvp default | --all | --arms a,b | --check)
npm run curriculum:compile:rhetorical-dramatic-plans

# 4a. canonical -> drama seeds
npm run curriculum:compile:drama
npm run curriculum:compile:drama -- --mvp --out curriculum/ai-foundations.mvp-dramas.yaml

# 4b. rhetorical plans -> drama spec (the suite the live light-drama loop runs)
npm run curriculum:compile:drama -- --mvp --from-rhetorical-plans \
  --out curriculum/ai-foundations.rhetorical-dramas.yaml

# 5. render a generated transcript to an HTML dialog (see scripts/render-light-drama-dialog-html.js for flags)
npm run drama:render -- --transcript <run>/transcripts/<id>.json --out exports/<id>.html
```

## Curriculum Builder

`npm run curriculum:build` is the authoring entry point for new curricula. It
does not replace the compiler contracts above. It produces a canonical
curriculum object, validates that the prerequisite associations form a DAG,
requires runtime-ready verifier and misconception evidence for every module,
and then uses the existing compilers to write worlds and drama seeds.

The deterministic path starts from a YAML brief:

```bash
npm run curriculum:build -- \
  --brief curriculum/examples/evidence-reasoning.brief.yaml \
  --out /tmp/evidence-reasoning.curriculum.yaml
```

Run with no arguments for a field-by-field interactive wizard. Add `--generate`
to let a configured model draft module structure from the high-level brief.
Model drafting is explicit: `--dry-run` never calls a model or writes files.

Optional web and local references are first-class provenance records:

```bash
npm run curriculum:build -- \
  --brief curriculum/my-course.brief.yaml \
  --generate \
  --source https://example.org/standard \
  --source-file notes/local-reading.md
```

Each source receives a stable build-local id such as `REF01`, along with its
title, location, access time, media type, extracted-text SHA-256 hash, and a
short excerpt. Modules and knowledge components cite those ids through
`reference_ids`. Sources may inform authoring, but they are not mastery
evidence and cannot substitute for module verifiers.

Default outputs share one basename:

- `*.curriculum.yaml` — canonical source of truth;
- `*.worlds.yaml` — locked world contracts;
- `*.dramas.yaml` — runnable drama seeds;
- `*.builder-report.md` — Mermaid prerequisite DAG, readiness counts, source
  ledger, artifact map, and the scenario-authoring handoff gate.

Use `--rhetorical` for the additional rhetorical-plan and rhetorical-drama
artifacts, `--no-compile` to stop after the canonical object, `--check` to
validate without writing, and `--force` to replace existing artifacts.

Generation itself (`scripts/generate-pedagogical-dramas.js`) follows a dry-run -> mock -> attended-real cost
ladder; the `/ms-curriculum-drama` skill drives the whole chain.

## From curriculum graph to scenario proof DAG

Curriculum building involves three related but non-interchangeable graphs:

1. The canonical curriculum's prerequisite DAG says which modules require
   which earlier modules.
2. The compiled world-adaptation spec constrains tutor actions for one module;
   it is neither a proof nor an evaluator.
3. A derivation world's proof DAG says which staged facts and public rules
   entail its answer.

The Curriculum Builder validates and reports the first, and compiles the
second. It deliberately does not invent the third. If a module is adapted into
a `config/drama-derivation/world-*.yaml` scenario, follow
[`SCENARIO-DAG-GUIDE.md`](SCENARIO-DAG-GUIDE.md): align the question with the
answer type, make every evidence surface support its exact formal fact, give
every public rule a domain-valid gloss, keep proof paths minimal, label
corroboration/controls/alternate routes, declare mirror incompatibility, and
set presentation and eligibility metadata.

Run the catalog gate after any such authoring change:

```bash
npm run derivation:quality
```

This is a structural authoring check. Scientific, legal, historical, and other
domain entailments still require human review; the compiler and proof chainer
cannot certify that a premise is true in the world outside the scenario.
