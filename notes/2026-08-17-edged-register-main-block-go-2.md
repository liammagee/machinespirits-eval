# GO — edged-register main block (replacement, after amendments 1 and 2)

This note replaces `notes/2026-08-17-edged-register-main-block-go.md`.
That note is spent: the block it launched (`batch-main-2026-08-17`)
latched after four rows and is abandoned, and its plan SHA no longer
exists. Nothing from it is resumed.

Registration: Part 3 of `notes/2026-08-16-edged-register-calibration-draft.md`,
frozen at commit `4cd28242`, amended at §3.7 (the harm reader) in commits
`935b9a6f` and `421e491f`, and at §3.8 (this note's own gate) in
`22dbbc31`.

Main-block plan SHA-256:
`31b7d77bfe7832a3e8b8f729753128432760ed5d7dbf151ac85c5519d52ed607`
Scenario source SHA-256:
`e1fc711a1cf16917614e85aaf6d2fd7d27a51a3be53baeb3d650e3899f29a4fe`

## Why there is a second note

The first launch stopped at 05:40 UTC on 2026-08-17, after four rows.
Two of the four raised a harm flag on the same two words, `your
capacity`, and neither turn attacked anyone — one states what would
count as evidence, the other restates the learner's own claim. Those two
words produced all 11 calibration matches in 109 rows. Under the
calibration rule a 312-row block would have stopped about every twelfth
row, for eight hours, over a phrase the tutor uses to teach.

Amendment 1 (§3.7) changes what a match *does*, in the main block only.
The word list is untouched and every match is still written to the
record; a model reader then answers one question — does this turn attack
the learner as a person — and only its yes pauses the block. That
changes the main plan SHA, which is why the old batch cannot be resumed:
the runner's drift gate refuses it, as intended.

## What is asked

The paid main block: three versions of the tutor over the four kept
cells. A = adaptive-edged (cell 207, two-pass), B = yoked warm delivery
(cell 208), C = router-warm (cell 206, byte-identical to the calibration
arm). Warm-only menus in B and C; `face_threat` stays out of every menu;
sarcasm is a manner device only (§2.10, §3.6).

Size and guardrail, copied from the runner's `--dry-run-main` output:

> [edged-main] exact-test size: 104 rows per arm (26 per cell), 312 rows over 3 arms, power 0.803487 at baseline 0.479167 vs 0.679167
> [edged-main] 312 main jobs, hard cap 350 rows
> [edged-main] harm guardrail: report_all_matches_pause_on_reader_confirmed_attack, 1 reader call per match, ceiling 700 calls

Jobs interleave so every consecutive dozen covers all twelve
arm-by-cell pairs. Generation only; zero judge calls at generation time.

## Budget cap and priced calls

- Generated rows: **312 planned, hard cap 350** (state-carried; the
  runner stops at the cap). The cap counts *attempts*, so a retry
  replaces a failed row rather than adding a completed one — each arm
  holds exactly 104 jobs whatever the cap allows.
- Generation calls: about 6,240 planned (the registered basis of ~20
  calls per row, §3.2), at most about 7,000 at the cap.
- Endpoint reader (`scripts/read-edged-register-endpoint.js`, one call
  per row, §3.4): 312 planned, at most 350.
- Register and stance readings, arm A only: the kept cells script 3, 3,
  3, and 2 learner turns, so at most four tutor turns per dialogue; at
  two readings per turn the bound is about 830 calls over arm A's 104
  dialogues. Only edged turns are read, so the real count is lower.
- **Harm reader at run time** (new, §3.7): one call per word-list match,
  **ceiling 700**, carried in state. The block pauses rather than reads
  past it. Calibration matched 0.10 times per row; arm A speaks edged
  registers, so it may match far more often, and the ceiling is where
  that stops being free.
- **Post-block harm sweep** (new, §3.7,
  `scripts/read-edged-register-harm-sweep.js`): arm A only, every tutor
  turn, **bounded at 416 calls** (104 rows × 4 turns). Not part of the
  block; run after it.
- About 8 attended hours at 4 lanes (the registered pace, scaled from
  285 to 312 rows).

## Pins, re-computed 2026-08-17 (§3.5, §3.7)

| Pin | Frozen | Now | |
|---|---|---|---|
| Endpoint reader blob | `cd44d452` | `cd44d452` | unchanged |
| Corridor selector blob | `5455c766` | `5455c766` | unchanged |
| Calibration plan sha256 | `121b55d1…` | `121b55d1…` | unchanged |
| `endpoint-readings.jsonl` sha256 | `43e45b42…0936c` | `43e45b42…0936c` | unchanged |
| Runner blob | `07b1c0d6` | `429db35f` | **changed — disclosed** |
| Grid blob | — | `2d099edc` | **changed by amendment 1** |
| Harm reader blob | — | `823a131c` | new file |
| Harm sweep blob | — | `d990a3be` | new file |

The runner changed three times since the §3.5 freeze: commit `7df6ebf6`
added the main-block mode (zero-call build, 20 tests), `935b9a6f` added
the reader screen and its call ceiling (15 more tests), and amendment 2
(§3.8) tightened this note's own gate — `GO` must sit on a line of its
own, and a note still carrying its draft banner is refused. The reader
rule for the *endpoint* stays frozen at `b761bbbe` (§2.16.1) and is
untouched by all three. Signing below accepts the runner changes; every
other pin is unchanged.

Both plan SHAs survived all three: the calibration plan is byte-identical
and the main plan moved only at amendment 1.

Stack, carried in the plan and shown in the copied commands below:
generation codex `gpt-5.6-luna` both seats, judge claude-code Sonnet 5,
4 lanes, never nemotron/kimi.

## Seeds and batch id

Burn set from the run search: 119 runs in `evaluation_runs` carry an
`edged-register-calibration` description, over two burned batch ids —
`batch-2026-08-17` (screen and confirm) and `batch-main-2026-08-17` (the
abandoned launch, six rows, archived). Fresh batch id for this block:
**`batch-main-2-2026-08-17`**. No other seed enters the design.

## Commands (copied, not composed)

Per-arm generation commands the runner will issue, copied from
`exports/edged-register-calibration/plan-main-block.json` (the absolute
node path is the runner's own resolved interpreter; these are shown for
review, not typed by hand):

```
/opt/homebrew/Cellar/node@22/22.22.3/bin/node scripts/eval-cli.js run --profiles cell_207_id_director_edged_register_two_pass_adaptive_edged --scenario charisma_desire_resistance_breakthrough_question_flood_sustained --runs 1 --parallelism 1 --skip-rubric --tutor-model codex.gpt-5.6-luna --learner-model codex.gpt-5.6-luna --description edged-register-calibration <batch-id> main job 1 charisma_desire_resistance_breakthrough_question_flood_sustained attempt 1
/opt/homebrew/Cellar/node@22/22.22.3/bin/node scripts/eval-cli.js run --profiles cell_208_id_director_edged_register_yoked_warm_delivery --scenario charisma_desire_resistance_breakthrough_question_flood_sustained --runs 1 --parallelism 1 --skip-rubric --tutor-model codex.gpt-5.6-luna --learner-model codex.gpt-5.6-luna --description edged-register-calibration <batch-id> main job 2 charisma_desire_resistance_breakthrough_question_flood_sustained attempt 1
/opt/homebrew/Cellar/node@22/22.22.3/bin/node scripts/eval-cli.js run --profiles cell_206_id_director_edged_register_calibration_warm --scenario charisma_desire_resistance_breakthrough_question_flood_sustained --runs 1 --parallelism 1 --skip-rubric --tutor-model codex.gpt-5.6-luna --learner-model codex.gpt-5.6-luna --description edged-register-calibration <batch-id> main job 3 charisma_desire_resistance_breakthrough_question_flood_sustained attempt 1
```

Launch, from the runner's usage line — run after this note is committed,
with `<sha>` = `git rev-parse HEAD` on the clean checkout:

```
node scripts/run-edged-register-calibration.js --main-block --batch-dir exports/edged-register-calibration/batch-main-2-2026-08-17 --go-note notes/2026-08-17-edged-register-main-block-go-2.md --launch-approved --expected-sha <sha>
```

Watch and rule, from the same usage line:

```
node scripts/run-edged-register-calibration.js --status --batch-dir exports/edged-register-calibration/batch-main-2-2026-08-17
node scripts/run-edged-register-calibration.js --resume-decision <resume_unchanged|kill_cell:<scenario>|kill_study> --batch-dir exports/edged-register-calibration/batch-main-2-2026-08-17
node scripts/run-edged-register-calibration.js --report --batch-dir exports/edged-register-calibration/batch-main-2-2026-08-17
```

After the block, before anything else:

```
node scripts/archive-run-artifacts.js exports/edged-register-calibration/batch-main-2-2026-08-17
```

then commit in the archive repo and add the run's line to its
`RUN-LEDGER.md`.

Then the post-block harm sweep (§3.7), arm A, bounded at 416 calls:

```
node scripts/read-edged-register-harm-sweep.js --batch-dir exports/edged-register-calibration/batch-main-2-2026-08-17 --arms A
```

## Stop rules

§2.7 carries forward whole (§3.6) with the §3.7 amendment on top: a
word-list match is written to the record and read; a reader **yes**
pauses generation before the next dialogue and waits for my ruling. The
only options stay `resume_unchanged`, `kill_cell:<scenario>`, and
`kill_study`. The reader fails closed — a failed call, an unparsable
reply, an unreadable dialogue log, or a match past the 700-call ceiling
all pause the block exactly as a confirmed attack would.

One attended resume per job; more needs my ruling. No widening, no model
change, no mid-run edit of the plan. I record no ruling while the runner
is still running.

The reader is a model and can be wrong both ways. Every cleared match
stays in the record with the reader's own words, and the post-block
sweep reads arm A again independently. If the sweep calls an attack on a
turn the run-time screen cleared, that disagreement is a recorded
finding about the reader, not a silent correction.

This note, once signed, licenses generation and the priced scoring calls
above. Endpoint analysis — the A-versus-C exact test on the reader's
yes, the A-versus-B read at the first edge moment — comes after the
block, on the frozen rules, and needs no new approval; any call beyond
the priced bounds does.

GO
Liam Magee, 08/17/2026
