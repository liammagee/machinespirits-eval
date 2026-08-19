---
id: optimize-ci-agent-iteration-loop
title: Reduce agent iteration and CI feedback latency
status: active
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-18
updated: 2026-08-18
branch: codex/ci-focused-fast-path
verification: "A reproducible PR and Actions timing baseline identifies agent-side and CI-side delay; instruction and workflow changes remove redundant authorization ceremony and low-risk full-matrix runs without weakening research authority, fail-closed runtime coverage, or required workplan/ref checks; follow-up hosted PRs demonstrate the reduced latency."
links:
  prs:
    - 665
    - 666
    - 669
    - 670
    - 671
    - 672
  items:
    - expedite-ci-expensive-boundaries
    - local-ci-parity-runner
    - resistance-action-register-integration
tags:
  - ci
  - agents
  - developer-experience
  - latency
  - governance
---

Small research-authority and workplan changes are paying nearly the same CI and
agent-process cost as runtime changes. Historical artifacts retain their literal
scope, but future runs now have standing bounded technical retry/resume authority.
Stop turning a failed dialogue into new schemas, validators, broad local suites,
repeated canaries, approvals, or multiple PRs unless diagnosis establishes a real
code defect or recovery would exceed the original authorization.

Acceptance:

- Reproduce an approximate baseline from PR, workflow, job, and step timestamps;
  distinguish pre-PR agent work, GitHub queueing, installation, tests, Electron,
  human approval, and paid-model execution where those boundaries are visible.
- Audit `AGENTS.md`, applicable agent skills, the PR template, workplan rules,
  study-authorization instructions, and workflow path/job conditions. Classify
  each cost as integrity-critical, compatibility-critical, or optional ceremony.
- Define the shortest defensible replacement path when no code defect exists:
  preserve the failed attempt, pin the same source/profile/seed/configuration and
  original budget, use a fresh non-overwriting destination, reuse the existing
  authorization and recovery mechanism, run narrow checks, and resume only the
  missing/failed unit. Do not require another approval or PR within the standing
  authority; stop on repeated failure or any source/model/scope/budget change.
- Add no governance schema, bespoke validator, npm alias, or extra PR unless a
  repeated failure class demonstrates that the existing mechanism is inadequate.
- Prototype fail-closed CI classification so workplan/docs/authorization-metadata
  PRs can avoid the four-way root matrix, while runtime, dependency, lockfile,
  workflow, database, evaluator, and tutor/learner changes retain appropriate
  Node 20/22 and hermetic coverage.
- Test whether non-Electron jobs can set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` and
  avoid Electron installation without breaking any selected test; keep packaged
  Electron acceptance authoritative in its own classified workflow.
- Measure the hosted result. Target at least a 50% reduction in median clean
  metadata/workplan PR feedback time and fewer full CI reruns per completed
  agent iteration, with no increase in red-main merges.

Benchmark log:

- 2026-08-18 — Sampled PRs #665-#675 and their pull-request Actions runs. A
  one-pass core CI run is approximately 4m58s median (observed successful range
  4m35s-5m09s). Clean PRs that waited for one green run took about 5m14s-5m23s
  from PR creation to merge, so CI consumed roughly 90% of the visible PR loop.
- 2026-08-18 — A representative metadata-authorization PR (#672) spent 4m53s
  in core CI and 5m23s from PR creation to merge. Its critical Node 20 shard
  spent 84-93s in `npm ci` and 2m38s-2m42s in the root tests; the comparable
  Node 22 install took 11s. Lint finished in 1m36s, risk coverage in 1m19s,
  workplan/validation in under 50s, and PTY coverage in under 1m.
- 2026-08-18 — Before semantic manifest classification, PR #665's packaged
  surface run took 7m57s end to end: 5m57s waiting for a macOS runner and 2m
  executing. The PR merged in 8m30s, versus 4m35s for its core CI. PR #666
  removed that critical path for unrelated scripts-only changes, but the
  approximately five-minute core matrix remains.
- 2026-08-18 — Rework multiplies the fixed cost. PR #666 took 18m with two full
  CI runs. The #669/#670 closeout took 19m50s and three full CI runs totaling
  15m13s after an unrelated stale assertion blocked a workplan-only change.
  PR #671 took 14m16s and three CI attempts totaling 12m56s (one failed, one
  cancelled, one passed).
- 2026-08-18 — Across PRs #665-#675 there were 15 core CI runs for 11 PRs:
  eight passed, six failed, and one was cancelled, totaling about 72m29s of
  per-run wall time. Four PRs merged before their checks finished; three of
  those later reported failure, trading apparent speed for red-main follow-up.
  This sum is not elapsed human time because some runs overlap, and PR timestamps
  do not include pre-PR diagnosis or authoring, but it is a useful lower-bound
  process-cost baseline.
- 2026-08-18 — Traced `no retry or resume authority` to the agent-prepared GO
  request in commit `95aa5fb851` / PR #665; it was not a standing `AGENTS.md`
  rule. The user now grants bounded technical retry/resume authority for future
  runs inside the original source/model/study/configuration/data/budget envelope.
  Historical sealed requests remain unchanged, but future technical recovery
  should use existing machinery and narrow checks without a fresh approval or
  authorization-only PR.
- 2026-08-18 — Implemented the fail-closed hosted classifier documented in
  `docs/ci-agent-iteration-policy.md`. Allowlisted docs/workplan/agent text and
  named authorization metadata now select a no-install focused lane; unknown,
  mixed, runtime, dependency, lockfile, workflow, database, evaluator, test, and
  tutor/learner changes retain full CI. Research prose retains the independent
  validation framework, and workplan/link checks remain independent for every
  PR. Manual dispatch always forces full CI.
- 2026-08-18 — Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` in the root CI and
  validation workflows while leaving packaged Electron acceptance unchanged.
  A fresh root `npm ci` with that boundary completed locally in 8.36s and
  contained no Electron package or binary. The PR template and generated PR body
  were reduced from checkbox ceremony to four routing/evidence fields, and
  `AGENTS.md` now gives a concrete proportional-verification stopping rule.
  Hosted timing remains to be measured after this workflow-changing PR lands;
  this PR itself correctly classifies as full CI.

Initial optimization hypotheses:

1. Path-classify low-risk authored metadata and workplan changes before
   allocating the root matrix; fail closed on ambiguity.
2. Run the complete root suite once on the primary Node version and retain a
   smaller Node 20 compatibility lane unless runtime-sensitive paths change.
3. Skip Electron binary download in every non-packaged job if focused tests
   prove the binary is unnecessary there.
4. Exercise standing bounded technical recovery through the existing artifact
   and narrow validation set, without another approval sentence or PR when the
   original authorization envelope is unchanged.
5. Rewrite repo agent instructions around proportional verification and explicit
   stopping conditions, while leaving paid-call authority literal and strict.
