# Tutor PR benchmark

The tutor PR benchmark is a bounded engineering regression gate for changes
that can affect tutor generation or its deterministic audits. It replays only
the current tutor turn from committed transcript fixtures. The prior public
dialogue, learner move, world, evidence state, and response configuration stay
frozen; the current first-draft contract is recompiled from the checked-out
code.

The default `strong` preset makes six model calls:

| Frozen turn | Pressure covered | Codex | Claude Code |
| --- | --- | --- | --- |
| Nocturne turn 2 | answer-seeking, due evidence, dramatic counterpressure | `gpt-5.6-terra`, medium | `claude-sonnet-5`, medium |
| Ravensmark turn 5 | affective resistance, due evidence, dramatic counterpressure | `gpt-5.6-terra`, medium | `claude-sonnet-5`, medium |
| Larkspur turn 2 | premature closure, evidentiary boundary | `gpt-5.6-terra`, medium | `claude-sonnet-5`, medium |

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

Each candidate must satisfy all three prospective conditions:

1. the existing frozen-turn delivery audit accepts the original candidate;
2. the actorial-realization audit itself passes, even where a wider delivery
   policy might treat an issue as advisory; and
3. the leak audit records no safety failure.

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

## Rubric boundary

This gate does not change or reinterpret evaluation rubric v2.2. It is a
prospective acceptance contract at the utterance grain, chosen to catch tutor
behavior regressions cheaply. It tests conformance to deterministic speaking,
evidence, progression, repetition, closure, and safety constraints on three
high-pressure historical moments. It is not a full-dialogue outcome measure,
an estimate of human learning, or evidence that one model family is generally
better than another.

Edit [`config/tutor-pr-benchmark.yaml`](../config/tutor-pr-benchmark.yaml) to
change cases, presets, models, or criteria. Any expansion must raise the
explicit call budget in the same review and preserve zero retries.
