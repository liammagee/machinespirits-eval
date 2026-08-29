---
id: adaptive-tutor-canonical-kernel-contract
title: Declare the canonical adaptive-tutor kernel and adapter boundaries
status: done
type: infra
priority: P1
owner: claude
source: review
created: 2026-08-28
updated: 2026-08-28
verification: The current closed-loop adaptive kernel and each tutor-stub,
  derivation, and curriculum surface have one documented state-to-action-to-
  guard-to-realization-to-outcome contract; the stale canonical-plan claim is
  reconciled; focused seam tests prove adapters do not fork policy semantics.
claim_status: methods
links:
  notes:
    - ADAPTIVE-TUTOR-ACTIVE-PLAN.md
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
    - notes/2026-08-03-adaptive-causality-living-log.md
  code:
    - services/adaptiveTutor/graph.js
    - services/adaptiveTutor/actionPolicy.js
    - services/adaptiveTutor/interventionLedger.js
    - services/adaptiveTutor/outcomeObserver.js
    - services/adaptiveTutor/tutorStubActionAdapter.js
  items:
    - adaptive-curriculum-memory-controller
    - adaptive-eval-resume-and-shared-budget-scope
    - tutor-stub-unified-session-surface
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/851
tags:
  - adaptive-tutor
  - architecture
  - integration
  - methods
---

Turn the presently strongest closed-loop implementation into the explicit
kernel contract for adaptive tutoring. Treat tutor-stub, dramatic derivation,
and curriculum work as adapters or experimental surfaces around that contract,
not as separate policy engines.

## Acceptance

- Name the canonical kernel and its stable state, action, guard, realization,
  observation, and ledger interfaces.
- Reconcile or retire the self-declared canonical status in
  `ADAPTIVE-TUTOR-ACTIVE-PLAN.md` against the later Plan 2 implementation and
  adaptive-causality living log.
- Map every active surface to the kernel contract and identify any intentional
  experimental divergence explicitly.
- Add focused contract coverage at the seams where surface-specific adapters
  could otherwise fork policy, guard, or outcome semantics.
- Preserve historical cells and results unchanged; this is zero-call
  architecture and methods work, not new efficacy evidence.

- 2026-08-28 — Landed as `ADAPTIVE-TUTOR-KERNEL-CONTRACT.md`, with seam tests
  in `tests/adaptiveTutorKernelContract.test.js`. Zero paid calls; no cell,
  scenario, or stored result changed.
  - **Kernel named.** `services/adaptiveTutor/` is the canonical
    state → action → guard → realization → outcome-closure loop. The
    `state_policy_closed_loop` architecture gives each stage its own node
    (`close_previous_intervention`, `estimate_learner_state`,
    `select_pedagogical_action`, `validate_adaptation_contract`,
    `realize_tutor_utterance`, `verify_realization`,
    `persist_pending_intervention`, plus the staged-follow-up path), and 26
    cells (133–158) run it. The doc lists the stable entry point for each of
    the six interfaces and the four version stamps a caller binds to.
  - **Canonical claim reconciled, not deleted.** The three documents hold three
    scopes: `ADAPTIVE-TUTOR-ACTIVE-PLAN.md` is canonical for the *closed* A20
    conduct-policy arc and its reopening gate; `PLAN_4_0/2026-07-11-…` already
    asserted the kernel and is followed here; the adaptive-causality living log
    assesses evidence, by its own statement not production readiness. The older
    banner is scoped in place, so its closeout keeps authority without reading
    as authority over the kernel. `DOCS.md` now points at all three.
  - **Surfaces mapped.** Four adapters plus four analysis scripts call the
    kernel. The `services/dramaticDerivation/*` line and the tutor-stub
    response-policy, guard, light-adaptation and projection modules run their
    own policy with no kernel import — divergent by design, per PLAN_4_0's
    "testbed" and "experimental lab" framing, and now written down rather than
    implied. `services/curriculum/*` couples by configuration, not import.
  - **Sharpest seam recorded.** `services/blueprintActionContracts.js` runs the
    cycle with `validateProofReleaseOwnershipGate` unported and
    `repairRealization` withheld, both deliberate. The test pins both, so
    adopting the gate or widening the exclusion has to be argued.
  - **Seam coverage.** Node set and order for the closed loop; the tutor-stub
    adapter covers every action in the registry (so it stays a projection, not
    a second vocabulary); the four version stamps; the exact list of external
    kernel callers, so a new one has to be declared here and in the doc.
