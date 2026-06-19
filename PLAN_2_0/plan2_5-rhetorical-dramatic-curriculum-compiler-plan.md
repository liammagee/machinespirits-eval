# Plan 2.5: Rhetorical-Dramatic Curriculum Compiler

Date: 2026-06-19
Status: design plan for the next curriculum/world/drama compiler slice

## Question

How do we weave the recent rhetoric, dramatic pacing, character, and poetics
work into the curriculum-to-world path without turning curriculum evidence into
loose script prose or circular self-evaluation?

## Relationship To Plan 2.4

Plan 2.4 adds the missing world contract: a locked
`world_adaptation_spec` compiled from curriculum before dialogue begins. It
defines learner-state evidence, misconceptions, verifiers, policy constraints,
forbidden moves, expected transitions, and observability.

Plan 2.5 should sit immediately after that contract. Its job is not to replace
the world spec. Its job is to compile that world into a role-playable teaching
drama using the drama machine's rhetoric, pacing, and character vocabulary.

The intended chain is:

```text
canonical curriculum
  -> locked world_adaptation_spec
  -> rhetorical_dramatic_plan
  -> generator-facing drama spec
  -> public transcript plus held-out role traces
```

The current light-drama path only partially does this. It compiles curriculum
into a drama seed, and the generator uses that seed to produce a transcript. The
full world contract is mostly adjacent metadata unless the adaptive tutor
runtime consumes it. Plan 2.5 makes the intermediate dramatic/rhetorical layer
explicit and testable.

## Design Principle

Keep three things separate:

1. **Curriculum evidence spine:** what must be learned, evidenced, verified,
   and not leaked.
2. **World contract:** how adaptive policy is constrained and what observable
   evidence counts inside the world.
3. **Dramatic realization:** how the encounter is staged through rhetoric,
   pacing, character, scene, and role-specific moves.

The dramatic plan can shape generation. It cannot prove success. Outcome and
quality analysis must remain independent.

## Target Artifact

Add a compiled `rhetorical_dramatic_plan` layer. It should be emitted either as
part of the drama YAML or as a sidecar linked by id and hash.

Suggested shape:

```yaml
rhetorical_dramatic_plan:
  id: RDP_AF6_CURRICULUM
  version: ms-rhetorical-dramatic-plan-v0.1
  source_curriculum_id: ai_foundations_v1
  source_world_adaptation_spec_id: W_AF6_CURRICULUM
  source_world_adaptation_spec_hash: sha256:...
  module_id: AF6
  locked_at_compile_time: true

  curriculum_spine:
    artifact: model audit and claim-evidence table
    verifier: metric engine and evaluation linter
    primary_misconception: High accuracy means a good classifier.
    target_task: Write a claim that matches the evidence rather than exceeding it.
    forbidden_public_exposure:
      - misconception ids
      - answer keys
      - verifier internals

  rhetoric:
    dialogue_approach: courtroom_cross_examination
    burden: claim_evidence_alignment
    pressure_style: admissible_evidence
    tutor_argument_habit: press_for_scope_and_evidence
    learner_argument_habit: defend_too_broad_a_claim_then_narrow_it

  pacing:
    beat_pattern: dogmatic_control
    beats:
      - exposition: learner states the tempting claim
      - complication: tutor asks what evidence licenses the claim scope
      - pressure: learner resists or deflects
      - turn: tutor either holds routine or changes route, depending on arm
      - action_gate: learner must revise, classify, add a row, or name a gap
      - closure: learner-authored bounded claim or unresolved failure
    turn_plan:
      - at: { turn: 2 }
        role: tutor
        moves: [hold]
        forbid: [route_change, reveal]
      - at: { turn: 2 }
        role: learner
        moves: [voice_misfit]
        forbid: [pseudo_catharsis]

  character:
    learner:
      persona: adversarial_tester
      motive: defend deployment claim
      public_risk: losing sign-off after prior work
    tutor:
      ethos: dogmatic_protocol_gatekeeper
      habit: preserve established evidence route under resistance
      prohibited_habits:
        - warm validation as substitute for evidence
        - hidden-label exposure
        - supplying the finished audit

  scene:
    setting: technical review room before panel sign-off
    object: audit table
    stakes: deployment claim may exceed validated data
```

## Compiler Responsibilities

### 1. Curriculum spine extraction

Reuse the existing canonical curriculum fields:

- `main_artifact`;
- `primary_verifier`;
- `canonical_tasks`;
- `knowledge_components`;
- `misconception_signatures`;
- `mastery_gate`;
- `transfer_challenge`.

The compiler should select a small prompt-facing spine, not dump every field into
the scene. For each module, choose:

- one primary misconception;
- one target task;
- one artifact;
- one verifier;
- a compact list of hidden fields that must not appear in public speech.

### 2. World-to-rhetoric mapping

Map `world_adaptation_spec.action_policy` and expected transitions into
rhetorical choices.

Examples:

- `request_evidence` + `claim-evidence alignment` -> courtroom or audit-table
  rhetoric;
- `contrast_models` -> Socratic counterexample, workshop comparison, or
  adversarial review;
- `repair_overconfidence` -> elenchus, social reckoning, or public sign-off
  pressure;
- `withhold_answer` -> examiner stance, Socratic discovery, or protocol gate.

The mapping should be deterministic for a default compile, with optional seeded
variation later.

### 3. Pacing synthesis

Emit a `beat_pattern` and `turn_plan` from the intended experimental arm.

Suggested arm mappings:

| Arm | Tutor policy | Pacing pattern |
| --- | --- | --- |
| adaptive curriculum drama | `peripeteia` | `stock_take -> route_change -> action_gate` |
| dogmatic/routine control | `routine` | `hold -> withhold -> protocol pressure` |
| Socratic discovery | `socratic_discovery` | `meter -> recognition_press` |
| no-cue low-organic control | `none` | ordinary clarification; no route change |
| reveal ceiling | `reveal_secret` | state the answer; test ceiling only |

This should build on the existing drama-machine move vocabulary:

- tutor: `stock_take`, `route_change`, `action_gate`, `hold`, `withhold`,
  `meter`, `recognition_press`, `reveal`;
- learner: `voice_misfit`, `perform_device`, `reframe`, `reconsider`,
  `revoice`;
- director: `inject_revisit_cue`, `inject_reversal_pressure`,
  `scene_interruption`.

### 4. Character synthesis

Compile character as typed fields rather than only free prose:

- learner persona;
- learner motive;
- learner public risk;
- tutor ethos;
- tutor argumentative habit;
- tutor prohibited habits;
- relationship/status relation;
- speech/register constraints.

The generated `intended_tutor_character`, `learner_voice_constraint`, and
`tutor_voice_constraint` can still exist, but they should be lowered from these
typed fields rather than hand-authored as the only source of truth.

### 5. Generator-facing lowering

Lower `rhetorical_dramatic_plan` into the existing `dramas:` YAML accepted by
`scripts/generate-pedagogical-dramas.js`:

- `persona`;
- `pedagogical_approach`;
- `dialogue_approach`;
- `learner_start_state`;
- `learner_voice_constraint`;
- `tutor_voice_constraint`;
- `intended_tutor_character`;
- `dramatic_shape`;
- `turn_plan`;
- `curriculum_binding`.

The lowered drama spec should also carry:

- `world_adaptation_spec_id`;
- `world_adaptation_spec_hash`;
- `rhetorical_dramatic_plan_id`;
- `rhetorical_dramatic_plan_hash`.

The run key should persist those ids and hashes so transcript artifacts can be
traced back to the exact curriculum/world/drama contracts.

## Runtime And Prompt Boundaries

The prompt-facing dramatic layer may expose:

- artifact name;
- public task;
- public evidence standard;
- scene/stakes;
- role constraints;
- allowed rhetorical form.

It must not expose:

- misconception ids;
- hidden labels;
- answer keys;
- verifier internals;
- spec hashes in public dialogue;
- the evaluator's desired classification.

The held-out key may store design hypotheses and hashes, but critic-visible
samples must remain transcript-only unless an explicitly omniscient critic is
being used.

## Initial AF6 Slice

Use AF6 as the first implementation slice because it already demonstrates the
problem:

- curriculum spine: model audit and claim-evidence table;
- world spec: request evidence, contrast models, repair overconfidence,
  challenge without telling;
- rhetoric: courtroom cross-examination or technical sign-off;
- character contrast: resistant learner and dogmatic protocol tutor;
- pacing contrast: routine hold versus adaptive route change;
- scene object: audit table;
- action gate: add leakage, subgroup, calibration, shift, or deployment-gap
  rows.

The Sonnet light-drama run showed that curriculum semantics transfer naturally
into scene furniture: the compiler gave evaluation, generalization, calibration,
shift, subgroup evaluation, and claim-evidence alignment; the generated script
realized those as held-out accuracy, distribution holds, supplier/fiscal
partitions, leakage documentation, calibration bins, distribution shift
indicators, and a deployment-scope gap.

That is a promising qualitative transfer, but not yet a world-constrained
runtime result.

## Implementation Slices

### Slice A: plan-only compiler output

Add a function in `services/curriculum/curriculumCompiler.js`:

```text
rhetoricalDramaticPlanForModule(module, worldSpec, options)
```

Generate a new file:

```text
curriculum/ai-foundations.rhetorical-dramatic-plans.yaml
```

No generator changes required yet. Tests check deterministic output and hash
stability.

### Slice B: lower plan into drama YAML

Extend `compile-curriculum-to-drama` so a drama entry can be produced from a
`rhetorical_dramatic_plan`, not directly from raw module fields.

Acceptance:

- existing `ai-foundations.mvp-dramas.yaml` still compiles;
- AF6 dogmatic-control and adaptive-peripeteia variants can be emitted from the
  same curriculum/world source;
- lowered entries include world and rhetorical plan ids/hashes.

### Slice C: generator provenance

Update `scripts/generate-pedagogical-dramas.js` key output to preserve:

- `curriculum_binding`;
- `world_adaptation_spec_id`;
- `world_adaptation_spec_hash`;
- `rhetorical_dramatic_plan_id`;
- `rhetorical_dramatic_plan_hash`.

Acceptance:

- public transcript does not expose those fields;
- held-out key records them;
- renderer can display them as metadata only when explicitly requested.

### Slice D: optional prompt constraint injection

Inject a compact, public-safe world/rhetoric constraint block into the director
and tutor plan:

- public artifact;
- public evidence standard;
- allowed rhetorical posture;
- forbidden public exposures;
- action gate expected from the learner.

Do not inject misconception ids, answer keys, hidden labels, or full verifier
internals.

### Slice E: comparison runs

Before any panel or claim:

1. generic curriculum drama;
2. world plus rhetorical-dramatic plan;
3. mismatched rhetorical-dramatic plan;
4. dogmatic/routine control;
5. adaptive/peripeteia variant.

Evaluate with cheap single-critic poetics scoring and hand inspection first.
Only escalate to a panel if the cheap screen finds a meaningful contrast.

## Test Plan

- Compiler emits deterministic `rhetorical_dramatic_plan` records.
- Plan hash changes when rhetorical, pacing, or character choices change.
- Missing world spec fails when the plan requires world-derived policy fields.
- Hidden misconception ids never enter public-facing lowered constraints.
- AF6 compiles to both dogmatic/routine and adaptive/peripeteia variants.
- Generator key persists world and rhetorical plan ids/hashes.
- Public transcript and rendered HTML do not contain hidden labels, answer keys,
  or hash strings.
- Scrambled or mismatched plans alter generation constraints but do not count as
  success evidence.

## Interpretation Gates

Plan 2.5 can support three outcomes:

1. **Useful realization layer:** curriculum evidence becomes dramatically
   inspectable without leaking hidden labels.
2. **Over-directive layer:** character/pacing controls dominate the curriculum
   and produce theatrical but weakly evidenced transcripts.
3. **Metadata-only layer:** the plan records provenance but does not materially
   change generated action.

Only the first outcome justifies deeper integration with the Plan 2.1 adaptive
runtime.

## Out Of Scope

- using the generated dramatic plan as an evaluator;
- claiming human learning, retention, or transfer;
- optimizing live against a generated rubric;
- replacing independent outcome or quality analysis;
- multi-learner group drama;
- beat-addressed act structure beyond fixed turn numbers;
- paper-claim updates before independent evidence exists.
