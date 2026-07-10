# Field Theory Implementation Plan

## Status

This plan turns the PLAN_4_0 field-theory note into an incremental runtime implementation. It is an implementation plan, not an empirical paper claim. Field reporting is instrumentation; field planning and enforcement are experimental controller work that must remain opt-in until evaluated under frozen protocols.

Current implementation status:

- Phases 1-2 are implemented as runtime field objects and dialogue-report artifacts.
- Phase 3 is implemented as a registered pedagogical-script object model with the default `prediction_failure_repair_generalisation_transfer` script.
- Phase 4 is implemented as deterministic candidate-move projection inside the field planner. LLM simulation remains deliberately out of scope until the deterministic baseline is evaluated.
- Phase 5 is implemented as opt-in advisory/enforced field planning with stored candidate projections, selected moves, expected movement, observed movement, and non-leak audits.
- Phase 6 is specified in `PHASE_6_EVIDENCE_GATE_PLAN.md` and remains unrun.

## Goal

Bring the dramatic-derivation runtime closer to the Field Theory of Adaptive Pedagogical Interaction by making learner, tutor, discourse, and joint interaction fields first-class computational objects, then using those fields to support reports, trajectory projections, script-level planning, and gated conduct selection.

## Design Boundaries

- Preserve the current derivation checker, proofDebt, release discipline, and hidden-state safeguards.
- Keep default behavior unchanged unless a field option is explicitly enabled.
- Treat field estimates as computed signals with provenance, not privileged access to the learner's mind.
- Separate reporting from control: reports can be broad; runtime enforcement must be gated and audited.
- Preserve paper discipline: this implementation does not revise the main-paper claims until validated separately.

## Phase 1: Field Objects

Create first-class modules for each field:

- `learnerField.js`: already present; represents learner movement over proof topology.
- `tutorField.js`: tutor-side pedagogical state, including diagnostic confidence, uncertainty, strategy momentum, rapport, active hypotheses, and instructional momentum.
- `discourseField.js`: shared pedagogical process, including vocabulary overlap, dialogue acts, open questions, commitments, tone, rhythm, and explanatory structure.
- `interactionField.js`: composes learner, tutor, and discourse fields into the joint field.

Each per-turn field frame should carry:

```js
{
  turn,
  dimensions,
  dynamics: { velocity, acceleration, speed, accelerationMagnitude, curvature },
  evidence,
}
```

## Phase 2: Field Frames And Reports

Accumulate `fieldFrame` history on every reported dialogue:

- dynamic learner field
- tutor field
- discourse field
- joint interaction field
- final deltas
- attractors and phases
- public-only audit status where applicable

The dialogue report remains the primary inspection surface and should continue to emit `dialogue-report.json`, `dialogue-report.md`, and `dynamic-field.svg`.

## Phase 3: Pedagogical Scripts

Promote scripts from labels into computational objects:

```js
{
  id,
  stages,
  entryConditions,
  exitConditions,
  preferredMoves,
  antiPatterns,
  expectedFieldMovement,
}
```

The default script remains `prediction_failure_repair_generalisation_transfer`, but the runtime should be able to register more scripts without touching planner logic.

Implemented in `services/dramaticDerivation/pedagogicalScripts.js`. Each interaction-field turn carries the active stage's preferred moves, anti-patterns, and expected movement into planner scoring.

## Phase 4: Trajectory Projection

Before selecting an action, evaluate candidate moves against predicted field deltas:

```text
current field
-> candidate conduct family
-> predicted learner/tutor/discourse/joint movement
-> selected move
```

Start with deterministic projections from existing conduct and didactic specs. Add LLM simulation only after deterministic projections provide a stable baseline.

Implemented in `services/dramaticDerivation/fieldPlanner.js` as a deterministic candidate table over all conduct move families. Each candidate receives expected learner/tutor/discourse/joint deltas and a score before selection.

## Phase 5: Runtime Planning

Keep field planning in three levels:

- `--field-report-context`: report-only instrumentation — the coupled-field summary enters the tutor context with no move recommendation and no conduct authority (the Phase 6 `field_report_only` placebo arm).
- `--field-planner`: advisory selection of conduct family and didactic mode.
- `--field-planner-enforce`: opt-in enforcement through existing conduct-policy machinery.

Planner choices must record:

- current field state
- candidate moves considered
- selected move and reason
- expected field movement
- observed post-turn movement
- non-leak audit status

Implemented in `result.fieldPlanner[*]` and surfaced in dialogue reports.

## Phase 6: Evaluation Gate

No paper-level claim follows from implementation alone. Promotion requires a frozen held-out evaluation:

- baseline hidden+proofDebt or current best arm
- field-report only
- field-planner advisory
- field-planner enforce
- fixed worlds and seeds
- exact scorer and stop rules
- proof reliability, release adherence, and field-movement metrics

The first valid claim should be narrow: whether field planning improves a predeclared derivation-controller failure without harming proof reliability.

See `PHASE_6_EVIDENCE_GATE_PLAN.md` for the frozen arms, world set, endpoints, safety gates, and decision rules.

## First Implementation Slice

1. Add `tutorField.js` and `discourseField.js`.
2. Refactor `interactionField.js` to compose those modules.
3. Preserve existing exports and tests.
4. Add focused tests only where new module boundaries need coverage.
5. Leave planner behavior unchanged except for consuming the refactored field frames.
