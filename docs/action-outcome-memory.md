# Action-outcome memory: zero-call engineering slice

Workplan item: `adaptive-curriculum-memory-controller`.

This implements a supplied evidence view and a default-off action-demotion
hook. It does not collect a training corpus, enable a live controller, alter
curriculum scheduling, or establish learner improvement. There is no model
call, database access, CLI switch, or automatic memory update in this slice.
The August design rewrite remains the research motivation; this document
describes the narrower engineering interface and its limits.

## Evidence interface

`services/adaptiveTutor/actionOutcomeMemory.js` exports:

- `buildActionOutcomeMemory(records, { asOf, source, excludedWorldIds,
excludedDialogueIds })`: copy and normalize supplied observations, exclude
  unusable records, resolve explicit corrections, and return a frozen view
  with per-condition/world/family/support counts and exclusions.
- `planActionMemoryDemotions(memory, context, candidates, policy)`: return
  numeric penalties or explicit abstention, plus the evidence used.
- `scrambleActionOutcomeMemory(memory, conditionPermutation, { source })`:
  apply a caller-supplied permutation of observed condition labels while
  preserving observations, family labels, support, and marginal outcomes.

Every observation has:

| Field                                       | Meaning                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                                        | Unique evidence-record identifier; repeats do not create support.                               |
| `dialogueId`, `contractId`                  | Identity of the intervention being observed.                                                    |
| `worldId`, `conditionId`, `contextKey`      | World, pre-action detected condition, and compatible instrument/population context.             |
| `actionType`                                | Canonical adaptive action type; the existing adapter derives its move family.                   |
| `supportLevel`                              | Explicit support level, matched exactly at lookup.                                              |
| `decisionTurn`, `observationTurn`           | The latter must be the next public learner turn.                                                |
| `observedAt`, `recordedAt`                  | Observation time and the time its label became available; both must precede the cutoff.         |
| `status`, `delivery`, `deliveredActionType` | Must be `closed`, `delivered`, and the selected action type.                                    |
| `outcome`                                   | `success`, `failure`, `partial`, `inconclusive`, or `measurement_indeterminate`.                |
| `supersedes`                                | Optional explicit correction references for the same intervention, with a later recording time. |

The caller must establish these facts from source evidence. In particular,
`delivery: delivered` is not itself a delivery verifier. Join the selected
action and next-turn observation with the final delivered response, guard
overrides, and delivery audit before supplying a record. A planned action
displaced before delivery must not receive the replacement action's outcome.
The existing typed-action decision/outcome events and final turn records are
the source interfaces; this slice does not invent missing historical fields
or import Writing Pad counters as equivalent evidence.

`contextKey` must identify compatible model routes, learner source, task
class, condition definition, and outcome instrument. It is ordinary data
provenance, not a code digest or an authorization gate. The module compares
it exactly; it cannot infer whether a caller has assigned it correctly.

Only success and failure contribute to binary support. Partial and
inconclusive outcomes remain visible. Measurement disagreement is retained as
`measurement_indeterminate` and stops the affected lookup. Minimum dialogue support counts distinct
dialogues, not repeated turns. Rates themselves are observation-weighted;
they are descriptive uptake associations, not causal effects or independent
learning scores. Heterogeneous support, selection bias, and outcome-label
validity still require study design and data review.

## Decision boundary

`createTutorStubTypedActionPlanningRuntime()` accepts an optional
`actionOutcomeMemory` dependency containing `snapshot`, `contextKey`,
`condition`, and `policy`, and an injectable `now()` clock. Existing callers
supply none, so ordinary runtime behavior remains unchanged.

The condition has an `id` and explicit `stagnationAtLeast`,
`fieldVelocityAtMost`, and `dagVelocityAtMost` settings. It reads the existing
public classification/DAG trajectory quantities; missing observations do not
count as stagnation. The three numerical settings have no defaults.

The policy explicitly supplies `enabled`, `scope`, `minObservations`,
`minDialogues`, `successFloor`, `penalty`, and `maxAgeMs`:

- `exact_world` matches only the current world. An unseen world abstains.
- `held_out_world` pools other worlds and additionally requires `minWorlds`.
  Any record from the evaluation world invalidates this lookup. There is no
  implicit fallback from exact-world to pooled evidence. Opposing world-level
  associations around the supplied floor cause abstention.

There are no empirically selected defaults for support, age, or effect
thresholds. Numbers in tests are synthetic fixtures only. Current-dialogue
records, future snapshots, stale observations, unresolved contradictions,
incompatible contexts, and insufficient support cannot trigger a demotion.

The planner first computes the existing candidate set, then supplies any
penalties through `actionPolicy.js`'s `actionUtilityPenalties`. Penalties can
only reduce utility. World/scaffold restrictions, mandatory diagnosis, and
required prerequisite escalation retain authority. Fixed explicit support is
required so a family change does not silently change assistance. Task and
register selection remain unchanged. Later warrant, closure, release, and
delivery guards are not bypassed.

A separate `tutor_action_outcome_memory` event records the contract identity,
condition quantities, lookup, support, abstention, penalties, baseline action,
and selected action. Candidate traces retain base and adjusted utilities.
The event precedes output and is not proof of delivered behavior; downstream
override records remain authoritative. Memory evidence and penalties are not
inserted into the selected action's realization rationale or prompt context.
Tutor/learner labels and scoring structures are unchanged.

## Controls and remaining research work

Stale memory is the first control: supply an old snapshot, and ensure expired
observations cannot become current just because a recent observation was added.
Scramble uses an explicit condition permutation, not a new model call.
Contradictory labels for the same intervention force abstention unless an
explicit later correction supersedes them. Ordinary successes and failures
from different interventions are variable evidence, not contradictions.
Irrelevant memory and low-support cases also abstain visibly.

These tests establish software behavior, not the outcomes of control arms.
Before any prospective study, obtain a compatible corpus and define exposure,
independent endpoints, held-out worlds, sample size, thresholds, dispositions,
and spend. A stale comparison needs actual changed conditions; a scramble
comparison must account for different demotion frequencies.

Independent improvement needs an unassisted assessment after support withdrawal;
transfer needs separate tasks/worlds excluded from the memory source. Immediate
uptake, assisted closure, curriculum phase labels, and machine aggregation over
an LLM-extracted record do not substitute for those endpoints. This work supplies
neither a study registration nor a model-backed execution authorization.

## Focused verification

The new `tests/actionOutcomeMemory.test.js` exercises evidence exclusions,
supersession, stale/scrambled/conflicting controls, support and world isolation,
mandatory-action preservation, a real change at the mock decision boundary,
disabled equivalence, fixed support, and absence from prompt projection.
Adjacent action-policy, ledger, scaffold, typed-action, and response-context
tests cover the existing boundaries. No paid execution is needed.
