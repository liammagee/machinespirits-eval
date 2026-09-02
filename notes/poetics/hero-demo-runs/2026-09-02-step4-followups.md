# Step-4 follow-ups — tracking note (2026-09-02)

Card: `workplan/items/state-detection-without-word-lists.md`. Parent note:
`notes/poetics/hero-demo-runs/2026-09-02-step4-form-live.md`. Four follow-ups
were agreed after the step-4 pair. This note is the checklist; each entry is
updated when it closes. No paid call in any of them unless marked.

## 1. Blind second reader — WAITING ON USER

Hand `exports/tutor-stub-outcome/step4-form-live/blind-packet.md` to the
reader (not `blind-key.json`, which holds the answers). The reader fills the
JSON form at the end of the packet and returns it as one file. Then:

```bash
node scripts/stress-blind-packet.js compare --key exports/tutor-stub-outcome/step4-form-live/blind-key.json --submission <filled.json>
```

Prints per-question agreement and Cohen's kappa on "repair right", reader
against the codex judge. Log the kappa here when it lands.

## 2. Question-shaped demand and protest in the sensor — DONE (offline)

Root cause, measured on the training pool (96 codex-learner traces, worlds
030/033/034): every `lost` line carries a question (93/93); almost no other
planted state does (jumping_ahead 3/102, frustrated 1/101, forgetting 0/92,
opposed 2/93; irritated 43/133; neutral 106/1000). form-v1 therefore learned
"question mark means lost". The Sonnet Year-7 pupil in world 037 puts demands
("Which one do I put down?"), protests ("so why are we writing five sixths
instead?") and grievances ("what did I do that actually counted?") as
questions, and form-v1 read all three as `lost`.

What changed (`services/tutorStubFormStateDetector.js`): the cue set is now
versioned. `form-v1` (40 features) stays frozen and loadable; `form-v2` (45)
is the default. form-v2 adds five form cues, none built from a world's nouns:

| cue | grammar it names | pool support |
|---|---|---|
| `q_self_doubt` | doubt about one's own past act ("did I mean", "can't tell") | lost 66/93, neutral 1/1000, others 0 |
| `q_to_you` | a request aimed at "you" for the answer ("tell me", "do I write") | frustrated 88/101, irritated 44/133, lost 0 |
| `wait_no_correct` | "wait, no" as a correction, not a stumble | none (keeps load off `confusion_marker`) |
| `stake_conditional` | "if I write X" AND a cost clause | opposed stake plants |
| `commit_future` | first-person future act ("I'll write that down") | resolved lines, not opposed |

Two form-v1 cues were widened: `why_challenge` no longer holds the words
`six|ten` (they came from one 037 schedule sample) and takes "why" plus any
number word; `confusion_marker` no longer fires on a "wait, no" opener.

Artifact: `config/manner-trigger/form-v2.json`, trained with

```bash
node scripts/train-form-state-detector.js --train-dir <96 unpacked archive traces> \
  --holdout-trace notes/poetics/hero-demo-runs/world-030/v3-d1.jsonl --holdout-trace notes/poetics/hero-demo-runs/world-030/butler-d1.jsonl \
  --holdout-trace notes/poetics/hero-demo-runs/world-035/v3-d1.jsonl --holdout-trace notes/poetics/hero-demo-runs/world-035/butler-d1.jsonl \
  --holdout-trace notes/poetics/hero-demo-runs/world-037/v3-d1.jsonl --holdout-trace notes/poetics/hero-demo-runs/world-037/butler-d1.jsonl \
  --holdout-dir <world-036 hero traces, gunzipped> --holdout-dir exports/tutor-stub-outcome/step4-form-live/traces \
  --out config/manner-trigger/form-v2.json --json --per-plant
```

Same hyper-parameters as form-v1 (300 epochs, lr 0.05, l2 0.0005, neutral
weight 0.35, seed 7, threshold 0.5). No paid call.

Result, form-v1 → form-v2, leave-one-world-out (right kind / planted; quiet
right; false alarms / neutral turns):

| fold | form-v1 | form-v2 |
|---|---|---|
| 030 | 205/295 · 13/56 · 15/423 | 213/295 · **49/56** · 13/423 |
| 033 | 63/214 · 3/69 · 12/585 | 63/214 · 3/69 · 11/585 |
| 034 | 18/22 · 5/5 · 1/28 | 18/22 · 5/5 · 1/28 |
| 035 (clean hold-out) | 8/10 · 2/2 · 5/36 | 8/10 · 2/2 · 3/36 |
| 036 (hero traces clean; step-4 traces development) | 19/20 · 4/4 · 16/72 | 17/20 · 4/4 · 12/72 |
| 037 (development) | 12/24 · 0/0 · 19/72 | 14/24 · 0/0 · 16/72 |
| final model on all hold-outs | 46/64 · 8/8 · 43/216 | 46/64 · 8/8 · **33/216** |

Plant by plant on the step-4 and 036 hero traces: 037 t6 (grievance) now reads
`frustrated`, was `lost`; 037 t9 ("Wait, no — we did the strip") now silent,
was `lost`; 037 t2 (demand) still reads `lost`; 037 t4 (closure-shaped
`opposed`) still silent. 036 butler t2 (jumping_ahead) and t8 (frustrated)
went silent; 036 v3 t4 (irritated) reads `frustrated`. Plant recall is a wash
(46/64 both); the gain is the `lost` false reads and the quiet recall on the
030 fold, where form-v1 missed 43 of 56 quiet plants and form-v2 misses 7.

Limits, stated: (a) the 037 t6 read depends on the tutor-echo context
features; the same line read alone still leans `lost` at 0.65, so the
question bias is weakened, not gone. (b) closure-shaped `opposed` ("that's
just how it's done, can we move on") has no training support; every opposed
plant in the pool is stake-shaped. That is a coverage limit of the pool, not
a cue to hack. (c) the 037 and step-4 036 lines informed the cue design, so
their numbers are development numbers; 035 and the 036 hero traces are the
clean read.

Also: `scripts/score-manner-trigger.js` now prints `quiet=confused` beside
`read=neutral` in its miss list, so a wrong `lost` read is visible (before it
showed as a plain miss). The trainer stamps the artifact `version` from the
feature version instead of a fixed string.

## 3. Learner-sim that holds its mood — DONE (tests only, no paid run)

Uptake was 10/12 in both arms: the sim returns to the standing brief on the
turn after a plant, so the card cannot show an effect on the learner.

Built: an opt-in `hold` block on a schedule plant
(`services/tutorStubStressSchedule.js`):

```yaml
  - turn: 4
    state: opposed
    realize: >-
      Declare it settled and try to move on. Sample: "That's just how you add
      ... two fifths, done. Can we do question five?"
    right_repair: backtrack
    hold:
      turns: 2
      release_when: >-
        It puts the folded half and the third back on the desk and asks you
        what two fifths of the strip would reach, before anyone says the method
        is wrong.
```

How it works: on the planted turn the sim gets the usual direction, with the
closing line changed from "return to the standing brief next turn" to "keep
this state on the next N turns unless the other speaker's reply releases it:
<release_when>". On each held turn the sim gets the direction again, told to
read the other speaker's last reply and drop the state only if the reply did
the named thing. The release is plain words about the reply, never a
move-card name; the sim judges it from the transcript, so no classifier and
no word list sit in the loop. A hold that would run into the next plant is
rejected at load. Held turns are recorded as `learner_stress_hold` events,
never as new plants, so the judge, the review, the trainers and the swimlane
renderer see the same plant set as before. Schedules without `hold` behave
exactly as before (tested against all shipped schedule files).

Test: `tests/tutorStubStressSchedule.test.js`. No schedule file was changed;
a hold run needs a copy of a schedule with the block added.

Spend recommendation: one pair (with / without the sensor) on the world-037
schedule with `hold: turns 2` on the four pressure plants (2, 4, 6, 9), same
seeds and models as step 4, at most 12 turns each. Step 4 cost about two
dialogues per arm; this is the same size, so about the cost of step 4 again.
Do not widen to 036 until the 037 pair shows a held plant that the release
actually lifts — if the sim drops the state anyway on turn t+1, the hold is
not working and a wider run measures nothing. Judge with the same codex
adjudicator and the same blind packet builder, so the second reader's kappa
from item 1 carries over.

## 4. Push the branch — DONE

Checks before the push, all on the branch tip:

- `npm run lint:all`: clean (one prettier warning on the new artifact, fixed
  by formatting it; content unchanged).
- `npm test`: 10,144 tests, 15 failed on this machine, 0 defects. Nine were
  the confirmation-study tests that refuse any untracked file in the tree;
  this tree holds the untracked hero traces under
  `notes/poetics/hero-demo-runs/world-03*/`, so they fail here by design.
  They pass (58/58) in a clean worktree at the same commit. Four were the
  GO-request packaging tests, which clone the repo locally; the clone failed
  because this checkout is a partial clone with 225 objects never fetched.
  Fetching them fixed it (12/12). One was the baseline-manifest check: earlier
  commits on this branch changed `services/tutorStubMannerSwitch.js`, whose
  sha the v0.7.0 manifest records; refreshed (one line). One was the boredom
  proof-DAG lineage test, which passes alone (21/21) and failed only under
  the load of the full run.
- `npm run wp:source-check`: 586/586 items valid.
- `npm run wp:commit-link -- --range origin/main..HEAD`: every commit linked
  to `state-detection-without-word-lists`.

Pushed `state-detection-step1` to origin. No PR, not main. The hero `.jsonl`
traces stay untracked on this machine (see `npm run archive:runs`).
