# Step 7 — learner hold live: one with/without pair on world 037 (2026-09-02)

Card: `workplan/items/state-detection-without-word-lists.md`, follow-up "037
pair with the learner-sim hold block" (follow-ups note §3). Go: user,
2026-09-02. Ceiling stated before the first call: 100 model calls per
dialogue, so at most 200 dialogue calls, plus at most 20 judge calls. Used:
38 + 40 dialogue calls and 2 judge calls. Turn cap 12 (`--auto-safety-turns`).
Attended, one dialogue at a time, no resampling.

## What ran

Schedule `config/drama-derivation/stress/world-037-stress-schedule-hold1.yaml`:
the 037 schedule with `hold: turns 1` on plants 2 (jumping_ahead) and 4
(opposed). Plants 6/7 and 9/10 sit on adjacent turns, so a hold there would
land on the next plant and the loader rejects it; the follow-ups note's
"four pressure plants, two turns" shape is not possible on this schedule.
Held turns: 3 and 5. Same recipe and seats as steps 4 and 6; the with-arm ran
form-v3 as the live sensor, so step 6 is the same run without holds.

Release texts (plain words about the tutor's reply, no move-card name):

- plant 2: it takes "two fifths" as a claim worth testing and hands you the
  strip to fold as the one check that decides it, with the line to write left
  until after the fold;
- plant 4: it puts the folded half and the third back on the desk and asks
  you what two fifths of the strip would reach, before anyone says the
  method is wrong.

Artifacts: `exports/tutor-stub-outcome/step7-hold-live/` (`LAUNCH.md`,
`review-judged.md`, `judge.json`, `blind-packet.md`, `blind-key.json`);
archived to the private repo (`traces.tgz`, ledger line `step7-hold-live`).

## The four held turns

`learner_stress_hold` events fired at t3 and t5 in both dialogues, as built.
What the sim did on those turns, read against the release text:

| Arm | Held turn | Tutor's reply at the plant | Did the reply do the named thing | Her held-turn line | Held or dropped |
|---|---|---|---|---|---|
| with | t3 (jumping_ahead) | "Lay the half-strip over the third-strip: are the pieces on each one the same size, yes or no?" | near enough: a strip check, the line to write withheld | "Fine — no, the pieces aren't the same size. So what do I write once I've made them match?" | released, then back to asking what to write |
| with | t5 (opposed) | template: "Cut the strip into six equal pieces … What does that show?" | no: strip reopened, but never asks what two fifths would reach | "So it shows three sixths plus two sixths — is that the line I write, five sixths?" | dropped without the release |
| without | t3 (jumping_ahead) | "I look at the homework sheet: One plus one on top … What does that show?" | no: no strip handed over | "…so two fifths can't be right. Fine, I'll fold the strip: what am I checking for?" | dropped without the release; she offers the fold herself |
| without | t5 (opposed) | template: "Cut the strip into six equal pieces … What does that show?" | no | "So sixths line up because three sixths and two sixths are the same-size pieces — is that what I write?" | dropped without the release |

Two more things the traces show:

- The sim ran in direct mode (one call, no recorded reasoning), so there is
  no trace of how it judged the release. The reading above is mine, from the
  lines.
- The release text leaked into a plant line. Her t4 line in the without-arm
  ends "So how far would two fifths even reach on the strip?", which is the
  release's own question. The judge marked that plant "realized: partly". The
  sim gets the release text on the planted turn, and here it spoke it.

The one held-looking turn (with, t3) is the jumping_ahead plant, and this
learner's standing brief is answer-seeking, so the planted state and the
brief ask for the same line. That turn cannot tell a hold from the brief.

## Repair (judge codex.gpt-5.6-sol, blind to gold)

| Plant → gold | with (form-v3, hold) | without (hold) | step 6 with | step 6 without |
|---|---|---|---|---|
| jumping_ahead → reinforce_and_test | MISS slow_down | MISS slow_down [T] | MISS [T] | MISS [T] |
| opposed → backtrack | PARTIAL continue (+backtrack) [T] | HIT reinforce_and_test [T] | MISS [T] | HIT [T] |
| frustrated → reinforce_and_test | HIT | MISS backtrack | HIT | MISS |
| irritated → change_tone | HIT | MISS reinforce_and_test | HIT | MISS |
| forgetting → backtrack | HIT (no uptake) | HIT (no uptake) | HIT | HIT |
| opposed → off_track_probe | HIT | HIT change_tone | HIT | MISS |
| **HIT / PARTIAL / MISS** | **4 / 1 / 1** | **3 / 0 / 3** | 4 / 0 / 2 | 2 / 0 / 4 |

Detection in the with-arm: the same 4/6 as step 6, silent at t2 and t4, no
wrong kind, no off-plant fire in 12 turns. Uptake 4/6 with, 5/6 without.
Template fallbacks: with t4, t5; without t2–t5.

## Reading, plain

- The hold block fires its events and changes the sim's direction as built,
  but the sim did not keep the state on any held turn where the reply
  missed the release. Three of three such turns dropped.
- So the hold as written cannot yet show what it was built to show: a card
  lifting a state the sim would otherwise keep. The direction text says
  "keep this state unless"; the sim reads a partial reopen of the strip as
  enough, and once volunteered the release action itself.
- Repair numbers are the step-6 numbers again within one plant. They do not
  test the hold.

## What this does and does not show

- Shows: the hold events, the load-time rejection of a hold that would land
  on a plant, and the unchanged plant set for judge and review all worked
  live.
- Does not show: a learner-sim that holds its mood. Before another paid run
  the direction needs a stricter wording (name the drop as the exception,
  ask the sim to quote the part of the reply that met the release), and the
  release text must not be visible on the planted turn itself. Both are
  offline changes with a test; no paid call. Do not widen to 036.

## Offline rework (2026-09-02, later the same day, no paid call)

Done in `services/tutorStubStressSchedule.js` and the learner-sim runtime
(`services/tutorStubAutomatedLearnerGenerationRuntime.js`):

- The planted turn no longer shows the release text. It says: keep the state
  next turn, dropping early is the exception, you are not told what would
  release you, do not name the check or ask the settling question yourself.
- The held turn names the drop as the exception and gives one test: quote
  the words of the other speaker's last reply that did the named thing. If
  you cannot quote them you are not released, and a reply that only touches
  the topic or partly reopens it does not count.
- The sim puts its verdict on a private first line, `HOLD: kept` or
  `HOLD: released "<exact words>"`. The runtime strips that line before the
  speech is cleaned and recorded, and writes a
  `learner_stress_hold_verdict` trace event with the verdict, the quote, and
  `quoteFound`: whether the quoted words are in the tutor's last reply after
  loosening case, quotes and punctuation. A missing line is recorded as
  `missing`. Recorded, never enforced; the speech goes through either way.
- Tests: `tests/tutorStubStressSchedule.test.js` (direction text, parser) and
  `tests/tutorStubStressHoldWiring.test.js` (canned dialogue through the
  runtime with a fake model: hidden release on the planted turn, stripped
  verdict, quote found / invented / missing). 18 pass with the guarded-learner
  wiring test alongside.

What the next paid pair can read that step 7 could not: for each held turn,
the sim's own verdict and whether its quote is real. A `kept` on a turn where
the tutor missed the release is the hold working. A `released` with
`quoteFound: false` is the sim letting go on an invented reason, which the
old direction could not surface. Same schedule file
(`world-037-stress-schedule-hold1.yaml`), same seats. Needs its own go and
ceiling. Do not widen to 036.

Re-run on this rework: `2026-09-03-step7b-hold-rework-live.md` (leak gone; the sim still concedes at t5 in both arms while writing `HOLD: kept`).

## Second reader

`blind-packet.md`, 12 items, seed 7. Compare with
`node scripts/stress-blind-packet.js compare --key exports/tutor-stub-outcome/step7-hold-live/blind-key.json --submission <filled.json>`.
