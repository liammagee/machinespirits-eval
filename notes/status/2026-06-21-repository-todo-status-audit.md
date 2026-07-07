# Repository TODO/status audit

Date: 2026-06-21 PDT  
Checkout audited: `/Users/lmagee/Dev/machinespirits/machinespirits-eval-derivation`  
Branch: `claude/derivation-fast-iteration` tracking `origin/claude/derivation-fast-iteration`  
Mode: read-only inspection except this report file.

## Executive summary

The repository is no longer just the original factorial evaluation framework. It now contains four large, mostly implemented strata:

1. The canonical Paper 2.0 evaluation framework: bilateral ego/superego tutoring, dynamic learner simulation, v2.2 scoring, paper reproducibility infrastructure, and a 4,179-test hermetic suite.
2. The adaptive-runner and Plan 2.x state-policy apparatus: LangGraph trap runner, cross-suite trap scenarios, graded and binary strategy-shift instruments, evidence-bound/hypothesis-ledger variants, and many closed negative or bounded-positive results.
3. The poetics/dramatic-derivation sidecar: Aristotle-derived poetics rubric, drama generation, derivation worlds, proof-debt/conduct policy machinery, selector/guard experiments, and extensive ignored export artifacts.
4. The newer Plan 2.5 rhetorical-dramatic/curriculum-drama line: implemented compiler/generator/performance infrastructure plus current AF6 subtype diagnostics, but not yet a paper-claim-bearing result.

The main open work is not "build the system"; it is consolidation and claim hygiene:

- Human-learner validation remains the highest-value open item: pilot infrastructure exists, but recruitment is gated by IRB, real consent, real items, free-text/retention design updates, and dogfood/recruitment plumbing.
- Planning documentation has drift: `TODO.md` and a generated techne board still refer to `notes/paper-2-0/BOARD.md`, but that file does not exist in this checkout and `CLAUDE.md` says dated `notes/poetics/`/`notes/` files are the active paper-work substrate.
- Paper markdown is ahead of the built PDF: `docs/research/paper-full-2.0.md` is `version: "3.0.166"`, while ignored built PDFs visible in the checkout stop at `docs/research/paper-2.0-v3.0.165.pdf`.
- The local DB is useful but not clean status truth: `data/evaluations.db` is a symlink to `/Users/lmagee/.machinespirits-data/evaluations.db`; it contains 780 run records and 17,375 result rows, but 260 runs are marked `running`, including 247 zero-test runs, many named `storeRejudgment propagation test`.
- `data/poetics.db` exists but is 0 bytes/no tables in this checkout. Current poetics evidence is primarily file/export-backed, not DB-backed.
- Ignored/generated evidence is large and important: `exports/` is about 310 MB; `logs` is a symlink to `../machinespirits-eval-private/logs`, whose target is about 6.9 GB.

Validation performed during this audit:

- `npm run test:hermetic`: pass, 4,179 tests, 464 suites, 0 failures, duration about 12.2s.
- Read-only SQLite snapshots of `data/evaluations.db`.
- No paid/API generation or judging jobs were run.

## Repository state and boundaries

### Canonical source / committed surfaces

- Root instructions: `AGENTS.md`, `CLAUDE.md`, `README.md`.
- Long-horizon board: `TODO.md` (1,062 lines).
- Dramatic recognition pre-registration/closeout ledger: `DRAMATIC-RECOGNITION-PLAN.md` (141 lines).
- Canonical paper source: `docs/research/paper-full-2.0.md` (4,649 lines, `version: "3.0.166"`).
- Main package manifest: `package.json` (`@machinespirits/eval` `0.5.0`).
- Core implementation areas: `services/`, `scripts/`, `routes/`, `public/`, `config/`, `tests/`, `tutor-core/`.

### Local/generated/ignored state visible during audit

- `git status --short --branch`: only untracked top-level paths were `.codex-tmp/` and `outputs/`.
- `.codex-tmp/feature-tracker/build-feature-tracker.mjs` and `outputs/feature-user-story-tracker/*` appear unrelated to the current audit.
- `data/evaluations.db` is a symlink to `/Users/lmagee/.machinespirits-data/evaluations.db` (target about 305 MB).
- `logs` is a symlink to `../machinespirits-eval-private/logs` (target about 6.9 GB).
- `exports/` is ignored/generated evidence, about 310 MB.
- `docs/research/paper-2.0-v3.0.144.pdf` through `paper-2.0-v3.0.165.pdf` are visible ignored build artifacts; no v3.0.166 PDF was visible.
- `data/paper2/superego-critiques-classified-paper-6.2-n500.jsonl` has 500 records and backs Paper 2.0 §6.2 transition/revision provenance.
- `data/poetics.db` is 0 bytes; `.tables` returned no tables.

## Accomplished / implemented

### 1. Bilateral ego/superego evaluation architecture

Status: implemented/canonical.

Evidence:

- `AGENTS.md` and `CLAUDE.md` describe bilateral tutor and learner ego/superego symmetry, trace labels, scoring symmetry, and backward-compatible `user` label handling.
- Tutor core has been in-housed under `tutor-core/`; `CLAUDE.md` says imports should use relative paths and the eval layer should not be imported back into `tutor-core/`.
- Dynamic learner machinery lives in `services/learnerTutorInteractionEngine.js`, with supporting config in `config/learner-agents.yaml` and tests in `services/__tests__/learnerTutorInteractionEngine.test.js`, `services/__tests__/learnerConfigLoader.test.js`, and multiple transcript/projection tests.
- Scoring/persistence schema in `services/evaluationStore.js` includes tutor, learner, holistic, dialogue, deliberation, transformation, provenance, rubric-version, charisma, id-director, and adaptive columns.

### 2. Cell registry and experimental design coverage

Status: substantially implemented/canonical, with active newer cells beyond older docs.

Evidence:

- `config/tutor-agents.yaml` contains cells through at least the Plan 2.x/2.5 ranges; `services/evaluationRunner.js` exports `EVAL_ONLY_PROFILES` and registers cells including `cell_101`-`cell_109`, `cell_110`, `cell_114`, `cell_124`, `cell_125`, `cell_126`, `cell_127`, and `cell_128`.
- `config/tutor-agents.yaml` records `runner: adaptive` and `conversation_mode: adaptive_trap` for adaptive cells, with standard-runner baselines where intended.
- Tests include `tests/factorial-design.test.js`, `tests/resolveConfigModels.test.js`, `tests/trapTurnConvention.test.js`, and many adaptive/Plan 2 tests.

### 3. Rubric and scoring pipeline

Status: implemented/canonical.

Evidence:

- Active rubrics: `config/evaluation-rubric.yaml` v2.2, `config/evaluation-rubric-learner.yaml` v2.2, `config/evaluation-rubric-dialogue.yaml` v2.2, `config/evaluation-rubric-deliberation.yaml` v2.2, `config/evaluation-rubric-tutor-holistic.yaml` v2.2.
- Independent side rubrics: `config/evaluation-rubric-charisma.yaml` v1.0 and `config/evaluation-rubric-poetics.yaml` v1.0.
- Versioned historical rubrics live under `config/rubrics/v1.0`, `v2.0`, `v2.1`, `v2.2`.
- `services/evaluationStore.js` stores rubric versions and judge latency; `AGENTS.md` explicitly forbids retroactive cross-version contamination.
- Test coverage: `tests/rubricEvaluator.test.js`, `tests/rubric-consistency.test.js`, `tests/rubric-version-override.test.js`, `services/__tests__/rubricScoring.test.js`, `services/__tests__/rubricEvaluatorSanitization.test.js`.

### 4. Evaluation CLI, analysis scripts, and hermetic testing

Status: implemented/canonical.

Evidence:

- `scripts/eval-cli.js` is the main run/evaluate/rejudge/resume/export entrypoint.
- `package.json` exposes `eval`, `eval:quick`, `eval:test`, `analyze:*`, `provenance:validate`, `audit:message-chain`, `test`, and `test:hermetic`.
- `scripts/ANALYSIS-SCRIPTS.md` inventories analysis scripts.
- Standard analyses include `scripts/analyze-eval-results.js`, `analyze-judge-reliability.js`, `analyze-mechanism-traces.js`, `analyze-trajectory-curves.js`, `analyze-within-test-change.js`, `analyze-learning-stagnation.js`, `analyze-recognition-lexicon.js`, `analyze-rubric-consistency.js`, and many A-series/D-series specialized analyzers.
- Audit validation: `npm run test:hermetic` passed 4,179 tests with 0 failures.

### 5. Paper 2.0 canonical manuscript and claim infrastructure

Status: implemented/canonical, current markdown ahead of PDF artifact.

Evidence:

- `docs/research/paper-full-2.0.md` is the canonical empirical source, version `3.0.166`.
- Paper sections cover architecture (§4), methodology (§5), results (§6), discussion (§7), limitations (§8), conclusion (§9), and appendices.
- Paper includes adaptive-runner and dramatic-derivation additions through §6.13.15, and revision history through v3.0.166.
- Claim/provenance infrastructure: `scripts/validate-paper-manifest.js`, `scripts/generate-paper-tables.js`, `scripts/validate-provable-discourse.js`, `scripts/bootstrap-provable-claims.js`, `scripts/reconstruct-provable-paper.js`, `config/paper-manifest.json`, `config/provable-claim-inventory.json`, `services/provableDiscourse.js`.
- Recent Git: `20f37e67 Add claim verification audit workflow`; earlier `038da119` and `c83b91f2` paper claim corrections.
- Tests: `tests/provableDiscourse.test.js`, `tests/provenance.test.js`, `tests/messageChainAudit.test.js`, `tests/analysis-smoke.test.js`.

### 6. Human learner pilot engineering

Status: engineering implemented; recruitment/content/legal still open.

Evidence:

- `services/pilotStore.js` creates `pilot_sessions`, `pilot_turns`, `pilot_test_items`, and `pilot_exit_survey`.
- `routes/pilotRoutes.js` implements the participant/admin flow.
- `public/pilot/index.html` and `public/pilot-admin/index.html` are the UI surfaces.
- `services/pilotItemBank.js` and `config/pilot/fractions-items.yaml` back form-counterbalanced scoring.
- `scripts/ingest-pilot-sessions.js` ingests completed pilot sessions into evaluation-format rows/logs.
- Tests: `tests/pilot.test.js`.
- Root TODO §A1 records engineering done, and remaining IRB/content/recontact/free-text/retention gaps.

### 7. Adaptive tutor / Plan 2.x state-policy apparatus

Status: implemented/canonical, with many completed/null/negative findings folded into paper.

Evidence:

- Core implementation in `services/adaptiveTutor/`: `runner.js`, `graph.js`, `stateSchema.js`, `policyActions.js`, `interventionLedger.js`, `realizationVerifier.js`, `outcomeObserver.js`, `proofReleaseOwnershipGate.js`, `realLLM.js`, `mockLLM.js`, `budgetTracker.js`, `persistence.js`.
- Scenarios: `config/adaptive-trap-scenarios.yaml`, `config/adaptive-trap-scenarios-v2.yaml`, `config/cross-suite-trap-scenarios.yaml`, `config/adaptive-plan2-1-evidence-bearing-scenarios.yaml`, `config/adaptive-generalization-counterfactual-scenarios.yaml`.
- Scripts: `scripts/analyze-strategy-shift.js`, `scripts/grade-adaptive-dialogue.js`, `scripts/analyze-adaptation-*`, `scripts/evaluate-adaptation-policy.js`, `scripts/launch-p21-fanout.sh`.
- Exports include `exports/plan2-1-*`, `exports/plan2-general-adaptation-*`, `exports/m0-*`, and many strategy-shift/quality reports.
- Paper sections §6.8-§6.12 and §6.9.1-§6.9.8 report this line.
- Tests: `tests/adaptation-*.test.js`, `tests/adaptive-mock-learner.test.js`, `tests/intervention-ledger.test.js`, `tests/outcome-observer.test.js`, `services/__tests__/adaptiveTutor.*.test.js`.

### 8. Id-director / charisma family

Status: implemented/canonical.

Evidence:

- `config/tutor-agents.yaml` defines `cell_101`-`cell_109` with `factors.id_director: true`.
- `services/idDirectorEngine.js` implements per-turn id construction.
- `services/evaluationStore.js` stores `id_construction_trace` and `tutor_charisma_*` fields.
- `config/evaluation-rubric-charisma.yaml` is an independent Weber-derived rubric.
- Paper §6.7 reports the family.
- Tests: `services/__tests__/idDirectorEngine.test.js`.

### 9. Poetics / dramatic recognition sidecar

Status: implemented as sidecar apparatus; some archive gaps remain.

Evidence:

- `DRAMATIC-RECOGNITION-PLAN.md` records the sanctioned arc, closeout ledger, completed phases, and still-open archive/gap items.
- `config/evaluation-rubric-poetics.yaml` defines a whole-transcript poetics rubric.
- `config/poetics-calibration/*` contains phase designs/findings and calibration/manifests.
- `scripts/score-poetics-calibration.js`, `score-poetics-phase2.js`, `critic-poetics-structure.js`, `critic-poetics-omniscient*.js`, `ingest-poetics-artifacts.js`, `report-poetics-sidecar.js`, `browse-poetics-scripts.js`, `run-poetics-adaptation-loop.js`, and related scripts implement scoring, ingestion, browsing, auditing, and loops.
- UI/docs: `notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html`, `.standalone.html`, image assets, `notes/poetics/assets/techne.css`, `techne.js`, `TECHNE-DOCS.md`.
- Exports include many `exports/poetics-*` JSON summaries and `exports/plan2_5-rhetorical-dramatic-eval/*`.
- Tests include `tests/poetics*.test.js`, `tests/criticPoetics*.test.js`, `tests/runPoeticsAdaptationLoop.test.js`, `tests/aggregatePoeticsPairedIncrement.test.js`.

Important boundary:

- `data/poetics.db` is empty in this checkout, so durable poetics evidence here is mainly in configs, notes, exports, and paper prose, not a populated sidecar DB.

### 10. Dramatic-derivation proof/conduct harness

Status: implemented and extensively tested; many artifacts are ignored/generated.

Evidence:

- Worlds: `config/drama-derivation/world-000-smoke.yaml` through `world-015-hethel-public-reversal.yaml`.
- Services: `services/dramaticDerivation/*` including `engine.js`, `world.js`, `critic.js`, `proofDebt.js`, `runtimeMonitor.js`, `guardCompiler.js`, `conductPolicy.js`, `visiblePacing.js`, `ownershipBenchmark.js`, `objectOwnership.js`, `rhetoricalMovePolicy.js`, `replay.js`.
- Scripts: `scripts/run-derivation-loop.js`, `run-derivation-episode.js`, `run-derivation-matrix.js`, `derivation-critic.js`, `derivation-guard-compiler.js`, `derivation-leak-audit.js`, `derivation-cost-report.js`, `derivation-detector-split.js`, `derivation-ownership-*`, `a21-*`.
- Exports: `exports/dramatic-derivation/*`, including boundary, guard compiler, ownership, selector, A20/A21, phase reports, and run logs.
- Paper §6.13.1-§6.13.15 reports the dramatic-derivation stage.
- Tests include `tests/dramaticDerivation*.test.js`, `tests/derivationOwnership*.test.js`, `tests/hiddenProofDebtFailureAudit.test.js`.

### 11. Curriculum / rhetorical-dramatic / Plan 2.5 tooling

Status: implemented infrastructure; current AF6 result is diagnostic/negative, not paper-claim-bearing.

Evidence:

- Scripts: `scripts/convert-ai-foundations-curriculum.js`, `compile-curriculum-to-rhetorical-dramatic-plans.js`, `compile-curriculum-to-drama.js`, `compile-curriculum-to-worlds.js`, `generate-pedagogical-dramas.js`, `check-curriculum-drama-quality-baseline.js`, `replay-plan25-prefix-branches.js`, `analyze-plan25-origin-demarcation.js`.
- Tests: `tests/curriculumCompiler.test.js`, `tests/generatePedagogicalDramas.test.js`, `tests/dramaGenerator*.test.js`, `tests/replayPlan25PrefixBranches.test.js`, `tests/curriculumDramaQualityBaseline.test.js`.
- Recent Git: `c9fe4ac9 Add help output for drama generator`, `5487e2b1 Document curriculum drama model routing runs`, `596663b5 Harden Plan 2.5 AF6 dogmatic control`, `3fc09e3d Add Plan 2.5 AF6 subtype contrast screen`, `5d9cb40d drama-gen: paper-sync assessment for the optimization work`.
- Notes: `notes/poetics/2026-06-20-curriculum-drama-generation-performance-plan.md`, `2026-06-20-curriculum-drama-model-routing-runs.md`, `2026-06-21-drama-gen-optimizations-paper-sync.md`, `2026-06-21-plan25-af6-negative-result-and-replay-next.md`, `2026-06-21-plan25-af6-subtype-contrast-v1.md`.
- Current diagnosis: Plan 2.5 AF6 full-fidelity and replay/subtype screens show possible positive examples but no robust tutor-origin proof; cheap subtype screen failed promotion rules. More paid full-fidelity reruns are not recommended without a changed question/prefix.

### 12. Public and localhost UI surfaces

Status: implemented, with deployment hardening explicitly out of scope for internal localhost.

Evidence:

- `public/chat/index.html`, `public/chat/orientation-helpers.js`.
- `public/pilot/index.html`, `public/pilot-admin/index.html`.
- `public/adjudication/index.html` and routes in `routes/a19AdjudicationRoutes.js`.
- `public/eval/geist-explained*.html`, `public/eval/geist-in-the-machine.html`.
- `public/components/mermaid-file-viewer.js`, `rail-inject.js`, `techne.css`.
- Server/routes: `server.js`, `routes/chatRoutes.js`, `routes/evalRoutes.js`, `routes/pilotRoutes.js`, `routes/a19AdjudicationRoutes.js`.
- README points to a known localhost-only risk register: `notes/known-risks-localhost-2026-02-13.md`.

## Open problems / things to do

### P0. Human learner pilot is the highest-value next milestone

Priority: critical.  
Evidence: `TODO.md` §A1; `AGENTS.md`/`CLAUDE.md` human learner pilot notes; `services/pilotStore.js`; `routes/pilotRoutes.js`; `public/pilot/index.html`; `config/pilot/fractions-items.yaml`; `scripts/ingest-pilot-sessions.js`; `tests/pilot.test.js`.  
Next action: update pilot implementation to match the 2026-05-18 three-arm/two-session design, replace placeholder consent/items, add free-text explanation coding/export, add retention recontact/token flow, run internal dogfood N=5, then IRB/OSF/Prolific prep.  
Destination: root `TODO.md` §A1 and a dedicated pilot issue/runbook; paper only after real data exists.

### P0. Board/source-of-truth drift: missing `notes/paper-2-0/BOARD.md`

Priority: high.  
Evidence: `AGENTS.md` and root `TODO.md` refer to `notes/paper-2-0/BOARD.md`; the file is absent. `CLAUDE.md` says there is no separate `BOARD.md` in this fork and that active work lives under dated `notes/poetics/` and `notes/`. `notes/poetics/2026-06-06-development-board.html` also still refers to the absent board.  
Next action: choose one current planning source. Either create `notes/paper-2-0/BOARD.md` as a real Paper 2.0 board, or update `AGENTS.md`, `TODO.md`, and generated board prose to point at the actual dated-notes workflow.  
Destination: root TODO/docs cleanup; not a paper section.

### P0. Paper build lag: v3.0.166 markdown has no visible v3.0.166 PDF

Priority: high.  
Evidence: `docs/research/paper-full-2.0.md` has `version: "3.0.166"`; ignored PDFs visible under `docs/research/` stop at `paper-2.0-v3.0.165.pdf`; `docs/research/build.sh paper2` is the build path.  
Next action: run `cd docs/research && ./build.sh paper2`, inspect build output, and archive or publish the v3.0.166 PDF if successful.  
Destination: paper artifact maintenance; likely `notes/status/` or Paper 2.0 build checklist.

### P0. Evaluation DB has many stale `running` zero-test runs

Priority: high.  
Evidence: read-only SQLite snapshot found 780 `evaluation_runs`, 17,375 `evaluation_results`, 260 runs marked `running`, and 247 `running` runs with `total_tests=0`, many named `storeRejudgment propagation test`.  
Next action: audit whether these are test artifacts in the shared symlinked DB, then delete or mark them with a cleanup script after backup. Avoid broad deletion until the shared DB ownership is confirmed.  
Destination: root `TODO.md` maintenance or a separate DB-cleanup issue; script/test if recurring.

### P1. Poetics evidence archive gap

Priority: high.  
Evidence: `DRAMATIC-RECOGNITION-PLAN.md` lists open items: production-v1/v2 reproducible payload gap, Phase 0 deferrals, shuffled-turn/form-destruction scoring, section-reference cleanup, archive decision. `data/poetics.db` is empty in this checkout.  
Next action: decide whether summary `.md`/`.json` reports are the explicit evidence layer or recover/package raw sample/score/key payloads. Score the shuffled-turn controls or demote that gate explicitly.  
Destination: `DRAMATIC-RECOGNITION-PLAN.md` closeout section, `notes/poetics/`, and possibly root `TODO.md` if it remains long-horizon.

### P1. Plan 2.5 AF6 should remain sidecar until subtype/origin separation is solved

Priority: high.  
Evidence: `notes/poetics/2026-06-21-plan25-af6-negative-result-and-replay-next.md`; `notes/poetics/2026-06-21-plan25-af6-subtype-contrast-v1.md`; `exports/plan2_5-rhetorical-dramatic-eval/evaluation-loop-2026-06-20.md`.  
Next action: stop paid full-fidelity AF6 repeats on the current contrast. If continuing, change the question to a narrower mechanism study and choose a different prefix where concrete counts permit evidence-route closure.  
Destination: `notes/poetics/` diagnostic plan or a Plan 2.5 issue; no paper section yet.

### P1. Paper 2.0 validation scripts were not re-run in this audit

Priority: medium-high.  
Evidence: `notes/poetics/2026-06-21-drama-gen-optimizations-paper-sync.md` explicitly says a rigorous sync-check would run `scripts/validate-paper-manifest.js` and `scripts/generate-paper-tables.js`; this audit only ran hermetic tests.  
Next action: run those two validation scripts after the PDF build and fix any N/prose drift.  
Destination: paper validation checklist; possibly `notes/status/`.

### P1. Root TODO still contains stale/open-looking headers after resolved work

Priority: medium-high.  
Evidence: `TODO.md` G section says all five G-items are resolved, but individual headers such as G2/G5 still say "paper edit pending sign-off." Current `paper-full-2.0.md` includes the G fixes: v2.2 PCA wording at §5.2.1, `r=0.907` with N=32/current r≈0.87, `tutor_overall_score`/Sonnet/source-run wording in §6.5.1, and the A7 p-value/reproduction note in the revision history.  
Next action: normalize TODO headers to match actual resolved state, or annotate that the header text is preserved historical diagnosis.  
Destination: root `TODO.md`.

### P1. D1 mechanistic feature analysis has open follow-ups

Priority: medium.  
Evidence: `TODO.md` §D1 records Pass 6 multi-feature OLS and Pass 7 multi-turn replication as open; reports/scripts through pass 5 exist (`scripts/analyze-d1-*.js`, exports named in TODO).  
Next action: implement pure-JS multi-feature OLS over existing features, then replicate on a multi-turn run with dialogue-trace features.  
Destination: root `TODO.md` §D1, scripts/tests, paper §8.6/§7.10 only if results change claims.

### P1. D2 true cross-application role-reframed study is deferred

Priority: medium.  
Evidence: `TODO.md` §D2 Path 2; design note `notes/design-d2-path2-cross-application.md` is referenced but not seen in the top-level notes listing during this audit; Paper §6.6.7 states Path 1 is only adjacency, not true cross-application.  
Next action: verify the design note path, then decide whether to keep as separate-study scope or retire from current repo planning. If pursued, resolve therapy include/exclude and author role-reframed prompts/content/rubrics.  
Destination: root `TODO.md` §D2 and separate issue/study plan.

### P1. D5 rubric v3.0/PCA consolidation remains a design decision

Priority: medium.  
Evidence: `TODO.md` §D5; Paper §8.6 reports strong single-factor collapse in v2.2 dimensions; `scripts/analyze-rubric-pca.js` exists and Paper §5.2.1/§8.6 cite PCA results.  
Next action: decide between a v3.0 consolidated rubric, a two-factor rubric, or a discriminant-validity demonstration before changing instruments.  
Destination: root `TODO.md` §D5; future paper/rubric version work.

### P1. B8 poetics critic/scorer calibration is analytically complete but unresolved operationally

Priority: medium.  
Evidence: `TODO.md` §B8; scripts `scripts/analyze-recognition-origin-cut-sweep.js`, `scripts/analyze-recognition-origin-panel-recompose.js`; reports `exports/recognition-origin-cut-sweep.md`, `exports/recognition-origin-panel-recompose.md`; Paper revision history v3.0.110 discusses scorer-side saturation.  
Next action: before any future gated-arc rerun, pre-register the critic panel/CUT. Do not rerun generation to solve a scorer-side classifier issue.  
Destination: root `TODO.md` §B8 and poetics run protocol.

### P2. Localhost risk register should be verified or refreshed

Priority: medium.  
Evidence: README's known deferred risks section points to `notes/known-risks-localhost-2026-02-13.md`, but this file was not present in the initial `find notes -maxdepth 3` output. Public/routes surfaces include chat, pilot, pilot admin, adjudication, and eval pages.  
Next action: locate or recreate the localhost risk register, then check whether current server routes and admin endpoints still match its acceptance scope.  
Destination: docs/security/ops issue or README maintenance.

### P2. `data/poetics.db` empty path may confuse future agents

Priority: medium.  
Evidence: `data/poetics.db` is 0 bytes and has no tables, while package scripts include `poetics:ingest`, `poetics:report`, and `poetics:browse`.  
Next action: either remove/ignore the empty DB if obsolete, or run documented sidecar ingestion into a deliberate DB path and document the current source of truth.  
Destination: poetics docs/README; maybe root cleanup.

### P2. README is stale relative to in-housed `tutor-core` and current cell counts

Priority: medium.  
Evidence: README still describes `@machinespirits/tutor-core` as a peer dependency and says the package implements about 97 cells; `CLAUDE.md` says tutor-core is in-housed and `config/tutor-agents.yaml`/`EVAL_ONLY_PROFILES` now include many more cells.  
Next action: refresh README installation/architecture/cell-count language and link to `TUTOR-CORE-INHOUSING.md`.  
Destination: README/docs maintenance.

### P2. Generated/ignored artifact provenance needs an index

Priority: medium.  
Evidence: `exports/` is about 310 MB and contains many active evidence artifacts; `logs` points to a 6.9 GB private archive; reports are scattered across `exports/dramatic-derivation/`, `exports/plan2_5-rhetorical-dramatic-eval/`, `exports/plan2-*`, `exports/a19`, and other roots.  
Next action: create a lightweight `exports/INDEX.md` or `notes/status/artifact-index-*.md` mapping claim families to durable roots, especially for ignored/generated artifacts that cannot be inferred from Git.  
Destination: notes/status or exports documentation.

### P2. Open A18.38/fine-tuning ladder should remain not greenlit

Priority: low-medium.  
Evidence: `TODO.md` §A18.38 says stay weight-free; A15 retrieval rung was run-null; trusted channel widening is already met but still too fragile for Goodhart-prone weight updates.  
Next action: leave as design pointer unless a new trusted, stable training signal appears.  
Destination: root `TODO.md`, no implementation issue now.

### P3. Optional cleanup: Paper 1.0 residue and local backups

Priority: low.  
Evidence: `TODO.md` §C7 says Paper 1.0 audit residue is closed but kept for history; §C1 says local `data/evaluations.db.bak-*` backups were a previous optional cleanup item. This checkout currently uses a symlinked DB rather than local backup files visible in `data/`.  
Next action: no action unless disk pressure or historical Paper 1.0 tooling confusion resurfaces.  
Destination: cleanup issue only if needed.

## Recommended next concrete tasks

1. Fix planning-source drift: decide whether to restore `notes/paper-2-0/BOARD.md` or update `AGENTS.md`, `TODO.md`, and `notes/poetics/2026-06-06-development-board.html` to the dated-notes model.
2. Build and inspect the current Paper 2.0 PDF: `cd docs/research && ./build.sh paper2`; confirm a `paper-2.0-v3.0.166.pdf` artifact exists.
3. Run paper validation: `node scripts/validate-paper-manifest.js` and `node scripts/generate-paper-tables.js`; fix any drift before treating v3.0.166 as the current release artifact.
4. Clean or quarantine the DB's zero-test `running` rows after backup/ownership check; at minimum write a read-only report listing counts and examples.
5. Close the poetics archive gap: decide summary-only vs raw-payload evidence, then update `DRAMATIC-RECOGNITION-PLAN.md`.
6. Keep Plan 2.5 AF6 as diagnostic sidecar; do not spend on another full-fidelity battery until the subtype/origin question and prefix are redesigned.
7. Start A1 pilot readiness work if the research program needs a new decisive empirical step: consent/items/free-text/retention/IRB/dogfood are now higher leverage than another simulated run.

## Commands run for this audit

Read-only/validation commands included:

```bash
sed -n '1,260p' AGENTS.md
sed -n '1,260p' CLAUDE.md
sed -n '1,220p' README.md
rg -n "^(#|##|###|####) " TODO.md
find notes -maxdepth 3 -type f
find exports -maxdepth 3 -type f
git status --short --branch
git log --oneline --decorate --graph -n 40
node -e "const p=require('./package.json'); console.log(JSON.stringify({scripts:p.scripts},null,2))"
npm run test:hermetic
sqlite3 data/evaluations.db "SELECT COUNT(*) FROM evaluation_runs; SELECT COUNT(*) FROM evaluation_results;"
sqlite3 data/evaluations.db "SELECT status, COUNT(*) FROM evaluation_runs GROUP BY status;"
sqlite3 data/poetics.db ".tables"
```

No paid/API evaluation jobs were run.
