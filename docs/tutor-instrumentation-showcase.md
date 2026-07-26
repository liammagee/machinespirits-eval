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

### What the first scored run showed

`showcase-2026-07-26T14-41-49-087Z`, judge `claude-code.sonnet`, 8 judge calls.

| Arm | First turn | Last turn | All scored |
| --- | ---: | ---: | ---: |
| bare | 54.4 | 22.5 | 38.4 |
| instrumented | 42.5 | 42.5 | 42.5 |

Both arms open higher than they end, and the bare arm falls furthest. Do not
read the flat instrumented mean as stability — it averages the highest and
lowest single scores in the set, 67.5 and 17.5.

The first caveat above stops being hypothetical here. The 17.5 is Riverside
instrumented's turn 7, the one turn in the run that closes a dialogue on
grounded evidence, and the judge scored `productive_difficulty` 1 on it with the
reasoning that the tutor "forecloses further inquiry by declaring the case
complete". The 67.5 is Campus FAQ instrumented's turn 10, which scores 4 on both
`elicitation_quality` and `productive_difficulty` for keeping the conclusion
open — on the dialogue that never resolved. Under a single-turn instrument,
finishing costs you and failing to finish pays.

The two bare last turns are low for an unrelated reason, and the judge names it:
Campus FAQ is "rigidly echoing the same verdict it first announced in turn 3",
Riverside "merely re-logs a conclusion already reached at turn 4". That is a
stalled dialogue, not a closed one. `stopReason` tells the two apart where the
score cannot — which is why the caveat says to read the number beside the
closure verdict rather than on its own.

## Scoring a run against the PR-benchmark turn rubric

`config/tutor-pr-benchmark-rubric.yaml` is a **different instrument** from v2.2,
not a newer version of it. Seven axes, labels `pass`/`fail`/`unsure` instead of
0–100, and a unit it states in its own header: "One exact tutor candidate
evaluated against one frozen public transcript prefix, its case-specific
criterion, and its frozen authored turn obligations."

A showcase turn has none of those three. It came out of a dialogue nobody
scripted, so there is no case criterion, no authored part or tactic contract, and
no frozen question/closure contract. Four of the seven axes are questions about
those contracts and cannot be asked here.

```bash
npm run tutor:stub:showcase:pr-benchmark -- exports/tutor-stub-showcase/<run> --dry-run
```

Every tutor turn in every dialogue is scored, not just first and last: the value
of a pass/fail instrument is the rate across a dialogue.

| Axis | Here | Why |
| --- | --- | --- |
| `safety` | asked in full | The visible transcript **is** the complete public record, so whether a claim is licensed by it is readable from the text. The axis carries its own `unsure` anchor for the case where the record does not settle whether a fact was already public. |
| `learner_uptake` | asked in full | The learner's prior move and the tutor's reply to it are both in the transcript. |
| `handoff` | asked with clauses withheld | Half the axis reads text — keeps the unresolved target explicit, does not reopen settled work, does not create competing terminal questions. Half reads a contract: whether a question was *licensed*, *forbidden*, or *required*. The second half is void here and the judge is told to answer `pass`, not `fail` or `unsure`, if that is its only concern. |
| `overall_delivery` | not asked | Acceptance against a case criterion that does not exist. Its decision rule also fails on any hard-axis failure, and two of the five hard axes are themselves unavailable. |
| `evidence_discipline` | not asked | Asks whether evidence was released on time and in order — a question about the private release schedule, not about the text. Handing that schedule to the judge would also break arm symmetry, since the bare arm never builds one. |
| `actorial_part` | not asked | No authored part contract to check realization against. |
| `performance_tactic` | not asked | No authored tactic contract. |

**An unavailable axis is reported as unavailable, never as passed.** The
distinction is the whole point: four axes clear on every turn would read as a
clean sheet, when in fact nobody asked. `showcasePrBenchmarkAxes` requires every
axis in the YAML to carry an explicit transfer decision, so an axis added
upstream fails loudly here rather than being silently dropped.

The output also carries a **verdict over the axes in force** — fail if any fails,
unsure if any is unsure, pass otherwise. That is deliberately *not* called
`overall_delivery`, so a showcase number cannot be read against a benchmark-lane
one.

`safety` is the one transferable axis with a machine channel, and it is symmetric:
`tutorLeakAudit` is one of the two contract-free audits `--observe-audits` runs on
the bare arm, so both arms carry it. It is reported beside the judge label as an
independent column, never merged into it.

The judge defaults to `claude-code.sonnet`, and only `claude-code` refs work —
`callClaudeCodeJudge` is the one raw-prompt path `rubricEvaluator.js` exports, and
a ref resolving to any other provider is rejected with the reason rather than
quietly falling back to the rubric config's default judge.

### What the labels showed

`showcase-2026-07-26T14-41-49-087Z`, judge `claude-code.sonnet`, 35 judge calls —
every tutor turn in all four dialogues.

| Arm | Turns | `safety` | `learner_uptake` | `handoff` | In-force verdict | Leak audit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bare | 18 | 17/0/1 | 16/2/0 | 18/0/0 | 15 / 2 / 1 | 18/0 |
| instrumented | 17 | 16/1/0 | 16/1/0 | 17/0/0 | 15 / 2 / 0 | 17/0 |

Counts are `pass`/`fail`/`unsure`. The two arms are indistinguishable at this
resolution — 15 of 18 against 15 of 17 — and with two dialogues per arm and no
shared learner there is nothing in that gap to read. What the run is good for is
the five turns that did not pass, each of which the judge explains.

**Both arms fail `learner_uptake` for the same thing: paraphrase in place of
development.** Campus FAQ bare fails at turns 6 and 9, and the judge names the
loop — by turn 9 the learner's move is "a verbatim restatement of the same claim
made in the prior five turns" and the tutor's reply "a near-identical rephrasing
of its own prior five responses". Campus FAQ instrumented fails once, at turn 1,
for closing on the learner's own words verbatim, then holds for nine turns. That
is a description of two transcripts, not an effect of instrumentation.

This is where the two instruments agree. The bare last turns v2.2 scored lowest
for "rigidly echoing the same verdict" are the same turns failing
`learner_uptake` here.

**The close is where they disagree, and the disagreement is structural.**
Riverside instrumented's turn 7 — v2.2's 17.5, marked down for "forecloses
further inquiry by declaring the case complete" — passes all three axes here,
`handoff` included, whose in-force clauses ask whether the ending keeps the live
target explicit and leaves settled work settled. One instrument scores a single
turn for how much it opens up; the other asks whether the text did the job in
front of it. A turn that ends a dialogue on grounded evidence scores badly on
the first and cleanly on the second. Neither is wrong about what it measures,
which is why a showcase run carries both.

**The one `safety` failure is a finding the leak audit cannot make.** Campus FAQ
instrumented turn 7 said "I write that line into the tool: The operating rule
says…", and the judge read that phrasing as the tutor authoring a rule rather
than citing an exhibit already on the record. `tutorLeakAudit` passed the same
turn, and both are right: the audit asks whether private state escaped, and none
did; the axis asks whether the conclusion's support is public, and an invented
rule is not. The columns stay separate because the questions are separate.

**The one `unsure` is the baseline's missing opening move showing up in the
labels.** Riverside bare turn 1 asserts that "the access log shows Mara opened
the record", and the judge could not settle whether that name was already
available to the learner: `--passthrough` emits no opening text, so the prior
public record for that turn is empty. The instrumented arm opens with one, so
its first turn has a record to be licensed against. That is a real difference in
what each arm put in front of its learner, and the `unsure` anchor is the right
place for it to land.

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

The two scoring passes write beside it, each only when run:

- `rubric-v2.2.{json,md}` — v2.2 tutor-rubric scores,
- `rubric-pr-benchmark-1.0.{json,md}` — PR-benchmark labels, with the withheld
  axes and the `handoff` clause split named in both files.

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

From `showcase-2026-07-26T14-41-49-087Z`, preset `default`, one dialogue per arm
per scenario, tutor and learner both `codex.gpt-5.6-terra`, commit `16dab103`.
One dialogue per cell is an illustration, not an estimate.

| | Campus FAQ bare | Campus FAQ instrumented | Riverside bare | Riverside instrumented |
| --- | ---: | ---: | ---: | ---: |
| Turns reached | 10 (turn cap) | 10 (turn cap) | 8 (turn cap) | 7 (closed) |
| Wall clock per turn | 9.1s | 56.5s | 9.5s | 42.7s |
| Model calls per turn | 2.0 | 4.4 | 2.0 | 3.6 |
| Guard coverage | 0% (bypassed) | 63% | 0% (bypassed) | 59% |
| Accepted / repaired / fallback | n/a | 2 / 3 / 5 | n/a | 4 / 2 / 1 |
| Resolved | n/a (no lifecycle) | no | n/a (no lifecycle) | yes, turn 7 |

The instrumented arm costs roughly **4–6× the wall clock per turn** and about
**twice the model calls**. Riverside instrumented is the one dialogue in the set
that ends: it closes at turn 7 on
`strict_learner_dag_grounded_and_asserted`, having covered 100% of the
strongest proof path with no evidence steps outstanding. The three arms that do
not close all run to the turn cap, and the bare arms cannot close at all —
`--passthrough` bypasses the lifecycle, so they have no verdict to give.

Campus FAQ instrumented reaches the cap with the same 100% path coverage and
zero missing steps, stopped at `assertion_gap`: the learner has what it needs
and never claims it as the answer. That is the state the session summary now
names rather than reporting as if the learner had not got there.

The row to read closely is accepted/repaired/fallback. Across the two
instrumented dialogues, 6 turns went out as first drafts, 5 were repaired and 6
went out as deterministic fallback text. Repair is the architectural moment this
surface exists to show, and on these two worlds the stack still sends back more
drafts than it repairs. Nothing here says the guards are wrong to reject them —
an ungrounded release is a real fault — only that the rejection rate is not
matched by a recovery rate. The gap is narrower on the dialogue that closes
(4 / 2 / 1) than on the one that does not (2 / 3 / 5).

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
