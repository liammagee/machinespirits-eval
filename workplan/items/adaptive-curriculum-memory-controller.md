---
id: adaptive-curriculum-memory-controller
title: Evidence-anchored memory and curriculum adaptation controller
status: active
type: research
priority: P2
owner: codex
source: review
created: 2026-07-11
updated: 2026-08-31
branch: codex/action-outcome-memory-readiness
verification: "A versioned evidence-anchored memory and task controller reuses the archived task/mastery scaffolds, passes stale/contradictory/irrelevant-memory controls, and improves independent work or transfer rather than assisted closure alone on held-out worlds."
claim_status: planned
depends_on:
  - tutor-stub-multiworld-policy-replication
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
    - notes/2026-08-28-memory-controller-design-rewrite.md
    - docs/action-outcome-memory.md
    - docs/action-outcome-memory-readiness.md
  prs:
    - 895
  items:
    - layered-task-session-adaptation
tags:
  - adaptive-tutor
  - memory
  - curriculum
  - transfer
milestone: adaptive-tutor-evidence-v1
---

Design rewritten 2026-08-28 against current evidence:
`notes/2026-08-28-memory-controller-design-rewrite.md`. The original Phase-6
text (implement only after cautious learned ranking passes; memory entries
carry evidence, validity, supersession, contradiction and retrieval reasons;
stale memory as an explicit control) is superseded and kept below as history.

The killed prerequisite is dropped. This design fits no ranker and needs no
transition dataset, because the evidence says a learned or persisted layer
was never the missing piece.

**What the memory adds.** Nothing about the learner — §6.10 settled that the
simulated learner's interior is surface-determined and §6.13.18 that the
policy reconstructs its strategy from context every turn. The one quantity
absent from any single transcript is the tutor's own historical hit rate, per
action family, per detected condition, per world. After
`writing-pad-intervention-outcomes` (landed 2026-08-28) that raw material
exists where it did not in July.

**The shape.** Not a memory screen read before speaking; three arrivals at
the §6.15/§6.16 boundary say a persisted advisory block does not change
conduct however well authored. Instead a conditioned demotion: when the
existing within-dialogue detector fires condition C, the controller demotes
an action family in the candidate ranking for that turn only, where its
historical rate for (C, world) is below a registered floor at registered
minimum support. Nothing enters a prompt. The memory changes which candidates
are available at the moment of choice — the seam §6.12.4 showed is
load-bearing, and the one §6.16 licensed as a successor.

**Controls.** Stale memory is the *first* control, not a robustness note:
§6.15 measured that action-shaped signals get uptake even when stale, because
compression detaches an imperative from its precondition, and a demotion is
an imperative. Then a memory scramble (permute the condition-to-family
association, holding schema, support and marginal rates intact — the analogue
of `policy.state_scramble`), a contradictory-record arm, and an abstention
floor below minimum support that must be visible in the trace.

**Endpoint.** Unassisted improvement and transfer on held-out worlds, scored
by the outcome-only machine check rather than a rubric. Assisted closure is
not admissible.

**Discriminating prediction.** Treatment beats control on held-out worlds;
scramble does not, at a registered margin; stale and contradictory sit at or
below control. If treatment and scramble move together the controller is a
demotion-step artifact and the line closes. If nothing moves, that is the
fourth independent arrival at the same boundary from the one direction not
yet tried, and it should be written up as a general result rather than probed
again.

## Superseded Phase-6 text (history)

Implement Phase 6 only after within-dialogue adaptation and cautious learned
ranking pass. Memory entries require evidence, validity, supersession,
contradiction, and retrieval reasons; stale memory must be an explicit control.

## Log

- 2026-08-31: After PR #895 merged, user authorized the next zero-call
  readiness slice in a fresh worktree. Added a strict trace-to-memory adapter,
  private create-once coverage report, and disabled/current/stale/scrambled
  selector replay. Typed decisions now record their actual pre-output selector
  input and condition quantities without enabling memory or making a call.
  Auxiliary outcome/delivery checks remain auxiliary: without a matching saved
  human review the exported outcome is measurement-indeterminate; disagreement
  stays indeterminate. Missing historical fields are reported, never backfilled.
  Source inventory: 36 local default JSONL traces (8,148 events) and the exact
  120 final-selected register-confirmatory traces (53,446 events), with both
  sealed archive data hashes verified. Neither set contains typed-action
  decisions or closed typed-action outcomes; no usable memory records or real
  replay comparisons result. Six local resume/history-clear files require
  complete lineage; archive inventory has no quarantined files. Private reports
  are under the readiness worktree's `.test-tmp/readiness-local-default-traces/`
  and `.test-tmp/readiness-step2-complete-report/`. The initial Terra-only
  inventory is retained separately; the completed report includes both families.
  No model calls, source-data changes, study registration, or live enablement.
  Research acceptance remains open; prospective compatible collection and
  independent unassisted/transfer endpoints are still required.
  Verification: 212 focused tests passed across memory readiness, memory,
  adaptation policy, intervention ledger, scaffold lifecycle, typed-action
  adapter/restoration, response context, warrant, and turn orchestration.
  After final strict-join and ledger-timing validation changes, the 37 memory
  and readiness tests passed again. Targeted ESLint, test-manifest, source
  check (575/575), and diff checks passed. The live tutor benchmark is not
  run: this slice only records additional pre-action provenance and performs
  offline analysis; existing callers still do not enable memory. The scoped
  benchmark-hook exception preserves this zero-call boundary; ordinary lint
  and CI checks remain enabled.

- 2026-08-31: User authorized the bounded zero-call engineering slice in a
  separate worktree, based on the read-only scope review. Implemented a
  supplied, default-off action-outcome evidence view and typed-action demotion
  hook; no database ingestion, live enablement, curriculum scheduling, or model
  calls. Scope and interfaces: `docs/action-outcome-memory.md`. The August
  rewrite's populated-data and independent-endpoint assumptions are not met by
  the current default Writing Pad store or the single-world Step-2 artifacts.
  Exact-world lookup abstains on unseen worlds; held-out pooling is explicit,
  preserves world disagreement, and cannot consume evaluation-world records.
  Thresholds are caller-supplied test settings, not measured or registered
  study criteria. This card remains active/planned: engineering acceptance
  does not complete its independent-improvement/transfer verification.
  Verification after rebasing onto current main: 197 focused tests passed
  across the memory, adaptation-policy,
  intervention-ledger, scaffold, typed-action, response-context, warrant, and
  turn-orchestration boundaries; targeted ESLint/Prettier, import-cycle check,
  test-manifest check, source check (575/575), and diff check passed. Mock
  delivery displacement cancels outcome credit; measurement disagreement
  remains indeterminate and stops the affected lookup. Real model calls: 0.
  Full CI is selected for the PR; no browser surface lane is selected.
  User then asked to continue through the branch/PR handoff. Final review
  tightened canonical action identity checks so inherited object names cannot
  enter evidence or penalty maps. The live tutor benchmark is not run:
  this remains a default-off, dependency-only zero-call slice with no change
  enabled in existing callers. Research acceptance remains open.

- 2026-08-27: Reopened for reexamination on operator instruction. The card
  was blocked on a killed prerequisite (the learned transition-ranking
  model), and the reexamination question is whether the controller needs
  that prerequisite at all. What we now know cuts both ways: adaptivity
  gains come from new signal the model cannot infer, not from re-encoding
  what it already infers; the delivered-move studies show value lives in
  machinery that issues the right move at a detected moment, not in a
  learned layer; and the Writing Pad already records intervention use but
  never the outcome (see `writing-pad-intervention-outcomes`). First step
  is zero-call: rewrite this card's design against the current evidence —
  what signal a cross-dialogue memory would add, what would count as the
  stale/contradictory-memory control, and what endpoint would show
  unassisted improvement — before any build or run.
- 2026-08-28: Design rewritten zero-call, no build and no run, per the
  2026-08-27 reexamination instruction. Full note:
  `notes/2026-08-28-memory-controller-design-rewrite.md`.
  Answers the three questions the instruction posed. Signal: the tutor's own
  per-condition, per-world action hit rate, which no single transcript can
  contain, now recorded by the intervention-outcome marks that landed the same
  day. Controls: stale first (§6.15 measured stale action-shaped uptake), then
  scramble, contradiction, and an abstention floor. Endpoint: outcome-only
  unassisted improvement and transfer on held-out worlds.
  The prerequisite `tutor-stub-transition-reward-model` is dropped from
  `depends_on` — it closed as killed, and this design needs neither a ranker
  nor a transition dataset.
  One uncomfortable finding is carried in the open rather than argued away:
  §6.12.4's closure-off arm preserved strict shift, so the intervention-outcome
  ledger already fails to change action selection inside a dialogue. A
  cross-dialogue memory built on the same outcomes inherits that burden, which
  is why the design is the narrowest testable shape and why the scramble margin
  is registered in advance.
  Still needs, before anything runs: a registration under
  `docs/paid-study-authorization-policy.md` with arms, worlds, sizing against a
  measured base rate, floors, ceilings and claim boundary.
