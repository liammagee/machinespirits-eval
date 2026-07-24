# Codebase Refactoring Review and Execution Plan

## Status

- Review date: 2026-07-24
- Structural-audit snapshot: `2a5d898178cbb4c3544caad4d655b433b6e40c87`
- Reconciled current main: `0f04094c` (includes merged PR #177 test/coverage foundation)
- Branch: `codex/codebase-refactoring-review`
- Scope: tracked application, test, configuration, packaging, and build surfaces
- Excluded from complexity ranking: generated artifacts, frozen empirical outputs,
  fixtures, vendored code, lockfiles, and generated workplan views
- Model/API spend: none

This is an execution plan, not an instruction to delete everything that a static
scan cannot reach. Machine Spirits is both an application and a research archive.
Historical cells, scripts, compatibility fields, and frozen outputs can have no
live caller while still carrying provenance. Every removal below therefore has a
consumer, database, paper, and artifact gate appropriate to its risk.

## Executive decision

The repository does not need a general rewrite. Its maintainability risk is
concentrated in four forms:

1. A few very large orchestration functions combine command parsing, domain
   policy, persistence, transport, and presentation.
2. The test suite is broad and now includes in-housed tutor-core plus risk-based
   coverage, but clean CI still silently skips important artifact-backed tests
   and branch coverage is uneven on the largest dispatchers.
3. A small amount of duplicated registry, projection, provider, and validation
   logic creates drift across otherwise well-tested surfaces.
4. Historical and live tooling share the same package and source namespaces,
   making dead-code decisions and packaging larger and riskier than necessary.

The correct order is: build on the now-merged test/coverage foundation by closing
its remaining skip and fixture blind spots; remove cycles and exact duplication;
finish the existing runtime facades; then decompose tutor-stub, evaluation,
dramatic derivation, and presentation in bounded slices. Deletion is the last
step for any research- or compatibility-bearing surface.

## Baseline

### Repository shape

| Measure | Structural-audit snapshot (`2a5d8981`) | Interpretation |
|---|---:|---|
| Tracked JavaScript-family files | 1,323 | Includes tests, archived scripts, and generated helper code. |
| Tracked JavaScript-family lines | 578,472 | Not a production-only measure. |
| Non-test production JavaScript files | 797 | `scripts`, `services`, `routes`, `tutor-core`, `desktop`, and `public`, excluding tests, fixtures, archive, and vendor. |
| Non-test production JavaScript lines | 428,445 | The useful denominator for structural work. |
| `scripts/` files / lines | 441 / 249,246 | 58.2% of production JavaScript; research CLIs are a first-class architecture surface. |
| Files at least 5,000 lines | 7 | All JavaScript-family files. |
| Files 2,000–4,999 lines | 27 | All JavaScript-family files. |
| Files 1,000–1,999 lines | 66 | One hundred files are at least 1,000 lines. |
| Files 500–999 lines | 187 | Size alone is not a deletion or extraction rule. |
| npm scripts | 282 | Forty-one `derivation:*` and forty-one `poetics:*`; many are reproducibility entry points. |
| Runtime environment keys | 247 unique keys in 162 files | 671 direct `process.env` references across scripts/services/routes/core/desktop. |
| Static relative-import cycles | 2 | Both are concrete and removable. |
| Current YAML profiles | 205 | 204 `cell_*` profiles plus `budget`. |
| `EVAL_ONLY_PROFILES` names | 214 | 204 current cells plus 10 aliases; this is a duplicated registry. |
| Tracked `exports/**` files / lines | 912 / 13,434,475 | Frozen/generated evidence, excluded from source-complexity metrics. |

The package surface is also broader than the application surface. At the
structural-audit snapshot, `npm pack --dry-run --json` reported a 20.4 MB
tarball, 40.1 MB unpacked, and 1,354 entries. The `scripts/` payload alone was
480 files and 10.6 MB, including eleven explicitly archived one-offs.

PR #177 then added the hermetic/risk-coverage infrastructure. At reconciled
main, the corresponding drift is small and explained: 1,327 tracked
JavaScript-family files / 579,285 lines, 442 `scripts/` files / 249,678 lines,
286 npm scripts, and a 1,356-entry package whose `scripts/` payload is 481 files
/ 10,627,695 bytes. The root package also wildcard-exports `services/*`, so an
apparently internal unused export may still be a public API. Re-run the metric
script at the start of each implementation slice rather than treating either
snapshot as a permanent baseline.

### Test and coverage baseline

The cast-layer reader-quality test depends on an absent gitignored matrix under
`exports/`. A restricted-sandbox run also confirmed that two voice tests require
permission to bind `127.0.0.1`; their isolated cases passed 2/2 once loopback
binding was permitted. These observations explain environment boundaries but
are not presented as the current test inventory.

While this review was being consolidated, PR #177 merged at `0f04094c` and
completed `make-inhoused-tests-and-coverage-first-class`. Current main now runs
the root Node phase and all ten in-housed Vitest files from one hermetic command,
uses `npm ci` in CI, removes the obsolete published tutor-core install, adds a
natural-teardown lane, and enforces versioned risk-based coverage floors. The
PR feature branch recorded 6,494 root tests (one skip) plus 133/133 tutor-core
tests before merging across PR #176. Reconciled current main discovers 6,544
root tests; the additional 50 are the intervening tutor-stub work, not test
runner drift. The restricted verification host still encounters the documented
loopback permission boundary, so this review records discovery rather than
claiming another unrestricted full-main pass.

Clean CI is less complete than the local result suggests:

- Thirty-two first-draft outer-loop tests and nine campaign tests skip unless
  `/Users/lmagee/Dev/.tutor-stub-auto-eval` exists.
- The cast-layer scorer skips without a gitignored export matrix.
- Three dialogue-structure suites read `logs/tutor-dialogues` directly instead
  of the hermetic log override and skip when it is absent.
- One PTY concurrency case explicitly skips under `CI`.
- Two runtime-fingerprint cases skip when local model CLIs are unavailable.

The structural-audit root suite was independently run with Node's built-in
coverage over
`services/**`, `routes/**`, `tutor-core/services/**`, and the four largest live
scripts. This is a selected runtime baseline, not repository-wide coverage and
not the narrower risk-floor configuration now in CI:

| Surface | Line | Branch | Function |
|---|---:|---:|---:|
| Selected runtime total | 80.26% | 69.90% | 87.30% |
| `scripts/tutor-stub.js` | 75.70% | 47.13% | 81.70% |
| `scripts/eval-cli.js` | 18.22% | 38.06% | 17.61% |
| `scripts/browse-poetics-scripts.js` | 67.70% | 65.69% | 55.64% |
| `scripts/run-tutor-stub-auto-eval.js` | 89.47% | 54.92% | 91.29% |
| `routes/evalRoutes.js` | 39.74% | 53.19% | 57.03% |
| `tutor-core/services/dialecticalEngine.js` | 40.09% | 21.95% | 37.50% |
| `tutor-core/services/tutorDialogueEngine.js` | 56.76% | 34.19% | 51.00% |
| `tutor-core/services/dialogueLogService.js` | 27.63% | 65.22% | 41.67% |
| `tutor-core/services/learnerIntegrationService.js` | 22.80% | 66.67% | 8.33% |

Current main's committed CI risk groups pass at:

| Risk group | Line | Branch | Function |
|---|---:|---:|---:|
| Evaluation store | 82.20% | 64.62% | 75.00% |
| Admin/auth | 91.27% | 78.65% | 90.91% |
| Evaluator/provenance | 56.74% | 57.14% | 51.69% |
| Labelling save state | 77.21% | 67.32% | 83.85% |
| Tutor-core recognition/memory | 85.34% | 72.96% | 82.43% |

The signal is not “there are few tests.” The signal is that some large
dispatch/orchestration branches are weakly exercised, several important tests
are environment-conditional, and the currently green aggregate can conceal both.

## Structural hotspots

Cyclomatic figures below come from ESLint v9's complexity calculation. They are
used to rank work, not as claims that every branch is equally difficult.

| Rank | Surface | Evidence | Proposed seam |
|---:|---|---|---|
| 1 | `scripts/tutor-stub.js` | 25,813 lines; 83 internal imports. `main` spans 10,225 lines (complexity 529), `callTutor` 2,013 (257), and `executeSlashCommand` 626 (170). | Keep a thin CLI adapter; move real command handlers, turn orchestration, and presentation behind the existing session runtime. |
| 2 | `scripts/eval-cli.js` | 6,642 lines. `main` spans 5,045 lines (complexity 793) across 22 command labels; nested multi-turn evaluation is 975 lines. | One command module per use case; no scoring/domain logic in the CLI. |
| 3 | `services/dramaticDerivation/engine.js` | 2,885 lines; `runDrama` occupies 2,582 lines (complexity 544). | Explicit transition phases around a stable state object. |
| 4 | `services/dramaticDerivation/llmRoles.js` | 5,528 lines. `makeLlmTutor` is 2,598 lines; returned `tutorFn` is 2,111 lines (complexity 502). | Prompt builders, provider port, conduct policy, release arbitration, tutor role, and learner role. |
| 5 | `services/evaluationRunner.js` | 6,832 lines. `runMultiTurnTest` is 1,776 lines (complexity 519); the file also owns resolution, transports, scheduling, reports, resume, and rejudging. | Profile registry, trace projection, single/multi executors, resume, and rejudge services behind a compatibility facade. |
| 6 | `scripts/browse-poetics-scripts.js` | 13,237 lines; 79 GET/POST handlers plus nine mounts; several 600–2,075-line renderers. | Domain routers and static/template presentation assets. |
| 7 | `scripts/run-tutor-stub-auto-eval.js` | 11,447 lines; at least 4,096 lines are embedded CSS/client/render functions. | Evaluation application service separate from report renderer/assets. |
| 8 | `services/tutorStubFirstDraftOuterLoop.js` | 4,587 lines; main validator 2,177 lines. Version-specific branches and machine paths encode contract data. | Generic validator plus versioned, repo-relative contract fixtures. |
| 9 | `tutor-core/services/tutorDialogueEngine.js` | 3,922 lines; `runDialogue` 802 lines (complexity 238), `_fetchProvider` 133. | Dialogue transitions separate from provider and logging adapters. |
| 10 | `routes/evalRoutes.js` | 3,870 lines and 50 endpoints; SSE recognition callback is 376 lines. | Thin routers grouped by sessions/config/runs/logs/monitoring/streaming. |
| 11 | `services/evaluationStore.js` | 3,410 lines and 30 production importers. It opens/migrates at import time and owns all repositories, projections, recovery, CSV, and rejudgment persistence. | Explicit connection/migration lifecycle and repository modules behind the current export facade. |
| 12 | `services/rubricEvaluator.js` | 3,404 lines. Provider transport, response repair, all rubric families, transcript projection, and prompts are coupled. | Transport/parser, rubric registry, projections, and evaluator use cases. |

`public/components/fauna-overlay.js` is a 1,084-line class, but its 42 methods
are individually bounded; it is a lower priority than the procedural workflows
above.

## Cross-cutting findings

### Dependency cycles

There are two static cycles:

1. `tutorDialogueEngine` ↔ `writingPadService`, with `dialecticalEngine`,
   `learnerIntegrationService`, and `memoryDynamicsService` also participating.
   The key inversion is `writingPadService` importing `isQuietOrTranscript`
   from the dialogue orchestrator.
2. `tutorStubResponseConfiguration` → `tutorStubDramaticRelease` →
   `tutorStubSourceAccessibilityContract` → `tutorStubResponseConfiguration`.

Break these by moving logging/quiet mode, surface-accessibility measurements,
role-voice predicates, and shared schema constants into dependency-free leaf
modules. Do this before moving the larger orchestrators.

### Confirmed duplication

The following are concrete, not similarity guesses:

- Adaptive trace projection is duplicated between `eval-cli.js` and
  `evaluationRunner.js`: scenario context, trace-to-dialogue conversion, and
  learner-turn extraction.
- Five field-policy helpers exported by `tutorStubFieldTrajectory.js` are copied
  into `tutorStubRegisterPolicy.js` (91 repeated lines).
- `auditForbiddenKeys` has six exact dramatic-derivation copies plus one
  parameter-only variant in `conductPolicy.js`; the shared helper must accept
  the forbidden-key set rather than hard-code either list.
- A 26-line `callClaudeCode` adapter appears in four scripts despite the shared
  `cliProviderBridge.js`.
- `lightweightFieldTurn` exists in both tutor-stub and auto-eval and has already
  drifted: the CLI version carries newer progression, overreach,
  self-assessment, and calculation fields.

Move one implementation at a time, add fixture equality before deletion, and
preserve compatibility exports until callers migrate.

### Registry drift

`config/tutor-agents.yaml` and `EVAL_ONLY_PROFILES` are two sources of truth.
Current cells happen to be fully represented, but `validate-config` checks only
registry names missing from YAML, not YAML cells missing from the registry. Ten
legacy aliases sit beside 204 canonical cells, and some unresolved aliases fall
back to generic profiles.

The tutor-stub command registry is a strong partial improvement: it freezes 42
commands and 57 tokens. However, its handler identifiers currently funnel
through generic wrappers to the 626-line conditional dispatcher in
`tutor-stub.js`. Registry tests catch token drift, not a registered command wired
to the wrong semantics.

Prefer the existing engagement-register pattern: declarative source, validated
schema, small accessor facade, and exact two-way invariants.

### Runtime correctness and test gaps found during the review

These are not all refactors, but they change the safe order of refactoring:

- `pilotStore` can write pre/post/exit artifacts before rejecting a state
  transition; tutor turn pairs are not atomic. Existing P1 card:
  `make-pilot-state-writes-atomic`.
- Direct model subprocesses in `rubricEvaluator`, adaptive `realLLM`, and
  dramatic-derivation `llmClient` inherit the ambient environment outside the
  tested provider boundary. Existing P1 card:
  `isolate-remaining-direct-model-subprocesses`.
- Human-labelling debounced/in-flight saves can be lost across navigation;
  coder identifiers can collide; impasse sidecars lack corpus hashes. Existing
  P1 card: `harden-consolidated-labelling-integrity`.
- `tests/rubricEvaluator.test.js` tests a hand-copied parser even though
  production now exports `parseJudgeResponse`. A false-green parser suite must
  be replaced before splitting the evaluator.
- Research-integrity CLIs (`validate-paper-manifest`, `validate-provenance`, and
  `audit-message-chain`) have no hermetic fixture-to-exit tests because private
  data is absent in CI. Their pure parsers and validators can still be tested.
- Empirical flags including `OEDIPUS_PREMISE_LICENSE`,
  `OEDIPUS_ADVERSARIAL_CONTROL`, `OEDIPUS_SUPEREGO_V1`,
  `EVAL_WRITING_PAD_DISABLED`, and `MS_DESKTOP_NO_CSP` lack table-driven branch
  tests.
- `dialogueLogService` reads a hard-coded log root while the runner redirects
  writes. Reachable API tests assert only status/array shape, so an empty wrong
  directory passes.
- `cleanupAllStreams()` tracks a plausible shutdown responsibility in
  `evalRoutes.js` but has no caller. Wire it into tested graceful shutdown or
  delete it; do not leave intention-shaped dead code.

### Dead-code and retention candidates

| Confidence | Candidate | Evidence | Required disposition gate |
|---|---|---|---|
| High that runtime is orphaned; medium deletion risk | `tutor-core/services/recognitionOrchestrator.js` | 496 lines, no production caller, barrel-exported and tested; live engine mirrors its required write inline. | Search downstream package consumers; deprecate/remove through an API boundary with its test and export. |
| High that aliases are redundant; high historical risk | Four `*_paid` aliases and other legacy profile aliases | Registry/YAML mismatch; several names occur nowhere else and resolve through fallback. | Query the real DB, tracked exports, notes, and invocation history; replace retained names with an explicit alias map. |
| Medium | Deprecated cells 34–39 | YAML says never run and superseded; only definitions/registry references found. | Query DB and frozen artifacts. Move to a historical config fixture rather than erase if provenance value remains. |
| High unused internally; medium API risk | Nine exact-one-reference exports in adaptive/register/epoch modules | Symbol occurs only at its declaration. | Search external consumers; use constants in live code where duplication exists, otherwise unexport/remove. |
| High one-off; medium provenance risk | `analyze-validation-failures.js`, `audit-claims.js` | No external references; hard-coded old/missing paths (`config/scenarios.yaml`, `/tmp/pd-final.json`). | Search paper/notes/shell history; archive with provenance or delete. |
| Medium | Five other zero-reference analysis/backfill CLIs | Dated run/artifact defaults; direct human invocation is invisible to static analysis. | Check analysis registry, paper citations, notes, and historical commands before archiving. |
| High alias duplication; low risk | `shootout:model`, `paper:integrity-audit` | Identical to documented npm commands; aliases themselves unreferenced. | One release-note and downstream-command search, then remove. |
| High packaging excess; medium consumer risk | Entire `scripts/` package payload | Ships archived and private research tooling in public tarball. | Define supported package CLIs/imports, narrow `files`, install the tarball in a clean temp project, smoke all documented entry points. |
| Medium | `.codex-tmp/feature-tracker/*.mjs` | 3,161 lines under a temp/tool-excluded namespace, imports undeclared `@oai/artifact-tool`, and has no live command. | Move to a supported tooling location with a runtime contract, or archive beside its generated tracker evidence. |
| Architecture decision required | `services/memory/learnerMemoryService.js` | 1,400 lines, import-time SQLite, no default production-runtime consumer and no direct service test; two tracked experiment consumers remain (`run-rich-memory-arc-experiment.js`, the documented live-tutor path, and `smoke-rich-memory-arc.js`). | Execute existing P2 card `decide-rich-learner-memory-service-retention`; characterize/migrate both experiment CLIs and do not delete opportunistically. |
| Design artifact | `config/adaptation-discrimination-scenarios.yaml` | Only the implementation plan references it; live tooling uses a differently shaped JSON suite. | Compare semantics, then archive beside the plan or wire it deliberately. |

Sixty scripts met a broad “not package-registered, not documented by exact path,
and no static incoming import” heuristic. That is a review queue, not a dead-code
count. Direct CLI invocation, dynamic paths, and paper provenance make automated
deletion unsafe.

## Protected boundaries

The following are frozen until an explicit migration proves parity:

- Database columns, append-only migrations, legacy score aliases, result-row
  projections, and historical `profile_name` values.
- Tutor/learner bilateral trace labels, deliberation ordering, score symmetry,
  and old `user` label compatibility.
- Cell architecture, prompt/config hashes, scenario sources, rubric versions,
  and the current runner dispatch boundary.
- CLI command tokens, completion/help output, trace event ordering, exit codes,
  and public-versus-research projections.
- HTTP route/auth/metering/CSP behavior and desktop/web route parity.
- Frozen evaluation outputs, paper-cited scripts/configs, archived one-shots,
  and reproducibility artifacts.
- Public package exports until an external-consumer and semver audit says they
  can change.

Specific static false positives to retain intentionally include
`services/tutorBlueprint.js` (a test-time architecture validator), Electron
entry points invoked from package metadata, dynamically resolved adaptive
configs, and archived one-shot scripts kept as historical method records.

## Target architecture

The dependency direction for extracted code is:

```text
CLI / HTTP / Electron adapters
  -> application use cases and controllers
    -> domain policies and state transitions
      -> pure contracts, schemas, projections, and value helpers

DB / filesystem / model / voice / process implementations
  -> injected ports consumed by application use cases
```

Rules:

- Services never import scripts or route modules.
- Domain policy never reads ambient process state, opens a database, spawns a
  process, or renders HTML.
- Compatibility facades preserve current imports while internal callers migrate
  to direct modules.
- Provider, storage, clock, random, filesystem, voice, and process behavior are
  injected where branch testing needs control.
- Version-specific research contracts live as validated data when they are
  observations/expectations rather than algorithms.

## Sequenced programme

### R0 — Close the remaining safety-net blind spots

Priority: P1. Start here, but do not redo the foundation. PR #177 completed
`make-inhoused-tests-and-coverage-first-class`: root plus tutor-core execution,
clean `npm ci`, CI risk coverage, and a focused natural-teardown path are now on
main.

#### R0.1 Required-run manifest and skip ledger

- Build on the current deterministic discovery helpers with a checked-in
  required-run manifest for root, tutor-core, and intentional fixture
  exclusions.
- Classify the nested captured-failure test as an explicit fixture exclusion.
- Emit selected file count, test count, skip count, and skip reasons for each
  phase.
- Fail CI on an unexpected skip or a required suite that executed zero tests.
- Keep the current Node 20/22 root gate and Node 22 risk-coverage gate.

Gate: the existing clean command still runs root plus in-housed suites, and its
required file/skip manifest is exact on a clean host.

#### R0.2 Remove environment-dependent false greens

- Replace the absolute V-series artifact path with a configurable, repo-relative
  fixture root and commit/generate minimal deterministic fixtures. Treat those
  fixtures as synthetic/derived CI inputs: do not change the closed V17–V53
  historical hashes, expected verdicts, or provenance contract recorded by
  `tutor-stub-first-draft-series` and `adaptive-eval-immutable-provenance`.
- Split large historical fingerprint tests from pure validator/state-machine
  tests so the latter always gate CI.
- Make dialogue-structure tests honor `EVAL_LOGS_DIR` and seed hermetic logs.
- Replace the cast-layer gitignored matrix dependency with a miniature tracked
  fixture or an explicit non-CI integration lane.
- Add a permitted PTY/loopback lane rather than silently dropping concurrency
  behavior under `CI`.

Gate: a clean checkout has zero accidental skips; any retained optional skip is
named in a machine-readable allowlist with an owner and reason.

#### R0.3 Extend risk coverage and natural teardown

- Extend `scripts/run-risk-coverage.js` and
  `config/coverage-risk-floors.json` to the large command/route/dialogue
  dispatchers before they are extracted.
- Keep JSON, LCOV, and Markdown output plus named-source presence checks.
- Ratchet from the committed per-group baselines; do not replace them with an
  arbitrary global floor.
- Expand the existing no-`--test-force-exit` path to stores, servers, PTYs, and
  child processes as explicit close/reset APIs land; replace scheduler sleeps
  with barriers/fake clocks.

Gate: changed high-risk modules cannot lower their recorded line/branch/function
coverage, and the focused lifecycle lane exits naturally.

#### R0.4 Characterization gaps needed by later phases

- Import and test production `parseJudgeResponse`; delete the copied test parser.
- Add hermetic fixture/exit-code tests for paper manifest, provenance, and
  message-chain validators.
- Add table-driven subprocess tests for the untested mechanism/CSP/writing-pad
  environment flags.
- Add data-bearing log API tests and tested graceful SSE shutdown.

Gate: every later extraction in R2–R6 names the characterization tests that
freeze its public behavior before code movement starts.

### R1 — Remove cycles, exact duplication, and registry ambiguity

Priority: P1. These are the lowest-risk structural wins, but only independent
leaf-helper and registry slices may proceed in parallel. Provider consolidation
depends on `isolate-remaining-direct-model-subprocesses`; tutor-stub handler
migration depends on the browser/Electron parity gate being executable. Each PR
must name its existing or newly added R0 characterization and coverage gate.

#### R1.1 Break the tutor-core import cycle

- Create a dependency-free leaf module for dialogue logging/quiet-mode helpers.
- Move, do not copy, the relevant functions/constants.
- Add a static cycle check and ratchet `2 -> 1`.

Gate: the tutor-core cycle is gone, public exports are unchanged, and focused
dialogue/writing-pad tests pass.

#### R1.2 Break the tutor-stub response-configuration cycle

- Extract dependency-free public accessibility/schema predicates and shared
  response-contract constants.
- Move, do not copy, the relevant functions/constants.
- Ratchet the static cycle check `1 -> 0`.

Gate: import-cycle count is zero, public exports are unchanged, and focused
response-configuration/release/accessibility tests pass.

#### R1.3 Consolidate exact duplicates

Treat each family as its own child card and PR:

1. Adaptive trace projection.
2. Field trajectory/policy helpers, explicitly as a follow-up to the completed
   `tutor-stub-register-policy-extraction` card.
3. Forbidden-key auditing.
4. Lightweight tutor-stub field-turn projection.
5. Provider CLI calls through `cliProviderBridge`, only after
   `isolate-remaining-direct-model-subprocesses` establishes the retained
   process/security contract.

Gate for every child: old/new outputs are deep- or byte-equal on frozen fixtures
before its old copy is removed. No child may redesign the data shape.

#### R1.4 Establish canonical registries

- Derive canonical evaluation cells from YAML or a generated validated manifest.
- Separate legacy aliases into an explicit, documented alias map.
- Make `validate-config` a two-way equality check.
- Make every tutor-stub command registry handler resolve to a distinct callable
  implementation; fail closed on missing/duplicate/wrong handler mappings.
- Keep `dramaticDerivation/index.js` as an external compatibility facade while
  migrating internal callers to direct imports.

Gate: all 204 current cell names match exactly; intentional aliases are tested;
no profile silently falls back; all 42 commands have semantic handler coverage.
Run the cell-config auditor for any cell/config registry change.

### R2 — Repair correctness boundaries before moving their code

Priority: P1 for the first five integrity gates; the rich-memory retention
decision remains P2. Execute existing cards rather than making duplicate work:

1. `make-pilot-state-writes-atomic`
2. `isolate-remaining-direct-model-subprocesses`
3. `harden-consolidated-labelling-integrity`
4. `automate-browser-and-packaged-electron-tutor-stub-acceptance`
5. `test-canonical-posthoc-analysis-pipeline` (done; preserve its golden gate)
6. `decide-rich-learner-memory-service-retention` (P2 decision gate)

Add new child cards only for the uncovered parser/validator, log-root/SSE, and
CI-skip work. The programme card links all of these.

Gate: no refactor of pilot, provider, human-coding, browser/Electron, or rich
memory code starts before its corresponding integrity decision/test is present.

### R3 — Finish the tutor-stub application/runtime separation

Priority: P1. Build on the existing command registry, capability registry,
session runtime, session host, voice bridge, and process-session factory rather
than introducing another runtime.

Slice order:

1. Extract pure formatting, debug, learning-summary, field projection, and
   terminal rendering helpers.
2. After the browser/Electron acceptance card has an executable host matrix and
   fake-provider gate, replace generic command wrappers one handler group at a
   time: settings; model/character/register; scenario/curriculum; reports;
   browser/voice; lifecycle.
3. Move `callTutor` behind a provider/response application service.
4. Move `runOneTurn` and compound-turn coordination behind the session runtime.
5. Leave `scripts/tutor-stub.js` as argument parsing, terminal wiring, and
   process bootstrap.

Per-slice gates:

- command tokens/help/completion and trace event ordering are unchanged;
- fake-provider golden traces match for passthrough, direct, scaffold, mixed,
  auto, curriculum, resume, reset, cancellation, and finalize;
- learner-safe/public and research/private projections remain separated;
- process HTTP rejects terminal-only effects exactly as before;
- tutor and learner controls remain symmetric;
- `scripts/tutor-stub.js` and its largest functions strictly shrink.

Programme exit: the script is a bounded adapter (target at most 2,000 lines), no
single application function exceeds 300 lines, and branch coverage of the moved
command/turn logic ratchets upward by slice. The observed 47.13% branch figure
is informational until R0.3 reproduces it under a named checked-in risk group
with JSON/LCOV output; that committed result, not the ad-hoc audit figure, is the
R3 floor.

### R4 — Separate evaluation CLI, runner, persistence, and rubric use cases

Priority: P1. Preserve `evaluationRunner.js`, `evaluationStore.js`, and
`rubricEvaluator.js` as compatibility facades until callers migrate.

Slice order:

1. Land the canonical cell/alias registry and shared adaptive trace projection
   from R1.
2. Extract single-turn and multi-turn execution services.
3. Extract resume/checkpoint and rejudge services.
4. Move each `eval-cli` command into a command module that only parses input,
   calls a use case, and renders output.
5. Inventory all storage importers, application entrypoints, package consumers,
   and import-time side-effect expectations; characterize them before moving
   persistence code.
6. Split storage behind the existing facade into connection/migrations, run
   repository, result repository, interaction repository,
   projections/statistics, and exporters.
7. Migrate application entrypoints explicitly, one host/use case at a time,
   while preserving facade import behavior for unmigrated and package
   consumers.
8. Remove import-time migration/bootstrap only after the caller inventory is
   empty and the packed-package consumer smoke proves the new startup contract.
9. Split rubric transport/parser, registry/prompt construction, transcript
   projection, and evaluator families.
10. Divide `evalRoutes` by sessions, configuration, runs/results, logs,
   monitoring, and streaming, preserving mount/auth order.

Per-slice gates:

- fixture DB rows, CSV, manifests, trace projections, and score shapes are
  deep-equal;
- old/new run, resume, evaluate, and rejudge commands have matching exit/output
  contracts;
- no cross-rubric, cross-judge, config-hash, dialogue-hash, or attempt-index
  drift is admitted;
- database migrations remain append-only and production DB paths are never
  touched by tests;
- route manifest, auth, metering, SSE cleanup, and status semantics are frozen;
- symmetry reviewer signs off on any trace/scoring/data-structure movement.

Programme exit: `eval-cli` contains no scoring logic; runner and store facades
delegate to bounded use cases/repositories; touched branch coverage rises from
the current weak CLI/route/core baselines without reducing selected-runtime
aggregate coverage.

### R5 — Decompose dramatic derivation around explicit transitions

Priority: P1/P2 after R1 and R0 characterization.

Slice order:

1. Extract shared audits and provider calls from R1.
2. Represent `runDrama` as named pure transition phases over one explicit state
   contract; keep the existing entrypoint.
3. Split `llmRoles` into prompt builders, provider adapter, conduct policy,
   release/lemma arbitration, tutor role, and learner role.
4. Reduce the 330-name barrel to an external compatibility facade; internal
   modules import direct dependencies.
5. Move first-draft V-series hashes, paths, observations, and expected results
   into versioned repo-relative contract data while retaining a generic
   validator/state machine. This is a representation migration of the closed
   `tutor-stub-first-draft-series` contract: historical hashes, expected
   verdicts, and immutable provenance must remain byte-identical.

Gate: deterministic mock derivation events, frozen replay, proof/release ledgers,
learner-visible text, and reports are byte- or deep-equal. Run
`npm run derivation:test`; no paid/provider-backed generation is required.

### R6 — Separate browser/report presentation from application logic

Priority: P2; safe to parallelize once R0/R2 browser gates exist.

For the poetics browser:

- mount domain routers for compose, derivation, replay, workplan, jobs, GitHub,
  curriculum, ontology, and documentation;
- move HTML templates, CSS, and client JavaScript out of the executable script;
- keep one application factory and route manifest.

For tutor-stub auto-eval:

- separate generation/resume/indexing from report projection;
- move the 2,150-line CSS, 1,003-line visualization renderer, and 943-line
  client script to versioned presentation modules/assets;
- reuse the canonical lightweight field projection from R1.

Gate: route/auth/CSP/mount order is unchanged; saved HTML/report artifacts are
golden-tested; live web and packaged Electron complete create → turn →
interrupt/reset → finalize → export with a fake provider; accessibility and
keyboard/text fallback remain green.

### R7 — Govern live, historical, and package surfaces

Priority: P2. This is the point at which confirmed dead code is actually
removed or archived.

1. Create a machine-readable candidate manifest with fields for runtime caller,
   test caller, package export, npm command, paper/notes/artifact reference,
   database occurrence, owner, confidence, and disposition.
2. Audit `recognitionOrchestrator`, legacy cell/profile aliases, exact-one-
   reference exports, zero-reference CLIs, the discrimination YAML, and
   `.codex-tmp` tracker against that manifest.
3. Use three dispositions: supported/live; historical/frozen; remove after
   migration. Do not use “unreferenced” as a disposition.
4. Narrow package `files`/exports to supported consumers and explicitly exclude
   archived one-offs. Test the packed tarball from a clean temporary install.
5. Remove the two duplicate npm aliases after compatibility search.
6. Keep `scripts/ANALYSIS-SCRIPTS.md` and package commands as an intentional
   catalogue of reproducible research entry points.

Gate: every removed path has zero live/package/paper/DB dependence or a recorded
migration; the package smoke passes; frozen provenance remains discoverable.

### R8 — Reduce configuration and command sprawl without erasing experiments

Priority: P2, incremental.

- Generate an environment inventory with name, owner, scope, default,
  sensitivity, parser, and provenance behavior.
- Route shared runtime services through injected typed configuration; leave
  one-off research scripts explicit until they are promoted.
- Add table-driven tests for boolean/enum/numeric parsing and invalid values.
- Consolidate clusters of npm aliases behind stable CLIs (`eval`, derivation,
  poetics, tutor-stub, workplan) while preserving named reproducibility recipes
  as data/manifests where their exact command matters.
- Require new environment keys and npm commands to declare an owner and test.

Gate: no ambient secret/config copying in services; shared keys have one parser;
the current measured command catalogue (286 entries at reconciled main) becomes
categorized and validated, not merely shorter.

## First executable queue

These are deliberately bounded to one domain seam each. A row is a proposed
child card and PR, not a batch milestone:

| Order | Proposed branch / child card | Scope | Proof |
|---:|---|---|---|
| 1 | `codex/refactor-required-run-manifest` | Required file/test/skip manifest and unexpected-skip failure only. | Clean root/core discovery is exact; optional skips have owner/reason. |
| 2 | `codex/refactor-v-series-fixtures` | Repo-relative first-draft outer-loop/campaign validator fixtures only; depend on and link the closed series/provenance cards. | Forty-one host-path-gated cases run on a clean host; historical hashes/verdicts stay byte-identical. |
| 3 | `codex/refactor-dialogue-log-fixtures` | Make structure tests honor `EVAL_LOGS_DIR` and seed minimal logs. | Data-bearing hermetic log assertions; no private logs required. |
| 4 | `codex/refactor-cast-layer-fixture` | Track/generate a minimal cast-layer scorer matrix. | Scorer test runs or is declared in the explicit optional integration ledger. |
| 5 | `codex/refactor-pty-ci-lane` | Run the currently CI-skipped PTY concurrency case in a permitted lane. | Same assertion runs under CI with deterministic teardown. |
| 6 | `codex/refactor-rubric-parser-tests` | Import production `parseJudgeResponse`; remove the copied parser. | Existing malformed corpus passes against active v2.1/v2.2 dimensions. |
| 7 | `codex/refactor-tutor-core-cycle` | Extract dialogue logging/quiet-mode leaf helper only. | Static cycles `2 -> 1`; focused parity tests. |
| 8 | `codex/refactor-tutor-response-cycle` | Extract response accessibility/schema leaf helper only. | Static cycles `1 -> 0`; focused parity tests. |
| 9 | `codex/refactor-adaptive-trace-projection` | Consolidate the eval CLI/runner adaptive trace projection only. | Deep-equal frozen dialogue/learner projections. |
| 10 | `codex/refactor-field-policy-helpers` | Remove field trajectory/register-policy helper copies only. | Byte/deep equality; completed extraction card remains authoritative. |
| 11 | `codex/refactor-forbidden-key-audit` | Consolidate six exact dramatic forbidden-key copies plus the parameter-only conduct-policy variant. | All seven callers pass the same parameterized mutation fixture corpus. |
| 12 | `codex/refactor-field-turn-projection` | Consolidate CLI/auto-eval lightweight field-turn projection only. | Newer fields preserved and report golden output unchanged. |
| 13 | `codex/refactor-eval-profile-registry` | YAML-derived canonical cells plus explicit legacy alias map and two-way validation. | 204-cell exact invariant; historical aliases/DB audit; no fallback. |
| 14 | `codex/refactor-paper-manifest-fixtures` | Extract/test paper-manifest validator core with synthetic paper/DB fixtures. | Exit 0/1 and drift/missing-data cases fail closed. |
| 15 | `codex/refactor-provenance-fixtures` | Add synthetic provenance validator fixtures, building on the completed path normalization. | Hash/path/schema cases pass without private data. |
| 16 | `codex/refactor-message-chain-fixtures` | Extract/test message-chain validator core with synthetic logs. | Malformed/order/hash cases and exit codes are exact. |
| 17 | `codex/refactor-log-route-data-root` | Add data-bearing log-route tests against the hermetic log root; depend on row 3. | Wrong/empty log roots cannot return a false-green shape-only response. |
| 18 | `codex/refactor-sse-lifecycle` | Wire and test graceful stream cleanup only. | Shutdown closes every tracked stream and exits naturally. |

Two further queued slices remain dependency-blocked:

- Provider adapter consolidation follows
  `isolate-remaining-direct-model-subprocesses`; it is not bundled into the
  projection/deduplication PRs.
- Tutor command-handler groups follow the refined
  `automate-browser-and-packaged-electron-tutor-stub-acceptance` gate; migrate
  one group per PR rather than all 42 commands at once.

After these land, choose one vertical hotspot at a time: tutor-stub R3,
evaluation R4, or dramatic derivation R5. Do not run all three decompositions in
one branch.

## Slice operating protocol

Every implementation PR must:

1. Have one child workplan item linked to
   `codebase-refactoring-program`, with exact files and verification.
2. Rebase on current `origin/main` and record the audit metric before editing.
3. Add or identify characterization tests before moving behavior.
4. Move one seam without changing policy, prompts, schemas, defaults, or output.
5. Preserve the old import/entrypoint as a compatibility facade unless the same
   PR proves all consumers migrated.
6. Record line/function complexity, cycle, coverage, package, or duplication
   deltas relevant to that slice.
7. Stop if fixture, trace, DB-row, route, or output parity differs; investigate
   rather than normalizing the golden result in the same PR.
8. Run the relevant focused tests, then lint, format, hermetic tests, workplan
   checks, and desktop/browser gates where applicable.
9. Use no paid model calls for a structural refactor. If a live comparison is
   genuinely required, make it a separately approved experiment.
10. Keep paper claims and empirical results unchanged. Any new empirical claim
    follows the canonical Paper 2.0 discipline in a separate slice.

### Review-size and ratchet rules

- New production modules should normally be at most 500 lines; 800 lines needs
  an explicit rationale.
- New functions should normally be at most 80 lines and complexity 15; existing
  hotspot functions may exceed this only while strictly shrinking.
- No touched hotspot file or function may grow without an explicit, temporary
  budget recorded in its child card.
- Extraction PRs should avoid simultaneous behavior changes, dependency
  upgrades, formatting sweeps, or mass renames.
- Moved code is reviewed by behavior boundary, not by a misleading low net-line
  diff.
- Static cycles may not increase above zero after R1.
- Per-file coverage may not fall below its recorded baseline; high-risk pure
  policy/repository code should converge toward at least 80% branch coverage,
  while I/O adapters use risk-specific failure-path gates.

## Verification matrix

| Slice touches | Required focused gates | Additional review |
|---|---|---|
| Cell/profile/config registry | `node scripts/eval-cli.js validate-config`; config/factorial/runner tests | Cell-config auditor |
| Tutor-stub commands/runtime | command registry, interactive modes, human discourse, process-session HTTP | CLI golden trace and transport-effect parity |
| Evaluation runner/store/rubric | config override, regression 007, runner, store roundtrip, scoring, parser corpus | Symmetry reviewer for trace/score structures |
| Dramatic derivation | `npm run derivation:test`; mock/frozen replay equality | No provider calls |
| Browser/routes/Electron | route manifest/auth tests, poetics/workplan/live-compose tests, `npm run desktop:test` | Real browser + packaged fake-provider acceptance |
| Packaging/deletion | `npm pack --dry-run --json`; clean tarball install; documented CLI/import smoke | Paper/DB/artifact/external-consumer audit |
| Any workplan edit | `node scripts/workplan.js render`; `node scripts/workplan.js validate`; `npm run wp:check` | Generated views never hand-edited |

Common final checks:

```bash
npm run lint
npm run format:check
npm run test:hermetic
npm run wp:check
```

## Programme exit criteria

This programme is complete when:

- root and in-housed tutor-core tests run from one clean-install CI contract;
- required test suites cannot disappear through host paths or silent skips;
- selected-runtime coverage is reproducible and per-file risk floors ratchet;
- both import cycles are gone and exact duplicate implementations have one
  owner;
- YAML cells, legacy aliases, tutor-stub commands, and rubric families have
  validated canonical registries;
- tutor-stub, eval CLI/runner/store, dramatic derivation, and browser/report
  entry points are bounded adapters/facades over testable use cases;
- high-confidence dead code is removed or explicitly frozen only after its
  consumer/provenance gate;
- public package contents and exports match documented supported consumers;
- all linked P1 integrity cards are done or explicitly superseded with evidence;
- every child card records its metric delta and verification, and no accepted
  empirical claim changed as a side effect of structural work.

## Existing workplan links

Do not duplicate these items:

- `make-inhoused-tests-and-coverage-first-class` (done on current main)
- `make-pilot-state-writes-atomic`
- `isolate-remaining-direct-model-subprocesses`
- `harden-consolidated-labelling-integrity`
- `automate-browser-and-packaged-electron-tutor-stub-acceptance`
- `test-canonical-posthoc-analysis-pipeline` (done on current main)
- `decide-rich-learner-memory-service-retention`
- `tutor-stub-register-policy-extraction` (done; field-policy predecessor)
- `tutor-stub-capability-session-runtime` (done; R3 runtime foundation)
- `tutor-stub-headless-session-transport` (done; R3 HTTP foundation)
- `tutor-stub-process-session-factory` (done; real process-host foundation)
- `tutor-stub-unified-session-surface` (done; web/Electron surface foundation)
- `normalize-provenance-validator-data-paths` (done; validator-fixture
  predecessor)
- `tutor-stub-first-draft-series` (done; frozen V17–V53 contract)
- `adaptive-eval-immutable-provenance` (done; V-series provenance predecessor)

The parent workplan item `codebase-refactoring-program` links this plan and
coordinates new child slices. The parent does not replace the scoped cards
above and should not be marked active merely because one child is in progress.
