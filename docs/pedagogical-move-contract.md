# Shared Pedagogical-Move Contract

Status: Phase 1 shadow boundary, 2026-08-18.
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

## Phase 1 authority

Neither projection is imported by a live runtime. Shadow records retain the
complete legacy decision and conservation context, mark `authority: legacy`,
and hard-code `consumer_switch_authorized: false`.

The conserved context covers:

- learner profile identity;
- experimental arm assignment;
- warrant basis;
- legacy selected action family and action type; and
- protected result labels.

An unexplained mismatch blocks integration. It does not trigger a repair,
rewrite a trace, alter a historical result, or license switching a consumer.

## Next boundary

Only after exact shadow parity and the full conservation gate pass may a later
PR add a live observer. Even then, legacy selection remains authoritative until
the workplan records a separate deletion/switch decision. Bored and
frame-defiant profile work extends the learner registry after this contract;
it does not change `low_agency` or `overconfident`. Its public-observation and
warrant projection is implemented in design shadow only: profile identity is
never itself a warrant, and no register choice is present in the projected
move.

Prospective resistant-profile measurement may separately report public axes
for effort investment, learner authorship/deference, evidential orientation,
epistemic trust, and frame legitimacy. Those axes are observations upstream of
the warrant. They are neither profile IDs nor move types, cannot directly
select a move, and cannot select sarcasm, irony, or any other register.
