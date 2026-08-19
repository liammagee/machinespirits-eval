# Shared Pedagogical-Move Contract

Status: Phase 3 live shadow tracer, 2026-08-19.
Workplan item: `resistance-action-register-integration`.
No model call, study run, runtime switch, or empirical claim is authorized by
this contract.

## Boundary

The shared commitment unit is a typed pedagogical move:

`public observation -> warrant -> PedagogicalMove -> register/character realization -> public outcome`

A move records the pedagogical operation, target, expected uptake,
constraints, transition contract, responsibility, compatibility projection,
and source provenance. It cannot contain register, stance, tone, character,
audience, lexical, or scene fields. Those remain downstream realization
choices.

The warrant also remains a separate upstream decision object. A shadow record
joins its exact `warrant_basis` to the projected move without copying or
reinterpreting that basis inside the move. This preserves the distinction
between why a move was licensed and what the licensed move commits the tutor
to do.

`action_type` and `action_family` are compatibility fields only. They preserve
the existing host decision for shadow parity; neither is silently promoted to
the shared `move_type`.

## Host projections

- `services/adaptiveTutor/pedagogicalMoveProjection.js` maps every concrete
  adaptive-runner action through a closed, versioned table. It preserves target
  axes, expected state change, success/failure evidence, forbidden moves, and
  the legacy action type/family. It deliberately drops the existing v2
  action's `register` field.
- `services/tutorStubPedagogicalMoveProjection.js` maps every tutor-stub
  expected-uptake action family through a separate closed, versioned table. It
  preserves the family, expected learner response, deadline, lifecycle
  transitions, and terminal state.

The two maps are explicit even where labels look similar. Consolidating two
move types later requires a reviewed semantic ruling; spelling or family
membership is not evidence of equivalence.

## Phase 3 shadow authority

The adaptive-runner projection remains offline. The tutor-stub projection is
now imported only by `services/tutorStubActionBeforeRegisterShadow.js`, whose
live observer executes a typed-move projection before the existing response-
configuration normalizer chooses a register. The observer does not feed the
move back into selection, prompts, guards, repairs, or public output. Existing
response-configuration selection remains authoritative, and every record
hard-codes `runtime_selection_authorized: false`,
`consumer_switch_authorized: false`, and `changes_public_output: false`.

The live trace records five ordered stages:

1. deterministic public observation;
2. a warrant or legacy-selector preview;
3. a typed `PedagogicalMove` candidate;
4. the independently selected legacy register and any later action-family
   override; and
5. the audit-observed public realization of the delivered legacy action and
   register.

For the two held-out resistant instruments, public effort withholding licenses
`ask_discriminating_question`, while a public frame-jurisdiction dispute
licenses `test_bounded_distinction`. Profile identity is never consulted. If
both axes fire, the warrant fails closed. When neither fires, the tracer uses
the existing action-family projection as its shadow candidate.

Register compatibility is diagnostic only. Sarcasm is provisionally compatible
with the boredom move and irony with the frame-defiance move only when a
negative, random, edge-timing, or explicit-register policy opted into an edged
register. Edged registers are incompatible during comprehension repair or
protected affect, after uptake, or when paired with another move. This mapping
is a design hypothesis for the later crossed experiment, not an outcome claim.

The conserved context covers:

- learner profile identity;
- experimental arm assignment;
- warrant basis;
- legacy selected action family and action type; and
- protected result labels.

An unexplained mismatch blocks integration. It does not trigger a repair,
rewrite a trace, alter a historical result, or license switching a consumer.

## Next boundary

The live observer does not authorize a consumer switch. After the conservation
gate passes, exact shadow traces can be used to freeze the crossed causal study
that tests matched versus mismatched action, warm/plain versus edged
realization, and same-treatment repeat. Only that registered experiment can
test whether a matched move or tonal realization improves an outcome.

Bored and frame-defiant profile work extends the learner registry; it does not
change `low_agency` or `overconfident`. Profile identity is never itself a
warrant, and no register choice is present in the projected move.

Prospective resistant-profile measurement may separately report public axes
for effort investment, learner authorship/deference, evidential orientation,
epistemic trust, and frame legitimacy. Those axes are observations upstream of
the warrant. They are neither profile IDs nor move types, cannot directly
select a move, and cannot select sarcasm, irony, or any other register.
