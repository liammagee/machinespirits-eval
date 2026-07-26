# Tutor PR benchmark

The tutor PR benchmark is a bounded engineering regression gate for changes
that can affect tutor generation or its deterministic audits. It replays only
the current tutor turn from committed transcript fixtures. The prior public
dialogue, learner move, world, evidence state, and response configuration stay
frozen; the current first-draft contract is recompiled from the checked-out
code.

The default `strong` preset makes six model calls:

| Frozen turn | Criterion | Codex | Claude Code |
| --- | --- | --- | --- |
| Nocturne turn 7 | writable evidentiary limit through dramatic counterpressure | `gpt-5.6-terra`, medium | `claude-sonnet-5`, medium |
| Nocturne turn 9 | state the licensed period without overclaiming authorship | `gpt-5.6-terra`, medium | `claude-sonnet-5`, medium |
| Nocturne turn 10 | preserve the settled date and hand off the unresolved people question | `gpt-5.6-terra`, medium | `claude-sonnet-5`, medium |

Inspect the exact zero-call plan first:

```bash
npm run tutor:stub:pr-benchmark -- --print-plan
```

Run the strong gate from an attended checkout with both CLIs authenticated:

```bash
npm run tutor:stub:pr-benchmark
```

For a two-call local smoke screen:

```bash
npm run tutor:stub:pr-benchmark -- --preset smoke
```

Reports land under the ignored `.tutor-stub-auto-eval/` tree by default. The
Markdown report is compact and PR-friendly; `report.json` retains the generated
candidates and full deterministic audits for diagnosis. Do not paste rejected
candidate text into a public PR unless it has been reviewed for leakage.

## Gate and stopping rule

Each candidate must satisfy both prospective conditions:

1. the existing frozen-turn delivery audit accepts the original candidate;
2. the leak audit records no safety failure.

The canonical delivery decision owns issue severity. Actorial realization is
still measured and retained in the report, but an issue that the versioned
guard-disposition catalog classifies as advisory is not silently promoted into
a new hard rubric by this PR gate. All six jobs must pass the canonical gate for
the benchmark report itself to have status `pass`.

There is no LLM judge, repair attempt, deterministic fallback, retry, learner
generation, learner classification, learner-DAG update, or conversation
continuation. The lane is deliberately finite: the strong preset has a hard
six-call budget and the smoke preset has two calls. A CLI infrastructure error
blocks that model after its first failed launch while the other model may
finish.

Terminal states and exit codes are:

| State | Meaning | Exit |
| --- | --- | ---: |
| `pass` | every planned candidate passed | 0 |
| `fail` | at least one completed candidate failed a gate | 1 |
| `blocked` | authentication, CLI, or other infrastructure prevented a complete verdict | 2 |
| `budget_exhausted` | the plan exceeded the declared call budget before generation | 2 |

## PR use

For a tutor-generation or tutor-audit PR, run the `strong` preset against the
final commit and record the status plus local report path in the PR template.
Normal CI validates the config, fixture hashes, model/effort pins, frozen-prefix
invariant, budget, terminal-state behavior, and zero-call plan. The live CLI
calls remain attended because ordinary hosted PR runners do not share both
authenticated subscription CLI sessions, and running untrusted PR code with
such sessions would cross a security boundary.

### Optional local pre-push gate

Install the repository-managed hook once from an authenticated local checkout:

```bash
npm run tutor:stub:pr-hook:install
```

The installer uses Git's actual shared hooks directory. If a `pre-push` hook is
already present, it moves that hook to a managed sidecar and installs a wrapper
that replays the same pre-push input to the prior hook first and this gate
second. This preserves the repository's Git LFS hook and works across linked
worktrees. A worktree on an older commit without the versioned benchmark script
continues after the preserved hook without trying to benchmark.

On a branch push, the gate diffs each pushed range against its remote revision,
or against the merge base with `origin/main` for a new branch. It runs the
`strong` preset only when that range changes a configured tutor-generation,
audit, world, prompt, fixture, or benchmark path. Unrelated documentation and
workplan-only pushes skip it. A completed report is cached by exact commit at
`.tutor-stub-auto-eval/pr-benchmark-hook/<commit>/report.json`; pushing the same
commit again reuses a valid `pass` report, or a valid `fail` report while in
report-only calibration mode, only when its recorded SHA matches.

The hook currently runs with `hook.enforcement: report_only` while the
prospective rubric is calibrated. It fails closed when a relevant push is not
the checked-out `HEAD`, when relevant tracked or untracked paths are dirty,
when either CLI is unavailable, or when no complete verdict is produced. A
completed quality `fail` is cached by exact SHA, printed as a prominent warning,
and allowed through. Change enforcement to `blocking` only after the selected
turns and criteria have a reviewed, repeatable baseline. In either mode, the
bounded matrix runs once: there is no retry, repair, fallback, or continuation
loop.

For an exceptional push blocked before a complete verdict, use a conspicuous
reasoned bypass:

```bash
TUTOR_PR_BENCHMARK_HOOK_BYPASS=1 \
TUTOR_PR_BENCHMARK_HOOK_BYPASS_REASON="describe why this push cannot wait" \
git push
```

Git's generic `git push --no-verify` also bypasses every pre-push hook, including
Git LFS, so prefer the scoped environment-variable bypass. Remove the managed
wrapper and restore the preserved hook with:

```bash
npm run tutor:stub:pr-hook:uninstall
```

Installation is deliberately opt-in rather than an `npm install` side effect.
The hook invokes the authenticated local CLIs; GitHub CI still runs only the
hermetic validation layer.

## Rubric boundary

This gate does not change or reinterpret evaluation rubric v2.2. It is a
prospective acceptance contract at the utterance grain, chosen to catch tutor
behavior regressions cheaply. Its three turns come from one frozen Nocturne
transcript and were selected because their recorded original drafts remain
accepted by the current model-free audit; they vary engagement stance,
actorial part, performance tactic, accessibility, and evidentiary handoff. The
gate tests conformance to deterministic speaking, evidence, progression,
repetition, closure, and safety constraints. It is not a full-dialogue outcome
measure, an estimate of human learning, coverage of learner-profile diversity,
or evidence that one model family is generally better than another.

Edit [`config/tutor-pr-benchmark.yaml`](../config/tutor-pr-benchmark.yaml) to
change cases, presets, models, or criteria. Any expansion must raise the
explicit call budget in the same review and preserve zero retries.
