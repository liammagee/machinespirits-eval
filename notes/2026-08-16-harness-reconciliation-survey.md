# Survey: the tutor-stub and cell-based harnesses side by side

**Date:** 16 August 2026. **Card:** `tutor-stub-cell-reconciliation`.
**Status:** read-only survey. No code changed. Options at the end; no
option is chosen here.

Method: direct reads of the files named in the brief, plus targeted
greps for imports that cross between the two worlds. File references
give the state of this worktree at `582d601f`.

## 1. What defines a tutor

**Cell world.** A tutor is one profile in `config/tutor-agents.yaml`.
There are 209 `cell_` profiles now. The YAML fields carry the whole
definition: the factor block (multi-agent flag, prompt type, id-director
flag), the superego block, the learner architecture, the conversation
mode, and the runner field. `services/evalProfileRegistry.js` derives
the canonical list from the YAML with a strict name pattern
(`evalProfileRegistry.js:1`), keeps historical names as explicit
aliases (`:10`), and fails closed on any mismatch between YAML and
registry (`:40-83`). The profile then maps onto a tutor-core base
profile through the prompt-type dispatch.

**Stub world.** A tutor is a launch configuration, not a registry row.
It is composed at start from: a capability lab
(`services/tutorStubLabs.js`; ten labs from `pure_chat` to
`research_controls`, `docs/tutor-stub-cli.md:67-116`), a world file
(`config/drama-derivation/world-*.yaml`, for example
`world-005-marrick.yaml`), command flags (register policy, DAG mode,
tutor character, model, budgets — see the `tutor:stub:*` scripts in
`package.json:35-54`), and a versioned session recipe for reproduction.
Each session freezes a versioned capability snapshot after launch
normalization (`docs/tutor-stub-cli.md:33-58`).

**Relation: siblings.** Both resolve prompts, a model, and a policy
into one running tutor. The cell profile is static, enumerable, and
built for population claims across many cells. The stub tutor is
composed per session, human-facing, and built for one dialogue at a
time. Nothing maps a stub launch configuration to a cell name or back.

## 2. What defines a learner

**Cell world.** The `learner_architecture` field picks one of two
kinds: scripted turns from `config/suggestion-scenarios.yaml`
(`unified`), or a full LLM agent with its own ego–superego loop
(`ego_superego`, `services/learnerTutorInteractionEngine.js`, personas
via `services/learnerConfigLoader.js`). Trap cells use
`config/adaptive-trap-scenarios.yaml` and
`config/cross-suite-trap-scenarios.yaml`. The learner is always
simulated.

**Stub world.** Three learner sources, with recorded authorship per
turn: human terminal or voice input, a fully automated learner
(behavior-brief profiles such as `diligent`, and stress profiles such
as `goalpost_shifter` and `counterexample_hunter`), and mixed drafting
where an AI draft is accepted or edited by a human. Every learner turn
records provenance — `human`, `ai`, `hybrid`, or `unknown` — down to
message fragments (`docs/tutor-stub-cli.md`, "Learner response
authorship").

**Relation: siblings with different depth.** The cell learner has
internal deliberation the rubric scores; the stub automated learner is
a behavior brief with no scored interior. Only the stub world admits a
human learner in the loop, and only it records who wrote each turn.
The pilot infrastructure (`services/pilotStore.js`) is a third,
cell-side path for human learners, ingested into `evaluation_results`;
it does not touch the stub world.

## 3. What defines a run

**Cell world.** A run ID in `evaluation_runs`, one row per attempt in
`evaluation_results` (store facade `services/evaluationStore.js`,
delegating to `evaluationStore/lifecycle.js`), dialogue logs on disk,
exports under `exports/`, and the manual archive step
(`npm run archive:runs`).

**Stub world.** JSONL traces per session under `.tutor-stub-traces/*`,
auto-eval JSON summaries under `.tutor-stub-auto-eval`, and an
artifact-archive manifest with an `off | best_effort | required`
policy (`services/tutorStubArtifactArchive.js:7-8`). The warrant
studies add sealed child processes, digest-bound launch authorization,
and recursive source-closure hashes (successor warrant card, below).
`scripts/ingest-tutor-stub-auto-evals.js` writes stub results into the
**same** `data/evaluations.db`, but into namespaced tables —
`tutor_stub_eval_runs`, `tutor_stub_eval_rows`,
`tutor_stub_register_counts`, `tutor_stub_efficacy_counts`,
`tutor_stub_turn_frames` — and its header says the shape is
"intentionally kept in namespaced tables instead of being forced into
evaluation_results" (`ingest-tutor-stub-auto-evals.js:3-6`).

**Relation: one database, two table families.** This is a deliberate,
already-built seam. A stub run never becomes an `evaluation_results`
row; a cell run never lands in the stub tables.

## 4. What defines a score

**Cell world.** LLM judges under versioned rubrics: v2.2 tutor rubric
active, v3.0 opt-in, plus the independent charisma and poetics rubrics.
Scores live in typed columns of `evaluation_results`; `rejudge` and the
reliability scripts cross-check judges.

**Stub world.** Three channels, ordered by authority: deterministic
readers and audits first (response-configuration audit, delivery
application, structured live/replay parity); typed gates with
predeclared thresholds second; blind two-reader human corpora third
(frozen 96-case packets; a packet with any defect is burned, never
patched). LLM reads exist but in bounded seats: paired A/B judging
(`scripts/judge-tutor-stub-ab-pairs.js`) and isolated model readers
used as blind annotators inside fail-closed envelopes.

**Relation: mostly unrelated, by design.** The cell world treats an
LLM judge as the scorer of record. The stub world treats an LLM read
as an annotation to be validated, and puts the score of record in
deterministic checks and predeclared gates. This difference is the
reason a claim cannot move between worlds without a stated rule.

## 5. What defines adaptation

**Cell world.** Adaptation is measured after the fact from traces:
adaptation and growth indices (`adaptationIndex`,
`learnerGrowthIndex`, `bilateralTransformationIndex`), the turn and
dialogue trace analyzers, and the strategy-shift scorers. The adaptive
LangGraph runner (`services/adaptiveTutor/`) adds run-time policy
actions, but the verdict still comes from scored rows.

**Stub world.** Adaptation is a typed run-time decision. The normative
architecture doc separates detecting divergence from deciding that
adaptation is warranted
(`normative-adaptive-dialogue-architecture.md:219-250`): six divergence
axes, evidence accumulation, a warrant threshold, then revision of a
pedagogical commitment. The objects are code: the warrant gate
(`services/adaptiveWarrantGateCore.js`, `tutorStubWarrantGate.js`),
13 action-family lifecycle contracts with expected learner response,
deadline, success, defeat, and expiry
(`adaptiveWarrantActionContracts.js`), the public obligation ledger
(`adaptiveWarrantPublicObligationLedger.js`), and typed inquiry
completion — all behind an `off | observe | active` gate.

**Relation: measurement versus mechanism.** The cell world asks "did
the tutor change, and did it help?" from rows. The stub world asks
"was this single revision decision licensed?" at the decision point.
A bridge already exists: the adaptive runner maps stub typed actions
into its five move families
(`services/adaptiveTutor/tutorStubActionAdapter.js:10-16`).

## 6. Shared seams that already exist

1. **The register router.** `services/engagementModeRouter.js` is
   imported by both `idDirectorEngine.js` (cell world) and
   `tutorStubEdgeTimingPolicy.js` (stub world). Resistance-signal
   detection and register menus are one shared implementation.
2. **The edge-timing overlay.** Born as Stage 1 of the cell-side
   adaptive-register-switching study, frozen as a deterministic
   zero-call map, then exposed in the stub as an opt-in policy overlay
   (`--register-policy field+edge_timing`,
   `docs/tutor-stub-cli.md:714-752`). The overlay claims timing only,
   not a learning benefit — that caveat is the transfer rule in
   miniature.
3. **Proof-DAG reads inside the edge-timing detector.** The detector
   reads stub DAG state for grounded closure
   (`tutorStubEdgeTimingPolicy.js:68-75`) and learner advance counts
   (`:113-121`). Stub state feeds a policy born in the cell world.
4. **One database, namespaced stub tables** (section 3).
5. **The adaptive runner's stub adapter and state benchmarks**
   (`services/adaptiveTutor/tutorStubActionAdapter.js` and the
   `stateBenchmark*` files): the cell-side runner consumes stub typed
   contracts.
6. **One session surface.** The `/tutor` shell and one versioned
   session protocol run both the stub labs and an admin-only eval-cell
   lab (card `converge-tutor-stub-and-legacy-chat`, done, PR 164). The
   UX converged; the harnesses did not.

**Dependency rules found.** Clean and enforced: tutor-core never
imports the eval repo; no `tutorStub*` service imports the evaluation
store; stub results never enter `evaluation_results`. Not clean: the
stub and the warrant layer import each other in both directions
(`tutorStub*` files import `adaptiveWarrant*` and `adaptiveTutor/`;
`adaptiveWarrantGateCore.js` and three siblings import `tutorStub*`).
There is no stated rule for that boundary today.

## 7. Things that exist in one world only, and why

**Cell only.** The factorial registry with its fail-closed count
ratchet; the judge pipeline and rubric versioning; the id-director
engine; the poetics pipeline; provenance hashes on rows; paper table
generation. These serve population-level claims: many cells, uniform
rows, one scorer, statistics over runs.

**Stub only.** The proof-DAG with its Lean certificate
(`tools/proof-dag-lean`, `scripts/check-proof-dag-lean.js`); the typed
contracts, warrant gate, and obligation ledger; capability labs and
session recipes; human-in-the-loop terminal, voice, and authorship
provenance; digest-bound launch authorization and sealed children;
the artifact-archive lifecycle. These serve single-dialogue normative
correctness and real human use, where a wrong turn matters more than a
mean over rows.

## Coordination constraints for any follow-up

- The live P1 warrant line (card
  `adaptive-warrant-public-obligation-ledger-and-inquiry-termin`)
  fingerprints the recursive source closure of its entrypoints and
  binds a clean 40-character HEAD. Moving or renaming any file in that
  closure burns its next checkpoint. Do not refactor near it without
  the owner.
- The paused edged-register line (`../ms-edged-register`, Stage 0)
  will touch the id-director side, which shares
  `engagementModeRouter.js` with the stub overlay. Changes to the
  router need both lines' agreement.

## Reconciliation options (no choice made here)

**Option A — stay separate, state the transfer rule.** Write one short
doc: a claim born in one world transfers only after it is re-run under
the other world's score of record, or it carries an explicit caveat
naming the world it came from. The edge-timing overlay is the
precedent: frozen map, opt-in, no learning-benefit claim. Add the
missing boundary rule for the stub/warrant two-way imports.
*Cost:* low — one doc, one test if the boundary rule is enforceable.
*Left unsolved:* duplicates stay (two register stacks, two learner
simulators, two run-artifact schemes); every future crossing repeats
this survey in miniature.

**Option B — give the stub a cell wrapper.** Add a runner value (or an
adapter script, on the `run-dialogue-engine-trap-baseline.js` pattern)
so a stub configuration can run as a cell: rows in
`evaluation_results`, judge scores under v2.2, cross-correlation with
the existing rubrics. *Cost:* medium — an adapter, a scenario mapping,
and a decision the ingest script has so far refused: forcing the stub
shape into `evaluation_results`. *Risk:* judge scores become the
quotable number for stub tutors, inverting the stub world's authority
order (deterministic first, LLM last); and the wrapper enters the
warrant line's source closure if it touches shared files.

**Option C — extract the typed adaptation layer as a neutral service.**
Move the warrant gate, action-family contracts, and obligation ledger
behind one module with no `tutorStub*` imports; both the stub runtime
and the adaptive runner call it (the adapter in
`adaptiveTutor/tutorStubActionAdapter.js` already sketches the
mapping). *Cost:* high — the layer is mutually entangled with the stub
today, and it is the exact code the live P1 line is validating; any
extraction now burns that line's provenance and must wait for its gate
to pass or the line to close. *Benefit:* one adaptation semantics both
worlds share, which is the only option that removes duplicates rather
than fencing them.

A staged path is possible — A now, C after the warrant line closes,
B only if a concrete cross-correlation question needs it — but that
ordering is a human ruling, not part of this survey.
