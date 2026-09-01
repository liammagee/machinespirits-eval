# Adaptive Tutor Kernel Contract

Status: canonical kernel contract, 2026-08-28. This names the one adaptive
tutoring kernel, its stable interfaces, and every surface that sits around it.
It is an architecture and methods document. It authorizes no paid run, changes
no cell, and reinterprets no historical result.

Workplan item: `adaptive-tutor-canonical-kernel-contract`.

## Why this exists

Adaptive tutoring policy is written in more than one place in this repo, and
until now nothing said which one was the kernel. The strongest closed-loop
implementation had grown into `services/adaptiveTutor/` without ever being
declared as such, while `ADAPTIVE-TUTOR-ACTIVE-PLAN.md` still carried a
"canonical active plan" banner from a different, closed arc. A new surface
could therefore fork action selection, the guard, or outcome observation
without anyone having to argue for it.

The kernel below is not new. This document names what already runs, and adds
tests at the seams where an adapter could quietly grow a second policy.

## The kernel

`services/adaptiveTutor/` is the canonical state → action → guard →
realization → outcome-closure kernel. `PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md`
already asserted this ("The canonical within-dialogue control kernel will be
the existing Plan 2.x stack in `services/adaptiveTutor/`"); this document is
where the claim becomes checkable.

Its clearest expression is the `state_policy_closed_loop` architecture in
`services/adaptiveTutor/graph.js`, which gives each stage of the contract its
own named node. 26 cells run it today (`cell_133` … `cell_158`).

### The six interfaces

Each interface is one stage of a turn. The node name is the contract; the
module behind it is the implementation.

| Stage | Node in the closed loop | Module | What it owns |
|---|---|---|---|
| Observation | `close_previous_intervention` | `outcomeObserver.js` | Reads the learner's reply for evidence that the last intervention landed |
| Ledger | `close_previous_intervention`, `persist_pending_intervention` | `interventionLedger.js` | Opens, closes and carries intervention records across turns |
| State | `estimate_learner_state` | `actionPolicy.js` | Builds the learner-state belief from dialogue and ledger |
| Action | `select_pedagogical_action` | `actionPolicy.js` | Scores and selects one of the 20 typed actions |
| Guard | `validate_adaptation_contract` | `proofReleaseOwnershipGate.js`, `actionPolicy.js` (world spec, policy layer) | Refuses or repairs an action, then seals the contract |
| Realization | `realize_tutor_utterance`, `verify_realization` | `realizationVerifier.js`, `tutorStubActionAdapter.js` | Turns the action into an utterance and checks it kept the action |

The staged follow-up path (`realize_staged_followup`) is part of the loop, not
an exception to it: it delivers a follow-up already committed by an earlier
turn's contract.

### Stable entry points

Callers should reach the kernel through these, and nothing deeper:

- **State** — `estimateLearnerStateBelief({ dialogue, interventionLedger, turnIndex, maxHypotheses, config })`
- **Action** — `selectPedagogicalAction({ stateBelief, interventionLedger, mode, config })`
- **Guard** — `validateProofReleaseOwnershipGate({ stateBelief, selectedAction, candidateActions, interventionLedger, config })`, plus `applyWorldAdaptationToAction` and `applyAdaptationPolicyLayerToAction`
- **Contract** — `createAdaptationContract({ … })`, `updateContractRealizationChecks(…)`
- **Realization** — `verifyRealization(…)`; to lower an action onto tutor-stub's axes, `adaptPedagogicalActionToTutorStub(…)` and `buildTutorStubTypedActionDecision(…)`
- **Observation** — `observeInterventionOutcome({ pendingIntervention, learnerTurn, turnIndex, config })`
- **Ledger** — `appendPendingIntervention(ledger, contract)`, `closePendingIntervention({ ledger, learnerTurn, turnIndex, observer, config })`

Four version stamps mark the semantics a caller is binding to:
`ADAPTATION_ACTION_REGISTRY_VERSION`, `ADAPTATION_POLICY_LAYER_VERSION`,
`INTERVENTION_LEDGER_VERSION`, `OUTCOME_OBSERVER_VERSION`. Changing what any
of them means is a deliberate edit, and the seam test makes it visible.

## Reconciling the older canonical claim

`ADAPTIVE-TUTOR-ACTIVE-PLAN.md` opens with "canonical active plan, 2026-06-15".
It is not retired, and it is not the kernel's authority. Read together:

- It is the **A20 conduct-policy compiler** arc, and its own second section
  records that arc as `Closed / Not Promoted`. It is canonical for that arc's
  closeout and for the reopening gate it sets, and dormant since 1 July.
- `PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md` (2026-07-11) is
  the live claim about which **implementation** is canonical, and names the
  kernel above.
- `notes/2026-08-03-adaptive-causality-living-log.md` is the live claim about
  **evidence**, and says so itself ("an assessment of the evidence boundary,
  not a production-readiness claim").

So: closed arc, live implementation claim, live evidence claim — three
documents, three scopes, no contest. The banner in `ADAPTIVE-TUTOR-ACTIVE-PLAN.md`
is scoped in place rather than deleted, so its closeout keeps its authority
without reading as authority over the kernel.

## Surface map

Every surface below is placed against the kernel. "Adapter" means it calls the
kernel and adds only lowering or transport. "Divergent" means it runs its own
policy on purpose; each divergence is named here so it stays a choice.

### Adapters — call the kernel

| Surface | Uses |
|---|---|
| `services/tutorStubTypedActionAssignment.js` | Policy-eligible action support, then prospective family-first assignment among those eligible actions |
| `services/tutorStubTypedActionPlanningRuntime.js` | The main tutor-stub bridge: state, action, contract, ledger, both adapter builders |
| `services/tutorStubTypedActionRestoration.js` | Ledger only, to restore a session |
| `services/learnerTutorInteractionEngine.js` | Ledger only, plus the observer version stamp |
| `services/adaptiveTutor/tutorStubStateAdapter.js` | State plus evidence analysis |
| `scripts/evaluate-adaptation-policy.js`, `scripts/analyze-adaptation-outcome-closure.js`, `scripts/run-character-dag-drama-framework.js`, `scripts/run-dag-resistance-comparison.js` | Offline analysis over kernel functions; no policy of their own |

### One declared partial adapter

`services/blueprintActionContracts.js` runs the select → contract → verify →
close cycle as plain per-turn calls for the standard-runner blueprint path, and
records two deliberate exclusions in its own header:

- `validateProofReleaseOwnershipGate` is **not** ported, because suggestion and
  resistance scenarios carry no machine-checkable proof state. Every contract
  it writes carries the default allowed gate result.
- `repairRealization` is **not** applied. Realization checks are recorded for
  analysis and never mutate the tutor's message, because the blueprint claim
  discipline wants observation before enforcement.

This is the sharpest seam in the repo: a partial adapter whose gate is a no-op
by design. The seam test pins both exclusions, so adopting the gate — or
quietly widening the exclusion — has to be an argued edit.

### Divergent by design — own policy, no kernel import

These are experimental surfaces, not adapters. None of them imports the kernel's
policy, ledger, or observer.

| Surface | Its own policy |
|---|---|
| `services/dramaticDerivation/conductPolicy.js`, `fieldPlanner.js`, `adaptationArbiter.js`, `discursiveAdaptation.js`, `rhetoricalMovePolicy.js`, `guardCompiler.js`, `registerRouter.js` | A parallel move taxonomy, planner, arbiter and guard compiler for the derivation testbed |
| `services/tutorStubAdaptiveResponsePolicyRuntime.js`, `services/tutorStubResponsePolicy.js`, `services/tutorStubPolicySampler.js` | Tutor-stub's own register and response scoring |
| `services/tutorStubLightAdaptation.js` | A second, regex-based outcome observer |
| `services/tutorStubResponseGuard.js`, `tutorStubWarrantGate.js`, `tutorStubGuard*.js` | Tutor-stub's own leak and warrant guards |
| `services/tutorStubOutcomeRows.js`, `services/tutorStubPedagogicalMoveProjection.js` | Own closure counting; a shadow projection that says the warrant decision stays authoritative |

Per `PLAN_4_0`, the derivation line is a "formal move-selection and proof-safety
testbed", and tutor-stub is a "low-cost experimental lab" — neither is the
production controller. Keeping them outside the kernel is the point; what this
document adds is that the divergence is now written down rather than implied.

### Not a policy surface

`services/curriculum/*` compiles content and emits a
`world_adaptation_spec` that the kernel consumes. It couples to the kernel by
configuration, not by import, and holds no policy of its own.

## What the seam tests check

`tests/adaptiveTutorKernelContract.test.js`, offline and free:

1. The closed loop declares one node per stage, in contract order, so a new
   architecture cannot skip the guard or the ledger and still be called closed.
2. Every action in the kernel registry has a tutor-stub move family and a
   support level, so the adapter stays a projection of the registry rather than
   a second action vocabulary.
3. The four version stamps are pinned, so a change to action, policy-layer,
   ledger or observation semantics is visible in the diff.
4. The list of modules importing the kernel's policy, ledger, or observer is
   the list in this document, so a new caller has to be declared here.
5. `blueprintActionContracts.js` still declares its two exclusions.

None of this checks that the policy is *good*. It checks that there is one
policy, and that the places allowed to differ say so.
