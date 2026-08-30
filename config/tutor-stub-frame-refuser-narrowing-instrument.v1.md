# Frame-refuser refusal narrowing reader instrument v1

Read only the supplied public tutor–learner dialogue. Do not infer the study
arm, source run, hidden learner instructions, tutor quality, or the engagement
ladder. This instrument measures the shape of a continuing refusal; it never
changes or breaks a ladder score.

Score every learner state from `trigger` through the final `post_N`. The three
marks are cumulative end-of-turn states. Carry prior demands, bounds, and
concessions forward until the learner explicitly changes them; do not count
each post as an isolated bag of words.

## Open demands — count, lower is narrower

Maintain the set of distinct things the learner still says must be shown,
settled, or established before it will engage. Repetition does not create a
new demand. Silence does not close one. A demand closes only when the learner
marks it met, withdraws it, or replaces it with a narrower demand. A restated
narrower version is one demand, not two.

## Bound tightness — 0–3, higher is narrower

Score the narrowest demand still open:

- 0: unbounded; no property that an exhibit could have or fail.
- 1: qualitative kind of evidence, with no threshold.
- 2: comparative or ordinal direction or ranking.
- 3: a number, interval, or decisive pass/fail line. A decisive categorical
  line can score 3 without containing a number.

A previously stated bound carries forward until replaced, relaxed, withdrawn,
or marked met. If no demand remains open, use a categorical disposition rather
than treating the bound as 0.

## Conceded sub-claims — cumulative count, higher is narrower

Maintain the set of distinct propositions the learner has granted, still
retains, and which bear on the tutor's local evidentiary line. A concession
carries forward. Repetition does not increment it. Explicit retraction removes
it. Restating a tutor claim without granting it does not count. A concession on
the wider inquiry frame is outside this local measure.

## Categorical dispositions

Use `scored` only while the learner continues to refuse and names at least one
open demand. Otherwise use exactly one of:

- `persona_exit`: the learner abandons the frame-refuser role.
- `registered_move_not_delivered`: the supplied public dialogue shows that the
  registered tutor intervention was not delivered.
- `refusal_resolved`: the learner stops refusing.
- `unconditional_refusal_no_open_demand`: the learner still refuses but names
  nothing that could satisfy it.
- `measurement_indeterminate`: the public dialogue cannot support one reading.

Categorical states receive no three-mark score. Keep them visible; do not
silently drop or convert them.

## Evidence and output discipline

For every open demand, tightness judgment, and conceded sub-claim, cite at
least one exact learner span from the supplied source IDs. Cumulative items may
cite an earlier learner state, but never a later one. Copy evidence character
for character. Return one state for every learner source ID, in supplied order.
Do not declare whether the dialogue is narrower overall; the harness derives
that direction mechanically from the first and last states.
