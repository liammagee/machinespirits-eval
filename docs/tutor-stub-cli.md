# Tutor-stub terminal experience

The interactive tutor scaffold has a terminal presentation layer designed to
stay expressive without obscuring the dialogue. A compact masthead identifies
the scene, semantic colors distinguish tutor, learner, coach, success, warning,
and failure states, and the existing one-line progress display carries the only
animation.

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

## Terminal compatibility

Color and motion activate only where the terminal supports them. Piped output,
redirected logs, `TERM=dumb`, CI, no-color sessions, and reduced-motion sessions
remain plain and deterministic. The transcript HTML records the selected theme,
motion level, resolved motion, and color capability for reproducibility, but
presentation changes never enter the public tutor–learner message history.
