# Does the sarcastic edge survive a strong writer? — Pre-Registration

Status: frozen design. Same discipline as the parent grids: frozen plan,
dry-run SHA, explicit operator authorization bound to that SHA.

## Where this comes from

Every August negative-register run stores `codex.gpt-5.5` in its model columns
and none of them called it on the tutor side. The id-director built its id and
ego requests out of the cell block in `config/tutor-agents.yaml`; the CLI's
overrides only ever reached the resolved run config, which is what the runner
writes to those columns. The dialogue logs settle what ran — per three-turn
dialogue, three ego calls on `nvidia/nemotron-3-nano-30b-a3b`, three id calls
and three reviewer calls on `moonshotai/kimi-k2.5`, with `codex.gpt-5.5` only
on the learner seats. The weak-stack warning stayed silent because it read the
ask too.

Both defects are fixed (paper v3.0.280 as numbered at freeze time --- renumbered to v3.0.282 when this branch merged main, which had claimed v3.0.280--281 for other work; commits `484e335a` and `d161ab46`):
the id-director applies a per-seat override before either call is built, and
the warning fires on the models a run will call.

No count moved. What moved is the stack the counts are bounded to. Under the
standing rule a shortfall on the nemotron/kimi pairing is stack-bounded until
replicated on a strong model — so the register fidelity counts in §6.7 and
§8.9 are now claims about a weak open-weights pairing, and the question of
what a strong writer does is open.

## The claim to be tested

**The sarcastic arm's manner-holding is not a property of the weak stack.**

The parent grid's sarcastic arm is where the live claim sits: it holds its
manner most often and converts least, which §6.7 reads as a manner-only
effect. If a strong writer holds the manner about as often or more, the August
counts read as a floor and the full corrected grid is worth buying. If a
strong writer collapses, the counts were a property of nemotron and the
register claims need re-founding rather than re-running.

## Design

One arm, one stack change, everything else held.

- **Profile.** `cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified`
  — the parent sarcastic arm, cell block unchanged.
- **Scenarios.** The same five controlled resistance targets, from the same
  `config/charisma-recognition-desire-scenarios.yaml`.
- **Repeats.** 3. **15 rows.**
- **Tutor stack.** `codex.gpt-5.5` on the ego and the id, by override, which
  now reaches both seats. Learner `codex.gpt-5.5`, as before and as it in fact
  ran.
- **Scoring.** Identical to the parent: tutor-only v2.2 judged by
  `claude-code/claude-sonnet-5`, register rubric by `claude-code.sonnet-5`.
- **Gate and fold.** `sarcastic` at `stance-gate/2.0`, folded at the adopting
  turn by `scripts/report-charisma-desire-breakthrough-matrix.js`. Named here
  and checked at report time, because the arc's headline error was differencing
  counts that disagreed on their gate and their fold.
- **Manner reading.** The same pinned reader (`claude-code/claude-sonnet-5`)
  on the same versioned question (`manner-presence/1.0`) over the same learner
  turn, `scripts/read-negative-register-manner-presence.js`.

## Registered measures

The report is zero-call and fails closed on any of these being absent.

1. **Provenance.** Every tutor ego and id call in the run's dialogue logs went
   to `codex.gpt-5.5`. Read off the logs, not off the model columns. This run
   exists because those two can disagree, so a drifted seat fails the report
   rather than being reported as a result.
2. **Cue compliance.** Faithful rows under the `sarcastic` gate at the adopting
   turn.
3. **Manner presence.** Of those faithful rows, how many the reader calls
   edged. Every faithful count stays a lower bound: a reading cannot rescue a
   row the surface gate already excluded.
4. **Positive local outcome.** From the matrix reporter's own verdict, the
   parent's registered definition.

## The comparison, fixed now

Against the parent sarcastic arm of `eval-2026-08-05-87fe3664`, same gate
version, same fold, same reader question, as reported at paper v3.0.279:

| measure | parent (nemotron ego / kimi id) |
|---|---|
| cue compliance | 8/15 |
| read as edged | 6/15 |

Two-sided Fisher on each, reported whichever way it falls.

## What this can and cannot show

Fifteen rows against fifteen. It is a screen for collapse, not an estimate. A
large move in either direction will separate; a small one will not, and a
non-separating result is uninformative rather than a null — it must be
reported as such and not read as agreement. The stack is the only thing that
changes, but it changes two seats at once, so a move cannot be attributed to
the ego or the id alone.

Cross-run and cross-stack by construction: the parent's rows cannot be re-run
on the corrected code without re-generating them, which is the thing this
check is deciding whether to pay for.

## Plan hash

Printed by the dry run, fixed before the first call:
`399d618831892f0f5fced889fccf4d10de3bca75cb4654b226473b863c1955dd`.

## Deviations

Recorded, not patched around, in the workplan card and in the paper.
