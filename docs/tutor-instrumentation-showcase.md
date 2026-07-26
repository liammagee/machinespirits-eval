# Tutor instrumentation showcase

The showcase runs a bare tutor and a fully instrumented tutor as two
**free-running** dialogues — each with its own automated learner, each allowed
to run until it closes — and renders both transcripts side by side with a
benchmark panel: turns, model calls, seconds per turn, tokens, guard coverage,
guard failures, first-draft repairs, and whether the conversation actually
resolved.

It exists because the frozen A/B (`docs/tutor-instrumentation-ab.md`) cannot
produce a conversation that ends. A frozen replay answers one recorded learner
utterance; the learner never replies to *this* tutor, so no arm is ever talked
to a conclusion. The showcase is the surface you read when you want to see the
system work. The frozen A/B is the surface you read when you want to know what
caused a difference.

```bash
npm run tutor:stub:showcase -- --print-plan     # zero calls
npm run tutor:stub:showcase                     # paid, attended
```

## What it is not

**Not a controlled comparison.** Each arm spawns its own tutor stub with its own
automated learner. After the first exchange the two transcripts have diverged —
different learner utterances, different world state, different length — so no
difference between them is attributable to instrumentation alone. That caveat is
carried in the config, the service header, `report.md`, and the rendered page,
because it is the one thing a reader is most likely to get wrong.

Use it for: showing what a finished dialogue looks like on each architecture,
and measuring cost (calls, wall clock, tokens) and guard behaviour per arm.

Use the frozen A/B for: attributing a change in tutor output to a specific
advisory block.

## Learner parity

The frozen A/B holds the dialogue fixed. The showcase cannot, so it holds fixed
everything *except* a declared set of tutor-side flags:

```js
TUTOR_STUB_SHOWCASE_ARM_FLAGS = [
  '--dag', '--no-dag', '--dag-mode',
  '--tutor-learner-dag', '--no-tutor-learner-dag',
  '--classifier', '--no-classifier',
  '--memory-summary', '--no-memory-summary',
  '--committee', '--no-committee',
  '--model-call-budget',
];
```

`assertTutorStubShowcaseLearnerParity` strips those flags (and their values)
from every arm's child argv, normalises the per-arm trace directory, and
requires the residue to be byte-identical for every arm in a
(scenario, model) cell. The residue is the world, the learner model, the learner
profile, the turn caps, and the streaming settings. If they ever diverge the
plan throws before a single call is spent.

Without this an arm labelled "bare" could quietly be handed an easier learner or
a longer turn cap, and the demo would be showing the learner rather than the
tutor. An arm flag outside the declared set is rejected at config load with the
reason stated: it would break learner parity.

`--model-call-budget` is inside the set because the instrumented arm genuinely
needs a higher ceiling. Every run records whether either arm's budget actually
bound (`budgetBinding`), so a truncated dialogue can never be read as a finished
one.

## Guard coverage is not guard merit

A bare arm passes some audits by never being asked. Measured on the probe runs:
the bare arm ran 4 of the 7 `tutor*Audit` checks; the instrumented arm ran all 7.
So the report counts `auditsRun` (coverage) separately from `auditsFailed`
(merit) and says so in prose above the table. A "0 guard failures" line on an arm
with low coverage means almost nothing.

The seven audits:

| Audit key | What it checks |
| --- | --- |
| `tutorLeakAudit` | Nothing due-but-uncommitted was said |
| `tutorQuestionSupportAudit` | A question the tutor asked is supported by what it gave |
| `tutorDramaticReleaseAudit` | Release is earned rather than dumped |
| `tutorHumanScaffoldAudit` | The reply sits on the scaffold's branch and warrant frame |
| `tutorRepetitionAudit` | The turn is not a restatement of the last one |
| `tutorDialogueClosureAudit` | Closure moves are consistent with the lifecycle |
| `tutorLiveSourceActionAlignmentAudit` | Cited sources match the action taken |

## First-draft repair

The architectural moment the showcase is built to show is
`turnRecord.tutorResponseRepaired: true`: a draft that failed its guards and was
regenerated **before the learner saw it**. It is machine-recorded — the trace
also carries `tutor_response_recovery_candidate` and `turn_failure_recorded`
rows — so the demo is showing measured behaviour, not a characterisation of it.
Repairs surface as an ochre chip on the turn in the HTML and as a `repairs`
column in the table.

## Resolution

"Did it resolve?" is read off `turnRecord.dialogueClosure.lifecycle.completedAtTurn`
— the stub's own verdict that the dialogue reached its authored answer — not off
the transcript text. Both arms are asked the same question by the same
mechanism, and `stopReason` records why a dialogue that did not resolve stopped
(turn cap, safety cap, budget).

## Scenarios

`config/tutor-stub-showcase.yaml` ships two contemporary worlds chosen to close
in a small number of turns:

| Scenario | World | Turn cap |
| --- | --- | --- |
| `campus_faq` | `world_016_ai_syllabus_af1` | 10 (safety 14) |
| `riverside_clinic` | `world_029_riverside_clinic` | 8 (safety 12) |

Presets: `smoke` (riverside only, 2 dialogues), `default` (both scenarios, 4
dialogues), `cross_model` (both model CLIs). Models are `codex_medium`
(`codex.gpt-5.6-terra`) and `claude_medium` (`claude-code.claude-sonnet-5`).
The learner is `codex.gpt-5.6-terra`, profile `diligent`, on every arm.

## Reading the rendered page

Free-running arms share no learner spine, so the A/B's swimlane layout does not
apply: there is no single utterance for the lanes to hang from. Instead each arm
gets a full-height column and the columns are aligned by **turn index**, with a
gutter carrying the index. Turn 0 is the tutor opening. A cell past the end of a
shorter dialogue says so rather than shifting the rows out of alignment.

Chips on a turn: `first draft repaired` (ochre), one per failed audit (red),
`N guards ok` (green), `no guards ran` (grey — the coverage case), and a closure
chip on the turn where the lifecycle completed. One toggle shows or hides the
guard chips.

## Artifacts

Each run writes to `exports/tutor-stub-showcase/showcase-<stamp>/` (honouring
`EVAL_EXPORTS_DIR`):

- `transcripts.html` — the reading surface, self-contained,
- `report.md` — arm benchmark table plus a per-scenario dialogue list,
- `report.json` — the plan, every turn, every audit, trace paths, git metadata.

Re-render both from a saved report with zero calls:

```bash
npm run tutor:stub:showcase -- --render-report exports/tutor-stub-showcase/<run>/report.json
```

Exit codes: `0` complete, `1` a dialogue exited non-zero, `2` blocked or budget
exhausted. Concurrency is 1 and there are no retries — a run is meant to be
attended, with child output echoed as it goes, so a stuck arm is visible and
interruptible rather than silently burning quota. An infrastructure error blocks
that model for the rest of the run.

## Cost

Measured on the probe turns (codex CLI, medium effort, one turn of each arm):

| | Bare | Instrumented |
| --- | ---: | ---: |
| Wall clock per turn | 28.5s | 47.2s |
| Model calls per turn | 4 | 5 |
| Tutor calls | 1 | 2 (original + repair) |
| Audits run | 4 of 7 | 7 of 7 |

The extra call is the first-draft regeneration. Token cost is recorded but the
CLI bridges are subscription-quota, so `cost` comes back as `0`; express cost in
calls and wall clock, not dollars.
