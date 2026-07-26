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
  '--passthrough', '--observe-audits',
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

## Why the baseline is `--passthrough`

The first version of this config built the bare arm by dropping flags:
`--no-classifier --no-memory-summary`, no `--dag`. That arm was not bare. The
guard suite, first-draft recovery and the closure lifecycle all run
**unconditionally** in `scripts/tutor-stub.js` — they are not behind
`--dag`/`--committee`, which default to false anyway. Measured on a real
Riverside dialogue, that "bare" arm made four model calls per turn, had five
drafts sent back, and closed on
`strict_learner_dag_grounded_and_asserted`. It was instrumented in every respect
that matters, and the comparison showed almost nothing.

`--passthrough` is the only genuinely bare mode the stub has. It bypasses
`learner_classifier`, `learner_dag`, `register_selection`,
`human_discourse_scaffold`, `response_composition`,
`response_checks_and_repair`, `release_planner`, `dialogue_closure`,
`mixed_prefetch`, `tutor_feedback` and the learning summary, leaving one model
call per turn over system setup + public history + latest learner message.

Passthrough could not originally be driven by `--auto-learner`, and three
separate layers dropped the learner independently: the arg-forcing block in
`scripts/tutor-stub.js` set `auto-learner: false`, the `passthrough_isolation`
capability rule listed `autoLearner` among its conflicts, and
`learnerSuggestionEnabled` gated both the harness suggestion feature and whether
a learner model was resolved at all. The first failure was silent — the child
fell into the interactive REPL, hit EOF and exited 0 with a plausible-looking
transcript of nothing. All three are fixed; the learner-safe surface is
unaffected, because `pure_chat` rejects `--auto-learner` through a separate
research-only audience gate rather than through the isolation rule.

## Evaluating the baseline without gating it: `--observe-audits`

Passthrough fuses two things that are not the same: *evaluating* a turn and
*enforcing* the result. Bypassing the guard suite bypassed the audits with it,
so the bare arm recorded nothing and its merit column was empty — the two arms
ran side by side but could not be scored on the same gate.

`--observe-audits` splits them. On each bare turn, after the draft is final, the
stub runs the two audits that need no per-turn contract and writes them to the
turn record:

| Audit | Needs |
|---|---|
| `tutorLeakAudit` | world, turn index, draft text, learner message |
| `tutorRepetitionAudit` | draft text, replayed prior tutor messages |

The other five (`questionSupport`, `dramaticRelease`, `humanScaffold`,
`dialogueClosure`, `liveSourceActionAlignment`) score a draft against a contract
the instrumented pipeline builds *before* it speaks — a question-support frame,
a release plan, a discourse scaffold, a closure frame, a live source/action
pairing. A bare arm never builds one, so those checks have no referent on its
turns. They are written as `null` and reported as unavailable, never as passed:
an absent contract must not read as a clean sheet.

Three properties hold by construction:

- **No extra model calls.** The audits are pure computation over the finished
  turn. `modelCallsPerTurn` stays 1.
- **No enforcement.** They run in `runPassthroughTurn` after `callTutor` has
  returned, so there is no path by which a result could reach the repair loop.
  `buildTutorStubObservedAudits` asserts the response carries none of
  `repaired`, `deterministicFallback` or a guard-accounting row, and throws if a
  future edit changes that.
- **No coverage inflation.** Guard coverage still reads
  `tutor_response_guard_accounting`, which a passthrough arm never emits, so the
  arm stays at 0% coverage while reporting its audits. Merit and coverage remain
  separate columns.

The flag requires `--passthrough`. In a guarded run all seven audits already run
as enforced guard results, and accepting the flag there would write a second,
weaker copy of two of them under a name that promises no enforcement.

One caveat for reading the numbers: a clean leak sheet on the bare arm is easily
earned. That arm never stages evidence, and an audit asking "did you say more
than the record warrants" is passed by saying nothing evidential. These audits
are ceilings on misconduct, not floors on usefulness.

## Scoring a run against the v2.2 tutor rubric

The showcase reports cost (calls, wall clock, tokens) and conduct (audits,
coverage, repairs, fallbacks). Neither says whether the tutoring was any good.
`config/evaluation-rubric.yaml` — the live v2.2 instrument the eval pipeline uses
on cells — answers that, and it reaches a showcase transcript with no database
round trip: `evaluateSuggestion`'s `context.prebuiltTranscript` takes a plain
public-transcript string.

```bash
npm run tutor:stub:showcase:rubric -- exports/tutor-stub-showcase/<run> --dry-run
```

Drop `--dry-run` to score. Two turns per dialogue by default, mirroring the DB's
canonical pair (`tutor_first_turn_score`, `tutor_last_turn_score`), each judged
with the whole public transcript as context. Only the public transcript is sent:
the proof DAG, the release plan, the scaffold and the guard verdicts are all
withheld, so both arms are judged on what a learner actually saw. Scoring the
instrumented arm on its own internal artefacts would be a closed loop.

The judge defaults to `claude-code.sonnet`. A sonnet-class judge is required —
gpt-mini-class judges are not reliable on this instrument.

Two reading caveats:

- **A closing turn is structurally penalised.** v2.2 scores a single tutor turn,
  and `elicitation_quality` and `productive_difficulty` reward opening something
  up. A dialogue that ends properly closes on a turn that asks nothing, and
  scores accordingly. Compare last turns with last turns, and read the close
  alongside `stopReason` and the closure verdict.
- **Still not a controlled comparison.** The arms have different transcripts, so
  a rubric gap between them is a difference between two dialogues.

## Guard coverage is read from the accounting rows, not the audit records

**The turn record carries an audit object whether or not the guard ran.**
Counting `turnRecord.tutor*Audit` keys therefore measures "did the turn happen",
not "was the guard enabled" — an early version of this report did exactly that
and showed identical 56/56 coverage on both arms.

Coverage comes from the stub's own `tutor_response_guard_accounting` trace row,
which carries `accounting.guards.{leak, humanScaffold, questionSupport,
dramaticRelease, actorialRealization, responseComposition, repetition,
dialogueClosure}` as booleans plus an `accounting.outcome`. An arm that emits no
such row (passthrough) scores 0 coverage rather than a clean sheet, and
`auditsFailed` (merit) stays a separate column from coverage. A "0 guard
failures" line on an arm with low coverage means almost nothing.

The seven per-turn audits the record carries:

| Audit key | What it checks |
| --- | --- |
| `tutorLeakAudit` | Nothing due-but-uncommitted was said |
| `tutorQuestionSupportAudit` | A question the tutor asked is supported by what it gave |
| `tutorDramaticReleaseAudit` | Release is earned rather than dumped |
| `tutorHumanScaffoldAudit` | The reply sits on the scaffold's branch and warrant frame |
| `tutorRepetitionAudit` | The turn is not a restatement of the last one |
| `tutorDialogueClosureAudit` | Closure moves are consistent with the lifecycle |
| `tutorLiveSourceActionAlignmentAudit` | Cited sources match the action taken |

## Accepted, repaired, fallback are three columns, not two

`accounting.outcome` falls into three buckets and the report keeps them apart:

- **accepted** — `guarded_original_accepted`,
  `guarded_original_accepted_with_advisory`, `unguarded_original`. The first
  draft went out.
- **repaired** — the draft failed and the tutor spoke again; the learner saw
  only the second draft. This is the architectural moment the showcase exists to
  show.
- **fallback** — `guarded_deterministic_fallback`. The draft failed and a canned
  deterministic line went out instead. That is a **cost** of the guard stack,
  not a win.

Summing fallbacks into repairs would let a loss read as a gain, which is why
`classifyGuardOutcome` exists and why the table has three columns.

## Resolution is tri-state

`--passthrough` bypasses `dialogue_closure`, so a passthrough arm has no
resolution verdict — not a negative one. `closure.grounded` is therefore
`true | false | null`, `closure.available` says whether the lifecycle ran at all,
and `closureMeasurable` is the denominator for the Resolved column. An arm with
no lifecycle reads `n/a`, because scoring it 0/N would be scoring it on an
instrument it does not carry.

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

Chips on a turn: `first draft repaired` (ochre), `draft rejected · fallback line`
(brick), one per failed audit (red), `N guards ok` (green), `no guards ran` (grey
— the passthrough case, keyed off the accounting row rather than the audit
count), and a closure chip on the turn where the lifecycle completed. One toggle
shows or hides the guard chips. The column head carries the arm's closure verdict
in the same three states as the table: resolved, unresolved, or no verdict.

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

From `showcase-2026-07-26T12-19-33-018Z`, preset `default`, one dialogue per arm
per scenario, tutor and learner both `codex.gpt-5.6-terra`, commit `9c70ab67`.
One dialogue per cell is an illustration, not an estimate.

| | Campus FAQ bare | Campus FAQ instrumented | Riverside bare | Riverside instrumented |
| --- | ---: | ---: | ---: | ---: |
| Turns reached | 10 (turn cap) | 10 (turn cap) | 8 (turn cap) | 8 (turn cap) |
| Wall clock per turn | 11.0s | 48.0s | 10.7s | 52.9s |
| Model calls per turn | 2.0 | 4.2 | 2.0 | 3.8 |
| Guard coverage | 0% (bypassed) | 63% | 0% (bypassed) | 56% |
| Accepted / repaired / fallback | n/a | 3 / 1 / 6 | n/a | 3 / 2 / 3 |
| Resolved | n/a (no lifecycle) | no | n/a (no lifecycle) | no |

The instrumented arm costs roughly **4–5× the wall clock per turn** and about
**twice the model calls**, and reaches the same turn cap. Neither arm resolved:
the bare arm has no verdict to give, and both instrumented arms ran their
closure lifecycle and finished with `grounded: false` at phase `open`.

The row to read closely is accepted/repaired/fallback. Across the two
instrumented dialogues, 6 turns went out as first drafts, 3 were repaired and 9
went out as deterministic fallback text. Repair is the architectural moment this
surface exists to show, and on these two worlds the stack rejects three times
more drafts than it repairs. Nothing here says the guards are wrong to reject
them — an ungrounded release is a real fault — only that on this stack the
rejection rate is not matched by a recovery rate.

### The last resort has to be unrejectable

The first free-running runs never reached the turn cap. Both died mid-dialogue
on `guard_exhausted_without_public_delivery` — Riverside at turn 5
(`showcase-2026-07-26T07-39-43-946Z`), Campus FAQ at turn 3
(`showcase-2026-07-26T11-27-25-251Z`) — with every candidate rejected, the
deterministic fallback included, leaving the tutor nothing it was permitted to
say. Both were blocked by `dramatic_release` on the same pair of findings,
`opaque_clue_release` and `missing_exhibit_action`, so it was not a property of
one scenario's authored chain.

The mechanism was narrower than "the fallback always fails".
`opaque_clue_release` fires on `!entranceVisible`; `missing_exhibit_action` only
when the clue's own frame sets `requiresExhibitHandoff` and no handoff is
visible (`services/tutorStubDramaticRelease.js`). The deterministic fallback
wraps the authored clue in a fixed "I write the live line down where we can both
see it:" frame, which supplies **neither** an entrance nor an exhibit action of
its own. Whether it passed depended entirely on whether the authored clue
happened to supply them: a Riverside turn used that exact template and was
accepted, because its clue named a person performing an act ("Mara opening
Noor's record at 17:42"). The clues that killed both runs were impersonal — an
action ledger entry, an artifact inventory count — and the fallback had nothing
to add.

So the floor was conditional, and a last resort that can be rejected is not a
floor. `services/tutorStubGuardDisposition.js` already downgraded
conversational-integrity and optional actorial-realization findings to recorded
advisories on the terminal-fallback attempt only; dramatic *form* now joins
them, keyed on the shadow column already reading advisory. That key is what
keeps `live_source_action_alignment_v1` and the two public-state
`dramatic_release` types — `duplicate_clue_delivery`, `source_perspective_drift`
— fatal there. Evidence, clue-transaction, semantic-closure and
pedagogical-support boundaries are untouched, and unknown findings still fail
closed: a fallback that leaks still kills the dialogue. Whether the clue's
*content* was delivered stays hard under `release_delivery`. Catalog version 3.

After the fix all four dialogues ran to their turn cap and the run exited 0.

Token cost is recorded but the CLI bridges are subscription-quota, so `cost`
comes back as `0`; express cost in calls and wall clock, not dollars.
