---
id: tutor-stub-resume-last-recipe
title: Reconstruct the saved recipe before resuming the latest tutor-stub trace
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: A CLI regression proves --resume-last selects the newest completed
  trace, reconstructs its saved lab and structural options before drift
  comparison, resumes with drift.ok true, and retains fail-closed checks for
  explicit overrides and genuine prompt, tutor, model, world, or schema drift.
branch: codex/fix-resume-last-recipe
links:
  code:
    - scripts/tutor-stub.js
    - tests/tutorStubLabsRecipeCli.test.js
tags:
  - tutor-stub
  - resume
  - session-recipe
milestone: evaluation-infrastructure
---

`--resume-last` discovered its trace after launch configuration had already
been resolved, so it compared the saved mixed/DAG recipe against bare CLI
defaults and rejected a configuration that explicit `--resume <trace>` could
reconstruct exactly.

Acceptance:

- Resolve explicit and latest resume sources before lab/default selection.
- Apply either source recipe through the same option-precedence path.
- Keep explicit CLI overrides authoritative and visible as drift.
- Keep the mutual-exclusion and no-usable-trace behavior unchanged.
- Do not weaken or bypass the existing drift acknowledgement boundary.

Log:

- 2026-07-26 — Reproduced from Rowan Flat trace
  `2026-07-25T22-35-28-793Z`: explicit resume reconstructed config hash
  `8dcbe301...` with no drift, while `--resume-last` reported lab, prompt, DAG,
  mixed-learner, palette, and learner-DAG drift before any model call.
- 2026-07-26 — Fixed latest-trace preparation to reconstruct the selected
  trace's saved lab and structural options before launch resolution. The same
  Rowan Flat trace now resumes with `drift.ok: true`, an empty drift list, and
  the unchanged config hash `8dcbe301...`; explicit model overrides still fail
  closed. Validation: resume/lab/recipe tests 26/26, hermetic root shards
  2,357/2,357 and 4,478/4,478, tutor-core 137/137, workplan source check
  195/195, ESLint, targeted Prettier, and `git diff --check`.
- 2026-07-27 — Closed. [PR #246](https://github.com/liammagee/machinespirits-eval/pull/246)
  merged 2026-07-25 with all six CI lanes green. As with
  [[tutor-stub-resume-handoff]], the PR body omitted its `Workplan item:` line,
  so the association is recorded here.
