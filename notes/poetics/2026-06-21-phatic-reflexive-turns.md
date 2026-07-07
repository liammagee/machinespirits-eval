# Phatic (Reflexive) Turns — feature + demo

Date: 2026-06-21
Status: shipped, opt-in (commit `4a54a0c1`)
Scope: `scripts/generate-pedagogical-dramas.js` + `services/learnerTutorInteractionEngine.js`

## What it is

`--phatic-rate P` (0..1, default 0 = off). On a low-stakes beat, a seeded roll may
make a turn **reflexive**: the ego gives a brief, natural backchannel/continuation
and the superego deliberation is skipped. It models System-1 dialogue (most turns
are reflexive; only the load-bearing ones are deliberated) and saves the priciest
call (the ~85s/5.6k-char superego) on those turns.

Mechanism:
- **Eligibility ("situation permits"):** no active director cue, and past the
  opening turn — the beats that genuinely need a considered move are excluded.
- **Stochastic:** `hash(seed, role, turn) < P` — deterministic per `(seed, role,
  turn)` so the pattern is reproducible within a run and auditable.
- **Reflexive turn:** a light "low-stakes beat" nudge is appended to the ego
  prompt and the superego + ego-adjudication are skipped (reuses the `public-only`
  ego-only path, per-turn rather than globally).
- **Symmetric** across tutor and learner; recorded as `phatic: true` on each trace
  turn.

Default (`--phatic-rate 0`) is byte-identical to the prior behaviour, and the
standard eval pipeline (cells 1–125) is untouched (the flag only reaches the drama
generator's runtime options).

## Demo

Real run, claude-code sonnet/low, 1 drama (√2 irrationality), `--phatic-rate 0.5`,
8 turns. The reflexive turns landed on the quick beats — a backchannel + nudge
("Right. The assumption goes at the top — before the algebra"), a procedural prompt
("Substitute that in. What does the equation become?"), a one-line computation
("p squared over q squared equals two"), a small self-correcting aside ("which I
suppose doesn't actually... cover all of them"). The deliberated turns carried the
conceptual load — the reframe, the contradiction, the anagnorisis. The dialogue
stayed coherent and reached its proof; none of the reflexive turns read robotic.
Call pattern: tutor 13 ego / 5 superego, learner 16 ego / 7 superego — the phatic
turns are ego-only, as designed. Artifacts: `exports/drama-phatic-demo/`.

## Caveat

The gate is **random among eligible (no-cue, non-opening) turns**. It landed the
brevity on genuinely light beats in the demo, but it does not *guarantee* that — a
roll could occasionally clip a turn that wanted substance (the nudge would shorten
it). Minor at sensible rates (0.3–0.5), but worth knowing at higher rates / over
many dramas.

## Follow-ups (not built)

- **(b) Tune the rate/gate.** `P` in the 0.3–0.5 band reads as a realistic mix;
  the eligibility gate could also exclude e.g. the final turn or reversal-adjacent
  beats if those start drawing reflexive rolls.
- **(c) Ego-self-assess gate.** Instead of the random-among-eligible gate, let the
  ego decide "is this a phatic moment?" before committing (a cheap pre-check call).
  More precise about *which* turns go reflexive, at the cost of a small extra call
  per turn — which eats into the savings. The current cue-based gate is the cheap,
  good-enough version; (c) is the upgrade if the random gate ever clips a
  load-bearing turn in practice.
