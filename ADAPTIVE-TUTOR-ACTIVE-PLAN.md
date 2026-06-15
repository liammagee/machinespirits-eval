# Adaptive Tutor Active Plan: A20 Entitlement-and-Repair Controller

Status: active planning note, 2026-06-15. This is a documentation-only
consolidation of the current derivation/adaptive-tutor trajectory. It does not
authorize new paid runs or replace the existing evidence ledgers.

Source notes:

- `adaptive-tutor-trajectory-analysis-note.md`
- `ADAPTIVE-TUTOR-GENERALIZATION-PLAN.md`
- `ADAPTIVE-TUTOR-BOUNDARY-PLAN.md`
- `LEARNED-ADAPTATION-PLAN.md`
- `DRAMATIC-RECOGNITION-PLAN.md`
- `exports/dramatic-derivation/same-turn-assertion-affordance-report.md`

## Board Allocation

`A19` is already occupied in the canonical paper by the teaching-drama axiom
scaffold and local stability screen. The entitlement controller should therefore
be tracked as `A20`.

There is an older sidecar HTML reference to `A20` as an EDRA policy compiler, but
that is not the active canonical board or paper allocation. In this plan, `A20`
means the entitlement-and-repair controller described below.

## Current Read

The latest results do not support the claim that the current H/V selector is a
successful adaptive representation selector. The stronger reading is:

- We have regulation, not yet robust adaptation.
- Hidden proof state and proofDebt are reliable substrates for proof continuity,
  especially under decay.
- Visible/conduct state is still real and sometimes necessary; it is not a
  dominated channel.
- Recognition pressure shapes discourse and local repair, but it is not by
  itself a success-rate lever.
- Same-turn assertion affordance is the first small entitlement-controller slice:
  it asks whether the tutor can invite closure once the proof has already become
  available, instead of continuing to perform caution.

The active hypothesis is:

> Adaptive tutoring is entitlement-regulated move selection over a consolidated
> proof board, with learner-visible conduct serving as evidence and proofDebt
> serving as constraint.

## Empirical Ledger

The older H/V selector work remains useful as evidence, but not as the next
implementation target.

- The selector should not be reported as an adaptive success unless it beats or
  matches simple policies and avoids negative transfer.
- H/V complementarity matters. Existing summaries include worlds where hidden
  wins and worlds where visible wins; hidden should not be described as simply
  strongest in general.
- Withercombe exposed a selector-risk pattern: the selector can choose visible
  while visible/selective underperform baseline/hidden under decay.
- Fengate/Sealhouse-style cases keep the hidden-positive lesson alive: hidden can
  preserve proof continuity when visible discourse is misleading or too brittle.
- Same-turn assertion affordance is a narrower question than selector choice: if
  proofDebt is low enough and the learner has enough public ownership, can the
  tutor stop repairing and invite the learner to assert?

## Immediate Gate

Do not broaden A20 until the current same-turn assertion affordance runs have
landed and been read.

Gate cases:

- Withercombe: tests whether the policy closes the earlier final-gap failure.
- Ravensmark: tests whether the policy introduces negative transfer in a
  visible-positive or mixed case.

If both are clean enough, the same-turn assertion affordance can be promoted as
an opt-in candidate layer for the overall derivation arm, with the flag recorded
in artifacts. If either fails, classify the failure before adding new controller
logic.

## A20 Minimal Design

A20 is not H/V selector v5, a learned-policy rerun, or a broad situation
taxonomy. It is a small controller layer between the proof ledger and the tutor's
public utterance.

Minimal controller loop:

1. Parse the learner's public move.
2. Update proofDebt.
3. Update learner entitlement state.
4. Classify only the local drama/rhetoric condition needed for the next move.
5. Select one typed move family before text generation.
6. Enforce allowed and blocked actions for that move.
7. Generate the tutor utterance.
8. Score local uptake at the next turn.
9. Save any learned axiom only if S1 beats S0 on held-out siblings.

Minimal entitlement distinctions:

- echoing versus owning
- local fluency versus proof entitlement
- hesitation versus contradiction
- repairable dependency gap versus final assertion gap
- recognition rupture versus ordinary uncertainty

Minimal move families:

- `invite_final_assertion`
- `block_assertion`
- `repair_dependency`
- `consolidate_subproof`
- `ask_diagnostic`
- `repair_recognition_rupture`

Move families should stay few. Add a family only when a failure cannot be
expressed by one of the existing families without hiding a real distinction.

## First Slices

Slice 0: same-turn assertion affordance.

This is already implemented as a narrow flag and is being validated. It should
remain the first proven A20 slice if the current runs hold.

Slice 1: dependency repair entitlement gate.

Design only until Slice 0 finishes. Candidate trigger: proofDebt says a
dependency is missing, while the learner's visible conduct shows ownership of a
nearby but insufficient local conclusion. The controller should repair the
dependency, not invite final assertion and not release unrelated evidence.

Slice 2: hidden-hurts / alternative-path fixture.

Design only. This is the clean test that prevents "always hidden" from becoming
an implicit policy. The world should allow a valid learner-owned route that is
not the authored hidden route. Predeclare that hidden-only proofDebt should
over-repair or block, while the controller should accept the alternative path
after checking it.

## Evaluation Unit

The unit should be local and trigger-based, not only final transcript quality.

For each trigger:

- source turn and trigger condition
- expected move family
- actual move family at trigger + 1
- blocked actions respected or violated
- learner uptake at trigger + 2
- final proof outcome

Primary comparison:

- S0: hidden + proofDebt baseline
- S1: hidden + proofDebt + A20 slice

Report:

- local move correctness
- final grounding
- negative transfer against S0
- artifacts, false triggers, and implementation failures
- held-out sibling transfer before admitting any policy memory

## Guardrails

- Keep the current selector unchanged for historical comparisons.
- Do not silently reclassify worlds after outcomes.
- Treat misroutes as evidence.
- Avoid taxonomy creep; prefer a shallow controller with explicit preconditions.
- Do not run paid arms without pre-registering the exact delta.
- Change one contour per slice.
- Keep source-of-truth empirical claims in `docs/research/paper-full-2.0.md`
  before spin-offs or sidecars inherit them.

## Next Action

After the current Withercombe and Ravensmark same-turn assertion runs finish,
write a short readout:

1. Did the flag close the expected final-gap failure?
2. Did it cause negative transfer?
3. Did any failure come from route choice, guard brittleness, implementation, or
   world instability?
4. Should Slice 0 become the first A20 controller component, or should it stay a
   local affordance only?

Only then decide whether to implement Slice 1.
