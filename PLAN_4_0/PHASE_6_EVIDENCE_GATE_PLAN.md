# PLAN_4_0 Phase 6 Evidence Gate

## Status

This is the promotion gate for the field-theory runtime work. It is not a result and does not license a paper-level claim by itself.

The implementation now supplies the instrumentation Phase 6 needs:

- learner, tutor, discourse, and joint interaction fields
- registered pedagogical script objects with stage-level preferred moves, anti-patterns, and expected movement
- deterministic candidate-move projection before field-planner selection
- selected move, candidate list, expected movement, observed movement, and non-leak audit in `result.fieldPlanner`
- dialogue reports with a field-planner trace section

Tutor-stub auto-evals remain calibration and debugging evidence. The promotion claim must come from the dramatic-derivation runtime, where proof reliability, release discipline, and learner assertion are mechanically checked.

## Claim Boundary

The first valid claim should be narrow:

> In predeclared derivation worlds where the current best hidden+proofDebt controller has a known failure or inefficiency mode, field-planner advisory or enforcement improves completion or turn efficiency without harming proof reliability, release adherence, or non-leak discipline.

Do not claim:

- human learning benefit
- general tutoring superiority
- reliable superiority of field theory as a pedagogy
- cross-domain transfer beyond the frozen worlds
- model-independent robustness unless separately replicated across model stacks

## Frozen Arms

Run the same worlds, seeds, learner profile, tutor model stack, stop rules, and scorer across these arms:

| arm | runtime flags | purpose |
| --- | --- | --- |
| `baseline_hidden_proofdebt` | current best hidden+proofDebt configuration, no field planner | primary control |
| `field_report_only` | `--field-report-context` — the coupled-field summary is injected into the tutor context with no move recommendation and no conduct authority | instrumentation placebo/control |
| `field_planner_advisory` | `--field-planner` | tests whether planner advice changes tutor conduct without enforced control |
| `field_planner_enforce` | `--field-planner-enforce` | tests whether candidate-projection control helps when made binding |

The placebo arm must stay flag-distinct from baseline (enforced by test): if
`field_report_only` ran the same command as baseline, decision rule 2 below
would pass vacuously and a planner "win" could not be separated from the
prompt-context change of merely showing the tutor the field report. Note that
in mock mode the deterministic tutor ignores prompt content, so mock rows
cannot exercise this arm (or the advisory arm) behaviorally — mock validates
plumbing and trace coherence only.

Optional secondary arms may be added only after the primary four-arm gate is registered:

- `field_planner_no_script_fit`: projection scores ignore script preferred/anti-pattern weights.
- `field_planner_no_projection`: planner uses the old rule ordering without candidate scores.
- `visible_guard_baseline`: page-visible guard where prior world geometry makes this an important comparison.

## Frozen World Set

Use a held-out set that spans the failure classes already visible in the derivation suite:

| world | role in gate |
| --- | --- |
| `world-005-marrick.yaml` | long forked medieval proof geometry; default hard case |
| `world-006-hethel.yaml` | linear distractor / decoy-seating boundary |
| `world-010-hethel-resistant.yaml` | resistant learner variant |
| `world-019-marrick-resistant.yaml` | marrick with resistant learner pressure |
| `world-004-withercombe.yaml` | transfer check against a non-marrick proof texture |
| `world-009-ravensmark.yaml` | second non-marrick robustness check |

Before launch, freeze the exact list and do not add worlds after seeing results. A smaller smoke gate can use `world-005`, `world-006`, and `world-019`, but it should be labeled smoke and not promoted.

## Seeds And Repetition

Minimum:

- `k = 5` seeds per arm per world for a smoke-quality directional read.
- `k = 10` seeds per arm per world for the first promotable local claim.

The same seed indexes must be used across arms. Failed rows caused by provider/network errors may be resumed, but no semantic rerolls are allowed.

Seed scope caveat: the seed parameterizes the decay process and row identity
only. In real mode the model backend is not seeded, so "same seed across arms"
pairs decay trajectories, not model behavior — report per-arm distributions,
not seed-paired deltas, for real-mode rows.

## Primary Endpoints

Primary endpoint:

- grounded anagnorisis rate: learner asserts the target and the public valid board entails it.

Primary safety gates:

- zero unreleased-premise leaks in learner-facing tutor output
- no increase in unsupported final assertions
- no material increase in release deviations
- non-leak audits pass for all field-planner rows

Primary efficiency endpoint:

- turns to grounded assertion among successful rows

## Field-Movement Endpoints

These are process endpoints, not substitutes for proof success:

- reduction in `trajectoryRisk`
- increase in `pedagogicalAlignment`
- increase in `couplingStrength`
- expected-vs-observed movement alignment from `result.fieldPlanner[*].outcome.projectionAlignment`
- candidate-rank stability: selected move score margin over the next-best candidate
- script-stage fit: selected move matches stage preferred moves and avoids anti-patterns

## Decision Rules

Promote only if:

1. `field_planner_advisory` or `field_planner_enforce` improves grounded anagnorisis or turn efficiency against `baseline_hidden_proofdebt`.
2. The improvement is not also reproduced by `field_report_only`.
3. Safety gates are not worse than baseline.
4. The field-planner trace explains the movement through pre-turn candidate projections and post-turn observed movement.

If `field_planner_enforce` improves completion but harms release adherence or leak discipline, treat it as a negative control result, not a success.

If `field_report_only` matches planner arms, the likely explanation is instrumentation or prompt-context change rather than planner control.

If `baseline_hidden_proofdebt` already solves all worlds with comparable efficiency, report a ceiling result and do not claim field-planner benefit.

## Audit Packet

For each run directory preserve:

- `result.json`
- `diagnosis.json`
- `transcript.md`
- `dialogue-report.json`
- `dialogue-report.md`
- `dynamic-field.svg`

For the full gate preserve:

- frozen command manifest
- code SHA
- world list
- seed list
- model stack
- generated matrix spec, if used
- aggregate CSV/JSON
- human-inspection packet with one success and one failure exemplar per arm

## Next Implementation Hook

Add a small gate runner only after the current runtime tests pass. It should:

1. Generate a frozen matrix from the arm/world/seed table.
2. Write a manifest before any live calls.
3. Run or resume each row idempotently.
4. Build an aggregate report from `diagnosis.json`, `result.json`, and `dialogue-report.json`.
5. Fail the gate if any safety condition fails.
