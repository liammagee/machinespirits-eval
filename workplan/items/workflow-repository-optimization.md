---
id: workflow-repository-optimization
title: Close the remaining workflow and repository optimization gaps
status: active
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-19
updated: 2026-08-19
branch: codex/workflow-coordination-safety
verification: >-
  Reproducible before/after measurements show that local and hosted CI select
  the same fail-closed profiles, avoid measured orchestration and test delays,
  preserve required coverage, and make zero model calls from a relevant
  pre-push hook without fresh explicit authority; later repository-state
  tranches retain restorable evidence and authoritative workplan sources
  without destructive cleanup or history rewriting.
links:
  items:
    - optimize-ci-agent-iteration-loop
    - local-ci-parity-runner
    - local-ci-pr-creation-gate
    - shorten-full-ci-critical-path
    - add-validator-only-ci-profile
    - optimize-local-node-execution
    - codebase-refactoring-program
    - tutor-pr-frozen-prefix-benchmark
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/705
  notes:
    - docs/next-steps/2026-08-19-coordinator-workflow-efficiency-audit.md
tags:
  - ci
  - latency
  - developer-experience
  - worktrees
  - repository-hygiene
---

The earlier optimization programme established fail-closed hosted profiles,
packaged local CI, and several bounded test-speed improvements. A current audit
found residual cost in local/hosted profile drift, fast-lane orchestration,
specific process-heavy tests, generated workplan commits, hydrated evidence in
task worktrees, and accumulated local artifacts. Close those measured gaps as
four outcome waves without reopening completed slices or manufacturing repair
PRs.

The initial authorization covered Wave 0 and Wave 1 only. It did not authorize
deleting worktrees or artifacts, selecting or writing an external artifact
store, rewriting Git history, or implementing later waves.

The 2026-08-19 live coordinator audit adds a bounded Wave 2A authorization:
record the audit and make model-backed pre-push execution require fresh,
explicit, attended authority. Keep path classification, deterministic checks,
cached reports, hard ceilings, and the reasoned bypass intact. Skill routing,
request packaging, artifact movement, repository truncation, and dead-code
separation remain later work unless separately authorized.

Wave 1 acceptance:

- Record the exact base SHA and reproducible local/hosted before measurements.
- Make local and hosted classification agree for representative focused,
  validator-only, full, mixed, and unknown changes, retaining full CI on
  ambiguity.
- Remove only demonstrated fast-lane bootstrap and slow-test delays; retain
  process boundaries where they are part of the tested contract.
- Repeat the same measurements after the change and keep only reproducible
  improvements with unchanged required coverage.
- Pass the focused classifier, workflow, affected-test, manifest, workplan,
  lint, formatting, diff, and complete hosted CI gates.
- Integrate Wave 1 through one outcome PR; fix attributable failures on that
  branch rather than opening a repair PR.

Later planned waves:

- Make coordinator publication review-first and milestone-reported; split the
  oversized tutor-stub skill into a short router plus task-specific references,
  and package digest-bound requests through one deterministic zero-call proof
  command.
- Stop committing generated workplan views while keeping every consumer able
  to render current source items.
- Define a checksummed artifact fetch/verify/restore boundary before moving any
  raw evidence out of Git or deleting a local copy.
- Close only high-confidence stale-code candidates after consumer and
  provenance checks, then reconcile the existing refactoring parent.

Log:

- 2026-08-19 — Wave 0 started from remote `main`
  `bdaa32db4aa61ef0ebd25299cd81e5499ace08b9`. Repaired the broken configured
  repository alias by preserving the old symlink as
  `/Users/lmagee/Dev/machinespirits-eval.broken-2026-08-19` and pointing the
  original path to the canonical checkout. Created the integration worktree
  with LFS smudging disabled; its initial size was 263,844 KiB versus roughly
  751 MiB for ordinary hydrated worktrees. No worktree, artifact, or history
  was removed.
- 2026-08-19 — Integrated the isolated CI slice. Local CI now defaults to the
  hosted fail-closed change classifier while preserving explicit legacy
  profiles. Historical PR shapes classify as expected: PR #699 full, PR #700
  validator-only, and PR #701 focused; mixed, runtime, and unknown changes
  remain full. With dependencies already installed, the representative
  validator-only and focused lanes completed in 1.64 seconds and 1.07 seconds,
  respectively. Hosted workflow topology was intentionally unchanged because
  no safe bootstrap-only reduction survived review.
- 2026-08-19 — Integrated the isolated slow-test slice. Setting
  `GIT_NO_LAZY_FETCH=1` only in the trailer-hook test subprocess prevents its
  deliberately unreachable object ID from causing partial-clone network
  waits. Two comparable runs improved from 2.68 and 2.56 seconds (2.62-second
  mean) to 1.88 and 1.75 seconds (1.815-second mean), a 30.7% reduction, while
  preserving all 11 assertions and the 51-test affected cohort. An
  output-triggered interactive-direction experiment was discarded because its
  roughly 1.4% change was within measurement noise; production behavior and
  the remaining real-process contracts were left unchanged.
- 2026-08-19 — Reproduced Wave 1 on Node 22.22.3 and Git 2.46.2 from base
  `bdaa32db4aa61ef0ebd25299cd81e5499ace08b9`. The trailer-hook timing command
  was `/usr/bin/time -p node --test
  tests/workplanTrailerPrePushHook.test.js`; two base runs were 2.68 and 2.56
  seconds, the isolated worker's two after runs were 1.88 and 1.75 seconds, and
  coordinator after runs were 1.78 and 1.78 seconds. The focused timings were
  dependency-ready lane timings, not default fresh-install timings, using
  `node scripts/run-local-ci.js --base 6d0241fcc63bc54097fbb04266922101d55b5ed6
  --head e168833fcb73ac04becf7d2aa2f1a28ccf99c705 --lane validator-only
  --no-install --offline --surface never` for PR #700 and the same command with
  base `054f6bfbe3796f3e3df49c85f6a005e0fdfe3bac`, head
  `c0087c0a709dccea5d8fb83a2a0bce05650078e1`, and lane `focused` for PR #701.
  Root shard 2 passed with 4,053 passed and 7 registered skips. Root shard 1's single
  `writingPadNarrativeBuilder` failure (4,969 passed, 11 registered skips) and
  tutor-core's single `writingPadInternalPathDelivery` failure (136 passed)
  reproduced on the untouched base; retained reports are under
  `.test-tmp/wave1-root-shard1-rerun/`, `.test-tmp/wave1-core-rerun/`, and the
  test worker's `.test-tmp/wave1-base-core/`. The latest full hosted `main`
  baseline, Actions run 32313112912, passed both root shards, tutor-core, and
  risk coverage on Node 22 and 24. Those unrelated local baseline failures were
  recorded but not repaired in this PR.
- 2026-08-19 — The first hosted PR run, Actions run 32317822501, exposed a
  branch-attributable process-lifecycle race in the new local Git collector:
  both Node 22 and 24 shard 1 could receive the child `exit` event before its
  stdout pipe delivered the final NUL-delimited paths. The other two root
  shards and every non-root gate passed. Resolving on `close` instead preserves
  all buffered stdout and stderr. The focused classifier/local-runner contract
  then passed 26 of 26 tests on local Node 22.22.3 and Node 24.19.0 with
  `node --test tests/localCiRunner.test.js tests/ciChangePolicy.test.js` (using
  `npx --yes node@24` for the Node 24 parity run). The repair remains on this
  outcome branch for a same-PR hosted rerun.
- 2026-08-19 — PR #705 merged Wave 0/1 at
  `9b91e670b83f0133027604e6e544d50518063ed8` after 14 successful hosted checks.
  The final implementation aligns local and hosted fail-closed classification,
  preserves NUL-delimited Git paths and drained child output, and removes the
  measured lazy-fetch test delay. No additional cherry-pick is required.
- 2026-08-19 — Audited the live `Verify resistance programme` coordinator at a
  fixed 107-minute snapshot: 246 activity items, 103 waits, 51 progress
  messages, 27 direct commands, and 10 subordinate tasks. The task produced a
  real study result and two implementation merges, but reviews after initial
  publication, repeated skill reads, short polling, and low-risk duplicate
  reviewers added avoidable cost. A shared pre-push hook also made six
  model-backed benchmark calls without fresh per-push approval. The linked
  audit defines Wave 2A authorization safety and later routing/packaging work;
  it does not authorize another study or destructive repository changes.
- 2026-08-19 — Implemented the Wave 2A live-call boundary before publication.
  A fresh benchmark launch now requires one transient token bound to the full
  HEAD oid, selected preset, and configured call ceiling; missing, boolean,
  stale-SHA, wrong-preset, and wrong-ceiling values make zero calls. Cached
  passes and report-only failures remain zero-call, a cached failure under
  blocking enforcement cannot spend again, and a cached technical block may
  retry only with a fresh exact token. The first independent review caught the
  missing executable launch-seam assertion and the cached-blocking rerun path;
  both were repaired before the first push, and re-review returned no blockers.
  The five benchmark/rubric/calibration suites pass 32/32 alongside manifest,
  workplan, ESLint, Prettier, cycle, and diff checks. No model call was made.
