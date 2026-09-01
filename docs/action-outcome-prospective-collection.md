# Prospective action-outcome collection

Workplan item: `adaptive-curriculum-memory-controller`.

This zero-call engineering contract closes the action-selection gap between the
typed-action runtime and the human-review packet. It does not register or launch
a model-backed collection, choose scientific conditions or thresholds, or test
whether action-outcome memory improves learning or transfer.

## Why ordinary policy traces are insufficient

The ordinary typed-action policy chooses one action deterministically from the
current public learner state. Outcomes collected under that policy are useful
operational history, but action families see different learner states by
construction. Comparing their raw hit rates would therefore mix action outcome
with policy selection. A deterministic propensity of one does not create the
overlap needed to distinguish those quantities.

The memory controller aggregates the five tutor-stub move families, so the
prospective collection unit is a **move family**, not an individual action.
Sampling actions uniformly would overrepresent a family whenever it contributes
several eligible action types.

## Collection assignment contract

The tutor CLI now accepts this default-off assignment mode alongside the existing
typed-action task and support axes:

```text
--typed-actions
--typed-action-assignment uniform_family_eligible
--typed-action-support-level <0..3>
--typed-action-task-id <stable-id>
--typed-action-knowledge-component <text>
--run-seed <integer>
--eval-repeat <integer>
--eval-job-id <stable-id>
```

This is only the relevant flag shape. It is not a complete launch command or an
authorization to call a model.

At each turn the runtime:

1. estimates the public learner state and applies the existing world and scaffold
   gates;
2. preserves mandatory diagnostic or escalation authority with probability one;
3. on an assignable turn, draws uniformly among represented eligible move
   families;
4. draws uniformly among the eligible action types inside the selected family;
5. realizes the assigned action through the existing response-configuration and
   guard path; and
6. closes the action against the next public learner observation.

The selected-family propensity is `1 / eligible families`. The selected-action
propensity is that family propensity multiplied by `1 / eligible actions in the
selected family`. The trace records the baseline policy action, eligible actions
grouped by move family, both deterministic draws, both probabilities, the chosen
action, and the seed material. Repeating the same run seed, profile, repeat, turn,
and job identity reproduces the draw.

Fixed support is required so an assigned family does not silently change the
assistance level. Register, task, support, world constraints, scaffold phase,
release rules, guards, and public-output audits remain separate axes. A guard that
displaces the assigned action cancels the intervention before delivery; its next
learner turn cannot be credited to the requested action.

## Evidence admission

`action-outcome-memory-readiness` validates the saved family and action draws,
candidate membership, family mapping, propensities, selected action, and replayed
seed record. Tampered or internally inconsistent assignment provenance is
excluded as `invalid_prospective_assignment`.

The readiness row reports one of these assignment states:

- `seeded_uniform_family_assignment`: eligible for prospective binary memory
  evidence after valid human review;
- `mandatory_policy_authority_preserved`: retained for audit, but not an
  exchangeable family assignment;
- `policy_selected` or `not_recorded`: deterministic or historical selection,
  retained for audit.

The standard two-coder packet accepts only the first state. Even if a separate
human review is supplied directly, deterministic, mandatory, or unrecorded
selection remains `measurement_indeterminate` with status
`nonrandomized_assignment`; it cannot become binary memory support. Human and
auxiliary disagreement remains indeterminate under the existing rule.

## Zero-call preflight evidence

The focused tests exercise a real `scripts/tutor-stub.js` process with a fake
local CLI executable. Three turns traverse CLI parsing, launch configuration,
seeded assignment, response realization, trace persistence, and next-turn outcome
closure without contacting a provider. Separate tests replay both assignment
draws, preserve mandatory authority, reject a corrupted draw, and complete the
trace-to-packet-to-review-importer handoff.

This proves the collection plumbing. The fake dialogue does not establish real
condition prevalence, delivery fidelity, outcome rates, coder agreement, usable
support per family, or expected cost.

## Registered pilot design

The complete prospective design is
`config/tutor-stub-action-outcome-collection-pilot-design.v1.json`. It fixes one
nonoverlapping stalled-state condition, the four collection worlds and two later
evaluation worlds, the maintained `bored` learner population, the Luna model
stack, an eight-turn horizon, fixed support and register, 24 job identities and
their seed schedule, two private human-coder seats, feasibility thresholds,
create-once destinations, technical dispositions, and a hard ceiling of 1,944
model-call reservations.

The design is not launch authority. Under
`docs/paid-study-authorization-policy.md`, it must first merge to `main`; a later
launcher must use the shared paid-study contract from a clean detached launch
commit, and a separate signed GO note must name that commit, design path, and
ceiling. No GO note or launcher is part of this slice.

The collection pilot must report mandatory versus assigned turns, eligible-family
sets, family and action propensities, delivered/displaced actions, conditions,
review dispositions, and usable binary records. Its outputs may size a later
controller study. They are not that study's outcome, and the action-outcome
memory controller remains disabled throughout collection.
