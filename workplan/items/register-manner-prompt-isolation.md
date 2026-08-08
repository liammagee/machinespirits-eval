---
id: register-manner-prompt-isolation
title: Where the edge is lost — send the flat turn's own prompt to the writer alone
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: The set is fixed and its plan hash printed by --dry-run before the
  first paid call. Both sides are read by the same pinned reader on the same
  versioned question over the same learner turn. The verdict is the count of
  isolated replies the reader calls edged, reported whichever way it falls.
claim_status: exploratory
depends_on:
  - register-presence-hand-marked-set
links:
  scripts:
    - scripts/probe-register-prompt-isolation.js
  exports:
    - exports/negative-register-manner-presence/eval-2026-08-05-87fe3664_eval-2026-08-06-4de45d05_eval-2026-08-07-45154bac_eval-2026-08-07-e3dffab2.json
tags:
  - register
  - manner
  - id-director
---

Two settings, one writer, opposite results.

Asked cleanly — five real learner turns crossed with four writing conditions,
one draw each, no cue phrases anywhere — `codex.gpt-5.5` wrote an edge every
time: ten of ten ironic and sarcastic prompts, picked out by two blind readers
twice over, with no false alarm on the plain control.

Asked inside the running pipeline, it mostly does not. Of 62 stored turns in
edged registers the pinned reader found an edge in 24 and none in 38. The grid
report has a name for the failure — warm or weak while wearing the costume —
and it takes 9 of 15 ironic turns, 7 of 15 sarcastic and 11 of 15 face threat.

Generation is not the limit. Something between the two settings sands the
manner off. Three candidates: the shipped prompt itself (the id-director
rewrites the registry's manner line, and may spend the joke inside the
instruction instead of asking for one), the earlier turns of the dialogue, or
the reviewer pass.

## The probe

Pre-registered in the script header before any call.

- **Set.** Every stored turn the reader called `absent` whose own shipped
  prompt names the manner: **35 rows** (ironic 14, sarcastic 6,
  sarcastic_determinate 15). Three flat turns are excluded because their prompt
  never asked for an edge, so a flat reply there would prove nothing.
- **Treatment.** That turn's exact shipped prompt, pulled from
  `id_construction_trace`, sent to the same writer alone — no earlier turns, no
  reviewer, no scenario wrapper, nothing edited.
- **Measure.** The same pinned reader (`claude-code/claude-sonnet-5`) and the
  same question (`manner-presence/1.0`) over the same learner turn.
- **Reads as.** Edged replies mean the prompt was enough and the harness sands
  the manner off. Flat replies mean the prompt itself is the problem.
- **Limit.** Sending the prompt alone drops the earlier turns as well as the
  reviewer, so an edged result does not separate those two from each other. It
  does separate both from the prompt.

Plan hash printed by the dry run, fixed before the first call:
`a9a1b4b29cd55b11996a297b23b351c248938fa52c1a9948f1545d00ce94d67e`.

## Outcome

Pending the attended run.
