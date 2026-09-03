---
id: adaptive-curriculum-memory-controller
title: Evidence-anchored memory and curriculum adaptation controller
status: active
type: research
priority: P2
owner: codex
source: review
created: 2026-07-11
updated: 2026-09-03
branch: claude/action-outcome-judge-v2
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
    - docs/action-outcome-human-review.md
    - docs/action-outcome-prospective-collection.md
    - config/tutor-stub-action-outcome-collection-pilot-design.v1.json
    - config/tutor-stub-action-outcome-prospective-redesign.v1.json
    - notes/2026-09-01-action-outcome-prospective-redesign.md
    - config/tutor-stub-action-outcome-comparable-collection-design.v2.json
    - services/tutorStubActionOutcomeComparableCollection.js
    - services/tutorStubActionOutcomeCollectionPilot.js
    - services/tutorStubActionOutcomeProspectiveRedesign.js
    - scripts/check-tutor-stub-action-outcome-prospective-redesign.js
    - scripts/run-tutor-stub-action-outcome-collection-pilot.js
    - notes/2026-09-01-tutor-stub-action-outcome-collection-pilot-go.md
    - notes/2026-09-02-tutor-stub-action-outcome-comparable-collection-v2-go.md
    - config/tutor-stub-action-outcome-failed-unit-recovery.v1.json
    - notes/2026-09-02-tutor-stub-action-outcome-failed-unit-recovery-go.md
    - docs/durable-evaluation-execution-contract.md
    - notes/2026-09-02-action-outcome-recovery-horizon-incident.md
    - config/tutor-stub-action-outcome-model-judge-shadow-design.v1.json
    - config/tutor-stub-action-outcome-model-judge-codebook.v1.md
    - services/tutorStubActionOutcomeModelJudge.js
    - scripts/run-tutor-stub-action-outcome-model-judge-shadow.js
    - notes/2026-09-02-tutor-stub-action-outcome-model-judge-shadow-go.md
    - notes/2026-09-03-action-outcome-model-judge-divergence-diagnosis.md
    - config/tutor-stub-action-outcome-model-judge-shadow-design.v2.json
    - config/tutor-stub-action-outcome-model-judge-codebook.v2.md
    - scripts/rescore-tutor-stub-action-outcome-model-judge-shadow.js
  exports:
    - exports/action-outcome-collection-pilot/2026-09-01-zero-call-quality-audit/README.md
    - exports/action-outcome-model-judge-shadow/2026-09-02/README.md
    - exports/action-outcome-model-judge-shadow/2026-09-02-quote-normalized-rescore/README.md
  prs:
    - 895
    - 898
    - 899
    - 901
    - 902
    - 903
    - 905
    - 906
    - 908
    - 913
    - 932
    - 937
    - 940
    - 945
    - 946
    - 947
    - 948
    - 949
    - 951
    - 952
    - 955
    - 958
    - 959
  items:
    - layered-task-session-adaptation
    - durable-evaluation-runner-migration
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

- 2026-09-03: Diagnosed the Opus-Sol outcome split and prepared revision 2 of
  the shadow instrument on branch `claude/action-outcome-judge-v2`, with zero
  model calls. Three causes. First, the packet is stall reports: 23/35 learner
  replies say the learner stopped before the step, and the v1 codebook has no
  stall rule. Sol read the absence of the step as `failure` in six cases and an
  echoed tutor step as `success` in two, all at high confidence; Opus applied
  the literal "absence is not failure" rule and said `inconclusive`. Second,
  the validator compared quotations byte for byte, so two Opus rows that wrote
  a straight apostrophe for the packet's curly one were voided. Third, both
  seats ran at low effort. Changes: codebook v2 adds a stall-report rule (a
  stall with no forbidden evidence is `inconclusive`; an echoed step is not
  learner-authored application), a confidence definition, and the quotation
  tolerance; the validator now maps curly apostrophes and quotation marks to
  straight ones before matching and records when it did so; design v2 runs
  both seats at medium effort with new order seeds and is otherwise identical
  to v1. Re-scoring the archived v1 responses under the new validator
  (`scripts/rescore-tutor-stub-action-outcome-model-judge-shadow.js`; public
  copy at
  `exports/action-outcome-model-judge-shadow/2026-09-02-quote-normalized-rescore/README.md`)
  recovers both voided Opus rows: paired valid cases 33 to 35, joint exact
  17/33 to 18/35, paired indeterminacy 27 to 26, binary records unchanged at
  5. The apostrophe fix alone does not move the verdict. The codebook and
  effort changes need a paid v2 run (70 calls) under a new GO note; this entry
  licenses nothing. Expected direction: the six Sol-failure/Opus-inconclusive
  and two Sol-success/Opus-inconclusive splits should close toward
  `inconclusive`, which raises joint agreement but not binary yield, because a
  stall-report packet holds few binary outcomes to find. Diagnosis with case
  ids and the label cross-tab (no case text):
  `notes/2026-09-03-action-outcome-model-judge-divergence-diagnosis.md`. Full
  re-score rows are in the private archive under
  `artifacts/tutor-stub-live/rescores/`.

- 2026-09-02: Completed the registered 35-case Opus-Sol shadow semantic
  judgment with exactly 70/70 reservations, 70 completed calls, no failed or
  missing units, and no retries. Protocol validity passed at 35/35 for Sol and
  33/35 for Opus. Delivery judgment was reproducible (30/33 exact, 90.9%,
  Cohen's kappa 0.791), while learner-outcome judgment was not (17/33 exact,
  51.5%, kappa 0.361). The pair left 27/35 cases measurement-indeterminate and
  produced only five exact-consensus binary records against the registered
  minimum of 24; every one was a failure, and no move family reached its
  minimum of six. The diagnostic therefore closed as
  `exploratory_model_pair_failed`. This shows that a model pair can automate
  delivery recognition much more readily than learner-outcome recognition; it
  does not justify substituting model consensus for the human construct anchor.
  The frozen source packet and both human templates remained unchanged. Public
  aggregate report:
  `exports/action-outcome-model-judge-shadow/2026-09-02/README.md`. The original
  human gates remain pending, and the controller study is not licensed.

- 2026-09-02: After PR #955 merged the bounded shadow-judgment design at
  `1ee6323ae5fb7ac7e6148c17e768924f06cd6d1e`, recorded the operator's direct
  "good, do it" instruction as the study-level GO note. It licenses exactly 70
  non-retried low-effort calls: one Sol and one Opus judgment for each of the 35
  frozen public cases, under the shared create-once ledger and the unchanged
  exploratory claim boundary. The note does not authorize human-label
  fabrication, model-result substitution into the human seats, source changes,
  memory enablement, or controller evaluation. Recording this note makes zero
  model calls.

- 2026-09-02: Registered the operator-requested Opus-Sol shadow semantic
  judgment before either model saw the frozen 35-case packet. The separate lane
  gives `codex.gpt-5.6-sol` and `claude-code.opus-5` one isolated low-effort
  call per case, with no retries, 70 planned calls, and a hard ceiling of 70
  attempt reservations. Prompts expose only the auxiliary-blind public case and
  require exact quotations for delivery and outcome labels. The machine key is
  used only after judgment for family, world, and frozen-auxiliary comparison;
  both original human submission templates are hash-checked before and after
  execution and never populated. The report measures protocol validity, exact
  agreement, Cohen kappa, paired indeterminacy, binary yield, and disagreements.
  Passing is exploratory evidence for a future model-first measurement design;
  it does not satisfy the v2 human gates, validate the construct, or license the
  controller. This registration and its tests make zero model calls.

- 2026-09-02: Completed the exact three-dialogue recovery at the registered
  eight-turn horizon. The fresh worker used 34 reservations; together with the
  sealed interrupted predecessor the recovery segment used 52/100, comprising
  51 completed and one interrupted attempt with zero unexplained. A zero-call
  packaging failure then exposed 22 valid latest-recovery rows whose relative
  trace paths had no explicit `artifact_root`. Added a source-report-directory
  fallback and regression coverage, finalized a 60/60-dialogue, 480/480-turn
  corpus with no turn above eight, and ran the unchanged zero-call audit. All
  execution and coverage gates pass: 35 condition-matched comparative cases,
  27 contributing dialogues, four worlds, and 34 visible deliveries. The
  verdict is `pending_human_review` only on the five registered coder gates. A
  fresh auxiliary-blind packet provides 35 cases each to `coder-a` and
  `coder-b`; no human labels have been fabricated.

- 2026-09-02: The first three-dialogue recovery exposed a resume-boundary defect:
  orchestration correctly supported a total eight-turn horizon, but the
  noninteractive application did not receive the resumed-dialogue object and
  selected eight additional turns. The operator stopped it after 18 dispatch
  reservations: 17 completed and one interrupted. The raw trace is preserved;
  completed turns 5 through 8 are accepted without redispatch, while turns 9
  and 10 are excluded from the registered corpus. Permanent controls now derive
  resume mode from the actual CLI request, enforce the maximum turn again at
  the shared provider-dispatch ledger, reconcile and count killed per-dispatch
  attempts before recovery, and test both public boundaries. Incident record:
  `notes/2026-09-02-action-outcome-recovery-horizon-incident.md`. The scientific
  design and claim boundary did not change; provider activity remains stopped
  until the fix is merged and the interrupted ledger is sealed.

- 2026-09-02: Registered the exact three-dialogue technical continuation after
  the operator extended recovery by 100 actual provider-dispatch reservations.
  The recovery keeps Luna at low effort, the original worlds, seeds, prompts,
  eight-turn horizon, action assignment, measurement, and claim boundary. It
  reuses accepted pending learner output and saved analysis where available,
  treats the horizon as eight total turns, preserves every raw artifact, and
  writes fresh lineage traces. The shared journal now reserves immediately
  before dispatch, terminalizes every attempt, reconciles stale in-flight work,
  releases unused capacity, and projects attempt, unit, workflow, verdict, and
  ETA state from the same ledger. A separate migration card tracks other paid
  runners; they are not represented as already migrated. No recovery provider
  call was made during implementation or preflight.

- 2026-09-02: The first executable v2 audit was preserved but superseded after
  its own family rows exposed an aggregation contradiction: 64 condition-matched
  rows were labelled as seeded comparative cases although 29 were mandatory or
  singleton audit-only decisions. Restricted v2 feasibility counts to seeded
  assignments with the exact registered three-family eligible set, while
  retaining the broader condition-matched count as a separate audit field and
  leaving the sealed v1 calculation unchanged. No coder packet, model call, or
  study reservation was created by the superseded audit.

- 2026-09-02: The first v2 zero-call audit invocation failed before reading a
  trace or creating its output because the CLI entry point still routed every
  design through the sealed v1 loader. Added explicit registered-study dispatch
  to the maintained v2 loader plus a CLI-loader regression covering both design
  versions. The fixed `asOf` input remains unchanged for the next invocation;
  this failed attempt made no model call and consumed no reservation.

- 2026-09-02: The final bounded recovery completed all 22 never-started
  dialogues and sealed the 60-unit block with 57 complete, 3 preserved
  technical failures, 0 missing units, 468/480 turns, and exactly 4,860/4,860
  shared reservations. Two failures are the operator-requested interruptions;
  the third is a learner-analysis request that timed out after three failed
  attempts. Zero-call artifact preparation then exposed that the audit still
  treated all five policy families as comparative, read four renamed v2 gate
  fields through their v1 names, required binary auxiliary labels under the new
  human-consensus/auxiliary-veto policy, and rendered fixed v1 prose. Corrected
  those version-sensitive paths and added a v2 regression while preserving the
  sealed v1 behavior. No model call or study reservation was made by the audit
  repair.

- 2026-09-02: After PR #946 merged, the final real zero-call preflight passed
  with exactly 22 untouched dialogues and 1,782 remaining reservations, but the
  live admission stopped before creating Recovery 3 or making a provider call.
  Root cause: the action-outcome loader independently validated Recovery 2's
  sealed report-backed provider failure, while the shared paid-study gate still
  treated its default `recovery_permitted: false` study-ledger field as final.
  Added a fail-closed admission check that reads the sealed action-outcome
  report and run ledger itself. It admits no caller override: launch identity,
  recovery link, job order, per-job child attempt accounting, cumulative
  reservations, final technical-failure disposition, missing units, and the
  unchanged hard ceiling must all agree. An absent or tampered report remains
  blocked. The focused paid-contract and collection suites pass 36/36. Model
  calls and new reservations for this failed admission: 0.

- 2026-09-02: The reviewed missing-only continuation completed three more
  dialogues, then stopped on a provider transport failure in
  `aocv2_larkspur_fridge_r08`: two automated-learner attempts failed before an
  accepted response, the next retry succeeded, and learner analysis then hit
  the fixed 300-second timeout. The unit remains a technical failure and will
  not be rerun. The launcher sealed 35 complete, 3 failed, and 22 untouched
  units with 3,078 of 4,860 shared reservations consumed. A chained zero-call
  preflight exposed that a report-backed failure in a recovery run omits the
  earlier explicit recovery flag. Extended the loader narrowly: it may accept
  that predecessor only after the full report, checkpoint, ordered run-ledger
  dispositions, per-row child attempt counts, and shared study seal agree on
  exactly one final current-run technical failure. Report presence alone grants
  nothing. The failed preflight made 0 model calls, created no destination, and
  consumed no reservation.

- 2026-09-02: Bringing the linked-recovery fix up to current `main` caused the
  repository's full Node 22/24 CI to run. Node 24 reproducibly exposed a
  temporary-directory cleanup race in two existing interactive presentation
  tests: the tutor process had closed, but a finishing fake-provider child could
  still create its final log while `rmSync` traversed the fixture directory.
  Added Node's bounded `ENOTEMPTY` retry options to those two cleanups. This is a
  test-lifecycle repair only; both failed CI attempts made 0 model calls and
  consumed no study reservation.

- 2026-09-02: The operator paused the v2 missing-only recovery after 17 of its
  44 units completed, then instructed continuation under the unchanged study
  authorization. The zero-call sealer preserved the active partial unit and
  closed the recovery ledger with 2,754 of 4,860 shared reservations consumed.
  A chained zero-call preflight then exposed a recovery-loader defect: linked
  recovery required a finished `report.json`, although an operator-interrupted
  process can only leave its atomic checkpoint, trace, and sealed ledgers.
  Extended linked recovery to validate the inherited chain, match every current
  completed row to its reservation and disposition, and reconstruct exactly one
  reserved-but-undispositioned unit from its saved trace. The partial unit is
  preserved as a second technical failure and can never be rerun; only the 26
  untouched dialogues remain eligible. Added a focused regression test. The
  failed preflight made 0 model calls, created no recovery destination, and
  consumed no additional reservation. Model activity remains inactive pending
  review and merge of this source repair.

- 2026-09-02: The operator paused the v2 collection after 15 complete dialogues
  and one partial dialogue, then instructed continuation under the unchanged
  authorization. The zero-call dead-process sealer preserved the initial run as
  a technical interruption with 1,296 of 4,860 shared reservations consumed.
  Recovery preflight then exposed a fail-before-call validator defect: the v2
  check required the original live root to remain absent even though a recovery
  necessarily names that existing predecessor. Corrected the prospective v2
  check to require the original live root to exist while the packet, comparison,
  readiness, and selected fresh recovery destinations remain unused, and added a
  focused regression test. No recovery destination, provider call, or additional
  reservation was created by the failed preflight.

- 2026-09-02: PR #937 merged the fixed prospective v2 collection registration
  at launch commit `35c178a0f1acbf467f5ffe643300350bc0089614` with all CI checks
  green. After that merge, the operator explicitly authorized one 60-dialogue
  collection using Luna at low effort, with 1,500 planned calls and a 4,860
  paid-model-attempt reservation ceiling, followed by zero-call extraction and
  coder-packet preparation. Recorded the separate study-level GO note. It does
  not authorize fabricated human judgments, memory enablement, held-out worlds,
  or a controller evaluation. Real model activity remains inactive pending this
  note's merge: 0 calls and 0 production writes.

- 2026-09-02: Registered the fresh fixed-size collection required by the
  prospective redesign. The new block contains 60 dialogues across the same
  four collection worlds, 15 independent repeats per world, a fresh master
  seed, Luna-only low-effort routes, an eight-turn horizon, and a fail-before-call
  ceiling of 4,860 reservations for 1,500 planned calls. Comparative review is
  restricted to the exact support-phase set containing `explain_model`,
  `minimal_support`, and `request_self_explanation`; diagnose and fade singleton
  decisions remain audit-only. Two independent human coders remain the semantic
  authority under `human_consensus_auxiliary_veto_v2`. The sealed v1 pilot is
  excluded from the new sample, Rowan Flat and Tideway Makerspace remain held
  out, and the memory controller remains disabled. Extended the maintained
  launcher with a separate pinned v2 preflight while leaving the historical v1
  validation boundary intact. This registration grants no call authority until
  its merged commit and separate signed GO note exist.

- 2026-09-01: Implemented the zero-call prospective redesign after the first
  collection pilot failed feasibility. Every assignment now carries a canonical
  exact eligible-family-set id. Seeded family assignment requires at least two
  simultaneously eligible families; singleton and mandatory choices remain
  audit-only. Memory cells and lookups include that exact set, and the controller
  abstains on a singleton or candidate-set mismatch. The first supported
  comparison is therefore the three-family support phase; `diagnose_elicit` and
  `fade_transfer` remain outside comparative memory until genuine alternatives
  exist. Added a prospective human-consensus measurement policy: two independent
  coders remain semantic authority, an opposite binary auxiliary label or hidden
  delivery forces indeterminacy, and an inconclusive auxiliary label is retained
  as nonconfirmatory instead of erasing exact human consensus. Added the saved
  redesign steps, a versioned zero-call design contract, preflight, and focused
  fixtures. The sealed pilot remains development-only and is neither recoded nor
  topped up. No new paid study, launch authority, held-out evaluation, production
  write, or model call is included.

- 2026-09-01: Completed the registered zero-call extraction and quality audit
  over the sealed collection and recovery chain. All 23 available trace files
  were readable and unquarantined; all 158 closed next-turn opportunities
  validated, with 181 typed decisions in total, 130 seeded closed assignments,
  and no held-out-world leakage. The registered stalled-state condition yielded
  30 seeded closed assignments across 13 dialogues and all four collection
  worlds, below the gates of 48 assignments and 16 dialogues. Delivery was
  visible for all 30, but family support failed: `diagnose_elicit` 16,
  `request_self_explanation` 6, `minimal_support` 5, `explain_model` 3, and
  `fade_transfer` 0. Every matched auxiliary outcome was `inconclusive`, so the
  frozen auxiliary-agreement rule places an upper bound of zero on final usable
  binary records even under perfect coder agreement. The pilot therefore fails
  its registered feasibility gates and does not license a held-out controller
  study; the no-top-up and no-threshold-change rules remain in force. Added a
  reusable zero-call audit script plus public Markdown/JSON reports with source
  hashes, Wilson intervals, family/world coverage, and every gate disposition;
  no transcript text is copied. Model activity was inactive and model calls were
  0.

- 2026-09-01: After PR #908 merged, the operator explicitly instructed,
  "continue the 22 untouched jobs." Added one narrow linked-recovery path for
  the sealed recovery that failed before any child model-attempt reservation.
  It validates the full predecessor chain, preserves both failed rows, carries
  forward the aggregate 162 reservations, selects exactly the 22 never-started
  jobs beginning with `aocp1_foxtrot_jukebox_r03`, and closes at the original
  1,944 ceiling. The shared contract permits this exception only when the
  latest recovery has one technical-failure unit with zero child reserved,
  completed, and failed attempts; a repeated zero-provider startup failure is
  rejected. The original study GO, design, models, seeds, claim boundary, and
  ceiling remain unchanged, and no new GO artifact is created. A real
  zero-call dry run against the sealed artifacts and private archive passed all
  checks with the archive writable, 22 recovery units, 1,782 remaining
  reservations, 0 provider calls, and 0 production writes. Model activity
  remains stopped pending merge of this source change.

- 2026-09-01: After PR #906 merged, the interrupted launch was sealed and its
  zero-call recovery preflight passed. The recovery then stopped on
  `aocp1_foxtrot_jukebox_r02` before any provider call because the local
  sandbox denied creation of the required private artifact-archive directory.
  The failed recovery unit has 0 turns and 0 child attempt reservations; its
  full 81-attempt shared reservation remains consumed. Across both preserved
  failures the study now has 5/192 turns, 30 completed provider calls, 0
  provider-call failures, 162/1,944 shared reservations, and 22 untouched
  jobs. The recovery run is sealed with further recovery disabled. Added a
  zero-write archive-access check so dry-run fails when the resolved archive
  exists but is not writable in the launch environment. Model activity is
  stopped. Continuing the 22 missing jobs would require an explicit human
  decision and a separately reviewed change to the one-recovery rule; no such
  execution is authorized by this source-only repair.

- 2026-09-01: The authorized initial collection launch exposed a mechanical
  completion-accounting defect during its first job and was stopped before a
  second job began. The maintained bored-learner repair path produced valid
  extra learner and analysis calls, while the launcher incorrectly required
  exactly the 25-call normal plan. The interrupted job is preserved with 5/8
  completed turns, 31 child reservations, 30 completed provider calls, no
  provider error, and one interrupted sixth-turn learner-analysis attempt; its
  full 81-attempt shared reservation remains consumed. Added a tested zero-call
  dead-process lease sealer and a missing-only recovery path. The corrected
  completion contract accepts successful repair calls above 25 only with the
  full eight-turn/seven-outcome structure, balanced attempt accounting, no
  budget exhaustion, and the unchanged 81-attempt dialogue ceiling. Recovery
  validates the sealed predecessor, preserves and skips the failed job, selects
  only the 23 never-attempted jobs, and closes exactly to the original 1,944
  study ceiling: 81 prior plus at most 1,863 recovery reservations. A second
  failure cannot authorize another retry. The original direct GO remains the
  study-level authorization; no new commit-bound approval artifact is created,
  and the repaired source commit is recorded only as launch provenance. Real
  model activity is stopped; no repair or recovery call has run. Verification:
  19 focused launcher/contract tests pass, along with targeted ESLint and
  Prettier, paid-launcher inventory, static import-cycle, hermetic manifest,
  workplan source, diff checks, and a real zero-call 24-job dry run.

- 2026-09-01: After PR #903 merged and the exact reviewed tree was prepared as
  clean detached launch commit
  `7f289563c7aa6e7917a81b2e1ea0569f69bf3cfc`, the operator sent the direct
  instruction `GO`. Added the separate signed GO note for exactly one initial
  launch of the registered 24-dialogue collection pilot under the shared paid
  study contract and the fixed 1,944-reservation fail-before-call ceiling. The
  note preserves the feasibility-only claim boundary and does not authorize
  human coding, memory enablement, or the later held-out controller study. The
  launch remains pending this note's merge; real model calls and production
  writes remain 0.

- 2026-09-01: After PR #902 merged, added the zero-call collection launcher
  for the registered 24-dialogue action-outcome pilot. It compiles only the
  fixed four-world by six-repeat schedule, holds every tutor and learner role
  to `codex.gpt-5.6-luna` at low effort, keeps the memory controller disabled,
  requires the private artifact archive, and verifies the live, packet,
  comparison, and readiness destinations are all unused. The paid path calls
  the shared standing launch contract directly, reserves the registered
  fail-before-call ceiling per dialogue, stops on the first incomplete unit,
  preserves technical failures for bounded recovery, and cannot run without a
  merged clean detached launch commit plus a separate signed GO note. The real
  dry run passed: 24 dialogues, 192 turns, 600 planned calls, 1,944 maximum
  reservations, one local Codex CLI 0.148.0 version probe, three local role
  smokes, all create-once destinations absent, private archive available, 0
  model calls, and 0 production writes. No GO note, paid launch, human packet,
  coder comparison, memory enablement, or controller study is included here.
  Research acceptance remains open.

- 2026-09-01: After PR #901 merged, registered the complete bounded prospective
  collection-pilot design in a fresh worktree. The fixed 24-dialogue block uses
  four collection worlds, six repetitions each, the maintained `bored`
  simulated learner, an eight-turn horizon, a single code-grounded stalled-state
  condition, fixed support level 1, a bland register, and seeded uniform
  eligible-family assignment. Rowan Flat and Tideway Makerspace are excluded
  from collection and memory for a later separately designed held-out controller
  evaluation. The design fixes all job ids, routes, task identities, packet
  handoff, two independent private coder seats, feasibility gates, create-once
  destinations, failure dispositions, and a fail-before-call ceiling of 1,944
  reservations: 600 planned calls, at most three reservations per planned call,
  plus six technical-headroom reservations per dialogue. Human uncertainty,
  coder disagreement, auxiliary disagreement, nonrandomized decisions, and
  displaced actions remain measurement-indeterminate or audit-only; there is no
  adjudication, top-up, threshold relaxation, or valid-unit replacement. The
  controller stays disabled. This design grants no launch or model-call
  authority; a clean detached launch commit and separate signed GO note are
  still required, and no launcher or GO note is included here. Real model calls:
  0. Research acceptance remains open; even a passing collection pilot can only
  license a new held-out controller-study design, not establish learning,
  transfer, family superiority, or controller benefit.

- 2026-08-31: After PR #899 merged, continued in a fresh worktree with the
  zero-call prospective-collection seam. The ordinary typed-action selector was
  deterministic with propensity one, so family hit rates would have inherited
  policy-selection confounding. Added a default-off seeded assignment mode that
  samples uniformly across policy-eligible move families and then within the
  selected family, while preserving mandatory diagnostic/escalation authority
  and requiring fixed support. Traces record baseline choice, eligible families
  and actions, both draws, family/action propensities, and seed material.
  Readiness replays and validates the assignment, rejects corrupt provenance,
  and labels deterministic/historical cases; the standard human packet admits
  only seeded family assignments. Nonrandomized or mandatory cases remain
  visible but measurement-indeterminate even if a direct review is supplied.
  Contract and remaining paid-design fields:
  `docs/action-outcome-prospective-collection.md`. No model-backed collection,
  conditions, thresholds, routes, worlds, sizing, spend ceiling, GO note, live
  memory enablement, or benefit claim. Real model calls: 0. Research acceptance
  remains open; the next step is a complete bounded collection-pilot design,
  followed later by independent unassisted/transfer evaluation.
  Verification: 134 focused tests passed across action memory/readiness/review,
  policy/outcome closure, typed-action assignment/adapter/restoration, turn
  orchestration, CLI help, and entrypoint facades. The real CLI path was exercised
  with a fake local executable; invalid collection flags failed before model
  dispatch. Targeted ESLint, Prettier, import-cycle check, test-manifest check,
  workplan source check (575/575), and diff checks passed. Symmetry review found
  no unmatched learner trace or scoring change: this is a tutor treatment
  assignment, while the existing next-public-learner outcome lane is unchanged.
  The paid tutor benchmark is not run because the new mode is default-off and a
  real benchmark would violate this slice's zero-call boundary; ordinary lint and
  CI remain enabled.

- 2026-08-31: After PR #898 merged, continued with the next zero-call
  prerequisite in a fresh worktree: a prospective auxiliary-blind human-review
  packet and exact importer handoff. The create-once builder admits only
  structurally joined typed-action records under explicit conditions, keeps
  source/run/world/condition and auxiliary labels in a private key, and gives
  two independent coders differently ordered public three-turn cases with the
  requested action and its saved pre-response success criterion. Comparison
  preserves uncertainty, coder disagreement, unconfirmed delivery, and
  auxiliary/human disagreement as measurement-indeterminate; it writes the
  exact review schema already consumed by the readiness importer. This is joint
  immediate-uptake review, not action-blind delivery coding and not the required
  independent unassisted/transfer endpoint. No study launch, live enablement,
  source-data change, threshold choice, or model call. The existing 156 traces
  still cannot produce a real packet; compatible prospective collection remains
  necessary.
  Verification: 62 focused memory, readiness, review-packet, intervention-ledger,
  and typed-action adapter tests passed, including the trace-to-packet-to-review
  importer round trip, public/private separation, saved all/any evidence logic,
  timestamp and data-drift rejection, and indeterminate disagreement handling.
  Test manifest synchronized; source check 575/575, targeted lint, formatting,
  and diff checks passed. No package, lockfile, workflow, runtime-selection, or
  browser-surface changes. Paid tutor benchmark is out of scope for this
  offline-only slice; normal lint and selected CI remain enabled.

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
