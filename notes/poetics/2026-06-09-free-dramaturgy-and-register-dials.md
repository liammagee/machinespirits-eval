# Operator decision — free dramaturgy + register dials (2026-06-09)

Status: implemented + mock-validated; no paid run yet under the new staging.
Scope: dramatic-derivation loop (`services/dramaticDerivation/`, `scripts/run-derivation-loop.js`, scriptorium `/derivation` pages).
Logged per the frozen guardrail: *director revisions are explicit operator decisions, logged with reasons.*

## The defect this answers

Both paid v002 runs derived cleanly but read as the same two people trading
the same move until the curtain: the tutor used **erotema** on 29/32 turns
(codex cast, `nocturne-v002-codex-001`) and 30/32 turns (mixed cast,
`nocturne-v002-mixed-001`). Cause, traced in the 06-08 session: with the
authored acts frozen, the tutor's only turn-to-turn variation was the slow
board and an 8-line tail — near-identical prompts in, near-identical figure
out. The drama had no one whose job was to notice the rhythm and break it.
(Operator phrasing of the ask: the director should call the general shape or
arc, not a fixed set of acts, "otherwise we get a locked-in pattern where
tutor and learner go back and forth until the conclusion, like Rosencrantz
and Guildenstern.")

## Decision 1 — the dramaturgy belongs to the director

- Director output extends to `{direction, release?, phase?, tutor_note?}`.
  - `phase {name, intent}` **declares a movement**: it persists until
    replaced and becomes the realized act-structure of the run.
  - `tutor_note` is a **one-turn staging instruction** to the tutor
    (director speaks first; the same turn's tutor consumes it; the engine
    then nulls it). It colors manner only.
- The author's `dramaturgy.acts` are demoted to a **sketch** — the director
  may keep, bend, or replace them. Diagnosis recovers the realized arc from
  the declarations (`stagingSegments`; falls back to the sketch when nothing
  was declared), and the curve/slope/transcript all group by realized
  movements, not the sketch.
- **Unchanged (still frozen):** release schedule, deterministic checker,
  slope constraints, turn cap, learner blindness to all staging, plotLint
  gate. The new channels touch *manner*; the evidence channel is the same
  index-mapped release machinery, so the single-concealment invariant is
  untouched (regression-tested).

Reason: the lock-in is a staging failure, not an evidence failure. Giving
the director observe-and-intervene instruments (new movement, new
instruction) attacks the repetition where it arises — the tutor's static
prompt context — without reopening anything the leak-proofing depends on.

## Decision 2 — recognition/charisma as operator dials (interim)

`--recognition 0–3` and `--charisma 0–3` on the loop shell. Graded free-text
register blocks are appended to the tutor system prompt (recognition =
Hegelian mutual-recognition lineage; charisma = the Weber register from
cells 101–109); the director additionally gets a charisma staging line.
Dials are recorded in `diagnosis.json` and shown as chips/panel lines.

Reason: the operator asked for variable amounts of both "for now", with a
structured treatment later. Free-text register blocks are the cheapest
faithful version and keep the dials out of the evidence channel entirely.
Phase 2 can replace the blocks with structured mechanisms without changing
the CLI surface.

## Decision 3 — the shell reports status

- One compact line per completed turn (engine `onTurn` hook): turn, D,
  releases, adopts/retracts, declared movement, asserts, event flags.
- Per-call stderr trace defaults ON for `--real` (`DERIVATION_TRACE=0`
  silences).

Reason: paid runs took ~30 min with no liveness signal; "the dramas seem to
stall or take a while to build, and their status is unclear."

## Decision 4 — viewer parity

`/derivation` pages now: home-page card (Recognize group), realized-movement
grouping with "declared by the director" tags + intent ledes, director
declares/notes rendered per turn, dials + staging chips, the instrument
panel at the transcript foot (mirrors the markdown twin), a dramaturgy
column on the index, and a click-to-expand trope glossary on the tutor's
move-figure labels (anaphora + erotema glosses verbatim from
`rhetoric-core.ttl`; analogia/exemplum/aposiopesis per the scripts' usage).

## Evidence on hand

- `nocturne-v002-mixed-001` (claude-opus director / codex tutor /
  claude-sonnet learner, OLD staging code): grounded_anagnorisis, 32/40
  turns, 11/11 releases on cue, slope 0.22 D/turn — and 30/32 erotema. The
  architecture survives a mixed cast; the monotony does not depend on the
  cast. That is the baseline the free director has to beat on figure
  diversity *without* losing the clean derivation.
- `freelance-director-mockcheck` (new code, mock): 4 movements declared, 4
  tutor notes consumed, dials recorded (recognition 2/3, charisma 1/3),
  releases all on cue, verdict unchanged — the new channels do not perturb
  the formal layer.
- Tests 24/24 (`tests/dramaticDerivationPhase1.test.js` + persistence), incl.
  a new free-dramaturgy test: mock declarations land exactly at sketch
  boundaries; `diagnose().staging` + the eval panel report them.

## Next

One attended paid run of v002 with the free director + dials (e.g.
`--recognition 2 --charisma 1`, mixed cast) to test whether declared
movements + one-turn notes actually break the figure monotony. Awaits
explicit operator go; success looks like erotema share well off 30/32 with
verdict and release adherence held.
