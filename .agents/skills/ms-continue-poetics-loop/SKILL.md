---
name: ms-continue-poetics-loop
description: Check whether the bounded poetics adaptation-recognition loop is eligible to continue and report its current hold. The historical D42/D50/D53 launch is closed; do not start model-backed work until a new complete registration and current two-stage semantic handoff exist.
---

# Continue Poetics Loop: Hold Check

This skill is read-only. The former D42/D50/D53 recipe is archived under
`references/legacy-d42-d50-d53-workflow.md` and must not be executed.

## Check

1. Record the exact checkout SHA and dirt state. Do not pull, switch, stash, or
   modify the worktree.
2. Read the current target registration, adaptation-recognition handoff, and
   latest loop-status artifact.
3. Verify whether every registered anchor is complete and whether a valid
   prepared-semantic artifact exists under the current requirement for exactly
   one of `--prepare-semantic` or `--resume-prepared`.
4. Report registered targets, completed/failed/missing iterations, model
   activity as inactive or not verifiable, prepared-semantic state, and the
   exact continuation blocker.

Do not launch a loop, production batch, or agent fan. Re-enable execution only
by revising this skill against a new complete registration, the current
two-stage workflow, an explicit model route, and an enforced attempt/spend
ceiling. This status is not study evidence.
