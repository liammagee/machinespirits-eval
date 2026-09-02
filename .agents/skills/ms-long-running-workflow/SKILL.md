---
name: ms-long-running-workflow
description: Operate and report long-running experiments, studies, evaluations, collections, recoveries, audits, builds, and multi-phase workflows. Use when work may exceed two minutes or crosses phase boundaries; loading this skill does not authorize model calls, retries, external writes, or recovery.
---

# Long-running workflow

Keep the complete requested workflow legible from preflight through its true
terminal state. Follow the root `AGENTS.md` transparency contract and the live
runner or study design; this skill does not replace either one.

## Establish fresh state

Before starting, verify the exact worktree, HEAD and dirt state, artifact root,
registered design, call ceiling, existing workflow-status record, and current
authorization boundary. Read existing artifacts before deciding that work is
missing. Preserve sealed data and unrelated user changes.

Define the whole requested phase plan before execution. Use the maintained
status helper or runner integration when available; do not hand-edit status
JSON. The canonical states are `PREFLIGHT`, `GENERATING`, `RECOVERING`,
`EXTRACTING`, `AUDITING`, `PACKAGING`, `BLOCKED`, `HANDOFF_PENDING`, and
`WORKFLOW_COMPLETE`.

For an existing canonical status artifact, report it with:

```bash
node scripts/report-long-running-workflow-status.js <workflow-status.json>
```

Add `--json` only when the user explicitly requests machine-readable output.

## Operate within authority

Loading this skill grants no provider, paid-run, retry, recovery, deployment,
or destructive authority. Inspect first, then use only the authority already
granted for the named workflow. Preserve completed and failed units, call
reservations, routes, thresholds, and scientific inputs. Stop when the next
action would widen that scope.

Do not infer live provider activity from timestamps, recent files, an `active`
unit label, or a nonterminal status. Report model activity as `active` only from
direct authorized runtime/provider evidence, `inactive` only from direct
terminal or no-dispatch evidence, and otherwise `unverifiable`.

## Report while work is active

Report every phase transition and every 60–90 seconds. Bound monitoring and
waits so control returns within that interval. If nothing changed, say `no
material change` and repeat the current blocker, next action, stopping
condition, and human-action boundary.

Use concise plain language and include:

- current phase, completed phases, and what is running now;
- model-activity state and its evidence;
- complete, active, failed, and missing units;
- completed, failed, and reserved calls plus the hard ceiling;
- workflow start, last material progress, recent measured pace, and an ETA
  range labeled as measured, inferred, or unavailable;
- repairs, retries, recovery work, and configuration drift;
- the current issue, exact next action, stopping condition, and whether human
  action is required.

Generation ending is only completion of `GENERATING`. When the next authorized
phase does not start in the same operation, write and report
`HANDOFF_PENDING`, explain the gap, and name the next phase. Report
`WORKFLOW_COMPLETE` only after every phase in the requested plan has a terminal
record. Use `BLOCKED` for a failed phase that cannot safely advance.

## Repair transparency

Before creating a repair branch or PR during an active workflow, report the
failed operation, exact observed error, effect on paid work or collected data,
why source repair is required, exact proposed change, remaining blocker, model
activity, and ETA after the repair. Record that repair or recovery in the
workflow-status history. A repair does not silently start or authorize the next
phase.

## Finish

At handoff, report the status-artifact path and whether it was recovered from an
atomic previous record. End only in `WORKFLOW_COMPLETE`, `BLOCKED`, or an
explicit `HANDOFF_PENDING`; never disappear between phases.
