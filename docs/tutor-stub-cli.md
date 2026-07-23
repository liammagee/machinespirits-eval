# Tutor-stub terminal experience

The interactive tutor scaffold has a terminal presentation layer designed to
stay expressive without obscuring the dialogue. A compact masthead identifies
the scene, semantic colors distinguish tutor, learner, coach, success, warning,
and failure states, and the existing one-line progress display carries the only
animation.

## Capability-aware commands

Every session resolves a frozen, versioned capability snapshot after launch
configuration has been normalized. The snapshot separates what the current
mode makes available from what is active now, identifies the resolved mode
(`passthrough`, `direct`, `scaffold`, `mixed`, `auto`, or `curriculum`), and
checks machine-readable prerequisites and conflicts before the dialogue starts.
It is included in `--dry-run`, trace metadata, and a
`capability_snapshot_resolved` trace event.

The slash-command palette, completions, `/help`, and `/features` read this
snapshot. Commands that cannot do meaningful work in the current session are
omitted; a direct attempt is rejected with the missing or inactive capability
named explicitly. For example, mixed-drafting commands such as `/suggest` and
`/use` appear only when mixed drafting is active, while `/random`, `/register`,
and `/character` require adaptive delivery. Calling `/help` therefore describes
the command surface that is actually usable rather than a larger global list.

The underlying command and capability registries remain frozen catalogs, so
tests and future web or Electron adapters can inspect every supported command
without starting a model-backed session.

## Importable session runtime

`services/tutorStubSessionRuntime.js` provides the versioned lifecycle boundary
used by the CLI. A runtime instance owns `create`, `load`, `resume`, `step`,
`reset`, and `finalize` transitions, exposes an immutable snapshot, and keeps
its counters, projected state, and event sequence isolated from every other
instance in the process. Provider calls, terminal output, persistence, and
other effects enter through explicit adapters rather than module globals.

The CLI now routes public learner input and slash commands through this
runtime. Each canonical command has one registry-owned handler id and one
registry-owned trace-event id; aliases resolve to the same invocation before
the CLI adapter runs. Capability rejection therefore occurs before a handler
can execute. Runtime lifecycle and command events use the versioned
`machinespirits.tutor-stub.session-event.v1` envelope and are retained in the
normal JSONL trace without altering the public dialogue.

The runtime accepts fake adapters, so two sessions can be exercised in one
process without model calls. The regression fixtures run the same learner turn
through passthrough, direct, scaffold, mixed, auto, and curriculum snapshots
and pin the public result plus lifecycle event order.

## Headless session transport

`services/tutorStubSessionHost.js` owns multiple runtime instances for a
non-terminal host and serializes mutations within each session. The host takes
an injected session factory: real tutor construction remains in the tutor
engine, while HTTP tests can use a deterministic fake provider. It rejects
duplicate ids, bounds the number of resident sessions, keeps independent
session state isolated, and retains finalized snapshots for inspection.

`routes/tutorStubSessionRoutes.js` exposes that host through the versioned
`machinespirits.tutor-stub.session-http.v1` contract:

```text
GET  /api/tutor-stub
POST /api/tutor-stub/sessions
GET  /api/tutor-stub/sessions
GET  /api/tutor-stub/sessions/:sessionId
POST /api/tutor-stub/sessions/:sessionId/steps
POST /api/tutor-stub/sessions/:sessionId/resume
POST /api/tutor-stub/sessions/:sessionId/reset
POST /api/tutor-stub/sessions/:sessionId/finalize
```

`services/tutorStubProcessSessionFactory.js` is the default real host in the
shared eval-surface mounter, so both the standalone web server and the
poetics/Electron server expose this API. Each HTTP session lazily starts the
actual tutor-stub CLI engine and controls its importable runtime over a private
versioned RPC channel. Dedicated file descriptors carry JSON frames; terminal
stdout and stderr remain diagnostics and can never be mistaken for protocol
data. Provider credentials stay only in the server child environment, and HTTP
snapshots expose the runtime's presentation-safe state projection.

Session creation accepts an allowlisted configuration: `id`, `mode`, `model`,
`classifierModel`, `learnerRecordModel`, `tutor`, `topic`, `world`,
`curriculum`, `module`, and `resumeLast`. Supported launch modes are `direct`,
`passthrough`, `scaffold`, `mixed`, and `curriculum`. For example:

```json
{
  "id": "fractions-1",
  "mode": "direct",
  "world": "world_005_marrick",
  "model": "codex.gpt-5.6-terra"
}
```

The factory disables terminal-only presentation effects, keeps trace writes in
`TUTOR_STUB_TRACE_DIR`, and closes child sessions with the host. The Electron
path resolver relocates this trace directory below `userData`. Slash commands
are temporarily rejected on the process-backed transport: several registered
commands open terminal pickers, browsers, voice devices, or relaunch the CLI,
so they need transport-safety metadata and noninteractive result adapters before
the web surface may expose them. Learner turns, launch-time resume, reset, and
finalize already traverse the real tutor engine; deterministic fake executables
cover that full HTTP-to-model path in tests without spending API credits.

## Themes

Use `/theme` to preview every theme and `/theme <name>` to switch immediately:

- `nocturne` — violet, cyan, and warm gold for dark terminals;
- `ember` — coral, amber, and rose;
- `parchment` — ink blue, sepia, and forest green for light terminals;
- `high_contrast` — bright, widely compatible ANSI colors; and
- `mono` — typography-only hierarchy.

The same choice can be made with `--theme <name>` or `/settings theme <name>`.
Interactive sessions remember it. `NO_COLOR` and `--no-color` disable color
without removing labels or hierarchy.

## Labelling game

The consolidated labelling harness serves both the blinded superego-taxonomy
packet and the tutor-stub communicative-impasse corpus. A plain interactive
launch now starts with a two-mode keyboard selector:

```bash
npm run tutor:stub
```

Choose `Tutor chat` (the default) or `Labelling game` with Up/Down and Enter.
Quitting the labelling game returns to the selector, so the same terminal can
switch back to chat. Explicit presets and piped/non-TTY runs skip the selector.

For scripts or direct launches:

```bash
npm run labelling-game -- --dataset tutor-stub-impasses --coder rater-A
npm run tutor:stub -- --launch-mode labelling-game --label-dataset tutor-stub-impasses --label-coder rater-A
npm run tutor:stub -- --labelling-game --label-dataset superego-taxonomy --label-coder rater-A
```

`--labelling-game` remains a compatibility alias. Omit the dataset and coder
flags to choose them interactively. The same packets
are available in the browser at `http://localhost:8081/human-coding-admin`
after `npm start`. Taxonomy judgments retain the analyzer-compatible rater CSV;
impasse judgments are stored as structured per-rater JSON sidecars.

## Reflecting on the workplan through the tutor

Tutor-stub can project the current open workplan cards into a live canonical
curriculum and load one card as public source material. The projection reads
`workplan/items/` on every launch, so it does not depend on a stale
`workplan/board.json` or copied curriculum snapshot.

List the available cards, then launch one:

```bash
npm run tutor:stub:workplan -- --list-curriculum-modules
npm run tutor:stub:workplan -- --module blueprint-composition
```

Inside any normal tutor-stub session, use the live picker instead:

```text
/board
/board blueprint-composition
```

`/board` opens a scrolling keyboard picker in a TTY; Up/Down, Page Up/Down,
Home/End, and Enter navigate it, while Escape returns to the current inquiry.
The direct form works in pipes and scripts. Selecting a card closes the current
inquiry cleanly and starts a fresh non-DAG reflective inquiry while preserving
the active learner profile, model routing, and dialogue settings.

The selected card becomes a reflective inquiry module: its problem frame,
dependencies, acceptance details, links, and declared completion gate are
available to the speaking tutor. The tutor is instructed to test the learner's
causal model and proposed evidence rather than merely summarize the card. The
session records the curriculum id, module id, and source hash in dry-run and
trace metadata.

This mode is deliberately non-DAG. A workplan dependency graph says which work
precedes other work; it is not a scenario proof DAG, and a card's verification
line is not a concealed answer. `--curriculum` therefore rejects `--dag`,
`--tutor-learner-dag`, and an active `--world`. If a particular card warrants a
staged proof inquiry, hand-author a dramatic-derivation world under the normal
world-authoring contract and run the proof-world quality gate first.

For inspection or provenance, emit an ignored YAML snapshot without changing
what tutor-stub loads live:

```bash
npm run curriculum:compile:workplan
```

## Motion

Use `/motion` to inspect the current level and `/motion <level>` to change it:

- `auto` selects subtle motion in a TTY and still output in pipes or CI;
- `full` uses a fluid four-frame progress glyph;
- `subtle` uses a slow two-frame pulse; and
- `off` leaves the progress surface still.

`REDUCE_MOTION=1` or `NO_MOTION=1` makes `auto` still. Explicit `full`,
`subtle`, or `off` can also be supplied with `--motion` or through
`/settings motion`.

The keyboard `/settings` panel includes live theme and motion previews. Escape
restores the active appearance and discards the preview; choosing
`Done — apply and return` saves it with the other interactive defaults.

## Live release notes

Use `/release-notes` to see meaningful tutor-stub changes committed during the
preceding 24 hours. The command reads Git at invocation time, groups relevant
commits by their expected effect on dialogue, recovery, dramatic delivery, or
CLI experience, and keeps test/documentation commits in a separate verification
group. Each group says both what changed and what should be visible in an
exchange. Use `/release-notes <hours>` for a different window from 1 to 168
hours.

The command is available in normal and passthrough modes, does not alter public
message history, and repeats the latest tutor utterance when it returns to the
scene. Newly committed changes appear automatically; uncommitted work does not.

## Directing and randomizing performance

Use `/register <style>` to direct the engagement stance and `/character <part>`
to direct the tutor's host character. Both commands show their current value
and available choices when used without an argument, and both autocomplete:

```text
/register warm
/character advocate
/register auto
/character auto
```

`auto` (also accepted as `clear`, `off`, or `reset`) removes only that explicit
direction. These controls are session-only and survive `/reset`. They do not
replace the learner analysis: action family, audience, language, scene,
evidence release, and safety continue through the normal pipeline. A due
authored clue source may still voice its clue, and the structurally licensed
final closeout character takes priority over a directed host character.

Explicit direction composes with `/random`. A `/register` lock outranks random
selection only for style; `/random` can still vary character. A `/character`
lock behaves symmetrically. If both axes are explicitly directed, `/random`
remains armed but performs no draw until either lock returns to `auto`.

Use `/random` to toggle a session-only performance experiment. `/random on`,
`/random off`, and `/random status` are also available and autocomplete from
the slash-command palette.

While it is on, every undirected performance axis samples a safe engagement
stance or host character independently of the learner assessment. The
immediately previous stance and character are excluded when alternatives exist,
so the variation is visible rather than accidentally repetitive. The configured
teaching policy is not replaced: it resumes when `/random` is turned off.

Only those two performance axes are randomized. Learner/DAG analysis still
chooses the teaching action, audience level, language accessibility, and scene
grounding; authored clue release, dialogue closure, and response-safety checks
remain active. The compact model line says `random performance`, and transcript
settings plus JSONL turns retain both seeded draws for exact replay. Changing
the mode refreshes any prefetched mixed-learner response.

## Returning to a saved scenario

When an interactive session restores a saved scenario and its dialogue
settings, the opening tutor prompt is available immediately. The CLI builds the
same audited, public-only opening from the saved world's authored frame without
waiting for a speaking-model call. In mixed mode it prints that opening first
and warms the learner answer, clue, analysis, and tutor prefetch in the
background.

First-time initialization is unchanged: scenario/profile/settings selection
finishes before the richer model-realized opening and its first mixed-learner
prelude are displayed. Explicit `--resume-last` also remains distinct: it
restores the existing public transcript rather than creating another opening.

## Learner response authorship

Every completed learner turn now records structured response provenance for
human-evaluation work. The stable `authorship` value is `human`, `ai`,
`hybrid`, or `unknown` for an older trace. The record also keeps the input
method, whether a human was in the loop, the learner model/profile when one was
used, and the originating mixed-suggestion request.

- terminal and voice-transcribed replies are human-authored;
- fully automated learner replies are AI-generated;
- `/use` and an unchanged Tab draft are AI-authored and human-accepted; and
- editing a Tab-inserted draft produces a hybrid, human-edited AI reply.

When several messages arrive before the tutor responds, each fragment retains
its own provenance and the compound turn aggregates them. JSONL traces contain
an explicit `learner_response_provenance_recorded` event and retain the same
record on `turnRecord`, `learnerInput`, and each `learnerMessages` fragment.
Transcript and learning-summary HTML label every learner response and show
session totals. Public tutor/learner speech and replay-JavaScript messages remain
unchanged.

## Long automated-learner dialogues

Speaking calls normally replay the complete public dialogue in native roles.
If that full replay would make the automated learner exceed its audited prompt
budget, the learner call alone falls back to a recent tutor-led window. The
first retained message states how many older public messages were omitted, and
the latest tutor message is preserved. `--history-turns` sets the target size
of this fallback window as well as the raw recent window in compact analysis
prompts. Short runs, tutor calls, and every non-budget audit failure keep their
existing behavior; the fallback never introduces private planner state.

## Terminal compatibility

Color and motion activate only where the terminal supports them. Piped output,
redirected logs, `TERM=dumb`, CI, no-color sessions, and reduced-motion sessions
remain plain and deterministic. The transcript HTML records the selected theme,
motion level, resolved motion, and color capability for reproducibility, but
presentation changes never enter the public tutor–learner message history.
