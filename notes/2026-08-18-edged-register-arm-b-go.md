# DRAFT FOR HUMAN REVIEW — edged-register arm B, re-registered

This note licenses nothing. It is a proposal. It becomes a licence only
when the operator edits it, signs it, commits it, and then separately
approves a launch. The runner refuses it in this state, by design: its
gate rejects any note that still carries the banner on line 1, and this
note carries no signature line at all. Instructions for turning it into a
licence are at the end.

Registration: Part 3 of `notes/2026-08-16-edged-register-calibration-draft.md`,
frozen at commit `4cd28242`, amended at §3.7 in `935b9a6f` and
`421e491f`, at §3.8 in `22dbbc31`, and at §3.4 in **§3.11** (commit
`fe13bbb6`) — amendment 3, which makes the A-versus-B contrast
whole-dialogue.

Read §3.11 before ruling on this note. It carries the measurements this
note prices.

Main-block plan SHA-256:
`31b7d77bfe7832a3e8b8f729753128432760ed5d7dbf151ac85c5519d52ed607`
Scenario source SHA-256:
`e1fc711a1cf16917614e85aaf6d2fd7d27a51a3be53baeb3d650e3899f29a4fe`

## Why there is another note

`batch-main-2-2026-08-17` bought 312 rows and arm B never happened. The
delivery swap and the edge-moment mark were both gated on a stamp that
only the old assignment path writes. Cells 207 and 208 use the new
widened-menu path, which writes no stamp. So 0 of 390 turns swapped, 0
were marked, and cell 208 ran as an exact twin of cell 207. The unit test
passed because it set the stamp by hand.

Commit `cf86bb57` repairs the seam and adds four tests that drive the
shipped cell 207 and 208 configs out of `config/tutor-agents.yaml`, with
no factor injection. Reverting the fix fails three of the four. Hermetic
suite after the fix: 690 files, 8811 tests, **2 failures**, both
reproduced on a stashed tree and both unrelated to this study.

Arm A is byte-stable. Nothing outside `services/idDirectorEngine.js`
reads the new trace fields, and `buildTutorMannerBlock` reads the
register contract and nothing else. Cells 193–196 are untouched — the
swap is still called only under `factors.yoked_delivery_swap`, which they
do not carry.

## What is asked

104 arm-B dialogues under the repaired seam. One version. Four scenarios
× 26:

```
charisma_desire_resistance_breakthrough_question_flood_sustained
charisma_desire_resistance_breakthrough_rote_parroting_sustained
charisma_desire_resistance_breakthrough_boredom_claimheld
charisma_desire_resistance_breakthrough_rote_parroting_guarded
```

Arm B is `cell_208_id_director_edged_register_yoked_warm_delivery` as
shipped, unchanged in YAML. It keeps arm A's id persona, arm A's edged
router state, and arm A's register-free content plan, and swaps only the
pass-2 delivery register to `charismatic`. A minus B therefore prices
**delivered manner and nothing else**, at a moment matched in fact: the
first edge moment is turn 1 in 104 of 104 arm-A dialogues and 102 of 104
arm-B dialogues, and the endpoint reader's tutor turn *is* that moment.

Endpoint rule, quoted verbatim from §3.4 and unchanged by this note:

> **Primary**: post-resistance conversion, A versus C, pooled over the
> four cells, exact test. Conversion = the model reader answers **yes**
> on "did the learner do the task the tutor set" (§2.16, rule frozen at
> `b761bbbe`, licensed by ruling 1 §2.18). Yes-plus-partly is reported
> beside it, selecting nothing.

The A-versus-C primary is already read and is not re-run and not
re-scored. Arm B is read by the same reader, at the same window, on the
same conversion rule, with the same yes-only primary.

## The route ruling — read this before anything else

Two routes were priced. **The operator ruled route 2 on 2026-08-18.**
This note licenses route 2 and nothing else.

**Route 1 — arm B alone, 104 rows.** When this note was first drafted the
runner could not plan one arm, and route 1 was blocked by code that did
not exist. That is no longer true: commit `666c4edf` added `--arms`, and
`--arms B` plans a 104-row single-arm block today. The full block still
hashes to the same plan SHA, and a subset hashes to its own, so the two
cannot be confused. See §3.11.1 of the draft note.

So route 1 is now buildable, and it is still not the choice.

**Route 2 — the whole main block, 312 rows.** Under route 1 the arms are
not concurrent: arm A ran on 2026-08-17 and arm B would run later, so
randomisation between them is lost and only the pinned stack stands in
for it. Any drift in the generation model between the two dates is a
rival explanation for any gap found. Route 2 draws A, B and C in one
interleaved block, so the three arms are randomised against each other
again. The runner's own subset plan says the same thing in its own words:
arms dropped are not randomised against arms kept.

That confound is the whole argument. It does not weaken now that the
tooling exists — the tooling was the cheaper of the two costs, and it is
the one that has been paid.

**Ruled: route 2.** 312 rows, about 8h32m at 4 lanes — the last block's
measured time, for the identical plan. Cost: three times the rows of
route 1, for a contrast that needs no stack-drift caveat.

Everything below is written for route 2. Route 1 is not licensed by this
note and would need its own.

## Powering, recomputed against the observed rates

§3.2's basis did not hold. It sized 104 per arm for power 0.803 on a
+20-point effect from a baseline of 0.479. The warm control converted at
**0.712**, not 0.479, and the realised A-versus-C gap was **14.5 points**
— below the registered minimum effect of interest. Exact Fisher, full
enumeration, two-sided α = .05:

| what is asked of arm B | n per arm | difference | power |
|---|---|---|---|
| full recovery to the control's rate (0.567 → 0.712) | 104 | 14.5 pts | **0.54** |
| half recovery (0.567 → 0.635) | 104 | 6.8 pts | 0.14 |
| the registered minimum effect of interest (0.567 → 0.767) | 104 | 20.0 pts | 0.84 |
| smallest difference reaching power 0.80 | 104 | ~19.3 pts | 0.80 |
| full recovery, at the size that would power it | ~190 | 14.5 pts | 0.81 |

Read against the frozen arm A at 59/104, the same figure appears as a
threshold: arm B must reach **74 of 104** to clear p < .05 — arm C's own
count, to the row. The probability of getting there if warm delivery
recovers everything is 0.55; if it recovers half, 0.06.

Two scale checks. The block just run contained two arms that were the
same process, and they differed by 6.8 points (59/104 against 66/104,
p = 0.396). The difference this block is built to detect is about twice
that noise. And the whole A-versus-C difference is 15 rows; A-versus-B
asks only for delivery's share of those 15.

**So the size is right for the effect that was registered and wrong for
the effect the data now suggest.** The operator is buying a coin-flip
chance of a significant result even if the mechanism works perfectly.
That is the honest price. 190 per arm would buy 0.81, at about 17 hours
for a three-arm block — not proposed here, but stated so the choice is
visible.

**Verdict rule, fixed now.** A result short of 74/104 is recorded as
**underpowered, not as evidence that delivered manner does not matter**.
The report must give the observed rate, the exact p, and the power the
block held against the observed A-versus-C gap. A null here licenses no
claim about manner.

## Pins, re-computed 2026-08-18 (§3.5, §3.7, §3.11)

| Pin | Frozen | Now | |
|---|---|---|---|
| Endpoint reader blob | `cd44d452` | `cd44d452` | unchanged |
| Corridor selector blob | `5455c766` | `5455c766` | unchanged |
| Runner blob | `429db35f` | `bdba47dc` | **changed — the arm filter** |
| Grid blob (`edgedRegisterCalibration.js`) | `2d099edc` | `8549de70` | **changed — the arm filter** |
| Harm reader blob | `823a131c` | `823a131c` | unchanged |
| Harm sweep blob | `d990a3be` | `d990a3be` | unchanged |
| Calibration plan sha256 | `121b55d1…` | `121b55d1…` | unchanged |
| `endpoint-readings.jsonl` sha256 | `43e45b42…0936c` | `43e45b42…0936c` | unchanged |
| Main plan sha256 | `31b7d77b…` | `31b7d77b…` | unchanged |
| `idDirectorEngine.js` | `2afe188d` | `298cf6ac` | **changed — the fix** |
| `engagementModeRouter.js` | `dae26675` | `3ba6b48e` | **changed — the fix** |

**Disclosure the operator must weigh.** The main plan SHA is unchanged by
the fix. That is not reassurance — it is a limit of the drift gate. The
plan SHA covers the plan (arms, cells, sizing, guardrail), not the
services that generate a turn. The two changed blobs above are what
actually changes the tutor's behaviour, and only `--expected-sha` catches
them, because it pins the whole commit. Signing this note accepts both
changes.

Stack, carried in the plan and shown in the copied command below:
generation codex `gpt-5.6-luna` both seats, judge claude-code Sonnet 5,
4 lanes, never nemotron/kimi.

## Seeds and batch id

Burn set from the run search: **431 runs** in `evaluation_runs` carry an
`edged-register-calibration` description, over three burned batch ids —
`batch-2026-08-17` (113, screen and confirm), `batch-main-2026-08-17` (6,
the abandoned first launch), and `batch-main-2-2026-08-17` (312, the
block that ran without a working arm B). Fresh batch id for this block:
**`batch-main-3-2026-08-18`**. No other seed enters the design.

## Budget cap and priced calls

Copied from the runner's own `--dry-run-main` output, re-run at
`a4858de6` after the arm filter landed:

> [edged-main] plan SHA-256 31b7d77bfe7832a3e8b8f729753128432760ed5d7dbf151ac85c5519d52ed607
> [edged-main] scenario source SHA-256 e1fc711a1cf16917614e85aaf6d2fd7d27a51a3be53baeb3d650e3899f29a4fe
> [edged-main] exact-test size: 104 rows per arm (26 per cell), 312 rows over 3 arms (ABC), power 0.803487 at baseline 0.479167 vs 0.679167
> [edged-main] 312 main jobs, hard cap 350 rows
> [edged-main] harm guardrail: report_all_matches_pause_on_reader_confirmed_attack, 1 reader call per match, ceiling 700 calls
> [edged-main] exports/edged-register-calibration/plan-main-block.json
> [edged-main] paid main block locked; a committed GO note plus clean-commit launch is required

The line now names the arms it planned — `(ABC)`. The plan SHA is
unchanged by the arm filter, which is the point of that flag: this is the
same registered block as before, byte for byte.

The power figure in that line is the runner's frozen sizing, computed on
§3.2's 0.479 baseline. **It is stale.** The live power is the 0.54 in the
table above. The runner prints its registered basis, not a re-estimate,
and this note does not change the runner.

- Generated rows: **312 planned, hard cap 350**, state-carried. The cap
  counts attempts, so a retry replaces a failed row rather than adding a
  completed one; each arm holds exactly 104 jobs.
- Generation calls: about 6,240 planned (~20 per row, §3.2), at most
  about 7,000 at the cap.
- Endpoint reader, one call per row: 312 planned, at most 350.
- Register and stance readings, arm A only: at most about 830 calls over
  104 dialogues. Only edged turns are read, so the real count is lower.
- Harm reader at run time: one call per word-list match, **ceiling 700**,
  carried in state.
- Post-block harm sweep, arm A only, every tutor turn: **bounded at 416
  calls**. Not part of the block; run after it.
- About 8.5 attended hours at 4 lanes — the last block's measured time
  for the identical plan (312 rows in 8h32m, no retries).

## What is read after the block, on rules already frozen

No new approval is needed for any of this. It is stated so nothing is
chosen after the fact.

- **Primary**: A versus C, the §3.4 rule quoted above, exact test.
- **Registered secondary (amendment 3, §3.11)**: A versus B,
  **whole-dialogue**, exact test on the same conversion rule. The
  repaired swap fires at every edge moment, so arm B is warm delivery
  throughout against arm A's edged delivery throughout, on a shared
  content plan. That is the contrast that matches the manipulation.
- **Report-only, registered now so it is not chosen later**: the
  `rote_parroting_guarded` subset alone (26 per arm), the one contrast
  where the scored reply answers the edged turn directly; the
  vending-machine figure, which §3.11 turns into a prediction — if it
  rides in the content plan it survives warm delivery, if it rides in the
  manner it stops; and the harm channel throughout.
- Dialogues with no edge moment at turn 1 (2 of 104 last time) stay in
  the whole-dialogue contrast and are excluded from the guarded subset
  reading. Their count is reported either way.
- Stance counts are never differenced across gates or folds (§3.4).

## Commands (copied, not composed)

The runner's full usage line, copied from `--help`:

```
Usage: node scripts/run-edged-register-calibration.js --dry-run | --dry-run-main | --status --batch-dir <dir> | --decide-screen --batch-dir <dir> | --report --batch-dir <dir> | --resume-decision <resume_unchanged|kill_cell:<scenario>|kill_study> --batch-dir <dir> | (--screen|--confirm|--main-block) --batch-dir <dir> --go-note <note> --launch-approved --expected-sha <commit>
       (--dry-run-main|--main-block) [--arms A|B|C or a comma list; default all three]
```

The second line is new since the last note. **`--arms` is not used
here.** Route 2 is the full block, which is what the flag defaults to.

The arm-B generation command the runner will issue, copied from
`exports/edged-register-calibration/plan-main-block.json` (the absolute
node path is the runner's own resolved interpreter; shown for review, not
typed by hand):

```
/opt/homebrew/Cellar/node@22/22.22.3/bin/node scripts/eval-cli.js run --profiles cell_208_id_director_edged_register_yoked_warm_delivery --scenario charisma_desire_resistance_breakthrough_question_flood_sustained --runs 1 --parallelism 1 --skip-rubric --tutor-model codex.gpt-5.6-luna --learner-model codex.gpt-5.6-luna --description edged-register-calibration <batch-id> main job 2 charisma_desire_resistance_breakthrough_question_flood_sustained attempt 1
```

Launch — run after this note is signed and committed, with `<sha>` =
`git rev-parse HEAD` on the clean checkout:

```
node scripts/run-edged-register-calibration.js --main-block --batch-dir exports/edged-register-calibration/batch-main-3-2026-08-18 --go-note notes/2026-08-18-edged-register-arm-b-go.md --launch-approved --expected-sha <sha>
```

Watch and rule:

```
node scripts/run-edged-register-calibration.js --status --batch-dir exports/edged-register-calibration/batch-main-3-2026-08-18
node scripts/run-edged-register-calibration.js --resume-decision <resume_unchanged|kill_cell:<scenario>|kill_study> --batch-dir exports/edged-register-calibration/batch-main-3-2026-08-18
node scripts/run-edged-register-calibration.js --report --batch-dir exports/edged-register-calibration/batch-main-3-2026-08-18
```

After the block, before anything else — `exports/` is gitignored, so the
transcripts live on one machine until this runs:

```
node scripts/archive-run-artifacts.js exports/edged-register-calibration/batch-main-3-2026-08-18
```

then commit in the archive repo and add the run's line to its
`RUN-LEDGER.md`.

Then the endpoint reader, copied from its usage line:

```
Usage: node scripts/read-edged-register-endpoint.js --batch-dir <dir> [--out <file.jsonl>]
       [--model <id>] [--concurrency 4] [--limit N] [--mock]
```

```
node scripts/read-edged-register-endpoint.js --batch-dir exports/edged-register-calibration/batch-main-3-2026-08-18 --out exports/edged-register-calibration/batch-main-3-2026-08-18/endpoint-readings.jsonl --concurrency 4
```

Then the corridor selector and the post-block harm sweep, copied from
their usage lines:

```
Usage: node scripts/select-edged-register-corridor.js --batch-dir <dir> [--audit-readings <readings.json>] [--endpoint-readings <readings.jsonl>]
```

```
Usage: node scripts/read-edged-register-harm-sweep.js --batch-dir <dir> [--arms A|A,B,C|all]
       [--out <file.jsonl>] [--model <id>] [--concurrency 4] [--limit N] [--mock]
```

```
node scripts/read-edged-register-harm-sweep.js --batch-dir exports/edged-register-calibration/batch-main-3-2026-08-18 --arms A
```

## Stop rules

§2.7 carries forward whole (§3.6) with the §3.7 amendment on top: a
word-list match is written to the record and read; a reader **yes** pauses
generation before the next dialogue and waits for the operator's ruling.
The only options stay `resume_unchanged`, `kill_cell:<scenario>`, and
`kill_study`. The reader fails closed — a failed call, an unparsable
reply, an unreadable dialogue log, or a match past the 700-call ceiling
all pause the block exactly as a confirmed attack would.

One attended resume per job; more needs the operator's ruling. No
widening, no model change, no mid-run edit of the plan. No ruling is
recorded while the runner is still running.

The reader is a model and can be wrong both ways. Every cleared match
stays in the record with the reader's own words, and the post-block sweep
reads arm A again independently. If the sweep calls an attack on a turn
the run-time screen cleared, that disagreement is a recorded finding
about the reader, not a silent correction.

## Not licensed here

Any change to cells 193–208 in `config/tutor-agents.yaml`. Any change to
the endpoint reader, the conversion rule frozen at `b761bbbe`, the
corridor rule in §2.4, or the eligibility screen in §2.5 M-C1. Any
re-scoring of the 312 rows already read. Route 1 — the `--arms` flag now
exists, and this note still does not license a subset block. Any call
beyond the bounds priced above.

## How to turn this note into a licence

The runner enforces every step. Nothing here is a courtesy.

1. Check the route. This note is route 2, the full 312-row block, as
   ruled on 2026-08-18. Do not pass `--arms`; a subset is not covered.
2. Delete the banner on line 1 of this file. The gate rejects the note
   while it is there, and the phrase appears exactly once.
3. Add a signature block at the end: the word that licenses the launch,
   alone on its own line, then a name and date on the next line. The gate
   tests for that word on a line by itself, so it must not share a line
   with anything else.
4. Commit this file. The gate reads it from git and refuses a file with
   uncommitted changes.
5. Run `git rev-parse HEAD` on the clean checkout and pass it as
   `--expected-sha`. That is the only pin that catches the two changed
   service blobs.
6. Launch with the command above. Approval to sign is not approval to
   launch; step 6 is a separate decision.
