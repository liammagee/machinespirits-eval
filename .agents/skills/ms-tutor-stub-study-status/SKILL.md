---
name: ms-tutor-stub-study-status
description: Report a zero-call, evidence-backed snapshot for one existing tutor-stub QA or study session from its exact worktree and artifact root. Use for progress, units, calls, repairs, blockers, or human-decision status; do not launch, resume, recover, stop, signal, or analyze the study.
---

# Tutor Stub Study Status

Produce one current status block from existing tutor-stub study artifacts. This
skill is inspection-only: it does not authorize a model/provider call, process
inspection or signalling, recovery, continuation, analysis, database access,
or any filesystem write.

## Resolve the exact session

1. Identify both the session worktree and its QA artifact root. Prefer an
   explicit absolute path from the user or current task context.
2. Verify the worktree with `git -C <candidate> rev-parse --show-toplevel` and
   `git worktree list --porcelain`. A valid artifact root must contain a
   readable `run-plan.json` with planned jobs.
3. When the artifact root is outside the worktree, use its recorded Git SHA and
   the exact session name/path to confirm the association. Do not select a
   worktree from a branch-name prefix, modification time, or a partial match.
4. If no worktree matches, or more than one remains plausible, stop and ask for
   the exact worktree or artifact-root path. Do not inspect multiple studies to
   guess which one the user meant.

Let `<skill-repo>` be the Git root containing this `SKILL.md`. Use its reporter
so the command also works when a frozen session worktree predates the reporter.
Do not copy the reporter into the session worktree or switch its branch.

## Run the snapshot

Execute this command with the tool call's working directory set to the verified
`<session-worktree>`:

```bash
node <skill-repo>/scripts/report-tutor-stub-study-status.js <artifact-root>
```

Add `--json` only when the user requests machine-readable output. Use absolute
paths for both the reporter and artifact root. Before reporting results, record
the session worktree, its `HEAD` SHA and dirt state, the artifact root, and the
reporter checkout's `HEAD` SHA and dirt state.

The default output is concise prose beginning with `State`, `What is happening
now`, `Overall progress`, `Timing`, `Model activity`, `Units`, `Calls`, `Repairs
or recovery`, `Current issue`, `Next action`, and `Human decision required`.
Keep the ETA label: it is inferred only when at least two completed-unit
durations support a range; otherwise it is unavailable with a reason. JSON is
an explicit `--json` mode, never the default.

Do not run a process-status command to supplement the snapshot. The reporter's
`Model activity: not verifiable` is the correct result unless the user has
separately asked for process/provider inspection and that activity is proved by
an authorized evidence source. A unit labeled `active` means only that work
started without a readable terminal event; it does not prove a live process.

## Relay the result

Return the reporter's human-readable block without replacing its counts or
technical-stop distinction. Precede it with the verified session worktree,
session SHA and dirt state, artifact root, and reporter SHA and dirt state.
Explain malformed trailing JSONL
as an ignored partial write, not a study failure.

Never treat this status as recovery authority. If the block says a human
decision is required, stop after naming the decision boundary. For a repeated
check whose evidence is unchanged, say `no material change` and retain the same
structured block.
