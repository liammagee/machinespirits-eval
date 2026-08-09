---
id: register-manner-learner-turn
title: Does the learner's own message pull the tutor out of the register?
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: The set is fixed and its plan hash printed by --dry-run before the
  first paid call. Every reply is read by the same pinned reader on the same
  versioned question over the same learner turn as both earlier readings. The
  verdict is the count of replies the reader calls edged, reported whichever way
  it falls.
claim_status: exploratory
depends_on:
  - register-manner-prompt-isolation
links:
  scripts:
    - scripts/probe-register-learner-turn.js
    - scripts/dump-turn-prompts.js
  exports:
    - exports/register-prompt-isolation/full-35.json
tags:
  - register
  - manner
  - id-director
---

The first probe sent each flat turn's shipped prompt to the writer alone and got
23 of 35 back edged. That ruled the prompt out for most rows and left three
suspects: the reviewer pass, the earlier turns of the dialogue, and the
learner's own message. Two of the three died without a single call.

**The reviewer.** Its verdict is already stored per turn. Of the 23 rows that
came back edged alone, it passed 20 untouched. It cannot have flattened a turn
it never rewrote. It fires rarely overall — 5 of 35 rows across the whole set,
3 full replacements and 2 appends.

When it does fire and replaces a turn, the tutor's own words are discarded and
stored nowhere. Row 34065 turn 0 is the clearest case: the stored `tutorText` is
byte-identical to the reviewer's `repaired_response`, and its stated reason is
that the tutor was too cold — "Cold procedural meta-instructions lack
charismatic warmth". So the reviewer is a warmth enforcer that can overwrite a
cold register, and the record keeps no trace of what it overwrote. Worth its own
card; not the cause here.

**The earlier turns.** These cells run in single-prompt mode. On that path
`extractLearnerInputs` returns an empty message history, with the comment "ego
call should NOT receive a messageHistory in this path"
(`services/idDirectorEngine.js`). The tutor never saw the earlier turns. Read
off the code, no run needed.

That leaves the one input the first probe dropped.

## The probe

Pre-registered in the script header before any call.

- **Set.** Rows the first probe read as edged alone, whose reviewer left the
  text alone, and whose stored writer is the writer used here: **20 rows**.
  Dropped and counted: 12 flat when sent alone, 3 the reviewer rewrote.
- **Treatment.** The run's own ego call, rebuilt — system prompt = that turn's
  shipped prompt, unedited; user message = that turn's learner message; no
  message history, matching the run. Same writer (`codex.gpt-5.5`), same bridge,
  same role string.
- **Measure.** The same pinned reader (`claude-code/claude-sonnet-5`) and the
  same question (`manner-presence/1.0`) over the same learner turn.
- **Reads as.** Flat replies mean the learner's message is what sands the manner
  off: a prompt that survives on its own does not survive a learner asking for
  something else. Edged replies mean the ego call reproduces the edge from the
  run's own inputs, the loss is somewhere not yet named, and this probe has not
  found it.
- **Limit.** These prompts shipped before the manner block was appended, so this
  measures the old pipeline. It says nothing about whether the appended block
  holds up against a learner; that needs a fresh run.

Plan hash printed by the dry run, fixed before the first call:
`52f562ee272a3740d7f109e19bec2ce3deea6473fb969a4d6500a19baea1b1cc`.

## Outcome

**Null.** All 20 rows ran; the reader called 17 of them edged, 3 flat, 0 unread.

```
ironic                 4 edged / 5
sarcastic              4 edged / 4
sarcastic_determinate  9 edged / 11
```

All 20 were edged when the prompt was sent alone, so putting the learner back in
the room cost 3 rows out of 20. That is not the loss the first probe was chasing.
Per the pre-registration this reads as: the ego call reproduces the edge from the
run's own inputs, and the loss is somewhere not yet named.

## Where it actually went

Chasing the last difference between the rebuilt call and the run turned it up in
the dialogue log. Row 34133, cell 202, turn 1, `sarcastic_determinate`. Same
prompt, same learner message, two writers:

*Stored by the run — read as flat:*

> **Concrete passage (Hegel, *Phenomenology of Spirit*, § 196…)** … ### Test: Map
> the three shifts … If you can do this without slipping back into the
> "work-dependence-fear" chant, you have begun to move beyond the formula.

*Rebuilt call — read as edged:*

> Nice trick: repeating "work, dependence, fear" can sound like understanding
> while doing none of the work. … If you cannot locate the phrase, then "work,
> dependence, fear" is still just a bid for authority that has not earned uptake.

The rebuilt call went to `codex.gpt-5.5`. The run did not. Counting the
provider/model pairs in that dialogue gives three ego calls on
`openrouter/nvidia/nemotron-3-nano-30b-a3b`, three id calls and three reviewer
calls on `openrouter/moonshotai/kimi-k2.5` — the exact pairing CLAUDE.md forbids
as a default. The `ego_model` column on all 77 register rows says
`codex.gpt-5.5`.

**Why the label and the calls disagree.** `generateIdDirectedSuggestion` builds
its ego and id calls from `evalCellProfile.ego` and `.superego`, straight out of
`config/tutor-agents.yaml` (`services/idDirectorEngine.js:1765`, `:1997`). It
never reads `resolvedConfig.egoModel`. The CLI overrides land on the run config
only (`services/evaluationRunner.js:534`, `:549`), which is what gets written to
the `ego_model` column. So the column records what was asked for and the calls
record what the YAML said. Worse, the weak-stack warning is skipped whenever any
tutor override is present (`hasExplicitTutorOverride`,
`services/stackDefaultWarning.js:27`) — so passing `--tutor-model codex.gpt-5.5`
silenced the one guard that would have named nemotron/kimi.

Every August register run is affected, and only those:

| run | cell | rows | ego actually |
|---|---|---|---|
| eval-2026-08-05-87fe3664 | 196 ironic | 15 | nemotron-3-nano-30b |
| eval-2026-08-05-87fe3664 | 197 sarcastic | 15 | nemotron-3-nano-30b |
| eval-2026-08-05-87fe3664 | 198 face threat | 15 | nemotron-3-nano-30b |
| eval-2026-08-06-4de45d05 | 202 sarcastic determinate | 15 | nemotron-3-nano-30b |
| eval-2026-08-07-e3dffab2 | 202 sarcastic determinate | 14 | nemotron-3-nano-30b |
| eval-2026-08-07-45154bac | 196 ironic | 3 | nemotron-3-nano-30b |

The July id-director runs (cells 186/193/199, `eval-2026-07-01` through
`-07-04`) all ran `gpt-5.5` for real, matching their label. Nothing in the code
changed between them: the id-director has always read the YAML, so those
worktrees must have carried an edited cell block on disk. No `provider: codex`
has ever been committed to `config/tutor-agents.yaml`.

**What this costs.** The register fidelity counts in §6.7 and §8.9 were read as
architecture verdicts on a strong stack. They are nemotron/kimi results, which
the standing rule calls stack-bounded until replicated. The learner-turn probe
above is unaffected — it ran the writer it says it ran — but it was asking why
`codex.gpt-5.5` output differed from a run that was never `codex.gpt-5.5`.

## What was decided

The operator settled all three on 2026-08-08.

**The id-director honours the override.** `applyModelOverride` copies the run's
per-seat override onto the cell block before either call is built, so `--ego-model`
reaches the ego and `--tutor-model` reaches both. Absent an override the seat
still takes what the YAML names, unchanged.

**The warning fires on the models a run will call, not on what it asked for.**
`hasExplicitTutorOverride` is gone; `effectiveStack` resolves each seat through
its override first and flags the pairing that survives. An override now silences
the warning only for the seat it replaces, so `--ego-model codex.gpt-5.5` on a
weak cell still names the kimi superego.

Both are pinned by tests that read the models off the calls rather than off the
run's record — `services/__tests__/idDirectorModelOverride.test.js` stubs the
engine's one model-call seam and asserts the provider and model each seat asked
for; `services/__tests__/stackDefaultWarning.test.js` and
`tests/resolveConfigModels.test.js` cover the other half.

**§6.7 and §8.9 are corrected in place, not re-run.** No count moves: the turns
were generated, stored and scored as reported. What changes is the stack they are
bounded to. §6.7 gains a paragraph naming the models actually called and the seat
map; §8.9 gains a seventh scope condition. Paper v3.0.282 (renumbered from v3.0.280).

**The corrected grid is not being paid for yet.** A 15-row single-register check
on a strong writer goes first, to see whether the edge survives before the full
~60-row grid is bought.
