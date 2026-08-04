---
id: codebase-refactoring-program
title: Execute the evidence-led codebase refactoring programme
status: active
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-08-05
verification: >-
  Every accepted refactoring slice has a linked child card and parity gate;
  root plus in-housed tutor-core tests run from one clean-install contract;
  required suites cannot silently skip; import cycles fall from two to zero;
  hotspot, coverage, registry, duplication, and package metrics ratchet without
  trace, schema, route, CLI, or empirical-output drift; every deletion passes
  its consumer, database, paper, and artifact audit.
claim_status: planned
depends_on: []
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - refactor-required-run-manifest
    - refactor-v-series-fixtures
    - refactor-dialogue-log-fixtures
    - refactor-cast-layer-fixture
    - refactor-pty-ci-lane
    - refactor-rubric-parser-tests
    - refactor-tutor-core-cycle
    - refactor-tutor-response-cycle
    - refactor-adaptive-trace-projection
    - refactor-field-policy-helpers
    - refactor-forbidden-key-audit
    - refactor-field-turn-projection
    - refactor-eval-profile-registry
    - refactor-paper-manifest-fixtures
    - refactor-provenance-fixtures
    - refactor-message-chain-fixtures
    - refactor-log-route-data-root
    - refactor-sse-lifecycle
    - refactor-tutor-stub-learning-summary
    - refactor-tutor-stub-explanatory-debug
    - refactor-tutor-stub-response-details
    - refactor-tutor-stub-field-presentation
    - refactor-tutor-stub-closeout-projection
    - refactor-tutor-stub-interim-presentation
    - refactor-tutor-stub-interim-frame-projection
    - refactor-tutor-stub-cli-help-projection
    - refactor-tutor-stub-interactive-help-projection
    - refactor-tutor-stub-feature-map-projection
    - refactor-tutor-stub-release-notes-projection
    - refactor-tutor-stub-dag-snapshot-projection
    - refactor-tutor-stub-dag-snapshot-model
    - refactor-tutor-stub-second-loop-recovery
    - refactor-tutor-stub-debug-identifiers
    - refactor-tutor-stub-fact-matching
    - refactor-tutor-stub-public-evidence
    - refactor-tutor-stub-response-leak-audit
    - refactor-tutor-stub-one-line-projection
    - refactor-tutor-stub-generous-fallback
    - refactor-tutor-stub-director-notes-model
    - refactor-tutor-stub-prompt-blocks
    - refactor-tutor-stub-recipe-model-identity
    - refactor-tutor-stub-model-temperature
    - refactor-tutor-stub-cli-parsing
    - refactor-tutor-stub-model-selection
    - refactor-tutor-stub-dag-mode
    - refactor-tutor-stub-register-prior-loading
    - refactor-tutor-stub-proof-command-projection
    - refactor-tutor-stub-interaction-mode-presentation
    - refactor-tutor-stub-session-status-presentation
    - refactor-tutor-stub-training-reuse-presentation
    - refactor-tutor-stub-dialogue-settings-presentation
    - refactor-tutor-stub-model-choice-presentation
    - refactor-tutor-stub-director-presentation
    - refactor-tutor-stub-learner-dag-presentation
    - refactor-tutor-stub-learner-classification-presentation
    - refactor-tutor-stub-response-configuration-presentation
    - refactor-tutor-stub-response-policy-context
    - refactor-tutor-stub-tutor-prompt-context
    - refactor-tutor-stub-dialogue-memory-context
    - refactor-tutor-stub-analysis-vocabulary
    - refactor-tutor-stub-turn-analysis-projection
    - refactor-tutor-stub-technical-analysis-projection
    - refactor-tutor-stub-technical-debug-presentation
    - refactor-tutor-stub-closeout-report-presentation
    - refactor-tutor-stub-field-report-presentation
    - refactor-tutor-stub-curriculum-progress-presentation
    - refactor-tutor-stub-curriculum-catalog-presentation
    - refactor-tutor-stub-world-catalog-presentation
    - refactor-tutor-stub-picker-presentation
    - refactor-tutor-stub-picker-entries
    - refactor-tutor-stub-world-grouping
    - refactor-tutor-stub-world-vocabulary
    - refactor-tutor-stub-launch-mode-contract
    - refactor-tutor-stub-model-choice-catalog
    - refactor-tutor-stub-director-context
    - make-inhoused-tests-and-coverage-first-class
    - make-pilot-state-writes-atomic
    - isolate-remaining-direct-model-subprocesses
    - harden-consolidated-labelling-integrity
    - automate-browser-and-packaged-electron-tutor-stub-acceptance
    - test-canonical-posthoc-analysis-pipeline
    - decide-rich-learner-memory-service-retention
    - tutor-stub-register-policy-extraction
    - tutor-stub-capability-session-runtime
    - tutor-stub-headless-session-transport
    - tutor-stub-process-session-factory
    - tutor-stub-unified-session-surface
    - normalize-provenance-validator-data-paths
    - tutor-stub-first-draft-series
    - adaptive-eval-immutable-provenance
    - refactor-tutor-stub-macro-decomposition
    - refactor-tutor-stub-extracted-owner-boundaries
tags:
  - refactoring
  - testing
  - coverage
  - dead-code
  - maintainability
milestone: evaluation-infrastructure
---

The detailed evidence, protected boundaries, ranked hotspots, candidate
deletions, sequencing, and verification matrix live in the linked plan. This is
the parent coordination card; do not copy that plan into the board.

Acceptance:

- Build on merged PR #177; start with the required-run/skip-ledger,
  hermetic-fixture, cycle, duplication, and canonical-registry slices listed in
  the plan.
- Create one child card and branch per bounded implementation slice; link each
  child back here and record its before/after metrics.
- Execute existing integrity cards rather than creating duplicate pilot,
  provider, labelling, browser/Electron, post-hoc, coverage, or rich-memory work.
- Preserve compatibility facades and frozen empirical behavior until a child
  card proves every consumer and migration gate.
- Mark this parent done only when every planned slice is done, explicitly
  dropped, or superseded with recorded evidence.

Log:

- 2026-07-24 — Rebased and reconciled after PR #177 merged the in-housed
  tutor-core and risk-coverage foundation; removed that completed work from the
  first execution queue and retained the environment-dependent skip/fixture
  blind spots as the opening slice.
- 2026-07-24 — Comprehensive static, structural, packaging, test-surface, and
  selected-runtime coverage review completed at `2a5d8981`; programme captured
  without starting implementation or deleting any candidate.
- 2026-07-24 — Execution started: R0.1 merged through PR #182; R0.2 activated
  on `codex/refactor-v-series-fixtures` with the closed first-draft and immutable
  provenance cards as explicit dependencies.
- 2026-07-24 — R0.2 reached review with the machine-local V-series skip removed,
  four source/hash-bound compact fixtures tracked, and focused plus full
  hermetic parity green. The next queued slice remains R0.3 dialogue-log
  fixtures after this branch lands.
- 2026-07-24 — PR #188 merged and R0.2 closed. Activated R0.3 on
  `codex/refactor-dialogue-log-fixtures` to replace ambient dialogue-log
  discovery with tracked hermetic fixtures and discharge its skip-ledger entry.
- 2026-07-24 — R0.3 reached review with three tracked architecture fixtures,
  all dialogue-structure groups executing hermetically, the ambient-log skip
  removed, and focused plus full local validation green. The next queued slice
  remains R0.4 cast-layer fixture extraction after this branch lands.
- 2026-07-24 — PR #192 merged and R0.3 closed. Activated R0.4 on
  `codex/refactor-cast-layer-fixture` to replace the gitignored reader-quality
  matrix dependency with an explicitly synthetic tracked scorer fixture and
  discharge its skip-ledger entry.
- 2026-07-24 — R0.4 reached review with the cast-layer scorer executing against
  a tracked test-only matrix, its private-export skip removed, and the complete
  root manifest passing with zero skips. The next queued slice remains R0.5's
  permitted PTY/loopback CI lane after this branch lands.
- 2026-07-24 — PR #193 merged and R0.4 closed. Activated R0.5 on
  `codex/refactor-pty-ci-lane`: the existing CI-conditioned skip remains explicit
  in the parallel root manifest while a dedicated Linux lane opts the same
  concurrency assertion back in and requires natural teardown.
- 2026-07-24 — R0.5 reached review with a named Ubuntu PTY/loopback job, a
  natural-teardown package contract, and the previously skipped concurrent
  input assertion executing under CI opt-in. The next queued slice remains
  R0.6's production rubric-parser characterization after this branch lands.
- 2026-07-24 — PR #194 merged and R0.5 closed with the dedicated PTY/loopback
  check green. Activated R0.6 on `codex/refactor-rubric-parser-tests` to delete
  the test-local parser copy and run the malformed-response corpus against the
  production export under v2.1 and v2.2 rubric configuration.
- 2026-07-24 — R0.6 reached review with the copied parser and generated test
  module removed, both versioned tutor-rubric shapes characterized through the
  production parser, and focused plus full hermetic parity green. The next
  queued slice is R1.1 on `codex/refactor-tutor-core-cycle` after this branch
  lands.
- 2026-07-24 — PR #196 merged and R0.6 closed. Activated R1.1 on
  `codex/refactor-tutor-core-cycle` to move shared quiet-mode state into a
  dependency-free leaf and ratchet the static import-cycle baseline from two
  strongly connected components to one.
- 2026-07-24 — R1.1 reached review with the tutor-core cycle removed, the
  existing quiet-mode export surface preserved, and an exact CI cycle ratchet
  admitting only the queued tutor-stub response component. Full hermetic parity
  is green; the next queued slice is R1.2 on
  `codex/refactor-tutor-response-cycle` after this branch lands.
- 2026-07-24 — PR #198 merged and R1.1 closed. Activated R1.2 on
  `codex/refactor-tutor-response-cycle` to move the three remaining cross-module
  accessibility, role-visibility, and schema seams into leaf modules while
  preserving each existing facade and ratcheting static cycles from one to
  zero.
- 2026-07-24 — R1.2 reached review with static import cycles eliminated,
  compatibility bindings preserved, and focused plus full hermetic parity
  green. The next queued slice is R1.3 adaptive trace projection on
  `codex/refactor-adaptive-trace-projection` after this branch lands.
- 2026-07-24 — PR #200 merged and R1.2 closed. Activated R1.3 on
  `codex/refactor-adaptive-trace-projection` to move adaptive trace recognition,
  scenario/dialogue conversion, and learner-turn extraction into one pure
  projection service shared by the evaluation CLI and runner.
- 2026-07-24 — R1.3 adaptive trace projection reached review with one pure
  production definition, deep-equal frozen projection coverage, and focused
  plus full hermetic parity green. The next queued duplicate family is the
  field trajectory/register-policy helper slice on
  `codex/refactor-field-policy-helpers` after this branch lands.
- 2026-07-25 — PR #202 merged and closed the adaptive trace-projection child.
  Activated the bounded field trajectory/register-policy helper consolidation
  on `codex/refactor-field-policy-helpers`; the intentionally divergent
  acceleration-aware trajectory window remains out of scope.
- 2026-07-25 — The field-policy helper child reached review with a neutral DAG
  feature leaf, eight exact register-policy declarations removed, facade
  binding identity plus deep-equality coverage, and focused/full hermetic parity
  green. The next queued duplicate family is forbidden-key auditing on
  `codex/refactor-forbidden-key-audit` after this branch lands.
- 2026-07-25 — PR #208 merged and closed the field-policy helper child.
  Activated the next R1.3 duplicate family on
  `codex/refactor-forbidden-key-audit`; this branch touches only the seven
  dramatic-derivation auditors, their shared helper, and parity coverage.
- 2026-07-25 — The forbidden-key audit leaf reached review with seven recursive
  copies reduced to one pure helper, caller-specific policies pinned by a
  shared corpus, and focused plus full hermetic parity green. The next queued
  independent duplicate family remains lightweight field-turn projection.
- 2026-07-25 — PR #210 merged and closed the forbidden-key audit child.
  Activated `refactor-field-turn-projection` to consolidate only the CLI and
  auto-eval lightweight field-turn projection while preserving the richer CLI
  fields and the existing auto-eval report contract.
- 2026-07-25 — The field-turn projection child reached review with one pure
  service, explicit interactive and auto-eval v1 compatibility adapters, and
  byte-stable frozen outputs. Focused and complete hermetic parity are green;
  the next queued slice is the canonical evaluation-profile registry on
  `codex/refactor-eval-profile-registry` after this branch lands.
- 2026-07-25 — PR #211 merged and closed the field-turn projection child.
  Activated R1.4 on `codex/refactor-eval-profile-registry` to derive the 204
  canonical cells from YAML, separate the ten historical aliases, make config
  validation two-way, and fail closed on missing cell or tutor-core targets.
- 2026-07-25 — R1.4 reached review on `codex/refactor-eval-profile-registry`:
  the 204-entry manual registry is gone, historical aliases are explicit, two
  source-grepping report validators use the registry API, and focused plus full
  hermetic parity are green. The next queued slice remains the paper-manifest
  fixture extraction after this child lands.
- 2026-07-25 — PR #226 merged and closed the evaluation-profile registry child.
  Activated `refactor-paper-manifest-fixtures` to extract the validator core,
  add synthetic paper/SQLite fixtures, and make missing-data and drift cases
  return exact non-zero exit results without private evaluation data.
- 2026-07-25 — PR #227 merged and closed the paper-manifest fixture child with
  all CI checks green. Activated `refactor-provenance-fixtures` to exercise the
  production provenance CLI against synthetic SQLite and dialogue-log fixtures
  across hash, path, schema, missing-data, and exact exit-code boundaries.
- 2026-07-25 — The provenance fixture child reached review without production
  changes: its self-contained CLI harness covers both normalized path forms and
  exact hash, turn-ID, required-field, rubric-schema, and missing-data failures.
  Focused and complete hermetic parity are green; message-chain fixtures remain
  the next queued slice after this child lands.
- 2026-07-25 — PR #230 merged and closed the provenance fixture child.
  Activated `refactor-message-chain-fixtures` to extract a pure integrity core
  and exercise malformed logs, stored hashes, turn/message ordering, and exact
  strict-mode exits without changing the auditor's legacy display exit.
- 2026-07-25 — The message-chain fixture child reached review with symmetric
  tutor/learner validation, exact strict-mode findings and exits, legacy
  zero-exit compatibility, 47/47 focused tests, and full hermetic parity green.
  The next queued slice is row 17, `refactor-log-route-data-root`, after this
  child lands.
- 2026-07-25 — PR #232 merged and closed the message-chain fixture child.
  Activated row 17 on `codex/refactor-log-route-data-root` to unify the
  redirected tutor-core writer/reader root and replace shape-only evaluation
  log-route checks with exact hermetic data assertions. Row 18 SSE lifecycle
  cleanup remains next after this branch lands.
- 2026-07-25 — Row 17 reached review with one shared tutor-core log-root leaf,
  exact date/collection/id/index/statistics HTTP assertions, and a decoy old
  root proving the routes cannot pass against empty or wrong data. Root/core,
  desktop, static, and source-only parity are green; row 18 SSE lifecycle
  remains next after merge.
- 2026-07-25 — PR #233 merged and closed row 17. Activated row 18 on
  `codex/refactor-sse-lifecycle` to extract the router-local tracker behind its
  existing facade, attach cleanup to every shared eval host, and prove that
  shutdown closes every stream without leaving refed timers behind.
- 2026-07-25 — Row 18 reached review with one tested stream registry and shared
  host lifecycle hook. A live socket test found and repaired the
  close-idle-before-stream-end race; root/core, Electron, static, and source
  gates are green. This completes the plan's initial 18-row execution queue once
  merged; the next programme slice should begin from refreshed hotspot and
  coverage metrics rather than extending this branch.
- 2026-07-25 — PR #235 merged row 18 as `e5d9f047`, completing the initial
  queue. Refreshed line-count evidence still places `scripts/tutor-stub.js`
  first at 27,555 lines; activated `refactor-tutor-stub-learning-summary` as a
  data-only R3 extraction with no terminal, browser, model, or turn-loop change.
- 2026-07-25 — PR #237 merged the learning-summary projection as `f56fb4b4`
  with every CI lane green. Activated `refactor-tutor-stub-explanatory-debug`
  to extract the next pure R3 frame/prompt/fallback seam while retaining debug
  commands, model calls, terminal rendering, and trace writes in the CLI.
- 2026-07-26 — PR #238 merged the explanatory-debug projection as `0d962967`
  with every CI lane green after one transient matrix rerun. Activated
  `refactor-tutor-stub-response-details` to extract compact response metadata,
  repair explanations, and shared human-readable presentation labels without
  moving printing, timing, commands, model calls, state changes, or traces.
- 2026-07-26 — The response-details child reached review with one pure
  presentation service, exhaustive authored-label and byte-exact metadata
  fixtures, a 106-line CLI reduction, and focused/full hermetic parity green.
  Command handling and the remaining terminal/runtime seams stay out of scope.
- 2026-07-26 — PR #240 merged the response-details child as `c4b3e7e5` with
  every CI lane green. Activated `refactor-tutor-stub-field-presentation` from
  rendered `origin/main` at `e7c86cb3` to move only bars, shift narratives,
  chart geometry, and interactive SVG serialization; auto-eval visuals and all
  terminal, filesystem, trace, command, model, and runtime behavior remain in
  their current owners.
- 2026-07-26 — The field-presentation child reached review with nine pure
  helpers in one leaf, a 166-line CLI reduction, a byte-pinned accessible SVG,
  and focused/full hermetic parity green. The deliberately different auto-eval
  renderer and every application-behavior boundary remain unchanged.
- 2026-07-26 — Rebased that child onto rendered `origin/main` at `4b69df9b`
  after the independent concealed-answer guard merged; the overlapping
  guard/replay set and complete hermetic suite remain green on the final base.
- 2026-07-26 — Rebased the child again onto `origin/main` at `296550eb` after
  the independent audience-pragmatics runtime merged. Its full overlap surface
  is green at 129/129 and the bounded 166-line extraction remains unchanged.
- 2026-07-26 — PR #243 merged the field-presentation child as `83d101fc` with
  every CI lane green; the serialized render followed as `b91e496b`. Closed
  that child and activated `refactor-tutor-stub-closeout-projection` to move
  only pure reason/status/count and guard-summary projection while retaining
  report assembly, terminal output, traces, commands, and runtime state.
- 2026-07-26 — The closeout-projection child reached review with five pure
  helpers in one leaf, a 134-line CLI reduction, exact guard-summary fixtures,
  32/32 focused tests, and complete zero-skip hermetic parity. Report assembly,
  terminal output, traces, commands, and the distinct auto-eval summary remain
  unchanged.
- 2026-07-26 — PR #247 merged the closeout-projection child as `57cba50c` with
  every CI lane green; the serialized render followed as `7a22b818`. Closed
  that child and activated `refactor-tutor-stub-interim-presentation` for the
  remaining pure loading copy and hint projection while retaining timers, TTY
  writes, panel assembly, commands, traces, and mutable runtime state.
- 2026-07-26 — The interim-presentation child has five pure helpers in one
  leaf, removes the duplicate learning-summary bottleneck mapping, reduces the
  CLI by 77 lines, and passes 9/9 direct/shared-summary tests plus the existing
  real PTY loading scenario. Broader parity remains to run.
- 2026-07-26 — The interim-presentation child reached review with 16/16 focused
  presentation/summary/terminal tests, the real PTY loading scenario, and the
  complete zero-skip hermetic contract green. Static, manifest, and source-only
  gates also pass; timers, TTY writes, panel assembly, commands, traces, and
  runtime state remain unchanged.
- 2026-07-26 — Rebased the interim child onto rendered `origin/main` at
  `a577fa6a` after three independent feature merges. The final-base overlap set
  passes 30/30 plus the real PTY scenario, and the complete hermetic suite is
  zero-skip green again (core 137/137); static, manifest, and 198-item
  source-only gates also pass.
- 2026-07-26 — PR #249 merged the interim-presentation child as `2e8f0708`
  with every CI lane green; the serialized render followed as `315cbaed`.
  Closed that child and activated
  `refactor-tutor-stub-interim-frame-projection` to move only pure panel
  ordering and frame serialization while retaining live summary calculation,
  animation state, timers, TTY writes, commands, traces, and model/runtime
  behavior in the CLI.
- 2026-07-26 — The interim-frame child reached review with pure panel ordering
  and byte-exact frame serialization in the existing presentation leaf, a
  further 29-line CLI reduction, 19/19 focused tests, the real PTY loading
  scenario, and complete zero-skip hermetic parity green. Live summary
  calculation and every animation/runtime effect remain CLI-owned.
- 2026-07-26 — PR #254 merged the interim-frame child as `95139c0d` with every
  CI lane green; the serialized render followed as `16deb64b`. Closed that
  child and activated `refactor-tutor-stub-cli-help-projection` to move only
  the 469-line pure launch help string while retaining terminal output,
  argument parsing, defaults, commands, and runtime behavior in the CLI.
- 2026-07-26 — The CLI-help child reached review with the complete launch help
  projection in one dependency-free leaf, a 450-line CLI reduction, exact
  28,938-byte pre/post output parity, 30/30 final-base launch-path tests, and
  complete zero-skip hermetic parity. The CLI still owns terminal output,
  argument parsing, defaults, commands, and every runtime effect.
- 2026-07-26 — PR #262 merged the CLI-help child as `cb1ab520` with every CI
  lane green; the serialized render followed as `85ccfb7a`. Closed that child
  and activated `refactor-tutor-stub-interactive-help-projection` to move only
  pure `/help` line projection while retaining capability/availability
  resolution, terminal writes, completion, command dispatch, and runtime state.
- 2026-07-26 — The interactive-help child reached review with normal and
  passthrough terminal bytes unchanged, every conditional section pinned, a
  55-line CLI reduction, 66 focused tests, and complete zero-skip hermetic
  parity. Registry availability, terminal writes, completion, command dispatch,
  traces, models, and runtime state remain CLI-owned.
- 2026-07-26 — Refreshed the interactive-help child onto rendered
  `origin/main` at `69c0ee37`; the independent due-source CLI overlap composed
  cleanly. Final-base help/registry/terminal coverage passes 60/60, and the
  complete hermetic root 6,907-test plus tutor-core 137-test contracts remain
  zero-skip green.
- 2026-07-26 — PR #265 merged the interactive-help child as `4030d09f` with
  every required CI lane green; the serialized render followed as `130efa09`.
  Closed that child and activated `refactor-tutor-stub-feature-map-projection`
  to move only pure capability-map and quick-start line projection while
  retaining capability/state resolution, terminal writes, slash dispatch, and
  runtime behavior in the CLI.
- 2026-07-26 — The feature-map child reached review with launch and live-session
  bytes unchanged, exact active-context fixtures, a 20-line CLI reduction,
  64/64 focused tests, and complete zero-skip hermetic parity. Capability/state
  resolution, terminal writes, slash dispatch, traces, models, and runtime
  behavior remain CLI-owned.
- 2026-07-26 — PR #266 merged the feature-map child as `d21da873` with every
  required CI lane green; the serialized render followed as `fb809c05`. Closed
  that child and activated `refactor-tutor-stub-release-notes-projection` to
  move only pure release-note line serialization while retaining time-window
  validation, Git loading, terminal writes, slash dispatch, and runtime behavior
  in the CLI.
- 2026-07-26 — The release-notes child reached review with live terminal bytes
  unchanged, exact empty/grouped and visibility-limit fixtures, a 24-line CLI
  reduction, 54/54 focused tests, and complete zero-skip hermetic parity. Git
  loading, time-window validation, terminal writes, slash dispatch, traces,
  models, and runtime behavior remain CLI-owned.
- 2026-07-26 — PR #268 merged the release-notes child as `5bbd115c`; the
  serialized render followed as `040222c6`. Closed that child and activated
  `refactor-tutor-stub-dag-snapshot-projection` to move only deterministic
  proof-DAG snapshot lines while retaining snapshot construction, state access,
  terminal writes, runtime callers, commands, traces, and tutor behavior in the
  CLI. The next child must also rerun the complete local hermetic contract
  because one pre-merge Node 20 shard on #268 reported a failure.
- 2026-07-26 — The DAG-snapshot child reached review with one dependency-free
  pure projector, a 27-line CLI reduction, exact live and synthetic terminal
  fixtures, and complete root 6,961-test plus tutor-core 137-test zero-skip
  parity. Snapshot construction, state access, terminal writes, every runtime
  caller, commands, traces, and tutor behavior remain CLI-owned.
- 2026-07-26 — Rebased the DAG-snapshot child onto rendered `origin/main` at
  `4cebdde1` after PR #267 changed the hermetic-runner lifecycle. Final-base
  focused 6/6, root 6,976/6,976, and tutor-core 137/137 zero-skip contracts are
  green through the new natural-teardown runner.
- 2026-07-26 — PR #269 merged the DAG-snapshot child as `482f97f3` with every
  CI lane green; the serialized render followed as `cce01690`. Closed that
  child and activated `refactor-tutor-stub-proof-command-projection` for the
  fixed artifact-path table and authored/learner/tutor semantic summaries while
  retaining formal checks, command handling, terminal writes, and traces in
  the CLI.
- 2026-07-26 — The proof-command child reached review with one dependency-free
  artifact/semantic projector, a 41-line CLI reduction, byte-identical real
  `/proof paths` and learner-inspection processes, 15/15 focused tests, and
  complete root 6,982-test plus tutor-core 137-test zero-skip parity. Formal
  proof execution, audits, dynamic imports, commands, terminal writes, and
  traces remain CLI-owned.
- 2026-07-26 — Rebased the proof-command child onto rendered `origin/main` at
  `689468b4` after PR #270's evidence-use rubric change. The separate tutor-stub
  edits compose cleanly: the overlap set passes 57/57 and final root 7,001 plus
  tutor-core 137 zero-skip contracts are green.
- 2026-07-26 — PR #271 merged the proof-command child as `65e7b91f` with every
  CI lane green; the serialized render followed as `839ec636`. Closed that
  child and activated `refactor-tutor-stub-interaction-mode-presentation` to
  move only pure mode-label and banner serialization while retaining state
  mutation, prompt changes, trace events, terminal writes, and automation in
  the CLI.
- 2026-07-26 — The interaction-mode child reached review with one pure shared
  label/banner projector, a 6-line CLI reduction, byte-identical real startup
  and mode-switch output, 30/30 focused tests, and complete root 7,008-test
  plus tutor-core 137-test zero-skip parity. Mode state, prompts, traces,
  terminal writes, commands, and automation remain CLI-owned.
- 2026-07-26 — PR #273 merged the interaction-mode child as `c074469c` with
  every CI lane green; the serialized render followed as `740a0981`. Closed
  that child and activated `refactor-tutor-stub-session-status-presentation`
  to move only normal and passthrough `/status` serialization while retaining
  state derivation, helper calls, slash dispatch, and terminal writes in the
  CLI.
- 2026-07-26 — The session-status child reached review with one pure normal and
  passthrough projector, a 29-line CLI reduction, byte-identical live `/status`
  output, 39/39 focused tests, and complete root 7,022-test plus tutor-core
  137-test zero-skip parity. State derivation, helper calls, slash dispatch,
  terminal writes, and runtime behavior remain CLI-owned.
- 2026-07-26 — PR #275 merged the session-status child as `7ffbf1b8` with all
  ten final CI lanes green; the serialized render followed as `9480bd7d`.
  Closed that child and activated
  `refactor-tutor-stub-training-reuse-presentation` to move only the reusable
  policy-status lines while retaining policy resolution, live state changes,
  persistence, trace events, terminal writes, and command handling in the CLI.
- 2026-07-26 — The training-reuse presentation child reached review with one
  dependency-free projector, exact candidate/opt-out/fail-closed process
  parity, 39/39 focused tests, and complete root 7,040-test plus tutor-core
  137-test zero-skip parity. Policy resolution, state, persistence, trace,
  commands, and terminal writes remain CLI-owned; the larger dialogue-settings
  projector is the logical next child after merge.
- 2026-07-26 — PR #276 merged the training-reuse child as `ccdf944e` after all
  ten CI lanes passed; the serialized render followed as `c6cb954f`. Closed
  that child and activated `refactor-tutor-stub-dialogue-settings-presentation`
  to move the complete deterministic `/settings` serialization while retaining
  every state/helper lookup, setting mutation, command, picker, persistence,
  trace, model, and terminal effect in the CLI.
- 2026-07-26 — The dialogue-settings presentation child reached review with one
  dependency-free projector, a 26-line CLI reduction, byte-identical default
  and configured `/settings` processes, 44/44 focused tests, and complete root
  7,048-test plus tutor-core 137-test final-base zero-skip parity. State/helper lookup,
  settings mutation, commands, pickers, persistence, traces, models, and
  terminal writes remain CLI-owned.
- 2026-07-26 — PR #280 merged the dialogue-settings child as `955a4ec1` with
  all ten CI lanes green; the serialized render followed as `911de566`.
  Closed that child and activated `refactor-tutor-stub-model-choice-presentation`
  to move only shared role-model choice-list serialization while retaining
  role/current-model resolution, catalog loading, slash dispatch, keyboard
  pickers, selection changes, and terminal writes in the CLI.
- 2026-07-26 — The model-choice presentation child reached review with one
  dependency-free projector, a 10-line CLI reduction, byte-identical tutor and
  classifier lists, 66/66 focused tests, and complete root 7,105-test plus
  tutor-core 137-test zero-skip parity. Role/current-model resolution, catalog
  loading, commands, keyboard pickers, mutations, and terminal writes remain
  CLI-owned.
- 2026-07-27 — Rebased the model-choice presentation child onto `origin/main`
  at `c7f5d5cd` after PR #282. Its sole manifest overlap composes cleanly with
  the tutor-benchmark additions: 48/48 overlap tests, 7,112/7,112 root tests,
  and 137/137 tutor-core tests pass on the final base with zero skips.
- 2026-07-27 — PR #285 merged the model-choice child as `b2bb02a3` with all ten
  CI lanes green; the serialized render followed as `46fd7e0e`. Closed that
  child and activated `refactor-tutor-stub-director-presentation` to move only
  director-context and issued-note serialization while retaining note
  derivation, future-note withholding, trace/state effects, slash dispatch,
  and terminal writes in the CLI.
- 2026-07-27 — The director-presentation child reached review with one
  dependency-free projector, a 35-line net CLI reduction, byte-identical live
  context and reprise blocks, 67/67 focused tests, 281/281 final-base overlap
  tests, and complete root 7,193-test plus tutor-core 137-test zero-skip parity.
  Note derivation, withholding, trace/state effects, command dispatch, and
  terminal writes remain CLI-owned.
- 2026-07-27 — PR #286 merged the director child as `c05444f6` with all ten CI
  lanes green; the serialized render followed as `f628fe85`. Closed that child
  and activated `refactor-tutor-stub-learner-dag-presentation` to move only the
  technical learner-DAG line serialization while retaining DAG construction,
  debug gating, state, warnings, traces, callers, and terminal writes in the
  CLI.
- 2026-07-27 — The learner-DAG presentation child reached review with one
  dependency-free projector, a 38-line net CLI reduction, byte-identical live
  technical output, 94/94 focused tests, 103/103 final-base overlap tests, and
  complete root 7,206-test plus tutor-core 137-test zero-skip parity. DAG
  construction, assessment state, debug gating, warning provenance, traces,
  call sites, and terminal writes remain CLI-owned.
- 2026-07-27 — PR #289 merged the learner-DAG child as `26503b06` with all ten
  CI lanes green; the serialized render followed as `e2a7cd75`. Closed that
  child and activated `refactor-tutor-stub-learner-classification-presentation`
  to move only normalized classifier diagnostic line serialization while
  retaining classification, score normalization, warning resolution, debug
  gating, callers, traces, and terminal writes in the CLI.
- 2026-07-27 — The learner-classifier presentation child reached review with
  one dependency-free projector, a seven-line net CLI reduction,
  byte-identical live technical output, 118/118 focused assertions, and
  initial-base root 7,210-test plus tutor-core 137-test zero-skip parity.
  Classification, score and warning semantics, debug gating, call sites,
  traces, and terminal writes remain CLI-owned.
- 2026-07-27 — Rebased the learner-classifier presentation child onto
  `origin/main` at `f32ffbb7` after PRs #288, #290, and #291. The manifest-only
  overlap composes cleanly: 295/295 overlap assertions, 7,229/7,229 root tests
  across 521 files, and 137/137 tutor-core tests pass with zero skips.
- 2026-07-27 — PR #295 merged the learner-classifier child as `7080678e` with
  every behavioral lane green. Its sole failed job was the unrelated stale
  ref-status gate after `paper/v3.0.230`; PR #296 repairs that generated line.
  Closed the child and activated
  `refactor-tutor-stub-response-configuration-presentation` to move only
  normalized efficacy and engagement-stance line serialization while
  retaining policy/state calculations, formatting helpers, debug gating,
  callers, traces, and terminal writes in the CLI.
- 2026-07-27 — The response-configuration presentation child reached review
  with one dependency-free projector, a 68-line net CLI reduction,
  byte-identical live technical output, 338/338 focused assertions, and
  complete root 7,234-test plus tutor-core 137-test zero-skip parity on the
  temporary PR #296 stack. Policy/state calculations, three helper-derived
  display values, debug gating, call sites, traces, and terminal writes remain
  CLI-owned.
- 2026-07-27 — PR #296 merged as `eff8e9ae` with every CI lane green, so the
  response-configuration child was unstacked and rebased through PR #297 onto
  `origin/main` at `b185756e`. Final-base parity passes 7,239/7,239 root tests
  across 522 files and 137/137 tutor-core tests with zero skips; the disjoint
  skill-permission overlap passes 7/7.
- 2026-07-27 — Rebased the response-configuration child onto `origin/main` at
  `5589017d` after PRs #300 and #301. The incoming big-picture skill and
  workplan-only changes are runtime-disjoint, and the skill-sync plus
  response-presenter boundary passes 7/7.
- 2026-07-27 — PR #303 merged the response-configuration child as `254111ba`
  with all ten CI lanes green; the serialized render followed as `e0e1f58d`.
  Closed that child and activated `refactor-tutor-stub-response-policy-context`
  to move the adjacent deterministic tutor-only prompt projection while
  retaining policy selection, world diction, runtime prompt assembly, model
  calls, state, traces, and effects in the CLI.
- 2026-07-27 — The response-policy context child has a 151-line pure projector,
  a 111-line net CLI reduction, a 6,561-byte golden full-context fixture, and
  184/184 passing response/prompt/typed-action neighborhood tests. It rebased
  onto `66d0cb7e` after PR #299's disjoint workplan commit-link contract.
- 2026-07-27 — The response-policy context child reached review with final
  7,251/7,251 root tests across 523 files plus 137/137 tutor-core tests, all
  zero-skip. Manifest, source-only workplan, refs, lint, formatting, syntax,
  diff, and the zero-cycle ratchet across 405 files are green.
- 2026-07-27 — The handoff rebased cleanly again onto current `origin/main` at
  `90084e70`. Its incoming response-composition changes remain compatible: the
  widened neighborhood passes 190/190, the complete hermetic suite passes all
  523 selected root files plus 137/137 tutor-core tests, and the 236-item
  source-only workplan, manifest, refs, and cycle gates remain green.
- 2026-07-27 — PR #309 merged the response-policy context child as `0aba11c4`
  with all ten CI lanes green; the serialized render followed as `7f313831`.
  Closed that child and activated `refactor-tutor-stub-tutor-prompt-context`
  for the adjacent redacted learner-DAG, human-discourse, and dialogue-closure
  serializers while retaining their frame/state/runtime owners in the CLI.
- 2026-07-27 — The tutor prompt-context child has a 232-line dependency-free
  projector, a 199-line net CLI reduction, byte-pinned redacted-DAG and full
  human-discourse fixtures, and 113/113 passing prompt/closure neighborhood
  tests. Full hermetic and static parity remain before review.
- 2026-07-27 — The tutor prompt-context child reached review with final
  7,259/7,259 root tests across all 524 manifest files plus 137/137 tutor-core
  tests, both zero-skip. Manifest, 237-item source-only workplan, refs, lint,
  formatting, syntax, diff, and the zero-cycle ratchet across 406 files are
  green on unchanged `origin/main` at `7f313831`.
- 2026-07-27 — Rebased the tutor prompt-context child onto `origin/main` at
  `d6ca5423` after the runtime-disjoint rubric-v3 PR #310. Final-base parity is
  113/113 for the overlap neighborhood and fully green across all 527 selected
  root files plus 137/137 tutor-core tests; the 239-item source workplan and
  zero-cycle ratchet across 408 files also pass.
- 2026-07-27 — PR #311 merged the tutor prompt-context child as `2713ea20`
  with all ten CI lanes green; the serialized render followed as `1dcafabe`.
  Closed that child and activated
  `refactor-tutor-stub-dialogue-memory-context` to move adjacent public replay,
  compact memory, message-context, and tutor-only classifier serializers while
  retaining their state/default/runtime owners in the CLI.
- 2026-07-27 — The dialogue-memory context child has 113 new lines across the
  existing public-history and tutor-only prompt owners, an 80-line net CLI
  reduction, a 944-byte golden compact-memory fixture, and 108/108 passing
  prompt/replay neighborhood tests. It reached review with the full 528-file
  root manifest and 137/137 tutor-core tests green, alongside all static,
  manifest, ref, source-only workplan, and zero-cycle gates.
- 2026-07-27 — PR #312 merged the dialogue-memory context child as `0bbd95a5`
  with all ten CI lanes green; the serialized render followed as `2f38e863`.
  Closed that child and activated `refactor-tutor-stub-analysis-vocabulary` to
  move shared pure policy/signal/strategy copy into the existing
  response-details owner before extracting the larger turn-analysis renderer.
- 2026-07-27 — The analysis-vocabulary child adds 62 lines to the existing
  presentation owner, reduces the CLI by 59 net lines, and passes 62/62 direct
  and shared settings/status/interim/command tests. It reached review with all
  528 required root files and 137/137 tutor-core tests green, alongside all
  static, manifest, ref, source-only workplan, and zero-cycle gates.
- 2026-07-27 — PR #313 merged the analysis-vocabulary child as `91893217`
  with all ten CI lanes green; the serialized render followed as `af137b0f`.
  Closed that child and activated
  `refactor-tutor-stub-turn-analysis-projection` to extract only the pure
  learner-facing line projection from `printCurrentTurnAnalysis` while
  retaining technical dispatch, state normalization, and terminal ownership.
- 2026-07-27 — The turn-analysis child adds a 286-line pure projector and
  reduces the CLI by 186 net lines. Four direct tests pin dense, sparse, empty,
  question-support, efficacy, immutability, and ownership branches; a seeded
  fake-provider completed turn is byte-identical to pre-extraction `main` at
  1,093 bytes and SHA-256 `a379dd60b84a554b4e79a4ad00bcf2d294aaa2a9751112f50148f4b14ad303b9`.
- 2026-07-27 — The turn-analysis child reached review with 66/66 focused
  assertions, 7,320/7,320 root tests across all 529 manifest files, and
  137/137 tutor-core tests, all zero-skip. Manifest, 242-item source workplan,
  refs, lint, formatting, syntax, diff, and the zero-cycle ratchet across 409
  files are green.
- 2026-07-27 — PR #316 merged the turn-analysis child as `86bb2147` with all
  ten CI lanes green; the serialized render followed as `07caedf8`. Closed
  that child and activated
  `refactor-tutor-stub-technical-analysis-projection` to move the adjacent
  operator-facing technical line projection while retaining normalization,
  field construction, trace resolution, runtime state, and terminal writes in
  the CLI.
- 2026-07-27 — The first technical-analysis parity fixture matches
  pre-extraction PR #316 exactly after generated identifier normalization:
  2,787 bytes and SHA-256
  `7c7c0b9c4eb55a9c075873d3f2a1711b4c30ce5d3e8c630367a7bbf11aca6778`.
- 2026-07-27 — The technical-analysis child adds a 566-line deterministic
  projector, reduces the CLI by 410 net lines, and pins dense/sparse plus live
  technical output in a 371-line direct test. It reached review with 30/30
  focused assertions, all 7,323 root tests across 530 files, 137/137 tutor-core
  tests, the 243-item source workplan, and every manifest, ref, lint,
  formatting, syntax, diff, and zero-cycle gate green.
- 2026-07-27 — PR #317 merged the technical-analysis child as `3258a19a` with
  all ten CI lanes green; the serialized render followed on `origin/main` at
  `b6b56e49`. Closed that child and activated
  `refactor-tutor-stub-technical-debug-presentation` to move only the remaining
  deterministic `/debug technical` line projection while retaining its gates,
  preparation, concurrent-terminal wrapper, trace write, and effects in the
  CLI.
- 2026-07-27 — The first technical-debug parity fixture matches
  pre-extraction PR #317 exactly after generated turn-id normalization: 1,316
  bytes and SHA-256
  `5f5d63300c55e4402bfc1a8f9ac7aa911655151757612d7f2ba3de16985eac6d`.
- 2026-07-27 — The technical-debug child adds a 261-line dependency-free
  projector and a 246-line direct test while reducing the CLI by 159 net
  lines. It reached review on its activation base with 30/30 focused
  assertions, all 7,326 root tests across 531 manifest files, 137/137
  tutor-core tests, the 244-item source workplan, and every manifest, ref,
  lint, formatting, syntax, diff, and zero-cycle gate green.
- 2026-07-27 — Rebased the technical-debug child without conflict onto
  rendered `origin/main` at `1fb7fe9f` after runtime-disjoint PR #318.
  Final-base focused parity remains 30/30, tutor-core remains 137/137, and all
  static gates remain green. The exact base passed all ten GitHub CI lanes;
  full-root certification for this child is deferred to PR CI because the
  loaded local host trips existing fixed subprocess deadlines even though all
  531 files report and the implicated files pass independently.
- 2026-07-28 — PR #319 merged the technical-debug child as `a4925f7a` with all
  ten CI lanes green; the serialized render followed as `e3d66045`. Closed
  that child and activated `refactor-tutor-stub-closeout-report-presentation`
  to move only deterministic closeout terminal lines while retaining payload
  assembly, snapshots, paths, trace emission, commands, and runtime state in
  the CLI.
- 2026-07-28 — The closeout-report child adds a 154-line dependency-free
  projector and a 217-line direct test while reducing the CLI by 79 net lines.
  It reached review with exact 1,208-byte live parity, 45/45 focused
  assertions, 137/137 tutor-core tests, and every manifest, ref, lint,
  formatting, syntax, diff, source-only workplan, and zero-cycle gate green.
  The loaded-host monolithic root timeout is recorded on the child; PR CI is
  the final full-root certification.
- 2026-07-28 — PR #320 merged the closeout-report child as `31bf577a` with all
  ten CI lanes green; the serialized render followed as `0110ccb0`. Closed
  that child and activated `refactor-tutor-stub-field-report-presentation` for
  the `/field` and `/viz` terminal-line seam explicitly retained by the earlier
  field-helper extraction. Field calculation, file writes, traces, command
  handling, and runtime state remain CLI-owned.
- 2026-07-28 — The field-report child reached review with exact 505-byte live
  `/field` plus `/viz` parity, a 30-line net CLI reduction, 37/37 focused
  assertions, 7,337/7,337 root tests, and 137/137 tutor-core tests, all
  zero-skip. Every manifest, ref, lint, formatting, syntax, diff, source-only
  workplan, and zero-cycle gate is green; application effects remain in their
  existing owners.
- 2026-07-28 — PR #323 merged the field-report child as `941af8d8`; the
  host-independent final fixture passed all current CI lanes. Closed that
  child and activated `refactor-tutor-stub-curriculum-progress-presentation`
  to move only deterministic `/progress` line serialization while retaining
  curriculum projection, runtime state, command dispatch, and terminal writes
  in the CLI. The pre-extraction keyless report is 1,740 bytes with SHA-256
  `5256a00d8ff9926ab9f94234ba8db7ed09579ef4627d330bab205e005396d894`.
- 2026-07-28 — The curriculum-progress child reached review with a 34-line
  pure projector, a 21-line net CLI reduction, exact 1,740-byte live parity,
  75/75 focused assertions, 7,377/7,377 root tests, and 137/137 tutor-core
  tests. All selected files executed with zero skips; static and source-only
  workplan gates are green.
- 2026-07-28 — PR #329 merged the curriculum-progress child as `8049a4cf`
  with all ten CI lanes green. Closed that child and activated
  `refactor-tutor-stub-curriculum-catalog-presentation` for the remaining pure
  `--list-curriculum-modules` and non-TTY `/board` line projection. Curriculum
  loading, public module normalization, commands, and terminal writes remain
  in their current owners; the canonical pre-extraction catalogue is 28 lines,
  852 bytes, and SHA-256
  `ded71f142f94e2960d289b988b0930bf5356c332b9fc831303be25e1b1aaacf7`.
- 2026-07-28 — The curriculum-catalogue child reached review with a 10-line
  pure projector, a four-line net CLI reduction, exact 852-byte live parity,
  30/30 focused assertions, 7,400/7,400 root tests, and 137/137 tutor-core
  tests. All 550 selected files executed with zero skips; static and
  source-only workplan gates are green, and command/runtime movement remains
  excluded behind the browser/Electron acceptance gate.
- 2026-07-28 — PR #334 merged the curriculum-catalogue child as `8dba3582`.
  Closed that child and activated
  `refactor-tutor-stub-world-catalog-presentation` for authorial world-summary
  helpers and deterministic `--list-worlds` lines. World loading, eligibility,
  family grouping, picker behavior, commands, and terminal writes remain in
  their current owners; setting/diction presentation remains explicitly
  separate from register. The pre-extraction catalogue is 71 lines, 6,670
  bytes, and SHA-256
  `a7f97c026e1f19d18d56b3f061ecf51772a76c22fa2dc121df9a58d91dafd42c`.
- 2026-07-28 — The world-catalogue child reached review with one 36-line pure
  presentation owner, a 24-line net CLI reduction, exact 6,670-byte live
  parity, 27/27 focused assertions, 7,403/7,403 root tests, and 137/137
  tutor-core tests. All 551 selected files executed with zero skips; static and
  source-only workplan gates are green, and setting/diction remains separate
  from register policy.
- 2026-07-28 — PR #338 merged the world-catalogue child through `30b59a24`.
  Closed that child and activated `refactor-tutor-stub-picker-presentation` for
  deterministic launch, scenario, and curriculum picker lines only. Before
  editing, `scripts/tutor-stub.js` was 25,107 lines and the three keyboard
  functions were 87, 134, and 123 lines; selection state, key handling,
  terminal effects, loading, commands, and runtime behavior remain CLI-owned.
- 2026-07-28 — The picker-presentation child reached review with one 119-line
  pure owner, a 38-line net CLI reduction, and the three keyboard functions at
  80, 118, and 103 lines. All 53 focused assertions, 7,413 root assertions
  across 541 files, and 137 tutor-core assertions pass with zero skips; every
  manifest, source-workplan, ref, static, syntax, diff, and zero-cycle gate is
  green.
- 2026-07-28 — Activated the dependent
  `refactor-tutor-stub-picker-entries` slice from PR #339's reviewed head to
  move only scenario and curriculum entry shaping into the pure picker owner.
  Loading, grouping, default resolution, selection, and terminal behavior stay
  in the CLI.
- 2026-07-28 — The picker-entry child reached review with a 19-line net CLI
  reduction, scenario/curriculum functions at 99/102 lines, 55 focused
  assertions, 7,415 root assertions, and 137 tutor-core assertions green with
  zero skips. All static and source-only gates pass.
- 2026-07-28 — Activated dependent slice
  `refactor-tutor-stub-world-grouping` from PR #340's reviewed head to give
  world-family keys and base-first grouping one pure owner. Filesystem loading,
  production eligibility, ordering inputs, and terminal consumers remain in
  the CLI.
- 2026-07-28 — The world-grouping child reached review with an 18-line net CLI
  reduction, exact catalogue parity, 21 focused assertions, 7,416 root
  assertions, and 137 tutor-core assertions green with zero skips. All static
  and source-only gates pass.
- 2026-07-28 — Activated dependent slice
  `refactor-tutor-stub-world-vocabulary` from PR #341's reviewed head to move
  authored ledger and narrative-diction labels beside world presentation while
  leaving prompts, register policy, runtime state, and all effects unchanged.
- 2026-07-28 — The world-vocabulary child reached review with an eight-line net
  CLI reduction, 11 focused assertions, 7,416 root assertions, and 137
  tutor-core assertions green with zero skips. World diction remains explicitly
  separate from tutor register; all static and source-only gates pass.
- 2026-07-28 — Activated dependent slice
  `refactor-tutor-stub-launch-mode-contract` from PR #342's reviewed head to
  give the two-mode catalogue and alias normalization one dependency-free
  owner. TTY admission, rendering, input, dispatch, and process behavior remain
  CLI-owned.
- 2026-07-28 — The launch-mode child reached review with a 35-line net CLI
  reduction, 14 focused assertions, 7,418 root assertions, and 137 tutor-core
  assertions green with zero skips. All static and source-only gates pass.
- 2026-07-28 — Activated dependent slice
  `refactor-tutor-stub-model-choice-catalog` from PR #343's reviewed head to
  move pure provider-model admission, access labeling, fallback, and ordering
  into the existing model-choice owner. Provider loading, commands, pickers,
  and effects remain CLI-owned.
- 2026-07-28 — The model-choice catalogue child reached review with a 47-line
  net CLI reduction, 55 focused assertions, 7,420 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass.
- 2026-07-28 — Activated dependent slice
  `refactor-tutor-stub-director-context` from PR #344's reviewed head to move
  pure initial director-context construction beside its line projection.
  Audience derivation, prelude state, traces, release notes, commands, and
  terminal effects remain CLI-owned.
- 2026-07-28 — The director-context child reached review with a 15-line net CLI
  reduction, 48 focused assertions, 7,421 root assertions, and 137 tutor-core
  assertions green with zero skips. All static and source-only gates pass.
- 2026-07-28 — Activated dependent slice
  `refactor-tutor-stub-world-public-prompt` from PR #345's reviewed head to move
  pure public world-prompt projection into a dependency-free owner. World
  loading, audience derivation, prompt assembly, model calls, state, and effects
  remain in their current owners.
- 2026-07-28 — The public-world-prompt child reached review with a 25-line net
  CLI reduction, 53 focused assertions, 7,423 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass; the localhost suites required their normal authorized execution rather
  than the binding-restricted filesystem sandbox.
- 2026-07-28 — Activated dependent slice
  `refactor-tutor-stub-world-speaker-prompt` from PR #346's reviewed head to move
  pure speaking-tutor evidence-contract projection beside the public-world
  projector. World loading, DAG admission, authorial vocabulary resolution,
  prompt assembly, model calls, state, and effects remain in their current
  owners.
- 2026-07-28 — The world-speaker-prompt child reached review with a 19-line net
  CLI reduction, 55 focused assertions, 7,425 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass.
- 2026-07-28 — Activated dependent slice
  `refactor-tutor-stub-human-discourse-config` from PR #347's reviewed head to
  move the pure three-mode run contract and stable schema/phase constants into
  a dependency-free owner. Normalization, prompt construction, turn state, DAG
  execution, model calls, traces, and effects remain in their current owners.
- 2026-07-28 — The human-discourse-config child reached review with a 45-line
  net CLI reduction, 51 focused assertions, 7,427 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass after removing the extraction's stale import and formatting its new
  dependency-free owner.
- 2026-07-28 — The first ten-run stack audit found that runs 4–10 had not
  reached `main`: their PRs were alternately merged into intermediate branches
  or closed as those bases disappeared. Activated
  `refactor-tutor-stub-stack-recovery`, rebased the preserved final branch onto
  current `origin/main`, and froze its cumulative delta to the seven reviewed
  slices plus tests, manifests, and authored workplan sources.
- 2026-07-28 — Stack recovery reached review with 69 focused, 7,427 root, and
  137 tutor-core assertions green with zero skips. All static, manifest,
  source-only workplan, and ref gates pass; no generated workplan view is in
  the cumulative delta.
- 2026-07-28 — Activated second-loop run 1,
  `refactor-tutor-stub-register-palette`, from recovery PR #349's reviewed head.
  Registry loading, CLI parsing, runtime selection, state, and effects remain
  in their current owners.
- 2026-07-28 — Second-loop register-palette run reached review with a 22-line
  net CLI reduction, 67 focused assertions, 7,429 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass.
- 2026-07-28 — Activated second-loop run 2,
  `refactor-tutor-stub-guard-spans`, from PR #350's reviewed head. Guard
  evaluation, repair, accounting, runtime state, and effects remain in their
  current owners.
- 2026-07-28 — Second-loop guard-span run reached review with an 89-line net
  CLI reduction, 26 focused assertions, 7,431 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass.
- 2026-07-28 — Activated second-loop run 3,
  `refactor-tutor-stub-repair-spans`, from PR #351's reviewed head. Repair
  selection, accounting, runtime state, and effects remain in their current
  owners.
- 2026-07-28 — Second-loop repair-span run reached review with a 28-line net
  CLI reduction, 14 focused assertions, 7,433 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass.
- 2026-07-28 — Activated second-loop run 4,
  `refactor-tutor-stub-guard-attempt-envelope`, from PR #352's reviewed head.
  Audit evaluation, repair selection, accounting aggregation, runtime state,
  and effects remain in their current owners.
- 2026-07-28 — Second-loop guard-attempt-envelope run reached review with a
  32-line net CLI reduction, 16 focused assertions, 7,435 root assertions, and
  137 tutor-core assertions green with zero skips. All static and source-only
  gates pass; one dead wrapper exposed by the extraction was removed.
- 2026-07-28 — Activated second-loop run 5,
  `refactor-tutor-stub-scaffold-state`, from PR #353's reviewed head. World and
  dramaturgy loading, branch choice, release scheduling, model calls, runtime
  state, and effects remain in their current owners.
- 2026-07-28 — Second-loop scaffold-state run reached review with a 51-line
  net CLI reduction, 48 focused assertions, 7,438 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass.
- 2026-07-28 — Activated second-loop run 6,
  `refactor-tutor-stub-side-arc-state`, from PR #354's reviewed head. Learner
  classification, generous inference, scaffold construction, model calls,
  runtime state, and effects remain in their current owners.
- 2026-07-28 — Second-loop side-arc-state run reached review with a 52-line net
  CLI reduction, 49 focused assertions, 7,444 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass.
- 2026-07-28 — Activated second-loop run 7,
  `refactor-tutor-stub-warrant-audit-projection`, from PR #355's reviewed head.
  Human-discourse extraction, world fact rendering, learner classification,
  model calls, runtime state, and effects remain in their current owners.
- 2026-07-28 — Second-loop warrant-audit run reached review with a 56-line net
  CLI reduction, 48 focused assertions, 7,447 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass.
- 2026-07-28 — Activated second-loop run 8,
  `refactor-tutor-stub-strict-dag-audit`, from PR #356's reviewed head. DAG
  construction, learner updates, warrant audit, proof debt, model calls,
  runtime state, and effects remain in their current owners.
- 2026-07-28 — Second-loop strict-DAG-audit run reached review with a 16-line
  net CLI reduction, 48 focused assertions, 7,450 root assertions, and 137
  tutor-core assertions green with zero skips. All static and source-only gates
  pass.
- 2026-07-28 — Activated second-loop run 9,
  `refactor-tutor-stub-dag-memory-reliability`, from PR #357's reviewed head.
  Dropout scheduling, board mutation, DAG construction, model calls, runtime
  state, and effects remain in their current owners.
- 2026-07-28 — Second-loop DAG-memory-reliability run reached review with 16
  duplicate source lines removed across the CLI and public-analysis service,
  41 focused assertions, 7,452 root assertions, and 137 tutor-core assertions
  green with zero skips. All static and source-only gates pass.
- 2026-07-28 — Activated second-loop run 10,
  `refactor-tutor-stub-dag-snapshot-model`, from PR #358's reviewed head. The
  completed `dag-snapshot-projection` card remains the earlier terminal-line
  presentation slice.
  Tutor-DAG construction, release scheduling, state access, terminal writes,
  runtime callers, and effects remain in their current owners.
- 2026-07-28 — Second-loop tutor-DAG-snapshot run reached review with a
  61-line net CLI reduction, eight focused assertions including the byte-exact
  live Marrick terminal block, 7,454 root assertions, and 137 tutor-core
  assertions green with zero skips. All static and source-only gates pass.
- 2026-07-28 — GitHub marked PRs #352–#359 merged while retaining feature
  branches as their bases, so their reviewed commits did not enter `main`.
  Replayed only those eight missing slices onto current `origin/main` under
  `refactor-tutor-stub-second-loop-recovery`; the complete hermetic contract
  passes before beginning the third ten-run loop.
- 2026-07-28 — Activated third-loop run 1,
  `refactor-tutor-stub-debug-identifiers`, from recovery PR #360's reviewed
  head. Trace persistence, filesystem writes, terminal presentation, and
  runtime state remain in their current owners.
- 2026-07-28 — Third-loop debug-identifier run reached review with a 10-line
  net CLI reduction, five focused assertions, and complete zero-skip hermetic
  parity. All static and source-only gates pass.
- 2026-07-28 — Activated third-loop run 2,
  `refactor-tutor-stub-fact-matching`, from PR #361's reviewed head. Public
  premise selection, entailment, leak policy, world state, and effects remain
  in their current owners.
- 2026-07-28 — Third-loop fact-matching run reached review with a 20-line net
  CLI reduction, five focused assertions, and complete zero-skip hermetic
  parity. All static and source-only gates pass.
- 2026-07-28 — Activated third-loop run 3,
  `refactor-tutor-stub-public-evidence`, from PR #362's reviewed head. Release
  scheduling, world loading, response audit policy, runtime state, and effects
  remain in their current owners.
- 2026-07-28 — Third-loop public-evidence run reached review with a 51-line
  net CLI reduction, seven focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated third-loop run 4,
  `refactor-tutor-stub-response-leak-audit`, from PR #363's reviewed head.
  Release scheduling, response generation, guard orchestration, runtime state,
  and effects remain in their current owners.
- 2026-07-28 — Third-loop response-leak-audit run reached review with a
  245-line net CLI reduction, 18 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated third-loop run 5,
  `refactor-tutor-stub-one-line-projection`, from PR #364's reviewed head.
  Call-site budgets, menu/report construction, terminal writes, runtime state,
  and effects remain in their current owners.
- 2026-07-28 — Third-loop one-line-projection run reached review with a
  seven-line net CLI reduction, five focused assertions, and complete
  zero-skip hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated third-loop run 6,
  `refactor-tutor-stub-generous-fallback`, from PR #365's reviewed head.
  Generous-inference detection, response generation, state, and effects remain
  in their current owners.
- 2026-07-28 — Third-loop generous-fallback run reached review with an
  18-line net CLI reduction, 14 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated third-loop run 7,
  `refactor-tutor-stub-director-notes-model`, from PR #366's reviewed head.
  Director opening/release effects, traces, terminal writes, slash dispatch,
  runtime state, and withholding policy remain unchanged.
- 2026-07-28 — Third-loop director-notes-model run reached review with a
  15-line net CLI reduction, seven focused assertions including byte-exact live
  terminal fixtures, and complete zero-skip hermetic parity. All static and
  source-only gates pass.
- 2026-07-28 — Activated third-loop run 8,
  `refactor-tutor-stub-prompt-blocks`, from PR #367's reviewed head. Authored
  block constants, full prompt assembly, world selection, state, and effects
  remain in their current owners.
- 2026-07-28 — Third-loop prompt-blocks run reached review with a 20-line net
  CLI reduction, six focused assertions, and complete zero-skip hermetic
  parity. All static and source-only gates pass.
- 2026-07-28 — Activated third-loop run 9,
  `refactor-tutor-stub-recipe-model-identity`, from PR #368's reviewed head.
  Live provider resolution, CLI model selection, runtime state, and effects
  remain in their current owners.
- 2026-07-28 — Third-loop recipe-model-identity run reached review with a
  28-line net CLI reduction, 15 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated third-loop run 10,
  `refactor-tutor-stub-model-temperature`, from PR #369's reviewed head.
  Provider selection, requested-temperature state, model calls, and effects
  remain in their current owners.
- 2026-07-28 — Third-loop model-temperature run reached review with a 10-line
  net CLI reduction, three focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 1,
  `refactor-tutor-stub-cli-parsing`, from PR #370's reviewed head. Argument
  ownership, runtime defaults, launch orchestration, and effects remain in
  their current owners.
- 2026-07-28 — Fifty-loop CLI-parsing run reached review with a 34-line net CLI
  reduction, six focused assertions, and complete zero-skip hermetic parity.
  All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 2,
  `refactor-tutor-stub-model-selection`, from PR #371's reviewed head. Provider
  definitions, environment configuration, runtime model state, and effects
  remain in their current owners.
- 2026-07-28 — Fifty-loop model-selection run reached review with a 27-line net
  CLI reduction, nine focused assertions including byte-exact live terminal
  blocks, and complete zero-skip hermetic parity. All static and source-only
  gates pass.
- 2026-07-28 — Activated fifty-loop run 3,
  `refactor-tutor-stub-dag-mode`, from PR #372's reviewed head. Allowed-mode
  configuration, runtime DAG state, launch orchestration, and effects remain in
  their current owners.
- 2026-07-28 — Fifty-loop DAG-mode run reached review with a six-line net CLI
  reduction, 11 focused assertions, and complete zero-skip hermetic parity.
  All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 4,
  `refactor-tutor-stub-register-prior-loading`, from PR #373's reviewed head.
  Policy selection, runtime register state, filesystem location, and effects
  remain in their current owners.
- 2026-07-28 — Fifty-loop register-prior-loading run reached review with a
  22-line net CLI reduction, 27 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 5,
  `refactor-tutor-stub-visible-model`, from PR #374's reviewed head. Provider
  resolution, runtime model state, launch orchestration, and effects remain in
  their current owners.
- 2026-07-28 — Fifty-loop visible-model run reached review with a 12-line net
  CLI reduction, 25 focused assertions, and complete zero-skip hermetic parity.
  All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 6,
  `refactor-tutor-stub-register-prompt-vocabulary`, from PR #376's reviewed
  head. Runtime register state, prompt assembly, policy selection, and effects
  remain in their current owners.
- 2026-07-28 — Fifty-loop register-prompt-vocabulary run reached review with a
  25-line net CLI reduction, 26 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 7,
  `refactor-tutor-stub-learner-dag-prompt`, from PR #377's reviewed head.
  Learner-DAG construction, runtime state, prompt assembly, and effects remain
  in their current owners.
- 2026-07-28 — Fifty-loop learner-DAG-prompt run reached review with an 18-line
  net CLI reduction, five focused assertions, and complete zero-skip hermetic
  parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 8,
  `refactor-tutor-stub-register-history-prompt`, from PR #379's reviewed head.
  Register normalization, runtime state, prompt assembly, policy selection, and
  effects remain in their current owners.
- 2026-07-28 — Fifty-loop register-history-prompt run reached review with a
  15-line net CLI reduction, 25 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 9,
  `refactor-tutor-stub-classifier-world-context`, from PR #380's reviewed head.
  Classifier prompt assembly, runtime state, model calls, and effects remain in
  their current owners.
- 2026-07-28 — Fifty-loop classifier-world-context run reached review with a
  10-line net CLI reduction, five focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 10,
  `refactor-tutor-stub-failed-classification`, from PR #381's reviewed head.
  Classifier invocation, error handling, runtime state, and effects remain in
  their current owners.
- 2026-07-28 — Fifty-loop failed-classification run reached review with a
  27-line net CLI reduction, eight focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass. Fifty-loop runs 1–10
  have removed 196 net lines from `scripts/tutor-stub.js` without regressions.
- 2026-07-28 — Activated fifty-loop run 11,
  `refactor-tutor-stub-learner-advance-classification`, from PR #383's reviewed
  head. Learner-DAG inference, classifier invocation, runtime state, and effects
  remain in their current owners.
- 2026-07-28 — Fifty-loop learner-advance-classification run reached review
  with a 21-line net CLI reduction, nine focused assertions, and complete
  zero-skip hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 12,
  `refactor-tutor-stub-interim-state-holder`, from PR #384's reviewed head. TTY
  checks, animation timers, runtime state, terminal writes, and effects remain
  in their current owners.
- 2026-07-28 — Fifty-loop interim-state-holder run reached review with a
  13-line net CLI reduction, 12 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 13,
  `refactor-tutor-stub-previous-learner-dag`, from PR #386's reviewed head. DAG
  construction, interim summaries, runtime state, and effects remain in their
  current owners.
- 2026-07-28 — Fifty-loop previous-learner-DAG run reached review with a
  five-line net CLI reduction, 13 focused assertions, and complete zero-skip
  hermetic parity. Its focused fixture now pins the existing immediate-
  predecessor/undefined-model contract. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 14,
  `refactor-tutor-stub-interim-learner-dag-summary`, from PR #387's reviewed
  head. Learner-DAG inference, context assembly, runtime state, and effects
  remain in their current owners.
- 2026-07-28 — Fifty-loop interim-learner-DAG-summary run reached review with a
  14-line net CLI reduction, 14 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 15,
  `refactor-tutor-stub-interim-learner-summary`, from PR #388's reviewed head.
  Classification, context assembly, runtime state, and effects remain in their
  current owners.
- 2026-07-28 — Fifty-loop interim-learner-summary run reached review with a
  15-line net CLI reduction, 15 focused assertions, and complete zero-skip
  hermetic parity. The focused fixture pins score-band and compaction
  boundaries; all static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 16,
  `refactor-tutor-stub-interim-register-summary`, from PR #389's reviewed head.
  Register selection, efficacy scoring, runtime state, and effects remain in
  their current owners.
- 2026-07-28 — Fifty-loop interim-register-summary run reached review with a
  26-line net CLI reduction, 16 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 17,
  `refactor-tutor-stub-interim-dag-movement`, from PR #390's reviewed head. DAG
  feature construction, runtime state, and effects remain in their current
  owners.
- 2026-07-28 — Fifty-loop interim-DAG-movement run reached review with a
  35-line net CLI reduction, 17 focused assertions, and complete zero-skip
  hermetic parity. Static lint also removed the obsolete CLI lookup alias; all
  static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 18,
  `refactor-tutor-stub-interim-learner-record`, from PR #391's reviewed head.
  Learner-record updates, fact rendering, runtime state, and effects remain in
  their current owners.
- 2026-07-28 — Fifty-loop interim-learner-record run reached review with a
  16-line net CLI reduction, 18 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 19,
  `refactor-tutor-stub-interim-objective-summary`, from PR #392's reviewed
  head. Release-row computation, classification, register selection, runtime
  state, and effects remain in their current owners.
- 2026-07-28 — Fifty-loop interim-objective-summary run reached review with a
  23-line net CLI reduction, 19 focused assertions, and complete zero-skip
  hermetic parity. All static and source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 20,
  `refactor-tutor-stub-interim-field-summary`, from PR #393's reviewed head.
  Dialogue-field construction, runtime state, and effects remain in their
  current owners.
- 2026-07-28 — Fifty-loop interim-field-summary run reached review with an
  11-line net CLI reduction, 20 focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass. Fifty-loop runs 1–20 have
  removed 375 net lines from `scripts/tutor-stub.js` without regressions.
- 2026-07-28 — Activated fifty-loop run 21,
  `refactor-tutor-stub-interim-evidence-timing`, from PR #394's reviewed head.
  Release scheduling, runtime state, and effects remain in their current
  owners.
- 2026-07-28 — Fifty-loop interim-evidence-timing run reached review with a
  14-line net CLI reduction, 21 focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 22,
  `refactor-tutor-stub-interim-clue-progress`, from PR #395's reviewed head.
  DAG snapshot construction, runtime state, and effects remain in their current
  owners.
- 2026-07-28 — Fifty-loop interim-clue-progress run reached review with a
  six-line net CLI reduction, 22 focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 23,
  `refactor-tutor-stub-interim-dialogue-outlook`, from PR #396's reviewed head.
  Field and DAG construction, runtime state, and effects remain in their
  current owners.
- 2026-07-28 — Fifty-loop interim-dialogue-outlook run reached review with a
  20-line net CLI reduction, 23 focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 24,
  `refactor-tutor-stub-next-release-row`, from PR #397's reviewed head. Release
  scheduling, runtime state, and effects remain unchanged.
- 2026-07-28 — Fifty-loop next-release-row run reached review with a 12-line
  net CLI reduction, 14 focused assertions, and complete zero-skip hermetic
  parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 25,
  `refactor-tutor-stub-committed-release-rows`, from PR #398's reviewed head.
  Release scheduling, public premise semantics, runtime state, and effects
  remain unchanged.
- 2026-07-28 — Fifty-loop committed-release-rows run reached review with a
  15-line net CLI reduction, 15 focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 26,
  `refactor-tutor-stub-current-release-rows`, from PR #399's reviewed head.
  Release scheduling, public premise semantics, runtime state, and effects
  remain unchanged.
- 2026-07-28 — Fifty-loop current-release-rows run reached review with a
  30-line net CLI reduction, 16 focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 27,
  `refactor-tutor-stub-public-release-ledger`, from PR #400's reviewed head.
  Committed-row selection, runtime state, and effects remain unchanged.
- 2026-07-28 — Fifty-loop public-release-ledger run reached review with the
  ledger shape removed from the CLI, eight focused assertions, and complete
  zero-skip hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 28,
  `refactor-tutor-stub-learner-public-evidence-state`, from PR #401's reviewed
  head. Committed-row selection, learner-DAG inference, runtime state, and
  effects remain unchanged.
- 2026-07-28 — Fifty-loop learner-public-evidence-state run reached review with
  a three-line net CLI reduction, nine focused assertions, and complete
  zero-skip hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 29,
  `refactor-tutor-stub-streaming-capability`, from PR #402's reviewed head.
  Provider resolution, network calls, token sinks, runtime state, and effects
  remain unchanged.
- 2026-07-28 — Fifty-loop streaming-capability run reached review with a
  four-line net CLI reduction, four focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 30,
  `refactor-tutor-stub-stream-label`, from PR #403's reviewed head. Token sinks,
  terminal writes, runtime state, and effects remain in the CLI.
- 2026-07-28 — Fifty-loop stream-label run reached review with a three-line net
  CLI reduction, five focused assertions, and complete zero-skip hermetic
  parity. All static/source-only gates pass. Fifty-loop runs 1–30 have removed
  483 net lines from `scripts/tutor-stub.js` without regressions.
- 2026-07-28 — Activated fifty-loop run 31,
  `refactor-tutor-stub-console-token-sink`, from PR #404's reviewed head.
  Terminal writes, animation control, runtime state, and effects remain owned
  by the CLI through injected adapters.
- 2026-07-28 — Fifty-loop console-token-sink run reached review with an
  18-line net CLI reduction, seven focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 32,
  `refactor-tutor-stub-console-stream-replay`, from PR #405's reviewed head.
  Sink creation, terminal writes, animation control, runtime state, and effects
  remain injected from the CLI.
- 2026-07-28 — Fifty-loop console-stream-replay run reached review with a
  two-line net CLI reduction, eight focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 33,
  `refactor-tutor-stub-trace-secret-redaction`, from PR #406's reviewed head.
  Trace creation, persistence, runtime state, and effects remain unchanged.
- 2026-07-28 — Fifty-loop trace-secret-redaction run reached review with a
  28-line net CLI reduction, five focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 34,
  `refactor-tutor-stub-trace-provenance`, from PR #407's reviewed head. Hashing,
  Git inspection, trace creation, persistence, runtime state, and effects
  remain injected or unchanged.
- 2026-07-28 — Fifty-loop trace-provenance run reached review with an 11-line
  net CLI reduction, seven focused assertions, and complete zero-skip hermetic
  parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 35,
  `refactor-tutor-stub-trace-display-path`, from PR #408's reviewed head.
  Filesystem resolution, trace persistence, runtime state, and effects remain
  injected or unchanged.
- 2026-07-28 — Fifty-loop trace-display-path run reached review with relative
  path semantics centralized in the trace schema, eight focused assertions,
  and complete zero-skip hermetic parity. The explicit import adds three CLI
  lines; all static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 36,
  `refactor-tutor-stub-state-debug-identity`, from PR #409's reviewed head.
  Debug printing, clipboard operations, runtime state, and effects remain in
  the CLI.
- 2026-07-28 — Fifty-loop state-debug-identity run reached review with a
  six-line net CLI reduction, seven focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 37,
  `refactor-tutor-stub-technical-debug-predicate`, from PR #410's reviewed head.
  Debug printing, clipboard operations, runtime state, and effects remain in
  the CLI.
- 2026-07-28 — Fifty-loop technical-debug-predicate run reached review with a
  three-line net CLI reduction, eight focused assertions, and complete
  zero-skip hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Activated fifty-loop run 38,
  `refactor-tutor-stub-debug-id-line`, from PR #411's reviewed head. Console
  writing, broader debug printing, clipboard operations, runtime state, and
  effects remain injected or in the CLI.
- 2026-07-28 — Fifty-loop debug-ID-line run reached review with a two-line net
  CLI reduction, nine focused assertions, and complete zero-skip hermetic
  parity. All static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 38 as PR #412 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 39,
  `refactor-tutor-stub-technical-debug-print-gate`, from PR #412's reviewed
  head. Concurrent-terminal printing, broader debug rendering, runtime state,
  and effects remain injected or in the CLI.
- 2026-07-28 — Fifty-loop technical-debug-print-gate run reached review with a
  one-line net CLI reduction, ten focused assertions, and complete zero-skip
  hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 39 as PR #413 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 40,
  `refactor-tutor-stub-current-debug-selection`, from PR #413's reviewed head.
  Clipboard access, clipboard text formatting, terminal writes, runtime state,
  and effects remain in the CLI.
- 2026-07-28 — Fifty-loop current-debug-selection run reached review with a
  three-line net CLI reduction, eleven focused assertions, and complete
  zero-skip hermetic parity. All static/source-only gates pass. Fifty-loop runs
  31–40 have removed 71 net lines from `scripts/tutor-stub.js` while
  centralizing transport, trace, and debug contracts without regressions.
- 2026-07-28 — Opened fifty-loop run 40 as PR #414 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 41,
  `refactor-tutor-stub-debug-line-printers`, from PR #414's reviewed head.
  Console output, color-state ownership, concurrent-terminal orchestration,
  runtime state, and effects remain injected or in the CLI.
- 2026-07-28 — Fifty-loop debug-line-printers run reached review with a
  twelve-line net CLI reduction, twelve focused assertions, and complete
  zero-skip hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 41 as PR #415 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 42,
  `refactor-tutor-stub-current-debug-lines`, from PR #415's reviewed head.
  Clipboard access, terminal writes, runtime state, and effects remain in the
  CLI.
- 2026-07-28 — Fifty-loop current-debug-lines run reached review with a
  five-line net CLI reduction, thirteen focused assertions, and complete
  zero-skip hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 42 as PR #416 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 43,
  `refactor-tutor-stub-current-debug-reporter`, from PR #416's reviewed head.
  Clipboard implementation, console implementation, live color state, runtime
  state, and effects remain injected by the CLI.
- 2026-07-28 — Fifty-loop current-debug-reporter run reached review with a
  fifteen-line net CLI reduction, fourteen focused assertions, and complete
  zero-skip hermetic parity. A lint-detected unused binding was repaired before
  the clean full rerun; all static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 43 as PR #417 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 44,
  `refactor-tutor-stub-turn-attempt-guard`, from PR #417's reviewed head.
  Abort-controller creation, cancellation timing, runtime state, and effects
  remain in the CLI.
- 2026-07-28 — Fifty-loop turn-attempt-guard run reached review with a
  twelve-line net CLI reduction, three focused assertions, synchronized
  hermetic inventory, and complete zero-skip hermetic parity. Lint removed an
  obsolete import before the clean full rerun; all static/source-only gates
  pass.
- 2026-07-28 — Opened fifty-loop run 44 as PR #418 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 45,
  `refactor-tutor-stub-register-state-restoration`, from PR #418's reviewed
  head. Trace loading, state creation, persistence, runtime sequencing, and
  effects remain in the CLI.
- 2026-07-28 — Fifty-loop register-state-restoration run reached review with a
  twenty-one-line net CLI reduction, four focused assertions, synchronized
  hermetic inventory, and complete zero-skip hermetic parity. All
  static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 45 as PR #419 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 46,
  `refactor-tutor-stub-comprehension-restoration`, from PR #419's reviewed
  head. Trace loading, state creation, persistence, runtime sequencing, and
  effects remain in the CLI.
- 2026-07-28 — Fifty-loop comprehension-restoration run reached review with an
  eighteen-line net CLI reduction, eleven focused assertions, and complete
  zero-skip hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 46 as PR #420 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 47,
  `refactor-tutor-stub-director-guidance-restoration`, from PR #420's reviewed
  head. Trace loading, state creation, persistence, runtime sequencing, and
  effects remain in the CLI.
- 2026-07-28 — Fifty-loop director-guidance-restoration run reached review with
  a sixteen-line net CLI reduction, fifteen focused assertions, and complete
  zero-skip hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 47 as PR #421 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 48,
  `refactor-tutor-stub-typed-action-decision-lookup`, from PR #421's reviewed
  head. Ledger reconstruction, lifecycle validation, trace loading, runtime
  state, and effects remain in the CLI.
- 2026-07-28 — Fifty-loop typed-action-decision-lookup run reached review with
  an eight-line net CLI reduction, three focused assertions, synchronized
  hermetic inventory, and complete zero-skip hermetic parity. All
  static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 48 as PR #422 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 49,
  `refactor-tutor-stub-typed-action-restoration`, from PR #422's reviewed head.
  Trace loading, state creation, persistence, runtime sequencing, and live
  typed-action effects remain in the CLI.
- 2026-07-28 — Fifty-loop typed-action-restoration run reached review with a
  one-hundred-eight-line net CLI reduction, seven focused assertions, and
  complete zero-skip hermetic parity. All static/source-only gates pass.
- 2026-07-28 — Opened fifty-loop run 49 as PR #423 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline.
- 2026-07-28 — Activated fifty-loop run 50,
  `refactor-tutor-stub-learner-dag-replay`, from PR #423's reviewed head.
  World/trace loading, state creation, persistence, live DAG updates, runtime
  sequencing, and effects remain in the CLI.
- 2026-07-28 — Fifty-loop learner-DAG-replay run reached review with a
  thirty-line net CLI reduction, four focused assertions, synchronized
  hermetic inventory, and complete zero-skip hermetic parity. All
  static/source-only gates pass. Across all fifty bounded runs,
  `scripts/tutor-stub.js` fell from 23,999 to 23,200 lines: a 799-line net
  reduction with no validated behavior regression.
- 2026-07-28 — Opened fifty-loop run 50 as PR #424 against `main`; the push
  benchmark remained byte-identical to its standing failed baseline. All fifty
  requested refactor/validate/commit/push/PR cycles are published.
- 2026-08-05 — Reconciled the parent after macro cycles 1–16 merged through PR
  #484. The tutor-stub entrypoint has reached its near-2,000 functional-body
  destination; the programme remains active for the explicit extracted-owner
  boundary card and later ranked hotspots, rather than for further helper-sized
  entrypoint shaving.
