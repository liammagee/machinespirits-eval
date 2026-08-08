# Evaluation-store boundary inventory

Date: 2026-08-06

Branch: `codex/refactor-evaluation-store-boundary-inventory`

Workplan item: `refactor-evaluation-store-boundary-inventory`

## Purpose

This is the R4 step 5 characterization checkpoint. It does not split or alter
`services/evaluationStore.js`. It makes the current compatibility boundary
executable so the persistence split can proceed without silently losing a
consumer, changing package resolution, or moving database bootstrap too early.

The machine-readable authority is
`config/evaluation-store-boundary-inventory.json`; run
`npm run eval-store:boundary-check` after changing a consumer, facade export,
or package path.

## Current boundary

At the pre-slice checkpoint, `services/evaluationStore.js` is 3,437 lines and
has 48 tracked direct consumers. The characterization test itself exercises the
file facade in a child process, so the committed ratchet contains 49:

| Consumer class | Count | Migration meaning |
|---|---:|---|
| Package root | 1 | `index.js` eagerly re-exports the store namespace. |
| Application runtime | 4 | The eval routes, standard runner, and two adaptive-tutor modules import the facade. |
| Operational scripts | 25 | Evaluation, scoring, reports, pilots, smoke tools, and data scripts depend on the facade or its bootstrap. |
| Archived one-offs | 4 | Historical scripts retain references but currently point at a non-existent archive-relative target; do not treat them as live hosts. |
| Tests | 15 | Tests use named, default, namespace, and deferred imports, often to set `EVAL_DB_PATH` first; this includes the new boundary smoke. |

Thirty files are therefore live application, operational, or package
consumers. Across all 49 files there are 25 namespace imports, 18 dynamic
imports, three named imports, two default imports, and one namespace re-export.

The facade has 44 named function exports and 41 members on its legacy default
object. `updateResultTutorScores`, `updateResultTutorCharismaScores`, and
`updateResultTutorRegisterScore` are named-only. That asymmetry is now pinned;
the persistence split must preserve it until a deliberate compatibility change
has its own consumer proof.

## Baseline import-time contract

Importing the facade currently:

1. resolves the database from `EVAL_DB_PATH`, falling back to the repository
   `data/evaluations.db`;
2. recursively creates the database parent directory;
3. opens SQLite and selects WAL journal mode;
4. creates and migrates the evaluation schema immediately; and
5. leaves one module-scoped connection serving all repository functions.

The hermetic characterization test pins the five current tables:
`evaluation_results`, `evaluation_runs`, `interaction_evaluations`,
`score_audit`, and SQLite's `sqlite_sequence`. It also imports the store through
the package root, the `./services/*` export, and the file facade, proving that
all three paths resolve to the same function bindings.

One operational script, `scripts/grade-adaptive-dialogue.js`, imports the store
only to run migrations before opening a second direct SQLite connection. It is
the clearest import-time side-effect dependency and should be the first host
given an explicit migration/bootstrap call.

## Ordered R4 step 6 split

Keep `services/evaluationStore.js` as the unchanged compatibility facade while
moving implementation in this order:

1. **Connection and migrations.** Introduce an internal connection owner and
   migration runner. The facade must still call it at import time during this
   step; explicit startup is a later host migration.
2. **Run repository.** Move run create/update/list/complete, stale-run recovery,
   and incomplete-test accounting together.
3. **Result repository.** Move result persistence, rejudgment, score updates,
   provenance mapping, cloning, and score audit as one round-trip-sensitive
   family.
4. **Interaction repository.** Move interaction-evaluation CRUD and learner
   score updates without changing tutor/learner data symmetry.
5. **Projections and statistics.** Move row parsing, generation identity,
   run/scenario/factorial statistics, and configuration comparison behind
   explicit repository inputs.
6. **Exporters and dialogue-log readers.** Move JSON/CSV projections and
   mutable/immutable log loading last, after their result shapes are pinned.

Each extraction must leave named and default facade binding behavior intact and
run the boundary audit plus the existing store round-trip, scoring, resume, and
package gates.

## Host migration after the split

Move callers to explicit dependencies by cohort, with a separate parity gate
for each:

1. `evaluationRunner` and the eval CLI dependency adapter;
2. adaptive-tutor index and persistence;
3. `evalRoutes` and mounted application startup;
4. operational scripts, beginning with the migration-only adaptive grader;
5. package consumers, while retaining a deprecated facade path for external
   callers through at least one release boundary.

At this characterization checkpoint, import-time bootstrap was not to be
removed merely because the internal files had split. R4 step 8 begins only when
the live/package direct-import inventory has
been driven to its explicitly approved compatibility remainder, every host has
an explicit connection lifecycle, and a packed-package smoke test proves the
new startup contract. The four broken archived references should be repaired
or declared permanently non-runnable under a separate archive-maintenance
decision; they are not blockers for live-host migration.

## Explicit lifecycle follow-up (2026-08-07)

The repository-family split is now complete through run-manifest ownership. The
first host-migration slice replaces the baseline contract above with three
explicit layers:

1. `createEvaluationStore()` opens or accepts one SQLite connection, runs the
   schema migration, assembles every repository, and returns an idempotently
   closeable store. It closes only connections it opened.
2. The standalone server starts the default store immediately before `listen()`;
   the poetics host wraps the connection it already owns, so mounting eval
   surfaces no longer creates a second connection to the same database.
3. The legacy `services/evaluationStore.js` facade remains source-compatible but
   starts its default store only on the first actual operation. Importing the
   file facade, package root, eval routes, or evaluation runner has no database
   or filesystem effect.

Application shutdown drains HTTP streams and tutor processes first, disposes the
evaluation store second, and closes any host-owned database last. The adaptive
grader now migrates its own explicit connection rather than importing the facade
for a side effect.

This closes bootstrap ownership, not all consumer injection. The runner,
adaptive runtime, CLI, operational scripts, and package compatibility remainder
still migrate by cohort under later cards; until then their first real store
operation uses the lazy compatibility path. Removing the adaptive grader's
migration-only import reduces the executable inventory to 48 consumers: 29
live/package, four archived one-offs, and 15 tests.

## Runner and eval-CLI injection follow-up (2026-08-07)

The first direct-dependency cohort removes the legacy facade from the standard
evaluation runner, the eval CLI, and its scoring dependency adapter:

1. `createEvaluationRunner({ evaluationStore })` binds run creation, result
   persistence, reports, resume, rejudgment, and multi-turn completion to one
   host-supplied store. Store-bound runtime owners are assembled lazily and
   cached per store; importing the runner still performs no persistence work.
2. The named runner exports remain compatible. Calls that do not inject a
   store resolve the lazy default lifecycle only when a persistence operation
   begins, so routes and external package callers can migrate in later cohorts.
3. `scripts/eval-cli.js` now owns one explicit store, constructs its runner and
   scoring dependency graph from that store, and closes it after command
   completion. A synchronous `exit` hook also closes it when a legacy command
   invokes `process.exit()` directly. Help remains database-free.

This removes three direct facade consumers. The executable inventory is now 45
consumers: 26 live/package, four archived one-offs, and 15 tests. The remaining
application-runtime consumers are eval routes plus the adaptive-tutor index and
persistence modules; those retain the lazy compatibility path until their own
host-migration cohorts land.

## Adaptive-tutor injection follow-up (2026-08-07)

The adaptive runner and persistence adapter now participate in the same explicit
ownership graph as the standard runner:

1. `createAdaptivePersistence({ evaluationStore })` binds run creation, trace
   metadata, result writes, and completion data to one supplied store while the
   existing named persistence functions retain lazy compatibility.
2. `createAdaptiveEvaluationRunner({ evaluationStore })` binds adaptive run
   orchestration and finalization to that store. Constructing either adapter
   without a store fails closed.
3. Adaptive eval-CLI dispatch constructs the runner from the store already owned
   by CLI startup. A real mock-backed child-process regression proves the route
   writes one run and one result, passes SQLite integrity, and exits cleanly.

This removes two application-runtime facade consumers and one test consumer.
The executable inventory is now 42 consumers: 24 live/package, four archived
one-offs, and 14 tests. `routes/evalRoutes.js` is the sole remaining direct
application-runtime consumer; operational scripts, the package entrypoint, and
legacy tests remain separate compatibility cohorts.

## Eval-route host-context follow-up (2026-08-07)

The shared evaluation router now consumes persistence and orchestration through
the Express application context owned by each host:

1. `bindEvalSurfaceDependencies()` binds one supplied evaluation store and its
   matching `createEvaluationRunner()` adapter to `app.locals`. Tests may supply
   an explicit runner while production hosts derive it from the store.
2. Every store- and runner-backed route resolves those dependencies from the
   current request application. The same router can therefore serve standalone,
   poetics, and test hosts without capturing a process-global namespace; missing
   host bindings fail closed with a configuration error.
3. Standalone binds immediately before `listen()`, while poetics binds around
   its existing host-owned database. Importing the router or server remains free
   of persistence effects.

This removes the last application-runtime facade consumer. The executable
inventory is now 41 consumers: 23 live/package, four archived one-offs, and 14
tests. The live compatibility remainder is entirely operational—22 scripts—plus
the package entrypoint; these can migrate in bounded cohorts without reopening
application startup ownership.

## Operational dialogue-log follow-up (2026-08-07)

The first operational cohort separates scripts that use the legacy facade only
for `loadDialogueLog()` from tools that read or mutate evaluation rows through
the facade:

1. `createEvaluationScriptContext()` resolves the established database and log
   roots without opening SQLite or creating directories. It supplies a
   dedicated dialogue-log repository to each script invocation.
2. Six analysis, audit, coding, and rendering scripts keep their existing
   explicitly closed SQLite connection while reading logs through that local
   repository. Contexts with different data roots cannot share log state.
3. Model-capable scripts retain their existing admission and calls; validation
   exercises only deterministic or help paths and makes no model request.

This removes six direct operational facade consumers. The executable inventory
is now 35 consumers: 17 live/package, four archived one-offs, and 14 tests. The
live remainder is 16 operational scripts plus the package entrypoint.

## Longitudinal live-report ownership follow-up (2026-08-08)

The four A2-A5 longitudinal live reports now acquire the evaluation store only
around modes that read result rows:

1. `withEvaluationScriptStore()` creates one store for a bounded asynchronous
   operation and closes it in `finally`; an injected host-owned store is never
   closed by the helper.
2. A2-A5 score modes, A4-A5 live-verification modes, and A5 canary mode use that
   boundary. Invalid score invocations return before opening SQLite.
3. Gate and injection-building modes retain their existing Writing Pad access
   but do not acquire an evaluation store. CLI entrypoints publish
   `process.exitCode` only after the owned operation and close have completed.

The reports no longer import the compatibility facade. Import and usage paths
are regression-tested against a missing explicitly selected database, while
success and failure paths prove owned stores close exactly once. The executable
inventory is now 31 consumers: 13 live/package, four archived one-offs, and 14
tests. The live remainder is 12 operational scripts plus the package entrypoint.
