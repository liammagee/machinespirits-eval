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
branch: codex/workflow-repository-optimization
verification: >-
  Reproducible before/after measurements show that local and hosted CI select
  the same fail-closed profiles, avoid measured orchestration and test delays,
  and preserve required coverage; later repository-state tranches retain
  restorable evidence and authoritative workplan sources without destructive
  cleanup or history rewriting.
links:
  items:
    - optimize-ci-agent-iteration-loop
    - local-ci-parity-runner
    - local-ci-pr-creation-gate
    - shorten-full-ci-critical-path
    - add-validator-only-ci-profile
    - optimize-local-node-execution
    - codebase-refactoring-program
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

Current authorization covers Wave 0 and Wave 1 only. It does not authorize
deleting worktrees or artifacts, selecting or writing an external artifact
store, rewriting Git history, or implementing later waves.

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
