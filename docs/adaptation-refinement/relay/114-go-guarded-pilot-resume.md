# 114 — GO: resume the guarded pilot after the quarantine stop

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 113 (GO, rung ladder), rung 0 passed, rung 1 generation stopped
Status: **GO.** Committed before any call is made.

## 1. The approval

The user's reply, verbatim and complete:

> Resume, option 1

Option 1 was put to the user as: re-run the one lost dialogue, then let the
readers run. About 26 + 576 calls. The two other options — reading the gate
on 17 dialogues, or stopping at generation — were declined.

## 2. What happened, and why resume is the clean path

Generation finished all 18 dialogues. 17 sealed. One did not:
`outcome-pilot-10-world_102_marigold_archive_box-s516-bare`. Turn 6's
reading failed three times, each with the same code (`invalid_semantic_events`)
and the same message: the reader quoted a span that is not a literal piece
of the transcript, so the strict check refused it. Turns 1 to 5, 7 and 8
all read on the first attempt. No defensive act was involved. This is a
reader failure, not a fault in the v3.3 contract.

The launcher then stopped itself. It demands all 18 sealed before it spends
a single reader call, so it wrote `generation_quarantine_stop` and exited
with code 0. **No reader call was made.** Relay 113 §7 says a technical
failure quarantines and gets reported, and that `--resume` exists for a
clean restart. That is what this note authorises.

Real generation spend, counted from the session logs rather than the
checkpoint: **469 calls**. The checkpoint reports 445, because a quarantined
dialogue records zero reserved calls.

## 3. Scope, and why this needs no new money

The registered pilot budget is 1,116 calls (the launcher's own figure, 1116)
and the user approved it at relay 113. This note spends inside that envelope;
it does not raise it.

| Item | Calls |
|---|---|
| generation, already spent | 469 |
| dialogue 10, second attempt | up to 30 (the per-dialogue cap) |
| presence readers | 288 |
| decision readers | 288 |
| **pilot total after resume** | **up to 1,075 of 1,116** |

## 4. Zero-call preparation, already done

The child runner writes into a fresh sub-directory when its trace directory
is not empty, and the parent's evidence collector reads only the top level
of the dialogue directory. Left in place, the retry would have written one
level down, the collector would have re-read the old failed seal, and the
26 calls would have bought a second quarantine.

So the failed attempt was moved aside, inside the run directory:

    was: dialogues/outcome-pilot-10-world_102_marigold_archive_box-s516-bare
    now: quarantine/outcome-pilot-10-world_102_marigold_archive_box-s516-bare-attempt-1

Nothing was deleted and nothing was edited. The moved seal still hashes
`0b0ae142bcc68cb925209e866050d110d1665f7680fc166059cd6fd31e044851`, which is
the value the checkpoint recorded when the dialogue was quarantined. The
whole run directory was archived to the private repo and committed
(`2902d0b5`) before the move, so the first attempt survives off this branch.

The checkpoint keeps the quarantined row. On a successful retry it will hold
two rows for dialogue 10 — one quarantined, one complete — and the reader
phases read the complete ones. The record of the loss is not overwritten.

## 5. The cost of a retry, stated before it is paid

This is a second draw at one cell. The other 17 cells had one draw each.
Seed, world and version of the tutor are fixed, so the scenario reproduces;
the tutor and learner replies are a fresh sample.

**This must be named in the gate reading.** If dialogue 10's numbers sit at
the edge of its group, the reading says so and says it was the retried one.
Only one retry is authorised. A second failure at this cell is reported, not
re-run.

## 6. Command

Copied from relay 113 §4 with the one flag the script's own usage string
names for a restart (`[--resume]`), and with the GO note moved to this one:

```bash
node scripts/run-adaptive-warrant-outcome-pilot.js \
  --go-note docs/adaptation-refinement/relay/114-go-guarded-pilot-resume.md \
  --accept-charges \
  --out .tutor-stub-auto-eval/guarded-learner-pilot-2026-08-15 \
  --instrument-freeze docs/adaptation-refinement/guarded-pilot/guarded-instrument-freeze.json \
  --manifest docs/adaptation-refinement/guarded-pilot/guarded-pilot-manifest.json \
  --learner-profile overconfident \
  --resume
```

Run from the worktree `../ms-guarded-learner` on branch
`build/guarded-learner-v3.3`. The launcher re-checks every pin at launch, so
if anything has moved since relay 113 the run refuses to start.

On resume the launcher skips the 17 sealed dialogues, re-runs dialogue 10,
and only then builds the case corpus and spends the reader calls.

## 7. Stop rules

Carried from relay 113 §7, unchanged, plus one:

- The **primary endpoint is measured, never gated.** A null is a finding.
- A deferral mislabel — a defensive turn read as `low_agency_deferral` — is
  **terminal**. Stop and report.
- Persona collapse: if the guarded learner stops over-claiming, stop.
- A technical failure quarantines and gets reported. **Never patch a live
  run.**
- The budget stays 1,116 calls. It is not raised.
- **New: one retry only.** If dialogue 10 quarantines again, stop and
  report. Do not spend a third attempt, and do not change the launcher's
  count of 18 to read the gate on 17.

## 8. Counter

- after rung 0: **10,486 / 19,337**
- generation, counted from the logs: **469** → **10,955 / 19,337**
- this note: up to **606** → **11,561 / 19,337**, leaving **7,776**

## 9. After

Archive again before anything else: `npm run archive:runs` with the run
directory named, then commit in the private repo. Then the gate report, then
a decision on the main block. Predictions for the main block get written from
pilot evidence only.

NEVER push this branch.
